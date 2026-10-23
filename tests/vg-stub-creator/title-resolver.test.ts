/**
 * @file tests/vg-stub-creator/title-resolver.test.ts
 * Purpose: Verify that related-page lookups cache confirmed results and propagate failed checks.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createCategoryCacheStore } from '../../src/vg-stub-creator/platform/browser/storage/category-cache.ts';
import { resolvePageTitles } from '../../src/vg-stub-creator/platform/mediawiki/title-resolver.ts';
import { createMemoryStorage } from './support/storage.ts';

test('a cache expiry boundary keeps the lookup observation without fabricating a miss', async () => {
    const day = 24 * 60 * 60 * 1000;
    let advancing = false;
    let ticks = 0;
    const now = () => (advancing ? 1_000 + day - 1 + ticks++ : 1_000);
    const store = createCategoryCacheStore('Game', createMemoryStorage(), now);
    store.cache['Windows遊戲'] = {
        exists: true,
        requestedTitle: 'Windows遊戲',
        title: 'Windows遊戲',
    };
    let requests = 0;
    advancing = true;
    const resolutions = await resolvePageTitles(
        ['Windows遊戲'],
        { namespace: 14 },
        {
            cache: store.cache,
            fetcher: async () => {
                requests += 1;
                throw new Error('The observed category was still fresh');
            },
        },
    );
    assert.equal(resolutions['Windows遊戲']?.exists, true);
    assert.equal(requests, 0);
    assert.equal(store.cache['Windows遊戲'], undefined);
});

test('expired evidence is fetched again and explicit bypass replaces fresh evidence', async () => {
    let now = 1_000;
    const store = createCategoryCacheStore(
        'Game',
        createMemoryStorage(),
        () => now,
    );
    store.cache['Windows遊戲'] = {
        exists: false,
        requestedTitle: 'Windows遊戲',
        title: 'Windows遊戲',
    };
    now += 60 * 60 * 1000;
    let requests = 0;
    const fetcher: typeof fetch = async () => {
        requests += 1;
        return Response.json({
            query: {
                pages: [
                    requests === 1
                        ? { title: 'Category:Windows遊戲', pageid: 123 }
                        : { title: 'Category:Windows遊戲', missing: true },
                ],
            },
        });
    };
    const confirmed = await resolvePageTitles(
        ['Windows遊戲'],
        { namespace: 14 },
        { cache: store.cache, fetcher },
    );
    assert.equal(confirmed['Windows遊戲']?.exists, true);
    assert.equal(store.cache['Windows遊戲'].exists, true);
    const rechecked = await resolvePageTitles(
        ['Windows遊戲'],
        { namespace: 14 },
        { bypassCache: true, cache: store.cache, fetcher },
    );
    assert.equal(rechecked['Windows遊戲']?.exists, false);
    assert.equal(store.cache['Windows遊戲'].exists, false);
    assert.equal(requests, 2);
});

test('transport and HTTP failures preserve confirmed cache entries without retrying', async () => {
    for (const failure of ['network', 'http']) {
        const previous = {
            exists: true,
            requestedTitle: 'Switch遊戲',
            title: '任天堂Switch遊戲',
        };
        const cache = { Switch遊戲: previous };
        let requests = 0;
        const fetcher: typeof fetch = async () => {
            requests += 1;
            if (failure === 'network') {
                throw new Error('Network unavailable');
            }
            return new Response('Service unavailable', { status: 503 });
        };

        await assert.rejects(
            resolvePageTitles(
                ['Switch遊戲'],
                { namespace: 14 },
                {
                    bypassCache: true,
                    cache,
                    fetcher,
                },
            ),
            failure === 'network' ? /Network unavailable/u : /HTTP 503/u,
        );
        assert.equal(requests, 1);
        assert.deepEqual(cache, { Switch遊戲: previous });
    }
});

test('API errors and malformed page responses never become cached missing pages', async () => {
    const failedResponses = [
        { error: { code: 'maxlag', info: 'Waiting for database replication' } },
        null,
        {},
        { query: { pages: {} } },
        { query: { pages: [] } },
        { query: { pages: [null] } },
        { query: { pages: [{ missing: true }] } },
        { query: { pages: [{ title: 'Category:Switch遊戲' }] } },
        { query: { pages: [{ title: 'Category:Unrelated', missing: true }] } },
        { query: { pages: [{ title: 'Category:Switch遊戲', invalid: true }] } },
    ];

    for (const data of failedResponses) {
        const cache = {};
        await assert.rejects(
            resolvePageTitles(
                ['Switch遊戲'],
                { namespace: 14 },
                {
                    cache,
                    fetcher: async () => Response.json(data),
                },
            ),
            /Title request failed/u,
        );
        assert.deepEqual(cache, {});
    }
});

test('invalid JSON leaves the lookup uncached so a later explicit check can succeed', async () => {
    const cache = {};
    await assert.rejects(
        resolvePageTitles(
            ['不存在的遊戲分類'],
            { namespace: 14 },
            {
                cache,
                fetcher: async () => new Response('Invalid JSON'),
            },
        ),
        SyntaxError,
    );
    assert.deepEqual(cache, {});

    let requests = 0;
    const fetcher: typeof fetch = async () => {
        requests += 1;
        return Response.json({
            query: {
                pages: [{ title: 'Category:不存在的遊戲分類', missing: true }],
            },
        });
    };
    const first = await resolvePageTitles(
        ['不存在的遊戲分類'],
        { namespace: 14 },
        { cache, fetcher },
    );
    assert.equal(first['不存在的遊戲分類']?.exists, false);
    assert.equal(first['不存在的遊戲分類']?.title, '不存在的遊戲分類');
    const cached = await resolvePageTitles(
        ['分類:不存在的遊戲分類'],
        { namespace: 14 },
        { cache, fetcher },
    );
    assert.deepEqual(cached, first);
    assert.equal(requests, 1);
});

test('confirmed normalization, conversion, and redirects retain the canonical category', async () => {
    const cache = {};
    const resolutions = await resolvePageTitles(
        ['Switch_游戏'],
        { namespace: 14 },
        {
            cache,
            fetcher: async () =>
                Response.json({
                    query: {
                        normalized: [
                            {
                                from: 'Category:Switch_游戏',
                                to: 'Category:Switch 游戏',
                            },
                        ],
                        converted: [
                            {
                                from: 'Category:Switch 游戏',
                                to: 'Category:Switch 遊戲',
                            },
                        ],
                        redirects: [
                            {
                                from: 'Category:Switch 遊戲',
                                to: 'Category:任天堂Switch遊戲',
                            },
                        ],
                        pages: [
                            { title: 'Category:任天堂Switch遊戲', pageid: 123 },
                        ],
                    },
                }),
        },
    );
    assert.equal(resolutions['Switch 游戏']?.exists, true);
    assert.equal(resolutions['Switch 游戏']?.title, '任天堂Switch遊戲');
    let requests = 0;
    const cached = await resolvePageTitles(
        ['任天堂Switch遊戲'],
        { namespace: 14 },
        {
            cache,
            fetcher: async () => {
                requests += 1;
                throw new Error('Canonical alias should be cached');
            },
        },
    );
    assert.equal(cached['任天堂Switch遊戲']?.exists, true);
    assert.equal(requests, 0);
});

test('a failed Chinese variant query does not poison direct or fallback results', async () => {
    const cache = {};
    const fetcher: typeof fetch = async (input) => {
        const url = new URL(String(input), 'https://offline.test');
        if (url.searchParams.get('variant') === 'zh-hans') {
            return Response.json({ error: { code: 'maxlag' } });
        }
        return Response.json({
            query: {
                pages: [
                    { title: 'Template:Existing', pageid: 123 },
                    { title: 'Template:Missing', missing: true },
                ],
            },
        });
    };
    await assert.rejects(
        resolvePageTitles(
            ['Existing', 'Missing'],
            { namespace: 10, variantFallback: true },
            { cache, fetcher },
        ),
        /maxlag/u,
    );
    assert.deepEqual(cache, {});
});

test('a failed category soft-redirect target lookup does not confirm the source', async () => {
    const cache = {};
    let requests = 0;
    const fetcher: typeof fetch = async () => {
        requests += 1;
        if (requests === 2) {
            throw new Error('Redirect target lookup unavailable');
        }
        return Response.json({
            query: {
                pages: [
                    {
                        title: 'Category:Old game category',
                        pageid: 123,
                        pageprops: {
                            category_redirect_target: 'Current game category',
                        },
                    },
                ],
            },
        });
    };
    await assert.rejects(
        resolvePageTitles(
            ['Old game category'],
            {
                namespace: 14,
                getRedirectTarget: (page) =>
                    (
                        page as {
                            pageprops: { category_redirect_target: string };
                        }
                    ).pageprops.category_redirect_target,
            },
            { cache, fetcher },
        ),
        /Redirect target lookup unavailable/u,
    );
    assert.deepEqual(cache, {});
    assert.equal(requests, 2);
});
