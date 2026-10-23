/**
 * @file src/vg-stub-creator/platform/mediawiki/page-title-checks.ts
 * Purpose: Checks exact page identities and Chinese variants without following redirects.
 *
 * Table of contents:
 * 1. Imports
 * 2. PageLookupApi
 * 3. fetchExistingPageTitles
 * 4. fetchPageTitleChecks
 * 5. getExistingTitleContext
 * 6. createExistingPageTitleMatch
 * 7. getTitleResponseRecord
 */

import { asRecord as getTitleResponseRecord } from '../../../library/data-validation/records.ts';

import { normalizePageTitle as normalizeTitle } from '../../domain/wiki-titles.ts';
import type { PageTitleMatch } from '../../domain/pre-save-actions.ts';

export interface PageLookupApi {
    get(params: Record<string, string>): PromiseLike<unknown>;
}

/**
 * Checks requested titles for exact pages and Chinese conversion matches.
 *
 * @param api - MediaWiki API client.
 * @param titles - Requested page titles.
 * @returns Page title matches.
 */
export async function fetchExistingPageTitles(
    api: PageLookupApi,
    titles: Array<string>,
): Promise<Array<PageTitleMatch>> {
    const requested = [...new Set(titles.map(normalizeTitle).filter(Boolean))];
    const results: PageTitleMatch[] = [];
    for (let index = 0; index < requested.length; index += 50) {
        const batch = requested.slice(index, index + 50);
        const exact = await fetchPageTitleChecks(api, batch);
        const missing = exact
            .filter((result) => !result.exists)
            .map((result) => result.requestedTitle);
        const variants = missing.length
            ? await Promise.all(
                  ['zh-hans', 'zh-hant'].map((variant) =>
                      fetchPageTitleChecks(api, missing, variant),
                  ),
              )
            : [];
        for (const result of exact) {
            const existingVariant = variants
                .flat()
                .find(
                    (candidate) =>
                        candidate.requestedTitle === result.requestedTitle &&
                        candidate.exists,
                );
            results.push(result.exists ? result : (existingVariant ?? result));
        }
    }
    return results;
}

/** Checks one batch without following redirects or inventing missing results. */
async function fetchPageTitleChecks(
    api: PageLookupApi,
    titles: string[],
    variant?: string,
): Promise<PageTitleMatch[]> {
    const params: Record<string, string> = {
        action: 'query',
        formatversion: '2',
        titles: titles.join('|'),
    };
    if (variant != null) {
        params.converttitles = '1';
        params.variant = variant;
    }
    const context = getExistingTitleContext(await api.get(params));
    return titles.map((title) => createExistingPageTitleMatch(title, context));
}

/** Validates API pages and their normalization/conversion aliases. */
function getExistingTitleContext(data: unknown): {
    aliases: Map<string, string>;
    pages: Map<string, { exists: boolean; title: string }>;
} {
    const response = getTitleResponseRecord(data);
    const error = getTitleResponseRecord(response?.error);
    if (response?.error != null) {
        throw new Error(
            `Title request failed: ${String(error?.info || error?.code || 'API error')}`,
        );
    }
    const query = getTitleResponseRecord(response?.query);
    const rawPages = query?.pages;
    const pageValues = Array.isArray(rawPages) ? rawPages : [];
    if (query == null || pageValues.length === 0) {
        throw new Error('Title request failed: No valid page response.');
    }
    const pages = new Map<string, { exists: boolean; title: string }>();
    for (const value of pageValues) {
        const page = getTitleResponseRecord(value);
        const title =
            typeof page?.title === 'string' ? normalizeTitle(page.title) : '';
        const missing = page?.missing === true;
        if (
            page == null ||
            title === '' ||
            page.invalid != null ||
            (Object.hasOwn(page, 'missing') && !missing) ||
            (!missing &&
                (typeof page.pageid !== 'number' ||
                    !Number.isInteger(page.pageid) ||
                    page.pageid <= 0)) ||
            pages.has(title)
        ) {
            throw new Error(
                `Title request failed: No valid page for ${title}.`,
            );
        }
        pages.set(title, { exists: !missing, title });
    }
    const aliases = new Map<string, string>();
    for (const values of [query.normalized, query.converted]) {
        if (values === undefined) continue;
        if (!Array.isArray(values)) {
            throw new Error('Title request failed: Invalid title aliases.');
        }
        for (const value of values) {
            const alias = getTitleResponseRecord(value);
            const from =
                typeof alias?.from === 'string'
                    ? normalizeTitle(alias.from)
                    : '';
            const to =
                typeof alias?.to === 'string' ? normalizeTitle(alias.to) : '';
            if (
                from === '' ||
                to === '' ||
                (aliases.has(from) && aliases.get(from) !== to)
            ) {
                throw new Error('Title request failed: Invalid title aliases.');
            }
            if (from !== to) aliases.set(from, to);
        }
    }
    return { aliases, pages };
}

/** Extracts one checked title while preserving the exact requested identity. */
function createExistingPageTitleMatch(
    title: string,
    context: {
        aliases: Map<string, string>;
        pages: Map<string, { exists: boolean; title: string }>;
    },
): PageTitleMatch {
    let resolvedTitle = normalizeTitle(title);
    const visited = new Set<string>();
    while (context.aliases.has(resolvedTitle)) {
        if (visited.has(resolvedTitle)) {
            throw new Error('Title request failed: Cyclic title aliases.');
        }
        visited.add(resolvedTitle);
        resolvedTitle = context.aliases.get(resolvedTitle)!;
    }
    const page = context.pages.get(resolvedTitle);
    if (page == null) {
        throw new Error(
            `Title request failed: No valid page for ${resolvedTitle}.`,
        );
    }
    return { exists: page.exists, requestedTitle: title, title: page.title };
}
