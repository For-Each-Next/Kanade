/**
 * @file tests/source-editor/wiki-link.test.ts
 * Purpose: Tests redirect-aware citation organization links.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCitationWikiLink } from '../../src/source-editor/platform/mediawiki/wiki-link.ts';

test('builds a piped link from the redirect target', async () => {
    const api = {
        async get() {
            return { query: { pages: [{ ns: 0, title: 'Fami通' }] } };
        },
    };

    assert.equal(
        await resolveCitationWikiLink('ファミ通', api),
        '[[Fami通|ファミ通]]',
    );
    assert.equal(
        await resolveCitationWikiLink('[[ファミ通]]', api),
        '[[Fami通|ファミ通]]',
    );
});

test('retains an existing display label while fixing its target', async () => {
    const api = {
        async get() {
            return { query: { pages: [{ ns: 0, title: 'Target' }] } };
        },
    };

    assert.equal(
        await resolveCitationWikiLink('[[Old target|Label]]', api),
        '[[Target|Label]]',
    );
});

test('rejects missing pages and non-article namespaces', async () => {
    const missing = {
        async get() {
            return { query: { pages: [{ missing: true, ns: 0 }] } };
        },
    };
    const category = {
        async get() {
            return { query: { pages: [{ ns: 14, title: 'Category:Games' }] } };
        },
    };

    await assert.rejects(resolveCitationWikiLink('Missing', missing));
    await assert.rejects(resolveCitationWikiLink('Games', category));
});
