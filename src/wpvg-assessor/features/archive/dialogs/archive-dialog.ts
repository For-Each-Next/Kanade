/**
 * @file src/wpvg-assessor/features/archive/dialogs/archive-dialog.ts
 * Purpose: Reviews annual archives and saves them before removing source records.
 *
 * Contents: Archive reviews, ordered saves, recovery feedback, and dialog lifecycle.
 */

import type {
    ArchiveSaveError,
    ArchiveReview,
    NewPageArchiveWorkflow,
} from '../../../app/archive-contracts.ts';
import type { PageAssessorRuntime } from '../../../app/dialog-contracts.ts';
import {
    buildArchiveSummary,
    interfaceLocale,
    msg,
} from '../../../i18n/index.ts';
import type { VueModule } from '../../assessment/codex.ts';

const ARCHIVE_DIALOG_TEMPLATE =
    typeof __WPVG_ASSESSOR_ARCHIVE_DIALOG_TEMPLATE__ === 'undefined'
        ? ''
        : __WPVG_ASSESSOR_ARCHIVE_DIALOG_TEMPLATE__;

export const ARCHIVE_DIALOG_STYLES =
    typeof __WPVG_ASSESSOR_ARCHIVE_DIALOG_STYLES__ === 'undefined'
        ? ''
        : __WPVG_ASSESSOR_ARCHIVE_DIALOG_STYLES__;

interface ArchiveDialogOptions {
    api: mw.Api;
    runtime: PageAssessorRuntime;
    workflow: NewPageArchiveWorkflow;
    onClose(): void;
}

/** Creates the archiver without loading an assessment for the list page. */
export function createArchiveDialogComponent(
    Vue: VueModule,
    options: ArchiveDialogOptions,
): unknown {
    return Vue.defineComponent({
        name: 'VgNewPageArchiveDialog',
        setup: () => createArchiveDialogBindings(Vue, options),
        template: ARCHIVE_DIALOG_TEMPLATE,
    });
}

