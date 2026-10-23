/**
 * @file tests/rev-copy/attribution-resolution.test.mjs
 * Purpose: Exercise read-only attribution API resolution with offline responses.
 *
 * Contents: Revision fidelity, language links, tab caching, and retryable failures.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers.mjs';

const { resolveAttributionPages } = await loadModule(
    'src/rev-copy/platform/mediawiki/attribution.ts',
);
const current = {
    pageTitle: 'FIRE BIRD',
    revisionId: 321,
    site: { interwiki: 'w:zh', language: 'zh' },
    interfaceLanguage: 'zh-hant',
};
const timestamp = '2026-09-07T10:07:09Z';

function pageResponse(title, revid = 123, language = 'ja') {
    return {
        query: {
            general: { lang: language },
            pages: [{ title, revisions: [{ revid, timestamp }] }],
        },
    };
}

function host(t, responder) {
    const requests = [];
    const previousMw = globalThis.mw;
    t.after(() => {
        globalThis.mw = previousMw;
    });
    globalThis.mw = {
        Api: class {
            async get(params) {
                requests.push({ local: true, params });
                return responder(params, 'zh.wikipedia.org');
            }
        },
    };
    t.mock.method(globalThis, 'fetch', async (input, options) => {
        const url = new URL(input);
        const params = Object.fromEntries(url.searchParams);
        requests.push({ local: false, params, url, options });
        return { ok: true, json: async () => responder(params, url.hostname) };
    });
    return requests;
}

test('pinned source and blank destination retain exact revisions and API languages', async (t) => {
    const requests = host(t, (params, hostname) => {
        assert.equal(params.meta, 'siteinfo');
        if (hostname === 'ja.wikipedia.org')
            return pageResponse(
                'FIRE BIRD (Roseliaの曲)',
                Number(params.revids),
                'ja',
            );
        return pageResponse('FIRE BIRD', Number(params.revids), 'zh');
    });
    const { from, to } = await resolveAttributionPages(
        'https://ja.wikipedia.org/w/index.php?title=FIRE_BIRD_(Roseliaの曲)&oldid=110930823#ライブ',
        '',
        current,
        false,
    );
    assert.equal(from.revisionId, 110930823);
    assert.equal(from.pageTitle, 'FIRE BIRD (Roseliaの曲)');
    assert.equal(from.sectionId, 'ライブ');
    assert.equal(from.timestamp, timestamp);
    assert.equal(to.revisionId, 321);
    assert.equal(to.site.language, 'zh');
    const remote = requests.find((request) => !request.local);
    assert.equal(remote.options.credentials, 'omit');
    assert.equal(remote.options.redirect, 'error');
    assert.equal(remote.url.origin, 'https://ja.wikipedia.org');
    assert.equal(remote.params.origin, '*');
    assert.equal(remote.params.action, 'query');
});

test('explicit titles request latest and use canonical titles from the API', async (t) => {
    const requests = host(t, (params, hostname) =>
        pageResponse(
            hostname === 'ja.wikipedia.org'
                ? 'Canonical Japanese title'
                : 'Canonical Chinese title',
            params.revids === undefined ? 999 : Number(params.revids),
            hostname === 'ja.wikipedia.org' ? 'ja' : 'zh',
        ),
    );
    const result = await resolveAttributionPages(
        'ja:redirect title',
        'FIRE BIRD',
        current,
        true,
    );
    assert.equal(result.from.pageTitle, 'Canonical Japanese title');
    assert.equal(result.from.revisionId, 999);
    assert.equal(result.to.revisionId, 999);
    assert.ok(
        requests.every(
            ({ params }) =>
                params.revids === undefined && Number(params.rvlimit) === 1,
        ),
    );
});

test('fragment-only source uses the current displayed revision, not the destination page', async (t) => {
    const requests = host(t, (params, hostname) =>
        pageResponse(
            hostname === 'zh.wikipedia.org'
                ? 'FIRE BIRD'
                : 'Different Japanese page',
            Number(params.revids ?? 456),
            hostname.split('.')[0],
        ),
    );
    const { from, to } = await resolveAttributionPages(
        '#History',
        'ja:Different Japanese page',
        current,
        false,
    );
    assert.equal(from.pageTitle, 'FIRE BIRD');
    assert.equal(from.revisionId, 321);
    assert.equal(from.sectionId, 'History');
    assert.equal(to.pageTitle, 'Different Japanese page');
    assert.ok(requests.every(({ params }) => params.prop === 'revisions'));
});

test('canonical File and Data namespaces resolve only through their wiki APIs', async (t) => {
    const requests = host(t, (params) =>
        pageResponse(params.titles, 456, 'en'),
    );
    const commons = {
        ...current,
        site: { interwiki: 'commons', language: 'en' },
    };
    const result = await resolveAttributionPages(
        'File:Example.jpg',
        'Data:Example.map',
        commons,
        false,
    );
    assert.equal(result.from.pageTitle, 'File:Example.jpg');
    assert.equal(result.to.pageTitle, 'Data:Example.map');
    assert.ok(requests.every((request) => request.local));
});

test('language-only source resolves through the destination interlanguage data', async (t) => {
    const requests = host(t, (params, hostname) => {
        if (params.prop === 'langlinks') {
            assert.equal(Number(params.revids), current.revisionId);
            assert.equal(params.lllang, 'ja');
            return {
                query: {
                    pages: [
                        {
                            title: 'FIRE BIRD',
                            langlinks: [
                                {
                                    lang: 'ja',
                                    title: 'FIRE BIRD (Roseliaの曲)',
                                },
                            ],
                        },
                    ],
                },
            };
        }
        return pageResponse(
            params.titles ?? 'FIRE BIRD',
            Number(params.revids ?? 456),
            hostname === 'ja.wikipedia.org' ? 'ja' : 'zh',
        );
    });
    const { from } = await resolveAttributionPages('ja:', '', current, false);
    assert.equal(from.pageTitle, 'FIRE BIRD (Roseliaの曲)');
    assert.equal(from.revisionId, 456);
    assert.equal(
        requests.filter(({ params }) => params.prop === 'langlinks').length,
        1,
    );
});

test('both language-only fields resolve independently against the current page', async (t) => {
    const requests = host(t, (params, hostname) => {
        if (params.prop === 'langlinks') {
            assert.equal(hostname, 'zh.wikipedia.org');
            assert.equal(Number(params.revids), current.revisionId);
            return {
                query: {
                    pages: [
                        {
                            title: 'FIRE BIRD',
                            langlinks: [
                                {
                                    lang: params.lllang,
                                    title: `${params.lllang} title`,
                                },
                            ],
                        },
                    ],
                },
            };
        }
        return pageResponse(params.titles, 789, hostname.split('.')[0]);
    });
    const { from, to } = await resolveAttributionPages(
        'ja:',
        'en:',
        current,
        true,
    );
    assert.equal(from.pageTitle, 'ja title');
    assert.equal(to.pageTitle, 'en title');
    assert.equal(
        requests.filter(({ params }) => params.prop === 'langlinks').length,
        2,
    );
});

test('language-link bases without a displayed revision use the page title', async (t) => {
    const requests = host(t, (params, hostname) => {
        if (params.prop === 'langlinks') {
            assert.equal(params.titles, current.pageTitle);
            assert.equal(params.revids, undefined);
            return {
                query: {
                    pages: [
                        {
                            title: current.pageTitle,
                            langlinks: [
                                {
                                    lang: params.lllang,
                                    title: `${params.lllang} linked page`,
                                },
                            ],
                        },
                    ],
                },
            };
        }
        return pageResponse(params.titles, 789, hostname.split('.')[0]);
    });
    const result = await resolveAttributionPages(
        'ja',
        'en',
        { ...current, revisionId: 0 },
        true,
    );
    assert.equal(result.from.pageTitle, 'ja linked page');
    assert.equal(result.to.pageTitle, 'en linked page');
    assert.equal(
        requests.filter(({ params }) => params.prop === 'langlinks').length,
        2,
    );
});

test('bare source and destination codes resolve linked titles and preserve a source section', async (t) => {
    const requests = host(t, (params, hostname) => {
        if (params.prop === 'langlinks') {
            assert.equal(hostname, 'zh.wikipedia.org');
            assert.equal(Number(params.revids), current.revisionId);
            return {
                query: {
                    pages: [
                        {
                            title: current.pageTitle,
                            langlinks: [
                                {
                                    lang: params.lllang,
                                    title: `${params.lllang} linked page`,
                                },
                            ],
                        },
                    ],
                },
            };
        }
        return pageResponse(
            params.titles,
            hostname === 'ja.wikipedia.org' ? 654 : 987,
            hostname.split('.')[0],
        );
    });
    const { from, to } = await resolveAttributionPages(
        'ja#History',
        'en',
        current,
        true,
    );
    assert.equal(from.pageTitle, 'ja linked page');
    assert.equal(from.revisionId, 654);
    assert.equal(from.sectionId, 'History');
    assert.equal(to.pageTitle, 'en linked page');
    assert.equal(to.revisionId, 987);
    assert.equal(
        requests.filter(({ params }) => params.prop === 'langlinks').length,
        2,
    );
    assert.ok(
        requests.every(
            ({ params }) => params.titles !== 'ja' && params.titles !== 'en',
        ),
    );
});

test('escaped bare codes query literal local pages without language-link lookup', async (t) => {
    const requests = host(t, (params) =>
        pageResponse(params.titles, 876, 'zh'),
    );
    const { from, to } = await resolveAttributionPages(
        ':ja#History',
        ':en',
        current,
        true,
    );
    assert.equal(from.pageTitle, 'ja');
    assert.equal(from.sectionId, 'History');
    assert.equal(to.pageTitle, 'en');
    assert.ok(
        requests.every(
            ({ local, params }) => local && params.prop === 'revisions',
        ),
    );
});

test('language-only destination can resolve from a revision-only source', async (t) => {
    host(t, (params, hostname) => {
        if (params.prop === 'langlinks') {
            assert.equal(Number(params.revids), 456);
            return {
                query: {
                    pages: [
                        {
                            title: 'Japanese source',
                            langlinks: [{ lang: 'zh', title: '中文目標' }],
                        },
                    ],
                },
            };
        }
        return pageResponse(
            hostname === 'ja.wikipedia.org' ? 'Japanese source' : params.titles,
            Number(params.revids ?? 789),
            hostname.split('.')[0],
        );
    });
    const result = await resolveAttributionPages(
        'ja:Special:PermaLink/456',
        'zh:',
        current,
        true,
    );
    assert.equal(result.from.revisionId, 456);
    assert.equal(result.to.pageTitle, '中文目標');
});

test('edit summaries allow new targets, and cached missing pages remain retryable when a revision is required', async (t) => {
    let targetExists = false;
    const requests = host(t, (params) =>
        params.titles === 'New target' && !targetExists
            ? {
                  query: {
                      general: { lang: 'zh' },
                      pages: [{ title: 'New target', missing: true }],
                  },
              }
            : pageResponse(
                  'Existing source',
                  Number(params.revids ?? 123),
                  'zh',
              ),
    );
    const result = await resolveAttributionPages(
        '',
        'New target',
        current,
        false,
    );
    assert.equal(result.to.pageTitle, 'New target');
    assert.equal(result.to.revisionId, undefined);
    await assert.rejects(
        resolveAttributionPages('', 'New target', current, true),
        /does not exist/u,
    );
    assert.equal(
        requests.length,
        2,
        'Changing purpose must first validate the cached missing page.',
    );
    await assert.rejects(
        resolveAttributionPages('New target', '', current, false),
        /does not exist/u,
    );
    assert.equal(
        requests.length,
        3,
        'A required missing revision must not stay cached.',
    );
    targetExists = true;
    const available = await resolveAttributionPages(
        '',
        'New target',
        current,
        true,
    );
    assert.equal(available.to.revisionId, 123);
    assert.equal(requests.length, 4);
});

test('unavailable language links fail without guessing a translated title', async (t) => {
    const requests = host(t, (params) =>
        params.prop === 'langlinks'
            ? { query: { pages: [{ title: 'FIRE BIRD', langlinks: [] }] } }
            : pageResponse('FIRE BIRD', 321, 'zh'),
    );
    await assert.rejects(
        resolveAttributionPages('ja:', '', current, false),
        /No interlanguage link/u,
    );
    await assert.rejects(
        resolveAttributionPages('ja', '', current, false),
        /No interlanguage link/u,
    );
    assert.equal(
        requests.filter(({ params }) => params.prop === 'langlinks').length,
        2,
    );
    assert.equal(
        requests.filter(({ params }) => params.prop === 'revisions').length,
        1,
    );
});

test('revision mismatch, malformed timestamps, and malformed siteinfo all fail', async (t) => {
    let bad = pageResponse('FIRE BIRD', 999, 'zh');
    const requests = host(t, () => bad);
    await assert.rejects(
        resolveAttributionPages('', '', current, false),
        /revision and its timestamp/u,
    );
    bad = pageResponse('FIRE BIRD', 321, 'zh');
    bad.query.pages[0].revisions[0].timestamp = '2026-02-30T10:07:09Z';
    await assert.rejects(
        resolveAttributionPages('', '', current, false),
        /revision and its timestamp/u,
    );
    bad = pageResponse('FIRE BIRD', 321, 'zh');
    delete bad.query.general;
    await assert.rejects(
        resolveAttributionPages('', '', current, false),
        /content language/u,
    );
    bad = { error: { code: 'badrevids' } };
    await assert.rejects(
        resolveAttributionPages('', '', current, false),
        /valid page/u,
    );
    bad = pageResponse('FIRE BIRD', 321, 'zh');
    await resolveAttributionPages('', '', current, false);
    await resolveAttributionPages('', '', current, true);
    assert.equal(
        requests.length,
        5,
        'Only the final valid response may be reused.',
    );
});

test('malformed page responses fail and leave the request retryable', async (t) => {
    const valid = pageResponse('FIRE BIRD', 321, 'zh');
    const invalidResponses = [
        null,
        {},
        { query: null },
        { query: { pages: null } },
        { query: { pages: [] } },
        { query: { pages: [null] } },
        { query: { pages: [...valid.query.pages, ...valid.query.pages] } },
        { query: { pages: [{ title: 'FIRE BIRD', invalid: true }] } },
        { ...valid, error: { code: 'badrevids' } },
    ];
    let response;
    const requests = host(t, () => response);
    for (response of invalidResponses) {
        await assert.rejects(
            resolveAttributionPages('', '', current, false),
            /valid page/u,
        );
    }
    response = valid;
    const result = await resolveAttributionPages('', '', current, false);
    assert.equal(result.from.revisionId, current.revisionId);
    assert.equal(result.to.site.language, 'zh');
    await resolveAttributionPages('', '', current, true);
    assert.equal(requests.length, invalidResponses.length + 1);
});

test('completed metadata is a tab snapshot shared across purposes, directions, and fragments', async (t) => {
    let latest = 700;
    const requests = host(t, (params, hostname) =>
        pageResponse(
            params.titles ?? 'Pinned page',
            Number(params.revids ?? latest),
            hostname.split('.')[0],
        ),
    );
    const first = await resolveAttributionPages(
        'ja:Shared_title#History',
        '',
        current,
        false,
    );
    assert.equal(first.from.revisionId, 700);
    assert.equal(requests.length, 2);
    latest = 701;
    const changed = await resolveAttributionPages(
        'ja:Shared title#Lead',
        '',
        current,
        true,
    );
    assert.equal(
        changed.from.revisionId,
        700,
        'Latest-by-title means the first successful lookup in this tab.',
    );
    assert.equal(changed.from.sectionId, 'Lead');
    const reversed = await resolveAttributionPages(
        '',
        'ja:Shared title',
        current,
        false,
    );
    assert.equal(
        reversed.to.sectionId,
        undefined,
        'Cached metadata must not retain a previous reference fragment.',
    );
    assert.equal(reversed.to.revisionId, 700);
    assert.equal(requests.length, 2);
    await resolveAttributionPages('en:Shared title', '', current, false);
    await resolveAttributionPages('ja:Different title', '', current, false);
    await resolveAttributionPages(
        'ja:Special:PermaLink/702',
        '',
        current,
        false,
    );
    await resolveAttributionPages(
        'ja:Special:PermaLink/703',
        '',
        current,
        false,
    );
    assert.equal(
        requests.length,
        6,
        'Origin, title, and revision IDs must each distinguish requests.',
    );
    const redisplayed = await resolveAttributionPages(
        'ja:Shared title',
        '',
        { ...current, revisionId: 322 },
        false,
    );
    assert.equal(redisplayed.to.revisionId, 322);
    assert.equal(
        requests.length,
        7,
        'A new displayed revision must never reuse the old current-page response.',
    );
});

test('simultaneous generations share pending metadata across resolver calls', async (t) => {
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    const requests = host(t, async (params, hostname) => {
        await gate;
        return pageResponse(
            params.titles ?? current.pageTitle,
            Number(params.revids ?? 700),
            hostname.split('.')[0],
        );
    });
    const generations = [
        resolveAttributionPages('ja:Shared page#One', '', current, false),
        resolveAttributionPages('ja:Shared page#Two', '', current, true),
        resolveAttributionPages('', 'ja:Shared page', current, false),
    ];
    assert.equal(requests.length, 2);
    release();
    const results = await Promise.all(generations);
    assert.equal(results[0].from.sectionId, 'One');
    assert.equal(results[1].from.sectionId, 'Two');
    assert.equal(results[2].to.revisionId, 700);
    assert.equal(requests.length, 2);
});

test('language-link cache distinguishes its source revision and requested language', async (t) => {
    const requests = host(t, (params, hostname) => {
        if (params.prop === 'langlinks')
            return {
                query: {
                    pages: [
                        {
                            title: current.pageTitle,
                            langlinks: [
                                {
                                    lang: params.lllang,
                                    title: `${params.lllang} linked title`,
                                },
                            ],
                        },
                    ],
                },
            };
        return pageResponse(
            params.titles ?? current.pageTitle,
            Number(params.revids ?? 700),
            hostname.split('.')[0],
        );
    });
    await resolveAttributionPages('ja', '', current, false);
    const again = await resolveAttributionPages(
        'ja:#History',
        '',
        current,
        true,
    );
    assert.equal(again.from.sectionId, 'History');
    assert.equal(requests.length, 3);
    await resolveAttributionPages(
        'ja',
        '',
        { ...current, revisionId: 322 },
        false,
    );
    assert.equal(
        requests.length,
        5,
        'A new source revision reloads its metadata and language links, reusing the unchanged target.',
    );
    await resolveAttributionPages('en', '', current, false);
    assert.equal(requests.length, 7);
    assert.deepEqual(
        requests
            .filter(({ params }) => params.prop === 'langlinks')
            .map(({ params }) => [Number(params.revids), params.lllang]),
        [
            [321, 'ja'],
            [322, 'ja'],
            [321, 'en'],
        ],
    );
});

test('failed remote requests are deduplicated while pending and fetched again on retry', async (t) => {
    let fail = true;
    const requests = host(t, (params, hostname) => {
        if (hostname === 'ja.wikipedia.org' && fail)
            throw new Error('offline wiki');
        return pageResponse(
            params.titles ?? current.pageTitle,
            Number(params.revids ?? 700),
            hostname.split('.')[0],
        );
    });
    const failures = await Promise.allSettled([
        resolveAttributionPages('ja:Retry page', '', current, false),
        resolveAttributionPages('ja:Retry page', '', current, true),
    ]);
    assert.ok(failures.every((result) => result.status === 'rejected'));
    assert.equal(requests.length, 2);
    fail = false;
    await resolveAttributionPages('ja:Retry page', '', current, false);
    await resolveAttributionPages('ja:Retry page', '', current, true);
    assert.equal(
        requests.length,
        3,
        'Successful local metadata survives the other endpoint failure; failed remote metadata does not.',
    );
});

test('the tab retains at most 200 successful responses and refreshes recently used entries', async (t) => {
    const requests = host(t, (params) =>
        pageResponse(params.titles, 700, 'zh'),
    );
    const resolve = (index) =>
        resolveAttributionPages(
            `Page ${index}`,
            `Page ${index}`,
            current,
            false,
        );
    for (let index = 0; index < 200; index++) await resolve(index);
    await resolve(0);
    await resolve(200);
    await resolve(0);
    assert.equal(
        requests.length,
        201,
        'A recently used response should survive eviction.',
    );
    await resolve(1);
    assert.equal(
        requests.length,
        202,
        'The least recently used response should be fetched again.',
    );
});

test('unsafe URLs fail before any API request and remote failures propagate', async (t) => {
    const requests = host(t, () => {
        throw new Error('offline wiki');
    });
    await assert.rejects(
        resolveAttributionPages(
            'https://example.org/wiki/Page',
            '',
            current,
            false,
        ),
        /supported Wikimedia/u,
    );
    assert.equal(requests.length, 0);
    await assert.rejects(
        resolveAttributionPages('ja:Page', '', current, false),
        /offline wiki/u,
    );
});
