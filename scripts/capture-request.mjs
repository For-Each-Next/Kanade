/**
 * @file scripts/capture-request.mjs
 * Purpose: Recognize wiki write requests before a live documentation capture sends them.
 * Contents: Read-only Action API operations and native/REST write boundaries.
 */

const readActions = new Set([
    'query',
    'parse',
    'expandtemplates',
    'templatedata',
    'help',
    'paraminfo',
    'opensearch',
    'languagesearch',
    'compare',
    'sitematrix',
    'wbgetentities',
    'wbsearchentities',
]);

const dispatchFields = new Set(['action', 'wpSave', 'wpPreview', 'wpDiff']);

/** PHP normalizes form keys before MediaWiki selects an action or edit button. */
function hasAmbiguousDispatchFields(fields) {
    for (const key of fields.keys()) {
        const normalized = key
            .replace(/^ +/u, '')
            .split(/[\0[]/u)[0]
            .replace(/[ .]/gu, '_');
        if (
            dispatchFields.has(normalized) &&
            (key !== normalized || fields.getAll(key).length !== 1)
        )
            return true;
    }
    return false;
}

function nativeFormFields(request, contentType) {
    if (contentType === 'application/x-www-form-urlencoded')
        return new URLSearchParams(request.postData() ?? '');
    if (contentType !== 'multipart/form-data') return null;
    const header = request.headers()['content-type'];
    const boundary = header.match(/boundary=(?:"([^"\r\n]+)"|([^;\s]+))/u);
    if (!boundary) return null;
    const parts = (request.postData() ?? '').split(
        `--${boundary[1] ?? boundary[2]}`,
    );
    if (parts.shift() !== '' || !/^--\r?\n?$/u.test(parts.pop() ?? ''))
        return null;
    const fields = new URLSearchParams();
    for (const part of parts) {
        const field = part.match(
            /^\r\nContent-Disposition: form-data; name="([^"\r\n]+)"\r\n\r\n([\s\S]*)\r\n$/u,
        );
        if (!field || fields.has(field[1])) return null;
        fields.set(field[1], field[2]);
    }
    return fields;
}

/** Unknown API POST bodies, including multipart data, cannot establish a read. */
export function isWikiWriteRequest(request) {
    const url = new URL(request.url());
    const method = request.method();
    if (['PUT', 'PATCH', 'DELETE'].includes(method)) return true;
    const headers = request.headers();
    const contentType = headers['content-type']
        ?.split(';')[0]
        .trim()
        .toLowerCase();
    const nativeFields = nativeFormFields(request, contentType);
    if (
        hasAmbiguousDispatchFields(url.searchParams) ||
        (nativeFields && hasAmbiguousDispatchFields(nativeFields))
    )
        return true;
    const queryAction = url.searchParams.get('action');
    const bodyAction = nativeFields?.get('action') ?? null;
    if (
        queryAction !== null &&
        bodyAction !== null &&
        queryAction !== bodyAction
    )
        return true;
    const action = bodyAction ?? queryAction;
    if (url.searchParams.has('wpSave') || nativeFields?.has('wpSave'))
        return true;
    if (
        method === 'POST' &&
        url.pathname.endsWith('/index.php') &&
        nativeFields &&
        (!action || action === 'edit' || action === 'submit') &&
        !nativeFields.has('wpSave') &&
        !nativeFields.has('action') &&
        (nativeFields.has('wpPreview') || nativeFields.has('wpDiff'))
    )
        return false;
    if (action === 'submit') return true;
    if (url.pathname.endsWith('/api.php')) {
        if (
            method === 'POST' &&
            contentType !== 'application/x-www-form-urlencoded'
        )
            return true;
        return action ? !readActions.has(action) : method === 'POST';
    }
    // ConfirmEdit's native edit-page risk telemetry does not submit wiki content.
    // https://github.com/wikimedia/mediawiki-extensions-ConfirmEdit/blob/master/includes/Api/Rest/Handler/PostHCaptchaTokenForBlockHandler.php
    if (
        method === 'POST' &&
        /\/rest\.php\/confirmedit\/v0\/hcaptcha\/blocktoken$/u.test(
            url.pathname,
        )
    )
        return false;
    return (
        method === 'POST' &&
        (/\/rest\.php(?:\/|$)/u.test(url.pathname) ||
            /\/api\/rest_v1\//u.test(url.pathname) ||
            url.pathname.endsWith('/index.php'))
    );
}
