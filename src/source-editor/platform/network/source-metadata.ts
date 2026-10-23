/**
 * @file src/source-editor/platform/network/source-metadata.ts
 * Purpose: Resolves citation metadata and existing Wayback snapshots.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. SourceArchiveMetadata
 * 4. ResolvedSourceMetadata
 * 5. SourceMetadataOptions
 * 6. WaybackAvailabilityResponse
 * 7. fetchAvailableArchive
 * 8. resolveSourceMetadata
 * 9. fetchSourceCiteTemplate
 * 10. resolveSourceArchive
 * 11. requestAvailableArchive
 * 12. buildFallbackTemplate
 * 13. buildFallbackCitation
 * 14. getHttpSourceUrl
 * 15. getRejectedMessage
 * 16. buildAvailabilityUrl
 * 17. parseAvailableArchive
 */

import type { WikiPolicy } from '../../domain/wiki-policy.ts';
import * as citoid from '../../../library/citoid/client.ts';
import { buildCitationTemplate } from '../../domain/citation-metadata.ts';
import {
    formatWaybackDate,
    sanitizeSourceUrl,
} from '../../domain/source-url.ts';

const WAYBACK_AVAILABILITY_ENDPOINT = 'https://archive.org/wayback/available';

export interface SourceArchiveMetadata {
    archiveDate: string;
    archiveUrl: string;
}

export interface ResolvedSourceMetadata extends SourceArchiveMetadata {
    archiveError: string;
    citeTemplate: string;
    metadataError: string;
    originalUrl: string;
}

export interface SourceMetadataOptions {
    wikiPolicy?: WikiPolicy;
    fetcher?: typeof fetch;
    now?: Date;
}

interface WaybackAvailabilityResponse {
    archived_snapshots?: {
        closest?: {
            available?: boolean;
            timestamp?: string;
            url?: string;
        };
    };
}

/**
 * Finds the closest existing Wayback snapshot for one source URL.
 *
 * Network, HTTP, and malformed-response failures mean no snapshot.
 *
 * @param originalUrl - Original source URL.
 * @param options - Fetch options.
 * @returns Existing snapshot metadata, or null when none is available.
 */
export async function fetchAvailableArchive(
    originalUrl: string,
    options: SourceMetadataOptions = {},
): Promise<SourceArchiveMetadata | null> {
    try {
        return await requestAvailableArchive(originalUrl, options);
    } catch (_error) {
        return null;
    }
}

/**
 * Resolves a cite template and archive metadata for one source.
 *
 * A supplied archive seed comes from a pasted archive URL. It takes
 * priority over an Availability API lookup.
 *
 * @param sourceInput - Source URL, identifier, or citation text.
 * @param archiveSeed - Archive values parsed from the entered URL.
 * @param options - Fetch and access-date options.
 * @returns Citation template and archive values.
 */
export async function resolveSourceMetadata(
    sourceInput: string,
    archiveSeed: SourceArchiveMetadata | null = null,
    options: SourceMetadataOptions = {},
): Promise<ResolvedSourceMetadata> {
    const search = sourceInput.trim();
    const originalUrl = getHttpSourceUrl(search);
    const citeTemplatePromise = fetchSourceCiteTemplate(
        search,
        originalUrl,
        options,
    );
    const archivePromise = resolveSourceArchive(
        originalUrl,
        archiveSeed,
        options,
    );
    const [citationResult, archiveResult] = await Promise.allSettled([
        citeTemplatePromise,
        archivePromise,
    ]);
    const metadataError = getRejectedMessage(citationResult);
    const archiveError = getRejectedMessage(archiveResult);
    const citeTemplate =
        citationResult.status === 'fulfilled'
            ? citationResult.value
            : buildFallbackTemplate(search, originalUrl, options);
    const availableArchive =
        archiveResult.status === 'fulfilled' ? archiveResult.value : null;
    const archive = availableArchive ?? { archiveDate: '', archiveUrl: '' };

    return {
        archiveError,
        citeTemplate,
        metadataError,
        originalUrl,
        ...archive,
    };
}

/**
 * Fetches raw Citoid metadata, then maps it into editable wikitext.
 *
 * @param search - Search value.
 * @param originalUrl - Original url value.
 * @param options - Operation options.
 * @returns Operation result.
 */
async function fetchSourceCiteTemplate(
    search: string,
    originalUrl: string,
    options: SourceMetadataOptions,
): Promise<string> {
    try {
        const metadata = await citoid.fetchCitationMetadata(search, {
            fetcher: options.fetcher,
        });
        return buildCitationTemplate(metadata, {
            bibliographic: originalUrl === '',
            now: options.now,
            wikiPolicy: options.wikiPolicy,
            url: originalUrl || undefined,
        });
    } catch (error) {
        if (
            error instanceof citoid.CitoidRequestError &&
            error.status === 404
        ) {
            throw new Error('Citoid could not resolve the entered source.', {
                cause: error,
            });
        }
        throw error;
    }
}

