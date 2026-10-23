/**
 * @file tests/library/i18n.test.ts
 * Purpose: Tests shared locale resolution and named interpolation.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createI18n,
    createTranslator,
    resolveLocale,
} from '../../src/library/i18n/messages.ts';

const english = {
    greeting: 'Hello, {name}.',
    rich: 'Open {link} now.',
};

test('resolves exact, Chinese variant, base, and English locales', () => {
    const locales = ['en', 'fr', 'zh-Hans', 'zh-Hant'];

    assert.equal(resolveLocale('FR', locales), 'fr');
    assert.equal(resolveLocale('zh_CN', locales), 'zh-Hans');
    assert.equal(resolveLocale('zh-TW', locales), 'zh-Hant');
    assert.equal(resolveLocale('fr-CA', locales), 'fr');
    assert.equal(resolveLocale('de', locales), 'en');
    assert.equal(resolveLocale('zh-Hant-TW', locales), 'en');
    assert.equal(resolveLocale('zh-unknown', locales), 'en');
    assert.equal(resolveLocale('de', ['fr']), 'fr');
    assert.equal(resolveLocale('de', []), 'en');
});

test('interpolates text and preserves typed rich message parts', () => {
    const translator = createTranslator({ en: english }, 'en');
    const link = { href: '/wiki/Example' };

    assert.equal(
        translator.text('greeting', { name: 'Editor' }),
        'Hello, Editor.',
    );
    assert.deepEqual(translator.parts('rich', { link }), [
        'Open ',
        link,
        ' now.',
    ]);
    assert.deepEqual(translator.parts('rich', { link: [link, ' →'] }), [
        'Open ',
        link,
        ' →',
        ' now.',
    ]);
    assert.equal(translator.text('unknown'), 'unknown');
    assert.equal(translator.text('greeting'), 'Hello, {name}.');
});

test('creates a catalog-keyed typed facade', () => {
    const i18n = createI18n(english, {
        fr: { greeting: 'Bonjour, {name}.', rich: 'Ouvrir {link}.' },
    });

    assert.equal(typeof i18n.msg('greeting', { name: 'Editor' }), 'string');
    assert.equal(typeof i18n.interfaceLocale, 'string');
});

test('translations resolve MediaWiki variants and retain plain-text interpolation', () => {
    const english = { greeting: 'Hello {name}', fallback: '{count} items' };
    const translations = {
        'zh-Hans': { greeting: '你好 {name}', fallback: '' },
        'zh-Hant': { greeting: '您好 {name}', fallback: '' },
    };
    for (const locale of ['zh', 'zh_CN', 'zh-sg', 'zh-Hans']) {
        assert.equal(
            createI18n(english, translations, locale).interfaceLocale,
            'zh-Hans',
        );
    }
    for (const locale of ['zh-tw', 'zh_HK', 'zh-Hant']) {
        assert.equal(
            createI18n(english, translations, locale).interfaceLocale,
            'zh-Hant',
        );
    }
    const translate = createI18n(english, translations, 'zh-hant');
    assert.equal(
        translate.msg('greeting', { name: '<script>{count}</script>' }),
        '您好 <script>{count}</script>',
    );
    assert.equal(translate.msg('fallback', { count: 0 }), '0 items');
    assert.equal(translate.msg('fallback'), '{count} items');
    assert.equal(
        createI18n(english, translations, 'fr').msg('greeting'),
        'Hello {name}',
    );
});
