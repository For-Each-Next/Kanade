/**
 * @file tests/source-editor/runtime-invariants.test.ts
 * Purpose: Preserve Source Editor's pure public API without browser startup.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

test('Source Editor exposes editing and reference operations without browser startup', async () => {
    const api = await import('../../src/source-editor/index.ts');

    for (const operation of [
        'formatArticleSource',
        'formatWikitext',
        'formatCitations',
        'manageCitations',
    ]) {
        assert.equal(
            typeof api[operation as keyof typeof api],
            'function',
            operation,
        );
    }
    assert.equal(typeof globalThis.window, 'undefined');
});