/** Preserves the reviewed source until all destination edits are confirmed. */
export function createArchiveDialogBindings(
    Vue: VueModule,
    options: ArchiveDialogOptions,
) {
    const archiveOpen = Vue.ref(true);
    const archiveLoading = Vue.ref(false);
    const archiveSaving = Vue.ref(false);
    const archiveReview = Vue.ref<ArchiveReview | null>(null);
    const archiveError = Vue.ref('');
    const archiveSaved = Vue.ref(false);
    const archiveSummary = Vue.ref(buildArchiveSummary());
    const narrowLayout = window.matchMedia('(max-width: 40rem)');
    const archiveNarrow = Vue.ref(narrowLayout.matches);
    let active = true;
    let generation = 0;

    function updateLayout(): void {
        archiveNarrow.value = narrowLayout.matches;
    }

    function release(): void {
        active = false;
        generation += 1;
        narrowLayout.removeEventListener('change', updateLayout);
    }
    Vue.onUnmounted(release);

    async function onArchiveReload(): Promise<void> {
        if (!active || archiveLoading.value || archiveSaving.value) return;
        const request = ++generation;
        archiveLoading.value = true;
        archiveError.value = '';
        archiveSaved.value = false;
        archiveReview.value = null;
        try {
            const review = await options.workflow.open(options.api);
            if (!active || request !== generation) return;
            archiveReview.value = review;
        } catch (error) {
            if (!active || request !== generation) return;
            options.runtime.logger.error('archive.preview.failed', { error });
            archiveError.value = msg('archive.failed', {
                error: getErrorMessage(error),
            });
        } finally {
            if (active && request === generation) archiveLoading.value = false;
        }
    }

    async function onArchiveSave(): Promise<void> {
        const review = archiveReview.value;
        if (
            !active ||
            archiveLoading.value ||
            archiveSaving.value ||
            archiveSaved.value ||
            archiveError.value ||
            review == null ||
            review.recordCount === 0 ||
            !archiveSummary.value.trim()
        )
            return;
        archiveSaving.value = true;
        try {
            await options.workflow.save(
                options.api,
                review,
                archiveSummary.value.trim(),
                () => undefined,
            );
            if (!active) return;
            archiveSaved.value = true;
            options.runtime.notify({
                key: 'archive-saved',
                message: msg('archive.saved'),
                type: 'success',
            });
        } catch (error) {
            if (!active) return;
            options.runtime.logger.error('archive.save.failed', { error });
            archiveError.value =
                isArchiveSaveError(error) && error.savedArchiveTitles.length > 0
                    ? msg('archive.partial', {
                          error: getErrorMessage(error),
                          titles: error.savedArchiveTitles.join('、'),
                      })
                    : msg('archive.failed', { error: getErrorMessage(error) });
        } finally {
            if (active) archiveSaving.value = false;
        }
    }

    function onArchiveCancel(): void {
        if (!active || archiveSaving.value) return;
        archiveOpen.value = false;
        release();
        queueMicrotask(options.onClose);
    }

    function onArchiveOpenChange(value: boolean): void {
        if (archiveSaving.value && !value) {
            archiveOpen.value = true;
            return;
        }
        archiveOpen.value = value;
        if (!value) onArchiveCancel();
    }

    function onArchiveAction(id: string): void {
        if (id === 'save') void onArchiveSave();
        else if (id === 'reload') void onArchiveReload();
        else onArchiveCancel();
    }

    const archiveActions = Vue.computed(() => {
        const actions = [
            {
                id: 'cancel',
                label: msg('archive.cancel'),
                action: 'default',
                weight: 'quiet',
                disabled: archiveSaving.value,
            },
            {
                id: 'reload',
                label: msg('archive.reload'),
                action: 'default',
                weight: 'normal',
                disabled: archiveSaving.value || archiveLoading.value,
            },
        ];
        if (
            archiveReview.value != null &&
            archiveReview.value.recordCount > 0 &&
            !archiveSaved.value
        ) {
            const saveAction = {
                id: 'save',
                label: msg('archive.save'),
                action: 'progressive',
                weight: 'primary',
                disabled:
                    archiveSaving.value ||
                    archiveLoading.value ||
                    !!archiveError.value ||
                    !archiveSummary.value.trim(),
            };
            if (archiveNarrow.value) actions.unshift(saveAction);
            else actions.push(saveAction);
        }
        return actions;
    });

    Vue.onMounted(() => {
        narrowLayout.addEventListener('change', updateLayout);
        void onArchiveReload();
    });

    return {
        archiveActions,
        archiveError,
        archiveLoading,
        archiveOpen,
        archivePageUrl,
        archiveReview,
        archiveSaved,
        archiveSaving,
        archiveSummary,
        interfaceLocale,
        msg,
        onArchiveAction,
        onArchiveCancel,
        onArchiveOpenChange,
        onArchiveReload,
        onArchiveSave,
    };
}

function archivePageUrl(title: string): string {
    return `/w/index.php?title=${encodeURIComponent(title)}`;
}

function getErrorMessage(error: unknown): string {
    if (isArchiveSaveError(error)) {
        const key =
            error.code === 'review-changed'
                ? 'archive.reviewChanged'
                : error.code === 'archive-conflict'
                  ? 'archive.conflict'
                  : 'archive.stopped';
        const cause =
            error.cause instanceof Error ? ` ${error.cause.message}` : '';
        return msg(key, { title: error.title }) + cause;
    }
    return error instanceof Error ? error.message : String(error);
}

function isArchiveSaveError(error: unknown): error is ArchiveSaveError {
    return (
        error instanceof Error &&
        'code' in error &&
        (error.code === 'review-changed' ||
            error.code === 'archive-conflict' ||
            error.code === 'save-failed') &&
        'title' in error &&
        typeof error.title === 'string' &&
        'savedArchiveTitles' in error &&
        Array.isArray(error.savedArchiveTitles) &&
        error.savedArchiveTitles.every(
            (title: unknown) => typeof title === 'string',
        )
    );
}
