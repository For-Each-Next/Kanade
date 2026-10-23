/**
 * @file tests/vg-stub-creator/redirect-review.test.ts
 * Purpose: Preserve related-page review choices and reject stale status checks.
 *
 * Table of contents:
 * 1. Imports
 * 2. createReviewFixture
 * 3. deferred
 * 4. namePasteEvent
 * 5. Test scenarios
 * 6. commitNameRoleAndWait
 */

import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { computed, reactive, ref } from 'vue';

import {
    buildRedirectRows,
    buildRedirectRowsFromTitles,
} from '../../src/vg-stub-creator/domain/pre-save-actions.ts';
import type { CreatorDialogOptions } from '../../src/vg-stub-creator/features/creator/form/dialog-options.ts';
import { createDialogComponent } from '../../src/vg-stub-creator/features/creator/form/component.ts';
import {
    getHistoryEntryForm,
    replaceFormValues,
    createFormValues,
} from '../../src/vg-stub-creator/features/creator/form/form-model.ts';
import { createFormHistoryStore } from '../../src/vg-stub-creator/platform/browser/storage/form-history.ts';
import { resolveReviewedNavboxRows } from '../../src/vg-stub-creator/platform/mediawiki/navboxes.ts';
import { createMemoryStorage } from './support/storage.ts';

/** Creates the real dialog behavior with offline adapters and inert watchers. */
function createReviewFixture(
    context: TestContext,
    initialForm: Record<string, unknown>,
    onCheckRedirectRows: (
        rows: Array<{ title: string }>,
        title: string,
    ) => Promise<unknown[]>,
    onPrepareRedirectRows?: () => Promise<unknown[]>,
    extraOptions: Record<string, unknown> = {},
) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {},
    });
    context.after(() => {
        if (descriptor == null) {
            Reflect.deleteProperty(globalThis, 'window');
        } else {
            Object.defineProperty(globalThis, 'window', descriptor);
        }
    });
    let dispose = () => {};
    const component = createDialogComponent(
        {
            computed,
            reactive,
            ref,
            watch() {},
            onBeforeUnmount(callback: () => void) {
                dispose = callback;
            },
        },
        {
            currentTitle: 'Star Harbor',
            defaultName: 'Star Harbor',
            initialForm,
            createReviewLinkSession: () => ({}),
            getHistoryEntries: () => [],
            getFieldPlaceholder: () => '',
            onCheckRedirectRows,
            onPrepareRedirectRows,
            ...extraOptions,
        } as unknown as CreatorDialogOptions,
    );
    const state = component.setup();
    return {
        state,
        methods: component.methods as Record<string, (...args: any[]) => any>,
        dispose: () => dispose(),
    };
}

/** Creates an explicitly controlled asynchronous adapter result. */
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((complete) => {
        resolve = complete;
    });
    return { promise, resolve };
}

/** Supplies clipboard text and an explicit selection without a browser. */
function namePasteEvent(
    value: string,
    start: number,
    end: number,
    text: string,
) {
    let prevented = false;
    return {
        event: {
            target: { value, selectionStart: start, selectionEnd: end },
            clipboardData: { getData: () => text },
            preventDefault() {
                prevented = true;
            },
        } as unknown as ClipboardEvent,
        prevented: () => prevented,
    };
}

test('title paste replaces the selection and commits fresh evidence while settled blur checks reuse it', async (context) => {
    const reads: string[] = [];
    const response = deferred<{ title: string; exists: boolean }>();
    const fixture = createReviewFixture(
        context,
        { englishName: 'Original' },
        async () => [],
        undefined,
        {
            onCheckPageTitle(title: string) {
                reads.push(title);
                return response.promise;
            },
        },
    );
    const card = fixture.methods
        .getNameCards()
        .find((source: { id: string }) => source.id === 'english');
    const paste = namePasteEvent('Old game suffix', 0, 8, 'New: name');
    fixture.methods.pasteNameRole(card, 'pageName', paste.event);
    assert.equal(paste.prevented(), true);
    assert.equal(
        fixture.methods.getNameRole(card, 'pageName').value,
        'New: name suffix',
    );
    assert.deepEqual(reads, ['New: name suffix']);
    fixture.methods.commitNameRole(card, 'pageName');
    assert.equal(reads.length, 1);
    response.resolve({ title: 'New: name suffix', exists: false });
    await response.promise;
    await Promise.resolve();
    await Promise.resolve();
    fixture.methods.commitNameRole(card, 'pageName');
    assert.equal(reads.length, 1);
    fixture.methods.commitNameRole(card, 'pageName', true);
    assert.equal(reads.length, 2);
});

test('independent numbered aliases preserve blank drafts and deletion affects only their own contribution', async (context) => {
    const fixture = createReviewFixture(
        context,
        {
            originalName: 'en:Shared alias',
            englishName: 'Shared alias',
            redirectRows: [
                {
                    title: 'Shared alias',
                    generatedTitle: 'Shared alias',
                    enabled: true,
                },
            ],
        },
        async (rows, title) =>
            buildRedirectRowsFromTitles(
                rows.map((row) => row.title),
                title,
            ),
        undefined,
        {
            onPrepareRedirectRows: async (form: unknown, title: string) =>
                buildRedirectRows(form, title),
        },
    );
    const original = fixture.methods
        .getNameCards()
        .find((source: { id: string }) => source.id === 'original');
    const english = fixture.methods
        .getNameCards()
        .find((source: { id: string }) => source.id === 'english');
    fixture.methods.addNameCardRedirect(english);
    fixture.methods.addNameCardRedirect(english);
    const aliases = fixture.methods.getNameCardExtraRedirectRows(english);
    assert.equal(aliases.length, 2);
    assert.match(fixture.methods.getNameCardRedirectLabel(english, 0), /2$/u);
    assert.match(fixture.methods.getNameCardRedirectLabel(english, 1), /3$/u);
    const index = fixture.state.form.redirectRows.indexOf(aliases[0]);
    fixture.methods.updateRedirectRowTitle(index, 'Multi ');
    assert.equal(aliases[0].title, 'Multi ');
    fixture.methods.updateRedirectRowTitle(index, '');
    await fixture.methods.checkRedirectRows();
    await fixture.methods.refreshRedirectRows();
    assert.deepEqual(
        fixture.methods.getNameCardExtraRedirectRows(english),
        aliases,
    );
    fixture.methods.removeNameRoleRedirect(original);
    assert.equal(fixture.methods.isNameRoleRedirectVisible(original), false);
    assert.equal(fixture.methods.isNameRoleRedirectVisible(english), true);
    assert.equal(
        fixture.methods.getNameRoleRedirectReviewRow(english).title,
        'Shared alias',
    );
    const paste = namePasteEvent('', 0, 0, 'Shared alias');
    fixture.methods.pasteNameCardRedirect(aliases[0], paste.event);
    assert.equal(paste.prevented(), true);
    assert.equal(aliases[0].title, 'Shared alias');
    fixture.methods.removeNameCardRedirect(aliases[0]);
    assert.equal(
        fixture.methods.getNameRole(english, 'redirect').enabled,
        true,
    );
    assert.equal(
        fixture.methods.getNameRoleRedirectReviewRow(english).title,
        'Shared alias',
    );
    assert.equal(
        fixture.methods.getNameCardExtraRedirectRows(english).length,
        1,
    );
    fixture.methods.removeNameRoleRedirect(english);
    assert.equal(fixture.methods.isNameRoleRedirectVisible(english), false);
    assert.match(fixture.methods.getNameCardRedirectLabel(english, 0), /1$/u);
    await fixture.methods.refreshRedirectRows();
    assert.equal(fixture.methods.isNameRoleRedirectVisible(english), false);
    assert.equal(
        fixture.methods.getNameCardExtraRedirectRows(english).length,
        1,
    );
});

