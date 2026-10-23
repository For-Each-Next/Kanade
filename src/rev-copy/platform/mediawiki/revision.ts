/**
 * @file src/rev-copy/platform/mediawiki/revision.ts
 * Purpose: Fetch, validate, and reuse timestamps for exactly the displayed revision.
 *
 * Contents: Exact-revision timestamp validation and bounded tab caching.
 */

import { isObject as isRecord } from '../../../library/data-validation/records';
import { isRevisionTimestamp } from './response';

const maxCachedTimestamps = 200;
const tabCaches = new WeakMap<object, Map<string, Promise<string>>>();

async function fetchRevisionTimestamp(revisionId: number): Promise<string> {
    const response: unknown = await new mw.Api().get({
        action: 'query',
        prop: 'revisions',
        revids: revisionId,
        rvprop: 'ids|timestamp',
        formatversion: 2,
    });
    if (
        isRecord(response) &&
        isRecord(response.query) &&
        Array.isArray(response.query.pages)
    ) {
        for (const page of response.query.pages as unknown[]) {
            if (!isRecord(page) || !Array.isArray(page.revisions)) continue;
            for (const revision of page.revisions as unknown[]) {
                if (
                    isRecord(revision) &&
                    revision.revid === revisionId &&
                    isRevisionTimestamp(revision.timestamp)
                ) {
                    return revision.timestamp;
                }
            }
        }
    }
    throw new Error('The displayed revision timestamp is unavailable.');
}

export async function getRevisionTimestamp(
    revisionId: number,
): Promise<string> {
    if (!Number.isSafeInteger(revisionId) || revisionId <= 0)
        throw new Error('The displayed revision ID is unavailable.');
    let cache = tabCaches.get(mw);
    if (!cache) {
        cache = new Map();
        tabCaches.set(mw, cache);
    }
    const key = JSON.stringify([
        mw.config.get('wgServerName') || location.hostname,
        mw.config.get('wgScriptPath') || '/w',
        revisionId,
    ]);
    const existing = cache.get(key);
    if (existing) {
        cache.delete(key);
        cache.set(key, existing);
        return existing;
    }
    const request = fetchRevisionTimestamp(revisionId);
    cache.set(key, request);
    if (cache.size > maxCachedTimestamps)
        cache.delete(cache.keys().next().value!);
    void request.catch(() => {
        if (cache.get(key) === request) cache.delete(key);
    });
    return request;
}
