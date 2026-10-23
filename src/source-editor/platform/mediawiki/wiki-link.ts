/**
 * @file src/source-editor/platform/mediawiki/wiki-link.ts
 * Purpose: Resolves organization-like citation values to local article links.
 *
 * Table of contents:
 * 1. WikiLinkApi
 * 2. QueryPage
 * 3. QueryResponse
 * 4. ParsedWikiLink
 * 5. resolveCitationWikiLink
 * 6. parseWikiLink
 * 7. buildWikiLink
 */

interface WikiLinkApi {
    get(parameters: Record<string, unknown>): PromiseLike<unknown>;
}

interface QueryPage {
    invalid?: boolean;
    missing?: boolean;
    ns?: number;
    title?: string;
}

interface QueryResponse {
    query?: {
        pages?: QueryPage[];
    };
}

interface ParsedWikiLink {
    label: string;
    title: string;
}

/**
 * Checks a local page and returns a redirect-aware wikilink.
 *
 * @param value - Value to process.
 * @param api - MediaWiki API client.
 * @returns Operation result.
 */
export async function resolveCitationWikiLink(
    value: string,
    api: WikiLinkApi,
): Promise<string> {
    const parsed = parseWikiLink(value);
    const response = (await api.get({
        action: 'query',
        formatversion: 2,
        redirects: true,
        titles: parsed.title,
    })) as QueryResponse;
    const page = response.query?.pages?.[0];
    if (
        page == null ||
        page.invalid === true ||
        page.missing === true ||
        page.ns !== 0 ||
        !page.title
    ) {
        throw new Error('The value does not resolve to an article.');
    }
    return buildWikiLink(page.title, parsed.label);
}

/**
 * Extracts a label and target from plain text or a simple wikilink.
 *
 * @param value - Value to process.
 * @returns Value.
 */
function parseWikiLink(value: string): ParsedWikiLink {
    const entered = value.trim();
    const link = entered.match(/^\[\[([^|[\]]+)(?:\|([^|[\]]+))?\]\]$/u);
    if (link != null) {
        return {
            label: (link[2] ?? link[1]).trim(),
            title: link[1].trim(),
        };
    }
    if (
        entered === '' ||
        /(?:\[\[|\]\]|\{\{|\}\}|\[https?:|https?:\/\/)/iu.test(entered)
    ) {
        throw new Error('Enter plain article text or one simple wikilink.');
    }
    return { label: entered, title: entered };
}

/**
 * Uses compact form when the target is also the display label.
 *
 * @param title - Wiki title.
 * @param label - Label value.
 * @returns Resulting text.
 */
function buildWikiLink(title: string, label: string): string {
    const normalizedTitle = title.replaceAll('_', ' ').trim();
    const normalizedLabel = label.replaceAll('_', ' ').trim();
    return normalizedTitle === normalizedLabel
        ? `[[${normalizedTitle}]]`
        : `[[${normalizedTitle}|${normalizedLabel}]]`;
}