test('alias checks preserve reviewed selection and staged source while ignoring deleted rows', async (context) => {
    const response = deferred<unknown[]>();
    const staged = {
        create: true,
        title: 'Independent',
        text: '#REDIRECT [[Star Harbor]]\n<!-- reviewed -->',
    };
    const fixture = createReviewFixture(
        context,
        {
            englishName: 'English',
            redirectRows: [
                {
                    title: 'Independent',
                    nameSourceId: 'english',
                    manualAdded: true,
                    enabled: false,
                    pendingEdit: staged,
                },
                { title: '', nameSourceId: 'english', manualAdded: true },
            ],
        },
        () => response.promise,
    );
    const card = fixture.methods
        .getNameCards()
        .find((source: { id: string }) => source.id === 'english');
    const [row, blank] = fixture.methods.getNameCardExtraRedirectRows(card);
    const checking = fixture.methods.commitNameCardRedirect(row, true);
    response.resolve([
        { title: 'Independent', exists: true, status: 'Exists' },
    ]);
    await checking;
    assert.equal(row.enabled, false);
    assert.deepEqual(row.pendingEdit, staged);
    assert.equal(fixture.methods.getNameCardExtraRedirectRows(card)[1], blank);
    const newer = deferred<unknown[]>();
    const second = createReviewFixture(
        context,
        {
            englishName: 'English',
            redirectRows: [
                {
                    title: 'Remove me',
                    nameSourceId: 'english',
                    manualAdded: true,
                },
            ],
        },
        () => newer.promise,
    );
    const removed = second.state.form.redirectRows[0];
    const pending = second.methods.commitNameCardRedirect(removed, true);
    second.methods.removeNameCardRedirect(removed);
    newer.resolve([{ title: 'Remove me', exists: true }]);
    await pending;
    assert.equal(
        second.state.form.redirectRows.some(
            (candidate: { title: string }) => candidate.title === 'Remove me',
        ),
        false,
    );
});

test('named history retains independent aliases and staged text while invalidating saved existence', () => {
    const storage = createMemoryStorage();
    const history = createFormHistoryStore(() => storage, {
        temporaryDraft: 'Temporary',
        untitled: 'Untitled',
    });
    const form = createFormValues();
    form.englishName = 'English';
    const staged = {
        create: false,
        title: 'Checked alias',
        text: 'Reviewed source',
        summary: 'Reviewed summary',
    };
    form.redirectRows = [
        {
            title: 'Checked alias',
            nameSourceId: 'english',
            manualAdded: true,
            enabled: false,
            fixed: true,
            fixedTitle: 'Checked alias',
            exists: true,
            status: 'Exists',
            pendingEdit: staged,
        },
        {
            title: '',
            nameSourceId: 'english',
            manualAdded: true,
            enabled: true,
        },
    ];
    history.saveFormHistory(form, 'Star Harbor');
    const restored = createFormValues();
    replaceFormValues(
        restored,
        getHistoryEntryForm(history.readFormHistory()[0]),
    );
    assert.equal(restored.redirectRows.length, 2);
    assert.equal(restored.redirectRows[0].enabled, false);
    assert.equal(restored.redirectRows[0].nameSourceId, 'english');
    assert.equal(restored.redirectRows[0].fixed, false);
    assert.equal(restored.redirectRows[0].exists, false);
    assert.equal(restored.redirectRows[0].status, 'Pending edit');
    assert.deepEqual(restored.redirectRows[0].pendingEdit, staged);
    assert.equal(restored.redirectRows[1].manualAdded, true);
    assert.equal(restored.redirectRows[1].fixed, false);
    assert.equal(restored.redirectRows[1].status, 'Unchecked');
    assert.equal(form.redirectRows[0].exists, true);
});

test('compact aliases report unknown failures without singleton conflict hints', async (context) => {
    const fixture = createReviewFixture(
        context,
        {
            originalName: 'en:Original alias',
            englishName: 'English alias',
            redirectRows: [
                {
                    title: 'English alias',
                    generatedTitle: 'English alias',
                    enabled: false,
                    exists: true,
                    fixed: true,
                    fixedTitle: 'English alias',
                    status: 'Exists',
                },
            ],
        },
        async () => [],
    );
    const original = fixture.methods
        .getNameCards()
        .find((source: { id: string }) => source.id === 'original');
    const english = fixture.methods
        .getNameCards()
        .find((source: { id: string }) => source.id === 'english');
    assert.deepEqual(
        fixture.methods.getNameRoleOtherUses(original, 'redirect'),
        [],
    );
    const row = fixture.methods.getNameRoleRedirectReviewRow(english);
    fixture.methods.updateNameCardRedirectEnabled(row, true);
    assert.deepEqual(
        fixture.methods.getNameRoleOtherUses(original, 'redirect'),
        [],
    );
    assert.equal(fixture.methods.getNameCardRedirectPageExistence(row), true);
    row.status = 'CheckFailed: API unavailable';
    assert.equal(fixture.methods.getNameCardRedirectPageExistence(row), null);
    row.status = 'Missing';
    row.exists = false;
    assert.equal(fixture.methods.getNameCardRedirectPageExistence(row), false);
    row.title = 'Unconfirmed change';
    assert.equal(fixture.methods.getNameCardRedirectPageExistence(row), null);
});

test('singleton conflict hints identify the source checkbox that selecting another use replaces', async (context) => {
    const fixture = createReviewFixture(
        context,
        {
            originalName: 'en:Original name',
            englishName: 'English name',
            pageName: 'Second title',
            name: 'Original display',
            sortKey: 'English Sort',
            localizedNames: [
                { nameId: 'first', name: 'First name' },
                { nameId: 'second', name: 'Second name' },
            ],
            nameRoleRows: [
                {
                    sourceId: 'second',
                    role: 'pageName',
                    value: 'Second title',
                    enabled: true,
                    modified: true,
                },
                {
                    sourceId: 'original',
                    role: 'displayTitle',
                    value: 'Original display',
                    enabled: true,
                    modified: true,
                },
                {
                    sourceId: 'english',
                    role: 'sortKey',
                    value: 'English Sort',
                    enabled: true,
                    modified: true,
                },
            ],
        },
        async () => [],
    );
    const first = fixture.methods
        .getNameCards()
        .find((source: { id: string }) => source.id === 'first');
    const expected = [
        {
            role: 'pageName',
            sourceId: 'second',
            source: 'Name #2',
            roleLabel: 'Page title',
            value: 'Second title',
        },
        {
            role: 'displayTitle',
            sourceId: 'original',
            source: 'Original',
            roleLabel: 'Main name',
            value: 'Original display',
        },
        {
            role: 'sortKey',
            sourceId: 'english',
            source: 'English name',
            roleLabel: 'Sort key',
            value: 'English Sort',
        },
    ];
    const snapshot = JSON.stringify(fixture.state.form);
    for (const { role, sourceId, source, roleLabel, value } of expected) {
        assert.deepEqual(fixture.methods.getNameRoleOtherUses(first, role), [
            {
                sourceId,
                value,
                label: `${source} already uses ${roleLabel} “${value}”`,
                hint: `Selecting this use will deselect ${roleLabel} for ${source}.`,
            },
        ]);
    }
    assert.equal(JSON.stringify(fixture.state.form), snapshot);
    assert.deepEqual(
        fixture.methods.getNameRoleOtherUses(first, 'redirect'),
        [],
    );
    assert.deepEqual(fixture.methods.getNameRoleOtherUses(first, 'noteTa'), []);
    for (const { role, sourceId } of expected) {
        fixture.methods.updateNameRoleEnabled(first, role, true);
        const previous = fixture.methods
            .getNameCards()
            .find((source: { id: string }) => source.id === sourceId);
        assert.equal(
            fixture.methods.getNameRole(previous, role).enabled,
            false,
        );
        assert.deepEqual(fixture.methods.getNameRoleOtherUses(first, role), []);
    }
});

