/**
 * @file tests/vg-stub-creator/preview.test.mjs
 * Purpose: Keep native previews and support read-only Action API fallback without changing editor source.
 * Contents: Isolated browser globals, preview adapters, and regression scenarios.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createPreviewController } from '../../src/vg-stub-creator/platform/mediawiki/preview.ts';

function createHost(context, response, apiResponse = {}) {
    const dom = new JSDOM(
        '<form id="editform"><textarea id="wpTextbox1" name="wpTextbox1">Original source</textarea><input name="wpSave" value="Save"><input name="wpDiff" value="Diff"><input id="wpPreview" name="wpPreview" value="Show preview"></form>',
        { url: 'https://zh.wikipedia.org/wiki/Source_page' },
    );
    const nativeRequests = [];
    const apiRequests = [];
    const globals = {
        document: dom.window.document,
        DOMParser: dom.window.DOMParser,
        XMLSerializer: dom.window.XMLSerializer,
        FormData: dom.window.FormData,
        mw: {
            util: {
                getUrl(title, params) {
                    return `https://zh.wikipedia.org/w/index.php?${new URLSearchParams({ title, ...params })}`;
                },
            },
        },
        fetch: async (url, init) => {
            nativeRequests.push({ url: String(url), init });
            return response;
        },
    };
    for (const [key, value] of Object.entries(globals)) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, {
            configurable: true,
            writable: true,
            value,
        });
        context.after(() => {
            if (previous) Object.defineProperty(globalThis, key, previous);
            else delete globalThis[key];
        });
    }
    context.after(() => dom.window.close());
    const preview = createPreviewController({
        createApi: () => ({
            async get() {
                return {};
            },
            async post(params) {
                apiRequests.push(params);
                if (apiResponse instanceof Error) throw apiResponse;
                return apiResponse;
            },
            async postWithToken() {
                assert.fail('A preview must never use a write-token endpoint.');
            },
        }),
        getPageName: () => 'Source page',
        messages: {
            previewHttp: (status) => `Preview HTTP ${status}`,
            previewMissing: 'Missing preview',
            unableRead: () => 'Cannot read',
        },
    });
    return { dom, preview, nativeRequests, apiRequests };
}

test('native article preview remains preferred and never submits save controls', async (context) => {
    const host = createHost(
        context,
        new Response(
            '<div id="wikiPreview"><div class="mw-parser-output"><p>Native preview</p></div></div>',
        ),
    );
    const html = await host.preview.parseArticlePreviewText('Reviewed source', {
        pageName: 'Draft title',
    });
    assert.match(html, /Native preview/u);
    assert.doesNotMatch(html, /wikiPreview|mw-parser-output/u);
    assert.deepEqual(host.apiRequests, []);
    assert.equal(host.nativeRequests.length, 1);
    const { url, init } = host.nativeRequests[0];
    assert.equal(new URL(url).searchParams.get('action'), 'submit');
    assert.equal(init.method, 'POST');
    assert.equal(
        init.body.get('wpTextbox1'),
        '= Draft title =\nReviewed source',
    );
    assert.equal(init.body.get('wpPreview'), 'Show preview');
    assert.equal(init.body.has('wpSave'), false);
    assert.equal(init.body.has('wpDiff'), false);
    assert.equal(
        host.dom.window.document.getElementById('wpTextbox1').value,
        'Original source',
    );
});

test('read-only native response parses the exact generated text in the draft title context', async (context) => {
    const host = createHost(
        context,
        new Response('<h1>View source</h1><p>This account cannot edit.</p>'),
        { parse: { text: '<p>API preview</p>' } },
    );
    const form = { pageName: 'Draft title', additionalProse: 'Reviewed text' };
    const before = structuredClone(form);
    assert.equal(
        await host.preview.parseArticlePreviewText('Reviewed source', form),
        '<p>API preview</p>',
    );
    assert.deepEqual(host.apiRequests, [
        {
            action: 'parse',
            contentmodel: 'wikitext',
            disableeditsection: true,
            formatversion: 2,
            prop: 'text',
            text: '= Draft title =\nReviewed source',
            title: 'Draft title',
            preview: true,
        },
    ]);
    assert.deepEqual(form, before);
    assert.equal(
        new URL(host.nativeRequests[0].url).searchParams.get('title'),
        'Source page',
    );
    assert.equal(
        host.dom.window.document.getElementById('wpTextbox1').value,
        'Original source',
    );
});

test('missing native preview and invalid API content cannot become an empty successful preview', async (context) => {
    const invalidResponses = [
        {},
        { error: { code: 'badrequest' } },
        { parse: { text: '' } },
        { parse: { text: '   ' } },
        { parse: { text: { '*': '<p>Obsolete format</p>' } } },
    ];
    for (const response of invalidResponses) {
        await context.test(JSON.stringify(response), async (subcontext) => {
            const host = createHost(
                subcontext,
                new Response('<h1>View source</h1>'),
                response,
            );
            await assert.rejects(
                host.preview.parseArticlePreviewText('Reviewed source', {}),
                /Missing preview/u,
            );
            assert.equal(host.apiRequests.length, 1);
            assert.equal(host.apiRequests[0].title, 'Source page');
            assert.equal(
                host.apiRequests[0].text,
                '= Source page =\nReviewed source',
            );
            assert.equal(
                host.dom.window.document.getElementById('wpTextbox1').value,
                'Original source',
            );
        });
    }
});

test('native HTTP errors remain visible and do not silently trigger a second request', async (context) => {
    const host = createHost(
        context,
        new Response('Unavailable', { status: 503 }),
    );
    await assert.rejects(
        host.preview.parseArticlePreviewText('Reviewed source', {}),
        /Preview HTTP 503/u,
    );
    assert.deepEqual(host.apiRequests, []);
});

test('fallback request failure preserves the draft and propagates the actual API error', async (context) => {
    const host = createHost(
        context,
        new Response('<h1>View source</h1>'),
        new Error('API unavailable'),
    );
    const form = {
        pageName: 'Draft title',
        additionalProse: 'Keep this draft',
    };
    await assert.rejects(
        host.preview.parseArticlePreviewText('Reviewed source', form),
        /API unavailable/u,
    );
    assert.equal(form.additionalProse, 'Keep this draft');
    assert.equal(
        host.dom.window.document.getElementById('wpTextbox1').value,
        'Original source',
    );
});
