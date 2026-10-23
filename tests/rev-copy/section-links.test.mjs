/**
 * @file tests/rev-copy/section-links.test.mjs
 * Purpose: Exercise heading copy controls, delayed choices, anchors, and teardown offline.
 *
 * Table of contents:
 * 1. Imports and compiled modules
 * 2. createFixture
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { loadModule, settle } from './helpers.mjs';

const { createSectionLinks } = await loadModule(
    'src/rev-copy/features/section-links/controller.ts',
);
const { getMessages } = await loadModule('src/rev-copy/i18n/index.ts');
const wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

function createFixture(t, options = {}) {
    const dom = new JSDOM(
        `<!doctype html>${options.beforeContent ?? ''}<main id="mw-content-text">${
            options.html ??
            '<div class="mw-parser-output"><h2 id="History">History</h2><p>Article text.</p></div>'
        }</main>`,
        { pretendToBeVisual: true },
    );
    const document = dom.window.document;
    const copies = [];
    const controller = createSectionLinks({
        container: document.querySelector('#mw-content-text'),
        includePageHeading: options.includePageHeading,
        pageTitle: 'Intel_1103',
        site: options.site ?? { interwiki: 'w:en', language: 'en' },
        homeWiki: 'w:zh',
        messages: getMessages('en'),
        copy: options.copy ?? (async (text) => copies.push(text)),
        advanced: options.advanced,
    });
    t.after(() => {
        controller.dispose();
        dom.window.close();
    });
    return {
        dom,
        document,
        controller,
        copies,
        trigger: () =>
            document.querySelector('.kanade-rev-copy-section-trigger'),
        popup: () => document.querySelector('.kanade-rev-copy-section-popup'),
        key(target, key) {
            target.dispatchEvent(
                new dom.window.KeyboardEvent('keydown', {
                    key,
                    bubbles: true,
                    cancelable: true,
                }),
            );
        },
        enter() {
            document
                .querySelector('.kanade-rev-copy-section-control')
                .dispatchEvent(new dom.window.MouseEvent('mouseenter'));
        },
    };
}

test('section controls support modern and legacy anchors and preserve titles and navigation', (t) => {
    const fixture = createFixture(t, {
        html: '<h1 id="Page_title">Page title</h1><nav><h2 id="Navigation">Navigation</h2></nav><div class="toc"><h2 id="Contents">Contents</h2></div><h2 id="History">History</h2><h3><span class="mw-headline" id="Legacy_section">Legacy section</span><span class="mw-editsection">Edit</span></h3><h4>No stable anchor</h4>',
    });
    const triggers = fixture.document.querySelectorAll(
        '.kanade-rev-copy-section-trigger',
    );
    assert.equal(triggers.length, 2);
    assert.equal(triggers[0].getAttribute('href'), '#History');
    assert.equal(triggers[1].getAttribute('href'), '#Legacy_section');
    assert.equal(
        triggers[1].getAttribute('aria-label'),
        'Copy link to Legacy section',
    );
    assert.equal(
        fixture.document.querySelector('h1').textContent,
        'Page title',
    );
    assert.equal(
        fixture.document.querySelector('.mw-editsection').textContent,
        'Edit',
    );
    fixture.controller.refresh();
    assert.equal(
        fixture.document.querySelectorAll('.kanade-rev-copy-section-control')
            .length,
        2,
    );
});

test('only the actual skin title receives an opt-in lead control outside article content', (t) => {
    const fixture = createFixture(t, {
        includePageHeading: true,
        beforeContent:
            '<nav><h1 class="firstHeading">Navigation title</h1></nav><aside><h1>Unrelated title</h1></aside><h1 id="firstHeading"><span>Intel 1103</span><span class="mw-editsection">Edit</span></h1>',
        html: '<h1 class="mw-first-heading">Article h1</h1><h2 id="History">History</h2>',
    });
    const title = fixture.document.getElementById('firstHeading');
    const trigger = title.querySelector('.kanade-rev-copy-section-trigger');
    assert.equal(trigger.getAttribute('href'), '#top');
    assert.equal(trigger.getAttribute('aria-label'), 'Copy link to Intel 1103');
    assert.equal(
        title.querySelector('span:not([class])').textContent,
        'Intel 1103',
    );
    assert.equal(title.querySelector('.mw-editsection').textContent, 'Edit');
    assert.equal(
        fixture.document.querySelectorAll('h1 .kanade-rev-copy-section-trigger')
            .length,
        1,
    );
    assert.equal(
        fixture.document.querySelectorAll('.kanade-rev-copy-section-trigger')
            .length,
        2,
    );
    fixture.controller.refresh();
    assert.equal(
        title.querySelectorAll('.kanade-rev-copy-section-control').length,
        1,
    );
    fixture.controller.dispose();
    assert.equal(title.textContent, 'Intel 1103Edit');
    assert.equal(title.className, '');

    const optOut = createFixture(t, {
        beforeContent: '<h1 id="firstHeading">Intel 1103</h1>',
    });
    assert.equal(
        optOut.document.querySelector(
            '#firstHeading .kanade-rev-copy-section-control',
        ),
        null,
    );
});

test('lead controls copy #top with the displayed revision and open advanced for top', async (t) => {
    const opened = [];
    const fixture = createFixture(t, {
        includePageHeading: true,
        beforeContent: '<h1 id="firstHeading">Intel 1103</h1>',
        advanced: (id) => {
            opened.push(id);
            assert.equal(fixture.popup(), null);
            assert.equal(fixture.document.activeElement, fixture.trigger());
        },
    });
    fixture.trigger().click();
    await settle();
    assert.deepEqual(fixture.copies, ['[[:w:en:Intel 1103#top]]']);
    fixture.key(fixture.trigger(), 'ArrowDown');
    assert.deepEqual(
        [...fixture.popup().querySelectorAll('a')].map(
            (action) => action.textContent,
        ),
        ['Copy link', 'Advanced copy'],
    );
    fixture.controller.setRevision({
        revisionId: 314,
        timestamp: '2026-09-05T12:00:26Z',
    });
    let actions = fixture.popup().querySelectorAll('a');
    assert.deepEqual(
        [...actions].map((action) => action.textContent),
        ['Copy link', 'Copy permalink', 'Copy both', 'Advanced copy'],
    );
    actions[1].click();
    await settle();
    assert.match(
        fixture.copies[1],
        /^\[\[:w:en:Special:PermaLink\/314#top\|September 5, 2026(?: at)? 12:00:26\]\]$/u,
    );
    fixture.key(fixture.trigger(), 'ArrowDown');
    fixture.popup().querySelectorAll('a')[2].click();
    await settle();
    assert.equal(
        fixture.copies[2],
        `${fixture.copies[0]} (${fixture.copies[1]})`,
    );
    fixture.key(fixture.trigger(), 'ArrowDown');
    actions = fixture.popup().querySelectorAll('a');
    fixture.key(actions[3], ' ');
    await settle();
    assert.deepEqual(opened, ['top']);
});

test('refresh follows replaced title nodes and labels while releasing stale title actions', async (t) => {
    const opened = [];
    const fixture = createFixture(t, {
        includePageHeading: true,
        beforeContent: '<h1 id="firstHeading">Original title</h1>',
        advanced: (id) => opened.push(id),
    });
    const previous = fixture.document.getElementById('firstHeading');
    fixture.key(fixture.trigger(), 'ArrowDown');
    const stale = fixture.popup().querySelector('a:last-child');
    const replacement = fixture.document.createElement('h1');
    replacement.className = 'mw-first-heading';
    replacement.textContent = 'Replacement title';
    previous.replaceWith(replacement);
    stale.click();
    fixture.controller.refresh();
    assert.deepEqual(opened, []);
    assert.equal(fixture.popup(), null);
    assert.equal(
        previous.querySelector('.kanade-rev-copy-section-control'),
        null,
    );
    assert.equal(previous.className, '');
    assert.equal(fixture.trigger().getAttribute('href'), '#top');
    assert.equal(
        fixture.trigger().getAttribute('aria-label'),
        'Copy link to Replacement title',
    );
    replacement.lastChild.textContent = 'Updated title';
    fixture.controller.refresh();
    assert.equal(
        fixture.trigger().getAttribute('aria-label'),
        'Copy link to Updated title',
    );
    fixture.key(fixture.trigger(), 'ArrowDown');
    fixture.popup().querySelector('a:last-child').click();
    await settle();
    assert.deepEqual(opened, ['top']);
    fixture.controller.dispose();
    assert.equal(replacement.className, 'mw-first-heading');
    assert.equal(replacement.textContent, 'Updated title');
});

test('generated category sections use their stable parent anchors outside parser output', async (t) => {
    const fixture = createFixture(t, {
        site: { interwiki: 'commons', language: 'en' },
        html: '<div class="mw-parser-output"><h2 id="Description">Description</h2></div><div id="mw-subcategories"><h2>Subcategories</h2><h3>A</h3></div><div id="mw-pages"><h2>Pages in category</h2></div><div id="mw-category-media"><h2>Media in category</h2></div>',
    });
    const triggers = fixture.document.querySelectorAll(
        '.kanade-rev-copy-section-trigger',
    );
    assert.deepEqual(
        [...triggers].map((trigger) => trigger.getAttribute('href')),
        [
            '#Description',
            '#mw-subcategories',
            '#mw-pages',
            '#mw-category-media',
        ],
    );
    triggers[3].click();
    await settle();
    assert.deepEqual(fixture.copies, ['[[:c:Intel 1103#mw-category-media]]']);
});

test('a direct section click copies immediately and cancels delayed popup opening', async (t) => {
    const fixture = createFixture(t);
    fixture.enter();
    assert.equal(fixture.popup(), null);
    fixture.trigger().click();
    assert.deepEqual(fixture.copies, ['[[:w:en:Intel 1103#History]]']);
    await wait(650);
    assert.equal(fixture.popup(), null);
});

test('delayed hover shows the three anchored outputs using Japanese UTC seconds', async (t) => {
    const fixture = createFixture(t, {
        site: { interwiki: 'w:ja', language: 'ja' },
    });
    fixture.controller.setRevision({
        revisionId: 314,
        timestamp: '2026-09-05T12:00:26Z',
    });
    fixture.enter();
    assert.equal(fixture.popup(), null);
    await wait(650);
    const popup = fixture.popup();
    assert.ok(popup);
    const choices = popup.querySelectorAll('a');
    assert.deepEqual(
        [...choices].map((choice) => choice.textContent),
        ['Copy link', 'Copy permalink', 'Copy both'],
    );
    fixture.document
        .querySelector('.kanade-rev-copy-section-control')
        .dispatchEvent(
            new fixture.dom.window.MouseEvent('mouseleave', {
                relatedTarget: choices[2],
            }),
        );
    await wait(170);
    assert.equal(fixture.popup(), popup);
    choices[2].click();
    await settle();
    assert.deepEqual(fixture.copies, [
        '[[:w:ja:Intel 1103#History]] ([[:w:ja:Special:PermaLink/314#History|2026年9月5日 12:00:26]])',
    ]);
    assert.equal(fixture.popup(), null);
    assert.equal(fixture.document.activeElement, fixture.trigger());
});

test('comparison choices retain the old and new revision IDs and exact section anchor', async (t) => {
    const fixture = createFixture(t);
    fixture.controller.setRevision({
        revisionId: 314,
        diffOldId: 271,
        timestamp: '2026-09-05T12:00:26Z',
    });
    fixture.key(fixture.trigger(), 'ArrowDown');
    const choices = fixture.popup().querySelectorAll('a');
    assert.equal(fixture.document.activeElement, choices[0]);
    choices[1].click();
    await settle();
    assert.match(
        fixture.copies[0],
        /^\[\[:w:en:Special:Diff\/271\/314#History\|September 5, 2026(?: at)? 12:00:26\]\]$/u,
    );
});

test('leaving the control dismisses its popup after a short grace period', async (t) => {
    const fixture = createFixture(t);
    fixture.key(fixture.trigger(), 'ArrowDown');
    fixture.document
        .querySelector('.kanade-rev-copy-section-control')
        .dispatchEvent(
            new fixture.dom.window.MouseEvent('mouseleave', {
                relatedTarget: fixture.document.body,
            }),
        );
    assert.ok(fixture.popup());
    await wait(170);
    assert.equal(fixture.popup(), null);
    assert.equal(fixture.trigger().getAttribute('aria-expanded'), 'false');
});

test('page-only choices support keyboard dismissal and Space copying without reopening', async (t) => {
    const fixture = createFixture(t, {
        site: { interwiki: 'w:zh', language: 'zh' },
    });
    fixture.trigger().focus();
    fixture.key(fixture.trigger(), 'ArrowDown');
    assert.equal(fixture.popup().querySelectorAll('a').length, 1);
    fixture.key(fixture.popup().querySelector('a'), 'Escape');
    assert.equal(fixture.popup(), null);
    assert.equal(fixture.document.activeElement, fixture.trigger());
    fixture.key(fixture.trigger(), ' ');
    await settle();
    assert.deepEqual(fixture.copies, ['[[:Intel 1103#History]]']);
    await wait(650);
    assert.equal(fixture.popup(), null);
});

test('refresh releases removed heading controls and disposal cancels pending hover work', async (t) => {
    const fixture = createFixture(t);
    fixture.key(fixture.trigger(), 'ArrowDown');
    const staleAction = fixture.popup().querySelector('a');
    fixture.document.querySelector('h2').remove();
    fixture.controller.refresh();
    assert.equal(fixture.popup(), null);
    staleAction.click();
    assert.deepEqual(fixture.copies, []);
    const heading = fixture.document.createElement('h3');
    heading.id = 'Replacement';
    heading.textContent = 'Replacement';
    fixture.document.querySelector('.mw-parser-output').append(heading);
    fixture.controller.refresh();
    fixture.enter();
    fixture.controller.dispose();
    await wait(650);
    assert.equal(fixture.popup(), null);
    assert.equal(
        fixture.document.querySelector('.kanade-rev-copy-section-control'),
        null,
    );
    assert.equal(
        heading.classList.contains('kanade-rev-copy-section-heading'),
        false,
    );
    fixture.controller.refresh();
    assert.equal(
        fixture.document.querySelector('.kanade-rev-copy-section-control'),
        null,
    );
});

test('only one popup is active and duplicate clipboard activation waits for its result', async (t) => {
    let release;
    const copied = [];
    const fixture = createFixture(t, {
        html: '<h2 id="History">History</h2><h3 id="Design">Design</h3>',
        copy: (text) => {
            copied.push(text);
            return new Promise((resolve) => {
                release = resolve;
            });
        },
    });
    const triggers = fixture.document.querySelectorAll(
        '.kanade-rev-copy-section-trigger',
    );
    fixture.key(triggers[0], 'ArrowDown');
    fixture.key(triggers[1], 'ArrowDown');
    assert.equal(
        fixture.document.querySelectorAll('.kanade-rev-copy-section-popup')
            .length,
        1,
    );
    assert.equal(triggers[0].getAttribute('aria-expanded'), 'false');
    triggers[1].click();
    triggers[1].click();
    assert.deepEqual(copied, ['[[:w:en:Intel 1103#Design]]']);
    assert.equal(triggers[1].getAttribute('aria-disabled'), 'true');
    release();
    await settle();
    assert.equal(triggers[1].hasAttribute('aria-disabled'), false);
});

test('a rejected clipboard write restores the section control for another attempt', async (t) => {
    let attempts = 0;
    const fixture = createFixture(t, {
        copy: async () => {
            attempts += 1;
            throw new Error('Clipboard permission denied');
        },
    });
    fixture.trigger().click();
    await settle();
    assert.equal(fixture.trigger().hasAttribute('aria-disabled'), false);
    fixture.trigger().click();
    await settle();
    assert.equal(attempts, 2);
});

test('advanced is the final popup action and restores heading focus before loading once', async (t) => {
    const opened = [];
    let release;
    const fixture = createFixture(t, {
        html: '<h2 id="ライブ・パフォーマンス">Live</h2><h3 id="Other">Other</h3>',
        advanced: (sectionId) => {
            opened.push(sectionId);
            assert.equal(fixture.popup(), null);
            assert.equal(fixture.document.activeElement, fixture.trigger());
            return new Promise((resolve) => {
                release = resolve;
            });
        },
    });
    fixture.key(fixture.trigger(), 'ArrowDown');
    let actions = fixture.popup().querySelectorAll('a');
    assert.deepEqual(
        [...actions].map((action) => action.textContent),
        ['Copy link', 'Advanced copy'],
    );
    assert.equal(actions[1].getAttribute('aria-haspopup'), 'dialog');
    fixture.key(actions[1], 'Enter');
    actions[1].click();
    fixture.key(actions[1], ' ');
    fixture.key(
        fixture.document.querySelectorAll(
            '.kanade-rev-copy-section-trigger',
        )[1],
        'ArrowDown',
    );
    assert.equal(fixture.popup(), null);
    assert.deepEqual(opened, ['ライブ・パフォーマンス']);
    assert.deepEqual(fixture.copies, []);
    assert.equal(fixture.trigger().getAttribute('aria-disabled'), 'true');
    release();
    await settle();
    assert.equal(fixture.trigger().hasAttribute('aria-disabled'), false);
    fixture.controller.setRevision({
        revisionId: 314,
        timestamp: '2026-09-05T12:00:26Z',
    });
    fixture.key(fixture.trigger(), 'ArrowDown');
    actions = fixture.popup().querySelectorAll('a');
    assert.deepEqual(
        [...actions].map((action) => action.textContent),
        ['Copy link', 'Copy permalink', 'Copy both', 'Advanced copy'],
    );
    fixture.key(actions[3], ' ');
    assert.deepEqual(opened, [
        'ライブ・パフォーマンス',
        'ライブ・パフォーマンス',
    ]);
    release();
    await settle();
});

test('stale advanced actions cannot launch after heading removal or controller disposal', async (t) => {
    const opened = [];
    const fixture = createFixture(t, {
        advanced: (sectionId) => {
            opened.push(sectionId);
        },
    });
    fixture.key(fixture.trigger(), 'ArrowDown');
    const removedAction = fixture.popup().querySelector('a:last-child');
    fixture.document.querySelector('h2').remove();
    fixture.controller.refresh();
    removedAction.click();
    fixture.key(removedAction, 'Enter');
    const heading = fixture.document.createElement('h2');
    heading.id = 'Replacement';
    fixture.document.querySelector('.mw-parser-output').append(heading);
    fixture.controller.refresh();
    fixture.key(fixture.trigger(), 'ArrowDown');
    const disposedAction = fixture.popup().querySelector('a:last-child');
    fixture.controller.dispose();
    disposedAction.click();
    await settle();
    assert.deepEqual(opened, []);
});

test('advanced failures release the section trigger for another attempt', async (t) => {
    let attempts = 0;
    const fixture = createFixture(t, {
        advanced: async () => {
            attempts++;
            throw new Error('Load failed');
        },
    });
    for (let attempt = 0; attempt < 2; attempt++) {
        fixture.key(fixture.trigger(), 'ArrowDown');
        fixture.popup().querySelector('a:last-child').click();
        await settle();
        assert.equal(fixture.trigger().hasAttribute('aria-disabled'), false);
    }
    assert.equal(attempts, 2);
});
