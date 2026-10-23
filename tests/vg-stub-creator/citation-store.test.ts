/**
 * @file tests/vg-stub-creator/citation-store.test.ts
 * Purpose: Verifies citation request ownership across explicit refreshes.
 * Contents: Superseded responses, pending deduplication, and retry.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createCitationStore } from '../../src/vg-stub-creator/platform/network/citation-store.ts';

function createFixture() {
    const responses: Array<{
        resolve(response: Response): void;
        reject(error: Error): void;
    }> = [];
    const store = createCitationStore({
        fetcher: () =>
            new Promise<Response>((resolve, reject) => {
                responses.push({ resolve, reject });
            }),
        now: new Date('2026-10-09T00:00:00Z'),
    });
    const url = 'https://example.test/source';
    function complete(index: number, title: string): void {
        responses[index].resolve(
            new Response(JSON.stringify([{ title, url }]), {
                headers: { 'content-type': 'application/json' },
            }),
        );
    }
    return { store, url, responses, complete };
}

test('a superseded citation response cannot replace the refreshed cache', async () => {
    const { store, url, responses, complete } = createFixture();
    const original = store.fetch(url);
    const refreshed = store.refetch(url);
    complete(1, 'Current citation');
    const current = await refreshed;
    complete(0, 'Older citation');
    const older = await original;

    assert.notEqual(older, current);
    assert.equal(await store.fetch(` ${url} `), current);
    assert.equal(responses.length, 2);
});

test('finishing a superseded citation request retains the current pending request', async () => {
    const { store, url, responses, complete } = createFixture();
    const original = store.fetch(url);
    const refreshed = store.refetch(url);
    complete(0, 'Older citation');
    await original;

    assert.equal(store.fetch(url), refreshed);
    assert.equal(responses.length, 2);
    complete(1, 'Current citation');
    assert.equal(await store.fetch(url), await refreshed);
});

test('a superseded citation failure retains the current pending request', async () => {
    const { store, url, responses, complete } = createFixture();
    const original = store.fetch(url);
    const refreshed = store.refetch(url);
    const failure = assert.rejects(original, /Old request failed/u);
    responses[0].reject(new Error('Old request failed'));
    await failure;

    assert.equal(store.fetch(url), refreshed);
    assert.equal(responses.length, 2);
    complete(1, 'Current citation');
    await refreshed;
});

test('a failed current citation request remains eligible for an explicit retry', async () => {
    const { store, url, responses, complete } = createFixture();
    const request = store.fetch(url);
    const failure = assert.rejects(request, /Request failed/u);
    responses[0].reject(new Error('Request failed'));
    await failure;

    const retry = store.fetch(url);
    assert.equal(responses.length, 2);
    complete(1, 'Retried citation');
    const result = await retry;
    assert.equal(await store.fetch(url), result);
});
