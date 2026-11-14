/**
 * @file src/wpvg-assessor/features/assessment/dialogs/assessment-dialog.ts
 * Purpose: Reactive presentation and review capture for the assessment dialog.
 *
 * Contents: Reactive assessment controls, exact reviews, staging, and dialog lifecycle.
 */

import { hasBatchTalkChange } from '../../../domain/batch-assessment.ts';
import { cdxIconEdit, cdxIconTrash } from '@wikimedia/codex-icons';
import projectConfig from '../../../domain/project-config.ts';
import type {
    DialogSavePhase,
    DialogSaveReview,
    DialogState,
    PageAssessorRuntime,
} from '../../../app/dialog-contracts.ts';
import type {
    PreparedAssessmentBatch,
    StagedAssessment,
    BatchSaveProgress,
} from '../../../app/staging-contracts.ts';
import {
    getExistingOtherProjectOptions,
    getTalkPageTopSection,
    normalizeAssessmentClass,
    parseAssessment,
    previewTalkPageTopSection,
} from '../../../domain/assessment.ts';
import {
    NOT_VIDEO_GAME_IMPORTANCE,
    type AssessmentImportance,
    type RegistrationResult,
    type SelectionMap,
} from '../../../domain/types.ts';
import { compareWikitext } from '../../../domain/wikitext-comparison.ts';
import { buildNewPageListSummary } from '../../../domain/new-page-summary.ts';
import { interfaceLocale, msg } from '../../../i18n/index.ts';
import {
    CLASS_OPTIONS,
    IMPORTANCE_OPTIONS,
    KNOWN_CLASS_OPTIONS,
    MAINTENANCE_OPTIONS,
    OTHER_PROJECT_OPTIONS,
    TASK_FORCE_OPTIONS,
    includeAssessmentValue,
} from '../assessment-options.ts';
import { buildEditSummary } from '../assessment-summary.ts';
import type { VueModule, VueRef } from '../codex.ts';
import * as Comparison from '../components/wikitext-comparison.ts';

const DIALOG_CLOSE_DELAY_MS = 600;

const ASSESSMENT_DIALOG_TEMPLATE =
    typeof __WPVG_ASSESSOR_DIALOG_TEMPLATE__ === 'undefined'
        ? ''
        : __WPVG_ASSESSOR_DIALOG_TEMPLATE__;

export const ASSESSMENT_DIALOG_STYLES =
    typeof __WPVG_ASSESSOR_DIALOG_STYLES__ === 'undefined'
        ? ''
        : __WPVG_ASSESSOR_DIALOG_STYLES__;

type MessageType = 'error' | 'notice';
type SelectionGroup = 'maintenance' | 'otherProjects' | 'taskForces';

interface DialogAction {
    id: 'collapse' | 'cancel' | 'submit';
    action: 'default' | 'progressive';
    weight: 'quiet' | 'normal' | 'primary';
    label: string;
    disabled: boolean;
    activate(): void | Promise<void>;
}

export interface AssessmentDialogOptions {
    onClose: () => void;
    onSaved?: () => void;
    registerRestore?: (restore: (() => void) | null) => void;
    onDraftApply?: (
        state: DialogState,
        review: DialogSaveReview,
    ) => Promise<void>;
    review?: DialogSaveReview;
    runtime: PageAssessorRuntime;
    state: DialogState;
}

type FocusTarget = HTMLElement | { $el: HTMLElement };

/**
 * Creates the actual MediaWiki Vue component mounted by the UI adapter.
 *
 * @param options - Operation options.
 * @returns Value.
 */
export function createAssessmentDialogComponent(
    Vue: VueModule,
    options: AssessmentDialogOptions,
): unknown {
    function setup() {
        return createAssessmentDialogBindings(Vue, options);
    }

    return Vue.defineComponent({
        components: {
            WikitextComparison:
                Comparison.createWikitextComparisonComponent(Vue),
        },
        name: 'VgPageAssessmentDialog',
        setup,
        template: ASSESSMENT_DIALOG_TEMPLATE,
    });
}

/**
 * Creates reactive dialog bindings without acquiring external services.
 *
 * @param options - Operation options.
 * @returns Value.
 */