/**
 * Chooses a seeded, remote, or empty archive result.
 *
 * @param originalUrl - Original url value.
 * @param archiveSeed - Archive seed value.
 * @param options - Operation options.
 * @returns Selected seeded, remote, or empty archive result.
 */
function resolveSourceArchive(
    originalUrl: string,
    archiveSeed: SourceArchiveMetadata | null,
    options: SourceMetadataOptions,
): Promise<SourceArchiveMetadata | null> {
    if (originalUrl === '') {
        return Promise.resolve(null);
    }
    return archiveSeed == null
        ? requestAvailableArchive(originalUrl, options)
        : Promise.resolve(archiveSeed);
}

/**
 * Requests Wayback Availability data, rejecting on failure.
 *
 * @param originalUrl - Original url value.
 * @param options - Operation options.
 * @returns Operation result.
 */
async function requestAvailableArchive(
    originalUrl: string,
    options: SourceMetadataOptions,
): Promise<SourceArchiveMetadata | null> {
    const requestUrl = buildAvailabilityUrl(originalUrl);
    const fetcher = options.fetcher ?? fetch;
    const response = await fetcher(requestUrl, {
        headers: { accept: 'application/json' },
    });
    if (!response.ok) {
        throw new Error(`Wayback request failed: HTTP ${response.status}`);
    }
    const data = (await response.json()) as WaybackAvailabilityResponse;
    return parseAvailableArchive(data);
}

/**
 * Builds a manual-editing draft when Citoid is unavailable.
 *
 * @param sourceInput - Source input value.
 * @param originalUrl - Original url value.
 * @param options - Operation options.
 * @returns Built manual-editing draft when Citoid is unavailable.
 */
function buildFallbackTemplate(
    sourceInput: string,
    originalUrl: string,
    options: SourceMetadataOptions,
): string {
    const citation = buildFallbackCitation(sourceInput, originalUrl);
    return buildCitationTemplate(citation, {
        bibliographic: originalUrl === '',
        now: options.now,
        wikiPolicy: options.wikiPolicy,
        url: originalUrl || undefined,
    });
}

/**
 * Builds a minimal editable citation for a failed lookup.
 *
 * @param sourceInput - Source input value.
 * @param originalUrl - Original url value.
 * @returns Built minimal editable citation for a failed lookup.
 */
function buildFallbackCitation(
    sourceInput: string,
    originalUrl: string,
): Record<string, string> {
    if (originalUrl !== '') {
        return { itemType: 'webpage', url: originalUrl };
    }
    const identifier = sourceInput.replace(
        /^(?:urn:)?(doi|isbn|issn)\s*:?\s*/iu,
        '',
    );
    if (/^10\.\d{4,9}\/\S+$/u.test(identifier)) {
        return { DOI: identifier, itemType: 'journalArticle' };
    }
    if (/^\d{4}-?\d{3}[\dX]$/iu.test(identifier)) {
        return { ISSN: identifier, itemType: 'journalArticle' };
    }
    if (/^(?:97[89][\d -]{10,}|[\dX][\dX -]{8,})$/iu.test(identifier)) {
        return { ISBN: identifier, itemType: 'book' };
    }
    return { itemType: 'webpage' };
}

/**
 * Returns a sanitized HTTP(S) source URL, or an empty string.
 *
 * @param value - Value to process.
 * @returns A sanitized HTTP(S) source URL, or an empty string.
 */
function getHttpSourceUrl(value: string): string {
    try {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return '';
        }
        return sanitizeSourceUrl(value);
    } catch {
        return '';
    }
}

/**
 * Gets a readable failure from one settled operation.
 *
 * @param result - Result value.
 * @returns Resulting text.
 */
function getRejectedMessage(result: PromiseSettledResult<unknown>): string {
    if (result.status === 'fulfilled') {
        return '';
    }
    return result.reason instanceof Error
        ? result.reason.message
        : String(result.reason);
}

/**
 * Builds a Wayback Availability API request URL.
 *
 * @param originalUrl - Original url value.
 * @returns Built Wayback Availability API request URL.
 */
function buildAvailabilityUrl(originalUrl: string): string {
    const params = new URLSearchParams({ url: originalUrl.trim() });
    return `${WAYBACK_AVAILABILITY_ENDPOINT}?${params.toString()}`;
}

/**
 * Parses one successful Wayback Availability API response.
 *
 * @param data - Data value.
 * @returns Parsed successful Wayback Availability API response.
 */
function parseAvailableArchive(
    data: WaybackAvailabilityResponse,
): SourceArchiveMetadata | null {
    const closest = data?.archived_snapshots?.closest;
    if (closest?.available !== true || !closest.url) {
        return null;
    }

    const archiveDate = formatWaybackDate(closest.timestamp ?? '');
    if (archiveDate === '') {
        return null;
    }

    return {
        archiveDate,
        archiveUrl: sanitizeSourceUrl(closest.url),
    };
}
