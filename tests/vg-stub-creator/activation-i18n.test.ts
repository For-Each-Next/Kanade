/**
 * @file tests/vg-stub-creator/activation-i18n.test.ts
 * Purpose: Verifies supported launch contexts, cross-wiki handoff, and interface catalogs.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 * 3. placeholders
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { canShowZhwikiLauncher } from '../../src/vg-stub-creator/features/creator/page-trigger.ts';
import {
    buildZhwikiCreationUrl,
    readZhwikiActivationForm,
    resolveZhwikiCreationTitle,
} from '../../src/vg-stub-creator/platform/network/zhwiki-activation.ts';
import {
    english,
    japanese,
    russian,
    simplifiedChinese,
    traditionalChinese,
} from '../../src/vg-stub-creator/i18n/index.ts';
import { createTranslator } from '../../src/library/i18n/messages.ts';

test("launching is limited to articles, drafts, and the editor's user pages", () => {
    const context = { namespaceNumber: 0, pageTitle: '星海', userName: null };
    assert.equal(canShowZhwikiLauncher(context), true);
    assert.equal(
        canShowZhwikiLauncher({ ...context, namespaceNumber: 118 }),
        true,
    );
    assert.equal(
        canShowZhwikiLauncher({
            namespaceNumber: 2,
            pageTitle: 'Editor_Name/Sandbox',
            userName: 'Editor Name',
        }),
        true,
    );
    for (const namespaceNumber of [1, 6, 10, 14]) {
        assert.equal(
            canShowZhwikiLauncher({ ...context, namespaceNumber }),
            false,
        );
    }
    assert.equal(
        canShowZhwikiLauncher({
            namespaceNumber: 2,
            pageTitle: 'Another editor/Sandbox',
            userName: 'Editor',
        }),
        false,
    );
});

test('cross-wiki handoff round trips its title and requires explicit activation', async () => {
    const enwikiTitle = 'Star Harbor (video game)';
    const url = new URL(buildZhwikiCreationUrl(enwikiTitle));
    assert.equal(url.origin, 'https://zh.wikipedia.org');
    assert.equal(decodeURIComponent(url.pathname), '/wiki/Star_Harbor');
    assert.deepEqual(readZhwikiActivationForm(url.searchParams), {
        enwikiTitle,
    });
    assert.equal(readZhwikiActivationForm('?vg-stub-creator=1'), null);
    assert.equal(
        readZhwikiActivationForm('?kanade-vg-stub-creator-enwiki-title=Star'),
        null,
    );
    const title = await resolveZhwikiCreationTitle(enwikiTitle, {
        async get() {
            return { query: { pages: [{ title: 'Star Harbor' }] } };
        },
    });
    assert.equal(title, 'Star Harbor (遊戲)');
});

function placeholders(message: string): string[] {
    return [...message.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/gu)]
        .map((match) => match[1]!)
        .sort();
}

test('every translation contains the English keys and named placeholders', () => {
    const entries = Object.entries(english);
    for (const catalog of [
        japanese,
        russian,
        simplifiedChinese,
        traditionalChinese,
    ]) {
        assert.deepEqual(
            Object.keys(catalog).sort(),
            Object.keys(english).sort(),
        );
        for (const [key, message] of entries) {
            const translated = catalog[key as keyof typeof english];
            assert.ok(translated.trim(), key);
            assert.deepEqual(
                placeholders(translated),
                placeholders(message),
                key,
            );
        }
    }
});

test('Japanese and Russian regions use complete base-language catalogs', () => {
    const catalogs = {
        en: english,
        ja: japanese,
        ru: russian,
        'zh-Hans': simplifiedChinese,
        'zh-Hant': traditionalChinese,
    };
    for (const [requested, locale] of [
        ['ja', 'ja'],
        ['ja-JP', 'ja'],
        ['JA_jp', 'ja'],
        ['ru', 'ru'],
        ['ru-RU', 'ru'],
        ['RU_by', 'ru'],
    ]) {
        const translator = createTranslator(catalogs, requested);
        assert.equal(translator.locale, locale);
        assert.equal(
            translator.text('launcher.createStub'),
            catalogs[locale as 'ja' | 'ru']['launcher.createStub'],
        );
        assert.match(translator.text('form.title', { title: '星海' }), /星海/u);
        assert.notEqual(
            translator.text('preview.continue'),
            english['preview.continue'],
        );
    }
    assert.equal(createTranslator(catalogs, 'de-DE').locale, 'en');
});

test('MediaWiki Chinese variants resolve correctly and interpolate messages', () => {
    const catalogs = {
        en: { greeting: 'Hello {name}' },
        'zh-Hans': { greeting: '你好，{name}' },
        'zh-Hant': { greeting: '您好，{name}' },
    };
    assert.equal(
        createTranslator(catalogs, 'zh-cn').text('greeting', {
            name: 'Editor',
        }),
        '你好，Editor',
    );
    assert.equal(createTranslator(catalogs, 'zh-tw').locale, 'zh-Hant');
    assert.equal(createTranslator(catalogs, 'fr').locale, 'en');
});
