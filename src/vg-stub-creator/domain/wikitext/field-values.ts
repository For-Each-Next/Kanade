/**
 * @file src/vg-stub-creator/domain/wikitext/field-values.ts
 * Purpose: Normalizes compact form values and wikilink-aware field lists.
 *
 * Table of contents:
 * 1. PrefixedValue
 * 2. WikilinkParts
 * 3. FormatPrefixedValueOptions
 * 4. parsePrefixedValue
 * 5. formatPrefixedValue
 * 6. preservePrefix
 * 7. uniqueValues
 * 8. splitFieldValues
 * 9. splitSourceUrls
 * 10. splitLookupFieldValues
 * 11. getWikilinkValue
 * 12. getWikilinkParts
 * 13. isWikilinkValue
 * 14. getWikilinkMatch
 * 15. splitDelimitedFieldValue
 * 16. getWikilinkTransition
 * 17. hasFirstLevelFieldSeparator
 * 18. splitWikilinkParts
 * 19. isFieldValueSeparator
 * 20. isSpacedSlash
 * 21. trimValue
 */

/** A compact value with an optional prefix before a colon. */
export interface PrefixedValue {
    prefix: string;
    value: string;
}

/** The target and optional display label of a whole-field wikilink. */
export interface WikilinkParts {
    label: string;
    target: string;
}

interface FormatPrefixedValueOptions {
    normalizePrefix?: (prefix: string) => string;
}

/** Parses a compact prefixed value such as `ja:タイトル`. */
export function parsePrefixedValue(
    value: unknown,
    defaultPrefix: string,
): PrefixedValue {
    const text = trimValue(value);
    const match = text.match(/^([^:\s][^:]*):(.*)$/u);

    if (match == null) {
        return {
            prefix: trimValue(defaultPrefix),
            value: text,
        };
    }

    return {
        prefix: trimValue(match[1]),
        value: trimValue(match[2]),
    };
}

/** Formats a compact prefixed value without separator whitespace. */
export function formatPrefixedValue(
    value: unknown,
    options: FormatPrefixedValueOptions = {},
): string {
    const parsed = parsePrefixedValue(value, '');

    if (parsed.prefix === '') {
        return parsed.value;
    }

    const normalizePrefix = options.normalizePrefix ?? preservePrefix;
    return `${normalizePrefix(parsed.prefix)}:${parsed.value}`;
}

function preservePrefix(prefix: string): string {
    return prefix;
}

/** Removes duplicate strings while preserving first-seen order. */
export function uniqueValues(values: Array<string>): Array<string> {
    return Array.from(new Set(values));
}

/** Splits one user-entered field into reusable lookup values. */
export function splitFieldValues(value: string): Array<string> {
    return splitDelimitedFieldValue(value).map(trimValue).filter(Boolean);
}

/** Splits a multiline source field into trimmed nonblank URLs. */
export function splitSourceUrls(value: unknown): Array<string> {
    return trimValue(value)
        .split(/[\r\n]+/u)
        .map(trimValue)
        .filter(Boolean);
}

/** Splits a field and unwraps complete wikilinks into lookup values. */
export function splitLookupFieldValues(value: string): Array<string> {
    return splitDelimitedFieldValue(value)
        .map(getWikilinkValue)
        .map(trimValue)
        .filter(Boolean);
}

/** Returns the label or target from a whole-field wikilink. */
export function getWikilinkValue(value: string): string {
    const item = trimValue(value);
    const parts = getWikilinkParts(item);

    if (parts == null) {
        return item;
    }

    return parts.label || parts.target;
}

/** Parses the target and label from a complete whole-field wikilink. */
export function getWikilinkParts(value: string): WikilinkParts | null {
    const match = getWikilinkMatch(trimValue(value));

    if (match == null) {
        return null;
    }

    const [target, label] = splitWikilinkParts(match[1]);
    return {
        label: trimValue(label),
        target: trimValue(target),
    };
}

/** Checks whether a field item is exactly one complete wikilink. */
export function isWikilinkValue(value: string): boolean {
    return getWikilinkMatch(trimValue(value)) != null;
}

function getWikilinkMatch(value: string): RegExpMatchArray | null {
    return value.match(/^\[\[([^[\]\r\n]+)\]\]$/u);
}

function splitDelimitedFieldValue(value: string): Array<string> {
    const text = value == null ? '' : String(value);
    const firstLevelOnly = hasFirstLevelFieldSeparator(text);
    const items: string[] = [];
    let item = '';
    let inWikilink = false;

    for (let index = 0; index < text.length; index += 1) {
        const pair = text.slice(index, index + 2);
        const transition = getWikilinkTransition(pair, inWikilink);

        if (transition != null) {
            inWikilink = transition;
            item += pair;
            index += 1;
            continue;
        }

        if (!inWikilink && isFieldValueSeparator(text, index, firstLevelOnly)) {
            items.push(item);
            item = '';
            continue;
        }

        item += text[index];
    }

    items.push(item);
    return items;
}

function getWikilinkTransition(
    pair: string,
    inWikilink: boolean,
): boolean | null {
    if (pair === '[[') {
        return true;
    }
    if (pair === ']]' && inWikilink) {
        return false;
    }

    return null;
}

/** Checks for a semicolon or line separator outside wikilinks. */
export function hasFirstLevelFieldSeparator(text: string): boolean {
    let inWikilink = false;

    for (let index = 0; index < text.length; index += 1) {
        const pair = text.slice(index, index + 2);

        if (pair === '[[') {
            inWikilink = true;
            index += 1;
            continue;
        }

        if (pair === ']]' && inWikilink) {
            inWikilink = false;
            index += 1;
            continue;
        }

        if (!inWikilink && /[;；\r\n]/u.test(text[index])) {
            return true;
        }
    }

    return false;
}

function splitWikilinkParts(value: string): [string, string] {
    const separatorIndex = value.indexOf('|');

    if (separatorIndex === -1) {
        return [value, ''];
    }

    return [value.slice(0, separatorIndex), value.slice(separatorIndex + 1)];
}

function isFieldValueSeparator(
    text: string,
    index: number,
    firstLevelOnly: boolean,
): boolean {
    const character = text[index];

    if (firstLevelOnly) {
        return /[;；\r\n]/u.test(character);
    }

    if (character === '/') {
        return isSpacedSlash(text, index);
    }

    return /[、,，;；\r\n]/u.test(character);
}

function isSpacedSlash(text: string, index: number): boolean {
    return (
        /\s/u.test(text[index - 1] || '') || /\s/u.test(text[index + 1] || '')
    );
}

/** Coerces and trims one lookup value. */
export function trimValue(value: unknown): string {
    return value == null ? '' : String(value).trim();
}