test('renamed reviewed aliases stay visible while unchanged joined-role suggestions are represented once', async (context) => {
    const staged = {
        create: true,
        title: 'Renamed alias',
        text: 'Reviewed renamed source',
    };
    const fixture = createReviewFixture(
        context,
        {
            englishName: 'Primary alias',
            nameRoleRows: [
                {
                    sourceId: 'english',
                    role: 'redirect',
                    value: 'Primary alias; Secondary alias',
                    enabled: true,
                    modified: true,
                },
            ],
            redirectRows: [
                {
                    title: 'Renamed alias',
                    generatedTitle: 'Primary alias',
                    pendingEdit: staged,
                },
                { title: 'Secondary alias', generatedTitle: 'Secondary alias' },
                {
                    title: 'Manual alias',
                    nameSourceId: 'english',
                    manualAdded: true,
                },
            ],
        },
        async () => [],
    );
    const card = fixture.methods
        .getNameCards()
        .find((source: { id: string }) => source.id === 'english');
    assert.equal(fixture.methods.getNameRoleRedirectReviewRow(card), undefined);
    const extras = fixture.methods.getNameCardExtraRedirectRows(card);
    assert.deepEqual(
        extras.map((row: { title: string }) => row.title),
        ['Renamed alias', 'Manual alias'],
    );
    assert.deepEqual(extras[0].pendingEdit, staged);
    fixture.methods.removeNameRoleRedirect(card);
    assert.deepEqual(
        fixture.methods
            .getNameCardExtraRedirectRows(card)
            .map((row: { title: string }) => row.title),
        ['Renamed alias', 'Manual alias'],
    );
    assert.equal(
        fixture.state.form.redirectRows.some(
            (row: { title: string }) => row.title === 'Secondary alias',
        ),
        false,
    );
});

test('primary redirect checkbox updates the role and staged save selection together', async (context) => {
    const staged = { create: true, title: 'Alias', text: 'Reviewed content' };
    const fixture = createReviewFixture(
        context,
        {
            englishName: 'Alias',
            redirectRows: [
                {
                    title: 'Alias',
                    generatedTitle: 'Alias',
                    enabled: true,
                    pendingEdit: staged,
                },
            ],
        },
        async (rows, title) =>
            buildRedirectRowsFromTitles(
                rows.map((row) => row.title),
                title,
            ),
    );
    const card = fixture.methods
        .getNameCards()
        .find((source: { id: string }) => source.id === 'english');
    const row = fixture.methods.getNameRoleRedirectReviewRow(card);
    fixture.methods.updateNamePrimaryRedirectEnabled(card, false);
    assert.equal(row.enabled, false);
    assert.equal(fixture.methods.getNameRole(card, 'redirect').enabled, false);
    await fixture.methods.checkRedirectRows();
    assert.equal(row.enabled, false);
    assert.deepEqual(row.pendingEdit, staged);
    fixture.methods.updateNamePrimaryRedirectEnabled(card, true);
    assert.equal(row.enabled, true);
    assert.equal(fixture.methods.getNameRole(card, 'redirect').enabled, true);
    assert.deepEqual(row.pendingEdit, staged);
});

test('deduplicated title responses preserve every independent alias and unmatched staged drafts', async (context) => {
    const staged = {
        create: false,
        title: 'Shared alias',
        text: 'Reviewed duplicate source',
    };
    const unmatched = {
        create: true,
        title: 'Unreturned alias',
        text: 'Reviewed unmatched source',
    };
    const fixture = createReviewFixture(
        context,
        {
            englishName: 'English',
            redirectRows: [
                {
                    title: 'Shared alias',
                    generatedTitle: 'Shared alias',
                    enabled: true,
                },
                {
                    title: 'Shared alias',
                    nameSourceId: 'english',
                    manualAdded: true,
                    enabled: false,
                    pendingEdit: staged,
                },
                {
                    title: 'Unreturned alias',
                    nameSourceId: 'english',
                    enabled: false,
                    pendingEdit: unmatched,
                },
                {
                    title: 'Unreturned manual alias',
                    nameSourceId: 'english',
                    manualAdded: true,
                },
                { title: '', nameSourceId: 'english', manualAdded: true },
            ],
        },
        async () => [{ title: 'Shared alias', exists: true, status: 'Exists' }],
    );
    const originals = [...fixture.state.form.redirectRows];
    await fixture.methods.checkRedirectRows();
    assert.deepEqual(fixture.state.form.redirectRows.slice(0, 5), originals);
    assert.notEqual(
        fixture.state.form.redirectRows[0],
        fixture.state.form.redirectRows[1],
    );
    assert.equal(originals[0].enabled, true);
    assert.equal(originals[1].enabled, false);
    assert.equal(originals[0].exists, true);
    assert.equal(originals[1].exists, true);
    assert.deepEqual(originals[1].pendingEdit, staged);
    assert.deepEqual(originals[2].pendingEdit, unmatched);
});

test('unknown fixed failures retry on blur and settled known results reuse their checks', async (context) => {
    let reads = 0;
    const fixture = createReviewFixture(
        context,
        {
            englishName: 'English',
            redirectRows: [
                {
                    title: 'Unknown alias',
                    nameSourceId: 'english',
                    manualAdded: true,
                    fixed: true,
                    fixedTitle: 'Unknown alias',
                    status: 'CheckFailed: API unavailable',
                },
            ],
        },
        async (rows) => {
            reads += 1;
            return rows.map((row) => ({
                title: row.title,
                exists: false,
                status: 'Missing',
            }));
        },
    );
    const row = fixture.state.form.redirectRows[0];
    assert.equal(fixture.methods.getNameCardRedirectPageExistence(row), null);
    await fixture.methods.commitNameCardRedirect(row);
    assert.equal(reads, 1);
    assert.equal(fixture.methods.getNameCardRedirectPageExistence(row), false);
    await fixture.methods.commitNameCardRedirect(row);
    assert.equal(reads, 1);
});

test('name uses keep disambiguation and romanized sort keys separate from source titles', async (context) => {
    const fixture = createReviewFixture(
        context,
        {
            originalName: 'ja:写真冒険',
            englishName: 'Photo Adventure',
            localizedNames: [{ name: '摄影冒险', hans: true }],
        },
        async () => [],
    );
    const original = fixture.methods
        .getNameCards()
        .find((card: { id: string }) => card.id === 'original');
    const english = fixture.methods
        .getNameCards()
        .find((card: { id: string }) => card.id === 'english');
    fixture.methods.updateNameRoleValue(
        original,
        'pageName',
        '写真冒険 (游戏)',
    );
    fixture.methods.updateNameRoleEnabled(original, 'pageName', true);
    fixture.methods.updateNameRoleValue(original, 'sortKey', 'Shashin Bouken');
    fixture.methods.updateNameRoleEnabled(original, 'sortKey', true);
    assert.equal(fixture.state.form.originalName, 'ja:写真冒険');
    assert.equal(fixture.state.form.pageName, '写真冒険 (游戏)');
    assert.equal(fixture.state.form.sortKey, 'Shashin Bouken');
    fixture.methods.updateNameRoleEnabled(english, 'pageName', true);
    assert.equal(fixture.state.form.pageName, 'Photo Adventure');
    assert.equal(
        fixture.methods.getNameRole(original, 'pageName').enabled,
        false,
    );
    fixture.methods.updateNameRoleValue(english, 'pageName', '');
    fixture.methods.commitNameRole(english, 'pageName');
    assert.equal(fixture.methods.getNameRole(english, 'pageName').value, '');
    assert.equal(fixture.state.form.pageName, 'Photo Adventure');
    fixture.methods.updateFieldValue({ key: 'pageName' }, 'Manual output');
    assert.equal(
        fixture.methods.getNameRole(english, 'pageName').enabled,
        false,
    );
});

test('committing an explicitly entered source-matching override keeps it independent from later source changes', async (context) => {
    const fixture = createReviewFixture(
        context,
        { englishName: 'Alias' },
        async () => [],
    );
    const card = fixture.methods
        .getNameCards()
        .find((source: { id: string }) => source.id === 'english');
    fixture.methods.updateNameRoleValue(card, 'pageName', 'Alias');
    fixture.methods.updateNameRoleEnabled(card, 'pageName', true);
    fixture.methods.commitNameRole(card, 'pageName');
    assert.equal(fixture.methods.getNameRole(card, 'pageName').modified, true);
    assert.equal(fixture.methods.getNameRole(card, 'pageName').value, 'Alias');
    fixture.methods.updateNameCardValue(card, 'name', 'Renamed alias');
    assert.equal(fixture.state.form.englishName, 'Renamed alias');
    assert.equal(fixture.state.form.pageName, 'Alias');
    assert.equal(fixture.methods.getNameRole(card, 'pageName').value, 'Alias');
});

