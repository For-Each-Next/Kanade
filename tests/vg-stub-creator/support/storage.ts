/**
 * @file tests/vg-stub-creator/support/storage.ts
 * Purpose: Browser storage substitute with no dependency on a DOM runtime.
 *
 * Table of contents:
 * 1. createMemoryStorage
 */

export function createMemoryStorage(): Storage {
    const entries = new Map<string, string>();
    return {
        get length() {
            return entries.size;
        },
        clear() {
            entries.clear();
        },
        getItem(key) {
            return entries.get(key) ?? null;
        },
        key(index) {
            return [...entries.keys()][index] ?? null;
        },
        removeItem(key) {
            entries.delete(key);
        },
        setItem(key, value) {
            entries.set(key, String(value));
        },
    };
}
