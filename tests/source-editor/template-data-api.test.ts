/**
 * @file tests/source-editor/template-data-api.test.ts
 * Purpose: Tests the shared single-template and bulk TemplateData loader.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 * 3. createTemplateDataApi
 * 4. createTemplateDataResponse
 * 5. createTemplateDataPage
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    chunkTemplateNames,
    loadTemplateData,
    type MediaWikiTemplateDataApi,
} from '../../src/source-editor/platform/mediawiki/template-data/api.ts';

test('template request batching partitions names without mutating the input', () => {
    const names = ['a', 'b', 'c', 'd', 'e'];
    const batches = chunkTemplateNames(names, 2);

    assert.deepEqual(batches, [['a', 'b'], ['c', 'd'], ['e']]);
    batches[0].push('changed');
    assert.deepEqual(names, ['a', 'b', 'c', 'd', 'e']);
    assert.deepEqual(chunkTemplateNames([], 20), []);
});

test('loads one bare or namespaced template', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const page = await loadTemplateData(' TM:Example ', {
        api: createTemplateDataApi(requests),
        requestParameters: { action: 'query', maxlag: 5 },
    });

    assert.equal(page?.title, 'Template:Example');
    assert.deepEqual(requests, [
        {
            action: 'templatedata',
            formatversion: 2,
            maxlag: 5,
            redirects: true,
            titles: 'Template:Example',
        },
    ]);
});

test('loads large title sets in bounded serial batches', async () => {
    const names = Array.from({ length: 45 }, (_value, index) => {
        return `Example ${index + 1}`;
    });
    const requests: Array<Record<string, unknown>> = [];
    let activeRequests = 0;
    let maximumActiveRequests = 0;
    const api: MediaWikiTemplateDataApi = {
        async get(parameters) {
            requests.push(parameters);
            activeRequests += 1;
            maximumActiveRequests = Math.max(
                maximumActiveRequests,
                activeRequests,
            );
            await Promise.resolve();
            activeRequests -= 1;
            return createTemplateDataResponse(parameters.titles);
        },
    };

    const result = await loadTemplateData(names, { api });

    assert.equal(result.size, names.length);
    assert.equal(maximumActiveRequests, 1);
    assert.deepEqual(
        requests.map((request) => String(request.titles).split('|').length),
        [20, 20, 5],
    );
});

test('resolves normalized titles and redirects', async () => {
    const result = await loadTemplateData(
        ['example_name', 'Old example', 'Missing'],
        {
            api: {
                async get() {
                    return {
                        normalized: [
                            {
                                from: 'Template:example_name',
                                to: 'Template:Example name',
                            },
                        ],
                        pages: [
                            createTemplateDataPage('Template:Example name'),
                            createTemplateDataPage('Template:New example'),
                            {
                                missing: true,
                                title: 'Template:Missing',
                            },
                        ],
                        redirects: [
                            {
                                from: 'Template:Old example',
                                to: 'Template:New example',
                            },
                        ],
                    };
                },
            },
        },
    );

    assert.equal(result.get('example_name')?.title, 'Template:Example name');
    assert.equal(result.get('Old example')?.title, 'Template:New example');
    assert.equal(result.has('Missing'), false);
});

test('rejects unsafe titles and unsupported batch sizes', async () => {
    const api: MediaWikiTemplateDataApi = {
        async get() {
            throw new Error('Unexpected API request');
        },
    };

    await assert.rejects(
        loadTemplateData('Unsafe|Title', { api }),
        /Invalid template name/u,
    );
    await assert.rejects(
        loadTemplateData(['Example'], { api, batchSize: 51 }),
        /batch size must be between 1 and 50/u,
    );
});

function createTemplateDataApi(
    requests: Array<Record<string, unknown>>,
): MediaWikiTemplateDataApi {
    return {
        async get(parameters) {
            requests.push(parameters);
            return createTemplateDataResponse(parameters.titles);
        },
    };
}

function createTemplateDataResponse(titles: unknown) {
    return {
        pages: String(titles).split('|').map(createTemplateDataPage),
    };
}

function createTemplateDataPage(title: string) {
    return {
        ns: 10,
        paramOrder: ['title'],
        params: { title: { aliases: [] } },
        title,
    };
}
