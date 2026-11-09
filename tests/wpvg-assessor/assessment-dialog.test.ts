/**
 * @file tests/wpvg-assessor/assessment-dialog.test.ts
 * Purpose: Assessment controls retain shared class while video-game scope is disabled.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 * 4. createObservableStaging
 * 5. createStaging
 * 6. createPreparedBatch
 * 7. createRuntime
 * 8. createDialogState
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import type {
    DialogSaveReview,
    DialogState,
    PageAssessorRuntime,
} from '../../src/wpvg-assessor/app/dialog-contracts.ts';
import type {
    AssessmentStagingWorkflow,
    PreparedAssessmentBatch,
} from '../../src/wpvg-assessor/app/staging-contracts.ts';
import { createDefaultAssessment } from '../../src/wpvg-assessor/domain/assessment.ts';
import projectConfig from '../../src/wpvg-assessor/domain/project-config.ts';
import { NOT_VIDEO_GAME_IMPORTANCE } from '../../src/wpvg-assessor/domain/types.ts';
import { createAssessmentDialogBindings } from '../../src/wpvg-assessor/features/assessment/dialogs/assessment-dialog.ts';
import { buildEditSummary } from '../../src/wpvg-assessor/features/assessment/assessment-summary.ts';
import type { VueModule } from '../../src/wpvg-assessor/features/assessment/codex.ts';
import { createLogger } from '../../src/library/logging/logger.ts';

const originalSource = [
    '{{WikiProject banner shell|class=Start|1=',
    '{{WikiProject Video games|importance=Low|Sega=yes|needs-infobox=yes}}',
    '}}',
].join('\n');
const vue: VueModule = {
    shallowRef: (value) => ({ value }),
    nextTick: async (callback) => {
        callback();
    },
    computed(getter) {
        return {
            get value() {
                return getter();
            },
        };
    },
    createMwApp() {
        throw new Error('Bindings do not mount an app.');
    },
    defineComponent: (component) => component,
    onMounted() {},
    onUnmounted() {},
    reactive: (value) => value,
    ref: (value) => ({ value }),
};

test('out-of-scope controls block video-game setters and stale registration', async () => {
    const state = createDialogState();
    let capturedReview: DialogSaveReview | undefined;
    const bindings = createAssessmentDialogBindings(vue, {
        currentNamespace: 0,
        onClose() {},
        runtime: createRuntime(async (_state, review) => {
            capturedReview = review;
            throw new Error('Stop after review capture.');
        }),
        state,
    });

    assert.equal(bindings.dialogTitle, 'Article Assessor (Example game)');
    assert.equal(bindings.shouldRegister.value, true);
    bindings.setImportance(NOT_VIDEO_GAME_IMPORTANCE);
    assert.equal(bindings.videoGamesDisabled.value, true);
    assert.equal(bindings.shouldRegister.value, false);
    assert.equal(bindings.registrationDisabled.value, true);
    assert.equal(bindings.showRegistrationPreview.value, false);
    assert.deepEqual(bindings.listComparison.value.rows, []);

    const selections = structuredClone(state.assessment);
    bindings.setSelection('taskForces', 'pokemon', true);
    bindings.setSelection('maintenance', 'reassess', true);
    bindings.setRegister(true);
    assert.deepEqual(state.assessment.taskForces, selections.taskForces);
    assert.deepEqual(state.assessment.maintenance, selections.maintenance);
    assert.equal(bindings.shouldRegister.value, false);

    bindings.setClassName('B');
    bindings.setSelection('otherProjects', 'acg', true);
    assert.match(bindings.previewText.value, /class=B/u);
    assert.match(bindings.previewText.value, /ACG專題/u);
    assert.doesNotMatch(bindings.previewText.value, /WikiProject Video games/u);
    assert.doesNotMatch(bindings.previewText.value, /NotVG/u);

    bindings.shouldRegister.value = true;
    await bindings.onSave();
    assert.equal(capturedReview?.shouldRegister, false);
    assert.equal(capturedReview?.previewText, bindings.previewText.value);
});

test('manual non-video-game source synchronizes scope and keeps registration unselected', () => {
    const bindings = createAssessmentDialogBindings(vue, {
        currentNamespace: 0,
        onClose() {},
        runtime: createRuntime(),
        state: createDialogState(),
    });
    const manual =
        '{{WPBS|class=C|1={{ACG專題}}}}\n<!-- Reviewed independently -->';

    bindings.onPreviewInput(manual);
    assert.equal(bindings.assessment.importance, NOT_VIDEO_GAME_IMPORTANCE);
    assert.equal(bindings.assessment.className, 'C');
    assert.equal(bindings.assessment.otherProjects.acg, true);
    assert.equal(bindings.videoGamesDisabled.value, true);
    assert.equal(bindings.previewText.value, manual);
    assert.equal(bindings.shouldRegister.value, false);
    assert.equal(bindings.registrationDisabled.value, true);

    bindings.setImportance('High');
    assert.equal(bindings.videoGamesDisabled.value, false);
    assert.equal(bindings.registrationDisabled.value, false);
    assert.equal(bindings.shouldRegister.value, false);
    assert.match(bindings.previewText.value, /importance=High/u);
    assert.match(bindings.previewText.value, /Reviewed independently/u);
});

test('unrecognizable manual source makes registration unavailable', () => {
    const bindings = createAssessmentDialogBindings(vue, {
        currentNamespace: 0,
        onClose() {},
        runtime: createRuntime(),
        state: createDialogState(),
    });

    bindings.onPreviewInput('A manually reviewed lead without a banner.');
    assert.equal(bindings.registrationDisabled.value, true);
    assert.equal(bindings.shouldRegister.value, false);
    bindings.setRegister(true);
    assert.equal(bindings.shouldRegister.value, false);
    assert.equal(bindings.showRegistrationPreview.value, false);
});

test('editable shared class accepts hidden codes and aliases without rewriting the typing draft', () => {
    const bindings = createAssessmentDialogBindings(vue, {
        currentNamespace: 0,
        onClose() {},
        runtime: createRuntime(),
        state: createDialogState(),
    });
    assert.equal(bindings.classInput.value, '');
    assert.equal(bindings.classSelection.value, 'Start');
    for (const hidden of ['A', 'FL', 'B+']) {
        assert.equal(
            bindings.classOptions.value.some(
                (option) => option.value === hidden,
            ),
            false,
        );
    }
    for (const draft of ['b', 'bp', 'bpl', 'bplu', 'bplus']) {
        bindings.setClassName(draft);
        assert.equal(bindings.classInput.value, draft);
    }
    assert.equal(bindings.assessment.className, 'B+');
    assert.match(bindings.previewText.value, /class=B\+/u);
    bindings.commitClassName();
    assert.equal(bindings.classInput.value, 'B+');
    assert.equal(
        bindings.classOptions.value.some((option) => option.value === 'B+'),
        false,
    );

    bindings.setClassName('fl');
    bindings.commitClassName();
    assert.equal(bindings.classInput.value, 'FL');
    assert.equal(bindings.assessment.className, 'FL');
    assert.equal(
        bindings.classOptions.value.some((option) => option.value === 'B+'),
        false,
    );
    bindings.setClassName('  Future-class  ');
    assert.equal(bindings.classInput.value, '  Future-class  ');
    assert.equal(bindings.assessment.className, 'Future-class');
    bindings.commitClassName();
    assert.equal(bindings.classInput.value, 'Future-class');
    bindings.selectClass('B');
    assert.equal(bindings.classSelection.value, 'B');
    assert.equal(bindings.assessment.className, 'B');
    assert.equal(bindings.classInput.value, 'Future-class');
    bindings.selectClass('');
    assert.equal(bindings.classSelection.value, '');
    assert.equal(bindings.assessment.className, 'Future-class');
});

test('non-video-game summaries describe shared class and only actual banner removal', () => {
    const assessment = createDefaultAssessment(projectConfig, originalSource);
    assessment.importance = NOT_VIDEO_GAME_IMPORTANCE;
    assessment.className = 'B';
    assessment.otherProjects.acg = true;
    assessment.taskForces.pokemon = true;
    assessment.maintenance.reassess = true;

    const removal = buildEditSummary(assessment, undefined, originalSource);
    assert.match(
        removal,
        /Update assessment: Start→B; remove Video games banner; add ACG/u,
    );
    assert.match(removal, /remove Video games banner/u);
    assert.doesNotMatch(removal, /importance|NotVG|Pokemon|Reassess|Sega/u);

    const omission = buildEditSummary(assessment, undefined, '');
    assert.match(omission, /Update shared assessment \(B\): ACG/u);
    assert.doesNotMatch(omission, /Video games/u);
    assessment.otherProjects.acg = false;
    const sharedOnly = buildEditSummary(assessment);
    assert.match(sharedOnly, /^Update shared assessment \(B\) /u);
    assert.doesNotMatch(sharedOnly, /Video games/u);
});

test('Stage keeps exact reviewed drafts synchronized and Unstage preserves the form', async (context) => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const drafts = new Map<string, DialogSaveReview>();
    const bindings = createAssessmentDialogBindings(vue, {
        currentNamespace: 0,
        onClose() {},
        runtime: {
            ...createRuntime(),
            staging: createStaging({
                count: () => drafts.size,
                getReview: (title) => drafts.get(title) ?? null,
                async stage(state, review) {
                    drafts.set(state.talkTitle, structuredClone(review));
                },
                async unstage(title) {
                    drafts.delete(title);
                },
            }),
        },
        state: createDialogState(),
    });
    assert.equal(bindings.currentStaged.value, false);
    await bindings.onStage(true);
    bindings.onPreviewInput(`${originalSource}\n<!-- Exact review -->`);
    bindings.onSummaryInput('Exact summary');
    bindings.setListSummary('Exact list summary');
    bindings.setRegister(false);
    context.mock.timers.tick(251);
    for (let index = 0; index < 10; index += 1) await Promise.resolve();
    assert.equal(drafts.get('Talk:Example game')?.summary, 'Exact summary');
    assert.equal(
        drafts.get('Talk:Example game')?.previewText,
        bindings.previewText.value,
    );
    assert.equal(drafts.get('Talk:Example game')?.shouldRegister, false);
    await bindings.onStage(false);
    assert.equal(drafts.size, 0);
    assert.equal(bindings.summary.value, 'Exact summary');
    assert.equal(bindings.open.value, true);
});

test('a staged synchronization failure retains the open reviewed form', async () => {
    const review = {
        previewText: originalSource,
        summary: 'Old',
        listSummary: 'List',
        shouldRegister: false,
    };
    const bindings = createAssessmentDialogBindings(vue, {
        currentNamespace: 0,
        onClose() {
            assert.fail('Failed draft flush must keep the dialog open.');
        },
        runtime: {
            ...createRuntime(),
            staging: createStaging({
                getReview: () => review,
                async stage() {
                    throw new Error('Storage unavailable');
                },
            }),
        },
        state: createDialogState(),
    });
    bindings.onSummaryInput('Retained summary');
    await bindings.onCancel();
    assert.equal(bindings.open.value, true);
    assert.equal(bindings.summary.value, 'Retained summary');
    assert.match(bindings.status.value, /Storage unavailable/u);
});

test('Submit prepares a selected-page review before any batch write', async () => {
    const state = createDialogState();
    const batch = createPreparedBatch(state);
    let saves = 0;
    const bindings = createAssessmentDialogBindings(vue, {
        currentNamespace: 0,
        onClose() {},
        state,
        runtime: {
            ...createRuntime(),
            staging: createStaging({
                count: () => 1,
                async prepare() {
                    return batch;
                },
                async save(_api, saved) {
                    saves += 1;
                    assert.equal(saved, batch);
                    throw new Error('Stopped save');
                },
            }),
        },
    });
    await bindings.onSave();
    assert.equal(saves, 0);
    assert.equal(bindings.batchConfirmOpen.value, true);
    assert.equal(bindings.batchReviewRows.value.length, 2);
    assert.equal(bindings.batchSelectedCount.value, 2);
    assert.equal(
        bindings.batchRegistrationReview.value?.summary,
        'Combined list summary',
    );
    await bindings.onConfirmBatch();
    assert.equal(saves, 1);
    assert.match(bindings.status.value, /Stopped save/u);
    assert.equal(bindings.saving.value, false);
});

test('selection prepares exactly checked entries and an empty selection blocks saving', async () => {
    const state = createDialogState();
    const batch = createPreparedBatch(state);
    let selected: string[] = [];
    let saves = 0;
    const bindings = createAssessmentDialogBindings(vue, {
        currentNamespace: 0,
        onClose() {},
        state,
        runtime: {
            ...createRuntime(),
            staging: createStaging({
                count: () => 1,
                async prepare() {
                    return batch;
                },
                async prepareSelection(_api, entries, draftSnapshot) {
                    selected = entries.map((entry) => entry.state.talkTitle);
                    return {
                        ...batch,
                        entries,
                        draftSnapshot,
                        registration: null,
                    };
                },
                async save() {
                    saves += 1;
                    return 'unchanged';
                },
            }),
        },
    });
    await bindings.onSave();
    await bindings.onBatchSelect(state.talkTitle, false);
    assert.deepEqual(selected, ['Talk:Other game']);
    assert.equal(bindings.batchPartiallySelected.value, true);
    await bindings.onBatchSelectAll(false);
    assert.equal(bindings.batchSelectedCount.value, 0);
    await bindings.onConfirmBatch();
    assert.equal(saves, 0);
});

test('removing a reviewed row rebuilds the selected registration preview', async () => {
    const state = createDialogState();
    const batch = createPreparedBatch(state);
    let removed = '';
    const bindings = createAssessmentDialogBindings(vue, {
        currentNamespace: 0,
        onClose() {},
        state,
        runtime: {
            ...createRuntime(),
            staging: createStaging({
                count: () => 1,
                async prepare() {
                    return batch;
                },
                async removeFromBatch(previous, title) {
                    removed = title;
                    return {
                        ...previous,
                        entries: previous.entries.filter(
                            (entry) => entry.state.talkTitle !== title,
                        ),
                    };
                },
                async prepareSelection(_api, entries, draftSnapshot) {
                    return {
                        ...batch,
                        entries,
                        draftSnapshot,
                        registration: null,
                    };
                },
            }),
        },
    });
    await bindings.onSave();
    await bindings.onBatchRemove('Talk:Other game');
    assert.equal(removed, 'Talk:Other game');
    assert.equal(bindings.batchReviewRows.value.length, 1);
    assert.equal(bindings.batchRegistrationReview.value, null);
    assert.equal(bindings.batchSelectedCount.value, 1);
});

test('an external queue change invalidates the pending review while retaining form edits', async () => {
    const state = createDialogState();
    const delayed = Promise.withResolvers<PreparedAssessmentBatch>();
    let saves = 0;
    const observable = createObservableStaging({
        count: () => 1,
        prepare: () => delayed.promise,
        async save() {
            saves += 1;
            return 'saved';
        },
    });
    const bindings = createAssessmentDialogBindings(vue, {
        currentNamespace: 0,
        onClose() {},
        state,
        runtime: { ...createRuntime(), staging: observable.staging },
    });
    bindings.onSummaryInput('Keep editable summary');
    const preparing = bindings.onSave();
    await Promise.resolve();
    observable.notify();
    delayed.resolve(createPreparedBatch(state));
    await preparing;
    assert.equal(bindings.batchConfirmOpen.value, false);
    assert.equal(bindings.summary.value, 'Keep editable summary');
    assert.equal(saves, 0);
    assert.match(bindings.status.value, /changed/u);
    await bindings.onCancel();
    assert.equal(observable.subscriberCount(), 0);
});

test('compact mode retains the draft and an existing launcher restores its current view', async () => {
    let restore: (() => void) | null = null;
    const bindings = createAssessmentDialogBindings(vue, {
        currentNamespace: 0,
        onClose() {},
        state: createDialogState(),
        runtime: createRuntime(),
        registerRestore(handler) {
            restore = handler;
        },
    });
    bindings.onSummaryInput('Keep draft');
    bindings.onCollapse();
    assert.equal(bindings.minimized.value, true);
    assert.equal(bindings.open.value, true);
    assert.equal(typeof restore, 'function');
    (restore as unknown as () => void)();
    assert.equal(bindings.minimized.value, false);
    assert.equal(bindings.summary.value, 'Keep draft');
    await bindings.onCancel();
    assert.equal(restore, null);
});

test('pending batch writes reject duplicate confirmation, edits, and close attempts', async () => {
    const state = createDialogState();
    const delayed = Promise.withResolvers<void>();
    let saves = 0;
    const bindings = createAssessmentDialogBindings(vue, {
        currentNamespace: 0,
        onClose() {},
        state,
        runtime: {
            ...createRuntime(),
            staging: createStaging({
                count: () => 1,
                async prepare() {
                    return createPreparedBatch(state);
                },
                async save() {
                    saves += 1;
                    await delayed.promise;
                    throw new Error('Stop after capture');
                },
            }),
        },
    });
    await bindings.onSave();
    const saving = bindings.onConfirmBatch();
    assert.equal(bindings.saving.value, true);
    await bindings.onConfirmBatch();
    await bindings.onCancel();
    bindings.onBatchCancel();
    bindings.onBatchOpenChange(false);
    const source = bindings.previewText.value;
    bindings.onPreviewInput('Unreviewed late edit');
    assert.equal(bindings.previewText.value, source);
    assert.equal(bindings.batchConfirmOpen.value, true);
    assert.equal(bindings.open.value, true);
    assert.equal(saves, 1);
    delayed.resolve();
    await saving;
});

function createObservableStaging(
    overrides: Partial<AssessmentStagingWorkflow>,
) {
    const listeners = new Set<() => void>();
    return {
        staging: createStaging({
            ...overrides,
            subscribe(listener) {
                listeners.add(listener);
                return () => {
                    listeners.delete(listener);
                };
            },
        }),
        notify() {
            for (const listener of listeners) listener();
        },
        subscriberCount: () => listeners.size,
    };
}

function createStaging(
    overrides: Partial<AssessmentStagingWorkflow>,
): AssessmentStagingWorkflow {
    return {
        count: () => 0,
        getReview: () => null,
        subscribe: () => () => {},
        async stage() {
            throw new Error('Unexpected staging call.');
        },
        async unstage() {
            throw new Error('Unexpected unstaging call.');
        },
        async prepare() {
            throw new Error('Unexpected preparation call.');
        },
        async save() {
            throw new Error('Unexpected batch save.');
        },
        async prepareSelection() {
            throw new Error('Unexpected batch selection.');
        },
        async removeFromBatch() {
            throw new Error('Unexpected batch removal.');
        },
        async updateInBatch() {
            throw new Error('Unexpected batch update.');
        },
        ...overrides,
    };
}

function createPreparedBatch(state: DialogState): PreparedAssessmentBatch {
    const stagedState: Omit<DialogState, 'api'> = state;
    const review: DialogSaveReview = {
        listSummary: 'Reviewed list summary',
        previewText: originalSource,
        shouldRegister: true,
        summary: 'Reviewed talk summary',
    };
    return {
        draftSnapshot: 'reviewed-drafts',
        entries: [
            {
                review,
                state: stagedState,
            },
            {
                review: {
                    ...review,
                    previewText: 'Other reviewed lead',
                    summary: 'Other reviewed summary',
                },
                state: {
                    ...stagedState,
                    subjectTitle: 'Other game',
                    talkTitle: 'Talk:Other game',
                },
            },
        ],
        registration: {
            proposedText: 'Combined list',
            snapshot: state.newPageList,
        },
        registrationSummary: 'Combined list summary',
    };
}

function createRuntime(
    saveReviewedDialog: PageAssessorRuntime['saveReviewedDialog'] = async () =>
        'unchanged',
): PageAssessorRuntime {
    return {
        createDialogPageContext() {
            throw new Error('Bindings do not acquire page context.');
        },
        async loadDialogState() {
            throw new Error('Bindings do not load pages.');
        },
        logger: createLogger('assessment-dialog-test', { level: 'silent' }),
        notify() {},
        saveReviewedDialog,
    };
}

function createDialogState(): DialogState {
    return {
        api: {} as mw.Api,
        assessment: createDefaultAssessment(projectConfig, originalSource),
        creationTimes: new Map(),
        newPageList: {
            basetimestamp: '2026-09-30T23:00:00Z',
            starttimestamp: '2026-10-01T00:00:00Z',
            text: 'old list',
        },
        page: {
            exists: true,
            starttimestamp: '2026-10-01T00:00:00Z',
            text: originalSource,
        },
        previewDirty: false,
        registration: {
            alreadyRegistered: false,
            changed: true,
            earliestDate: new Date('2026-09-30T00:00:00Z'),
            eligible: true,
            existing: null,
            proposedText: 'updated list',
        },
        subjectInfo: {
            creationDate: new Date('2026-09-30T00:00:00Z'),
            isRedirect: false,
            listedTitle: 'Example game',
            namespaceNumber: 0,
            targetTitle: 'Example game',
        },
        subjectTitle: 'Example game',
        summaryDirty: false,
        talkTitle: 'Talk:Example game',
    };
}
