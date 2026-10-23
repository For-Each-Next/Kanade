/**
 * @file tests/source-editor/i18n.test.ts
 * Purpose: One Source Editor locale for editor labels, reference labels, and diagnostics.
 *
 * Table of contents:
 * 1. Imports
 * 2. placeholders
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createSourceEditorI18n,
    english,
    initializeSourceEditorI18n,
    interfaceLocale,
    japanese,
    msg,
    russian,
    simplifiedChinese,
    traditionalChinese,
} from '../../src/source-editor/i18n/index.ts';
import {
    createSourceAnalysisMessages,
    createSourceValidationMessages,
    sourceAnalysisMessages,
    sourceValidationMessages,
} from '../../src/source-editor/features/source-manager/messages.ts';

function placeholders(message: string): string[] {
    return [...message.matchAll(/(?<!\{)\{([A-Za-z][A-Za-z0-9]*)\}(?!\})/gu)]
        .map((match) => match[1])
        .toSorted();
}

test('keeps translated catalogs and named placeholders aligned', () => {
    const ids = (
        Object.keys(english) as Array<keyof typeof english>
    ).toSorted();
    for (const catalog of [
        japanese,
        russian,
        simplifiedChinese,
        traditionalChinese,
    ]) {
        assert.deepEqual(Object.keys(catalog).toSorted(), ids);
        for (const id of ids) {
            assert.ok(catalog[id].trim(), `${id} must have a translation`);
            assert.deepEqual(
                placeholders(catalog[id]),
                placeholders(english[id]),
                id,
            );
        }
    }
});

test('resolves MediaWiki language variants and English fallback', () => {
    for (const locale of ['ja', 'ja-JP', 'JA_jp']) {
        assert.equal(createSourceEditorI18n(locale).interfaceLocale, 'ja');
    }
    for (const locale of ['ru', 'ru-RU', 'RU_ru']) {
        assert.equal(createSourceEditorI18n(locale).interfaceLocale, 'ru');
    }
    for (const locale of ['zh', 'zh-CN', 'zh_CN', 'zh-Hans', 'zh-SG']) {
        assert.equal(createSourceEditorI18n(locale).interfaceLocale, 'zh-Hans');
    }
    for (const locale of ['zh-HK', 'zh_HK', 'zh-Hant', 'zh-MO', 'zh-TW']) {
        assert.equal(createSourceEditorI18n(locale).interfaceLocale, 'zh-Hant');
    }
    assert.equal(createSourceEditorI18n('fr').interfaceLocale, 'en');
});

test('initializes editor and reference messages together when MediaWiki becomes ready', () => {
    const previousMediaWiki = Object.getOwnPropertyDescriptor(globalThis, 'mw');
    try {
        Reflect.deleteProperty(globalThis, 'mw');
        initializeSourceEditorI18n();
        assert.equal(msg('tool.name'), english['tool.name']);

        let locale = 'en';
        Object.defineProperty(globalThis, 'mw', {
            configurable: true,
            value: {
                config: {
                    get(key: string) {
                        assert.equal(key, 'wgUserLanguage');
                        return locale;
                    },
                },
            },
        });

        for (const selection of [
            { locale: 'ja-JP', resolved: 'ja', catalog: japanese },
            { locale: 'ru-RU', resolved: 'ru', catalog: russian },
            {
                locale: 'zh-cn',
                resolved: 'zh-Hans',
                catalog: simplifiedChinese,
            },
            {
                locale: 'zh-tw',
                resolved: 'zh-Hant',
                catalog: traditionalChinese,
            },
            { locale: 'fr', resolved: 'en', catalog: english },
        ]) {
            locale = selection.locale;
            initializeSourceEditorI18n();
            assert.equal(interfaceLocale, selection.resolved);
            assert.equal(msg('tool.name'), selection.catalog['tool.name']);
            assert.equal(
                msg('dialog.referencesTab'),
                selection.catalog['dialog.referencesTab'],
            );
            assert.equal(
                msg('references.title'),
                selection.catalog['references.title'],
            );
            assert.equal(
                msg('references.description'),
                selection.catalog['references.description'],
            );
            assert.equal(
                sourceAnalysisMessages.untitledSource(),
                selection.catalog['common.untitledSource'],
            );
            assert.equal(
                sourceValidationMessages.unsupportedParameter('example'),
                createSourceEditorI18n(locale).msg(
                    'validation.unsupportedParameter',
                    {
                        parameter: 'example',
                    },
                ),
            );
        }
    } finally {
        if (previousMediaWiki == null) {
            Reflect.deleteProperty(globalThis, 'mw');
        } else {
            Object.defineProperty(globalThis, 'mw', previousMediaWiki);
        }
        initializeSourceEditorI18n();
    }
});

test('an explicit translator includes source-editing and reference-management messages', () => {
    const translator = createSourceEditorI18n('zh-Hant');
    assert.equal(
        translator.msg('dialog.referenceEditing'),
        traditionalChinese['dialog.referenceEditing'],
    );
    assert.equal(
        translator.msg('draft.createSourceTitle'),
        traditionalChinese['draft.createSourceTitle'],
    );
});

test('interpolates counts and domain diagnostics in the selected locale', () => {
    const translator = createSourceEditorI18n('zh-TW');
    const validation = createSourceValidationMessages(translator);
    const analysis = createSourceAnalysisMessages(translator);
    const tabs = translator.msg('tabs.sourcesList', { count: 3 });
    assert.match(tabs, /3/u);
    assert.doesNotMatch(tabs, /\{count\}/u);
    assert.equal(
        validation.unsupportedParameter('example'),
        'CS1不支援example參數。',
    );
    assert.equal(analysis.untitledSource(), '無標題來源');
    const simplified = createSourceEditorI18n('zh-CN');
    assert.equal(
        simplified.msg('lookup.sourceUsageWithSubReferences', {
            count: 132,
            subCount: 37,
        }),
        '132×（含37个子参考）',
    );
});

test('uses Japanese and Russian editor, reference, and diagnostic translations', () => {
    for (const locale of ['ja', 'ru']) {
        const translator = createSourceEditorI18n(locale);
        for (const id of [
            'dialog.saveSettings',
            'dialog.referenceEditing',
            'draft.createSourceTitle',
            'tools.openFormattingSettings',
            'feedback.settingsSaveFailed',
        ] as const) {
            assert.notEqual(
                translator.msg(id),
                english[id],
                `${locale}: ${id}`,
            );
        }
        const examples = translator.msg('tools.scriptTitleLanguages', {
            languages: 'en, ja, ru',
        });
        assert.ok(examples.includes('en, ja, ru'));
        assert.doesNotMatch(examples, /\{languages\}/u);
        const validation = createSourceValidationMessages(translator);
        assert.ok(validation.unsupportedParameter('custom').includes('custom'));
        assert.notEqual(
            validation.unsupportedParameter('custom'),
            createSourceValidationMessages(
                createSourceEditorI18n('en'),
            ).unsupportedParameter('custom'),
        );
    }
});
