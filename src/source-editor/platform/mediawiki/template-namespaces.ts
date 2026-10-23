/**
 * @file src/source-editor/platform/mediawiki/template-namespaces.ts
 * Purpose: Template namespace discovery with static Wikipedia fast paths.
 *
 * Table of contents:
 * 1. Imports
 * 2. CitationNamespaceApi
 * 3. TemplateNameContextResolver
 * 4. createTemplateNameContextResolver
 * 5. loadNamespaceCatalog
 * 6. getStaticSource
 */

import {
    decodeNamespaceCatalog,
    getNamespacePrefixes,
    type NamespaceCatalog,
    type NamespaceDatabaseName,
} from '../../../library/wiki-titles/wikipedia.ts';
import {
    createTemplateNameContext,
    DEFAULT_TEMPLATE_NAME_CONTEXT,
    type TemplateNameContext,
} from '../../domain/templates.ts';

export interface CitationNamespaceApi {
    get(parameters: Record<string, unknown>): PromiseLike<unknown>;
}

export interface TemplateNameContextResolver {
    current(): TemplateNameContext;
    load(api: CitationNamespaceApi): Promise<TemplateNameContext>;
}

/**
 * Creates a memoized current-wiki Template namespace resolver.
 *
 * English and Chinese Wikipedia use static catalogs without a request.
 * Other databases keep the fallback if siteinfo is unavailable.
 * A failed request may be retried by a later dialog open.
 */
export function createTemplateNameContextResolver(
    databaseName: string,
): TemplateNameContextResolver {
    const staticSource = getStaticSource(databaseName);
    let context =
        staticSource == null
            ? DEFAULT_TEMPLATE_NAME_CONTEXT
            : createTemplateNameContext(staticSource);
    let loaded = staticSource != null;
    let pending: Promise<TemplateNameContext> | null = null;

    return Object.freeze({
        current(): TemplateNameContext {
            return context;
        },
        load(api: CitationNamespaceApi): Promise<TemplateNameContext> {
            if (loaded) {
                return Promise.resolve(context);
            }
            if (pending != null) {
                return pending;
            }
            pending = loadNamespaceCatalog(api, databaseName)
                .then(function useNamespaceCatalog(catalog) {
                    context = createTemplateNameContext(catalog);
                    loaded = true;
                    return context;
                })
                .catch(() => context)
                .finally(function clearPending() {
                    pending = null;
                });
            return pending;
        },
    });
}

async function loadNamespaceCatalog(
    api: CitationNamespaceApi,
    databaseName: string,
): Promise<NamespaceCatalog> {
    const response = await api.get({
        action: 'query',
        formatversion: 2,
        meta: 'siteinfo',
        siprop: 'namespaces|namespacealiases',
    });
    const catalog = decodeNamespaceCatalog(databaseName, response);
    if (getNamespacePrefixes(catalog, 10).length === 0) {
        throw new TypeError(`Missing Template namespace for ${databaseName}.`);
    }
    return catalog;
}

function getStaticSource(databaseName: string): NamespaceDatabaseName | null {
    return databaseName === 'enwiki' || databaseName === 'zhwiki'
        ? databaseName
        : null;
}
