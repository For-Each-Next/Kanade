/**
 * @file tests/source-editor/short-footnotes.test.ts
 * Purpose: Tests shared short-footnote citation resolution.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    findShortFootnoteCitations,
    resolveShortFootnoteCitation,
} from '../../src/source-editor/domain/short-footnotes.ts';

const CITATION = '{{cite book|last=Smith|year=2020|title=Example}}';
const SOURCE = `Lead {{sfn|Smith|2020}}.\n\n* ${CITATION}`;

test('finds bibliography entries referenced by short footnotes', () => {
    const citations = findShortFootnoteCitations(SOURCE);

    assert.equal(citations.length, 1);
    assert.equal(citations[0].raw, CITATION);
    assert.equal(citations[0].reuseText, '{{sfn|Smith|2020}}');
    assert.deepEqual(citations[0].usePositions, [5]);
});

test('resolves one complete short-footnote call', () => {
    assert.equal(
        resolveShortFootnoteCitation(SOURCE, ' {{sfn|Smith|2020}} '),
        CITATION,
    );
    assert.equal(
        resolveShortFootnoteCitation(SOURCE, '{{sfn|Other|2020}}'),
        '',
    );
});

test('supports a site-specific template name normalizer', () => {
    const localized = `{{短脚注|Smith|2020}}\n${CITATION}`;
    const normalize = (name: string) =>
        name.trim() === '短脚注' ? 'sfn' : name.trim().toLowerCase();

    assert.equal(findShortFootnoteCitations(localized, normalize).length, 1);
});
