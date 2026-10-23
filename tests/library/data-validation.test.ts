/**
 * @file tests/library/data-validation.test.ts
 * Purpose: Preserve boundary object-check and missing-record contracts.
 * Contents: Array acceptance, record identity, and invalid-value regressions.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    asRecord,
    isObject,
    isRecord,
    readRecord,
} from '../../src/library/data-validation/records.ts';

test('object and record guards retain their distinct array contracts', () => {
    const array: unknown[] = [];
    assert.equal(isObject(array), true);
    assert.equal(isRecord(array), false);
    assert.equal(asRecord(array), undefined);
    assert.equal(readRecord(array), null);
});

test('record readers preserve the original object without normalizing it', () => {
    for (const value of [{}, { title: 'Article' }, Object.create(null)]) {
        assert.equal(isObject(value), true);
        assert.equal(isRecord(value), true);
        assert.equal(asRecord(value), value);
        assert.equal(readRecord(value), value);
    }
});

test('invalid values retain undefined and null reader contracts', () => {
    for (const value of [null, undefined, '', 0, false, () => undefined]) {
        assert.equal(isObject(value), false);
        assert.equal(isRecord(value), false);
        assert.equal(asRecord(value), undefined);
        assert.equal(readRecord(value), null);
    }
});
