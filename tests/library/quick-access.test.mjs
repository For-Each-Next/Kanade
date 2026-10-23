/**
 * @file tests/library/quick-access.test.mjs
 * Purpose: Exercise shared quick-access ownership with the real host components.
 * Contents: Deferred runtime, duplicate registration, navigation, and cleanup checks.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { buildCodexRuntime } from '../rev-copy/codex-runtime.mjs';

const runtime = await buildCodexRuntime();
const { outputFiles } = await build({
    entryPoints: ['src/library/quick-access/registry.ts'],
    bundle: true,
    format: 'iife',
    globalName: 'QuickAccessTest',
    loader: { '.css': 'text' },
    footer: { js: 'window.QuickAccessTest = QuickAccessTest;' },
    write: false,
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function fixture(t, load) {
    const dom = new JSDOM(
        '<!doctype html><button id="host">Host action</button>',
        {
            url: 'https://en.wikipedia.org/wiki/Example',
            runScripts: 'outside-only',
            pretendToBeVisual: true,
        },
    );
    const { window } = dom;
    const errors = [];
    const requests = [];
    window.console.error = (...error) => errors.push(error);
    window.eval(runtime);
    const require = (name) => window.revCopyTestModules[name];
    window.mw = {
        loader: {
            using(modules) {
                requests.push(modules);
                return load ? load(require) : Promise.resolve(require);
            },
        },
    };
    window.eval(outputFiles[0].text);
    t.after(() => window.close());
    return {
        window,
        document: window.document,
        register: window.QuickAccessTest.registerQuickAccessAction,
        requests,
        errors,
    };
}

test('independent owners share one ordered dock and obsolete disposers preserve replacements', async (t) => {
    let release;
    const f = fixture(
        t,
        (require) =>
            new Promise((resolve) => {
                release = () => resolve(require);
            }),
    );
    let calls = 0;
    f.register({ id: 'example', label: 'Example action', activate() {} });
    const old = f.register({
        id: 'source-editor',
        label: 'Old editor',
        activate() {
            calls -= 100;
        },
    });
    f.register({ id: 'source-editor-tools', label: 'Tools', activate() {} });
    f.register({
        id: 'source-editor',
        label: 'Editor',
        activate() {
            calls += 1;
        },
    });
    f.register({
        id: 'navigation',
        label: 'Open example',
        href: 'https://zh.wikipedia.org/wiki/Example',
        target: '_blank',
    });
    old();
    assert.equal(f.requests.length, 1);
    release();
    await settle();
    assert.equal(f.document.querySelectorAll('#kanade-quick-access').length, 1);
    assert.deepEqual(
        [
            ...f.document.querySelectorAll('[data-kanade-quick-access-action]'),
        ].map((button) => button.dataset.kanadeQuickAccessAction),
        ['source-editor', 'source-editor-tools', 'example', 'navigation'],
    );
    f.document
        .querySelector('[data-kanade-quick-access-action="source-editor"]')
        .click();
    assert.equal(calls, 1);
    const navigation = f.document.querySelector(
        '[data-kanade-quick-access-action="navigation"]',
    );
    assert.equal(navigation.tagName, 'A');
    assert.equal(navigation.target, '_blank');
    assert.equal(navigation.rel, 'noopener noreferrer');
    assert.deepEqual(f.errors, []);
});

test('disposed pending owners cannot mount after a newer owner registers', async (t) => {
    const pending = [];
    const f = fixture(
        t,
        (require) =>
            new Promise((resolve) => pending.push(() => resolve(require))),
    );
    const old = f.register({
        id: 'source-editor',
        label: 'Old',
        activate() {},
    });
    old();
    const current = f.register({
        id: 'source-editor',
        label: 'Current',
        activate() {},
    });
    pending[0]();
    await settle();
    assert.equal(f.document.querySelector('#kanade-quick-access'), null);
    pending[1]();
    await settle();
    old();
    assert.equal(
        f.document.querySelector(
            '[data-kanade-quick-access-action="source-editor"]',
        ).textContent,
        'Current',
    );
    current();
    assert.equal(f.document.querySelector('#kanade-quick-access'), null);
    assert.equal(f.document.head.querySelector('style'), null);
    assert.equal(f.window[Symbol.for('kanade.quick-access.v1')], undefined);
});

test('back-forward cache retains controls while final navigation releases owned UI only', async (t) => {
    const f = fixture(t);
    f.register({ id: 'source-editor', label: 'Editor', activate() {} });
    await settle();
    const dock = f.document.querySelector('#kanade-quick-access');
    f.window.dispatchEvent(
        new f.window.PageTransitionEvent('pagehide', { persisted: true }),
    );
    f.window.dispatchEvent(
        new f.window.PageTransitionEvent('pageshow', { persisted: true }),
    );
    assert.equal(f.document.querySelector('#kanade-quick-access'), dock);
    f.window.dispatchEvent(
        new f.window.PageTransitionEvent('pagehide', { persisted: false }),
    );
    assert.equal(f.document.querySelector('#kanade-quick-access'), null);
    assert.ok(f.document.querySelector('#host'));
    assert.equal(f.document.head.querySelector('style'), null);
});

test('a failed host runtime leaves host controls intact and a later owner can retry', async (t) => {
    let failed = true;
    const f = fixture(t, (require) =>
        failed
            ? Promise.reject(new Error('Unavailable'))
            : Promise.resolve(require),
    );
    f.register({ id: 'example', label: 'Example action', activate() {} });
    await settle();
    assert.equal(f.document.querySelector('#kanade-quick-access'), null);
    assert.ok(f.document.querySelector('#host'));
    assert.equal(f.errors.length, 1);
    failed = false;
    f.register({ id: 'source-editor', label: 'Editor', activate() {} });
    await settle();
    assert.equal(
        f.document.querySelectorAll('[data-kanade-quick-access-action]').length,
        2,
    );
    assert.equal(f.requests.length, 2);
});

test('a replaced host mount is recreated without duplicate styles or detached activations', async (t) => {
    const f = fixture(t);
    let calls = 0;
    f.register({
        id: 'source-editor',
        label: 'Editor',
        activate() {
            calls += 1;
        },
    });
    await settle();
    const old = f.document.querySelector(
        '[data-kanade-quick-access-action="source-editor"]',
    );
    f.document.querySelector('#kanade-quick-access').remove();
    f.register({
        id: 'source-editor',
        label: 'Current editor',
        activate() {
            calls += 10;
        },
    });
    old.click();
    f.document
        .querySelector('[data-kanade-quick-access-action="source-editor"]')
        .click();
    assert.equal(calls, 10);
    assert.equal(f.document.querySelectorAll('#kanade-quick-access').length, 1);
    assert.equal(f.document.head.querySelectorAll('style').length, 1);
});
