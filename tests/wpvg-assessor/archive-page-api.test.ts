/**
 * @file tests/wpvg-assessor/archive-page-api.test.ts
 * Purpose: Validate annual archive API snapshots and protected write parameters.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. pageResponse
 * 4. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createArchivePageApi,
    decodeArchivePageResponse,
} from '../../src/wpvg-assessor/platform/mediawiki/archive-page-api.ts';
import { createLogger } from '../../src/library/logging/logger.ts';

const TITLE = 'WikiProject:电子游戏/新进条目/2026年存档';
const logger = createLogger('archive-test', { level: 'silent' });
const pages = createArchivePageApi(logger);

function pageResponse(
    text: string,
    title = TITLE,
    revisionId: unknown = 42,
): unknown {
    return {
        curtimestamp: 'query-time',
        query: {
            pages: [
                {
                    title,
                    revisions: [
                        {
                            timestamp: 'base-time',
                            revid: revisionId,
                            slots: { main: { content: text } },
                        },
                    ],
                },
            ],
        },
    };
}

test('reads an existing annual archive with modern slot content', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const api = {
        async get(params: Record<string, unknown>) {
            requests.push(params);
            return pageResponse('Existing archive');
        },
    } as unknown as mw.Api;
    assert.deepEqual(await pages.fetchPageText(api, TITLE), {
        title: TITLE,
        text: 'Existing archive',
        exists: true,
        revisionId: 42,
        basetimestamp: 'base-time',
        starttimestamp: 'query-time',
    });
    assert.deepEqual(requests, [
        {
            action: 'query',
            curtimestamp: true,
            formatversion: '2',
            prop: 'revisions',
            rvprop: 'ids|content|timestamp',
            rvslots: 'main',
            titles: TITLE,
        },
    ]);
});

test('accepts a missing archive only with a query timestamp', () => {
    const response = {
        curtimestamp: 'query-time',
        query: { pages: [{ title: TITLE, missing: true }] },
    };
    assert.deepEqual(decodeArchivePageResponse(response, TITLE), {
        title: TITLE,
        text: '',
        exists: false,
        revisionId: null,
        basetimestamp: null,
        starttimestamp: 'query-time',
    });
    assert.throws(
        () =>
            decodeArchivePageResponse(
                { query: { pages: [{ title: TITLE, missing: true }] } },
                TITLE,
            ),
        /query timestamp/u,
    );
});

test('rejects legacy, invalid, or unreadable archive responses', () => {
    for (const response of [
        {
            curtimestamp: 'query-time',
            query: { pages: { 1: { revisions: [{ '*': 'Old archive' }] } } },
        },
        { curtimestamp: 'query-time', query: { pages: [{ invalid: true }] } },
        {
            curtimestamp: 'query-time',
            query: {
                pages: [{ title: 'WikiProject:Different page', missing: true }],
            },
        },
        { curtimestamp: 'query-time', query: { pages: [{ title: TITLE }] } },
        {
            curtimestamp: 'query-time',
            query: {
                pages: [
                    {
                        title: TITLE,
                        revisions: [
                            { timestamp: 'base-time', '*': 'Old archive' },
                        ],
                    },
                ],
            },
        },
        {
            curtimestamp: 'query-time',
            query: {
                pages: [
                    {
                        title: TITLE,
                        revisions: [
                            { slots: { main: { content: 'No timestamp' } } },
                        ],
                    },
                ],
            },
        },
    ]) {
        assert.throws(() => decodeArchivePageResponse(response, TITLE));
    }
});

test('saves reviewed existing archives with a strict revision ID, query timestamp, and nocreate', async () => {
    const posts: Array<{ token: string; params: Record<string, unknown> }> = [];
    const api = {
        async postWithToken(token: string, params: Record<string, unknown>) {
            posts.push({ token, params });
            return { edit: { result: 'Success' } };
        },
    } as unknown as mw.Api;
    await pages.saveArchivePage(
        api,
        decodeArchivePageResponse(pageResponse('Old'), TITLE),
        'Exact reviewed text',
        'Exact summary',
    );
    assert.deepEqual(posts, [
        {
            token: 'csrf',
            params: {
                action: 'edit',
                baserevid: 42,
                createonly: undefined,
                nocreate: true,
                starttimestamp: 'query-time',
                summary: 'Exact summary',
                text: 'Exact reviewed text',
                title: TITLE,
            },
        },
    ]);
});

test('creates a missing archive with createonly and the query timestamp', async () => {
    const posts: Array<Record<string, unknown>> = [];
    const api = {
        async postWithToken(_token: string, params: Record<string, unknown>) {
            posts.push(params);
            return { edit: { result: 'Success' } };
        },
    } as unknown as mw.Api;
    const snapshot = decodeArchivePageResponse(
        {
            curtimestamp: 'query-time',
            query: { pages: [{ title: TITLE, missing: true }] },
        },
        TITLE,
    );
    await pages.saveArchivePage(
        api,
        snapshot,
        'Exact new archive',
        'Archive summary',
    );
    assert.equal(posts[0]?.createonly, true);
    assert.equal(posts[0]?.nocreate, undefined);
    assert.equal(posts[0]?.basetimestamp, undefined);
    assert.equal(posts[0]?.baserevid, undefined);
    assert.equal(posts[0]?.starttimestamp, 'query-time');
    assert.equal(posts[0]?.title, TITLE);
});

test('a fulfilled edit promise without Success remains an unconfirmed write and is not retried', async () => {
    let calls = 0;
    const api = {
        async postWithToken() {
            calls++;
            return { edit: { result: 'Failure', code: 'editconflict' } };
        },
    } as unknown as mw.Api;
    await assert.rejects(
        pages.saveArchivePage(
            api,
            decodeArchivePageResponse(pageResponse('Old'), TITLE),
            'Reviewed',
            'Summary',
        ),
        { code: 'editconflict' },
    );
    assert.equal(calls, 1);
});

test('accepts canonical Chinese namespace aliases without changing the requested destination', () => {
    for (const namespace of ['维基专题', '維基專題', '专题', '專題', 'PJ']) {
        const title = TITLE.replace('WikiProject:', `${namespace}:`);
        assert.equal(
            decodeArchivePageResponse(pageResponse('Archive', title), TITLE)
                .title,
            TITLE,
        );
    }
    assert.throws(() =>
        decodeArchivePageResponse(
            pageResponse('Other', TITLE.replace('WikiProject:', 'Wikipedia:')),
            TITLE,
        ),
    );
});

test('rejects missing or invalid existing revision IDs before a preview or write', async () => {
    for (const revisionId of [null, 0, -1, 1.5, '42', Number.NaN]) {
        assert.throws(
            () =>
                decodeArchivePageResponse(
                    pageResponse('Archive', TITLE, revisionId),
                    TITLE,
                ),
            /revision ID/u,
        );
    }
    let writes = 0;
    const api = {
        async postWithToken() {
            writes++;
        },
    } as unknown as mw.Api;
    const snapshot = decodeArchivePageResponse(pageResponse('Archive'), TITLE);
    await assert.rejects(
        pages.saveArchivePage(
            api,
            { ...snapshot, revisionId: null },
            'Reviewed',
            'Summary',
        ),
        /revision ID/u,
    );
    assert.equal(writes, 0);
});

test('strict revision protection reports a same-account intervening edit without retry', async () => {
    let writes = 0;
    const api = {
        async postWithToken(_token: string, params: Record<string, unknown>) {
            writes++;
            assert.equal(params.baserevid, 42);
            assert.equal('basetimestamp' in params, false);
            throw Object.assign(
                new Error('A same-account edit changed revision 42.'),
                { code: 'editconflict' },
            );
        },
    } as unknown as mw.Api;
    await assert.rejects(
        pages.saveArchivePage(
            api,
            decodeArchivePageResponse(pageResponse('Archive'), TITLE),
            'Reviewed',
            'Summary',
        ),
        { code: 'editconflict' },
    );
    assert.equal(writes, 1);
});
