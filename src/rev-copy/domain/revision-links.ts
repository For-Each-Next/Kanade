/**
 * @file src/rev-copy/domain/revision-links.ts
 * Purpose: Format site-language UTC revision labels and copyable wikitext.
 *
 * Contents: UTC revision labels, safe link targets, and comparison/section formatting.
 */

import { getInterwikiPrefix } from './wiki-site';
import type { WikiSite } from './wiki-site';

export interface RevisionLinks {
    page: string;
    permalink: string;
    all: string;
    revisionLabel: string;
}

export interface RevisionLinkInput {
    pageTitle: string;
    revisionId: number;
    timestamp: string;
    site: WikiSite;
    homeWiki?: string;
    /** Present on comparison pages; zero means the newer revision's predecessor. */
    diffOldId?: number;
    sectionId?: string;
}

export function formatRevisionTimestamp(
    timestamp: string,
    language: string,
): string {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime()))
        throw new Error('Invalid revision timestamp.');
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
        timeZone: 'UTC',
    };
    // MediaWiki language codes normally use BCP 47. Fall back for private codes.
    try {
        return new Intl.DateTimeFormat(language, options).format(date);
    } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        return new Intl.DateTimeFormat('en', options).format(date);
    }
}

function escapeWikitext(text: string): string {
    return text.replace(/[&<>\[\]|\r\n]/gu, (character) => {
        const entities: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '[': '&#91;',
            ']': '&#93;',
            '|': '&#124;',
            '\r': ' ',
            '\n': ' ',
        };
        return entities[character];
    });
}

export function buildPageLink(
    pageTitle: string,
    site: WikiSite,
    homeWiki = 'w:zh',
    sectionId?: string,
): string {
    const prefix = getInterwikiPrefix(site, homeWiki);
    const fragment = sectionId ? `#${escapeWikitext(sectionId)}` : '';
    return `[[:${prefix}${escapeWikitext(pageTitle.replace(/_/gu, ' '))}${fragment}]]`;
}

export function buildRevisionLinks(input: RevisionLinkInput): RevisionLinks {
    if (!Number.isSafeInteger(input.revisionId) || input.revisionId <= 0) {
        throw new Error('A positive displayed revision ID is required.');
    }
    const prefix = getInterwikiPrefix(input.site, input.homeWiki);
    const page = buildPageLink(
        input.pageTitle,
        input.site,
        input.homeWiki,
        input.sectionId,
    );
    const revisionLabel = formatRevisionTimestamp(
        input.timestamp,
        input.site.language,
    );
    if (
        input.diffOldId !== undefined &&
        (!Number.isSafeInteger(input.diffOldId) || input.diffOldId < 0)
    ) {
        throw new Error(
            'A non-negative old revision ID is required for comparisons.',
        );
    }
    const target =
        input.diffOldId === undefined
            ? `Special:PermaLink/${input.revisionId}`
            : input.diffOldId > 0
              ? `Special:Diff/${input.diffOldId}/${input.revisionId}`
              : `Special:Diff/${input.revisionId}`;
    const fragment = input.sectionId
        ? `#${escapeWikitext(input.sectionId)}`
        : '';
    const permalink = `[[:${prefix}${target}${fragment}|${escapeWikitext(revisionLabel)}]]`;
    return { page, permalink, all: `${page} (${permalink})`, revisionLabel };
}
