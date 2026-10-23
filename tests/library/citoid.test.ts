/**
 * @file tests/library/citoid.test.ts
 * Purpose: Tests raw Wikimedia Citoid metadata requests.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. jsonResponse
 * 4. testReturnsFirstRawRecord
 * 5. Test scenarios
 * 6. testEncodesLookupText
 * 7. testRejectsBlankLookup
 * 8. testReportsHttpStatus
 * 9. testRejectsInvalidPayloads
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    CitoidRequestError,
    fetchCitationMetadata,
} from '../../src/library/citoid/client.ts';

const CITOID_ENDPOINT = '/api/rest_v1/data/citation/zotero/';

function jsonResponse(value: unknown, status = 200): Response {
    return new Response(JSON.stringify(value), {
        headers: { 'content-type': 'application/json' },
        status,
    });
}

async function testReturnsFirstRawRecord(): Promise<void> {
    const first = {
        itemType: 'webpage',
        publisher: 'Raw Publisher LLC',
        title: 'Example - Metacritic',
        unknownField: { preserved: true },
    };
    const fetcher = (async () =>
        jsonResponse([first, { title: 'Ignored' }])) as typeof fetch;

    const result = await fetchCitationMetadata('Example', { fetcher });

    assert.deepEqual(result, first);
}
test(
    'returns the first metadata record without normalization',
    testReturnsFirstRawRecord,
);

async function testEncodesLookupText(): Promise<void> {
    const requests: Array<[string, RequestInit | undefined]> = [];
    const fetcher = (async (input, init) => {
        requests.push([String(input), init]);
        return jsonResponse([{ itemType: 'webpage' }]);
    }) as typeof fetch;

    await fetchCitationMetadata(' https://example.test/a b?q=x/y ', {
        fetcher,
    });
    await fetchCitationMetadata(' doi:10.1000/example value ', { fetcher });

    const encodedUrl = 'https%3A%2F%2Fexample.test%2Fa%20b%3Fq%3Dx%2Fy';
    assert.deepEqual(requests, [
        [
            `${CITOID_ENDPOINT}${encodedUrl}`,
            { headers: { accept: 'application/json' } },
        ],
        [
            `${CITOID_ENDPOINT}doi%3A10.1000%2Fexample%20value`,
            { headers: { accept: 'application/json' } },
        ],
    ]);
}
test(
    'encodes URL and identifier lookups with a JSON accept header',
    testEncodesLookupText,
);

async function testRejectsBlankLookup(): Promise<void> {
    let requestCount = 0;
    const fetcher = (async () => {
        requestCount += 1;
        return jsonResponse([]);
    }) as typeof fetch;

    await assert.rejects(
        fetchCitationMetadata(' \n ', { fetcher }),
        /Enter a source before fetching citation metadata/u,
    );
    assert.equal(requestCount, 0);
}
test(
    'rejects blank lookup text before requesting Citoid',
    testRejectsBlankLookup,
);

async function testReportsHttpStatus(): Promise<void> {
    const fetcher = (async () =>
        jsonResponse({ message: 'unavailable' }, 503)) as typeof fetch;

    await assert.rejects(
        fetchCitationMetadata('10.1000/example', { fetcher }),
        function checkError(error: unknown) {
            assert.ok(error instanceof CitoidRequestError);
            assert.equal(error.status, 503);
            assert.match(error.message, /HTTP 503/u);
            return true;
        },
    );
}
test('reports non-OK responses with their HTTP status', testReportsHttpStatus);

async function testRejectsInvalidPayloads(): Promise<void> {
    const payloads: unknown[] = [{}, [], [null], [[]]];

    for (const payload of payloads) {
        const fetcher = (async () => jsonResponse(payload)) as typeof fetch;
        await assert.rejects(
            fetchCitationMetadata('Example', { fetcher }),
            /Citoid did not return citation metadata/u,
        );
    }
}
test(
    'rejects payloads without a first metadata object',
    testRejectsInvalidPayloads,
);
