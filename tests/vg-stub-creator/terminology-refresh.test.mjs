/**
 * @file tests/vg-stub-creator/terminology-refresh.test.mjs
 * Purpose: Verify conservative offline Wikipedia terminology transformations.
 *
 * Table of contents:
 * 1. Imports
 * 2. article
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
    addVerifiedAliases,
    batchTitles,
    chooseArticle,
    collectTaxonomyArticles,
    createWikipediaCollector,
    findCategoryReplacements,
    mergeQueryResponses,
    normalizeTitle,
    renderCatalog,
    resolveCategoryRedirects,
    resolveQueryTitles,
} from '../../scripts/vg-stub-creator/refresh-terminologies.mjs';
import { get } from '../../src/vg-stub-creator/domain/terminologies/index.ts';

function article(title, id, language, counterpart) {
    return {
        title,
        ns: 0,
        exists: true,
        pageprops: { wikibase_item: id },
        langlinks: [{ lang: language, title: counterpart }],
        categories: [{ title: 'Category:Video game genres' }],
    };
}

test('uncached collection requires a valid operator contact before requesting Wikipedia', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'kanade-terminologies-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    let requests = 0;
    const fetchRequest = async () => {
        requests += 1;
        throw new Error('Unexpected network request');
    };
    for (const contact of [
        null,
        '',
        'read-only catalog maintenance',
        '/contact',
        'mailto:operator@example.test',
        'https://person:password@example.test/contact',
        'https://example.test/contact\r\nInjected: value',
        'https://example.test/contact\u0000',
    ]) {
        const collector = createWikipediaCollector(directory, {
            contact,
            fetchRequest,
        });
        await assert.rejects(
            collector.request('en', { titles: 'Example' }),
            /KANADE_TERMINOLOGY_CONTACT/u,
        );
        assert.equal(collector.statistics.networkRequests, 0);
    }
    assert.equal(requests, 0);
    assert.deepEqual(await readdir(directory), []);
});

test('collection sends operator contact only in the request header and reuses cached data without it', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'kanade-terminologies-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const contact = 'https://example.test/operator-contact';
    const requests = [];
    const collector = createWikipediaCollector(directory, {
        contact,
        async fetchRequest(url, options) {
            requests.push({ url, options });
            return Response.json({ query: { pages: [] } });
        },
    });
    const result = await collector.request('en', { titles: 'Example' });
    assert.equal(requests.length, 1);
    assert.equal(
        requests[0].options.headers['User-Agent'],
        `Kanade-TerminologyRefresh/1.0 (${contact})`,
    );
    assert.equal(requests[0].url.includes(contact), false);
    assert.equal(
        JSON.stringify([...collector.requestRecords]).includes(contact),
        false,
    );
    const files = await readdir(directory);
    assert.equal(files.length, 1);
    assert.equal(
        (await readFile(join(directory, files[0]), 'utf8')).includes(contact),
        false,
    );

    const cachedCollector = createWikipediaCollector(directory, {
        contact: '',
        async fetchRequest() {
            throw new Error('Cached data should not request Wikipedia');
        },
    });
    assert.deepEqual(
        await cachedCollector.request('en', { titles: 'Example' }),
        result,
    );
    assert.deepEqual(cachedCollector.statistics, {
        networkRequests: 0,
        cacheHits: 1,
    });
});

test('taxonomy discovery follows continuation and relevant classes while pruning branded game trees', async () => {
    const requests = [];
    const collector = {
        async request(_wiki, values) {
            requests.push(values);
            if (values.cmtitle === 'Category:Companies' && !values.cmcontinue)
                return {
                    data: {
                        query: {
                            categorymembers: [
                                { ns: 0, title: 'New studio' },
                                { ns: 14, title: 'Category:Country companies' },
                                { ns: 14, title: 'Category:Brand games' },
                            ],
                        },
                        continue: { cmcontinue: 'next', continue: '-||' },
                    },
                };
            if (values.cmcontinue)
                return {
                    data: {
                        query: {
                            categorymembers: [
                                { ns: 0, title: 'Another studio' },
                            ],
                        },
                    },
                };
            return {
                data: {
                    query: {
                        categorymembers: [
                            { ns: 0, title: 'New studio' },
                            { ns: 0, title: 'Country studio' },
                            { ns: 14, title: 'Category:Companies' },
                        ],
                    },
                },
            };
        },
    };
    const result = await collectTaxonomyArticles(collector, {
        roots: ['Companies'],
        depth: 2,
        descendants: /companies$/iu,
    });
    assert.deepEqual(result.articles, [
        'New studio',
        'Another studio',
        'Country studio',
    ]);
    assert.deepEqual(result.categories, [
        'Category:Companies',
        'Category:Country companies',
    ]);
    assert.equal(requests.length, 3);
    assert.equal(requests[1].cmcontinue, 'next');
    await assert.rejects(
        collectTaxonomyArticles(
            {
                async request() {
                    return {
                        data: {
                            query: {
                                categorymembers: [
                                    { title: 'Malformed member' },
                                ],
                            },
                        },
                    };
                },
            },
            { roots: ['Companies'], depth: 0, descendants: /companies$/iu },
        ),
        /Malformed/,
    );
});

test('bulk queries bound title count and URL length and preserve continued metadata', () => {
    const titles = Array.from(
        { length: 120 },
        (_, index) => `${index}${'电子游戏'.repeat(20)}`,
    );
    const batches = batchTitles(titles);
    assert.deepEqual(batches.flat(), titles);
    assert.ok(batches.every((batch) => batch.length <= 50));
    assert.ok(
        batches.every(
            (batch) =>
                new URLSearchParams({ titles: batch.join('|') }).toString()
                    .length <= 6_000,
        ),
    );
    const combined = mergeQueryResponses([
        {
            query: {
                pages: [
                    {
                        pageid: 1,
                        title: '动作游戏',
                        langlinks: [{ lang: 'en', title: 'Action game' }],
                        categories: [{ title: 'Category:动作游戏' }],
                    },
                ],
            },
        },
        {
            query: {
                pages: [
                    {
                        pageid: 1,
                        title: '动作游戏',
                        categories: [{ title: 'Category:电子游戏类型' }],
                    },
                ],
            },
        },
    ]);
    assert.equal(combined.query.pages[0].langlinks[0].title, 'Action game');
    assert.equal(combined.query.pages[0].categories.length, 2);
});

test('API title transformations require complete evidence and retain redirect fragments', () => {
    const data = {
        query: {
            normalized: [
                { from: 'template:action-stub', to: 'Template:Action-stub' },
                { from: 'Action_game', to: 'Action game' },
            ],
            redirects: [
                {
                    from: 'RPG',
                    to: 'Role-playing video game',
                    tofragment: 'History',
                },
            ],
            pages: [
                { title: 'Template:Action-stub', ns: 10, pageid: 1 },
                { title: 'Role-playing video game', ns: 0, pageid: 2 },
                { title: 'Action game', ns: 0, pageid: 3 },
            ],
        },
    };
    const values = resolveQueryTitles(
        ['template:action-stub', 'RPG', 'Action_game'],
        data,
        1_000,
    );
    assert.equal(
        values.get(normalizeTitle('template:action-stub')).exists,
        true,
    );
    assert.equal(values.get('rpg').fragment, 'History');
    assert.equal(values.get('action game').title, 'Action game');
    assert.throws(
        () => resolveQueryTitles(['Missing evidence'], data, 1_000),
        /Incomplete/,
    );
    assert.throws(
        () =>
            resolveQueryTitles(
                ['Action game'],
                { error: { code: 'maxlag' } },
                1_000,
            ),
        /API error/,
    );
    assert.throws(
        () =>
            resolveQueryTitles(
                ['Action game'],
                { query: { pages: [{ title: 'Action game', ns: 0 }] } },
                1_000,
            ),
        /Malformed/,
    );
    for (const flag of ['missing', 'invalid']) {
        assert.throws(
            () =>
                resolveQueryTitles(
                    ['Game'],
                    {
                        query: {
                            pages: [
                                {
                                    title: 'Game',
                                    ns: 0,
                                    [flag]: 'not a boolean',
                                },
                            ],
                        },
                    },
                    1_000,
                ),
            /Malformed/,
        );
    }
    assert.throws(
        () =>
            resolveQueryTitles(
                ['Foo bar'],
                { query: { pages: [{ title: 'Foo Bar', ns: 0, pageid: 4 }] } },
                1_000,
            ),
        /Incomplete/,
    );
});

test('category soft redirects require a confirmed target and unresolved markup remains inactive', async () => {
    const source = {
        title: 'Category:Old games',
        ns: 14,
        pageid: 1,
        lastrevid: 10,
        exists: true,
        templates: [{ title: 'Template:Category redirect' }],
        observedAt: 1_000,
    };
    const categories = new Map([[normalizeTitle(source.title), source]]);
    const requests = [];
    const collector = {
        async request(_wiki, values) {
            requests.push(values.titles);
            const content = values.prop.includes('revisions');
            return {
                observedAt: 1_000,
                data: {
                    query: {
                        pages: [
                            {
                                title: values.titles,
                                pageid: content ? 1 : 2,
                                ns: 14,
                                lastrevid: content ? 10 : 20,
                                ...(content
                                    ? {
                                          revisions: [
                                              {
                                                  slots: {
                                                      main: {
                                                          content:
                                                              '{{Category redirect|New games}}',
                                                      },
                                                  },
                                              },
                                          ],
                                      }
                                    : {}),
                            },
                        ],
                    },
                },
            };
        },
    };
    await resolveCategoryRedirects(collector, 'zh', categories);
    assert.equal(
        categories.get(normalizeTitle(source.title)).title,
        'Category:New games',
    );
    assert.deepEqual(requests, ['Category:Old games', 'Category:New games']);
    const unresolved = new Map([
        [
            normalizeTitle(source.title),
            { ...source, softRedirectChecked: false },
        ],
    ]);
    const badMarkup = {
        async request(_wiki, values) {
            return {
                observedAt: 1_000,
                data: {
                    query: {
                        pages: [
                            {
                                title: values.titles,
                                pageid: 1,
                                ns: 14,
                                revisions: [
                                    {
                                        slots: {
                                            main: {
                                                content:
                                                    '{{Unknown redirect|New games}}',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                },
            };
        },
    };
    await resolveCategoryRedirects(badMarkup, 'zh', unresolved);
    assert.equal(
        unresolved.get(normalizeTitle(source.title)).softRedirectUnresolved,
        true,
    );
});

test('missing Chinese article links use matching crosswiki identities and reject ambiguous shorthand pages', () => {
    const definition = {
        label: '角色扮演',
        page: 'Old RPG title',
        aliases: ['RPG', 'Role-playing video game'],
    };
    const zh = new Map([
        [
            normalizeTitle('電子角色扮演遊戲'),
            article(
                '電子角色扮演遊戲',
                'Q744038',
                'en',
                'Role-playing video game',
            ),
        ],
    ]);
    const en = new Map([
        [
            'rpg',
            {
                ...article('RPG', 'Q1244298', 'zh', '角色扮演'),
                pageprops: { disambiguation: '', wikibase_item: 'Q1244298' },
            },
        ],
        [
            'role-playing video game',
            article(
                'Role-playing video game',
                'Q744038',
                'zh',
                '電子角色扮演遊戲',
            ),
        ],
    ]);
    assert.equal(
        chooseArticle(definition, 'genres', zh, en).article.title,
        '電子角色扮演遊戲',
    );
    zh.get(normalizeTitle('電子角色扮演遊戲')).pageprops.wikibase_item = 'Q999';
    assert.equal(
        chooseArticle(definition, 'genres', zh, en).article,
        undefined,
    );
    assert.equal(
        chooseArticle({ ...definition, page: undefined }, 'genres', zh, en)
            .reason,
        'intentionally-unlinked',
    );
});

test('category replacements require explicit namespace-14 crosslinks and exact established stems', () => {
    const definition = {
        label: '角色扮演',
        aliases: ['Role-playing video game'],
        categories: ['Old RPG category'],
    };
    const chinese = {
        title: 'Category:電子角色扮演遊戲',
        ns: 14,
        exists: true,
        pageprops: { wikibase_item: 'Q123' },
    };
    const en = new Map([
        [
            'proper',
            {
                title: 'Category:Role-playing video games',
                ns: 14,
                exists: true,
                langlinks: [{ lang: 'zh', title: chinese.title }],
                pageprops: { wikibase_item: 'Q123' },
            },
        ],
        [
            'broad',
            {
                title: 'Category:Video games',
                ns: 14,
                exists: true,
                langlinks: [{ lang: 'zh', title: 'Category:电子游戏' }],
            },
        ],
    ]);
    const zh = new Map([[normalizeTitle(chinese.title), chinese]]);
    const allowed = new Set([
        normalizeTitle('Category:Role-playing video games'),
    ]);
    assert.deepEqual(
        findCategoryReplacements(definition, undefined, en, zh, allowed),
        [chinese],
    );
    chinese.ns = 0;
    assert.deepEqual(
        findCategoryReplacements(definition, undefined, en, zh, allowed),
        [],
    );
});

test("a matching crosswiki category stem does not prove a company's video-game scope", () => {
    const definition = {
        label: 'Ancient (company)',
        aliases: ['Ancient (company)'],
        categories: ['Ancient (company)遊戲'],
    };
    const zhCategory = { title: 'Category:古代遊戲', ns: 14, exists: true };
    const en = new Map([
        [
            'ancient',
            {
                title: 'Category:Ancient games',
                ns: 14,
                exists: true,
                langlinks: [{ lang: 'zh', title: zhCategory.title }],
            },
        ],
    ]);
    const zh = new Map([[normalizeTitle(zhCategory.title), zhCategory]]);
    assert.deepEqual(
        findCategoryReplacements(
            definition,
            undefined,
            en,
            zh,
            new Set([normalizeTitle('Category:Ancient (company) games')]),
        ),
        [],
    );
});

test('verified aliases preserve field-context RPG and patterns while excluding collisions and fragments', () => {
    const definitions = [
        {
            label: '角色扮演',
            aliases: [/角色扮演/u, 'RPG'],
            page: '電子角色扮演遊戲',
        },
        { label: '动作', aliases: [/Action/u, 'action'] },
    ];
    const updated = addVerifiedAliases(definitions, [
        [
            'Role-playing video game',
            'Shared',
            'Action',
            'RPG#Video games',
            'RPG (disambiguation)',
        ],
        ['Shared', 'Action game'],
    ]);
    assert.equal(updated[0].aliases[0], '角色扮演');
    assert.equal(updated[0].aliases[1], definitions[0].aliases[0]);
    assert.ok(updated[0].aliases.includes('RPG'));
    assert.ok(updated[0].aliases.includes('Role-playing video game'));
    assert.ok(!updated[0].aliases.includes('Action'));
    assert.ok(!updated.flatMap((entry) => entry.aliases).includes('Shared'));
    assert.ok(
        !updated[0].aliases.some(
            (alias) => typeof alias === 'string' && alias.includes('#'),
        ),
    );
    const rendered = renderCatalog(
        "import type { T } from './schema.ts';\nexport default [] satisfies T[];",
        updated,
    );
    assert.match(rendered, /\/角色扮演\/u/u);
    assert.ok(
        rendered.indexOf('label: "角色扮演"') <
            rendered.indexOf('label: "动作"'),
    );
});

test('RPG resolves within video-game genre context to the curated Chinese article and stub tag', () => {
    const rpg = get('genre', 'RPG');
    assert.equal(rpg.page, '電子角色扮演遊戲');
    assert.deepEqual(rpg.stubTags, ['rpg-videogame-stub']);
    const canonical = get('genre', 'Role-playing video game');
    if (canonical) assert.equal(canonical, rpg);
});

test('Xbox platform shorthand links the original console rather than the brand overview', () => {
    assert.equal(get('platform', 'Xbox').page, 'Xbox (遊戲機)');
});
