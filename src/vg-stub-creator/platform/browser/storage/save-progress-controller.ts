/**
 * @file src/vg-stub-creator/platform/browser/storage/save-progress-controller.ts
 * Purpose: Coordinates persistent article-save progress.
 *
 * Table of contents:
 * 1. Imports
 * 2. initializeSaveProgress
 * 3. clearSaveProgress
 * 4. setSaveProgressStep
 * 5. failSaveProgress
 * 6. reportSaveProgressError
 * 7. createProgressSteps
 * 8. createProgressStep
 * 9. toProgressStatus
 */

import type {
    PendingSaveOperationStatus,
    PendingSaveSession,
    SaveProgressState,
} from '../../../app/contracts/application.ts';
import type { SaveProgressStatus } from '../../../domain/models.ts';
import { updateSaveProgress } from '../../../domain/save-progress.ts';
import {
    SAVE_PROGRESS_STORAGE_KEY,
    readSaveProgress,
    storeSaveProgress,
} from './save-progress.ts';

/** Creates persisted progress alongside the pending-save checkpoint. */
export function initializeSaveProgress(
    pending: PendingSaveSession,
    storage: Storage = sessionStorage,
): SaveProgressState {
    const progress: SaveProgressState = {
        error: '',
        open: true,
        steps: createProgressSteps(pending),
        title: pending.title,
        version: 1,
    };
    storeSaveProgress(progress, storage);
    return progress;
}

/** Removes persisted save progress after every operation completes. */
export function clearSaveProgress(storage: Storage = sessionStorage): void {
    storage.removeItem(SAVE_PROGRESS_STORAGE_KEY);
}

/** Updates and persists one save-progress row. */
export function setSaveProgressStep(
    id: string,
    status: SaveProgressStatus,
    storage: Storage = sessionStorage,
): SaveProgressState | undefined {
    const progress = readSaveProgress(storage);
    if (progress == null) {
        return undefined;
    }
    const updated = updateSaveProgress(progress, id, status);
    storeSaveProgress(updated, storage);
    return updated;
}

/** Stores a progress failure and keeps the layer visible. */
export function failSaveProgress(
    error: Error,
    storage: Storage = sessionStorage,
): SaveProgressState | undefined {
    const progress = readSaveProgress(storage);
    if (progress == null) {
        return undefined;
    }
    const running = progress.steps.find(
        (step: SaveProgressState['steps'][number]) => step.status === 'running',
    );
    const failed =
        running == null
            ? progress
            : updateSaveProgress(progress, running.id, 'failed');
    const updated = {
        ...failed,
        error: error instanceof Error ? error.message : String(error),
    };
    storeSaveProgress(updated, storage);
    return updated;
}

/** Stores a non-fatal error while retaining completed progress rows. */
export function reportSaveProgressError(
    error: Error | string,
    storage: Storage = sessionStorage,
): SaveProgressState | undefined {
    const progress = readSaveProgress(storage);
    if (progress == null) {
        return undefined;
    }
    const updated = {
        ...progress,
        error: error instanceof Error ? error.message : String(error),
    };
    storeSaveProgress(updated, storage);
    return updated;
}

function createProgressSteps(
    pending: PendingSaveSession,
): SaveProgressState['steps'] {
    const steps: SaveProgressState['steps'] = [
        createProgressStep(pending, 'save', pending.title),
    ];
    if (Object.hasOwn(pending.operations, 'move')) {
        steps.push(
            createProgressStep(
                pending,
                'move',
                String(pending.move.to ?? pending.title),
            ),
        );
    }
    for (const action of pending.actions) {
        if (Object.hasOwn(pending.operations, action.id)) {
            steps.push({
                ...createProgressStep(pending, action.id, action.pageTitle),
                label: action.label,
            });
        }
    }
    if (Object.hasOwn(pending.operations, 'new-page-list')) {
        steps.push(createProgressStep(pending, 'new-page-list', pending.title));
    }
    return steps;
}

function createProgressStep(
    pending: PendingSaveSession,
    id: string,
    targetPage: string,
): SaveProgressState['steps'][number] {
    return {
        id,
        status: toProgressStatus(pending.operations[id]),
        targetPage,
    };
}

function toProgressStatus(
    status: PendingSaveOperationStatus | undefined,
): SaveProgressStatus {
    if (status === 'confirmed') {
        return 'complete';
    }
    if (status === 'running') {
        return 'running';
    }
    if (status === 'uncertain') {
        return 'failed';
    }
    return 'pending';
}