test('a shared redirect remains selected while another name contributes it and staged edits stay independent', async (context) => {
    const staged = {
        create: true,
        text: 'Reviewed redirect text',
        title: 'Staged alias',
    };
    const fixture = createReviewFixture(
        context,
        {
            originalName: 'en:Alias',
            englishName: 'Alias',
            localizedNames: [{ name: 'Staged alias', hans: true }],
            redirectRows: [
                { title: 'Alias', generatedTitle: 'Alias', enabled: true },
                {
                    title: 'Staged alias',
                    generatedTitle: 'Staged alias',
                    enabled: true,
                    pendingEdit: staged,
                },
            ],
        },
        async (rows, title) =>
            buildRedirectRowsFromTitles(
                rows.map((row) => row.title),
                title,
            ),
        undefined,
        {
            onPrepareRedirectRows: async (form: unknown, title: string) =>
                buildRedirectRows(form, title),
        },
    );
    const original = fixture.methods
        .getNameCards()
        .find((source: { id: string }) => source.id === 'original');
    const english = fixture.methods
        .getNameCards()
        .find((source: { id: string }) => source.id === 'english');
    const localized = fixture.methods
        .getNameCards()
        .find(
            (source: { kind: string; name: string }) =>
                source.kind === 'localized' && source.name === 'Staged alias',
        );
    fixture.methods.updateNameRoleEnabled(original, 'redirect', false);
    await fixture.methods.refreshRedirectRows();
    assert.equal(
        fixture.methods.getNameRole(english, 'redirect').enabled,
        true,
    );
    assert.equal(
        fixture.state.form.redirectRows.find(
            (row: { title: string }) => row.title === 'Alias',
        ).enabled,
        true,
    );
    fixture.methods.updateNameRoleEnabled(english, 'redirect', false);
    await fixture.methods.refreshRedirectRows();
    assert.equal(
        fixture.state.form.redirectRows.find(
            (row: { title: string }) => row.title === 'Alias',
        ).enabled,
        false,
    );
    fixture.methods.updateNameRoleEnabled(original, 'redirect', true);
    await fixture.methods.refreshRedirectRows();
    assert.equal(
        fixture.state.form.redirectRows.find(
            (row: { title: string }) => row.title === 'Alias',
        ).enabled,
        true,
    );
    fixture.methods.updateNameRoleEnabled(localized, 'redirect', false);
    await fixture.methods.refreshRedirectRows();
    const reviewed = fixture.state.form.redirectRows.find(
        (row: { title: string }) => row.title === 'Staged alias',
    );
    assert.equal(reviewed.enabled, true);
    assert.deepEqual(reviewed.pendingEdit, staged);
});

test('removing a selected source keeps its title values editable without retargeting the article', async (context) => {
    const fixture = createReviewFixture(
        context,
        { localizedNames: [{ name: '名称', hans: true }] },
        async () => [],
    );
    const card = fixture.methods.getNameCards()[0];
    fixture.methods.updateNameRoleValue(card, 'pageName', '名称（游戏）');
    fixture.methods.updateNameRoleEnabled(card, 'pageName', true);
    fixture.methods.updateNameRoleEnabled(card, 'displayTitle', true);
    fixture.methods.updateNameRoleValue(card, 'sortKey', 'Mingcheng');
    fixture.methods.updateNameRoleEnabled(card, 'sortKey', true);
    fixture.methods.removeNameRow('localizedNames', card.index);
    const retainedRoles = fixture.state.form.nameRoleRows;
    assert.deepEqual(
        retainedRoles.map((row: { role: string }) => row.role),
        ['pageName', 'displayTitle', 'sortKey'],
    );
    retainedRoles.forEach(
        (row: { sourceId: string; enabled: boolean; modified: boolean }) => {
            assert.notEqual(row.sourceId, card.id);
            assert.equal(row.enabled, true);
            assert.equal(row.modified, true);
        },
    );
    assert.equal(fixture.state.form.pageName, '名称（游戏）');
    assert.equal(fixture.state.form.name, '名称');
    assert.equal(fixture.state.form.sortKey, 'Mingcheng');
    const remaining = fixture.methods.getNameCards()[0];
    fixture.methods.updateNameCardValue(remaining, 'name', '其他名称');
    assert.equal(fixture.state.form.pageName, '名称（游戏）');
    assert.equal(fixture.state.form.name, '名称');
    assert.equal(fixture.state.form.sortKey, 'Mingcheng');
});

test('removing and re-enabling a default NoteTA use updates its checkbox and restores the combined rule', async (context) => {
    const fixture = createReviewFixture(
        context,
        {
            localizedNames: [
                { name: '名称', official: true, hans: true, hant: true },
            ],
        },
        async () => [],
    );
    const card = fixture.methods.getNameCards()[0];
    assert.equal(fixture.methods.getNameRole(card, 'noteTa').enabled, true);
    assert.equal(fixture.methods.getNameRole(card, 'noteTa').value, '');
    const index = fixture.state.form.noteTaRows.findIndex(
        (row: { source: string }) => row.source === 'names',
    );
    assert.ok(index >= 0);
    fixture.methods.updateNameRoleEnabled(card, 'noteTa', false);
    assert.equal(fixture.methods.getNameRole(card, 'noteTa').enabled, false);
    assert.equal(
        fixture.state.form.noteTaRows.some(
            (row: { source: string }) => row.source === 'names',
        ),
        false,
    );
    fixture.methods.updateNameRoleEnabled(card, 'noteTa', true);
    assert.equal(fixture.methods.getNameRole(card, 'noteTa').enabled, true);
    assert.equal(fixture.methods.getNameRole(card, 'noteTa').value, '');
    assert.equal(fixture.state.form.noteTaNamesRemoved, false);
    assert.equal(
        fixture.state.form.noteTaRows.find(
            (row: { source: string }) => row.source === 'names',
        )?.value,
        'zh-cn:名称; zh-tw:名称;',
    );
});

test('disabling a legacy CN use preserves enabled TW defaults and reviewed manual full rules', async (context) => {
    const fixture = createReviewFixture(
        context,
        {
            originalName: 'ja: 原題',
            localizedNames: [
                { name: '简体名称', official: true, hans: true },
                { name: '繁體名稱', official: true, tw: true },
            ],
            nameRoleRows: [
                {
                    sourceId: 'original',
                    role: 'noteTa',
                    enabled: true,
                    modified: true,
                    value: 'zh-hk:默认香港;',
                },
            ],
            noteTaRows: [
                { key: 'G1', value: 'Games' },
                {
                    key: '3',
                    source: 'name-role:original',
                    generatedValue: 'zh-hk:默认香港;',
                    value: 'zh-hk:已审核香港;',
                    modified: true,
                },
            ],
        },
        async () => [],
    );
    const [simplified, traditional] = fixture.methods.getNameCards();
    assert.equal(
        fixture.methods.getNameRole(simplified, 'noteTa').enabled,
        true,
    );
    assert.equal(
        fixture.methods.getNameRole(traditional, 'noteTa').enabled,
        true,
    );
    const manualRole = fixture.state.form.nameRoleRows.find(
        (row: { sourceId: string }) => row.sourceId === 'original',
    );
    const manualRule = fixture.state.form.noteTaRows.find(
        (row: { source: string }) => row.source === 'name-role:original',
    );
    fixture.methods.updateNameRoleEnabled(simplified, 'noteTa', false);
    assert.equal(
        fixture.methods.getNameRole(traditional, 'noteTa').enabled,
        true,
    );
    assert.equal(
        fixture.state.form.noteTaRows.find(
            (row: { source: string }) => row.source === 'names',
        ).value,
        'zh-tw:繁體名稱;',
    );
    assert.equal(manualRole.noteTaVariants, undefined);
    assert.equal(manualRole.enabled, true);
    assert.equal(manualRole.value, 'zh-hk:默认香港;');
    assert.ok(fixture.state.form.noteTaRows.includes(manualRule));
    assert.equal(manualRule.value, 'zh-hk:已审核香港;');
    assert.equal(manualRule.modified, true);
    assert.equal(fixture.state.form.localizedNames[0].name, '简体名称');
    assert.equal(fixture.state.form.localizedNames[1].name, '繁體名稱');
    assert.equal(fixture.state.form.originalName, 'ja: 原題');
});

