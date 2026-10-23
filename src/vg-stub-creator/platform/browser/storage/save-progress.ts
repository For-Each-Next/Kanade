/**
 * @file src/vg-stub-creator/platform/browser/storage/save-progress.ts
 * Purpose: Persists article-save progress across browser navigation.
 *
 * Table of contents:
 * 1. Constants and state
 * 2. storeSaveProgress
 * 3. readSaveProgress
 */

export const SAVE_PROGRESS_STORAGE_KEY = 'vg-stub-creator-save-progress';

/**
 * Stores progress in session storage.
 *
 * @param progress - Save progress state.
 * @param storage - Session storage implementation.
 */
export function storeSaveProgress(
    progress: any,
    storage: Storage = sessionStorage,
): void {
    const serialized = JSON.stringify(progress);
    storage.setItem(SAVE_PROGRESS_STORAGE_KEY, serialized);
}

/**
 * Reads stored progress.
 *
 * @param storage - Session storage implementation.
 * @returns Stored save progress.
 */
export function readSaveProgress(
    storage: Storage = sessionStorage,
): any | undefined {
    const stored = storage.getItem(SAVE_PROGRESS_STORAGE_KEY);

    if (stored == null) {
        return undefined;
    }

    try {
        const progress = JSON.parse(stored);
        if (Array.isArray(progress?.steps)) {
            progress.steps = progress.steps.map((step: any) =>
                step?.status === 'retrying'
                    ? { ...step, status: 'running' }
                    : step,
            );
        }
        return progress;
    } catch (_error) {
        storage.removeItem(SAVE_PROGRESS_STORAGE_KEY);
        return undefined;
    }
}
