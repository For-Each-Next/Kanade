/**
 * @file tests/source-editor/editor-backend.test.ts
 * Purpose: Validate interoperable host-owned editor backends without taking ownership.
 * Contents: Complete operation contract and malformed host-value rejection.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getEditBoxBackend } from '../../src/source-editor/platform/editor-backend.ts';
import type { EditBoxBackend } from '../../src/source-editor/app/contracts/editor-backend.ts';

function backend(): EditBoxBackend {
    return {
        focus() {},
        read() {
            return 'source';
        },
        replaceSelection() {},
        write() {},
        writePreservingPosition() {},
    };
}

test('complete host-owned backends are accepted without replacing or disposing them', () => {
    const key = Symbol.for('mediawiki-gadgets.edit-box-backend');
    const foreign = backend();
    const textarea = { [key]: foreign } as unknown as HTMLTextAreaElement;
    assert.equal(getEditBoxBackend(textarea), foreign);
    assert.equal(
        (textarea as unknown as Record<symbol, unknown>)[key],
        foreign,
    );
});

test('missing or incomplete backend contracts are ignored', () => {
    const key = Symbol.for('mediawiki-gadgets.edit-box-backend');
    assert.equal(getEditBoxBackend(null), null);
    for (const candidate of [
        undefined,
        null,
        'backend',
        false,
        {},
        ...Object.keys(backend()).map((missing) => {
            const value = { ...backend() } as Record<string, unknown>;
            delete value[missing];
            return value;
        }),
    ]) {
        const textarea = { [key]: candidate } as unknown as HTMLTextAreaElement;
        assert.equal(getEditBoxBackend(textarea), null);
    }
});
