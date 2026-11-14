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
import {
    createAssessmentDialogBindings as createDefaultAssessmentDialogBindings,
    type AssessmentDialogOptions,
} from '../../src/wpvg-assessor/features/assessment/dialogs/assessment-dialog.ts';
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

test('ordinary assessments open compact and stage their initial reviewed draft after mount without wiki edits', async () => {
    const mounted: Array<() => void> = [];
    const staging = createStaging({});
    let wikiWrites = 0;
    const state = createDialogState();
    const bindings = createDefaultAssessmentDialogBindings(
        { ...vue, onMounted: (callback) => mounted.push(callback) },
        {
            onClose() {},
            runtime: {
                ...createRuntime(async () => {
                    wikiWrites += 1;
                    return 'saved';
                }),
                staging,
            },
            state,
        },
    );
    assert.equal(bindings.minimized.value, true);
    assert.equal(bindings.currentStaged.value, true);
    assert.equal(staging.count(), 0);
    for (const callback of mounted) callback();
    for (let index = 0; index < 10; index += 1) await Promise.resolve();
    assert.equal(staging.count(), 1);
    assert.deepEqual(staging.getReview(state.talkTitle), {
        previewText: bindings.previewText.value,
        summary: bindings.summary.value,
        listSummary: bindings.listSummary.value,
        shouldRegister: bindings.shouldRegister.value,
    });
    assert.equal(bindings.currentStaged.value, true);
    assert.equal(bindings.minimized.value, true);
    assert.equal(wikiWrites, 0);
    await bindings.onDismiss();
    assert.equal(staging.count(), 1);
    assert.equal(wikiWrites, 0);
});

test('eligible registration defaults checked even when the existing assessment is unchanged or the title is a subpage', () => {
    for (const [subjectTitle, namespaceNumber] of [
        ['Example game', 0],
        ['Example game/Details', 0],
        ['User:Example/Draft', 2],
    ] as const) {
        const state = createDialogState();
        state.subjectTitle = subjectTitle;
        state.subjectInfo.namespaceNumber = namespaceNumber;
        const bindings = createAssessmentDialogBindings(vue, {
            onClose() {},
            runtime: createRuntime(),
            state,
        });
        assert.equal(bindings.registrationDisabled.value, false);
        assert.equal(bindings.shouldRegister.value, true);
    }
});

test('restored registration opt-out and its authored summary survive edits and are captured unchanged for saving', async () => {
    const state = createDialogState();
    let savedReview: DialogSaveReview | undefined;
    const review = {
        previewText: originalSource,
        summary: 'Restored talk summary',
        listSummary: 'Authored registration summary',
        shouldRegister: false,
    };
    const bindings = createAssessmentDialogBindings(vue, {
        onClose() {},
        state,
        review,
        runtime: createRuntime(async (_state, captured) => {
            savedReview = captured;
            throw new Error('Stop after capture');
        }),
    });
    assert.equal(bindings.shouldRegister.value, false);
    bindings.setClassName('B');
    assert.equal(bindings.shouldRegister.value, false);
    await bindings.onSave();
    assert.equal(savedReview?.shouldRegister, false);
    assert.equal(savedReview?.listSummary, 'Authored registration summary');
});

test('ineligible and already registered assessments do not request registration', () => {
    for (const registration of [
        { eligible: false, changed: false },
        { alreadyRegistered: true, changed: false },
    ]) {
        const state = createDialogState();
        Object.assign(state.registration, registration);
        const bindings = createAssessmentDialogBindings(vue, {
            onClose() {},
            runtime: createRuntime(),
            state,
        });
        assert.equal(bindings.shouldRegister.value, false);
        assert.equal(bindings.registrationDisabled.value, true);
        bindings.setRegister(true);
        assert.equal(bindings.shouldRegister.value, false);
    }
});

