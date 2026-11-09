/**
 * @file src/wpvg-assessor/app/staged-assessments.ts
 * Purpose: Keeps reviewed drafts in the background and submits one registration edit.
 *
 * Contents: Shared staging, batch preparation/submission, and per-tab read caching.
 */

import type {
    DialogSaveReview,
    DialogState,
    RegistrationSave,
    SaveReviewedDialog,
    ReportDialogSavePhase,
} from './dialog-contracts.ts';
import type {
    AssessmentSessionStore,
    AssessmentStagingWorkflow,
    PreparedAssessmentBatch,
    StagedAssessment,
    ReportBatchSaveProgress,
    BatchSaveProgress,
} from './staging-contracts.ts';
import {
    getTitlesForDate,
    NEW_PAGE_LIST_TITLE,
    prepareNewPageListRegistration,
} from '../domain/new-page-list.ts';
import {
    createDefaultAssessment,
    hasDykInviteAtTop,
    parseAssessment,
} from '../domain/assessment.ts';
import {
    NOT_VIDEO_GAME_IMPORTANCE,
    type NewPageListSnapshot,
} from '../domain/types.ts';
import type { ProjectConfig } from '../domain/project-types.ts';
import { hasBatchTalkChange } from '../domain/batch-assessment.ts';
import type { Logger } from '../../library/logging/logger.ts';
import {
    buildNewPageListBatchSummary,
    type RegistrationSummaryEntry,
} from '../domain/new-page-summary.ts';

interface StagingOperations {
    session: AssessmentSessionStore;
    changedBatchMessage?: () => string;
    fetchNewPageList(api: mw.Api): Promise<NewPageListSnapshot>;
    fetchPageCreationTimes(
        api: mw.Api,
        titles: string[],
    ): Promise<Map<string, Date>>;
    saveRegistration(
        api: mw.Api,
        registration: RegistrationSave,
        summary: string,
    ): Promise<void>;
    saveReviewedDialog: SaveReviewedDialog;
    logger: Logger;
}

const BATCH_SAVE_INTERVAL_MS = 6000;

/** Pace actual edit requests, including conflict retries; read requests remain immediate. */
function createBatchEditApi(
    api: mw.Api,
    beforeEdit: (title: string) => Promise<void>,
    afterEdit: () => void = () => {},
): mw.Api {
    return new Proxy(api, {
        get(target, property) {
            if (property !== 'postWithToken') {
                const value: unknown = Reflect.get(target, property);
                return typeof value === 'function' ? value.bind(target) : value;
            }
            return async (
                token: string,
                params: Parameters<mw.Api['postWithToken']>[1],
            ) => {
                if (params.action !== 'edit')
                    return target.postWithToken(token, params);
                await beforeEdit(
                    typeof params.title === 'string' ? params.title : '',
                );
                let response;
                try {
                    response = await target.postWithToken(token, params);
                } catch (error) {
                    try {
                        afterEdit();
                    } catch {
                        /* Preserve the original write failure. */
                    }
                    throw error;
                }
                afterEdit();
                return response;
            };
        },
    });
}

