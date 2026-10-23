/**
 * @file tests/vg-stub-creator/page-title-checks.test.ts
 * Purpose: Require confirmed exact and Chinese-variant evidence before declaring titles missing.
 *
 * Table of contents:
 * 1. Imports
 * 2. createLookupApi
 * 3. missingResponse
 * 4. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchExistingPageTitles } from '../../src/vg-stub-creator/platform/mediawiki/page-title-checks.ts';

function createLookupApi(
    reply: (params: Record<string, string>) => unknown | Promise<unknown>,
) {
    const calls: Record<string, string>[] = [];
    return {
        calls,
        api: {
            async get(params: Record<string, string>) {
                calls.push({ ...params });
                return reply(params);
            },
        },
    };
}

function missingResponse(params: Record<string, string>) {
    return {
        query: {
            pages: params.titles.split('|').map((title) => ({
                title,
                missing: true,
            })),
        },
    };
}

test('confirmed exact pages retain their identity without following redirects or checking variants', async () => {
    const { api, calls } = createLookupApi(() => ({
        query: {
            pages: [{ title: 'Alias', pageid: 7, redirect: true }],
        },
    }));
    assert.deepEqual(await fetchExistingPageTitles(api, ['Alias']), [
        { requestedTitle: 'Alias', title: 'Alias', exists: true },
    ]);
    assert.deepEqual(calls, [
        { action: 'query', formatversion: '2', titles: 'Alias' },
    ]);
});

test('an existing Traditional variant blocks a missing Simplified candidate without rewriting the requested name', async () => {
    const { api, calls } = createLookupApi((params) =>
        params.variant === 'zh-hant'
            ? {
                  query: {
                      converted: [{ from: '摄影冒险', to: '攝影冒險' }],
                      pages: [{ title: '攝影冒險', pageid: 9 }],
                  },
              }
            : missingResponse(params),
    );
    assert.deepEqual(await fetchExistingPageTitles(api, ['摄影冒险']), [
        { requestedTitle: '摄影冒险', title: '攝影冒險', exists: true },
    ]);
    assert.equal(calls[0]?.converttitles, undefined);
    assert.deepEqual(
        calls.slice(1).map((params) => [params.converttitles, params.variant]),
        [
            ['1', 'zh-hans'],
            ['1', 'zh-hant'],
        ],
    );
});

test('confirmed missing results require valid exact, Simplified and Traditional responses', async () => {
    const { api, calls } = createLookupApi(missingResponse);
    assert.deepEqual(await fetchExistingPageTitles(api, ['Missing name']), [
        {
            requestedTitle: 'Missing name',
            title: 'Missing name',
            exists: false,
        },
    ]);
    assert.equal(calls.length, 3);
});

test('normalization and conversion chains preserve category and template namespaces', async () => {
    for (const namespace of ['Category', 'Template']) {
        const requestedTitle = `${namespace.toLowerCase()}:摄影冒险`;
        const normalizedTitle = `${namespace}:摄影冒险`;
        const convertedTitle = `${namespace}:攝影冒險`;
        const { api } = createLookupApi((params) => ({
            query: {
                normalized: [{ from: requestedTitle, to: normalizedTitle }],
                ...(params.variant === 'zh-hant'
                    ? {
                          converted: [
                              { from: normalizedTitle, to: convertedTitle },
                          ],
                      }
                    : {}),
                pages: [
                    params.variant === 'zh-hant'
                        ? { title: convertedTitle, pageid: 17 }
                        : { title: normalizedTitle, missing: true },
                ],
            },
        }));
        assert.deepEqual(await fetchExistingPageTitles(api, [requestedTitle]), [
            { requestedTitle, title: convertedTitle, exists: true },
        ]);
    }
});

test('malformed, invalid and incomplete responses never become confirmed missing titles', async () => {
    const responses = [
        null,
        {},
        { error: { code: 'maxlag', info: 'Database replication pending' } },
        { query: { pages: [] } },
        { query: { pages: {} } },
        { query: { pages: { 1: { title: 'Missing name', pageid: 1 } } } },
        { query: { pages: [{ title: 'Missing name', missing: '' }] } },
        { query: { pages: [null] } },
        { query: { pages: [{ title: 'Missing name' }] } },
        { query: { pages: [{ title: 'Missing name', invalid: true }] } },
        { query: { pages: [{ title: 'Other name', missing: true }] } },
        { query: { pages: [{ title: 'Missing name', pageid: -1 }] } },
        {
            query: {
                pages: [{ title: 'Missing name', missing: false, pageid: 1 }],
            },
        },
        {
            query: {
                converted: null,
                pages: [{ title: 'Missing name', missing: true }],
            },
        },
        {
            query: {
                normalized: [
                    { from: 'Missing name', to: 'Other name' },
                    { from: 'Other name', to: 'Missing name' },
                ],
                pages: [{ title: 'Missing name', missing: true }],
            },
        },
    ];
    for (const response of responses) {
        const { api, calls } = createLookupApi(() => response);
        await assert.rejects(
            fetchExistingPageTitles(api, ['Missing name']),
            /Title request failed/u,
        );
        assert.equal(calls.length, 1);
    }
});

test('a failed variant prevents missing status and remains eligible for an explicit recheck', async () => {
    let unavailable = true;
    const { api, calls } = createLookupApi((params) => {
        if (unavailable && params.variant === 'zh-hant')
            throw new Error('Variant service unavailable');
        return missingResponse(params);
    });
    await assert.rejects(
        fetchExistingPageTitles(api, ['Missing name']),
        /Variant service unavailable/u,
    );
    unavailable = false;
    assert.deepEqual(await fetchExistingPageTitles(api, ['Missing name']), [
        {
            requestedTitle: 'Missing name',
            title: 'Missing name',
            exists: false,
        },
    ]);
    assert.equal(calls.length, 6);
});

test('only exact misses need variant requests in a mixed batch', async () => {
    const { api, calls } = createLookupApi((params) =>
        params.variant == null
            ? {
                  query: {
                      pages: [
                          { title: 'Known name', pageid: 1 },
                          { title: 'Missing name', missing: true },
                      ],
                  },
              }
            : missingResponse(params),
    );
    assert.deepEqual(
        await fetchExistingPageTitles(api, ['Known name', 'Missing name']),
        [
            { requestedTitle: 'Known name', title: 'Known name', exists: true },
            {
                requestedTitle: 'Missing name',
                title: 'Missing name',
                exists: false,
            },
        ],
    );
    assert.deepEqual(
        calls.map((params) => params.titles),
        ['Known name|Missing name', 'Missing name', 'Missing name'],
    );
});

test('title batches respect API limits and preserve case-sensitive names', async () => {
    const titles = [
        'Name',
        'NAME',
        ...Array.from({ length: 49 }, (_, index) => `Name ${index}`),
    ];
    const { api, calls } = createLookupApi((params) => ({
        query: {
            pages: params.titles.split('|').map((title, index) => ({
                title,
                pageid: index + 1,
            })),
        },
    }));
    const results = await fetchExistingPageTitles(api, titles);
    assert.deepEqual(
        results.map((result) => result.requestedTitle),
        titles,
    );
    assert.deepEqual(
        calls.map((params) => params.titles.split('|').length),
        [50, 1],
    );
});

test('empty input avoids lookups and underscore duplicates retain one exact identity', async () => {
    const { api, calls } = createLookupApi((params) => ({
        query: { pages: [{ title: params.titles, pageid: 1 }] },
    }));
    assert.deepEqual(await fetchExistingPageTitles(api, ['', ' ']), []);
    assert.equal(calls.length, 0);
    assert.deepEqual(
        await fetchExistingPageTitles(api, [' Game_Name ', 'Game Name']),
        [{ requestedTitle: 'Game Name', title: 'Game Name', exists: true }],
    );
    assert.equal(calls.length, 1);
});
