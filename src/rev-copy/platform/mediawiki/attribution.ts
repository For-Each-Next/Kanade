/**
 * @file src/rev-copy/platform/mediawiki/attribution.ts
 * Purpose: Resolve attribution titles, revisions, languages, and interlanguage links.
 *
 * Contents: Tab-scoped query cache, validated read-only queries, and source/destination resolution.
 */

import { getWikiApiUrl, parsePageReference } from '../../domain/page-reference';
import type {
    AttributionPage,
    PageReference,
} from '../../domain/page-reference';
import type { WikiSite } from '../../domain/wiki-site';
import type { PageContext } from './context';
import { isObject as isRecord } from '../../../library/data-validation/records';
import { isRevisionTimestamp } from './response';

type Parameters = Record<string, string | number>;
type Query = <T>(
    site: WikiSite,
    parameters: Parameters,
    validate: (response: unknown) => T,
) => Promise<T>;

interface QueryCache {
    responses: Map<string, unknown>;
    pending: Map<string, Promise<unknown>>;
}

const maxCachedResponses = 200;
const tabCaches = new WeakMap<object, QueryCache>();

function queryPage(response: unknown): {
    query: Record<string, unknown>;
    page: Record<string, unknown>;
} {
    if (
        !isRecord(response) ||
        response.error ||
        !isRecord(response.query) ||
        !Array.isArray(response.query.pages) ||
        response.query.pages.length !== 1 ||
        !isRecord(response.query.pages[0]) ||
        response.query.pages[0].invalid !== undefined
    ) {
        throw new Error('The wiki did not return a valid page.');
    }
    return { query: response.query, page: response.query.pages[0] };
}

function createQuery(current: PageContext): Query {
    let cache = tabCaches.get(mw);
    if (!cache) {
        cache = { responses: new Map(), pending: new Map() };
        tabCaches.set(mw, cache);
    }
    const { responses, pending } = cache;
    return async (site, parameters, validate) => {
        const endpoint = getWikiApiUrl(site);
        const params = { action: 'query', formatversion: 2, ...parameters };
        const key = JSON.stringify([
            endpoint,
            Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
        ]);
        let request = pending.get(key);
        if (!responses.has(key) && !request) {
            request = (async (): Promise<unknown> => {
                if (site.interwiki === current.site.interwiki) {
                    return new mw.Api().get(params);
                }
                const url = new URL(endpoint);
                for (const [name, value] of Object.entries(params)) {
                    url.searchParams.set(name, String(value));
                }
                url.searchParams.set('format', 'json');
                url.searchParams.set('origin', '*');
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 15000);
                try {
                    const response = await fetch(url.href, {
                        credentials: 'omit',
                        redirect: 'error',
                        signal: controller.signal,
                    });
                    if (!response.ok)
                        throw new Error('The remote wiki request failed.');
                    return await response.json();
                } finally {
                    clearTimeout(timeout);
                }
            })();
            pending.set(key, request);
        }
        try {
            const response = responses.has(key)
                ? responses.get(key)
                : await request;
            // Validate on every use: a missing destination may be allowed for a
            // summary but must fail (and remain retryable) for a talk notice.
            const result = validate(response);
            responses.delete(key);
            responses.set(key, response);
            if (responses.size > maxCachedResponses) {
                responses.delete(responses.keys().next().value!);
            }
            return result;
        } catch (error) {
            responses.delete(key);
            throw error;
        } finally {
            if (pending.get(key) === request) pending.delete(key);
        }
    };
}