test('name title evidence rejects superseded same-title requests and disposal', async (context) => {
    const first = deferred<{ exists: boolean; title: string }>();
    const second = deferred<{ exists: boolean; title: string }>();
    let calls = 0;
    const fixture = createReviewFixture(
        context,
        { englishName: 'Alias' },
        async () => [],
        undefined,
        {
            onCheckPageTitle: () =>
                ++calls === 1 ? first.promise : second.promise,
        },
    );
    const card = fixture.methods
        .getNameCards()
        .find((source: { id: string }) => source.id === 'english');
    const older = commitNameRoleAndWait(fixture, card, 'pageName');
    const newer = commitNameRoleAndWait(fixture, card, 'pageName');
    first.resolve({ exists: false, title: 'Alias' });
    await older;
    assert.equal(
        fixture.methods.getNameRolePageState(card, 'pageName').loading,
        true,
    );
    assert.equal(
        fixture.methods.getNameRolePageState(card, 'pageName').exists,
        null,
    );
    second.resolve({ exists: true, title: 'Alias' });
    await newer;
    assert.equal(
        fixture.methods.getNameRolePageState(card, 'pageName').exists,
        true,
    );
    fixture.dispose();
    assert.equal(
        fixture.methods.getNameRolePageState(card, 'pageName').exists,
        null,
    );
});

test('move title checks reject superseded same-title requests and changed page selections', async (context) => {
    const first = deferred<{ exists: boolean; title: string }>();
    const second = deferred<{ exists: boolean; title: string }>();
    const third = deferred<{ exists: boolean; title: string }>();
    let calls = 0;
    const fixture = createReviewFixture(
        context,
        {},
        async () => [],
        undefined,
        {
            onCheckPageTitle: () => [first, second, third][calls++].promise,
        },
    );
    fixture.methods.updateMoveTarget('Target');
    const older = fixture.methods.checkMoveTarget();
    const newer = fixture.methods.checkMoveTarget();
    first.resolve({ title: 'Target', exists: true });
    await older;
    assert.equal(fixture.state.moveTargetState.loading, true);
    assert.equal(fixture.state.moveTargetState.checkedTitle, '');
    second.resolve({ title: 'Target', exists: false });
    await newer;
    assert.equal(fixture.state.moveTargetState.exists, false);
    assert.equal(fixture.state.moveTargetState.checkedTitle, 'Target');
    const checking = fixture.methods.checkMoveTarget();
    fixture.methods.updateFieldValue({ key: 'pageName' }, 'New selection');
    third.resolve({ title: 'Target', exists: true });
    await checking;
    assert.equal(fixture.state.moveTargetState.exists, null);
    assert.equal(fixture.state.moveTargetState.checkedTitle, '');
    assert.equal(fixture.state.moveTargetState.loading, false);
});

test('name candidate checks retain unknown failures, recheck settled evidence, and check every redirect', async (context) => {
    let fails = true;
    const reads: string[] = [];
    const fixture = createReviewFixture(
        context,
        { englishName: 'Alias' },
        async () => [],
        undefined,
        {
            onCheckPageTitle: async (title: string) => {
                reads.push(title);
                if (fails) throw new Error('Offline');
                return { title, exists: title === 'Existing alias' };
            },
        },
    );
    const card = fixture.methods
        .getNameCards()
        .find((source: { id: string }) => source.id === 'english');
    // Check the source candidate rather than the adopted current page title.
    fixture.methods.updateNameRoleValue(card, 'pageName', '');
    await commitNameRoleAndWait(fixture, card, 'pageName');
    assert.equal(
        fixture.methods.getNameRolePageState(card, 'pageName').exists,
        null,
    );
    fails = false;
    await commitNameRoleAndWait(fixture, card, 'pageName');
    assert.equal(
        fixture.methods.getNameRolePageState(card, 'pageName').exists,
        false,
    );
    await commitNameRoleAndWait(fixture, card, 'pageName');
    assert.deepEqual(reads, ['Alias', 'Alias', 'Alias']);
    fixture.methods.updateNameRoleValue(
        card,
        'redirect',
        'Existing alias; New alias',
    );
    await commitNameRoleAndWait(fixture, card, 'redirect');
    assert.deepEqual(reads.slice(-2), ['Existing alias', 'New alias']);
    assert.equal(
        fixture.methods.getNameRolePageState(card, 'redirect').exists,
        true,
    );
});

test('name candidate results cannot survive a source rename or removal', async (context) => {
    const response = deferred<{ title: string; exists: boolean }>();
    const fixture = createReviewFixture(
        context,
        { localizedNames: [{ name: '摄影冒险', hans: true }] },
        async () => [],
        undefined,
        {
            onCheckPageTitle: () => response.promise,
        },
    );
    const card = fixture.methods.getNameCards()[0];
    // A source rename must invalidate evidence for its default candidate title.
    fixture.methods.updateNameRoleValue(card, 'pageName', '');
    const checking = commitNameRoleAndWait(fixture, card, 'pageName');
    fixture.methods.updateNameCardValue(card, 'name', '摄影冒险2');
    response.resolve({ title: '摄影冒险', exists: false });
    await checking;
    assert.equal(
        fixture.methods.getNameRolePageState(card, 'pageName').exists,
        null,
    );
    assert.equal(
        fixture.methods.getNameRolePageState(card, 'pageName').title,
        '摄影冒险2',
    );
});

test('redirect refresh preserves selections and staged edits after excluded rows', async (context) => {
    const fixture = createReviewFixture(
        context,
        {
            redirectRows: [
                { title: 'Star Harbor' },
                { title: 'Alternative_Name', enabled: false },
                {
                    title: 'Reviewed alias',
                    enabled: false,
                    status: 'Pending edit',
                    pendingEdit: {
                        create: false,
                        title: 'Reviewed alias',
                        text: 'Reviewed source',
                        summary: 'Reviewed summary',
                        previousStatus: 'Exists',
                    },
                },
            ],
        },
        async (rows, title) =>
            buildRedirectRowsFromTitles(
                rows.map((row) => row.title),
                title,
                [
                    {
                        requestedTitle: 'Reviewed alias',
                        title: 'Reviewed alias',
                        exists: true,
                    },
                ],
            ),
    );
    const [excluded, missing, staged] = fixture.state.form.redirectRows;
    const pendingEdit = staged.pendingEdit;
    await fixture.methods.checkRedirectRows();
    const rows = fixture.state.form.redirectRows;
    assert.equal(rows.includes(excluded), false);
    assert.equal(rows[0], missing);
    assert.equal(rows[0].title, 'Alternative Name');
    assert.equal(rows[0].enabled, false);
    assert.equal(rows[0].status, 'Missing');
    assert.equal(rows[1], staged);
    assert.equal(rows[1].enabled, false);
    assert.equal(rows[1].exists, true);
    assert.equal(rows[1].status, 'Pending edit');
    assert.equal(rows[1].pendingEdit, pendingEdit);
    assert.equal(rows[1].pendingEdit.text, 'Reviewed source');
});

test('redirect refresh preserves changes made while lookup is pending', async (context) => {
    const result = deferred<unknown[]>();
    const fixture = createReviewFixture(
        context,
        { redirectRows: [{ title: 'Alternative name', enabled: true }] },
        () => result.promise,
    );
    const row = fixture.state.form.redirectRows[0];
    const checking = fixture.methods.checkRedirectRows();
    row.enabled = false;
    row.pendingEdit = {
        create: true,
        title: row.title,
        text: 'Reviewed redirect source',
    };
    result.resolve([{ title: row.title, exists: false }]);
    await checking;
    assert.equal(fixture.state.form.redirectRows[0], row);
    assert.equal(row.enabled, false);
    assert.equal(row.status, 'Pending creation');
    assert.equal(row.pendingEdit.text, 'Reviewed redirect source');
});