export function createAssessmentStagingWorkflow(
    operations: StagingOperations,
    config: ProjectConfig,
): AssessmentStagingWorkflow {
    const { session, logger } = operations;
    let submitting = false;
    let nextEditAt = 0;
    let pacingShared = true;
    async function stage(
        state: DialogState,
        review: DialogSaveReview,
    ): Promise<void> {
        if (submitting) {
            throw new Error('A staged submission is already running.');
        }
        const draft = captureDraft(state, review);
        await session.runExclusive(async () => {
            const data = session.read();
            data.drafts = mergeCurrentDraft(data.drafts, draft);
            delete data.pages[draft.state.talkTitle];
            session.write(data);
            logger.info('draft.staged', { itemCount: data.drafts.length });
        });
    }
    async function unstage(talkTitle: string): Promise<void> {
        if (submitting) {
            throw new Error('A staged submission is already running.');
        }
        await session.runExclusive(async () => {
            removeDraft(talkTitle);
        });
    }
    function removeDraft(talkTitle: string): void {
        const data = session.read();
        const draft = data.drafts.find(
            (entry) => entry.state.talkTitle === talkTitle,
        );
        if (draft == null) {
            return;
        }
        if (data.newPageList != null) {
            data.pages[talkTitle] = {
                ...cloneSessionSnapshot(draft.state),
                assessment: createDefaultAssessment(
                    config,
                    draft.state.page.text,
                ),
                previewDirty: false,
                summaryDirty: false,
            };
        } else {
            delete data.pages[talkTitle];
        }
        data.drafts = data.drafts.filter(
            (entry) => entry.state.talkTitle !== talkTitle,
        );
        session.write(data);
        logger.info('draft.unstaged', { itemCount: data.drafts.length });
    }
    function assertBatchCurrent(draftSnapshot: string): void {
        if (
            typeof draftSnapshot !== 'string' ||
            fingerprint(session.read().drafts) !== draftSnapshot
        ) {
            throw new Error(
                operations.changedBatchMessage?.() ??
                    'The staged pages changed. Review the batch before saving.',
            );
        }
    }
    function cloneBatchEntries(
        entries: StagedAssessment[],
    ): StagedAssessment[] {
        const titles = new Set();
        return entries.map((entry) => {
            const title = entry.state.talkTitle;
            if (titles.has(title)) {
                throw new Error('The reviewed batch contains duplicate pages.');
            }
            titles.add(title);
            return {
                state: cloneSessionSnapshot(entry.state),
                review: { ...entry.review },
            };
        });
    }
    function mergeBatchEntries(
        drafts: StagedAssessment[],
        entries: StagedAssessment[],
    ): StagedAssessment[] {
        const remaining = new Map(
            entries.map((entry) => [entry.state.talkTitle, entry]),
        );
        const merged = drafts.map((draft) => {
            const title = draft.state.talkTitle;
            const replacement = remaining.get(title);
            remaining.delete(title);
            return replacement ?? draft;
        });
        return [...merged, ...remaining.values()];
    }
    async function prepare(
        state: DialogState,
        review: DialogSaveReview,
    ): Promise<PreparedAssessmentBatch> {
        const drafts = session.read().drafts;
        const entries = mergeCurrentDraft(drafts, captureDraft(state, review));
        return prepareSelection(state.api, entries, fingerprint(drafts));
    }
    async function prepareSelection(
        api: mw.Api,
        selected: StagedAssessment[],
        draftSnapshot: string,
    ): Promise<PreparedAssessmentBatch> {
        assertBatchCurrent(draftSnapshot);
        const entries = cloneBatchEntries(selected);
        const candidates = entries.filter((entry) =>
            canRegister(entry, config),
        );
        let registration: RegistrationSave | null = null;
        let registrationSummary = '';
        if (candidates.length > 0) {
            const snapshot = await operations.fetchNewPageList(api);
            const creationTimes = new Map();
            const neededTitles = new Set<string>();
            for (const entry of candidates) {
                for (const [title, date2] of entry.state.creationTimes) {
                    creationTimes.set(title, date2);
                }
                const { subjectInfo, subjectTitle } = entry.state;
                creationTimes.set(
                    subjectInfo.listedTitle || subjectTitle,
                    subjectInfo.creationDate,
                );
                for (const title of getTitlesForDate(
                    snapshot.text,
                    subjectInfo.creationDate,
                )) {
                    neededTitles.add(title);
                }
            }
            const missingTitles = [...neededTitles].filter(
                (title) => !creationTimes.has(title),
            );
            if (missingTitles.length > 0) {
                const fetched = await operations.fetchPageCreationTimes(
                    api,
                    missingTitles,
                );
                for (const [title, date2] of fetched) {
                    creationTimes.set(title, date2);
                }
            }
            let proposedText = snapshot.text;
            const summaries: RegistrationSummaryEntry[] = [];
            for (const entry of candidates) {
                const { subjectInfo, subjectTitle } = entry.state;
                const result = prepareNewPageListRegistration({
                    creationDate: subjectInfo.creationDate,
                    creationTimes,
                    includeDykIcon: hasDykInviteAtTop(entry.review.previewText),
                    namespaceNumber: subjectInfo.namespaceNumber,
                    text: proposedText,
                    title: subjectInfo.listedTitle || subjectTitle,
                });
                if (result.changed) {
                    proposedText = result.proposedText;
                    summaries.push({
                        title: subjectInfo.listedTitle || subjectTitle,
                        creationDate: subjectInfo.creationDate,
                        summary: entry.review.listSummary,
                    });
                }
            }
            if (proposedText !== snapshot.text) {
                registration = { snapshot, proposedText };
                registrationSummary = buildNewPageListBatchSummary(summaries);
            }
        }
        assertBatchCurrent(draftSnapshot);
        return { entries, registration, registrationSummary, draftSnapshot };
    }
    async function removeFromBatch(
        batch: PreparedAssessmentBatch,
        talkTitle: string,
    ): Promise<PreparedAssessmentBatch> {
        if (submitting) {
            throw new Error('A staged submission is already running.');
        }
        return session.runExclusive(async () => {
            assertBatchCurrent(batch.draftSnapshot);
            if (
                !batch.entries.some(
                    (entry) => entry.state.talkTitle === talkTitle,
                )
            ) {
                throw new Error('The page is not in the reviewed batch.');
            }
            const entries = cloneBatchEntries(
                batch.entries.filter(
                    (entry) => entry.state.talkTitle !== talkTitle,
                ),
            );
            removeDraft(talkTitle);
            return {
                entries,
                registration: null,
                registrationSummary: '',
                draftSnapshot: fingerprint(session.read().drafts),
            };
        });
    }
    async function updateInBatch(
        batch: PreparedAssessmentBatch,
        talkTitle: string,
        state: DialogState,
        review: DialogSaveReview,
    ): Promise<PreparedAssessmentBatch> {
        if (submitting) {
            throw new Error('A staged submission is already running.');
        }
        const draft = captureDraft(state, review);
        return session.runExclusive(async () => {
            assertBatchCurrent(batch.draftSnapshot);
            const previous = batch.entries.find(
                (entry) => entry.state.talkTitle === talkTitle,
            );
            if (previous == null) {
                throw new Error('The page is not in the reviewed batch.');
            }
            if (
                draft.state.talkTitle !== talkTitle ||
                draft.state.subjectTitle !== previous.state.subjectTitle
            ) {
                throw new Error('The edited draft belongs to another page.');
            }
            const entries = cloneBatchEntries(
                batch.entries.map((entry) =>
                    entry === previous ? draft : entry,
                ),
            );
            const data = session.read();
            const staged = data.drafts.some(
                (entry) => entry.state.talkTitle === talkTitle,
            );
            if (staged) {
                data.drafts = data.drafts.map((entry) =>
                    entry.state.talkTitle === talkTitle ? draft : entry,
                );
                delete data.pages[talkTitle];
                session.write(data);
                logger.info('draft.updated', { title: talkTitle });
            }
            return {
                entries,
                registration: null,
                registrationSummary: '',
                draftSnapshot: fingerprint(session.read().drafts),
            };
        });
    }
    async function save(
        api: mw.Api,
        batch: PreparedAssessmentBatch,
        reportPhase: ReportDialogSavePhase,
        reportProgress: ReportBatchSaveProgress = () => {},
    ) {
        if (submitting) {
            throw new Error('A staged submission is already running.');
        }
        submitting = true;
        try {
            return await session.runExclusive(async () => {
                try {
                    return await saveBatch(
                        api,
                        batch,
                        reportPhase,
                        reportProgress,
                    );
                } finally {
                    // A failed disposable timestamp must never reclassify a confirmed edit.
                    // Keep the lock until its interval expires when it cannot be shared.
                    if (!pacingShared) {
                        const remaining = nextEditAt - Date.now();
                        if (remaining > 0)
                            await new Promise((resolve) =>
                                setTimeout(resolve, remaining),
                            );
                    }
                }
            });
        } finally {
            submitting = false;
        }
    }
    async function saveBatch(
        api: mw.Api,
        batch: PreparedAssessmentBatch,
        reportPhase: ReportDialogSavePhase,
        reportProgress: ReportBatchSaveProgress,
    ) {
        assertBatchCurrent(batch.draftSnapshot);
        let saved = false;
        const entries = cloneBatchEntries(batch.entries);
        if (entries.length === 0) {
            reportProgress({
                completed: 0,
                total: 0,
                title: '',
                phase: 'complete',
                waitSeconds: 0,
            });
            return 'unchanged';
        }
        const total =
            entries.filter(hasBatchTalkChange).length +
            (batch.registration == null ? 0 : 1);
        let completed = 0;
        let currentTitle = '';
        function reportProgressState(
            phase: BatchSaveProgress['phase'],
            waitSeconds = 0,
        ) {
            reportProgress({
                completed,
                total,
                title: currentTitle,
                phase,
                waitSeconds,
            });
        }
        function postponeNextEdit() {
            nextEditAt = Date.now() + BATCH_SAVE_INTERVAL_MS;
            try {
                pacingShared = session.writeNextEditAt?.(nextEditAt) !== false;
            } catch {
                pacingShared = false;
                logger.warn('batch.pacing.write.failed');
            }
        }
        async function waitForNextEdit(title: string) {
            currentTitle = title;
            try {
                nextEditAt = Math.max(
                    nextEditAt,
                    session.readNextEditAt?.() ?? 0,
                );
            } catch {
                logger.warn('batch.pacing.read.failed');
            }
            let remaining = nextEditAt - Date.now();
            while (remaining > 0) {
                reportProgressState('waiting', Math.ceil(remaining / 1e3));
                await new Promise((resolve) => {
                    setTimeout(resolve, Math.min(remaining, 1e3));
                });
                remaining = nextEditAt - Date.now();
            }
            postponeNextEdit();
            reportProgressState('saving');
        }
        const batchApi = createBatchEditApi(
            api,
            waitForNextEdit,
            postponeNextEdit,
        );
        reportProgressState('saving');
        const data = session.read();
        data.drafts = mergeBatchEntries(data.drafts, structuredClone(entries));
        session.write(data);
        if (batch.registration != null) {
            currentTitle = NEW_PAGE_LIST_TITLE;
            reportPhase('registration');
            reportProgressState('saving');
            await operations.saveRegistration(
                batchApi,
                batch.registration,
                batch.registrationSummary,
            );
            saved = true;
            completed += 1;
            reportProgressState('saving');
        }
        for (const entry of entries) {
            entry.review.shouldRegister = false;
        }
        const registeredData = session.read();
        registeredData.drafts = mergeBatchEntries(
            registeredData.drafts,
            structuredClone(entries),
        );
        registeredData.newPageList = null;
        registeredData.pages = {};
        session.write(registeredData);
        for (const entry of entries) {
            const changed = hasBatchTalkChange(entry);
            let outcome: 'saved' | 'unchanged' = 'unchanged';
            if (changed) {
                currentTitle = entry.state.talkTitle;
                reportProgressState('saving');
                outcome = await operations.saveReviewedDialog(
                    { ...structuredClone(entry.state), api: batchApi },
                    { ...entry.review, shouldRegister: false },
                    reportPhase,
                );
            }
            saved ||= outcome === 'saved';
            const completedData = session.read();
            completedData.drafts = completedData.drafts.filter(
                (draft) => draft.state.talkTitle !== entry.state.talkTitle,
            );
            session.write(completedData);
            if (changed) {
                completed += 1;
                reportProgressState('saving');
            }
        }
        reportProgressState('complete');
        return saved ? 'saved' : 'unchanged';
    }
    return {
        count: () => session.read().drafts.length,
        getReview: (talkTitle) => {
            const draft = session
                .read()
                .drafts.find((entry) => entry.state.talkTitle === talkTitle);
            return draft == null ? null : structuredClone(draft.review);
        },
        stage,
        unstage,
        subscribe: (listener) => session.subscribe(listener),
        prepare,
        prepareSelection,
        removeFromBatch,
        updateInBatch,
        save,
    };
}

