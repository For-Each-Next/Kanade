/**
 * @file tests/vg-stub-creator/category-cache.test.ts
 * Purpose: Verify category cache expiry, persisted evidence, and storage failures.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. createResolution
 * 4. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createCategoryCacheStore } from '../../src/vg-stub-creator/platform/browser/storage/category-cache.ts';
import { createMemoryStorage } from './support/storage.ts';

const CACHE_KEY = 'vg-stub-creator-category-cache:Star Harbor';
const HOUR = 60 * 60 * 1000;

function createResolution(title: string, exists = true) {
    return { exists, requestedTitle: title, title };
}

test('category evidence expires by age in both persisted and active caches', () => {
    const storage = createMemoryStorage();
    let now = 1_000;
    const cache = createCategoryCacheStore('Star Harbor', storage, () => now);
    cache.cache.existing = createResolution('Windows游戏');
    cache.cache.missing = createResolution('星海游戏', false);
    cache.save();

    now += HOUR - 1;
    let restored = createCategoryCacheStore('Star Harbor', storage, () => now);
    assert.equal(restored.cache.missing.exists, false);
    now += 1;
    assert.equal(cache.cache.missing, undefined);
    assert.equal(cache.cache.existing.exists, true);
    restored = createCategoryCacheStore('Star Harbor', storage, () => now);
    assert.equal(restored.cache.missing, undefined);
    assert.equal(restored.cache.existing.exists, true);

    now += 23 * HOUR;
    assert.deepEqual(Object.keys(cache.cache), []);
    restored = createCategoryCacheStore('Star Harbor', storage, () => now);
    assert.deepEqual(Object.keys(restored.cache), []);
});

test('saving unrelated lookups preserves observation times while a new lookup refreshes its own evidence', () => {
    const storage = createMemoryStorage();
    let now = 1_000;
    const cache = createCategoryCacheStore('Star Harbor', storage, () => now);
    cache.cache.missing = createResolution('星海游戏', false);
    cache.save();
    now += HOUR / 2;
    const restored = createCategoryCacheStore(
        'Star Harbor',
        storage,
        () => now,
    );
    restored.cache.unrelated = createResolution('任天堂游戏');
    restored.save();
    const persisted = JSON.parse(storage.getItem(CACHE_KEY)!);
    assert.equal(persisted.entries.missing.observedAt, 1_000);
    assert.equal(persisted.entries.unrelated.observedAt, now);

    now += HOUR / 4;
    restored.cache.unrelated = createResolution('任天堂游戏');
    restored.save();
    assert.equal(
        JSON.parse(storage.getItem(CACHE_KEY)!).entries.unrelated.observedAt,
        now,
    );
    now = 1_000 + HOUR;
    restored.save();
    assert.equal(
        JSON.parse(storage.getItem(CACHE_KEY)!).entries.missing,
        undefined,
    );
    assert.equal(restored.cache.unrelated.exists, true);
});

test('malformed, legacy, and future category evidence cannot become cached resolutions', () => {
    const storage = createMemoryStorage();
    for (const value of [
        '{broken JSON',
        JSON.stringify({ old: createResolution('Windows游戏') }),
        JSON.stringify({ version: 2, entries: {} }),
        JSON.stringify({ version: 1, entries: [] }),
    ]) {
        storage.setItem(CACHE_KEY, value);
        const cache = createCategoryCacheStore(
            'Star Harbor',
            storage,
            () => 1_000,
        );
        assert.deepEqual(Object.keys(cache.cache), []);
    }
    storage.setItem(
        CACHE_KEY,
        JSON.stringify({
            version: 1,
            entries: {
                valid: {
                    observedAt: 500,
                    resolution: createResolution('Windows游戏'),
                },
                future: {
                    observedAt: 2_000,
                    resolution: createResolution('任天堂游戏'),
                },
                malformed: {
                    observedAt: 500,
                    resolution: { exists: false, title: '星海游戏' },
                },
                invalidPage: {
                    observedAt: 500,
                    resolution: { ...createResolution('星海游戏'), page: [] },
                },
            },
        }),
    );
    const cache = createCategoryCacheStore('Star Harbor', storage, () => 1_000);
    assert.deepEqual(Object.keys(cache.cache), ['valid']);
    cache.cache.failure = { exists: 'unknown', title: '星海游戏' };
    assert.equal(cache.cache.failure, undefined);
});

test('clearing category evidence preserves other pages and tolerates storage failure', () => {
    const storage = createMemoryStorage();
    const cache = createCategoryCacheStore('Star Harbor', storage, () => 1_000);
    const other = createCategoryCacheStore(
        'Another game',
        storage,
        () => 1_000,
    );
    cache.cache.windows = createResolution('Windows游戏');
    other.cache.nintendo = createResolution('任天堂游戏');
    cache.save();
    other.save();
    cache.clear();
    assert.deepEqual(Object.keys(cache.cache), []);
    assert.equal(storage.getItem(CACHE_KEY), null);
    assert.equal(
        createCategoryCacheStore('Another game', storage, () => 1_000).cache
            .nintendo.exists,
        true,
    );

    const unavailable = {
        getItem() {
            throw new Error('Storage unavailable');
        },
        setItem() {
            throw new Error('Storage unavailable');
        },
        removeItem() {
            throw new Error('Storage unavailable');
        },
    } as unknown as Storage;
    const memory = createCategoryCacheStore(
        'Star Harbor',
        unavailable,
        () => 1_000,
    );
    memory.cache.windows = createResolution('Windows游戏');
    assert.doesNotThrow(() => memory.save());
    assert.equal(memory.cache.windows.exists, true);
    assert.doesNotThrow(() => memory.clear());
    assert.deepEqual(Object.keys(memory.cache), []);
});