test('redirect refresh discards results after names are edited or removed', async (context) => {
    const result = deferred<unknown[]>();
    let requestedRows: Array<{ title: string }> = [];
    const fixture = createReviewFixture(
        context,
        {
            redirectRows: [
                { title: 'Original alias', exists: false },
                { title: 'Removed alias', exists: false },
            ],
        },
        (rows) => {
            requestedRows = rows;
            return result.promise;
        },
    );
    const checking = fixture.methods.checkRedirectRows();
    fixture.methods.updateRedirectRowTitle(0, 'New alias');
    fixture.methods.removeRedirectRow(1);
    assert.deepEqual(requestedRows, [
        { title: 'Original alias' },
        { title: 'Removed alias' },
    ]);
    result.resolve([
        { title: 'Original alias', exists: true },
        { title: 'Removed alias', exists: true },
    ]);
    await checking;
    assert.equal(fixture.state.form.redirectRows[0].title, 'New alias');
    assert.equal(fixture.state.form.redirectRows[0].exists, false);
    assert.equal(
        fixture.state.form.redirectRows.some(
            (row: { title: string }) => row.title === 'Removed alias',
        ),
        false,
    );
});

test('newer redirect checks supersede older responses', async (context) => {
    const first = deferred<unknown[]>();
    const second = deferred<unknown[]>();
    let calls = 0;
    const fixture = createReviewFixture(
        context,
        { redirectRows: [{ title: 'Alternative name' }] },
        () => (++calls === 1 ? first.promise : second.promise),
    );
    const firstCheck = fixture.methods.checkRedirectRows();
    const secondCheck = fixture.methods.checkRedirectRows();
    second.resolve([{ title: 'Alternative name', exists: true }]);
    await secondCheck;
    first.resolve([{ title: 'Alternative name', exists: false }]);
    await firstCheck;
    assert.equal(fixture.state.form.redirectRows[0].exists, true);
});

test('initial redirect suggestions discard responses after names change', async (context) => {
    const result = deferred<unknown[]>();
    const fixture = createReviewFixture(
        context,
        { englishName: 'Old name' },
        async () => [],
        () => result.promise,
    );
    const preparing = fixture.methods.refreshRedirectRows();
    fixture.state.form.englishName = 'New name';
    result.resolve([{ title: 'Old name', exists: false }]);
    await preparing;
    assert.equal(fixture.state.form.redirectRows, null);
});

test('completed name changes reconcile redirects and preserve manual, excluded and staged choices', async (context) => {
    const fixture = createReviewFixture(
        context,
        {
            englishName: 'Old English name',
            localizedNames: [{ name: '本地名稱', official: true }],
            redirectRows: [
                {
                    title: 'Old English name',
                    generatedTitle: 'Old English name',
                },
                {
                    title: 'Excluded alias',
                    enabled: false,
                    generatedTitle: 'Excluded alias',
                },
                { title: 'Manual alias', manualAdded: true, enabled: false },
                {
                    title: 'Staged alias',
                    generatedTitle: 'Staged alias',
                    pendingEdit: {
                        create: true,
                        text: 'Reviewed redirect source',
                    },
                },
            ],
        },
        async (rows, title) =>
            buildRedirectRowsFromTitles(
                rows.map((row) => row.title),
                title,
            ),
        undefined,
        {
            async onPrepareRedirectRows(
                form: {
                    englishName: string;
                    localizedNames: Array<{ name: string }>;
                },
                title: string,
            ) {
                return buildRedirectRowsFromTitles(
                    [
                        form.englishName,
                        ...form.localizedNames.map((row) => row.name),
                    ],
                    title,
                );
            },
        },
    );
    const [, excluded, manual, staged] = fixture.state.form.redirectRows;
    await fixture.methods.refreshRedirectRows();
    fixture.state.form.englishName = 'New English name';
    fixture.state.form.localizedNames[0].name = '新本地名稱';
    await fixture.methods.refreshRedirectRows();
    const rows = fixture.state.form.redirectRows;
    assert.equal(
        rows.some((row: { title: string }) => row.title === 'Old English name'),
        false,
    );
    assert.equal(
        rows.some((row: { title: string }) => row.title === '本地名稱'),
        false,
    );
    assert.equal(
        rows.some((row: { title: string }) => row.title === 'New English name'),
        true,
    );
    assert.equal(
        rows.some((row: { title: string }) => row.title === '新本地名稱'),
        true,
    );
    assert.equal(rows.includes(excluded), true);
    assert.equal(excluded.enabled, false);
    assert.equal(rows.includes(manual), true);
    assert.equal(manual.enabled, false);
    assert.equal(rows.includes(staged), true);
    assert.equal(staged.pendingEdit.text, 'Reviewed redirect source');
});

test('name suggestion refresh preserves choices made during lookup and rejects a replaced title', async (context) => {
    const result = deferred<unknown[]>();
    const fixture = createReviewFixture(
        context,
        {
            englishName: 'Suggested alias',
            redirectRows: [{ title: 'Suggested alias', enabled: true }],
        },
        async () => [],
        () => result.promise,
    );
    const row = fixture.state.form.redirectRows[0];
    const refreshing = fixture.methods.refreshRedirectRows();
    row.enabled = false;
    row.pendingEdit = { create: true, text: 'Reviewed new source' };
    result.resolve([{ title: 'Suggested alias', exists: false }]);
    await refreshing;
    assert.equal(fixture.state.form.redirectRows[0], row);
    assert.equal(row.enabled, false);
    assert.equal(row.pendingEdit.text, 'Reviewed new source');
});

test('redirect checks discard responses after the dialog is disposed', async (context) => {
    const result = deferred<unknown[]>();
    const fixture = createReviewFixture(
        context,
        { redirectRows: [{ title: 'Alternative name', exists: false }] },
        () => result.promise,
    );
    const checking = fixture.methods.checkRedirectRows();
    fixture.dispose();
    result.resolve([{ title: 'Alternative name', exists: true }]);
    await checking;
    assert.equal(fixture.state.form.redirectRows[0].exists, false);
});

test('related-page refresh actions display failures and preserve reviewed rows', async (context) => {
    for (const method of [
        'checkRedirectRows',
        'refreshRedirectRows',
        'rebuildRedirectRows',
        'refreshRelatedItems',
    ]) {
        await context.test(method, async (nested) => {
            const unavailable = async () => {
                throw new Error('Wiki API unavailable');
            };
            const fixture = createReviewFixture(
                nested,
                {
                    redirectRows: [{ title: 'Reviewed alias', enabled: false }],
                    navboxRows: [
                        {
                            text: '{{Reviewed series}}',
                            title: 'Reviewed series',
                            enabled: false,
                            pendingEdit: {
                                title: 'Template:Reviewed series',
                                text: 'Reviewed template source',
                                create: false,
                            },
                        },
                    ],
                },
                unavailable,
                unavailable,
                { onPrepareReview: unavailable },
            );
            const redirectRows = fixture.state.form.redirectRows;
            const navboxRows = fixture.state.form.navboxRows;
            await fixture.methods[method]();
            assert.equal(
                fixture.state.reviewState.error,
                'Wiki API unavailable',
            );
            assert.equal(fixture.state.reviewState.loading, false);
            assert.equal(fixture.state.form.redirectRows, redirectRows);
            assert.equal(fixture.state.form.navboxRows, navboxRows);
            assert.equal(redirectRows[0].enabled, false);
            assert.equal(navboxRows[0].enabled, false);
            assert.equal(
                navboxRows[0].pendingEdit.text,
                'Reviewed template source',
            );
        });
    }
});

test('category lookup failure does not mark unchanged rows as checked', async (context) => {
    const fixture = createReviewFixture(
        context,
        { categoryRows: [{ category: 'Reviewed games', fixed: false }] },
        async () => [],
        undefined,
        {
            async onCategoryRowsRefresh(
                _form: unknown,
                state: { error: string },
            ) {
                state.error = 'Category API unavailable';
            },
        },
    );
    const row = fixture.state.form.categoryRows[0];
    await fixture.methods.refreshCategoryRows();
    assert.equal(fixture.state.categoryState.error, 'Category API unavailable');
    assert.equal(row.fixed, false);
    assert.equal(row.fixedCategory, undefined);
});

