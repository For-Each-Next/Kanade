/**
 * @file src/library/wiki-titles/canonical.ts
 * Purpose: Apply live namespace catalogs with a minimal canonical fallback for unverified sites.
 *
 * Contents: Explicit fallback policy and catalog-based title operations.
 */

import * as catalog from './catalog.ts';
import type { NamespaceCatalog } from './catalog.ts';

export type { NamespaceCatalog } from './catalog.ts';
export {
    decodeNamespaceCatalog,
    normalizeWikitextTitleKey,
} from './catalog.ts';

export type NamespaceSource = string | NamespaceCatalog;

const canonical = catalog.createNamespaceCatalog('', {
    0: [''],
    6: ['File'],
    10: ['Template'],
    14: ['Category'],
});

function resolveCatalog(source: NamespaceSource): NamespaceCatalog {
    return typeof source === 'string'
        ? { ...canonical, databaseName: source }
        : source;
}

export function getNamespaceId(
    source: NamespaceSource,
    prefix: string,
): number | undefined {
    return catalog.getNamespaceId(resolveCatalog(source), prefix);
}

export function getNamespacePrefixes(
    source: NamespaceSource,
    namespaceId: number,
): readonly string[] {
    return catalog.getNamespacePrefixes(resolveCatalog(source), namespaceId);
}

export function stripNamespacePrefix(
    value: string,
    source: NamespaceSource,
    namespaceId: number,
): string {
    return catalog.stripNamespacePrefix(
        value,
        resolveCatalog(source),
        namespaceId,
    );
}

export function formatNamespaceTitle(
    value: string,
    source: NamespaceSource,
    namespaceId: number,
): string {
    return catalog.formatNamespaceTitle(
        value,
        resolveCatalog(source),
        namespaceId,
    );
}