test('failed initial staging keeps compact source open and reports that its draft was not queued', async () => {
    const mounted: Array<() => void> = [];
    const bindings = createDefaultAssessmentDialogBindings(
        { ...vue, onMounted: (callback) => mounted.push(callback) },
        {
            onClose() {
                assert.fail('A storage failure must preserve the draft.');
            },
            runtime: {
                ...createRuntime(),
                staging: createStaging({
                    async stage() {
                        throw new Error('Initial queue storage unavailable');
                    },
                }),
            },
            state: createDialogState(),
        },
    );
    const reviewedSource = bindings.previewText.value;
    for (const callback of mounted) callback();
    for (let index = 0; index < 10; index += 1) await Promise.resolve();
    assert.equal(bindings.minimized.value, true);
    assert.equal(bindings.open.value, true);
    assert.equal(bindings.currentStaged.value, false);
    assert.equal(bindings.previewText.value, reviewedSource);
    assert.match(bindings.status.value, /Initial queue storage unavailable/u);
});

test('Next retries failed initial staging and reviews the latest draft without a direct wiki write', async () => {
    const mounted: Array<() => void> = [];
    const state = createDialogState();
    const drafts = new Map<string, DialogSaveReview>();
    let stageAttempts = 0;
    let wikiWrites = 0;
    let preparations = 0;
    const bindings = createDefaultAssessmentDialogBindings(
        { ...vue, onMounted: (callback) => mounted.push(callback) },
        {
            onClose() {},
            state,
            runtime: {
                ...createRuntime(async () => {
                    wikiWrites += 1;
                    return 'saved';
                }),
                staging: createStaging({
                    count: () => drafts.size,
                    getReview: (title) => drafts.get(title) ?? null,
                    async stage(state, review) {
                        stageAttempts += 1;
                        if (stageAttempts === 1)
                            throw new Error('Temporary storage failure');
                        drafts.set(state.talkTitle, structuredClone(review));
                    },
                    async prepare(_state, review) {
                        preparations += 1;
                        assert.equal(
                            review.summary,
                            'Latest review after failure',
                        );
                        assert.deepEqual(drafts.get(state.talkTitle), review);
                        return createPreparedBatch(state);
                    },
                }),
            },
        },
    );
    for (const callback of mounted) callback();
    for (let index = 0; index < 10; index += 1) await Promise.resolve();
    assert.equal(bindings.currentStaged.value, false);
    bindings.onSummaryInput('Latest review after failure');
    bindings.onExpand();
    await bindings.onSave();
    assert.equal(stageAttempts, 2);
    assert.equal(preparations, 1);
    assert.equal(bindings.currentStaged.value, true);
    assert.equal(bindings.batchConfirmOpen.value, true);
    assert.equal(wikiWrites, 0);
    await bindings.onDismiss();
});

test('queued draft editing starts expanded and only applies the exact review explicitly', async () => {
    const mounted: Array<() => void> = [];
    const applied: DialogSaveReview[] = [];
    const bindings = createDefaultAssessmentDialogBindings(
        { ...vue, onMounted: (callback) => mounted.push(callback) },
        {
            onClose() {},
            runtime: createRuntime(),
            state: createDialogState(),
            async onDraftApply(_state, review) {
                applied.push(structuredClone(review));
            },
        },
    );
    for (const callback of mounted) callback();
    assert.equal(bindings.minimized.value, false);
    assert.equal(bindings.currentStaged.value, false);
    assert.equal(applied.length, 0);
    bindings.onSummaryInput('Explicit queued review');
    await bindings.onSave();
    assert.equal(applied.length, 1);
    assert.equal(applied[0]?.summary, 'Explicit queued review');
    assert.equal(applied[0]?.previewText, bindings.previewText.value);
});

test('Cancel in the queued draft editor closes without applying or removing the queued review', async () => {
    const state = createDialogState();
    const review = createPreparedBatch(state).entries[0]!.review;
    const staging = createStaging({});
    await staging.stage(state, review);
    let applies = 0;
    const bindings = createDefaultAssessmentDialogBindings(vue, {
        onClose() {},
        state,
        review,
        runtime: { ...createRuntime(), staging },
        async onDraftApply() {
            applies += 1;
        },
    });
    bindings.onSummaryInput('Unapplied editor summary');
    await bindings.onCancel();
    assert.equal(bindings.open.value, false);
    assert.equal(applies, 0);
    assert.deepEqual(staging.getReview(state.talkTitle), review);
});

