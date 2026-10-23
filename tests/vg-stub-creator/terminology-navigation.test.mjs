/**
 * @file tests/vg-stub-creator/terminology-navigation.test.mjs
 * Purpose: Verify conservative navigation associations with offline API evidence.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. navigation
 * 4. find
 * 5. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    findNavigationGame,
    findNavigationTemplates,
    getNavigationCategoryRoots,
    getNavigationHead,
} from '../../scripts/vg-stub-creator/terminology-navigation.mjs';

const definition = {
    label: '任天堂',
    page: '任天堂',
    aliases: ['任天堂', 'Nintendo', /Nintendo.*/iu],
};
const article = {
    title: '任天堂',
    pageid: 1,
    ns: 0,
    exists: true,
};

function navigation(title = 'Template:Nintendo', extra = {}) {
    return {
        title,
        pageid: 2,
        ns: 10,
        exists: true,
        templates: [{ title: 'Template:Navbox', ns: 10 }],
        links: [{ title: article.title, ns: 0 }],
        revisions: [
            {
                slots: {
                    main: { content: '{{Navbox\n| title = [[任天堂]]\n}}' },
                },
            },
        ],
        ...extra,
    };
}

function find(record, page = article, term = definition, allowed) {
    return findNavigationTemplates(
        term,
        page,
        new Map([[record.title, record]]),
        allowed || new Set([record.title.toLowerCase()]),
    );
}

test('navigation roots separate company boards from hardware boards', () => {
    const roots = getNavigationCategoryRoots();
    assert.deepEqual(roots, {
        companies: ['电子游戏公司导航模板'],
        platforms: ['电子游戏硬件导航模板'],
    });
    roots.companies.push('unrelated');
    assert.equal(getNavigationCategoryRoots().companies.length, 1);
});

test('a category member needs an exact established name, navbox, and canonical article link', () => {
    const matched = navigation();
    assert.deepEqual(find(matched), [matched]);
    assert.deepEqual(find(navigation('Template:Other company')), []);
    assert.deepEqual(find(navigation(undefined, { links: [] })), []);
    assert.deepEqual(find(navigation(undefined, { templates: [] })), []);
    assert.deepEqual(find(navigation(), article, definition, new Set()), []);
    assert.deepEqual(
        find(
            navigation(undefined, {
                templates: [{ title: 'Template:Infobox', ns: 10 }],
            }),
        ),
        [],
    );
    assert.deepEqual(
        find(navigation('Template:电子游戏'), article, {
            label: '电子游戏',
            aliases: ['电子游戏'],
        }),
        [],
    );
});

test('localized namespace prefixes, case, underscores, and spacing preserve exact identity', () => {
    const record = navigation(' 模板:  NINTENDO ', {
        templates: [{ title: '樣板:Navbox_with_columns', ns: 10 }],
    });
    assert.deepEqual(
        find(record, article, definition, new Set(['template:nintendo'])),
        [record],
    );
    const spaced = navigation('Template:Nintendo_of_America', {
        templates: [{ title: '模板:導航模板', ns: 10 }],
    });
    assert.deepEqual(
        find(
            spaced,
            article,
            { ...definition, aliases: ['Nintendo  of America'] },
            new Set(['template:nintendo of america']),
        ),
        [spaced],
    );
});

test('game-list suffixes stay tied to exact established company names', () => {
    const source = { ...article, title: 'FromSoftware' };
    const term = { label: 'FromSoftware', aliases: ['FromSoftware'] };
    for (const suffix of [
        '遊戲',
        '游戏',
        '電子遊戲',
        '电子游戏',
        ' games',
        ' video games',
    ]) {
        const record = navigation(`Template:FromSoftware${suffix}`, {
            links: [{ title: source.title, ns: 0 }],
        });
        assert.deepEqual(find(record, source, term), [record]);
    }
    const unrelated = navigation('Template:Other FromSoftware games', {
        links: [{ title: source.title, ns: 0 }],
    });
    assert.deepEqual(find(unrelated, source, term), []);
});

