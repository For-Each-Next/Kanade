/**
 * @file src/wpvg-assessor/platform/mediawiki/new-page-list-api.ts
 * Purpose: Reads and writes the WikiProject Video games new-page list.
 *
 * Contents: New-page-list snapshots and revision-protected edits.
 */

import type { NewPageListSnapshot } from '../../domain/types.ts';
import {
    asRecord,
    getFirstQueryPage,
    getFirstRevision,
    getRequiredString,
    getRevisionContent,
} from './response.ts';
import {
    createLoggedApiRequests,
    type LoggedApiRequests,
} from './api-requests.ts';
import { formatNamespaceTitle } from '../../../library/wiki-titles/wikipedia.ts';
import type { Logger } from '../../../library/logging/logger.ts';

export const NEW_PAGE_LIST_TITLE = formatNamespaceTitle(
    '电子游戏/新进条目',
    'zhwiki',
    102,
);

export interface NewPageListApi {
    fetchNewPageList(api: mw.Api): Promise<NewPageListSnapshot>;
    savePreparedNewPageList(
        api: mw.Api,
        page: NewPageListSnapshot,
        proposedText: string,
        summary: string,
    ): Promise<void>;
}

interface NewPageListContext {
    logger: Logger;
    requests: LoggedApiRequests;
}

/** Creates the new-page-list adapter with scoped diagnostics. */
export function createNewPageListApi(logger: Logger): NewPageListApi {
    const context: NewPageListContext = {
        logger,
        requests: createLoggedApiRequests(logger.child('request')),
    };
    return Object.freeze({
        fetchNewPageList: fetchNewPageList.bind(null, context),
        savePreparedNewPageList: savePreparedNewPageList.bind(null, context),
    });
}

async function fetchNewPageList(
    context: NewPageListContext,
    api: mw.Api,
): Promise<NewPageListSnapshot> {
    context.logger.debug('new-page-list.fetch.started', {
        title: NEW_PAGE_LIST_TITLE,
    });
    const response = await context.requests.get(api, 'new-page-list.fetch', {
        action: 'query',
        curtimestamp: true,
        formatversion: '2',
        prop: 'revisions',
        rvprop: 'ids|content|timestamp',
        rvslots: 'main',
        titles: NEW_PAGE_LIST_TITLE,
    });
    const result = decodeNewPageListResponse(response);
    context.logger.info('new-page-list.fetch.completed', {
        characterCount: result.text.length,
        title: NEW_PAGE_LIST_TITLE,
    });
    return result;
}

async function savePreparedNewPageList(
    context: NewPageListContext,
    api: mw.Api,
    page: NewPageListSnapshot,
    proposedText: string,
    summary: string,
): Promise<void> {
    if (
        !Number.isSafeInteger(page.revisionId) ||
        typeof page.revisionId !== 'number' ||
        page.revisionId <= 0
    ) {
        throw new Error(
            'The new-page-list snapshot omitted a valid revision ID. Reload the review before saving.',
        );
    }
    context.logger.info('new-page-list.save.started', {
        title: NEW_PAGE_LIST_TITLE,
    });
    await context.requests.postWithToken(api, 'new-page-list.save', 'csrf', {
        action: 'edit',
        baserevid: page.revisionId,
        nocreate: true,
        starttimestamp: page.starttimestamp,
        summary,
        text: proposedText,
        title: NEW_PAGE_LIST_TITLE,
    });
    context.logger.info('new-page-list.save.completed', {
        title: NEW_PAGE_LIST_TITLE,
    });
}

export function decodeNewPageListResponse(
    response: unknown,
): NewPageListSnapshot {
    const responseRecord = asRecord(response);
    const page = getFirstQueryPage(response);
    const revision = getFirstRevision(page);

    if (page == null || page.missing != null || revision == null) {
        throw new Error(`Unable to read ${NEW_PAGE_LIST_TITLE}.`);
    }

    const revisionId = revision.revid;
    if (
        revisionId !== undefined &&
        (typeof revisionId !== 'number' ||
            !Number.isSafeInteger(revisionId) ||
            revisionId <= 0)
    ) {
        throw new Error('MediaWiki response omitted a valid revision ID.');
    }

    return {
        ...(revisionId === undefined ? {} : { revisionId }),
        basetimestamp: getRequiredString(
            revision,
            'timestamp',
            'the base timestamp',
        ),
        starttimestamp: getRequiredString(
            responseRecord,
            'curtimestamp',
            'the query timestamp',
        ),
        text: getRevisionContent(revision),
    };
}