test('clearing Video games preserves shared class and project saves while blocking its hidden branch', async () => {
    const state = createDialogState();
    let capturedReview: DialogSaveReview | undefined;
    const bindings = createAssessmentDialogBindings(vue, {
        onClose() {},
        runtime: createRuntime(async (_state, review) => {
            capturedReview = review;
            throw new Error('Stop after review capture.');
        }),
        state,
    });

    assert.equal(bindings.dialogTitle, 'Article Assessor (Example game)');
    assert.equal(bindings.shouldRegister.value, true);
    assert.equal(bindings.videoGamesSelected.value, true);
    bindings.setVideoGamesSelected(false);
    assert.equal(bindings.videoGamesSelected.value, false);
    assert.equal(bindings.videoGamesDisabled.value, true);
    assert.equal(bindings.shouldRegister.value, false);
    assert.equal(bindings.registrationDisabled.value, true);

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
    assert.equal(bindings.videoGamesSelected.value, false);

    bindings.setVideoGamesSelected(true);
    bindings.setImportance('High');
    assert.equal(bindings.videoGamesSelected.value, true);
    assert.equal(bindings.videoGamesDisabled.value, false);
    assert.equal(bindings.registrationDisabled.value, false);
    assert.equal(bindings.shouldRegister.value, false);
    assert.match(bindings.previewText.value, /importance=High/u);
    assert.match(bindings.previewText.value, /Reviewed independently/u);
});

test('Video games rechecking restores the previous importance and preserves its other draft flags', () => {
    const bindings = createAssessmentDialogBindings(vue, {
        onClose() {},
        runtime: createRuntime(),
        state: createDialogState(),
    });
    bindings.setImportance('High');
    bindings.setSelection('taskForces', 'pokemon', true);
    bindings.setSelection('maintenance', 'reassess', true);
    bindings.setVideoGamesSelected(false);
    assert.equal(bindings.assessment.importance, NOT_VIDEO_GAME_IMPORTANCE);
    assert.doesNotMatch(bindings.previewText.value, /WikiProject Video games/u);
    bindings.setClassName('B');
    bindings.setSelection('otherProjects', 'acg', true);
    bindings.setVideoGamesSelected(true);
    assert.equal(bindings.assessment.importance, 'High');
    assert.equal(bindings.assessment.className, 'B');
    assert.equal(bindings.assessment.otherProjects.acg, true);
    assert.equal(bindings.assessment.taskForces.pokemon, true);
    assert.equal(bindings.assessment.maintenance.reassess, true);
    assert.match(bindings.previewText.value, /importance=High/u);
    assert.match(bindings.previewText.value, /Pokemon=yes/u);
    assert.match(bindings.previewText.value, /reassess=yes/u);
    assert.equal(bindings.shouldRegister.value, false);
});

test('manual Video games source refreshes the importance retained by its checkbox', () => {
    const bindings = createAssessmentDialogBindings(vue, {
        onClose() {},
        runtime: createRuntime(),
        state: createDialogState(),
    });
    bindings.setImportance('High');
    bindings.setVideoGamesSelected(false);
    bindings.onPreviewInput(
        '{{WPBS|class=C|1={{WikiProject Video games|importance=Critical}}}}\n<!-- exact source -->',
    );
    assert.equal(bindings.videoGamesSelected.value, true);
    assert.equal(bindings.assessment.importance, 'Critical');
    bindings.setVideoGamesSelected(false);
    bindings.setVideoGamesSelected(true);
    assert.equal(bindings.assessment.importance, 'Critical');
    assert.match(bindings.previewText.value, /importance=Critical/u);
    assert.match(bindings.previewText.value, /exact source/u);
});

test('fresh assessment selects Video games while an existing shared-only assessment keeps it cleared', () => {
    for (const [source, selected] of [
        ['', true],
        ['{{WPBS|class=C|1={{ACG專題}}}}', false],
    ] as const) {
        const state = createDialogState();
        state.page.text = source;
        state.assessment = createDefaultAssessment(projectConfig, source);
        const bindings = createAssessmentDialogBindings(vue, {
            onClose() {},
            runtime: createRuntime(),
            state,
        });
        assert.equal(bindings.videoGamesSelected.value, selected);
        bindings.setClassName('B');
        assert.equal(bindings.videoGamesSelected.value, selected);
        assert.equal(bindings.assessment.className, 'B');
        assert.equal(
            /WikiProject Video games/u.test(bindings.previewText.value),
            selected,
        );
    }
});

