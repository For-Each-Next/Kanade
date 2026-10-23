/**
 * @file tests/vg-stub-creator/mediawiki-responses.test.ts
 * Purpose: Reject obsolete or incomplete read responses before follow-up wiki writes.
 *
 * Table of contents:
 * 1. Imports
 * 2. createApi
 * 3. revisionResponse
 * 4. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreviewController } from '../../src/vg-stub-creator/platform/mediawiki/preview.ts';
import { registerNewPage } from '../../src/vg-stub-creator/platform/mediawiki/new-page-list.ts';
import { addTalkPageBanner } from '../../src/vg-stub-creator/platform/mediawiki/wiki-writes.ts';
import { fetchEnwikiMetadata } from '../../src/vg-stub-creator/platform/network/crosswiki.ts';

function createApi(response: unknown) {
    const reads: Record<string, unknown>[] = [];
    const writes: Record<string, unknown>[] = [];
    return {
        reads,
        writes,
        async get(params: Record<string, unknown>) {
            reads.push(params);
            return response;
        },
        async post() {
            return {};
        },
        async postWithToken(_token: string, params: Record<string, unknown>) {
            writes.push(params);
            return {};
        },
    };
}

function revisionResponse(content: string) {
    return {
        curtimestamp: '2026-10-06T12:00:00Z',
        query: {
            pages: [
                {
                    title: 'Reviewed page',
                    revisions: [
                        {
                            timestamp: '2026-10-06T11:00:00Z',
                            slots: { main: { content } },
                        },
                    ],
                },
            ],
        },
    };
}

test('preview reads current main-slot content and distinguishes blank content from missing content', async () => {
    const responses = [
        revisionResponse('Reviewed source'),
        revisionResponse(''),
    ];
    for (const [index, response] of responses.entries()) {
        const api = createApi(response);
        const preview = createPreviewController({
            createApi: () => api,
            getPageName: () => 'Reviewed page',
            messages: {
                previewHttp: String,
                previewMissing: 'Missing preview',
                unableRead: () => 'Cannot read',
            },
        });
        assert.equal(
            await preview.fetchPageText('Reviewed page'),
            index === 0 ? 'Reviewed source' : '',
        );
        assert.equal(api.reads[0]?.formatversion, '2');
    }
    for (const response of [
        {
            query: {
                pages: {
                    1: {
                        title: 'Reviewed page',
                        revisions: [{ '*': 'Old source' }],
                    },
                },
            },
        },
        {
            query: {
                pages: [
                    {
                        title: 'Reviewed page',
                        revisions: [{ slots: { main: { '*': 'Old source' } } }],
                    },
                ],
            },
        },
        { query: { pages: [{ title: 'Reviewed page', revisions: [{}] }] } },
    ]) {
        const preview = createPreviewController({
            createApi: () => createApi(response),
            getPageName: () => 'Reviewed page',
            messages: {
                previewHttp: String,
                previewMissing: 'Missing preview',
                unableRead: () => 'Cannot read',
            },
        });
        await assert.rejects(
            preview.fetchPageText('Reviewed page'),
            /Cannot read/u,
        );
    }
});

test('new-page registration preserves conflict timestamps and refuses incomplete revisions before writing', async () => {
    const api = createApi(revisionResponse(''));
    await registerNewPage(
        api,
        'Star Harbor',
        [],
        new Date('2026-10-06T12:00:00Z'),
    );
    assert.equal(api.writes.length, 1);
    assert.equal(api.writes[0]?.basetimestamp, '2026-10-06T11:00:00Z');
    assert.equal(api.writes[0]?.starttimestamp, '2026-10-06T12:00:00Z');
    assert.equal(api.writes[0]?.nocreate, true);
    for (const field of ['timestamp', 'slots'] as const) {
        const response = revisionResponse('Reviewed list');
        delete (
            response.query.pages[0]!.revisions[0] as Record<string, unknown>
        )[field];
        const invalid = createApi(response);
        await assert.rejects(
            registerNewPage(invalid, 'Star Harbor'),
            /Unable to read/u,
        );
        assert.equal(invalid.writes.length, 0);
    }
});

test('talk-banner reads use v2 and never append after an invalid or hidden revision', async () => {
    const existing = createApi(revisionResponse('{{WikiProject Video games}}'));
    await addTalkPageBanner(existing, 'Star Harbor');
    assert.equal(existing.reads[0]?.formatversion, '2');
    assert.equal(existing.writes.length, 0);
    const missing = createApi({
        query: { pages: [{ title: 'Talk:Star Harbor', missing: true }] },
    });
    await addTalkPageBanner(missing, 'Star Harbor');
    assert.equal(missing.writes.length, 1);
    for (const response of [
        {},
        { query: { pages: [{ title: 'Talk:Star Harbor', revisions: [{}] }] } },
    ]) {
        const invalid = createApi(response);
        await assert.rejects(
            addTalkPageBanner(invalid, 'Star Harbor'),
            /invalid revision/u,
        );
        assert.equal(invalid.writes.length, 0);
    }
});

test('English metadata requests current response format and leaves malformed evidence unknown', async () => {
    let requested = '';
    const fetcher: typeof fetch = async (input) => {
        requested = String(input);
        return Response.json({ query: { pages: [{ title: 'Star Harbor' }] } });
    };
    const metadata = await fetchEnwikiMetadata('Star Harbor', { fetcher });
    assert.equal(new URL(requested).searchParams.get('formatversion'), '2');
    assert.equal(metadata.pageExists, true);
    const unknown = await fetchEnwikiMetadata('Star Harbor', {
        fetcher: async () =>
            Response.json({
                query: { pages: { 1: { title: 'Star Harbor' } } },
            }),
    });
    assert.equal(unknown.pageExists, null);
});
