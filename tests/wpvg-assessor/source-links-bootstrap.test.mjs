/**
 * @file tests/wpvg-assessor/source-links-bootstrap.test.mjs
 * Purpose: Verify the real source launcher bundle before host-dependent startup.
 * Contents: Both artifact forms, external-only startup, wiki readiness, and safe routes.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

import { createArtifacts, outputOptions } from '../../scripts/artifacts.mjs';
import { tools } from '../../scripts/tools.mjs';
import { startBeforeHost } from '../../src/wpvg-assessor/app/source-links-browser.ts';

const tool = tools.find(({ id }) => id === 'wpvg-assessor');
const bootstrap = await build({
    entryPoints: [`src/${tool.directory}/${tool.pageBootstrapEntrypoint}`],
    bundle: true,
    write: false,
    ...outputOptions,
    globalName: 'kanadePageBootstrap',
    legalComments: 'none',
});
const artifacts = await createArtifacts({
    tool,
    compact: 'window.fixtureHostStarts = (window.fixtureHostStarts ?? 0) + 1;',
    pageBootstrap: bootstrap.outputFiles[0].text,
    version: '0.1.3',
    license: 'Fixture license',
});

test('source bootstrap returns external versus wiki startup ownership and decorates each list', (t) => {
    const originals = new Map(
        ['window', 'document'].map((key) => [
            key,
            Object.getOwnPropertyDescriptor(globalThis, key),
        ]),
    );
    t.after(() => {
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    });
    for (const [url, id, expected] of [
        ['https://petscan.toolforge.org/', 'main_results', false],
        [
            'https://zh.wikipedia.org/wiki/WikiProject:电子游戏/新进条目',
            'mw-content-text',
            true,
        ],
    ]) {
        const { window } = createPage(
            t,
            url,
            `<div id="${id}"><a href="https://zh.wikipedia.org/wiki/Game">Game</a></div>`,
        );
        globalThis.window = window;
        globalThis.document = window.document;
        assert.equal(startBeforeHost(), expected);
        assert.equal(
            window.document.querySelector('a').href,
            'https://zh.wikipedia.org/wiki/Game?wpvg-assessor=1',
        );
    }
});

function createPage(t, url, content) {
    const dom = new JSDOM(content, { url, runScripts: 'dangerously' });
    const timers = new Map();
    let timerIdentity = 0;
    dom.window.setTimeout = (callback) => {
        const identity = ++timerIdentity;
        timers.set(identity, callback);
        return identity;
    };
    dom.window.clearTimeout = (identity) => timers.delete(identity);
    const errors = [];
    dom.window.addEventListener('error', (event) => errors.push(event.message));
    t.after(() => {
        assert.deepEqual(errors, []);
        dom.window.close();
    });
    return { window: dom.window, timers };
}

for (const [name, artifact] of artifacts) {
    test(`${name} decorates PetScan results without host modules or readiness polling`, (t) => {
        for (const origin of [
            'https://petscan.toolforge.org',
            'https://petscan.wmcloud.org',
        ]) {
            const { window, timers } = createPage(
                t,
                `${origin}/?psid=12`,
                `<table><tr><td>
                    <a id="article" href="https://zh.wikipedia.org/zh-tw/Game?uselang=en#History">Game</a>
                    <a id="revision" href="https://zh.wikipedia.org/w/index.php?title=Game&oldid=12">Revision</a>
                    <a id="edit" href="https://zh.wikipedia.org/wiki/Game?action=edit">Edit</a>
                    <a id="foreign" href="https://en.wikipedia.org/wiki/Game">Foreign</a>
                </td></tr></table>`,
            );
            window.eval(artifact);
            const { document } = window;
            assert.equal(
                document.getElementById('article').href,
                'https://zh.wikipedia.org/zh-tw/Game?uselang=en&wpvg-assessor=1#History',
            );
            for (const id of ['revision', 'edit', 'foreign']) {
                assert.equal(
                    document.getElementById(id).href.includes('wpvg-assessor'),
                    false,
                );
            }
            assert.equal(window.fixtureHostStarts, undefined);
            assert.equal(window.mw, undefined);
            assert.equal(window.kanadePageBootstrap, undefined);
            assert.equal(timers.size, 0);
            const owner =
                window[Symbol.for('kanade.wpvg-assessor.source-links')];
            assert.equal(typeof owner, 'function');
            window.eval(artifact);
            assert.equal(
                window[Symbol.for('kanade.wpvg-assessor.source-links')],
                owner,
            );
            assert.equal(timers.size, 0);
        }
    });
}

test('readable artifact decorates the wiki list before MediaWiki arrives, then starts the host once', (t) => {
    const { window, timers } = createPage(
        t,
        'https://zh.wikipedia.org/wiki/WikiProject:电子游戏/新进条目',
        '<div id="mw-content-text"><a href="/wiki/Game">Game</a></div>',
    );
    window.eval(artifacts.get(`${tool.basename}.user.js`));
    assert.equal(
        window.document.querySelector('a').href,
        'https://zh.wikipedia.org/wiki/Game?wpvg-assessor=1',
    );
    assert.equal(window.fixtureHostStarts, undefined);
    assert.equal(timers.size, 1);
    window.mw = { config: { get() {} }, loader: { using() {} }, hook() {} };
    const [identity, callback] = [...timers][0];
    timers.delete(identity);
    callback();
    assert.equal(window.fixtureHostStarts, 1);
    assert.equal(timers.size, 0);
    assert.equal(window.kanadePageBootstrap, undefined);
});
