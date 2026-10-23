/**
 * @file tests/vg-stub-creator/related-items.test.ts
 * Purpose: Keep related choices beside their contributing inputs across edits and draft restoration.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildRelatedFieldMetadata,
    getRelatedIdentity,
    getRelatedItemField,
} from '../../src/vg-stub-creator/features/creator/form/related-items.ts';
import { replaceFormValues } from '../../src/vg-stub-creator/features/creator/form/form-model.ts';

test('Nintendo categories and explicit source roles appear beside their input fields', () => {
    const metadata = buildRelatedFieldMetadata({ developers: 'Nintendo' });

    assert.equal(
        getRelatedItemField(
            { category: '任天堂游戏', source: 'known' },
            'category',
            metadata,
            [],
        ),
        'developers',
    );
    assert.equal(
        getRelatedItemField(
            { category: 'Renamed developer category', source: 'developer †' },
            'category',
            metadata,
            [],
        ),
        'developers',
    );
    assert.equal(
        getRelatedItemField(
            { category: 'Resolved platform category', source: 'platform' },
            'category',
            metadata,
            [],
        ),
        'platforms',
    );
});

test('company choices remain beside their developer or publisher after title edits', () => {
    const metadata = buildRelatedFieldMetadata({
        developers: 'Konami',
        publishers: 'Square Enix',
    });
    const categories = [
        {
            category: 'Reviewed company category',
            originalCategory: '科樂美遊戲',
            company: '科樂美',
        },
        {
            category: 'Resolved publisher category',
            company: '史克威尔艾尼克斯',
        },
    ];

    assert.equal(
        getRelatedItemField(categories[0], 'category', metadata, categories),
        'developers',
    );
    assert.equal(
        getRelatedItemField(categories[1], 'category', metadata, categories),
        'publishers',
    );
    assert.equal(
        getRelatedItemField(
            {
                sourceTitle: 'Template:Square_Enix',
                text: '{{Reviewed publisher}}',
            },
            'navbox',
            metadata,
            categories,
        ),
        'publishers',
    );
    assert.equal(
        getRelatedItemField(
            { originalStubTag: 'konami-stub', stubTag: 'Reviewed-stub' },
            'stubTag',
            metadata,
            categories,
        ),
        'developers',
    );
});

test("same-company publisher shorthand contributes the developer's related choices", () => {
    const metadata = buildRelatedFieldMetadata({
        developers: 'Konami',
        publishers: '=',
    });

    assert.deepEqual(
        metadata.publishers.category,
        metadata.developers.category,
    );
    assert.deepEqual(metadata.publishers.company, metadata.developers.company);
    assert.deepEqual(metadata.publishers.navbox, metadata.developers.navbox);
    assert.deepEqual(metadata.publishers.stubTag, metadata.developers.stubTag);
});

test('series lookup candidates and platform, year and genre choices retain their input ownership', () => {
    const metadata = buildRelatedFieldMetadata({
        series: '[[薩爾達傳說系列]]',
        platforms: 'PlayStation 4',
        year: '2020',
        genres: 'Action',
    });
    const cases = [
        ['薩爾達傳說系列游戏', 'series'],
        ['PlayStation 4遊戲', 'platforms'],
        ['2020年电子游戏', 'year'],
        ['動作遊戲', 'genres'],
    ];

    for (const [category, field] of cases) {
        assert.equal(
            getRelatedItemField({ category }, 'category', metadata, []),
            field,
        );
    }
    assert.equal(
        getRelatedItemField(
            { stubTag: '{{Template:PlayStation-stub}}' },
            'stubTag',
            metadata,
            [],
        ),
        'platforms',
    );
});

test('manual placement wins over recognized titles and legacy unassociated items remain reachable', () => {
    const metadata = buildRelatedFieldMetadata({ developers: 'Konami' });

    assert.equal(
        getRelatedItemField(
            { relatedField: 'series', category: '科樂美遊戲' },
            'category',
            metadata,
            [],
        ),
        'series',
    );
    for (const [kind, row] of [
        ['category', { category: 'Legacy custom category' }],
        ['navbox', { text: '{{Legacy custom navbox}}' }],
        ['stubTag', { stubTag: 'Legacy-custom-stub' }],
    ] as const) {
        assert.equal(getRelatedItemField(row, kind, metadata, []), 'genres');
    }
    assert.equal(
        getRelatedIdentity('Category:PlayStation_4遊戲', 'category'),
        getRelatedIdentity('PlayStation 4遊戲', 'category'),
    );
});

test('draft restoration preserves inline ownership, selections and staged related-page edits', () => {
    const form: Record<string, any> = {};
    const pendingEdit = {
        title: 'Template:Reviewed navbox',
        text: 'Editor-approved source',
        summary: 'Editor-approved summary',
        create: false,
    };
    replaceFormValues(form, {
        metadataItemRows: {
            publishers: [
                {
                    id: 'reviewed-publisher',
                    value: 'Reviewed publisher',
                    enabled: false,
                },
            ],
        },
        navboxRows: [
            {
                relatedField: 'publishers',
                relatedItemId: 'reviewed-publisher',
                relatedGenerated: true,
                relatedModified: true,
                relatedRemoved: true,
                relatedDisabledByItem: true,
                sourceTitle: 'Original navbox',
                title: 'Reviewed navbox',
                text: '{{Reviewed navbox|mode=compact}}',
                enabled: false,
                pendingEdit,
            },
        ],
        stubTagRows: [
            {
                relatedField: 'platforms',
                relatedItemId: 'reviewed-platform',
                relatedRemoved: true,
                relatedDisabledByItem: false,
                originalStubTag: 'Original-stub',
                stubTag: 'Reviewed-stub',
                enabled: false,
                pendingEdit,
            },
        ],
        categoryRows: [
            {
                relatedField: 'year',
                relatedItemId: 'reviewed-year',
                relatedRemoved: true,
                relatedDisabledByItem: true,
                category: 'Reviewed year category',
                enabled: false,
                pendingEdit,
            },
        ],
    });

    const metadata = buildRelatedFieldMetadata(form);
    for (const [kind, rows, field] of [
        ['navbox', form.navboxRows, 'publishers'],
        ['stubTag', form.stubTagRows, 'platforms'],
        ['category', form.categoryRows, 'year'],
    ] as const) {
        assert.equal(
            getRelatedItemField(rows[0], kind, metadata, form.categoryRows),
            field,
        );
        assert.equal(rows[0].enabled, false);
        assert.deepEqual(rows[0].pendingEdit, pendingEdit);
    }
    assert.equal(form.navboxRows[0].relatedGenerated, true);
    assert.equal(form.navboxRows[0].relatedModified, true);
    assert.equal(form.navboxRows[0].relatedItemId, 'reviewed-publisher');
    assert.equal(form.navboxRows[0].relatedRemoved, true);
    assert.equal(form.navboxRows[0].relatedDisabledByItem, true);
    assert.equal(form.navboxRows[0].sourceTitle, 'Original navbox');
    assert.equal(form.navboxRows[0].text, '{{Reviewed navbox|mode=compact}}');
    assert.equal(form.stubTagRows[0].originalStubTag, 'Original-stub');
    assert.equal(form.stubTagRows[0].relatedItemId, 'reviewed-platform');
    assert.equal(form.stubTagRows[0].relatedRemoved, true);
    assert.equal(form.stubTagRows[0].relatedDisabledByItem, false);
    assert.equal(form.categoryRows[0].relatedItemId, 'reviewed-year');
    assert.equal(form.categoryRows[0].relatedRemoved, true);
    assert.equal(form.categoryRows[0].relatedDisabledByItem, true);
    assert.deepEqual(form.metadataItemRows.publishers, [
        {
            id: 'reviewed-publisher',
            value: 'Reviewed publisher',
            enabled: false,
        },
    ]);
});
