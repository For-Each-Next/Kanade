/**
 * @file src/vg-stub-creator/platform/network/steam-names.ts
 * Purpose: Fetches localized official game names from Steam citations.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. fetchSteamNameRows
 * 4. buildSteamLanguages
 * 5. fetchSteamNameRow
 * 6. getSteamAppId
 * 7. buildSteamLocalizedSourceUrl
 * 8. getTemplateParam
 * 9. escapeRegExp
 * 10. cleanSteamNameTitle
 */

import * as wikitext from '../../domain/wikitext/index.ts';
const { trimValue } = wikitext;

/**
 * Fetches localized Steam names.
 *
 * @param sourceUrl - Steam store app URL.
 * @param citationStore - Citation fetch/cache store.
 * @param options - Fetch options.
 * @param options.includeJapanese - Whether to fetch
 * Japanese.
 * @returns Localized official name rows.
 */
export async function fetchSteamNameRows(
    sourceUrl: string,
    citationStore: any,
    options: any = {},
): Promise<Array<any>> {
    getSteamAppId(
        sourceUrl,
        options.invalidUrlMessage || 'Enter a Steam app URL.',
    );
    const languages = buildSteamLanguages(
        options.includeJapanese === true,
        options.labels,
    );
    const mapCallback = function callback(item: Record<string, any>) {
        return fetchSteamNameRow(sourceUrl, item, citationStore);
    };
    const mappedValues = languages.map(mapCallback);
    const rows = await Promise.all(mappedValues);

    return rows.filter(Boolean);
}

/**
 * Builds the Steam language requests for a lookup.
 *
 * @param includeJapanese - Include japanese value.
 * @returns The Steam language requests for a lookup.
 */
function buildSteamLanguages(
    includeJapanese: boolean,
    labels: Record<string, string> = {},
): Record<string, any>[] {
    const languages: Record<string, any>[] = [
        {
            label: labels.simplified || 'Simplified Chinese',
            language: 'schinese',
            markets: ['hans'],
        },
        {
            label: labels.traditional || 'Traditional Chinese',
            language: 'tchinese',
            markets: ['hant'],
        },
    ];

    if (includeJapanese) {
        const message: Record<string, any> = {
            label: labels.japanese || 'Japanese',
            language: 'japanese',
            markets: [],
            previewOnly: true,
        };
        languages.push(message);
    }

    return languages;
}

/**
 * Fetches one localized Steam name through generated citation text.
 *
 * @param sourceUrl - Steam store app URL.
 * @param item - Steam language metadata.
 * @param citationStore - Citation fetch/cache store.
 * @returns Localized official name row.
 */
async function fetchSteamNameRow(
    sourceUrl: string,
    item: any,
    citationStore: any,
): Promise<any | undefined> {
    const localizedUrl = buildSteamLocalizedSourceUrl(sourceUrl, item.language);
    const citation = await citationStore.fetch(localizedUrl);
    const templateParamResult = getTemplateParam(citation, 'title');
    const name = cleanSteamNameTitle(templateParamResult);

    if (name === '') {
        return undefined;
    }

    const result = {
        label: item.label,
        markets: item.markets,
        name,
        official: true,
        previewOnly: Boolean(item.previewOnly),
        sourceUrl: localizedUrl,
    };
    return result;
}

/**
 * Validates and extracts a Steam app ID.
 *
 * @param sourceUrl - Steam store app URL.
 * @returns Steam app ID.
 */
function getSteamAppId(sourceUrl: string, invalidUrlMessage: string): string {
    const match = trimValue(sourceUrl).match(/\/app\/(\d+)(?:[/?#]|$)/u);

    if (match == null) {
        throw new Error(invalidUrlMessage);
    }

    return match[1];
}

/**
 * Adds a Steam language query to a store URL.
 *
 * @param sourceUrl - Steam store app URL.
 * @param language - Steam language key.
 * @returns Localized Steam store URL.
 */
function buildSteamLocalizedSourceUrl(
    sourceUrl: string,
    language: string,
): string {
    const normalizedSourceUrl = trimValue(sourceUrl);
    const url = new URL(normalizedSourceUrl);

    url.searchParams.set('l', language);

    return url.toString();
}

/**
 * Gets a named template parameter from citation wikitext.
 *
 * @param template - Citation template wikitext.
 * @param key - Template parameter key.
 * @returns Template parameter value.
 */
function getTemplateParam(template: string, key: string): string {
    const escapedKey = escapeRegExp(key);
    const pattern = new RegExp(
        `(?:^|\\|)\\s*${escapedKey}\\s*=\\s*([^|}]*)`,
        'u',
    );
    const match = String(template).match(pattern);

    return trimValue(match?.[1] || '');
}

/**
 * Escapes text for use inside a regular expression.
 *
 * @param text - Raw text.
 * @returns Escaped text.
 */
function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * Cleans a Steam citation title into a displayed game name.
 *
 * @param title - Citation title.
 * @returns Game name.
 */
function cleanSteamNameTitle(title: string): string {
    const result = trimValue(title)
        .replace(/^Steam - /u, '')
        .replace(/^Steam 上的 /u, '')
        .replace(/ on Steam$/u, '');
    return result;
}
