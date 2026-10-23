/**
 * @file tests/vg-stub-creator/related-entry.test.ts
 * Purpose: Verifies unified related entries preserve template parameters and explicit namespace intent.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { getNavboxTitle } from '../../src/vg-stub-creator/features/creator/form/related-items.ts';
import { parseRelatedEntry } from '../../src/vg-stub-creator/features/creator/form/related-entry.ts';

test('plain names and category namespace links become category review values', () => {
    for (const entered of [
        ' 動作遊戲 ',
        'Category:動作遊戲',
        '分類:動作遊戲',
        '分类:動作遊戲',
        'CAT:動作遊戲',
        '[[Category:動作遊戲]]',
        '[[:分類:動作遊戲|Display name]]',
    ]) {
        assert.deepEqual(parseRelatedEntry(entered), {
            kind: 'category',
            value: '動作遊戲',
        });
    }
    assert.deepEqual(parseRelatedEntry('Nintendo-stub'), {
        kind: 'category',
        value: 'Nintendo-stub',
    });
});

test('complete template calls retain invocation parameters and nested wikitext verbatim', () => {
    for (const invocation of [
        '{{任天堂}}',
        '{{ Template:任天堂 |state=collapsed }}',
        '{{模板:任天堂|label=[[任天堂|Nintendo]]|note={{lang|en|Nintendo}}}}',
        '{{任天堂|note=First line\nSecond line}}',
    ]) {
        assert.deepEqual(parseRelatedEntry(invocation), {
            kind: 'navbox',
            value: invocation,
        });
        assert.equal(getNavboxTitle(invocation), '任天堂');
    }
});

test('template namespace aliases and links explicitly select template rows', () => {
    for (const entered of [
        'Template:任天堂',
        'template:任天堂',
        '模板:任天堂',
        '樣板:任天堂',
        'T:任天堂',
        '[[Template:任天堂|Display name]]',
    ]) {
        assert.deepEqual(parseRelatedEntry(entered), {
            kind: 'navbox',
            value: '{{任天堂}}',
        });
    }
    assert.deepEqual(parseRelatedEntry('Template:任天堂|state=collapsed'), {
        kind: 'navbox',
        value: '{{任天堂|state=collapsed}}',
    });
});

test('unparameterized stub templates use stub rows while parameterized calls retain all text', () => {
    for (const entered of [
        '{{Nintendo-stub}}',
        '{{ Template:Nintendo-stub }}',
        'Template:Nintendo-stub',
        '模板:Nintendo-stub',
        '[[Template:Nintendo-stub]]',
    ]) {
        assert.deepEqual(parseRelatedEntry(entered), {
            kind: 'stubTag',
            value: 'Nintendo-stub',
        });
    }
    for (const invocation of [
        '{{Nintendo-stub|date=October 2026}}',
        '{{Template:Nintendo-stub|note={{lang|en|Example}}}}',
    ]) {
        assert.deepEqual(parseRelatedEntry(invocation), {
            kind: 'navbox',
            value: invocation,
        });
    }
    assert.deepEqual(
        parseRelatedEntry('Template:Nintendo-stub|date=October 2026'),
        {
            kind: 'navbox',
            value: '{{Nintendo-stub|date=October 2026}}',
        },
    );
});

test('empty values and empty explicit page titles produce no related row', () => {
    for (const value of [undefined, null, '', '  ', 'Category:', 'Template:']) {
        assert.equal(parseRelatedEntry(value), null);
    }
});

test('related template recognition uses balanced complete calls and retains literal arguments', () => {
    const invocation =
        '{{任天堂|note=<nowiki>}}</nowiki>|value={{{fallback|{{lang|en|Nintendo}}}}}}}';
    assert.deepEqual(parseRelatedEntry(invocation), {
        kind: 'navbox',
        value: invocation,
    });
    assert.equal(getNavboxTitle(invocation), '任天堂');

    for (const source of ['{{任天堂}}{{索尼}}', '{{任天堂|note={{Open}}']) {
        assert.deepEqual(parseRelatedEntry(source), {
            kind: 'category',
            value: source,
        });
        assert.equal(getNavboxTitle(source), source);
    }
});
