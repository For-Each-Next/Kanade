/**
 * @file src/library/i18n/messages.ts
 * Purpose: Share pure catalog translation and locale resolution across tools.
 *
 * Contents: Typed catalogs, locale fallback, and text or rich-part interpolation.
 */

type MessageCatalog = Record<string, string>;
type MessageCatalogs = Record<string, MessageCatalog>;
type MessagePartValues<T> = Record<string, T | T[]>;
export type MessageValues = Record<string, string | number>;
export type LocaleCatalog<Source extends MessageCatalog> = {
    [Id in keyof Source]: string;
};

interface Translator {
    locale: string;
    parts<T>(message: string, values: MessagePartValues<T>): Array<string | T>;
    text(message: string, values?: MessageValues): string;
}

export interface TypedI18n<Id extends string> {
    interfaceLocale: string;
    msg(id: Id, values?: MessageValues): string;
    msgParts<T>(id: Id, values: MessagePartValues<T>): Array<string | T>;
}

/** Creates a translator whose message keys come from its English catalog. */
export function createI18n<Source extends MessageCatalog>(
    english: Source,
    translations: Record<string, LocaleCatalog<Source>>,
    locale = 'en',
): TypedI18n<Extract<keyof Source, string>> {
    const translator = createTranslator(
        { en: english, ...translations },
        locale,
    );
    return {
        interfaceLocale: translator.locale,
        msg: translator.text,
        msgParts: translator.parts,
    };
}

/** Translates with English and source-key fallbacks for missing messages. */
export function createTranslator(
    catalogs: MessageCatalogs,
    locale = 'en',
): Translator {
    const resolvedLocale = resolveLocale(locale, Object.keys(catalogs));
    function messageText(message: string): string {
        return (
            catalogs[resolvedLocale]?.[message] ||
            catalogs.en?.[message] ||
            message
        );
    }
    return {
        locale: resolvedLocale,
        parts(message, values) {
            return interpolateMessageParts(messageText(message), values);
        },
        text(message, values = {}) {
            return interpolateMessageParts(messageText(message), values).join(
                '',
            );
        },
    };
}

/** Resolves exact, Chinese-variant, base-language, and English catalogs. */
export function resolveLocale(
    locale: string,
    availableLocales: string[],
): string {
    const available = new Map(
        availableLocales.map((entry) => [entry.toLocaleLowerCase(), entry]),
    );
    const normalized = normalizeLocale(locale).toLocaleLowerCase();
    return (
        available.get(normalized) ??
        available.get(normalized.split('-')[0]) ??
        (available.get('en') || availableLocales[0] || 'en')
    );
}

function normalizeLocale(locale: string): string {
    const value = (locale || 'en').replace(/_/gu, '-');
    if (/^zh(?:-(?:cn|hans|my|sg))?$/iu.test(value)) return 'zh-Hans';
    if (/^zh-(?:hk|hant|mo|tw)$/iu.test(value)) return 'zh-Hant';
    return value;
}

function interpolateMessageParts<T>(
    message: string,
    values: MessagePartValues<T>,
): Array<string | T> {
    const parts: Array<string | T> = [];
    let offset = 0;
    for (const match of message.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/gu)) {
        parts.push(message.slice(offset, match.index));
        const value = values[match[1]];
        if (Array.isArray(value)) parts.push(...value);
        else parts.push(value ?? match[0]);
        offset = match.index + match[0].length;
    }
    parts.push(message.slice(offset));
    return parts.filter((part) => part !== '');
}
