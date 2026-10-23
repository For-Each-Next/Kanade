/**
 * @file src/vg-stub-creator/domain/terminologies/index.ts
 * Purpose: Resolves terminology aliases and projects canonical article metadata.
 * Contents: Company, genre, platform, and year matching.
 */

import companies from './companies.ts';
import genres from './genres.ts';
import platforms from './platforms.ts';
import years from './years.ts';
import * as wikitext from '../wikitext/index.ts';
const { buildLinkText, getReferenceDefinition, getWikilinkValue } = wikitext;

const TERMINOLOGY_DEFINITIONS = { companies, genres, platforms, years };

const GENRE_TYPE_SUFFIXES = [
    /[類类][電电]子[遊游][戲戏]$/iu,
    /[電电]子[遊游][戲戏]$/iu,
    /[類类][遊游][戲戏]$/iu,
    /[遊游][戲戏]$/iu,
    /\s+video game$/iu,
    /\s+game$/iu,
];

type TerminologyKey = keyof typeof TERMINOLOGY_DEFINITIONS;

const TYPE_KEYS: Record<string, TerminologyKey> = {
    companies: 'companies',
    company: 'companies',
    genre: 'genres',
    genres: 'genres',
    platform: 'platforms',
    platforms: 'platforms',
    year: 'years',
    years: 'years',
};

/**
 * Gets terminology metadata or one projected value.
 *
 * @param type - Terminology type, such as company or platform.
 * @param value - Term or alias to resolve.
 * @param projection - Metadata property or derived value.
 * @returns Resolved metadata or projected value.
 */
export function get(type: string, value: string, projection?: string): any {
    return getFrom(TERMINOLOGY_DEFINITIONS, type, value, projection);
}

/**
 * Gets every bundled terminology definition collection.
 *
 * @returns Every bundled terminology definition collection.
 */
export function getDefinitionCollections(): Array<Array<any>> {
    return Object.values(TERMINOLOGY_DEFINITIONS);
}

/**
 * Gets terminology data from an explicit definition collection.
 *
 * @param definitions - Terminology definitions by type.
 * @param type - Terminology type.
 * @param value - Term or alias to resolve.
 * @param projection - Metadata property or derived value.
 * @returns Resolved metadata or projected value.
 */
function getFrom(
    definitions: any,
    type: string,
    value: string,
    projection?: string,
): any {
    const key = TYPE_KEYS[type?.toLocaleLowerCase()];

    if (key == null) {
        return undefined;
    }

    const metadata = getTerminologyDefinition(definitions[key], key, value);

    if (metadata == null || projection == null || projection === '') {
        return metadata;
    }

    const normalizedProjection = projection
        .toLocaleLowerCase()
        .replace(/[\s_-]+/gu, '');

    if (normalizedProjection === 'link') {
        return getLink(metadata);
    }

    if (normalizedProjection === 'shortname') {
        return getShortLabel(metadata.label);
    }

    if (normalizedProjection === 'name') {
        return metadata.label;
    }

    return metadata[projection] ?? metadata[normalizedProjection];
}

/**
 * Resolves exact terms before normalizing genre type words.
 *
 * @param definitions - Definitions value.
 * @param type - Type value.
 * @param value - Input value.
 * @returns Exact terms before normalizing genre type words.
 */
function getTerminologyDefinition(
    definitions: Array<any>,
    type: string,
    value: string,
): any | undefined {
    const exact = getReferenceDefinition(definitions, value);

    if (exact != null || type !== 'genres') {
        return exact;
    }

    const genreWithoutTypeSuffix = stripGenreTypeSuffix(value);
    return getReferenceDefinition(definitions, genreWithoutTypeSuffix);
}

/**
 * Removes type words implied by the genre field before fallback lookup.
 *
 * @param value - Value to process.
 * @returns Resulting text.
 */
function stripGenreTypeSuffix(value: string): string {
    const unwrappedValue = getWikilinkValue(value);

    for (const suffix of GENRE_TYPE_SUFFIXES) {
        if (suffix.test(unwrappedValue)) {
            return unwrappedValue.replace(suffix, '').trim();
        }
    }

    return unwrappedValue;
}

/**
 * Builds linked or plain canonical terminology text.
 *
 * @param metadata - Terminology metadata.
 * @returns Canonical display text.
 */
function getLink(metadata: any): string | undefined {
    if (metadata.label == null) {
        return undefined;
    }

    if (metadata.page == null) {
        return metadata.label;
    }

    return buildLinkText(metadata.page, metadata.label);
}

/**
 * Removes a trailing game suffix from a canonical label.
 *
 * @param label - Canonical label.
 * @returns Short canonical label.
 */
function getShortLabel(label: string): string | undefined {
    return label?.replace(/(?:[电電]子)?[游遊][戏戲]$/u, '');
}