test('category blur checks do not restore an old value into a renamed or moved row', async (context) => {
    const result = deferred<void>();
    const fixture = createReviewFixture(
        context,
        {
            categoryRows: [
                { category: 'First games', fixed: false },
                { category: 'Second games', fixed: false },
            ],
        },
        async () => [],
        undefined,
        {
            onCategoryRowsRefresh: () => result.promise,
            onUpdateCategoryRowCategory: (
                row: Record<string, unknown>,
                category: string,
            ) => ({ ...row, category }),
        },
    );
    const checking = fixture.methods.checkRelatedItem(
        fixture.state.form.categoryRows[0],
        'category',
        {
            target: { value: 'Blurred games' },
        },
    );
    fixture.methods.updateRelatedItem(
        fixture.state.form.categoryRows[0],
        'category',
        'New games',
    );
    const renamed = fixture.state.form.categoryRows.shift();
    fixture.state.form.categoryRows.push(renamed);
    result.resolve();
    await checking;
    assert.equal(fixture.state.form.categoryRows[0].category, 'Second games');
    assert.equal(renamed.category, 'New games');
});

test('category blur checks do not overwrite a neighbor after removal', async (context) => {
    const result = deferred<void>();
    const fixture = createReviewFixture(
        context,
        {
            categoryRows: [
                { category: 'First games', fixed: false },
                { category: 'Second games', fixed: false },
            ],
        },
        async () => [],
        undefined,
        {
            onCategoryRowsRefresh: () => result.promise,
            onUpdateCategoryRowCategory: (
                row: Record<string, unknown>,
                category: string,
            ) => ({ ...row, category }),
        },
    );
    const checking = fixture.methods.checkRelatedItem(
        fixture.state.form.categoryRows[0],
        'category',
        {
            target: { value: 'Blurred games' },
        },
    );
    fixture.methods.removeRelatedItem(
        fixture.state.form.categoryRows[0],
        'category',
    );
    result.resolve();
    await checking;
    assert.equal(fixture.state.form.categoryRows[0].relatedRemoved, true);
    assert.equal(fixture.state.form.categoryRows[1].category, 'Second games');
});

test('navbox refresh matches resolved aliases by source title and preserves staged edits', async (context) => {
    const fixture = createReviewFixture(
        context,
        {
            navboxRows: [
                {
                    text: '{{Alias series|mode=reviewed}}',
                    enabled: false,
                    pendingEdit: {
                        title: 'Template:Alias series',
                        text: 'Reviewed template source',
                        summary: 'Reviewed summary',
                        create: false,
                    },
                },
                { text: '{{Other series}}', enabled: true },
            ],
        },
        async () => [],
        undefined,
        {
            async onPrepareReview(form: { navboxRows: unknown[] }) {
                const rows = await resolveReviewedNavboxRows(form.navboxRows, {
                    fetcher: async () =>
                        Response.json({
                            query: {
                                redirects: [
                                    {
                                        from: 'Template:Alias series',
                                        to: 'Template:Canonical series',
                                    },
                                ],
                                pages: [
                                    {
                                        title: 'Template:Canonical series',
                                        pageid: 1,
                                    },
                                    {
                                        title: 'Template:Other series',
                                        pageid: 2,
                                    },
                                ],
                            },
                        }),
                });
                return rows.reverse();
            },
        },
    );
    const [alias, other] = fixture.state.form.navboxRows;
    const pendingEdit = alias.pendingEdit;
    await fixture.methods.checkRelatedItem(
        fixture.state.form.navboxRows[0],
        'navbox',
    );
    const rows = fixture.state.form.navboxRows;
    assert.equal(rows[0], other);
    assert.equal(rows[1], alias);
    assert.equal(alias.title, 'Canonical series');
    assert.equal(alias.text, '{{Canonical series|mode=reviewed}}');
    assert.equal(alias.enabled, false);
    assert.equal(alias.pendingEdit, pendingEdit);
    assert.equal(alias.status, 'Pending edit');
    assert.equal(alias.pendingEdit.text, 'Reviewed template source');
    alias.fixed = false;
    other.fixed = false;
    await fixture.methods.checkRelatedItem(
        fixture.state.form.navboxRows[0],
        'navbox',
    );
    assert.equal(fixture.state.form.navboxRows.includes(alias), true);
    assert.equal(alias.enabled, false);
    assert.equal(alias.pendingEdit, pendingEdit);
    assert.equal(alias.status, 'Pending edit');
});

test('navbox refresh rejects edited inputs, removed rows and disposed dialogs', async (context) => {
    for (const change of ['title', 'remove', 'series', 'replace', 'dispose']) {
        await context.test(change, async (nested) => {
            const result = deferred<unknown[]>();
            let requestedTitle = '';
            const fixture = createReviewFixture(
                nested,
                {
                    series: 'Old series',
                    navboxRows: [{ text: '{{Old series}}', status: 'Missing' }],
                },
                async () => [],
                undefined,
                {
                    onPrepareReview(form: {
                        navboxRows: Array<{ title: string }>;
                    }) {
                        requestedTitle = form.navboxRows[0]!.title;
                        return result.promise;
                    },
                },
            );
            const row = fixture.state.form.navboxRows[0];
            const checking = fixture.methods.checkRelatedItem(
                fixture.state.form.navboxRows[0],
                'navbox',
            );
            if (change === 'title') {
                fixture.methods.updateNavboxRow(0, '{{New series}}');
            } else if (change === 'remove') {
                fixture.methods.removeRelatedItem(
                    fixture.state.form.navboxRows[0],
                    'navbox',
                );
            } else if (change === 'series') {
                fixture.state.form.series = 'New series';
            } else if (change === 'replace') {
                fixture.state.form.navboxRows = [];
            } else {
                fixture.dispose();
            }
            result.resolve([
                {
                    text: '{{Old series}}',
                    title: 'Old series',
                    sourceTitle: 'Old series',
                    status: 'OK',
                },
            ]);
            await checking;
            assert.equal(requestedTitle, 'Old series');
            assert.notEqual(row.status, 'OK');
            if (change === 'title') {
                assert.equal(row.title, 'New series');
            } else if (change === 'remove') {
                assert.equal(row.relatedRemoved, true);
                assert.equal(row.enabled, false);
            } else if (change === 'replace') {
                assert.equal(
                    fixture.state.form.navboxRows.includes(row),
                    false,
                );
            }
        });
    }
});

test('newer navbox checks supersede older responses', async (context) => {
    const first = deferred<unknown[]>();
    const second = deferred<unknown[]>();
    let calls = 0;
    const fixture = createReviewFixture(
        context,
        { navboxRows: [{ text: '{{Reviewed series}}' }] },
        async () => [],
        undefined,
        {
            onPrepareReview: () =>
                ++calls === 1 ? first.promise : second.promise,
        },
    );
    const firstCheck = fixture.methods.checkRelatedItem(
        fixture.state.form.navboxRows[0],
        'navbox',
    );
    const secondCheck = fixture.methods.checkRelatedItem(
        fixture.state.form.navboxRows[0],
        'navbox',
    );
    second.resolve([{ text: '{{Reviewed series}}', status: 'OK' }]);
    await secondCheck;
    first.resolve([{ text: '{{Reviewed series}}', status: 'Not exists' }]);
    await firstCheck;
    assert.equal(fixture.state.form.navboxRows[0].status, 'OK');
});

test('navbox refresh preserves selections and edits made during lookup', async (context) => {
    const result = deferred<unknown[]>();
    const fixture = createReviewFixture(
        context,
        { navboxRows: [{ text: '{{Reviewed series}}', enabled: true }] },
        async () => [],
        undefined,
        { onPrepareReview: () => result.promise },
    );
    const row = fixture.state.form.navboxRows[0];
    const checking = fixture.methods.checkRelatedItem(
        fixture.state.form.navboxRows[0],
        'navbox',
    );
    row.enabled = false;
    row.pendingEdit = { create: false, text: 'New reviewed source' };
    result.resolve([{ text: '{{Reviewed series}}', status: 'OK' }]);
    await checking;
    assert.equal(fixture.state.form.navboxRows[0], row);
    assert.equal(row.enabled, false);
    assert.equal(row.status, 'Pending edit');
    assert.equal(row.pendingEdit.text, 'New reviewed source');
});

