/**
 * @file src/source-editor/platform/mediawiki/template-data.ts
 * Purpose: Loads generic citation TemplateData with a small MediaWiki cache.
 *
 * Contents: Bounded metadata loading, runtime validation, and disposable caching.
 */

import { isObject as isRecord } from '../../../library/data-validation/records.ts';
import {
    isSafeParameterName,
    readParameterNames,
} from '../../domain/template-data-snapshot.ts';

import {
    DEFAULT_TEMPLATE_NAME_CONTEXT,
    getCanonicalTemplateName,
    isCitePrefixedTemplate,
    isMetadataFreeCitationTemplate,
    type TemplateNameContext,
} from '../../domain/templates.ts';
import type {
    CitationTemplateData,
    CitationTemplateDataMap,
} from '../../domain/types.ts';
import {
    chunkTemplateNames,
    loadTemplateData,
    type MediaWikiTemplateDataApi,
    type TemplateDataPage,
} from './template-data/api.ts';

export type { MediaWikiTemplateDataApi } from './template-data/api.ts';

const BATCH_SIZE = 20;
const CACHE_ENTRY_LIMIT = 64;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const PARAMETER_LIMIT = 512;
const STRING_LENGTH_LIMIT = 255;
export const TEMPLATE_DATA_CACHE_KEY = 'kanade:source-editor:template-data:v1';

export interface TemplateDataObjectStorage {
    getObject(key: string): unknown;
    setObject(key: string, value: unknown): unknown;
}

export interface CitationTemplateDataLoadOptions {
    api: MediaWikiTemplateDataApi;
    now?: () => number;
    storage?: TemplateDataObjectStorage;
    templateNameContext?: TemplateNameContext;
    wikiId: string;
}

/**
 * Adapts browser key-value storage to the cache's object interface.
 *
 * @param storage - Storage value.
 * @returns Operation result.
 */
export function createTemplateDataObjectStorage(
    storage: Pick<Storage, 'getItem' | 'setItem'>,
): TemplateDataObjectStorage {
    return {
        getObject(key) {
            const value = storage.getItem(key);
            return value == null ? null : JSON.parse(value);
        },
        setObject(key, value) {
            storage.setItem(key, JSON.stringify(value));
        },
    };
}

interface CachedTemplateData extends CitationTemplateData {
    fetchedAt: number;
}

interface ResolvedTemplateData extends CitationTemplateData {
    canonicalName: string;
}

interface TemplateDataCache {
    entries: Record<string, CachedTemplateData>;
    version: 1;
    wikiId: string;
}

interface FetchedTemplateDataBatch {
    entries: CitationTemplateDataMap;
    refreshedNames: string[];
}

interface ResolvedCacheEntries {
    pending: string[];
    result: CitationTemplateDataMap;
}

/**
 * Resolves cached entries and downloads remaining template metadata.
 *
 * Failures retain stale cache entries or fall back to raw formatting.
 *
 * @param names - Names to process.
 * @param options - Operation options.
 * @returns Value.
 */
export async function loadCitationTemplateData(
    names: string[],
    options: CitationTemplateDataLoadOptions,
): Promise<CitationTemplateDataMap> {
    const requested = getRequestedTemplateNames(
        names,
        options.templateNameContext ?? DEFAULT_TEMPLATE_NAME_CONTEXT,
    );
    if (requested.length === 0) {
        return {};
    }
    const now = options.now?.() ?? Date.now();
    const cache = readTemplateDataCache(options.storage, options.wikiId);
    const { pending, result } = resolveCacheEntries(requested, cache, now);
    const downloaded = await fetchTemplateDataBatches(pending, options.api);
    applyDownloadedEntries(downloaded, result, cache, now);
    pruneCache(cache);
    writeTemplateDataCache(options.storage, cache);
    return result;
}

function resolveCacheEntries(
    requested: string[],
    cache: TemplateDataCache,
    now: number,
): ResolvedCacheEntries {
    const result: CitationTemplateDataMap = {};
    const pending: string[] = [];
    for (const name of requested) {
        const cached = cache.entries[name];
        if (cached != null) {
            result[name] = removeCacheTimestamp(cached);
        }
        if (cached == null || now - cached.fetchedAt >= CACHE_TTL_MS) {
            pending.push(name);
        }
    }
    return { pending, result };
}

