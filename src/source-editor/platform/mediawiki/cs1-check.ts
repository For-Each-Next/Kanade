/**
 * @file src/source-editor/platform/mediawiki/cs1-check.ts
 * Purpose: MediaWiki parse adapter for live CS1 validation.
 *
 * Table of contents:
 * 1. Constants and state
 * 2. MediaWikiPostApi
 * 3. Cs1CheckOptions
 * 4. Cs1CheckResult
 * 5. buildCs1CheckWikitext
 * 6. requestCs1WikitextCheck
 * 7. splitCs1CheckHtml
 * 8. parseCs1CheckResponse
 * 9. parseCs1Result
 * 10. parseCs1Html
 * 11. parseCs1Categories
 * 12. isRecord
 */

import { isObject as isRecord } from '../../../library/data-validation/records.ts';

const CS1_CHECK_ID_PREFIX = 'kanade-source-editor-cs1-check-';

export interface MediaWikiPostApi {
    post(parameters: Record<string, unknown>): PromiseLike<unknown>;
}

export interface Cs1CheckOptions {
    api?: MediaWikiPostApi;
    pageTitle: string;
}

export interface Cs1CheckResult {
    categories: string[];
    html: string;
}

/**
 * Builds one isolated CS1-check region for every citation source.
 *
 * @param sources - Sources value.
 * @returns Built isolated CS1-check region for every citation source.
 */
export function buildCs1CheckWikitext(
    sources: readonly { rawTemplate: string }[],
): string {
    return sources
        .map(function wrapSource(source, index) {
            const id = `${CS1_CHECK_ID_PREFIX}${index}`;
            return `<div id="${id}">
${source.rawTemplate}
</div>`;
        })
        .join('\n');
}

/**
 * Requests a live CS1 check through MediaWiki action=parse.
 *
 * @param text - Text to process.
 * @param options - Operation options.
 * @returns Operation result.
 */
export async function requestCs1WikitextCheck(
    text: string,
    options: Cs1CheckOptions,
): Promise<Cs1CheckResult> {
    const api: MediaWikiPostApi = options.api ?? new mw.Api();
    const response = await api.post({
        action: 'parse',
        contentmodel: 'wikitext',
        disableeditsection: true,
        disablelimitreport: true,
        disabletoc: true,
        formatversion: 2,
        preview: true,
        prop: 'text|categories',
        text,
        title: options.pageTitle,
    });
    return parseCs1CheckResponse(response);
}

/**
 * Splits an isolated checker response back into per-source fragments.
 *
 * @param html - Html value.
 * @param sourceCount - Source count value.
 * @returns Value.
 */
export function splitCs1CheckHtml(html: string, sourceCount: number): string[] {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    return Array.from({ length: sourceCount }, (_, index) => {
        const id = `${CS1_CHECK_ID_PREFIX}${index}`;
        return parsed.getElementById(id)?.innerHTML ?? '';
    });
}

/**
 * Validates the portion of an action=parse response used by the UI.
 *
 * @param response - API response to parse.
 * @returns Operation result.
 */
function parseCs1CheckResponse(response: unknown): Cs1CheckResult {
    if (isRecord(response)) {
        return parseCs1Result(response.parse);
    }
    throw new TypeError('CS1 parse response must be an object.');
}

/**
 * Validates the optional parse member in an action=parse response.
 *
 * @param value - Value to process.
 * @returns Operation result.
 */
function parseCs1Result(value: unknown): Cs1CheckResult {
    if (value == null) {
        return { categories: [], html: '' };
    }
    if (isRecord(value)) {
        return {
            categories: parseCs1Categories(value.categories),
            html: parseCs1Html(value.text),
        };
    }
    throw new TypeError('CS1 parse result must be an object.');
}

/**
 * Validates the rendered HTML in a parse result.
 *
 * @param value - Value to process.
 * @returns Resulting text.
 */
function parseCs1Html(value: unknown): string {
    if (value == null) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    throw new TypeError('CS1 parse text must be a string.');
}

/**
 * Extracts category names from MediaWiki formatversion 2 output.
 *
 * @param value - Value to process.
 * @returns Category names from MediaWiki formatversion 2 output.
 */
function parseCs1Categories(value: unknown): string[] {
    if (value == null) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new TypeError('CS1 parse categories must be an array.');
    }
    return value.flatMap(function getCategory(entry) {
        if (!isRecord(entry)) {
            throw new TypeError('CS1 parse category must be an object.');
        }
        const category = entry.category;
        if (category == null) {
            return [];
        }
        if (typeof category !== 'string') {
            throw new TypeError('CS1 parse category name must be a string.');
        }
        return [category];
    });
}
