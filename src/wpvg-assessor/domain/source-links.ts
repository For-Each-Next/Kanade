/**
 * @file src/wpvg-assessor/domain/source-links.ts
 * Purpose: Recognize supported assessment lists and safe article launch URLs.
 * Contents: Source identity, title routes, and query-marker preservation.
 */

import { getTitleNamespaceId } from '../../library/wiki-titles/wikipedia.ts';

export const ASSESSOR_LAUNCHER_PARAMETER = 'wpvg-assessor';
const WIKI_ORIGIN = 'https://zh.wikipedia.org';
const PETSCAN_ORIGINS = new Set([
    'https://petscan.toolforge.org',
    'https://petscan.wmcloud.org',
]);

/** Parse navigation URLs without accepting embedded credentials. */
function readPageUrl(value: string | null, base?: string): URL | null {
    if (value == null || value.trim() === '') return null;
    try {
        const url = new URL(value, base);
        return url.username || url.password ? null : url;
    } catch {
        return null;
    }
}

/** Read canonical and Chinese-variant title routes without losing colons. */
function readWikiTitle(url: URL | null): string | null {
    if (url?.origin !== WIKI_ORIGIN) return null;
    let title: string;
    if (url.pathname === '/w/index.php') {
        const titles = url.searchParams.getAll('title');
        if (titles.length !== 1) return null;
        title = titles[0];
    } else {
        const route = url.pathname.match(
            /^\/(?:wiki|zh(?:-(?:hans|hant|cn|tw|hk|mo|sg|my))?)\/(.+)$/u,
        );
        if (route == null || url.searchParams.has('title')) return null;
        try {
            title = decodeURIComponent(route[1]);
        } catch {
            return null;
        }
    }
    const normalized = title.replace(/_/gu, ' ').trim().replace(/^:/u, '');
    return normalized &&
        !/[#<>[\]{}|]/u.test(normalized) &&
        !Array.from(normalized).some((character) => {
            const code = character.charCodeAt(0);
            return code < 32 || code === 127;
        })
        ? normalized
        : null;
}

/** Only supported PetScan documents run without the MediaWiki runtime. */
export function isAssessorExternalSource(value: string): boolean {
    const url = readPageUrl(value);
    return (
        url != null &&
        PETSCAN_ORIGINS.has(url.origin) &&
        ['/', '/index.php'].includes(url.pathname)
    );
}

export function getAssessorSourceKind(
    value: string,
): 'petscan' | 'wiki' | null {
    if (isAssessorExternalSource(value)) return 'petscan';
    const title = readWikiTitle(readPageUrl(value));
    if (title == null || getTitleNamespaceId(title, 'zhwiki') !== 102)
        return null;
    return /^[電电]子[遊游][戲戏]\/新[進进][條条]目$/u.test(
        title.slice(title.indexOf(':') + 1).trim(),
    )
        ? 'wiki'
        : null;
}

/** Remove only the launch marker, retaining unrelated query encodings. */
export function removeAssessorLauncherParameter(url: URL): void {
    const parameters = url.search ? url.search.slice(1).split('&') : [];
    const retained = parameters.filter((parameter) => {
        const name = parameter.split('=', 1)[0].replace(/\+/gu, ' ');
        try {
            return decodeURIComponent(name) !== ASSESSOR_LAUNCHER_PARAMETER;
        } catch {
            return true;
        }
    });
    url.search = retained.length ? `?${retained.join('&')}` : '';
}

/** Preserve native navigation while marking current article and talk views. */
export function getAssessorDestinationHref(
    value: string | null,
    base: string,
): string | null {
    if (value == null || value.trim().startsWith('#')) return null;
    const url = readPageUrl(value, base);
    const title = readWikiTitle(url);
    if (url == null || title == null) return null;
    const namespace = getTitleNamespaceId(title, 'zhwiki');
    if (namespace !== 0 && namespace !== 1) return null;
    if (
        ['diff', 'redlink', 'veaction', 'curid', 'oldid'].some((key) =>
            url.searchParams.has(key),
        ) ||
        url.searchParams
            .getAll('action')
            .some((action) => action !== 'view' && action !== '')
    ) {
        return null;
    }
    const source = readPageUrl(base);
    if (
        url.hash &&
        source?.origin === url.origin &&
        source.pathname === url.pathname &&
        source.search === url.search
    ) {
        return null;
    }
    const markers = url.searchParams.getAll(ASSESSOR_LAUNCHER_PARAMETER);
    if (markers.length !== 1 || markers[0] !== '1') {
        removeAssessorLauncherParameter(url);
        url.search += `${url.search ? '&' : '?'}${ASSESSOR_LAUNCHER_PARAMETER}=1`;
    }
    return url.href;
}
