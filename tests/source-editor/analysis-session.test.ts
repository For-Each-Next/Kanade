/**
 * @file tests/source-editor/analysis-session.test.ts
 * Purpose: Tests session-safe undo snapshots for citation analysis.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    appendAnalysisUndo,
    getAnalysisUndoText,
} from '../../src/source-editor/features/source-manager/analysis-session.ts';

test('groups consecutive analysis writes into one session undo', () => {
    const first = appendAnalysisUndo(null, 'original', 'first');
    const second = appendAnalysisUndo(first, 'first', 'second');

    assert.deepEqual(second, {
        afterText: 'second',
        beforeText: 'original',
    });
    assert.equal(getAnalysisUndoText(second, 'second'), 'original');
});

test('starts a new undo chain after an intervening editor change', () => {
    const first = appendAnalysisUndo(null, 'original', 'first');
    const second = appendAnalysisUndo(first, 'external', 'second');

    assert.equal(second.beforeText, 'external');
    assert.equal(getAnalysisUndoText(second, 'changed again'), null);
});