test('canonical redirect targets match aliases and deduplicate without relying on redirect names', () => {
    const first = navigation('Template:Nintendo', {
        requested: 'Template:任天堂导航',
    });
    const second = { ...first, requested: '模板:Nintendo' };
    const templates = new Map([
        ['template:任天堂导航', first],
        ['template:nintendo', second],
    ]);
    assert.deepEqual(
        findNavigationTemplates(
            definition,
            article,
            templates,
            new Set(['template:nintendo']),
        ),
        [second],
    );
    assert.deepEqual(
        find(
            navigation('Template:Other company', {
                requested: 'Template:Nintendo',
            }),
        ),
        [],
    );
    assert.deepEqual(find(navigation(undefined, { fragment: 'Games' })), []);
});

test('missing, malformed, fragmented, and disambiguation pages cannot supply evidence', () => {
    for (const extra of [
        { exists: false },
        { ns: 14 },
        { title: '' },
        { title: '任天堂#Games' },
        { fragment: 'Games' },
        { pageprops: { disambiguation: '' } },
        { pageprops: null },
        { pageprops: 'invalid' },
        { missing: true },
        { invalid: true },
        { pageid: -1 },
        { redirect: true },
    ])
        assert.deepEqual(find(navigation(), { ...article, ...extra }), []);
    for (const extra of [
        { exists: false },
        { ns: 0 },
        { title: 'Template:Nintendo#Games' },
        { fragment: 'Games' },
        { tofragment: 'Games' },
        { pageprops: { disambiguation: '' } },
        { pageprops: [] },
        { missing: true },
        { invalid: true },
        { pageid: 0 },
        { redirect: true },
        { links: undefined },
        { templates: 'Navbox' },
    ])
        assert.deepEqual(find(navigation(undefined, extra)), []);
    assert.deepEqual(
        findNavigationTemplates(definition, undefined, new Map(), new Set()),
        [],
    );
    assert.deepEqual(
        findNavigationTemplates(definition, article, [], new Set()),
        [],
    );
});

test('documentation, sandbox, and test subpages cannot become navigation associations', () => {
    for (const suffix of [
        '/doc',
        '/sandbox',
        '/testcases',
        '/doc/example',
        '/沙盒',
    ]) {
        const title = `Nintendo${suffix}`;
        assert.deepEqual(
            find(navigation(`Template:${title}`), article, {
                ...definition,
                aliases: [title],
            }),
            [],
        );
    }
    assert.deepEqual(
        find(
            navigation(undefined, {
                templates: [{ title: 'Template:Navbox/doc', ns: 10 }],
            }),
        ),
        [],
    );
});

test('links to a redirect spelling, section, or different namespace are insufficient', () => {
    for (const link of [
        { title: 'Nintendo', ns: 0 },
        { title: '任天堂#Games', ns: 0 },
        { title: '任天堂', ns: 10 },
        { title: '任天堂', ns: 0, fragment: 'Games' },
        { title: '任天堂', ns: 0, tofragment: 'Games' },
    ])
        assert.deepEqual(find(navigation(undefined, { links: [link] })), []);
    assert.deepEqual(
        find(
            navigation(undefined, {
                templates: [{ title: 'Template:Navbox', ns: 0 }],
            }),
        ),
        [],
    );
});

test('regular-expression aliases and navbox-like names do not widen association', () => {
    assert.deepEqual(find(navigation('Template:Nintendo competitors')), []);
    const patternOnly = { label: '任天堂', aliases: [/Nintendo/iu] };
    assert.deepEqual(find(navigation(), article, patternOnly), []);
    assert.deepEqual(
        find(
            navigation(undefined, {
                templates: [{ title: 'Template:Navbox-like', ns: 10 }],
            }),
        ),
        [],
    );
});

