/**
 * @file tests/source-editor/page-preview-lifecycle.test.mjs
 * Purpose: Verify that disposing link previews invalidates pending lookups.
 * Contents: Offline DOM lifecycle regression.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import { attachPagePreviews } from '../../src/source-editor/features/editor/page-preview.ts';

test('a pending preview cannot highlight source after its controller is destroyed', async () => {
    const dom = new JSDOM(
        '<div id="editor"><span data-kanade-source-editor-page-preview-title="Example" data-kanade-source-editor-page-preview-wiki="local">Example</span></div><div id="overlay"></div>',
    );
    const { window } = dom;
    const editor = window.document.getElementById('editor');
    const overlay = window.document.getElementById('overlay');
    const anchor = editor.querySelector('span');
    const timers = new Map();
    let nextTimer = 0;
    window.setTimeout = (callback) => {
        const handle = ++nextTimer;
        timers.set(handle, callback);
        return handle;
    };
    window.clearTimeout = (handle) => timers.delete(handle);
    let finish;
    let requests = 0;
    const pending = new Promise((resolve) => {
        finish = resolve;
    });
    const previews = attachPagePreviews({
        editor,
        overlay,
        enabled: true,
        load() {
            requests += 1;
            return pending;
        },
    });

    try {
        anchor.dispatchEvent(
            new window.MouseEvent('pointerover', {
                bubbles: true,
                clientX: 10,
                clientY: 10,
            }),
        );
        const scheduled = [...timers.values()];
        timers.clear();
        for (const callback of scheduled) callback();
        assert.equal(requests, 1);

        previews.destroy();
        finish({ kind: 'missing' });
        await pending;
        await Promise.resolve();

        assert.equal(
            anchor.classList.contains(
                'kanade-source-editor-token--page-missing',
            ),
            false,
        );
        assert.equal(overlay.childElementCount, 0);
        assert.equal(timers.size, 0);
    } finally {
        previews.destroy();
        window.close();
    }
});
