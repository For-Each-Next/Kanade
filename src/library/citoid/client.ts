/**
 * @file src/library/citoid/client.ts
 * Purpose: Fetch raw citation metadata through the host wiki's Citoid endpoint.
 * Contents: Injected requests, HTTP errors, and response validation.
 */

import { isRecord } from '../data-validation/records.ts';

export type CitationMetadata = Record<string, unknown>;

interface CitationMetadataOptions {
    fetcher?: typeof fetch;
}

export class CitoidRequestError extends Error {
    override name = 'CitoidRequestError';
    readonly status: number;

    constructor(status: number) {
        super(`Citoid request failed: HTTP ${status}`);
        this.status = status;
    }
}

/** Return the first metadata record without changing its fields. */
export async function fetchCitationMetadata(
    search: string,
    options: CitationMetadataOptions = {},
): Promise<CitationMetadata> {
    const query = search.trim();
    if (!query) {
        throw new Error('Enter a source before fetching citation metadata.');
    }
    const fetcher = options.fetcher ?? fetch;
    const response = await fetcher(
        `/api/rest_v1/data/citation/zotero/${encodeURIComponent(query)}`,
        { headers: { accept: 'application/json' } },
    );
    if (!response.ok) throw new CitoidRequestError(response.status);
    const citations: unknown = await response.json();
    const first: unknown = Array.isArray(citations) ? citations[0] : undefined;
    if (!isRecord(first)) {
        throw new Error('Citoid did not return citation metadata.');
    }
    return first;
}