interface CachedLoaderOperations {
    session: AssessmentSessionStore;
    getTalkPageTitle(title: mw.Title): string;
    loadDialogState(api: mw.Api, title: mw.Title): Promise<DialogState>;
    logger: Logger;
}

/** Successful snapshots and in-flight loads are reused until a save invalidates them. */
export function createCachedDialogLoader(operations: CachedLoaderOperations) {
    const pending = new Map<string, Promise<DialogState>>();
    let generation = 0;
    async function load(api: mw.Api, title: mw.Title): Promise<DialogState> {
        const talkTitle = operations.getTalkPageTitle(title);
        const data = operations.session.read();
        const cached =
            data.drafts.find((draft) => draft.state.talkTitle === talkTitle)
                ?.state ?? data.pages[talkTitle];
        if (cached != null) {
            return { ...structuredClone(cached), api };
        }
        let promise = pending.get(talkTitle);
        if (promise == null) {
            const startedGeneration = generation;
            promise = operations.loadDialogState(api, title).then((state) => {
                if (startedGeneration === generation) {
                    const loaded = operations.session.read();
                    loaded.pages[talkTitle] = cloneDialogSnapshot(state);
                    loaded.newPageList = structuredClone(state.newPageList);
                    try {
                        operations.session.write(loaded);
                    } catch (error) {
                        operations.logger.warn('dialog-cache.write.failed', {
                            error,
                        });
                    }
                }
                return state;
            });
            pending.set(talkTitle, promise);
            void promise
                .finally(() => {
                    if (pending.get(talkTitle) === promise)
                        pending.delete(talkTitle);
                })
                .catch(() => undefined);
        }
        return { ...cloneDialogSnapshot(await promise), api };
    }
    function invalidate(): void {
        generation += 1;
        pending.clear();
        try {
            const data = operations.session.read();
            data.pages = {};
            data.newPageList = null;
            operations.session.write(data);
        } catch (error) {
            operations.logger.warn('dialog-cache.invalidate.failed', { error });
        }
    }
    return { load, invalidate };
}

