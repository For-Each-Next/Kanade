/**
 * @file src/source-editor/i18n/index.ts
 * Purpose: Shared Source Editor messages and runtime interface-language selection.
 *
 * Contents: Catalogs, typed translators, and one initialized runtime locale.
 */

import {
    createI18n,
    type LocaleCatalog,
    type MessageValues,
    type TypedI18n,
} from '../../library/i18n/messages.ts';
import { getMediaWikiInterfaceLanguage } from '../platform/mediawiki/interface-language.ts';
import englishCatalog from './en.json' with { type: 'json' };
import japaneseCatalog from './ja.json' with { type: 'json' };
import russianCatalog from './ru.json' with { type: 'json' };
import zhHansCatalog from './zh-Hans.json' with { type: 'json' };
import zhHantCatalog from './zh-Hant.json' with { type: 'json' };

export const english = englishCatalog;
export const japanese: LocaleCatalog<typeof english> = japaneseCatalog;
export const russian: LocaleCatalog<typeof english> = russianCatalog;
export const simplifiedChinese: LocaleCatalog<typeof english> = zhHansCatalog;
export const traditionalChinese: LocaleCatalog<typeof english> = zhHantCatalog;

export type MessageId = Extract<keyof typeof english, string>;
export type SourceEditorI18n = TypedI18n<MessageId>;

/** Creates editor, reference, and diagnostic messages for one interface locale. */
export function createSourceEditorI18n(
    locale: string = getMediaWikiInterfaceLanguage(),
): SourceEditorI18n {
    return createI18n(
        english,
        {
            ja: japanese,
            ru: russian,
            'zh-Hans': simplifiedChinese,
            'zh-Hant': traditionalChinese,
        },
        locale,
    );
}

let messages = createSourceEditorI18n('en');

export let interfaceLocale = messages.interfaceLocale;

/** Selects the shared runtime locale once the host is ready for Source Editor startup. */
export function initializeSourceEditorI18n(): void {
    messages = createSourceEditorI18n();
    interfaceLocale = messages.interfaceLocale;
}

/** Translates a message using the initialized Source Editor interface locale. */
export function msg(id: MessageId, values?: MessageValues): string {
    return messages.msg(id, values);
}
