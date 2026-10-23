/**
 * @file src/library/wiki-titles/catalog.ts
 * Purpose: Decode namespace catalogs and apply their title rules without choosing a wiki policy.
 *
 * Contents: Siteinfo validation, immutable catalogs, namespace lookup, and title syntax.
 */

import { readRecord } from '../data-validation/records.ts';

export type NamespacePrefixMap = Readonly<Record<number, readonly string[]>>;

export interface NamespaceCatalog {
    readonly databaseName: string;
    readonly namespaceIds: Readonly<Record<string, number>>;
    readonly namespacePrefixes: NamespacePrefixMap;
}

const emptyPrefixes: readonly string[] = Object.freeze([]);

/** Builds immutable lookup tables from current names, canonical names, and aliases. */
export function createNamespaceCatalog(
    databaseName: string,
    namespacePrefixes: NamespacePrefixMap,
): NamespaceCatalog {
    const namespaceIds = Object.create(null) as Record<string, number>;
    for (const [namespaceId, prefixes] of Object.entries(namespacePrefixes)) {
        for (const prefix of prefixes) {
            namespaceIds[normalizeNamespacePrefix(prefix)] =
                Number(namespaceId);
        }
        Object.freeze(prefixes);
    }
    return Object.freeze({
        databaseName,
        namespaceIds: Object.freeze(namespaceIds),
        namespacePrefixes: Object.freeze(namespacePrefixes),
    });
}

/** Decodes modern siteinfo `namespaces` and `namespacealiases` fields. */
export function decodeNamespaceCatalog(
    databaseName: string,
    response: unknown,
): NamespaceCatalog {
    const query = readRecord(readRecord(response)?.query);
    const namespaces = readRecord(query?.namespaces);
    const aliases = query?.namespacealiases;
    if (namespaces == null || !Array.isArray(aliases)) {
        throw invalidSiteinfoError();
    }
    const prefixes = Object.create(null) as Record<number, readonly string[]>;
    for (const [enteredId, value] of Object.entries(namespaces)) {
        const namespace = readRecord(value);
        const namespaceId = readNamespaceId(namespace?.id, enteredId);
        const name = readNamespaceName(namespace);
        if (namespaceId == null || name == null) throw invalidSiteinfoError();
        const canonical = namespace?.canonical;
        prefixes[namespaceId] = uniquePrefixes([
            name,
            typeof canonical === 'string' ? canonical : '',
            ...readNamespaceAliases(aliases, namespaceId),
        ]);
    }
    return createNamespaceCatalog(databaseName, prefixes);
}

/** Uses MediaWiki's case-insensitive namespace-prefix spelling. */
export function normalizeNamespacePrefix(prefix: string): string {
    return prefix
        .trim()
        .replace(/[_\s]+/gu, '_')
        .toLowerCase();
}

/** Normalizes syntax only; full-title case rules remain wiki-specific. */
export function normalizeWikitextTitleKey(title: string): string {
    return title.replaceAll('_', ' ').trim();
}

export function getNamespaceId(
    catalog: NamespaceCatalog,
    prefix: string,
): number | undefined {
    return catalog.namespaceIds[normalizeNamespacePrefix(prefix)];
}

export function getNamespacePrefixes(
    catalog: NamespaceCatalog,
    namespaceId: number,
): readonly string[] {
    return catalog.namespacePrefixes[namespaceId] ?? emptyPrefixes;
}

export function getTitleNamespaceId(
    value: string,
    catalog: NamespaceCatalog,
): number {
    const entered = readEnteredNamespacePrefix(value);
    return entered == null ? 0 : (getNamespaceId(catalog, entered.prefix) ?? 0);
}

export function hasNamespacePrefix(
    value: string,
    catalog: NamespaceCatalog,
    namespaceId: number,
): boolean {
    const entered = readEnteredNamespacePrefix(value);
    return (
        entered != null &&
        getNamespaceId(catalog, entered.prefix) === namespaceId
    );
}

export function stripNamespacePrefix(
    value: string,
    catalog: NamespaceCatalog,
    namespaceId: number,
): string {
    const title = value.trim();
    const entered = readEnteredNamespacePrefix(title);
    if (
        entered == null ||
        getNamespaceId(catalog, entered.prefix) !== namespaceId
    ) {
        return title;
    }
    return title.slice(entered.separator + 1).trim();
}

export function formatNamespaceTitle(
    value: string,
    catalog: NamespaceCatalog,
    namespaceId: number,
): string {
    const prefix = getNamespacePrefixes(catalog, namespaceId)[0];
    if (prefix == null) {
        throw new RangeError(
            `Unknown ${catalog.databaseName} namespace ID: ${namespaceId}`,
        );
    }
    const title = stripNamespacePrefix(value, catalog, namespaceId);
    return prefix === '' ? title : `${prefix}:${title}`;
}

function readNamespaceAliases(
    values: unknown[],
    namespaceId: number,
): string[] {
    const aliases: string[] = [];
    for (const value of values) {
        const alias = readRecord(value);
        const aliasId = readNamespaceId(alias?.id);
        const name = readNamespaceName(alias);
        if (aliasId == null || name == null) throw invalidSiteinfoError();
        if (aliasId === namespaceId) aliases.push(name);
    }
    return aliases;
}

function readNamespaceId(value: unknown, fallback?: string): number | null {
    const namespaceId = typeof value === 'number' ? value : Number(fallback);
    return Number.isInteger(namespaceId) ? namespaceId : null;
}

function readNamespaceName(
    value: Record<string, unknown> | null,
): string | null {
    const name = value?.name ?? value?.alias;
    return typeof name === 'string' ? name : null;
}

function invalidSiteinfoError(): TypeError {
    return new TypeError('Invalid MediaWiki namespace siteinfo response.');
}

function uniquePrefixes(prefixes: readonly string[]): string[] {
    const seen = new Set<string>();
    return prefixes.filter((prefix, index) => {
        const normalized = normalizeNamespacePrefix(prefix);
        if ((prefix === '' && index > 0) || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
    });
}

function readEnteredNamespacePrefix(
    value: string,
): { prefix: string; separator: number } | null {
    const title = value.trim();
    let start = title.startsWith(':') ? 1 : 0;
    while (/\s/u.test(title[start] ?? '')) start += 1;
    const separator = title.indexOf(':', start);
    return separator < 0
        ? null
        : { prefix: title.slice(start, separator), separator };
}
