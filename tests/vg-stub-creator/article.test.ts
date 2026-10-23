/**
 * @file tests/vg-stub-creator/article.test.ts
 * Purpose: Verifies deterministic article generation and citation normalization.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { buildStubText } from '../../src/vg-stub-creator/app/workflows/article.ts';
import { createArticleData } from '../../src/vg-stub-creator/domain/processor.ts';
import {
    buildCiteTemplate,
    buildCiteTemplateFromParts,
    parseCiteTemplate,
} from '../../src/vg-stub-creator/domain/citations/index.ts';
import { splitLookupFieldValues } from '../../src/vg-stub-creator/domain/wikitext/index.ts';

test('generates Chinese prose from normalized game metadata', () => {
    const form = {
        name: '星海',
        englishName: 'Star Harbor',
        developers: 'Nintendo',
        publishers: 'Nintendo',
        platforms: 'Nintendo Switch',
        genres: 'Role-playing',
        year: '2024',
        additionalProse: '玩家探索群島。',
    };
    const data = createArticleData(form);
    const text = buildStubText(data);

    assert.equal(form.year, '2024', 'normalization must preserve input');
    assert.equal(data.form.year, '2024年');
    assert.match(text, /\{\{Infobox VG/u);
    assert.match(text, /title = 星海/u);
    assert.match(text, /2024年/u);
    assert.match(text, /\[\[任天堂\]\]/u);
    assert.match(text, /\[\[任天堂Switch\]\]/u);
    assert.match(text, /玩家探索群島。/u);
    assert.doesNotMatch(text, /undefined|null/u);
    assert.deepEqual(Object.keys(data).sort(), [
        'form',
        'prose',
        'records',
        'renderers',
        'sourceReferences',
        'sourceTags',
    ]);
    assert.equal(data.prose.sinographs, 41);
});

test('fallback category rendering preserves the approved form and review record', () => {
    const data = createArticleData({ name: '星海', categoryRows: [] });
    const snapshot = JSON.stringify(data);
    const text = buildStubText(data, () => [
        { category: '电子游戏', enabled: true },
    ]);

    assert.match(text, /\{\{DEFAULTSORT:星海\}\}\n\[\[Category:电子游戏\]\]/u);
    assert.equal(JSON.stringify(data), snapshot);
});

test('articles begin with the default Games conversion group without a global editor', () => {
    for (const noteTaRows of [undefined, [], [{ key: 'G1', value: '' }]]) {
        const text = buildStubText(
            createArticleData({ name: '星海', noteTaRows }),
        );

        assert.ok(text.startsWith('{{NoteTA-lite\n| G1 = Games\n}}\n\n'));
        assert.equal(text.match(/\| G1 = Games/gu)?.length, 1);
    }
});

test('per-name conversion choices retain the Games group and explicit exclusions', () => {
    const form = {
        name: '星海',
        localizedNames: [
            { name: '星海简体', official: true, hans: true },
            { name: '星海繁體', official: true, tw: true },
        ],
        noteTaRows: [
            {
                key: '1',
                source: 'name-role:localized-1',
                value: 'zh-cn:审定名称; zh-tw:審定名稱;',
            },
        ],
    };
    const text = buildStubText(createArticleData(form));

    assert.ok(
        text.startsWith(
            '{{NoteTA-lite\n| G1 = Games\n| 1 = zh-cn:审定名称; zh-tw:審定名稱;\n}}',
        ),
    );
    assert.doesNotMatch(text, /zh-cn:星海简体/u);

    const excludedText = buildStubText(
        createArticleData({
            ...form,
            noteTaRows: [],
            noteTaNamesRemoved: true,
        }),
    );
    assert.ok(excludedText.startsWith('{{NoteTA-lite\n| G1 = Games\n}}'));
    assert.doesNotMatch(excludedText, /zh-(?:cn|tw):/u);
});

test('stored reviewed conversion rows survive while missing first groups use Games', () => {
    const form = {
        name: '星海',
        noteTaRows: [
            { key: 'G2', value: 'Science' },
            { key: '3', value: 'zh-cn:手动词; zh-tw:手動詞;', modified: true },
        ],
    };
    const snapshot = JSON.stringify(form);
    const text = buildStubText(createArticleData(form));

    assert.ok(text.startsWith('{{NoteTA-lite\n| G1 = Games\n| G2 = Science\n'));
    assert.match(text, /\| 3 = zh-cn:手动词; zh-tw:手動詞;/u);
    assert.equal(JSON.stringify(form), snapshot);

    const reviewedGroupText = buildStubText(
        createArticleData({
            ...form,
            noteTaRows: [
                { key: 'G1', value: 'Reviewed group', modified: true },
                ...form.noteTaRows,
            ],
        }),
    );
    assert.ok(
        reviewedGroupText.startsWith('{{NoteTA-lite\n| G1 = Reviewed group\n'),
    );
    assert.doesNotMatch(reviewedGroupText, /\| G1 = Games/u);
});

test('list parsing keeps punctuation inside a wikilink together', () => {
    assert.deepEqual(
        splitLookupFieldValues('[[Example, Inc.|Example, Inc.]]; Nintendo'),
        ['Example, Inc.', 'Nintendo'],
    );
});

test('article output honors reviewed manual and excluded stub templates', () => {
    const form = {
        name: '星海',
        genres: 'music',
        categoryRows: [
            {
                category: '音樂遊戲',
                enabled: true,
                stubTag: 'music-videogame-stub',
                stubTagEnabled: true,
            },
        ],
        stubTagRows: [
            { stubTag: 'music-videogame-stub', enabled: false },
            { stubTag: 'Manual-stub', enabled: true },
            { stubTag: 'Excluded-stub', enabled: false },
        ],
    };
    const text = buildStubText(createArticleData(form));
    assert.match(text, /\{\{Manual-stub\}\}/u);
    assert.doesNotMatch(text, /\{\{music-videogame-stub\}\}/u);
    assert.doesNotMatch(text, /\{\{Excluded-stub\}\}/u);
    const withoutStubs = buildStubText(
        createArticleData({ ...form, stubTagRows: [] }),
    );
    assert.doesNotMatch(
        withoutStubs,
        /\{\{(?:music-videogame-stub|Manual-stub)\}\}/u,
    );
});

test('formats source metadata and retains reviewed citation changes', () => {
    const citation = buildCiteTemplate(
        {
            itemType: 'webpage',
            title: 'A sample announcement',
            url: 'https://example.test/game',
            websiteTitle: 'Example News',
            date: '2024-03-12',
            language: 'en',
            creators: [
                {
                    creatorType: 'author',
                    firstName: 'Ada',
                    lastName: 'Example',
                },
            ],
        },
        { now: new Date('2026-01-02T00:00:00Z'), rules: [] },
    );
    const parts = parseCiteTemplate(citation);
    const title = parts.params.find(
        (parameter: { name: string }) => parameter.name === 'title',
    );
    title.value = 'Reviewed announcement title';
    const reviewed = buildCiteTemplateFromParts(parts);

    assert.equal(parts.template, 'cite web');
    assert.match(citation, /author = Ada Example/u);
    assert.match(citation, /access-date = 2026-01-02/u);
    assert.match(reviewed, /title = Reviewed announcement title/u);
    assert.match(reviewed, /url = https:\/\/example.test\/game/u);
    assert.doesNotMatch(reviewed, /title = A sample announcement/u);
});
