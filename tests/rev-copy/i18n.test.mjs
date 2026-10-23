/**
 * @file tests/rev-copy/i18n.test.mjs
 * Purpose: Verify complete interface catalogs and language selection.
 * Contents: Catalog parity, placeholders, locale variants, and English fallback.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadModule } from './helpers.mjs';

const { getMessages } = await loadModule('src/rev-copy/i18n/index.ts');
const english = getMessages('en');

test('all interface catalogs retain message keys and interpolation placeholders', async () => {
    for (const locale of ['zh-Hans', 'zh-Hant', 'ja', 'ru']) {
        const catalog = JSON.parse(
            await readFile(`src/rev-copy/i18n/${locale}.json`, 'utf8'),
        );
        assert.deepEqual(
            Object.keys(catalog).toSorted(),
            Object.keys(english).toSorted(),
        );
        for (const [id, message] of Object.entries(english)) {
            assert.deepEqual(
                catalog[id].match(/\$\d+/gu),
                message.match(/\$\d+/gu),
                `${locale}: ${id}`,
            );
        }
    }
});

test('Japanese and Russian regions select translated interfaces', () => {
    assert.equal(getMessages('ja-JP').advancedClose, '閉じる');
    assert.equal(getMessages('ru_RU').advancedClose, 'Закрыть');
    assert.equal(
        getMessages('RU').sectionCopyPermalink,
        'Копировать постоянную ссылку',
    );
    assert.equal(getMessages('de').advancedClose, english.advancedClose);
});

test('Chinese variants retain Revision Copy extended-tag selection', () => {
    for (const locale of ['zh-Hant-TW', 'ZH_tw', 'zh-hk-extra', 'zh-mo']) {
        assert.equal(getMessages(locale), getMessages('zh-Hant'), locale);
    }
    for (const locale of ['zh', 'zh_CN', 'zh-Hans-CN', 'zh-unknown']) {
        assert.equal(getMessages(locale), getMessages('zh-Hans'), locale);
    }
});
