/**
 * @file tests/rev-copy/quick-access.test.mjs
 * Purpose: Verify Revision Copy keeps native entrypoints without a bottom-right launcher.
 * Contents: Lazy Codex opening, duplicate mounts, page invalidation, and focus restoration.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCodexRuntime } from './codex-runtime.mjs';
import { createHost, settle } from './helpers.mjs';

const runtime = await buildCodexRuntime();

test('inline Tools opens the current dialog without registering a floating shortcut', async (t) => {
    const host = createHost();
    t.after(() => host.dom.window.close());
    host.window.HTMLElement.prototype.scrollIntoView = () => {};
    host.window.eval(runtime);
    const modules = [];
    host.window.mw.loader.using = async (names) => {
        modules.push(names);
        return (name) => host.window.revCopyTestModules[name];
    };
    host.start();
    await settle();
    const selector = '[data-kanade-rev-copy-action="advanced"]';
    const action = host.document.querySelector(selector);
    assert.ok(action);
    assert.equal(action.tagName, 'A');
    assert.equal(action.textContent, 'tools');
    assert.equal(host.document.querySelector('#kanade-quick-access'), null);
    assert.equal(host.window[Symbol.for('kanade.quick-access.v1')], undefined);
    assert.equal(
        modules.some((names) => names.includes('@wikimedia/codex')),
        false,
    );
    host.start();
    host.fireContent();
    await settle();
    assert.equal(host.document.querySelectorAll(selector).length, 1);
    assert.equal(host.document.querySelector(selector), action);
    assert.equal(host.document.querySelector('#kanade-quick-access'), null);

    action.focus();
    action.click();
    await settle();
    const dialog = host.document.querySelector(
        '.kanade-rev-copy-advanced-dialog',
    );
    assert.ok(dialog);
    assert.equal(
        modules.filter((names) => names.includes('@wikimedia/codex')).length,
        1,
    );
    host.document
        .querySelector(
            '.kanade-rev-copy-advanced-dialog .cdx-dialog__header__close-button',
        )
        .click();
    await settle();
    assert.equal(host.document.activeElement, action);

    host.values.wgAction = 'edit';
    host.fireContent();
    await settle();
    assert.equal(host.document.querySelector(selector), null);
    assert.equal(host.document.querySelector('#kanade-quick-access'), null);
    assert.equal(host.document.getElementById('kanade-rev-copy-row'), null);
    action.click();
    await settle();
    assert.equal(
        host.document.querySelector('.kanade-rev-copy-advanced-dialog'),
        null,
    );
});