export function createAssessmentDialogBindings(
    Vue: VueModule,
    options: AssessmentDialogOptions,
) {
    const { runtime, state } = options;
    const draftEditor = typeof options.onDraftApply === 'function';
    const autoStage = !draftEditor && runtime.staging != null;
    const restoredReview =
        options.review ?? runtime.staging?.getReview(state.talkTitle);
    const assessment = Vue.reactive(state.assessment);
    const videoGamesDisabled = Vue.computed(function isVideoGamesDisabled() {
        return assessment.importance === NOT_VIDEO_GAME_IMPORTANCE;
    });
    const videoGamesSelected = Vue.computed(() => !videoGamesDisabled.value);
    let retainedVideoGamesImportance = videoGamesSelected.value
        ? assessment.importance
        : '';
    const classSelection = Vue.ref(getPresetClass(assessment.className));
    const classInput = Vue.ref(
        classSelection.value ? '' : getClassLabel(assessment.className),
    );
    const classOptions = Vue.computed(function getClassOptions() {
        return [...CLASS_OPTIONS];
    });
    const importanceOptions = Vue.computed(function getImportanceOptions() {
        return includeAssessmentValue(
            IMPORTANCE_OPTIONS.filter(
                (option) => option.value !== NOT_VIDEO_GAME_IMPORTANCE,
            ),
            videoGamesSelected.value ? assessment.importance : '',
        );
    });
    const otherProjectOptions = [
        ...OTHER_PROJECT_OPTIONS.filter((option) => option.id === 'acg'),
        ...OTHER_PROJECT_OPTIONS.filter((option) => option.id !== 'acg'),
        ...getExistingOtherProjectOptions(state.page.text, projectConfig),
    ];
    const open = Vue.ref(true);
    const minimized = Vue.ref(!draftEditor);
    const miniExpandButton = Vue.ref<FocusTarget | null>(null);
    const miniHeading = Vue.ref<FocusTarget | null>(null);
    const assessmentHeading = Vue.ref<FocusTarget | null>(null);
    const batchContent = Vue.ref<FocusTarget | null>(null);
    const batchBackButton = Vue.ref<FocusTarget | null>(null);
    const assessmentHeadingTabIndex = Vue.ref(0);
    function onAssessmentHeadingFocus(): void {
        assessmentHeadingTabIndex.value = -1;
    }
    const previewText = Vue.ref(
        restoredReview?.previewText ?? createAssessmentPreview(state),
    );
    const currentSource = Vue.ref(getTalkPageTopSection(state.page.text));
    const summary = Vue.ref(
        restoredReview?.summary ??
            buildEditSummary(assessment, otherProjectOptions, state.page.text),
    );
    const listSummary = Vue.ref(
        restoredReview?.listSummary ?? buildRegistrationSummary(state),
    );
    const shouldRegister = Vue.ref(
        restoredReview?.shouldRegister ?? getDefaultRegistration(state),
    );
    const registration = Vue.ref(state.registration);
    const videoGamesAvailable = Vue.computed(function isVideoGamesAvailable() {
        const parsed = parseAssessment(projectConfig, previewText.value);
        return (
            !videoGamesDisabled.value &&
            parsed != null &&
            parsed.importance !== NOT_VIDEO_GAME_IMPORTANCE
        );
    });
    const saving = Vue.ref(false);
    const preparing = Vue.ref(false);
    const batchConfirmOpen = Vue.ref(false);
    const batchEditor = Vue.shallowRef<unknown>(null);
    const batchEntries = Vue.ref<StagedAssessment[]>([]);
    const batchSelectedTitles = Vue.ref<string[]>([]);
    const batchRemovingTitle = Vue.ref('');
    const batchProgress = Vue.ref<BatchSaveProgress>({
        completed: 0,
        total: 0,
        title: '',
        phase: 'waiting',
        waitSeconds: 0,
    });
    let preparedBatch: PreparedAssessmentBatch | null = null;
    let reviewedBatch: PreparedAssessmentBatch | null = null;
    let batchEditorToken: object | null = null;
    let batchSelectionRevision = 0;
    const batchPrepared = Vue.ref(false);
    const stagedCount = Vue.ref(runtime.staging?.count() ?? 0);
    const currentStaged = Vue.ref(autoStage);
    let defaultStagePending = currentStaged.value && restoredReview == null;
    let stagedReviewKey =
        restoredReview == null ? null : getStagedReviewKey(restoredReview);
    let stagedEditRevision = 0;
    let stagedSavedRevision = 0;
    let stagedSyncPromise: Promise<void> | null = null;
    let stagedSyncTimer: ReturnType<typeof setTimeout> | undefined;
    let unstagingRequested = false;
    let active = true;
    let reviewRevision = 0;
    let batchPreparationPending = false;
    let stagingPending = false;
    let unsubscribeStaging: (() => void) | undefined;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const actionLayout =
        typeof matchMedia === 'function'
            ? matchMedia('(max-width: 40rem)')
            : void 0;
    const stackedActions = Vue.ref(actionLayout?.matches ?? false);
    const updateActionLayout = () => {
        stackedActions.value = actionLayout?.matches ?? false;
    };
    actionLayout?.addEventListener('change', updateActionLayout);
    Vue.onUnmounted(release);
    const status = Vue.ref('');
    const statusType = Vue.ref<MessageType>('notice');
    function setStatus(text: string, isError: boolean): void {
        status.value = text;
        statusType.value = isError ? 'error' : 'notice';
        runtime.logger.debug('status.updated', { isError });
    }
    function invalidatePreparedBatch(): void {
        reviewRevision += 1;
        batchSelectionRevision += 1;
        batchConfirmOpen.value = false;
        preparedBatch = null;
        reviewedBatch = null;
        batchEntries.value = [];
        batchSelectedTitles.value = [];
        batchPrepared.value = false;
        if (batchPreparationPending) {
            batchPreparationPending = false;
            preparing.value = false;
        }
        if (statusType.value !== 'error') {
            status.value = '';
        }
    }
    function refreshStagedCount(): void {
        stagedCount.value = runtime.staging?.count() ?? 0;
        const review = runtime.staging?.getReview(state.talkTitle);
        currentStaged.value =
            !unstagingRequested && (defaultStagePending || review != null);
        if (review == null) {
            stagedReviewKey = null;
        }
    }
    function onStagedQueueChange(): void {
        if (!active) {
            return;
        }
        try {
            refreshStagedCount();
            if (saving.value || stagingPending) {
                return;
            }
            const hadBatchReview =
                preparedBatch != null || batchPreparationPending;
            invalidatePreparedBatch();
            if (batchPreparationPending) {
                batchPreparationPending = false;
                preparing.value = false;
            }
            if (hadBatchReview) {
                setStatus(msg('dialog.batchChanged'), false);
            }
        } catch (error) {
            runtime.logger.error('assessment.queue-refresh.failed', { error });
            setStatus(getErrorMessage(error), true);
        }
    }
    function refreshAssessment(): void {
        invalidatePreparedBatch();
        runtime.logger.debug('assessment.changed', {
            className: assessment.className,
            importance: assessment.importance,
        });
        const previewSource = state.previewDirty
            ? previewText.value
            : state.page.text;
        previewText.value = previewTalkPageTopSection(
            previewSource,
            assessment,
            projectConfig,
        );
        runtime.logger.debug('assessment-preview.updated', {
            fromManualSource: state.previewDirty,
            characterCount: previewText.value.length,
        });
        currentSource.value = getTalkPageTopSection(state.page.text);
        runtime.logger.debug('talk-diff.updated', {
            characterCount: currentSource.value.length,
        });
        if (!state.summaryDirty) {
            summary.value = buildEditSummary(
                assessment,
                otherProjectOptions,
                state.page.text,
            );
            runtime.logger.debug('assessment-summary.updated', {
                characterCount: summary.value.length,
            });
        } else {
            runtime.logger.debug('assessment-summary.update.skipped');
        }
        if (registrationDisabled.value) {
            shouldRegister.value = false;
        }
        scheduleStagedReview();
    }
    function setClassName(value: unknown): void {
        if (saving.value || preparing.value || typeof value !== 'string') {
            return;
        }
        if (classInput.value !== value) {
            invalidatePreparedBatch();
        }
        classInput.value = value;
        classSelection.value = '';
        const knownOption = KNOWN_CLASS_OPTIONS.find(
            (option) => option.label === value,
        );
        const className = normalizeAssessmentClass(knownOption?.value ?? value);
        if (className == null || className === assessment.className) {
            return;
        }
        assessment.className = className;
        refreshAssessment();
    }
    function selectClass(value: unknown): void {
        if (saving.value || preparing.value || typeof value !== 'string') {
            return;
        }
        if (value === '') {
            setClassName(classInput.value);
            return;
        }
        if (!CLASS_OPTIONS.some((option) => option.value === value)) {
            return;
        }
        classSelection.value = value;
        if (assessment.className !== value) {
            assessment.className = value;
            refreshAssessment();
        }
    }
    function commitClassName(): void {
        if (!saving.value && !preparing.value && classSelection.value === '') {
            classInput.value = getClassLabel(assessment.className);
        }
    }
    function setImportance(value: unknown): void {
        if (saving.value || preparing.value || !isAssessmentImportance(value)) {
            return;
        }
        assessment.importance = value;
        if (value !== NOT_VIDEO_GAME_IMPORTANCE) {
            retainedVideoGamesImportance = value;
        }
        refreshAssessment();
    }
    function setVideoGamesSelected(value: boolean): void {
        if (
            typeof value !== 'boolean' ||
            saving.value ||
            preparing.value ||
            value === videoGamesSelected.value
        ) {
            return;
        }
        setImportance(
            value ? retainedVideoGamesImportance : NOT_VIDEO_GAME_IMPORTANCE,
        );
    }
    function setSelection(
        group: SelectionGroup,
        id: string,
        value: boolean,
    ): void {
        if (
            saving.value ||
            preparing.value ||
            (videoGamesDisabled.value && group !== 'otherProjects')
        ) {
            return;
        }
        const selections = assessment[group] as SelectionMap;
        selections[id] = value;
        refreshAssessment();
    }
    function onPreviewInput(value: string): void {
        if (saving.value || preparing.value) {
            return;
        }
        invalidatePreparedBatch();
        previewText.value = value;
        state.previewDirty = true;
        const parsed = parseAssessment(projectConfig, value);
        if (parsed != null) {
            Object.assign(assessment, parsed);
            if (parsed.importance !== NOT_VIDEO_GAME_IMPORTANCE) {
                retainedVideoGamesImportance = parsed.importance;
            }
            classSelection.value = getPresetClass(assessment.className);
            if (classSelection.value === '') {
                classInput.value = getClassLabel(assessment.className);
            }
            if (!state.summaryDirty) {
                summary.value = buildEditSummary(
                    assessment,
                    otherProjectOptions,
                    state.page.text,
                );
            }
        }
        if (registrationDisabled.value) {
            shouldRegister.value = false;
        }
        runtime.logger.debug('lead-source.edited');
        runtime.logger.debug('talk-diff.updated', {
            characterCount: currentSource.value.length,
        });
        scheduleStagedReview();
    }
    function onSummaryInput(value: string): void {
        if (saving.value || preparing.value) {
            return;
        }
        invalidatePreparedBatch();
        summary.value = value;
        state.summaryDirty = true;
        runtime.logger.debug('assessment-summary.edited');
        scheduleStagedReview();
    }
    function setRegister(value: boolean): void {
        if (saving.value || preparing.value || registrationDisabled.value) {
            return;
        }
        invalidatePreparedBatch();
        shouldRegister.value = value;
        runtime.logger.debug('registration-selection.changed', { value });
        scheduleStagedReview();
    }
    function close(): void {
        if (!active) {
            return;
        }
        minimized.value = false;
        batchConfirmOpen.value = false;
        open.value = false;
        release();
        queueMicrotask(options.onClose);
    }
    function release(): void {
        active = false;
        batchEditor.value = null;
        batchEditorToken = null;
        clearTimeout(stagedSyncTimer);
        stagedSyncTimer = void 0;
        options.registerRestore?.(null);
        actionLayout?.removeEventListener('change', updateActionLayout);
        unsubscribeStaging?.();
        unsubscribeStaging = void 0;
        if (closeTimer != null) {
            clearTimeout(closeTimer);
            closeTimer = void 0;
        }
    }
    async function onCancel(): Promise<void> {
        if (
            !active ||
            saving.value ||
            unstagingRequested ||
            batchEditor.value != null
        ) {
            return;
        }
        if (!autoStage) {
            close();
            return;
        }
        invalidatePreparedBatch();
        clearTimeout(stagedSyncTimer);
        stagedSyncTimer = void 0;
        defaultStagePending = false;
        unstagingRequested = true;
        currentStaged.value = false;
        preparing.value = true;
        stagingPending = true;
        try {
            // A pending storage write must settle before removing its draft.
            await stagedSyncPromise?.catch(() => {});
            stagingPending = true;
            await runtime.staging!.unstage(state.talkTitle);
            stagedReviewKey = null;
            runtime.logger.info('assessment.discarded');
            close();
        } catch (error) {
            runtime.logger.error('assessment.discard.failed', { error });
            unstagingRequested = false;
            reportStagedSyncError(error);
        } finally {
            unstagingRequested = false;
            stagingPending = false;
            if (active) {
                preparing.value = false;
            }
        }
    }
    async function onDismiss(): Promise<void> {
        if (
            !active ||
            saving.value ||
            unstagingRequested ||
            batchEditor.value != null
        ) {
            return;
        }
        try {
            await flushStagedReview();
        } catch (error) {
            reportStagedSyncError(error);
            return;
        }
        if (unstagingRequested) {
            return;
        }
        runtime.logger.info('dialog.closed');
        close();
    }
    function onOpenChange(value: boolean): void {
        if (
            minimized.value ||
            batchConfirmOpen.value ||
            batchEditor.value != null
        ) {
            return;
        }
        if (saving.value && !value) {
            open.value = true;
            return;
        }
        if (!value) {
            void onDismiss();
        }
    }
    function focusCurrentView(initialCompact = false) {
        const focus = () => {
            if (!active || !open.value || batchEditor.value != null) {
                return;
            }
            const target = minimized.value
                ? initialCompact
                    ? miniHeading.value
                    : miniExpandButton.value
                : batchConfirmOpen.value
                  ? batchContent.value
                  : assessmentHeading.value;
            const element =
                target != null && '$el' in target ? target.$el : target;
            if (
                typeof element?.focus === 'function' &&
                element.isConnected !== false
            ) {
                element.focus({ preventScroll: true });
            }
        };
        void Vue.nextTick(() => {
            if (minimized.value) {
                focus();
                return;
            }
            // Codex opens its focus trap through two awaited render ticks.
            // Restore the owned heading after that native focus settles.
            void Vue.nextTick(() => {
                void Vue.nextTick(focus);
            });
        });
    }
    function onCollapse() {
        if (
            !active ||
            !open.value ||
            minimized.value ||
            draftEditor ||
            batchEditor.value != null
        ) {
            return;
        }
        minimized.value = true;
        focusCurrentView();
    }
    function onExpand() {
        if (!active || !open.value || batchEditor.value != null) {
            return;
        }
        minimized.value = false;
        focusCurrentView();
    }
    async function onMiniSave() {
        if (saving.value || preparing.value || !active) {
            return;
        }
        onExpand();
        await onSave();
    }
    function captureReview(): DialogSaveReview {
        return createSaveReview({
            listSummary,
            previewText,
            registrationDisabled,
            shouldRegister,
            summary,
        });
    }
    function getStagedReviewKey(review: DialogSaveReview): string {
        return JSON.stringify([
            review.previewText,
            review.summary,
            review.shouldRegister,
            review.listSummary,
        ]);
    }
    function scheduleStagedReview() {
        clearTimeout(stagedSyncTimer);
        stagedSyncTimer = void 0;
        if (!active || saving.value || !autoStage || unstagingRequested) {
            return;
        }
        stagedEditRevision += 1;
        stagedSyncTimer = setTimeout(() => {
            void flushStagedReview().catch(reportStagedSyncError);
        }, 250);
    }
    function flushStagedReview(): Promise<void> {
        clearTimeout(stagedSyncTimer);
        stagedSyncTimer = void 0;
        if (stagedSyncPromise != null) {
            return stagedSyncPromise.then(() => {
                if (
                    active &&
                    !unstagingRequested &&
                    stagedEditRevision !== stagedSavedRevision
                )
                    return flushStagedReview();
            });
        }
        if (
            !active ||
            saving.value ||
            !autoStage ||
            unstagingRequested ||
            runtime.staging == null
        ) {
            return Promise.resolve();
        }
        stagingPending = true;
        stagedSyncPromise = synchronize().finally(() => {
            stagedSyncPromise = null;
            stagingPending = false;
        });
        return stagedSyncPromise;
        async function synchronize() {
            while (active && !unstagingRequested && !saving.value) {
                const review = captureReview();
                const key = getStagedReviewKey(review);
                const editRevision = stagedEditRevision;
                if (
                    key === stagedReviewKey &&
                    editRevision === stagedSavedRevision
                ) {
                    return;
                }
                await runtime.staging!.stage(state, review);
                defaultStagePending = false;
                stagedReviewKey = key;
                stagedSavedRevision = editRevision;
                if (active) {
                    refreshStagedCount();
                    if (unstagingRequested) {
                        currentStaged.value = false;
                    }
                }
            }
        }
    }
    function reportStagedSyncError(error: unknown): void {
        if (!active || unstagingRequested) {
            return;
        }
        defaultStagePending = false;
        try {
            refreshStagedCount();
        } catch {
            currentStaged.value = false;
        }
        runtime.logger.error('assessment.stage-sync.failed', { error });
        setStatus(getErrorMessage(error), true);
    }
    async function prepareBatch(
        review: DialogSaveReview,
    ): Promise<PreparedAssessmentBatch | null> {
        const staging = runtime.staging;
        if (staging == null) {
            return null;
        }
        const revision = reviewRevision;
        batchPreparationPending = true;
        preparing.value = true;
        setStatus(msg('dialog.preparingBatch'), false);
        try {
            const batch = await staging.prepare(state, review);
            if (!active || !open.value || revision !== reviewRevision) {
                return null;
            }
            reviewedBatch = batch;
            batchEntries.value = batch.entries;
            batchSelectedTitles.value = batch.entries.map(
                (entry) => entry.state.talkTitle,
            );
            installPreparedBatch(batch);
            refreshStagedCount();
            return batch;
        } catch (error) {
            if (active && revision === reviewRevision) {
                runtime.logger.error('batch.prepare.failed', { error });
                setStatus(getErrorMessage(error), true);
            }
            return null;
        } finally {
            if (active && revision === reviewRevision) {
                batchPreparationPending = false;
                preparing.value = false;
            }
        }
    }
    function installPreparedBatch(batch: PreparedAssessmentBatch): void {
        preparedBatch = batch;
        batchPrepared.value = true;
        batchProgress.value = {
            completed: 0,
            total:
                batch.entries.filter(hasBatchTalkChange).length +
                (batch.registration == null ? 0 : 1),
            title: '',
            phase: 'waiting',
            waitSeconds: 0,
        };
    }
    async function prepareBatchSelection() {
        const fullBatch = reviewedBatch;
        const staging = runtime.staging;
        if (fullBatch == null || staging == null) {
            return false;
        }
        const revision = reviewRevision;
        const selectionRevision = ++batchSelectionRevision;
        const selected = new Set(batchSelectedTitles.value);
        const entries = fullBatch.entries.filter((entry) =>
            selected.has(entry.state.talkTitle),
        );
        preparedBatch = null;
        batchPrepared.value = false;
        batchProgress.value = {
            completed: 0,
            total: 0,
            title: '',
            phase: 'waiting',
            waitSeconds: 0,
        };
        if (entries.length === 0) {
            batchPreparationPending = false;
            preparing.value = false;
            status.value = '';
            return true;
        }
        batchPreparationPending = true;
        preparing.value = true;
        setStatus(msg('dialog.preparingBatch'), false);
        try {
            const batch = await staging.prepareSelection(
                state.api,
                entries,
                fullBatch.draftSnapshot,
            );
            if (
                !active ||
                !batchConfirmOpen.value ||
                revision !== reviewRevision ||
                selectionRevision !== batchSelectionRevision ||
                reviewedBatch !== fullBatch
            ) {
                return false;
            }
            installPreparedBatch(batch);
            status.value = '';
            return true;
        } catch (error) {
            if (
                active &&
                revision === reviewRevision &&
                selectionRevision === batchSelectionRevision
            ) {
                runtime.logger.error('batch.selection.failed', { error });
                setStatus(getErrorMessage(error), true);
            }
            return false;
        } finally {
            if (
                active &&
                revision === reviewRevision &&
                selectionRevision === batchSelectionRevision
            ) {
                batchPreparationPending = false;
                preparing.value = false;
            }
        }
    }
    async function onBatchSelect(title: string, selected: boolean) {
        if (
            saving.value ||
            batchRemovingTitle.value !== '' ||
            batchEditor.value != null ||
            !active ||
            !batchConfirmOpen.value ||
            reviewedBatch == null ||
            typeof selected !== 'boolean' ||
            !batchEntries.value.some((entry) => entry.state.talkTitle === title)
        ) {
            return;
        }
        const titles = new Set(batchSelectedTitles.value);
        if (selected === titles.has(title)) {
            return;
        }
        if (selected) {
            titles.add(title);
        } else {
            titles.delete(title);
        }
        batchSelectedTitles.value = batchEntries.value
            .map((entry) => entry.state.talkTitle)
            .filter((talkTitle) => titles.has(talkTitle));
        await prepareBatchSelection();
    }
    async function onBatchSelectAll(selected: boolean) {
        if (
            saving.value ||
            batchRemovingTitle.value !== '' ||
            batchEditor.value != null ||
            !active ||
            !batchConfirmOpen.value ||
            reviewedBatch == null ||
            typeof selected !== 'boolean'
        ) {
            return;
        }
        batchSelectedTitles.value = selected
            ? batchEntries.value.map((entry) => entry.state.talkTitle)
            : [];
        await prepareBatchSelection();
    }
    function onBatchEdit(title: string): void {
        const fullBatch = reviewedBatch;
        if (
            saving.value ||
            preparing.value ||
            !active ||
            batchEditor.value != null ||
            batchRemovingTitle.value !== '' ||
            !batchConfirmOpen.value ||
            fullBatch == null
        ) {
            return;
        }
        const entry = fullBatch.entries.find(
            (draft) => draft.state.talkTitle === title,
        );
        if (entry == null) {
            return;
        }
        const revision = reviewRevision;
        const token = {};
        const editState = {
            ...cloneDraftState(entry.state),
            api: state.api,
        };
        batchEditorToken = token;
        batchEditor.value = createAssessmentDialogComponent(Vue, {
            onClose() {
                if (!active || batchEditorToken !== token) {
                    return;
                }
                batchEditor.value = null;
                batchEditorToken = null;
                focusCurrentView();
            },
            onDraftApply(nextState, review) {
                return applyBatchEdit(
                    fullBatch,
                    revision,
                    token,
                    title,
                    nextState,
                    review,
                );
            },
            review: structuredClone(entry.review),
            runtime: { ...runtime, staging: undefined },
            state: editState,
        });
    }
    async function applyBatchEdit(
        fullBatch: PreparedAssessmentBatch,
        revision: number,
        token: object,
        title: string,
        nextState: DialogState,
        review: DialogSaveReview,
    ) {
        function assertEditorCurrent() {
            if (
                !active ||
                !batchConfirmOpen.value ||
                batchEditorToken !== token ||
                revision !== reviewRevision ||
                reviewedBatch !== fullBatch
            ) {
                throw new Error(msg('dialog.batchChanged'));
            }
        }
        assertEditorCurrent();
        preparing.value = true;
        stagingPending = true;
        try {
            const nextBatch = await runtime.staging!.updateInBatch(
                fullBatch,
                title,
                nextState,
                review,
            );
            assertEditorCurrent();
            reviewedBatch = nextBatch;
            batchEntries.value = nextBatch.entries;
            refreshStagedCount();
            if (title === state.talkTitle) {
                syncCurrentBatchDraft(
                    nextBatch.entries.find(
                        (entry) => entry.state.talkTitle === title,
                    )!,
                );
            }
        } finally {
            stagingPending = false;
            if (active) {
                preparing.value = false;
            }
        }
        if (await prepareBatchSelection()) {
            setStatus(msg('dialog.batchEdited', { title }), false);
        }
    }
    function syncCurrentBatchDraft(entry: StagedAssessment): void {
        Object.assign(assessment, structuredClone(entry.state.assessment));
        if (assessment.importance !== NOT_VIDEO_GAME_IMPORTANCE) {
            retainedVideoGamesImportance = assessment.importance;
        }
        state.previewDirty = entry.state.previewDirty;
        state.summaryDirty = entry.state.summaryDirty;
        classSelection.value = getPresetClass(assessment.className);
        classInput.value = classSelection.value
            ? ''
            : getClassLabel(assessment.className);
        previewText.value = entry.review.previewText;
        summary.value = entry.review.summary;
        listSummary.value = entry.review.listSummary;
        shouldRegister.value = entry.review.shouldRegister;
        stagedReviewKey = currentStaged.value
            ? getStagedReviewKey(entry.review)
            : null;
        stagedSavedRevision = stagedEditRevision;
    }
    async function onBatchRemove(title: string) {
        const fullBatch = reviewedBatch;
        if (
            saving.value ||
            preparing.value ||
            batchEditor.value != null ||
            batchRemovingTitle.value !== '' ||
            !active ||
            !batchConfirmOpen.value ||
            fullBatch == null ||
            !fullBatch.entries.some((entry) => entry.state.talkTitle === title)
        ) {
            return;
        }
        const revision = reviewRevision;
        const removedIndex = fullBatch.entries.findIndex(
            (entry) => entry.state.talkTitle === title,
        );
        batchSelectionRevision += 1;
        batchRemovingTitle.value = title;
        stagingPending = true;
        preparing.value = true;
        preparedBatch = null;
        batchPrepared.value = false;
        let removed = false;
        try {
            const nextBatch = await runtime.staging!.removeFromBatch(
                fullBatch,
                title,
            );
            if (
                !active ||
                revision !== reviewRevision ||
                reviewedBatch !== fullBatch
            ) {
                return;
            }
            reviewedBatch = nextBatch;
            batchEntries.value = nextBatch.entries;
            batchSelectedTitles.value = batchSelectedTitles.value.filter(
                (talkTitle) => talkTitle !== title,
            );
            refreshStagedCount();
            removed = true;
        } catch (error) {
            if (active && revision === reviewRevision) {
                runtime.logger.error('batch.remove.failed', { error });
                setStatus(getErrorMessage(error), true);
            }
        } finally {
            stagingPending = false;
            batchRemovingTitle.value = '';
            if (active && revision === reviewRevision) {
                preparing.value = false;
            }
        }
        if (removed && (await prepareBatchSelection())) {
            setStatus(msg('dialog.batchRemoved', { title }), false);
            void Vue.nextTick(() => {
                if (!active || !batchConfirmOpen.value) return;
                const target = batchContent.value;
                const root =
                    target != null && '$el' in target ? target.$el : target;
                const actions = root?.querySelectorAll<HTMLButtonElement>(
                    '.kanade-wpvg-assessor-edit',
                );
                const next =
                    actions?.[Math.min(removedIndex, actions.length - 1)];
                const back = batchBackButton.value;
                const fallback =
                    back != null && '$el' in back ? back.$el : back;
                (next ?? fallback)?.focus({ preventScroll: true });
            });
        }
    }
    async function onSave(): Promise<void> {
        if (
            saving.value ||
            preparing.value ||
            unstagingRequested ||
            !active ||
            batchConfirmOpen.value ||
            minimized.value ||
            batchEditor.value != null
        ) {
            return;
        }
        if (draftEditor) {
            saving.value = true;
            setStatus(msg('dialog.batchApplying'), false);
            try {
                await options.onDraftApply!(state, captureReview());
                close();
            } catch (error) {
                if (active) {
                    runtime.logger.error('batch.edit.failed', { error });
                    setStatus(getErrorMessage(error), true);
                }
            } finally {
                if (active) {
                    saving.value = false;
                }
            }
            return;
        }
        preparing.value = true;
        try {
            await flushStagedReview();
        } catch (error) {
            reportStagedSyncError(error);
            return;
        } finally {
            if (active) {
                preparing.value = false;
            }
        }
        if (!active || !open.value || unstagingRequested) {
            return;
        }
        const review = captureReview();
        if (runtime.staging != null) {
            const batch = await prepareBatch(review);
            if (
                !active ||
                !open.value ||
                batch == null ||
                batch !== preparedBatch
            ) {
                return;
            }
            status.value = '';
            batchConfirmOpen.value = true;
            return;
        }
        await saveReview(review, null);
    }
    function onBatchCancel() {
        if (
            saving.value ||
            batchRemovingTitle.value !== '' ||
            batchEditor.value != null ||
            !active
        ) {
            return;
        }
        invalidatePreparedBatch();
    }
    function onBatchOpenChange(value: boolean) {
        if (!value && !minimized.value && batchEditor.value == null) {
            onBatchCancel();
        }
    }
    async function onConfirmBatch() {
        if (
            saving.value ||
            preparing.value ||
            !active ||
            batchEditor.value != null ||
            minimized.value ||
            !batchConfirmOpen.value ||
            !batchPrepared.value ||
            preparedBatch == null ||
            batchSelectedTitles.value.length === 0
        ) {
            return;
        }
        await saveReview(captureReview(), preparedBatch);
    }
    async function saveReview(
        review: DialogSaveReview,
        submittedBatch: PreparedAssessmentBatch | null,
    ) {
        runtime.logger.info('save.activated');
        saving.value = true;
        try {
            const reportPhase = reportSavePhase.bind(null, setStatus);
            const reportProgress = (progress: BatchSaveProgress) => {
                if (active) {
                    batchProgress.value = { ...progress };
                }
            };
            const outcome =
                submittedBatch != null
                    ? await runtime.staging!.save(
                          state.api,
                          submittedBatch,
                          reportPhase,
                          reportProgress,
                      )
                    : await runtime.saveReviewedDialog(
                          state,
                          review,
                          reportPhase,
                      );
            if (!active) {
                return;
            }
            refreshStagedCount();
            const text =
                outcome === 'unchanged'
                    ? msg('dialog.unchanged')
                    : msg('dialog.saved');
            setStatus(text, false);
            closeTimer = setTimeout(finishSave, DIALOG_CLOSE_DELAY_MS);
        } catch (error) {
            batchConfirmOpen.value = false;
            preparedBatch = null;
            batchPrepared.value = false;
            if (!active) {
                return;
            }
            refreshStagedCount();
            const remainingReview = runtime.staging?.getReview(state.talkTitle);
            if (submittedBatch != null && remainingReview != null) {
                shouldRegister.value = remainingReview.shouldRegister;
            }
            runtime.logger.error('save.failed', { error });
            setStatus(
                submittedBatch == null
                    ? getErrorMessage(error)
                    : msg('dialog.submitStopped', {
                          count: stagedCount.value,
                          error: getErrorMessage(error),
                      }),
                true,
            );
            saving.value = false;
        }
    }
    function finishSave(): void {
        close();
        if (options.onSaved != null) {
            queueMicrotask(options.onSaved);
        }
    }
    const registrationDisabled = Vue.computed(function isDisabled() {
        return (
            !videoGamesAvailable.value ||
            isRegistrationDisabled(registration.value)
        );
    });
    const registrationLabel = Vue.computed(function getLabel() {
        if (!videoGamesAvailable.value) {
            return msg('registration.noVideoGamesBanner');
        }
        return getRegistrationLabel(
            registration.value,
            state.subjectInfo.creationDate,
        );
    });
    const talkComparison = Vue.computed(function getTalkComparison() {
        return compareWikitext(currentSource.value, previewText.value);
    });
    const batchReviewDetails = Vue.computed(() => {
        return batchEntries.value.map((entry) => ({
            title: entry.state.talkTitle,
            summary: entry.review.summary,
            changed: hasBatchTalkChange(entry),
            comparison: compareWikitext(
                getTalkPageTopSection(entry.state.page.text),
                entry.review.previewText,
            ),
        }));
    });
    const batchReviewRows = Vue.computed(() => {
        const selected = new Set(batchSelectedTitles.value);
        return batchReviewDetails.value.map((row) => ({
            ...row,
            selected: selected.has(row.title),
        }));
    });
    const batchSelectedCount = Vue.computed(
        () => batchSelectedTitles.value.length,
    );
    const batchAllSelected = Vue.computed(() => {
        return (
            batchEntries.value.length > 0 &&
            batchSelectedCount.value === batchEntries.value.length
        );
    });
    const batchPartiallySelected = Vue.computed(() => {
        return (
            batchSelectedCount.value > 0 &&
            batchSelectedCount.value < batchEntries.value.length
        );
    });
    const batchProgressMessage = Vue.computed(() => {
        const progress = batchProgress.value;
        if (progress.phase === 'complete') {
            return msg(
                progress.total === 0
                    ? 'dialog.unchanged'
                    : 'dialog.batchComplete',
            );
        }
        if (progress.phase === 'waiting' && progress.waitSeconds > 0) {
            return msg('dialog.batchWaiting', {
                seconds: progress.waitSeconds,
                title: progress.title,
            });
        }
        return progress.title
            ? msg('dialog.batchSavingPage', { title: progress.title })
            : msg('dialog.saving');
    });
    const submitLabel = Vue.computed(function getSubmitLabel() {
        if (draftEditor) {
            return msg('dialog.batchApply');
        }
        const otherPages = Math.max(
            0,
            stagedCount.value - (currentStaged.value ? 1 : 0),
        );
        return otherPages > 0
            ? msg('dialog.nextWithCount', { count: otherPages })
            : msg('dialog.next');
    });
    const cancelLabel = msg(
        autoStage ? 'dialog.discardDraft' : 'dialog.cancel',
    );
    const miniAssessmentLabel = Vue.computed(() => {
        const stageMessage = currentStaged.value
            ? 'dialog.miniStaged'
            : 'dialog.miniUnstaged';
        return msg('dialog.miniAssessment', {
            className: getClassLabel(assessment.className),
            state: msg(stageMessage),
        });
    });
    const footerActions = Vue.computed(() => {
        const actions: DialogAction[] = [
            {
                id: 'collapse',
                action: 'default',
                weight: 'quiet',
                label: msg('dialog.collapse'),
                disabled: false,
                activate: onCollapse,
            },
            {
                id: 'cancel',
                action: 'default',
                weight: 'quiet',
                label: cancelLabel,
                disabled: saving.value || unstagingRequested,
                activate: onCancel,
            },
        ];
        actions.push({
            id: 'submit',
            action: 'progressive',
            weight: 'primary',
            label: submitLabel.value,
            disabled: saving.value || preparing.value,
            activate: onSave,
        });
        const visibleActions = draftEditor
            ? actions.filter((action) => action.id !== 'collapse')
            : actions;
        return stackedActions.value ? visibleActions.reverse() : visibleActions;
    });
    unsubscribeStaging = runtime.staging?.subscribe(onStagedQueueChange);
    options.registerRestore?.(onExpand);
    Vue.onMounted(() => {
        focusCurrentView(true);
        if (currentStaged.value) {
            void flushStagedReview().catch(reportStagedSyncError);
        }
    });
    return {
        assessment,
        assessmentHeading,
        assessmentHeadingTabIndex,
        batchAllSelected,
        batchConfirmOpen,
        batchContent,
        batchBackButton,
        batchEditor,
        batchPartiallySelected,
        batchPrepared,
        batchProgress,
        batchProgressMessage,
        batchRemovingTitle,
        batchReviewRows,
        batchSelectedCount,
        cancelLabel,
        cdxIconEdit,
        cdxIconTrash,
        classInput,
        classSelection,
        classOptions,
        commitClassName,
        currentSource,
        currentStaged,
        dialogTitle: msg(
            draftEditor ? 'dialog.batchEditTitle' : 'dialog.title',
            { title: state.subjectTitle },
        ),
        flushStagedReview,
        footerActions,
        importanceOptions,
        interfaceLocale,
        listSummary,
        maintenanceOptions: MAINTENANCE_OPTIONS,
        miniAssessmentLabel,
        miniExpandButton,
        miniHeading,
        minimized,
        msg,
        onAssessmentHeadingFocus,
        onBatchCancel,
        onBatchEdit,
        onBatchOpenChange,
        onBatchRemove,
        onBatchSelect,
        onBatchSelectAll,
        onCancel,
        onDismiss,
        onCollapse,
        onConfirmBatch,
        onExpand,
        onMiniSave,
        onOpenChange,
        onPreviewInput,
        onSave,
        onSummaryInput,
        open,
        otherProjectOptions,
        previewText,
        preparing,
        registrationDisabled,
        registrationLabel,
        saving,
        setClassName,
        selectClass,
        setImportance,
        setVideoGamesSelected,
        setRegister,
        setSelection,
        shouldRegister,
        stackedActions,
        status,
        statusType,
        summary,
        submitLabel,
        talkComparison,
        taskForceOptions: TASK_FORCE_OPTIONS,
        videoGamesDisabled,
        videoGamesSelected,
    };
}