test('headings require one explicit title parameter and a single unfragmented target', () => {
    const source = (content) =>
        navigation(undefined, {
            revisions: [{ slots: { main: { content } } }],
        });
    for (const content of [
        '{{Navbox\n| title = [[任天堂]]遊戲\n}}',
        '{{Navbox|title=[[任天堂|Nintendo]]|list1=[[Game]]}}',
        "{{Navbox\n| TITLE = '''[[任天堂]]''' [[任天堂|Nintendo]]\n}}",
        '{{Navbox\n|title=[[:任天堂]]\n}}',
        '{{Navbox\n<!-- |title=[[世嘉]] -->\n|title=[[任天堂]]\n}}',
    ])
        assert.equal(getNavigationHead(source(content)), '任天堂');
    for (const content of [
        '{{Navbox\n| title = 任天堂\n}}',
        '{{Navbox\n| title = [[任天堂#Games]]\n}}',
        '{{Navbox\n| title = [[任天堂]] and [[世嘉]]\n}}',
        '{{Navbox\n| title = [[任天堂]]\n| title = [[任天堂]]\n}}',
        '{{Navbox\n| title =\n[[任天堂]]\n}}',
        '{{Navbox\n| title = {{nowrap|[[任天堂]]}}\n}}',
        '{{Navbox\n| title = <!-- [[任天堂]] -->\n}}',
        '{{Navbox\n| title = [[任天堂]] [[broken\n}}',
        '{{Navbox\n<!--\n|title=[[任天堂]]\n-->\n}}',
        '{{Navbox\n|title=[[{{Company}}]]\n}}',
    ])
        assert.equal(getNavigationHead(source(content)), undefined);
    assert.equal(
        getNavigationHead(navigation(undefined, { revisions: [] })),
        undefined,
    );
    assert.equal(getNavigationHead(source(12)), undefined);
    assert.equal(
        getNavigationHead(navigation(undefined, { exists: false })),
        undefined,
    );
});

test('corporate-only boards need a linked article in a verified company game category', () => {
    const allowed = new Set(['category:任天堂遊戲']);
    const company = {
        ...article,
        categories: [{ title: 'Category:任天堂遊戲', ns: 14 }],
    };
    const companyOnly = new Map([['任天堂', company]]);
    assert.equal(
        findNavigationGame(navigation(), companyOnly, allowed),
        undefined,
    );
    const game = {
        ...article,
        title: 'Super Mario Bros.',
        pageid: 3,
        categories: [{ title: '分類:任天堂遊戲', ns: 14 }],
    };
    const records = new Map([...companyOnly, ['super mario bros.', game]]);
    const board = navigation(undefined, {
        links: [...navigation().links, { title: 'Super_Mario_Bros.', ns: 0 }],
    });
    assert.equal(findNavigationGame(board, records, allowed), game);
    assert.equal(
        findNavigationGame(board, records, new Set(['category:世嘉遊戲'])),
        undefined,
    );
    assert.equal(findNavigationGame(board, records, new Set()), undefined);
    const alias = { ...board, links: [{ title: 'Nintendo', ns: 0 }] };
    records.set('nintendo', company);
    assert.equal(findNavigationGame(alias, records, allowed), undefined);
});

test('game evidence rejects missing, malformed, unrelated, or ambiguous linked pages', () => {
    const allowed = new Set(['category:任天堂遊戲']);
    const game = {
        ...article,
        title: 'Game',
        pageid: 3,
        categories: [{ title: 'Category:任天堂遊戲', ns: 14 }],
    };
    const board = navigation(undefined, { links: [{ title: 'Game', ns: 0 }] });
    for (const extra of [
        { exists: false },
        { ns: 10 },
        { missing: true },
        { invalid: true },
        { pageprops: { disambiguation: '' } },
        { fragment: 'Game' },
        { title: 'Game#History' },
        { pageid: -1 },
        { categories: undefined },
        { categories: 'Category:任天堂遊戲' },
        { categories: [{ title: 'Category:任天堂', ns: 14 }] },
        { categories: [{ title: 'Category:任天堂遊戲', ns: 0 }] },
        { categories: [{ title: 'Category:任天堂遊戲#Games', ns: 14 }] },
        { categories: [{ title: 12, ns: 14 }] },
    ]) {
        const records = new Map([
            ['任天堂', article],
            ['game', { ...game, ...extra }],
        ]);
        assert.equal(findNavigationGame(board, records, allowed), undefined);
    }
    const records = new Map([
        ['任天堂', article],
        ['game', game],
    ]);
    for (const link of [
        { title: 'Game#History', ns: 0 },
        { title: 'Game', ns: 10 },
        { title: 'Game', ns: 0, fragment: 'History' },
        { title: 'Unknown', ns: 0 },
    ])
        assert.equal(
            findNavigationGame(
                navigation(undefined, { links: [link] }),
                records,
                allowed,
            ),
            undefined,
        );
    assert.equal(
        findNavigationGame(board, new Map([['game', game]]), allowed),
        undefined,
    );
    assert.equal(
        findNavigationGame(board, records, new Set(['任天堂遊戲'])),
        undefined,
    );
    assert.equal(findNavigationGame(board, [], allowed), undefined);
});
