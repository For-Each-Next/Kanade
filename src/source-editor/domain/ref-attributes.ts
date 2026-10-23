/**
 * @file src/source-editor/domain/ref-attributes.ts
 * Purpose: Encoding helpers for citation reference attributes.
 *
 * Contents: Reference identity decoding and quoted group/detail attributes.
 */

import { decodeHTMLStrict } from 'entities';

/**
 * Decodes entities recognized in reference names and groups.
 *
 * @param value - Entered attribute value.
 * @returns Decoded attribute text.
 */
export function decodeReferenceAttribute(value: string): string {
    return decodeReferenceDetailsAttribute(value);
}

/**
 * Escapes arbitrary text for a quoted HTML-like attribute.
 *
 * @param value - Raw attribute value.
 * @returns Escaped attribute text.
 */
export function escapeQuotedAttribute(value: string): string {
    return value.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;');
}

/** Decodes details text once without interpreting nested wikitext. */
export function decodeReferenceDetailsAttribute(value: string): string {
    return value.replace(/&(?:[a-z][\da-z]*|#\d+|#x[\da-f]+);/giu, (entity) => {
        const name = entity.slice(1, -1).toLowerCase();
        if (!name.startsWith('#')) return decodeHTMLStrict(entity);
        const hexadecimal = name.startsWith('#x');
        const code = Number.parseInt(
            name.slice(hexadecimal ? 2 : 1),
            hexadecimal ? 16 : 10,
        );
        return code > 0 &&
            code <= 0x10ffff &&
            !(code >= 0xd800 && code <= 0xdfff)
            ? String.fromCodePoint(code)
            : entity;
    });
}

/** Escapes new details text for storage in a native reference attribute. */
export function escapeReferenceDetails(value: string): string {
    return escapeQuotedAttribute(value)
        .replace(/</gu, '&lt;')
        .replace(/>/gu, '&gt;');
}

/** Preserves existing details entities while quoting the entered attribute. */
export function formatReferenceDetailsAttribute(
    value: string | undefined,
): string {
    if (value === undefined) return '';
    const escaped = value
        .replace(/"/gu, '&quot;')
        .replace(/</gu, '&lt;')
        .replace(/>/gu, '&gt;');
    return ` details="${escaped}"`;
}

/**
 * Builds an optional, escaped reference-group attribute.
 *
 * @param value - Raw reference group.
 * @returns Leading-space group attribute or an empty string.
 */
export function formatReferenceGroupAttribute(value: string): string {
    const decoded = decodeReferenceAttribute(value);
    return decoded === '' ? '' : ` group="${escapeQuotedAttribute(decoded)}"`;
}

/**
 * Removes optional matching quote marks around an R-template name.
 *
 * @param value - Entered reference name.
 * @returns Unquoted reference name.
 */
export function stripOptionalReferenceNameQuotes(value: string): string {
    return value.trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/u, '$1$2');
}
