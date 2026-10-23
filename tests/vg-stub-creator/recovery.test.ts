/**
 * @file tests/vg-stub-creator/recovery.test.ts
 * Purpose: Verifies stored drafts, write checkpoints, and safe recovery boundaries.
 *
 * Table of contents:
 * 1. Imports
 * 2. createDraft
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import type { PendingSaveDraft } from '../../src/vg-stub-creator/app/contracts/application.ts';
import { preparePendingSaveResume } from '../../src/vg-stub-creator/app/workflows/pre-save-checkpoint.ts';
import { runSelectedActions } from '../../src/vg-stub-creator/app/workflows/pre-save.ts';
import { createFormHistoryStore } from '../../src/vg-stub-creator/platform/browser/storage/form-history.ts';
import {
    getPendingSaveData,
    PENDING_SAVE_STORAGE_KEY,
    setPendingSaveOperationStatus,
    storePendingSaveData,
} from '../../src/vg-stub-creator/platform/browser/storage/session.ts';
import { createMemoryStorage } from './support/storage.ts';

function createDraft(): PendingSaveDraft {
    const presentation = {
        displayLabel: 'Reviewed operation',
        label: 'Reviewed operation',
        pageTitle: 'Star Harbor',
        selected: true,
    };
    return {
        title: 'Star Harbor',
        move: { enabled: true, to: '星海', leaveRedirect: true },
        registration: { enabled: false },
        actions: [
            {
                ...presentation,
                id: 'redirect:Star Harbour',
                type: 'redirect',
                exists: false,
                redirectTitle: 'Star Harbour',
                targetTitle: 'Star Harbor',
            },
            { ...presentation, id: 'talk-banner', type: 'talk-banner' },
            {
                ...presentation,
                id: 'page-edit:Series',
                type: 'page-edit',
                create: false,
                title: 'Template:Series',
                summary: 'Add reviewed game',
                text: 'Reviewed navbox text',
            },
        ],
    };
}

test('checkpoint recovery separates completed, untouched, and uncertain writes', () => {
    const storage = createMemoryStorage();
    const checkpoint = storePendingSaveData(createDraft(), storage);
    assert.equal(checkpoint.version, 1);
    assert.equal(checkpoint.operations.save, 'pending');
    setPendingSaveOperationStatus('save', 'confirmed', storage);
    setPendingSaveOperationStatus('move', 'confirmed', storage);
    setPendingSaveOperationStatus('talk-banner', 'confirmed', storage);
    setPendingSaveOperationStatus('page-edit:Series', 'uncertain', storage);

    const restored = getPendingSaveData('Star_Harbor', storage);
    assert.ok(restored);
    const resume = preparePendingSaveResume(restored);
    assert.equal(resume.title, '星海');
    assert.equal(resume.move.enabled, false);
    assert.deepEqual(
        resume.actions.map((action) => action.id),
        ['redirect:Star Harbour'],
    );
    assert.deepEqual(
        resume.confirmedActions.map((action) => action.id),
        ['talk-banner'],
    );
    assert.deepEqual(resume.blockedOperationIds, ['page-edit:Series']);
    assert.equal(getPendingSaveData('Unrelated title', storage), undefined);
    assert.ok(getPendingSaveData('星海', storage));
    assert.notEqual(storage.getItem(PENDING_SAVE_STORAGE_KEY), null);
});

test('invalid or duplicate checkpoints cannot become resumable writes', () => {
    const storage = createMemoryStorage();
    storage.setItem(PENDING_SAVE_STORAGE_KEY, '{broken JSON');
    assert.equal(getPendingSaveData('Star Harbor', storage), undefined);
    assert.equal(storage.getItem(PENDING_SAVE_STORAGE_KEY), null);
    const draft = createDraft();
    draft.actions.push({ ...draft.actions[0]! });
    assert.throws(() => storePendingSaveData(draft, storage), /unique/iu);
    assert.equal(storage.getItem(PENDING_SAVE_STORAGE_KEY), null);
});

test('a dispatched follow-up that loses its response is attempted once', async () => {
    const storage = createMemoryStorage();
    const action = createDraft().actions[2]!;
    storePendingSaveData(
        { title: 'Star Harbor', move: {}, actions: [action] },
        storage,
    );
    setPendingSaveOperationStatus('save', 'confirmed', storage);
    let attempts = 0;
    const result = await runSelectedActions([action], {
        title: 'Star Harbor',
        api: {
            get: async () => ({}),
            post: async () => ({}),
            postWithToken: async () => ({}),
        },
        move: {},
        writes: {
            addTalkPageBanner: async () => {},
            connectWikidataSitelink: async () => {},
            createRedirect: async () => {},
            movePage: async () => {},
            async savePageEdit() {
                attempts += 1;
                throw new Error('Response lost after dispatch');
            },
        },
        onActionStart(started: { id: string }) {
            setPendingSaveOperationStatus(started.id, 'running', storage);
        },
        onActionFailed(failed: { id: string }) {
            setPendingSaveOperationStatus(failed.id, 'uncertain', storage);
        },
    });
    assert.equal(attempts, 1);
    assert.equal(result.failed.length, 1);
    const pending = getPendingSaveData('Star Harbor', storage);
    assert.ok(pending);
    const resume = preparePendingSaveResume(pending);
    assert.deepEqual(resume.actions, []);
    assert.deepEqual(resume.blockedOperationIds, [action.id]);
});

test('draft restoration is page-specific and stored values are independent', () => {
    const storage = createMemoryStorage();
    const history = createFormHistoryStore(() => storage, {
        temporaryDraft: 'Temporary draft',
        untitled: 'Untitled',
    });
    const form = { name: '星海', developers: 'Nintendo' };
    history.saveFormDraft(form, 'Star Harbor');
    form.name = 'Changed after saving';
    assert.equal(history.readFormDraftForPage('Star Harbor')?.name, '星海');
    assert.equal(history.readFormDraftForPage('Another game'), undefined);
    history.saveFormHistory({ name: '星海' }, 'Star Harbor');
    assert.equal(history.readFormHistory().length, 1);
    history.clearFormHistory();
    assert.deepEqual(history.readFormHistory(), []);
});

test('legacy retrying progress remains in flight and cannot make an uncertain checkpoint resumable', async () => {
    const { readSaveProgress, SAVE_PROGRESS_STORAGE_KEY } =
        await import('../../src/vg-stub-creator/platform/browser/storage/save-progress.ts');
    const storage = createMemoryStorage();
    storePendingSaveData(createDraft(), storage);
    setPendingSaveOperationStatus('save', 'confirmed', storage);
    setPendingSaveOperationStatus('talk-banner', 'running', storage);
    storage.setItem(
        SAVE_PROGRESS_STORAGE_KEY,
        JSON.stringify({
            title: 'Star Harbor',
            error: '',
            steps: [
                {
                    id: 'talk-banner',
                    status: 'retrying',
                    label: 'Reviewed banner',
                },
            ],
        }),
    );
    const progress = readSaveProgress(storage);
    assert.equal(progress.steps[0].status, 'running');
    assert.equal(progress.steps[0].label, 'Reviewed banner');
    const pending = getPendingSaveData('Star Harbor', storage)!;
    assert.equal(pending.operations['talk-banner'], 'running');
    const resume = preparePendingSaveResume(pending);
    assert.ok(resume.blockedOperationIds.includes('talk-banner'));
    assert.ok(resume.actions.every((action) => action.id !== 'talk-banner'));
});
