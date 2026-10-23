/**
 * @file src/vg-stub-creator/platform/network/crosswiki.ts
 * Purpose: Fetches cross-wiki page metadata.
 *
 * Table of contents:
 * 1. Imports
 * 2. fetchEnwikiMetadata
 * 3. addWikidataIdentifiers
 * 4. buildEnwikiMetadataUrl
 * 5. buildWikidataEntityUrl
 * 6. parseEnwikiMetadata
 * 7. parseWikidataIdentifiers
 * 8. createBlankEnwikiMetadata
 * 9. createBlankExternalIdentifiers
 * 10. getClaimValue
 */

import { readQueryPage } from '../mediawiki/query-response.ts';

/**
 * Fetches metadata for an English Wikipedia page.
 *
 * @param title - English Wikipedia page title.
 * @param options - Fetch options.
 * @param options.fetcher - Fetch implementation.
 * @returns Page metadata.
 */
export async function fetchEnwikiMetadata(
    title: string,
    options: any = {},
): Promise<any> {
    const fetcher = options.fetcher || fetch;

    try {
        const enwikiMetadataUrlResult = buildEnwikiMetadataUrl(title);
        const response = await fetcher(enwikiMetadataUrlResult, {
            headers: {
                accept: 'application/json',
            },
        });

        if (!response.ok) {
            return createBlankEnwikiMetadata(title);
        }

        const responseDataA = await response.json();
        const metadata = parseEnwikiMetadata(title, responseDataA);

        if (metadata.wikidataId === '') {
            return metadata;
        }

        return await addWikidataIdentifiers(metadata, fetcher);
    } catch (_error) {
        return createBlankEnwikiMetadata(title);
    }
}

/**
 * Adds Wikidata identifiers when their entity request succeeds.
 *
 * @param metadata - Article metadata.
 * @param fetcher - Fetch implementation.
 * @returns Result when the function
 *   adds wikidata identifiers when their entity
 *   request succeeds.
 */
async function addWikidataIdentifiers(metadata: any, fetcher: any) {
    try {
        const wikidataEntityUrlResult = buildWikidataEntityUrl(
            metadata.wikidataId,
        );
        const response = await fetcher(wikidataEntityUrlResult, {
            headers: { accept: 'application/json' },
        });

        if (!response.ok) {
            return metadata;
        }

        const responseData = await response.json();
        const result = {
            ...metadata,
            ...parseWikidataIdentifiers(metadata.wikidataId, responseData),
        };
        return result;
    } catch (_error) {
        return metadata;
    }
}

/**
 * Builds the English Wikipedia metadata API URL.
 *
 * @param title - English Wikipedia page title.
 * @returns API URL.
 */
function buildEnwikiMetadataUrl(title: string): string {
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        origin: '*',
        prop: 'pageprops',
        titles: title,
    });

    const result = [
        'https://en.wikipedia.org/w/api.php',
        '?',
        params.toString(),
        '',
    ].join('');
    return result;
}

/**
 * Builds the Wikidata entity API URL for external game identifiers.
 *
 * @param wikidataId - Wikidata entity ID.
 * @returns API URL.
 */
function buildWikidataEntityUrl(wikidataId: string): string {
    const params = new URLSearchParams({
        action: 'wbgetentities',
        format: 'json',
        origin: '*',
        ids: wikidataId,
        props: 'claims',
    });

    const result = [
        'https://www.wikidata.org/w/api.php',
        '?',
        params.toString(),
        '',
    ].join('');
    return result;
}

/**
 * Parses English Wikipedia metadata from an API response.
 *
 * @param title - Fallback page title.
 * @param data - API response data.
 * @returns Page metadata.
 */
function parseEnwikiMetadata(title: string, data: any): any {
    const page = readQueryPage(
        data,
        'English Wikipedia metadata lookup returned an invalid page.',
    );

    if (page.missing === true) {
        const result = {
            ...createBlankEnwikiMetadata(title),
            pageExists: false,
        };
        return result;
    }

    const result = {
        pageExists: true,
        title: page.title || title,
        wikidataId:
            (page.pageprops as Record<string, unknown> | undefined)
                ?.wikibase_item || '',
        ...createBlankExternalIdentifiers(),
    };
    return result;
}

/**
 * Parses game website identifiers from a Wikidata entity response.
 *
 * @param wikidataId - Wikidata entity ID.
 * @param data - Wikidata API response data.
 * @returns External game identifiers.
 */
function parseWikidataIdentifiers(wikidataId: string, data: any): any {
    const claims = data?.entities?.[wikidataId]?.claims || {};

    const result = {
        metacriticId: getClaimValue(claims.P12054),
        openCriticId: getClaimValue(claims.P2864),
        steamId: getClaimValue(claims.P1733),
    };
    return result;
}

/**
 * Creates blank English Wikipedia metadata.
 *
 * @param title - Page title.
 * @returns Blank metadata.
 */
function createBlankEnwikiMetadata(title: string): any {
    const result = {
        pageExists: null,
        title,
        wikidataId: '',
        ...createBlankExternalIdentifiers(),
    };
    return result;
}

/**
 * Creates blank external identifier values.
 *
 * @returns Blank identifier values.
 */
function createBlankExternalIdentifiers(): any {
    const result = {
        metacriticId: '',
        openCriticId: '',
        steamId: '',
    };
    return result;
}

/**
 * Gets the first usable external identifier claim value.
 *
 * @param statements - Wikidata claim statements.
 * @returns External identifier, or an empty string.
 */
function getClaimValue(statements: Array<any>): string {
    const statement = (statements || []).find(function callback(item) {
        const result =
            item.rank !== 'deprecated' &&
            item.mainsnak?.snaktype === 'value' &&
            item.mainsnak?.datavalue?.value != null;
        return result;
    });

    return String(statement?.mainsnak?.datavalue?.value || '').trim();
}
