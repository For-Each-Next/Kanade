/**
 * @file tests/rev-copy/notification.test.mjs
 * Purpose: Verify lazy Codex copy toasts, focus preservation, dismissal, and fallback.
 *
 * Contents: Real-component offline fixtures and notification behavior tests.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { buildCodexRuntime } from './codex-runtime.mjs';

const runtime = await buildCodexRuntime();
const { outputFiles } = await build({
    entryPoints: ['src/rev-copy/platform/mediawiki/notification.ts'],
    bundle: true,
    format: 'iife',
    globalName: 'RevCopyNotificationTest',
    loader: { '.css': 'text' },
    write: false,
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

async function waitForToastRemoval(document) {
    const deadline = Date.now() + 2000;
    while (
        document.querySelector('#kanade-rev-copy-copy-notification') &&
        Date.now() < deadline
    ) {
        await settle();
    }
    assert.equal(
        document.querySelector('#kanade-rev-copy-copy-notification'),
        null,
    );
}

function fixture(t, options = {}) {
    const dom = new JSDOM('<!doctype html><button id="copy">Copy</button>', {
        url: 'https://zh.wikipedia.org/wiki/Example',
        pretendToBeVisual: true,
        runScripts: 'outside-only',
    });
    const { window } = dom;
    const modules = [];
    const notifications = [];
    const timers = [];
    window.eval(runtime);
    const originalTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => {
        if (delay === 4000) {
            timers.push(callback);
            return -timers.length;
        }
        return originalTimeout(callback, delay, ...args);
    };
    window.mw = {
        loader: {
            using: async (names) => {
                modules.push(names);
                if (options.failure) throw new Error('Module load failed');
                await options.loading;
                return (name) =>
                    options.missing ? {} : window.revCopyTestModules[name];
            },
        },
        notify: (message, settings) => {
            notifications.push({ message, settings });
            if (options.notifyFailure)
                throw new Error('Host notification failed');
        },
    };
    window.eval(
        `${outputFiles[0].text}\nwindow.RevCopyNotificationTest = RevCopyNotificationTest;`,
    );
    window.document.querySelector('#copy').focus();
    t.after(() => window.close());
    return {
        window,
        document: window.document,
        modules,
        notifications,
        timers,
        notify: window.RevCopyNotificationTest.notifyCopySuccess,
    };
}

test('copy feedback loads actual Codex lazily and preserves focus while rendering text safely', async (t) => {
    const f = fixture(t);
    assert.equal(f.modules.length, 0);
    await f.notify('Copied <img src=x onerror=alert(1)>');
    await settle();
    const toast = f.document.querySelector(
        '#kanade-rev-copy-copy-notification .cdx-toast--success',
    );
    assert.ok(toast);
    assert.match(toast.textContent, /Copied <img/u);
    assert.equal(toast.querySelector('img'), null);
    assert.equal(f.document.activeElement, f.document.querySelector('#copy'));
    assert.equal(f.window.getComputedStyle(toast).top, '16px');
    assert.equal(f.window.getComputedStyle(toast).right, '16px');
    assert.equal(f.window.getComputedStyle(toast).bottom, 'auto');
    assert.equal(f.notifications.length, 0);
    assert.equal(f.modules.length, 1);
    assert.deepEqual([...f.modules[0]], ['vue', '@wikimedia/codex']);
    assert.equal(f.timers.length, 1);
    f.timers[0]();
    await waitForToastRemoval(f.document);
});

test('later copies replace the gadget toast without changing other notification areas', async (t) => {
    const f = fixture(t);
    const unrelated = f.document.createElement('div');
    unrelated.className = 'cdx-toast-container__stack';
    unrelated.textContent = 'Unrelated notification';
    f.document.body.append(unrelated);
    await f.notify('First copy');
    await f.notify('Second copy');
    await settle();
    assert.equal(f.document.querySelectorAll('.cdx-toast').length, 1);
    assert.match(
        f.document.querySelector('.cdx-toast').textContent,
        /Second copy/u,
    );
    assert.equal(unrelated.textContent, 'Unrelated notification');
    assert.equal(f.modules.length, 1);
    f.document.querySelector('.cdx-message__dismiss-button').click();
    await waitForToastRemoval(f.document);
});

test('only the latest completed-copy confirmation appears after a delayed runtime load', async (t) => {
    let resolve;
    const loading = new Promise((yes) => {
        resolve = yes;
    });
    const f = fixture(t, { loading });
    const first = f.notify('First copy');
    const second = f.notify('Second copy');
    assert.equal(f.document.querySelector('.cdx-toast'), null);
    resolve();
    await Promise.all([first, second]);
    assert.equal(f.modules.length, 1);
    assert.match(
        f.document.querySelector('.cdx-toast').textContent,
        /Second copy/u,
    );
});

test('missing or failed Codex falls back to a scoped success notification without rejecting', async (t) => {
    for (const options of [
        { failure: true },
        { missing: true },
        { failure: true, notifyFailure: true },
    ]) {
        const f = fixture(t, options);
        await assert.doesNotReject(f.notify('Copied wikitext.'));
        assert.equal(f.document.querySelector('.cdx-toast'), null);
        assert.equal(f.notifications[0].message, 'Copied wikitext.');
        assert.equal(f.notifications[0].settings.type, 'success');
        assert.equal(
            f.notifications[0].settings.classes,
            'kanade-rev-copy-notification-fallback',
        );
        assert.equal(f.notifications[0].settings.autoHide, true);
    }
});
