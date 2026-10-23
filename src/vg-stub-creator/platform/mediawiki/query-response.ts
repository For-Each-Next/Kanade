/**
 * @file src/vg-stub-creator/platform/mediawiki/query-response.ts
 * Purpose: Validates current MediaWiki single-page query responses and revision content.
 *
 * Table of contents:
 * 1. QueryPage
 * 2. readQueryPage
 * 3. readPageRevision
 * 4. readRevisionContent
 * 5. asRecord
 */

import { asRecord } from '../../../library/data-validation/records.ts';

interface QueryPage extends Record<string, unknown> {
    title: string;
    missing?: true;
}

/** Reads a single page from a formatversion=2 query without inventing missing data. */
export function readQueryPage(response: unknown, message: string): QueryPage {
    const record = asRecord(response);
    const pages = asRecord(record?.query)?.pages;
    const page =
        Array.isArray(pages) && pages.length === 1
            ? asRecord(pages[0])
            : undefined;
    if (
        record?.error != null ||
        page == null ||
        typeof page.title !== 'string' ||
        page.title.trim() === '' ||
        page.invalid != null ||
        (Object.hasOwn(page, 'missing') && page.missing !== true)
    ) {
        throw new Error(message);
    }
    return page as QueryPage;
}

/** Requires a visible revision for an existing page. */
export function readPageRevision(
    page: QueryPage,
    message: string,
): Record<string, unknown> {
    const revision = Array.isArray(page.revisions)
        ? asRecord(page.revisions[0])
        : undefined;
    if (page.missing === true || revision == null) throw new Error(message);
    return revision;
}

/** Reads a modern main slot, including a valid empty page. */
export function readRevisionContent(
    revision: Record<string, unknown>,
    message: string,
): string {
    const content = asRecord(asRecord(revision.slots)?.main)?.content;
    if (typeof content !== 'string') throw new Error(message);
    return content;
}
