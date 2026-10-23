/**
 * @file tests/source-editor/template-data-cache.test.ts
 * Purpose: Tests runtime TemplateData loading and browser-cache fallback.
 *
 * Table of contents:
 * 1. Imports
 * 2. MemoryObjectStorage
 * 3. Test scenarios
 * 4. testTemplateDataCache
 * 5. createTemplateDataApi
 * 6. assertTemplateDataRequest
 * 7. assertTemplateDataResult
 * 8. assertFreshCacheHit
 * 9. testRedirectCache
 * 10. createRedirectTemplateDataApi
 * 11. assertStaleCacheFallback
 * 12. assertAuthoritativeMissingEvictsCache
 * 13. createCaseSensitiveTemplateDataApi
 * 14. createTemplateDataPage
 * 15. createHostileTemplateDataApi
 * 16. createHostileTemplateDataCache
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    loadCitationTemplateData,
    TEMPLATE_DATA_CACHE_KEY,
    type MediaWikiTemplateDataApi,
    type TemplateDataObjectStorage,
} from '../../src/source-editor/platform/mediawiki/template-data.ts';

class MemoryObjectStorage implements TemplateDataObjectStorage {
    value: unknown;

    getObject(key: string): unknown {
        assert.equal(key, TEMPLATE_DATA_CACHE_KEY);
        return structuredClone(this.value);
    }

    setObject(key: string, value: unknown): void {
        assert.equal(key, TEMPLATE_DATA_CACHE_KEY);
        this.value = structuredClone(value);
    }
}

test(
    'fetches and caches only generic citation TemplateData fields',
    testTemplateDataCache,
);

async function testTemplateDataCache(): Promise<void> {
    const calls: Array<Record<string, unknown>> = [];
    const storage = new MemoryObjectStorage();
    const result = await loadCitationTemplateData(['Cite Fan Guide'], {
        api: createTemplateDataApi(calls),
        now: () => 1_000,
        storage,
        wikiId: 'examplewiki',
    });

    assertTemplateDataRequest(calls);
    assertTemplateDataResult(result);
    assert.doesNotMatch(JSON.stringify(storage.value), /description/u);
    await assertFreshCacheHit(storage, result);
}

function createTemplateDataApi(
    calls: Array<Record<string, unknown>>,
): MediaWikiTemplateDataApi {
    return {
        async get(parameters) {
            calls.push(parameters);
            return {
                pages: [
                    {
                        description: 'Not cached',
                        ns: 10,
                        paramOrder: ['title', 'writer'],
                        params: {
                            title: { aliases: ['name'] },
                            unused: { description: 'Not cached' },
                            writer: { aliases: ['Writer'] },
                        },
                        title: 'Template:Cite Fan Guide',
                    },
                ],
            };
        },
    };
}

function assertTemplateDataRequest(
    calls: Array<Record<string, unknown>>,
): void {
    assert.deepEqual(calls, [
        {
            action: 'templatedata',
            formatversion: 2,
            redirects: true,
            titles: 'Template:Cite Fan Guide',
        },
    ]);
}

function assertTemplateDataResult(
    result: Awaited<ReturnType<typeof loadCitationTemplateData>>,
): void {
    assert.deepEqual(result['Cite Fan Guide'], {
        aliases: {
            title: ['name'],
            unused: [],
            writer: ['Writer'],
        },
        canonicalName: 'Cite Fan Guide',
        paramOrder: ['title', 'writer', 'unused'],
    });
}

async function assertFreshCacheHit(
    storage: MemoryObjectStorage,
    expected: Awaited<ReturnType<typeof loadCitationTemplateData>>,
): Promise<void> {
    let cacheMissRequest = false;
    const cached = await loadCitationTemplateData(['Cite Fan Guide'], {
        api: {
            async get() {
                cacheMissRequest = true;
                throw new Error('Unexpected request');
            },
        },
        now: () => 2_000,
        storage,
        wikiId: 'examplewiki',
    });
    assert.equal(cacheMissRequest, false);
    assert.deepEqual(cached, expected);
}

test('normalizes localized API template namespaces', async () => {
    const result = await loadCitationTemplateData(['Cite Alias Guide'], {
        api: {
            async get() {
                return {
                    normalized: [
                        {
                            from: 'Template:Cite Alias Guide',
                            to: 'Vorlage:Cite Alias Guide',
                        },
                    ],
                    pages: [
                        {
                            ns: 10,
                            paramOrder: ['title'],
                            params: { title: { aliases: [] } },
                            title: 'Vorlage:Cite Alias Guide',
                        },
                    ],
                };
            },
        },
        wikiId: 'dewiki',
    });

    assert.equal(result['Cite Alias Guide']?.canonicalName, 'Cite Alias Guide');
});

test(
    'indexes redirect names and refreshes stale entries safely',
    testRedirectCache,
);

async function testRedirectCache(): Promise<void> {
    const storage = new MemoryObjectStorage();
    const first = await loadCitationTemplateData(['Cite Old Guide'], {
        api: createRedirectTemplateDataApi(),
        now: () => 1_000,
        storage,
        wikiId: 'examplewiki',
    });

    assert.equal(first['Cite Old Guide']?.canonicalName, 'Cite Fan Guide');
    assert.equal(first['Cite Fan Guide']?.canonicalName, 'Cite Fan Guide');
    await assertStaleCacheFallback(storage);
    await assertAuthoritativeMissingEvictsCache(storage);
}

function createRedirectTemplateDataApi(): MediaWikiTemplateDataApi {
    return {
        async get() {
            return {
                pages: [
                    {
                        ns: 10,
                        paramOrder: ['title'],
                        params: { title: { aliases: [] } },
                        title: 'Template:Cite Fan Guide',
                    },
                ],
                redirects: [
                    {
                        from: 'Template:Cite Old Guide',
                        to: 'Template:Cite Fan Guide',
                    },
                ],
            };
        },
    };
}

async function assertStaleCacheFallback(
    storage: MemoryObjectStorage,
): Promise<void> {
    let refreshRequests = 0;
    const stale = await loadCitationTemplateData(['Cite Old Guide'], {
        api: {
            async get() {
                refreshRequests += 1;
                throw new Error('Offline');
            },
        },
        now: () => 8 * 24 * 60 * 60 * 1_000,
        storage,
        wikiId: 'examplewiki',
    });
    assert.equal(refreshRequests, 1);
    assert.equal(stale['Cite Old Guide']?.canonicalName, 'Cite Fan Guide');
}

async function assertAuthoritativeMissingEvictsCache(
    storage: MemoryObjectStorage,
): Promise<void> {
    const missing = await loadCitationTemplateData(['Cite Old Guide'], {
        api: {
            async get() {
                return { pages: [] };
            },
        },
        now: () => 9 * 24 * 60 * 60 * 1_000,
        storage,
        wikiId: 'examplewiki',
    });
    assert.deepEqual(missing, {});
    assert.doesNotMatch(JSON.stringify(storage.value), /Cite Old Guide/u);
}

test(
    'preserves case-sensitive ' + 'and colon-bearing template titles',
    async () => {
        const calls: Array<Record<string, unknown>> = [];
        const names = ['Cite Apple Music', 'Cite apple music', 'Cite Foo:Bar'];
        const result = await loadCitationTemplateData(names, {
            api: createCaseSensitiveTemplateDataApi(calls),
            wikiId: 'examplewiki',
        });

        assert.equal(
            calls[0]?.titles,
            names.map((name) => `Template:${name}`).join('|'),
        );
        assert.deepEqual(Object.keys(result), names);
    },
);

function createCaseSensitiveTemplateDataApi(
    calls: Array<Record<string, unknown>>,
): MediaWikiTemplateDataApi {
    return {
        async get(parameters) {
            calls.push(parameters);
            return {
                pages: [
                    createTemplateDataPage('Cite Apple Music'),
                    createTemplateDataPage('Cite apple music'),
                    createTemplateDataPage('Cite Foo:Bar'),
                ],
            };
        },
    };
}

function createTemplateDataPage(name: string) {
    return {
        ns: 10,
        paramOrder: ['title'],
        params: { title: { aliases: [] } },
        title: `Template:${name}`,
    };
}

test('rejects structurally unsafe API and cache metadata', async () => {
    const apiResult = await loadCitationTemplateData(['Cite Hostile'], {
        api: createHostileTemplateDataApi(),
        wikiId: 'examplewiki',
    });
    assert.deepEqual(apiResult, {});

    const storage = new MemoryObjectStorage();
    storage.value = createHostileTemplateDataCache();
    const cachedResult = await loadCitationTemplateData(['Cite Hostile'], {
        api: {
            async get() {
                throw new Error('Offline');
            },
        },
        now: () => 2_000,
        storage,
        wikiId: 'examplewiki',
    });
    assert.deepEqual(cachedResult, {});
});

function createHostileTemplateDataApi(): MediaWikiTemplateDataApi {
    return {
        async get() {
            return {
                pages: [
                    {
                        ns: 10,
                        paramOrder: ['title|injected'],
                        params: {
                            'title|injected': { aliases: ['title'] },
                        },
                        title: 'Template:Cite Hostile',
                    },
                ],
            };
        },
    };
}

function createHostileTemplateDataCache(): unknown {
    return {
        entries: {
            'Cite Hostile': {
                aliases: { 'title|injected': ['title'] },
                canonicalName: 'Cite Hostile}}Injected',
                fetchedAt: 1_000,
                paramOrder: ['title|injected'],
            },
        },
        version: 1,
        wikiId: 'examplewiki',
    };
}

test('ignores missing data and unavailable browser storage', async () => {
    const storage: TemplateDataObjectStorage = {
        getObject() {
            throw new Error('Storage blocked');
        },
        setObject() {
            throw new Error('Quota exceeded');
        },
    };
    const result = await loadCitationTemplateData(
        ['Cite Missing', 'Cite Missing'],
        {
            api: {
                async get() {
                    return {
                        pages: [
                            {
                                missing: true,
                                title: 'Template:Cite Missing',
                            },
                        ],
                    };
                },
            },
            storage,
            wikiId: 'examplewiki',
        },
    );

    assert.deepEqual(result, {});
});
