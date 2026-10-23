/**
 * @file src/source-editor/platform/mediawiki/template-data/api.ts
 * Purpose: Loads TemplateData from a MediaWiki API in bounded, serial batches.
 *
 * Contents: API contracts, request batching, validated responses, and title mappings.
 */

import { isObject as isRecord } from '../../../../library/data-validation/records.ts';

import {
    formatNamespaceTitle,
    stripNamespacePrefix,
} from '../../../../library/wiki-titles/wikipedia.ts';

const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 50;
const TITLE_LENGTH_LIMIT = 255;

/** Minimal MediaWiki API contract required by the loader. */
export interface MediaWikiTemplateDataApi {
    get(parameters: Record<string, unknown>): PromiseLike<unknown>;
}

/** One validated page returned by `action=templatedata`. */
export interface TemplateDataPage {
    readonly [key: string]: unknown;
    readonly title: string;
}

/** TemplateData pages keyed by the requested bare template name. */
export type TemplateDataPageMap = ReadonlyMap<string, TemplateDataPage>;

/** Configuration for single-template and bulk TemplateData requests. */
export interface TemplateDataLoadOptions {
    api: MediaWikiTemplateDataApi;
    batchSize?: number;
    requestParameters?: Readonly<Record<string, unknown>>;
}

interface ApiTitleMapping {
    from?: unknown;
    to?: unknown;
}

/**
 * Loads one template's TemplateData.
 *
 * Returns `null` when TemplateData is unavailable.
 *
 * @param name - Name to process.
 * @param options - Operation options.
 * @returns Loaded template's TemplateData.
 */
export function loadTemplateData(
    name: string,
    options: TemplateDataLoadOptions,
): Promise<TemplateDataPage | null>;

/**
 * Loads any number of templates in bounded, serial API requests.
 *
 * Map keys are trimmed, bare template names. English Wikipedia template
 * namespace prefixes are accepted as input as well.
 *
 * @param names - Names to process.
 * @param options - Operation options.
 * @returns Loaded TemplateData pages keyed by requested name.
 */
export function loadTemplateData(
    names: Iterable<string>,
    options: TemplateDataLoadOptions,
): Promise<TemplateDataPageMap>;

export async function loadTemplateData(
    names: string | Iterable<string>,
    options: TemplateDataLoadOptions,
): Promise<TemplateDataPage | null | TemplateDataPageMap> {
    const singleName = typeof names === 'string';
    const requested = normalizeRequestedNames(singleName ? [names] : names);
    const batchSize = getBatchSize(options.batchSize);
    const result = new Map<string, TemplateDataPage>();
    for (const batch of chunkTemplateNames(requested, batchSize)) {
        const loaded = await loadTemplateDataBatch(batch, options);
        for (const [name, page] of loaded) {
            result.set(name, page);
        }
    }
    return singleName ? (result.get(requested[0] ?? '') ?? null) : result;
}

async function loadTemplateDataBatch(
    names: string[],
    options: TemplateDataLoadOptions,
): Promise<Map<string, TemplateDataPage>> {
    const response = await options.api.get({
        ...options.requestParameters,
        action: 'templatedata',
        formatversion: 2,
        redirects: true,
        titles: names.map(toTemplateTitle).join('|'),
    });
    return parseTemplateDataResponse(response, names);
}

function parseTemplateDataResponse(
    response: unknown,
    requested: string[],
): Map<string, TemplateDataPage> {
    if (!isRecord(response) || !isApiPages(response.pages)) {
        throw new TypeError('Invalid TemplateData API response');
    }
    const pages = new Map<string, TemplateDataPage>();
    for (const value of getApiPages(response.pages)) {
        const page = parseTemplateDataPage(value);
        if (page != null) {
            pages.set(normalizeFullTitle(page.title), page);
        }
    }
    const mappings = buildTitleMappings(response);
    const result = new Map<string, TemplateDataPage>();
    for (const name of requested) {
        const title = followTitleMappings(toTemplateTitle(name), mappings);
        const page = pages.get(title);
        if (page != null) {
            result.set(name, page);
        }
    }
    return result;
}