test('inline related labels distinguish categories and templates without trusting restored statuses', (context) => {
    const fixture = createReviewFixture(context, {}, async () => []);
    assert.equal(
        fixture.methods.getRelatedItemLabel(
            { category: ':Category:Known games' },
            'category',
        ),
        'Known games',
    );
    assert.equal(
        fixture.methods.getRelatedItemLabel(
            { text: '{{Template:Known navbox|mode=compact}}' },
            'navbox',
        ),
        'Known navbox',
    );
    assert.equal(
        fixture.methods.getRelatedItemLabel(
            { stubTag: '{{模板:Known-stub}}' },
            'stubTag',
        ),
        'Known-stub',
    );
    for (const kind of ['category', 'navbox', 'stubTag']) {
        assert.equal(
            fixture.methods.getRelatedItemPageExistence(
                { status: 'OK', pendingEdit: { text: 'Reviewed' } },
                kind,
            ),
            'unchecked',
        );
    }
    assert.equal(
        fixture.methods.getRelatedItemDisplayLabel(
            { text: '{{Template:Known navbox|mode=compact}}' },
            'navbox',
        ),
        '{{Known navbox}}',
    );
    assert.equal(
        fixture.methods.getRelatedItemDisplayLabel(
            { category: 'Category:Known games' },
            'category',
        ),
        'Known games',
    );
});

test('confirmed category and navbox colors are rechecked and failures remain unknown', async (context) => {
    const requested: string[] = [];
    let response: boolean | Error = true;
    const fixture = createReviewFixture(
        context,
        {
            categoryRows: [
                { category: 'Known games', enabled: true, status: 'OK' },
            ],
            navboxRows: [
                {
                    text: '{{Known navbox|note=First\nSecond}}',
                    enabled: false,
                    status: 'OK',
                },
            ],
        },
        async () => [],
        undefined,
        {
            async onCheckPageTitle(title: string) {
                requested.push(title);
                if (response instanceof Error) throw response;
                return { exists: response };
            },
        },
    );
    const category = fixture.state.form.categoryRows[0];
    const navbox = fixture.state.form.navboxRows[0];
    for (const [row, kind] of [
        [category, 'category'],
        [navbox, 'navbox'],
    ]) {
        assert.equal(
            fixture.methods.getRelatedItemPageExistence(row, kind),
            'unchecked',
        );
        response = true;
        await fixture.methods.checkRelatedItem(row, kind);
        assert.equal(
            fixture.methods.getRelatedItemPageExistence(row, kind),
            'exists',
        );
        response = false;
        await fixture.methods.checkRelatedItem(row, kind);
        assert.equal(
            fixture.methods.getRelatedItemPageExistence(row, kind),
            'missing',
        );
        response = new Error('API unavailable');
        await fixture.methods.checkRelatedItem(row, kind);
        assert.equal(
            fixture.methods.getRelatedItemPageExistence(row, kind),
            'unchecked',
        );
        assert.equal(fixture.state.reviewState.error, 'API unavailable');
    }
    assert.deepEqual(requested, [
        'Category:Known games',
        'Category:Known games',
        'Category:Known games',
        'Template:Known navbox',
        'Template:Known navbox',
        'Template:Known navbox',
    ]);
    assert.equal(category.enabled, true);
    assert.equal(navbox.enabled, false);
});

test('stub template checks deduplicate pending reads, recheck settled results and preserve reviewed choices', async (context) => {
    const result = deferred<{ exists: boolean }>();
    const requested: string[] = [];
    const fixture = createReviewFixture(
        context,
        {
            stubTagRows: [
                { stubTag: '{{Template:Known-stub}}', enabled: true },
            ],
        },
        async () => [],
        undefined,
        {
            onCheckPageTitle(title: string) {
                requested.push(title);
                return result.promise;
            },
        },
    );
    const row = fixture.state.form.stubTagRows[0];
    const first = fixture.methods.checkRelatedItem(row, 'stubTag');
    const second = fixture.methods.checkRelatedItem(row, 'stubTag');
    row.enabled = false;
    row.pendingEdit = { create: false, text: 'Reviewed template source' };
    row.status = 'Pending edit';
    result.resolve({ exists: true });
    await Promise.all([first, second]);
    assert.deepEqual(requested, ['Template:Known-stub']);
    assert.equal(row.enabled, false);
    assert.equal(row.status, 'Pending edit');
    assert.equal(row.pendingEdit.text, 'Reviewed template source');
    assert.equal(row.checkedStubTag, 'Template:Known-stub');
    await fixture.methods.checkRelatedItem(row, 'stubTag');
    assert.equal(requested.length, 2);
});

test('stub template checks discard stale renamed, removed, replaced and disposed rows', async (context) => {
    for (const change of ['rename', 'remove', 'replace', 'dispose']) {
        await context.test(change, async (nested) => {
            const result = deferred<{ exists: boolean }>();
            const fixture = createReviewFixture(
                nested,
                { stubTagRows: [{ stubTag: 'Original-stub', enabled: false }] },
                async () => [],
                undefined,
                { onCheckPageTitle: () => result.promise },
            );
            const row = fixture.state.form.stubTagRows[0];
            const checking = fixture.methods.checkRelatedItem(row, 'stubTag');
            if (change === 'rename') row.stubTag = 'Renamed-stub';
            else if (change === 'remove')
                fixture.methods.removeRelatedItem(row, 'stubTag');
            else if (change === 'replace')
                fixture.state.form.stubTagRows = [
                    { stubTag: row.stubTag, status: '' },
                ];
            else fixture.dispose();
            result.resolve({ exists: true });
            await checking;
            assert.equal(row.status, '');
            assert.equal(row.checkedStubTag, undefined);
            assert.equal(row.enabled, false);
        });
    }
});

test('newer stub template names supersede pending existence checks', async (context) => {
    const first = deferred<{ exists: boolean }>();
    const second = deferred<{ exists: boolean }>();
    const fixture = createReviewFixture(
        context,
        { stubTagRows: [{ stubTag: 'Original-stub', enabled: false }] },
        async () => [],
        undefined,
        {
            onCheckPageTitle: (title: string) =>
                title === 'Template:Original-stub'
                    ? first.promise
                    : second.promise,
        },
    );
    const row = fixture.state.form.stubTagRows[0];
    const oldCheck = fixture.methods.checkRelatedItem(row, 'stubTag');
    fixture.methods.updateRelatedItem(row, 'stubTag', 'Renamed-stub');
    const newCheck = fixture.methods.checkRelatedItem(row, 'stubTag');
    second.resolve({ exists: false });
    await newCheck;
    first.resolve({ exists: true });
    await oldCheck;
    assert.equal(row.status, 'Not exists');
    assert.equal(row.checkedStubTag, 'Renamed-stub');
    assert.equal(row.enabled, false);
});

test('restored stub existence is checked afresh when its inline suggestions first open', async (context) => {
    const titles: string[] = [];
    const fixture = createReviewFixture(
        context,
        {
            stubTagRows: [
                {
                    stubTag: 'Restored-stub',
                    checkedStubTag: 'Restored-stub',
                    status: 'OK',
                    enabled: false,
                },
            ],
        },
        async () => [],
        undefined,
        {
            async onCheckPageTitle(title: string) {
                titles.push(title);
                return { exists: false };
            },
        },
    );
    await fixture.methods.refreshRelatedItems();
    const row = fixture.state.form.stubTagRows[0];
    assert.deepEqual(titles, ['Template:Restored-stub']);
    assert.equal(row.status, 'Not exists');
    assert.equal(row.enabled, false);
    await fixture.methods.refreshRelatedItems();
    assert.equal(titles.length, 1);
});

/** Lets checks started by the real blur/explicit-refresh handler settle in offline tests. */
async function commitNameRoleAndWait(
    fixture: ReturnType<typeof createReviewFixture>,
    card: unknown,
    role: string,
): Promise<void> {
    fixture.methods.commitNameRole(card, role, true);
    await new Promise<void>((resolve) => setImmediate(resolve));
}
