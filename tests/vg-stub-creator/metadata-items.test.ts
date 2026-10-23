/**
 * @file tests/vg-stub-creator/metadata-items.test.ts
 * Purpose: Verifies selectable metadata parsing, per-item related ownership, and restored editor choices.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createMetadataItemRow,
    getMetadataFieldRows,
    getMetadataItemDetails,
    getRelatedItemOwner,
    serializeMetadataItemRows,
    syncMetadataItemRows,
} from '../../src/vg-stub-creator/features/creator/form/metadata-items.ts';

test('metadata lists complete terminology aliases and retain explicit wikilink labels as one item', () => {
    const form: Record<string, any> = {
        developers: 'Konami; Nintendo; [[Unknown company|Unknown, Inc.]]',
    };
    const rows = getMetadataFieldRows(form, 'developers');

    assert.equal(rows.length, 3);
    assert.equal(rows[0].value, '[[科樂美]]');
    assert.equal(rows[1].value, '[[任天堂]]');
    assert.deepEqual(
        rows.map((row) => {
            const details = getMetadataItemDetails(form, 'developers', row);
            return [details.displayText, details.linkTarget];
        }),
        [
            ['科樂美', '科樂美'],
            ['任天堂', '任天堂'],
            ['Unknown, Inc.', 'Unknown company'],
        ],
    );
    assert.equal(new Set(rows.map((row) => row.id)).size, 3);
});

test('unlinked terminology and unknown items keep plain canonical names without invented links', () => {
    const form: Record<string, any> = {
        developers: '17-Bit; Unlisted developer',
        platforms: 'aqua',
        genres: 'farming',
        year: '2020',
    };
    const expectations = [
        ['developers', '17-Bit'],
        ['developers', 'Unlisted developer'],
        ['platforms', 'Mattel Aquarius'],
        ['genres', '農場模擬'],
        ['year', '2020年'],
    ] as const;

    for (const [field, label] of expectations) {
        const details = getMetadataFieldRows(form, field)
            .map((row) => getMetadataItemDetails(form, field, row))
            .find((item) => item.displayText === label);
        assert.ok(details, `${field}: ${label}`);
        assert.equal(details.linkTarget, '');
    }
});

test('each company owns its own category, navbox, and stub even after related titles are reviewed', () => {
    const form: Record<string, any> = { developers: 'Konami; Nintendo' };
    const rows = getMetadataFieldRows(form, 'developers');
    const items = rows.map((row) => ({
        id: row.id,
        ...getMetadataItemDetails(form, 'developers', row),
    }));
    const categories = [
        {
            category: 'Editor-reviewed company category',
            originalCategory: '科樂美遊戲',
            company: '科樂美',
            stubTag: 'Reviewed-stub',
        },
        { category: '任天堂游戏', company: '任天堂' },
    ];

    assert.equal(
        getRelatedItemOwner(categories[0], 'category', items, categories),
        rows[0].id,
    );
    assert.equal(
        getRelatedItemOwner(categories[1], 'category', items, categories),
        rows[1].id,
    );
    assert.equal(
        getRelatedItemOwner(
            { sourceTitle: 'Template:科樂美', text: '{{Reviewed navbox}}' },
            'navbox',
            items,
            categories,
        ),
        rows[0].id,
    );
    assert.equal(
        getRelatedItemOwner(
            { stubTag: 'Reviewed-stub' },
            'stubTag',
            items,
            categories,
        ),
        rows[0].id,
    );
    assert.equal(
        getRelatedItemOwner(
            { stubTag: '{{Template:Nintendo-stub}}' },
            'stubTag',
            items,
            categories,
        ),
        rows[1].id,
    );
});

test('series candidates and platform and year suggestions remain item-specific', () => {
    const form: Record<string, any> = {
        series: '[[薩爾達傳說系列]]; [[瑪利歐系列]]',
        platforms: 'PlayStation 4; Nintendo Switch',
        year: '2020',
    };

    for (const [field, category, index] of [
        ['series', '薩爾達傳說系列游戏', 0],
        ['series', '瑪利歐系列电子游戏', 1],
        ['platforms', 'PlayStation 4遊戲', 0],
        ['platforms', '任天堂Switch游戏', 1],
        ['year', '2020年电子游戏', 0],
    ] as const) {
        const rows = getMetadataFieldRows(form, field);
        const items = rows.map((row) => ({
            id: row.id,
            ...getMetadataItemDetails(form, field, row),
        }));
        assert.equal(
            getRelatedItemOwner({ category }, 'category', items, []),
            rows[index].id,
        );
    }
});

test('checkbox choices exclude unchecked values while keeping them through authoritative imports and restoration', () => {
    const form: Record<string, any> = { developers: 'Konami; Nintendo' };
    const rows = getMetadataFieldRows(form, 'developers');
    const unchecked = rows[0];
    unchecked.enabled = false;

    assert.equal(serializeMetadataItemRows(form, 'developers'), '[[任天堂]]');
    syncMetadataItemRows(form, 'developers');
    assert.equal(rows.length, 2);
    assert.equal(rows[0], unchecked);
    assert.equal(rows[0].enabled, false);

    form.developers = 'Square Enix';
    syncMetadataItemRows(form, 'developers');
    assert.equal(rows[0].value, '[[史克威尔艾尼克斯]]');
    assert.equal(rows[1], unchecked);
    assert.equal(rows[1].enabled, false);

    const restored = JSON.parse(JSON.stringify(form));
    const restoredRows = getMetadataFieldRows(restored, 'developers');
    assert.equal(restoredRows[1].id, unchecked.id);
    assert.equal(restoredRows[1].enabled, false);
    assert.equal(
        serializeMetadataItemRows(restored, 'developers'),
        '[[史克威尔艾尼克斯]]',
    );
    restoredRows[1].enabled = true;
    assert.equal(
        serializeMetadataItemRows(restored, 'developers'),
        '[[史克威尔艾尼克斯]]; [[科樂美]]',
    );
});

test("same-company publishers expand to items and preserve '=' until their choices differ", () => {
    const form: Record<string, any> = {
        developers: 'Konami; Nintendo',
        publishers: '=',
    };
    const publishers = getMetadataFieldRows(form, 'publishers');
    assert.deepEqual(
        publishers.map((row) => row.value),
        ['[[科樂美]]', '[[任天堂]]'],
    );
    assert.equal(serializeMetadataItemRows(form, 'publishers'), '=');

    form.developers = 'Nintendo';
    syncMetadataItemRows(form, 'publishers');
    assert.equal(publishers.length, 1);
    assert.equal(publishers[0].value, '[[任天堂]]');
    assert.equal(serializeMetadataItemRows(form, 'publishers'), '=');

    publishers[0].enabled = false;
    assert.equal(serializeMetadataItemRows(form, 'publishers'), '');
    assert.equal(getMetadataFieldRows(form, 'publishers').length, 1);
});

test('manual related ownership survives item renames while unassociated and orphan rows remain available separately', () => {
    const form: Record<string, any> = { developers: 'Konami; Nintendo' };
    const rows = getMetadataFieldRows(form, 'developers');
    const renamed = rows[0];
    const id = renamed.id;
    renamed.value = 'Reviewed developer';
    const items = rows.map((row) => ({
        id: row.id,
        ...getMetadataItemDetails(form, 'developers', row),
    }));

    assert.equal(
        getRelatedItemOwner(
            { relatedItemId: id, category: '任天堂游戏' },
            'category',
            items,
            [],
        ),
        id,
    );
    assert.equal(
        getRelatedItemOwner(
            { category: 'Manual category' },
            'category',
            items,
            [],
        ),
        '',
    );
    assert.equal(
        getRelatedItemOwner(
            { relatedItemId: 'removed-owner', category: '任天堂游戏' },
            'category',
            items,
            [],
        ),
        '',
    );
    serializeMetadataItemRows(form, 'developers');
    syncMetadataItemRows(form, 'developers');
    assert.equal(rows[0].id, id);
});

test('restored alias rows keep their IDs during canonical synchronization and new rows avoid restored IDs', () => {
    const form: Record<string, any> = {
        developers: 'Nintendo',
        metadataItemRows: {
            developers: [
                { id: 'restored-developer', value: 'Nintendo', enabled: true },
            ],
            genres: [
                { id: 'metadata-item-1000', value: 'Action', enabled: false },
            ],
        },
    };
    syncMetadataItemRows(form, 'developers');
    assert.equal(form.metadataItemRows.developers[0].id, 'restored-developer');
    const added = createMetadataItemRow('developers', 'Konami');
    assert.notEqual(added.id, 'restored-developer');
    assert.notEqual(added.id, 'metadata-item-1000');
});

test("reading row details preserves the active editor's unfinished whitespace and raw alias", () => {
    const form: Record<string, any> = { developers: 'Nintendo' };
    const [row] = getMetadataFieldRows(form, 'developers');
    row.value = ' Nintendo ';

    assert.equal(getMetadataFieldRows(form, 'developers')[0], row);
    assert.equal(
        getMetadataItemDetails(form, 'developers', row).displayText,
        '任天堂',
    );
    assert.equal(row.value, ' Nintendo ');
    syncMetadataItemRows(form, 'developers');
    assert.equal(row.value, ' Nintendo ');
    assert.equal(serializeMetadataItemRows(form, 'developers'), '[[任天堂]]');
});

test('shared suggestions prefer another selected contributor when their first item is unchecked', () => {
    const form: Record<string, any> = {
        platforms: 'PlayStation 4; PlayStation 5',
    };
    const rows = getMetadataFieldRows(form, 'platforms');
    const buildItems = () =>
        rows.map((row) => ({
            id: row.id,
            enabled: row.enabled,
            ...getMetadataItemDetails(form, 'platforms', row),
        }));
    const stubTag = { stubTag: 'PlayStation-stub' };

    assert.equal(
        getRelatedItemOwner(stubTag, 'stubTag', buildItems(), []),
        rows[0].id,
    );
    rows[0].enabled = false;
    assert.equal(
        getRelatedItemOwner(stubTag, 'stubTag', buildItems(), []),
        rows[1].id,
    );
    rows[1].enabled = false;
    assert.equal(
        getRelatedItemOwner(stubTag, 'stubTag', buildItems(), []),
        rows[0].id,
    );
    assert.equal(
        getRelatedItemOwner(
            { ...stubTag, relatedItemId: rows[1].id },
            'stubTag',
            buildItems(),
            [],
        ),
        rows[1].id,
    );
});