interface SaveReviewRefs {
    listSummary: VueRef<string>;
    previewText: VueRef<string>;
    registrationDisabled: VueRef<boolean>;
    shouldRegister: VueRef<boolean>;
    summary: VueRef<string>;
}

function createSaveReview(refs: SaveReviewRefs): DialogSaveReview {
    return {
        listSummary: refs.listSummary.value.trim(),
        previewText: refs.previewText.value,
        shouldRegister:
            refs.shouldRegister.value && !refs.registrationDisabled.value,
        summary: refs.summary.value.trim(),
    };
}

function createAssessmentPreview(state: DialogState): string {
    return previewTalkPageTopSection(
        state.page.text,
        state.assessment,
        projectConfig,
    );
}

function buildRegistrationSummary(state: DialogState): string {
    const title = state.subjectInfo.listedTitle || state.subjectTitle;
    return buildNewPageListSummary(title, state.subjectInfo.creationDate);
}

function isRegistrationDisabled(registration: RegistrationResult): boolean {
    return !registration.eligible || registration.alreadyRegistered;
}

function getRegistrationLabel(
    registration: RegistrationResult,
    creationDate: Date,
): string {
    if (!registration.eligible) {
        return msg('registration.ineligible', {
            date: formatInterfaceDate(creationDate, true),
        });
    }
    const created = msg('registration.createdOn', {
        date: formatInterfaceDate(creationDate),
    });
    if (
        registration.existing?.date != null &&
        registration.existing.listedTitle
    ) {
        return msg('registration.existing', {
            date: formatInterfaceDate(registration.existing.date),
            title: registration.existing.listedTitle,
        });
    }
    if (registration.alreadyRegistered) {
        return msg('registration.alreadyRegistered');
    }
    return msg('registration.register', { created });
}

