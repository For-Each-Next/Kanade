/**
 * @file tests/source-editor/language-codes.test.ts
 * Purpose: Tests the shared ISO language-name normalizer.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as citation from '../../src/source-editor/domain/language-codes.ts';

const normalize = citation.normalizeEnglishLanguageCodes;

test('prefers ISO 639-1 codes and falls back to ISO 639-3', () => {
    assert.equal(normalize('Japanese'), 'ja');
    assert.equal(normalize('Yue Chinese'), 'yue');
});

test('normalizes names case-insensitively and cleans comma spacing', () => {
    assert.equal(normalize('English,japanese'), 'en, ja');
    assert.equal(normalize('  FRENCH , japanese  '), 'fr, ja');
});

test('preserves existing codes and unknown values', () => {
    assert.equal(
        normalize('en-US, jpn, Unknown language'),
        'en-US, jpn, Unknown language',
    );
});

test('does not rewrite malformed lists or nested wikitext', () => {
    assert.equal(normalize('English,,Japanese'), 'English,,Japanese');
    assert.equal(
        normalize('{{lang|en|English}},Japanese'),
        '{{lang|en|English}},Japanese',
    );
});