async function fetchTemplateDataBatches(
    pending: string[],
    api: MediaWikiTemplateDataApi,
): Promise<FetchedTemplateDataBatch[]> {
    const batches = chunkTemplateNames(pending, BATCH_SIZE);
    const result: FetchedTemplateDataBatch[] = [];
    for (const batch of batches) {
        try {
            result.push({
                entries: await fetchTemplateDataBatch(batch, api),
                refreshedNames: batch,
            });
        } catch {
            result.push({ entries: {}, refreshedNames: [] });
        }
    }
    return result;
}

function applyDownloadedEntries(
    downloaded: FetchedTemplateDataBatch[],
    result: CitationTemplateDataMap,
    cache: TemplateDataCache,
    now: number,
): void {
    for (const { entries, refreshedNames } of downloaded) {
        for (const name of refreshedNames) {
            evictRefreshedEntry(name, result, cache);
        }
        for (const [name, metadata] of Object.entries(entries)) {
            result[name] = metadata;
            cache.entries[name] = { ...metadata, fetchedAt: now };
        }
    }
}

function evictRefreshedEntry(
    name: string,
    result: CitationTemplateDataMap,
    cache: TemplateDataCache,
): void {
    const canonicalName = cache.entries[name]?.canonicalName;
    for (const [key, entry] of Object.entries(cache.entries)) {
        if (key === name || entry.canonicalName === canonicalName) {
            delete cache.entries[key];
            delete result[key];
        }
    }
}

function getRequestedTemplateNames(
    names: string[],
    templateNameContext: TemplateNameContext,
): string[] {
    const normalized = names
        .filter((name) =>
            isMetadataFreeCitationTemplate(name, templateNameContext),
        )
        .map((name) => getCanonicalTemplateName(name, templateNameContext))
        .filter((name) => isSafeTemplateName(name, templateNameContext));
    return [...new Set(normalized)].slice(0, CACHE_ENTRY_LIMIT);
}

async function fetchTemplateDataBatch(
    names: string[],
    api: MediaWikiTemplateDataApi,
): Promise<CitationTemplateDataMap> {
    const pages = await loadTemplateData(names, {
        api,
        batchSize: BATCH_SIZE,
    });
    return parseTemplateDataPages(pages, names);
}

function parseTemplateDataPages(
    pages: ReadonlyMap<string, TemplateDataPage>,
    requested: string[],
): CitationTemplateDataMap {
    const result: CitationTemplateDataMap = {};
    for (const requestedName of requested) {
        const metadata = parseApiPage(pages.get(requestedName));
        if (metadata != null) {
            result[requestedName] = metadata;
            result[normalizeBareTemplateTitle(metadata.canonicalName ?? '')] =
                metadata;
        }
    }
    return result;
}

function parseApiPage(
    page: TemplateDataPage | undefined,
): ResolvedTemplateData | null {
    if (
        page == null ||
        page.ns !== 10 ||
        typeof page.title !== 'string' ||
        !isRecord(page.params)
    ) {
        return null;
    }
    const canonicalName = normalizeApiTemplateTitle(page.title);
    if (!isSafeTemplateName(canonicalName)) {
        return null;
    }
    const parsedParams = parseApiParameters(page.params);
    if (parsedParams == null) {
        return null;
    }
    const paramOrder = buildCompleteParamOrder(
        page.paramOrder,
        parsedParams.parameterNames,
    );
    if (paramOrder == null) {
        return null;
    }
    return {
        aliases: Object.fromEntries(parsedParams.aliasEntries),
        canonicalName,
        paramOrder,
    };
}

function parseApiParameters(paramsValue: Record<string, unknown>): {
    aliasEntries: Array<[string, string[]]>;
    parameterNames: string[];
} | null {
    const aliasEntries: Array<[string, string[]]> = [];
    const parameterNames: string[] = [];
    const params = Object.entries(paramsValue);
    if (params.length > PARAMETER_LIMIT) {
        return null;
    }
    for (const [name, value] of params) {
        if (!isSafeParameterName(name) || !isRecord(value)) {
            return null;
        }
        const aliases = readParameterNames(value.aliases);
        if (aliases == null) {
            return null;
        }
        parameterNames.push(name);
        aliasEntries.push([name, aliases]);
    }
    return { aliasEntries, parameterNames };
}

