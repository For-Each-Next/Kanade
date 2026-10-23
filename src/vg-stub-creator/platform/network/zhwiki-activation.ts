/**
 * @file src/vg-stub-creator/platform/network/zhwiki-activation.ts
 * Purpose: Transfers English article metadata to Chinese article creation.
 * Contents: Creation-title checks, launch URLs, and activation input.
 */

import { readQueryPage } from '../mediawiki/query-response.ts';

import * as wikitext from '../../domain/wikitext/index.ts';
const { trimValue } = wikitext;

export const ZHWIKI_API_URL = 'https://zh.wikipedia.org/w/api.php';
const ZHWIKI_ORIGIN = 'https://zh.wikipedia.org';
const ZHWIKI_ACTIVATION_PARAM = 'vg-stub-creator';
const ZHWIKI_ENWIKI_TITLE_PARAM = 'kanade-vg-stub-creator-enwiki-title';

/**
 * Removes English Wikipedia's generic video-game disambiguator.
 *
 * @param title - English Wikipedia page title.
 * @returns Base title for the zhwiki creation page.
 */
function removeEnwikiVideoGameSuffix(title: string): string {
    return trimValue(title).replace(/\s+\(video game\)$/iu, '');
}

/**
 * Handles build zhwiki creation title.
 *
 * Builds the fallback zhwiki article title from an English Wikipedia
 * title.
 *
 * @param enwikiTitle - English Wikipedia page title.
 * @returns zhwiki creation title.
 */
function buildZhwikiCreationTitle(enwikiTitle: string): string {
    return removeEnwikiVideoGameSuffix(enwikiTitle);
}

/**
 * Handles resolve zhwiki creation title.
 *
 * Resolves the zhwiki creation title, adding a Chinese disambiguator on
 * clash.
 *
 * @param enwikiTitle - English Wikipedia page title.
 * @param api - zhwiki MediaWiki API client.
 * @returns zhwiki creation title.
 */
export async function resolveZhwikiCreationTitle(
    enwikiTitle: string,
    api: any,
): Promise<string> {
    const baseTitle = buildZhwikiCreationTitle(enwikiTitle);

    if (baseTitle === '') {
        return '';
    }

    if (await fetchZhwikiPageExists(api, baseTitle)) {
        return `${baseTitle} (遊戲)`;
    }

    return baseTitle;
}

/**
 * Checks whether a zhwiki article exists.
 *
 * @param api - zhwiki MediaWiki API client.
 * @param title - zhwiki page title.
 * @returns Whether the page exists.
 */
async function fetchZhwikiPageExists(
    api: any,
    title: string,
): Promise<boolean> {
    const response = await api.get({
        action: 'query',
        formatversion: '2',
        titles: title,
    });
    const page = readQueryPage(
        response,
        'Page lookup returned an invalid page.',
    );
    return page.missing !== true;
}

/**
 * Builds the zhwiki edit URL that opens the creation gadget.
 *
 * @param enwikiTitle - English Wikipedia page title.
 * @param targetTitle - Resolved zhwiki target title.
 * @returns zhwiki edit URL.
 */
export function buildZhwikiCreationUrl(
    enwikiTitle: string,
    targetTitle?: string,
): string {
    const title =
        trimValue(targetTitle) || buildZhwikiCreationTitle(enwikiTitle);
    const replacedText = title.replace(/ /gu, '_');
    const encodedTitle = encodeURIComponent(replacedText);
    const path = ['/wiki/', encodedTitle, ''].join('');
    const url = new URL(path, ZHWIKI_ORIGIN);

    url.searchParams.set('action', 'edit');
    url.searchParams.set('redlink', '1');
    url.searchParams.set(ZHWIKI_ACTIVATION_PARAM, '1');
    const trimmedValue = trimValue(enwikiTitle);
    url.searchParams.set(ZHWIKI_ENWIKI_TITLE_PARAM, trimmedValue);

    return url.toString();
}

/**
 * Reads zhwiki activation form values from a URL query string.
 *
 * @param search - URL query string or params.
 * @returns Initial form values, or null when not
 * activated.
 */
export function readZhwikiActivationForm(
    search: string | URLSearchParams,
): any | null {
    const params =
        search instanceof URLSearchParams
            ? search
            : new URLSearchParams(String(search || ''));

    if (params.get(ZHWIKI_ACTIVATION_PARAM) !== '1') {
        return null;
    }

    const configValue = params.get(ZHWIKI_ENWIKI_TITLE_PARAM) || '';
    const enwikiTitle = trimValue(configValue);

    if (enwikiTitle === '') {
        return null;
    }

    const result = {
        enwikiTitle,
    };
    return result;
}
