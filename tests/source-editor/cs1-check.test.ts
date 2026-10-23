/**
 * @file tests/source-editor/cs1-check.test.ts
 * Purpose: Tests the typed MediaWiki adapter used for live CS1 checks.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildCs1CheckWikitext,
    requestCs1WikitextCheck,
} from '../../src/source-editor/platform/mediawiki/cs1-check.ts';

test('builds isolated CS1 regions in source order', () => {
    const text = buildCs1CheckWikitext([
        { rawTemplate: '{{cite web|title=First}}' },
        { rawTemplate: '{{cite book|title=Second}}' },
    ]);

    assert.equal(
        text,
        [
            '<div id="kanade-source-editor-cs1-check-0">',
            '{{cite web|title=First}}',
            '</div>',
            '<div id="kanade-source-editor-cs1-check-1">',
            '{{cite book|title=Second}}',
            '</div>',
        ].join('\n'),
    );
});

test('posts the action=parse contract and validates its result', async () => {
    let parameters: Record<string, unknown> | undefined;
    const api = {
        async post(entered: Record<string, unknown>): Promise<unknown> {
            parameters = entered;
            return {
                parse: {
                    categories: [
                        { category: 'CS1 errors' },
                        {},
                        { category: 'CS1 maintenance' },
                    ],
                    text: '<span>checked</span>',
                },
            };
        },
    };

    const result = await requestCs1WikitextCheck('{{cite web}}', {
        api,
        pageTitle: 'Example page',
    });

    assert.deepEqual(parameters, {
        action: 'parse',
        contentmodel: 'wikitext',
        disableeditsection: true,
        disablelimitreport: true,
        disabletoc: true,
        formatversion: 2,
        preview: true,
        prop: 'text|categories',
        text: '{{cite web}}',
        title: 'Example page',
    });
    assert.deepEqual(result, {
        categories: ['CS1 errors', 'CS1 maintenance'],
        html: '<span>checked</span>',
    });
});

test('accepts empty parse output and rejects malformed output', async () => {
    const emptyApi = {
        async post(): Promise<unknown> {
            return {};
        },
    };
    assert.deepEqual(
        await requestCs1WikitextCheck('', {
            api: emptyApi,
            pageTitle: 'Page',
        }),
        { categories: [], html: '' },
    );

    const malformedApi = {
        async post(): Promise<unknown> {
            return { parse: { categories: 'not an array' } };
        },
    };
    await assert.rejects(
        requestCs1WikitextCheck('', {
            api: malformedApi,
            pageTitle: 'Page',
        }),
        /categories must be an array/u,
    );
});