function buildCompleteParamOrder(
    value: unknown,
    parameterNames: string[],
): string[] | null {
    const readOrder = readParameterNames(value);
    if (readOrder == null) {
        return null;
    }
    const enteredOrder = [...new Set(readOrder)].slice(0, PARAMETER_LIMIT);
    const missingFromOrder = parameterNames.filter(
        (name) => !enteredOrder.includes(name),
    );
    return [...enteredOrder, ...missingFromOrder].slice(0, PARAMETER_LIMIT);
}

function normalizeApiTemplateTitle(value: string): string {
    return normalizeBareTemplateTitle(stripApiTemplateNamespace(value));
}

/**
 * Removes a localized prefix after the API page was validated as ns 10.
 *
 * @param value - API-returned template page title.
 * @returns Bare template title.
 */
function stripApiTemplateNamespace(value: string): string {
    const entered = value.trim();
    const separator = entered.indexOf(':');
    return separator < 0 ? entered : entered.slice(separator + 1).trim();
}

function normalizeBareTemplateTitle(value: string): string {
    return getCanonicalTemplateName(value);
}

function isSafeTemplateName(
    value: unknown,
    templateNameContext: TemplateNameContext = DEFAULT_TEMPLATE_NAME_CONTEXT,
): value is string {
    return (
        typeof value === 'string' &&
        value !== '' &&
        value.length <= STRING_LENGTH_LIMIT &&
        isCitePrefixedTemplate(value, templateNameContext) &&
        !/[#<>[\]|{}\r\n]/u.test(value)
    );
}

function readTemplateDataCache(
    storage: TemplateDataObjectStorage | undefined,
    wikiId: string,
): TemplateDataCache {
    try {
        const stored = storage?.getObject(TEMPLATE_DATA_CACHE_KEY);
        if (isTemplateDataCache(stored, wikiId)) {
            return stored;
        }
    } catch {
        // Storage can fail in privacy modes.
    }
    return { entries: {}, version: 1, wikiId };
}

function isTemplateDataCache(
    value: unknown,
    wikiId: string,
): value is TemplateDataCache {
    if (
        !isRecord(value) ||
        value.version !== 1 ||
        value.wikiId !== wikiId ||
        !isRecord(value.entries)
    ) {
        return false;
    }
    return Object.values(value.entries).every(isCachedTemplateData);
}

function isCachedTemplateData(value: unknown): value is CachedTemplateData {
    return (
        isRecord(value) &&
        typeof value.fetchedAt === 'number' &&
        Number.isFinite(value.fetchedAt) &&
        isCitationTemplateData(value)
    );
}

function isCitationTemplateData(value: Record<string, unknown>): boolean {
    if (
        !isSafeTemplateName(value.canonicalName) ||
        !Array.isArray(value.paramOrder) ||
        value.paramOrder.length > PARAMETER_LIMIT ||
        !value.paramOrder.every(isSafeParameterName) ||
        !isRecord(value.aliases)
    ) {
        return false;
    }
    const entries = Object.entries(value.aliases);
    return (
        entries.length <= PARAMETER_LIMIT &&
        entries.every(
            ([name, aliases]) =>
                isSafeParameterName(name) &&
                Array.isArray(aliases) &&
                aliases.length <= PARAMETER_LIMIT &&
                aliases.every(isSafeParameterName),
        )
    );
}

function removeCacheTimestamp(
    cached: CachedTemplateData,
): CitationTemplateData {
    const { aliases, canonicalName, paramOrder } = cached;
    return { aliases, canonicalName, paramOrder };
}

function pruneCache(cache: TemplateDataCache): void {
    const sorted = Object.entries(cache.entries).sort(
        (left, right) => right[1].fetchedAt - left[1].fetchedAt,
    );
    cache.entries = Object.fromEntries(sorted.slice(0, CACHE_ENTRY_LIMIT));
}

function writeTemplateDataCache(
    storage: TemplateDataObjectStorage | undefined,
    cache: TemplateDataCache,
): void {
    try {
        storage?.setObject(TEMPLATE_DATA_CACHE_KEY, cache);
    } catch {
        // Formatting does not depend on persistent storage.
    }
}
