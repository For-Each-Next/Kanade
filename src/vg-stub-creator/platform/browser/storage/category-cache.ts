/**
 * @file src/vg-stub-creator/platform/browser/storage/category-cache.ts
 * Purpose: Validates and expires per-page category resolution caches.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. CategoryCacheStore
 * 4. CachedCategoryResolution
 * 5. createCategoryCacheStore
 * 6. restoreCategoryResolutions
 * 7. isCategoryResolution
 * 8. isObjectRecord
 * 9. isFreshCategoryResolution
 * 10. readJsonStorage
 * 11. writeJsonStorage
 * 12. removeStorageItem
 */

import { isRecord as isObjectRecord } from '../../../../library/data-validation/records.ts';

import type { TitleResolution } from '../../mediawiki/title-resolver.ts';

const CATEGORY_CACHE_STORAGE_PREFIX = 'vg-stub-creator-category-cache:';
const CATEGORY_CACHE_VERSION = 1;
const EXISTING_CATEGORY_MAX_AGE = 24 * 60 * 60 * 1000;
const MISSING_CATEGORY_MAX_AGE = 60 * 60 * 1000;

/**
 * Browser-backed category resolution cache.
 */
interface CategoryCacheStore {
    cache: Record<string, any>;
    clear: () => void;
    save: () => void;
}

interface CachedCategoryResolution {
    observedAt: number;
    resolution: TitleResolution;
}

/**
 * Creates a category cache backed by browser storage.
 *
 * @param page - Current page title.
 * @param storage - Browser storage implementation.
 * @param now - Current time in milliseconds, injectable for offline tests.
 * @returns Category cache store.
 */
export function createCategoryCacheStore(
    page: string,
    storage: Storage = localStorage,
    now: () => number = Date.now,
): CategoryCacheStore {
    const storageKey = `${CATEGORY_CACHE_STORAGE_PREFIX}${page}`;
    const entries = restoreCategoryResolutions(
        readJsonStorage(storage, storageKey),
        now(),
    );
    const resolutions: Record<string, any> = Object.create(null);
    for (const [key, entry] of entries) resolutions[key] = entry.resolution;

    const discardExpired = (key: string): void => {
        const entry = entries.get(key);
        if (entry == null || !isFreshCategoryResolution(entry, now())) {
            entries.delete(key);
            delete resolutions[key];
        }
    };
    const cache = new Proxy(resolutions, {
        get(target, key) {
            if (typeof key === 'string') discardExpired(key);
            return Reflect.get(target, key);
        },
        set(target, key, value) {
            if (typeof key !== 'string') return false;
            if (!isCategoryResolution(value)) {
                entries.delete(key);
                delete target[key];
                return true;
            }
            if (entries.get(key)?.resolution !== value) {
                entries.set(key, { observedAt: now(), resolution: value });
            }
            target[key] = value;
            return true;
        },
        ownKeys(target) {
            for (const key of Object.keys(target)) discardExpired(key);
            return Reflect.ownKeys(target);
        },
        deleteProperty(target, key) {
            if (typeof key === 'string') entries.delete(key);
            return Reflect.deleteProperty(target, key);
        },
    });

    const result: CategoryCacheStore = {
        cache,

        /**
         * Clears cached category resolutions.
         *
         * @returns Result when the function
         *   clears cached category resolutions.
         */
        clear(): void {
            Object.keys(cache).forEach(function callback(key) {
                delete cache[key];
            });
            removeStorageItem(storage, storageKey);
        },

        /**
         * Saves current category resolutions.
         *
         * @returns Result when the function
         *   saves current category resolutions.
         */
        save(): void {
            const persisted: Record<string, CachedCategoryResolution> =
                Object.create(null);
            for (const key of Object.keys(cache)) {
                const entry = entries.get(key);
                if (entry != null) persisted[key] = entry;
            }
            writeJsonStorage(storage, storageKey, {
                version: CATEGORY_CACHE_VERSION,
                entries: persisted,
            });
        },
    };
    return result;
}

/** Restores fresh entries only from the current validated cache envelope. */
function restoreCategoryResolutions(
    value: unknown,
    now: number,
): Map<string, CachedCategoryResolution> {
    const entries = new Map<string, CachedCategoryResolution>();
    if (
        !isObjectRecord(value) ||
        value.version !== CATEGORY_CACHE_VERSION ||
        !isObjectRecord(value.entries)
    ) {
        return entries;
    }
    for (const [key, entry] of Object.entries(value.entries)) {
        if (
            key.trim() !== '' &&
            isObjectRecord(entry) &&
            typeof entry.observedAt === 'number' &&
            isCategoryResolution(entry.resolution)
        ) {
            const restored = {
                observedAt: entry.observedAt,
                resolution: entry.resolution,
            };
            if (isFreshCategoryResolution(restored, now)) {
                entries.set(key, restored);
            }
        }
    }
    return entries;
}

/** Checks the fields required by the title resolver before caching evidence. */
function isCategoryResolution(value: unknown): value is TitleResolution {
    return (
        isObjectRecord(value) &&
        typeof value.exists === 'boolean' &&
        typeof value.requestedTitle === 'string' &&
        value.requestedTitle.trim() !== '' &&
        typeof value.title === 'string' &&
        value.title.trim() !== '' &&
        (value.redirectTarget === undefined ||
            typeof value.redirectTarget === 'string') &&
        (value.page === undefined || isObjectRecord(value.page))
    );
}

/** Gives missing categories a shorter lifetime without refreshing old evidence. */
function isFreshCategoryResolution(
    entry: CachedCategoryResolution,
    now: number,
): boolean {
    const maxAge = entry.resolution.exists
        ? EXISTING_CATEGORY_MAX_AGE
        : MISSING_CATEGORY_MAX_AGE;
    return (
        Number.isSafeInteger(entry.observedAt) &&
        entry.observedAt >= 0 &&
        entry.observedAt <= now &&
        now - entry.observedAt < maxAge &&
        isCategoryResolution(entry.resolution)
    );
}

/**
 * Reads a JSON value from browser storage.
 *
 * @param storage - Browser storage implementation.
 * @param key - Storage key.
 * @returns Stored value.
 */
function readJsonStorage(storage: Storage, key: string): unknown {
    try {
        const value = storage.getItem(key);

        return value == null ? undefined : JSON.parse(value);
    } catch (_error) {
        return undefined;
    }
}

/**
 * Writes a JSON value to browser storage.
 *
 * @param storage - Browser storage implementation.
 * @param key - Storage key.
 * @param value - Value to store.
 * @returns Result when the function
 *   writes a json value to browser storage.
 */
function writeJsonStorage(storage: Storage, key: string, value: any): void {
    try {
        const stringifyResult = JSON.stringify(value);
        storage.setItem(key, stringifyResult);
    } catch (_error) {
        // Storage may fail. The in-memory cache remains usable.
    }
}

/**
 * Removes one browser storage value.
 *
 * @param storage - Browser storage implementation.
 * @param key - Storage key.
 * @returns Result when the function
 *   removes one browser storage value.
 */
function removeStorageItem(storage: Storage, key: string): void {
    try {
        storage.removeItem(key);
    } catch (_error) {
        // Cleanup is best effort. The in-memory cache is already clear.
    }
}
