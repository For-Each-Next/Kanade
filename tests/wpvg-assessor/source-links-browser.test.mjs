/**
 * @file tests/wpvg-assessor/source-links-browser.test.mjs
 * Purpose: Verify list-link decoration, lifecycle ownership, and one-time launch consumption.
 * Contents: Scoped navigation, dynamic results, bfcache restoration, and marker cleanup.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import {
    consumeAssessorLauncher,
    installAssessorSourceLinks,
} from '../../src/wpvg-assessor/platform/browser/source-links.ts';

const ARTICLE = 'https://zh.wikipedia.org/wiki/Game';
const LIST = 'https://zh.wikipedia.org/wiki/WikiProject:电子游戏/新进条目';
const flush = () => new Promise(setImmediate);

test('decorates only eligible list content while retaining native navigation', async (t) => {
    for (const url of ['https://petscan.toolforge.org/', LIST]) {
        const isWiki = url === LIST;
        const dom = new JSDOM(
            `<nav><a id="navigation" href="${ARTICLE}">Navigation</a></nav>
            <a id="outside" href="${ARTICLE}">Outside</a>
            <div id="${isWiki ? 'mw-content-text' : 'main_results'}">
                <a id="game" href="${ARTICLE}?uselang=en#History" target="_blank" rel="noopener">Game</a>
                <a id="talk" href="https://zh.wikipedia.org/wiki/Talk:Game">Talk</a>
                <a id="old" href="${ARTICLE}?oldid=12">Revision</a>
                <a id="new" class="new" href="${ARTICLE}">Missing</a>
                <a id="download" download href="${ARTICLE}">Download</a>
                <div class="navbox"><a id="navbox" href="${ARTICLE}">Navbox</a></div>
                <form><a id="form" href="${ARTICLE}">Form</a></form>
            </div>`,
            { url },
        );
        t.after(() => dom.window.close());
        const { document } = dom.window;
        const before = document.getElementById('game').outerHTML;
        const dispose = installAssessorSourceLinks(dom.window, document);
        t.after(dispose);
        assert.equal(installAssessorSourceLinks(dom.window, document), dispose);
        const game = document.getElementById('game');
        assert.equal(
            game.href,
            `${ARTICLE}?uselang=en&wpvg-assessor=1#History`,
        );
        assert.equal(game.target, '_blank');
        assert.equal(game.rel, 'noopener');
        assert.equal(game.textContent, 'Game');
        assert.notEqual(game.outerHTML, before);
        assert.match(document.getElementById('talk').href, /wpvg-assessor=1$/u);
        for (const id of [
            'navigation',
            'outside',
            'old',
            'new',
            'download',
            'navbox',
        ]) {
            assert.equal(
                document.getElementById(id).href.includes('wpvg-assessor'),
                false,
                id,
            );
        }
        assert.equal(
            document.getElementById('form').href.includes('wpvg-assessor'),
            !isWiki,
        );

        game.setAttribute('href', `${ARTICLE}?uselang=ja`);
        await flush();
        assert.equal(game.href, `${ARTICLE}?uselang=ja&wpvg-assessor=1`);
        const dynamic = document.createElement('a');
        dynamic.href = ARTICLE;
        dynamic.textContent = 'New result';
        document
            .getElementById(isWiki ? 'mw-content-text' : 'main_results')
            .append(dynamic);
        await flush();
        assert.equal(dynamic.href, `${ARTICLE}?wpvg-assessor=1`);
    }
});

test('activation catches immediate results and cleanup releases listeners and observers', async (t) => {
    const dom = new JSDOM('<table><tbody><tr><td></td></tr></tbody></table>', {
        url: 'https://petscan.wmcloud.org/index.php',
    });
    t.after(() => dom.window.close());
    const { document } = dom.window;
    const dispose = installAssessorSourceLinks(dom.window, document);
    for (const name of ['pointerdown', 'click', 'auxclick', 'contextmenu']) {
        const anchor = document.createElement('a');
        anchor.href = ARTICLE;
        anchor.innerHTML = '<span>Result</span>';
        document.querySelector('td').append(anchor);
        const event = new dom.window.Event(name, {
            bubbles: true,
            cancelable: true,
        });
        anchor.firstChild.dispatchEvent(event);
        assert.equal(anchor.href, `${ARTICLE}?wpvg-assessor=1`);
        assert.equal(event.defaultPrevented, false);
    }
    dispose();
    const anchor = document.querySelector('a');
    anchor.href = ARTICLE;
    anchor.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    await flush();
    assert.equal(anchor.href, ARTICLE);
    assert.notEqual(installAssessorSourceLinks(dom.window, document), dispose);
});

test('page cache restores decoration and replacement documents remain observed', async (t) => {
    const dom = new JSDOM(
        '<table><tr><td><a href="' + ARTICLE + '">Result</a></td></tr></table>',
        {
            url: 'https://petscan.toolforge.org/',
        },
    );
    t.after(() => dom.window.close());
    const { document } = dom.window;
    const dispose = installAssessorSourceLinks(dom.window, document);
    t.after(dispose);
    await flush();
    dom.window.dispatchEvent(
        new dom.window.PageTransitionEvent('pagehide', { persisted: true }),
    );
    document.querySelector('a').href = ARTICLE;
    await flush();
    assert.equal(document.querySelector('a').href, ARTICLE);
    dom.window.dispatchEvent(
        new dom.window.PageTransitionEvent('pageshow', { persisted: true }),
    );
    assert.equal(
        document.querySelector('a').href,
        `${ARTICLE}?wpvg-assessor=1`,
    );
    const root = document.createElement('html');
    root.innerHTML = `<body><table><tr><td><a href="${ARTICLE}">Replaced result</a></td></tr></table></body>`;
    document.replaceChild(root, document.documentElement);
    await flush();
    assert.equal(
        document.querySelector('a').href,
        `${ARTICLE}?wpvg-assessor=1`,
    );
    dom.window.history.replaceState(null, '', '/other');
    document.querySelector('a').href = ARTICLE;
    await flush();
    assert.equal(document.querySelector('a').href, ARTICLE);
});

test('consumes one launch while preserving query encoding, fragments, and history state', (t) => {
    const dom = new JSDOM('', {
        url: `${ARTICLE}?foo=a%20b&wpvg%2Dassessor=1&bar=%2f#History`,
    });
    t.after(() => dom.window.close());
    const state = { host: 'retained' };
    dom.window.history.replaceState(state, '', dom.window.location.href);
    assert.equal(consumeAssessorLauncher(dom.window), true);
    assert.equal(
        dom.window.location.href,
        `${ARTICLE}?foo=a%20b&bar=%2f#History`,
    );
    assert.equal(dom.window.history.state, state);
    dom.window.history.replaceState(state, '', `${ARTICLE}?wpvg-assessor=1`);
    assert.equal(consumeAssessorLauncher(dom.window), false);
});

test('invalid markers never launch and history restrictions still permit one requested launch', (t) => {
    for (const url of [
        ARTICLE,
        `${ARTICLE}?wpvg-assessor=0`,
        `${ARTICLE}?wpvg-assessor=1&wpvg-assessor=1`,
        'https://en.wikipedia.org/wiki/Game?wpvg-assessor=1',
    ]) {
        const dom = new JSDOM('', { url });
        t.after(() => dom.window.close());
        assert.equal(consumeAssessorLauncher(dom.window), false);
        assert.equal(dom.window.location.href, url);
    }
    const dom = new JSDOM('', { url: `${ARTICLE}?wpvg-assessor=1` });
    t.after(() => dom.window.close());
    dom.window.history.replaceState = () => {
        throw new Error('restricted');
    };
    assert.equal(consumeAssessorLauncher(dom.window), true);
    assert.equal(consumeAssessorLauncher(dom.window), false);
});
