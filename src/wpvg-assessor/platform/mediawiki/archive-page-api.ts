/**
 * @file src/wpvg-assessor/platform/mediawiki/archive-page-api.ts
 * Purpose: Read annual archive snapshots and make protected reviewed writes.
 *
 * Contents: Archive snapshot decoding and revision-protected writes.
 */

import type { ArchivePageSnapshot } from '../../app/archive-contracts.ts';
import type { Logger } from '../../../library/logging/logger.ts';
import {
    getTitleNamespaceId,
    stripNamespacePrefix,
} from '../../../library/wiki-titles/wikipedia.ts';
import { createLoggedApiRequests } from './api-requests.ts';
import {
    asRecord,
    getFirstQueryPage,
    getFirstRevision,
    getRequiredString,
    getRevisionContent,
} from './response.ts';

export interface ArchivePageApi {
    fetchPageText(api: mw.Api, title: string): Promise<ArchivePageSnapshot>;
    saveArchivePage(
        api: mw.Api,
        snapshot: ArchivePageSnapshot,
        proposedText: string,
        summary: string,
    ): Promise<void>;
}

/** Binds generic page requests without changing the reviewed destination title. */
export function createArchivePageApi(logger: Logger): ArchivePageApi {
    const requests = createLoggedApiRequests(logger.child('request'));

    async function fetchPageText(
        api: mw.Api,
        title: string,
    ): Promise<ArchivePageSnapshot> {
        const response = await requests.get(api, 'archive-page.fetch', {
            action: 'query',
            curtimestamp: true,
            formatversion: '2',
            prop: 'revisions',
            rvprop: 'ids|content|timestamp',
            rvslots: 'main',
            titles: title,
        });
        return decodeArchivePageResponse(response, title);
    }

    async function saveArchivePage(
        api: mw.Api,
        snapshot: ArchivePageSnapshot,
        proposedText: string,
        summary: string,
    ): Promise<void> {
        if (snapshot.exists && !isValidRevisionId(snapshot.revisionId)) {
            throw new Error('The archive snapshot omitted its revision ID.');
        }
        await requests.postWithToken(api, 'archive-page.save', 'csrf', {
            action: 'edit',
            baserevid: snapshot.revisionId ?? undefined,
            createonly: !snapshot.exists ? true : undefined,
            nocreate: snapshot.exists ? true : undefined,
            starttimestamp: snapshot.starttimestamp,
            summary,
            text: proposedText,
            title: snapshot.title,
        });
    }

    return Object.freeze({ fetchPageText, saveArchivePage });
}

export function decodeArchivePageResponse(
    response: unknown,
    title: string,
): ArchivePageSnapshot {
    const page = getFirstQueryPage(response);
    if (
        page == null ||
        page.invalid != null ||
        !isSameArchiveTitle(title, page.title)
    ) {
        throw new Error(`Unable to read ${title}.`);
    }
    const starttimestamp = getRequiredString(
        asRecord(response),
        'curtimestamp',
        'the query timestamp',
    );
    if (page.missing != null) {
        return {
            title,
            text: '',
            exists: false,
            revisionId: null,
            basetimestamp: null,
            starttimestamp,
        };
    }
    const revision = getFirstRevision(page);
    if (revision == null) {
        throw new Error(`Unable to read ${title}.`);
    }
    if (!isValidRevisionId(revision.revid)) {
        throw new Error('The archive response omitted its revision ID.');
    }
    return {
        title,
        text: getRevisionContent(revision),
        exists: true,
        revisionId: revision.revid,
        basetimestamp: getRequiredString(
            revision,
            'timestamp',
            'the base timestamp',
        ),
        starttimestamp,
    };
}

/** Accepts the API's canonical namespace name while retaining the exact page target. */
function isSameArchiveTitle(expected: string, actual: unknown): boolean {
    if (typeof actual !== 'string') return false;
    const namespace = getTitleNamespaceId(expected, 'zhwiki');
    return (
        getTitleNamespaceId(actual, 'zhwiki') === namespace &&
        stripNamespacePrefix(actual, 'zhwiki', namespace).replace(
            /_/gu,
            ' ',
        ) ===
            stripNamespacePrefix(expected, 'zhwiki', namespace).replace(
                /_/gu,
                ' ',
            )
    );
}

function isValidRevisionId(value: unknown): value is number {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    );
}
