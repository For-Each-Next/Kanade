/**
 * @file src/vg-stub-creator/platform/network/fallback-citation.ts
 * Purpose: Builds source citations when Citoid cannot identify a page.
 * Contents: Fallback metadata acquisition and citation rendering.
 */

/**
 * Builds a minimal web citation from source-page HTML when Citoid
 * cannot resolve a URL.
 */

import { buildCiteTemplate } from '../../domain/citations/index.ts';

export interface FallbackCitationOptions {
    fetcher?: typeof fetch;
    now?: Date;
    rules?: unknown[];
}

/**
 * Builds a minimal cite web template when Citoid cannot resolve a URL.
 *
 * @param url - Source URL.
 * @param options - Fetch and formatting options.
 * @returns Generated cite web template wikitext.
 */
export async function buildFallbackCiteWebTemplate(
    url: string,
    options: FallbackCitationOptions = {},
): Promise<string> {
    const trimmedUrl = url.trim();
    let title = '';
    if (!isSteamUrl(trimmedUrl)) {
        title = await fetchFallbackTitle(trimmedUrl, options);
    }
    const citation = {
        itemType: 'webpage',
        title,
        url: trimmedUrl,
        websiteTitle: getFallbackWebsiteTitle(trimmedUrl),
    };
    return buildCiteTemplate(citation, {
        now: options.now,
        rules: options.rules,
        url,
    });
}

/**
 * Checks whether a source URL is on Steam.
 *
 * @param url - Source URL.
 * @returns Whether the source is a Steam URL.
 */
function isSteamUrl(url: string): boolean {
    return parseUrl(url)?.hostname === 'store.steampowered.com';
}

/**
 * Fetches the source page title for a fallback citation.
 *
 * @param url - Source URL.
 * @param options - Fetch options.
 * @returns Page title, or an empty string when unavailable.
 */
async function fetchFallbackTitle(
    url: string,
    options: FallbackCitationOptions,
): Promise<string> {
    const fetcher = options.fetcher || fetch;

    try {
        const response = await fetcher(url, {
            headers: {
                accept: 'text/html',
            },
        });

        if (!response.ok) {
            return '';
        }

        const html = await response.text();
        return extractHtmlTitle(html);
    } catch (_error) {
        return '';
    }
}

/**
 * Extracts a document title from HTML text.
 *
 * @param html - HTML source.
 * @returns Extracted title, or an empty string.
 */
function extractHtmlTitle(html: string): string {
    const match = String(html || '').match(
        /<title\b[^>]*>([\s\S]*?)<\/title>/iu,
    );

    if (match == null) {
        return '';
    }

    const compactTitle = match[1].replace(/\s+/gu, ' ').trim();
    return decodeHtmlEntities(compactTitle);
}

/**
 * Decodes common HTML entities from title text.
 *
 * @param text - Encoded title text.
 * @returns Decoded title text.
 */
function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&#(\d+);/gu, decodeDecimalHtmlEntity)
        .replace(/&#x([\da-f]+);/giu, decodeHexHtmlEntity)
        .replace(/&quot;/gu, '"')
        .replace(/&apos;/gu, "'")
        .replace(/&amp;/gu, '&')
        .replace(/&lt;/gu, '<')
        .replace(/&gt;/gu, '>');
}

/**
 * Decodes one decimal numeric HTML entity.
 *
 * @param _match - Full entity text.
 * @param code - Decimal code point.
 * @returns Decoded character.
 */
function decodeDecimalHtmlEntity(_match: string, code: string): string {
    return String.fromCodePoint(Number(code));
}

/**
 * Decodes one hexadecimal numeric HTML entity.
 *
 * @param _match - Full entity text.
 * @param code - Hexadecimal code point.
 * @returns Decoded character.
 */
function decodeHexHtmlEntity(_match: string, code: string): string {
    return String.fromCodePoint(Number.parseInt(code, 16));
}

/**
 * Gets a website title from a source URL hostname.
 *
 * @param url - Source URL.
 * @returns Source URL hostname, or an empty string.
 */
function getFallbackWebsiteTitle(url: string): string {
    return (parseUrl(url)?.hostname || '').replace(/^www\./u, '');
}

/**
 * Parses a URL, returning null for invalid values.
 *
 * @param url - URL to parse.
 * @returns Parsed URL, or null.
 */
function parseUrl(url: string): URL | null {
    try {
        return new URL(url);
    } catch (_error) {
        return null;
    }
}
