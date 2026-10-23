/**
 * @file src/wpvg-assessor/i18n/index.ts
 * Purpose: Article Assessor locale registry.
 *
 * Contents: Locale catalogs, interface messages, and English save summaries.
 */

import * as i18n from '../../library/i18n/messages.ts';
import { getInterfaceLanguage } from '../platform/mediawiki/language.ts';
import englishCatalog from './en.json' with { type: 'json' };
import zhHansCatalog from './zh-Hans.json' with { type: 'json' };
import zhHantCatalog from './zh-Hant.json' with { type: 'json' };
import jaCatalog from './ja.json' with { type: 'json' };
import ruCatalog from './ru.json' with { type: 'json' };

export const english = englishCatalog;
export const simplifiedChinese: i18n.LocaleCatalog<typeof english> =
    zhHansCatalog;
export const traditionalChinese: i18n.LocaleCatalog<typeof english> =
    zhHantCatalog;
export const japanese: i18n.LocaleCatalog<typeof english> = jaCatalog;
export const russian: i18n.LocaleCatalog<typeof english> = ruCatalog;

export type MessageId = Extract<keyof typeof english, string>;

const SUMMARY_SOURCE_LINK = [
    '[[:m:User:For Each ... Next/global.js',
    '/vg page assessor.js|🍄]]',
].join('');

const messages = i18n.createI18n(
    english,
    {
        'zh-Hans': simplifiedChinese,
        'zh-Hant': traditionalChinese,
        ja: japanese,
        ru: russian,
    },
    getInterfaceLanguage(),
);

export const interfaceLocale = messages.interfaceLocale;
export const msg = messages.msg;
const englishMessages = i18n.createI18n(english, {});

/** Builds an English summary for the reviewed archive and list edits. */
export function buildArchiveSummary(): string {
    return englishMessages.msg('archive.summary', {
        source: SUMMARY_SOURCE_LINK,
    });
}