function captureDraft(
    state: DialogState,
    review: DialogSaveReview,
): StagedAssessment {
    return {
        state: cloneDialogSnapshot(state),
        review: structuredClone(review),
    };
}

function cloneDialogSnapshot({
    api: _api,
    ...snapshot
}: DialogState): Omit<DialogState, 'api'> {
    return cloneSessionSnapshot(snapshot);
}

function cloneSessionSnapshot(
    snapshot: Omit<DialogState, 'api'>,
): Omit<DialogState, 'api'> {
    // Capture plain values even when a UI supplies deeply reactive Vue state.
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

function mergeCurrentDraft(
    drafts: StagedAssessment[],
    current: StagedAssessment,
): StagedAssessment[] {
    return [
        ...drafts.filter(
            (draft) => draft.state.talkTitle !== current.state.talkTitle,
        ),
        current,
    ];
}

function canRegister(entry: StagedAssessment, config: ProjectConfig): boolean {
    if (
        !entry.review.shouldRegister ||
        entry.state.assessment.importance === NOT_VIDEO_GAME_IMPORTANCE
    )
        return false;
    const assessment = parseAssessment(config, entry.review.previewText);
    return (
        assessment != null &&
        assessment.importance !== NOT_VIDEO_GAME_IMPORTANCE
    );
}

function fingerprint(drafts: StagedAssessment[]): string {
    return JSON.stringify(drafts, (_key, value: unknown) =>
        value instanceof Map ? [...value] : value,
    );
}