function formatInterfaceDate(date: Date, includeYear = false): string {
    return new Intl.DateTimeFormat(interfaceLocale, {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
        ...(includeYear ? { year: 'numeric' } : {}),
    }).format(date);
}

function getDefaultRegistration(state: DialogState): boolean {
    const registration = state.registration;
    return (
        state.assessment.importance !== NOT_VIDEO_GAME_IMPORTANCE &&
        registration.eligible &&
        !registration.alreadyRegistered
    );
}

function reportSavePhase(
    setStatus: (text: string, isError: boolean) => void,
    phase: DialogSavePhase,
): void {
    const text =
        phase === 'registration'
            ? msg('dialog.updatingNewPageList')
            : msg('dialog.savingTalkPage');
    setStatus(text, false);
}

function getClassLabel(value: string): string {
    return (
        KNOWN_CLASS_OPTIONS.find((option) => option.value === value)?.label ??
        value
    );
}

function getPresetClass(value: string): string {
    return CLASS_OPTIONS.some((option) => option.value === value) ? value : '';
}

function isAssessmentImportance(value: unknown): value is AssessmentImportance {
    return typeof value === 'string';
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** Copy plain state from a possibly reactive reviewed row without retaining proxies. */
function cloneDraftState(
    snapshot: Omit<DialogState, 'api'>,
): Omit<DialogState, 'api'> {
    return structuredClone({
        ...snapshot,
        assessment: JSON.parse(
            JSON.stringify(snapshot.assessment),
        ) as DialogState['assessment'],
        creationTimes: new Map(snapshot.creationTimes),
        newPageList: { ...snapshot.newPageList },
        page: { ...snapshot.page },
        registration: {
            ...snapshot.registration,
            existing:
                snapshot.registration.existing == null
                    ? null
                    : { ...snapshot.registration.existing },
        },
        subjectInfo: { ...snapshot.subjectInfo },
    });
}
