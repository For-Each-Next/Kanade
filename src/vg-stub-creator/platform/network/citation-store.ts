/**
 * @file src/vg-stub-creator/platform/network/citation-store.ts
 * Purpose: Deduplicates citation acquisition and explicit source refreshes.
 * Contents: Citation cache ownership, Citoid fallback, and prefetch.
 */

import { buildCiteTemplate } from '../../domain/citations/index.ts';
import * as fallback from './fallback-citation.ts';
import * as citoid from '../../../library/citoid/client.ts';

const HTTP_NOT_FOUND = 404;

export interface CitationStore {
    fetch(url: string): Promise<string>;
    prefetch(url: string): void;
    refetch(url: string): Promise<string>;
}

export interface CitationStoreOptions {
    fetcher?: typeof fetch;
    now?: Date;
}

/** Keeps one current citation request per source, including explicit refreshes. */
export function createCitationStore(
    options: CitationStoreOptions = {},
): CitationStore {
    const cache = new Map<string, string>();
    const pending = new Map<string, Promise<string>>();

    function startRequest(key: string): Promise<string> {
        const request = fetchCitationTemplate(key, options)
            .then((template) => {
                if (pending.get(key) === request) cache.set(key, template);
                return template;
            })
            .finally(() => {
                if (pending.get(key) === request) pending.delete(key);
            });
        pending.set(key, request);
        return request;
    }

    function fetchCitation(url: string): Promise<string> {
        const key = url.trim();
        const cached = cache.get(key);
        if (cached != null) return Promise.resolve(cached);
        return pending.get(key) ?? startRequest(key);
    }

    return {
        fetch: fetchCitation,
        prefetch(url): void {
            if (!isFetchableSourceUrl(url)) return;
            void fetchCitation(url).catch(() => {
                // Prefetch is opportunistic; an explicit fetch reports failures.
            });
        },
        refetch(url): Promise<string> {
            const key = url.trim();
            cache.delete(key);
            return startRequest(key);
        },
    };
}

/** Fetches raw metadata before applying article citation formatting. */
async function fetchCitationTemplate(
    url: string,
    options: CitationStoreOptions,
): Promise<string> {
    try {
        const metadata = await citoid.fetchCitationMetadata(url, options);
        return buildCiteTemplate(metadata, {
            now: options.now,
            url,
        });
    } catch (error) {
        if (
            !(error instanceof citoid.CitoidRequestError) ||
            error.status !== HTTP_NOT_FOUND
        ) {
            throw error;
        }
        return fallback.buildFallbackCiteWebTemplate(url, options);
    }
}

/** Prefetch accepts HTTP sources while explicit acquisition validates its input. */
function isFetchableSourceUrl(url: string): boolean {
    try {
        return ['http:', 'https:'].includes(new URL(url.trim()).protocol);
    } catch {
        return false;
    }
}
