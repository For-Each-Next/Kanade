/**
 * @file src/rev-copy/i18n/index.ts
 * Purpose: Select interface messages independently from revision timestamp language.
 *
 * Contents: Interface catalog contracts, locale selection, and message lookup.
 */

import { resolveLocale } from '../../library/i18n/messages';
import en from './en.json';
import hans from './zh-Hans.json';
import hant from './zh-Hant.json';
import ja from './ja.json';
import ru from './ru.json';

export type Messages = typeof en;

const catalogs: Record<string, Messages> = {
    en,
    'zh-Hans': hans,
    'zh-Hant': hant,
    ja,
    ru,
};

export function getMessages(language: string): Messages {
    const locale = language.replace(/_/gu, '-').toLowerCase();
    // Revision Copy also accepts extended and unrecognized Chinese variants.
    const requested = /^zh-(?:hant|tw|hk|mo)(?:-|$)/u.test(locale)
        ? 'zh-Hant'
        : /^zh(?:-|$)/u.test(locale)
          ? 'zh-Hans'
          : locale;
    return catalogs[resolveLocale(requested, Object.keys(catalogs))];
}
