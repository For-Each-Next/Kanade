/**
 * @file src/vg-stub-creator/i18n/index.ts
 * Purpose: VG Stub Creator locale registry.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 */

import * as i18n from '../../library/i18n/messages.ts';
import { getMediaWikiInterfaceLanguage } from '../platform/mediawiki/language.ts';
import englishCatalog from './en.json' with { type: 'json' };
import japaneseCatalog from './ja.json' with { type: 'json' };
import russianCatalog from './ru.json' with { type: 'json' };
import zhHansCatalog from './zh-Hans.json' with { type: 'json' };
import zhHantCatalog from './zh-Hant.json' with { type: 'json' };

export const english = englishCatalog;
export const japanese: i18n.LocaleCatalog<typeof english> = japaneseCatalog;
export const russian: i18n.LocaleCatalog<typeof english> = russianCatalog;
export const simplifiedChinese: i18n.LocaleCatalog<typeof english> =
    zhHansCatalog;
export const traditionalChinese: i18n.LocaleCatalog<typeof english> =
    zhHantCatalog;

const messages = i18n.createI18n(
    english,
    {
        ja: japanese,
        ru: russian,
        'zh-Hans': simplifiedChinese,
        'zh-Hant': traditionalChinese,
    },
    getMediaWikiInterfaceLanguage(),
);

export const msg = messages.msg;
export const msgParts = messages.msgParts;
export const interfaceLocale = messages.interfaceLocale;
