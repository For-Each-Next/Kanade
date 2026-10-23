/**
 * @file tests/rev-copy/revision-timestamp.test.mjs
 * Purpose: Verify exact-revision timestamp validation, request reuse, retry, and cache boundaries.
 *
 * Table of contents:
 * 1. Imports and offline host helpers
 * 2. Request sharing and identity
 * 3. Validation and retry
 * 4. Cache bounds
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers.mjs';

const { getRevisionTimestamp } = await loadModule(
    'src/rev-copy/platform/mediawiki/revision.ts',
);
const timestamp = '2026-09-05T12:00:26Z';

function revisionResponse(revisionId, value = timestamp) {
    return {
        query: {
            pages: [{ revisions: [{ revid: revisionId, timestamp: value }] }],
        },
    };
}

function createRevisionHost(
    response = ({ revids }) => revisionResponse(revids),
) {
    const values = { wgServerName: 'zh.wikipedia.org', wgScriptPath: '/w' };
    const requests = [];
    const host = {
        config: { get: (name) => values[name] },
        Api: class {
            async get(parameters) {
                requests.push(parameters);
                return response(parameters, requests.length);
            }
        },
    };
    return { host, values, requests };
}

function useHost(host) {
    const previous = globalThis.mw;
    globalThis.mw = host;
    return () => {
        if (previous === undefined) delete globalThis.mw;
        else globalThis.mw = previous;
    };
}

test('identical revision lookups share pending and validated timestamp data', async () => {
    let resolveRevision;
    const revision = new Promise((resolve) => {
        resolveRevision = resolve;
    });
    const { host, requests } = createRevisionHost(() => revision);
    const restore = useHost(host);
    try {
        const first = getRevisionTimestamp(123);
        const second = getRevisionTimestamp(123);
        assert.deepEqual(requests, [
            {
                action: 'query',
                prop: 'revisions',
                revids: 123,
                rvprop: 'ids|timestamp',
                formatversion: 2,
            },
        ]);
        resolveRevision(revisionResponse(123));
        assert.deepEqual(await Promise.all([first, second]), [
            timestamp,
            timestamp,
        ]);
        assert.equal(await getRevisionTimestamp(123), timestamp);
        assert.equal(requests.length, 1);
    } finally {
        restore();
    }
});

test('cache identity separates revisions, wiki origins, script paths, and host runtimes', async () => {
    const first = createRevisionHost();
    const second = createRevisionHost();
    const restore = useHost(first.host);
    try {
        await getRevisionTimestamp(123);
        await getRevisionTimestamp(456);
        first.values.wgServerName = 'en.wikipedia.org';
        await getRevisionTimestamp(123);
        first.values.wgScriptPath = '/wiki-api';
        await getRevisionTimestamp(123);
        first.values.wgServerName = 'zh.wikipedia.org';
        first.values.wgScriptPath = '/w';
        await getRevisionTimestamp(123);
        assert.deepEqual(
            first.requests.map(({ revids }) => revids),
            [123, 456, 123, 123],
        );
        globalThis.mw = second.host;
        assert.equal(await getRevisionTimestamp(123), timestamp);
        assert.equal(second.requests.length, 1);
    } finally {
        restore();
    }
});

test('the hostname and default API path qualify lookups without host configuration', async () => {
    const { host, values, requests } = createRevisionHost();
    delete values.wgServerName;
    delete values.wgScriptPath;
    const previousLocation = globalThis.location;
    globalThis.location = { hostname: 'zh.wikipedia.org' };
    const restore = useHost(host);
    try {
        await getRevisionTimestamp(123);
        globalThis.location.hostname = 'en.wikipedia.org';
        await getRevisionTimestamp(123);
        values.wgServerName = 'zh.wikipedia.org';
        values.wgScriptPath = '/w';
        await getRevisionTimestamp(123);
        assert.equal(requests.length, 2);
    } finally {
        restore();
        if (previousLocation === undefined) delete globalThis.location;
        else globalThis.location = previousLocation;
    }
});

test('failed pending requests are shared and discarded so the revision can retry', async () => {
    let rejectRevision;
    const revision = new Promise((_resolve, reject) => {
        rejectRevision = reject;
    });
    const { host, requests } = createRevisionHost(({ revids }, count) =>
        count === 1 ? revision : revisionResponse(revids),
    );
    const restore = useHost(host);
    try {
        const first = getRevisionTimestamp(123);
        const second = getRevisionTimestamp(123);
        const rejected = Promise.allSettled([first, second]);
        rejectRevision(new Error('The revision API is unavailable.'));
        const results = await rejected;
        assert.ok(results.every(({ status }) => status === 'rejected'));
        assert.equal(requests.length, 1);
        assert.equal(await getRevisionTimestamp(123), timestamp);
        assert.equal(await getRevisionTimestamp(123), timestamp);
        assert.equal(requests.length, 2);
    } finally {
        restore();
    }
});

test('revision IDs must be positive safe integers before an API request starts', async () => {
    const { host, requests } = createRevisionHost();
    const restore = useHost(host);
    try {
        for (const revisionId of [0, -1, 1.5, NaN, Infinity, 2 ** 53, '123'])
            await assert.rejects(getRevisionTimestamp(revisionId));
        assert.equal(requests.length, 0);
    } finally {
        restore();
    }
});

test('mismatched revision metadata is rejected and cannot enter the cache', async () => {
    const { host, requests } = createRevisionHost(({ revids }, count) =>
        revisionResponse(count === 1 ? 999 : revids),
    );
    const restore = useHost(host);
    try {
        await assert.rejects(getRevisionTimestamp(123));
        assert.equal(await getRevisionTimestamp(123), timestamp);
        assert.equal(requests.length, 2);
    } finally {
        restore();
    }
});

test('timestamps require real UTC calendar dates at whole-second precision', async () => {
    const invalidTimestamps = [
        '2026-02-29T12:00:26Z',
        '2026-02-31T12:00:26Z',
        '2026-00-05T12:00:26Z',
        '2026-13-05T12:00:26Z',
        '2026-09-00T12:00:26Z',
        '2026-09-05T24:00:00Z',
        '2026-09-05T12:60:26Z',
        '2026-09-05T12:00:60Z',
        '2026-09-05T12:00:26.000Z',
        '2026-09-05T12:00:26+00:00',
        'not a timestamp',
        null,
    ];
    for (const invalidTimestamp of invalidTimestamps) {
        const { host, requests } = createRevisionHost(({ revids }, count) =>
            revisionResponse(
                revids,
                count === 1 ? invalidTimestamp : timestamp,
            ),
        );
        const restore = useHost(host);
        try {
            await assert.rejects(getRevisionTimestamp(123));
            assert.equal(await getRevisionTimestamp(123), timestamp);
            assert.equal(requests.length, 2);
        } finally {
            restore();
        }
    }
    const leapTimestamp = '2024-02-29T23:59:59Z';
    const { host } = createRevisionHost(({ revids }) =>
        revisionResponse(revids, leapTimestamp),
    );
    const restore = useHost(host);
    try {
        assert.equal(await getRevisionTimestamp(123), leapTimestamp);
    } finally {
        restore();
    }
});

test('timestamp caching is bounded while recently used revisions stay available', async () => {
    const { host, requests } = createRevisionHost();
    const restore = useHost(host);
    try {
        for (let revisionId = 1; revisionId <= 200; revisionId++)
            await getRevisionTimestamp(revisionId);
        await getRevisionTimestamp(1);
        assert.equal(requests.length, 200);
        await getRevisionTimestamp(201);
        await getRevisionTimestamp(1);
        assert.equal(requests.length, 201);
        await getRevisionTimestamp(2);
        assert.equal(requests.length, 202);
        assert.equal(requests.at(-1).revids, 2);
        await getRevisionTimestamp(201);
        assert.equal(requests.length, 202);
    } finally {
        restore();
    }
});
