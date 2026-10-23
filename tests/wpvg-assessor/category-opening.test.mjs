/**
 * @file tests/wpvg-assessor/category-opening.test.mjs
 * Purpose: Verify category loading failures dispose their pending navigation session.
 * Contents: Offline startup, failed loading mount, and failed category transition.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { startPageAssessor } from './interface-fixture.ts';

test('category loading failures release sessions before and after resolution', async (t) => {
    const dom = new JSDOM(
        '<div id="host-content">Host content</div><div id="kanade-wpvg-assessor-launcher"><a href="#">Launch</a></div>',
    );
    const originals = new Map(
        ['document', 'window', 'mw'].map((key) => [
            key,
            Object.getOwnPropertyDescriptor(globalThis, key),
        ]),
    );
    t.after(() => {
        for (const [key, original] of originals) {
            if (original) Object.defineProperty(globalThis, key, original);
            else delete globalThis[key];
        }
        dom.window.close();
    });
    globalThis.document = dom.window.document;
    globalThis.window = dom.window;
    let resolveSession;
    let disposals = 0;
    let failure = 'creation';
    let session = new Promise((resolve) => {
        resolveSession = resolve;
    });
    const require = (name) =>
        name === 'vue'
            ? {
                  defineComponent(component) {
                      if (failure === 'creation') {
                          throw new Error('Loading component failed');
                      }
                      return component;
                  },
                  createMwApp() {
                      return {
                          component() {},
                          mount() {},
                          unmount() {
                              throw new Error('Loading teardown failed');
                          },
                      };
                  },
              }
            : {};
    const anchor = document.querySelector('#kanade-wpvg-assessor-launcher a');
    globalThis.mw = {
        config: {
            get(key) {
                return {
                    wgDBname: 'zhwiki',
                    wgNamespaceNumber: 14,
                    wgPageName: 'Category:未评级电子游戏条目',
                }[key];
            },
        },
        Title: {
            newFromText: () => ({ getMainText: () => '未评级电子游戏条目' }),
        },
        loader: { using: async () => require },
        util: { addPortletLink: () => anchor.parentElement },
    };
    const notifications = [];
    startPageAssessor({
        logger: { debug() {}, info() {}, warn() {}, error() {} },
        notify: (item) => notifications.push(item),
        categoryAssessment: { open: () => session },
        createDialogPageContext: () => ({ api: {} }),
    });
    await new Promise(setImmediate);
    anchor.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise(setImmediate);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0].message, /Loading component failed/u);
    assert.equal(
        document.getElementById('kanade-wpvg-assessor-dialog-host'),
        null,
    );

    resolveSession({
        dispose() {
            disposals += 1;
        },
    });
    await new Promise(setImmediate);
    assert.equal(disposals, 1);

    failure = 'unmount';
    session = new Promise((resolve) => {
        resolveSession = resolve;
    });
    anchor.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise(setImmediate);
    assert.ok(document.getElementById('kanade-wpvg-assessor-dialog-host'));
    assert.equal(notifications.length, 1);
    resolveSession({
        dispose() {
            disposals += 1;
        },
    });
    await new Promise(setImmediate);
    assert.equal(notifications.length, 2);
    assert.match(notifications[1].message, /Loading teardown failed/u);
    assert.equal(disposals, 2);
    assert.equal(
        document.getElementById('kanade-wpvg-assessor-dialog-host'),
        null,
    );
    assert.equal(
        document.getElementById('host-content').textContent,
        'Host content',
    );
});