function parseTemplateDataPage(
    value: Record<string, unknown>,
): TemplateDataPage | null {
    if (
        isApiFlag(value.missing) ||
        isApiFlag(value.notemplatedata) ||
        typeof value.title !== 'string' ||
        !isRecord(value.params)
    ) {
        return null;
    }
    return value as TemplateDataPage;
}

function normalizeRequestedNames(names: Iterable<string>): string[] {
    const result: string[] = [];
    const seen = new Set<string>();
    for (const value of names) {
        if (typeof value !== 'string') {
            throw new TypeError('Template names must be strings');
        }
        const name = stripTemplateNamespace(value.trim());
        if (!isSafeTemplateName(name)) {
            throw new TypeError(
                `Invalid template name: ${JSON.stringify(value)}`,
            );
        }
        if (!seen.has(name)) {
            seen.add(name);
            result.push(name);
        }
    }
    return result;
}

function getBatchSize(value: number | undefined): number {
    const batchSize = value ?? DEFAULT_BATCH_SIZE;
    if (
        !Number.isInteger(batchSize) ||
        batchSize < 1 ||
        batchSize > MAX_BATCH_SIZE
    ) {
        throw new RangeError(
            `TemplateData batch size must be between 1 and ${MAX_BATCH_SIZE}`,
        );
    }
    return batchSize;
}

/** Partitions template names using a validated positive request batch size. */
export function chunkTemplateNames(
    names: string[],
    batchSize: number,
): string[][] {
    const result: string[][] = [];
    for (let index = 0; index < names.length; index += batchSize) {
        result.push(names.slice(index, index + batchSize));
    }
    return result;
}

function buildTitleMappings(
    response: Record<string, unknown>,
): Map<string, string> {
    const result = new Map<string, string>();
    for (const key of ['normalized', 'redirects']) {
        const entries = Array.isArray(response[key]) ? response[key] : [];
        for (const entry of entries) {
            const mapping = parseTitleMapping(entry);
            if (mapping != null) {
                result.set(mapping.from, mapping.to);
            }
        }
    }
    return result;
}

function parseTitleMapping(
    value: unknown,
): { from: string; to: string } | null {
    if (!isRecord(value)) {
        return null;
    }
    const mapping = value as ApiTitleMapping;
    if (typeof mapping.from !== 'string' || typeof mapping.to !== 'string') {
        return null;
    }
    return {
        from: normalizeFullTitle(mapping.from),
        to: normalizeFullTitle(mapping.to),
    };
}

function followTitleMappings(
    value: string,
    mappings: Map<string, string>,
): string {
    let current = normalizeFullTitle(value);
    const seen = new Set<string>();
    while (!seen.has(current)) {
        seen.add(current);
        const next = mappings.get(current);
        if (next == null) {
            break;
        }
        current = next;
    }
    return current;
}

function getApiPages(
    value: unknown[] | Record<string, unknown>,
): Array<Record<string, unknown>> {
    const pages = Array.isArray(value) ? value : Object.values(value);
    return pages.filter(isRecord);
}

function isApiPages(
    value: unknown,
): value is unknown[] | Record<string, unknown> {
    return Array.isArray(value) || isRecord(value);
}

function toTemplateTitle(name: string): string {
    return formatNamespaceTitle(name, 'enwiki', 10);
}

function stripTemplateNamespace(value: string): string {
    return stripNamespacePrefix(value, 'enwiki', 10);
}

function normalizeFullTitle(value: string): string {
    return value.trim().replaceAll('_', ' ');
}

function isSafeTemplateName(value: string): boolean {
    return (
        value !== '' &&
        value.length <= TITLE_LENGTH_LIMIT &&
        // Reject control characters that cannot form a safe wikitext name.
        // eslint-disable-next-line no-control-regex
        !/[#<>[\]|{}\r\n\u0000-\u001f\u007f]/u.test(value)
    );
}

function isApiFlag(value: unknown): boolean {
    return value === true || value === '';
}