test('unrecognizable manual source makes registration unavailable', () => {
    const bindings = createAssessmentDialogBindings(vue, {
        onClose() {},
        runtime: createRuntime(),
        state: createDialogState(),
    });

    bindings.onPreviewInput('A manually reviewed lead without a banner.');
    assert.equal(bindings.registrationDisabled.value, true);
    assert.equal(bindings.shouldRegister.value, false);
    bindings.setRegister(true);
    assert.equal(bindings.shouldRegister.value, false);
});

test('editable shared class accepts hidden codes and aliases without rewriting the typing draft', () => {
    const bindings = createAssessmentDialogBindings(vue, {
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

test('automatic staging preserves exact source, summaries, and registration until dismissal', async (context) => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const drafts = new Map<string, DialogSaveReview>();
    const bindings = createAssessmentDialogBindings(vue, {
        onClose() {},
        review: {
            previewText: originalSource,
            summary: 'Original summary',
            listSummary: 'Exact list summary',
            shouldRegister: true,
        },
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
    assert.equal(bindings.currentStaged.value, true);
    bindings.onPreviewInput(`${originalSource}\n<!-- Exact review -->`);
    bindings.onSummaryInput('Exact summary');
    bindings.setRegister(false);
    context.mock.timers.tick(251);
    for (let index = 0; index < 10; index += 1) await Promise.resolve();
    assert.equal(drafts.get('Talk:Example game')?.summary, 'Exact summary');
    assert.equal(
        drafts.get('Talk:Example game')?.listSummary,
        'Exact list summary',
    );
    assert.equal(
        drafts.get('Talk:Example game')?.previewText,
        bindings.previewText.value,
    );
    assert.equal(drafts.get('Talk:Example game')?.shouldRegister, false);
    bindings.onSummaryInput('Flushed on dismissal');
    bindings.onOpenChange(false);
    for (let index = 0; index < 10; index += 1) await Promise.resolve();
    assert.equal(drafts.size, 1);
    assert.equal(
        drafts.get('Talk:Example game')?.summary,
        'Flushed on dismissal',
    );
    assert.equal(bindings.open.value, false);
});

test('Don’t stage discards only the current draft and cancels its pending synchronization', async (context) => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const state = createDialogState();
    const staging = createStaging({});
    const review = createPreparedBatch(state).entries[0]!.review;
    await staging.stage(state, review);
    await staging.stage(
        { ...state, talkTitle: 'Talk:Other game' },
        { ...review, summary: 'Other queued review' },
    );
    let wikiWrites = 0;
    const bindings = createAssessmentDialogBindings(vue, {
        onClose() {},
        state,
        runtime: {
            ...createRuntime(async () => {
                wikiWrites += 1;
                return 'saved';
            }),
            staging,
        },
    });
    bindings.onSummaryInput('Pending summary to discard');
    await bindings.onCancel();
    context.mock.timers.tick(500);
    for (let index = 0; index < 10; index += 1) await Promise.resolve();
    assert.equal(bindings.open.value, false);
    assert.equal(staging.getReview(state.talkTitle), null);
    assert.equal(staging.count(), 1);
    assert.equal(
        staging.getReview('Talk:Other game')?.summary,
        'Other queued review',
    );
    assert.equal(wikiWrites, 0);
});

test('Don’t stage waits for an in-flight draft write before removing it', async () => {
    const state = createDialogState();
    const mounted: Array<() => void> = [];
    const delayed = Promise.withResolvers<void>();
    const started = Promise.withResolvers<void>();
    const drafts = new Map<string, DialogSaveReview>();
    const operations: string[] = [];
    const bindings = createDefaultAssessmentDialogBindings(
        { ...vue, onMounted: (callback) => mounted.push(callback) },
        {
            onClose() {},
            state,
            runtime: {
                ...createRuntime(),
                staging: createStaging({
                    count: () => drafts.size,
                    getReview: (title) => drafts.get(title) ?? null,
                    async stage(state, review) {
                        started.resolve();
                        await delayed.promise;
                        operations.push('stage');
                        drafts.set(state.talkTitle, structuredClone(review));
                    },
                    async unstage(title) {
                        operations.push('unstage');
                        drafts.delete(title);
                    },
                }),
            },
        },
    );
    for (const callback of mounted) callback();
    await started.promise;
    const discarding = bindings.onCancel();
    assert.equal(bindings.open.value, true);
    assert.deepEqual(operations, []);
    delayed.resolve();
    await discarding;
    assert.deepEqual(operations, ['stage', 'unstage']);
    assert.equal(drafts.size, 0);
    assert.equal(bindings.open.value, false);
});

test('a failed Don’t stage removal retains the reviewed form and allows a retry', async () => {
    const state = createDialogState();
    const review = createPreparedBatch(state).entries[0]!.review;
    const drafts = new Map([[state.talkTitle, review]]);
    let removals = 0;
    const bindings = createAssessmentDialogBindings(vue, {
        onClose() {},
        state,
        runtime: {
            ...createRuntime(),
            staging: createStaging({
                count: () => drafts.size,
                getReview: (title) => drafts.get(title) ?? null,
                async unstage(title) {
                    removals += 1;
                    if (removals === 1)
                        throw new Error('Queue removal unavailable');
                    drafts.delete(title);
                },
            }),
        },
    });
    bindings.onSummaryInput('Retained after removal failure');
    const source = bindings.previewText.value;
    await bindings.onCancel();
    assert.equal(bindings.open.value, true);
    assert.equal(bindings.summary.value, 'Retained after removal failure');
    assert.equal(bindings.previewText.value, source);
    assert.equal(drafts.size, 1);
    assert.match(bindings.status.value, /Queue removal unavailable/u);
    await bindings.onCancel();
    assert.equal(removals, 2);
    assert.equal(drafts.size, 0);
    assert.equal(bindings.open.value, false);
});

test('a staged synchronization failure retains the open reviewed form', async () => {
    const review = {
        previewText: originalSource,
        summary: 'Old',
        listSummary: 'List',
        shouldRegister: false,
    };
    const bindings = createAssessmentDialogBindings(vue, {
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
    await bindings.onDismiss();
    assert.equal(bindings.open.value, true);
    assert.equal(bindings.summary.value, 'Retained summary');
    assert.match(bindings.status.value, /Storage unavailable/u);
});

test('Next prepares a selected-page review before any batch write', async () => {
    const state = createDialogState();
    const batch = createPreparedBatch(state);
    let saves = 0;
    const bindings = createAssessmentDialogBindings(vue, {
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
                    assert.equal(
                        saved.registrationSummary,
                        'Combined list summary',
                    );
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

test('removing a reviewed row rebuilds selected registration before saving', async () => {
    const state = createDialogState();
    const batch = createPreparedBatch(state);
    let removed = '';
    const bindings = createAssessmentDialogBindings(vue, {
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
    assert.equal(bindings.batchSelectedCount.value, 1);
});

test('applying a queued edit refreshes the importance restored by the current Video games checkbox', async () => {
    const state = createDialogState();
    const batch = createPreparedBatch(state);
    let wikiWrites = 0;
    const bindings = createAssessmentDialogBindings(vue, {
        onClose() {},
        state,
        runtime: {
            ...createRuntime(async () => {
                wikiWrites += 1;
                return 'saved';
            }),
            staging: createStaging({
                async prepare() {
                    return batch;
                },
                async updateInBatch(previous, title, nextState, review) {
                    return {
                        ...previous,
                        entries: previous.entries.map((entry) =>
                            entry.state.talkTitle === title
                                ? {
                                      state: nextState,
                                      review: structuredClone(review),
                                  }
                                : entry,
                        ),
                    };
                },
                async prepareSelection(_api, entries, draftSnapshot) {
                    return { ...batch, entries, draftSnapshot };
                },
            }),
        },
    });
    bindings.setImportance('High');
    await bindings.onSave();
    bindings.onBatchEdit(state.talkTitle);
    const editor = (
        bindings.batchEditor.value as {
            setup(): ReturnType<typeof createDefaultAssessmentDialogBindings>;
        }
    ).setup();
    editor.setImportance('Critical');
    editor.onSummaryInput('Reviewed current-page queue edit');
    await editor.onSave();
    assert.equal(bindings.batchEditor.value, null);
    bindings.onBatchCancel();
    assert.equal(bindings.assessment.importance, 'Critical');
    assert.equal(bindings.summary.value, 'Reviewed current-page queue edit');
    bindings.setVideoGamesSelected(false);
    bindings.setVideoGamesSelected(true);
    assert.equal(bindings.assessment.importance, 'Critical');
    assert.match(bindings.previewText.value, /importance=Critical/u);
    assert.equal(bindings.shouldRegister.value, false);
    assert.equal(wikiWrites, 0);
    await bindings.onCancel();
});

test('an external queue change invalidates the pending review while retaining form edits', async () => {
    const state = createDialogState();
    const delayed = Promise.withResolvers<PreparedAssessmentBatch>();
    const preparationStarted = Promise.withResolvers<void>();
    let saves = 0;
    const observable = createObservableStaging({
        count: () => 1,
        prepare: () => {
            preparationStarted.resolve();
            return delayed.promise;
        },
        async save() {
            saves += 1;
            return 'saved';
        },
    });
    const bindings = createAssessmentDialogBindings(vue, {
        onClose() {},
        state,
        runtime: { ...createRuntime(), staging: observable.staging },
    });
    bindings.onSummaryInput('Keep editable summary');
    const preparing = bindings.onSave();
    await preparationStarted.promise;
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

test('Next restores an externally removed current draft before preparing the batch', async () => {
    const state = createDialogState();
    const review = createPreparedBatch(state).entries[0]!.review;
    const drafts = new Map([[state.talkTitle, review]]);
    let preparations = 0;
    let wikiWrites = 0;
    const observable = createObservableStaging({
        count: () => drafts.size,
        getReview: (title) => drafts.get(title) ?? null,
        async stage(state, review) {
            drafts.set(state.talkTitle, structuredClone(review));
        },
        async prepare(_state, review) {
            preparations += 1;
            assert.deepEqual(drafts.get(state.talkTitle), review);
            return createPreparedBatch(state);
        },
    });
    const bindings = createAssessmentDialogBindings(vue, {
        onClose() {},
        state,
        runtime: {
            ...createRuntime(async () => {
                wikiWrites += 1;
                return 'saved';
            }),
            staging: observable.staging,
        },
    });
    bindings.onSummaryInput('Latest local review');
    drafts.delete(state.talkTitle);
    observable.notify();
    assert.equal(bindings.summary.value, 'Latest local review');
    assert.equal(bindings.currentStaged.value, false);
    await bindings.onSave();
    assert.equal(preparations, 1);
    assert.equal(drafts.get(state.talkTitle)?.summary, 'Latest local review');
    assert.equal(bindings.batchConfirmOpen.value, true);
    assert.equal(wikiWrites, 0);
    await bindings.onDismiss();
});

test('compact mode retains the draft and an existing launcher restores its current view', async () => {
    let restore: (() => void) | null = null;
    const bindings = createAssessmentDialogBindings(vue, {
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
    await bindings.onDismiss();
    bindings.onOpenChange(false);
    bindings.onBatchCancel();
    bindings.onBatchOpenChange(false);
    const source = bindings.previewText.value;
    const videoGamesSelected = bindings.videoGamesSelected.value;
    bindings.onPreviewInput('Unreviewed late edit');
    bindings.setVideoGamesSelected(false);
    assert.equal(bindings.previewText.value, source);
    assert.equal(bindings.videoGamesSelected.value, videoGamesSelected);
    assert.equal(bindings.batchConfirmOpen.value, true);
    assert.equal(bindings.open.value, true);
    assert.equal(saves, 1);
    delayed.resolve();
    await saving;
});

/** Existing review scenarios explicitly expand the ordinary compact entry view. */
function createAssessmentDialogBindings(
    Vue: VueModule,
    options: AssessmentDialogOptions,
) {
    const bindings = createDefaultAssessmentDialogBindings(Vue, options);
    bindings.onExpand();
    return bindings;
}

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
    const drafts = new Map<string, DialogSaveReview>();
    return {
        count: () => drafts.size,
        getReview: (title) => drafts.get(title) ?? null,
        subscribe: () => () => {},
        async stage(state, review) {
            drafts.set(state.talkTitle, structuredClone(review));
        },
        async unstage(title) {
            drafts.delete(title);
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
