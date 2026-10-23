/**
 * @file tests/wpvg-assessor/mediawiki-adapters.test.ts
 * Purpose: Characterizes MediaWiki response decoding and protected saves.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. pageResponse
 * 4. PostedRequest
 * 5. createConflictingApi
 * 6. Test scenarios
 * 7. loadPageBatch
 * 8. createPageBatchApi
 * 9. createPageBatchResponse
 * 10. createCreationLookupApi
 * 11. createCreationTimeApi
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createLogger } from '../../src/library/logging/logger.ts';

import * as assessmentPageApi from '../../src/wpvg-assessor/platform/mediawiki/assessment-page-api.ts';
import * as pageApi from '../../src/wpvg-assessor/platform/mediawiki/page-api.ts';
import * as listApi from '../../src/wpvg-assessor/platform/mediawiki/new-page-list-api.ts';
import { createTalkPageApi } from '../../src/wpvg-assessor/platform/mediawiki/talk-page-api.ts';
import {
    createTalkSaveWorkflow,
    isEditConflict,
} from '../../src/wpvg-assessor/app/save-talk-assessment.ts';

const logger = createLogger('wpvg-assessor-test', { level: 'silent' });
const creationTimeCache = {
    read() {
        return {};
    },
    write() {},
};
const pages = pageApi.createPageApi(logger, creationTimeCache);
const assessmentPages = assessmentPageApi.createAssessmentPageApi(logger);
const talkPages = createTalkPageApi(logger);
const saveTalkAssessment = createTalkSaveWorkflow({
    fetchPageText: pages.fetchPageText,
    logger,
    postTalkPageEdit: talkPages.postTalkPageEdit,
});

function pageResponse(
    text: string,
    basetimestamp: string,
    starttimestamp: string,
    revisionId?: unknown,
): unknown {
    return {
        curtimestamp: starttimestamp,
        query: {
            pages: [
                {
                    revisions: [
                        {
                            ...(revisionId === undefined
                                ? {}
                                : { revid: revisionId }),
                            slots: { main: { content: text } },
                            timestamp: basetimestamp,
                        },
                    ],
                    title: 'Talk:Example',
                },
            ],
        },
    };
}

interface PostedRequest {
    params: Record<string, unknown>;
    token: string;
}

function createConflictingApi(): {
    api: mw.Api;
    posts: Array<PostedRequest>;
} {
    const responses = [
        pageResponse(
            '{{Old}}\n\n== Discussion ==\nOriginal body',
            'base-1',
            'start-1',
        ),
        pageResponse(
            '{{Concurrent}}\n\n== Discussion ==\nConcurrent body',
            'base-2',
            'start-2',
        ),
    ];
    const posts: Array<PostedRequest> = [];
    const api = {
        async get(): Promise<unknown> {
            return responses.shift();
        },
        async postWithToken(
            token: string,
            params: Record<string, unknown>,
        ): Promise<unknown> {
            posts.push({ params, token });
            if (posts.length === 1) {
                throw { error: { code: 'editconflict' } };
            }
            return { edit: { result: 'Success' } };
        },
    } as unknown as mw.Api;

    return { api, posts };
}

test('decodes current slot revision content', () => {
    const result = pageApi.decodePageTextResponse(
        pageResponse('array text', 'base-1', 'start-1'),
    );

    assert.deepEqual(result, {
        basetimestamp: 'base-1',
        exists: true,
        starttimestamp: 'start-1',
        text: 'array text',
    });
});

test('loads the talk page and assessment log in one query', loadPageBatch);

async function loadPageBatch(): Promise<void> {
    const requests: Array<Record<string, unknown>> = [];
    const api = createPageBatchApi(requests);
    const result = await assessmentPages.fetchAssessmentPages(
        api,
        'Talk:Example',
    );

    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.rvprop, 'ids|content|timestamp');
    assert.equal(
        requests[0]?.titles,
        `Talk:Example|${listApi.NEW_PAGE_LIST_TITLE}`,
    );
    assert.deepEqual(result, {
        newPageList: {
            basetimestamp: 'log-base',
            revisionId: 123,
            starttimestamp: 'query-time',
            text: 'Log text',
        },
        talkPage: {
            basetimestamp: 'talk-base',
            exists: true,
            starttimestamp: 'query-time',
            text: 'Talk text',
        },
    });
}

function createPageBatchApi(requests: Array<Record<string, unknown>>): mw.Api {
    return {
        async get(params: Record<string, unknown>): Promise<unknown> {
            requests.push(params);
            return createPageBatchResponse();
        },
    } as unknown as mw.Api;
}

function createPageBatchResponse(): unknown {
    return {
        curtimestamp: 'query-time',
        query: {
            pages: [
                {
                    ns: 102,
                    revisions: [
                        {
                            revid: 123,
                            slots: { main: { content: 'Log text' } },
                            timestamp: 'log-base',
                        },
                    ],
                    title: listApi.NEW_PAGE_LIST_TITLE,
                },
                {
                    ns: 1,
                    revisions: [
                        {
                            slots: { main: { content: 'Talk text' } },
                            timestamp: 'talk-base',
                        },
                    ],
                    title: 'Talk:Example',
                },
            ],
        },
    };
}

test('rejects obsolete keyed pages and revision content before preparing edits', () => {
    assert.throws(
        () =>
            pageApi.decodePageTextResponse({
                curtimestamp: 'start',
                query: {
                    pages: {
                        42: {
                            revisions: [
                                {
                                    slots: { main: { '*': 'old text' } },
                                    timestamp: 'base',
                                },
                            ],
                        },
                    },
                },
            }),
        /requested page/u,
    );
    assert.throws(
        () =>
            pageApi.decodePageTextResponse({
                curtimestamp: 'start',
                query: {
                    pages: [
                        { revisions: [{ '*': 'old text', timestamp: 'base' }] },
                    ],
                },
            }),
        /readable revision content/u,
    );
});

test('requires list content and both edit timestamps', () => {
    const decoded = listApi.decodeNewPageListResponse(
        pageResponse('list text', 'base', 'start'),
    );

    assert.deepEqual(decoded, {
        basetimestamp: 'base',
        starttimestamp: 'start',
        text: 'list text',
    });
    assert.throws(
        () =>
            listApi.decodeNewPageListResponse({
                query: { pages: [{ missing: true }] },
            }),
        /Unable to read/u,
    );
    assert.throws(
        () =>
            listApi.decodeNewPageListResponse({
                query: {
                    pages: [
                        {
                            revisions: [
                                {
                                    slots: {
                                        main: { content: 'list text' },
                                    },
                                    timestamp: 'base',
                                },
                            ],
                        },
                    ],
                },
            }),
        /query timestamp/u,
    );
});

test('standalone list reads request and preserve the base revision ID', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const api = {
        async get(params: Record<string, unknown>) {
            requests.push(params);
            return pageResponse('List text', 'base', 'query', 456);
        },
    } as unknown as mw.Api;
    const lists = listApi.createNewPageListApi(logger);
    const snapshot = await lists.fetchNewPageList(api);
    assert.equal(snapshot.revisionId, 456);
    assert.equal(requests[0]?.rvprop, 'ids|content|timestamp');
    for (const revisionId of [
        0,
        -1,
        1.5,
        '456',
        null,
        Number.MAX_SAFE_INTEGER + 1,
    ]) {
        assert.throws(
            () =>
                listApi.decodeNewPageListResponse(
                    pageResponse('List', 'base', 'query', revisionId),
                ),
            /valid revision ID/u,
        );
    }
});

test('whole-list writes use revision IDs without enabling timestamp self-conflicts', async () => {
    const posts: Array<PostedRequest> = [];
    const api = {
        async postWithToken(token: string, params: Record<string, unknown>) {
            posts.push({ token, params });
            return { edit: { result: 'Success' } };
        },
    } as unknown as mw.Api;
    const lists = listApi.createNewPageListApi(logger);
    await lists.savePreparedNewPageList(
        api,
        {
            basetimestamp: 'base',
            revisionId: 456,
            starttimestamp: 'query',
            text: 'Old',
        },
        'Exact reviewed source',
        'Exact reviewed summary',
    );
    assert.deepEqual(posts, [
        {
            token: 'csrf',
            params: {
                action: 'edit',
                baserevid: 456,
                nocreate: true,
                starttimestamp: 'query',
                summary: 'Exact reviewed summary',
                text: 'Exact reviewed source',
                title: listApi.NEW_PAGE_LIST_TITLE,
            },
        },
    ]);
    assert.equal(Object.hasOwn(posts[0].params, 'basetimestamp'), false);
});

test('legacy or invalid list snapshots fail before any write and never fall back to timestamps', async () => {
    let posts = 0;
    const api = {
        async postWithToken() {
            posts += 1;
            return { edit: { result: 'Success' } };
        },
    } as unknown as mw.Api;
    const lists = listApi.createNewPageListApi(logger);
    for (const revisionId of [
        undefined,
        0,
        -1,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.MAX_SAFE_INTEGER + 1,
    ]) {
        await assert.rejects(
            lists.savePreparedNewPageList(
                api,
                {
                    basetimestamp: 'base',
                    revisionId,
                    starttimestamp: 'query',
                    text: 'Legacy snapshot',
                },
                'Reviewed',
                'Summary',
            ),
            /Reload the review/u,
        );
    }
    assert.equal(posts, 0);
});

test('a stale whole-list revision cannot restore archived rows after a same-account edit', async () => {
    const current = { revisionId: 457, text: 'Recent rows only' };
    let posts = 0;
    const api = {
        async postWithToken(_token: string, params: Record<string, unknown>) {
            posts += 1;
            assert.equal(Object.hasOwn(params, 'basetimestamp'), false);
            if (params.baserevid !== current.revisionId)
                return { error: { code: 'editconflict' } };
            current.text = String(params.text);
            return { edit: { result: 'Success' } };
        },
    } as unknown as mw.Api;
    await assert.rejects(
        listApi.createNewPageListApi(logger).savePreparedNewPageList(
            api,
            {
                basetimestamp: 'same timestamp',
                revisionId: 456,
                starttimestamp: 'query',
                text: 'Old month plus recent rows',
            },
            'Old month plus new registration',
            'Register',
        ),
        { code: 'editconflict' },
    );
    assert.equal(current.text, 'Recent rows only');
    assert.equal(posts, 1);
});

test('batches creation times across zhwiki namespace aliases', async () => {
    const batches: string[] = [];
    const api = {
        async get(params: Record<string, unknown>): Promise<unknown> {
            const titles = String(params.titles ?? '');
            if (params.rvdir === 'newer') {
                batches.push(titles);
                return {
                    query: {
                        pages: titles.split('|').map((title) => ({
                            revisions: [{ timestamp: '2026-08-03T00:00:00Z' }],
                            title,
                        })),
                    },
                };
            }
            return {
                query: {
                    pages: [
                        {
                            revisions: [{ slots: { main: { content: '' } } }],
                            title: titles,
                        },
                    ],
                },
            };
        },
    } as unknown as mw.Api;

    await pages.fetchPageCreationTimes(api, [
        'Template:Alias batch A',
        'T:Alias batch B',
        '樣板:Alias batch C',
    ]);

    assert.deepEqual(batches, [
        'Template:Alias batch A|T:Alias batch B|樣板:Alias batch C',
    ]);
});

test('creation-time diagnostics do not include page titles', async () => {
    const output: unknown[][] = [];
    const diagnosticLogger = createLogger('wpvg-assessor-test', {
        level: 'debug',
        output: {
            debug(...values) {
                output.push(values);
            },
            error() {},
            info(...values) {
                output.push(values);
            },
            warn() {},
        },
    });
    const diagnosticPages = pageApi.createPageApi(
        diagnosticLogger,
        creationTimeCache,
    );
    const secretTitle = 'Private Draft Title';

    await diagnosticPages.fetchPageCreationTimes(
        createCreationTimeApi(secretTitle),
        [secretTitle],
    );

    assert.equal(JSON.stringify(output).includes(secretTitle), false);
    assert.match(JSON.stringify(output), /itemCount/u);
});

test('omits explicitly missing list peers from optional creation-time reads', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const missingTitle = 'File:阴阳师 (游戏).JPG';
    const api = createCreationLookupApi(
        {
            'COCORO (遊戲)': {
                title: 'COCORO (遊戲)',
                revisions: [
                    { slots: { main: { content: '#REDIRECT [[COCORO]]' } } },
                ],
            },
            COCORO: {
                title: 'COCORO',
                revisions: [{ slots: { main: { content: 'Article source' } } }],
            },
            [missingTitle]: { ns: 6, title: missingTitle, missing: true },
        },
        requests,
    );

    const dates = await pages.fetchPageCreationTimes(api, [
        'COCORO (遊戲)',
        'COCORO',
        missingTitle,
    ]);

    assert.equal(dates.has(missingTitle), false);
    assert.equal(
        dates.get('COCORO')?.toISOString(),
        '2026-08-29T00:00:00.000Z',
    );
    assert.equal(dates.get('COCORO (遊戲)'), dates.get('COCORO'));
    assert.deepEqual(
        requests
            .filter((request) => request.rvdir === 'newer')
            .map((request) => request.titles),
        ['COCORO'],
    );
});

test('an optional lookup containing only a missing page needs no revision-date query', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const api = createCreationLookupApi(
        { Missing: { title: 'Missing', missing: true } },
        requests,
    );

    const dates = await pages.fetchPageCreationTimes(api, ['Missing']);

    assert.equal(dates.size, 0);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.rvdir, undefined);
});

test('optional creation-time reads still reject unreadable existing or omitted pages', async () => {
    const sourcePages = [
        {
            title: 'Unreadable',
            revisions: [{ slots: { main: { texthidden: true } } }],
        },
        { title: 'Unreadable' },
        null,
    ];

    for (const sourcePage of sourcePages) {
        const api = createCreationLookupApi({ Unreadable: sourcePage });
        await assert.rejects(
            pages.fetchPageCreationTimes(api, ['Unreadable']),
            /omitted readable revision content/u,
        );
    }
});

test('an explicitly missing current subject still stops dialog metadata loading', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const api = createCreationLookupApi(
        { COCORO: { ns: 0, title: 'COCORO', missing: true } },
        requests,
    );

    await assert.rejects(
        pages.fetchSubjectPageInfo(api, 'COCORO'),
        /Unable to read the current subject page: COCORO/u,
    );
    assert.equal(requests.length, 2);
    assert.equal(
        requests.some((request) => request.rvdir === 'newer'),
        false,
    );
});

function createCreationLookupApi(
    sourcePages: Record<string, Record<string, unknown> | null>,
    requests: Array<Record<string, unknown>> = [],
): mw.Api {
    return {
        async get(params: Record<string, unknown>): Promise<unknown> {
            requests.push(params);
            if (params.rvdir === 'newer') {
                return {
                    query: {
                        pages: String(params.titles)
                            .split('|')
                            .map((title) => ({
                                title,
                                revisions: [
                                    { timestamp: '2026-08-29T00:00:00Z' },
                                ],
                            })),
                    },
                };
            }
            return { query: { pages: [sourcePages[String(params.titles)]] } };
        },
    } as unknown as mw.Api;
}

function createCreationTimeApi(title: string): mw.Api {
    let calls = 0;
    return {
        async get(): Promise<unknown> {
            calls += 1;
            if (calls === 1) {
                return {
                    query: {
                        pages: [
                            {
                                revisions: [
                                    { slots: { main: { content: '' } } },
                                ],
                                title,
                            },
                        ],
                    },
                };
            }
            return {
                query: {
                    pages: [
                        {
                            revisions: [{ timestamp: '2026-08-03T00:00:00Z' }],
                            title,
                        },
                    ],
                },
            };
        },
    } as unknown as mw.Api;
}

test('recognizes direct and nested edit conflicts', () => {
    assert.equal(isEditConflict('editconflict'), true);
    assert.equal(isEditConflict({ code: 'editconflict' }), true);
    assert.equal(isEditConflict({ error: { code: 'editconflict' } }), true);
    assert.equal(isEditConflict({ code: 'permissiondenied' }), false);
});

test('retries conflicts with the exact reviewed top section', async () => {
    const { api, posts } = createConflictingApi();

    const result = await saveTalkAssessment(api, {
        summary: 'Reviewed summary',
        title: 'Talk:Example',
        topSection: '{{Reviewed}}\n',
    });

    const expected = '{{Reviewed}}\n\n== Discussion ==\nConcurrent body';
    assert.equal(result, expected);
    assert.equal(posts.length, 2);
    assert.equal(posts[0].token, 'csrf');
    assert.equal(posts[0].params.basetimestamp, 'base-1');
    assert.equal(posts[1].params.basetimestamp, 'base-2');
    assert.equal(posts[1].params.starttimestamp, 'start-2');
    assert.equal(posts[1].params.summary, 'Reviewed summary');
    assert.equal(posts[1].params.text, expected);
});
