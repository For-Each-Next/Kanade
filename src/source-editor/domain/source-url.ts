/**
 * @file src/source-editor/domain/source-url.ts
 * Purpose: Source URL parsing, Wayback decoding, and matching normalization.
 *
 * Table of contents:
 * 1. Imports
 * 2. ParsedSourceUrl
 * 3. ParsedSourceInput
 * 4. parseSourceUrl
 * 5. parseSourceInput
 * 6. normalizeSourceUrl
 * 7. sanitizeSourceUrl
 * 8. parseHttpUrl
 * 9. parseWaybackUrl
 * 10. isWaybackHost
 * 11. decodeWaybackTarget
 * 12. formatWaybackDate
 * 13. decodeUrlEntities
 * 14. sanitizeParsedUrl
 */

import { isGregorianCalendarDate } from './calendar-date.ts';
import { cleanValue } from './citation.ts';

export interface ParsedSourceUrl {
    archiveDate: string;
    archiveUrl: string;
    originalUrl: string;
}

export interface ParsedSourceInput extends ParsedSourceUrl {
    search: string;
}

/**
 * Parses a normal HTTP URL or an Internet Archive playback URL.
 *
 * @param value - Value to process.
 * @returns Parsed normal HTTP URL or an Internet Archive playback URL.
 */
export function parseSourceUrl(value: string): ParsedSourceUrl | null {
    const clean = decodeUrlEntities(value.trim());
    const parsed = parseHttpUrl(clean);
    if (parsed == null) {
        return null;
    }
    const wayback = parseWaybackUrl(parsed);
    if (wayback != null) {
        return wayback;
    }
    return {
        archiveDate: '',
        archiveUrl: '',
        originalUrl: sanitizeParsedUrl(parsed),
    };
}

/**
 * Parses a Citoid lookup while retaining URL-specific archive data.
 *
 * @param value - Value to process.
 * @returns Citoid lookup retaining URL-specific archive data.
 */
export function parseSourceInput(value: string): ParsedSourceInput | null {
    const search = value.trim();
    if (search === '') {
        return null;
    }
    const parsedUrl = parseSourceUrl(search);
    return {
        archiveDate: parsedUrl?.archiveDate ?? '',
        archiveUrl: parsedUrl?.archiveUrl ?? '',
        originalUrl: parsedUrl?.originalUrl ?? '',
        search: parsedUrl?.originalUrl ?? search,
    };
}

/**
 * Returns a deterministic source URL used only for matching.
 *
 * @param value - Value to process.
 * @returns A deterministic source URL used only for matching.
 */
export function normalizeSourceUrl(value: string): string {
    const clean = cleanValue(decodeUrlEntities(value));
    const parsed = parseHttpUrl(clean);
    if (parsed == null) {
        return clean.replace(/#.*$/u, '');
    }
    parsed.hash = '';
    return sanitizeParsedUrl(parsed);
}

/**
 * Encodes template delimiters that URL parsing deliberately preserves.
 *
 * @param value - Value to process.
 * @returns Resulting text.
 */
export function sanitizeSourceUrl(value: string): string {
    const clean = decodeUrlEntities(value.trim());
    const parsed = parseHttpUrl(clean);
    return parsed == null
        ? clean.replace(/\|/gu, '%7C')
        : sanitizeParsedUrl(parsed);
}

function parseHttpUrl(value: string): URL | null {
    try {
        const parsed = new URL(value);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed : null;
    } catch {
        return null;
    }
}

function parseWaybackUrl(parsed: URL): ParsedSourceUrl | null {
    if (!isWaybackHost(parsed.hostname)) {
        return null;
    }
    const match = parsed.pathname.match(
        /^\/web\/(\d{4}(?:\d{2}){0,5})(?:[a-z][a-z0-9_-]*)?\/(.+)$/iu,
    );
    if (match == null) {
        return null;
    }
    const original = decodeWaybackTarget(
        `${match[2]}${parsed.search}${parsed.hash}`,
    );
    const originalUrl = parseHttpUrl(original);
    if (originalUrl == null) {
        return null;
    }
    return {
        archiveDate: formatWaybackDate(match[1]),
        archiveUrl: sanitizeParsedUrl(parsed),
        originalUrl: sanitizeParsedUrl(originalUrl),
    };
}

function isWaybackHost(hostname: string): boolean {
    const normalized = hostname.toLowerCase();
    return normalized === 'archive.org' || normalized.endsWith('.archive.org');
}

function decodeWaybackTarget(value: string): string {
    if (/^https?:\/\//iu.test(value)) {
        return value;
    }
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export function formatWaybackDate(timestamp: string): string {
    const match = timestamp.match(/^(\d{4})(\d{2})(\d{2})/u);
    if (
        match == null ||
        !isGregorianCalendarDate(match[1], match[2], match[3])
    ) {
        return '';
    }
    return `${match[1]}-${match[2]}-${match[3]}`;
}

function decodeUrlEntities(value: string): string {
    return value
        .replace(/&amp;/giu, '&')
        .replace(/&#0*38;/giu, '&')
        .replace(/&#x0*26;/giu, '&');
}

function sanitizeParsedUrl(url: URL): string {
    return url.toString().replace(/\|/gu, '%7C');
}