async function resolvePage(
    reference: PageReference,
    requireRevision: boolean,
    query: Query,
): Promise<AttributionPage> {
    return query(
        reference.site,
        {
            prop: 'revisions',
            rvprop: 'ids|timestamp',
            meta: 'siteinfo',
            siprop: 'general',
            ...(reference.revisionId !== undefined
                ? { revids: reference.revisionId }
                : {
                      titles: reference.pageTitle ?? '',
                      redirects: 1,
                      rvlimit: 1,
                  }),
        },
        (response) => {
            const { query: pageQuery, page } = queryPage(response);
            if (
                !isRecord(pageQuery.general) ||
                typeof pageQuery.general.lang !== 'string' ||
                !/^[a-z][a-z0-9-]{0,30}$/iu.test(pageQuery.general.lang) ||
                typeof page.title !== 'string' ||
                !page.title.trim()
            ) {
                throw new Error(
                    'The wiki did not return a valid title and content language.',
                );
            }
            const result: AttributionPage = {
                site: {
                    ...reference.site,
                    language: pageQuery.general.lang,
                },
                pageTitle: page.title,
                ...(reference.sectionId
                    ? { sectionId: reference.sectionId }
                    : {}),
            };
            if (page.missing !== undefined) {
                if (requireRevision || reference.revisionId !== undefined) {
                    throw new Error(
                        'The selected page or revision does not exist.',
                    );
                }
                return result;
            }
            const revision = Array.isArray(page.revisions)
                ? page.revisions[0]
                : undefined;
            if (
                !isRecord(revision) ||
                typeof revision.revid !== 'number' ||
                !Number.isSafeInteger(revision.revid) ||
                revision.revid <= 0 ||
                (reference.revisionId !== undefined &&
                    revision.revid !== reference.revisionId) ||
                !isRevisionTimestamp(revision.timestamp)
            ) {
                throw new Error(
                    'The selected revision and its timestamp are unavailable.',
                );
            }
            return {
                ...result,
                revisionId: revision.revid,
                timestamp: revision.timestamp,
            };
        },
    );
}

async function linkedReference(
    reference: PageReference,
    basis: Pick<AttributionPage, 'site' | 'pageTitle' | 'revisionId'>,
    query: Query,
): Promise<PageReference> {
    if (reference.site.interwiki === basis.site.interwiki) {
        return { ...reference, pageTitle: basis.pageTitle };
    }
    const [project, language] = reference.site.interwiki.split(':');
    if (!language || basis.site.interwiki.split(':')[0] !== project) {
        throw new Error(
            'Enter a page title when copying between wiki projects.',
        );
    }
    return query(
        basis.site,
        {
            prop: 'langlinks',
            ...(basis.revisionId !== undefined && basis.revisionId > 0
                ? { revids: basis.revisionId }
                : { titles: basis.pageTitle, redirects: 1 }),
            lllang: language,
            llprop: 'url',
            lllimit: 1,
        },
        (response) => {
            const { page } = queryPage(response);
            const links: unknown[] = Array.isArray(page.langlinks)
                ? page.langlinks
                : [];
            for (const link of links) {
                if (!isRecord(link) || link.lang !== language) continue;
                const title =
                    typeof link.title === 'string' ? link.title : link['*'];
                if (typeof title !== 'string' || !title.trim()) continue;
                return { ...reference, pageTitle: title };
            }
            throw new Error(
                'No interlanguage link was found; enter the page title.',
            );
        },
    );
}

function isShorthand(reference: PageReference): boolean {
    return (
        reference.pageTitle === undefined && reference.revisionId === undefined
    );
}

export async function resolveAttributionPages(
    fromInput: string,
    toInput: string,
    current: PageContext,
    notice: boolean,
): Promise<{ from: AttributionPage; to: AttributionPage }> {
    const fromReference = parsePageReference(fromInput, current);
    const toReference = parsePageReference(toInput, current);
    const query = createQuery(current);
    const [initialFrom, initialTo] = await Promise.all([
        isShorthand(fromReference)
            ? undefined
            : resolvePage(fromReference, true, query),
        isShorthand(toReference)
            ? undefined
            : resolvePage(toReference, notice, query),
    ]);
    const bothShorthand =
        isShorthand(fromReference) && isShorthand(toReference);
    const from =
        initialFrom ??
        (await resolvePage(
            await linkedReference(fromReference, initialTo ?? current, query),
            true,
            query,
        ));
    const to =
        initialTo ??
        (await resolvePage(
            await linkedReference(
                toReference,
                bothShorthand ? current : from,
                query,
            ),
            notice,
            query,
        ));
    return { from, to };
}
