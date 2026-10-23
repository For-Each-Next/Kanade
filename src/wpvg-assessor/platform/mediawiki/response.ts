/**
 * @file src/wpvg-assessor/platform/mediawiki/response.ts
 * Purpose: Decodes the small MediaWiki response shapes used by the gadget.
 *
 * Contents: Unknown-record decoding and required revision-field validation.
 */

import { readRecord as asRecord } from '../../../library/data-validation/records.ts';

export { asRecord };
export type UnknownRecord = Record<string, unknown>;

export function getFirstQueryPage(response: unknown): UnknownRecord | null {
    return getQueryPages(response)[0] ?? null;
}

export function getQueryPages(response: unknown): Array<UnknownRecord> {
    const responseRecord = asRecord(response);
    const query = asRecord(responseRecord?.query);
    const pages = query?.pages;

    if (!Array.isArray(pages)) return [];
    return pages.flatMap(function readPage(page) {
        const record = asRecord(page);
        return record == null ? [] : [record];
    });
}

export function getFirstRevision(
    page: UnknownRecord | null,
): UnknownRecord | null {
    const revisions = page?.revisions;
    return Array.isArray(revisions) ? asRecord(revisions[0]) : null;
}

export function getRevisionContent(revision: UnknownRecord | null): string {
    const slots = asRecord(revision?.slots);
    const main = asRecord(slots?.main);
    const content = main?.content;
    if (typeof content !== 'string') {
        throw new Error(
            'MediaWiki response omitted readable revision content.',
        );
    }
    return content;
}

export function getRequiredString(
    record: UnknownRecord | null,
    key: string,
    description: string,
): string {
    const value = record?.[key];
    if (typeof value !== 'string' || value === '') {
        throw new Error(`MediaWiki response omitted ${description}.`);
    }

    return value;
}
