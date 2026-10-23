/**
 * @file tests/vg-stub-creator/editor.test.ts
 * Purpose: Verify enhanced-editor integration and current CodeMirror transactions.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getCodeMirrorText,
    setCodeMirrorText,
    type SourceEditor,
} from '../../src/vg-stub-creator/features/creator/form/source-editor.ts';

test('preview source uses CodeMirror 6 transactions without obsolete APIs', () => {
    let text = 'before';
    const textarea = { value: 'backing source' } as HTMLTextAreaElement;
    const editor: SourceEditor = {
        initialize() {},
        destroy() {},
        view: {
            state: {
                doc: {
                    get length() {
                        return text.length;
                    },
                    toString: () => text,
                },
            },
            dispatch({ changes }) {
                assert.deepEqual(changes, { from: 0, to: 6, insert: 'after' });
                text = changes.insert;
            },
        },
    };
    assert.equal(getCodeMirrorText(editor, textarea), 'before');
    setCodeMirrorText(editor, textarea, 'after');
    assert.equal(getCodeMirrorText(editor, textarea), 'after');
    delete editor.view;
    setCodeMirrorText(editor, textarea, 'native fallback');
    assert.equal(getCodeMirrorText(editor, textarea), 'native fallback');
});
