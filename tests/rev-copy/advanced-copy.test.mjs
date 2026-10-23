/**
 * @file tests/rev-copy/advanced-copy.test.mjs
 * Purpose: Exercise advanced-copy lifecycle and accessibility using real Codex components offline.
 *
 * Contents: Compiled fixtures, host setup, and dialog interaction scenarios.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { buildCodexRuntime } from './codex-runtime.mjs';

const runtime = await buildCodexRuntime();
const { outputFiles } = await build({
    stdin: {
        contents: `export { createAdvancedCopy } from './src/rev-copy/features/advanced-copy/dialog';
            export { resolveAttributionPages } from './src/rev-copy/platform/mediawiki/attribution';
            export { generateAttribution } from './src/rev-copy/domain/attribution';
            export { getMessages } from './src/rev-copy/i18n';
            export { loadCodex } from './src/rev-copy/platform/mediawiki/codex';
            export { notifyCopySuccess } from './src/rev-copy/platform/mediawiki/notification';`,
        resolveDir: process.cwd(),
    },
    bundle: true,
    format: 'iife',
    globalName: 'RevCopyAdvancedTest',
    loader: { '.css': 'text' },
    write: false,
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}

function fixture(t, options = {}) {
    const dom = new JSDOM(
        '<!doctype html><button id="opener">advanced</button>',
        {
            url: 'https://zh.wikipedia.org/wiki/Example',
            pretendToBeVisual: true,
            runScripts: 'outside-only',
        },
    );
    const { window } = dom;
    const { document } = window;
    window.HTMLElement.prototype.scrollIntoView = () => {};
    const modules = [];
    const notifications = [];
    const copies = [];
    const generations = [];
    window.eval(runtime);
    window.mw = {
        loader: {
            using: async (names) => {
                modules.push(names);
                await options.loading;
                return (name) => window.revCopyTestModules[name];
            },
        },
        notify: (message, settings) =>
            notifications.push({ message, settings }),
    };
    window.eval(outputFiles[0].text);
    const messages = window.RevCopyAdvancedTest.getMessages(
        options.language ?? 'en',
    );
    const controller = window.RevCopyAdvancedTest.createAdvancedCopy({
        loadRuntime: window.RevCopyAdvancedTest.loadCodex,
        notifyCopySuccess: window.RevCopyAdvancedTest.notifyCopySuccess,
        messages,
        currentPageTitle: options.currentPageTitle ?? 'Example_page',
        currentSitePrefix: options.currentSitePrefix ?? 'w:zh',
        generate: async (...args) => {
            generations.push(args);
            const result = options.generate
                ? await options.generate(...args)
                : '[[:w:ja:Example]] (<img src=x onerror=alert(1)>)';
            return typeof result === 'string'
                ? {
                      wikitext: result,
                      fromTitle:
                          options.currentSitePrefix === 'w:en'
                              ? 'Example page'
                              : 'English example',
                      toTitle:
                          options.currentSitePrefix === 'w:en'
                              ? '中文例子'
                              : 'Example page',
                  }
                : result;
        },
        copy: async (text) => {
            copies.push(text);
            return options.copy?.(text);
        },
    });
    document.querySelector('#opener').focus();
    t.after(() => {
        controller.dispose();
        window.close();
    });
    const query = (selector) => document.querySelector(selector);
    return {
        window,
        document,
        controller,
        modules,
        notifications,
        copies,
        generations,
        messages,
        query,
        primary: () => query('.cdx-dialog__footer__primary-action'),
        output: () => query('.kanade-rev-copy-advanced-output textarea'),
        async open(sectionId) {
            await controller.open(sectionId);
            await settle();
        },
        async input(kind, value) {
            const input = query(`input[name$="-${kind}"]`);
            input.value = value;
            input.dispatchEvent(new window.Event('input', { bubbles: true }));
            await settle();
        },
        async enter(kind = 'from', settings = {}) {
            query(`input[name$="-${kind}"]`).dispatchEvent(
                new window.KeyboardEvent('keydown', {
                    key: 'Enter',
                    bubbles: true,
                    cancelable: true,
                    ...settings,
                }),
            );
            await settle();
        },
        async blur(kind = 'from') {
            query(`input[name$="-${kind}"]`).dispatchEvent(
                new window.FocusEvent('blur'),
            );
            await settle();
        },
        async paste(kind, value, blur = false) {
            const input = query(`input[name$="-${kind}"]`);
            input.dispatchEvent(new window.Event('paste', { bubbles: true }));
            input.value = value;
            input.dispatchEvent(new window.Event('input', { bubbles: true }));
            if (blur) input.dispatchEvent(new window.FocusEvent('blur'));
            await settle();
        },
        async key(key) {
            query('.cdx-dialog').dispatchEvent(
                new window.KeyboardEvent('keyup', { key, bubbles: true }),
            );
            await settle();
        },
    };
}

test('Codex loads lazily once and provides labeled fields, focus containment, and reopen', async (t) => {
    const f = fixture(t, { language: 'zh-Hant' });
    assert.equal(f.modules.length, 0);
    await Promise.all([f.controller.open(), f.controller.open()]);
    await settle();
    assert.deepEqual([...f.modules[0]], ['vue', '@wikimedia/codex']);
    assert.equal(f.modules.length, 1);
    const dialog = f.query('[role="dialog"]');
    assert.ok(dialog);
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    assert.match(dialog.textContent, /譯入頁編輯摘要/u);
    assert.match(dialog.textContent, /譯出頁討論頁告知/u);
    assert.equal(
        f.query('input[name$="-from"]').placeholder,
        'English example',
    );
    assert.ok(dialog.contains(f.document.activeElement));
    assert.equal(f.query('#opener').hasAttribute('inert'), true);
    const traps = f
        .query('.cdx-dialog-backdrop')
        .querySelectorAll('[tabindex="0"]');
    assert.ok(traps.length >= 2);
    traps[traps.length - 1].focus();
    assert.ok(dialog.contains(f.document.activeElement));
    await f.key('Escape');
    assert.equal(f.query('#opener').hasAttribute('inert'), false);
    assert.equal(f.document.activeElement, f.query('#opener'));
    await f.open();
    assert.equal(f.modules.length, 1);
    assert.equal(f.document.querySelectorAll('[role="dialog"]').length, 1);
    assert.ok(f.query('[role="dialog"]').contains(f.document.activeElement));
});

test('page groups show only their group labels and two textboxes with accessible names', async (t) => {
    const f = fixture(t);
    await f.open();
    for (const [kind, label] of [
        ['from', 'From'],
        ['to', 'To'],
    ]) {
        const page = f.query(`input[name$="-${kind}"]`);
        const prefix = f.query(`input[name$="-${kind}-prefix"]`);
        const group = page.closest('fieldset');
        assert.equal(group.querySelectorAll('input').length, 2);
        assert.equal(group.textContent.trim(), label);
        assert.equal(
            prefix.getAttribute('aria-label'),
            `${label}: Wiki prefix`,
        );
        assert.equal(
            page.getAttribute('aria-label'),
            `${label}: Page name or URL`,
        );
        assert.equal(page.hasAttribute('aria-describedby'), false);
    }
    assert.equal(
        f.document.querySelectorAll('.kanade-rev-copy-advanced-help').length,
        0,
    );
    assert.equal(f.query('[role="tooltip"]'), null);
    await f.key('Escape');
    assert.equal(f.query('#opener').hasAttribute('inert'), false);
});

test('English and Chinese prefixes are placeholders that resolve their own page titles independently of UI language', async (t) => {
    for (const currentSitePrefix of ['w:zh', 'w:en']) {
        for (const language of ['en', 'zh-Hans', 'zh-Hant']) {
            const f = fixture(t, { currentSitePrefix, language });
            await f.open();
            assert.equal(f.query('input[name$="-from-prefix"]').value, '');
            assert.equal(
                f.query('input[name$="-from-prefix"]').placeholder,
                'en',
            );
            assert.equal(f.query('input[name$="-to-prefix"]').value, '');
            assert.equal(
                f.query('input[name$="-to-prefix"]').placeholder,
                'zh',
            );
            assert.deepEqual(
                [...f.generations[0].slice(0, 2)],
                currentSitePrefix === 'w:en' ? ['', 'zh:'] : ['en:', ''],
            );
            assert.equal(f.query('input[name$="-from"]').value, '');
            assert.equal(f.query('input[name$="-to"]').value, '');
            assert.equal(
                f.query('input[name$="-from"]').placeholder,
                currentSitePrefix === 'w:en'
                    ? 'Example page'
                    : 'English example',
            );
            assert.equal(
                f.query('input[name$="-to"]').placeholder,
                currentSitePrefix === 'w:en' ? '中文例子' : 'Example page',
            );
            f.controller.dispose();
        }
    }
});

test('blank prefix defaults resolve distinct English and Chinese titles through the actual attribution adapter', async (t) => {
    const current = {
        pageTitle: '中文条目',
        revisionId: 321,
        site: { interwiki: 'w:zh', language: 'zh' },
        interfaceLanguage: 'en',
    };
    const englishTitle = 'English source article';
    const requests = [];
    const pageResponse = (title, revid, language) => ({
        query: {
            general: { lang: language },
            pages: [
                {
                    title,
                    revisions: [{ revid, timestamp: '2026-09-07T10:07:09Z' }],
                },
            ],
        },
    });
    const f = fixture(t, {
        currentPageTitle: current.pageTitle,
        currentSitePrefix: current.site.interwiki,
        async generate(fromInput, toInput, selection) {
            const { resolveAttributionPages, generateAttribution } =
                f.window.RevCopyAdvancedTest;
            const { from, to } = await resolveAttributionPages(
                fromInput,
                toInput,
                current,
                selection.notice,
            );
            return {
                wikitext: generateAttribution(from, to, {
                    ...selection,
                    interfaceLanguage: current.interfaceLanguage,
                }),
                fromTitle: from.pageTitle,
                toTitle: to.pageTitle,
            };
        },
    });
    f.window.mw.Api = class {
        async get(params) {
            requests.push(params.prop);
            assert.equal(params.revids, current.revisionId);
            if (params.prop === 'langlinks') {
                assert.equal(params.lllang, 'en');
                return {
                    query: {
                        pages: [
                            {
                                langlinks: [
                                    { lang: 'en', title: englishTitle },
                                ],
                            },
                        ],
                    },
                };
            }
            assert.equal(params.prop, 'revisions');
            return pageResponse(current.pageTitle, current.revisionId, 'zh');
        }
    };
    f.window.fetch = async (input) => {
        const url = new URL(input);
        requests.push(url.hostname);
        assert.equal(url.hostname, 'en.wikipedia.org');
        assert.equal(url.searchParams.get('titles'), englishTitle);
        assert.equal(url.searchParams.get('prop'), 'revisions');
        return {
            ok: true,
            json: async () => pageResponse(englishTitle, 654, 'en'),
        };
    };

    await f.open();
    for (const [kind, prefix, title] of [
        ['from', 'en', englishTitle],
        ['to', 'zh', current.pageTitle],
    ]) {
        assert.equal(f.query(`input[name$="-${kind}-prefix"]`).value, '');
        assert.equal(
            f.query(`input[name$="-${kind}-prefix"]`).placeholder,
            prefix,
        );
        assert.equal(f.query(`input[name$="-${kind}"]`).value, '');
        assert.equal(f.query(`input[name$="-${kind}"]`).placeholder, title);
    }
    assert.deepEqual(requests, ['revisions', 'langlinks', 'en.wikipedia.org']);
    assert.match(f.output().value, /English source article/u);
    assert.match(f.output().value, /Special:PermaLink\/654/u);
    assert.equal(f.primary().disabled, false);
});

test('copy mode uses the current wiki for both empty prefix fields and translation restores its defaults', async (t) => {
    for (const currentSitePrefix of [
        'w:zh',
        'w:en',
        'w:ja',
        'w:ru',
        'c',
        'wikt:ja',
    ]) {
        const f = fixture(t, { currentSitePrefix });
        const currentPrefix = currentSitePrefix.replace(/^w:/u, '');
        await f.open();
        f.query('.cdx-toggle-button-group button:last-child').click();
        await settle();
        for (const kind of ['from', 'to']) {
            const prefix = f.query(`input[name$="-${kind}-prefix"]`);
            assert.equal(prefix.value, '');
            assert.equal(prefix.placeholder, currentPrefix);
        }
        assert.deepEqual([...f.generations.at(-1).slice(0, 2)], ['', '']);
        await f.input('from', 'Source');
        await f.input('to', 'Target');
        await f.enter('to');
        assert.deepEqual(
            [...f.generations.at(-1).slice(0, 2)],
            [`${currentPrefix}:Source`, `${currentPrefix}:Target`],
        );
        f.query('.cdx-toggle-button-group button:first-child').click();
        await settle();
        const translationSource = currentPrefix === 'zh' ? 'en' : currentPrefix;
        assert.equal(
            f.query('input[name$="-from-prefix"]').placeholder,
            translationSource,
        );
        assert.equal(f.query('input[name$="-to-prefix"]').placeholder, 'zh');
        assert.equal(f.query('input[name$="-from"]').value, 'Source');
        assert.equal(f.query('input[name$="-to"]').value, 'Target');
        assert.deepEqual(
            [...f.generations.at(-1).slice(0, 2)],
            [`${translationSource}:Source`, 'zh:Target'],
        );
        f.controller.dispose();
    }
});

test('mode changes retain explicit prefixes, URLs, and edits when reopening the same context', async (t) => {
    const f = fixture(t, { currentSitePrefix: 'w:en' });
    const target =
        'https://ru.wikipedia.org/w/index.php?title=Target&oldid=123';
    await f.open();
    await f.input('from-prefix', 'ja');
    await f.input('from', 'Source#History');
    await f.input('to-prefix', 'ru');
    await f.input('to', target);
    f.query('.cdx-toggle-button-group button:last-child').click();
    await settle();
    assert.deepEqual(
        [...f.generations.at(-1).slice(0, 2)],
        ['ja:Source#History', target],
    );
    await f.key('Escape');
    await f.open();
    assert.equal(f.generations.at(-1)[2].mode, 'copy');
    assert.equal(f.query('input[name$="-from-prefix"]').placeholder, 'en');
    assert.equal(f.query('input[name$="-to-prefix"]').placeholder, 'en');
    f.query('.cdx-toggle-button-group button:first-child').click();
    await settle();
    assert.equal(f.query('input[name$="-from-prefix"]').value, 'ja');
    assert.equal(f.query('input[name$="-to-prefix"]').value, 'ru');
    assert.equal(f.query('input[name$="-from"]').value, 'Source#History');
    assert.equal(f.query('input[name$="-to"]').value, target);
    assert.deepEqual(
        [...f.generations.at(-1).slice(0, 2)],
        ['ja:Source#History', target],
    );
});

test('mode-specific defaults clear resolved titles and discard the previous mode’s pending result', async (t) => {
    const firstTranslation = deferred();
    const copy = deferred();
    const secondTranslation = deferred();
    const results = [firstTranslation, copy, secondTranslation];
    const currentPageTitle = '当前中文页面';
    const f = fixture(t, {
        currentPageTitle,
        generate: () => results.shift().promise,
    });
    await f.open();
    f.query('.cdx-toggle-button-group button:last-child').click();
    await settle();
    assert.deepEqual([...f.generations.at(-1).slice(0, 2)], ['', '']);
    for (const kind of ['from', 'to']) {
        assert.equal(
            f.query(`input[name$="-${kind}"]`).placeholder,
            currentPageTitle,
        );
    }
    firstTranslation.resolve({
        wikitext: 'Stale translation',
        fromTitle: 'Old English title',
        toTitle: 'Old Chinese title',
    });
    await settle();
    assert.equal(f.output().value, '');
    assert.equal(f.query('input[name$="-from"]').placeholder, currentPageTitle);
    copy.resolve({
        wikitext: 'Current copy',
        fromTitle: currentPageTitle,
        toTitle: currentPageTitle,
    });
    await settle();
    assert.equal(f.output().value, 'Current copy');
    f.query('.cdx-toggle-button-group button:first-child').click();
    await settle();
    assert.equal(f.output().value, '');
    assert.equal(
        f.query('input[name$="-from"]').placeholder,
        f.messages.advancedPageName,
    );
    assert.equal(f.query('input[name$="-to"]').placeholder, currentPageTitle);
    secondTranslation.resolve({
        wikitext: 'New translation',
        fromTitle: 'New English title',
        toTitle: currentPageTitle,
    });
    await settle();
    assert.equal(
        f.query('input[name$="-from"]').placeholder,
        'New English title',
    );
    assert.equal(f.output().value, 'New translation');
});

test('resolved page titles update language placeholders and failures clear outdated examples without changing drafts', async (t) => {
    const f = fixture(t, {
        generate: (from) => {
            if (from === 'ru:') throw new Error('No language link');
            return {
                wikitext: 'Resolved attribution',
                fromTitle: from === 'ja:' ? '日本語のページ' : 'English page',
                toTitle: '中文页面',
            };
        },
    });
    await f.open();
    const source = f.query('input[name$="-from"]');
    const target = f.query('input[name$="-to"]');
    assert.equal(source.placeholder, 'English page');
    assert.equal(target.placeholder, '中文页面');
    await f.input('from-prefix', 'ja');
    assert.equal(source.placeholder, f.messages.advancedPageName);
    await f.enter('from-prefix');
    assert.equal(source.placeholder, '日本語のページ');
    assert.equal(source.value, '');
    assert.equal(target.value, '');
    await f.input('from-prefix', 'ru');
    await f.enter('from-prefix');
    assert.equal(source.placeholder, f.messages.advancedPageName);
    assert.equal(f.output().value, '');
    assert.match(f.query('.cdx-dialog').textContent, /Could not resolve/u);
});

test('blank and overridden prefixes keep both page placeholders in their effective language', async (t) => {
    const initial = deferred();
    const f = fixture(t, {
        currentPageTitle: '当前中文页面',
        generate: (from, to) => {
            if (from === 'en:' && !to) return initial.promise;
            return {
                wikitext: 'Resolved attribution',
                fromTitle: from === 'ja:' ? '日本語のページ' : 'English page',
                toTitle: to === 'ru:' ? 'Русская страница' : '当前中文页面',
            };
        },
    });
    await f.open();
    const source = f.query('input[name$="-from"]');
    const target = f.query('input[name$="-to"]');
    assert.equal(source.placeholder, f.messages.advancedPageName);
    assert.equal(target.placeholder, '当前中文页面');
    initial.resolve({
        wikitext: 'Initial attribution',
        fromTitle: 'English page',
        toTitle: '当前中文页面',
    });
    await settle();
    assert.equal(source.placeholder, 'English page');
    await f.input('from-prefix', 'ja');
    await f.input('to-prefix', 'ru');
    assert.equal(source.placeholder, f.messages.advancedPageName);
    assert.equal(target.placeholder, f.messages.advancedPageName);
    await f.enter('to-prefix');
    assert.deepEqual([...f.generations.at(-1).slice(0, 2)], ['ja:', 'ru:']);
    assert.equal(source.placeholder, '日本語のページ');
    assert.equal(target.placeholder, 'Русская страница');
    assert.equal(source.value, '');
    assert.equal(target.value, '');
    await f.input('from-prefix', '');
    await f.input('to-prefix', '');
    assert.equal(source.placeholder, f.messages.advancedPageName);
    assert.equal(target.placeholder, '当前中文页面');
    await f.enter('from-prefix');
    assert.deepEqual([...f.generations.at(-1).slice(0, 2)], ['en:', '']);
    assert.equal(source.placeholder, 'English page');
    assert.equal(target.placeholder, '当前中文页面');
});

test('empty prefix placeholders also apply to typed titles while complete URLs retain their own site', async (t) => {
    const f = fixture(t, { currentSitePrefix: 'w:ja' });
    await f.open();
    await f.input('from', '出典');
    await f.input('to', '目標');
    await f.enter('to');
    assert.deepEqual(
        [...f.generations.at(-1).slice(0, 2)],
        ['ja:出典', 'zh:目標'],
    );
    const url = 'https://ru.wikipedia.org/w/index.php?title=Источник&oldid=123';
    await f.input('from', url);
    await f.enter('from');
    assert.equal(f.generations.at(-1)[0], url);
});

test('translation sections keep their source and copy mode keeps both endpoints on the current wiki', async (t) => {
    for (const currentSitePrefix of ['w:en', 'w:ja', 'w:ru', 'c']) {
        const f = fixture(t, { currentSitePrefix });
        const expectedSource = currentSitePrefix.replace(/^w:/u, '');
        await f.open();
        assert.equal(f.query('input[name$="-from-prefix"]').value, '');
        assert.equal(
            f.query('input[name$="-from-prefix"]').placeholder,
            expectedSource,
        );
        assert.equal(f.query('input[name$="-to-prefix"]').value, '');
        assert.equal(f.query('input[name$="-to-prefix"]').placeholder, 'zh');
        assert.deepEqual([...f.generations.at(-1).slice(0, 2)], ['', 'zh:']);
        await f.key('Escape');
        await f.open('History');
        assert.equal(f.query('input[name$="-from-prefix"]').value, '');
        assert.equal(
            f.query('input[name$="-from-prefix"]').placeholder,
            expectedSource,
        );
        assert.equal(f.query('input[name$="-to-prefix"]').value, '');
        assert.equal(f.query('input[name$="-to-prefix"]').placeholder, 'zh');
        assert.deepEqual(
            [...f.generations.at(-1).slice(0, 2)],
            ['#History', 'zh:'],
        );
        f.query('.cdx-toggle-button-group button:last-child').click();
        await settle();
        assert.equal(
            f.query('input[name$="-from-prefix"]').placeholder,
            expectedSource,
        );
        assert.equal(
            f.query('input[name$="-to-prefix"]').placeholder,
            expectedSource,
        );
        assert.deepEqual(
            [...f.generations.at(-1).slice(0, 2)],
            ['#History', ''],
        );
        await f.key('Escape');
        await f.open('History');
        assert.equal(f.generations.at(-1)[2].mode, 'copy');
        assert.deepEqual(
            [...f.generations.at(-1).slice(0, 2)],
            ['#History', ''],
        );
        f.controller.dispose();
    }
});

test('opening generates into an always-visible readonly textarea with accessible indeterminate progress', async (t) => {
    const pending = deferred();
    const f = fixture(t, { generate: () => pending.promise });
    await f.open();
    assert.equal(f.generations.length, 1);
    assert.deepEqual([...f.generations[0].slice(0, 2)], ['en:', '']);
    const output = f.output();
    assert.equal(output.value, '');
    assert.equal(output.readOnly, true);
    assert.equal(output.labels[0].textContent.trim(), 'Wikitext');
    assert.equal(f.primary().disabled, true);
    assert.equal(
        f.primary().textContent.trim(),
        f.messages.advancedCopyWikitext,
    );
    const progress = f.query('.kanade-rev-copy-advanced-progress');
    assert.equal(
        progress.parentElement,
        output.closest('.kanade-rev-copy-advanced-output-control'),
    );
    assert.equal(progress.getAttribute('role'), 'progressbar');
    assert.equal(
        progress.getAttribute('aria-label'),
        f.messages.advancedGenerating,
    );
    assert.equal(progress.hasAttribute('aria-valuenow'), false);
    assert.equal(
        progress.querySelector('.cdx-progress-bar').getAttribute('aria-hidden'),
        'true',
    );
    const from = f.query('input[name$="-from"]');
    from.focus();
    pending.resolve('Initial text');
    await settle();
    assert.equal(f.output(), output);
    assert.equal(output.value, 'Initial text');
    assert.equal(f.primary().disabled, false);
    assert.equal(progress.hasAttribute('role'), false);
    assert.equal(progress.querySelector('.cdx-progress-bar'), null);
    assert.equal(f.document.activeElement, from);
    assert.deepEqual(f.copies, []);
});

test('paired wiki and page inputs regenerate together, retain focus, and invalidate stale results', async (t) => {
    const pending = deferred();
    const f = fixture(t, {
        generate: (from) =>
            from === 'ja:Talk:Source#History'
                ? pending.promise
                : 'Current output',
    });
    await f.open();
    const prefix = f.query('input[name$="-from-prefix"]');
    const page = f.query('input[name$="-from"]');
    assert.equal(prefix.placeholder, 'en');
    assert.equal(prefix.getAttribute('aria-label'), 'From: Wiki prefix');
    assert.equal(page.getAttribute('aria-label'), 'From: Page name or URL');
    assert.ok(prefix.closest('fieldset').contains(page));
    await f.input('from-prefix', 'ja');
    await f.input('from', 'Talk:Source#History');
    prefix.focus();
    await f.enter('from-prefix');
    assert.equal(f.generations.at(-1)[0], 'ja:Talk:Source#History');
    await f.input('from-prefix', 'w:en');
    pending.resolve({
        wikitext: 'Stale Japanese output',
        fromTitle: '古い日本語のタイトル',
        toTitle: 'Old target',
    });
    await settle();
    assert.equal(f.output().value, '');
    assert.equal(page.placeholder, f.messages.advancedPageName);
    await f.blur('from-prefix');
    assert.equal(f.generations.at(-1)[0], 'w:en:Talk:Source#History');
    assert.equal(f.document.activeElement, prefix);
    await f.paste('to-prefix', 'w:zh', true);
    await f.input('to', 'Target');
    await f.enter('to');
    assert.deepEqual(
        [...f.generations.at(-1).slice(0, 2)],
        ['w:en:Talk:Source#History', 'w:zh:Target'],
    );
    await f.key('Escape');
    await f.open();
    assert.equal(f.query('input[name$="-from-prefix"]').value, 'w:en');
    await f.key('Escape');
    await f.open('Development');
    assert.equal(f.query('input[name$="-from-prefix"]').value, '');
    assert.equal(f.query('input[name$="-from-prefix"]').placeholder, 'zh');
    assert.equal(f.query('input[name$="-to-prefix"]').value, '');
    assert.equal(f.query('input[name$="-to-prefix"]').placeholder, 'zh');
    assert.deepEqual(
        [...f.generations.at(-1).slice(0, 2)],
        ['#Development', ''],
    );
    assert.deepEqual(f.copies, []);
});

test('paste uses the updated value and repeated blur or Enter deduplicates pending and completed input', async (t) => {
    const pending = deferred();
    const f = fixture(t, {
        generate: (from) => (from === 'en:' ? 'Initial text' : pending.promise),
    });
    await f.open();
    const from = f.query('input[name$="-from"]');
    from.focus();
    await f.paste('from', 'FIRE BIRD', true);
    assert.equal(f.generations.length, 2);
    assert.equal(f.generations[1][0], 'en:FIRE BIRD');
    assert.equal(f.output().value, '');
    assert.equal(f.primary().disabled, true);
    await f.blur();
    await f.enter();
    assert.equal(f.generations.length, 2);
    pending.resolve('Pasted source text');
    await settle();
    await f.blur();
    await f.enter();
    assert.equal(f.generations.length, 2);
    assert.equal(f.output().value, 'Pasted source text');
    assert.equal(f.document.activeElement, from);
});

test('manual editing clears output immediately and waits for Enter or blur while IME confirmation is ignored', async (t) => {
    const f = fixture(t);
    await f.open();
    await f.input('from', 'Manual');
    assert.equal(f.output().value, '');
    assert.equal(f.generations.length, 1);
    await f.enter();
    assert.equal(f.generations.length, 2);
    assert.equal(f.generations.at(-1)[0], 'en:Manual');
    await f.input('to-prefix', 'w:zh');
    assert.equal(f.generations.length, 2);
    await f.blur('to');
    assert.equal(f.generations.length, 3);
    assert.equal(f.generations.at(-1)[1], '');
    const from = f.query('input[name$="-from"]');
    from.dispatchEvent(
        new f.window.CompositionEvent('compositionstart', { bubbles: true }),
    );
    from.value = '入力';
    from.dispatchEvent(
        new f.window.InputEvent('input', { bubbles: true, isComposing: true }),
    );
    await f.enter('from', { isComposing: true });
    f.query('form').dispatchEvent(
        new f.window.Event('submit', { bubbles: true, cancelable: true }),
    );
    await settle();
    assert.equal(f.output().value, '');
    assert.equal(f.generations.length, 3);
    from.dispatchEvent(
        new f.window.CompositionEvent('compositionend', { bubbles: true }),
    );
    await f.enter('from', { keyCode: 229 });
    assert.equal(f.generations.length, 3);
    await f.enter();
    assert.equal(f.generations.length, 4);
    assert.equal(f.generations.at(-1)[0], 'en:入力');
});

test('Enter and unchanged-field blur can retry a failed state without copying', async (t) => {
    let attempts = 0;
    const f = fixture(t, {
        generate: async () => {
            if (++attempts < 3) throw new Error('Offline');
            return 'Recovered text';
        },
    });
    await f.open();
    assert.equal(f.output().value, '');
    await f.enter();
    assert.equal(attempts, 2);
    await f.blur();
    assert.equal(attempts, 3);
    assert.equal(f.output().value, 'Recovered text');
    await f.blur();
    assert.equal(attempts, 3);
    assert.deepEqual(f.copies, []);
});

test('blur or paste during composition waits for the committed input value', async (t) => {
    const f = fixture(t);
    await f.open();
    const from = f.query('input[name$="-from"]');
    for (const [index, trigger] of ['blur', 'paste'].entries()) {
        from.dispatchEvent(
            new f.window.CompositionEvent('compositionstart', {
                bubbles: true,
            }),
        );
        from.value = `入力${index}`;
        from.dispatchEvent(
            new f.window.InputEvent('input', {
                bubbles: true,
                isComposing: true,
            }),
        );
        from.dispatchEvent(new f.window.Event(trigger, { bubbles: true }));
        await settle();
        assert.equal(f.generations.length, index + 1);
        assert.equal(f.output().value, '');
        from.dispatchEvent(
            new f.window.CompositionEvent('compositionend', { bubbles: true }),
        );
        await settle();
        assert.equal(f.generations.length, index + 2);
        assert.equal(f.generations.at(-1)[0], `en:入力${index}`);
        assert.ok(f.output().value);
    }
});

test('closing cancels a paste scheduled before value insertion and reopening generates only the current value', async (t) => {
    const f = fixture(t);
    await f.open();
    const from = f.query('input[name$="-from"]');
    from.dispatchEvent(new f.window.Event('paste', { bubbles: true }));
    from.value = 'Queued';
    from.dispatchEvent(new f.window.Event('input', { bubbles: true }));
    await f.key('Escape');
    assert.equal(f.generations.length, 1);
    await f.open();
    assert.equal(f.generations.length, 2);
    assert.equal(f.generations[1][0], 'en:Queued');
});

test('form choices generate safe selectable text, then copy only reports success after completion', async (t) => {
    const pendingCopy = deferred();
    const f = fixture(t, { copy: () => pendingCopy.promise });
    await f.open();
    await f.input('from-prefix', 'ja');
    await f.input('from', 'FIRE BIRD (Roseliaの曲)');
    f.query('.cdx-toggle-button-group button:last-child').click();
    await settle();
    assert.match(
        f.query('.kanade-rev-copy-advanced-form').textContent,
        /Partial copy/u,
    );
    f.document.querySelectorAll('input[type="radio"]')[2].click();
    f.document.querySelectorAll('input[type="checkbox"]')[0].click();
    await settle();
    f.document.querySelectorAll('input[type="checkbox"]')[1].click();
    await settle();
    const [from, to, settings] = f.generations.at(-1);
    assert.equal(from, 'ja:FIRE BIRD (Roseliaの曲)');
    assert.equal(to, '');
    assert.deepEqual(
        { ...settings },
        {
            mode: 'copy',
            notice: true,
            sourceSummary: false,
            partial: true,
            modified: true,
        },
    );
    assert.equal(f.output().readOnly, true);
    assert.equal(f.query('img'), null);
    assert.match(f.output().value, /<img src=x/u);
    const generated = f.output().value;
    f.primary().click();
    f.primary().click();
    await settle();
    assert.deepEqual(f.copies, [generated]);
    assert.equal(f.primary().disabled, true);
    assert.doesNotMatch(f.query('.cdx-dialog').textContent, /Copied wikitext/u);
    assert.equal(f.query('#kanade-rev-copy-copy-notification'), null);
    pendingCopy.resolve();
    await settle();
    assert.match(f.query('.cdx-dialog').textContent, /Copied wikitext/u);
    assert.match(
        f.query('#kanade-rev-copy-copy-notification').textContent,
        /Copied wikitext/u,
    );
    assert.equal(f.primary().disabled, false);
});

test('copy and paste has destination, cut-source, and notice purposes and resets cut mode for translation', async (t) => {
    const f = fixture(t, { language: 'zh-Hant' });
    await f.open();
    assert.equal(f.document.querySelectorAll('input[type="radio"]').length, 2);
    const copyMode = f.query('.cdx-toggle-button-group button:last-child');
    assert.equal(copyMode.textContent.trim(), '複製貼上');
    copyMode.click();
    await settle();
    let radios = f.document.querySelectorAll('input[type="radio"]');
    assert.equal(radios.length, 3);
    const labels = [...f.document.querySelectorAll('.cdx-radio__label')].map(
        (label) => label.textContent.trim(),
    );
    assert.deepEqual(labels, [
        '目標頁編輯摘要',
        '剪下頁編輯摘要',
        '來源頁討論頁告知',
    ]);
    radios[1].click();
    await settle();
    assert.equal(f.generations.at(-1)[2].sourceSummary, true);
    assert.equal(f.generations.at(-1)[2].notice, false);
    assert.match(
        f.query('.kanade-rev-copy-advanced-output').textContent,
        /剪下內容的來源頁編輯摘要/u,
    );
    radios[2].click();
    await settle();
    assert.equal(f.generations.at(-1)[2].sourceSummary, false);
    assert.equal(f.generations.at(-1)[2].notice, true);
    radios[1].click();
    await settle();
    f.query('.cdx-toggle-button-group button:first-child').click();
    await settle();
    radios = f.document.querySelectorAll('input[type="radio"]');
    assert.equal(radios.length, 2);
    assert.equal(radios[0].checked, true);
    assert.equal(f.generations.at(-1)[2].mode, 'translate');
    assert.equal(f.generations.at(-1)[2].sourceSummary, false);
    assert.equal(f.generations.at(-1)[2].notice, false);
});

test('edits invalidate generated text and in-flight results', async (t) => {
    const first = deferred();
    const second = deferred();
    const third = deferred();
    let count = 0;
    const f = fixture(t, {
        generate: () => [first, second, third][count++].promise,
    });
    await f.open();
    assert.equal(f.primary().disabled, true);
    await f.input('from', 'ja:Changed');
    assert.equal(f.primary().disabled, true);
    assert.equal(f.output().value, '');
    first.resolve('old result');
    await settle();
    assert.equal(f.output().value, '');
    await f.enter();
    second.resolve('current result');
    await settle();
    assert.equal(f.output().value, 'current result');
    f.document.querySelector('input[type="checkbox"]').click();
    await settle();
    assert.equal(f.output().value, '');
    assert.equal(
        f.primary().textContent.trim(),
        f.messages.advancedCopyWikitext,
    );
    third.resolve('updated options');
    await settle();
    assert.equal(f.output().value, 'updated options');
});

test('pending actions keep focus in the dialog and completion preserves subsequent input focus', async (t) => {
    const generated = deferred();
    const copied = deferred();
    const f = fixture(t, {
        generate: () => generated.promise,
        copy: () => copied.promise,
    });
    await f.open();
    const from = f.query('input[name$="-from"]');
    from.focus();
    generated.resolve('Result');
    await settle();
    assert.equal(f.document.activeElement, from);
    f.primary().focus();
    f.primary().click();
    await settle();
    assert.equal(
        f.document.activeElement,
        f.query('.kanade-rev-copy-advanced-form'),
    );
    from.focus();
    copied.resolve();
    await settle();
    assert.equal(f.document.activeElement, from);
});

test('lookup and clipboard failures allow retry and retain manual-copy output', async (t) => {
    let attempts = 0;
    const f = fixture(t, {
        generate: async () => {
            if (++attempts === 1) throw new Error('Network failure');
            return 'Generated result';
        },
        copy: async () => {
            throw new Error('Clipboard denied');
        },
    });
    await f.open();
    assert.match(f.query('.cdx-dialog').textContent, /Could not resolve/u);
    assert.equal(f.output().value, '');
    await f.enter();
    f.primary().click();
    await settle();
    assert.match(f.query('.cdx-dialog').textContent, /clipboard permission/u);
    assert.equal(f.output().value, 'Generated result');
    assert.equal(f.primary().disabled, false);
    assert.equal(f.query('#kanade-rev-copy-copy-notification'), null);
});

test('auto-refresh retains the clipboard lock until an earlier write settles', async (t) => {
    const pendingCopy = deferred();
    let generation = 0;
    const f = fixture(t, {
        generate: async () => `Preview ${++generation}`,
        copy: () => pendingCopy.promise,
    });
    await f.open();
    f.primary().click();
    await settle();
    f.query('input[type="checkbox"]').click();
    await settle();
    assert.equal(f.output().value, 'Preview 2');
    assert.equal(f.primary().disabled, true);
    f.primary().click();
    assert.deepEqual(f.copies, ['Preview 1']);
    pendingCopy.resolve();
    await settle();
    assert.equal(f.primary().disabled, false);
    assert.equal(f.query('#kanade-rev-copy-copy-notification'), null);
    f.primary().click();
    await settle();
    assert.deepEqual(f.copies, ['Preview 1', 'Preview 2']);
    assert.ok(f.query('#kanade-rev-copy-copy-notification'));
});

test('closing and disposal discard late completions and remove modal state', async (t) => {
    const first = deferred();
    const second = deferred();
    let attempts = 0;
    const f = fixture(t, {
        generate: () => (++attempts === 1 ? first.promise : second.promise),
    });
    await f.open();
    await f.key('Escape');
    first.resolve('stale result');
    await settle();
    await f.open();
    assert.equal(f.output().value, '');
    f.controller.dispose();
    second.resolve('disposed result');
    await settle();
    assert.equal(f.query('[role="dialog"]'), null);
    assert.equal(f.query('.kanade-rev-copy-advanced-mount'), null);
    assert.equal(f.query('#opener').hasAttribute('inert'), false);
    assert.equal(f.document.activeElement, f.query('#opener'));
});

test('failed module loads notify without rejection and disposed loads never mount', async (t) => {
    const failure = deferred();
    const f = fixture(t, { loading: failure.promise });
    const opening = f.controller.open();
    failure.reject(new Error('ResourceLoader failure'));
    await opening;
    assert.equal(f.notifications[0].message, f.messages.advancedLoadFailed);
    assert.equal(f.query('[role="dialog"]'), null);
    const delayed = deferred();
    const disposed = fixture(t, { loading: delayed.promise });
    const pending = disposed.controller.open();
    disposed.controller.dispose();
    delayed.resolve();
    await pending;
    assert.equal(disposed.query('.kanade-rev-copy-advanced-mount'), null);
});

test('section contexts prefill the exact fragment and retain partial only when manually selected', async (t) => {
    const f = fixture(t);
    await f.open('ライブ・パフォーマンス');
    assert.equal(
        f.query('input[name$="-from"]').value,
        '#ライブ・パフォーマンス',
    );
    assert.equal(f.query('input[name$="-to"]').value, '');
    assert.deepEqual(
        { ...f.generations.at(-1)[2] },
        {
            mode: 'translate',
            notice: false,
            sourceSummary: false,
            partial: false,
            modified: false,
        },
    );
    assert.equal(f.generations.at(-1)[0], '#ライブ・パフォーマンス');
    await f.input('from', 'ja:Edited source');
    await f.input('to', 'zh:Destination');
    f.query('.cdx-toggle-button-group button:last-child').click();
    await settle();
    f.document.querySelectorAll('input[type="checkbox"]')[0].click();
    await settle();
    f.document.querySelectorAll('input[type="checkbox"]')[1].click();
    await settle();
    await f.key('Escape');
    await f.open('ライブ・パフォーマンス');
    assert.equal(f.query('input[name$="-from"]').value, 'ja:Edited source');
    assert.equal(f.query('input[name$="-to"]').value, 'zh:Destination');
    assert.equal(f.generations.at(-1)[2].mode, 'copy');
    assert.equal(f.generations.at(-1)[2].partial, true);
    assert.equal(f.generations.at(-1)[2].modified, true);
    await f.key('Escape');
    await f.open('Other_section');
    assert.equal(f.query('input[name$="-from"]').value, '#Other_section');
    assert.equal(f.query('input[name$="-to"]').value, '');
    assert.equal(f.generations.at(-1)[2].mode, 'translate');
    assert.equal(f.generations.at(-1)[2].partial, false);
    assert.equal(f.generations.at(-1)[2].modified, false);
    await f.key('Escape');
    await f.open('top');
    assert.equal(f.query('input[name$="-from"]').value, '#top');
    assert.equal(f.generations.at(-1)[2].partial, false);
    await f.key('Escape');
    await f.open();
    assert.equal(f.query('input[name$="-from"]').value, '');
    assert.equal(f.query('input[name$="-to"]').value, '');
    assert.equal(f.generations.at(-1)[2].partial, false);
    await f.input('from', 'ja:Page context edit');
    await f.key('Escape');
    await f.open();
    assert.equal(f.query('input[name$="-from"]').value, 'ja:Page context edit');
});

test('a removed section opener cannot launch a stale dialog after lazy loading', async (t) => {
    const loading = deferred();
    const f = fixture(t, { loading: loading.promise });
    const opening = f.controller.open('Development');
    f.query('#opener').remove();
    loading.resolve();
    await opening;
    await settle();
    assert.equal(f.query('[role="dialog"]'), null);
    assert.equal(f.generations.length, 0);
    await f.open();
    assert.ok(f.query('[role="dialog"]'));
    assert.equal(f.generations.length, 1);
    assert.equal(f.generations[0][0], 'en:');
});
