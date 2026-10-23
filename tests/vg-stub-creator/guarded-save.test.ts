/**
 * @file tests/vg-stub-creator/guarded-save.test.ts
 * Purpose: Verifies article write preconditions and ambiguous save handling.
 *
 * Table of contents:
 * 1. Imports
 * 2. createApi
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { saveReviewedArticle } from '../../src/vg-stub-creator/app/workflows/pre-save-write.ts';

function createApi(exists: boolean) {
    const posts: Record<string, unknown>[] = [];
    return {
        posts,
        async get() {
            return {
                curtimestamp: '2026-01-02T12:00:00Z',
                query: {
                    pages: [
                        exists
                            ? {
                                  title: '星海',
                                  revisions: [
                                      { timestamp: '2026-01-02T11:00:00Z' },
                                  ],
                              }
                            : { title: '星海', missing: true },
                    ],
                },
            };
        },
        async postWithToken(token: string, params: Record<string, unknown>) {
            assert.equal(token, 'csrf');
            posts.push(params);
        },
    };
}

test('creation and existing-page edits carry the appropriate preconditions', async () => {
    for (const exists of [false, true]) {
        const api = createApi(exists);
        await saveReviewedArticle(api, {
            exists,
            title: '星海',
            text: 'Reviewed article text',
            summary: 'Create a video game stub',
        });
        assert.equal(api.posts.length, 1);
        const post = api.posts[0]!;
        assert.equal(post.text, 'Reviewed article text');
        assert.equal(post.starttimestamp, '2026-01-02T12:00:00Z');
        assert.equal(post.createonly, exists ? undefined : true);
        assert.equal(post.nocreate, exists ? true : undefined);
        assert.equal(
            post.basetimestamp,
            exists ? '2026-01-02T11:00:00Z' : undefined,
        );
    }
});

test('a changed page-existence state aborts before the write', async () => {
    const api = createApi(true);
    await assert.rejects(
        saveReviewedArticle(api, {
            exists: false,
            title: '星海',
            text: 'Reviewed text',
            summary: 'Create stub',
        }),
        /already exists/u,
    );
    assert.deepEqual(api.posts, []);
});

test('an ambiguous primary edit is propagated without an automatic retry', async () => {
    const api = createApi(false);
    let attempts = 0;
    api.postWithToken = async () => {
        attempts += 1;
        throw new Error('Connection lost after dispatch');
    };
    await assert.rejects(
        saveReviewedArticle(api, {
            exists: false,
            title: '星海',
            text: 'Reviewed text',
            summary: 'Create stub',
        }),
        /Connection lost/u,
    );
    assert.equal(attempts, 1);
});

test('malformed or obsolete precondition responses cannot authorize article creation', async () => {
    const responses = [
        { curtimestamp: '2026-10-06T12:00:00Z' },
        { curtimestamp: '2026-10-06T12:00:00Z', query: { pages: {} } },
        {
            curtimestamp: '2026-10-06T12:00:00Z',
            query: { pages: [{ title: '星海', missing: '' }] },
        },
        {
            curtimestamp: '2026-10-06T12:00:00Z',
            query: { pages: [{ title: '星海', invalid: true }] },
        },
    ];
    for (const response of responses) {
        let writes = 0;
        await assert.rejects(
            saveReviewedArticle(
                {
                    get: async () => response,
                    postWithToken: async () => {
                        writes += 1;
                    },
                },
                {
                    exists: false,
                    title: '星海',
                    text: 'Reviewed source',
                    summary: 'Reviewed summary',
                },
            ),
            /invalid reviewed page/u,
        );
        assert.equal(writes, 0);
    }
});
