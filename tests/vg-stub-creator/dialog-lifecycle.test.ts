/**
 * @file tests/vg-stub-creator/dialog-lifecycle.test.ts
 * Purpose: Keeps simultaneously constructed creator dialogs and disposed async work isolated.
 *
 * Contents: Independent dialog state, source identity, and editor teardown.
 */

import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { computed, reactive, ref } from 'vue';
import { createDialogComponent } from '../../src/vg-stub-creator/features/creator/form/component.ts';
import type { CreatorDialogOptions } from '../../src/vg-stub-creator/features/creator/form/dialog-options.ts';
import type { SourceEditor } from '../../src/vg-stub-creator/features/creator/form/source-editor.ts';

/** Supplies one shared offline browser surface for all dialogs in a scenario. */
function installWindow(context: TestContext) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const listeners = new Map<string, Set<unknown>>();
    const disposeAfter: Array<() => void> = [];
    const host: {
        vgStubCreatorDialog?: { open(): void; submit(): Promise<void> };
        addEventListener(type: string, listener: unknown): void;
        removeEventListener(type: string, listener: unknown): void;
    } = {
        addEventListener(type, listener) {
            const registered = listeners.get(type) ?? new Set();
            registered.add(listener);
            listeners.set(type, registered);
        },
        removeEventListener(type, listener) {
            listeners.get(type)?.delete(listener);
        },
    };
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: host,
    });
    context.after(() => {
        disposeAfter.forEach((dispose) => dispose());
        if (previous == null) Reflect.deleteProperty(globalThis, 'window');
        else Object.defineProperty(globalThis, 'window', previous);
    });
    return { host, listeners, disposeAfter };
}

/** Runs real dialog methods with inert watchers and explicitly controlled adapters. */
function createDialogFixture(
    name: string,
    extraOptions: Record<string, unknown> = {},
) {
    const unmount: Array<() => void> = [];
    const watchers: Array<{
        source: unknown;
        callback: (value: unknown) => void;
    }> = [];
    let activations = 0;
    const component = createDialogComponent(
        {
            computed,
            reactive,
            ref,
            watch(source: unknown, callback: (value: unknown) => void) {
                watchers.push({ source, callback });
            },
            onBeforeUnmount(callback: () => void) {
                unmount.push(callback);
            },
        },
        {
            currentTitle: name,
            defaultName: name,
            initialForm: { name, englishName: `${name} English` },
            createReviewLinkSession: () => ({ claim: () => false }),
            getHistoryEntries: () => [],
            getFieldPlaceholder: (form: { name: string }) => form.name,
            onCheckRedirectRows: async () => [],
            onFormChange() {},
            onActivate() {
                activations += 1;
            },
            ...extraOptions,
        } as unknown as CreatorDialogOptions,
    );
    const state = component.setup();
    let disposed = false;
    return {
        state,
        methods: component.methods as Record<string, (...args: any[]) => any>,
        activations: () => activations,
        activateTab(value: string) {
            state.activeTab.value = value;
            for (const watcher of watchers) {
                if (watcher.source === state.activeTab) watcher.callback(value);
            }
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            unmount.forEach((callback) => callback());
        },
    };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((complete, fail) => {
        resolve = complete;
        reject = fail;
    });
    return { promise, reject, resolve };
}

/** Supplies an enhanced source buffer independent of the textarea's reactive value. */
function installCodeMirror(context: TestContext) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'mw');
    const instances: Editor[] = [];
    class Editor implements SourceEditor {
        value: string;
        view: NonNullable<SourceEditor['view']>;

        constructor(textarea: HTMLTextAreaElement) {
            this.value = textarea.value;
            const read = () => this.value;
            this.view = {
                state: {
                    doc: {
                        get length() {
                            return read().length;
                        },
                        toString: read,
                    },
                },
                dispatch: ({ changes }) => {
                    this.value = changes.insert;
                },
            };
            instances.push(this);
        }

        initialize(): void {}
        destroy(): void {}
    }
    Object.defineProperty(globalThis, 'mw', {
        configurable: true,
        value: {
            loader: {
                using: async () => (module: string) =>
                    module === 'ext.CodeMirror' ? Editor : () => ({}),
            },
        },
    });
    context.after(() => {
        if (previous == null) Reflect.deleteProperty(globalThis, 'mw');
        else Object.defineProperty(globalThis, 'mw', previous);
    });
    return instances;
}

test('two dialogs retain their own forms, methods, editor state, and global controller ownership', async (context) => {
    const { host, listeners, disposeAfter } = installWindow(context);
    const first = createDialogFixture('First');
    const firstController = host.vgStubCreatorDialog!;
    const second = createDialogFixture('Second');
    const secondController = host.vgStubCreatorDialog!;
    disposeAfter.push(() => {
        first.dispose();
        second.dispose();
    });

    assert.notEqual(firstController, secondController);
    assert.notEqual(first.state.form, second.state.form);
    assert.notEqual(first.methods, second.methods);
    assert.notEqual(
        first.state.nameUsageIdPrefix,
        second.state.nameUsageIdPrefix,
    );
    assert.equal(listeners.get('keydown')?.size, 2);

    first.methods.updateFieldValue({ key: 'name' }, 'First edited');
    second.methods.updateFieldValue({ key: 'year' }, '2025');
    first.methods.updateFieldValue(
        { key: 'enwikiTitle' },
        'First game (video game)',
    );
    const firstName = first.methods
        .getNameCards()
        .find((row: { id: string }) => row.id === 'english');
    first.methods.toggleNameUses(firstName);

    assert.equal(first.state.form.name, 'First edited');
    assert.equal(second.state.form.name, 'Second');
    assert.equal(first.state.form.year, undefined);
    assert.equal(second.state.form.year, '2025年');
    assert.equal(
        first.state.getFieldPlaceholder({ key: 'name' }),
        'First edited',
    );
    assert.equal(second.state.getFieldPlaceholder({ key: 'name' }), 'Second');
    assert.deepEqual(
        first.state.getNameSearchRows().map((row) => row.query),
        ['First game'],
    );
    assert.deepEqual(second.state.getNameSearchRows(), []);
    assert.equal(first.methods.isNameUsesExpanded(firstName), true);
    assert.equal(second.methods.isNameUsesExpanded(firstName), false);

    first.dispose();
    assert.equal(host.vgStubCreatorDialog, secondController);
    assert.equal(listeners.get('keydown')?.size, 1);
    firstController.open();
    await firstController.submit();
    assert.equal(first.state.preSaveOpen.value, false);
    secondController.open();
    await nextTurn();
    assert.equal(first.state.open.value, false);
    assert.equal(second.state.open.value, true);
    assert.equal(first.activations(), 0);
    assert.equal(second.activations(), 1);
    second.methods.updateFieldValue({ key: 'name' }, 'Second still active');
    assert.equal(first.state.form.name, 'First edited');
    assert.equal(second.state.form.name, 'Second still active');

    second.dispose();
    assert.equal(host.vgStubCreatorDialog, undefined);
    assert.equal(listeners.get('keydown')?.size, 0);
    assert.equal(listeners.get('keyup')?.size, 0);
    assert.equal(listeners.get('blur')?.size, 0);
});

test('disposed dialogs reject late name checks and English Wikipedia metadata', async (context) => {
    const { disposeAfter } = installWindow(context);
    const page = deferred<{ title: string; exists: boolean }>();
    const metadata = deferred<{ wikidataId: string }>();
    const first = createDialogFixture('First', {
        onCheckPageTitle: () => page.promise,
        onEnwikiTitleChange: () => metadata.promise,
    });
    disposeAfter.push(() => first.dispose());
    const card = first.methods
        .getNameCards()
        .find((row: { id: string }) => row.id === 'english');
    first.methods.commitNameRole(card, 'pageName');
    first.methods.updateFieldValue({ key: 'enwikiTitle' }, 'First article');
    assert.equal(
        first.methods.getNameRolePageState(card, 'pageName').loading,
        true,
    );
    first.dispose();
    const snapshot = JSON.stringify(first.state.form);

    const second = createDialogFixture('Second');
    disposeAfter.push(() => second.dispose());
    page.resolve({ title: 'First English', exists: true });
    metadata.resolve({ wikidataId: 'Q999' });
    await nextTurn();

    assert.equal(JSON.stringify(first.state.form), snapshot);
    assert.equal(
        first.methods.getNameRolePageState(card, 'pageName').exists,
        null,
    );
    assert.equal(second.state.form.name, 'Second');
    assert.equal(second.state.form.wikidataId, undefined);
});

test('a citation response cannot replace reviewed rows after its dialog is disposed', async (context) => {
    const { disposeAfter } = installWindow(context);
    const citations = deferred<unknown[]>();
    const fixture = createDialogFixture('First', {
        initialForm: {
            name: 'First',
            citationRows: [
                {
                    sourceUrl: 'https://example.test/reviewed',
                    params: [{ name: 'title', value: 'Reviewed' }],
                },
            ],
        },
        onPrepareCitations: () => citations.promise,
    });
    disposeAfter.push(() => fixture.dispose());
    fixture.activateTab('references');
    assert.equal(fixture.state.citationState.loading, true);
    fixture.dispose();
    const reviewed = JSON.stringify(fixture.state.form.citationRows);
    citations.resolve([
        {
            sourceUrl: 'https://example.test/late',
            params: [{ name: 'title', value: 'Late response' }],
        },
    ]);
    await nextTurn();
    assert.equal(JSON.stringify(fixture.state.form.citationRows), reviewed);
});

test('closing a page editor discards its pending source read', async (context) => {
    const { disposeAfter } = installWindow(context);
    const source = deferred<string>();
    let previews = 0;
    const fixture = createDialogFixture('First', {
        onFetchPageText: () => source.promise,
        onParsePreview: async () => {
            previews += 1;
            return 'Late preview';
        },
    });
    disposeAfter.push(() => fixture.dispose());
    const loading = fixture.methods.openNavboxEdit({
        title: 'First template',
        status: 'OK',
    });
    assert.equal(fixture.state.pageEditState.loading, true);
    fixture.methods.closePageEditDialog();
    source.resolve('Late source');
    await loading;

    assert.equal(previews, 0);
    assert.equal(fixture.state.pageEditOpen.value, false);
    assert.equal(fixture.state.pageEditState.loading, false);
    assert.equal(fixture.state.pageEditState.text, '');
    assert.equal(fixture.state.pageEditState.html, '');
});

test('a superseded source failure cannot change the new page editor', async (context) => {
    const { disposeAfter } = installWindow(context);
    const firstSource = deferred<string>();
    const secondSource = deferred<string>();
    const fixture = createDialogFixture('First', {
        onFetchPageText: (title: string) =>
            title === 'Template:First template'
                ? firstSource.promise
                : secondSource.promise,
        onParsePreview: async (text: string) => `<p>${text}</p>`,
    });
    disposeAfter.push(() => fixture.dispose());
    const first = fixture.methods.openNavboxEdit({
        title: 'First template',
        status: 'OK',
    });
    fixture.methods.closePageEditDialog();
    const row = { title: 'Second template', status: 'OK' };
    const second = fixture.methods.openNavboxEdit(row);
    firstSource.reject(new Error('Old lookup failed'));
    await first;

    assert.deepEqual(fixture.state.pageEditState.row, row);
    assert.equal(fixture.state.pageEditState.title, 'Template:Second template');
    assert.equal(fixture.state.pageEditState.error, '');
    assert.equal(fixture.state.pageEditState.loading, true);
    secondSource.resolve('Current source');
    await second;
    assert.equal(fixture.state.pageEditState.text, 'Current source');
    assert.equal(fixture.state.pageEditState.html, '<p>Current source</p>');
});

test('page preview responses preserve newer source and newer requests', async (context) => {
    const { disposeAfter } = installWindow(context);
    const initialPreview = deferred<string>();
    const firstPreview = deferred<string>();
    const secondPreview = deferred<string>();
    const previews = [initialPreview, firstPreview, secondPreview];
    const fixture = createDialogFixture('First', {
        onParsePreview: () => previews.shift()!.promise,
    });
    disposeAfter.push(() => fixture.dispose());
    const opening = fixture.methods.openNavboxEdit({
        title: 'First template',
        status: 'OK',
        pendingEdit: { create: false, text: 'Reviewed source' },
    });
    fixture.state.pageEditState.text = 'Newer source';
    initialPreview.resolve('Older source preview');
    await opening;
    assert.equal(fixture.state.pageEditState.text, 'Newer source');
    assert.equal(fixture.state.pageEditState.html, '');

    const first = fixture.methods.refreshPageEditPreview();
    const second = fixture.methods.refreshPageEditPreview();
    secondPreview.resolve('Current source preview');
    await second;
    firstPreview.resolve('Superseded preview');
    await first;
    assert.equal(fixture.state.pageEditState.html, 'Current source preview');
    assert.equal(fixture.state.pageEditState.loading, false);
});

test('disposed and reset page editors reject late parsed previews', async (context) => {
    const { disposeAfter } = installWindow(context);
    for (const end of ['dispose', 'reset'] as const) {
        const preview = deferred<string>();
        const fixture = createDialogFixture('First', {
            onParsePreview: () => preview.promise,
        });
        disposeAfter.push(() => fixture.dispose());
        const opening = fixture.methods.openNavboxEdit({
            title: 'First template',
            status: 'OK',
            pendingEdit: { create: false, text: 'Reviewed source' },
        });
        if (end === 'dispose') fixture.dispose();
        else fixture.methods.clearForm();
        const snapshot = JSON.stringify(fixture.state.pageEditState);
        preview.resolve('Late preview');
        await opening;
        assert.equal(JSON.stringify(fixture.state.pageEditState), snapshot);
    }
});

test('page-preview failures ignore changed source while current failures remain visible', async (context) => {
    const { disposeAfter } = installWindow(context);
    for (const stage of ['open', 'refresh'] as const) {
        const preview = deferred<string>();
        let previews = 0;
        const fixture = createDialogFixture('First', {
            onParsePreview: () => {
                previews += 1;
                return stage === 'refresh' && previews === 1
                    ? Promise.resolve('Reviewed preview')
                    : preview.promise;
            },
        });
        disposeAfter.push(() => fixture.dispose());
        let pending = fixture.methods.openNavboxEdit({
            title: 'First template',
            status: 'OK',
            pendingEdit: { create: false, text: 'Reviewed source' },
        });
        if (stage === 'refresh') {
            await pending;
            pending = fixture.methods.refreshPageEditPreview();
        }
        fixture.state.pageEditState.text = 'Newer source';
        preview.reject(new Error('Older preview failed'));
        await pending;

        assert.equal(fixture.state.pageEditState.text, 'Newer source');
        assert.equal(fixture.state.pageEditState.error, '');
        assert.equal(fixture.state.pageEditState.loading, false);

        await fixture.methods.refreshPageEditPreview();
        assert.equal(fixture.state.pageEditState.error, 'Older preview failed');
    }
});

test('page-preview failure checks the current CodeMirror source before reporting an error', async (context) => {
    const { disposeAfter } = installWindow(context);
    const editors = installCodeMirror(context);
    const preview = deferred<string>();
    const fixture = createDialogFixture('First', {
        onParsePreview: () => preview.promise,
    });
    disposeAfter.push(() => fixture.dispose());
    fixture.state.pageEditTextArea.value = {
        tagName: 'TEXTAREA',
        value: '',
    };
    const opening = fixture.methods.openNavboxEdit({
        title: 'First template',
        status: 'OK',
        pendingEdit: { create: false, text: 'Reviewed source' },
    });
    await nextTurn();
    assert.equal(editors.length, 1);
    editors[0].value = 'Newer enhanced source';
    assert.equal(fixture.state.pageEditState.text, 'Reviewed source');
    preview.reject(new Error('Older preview failed'));
    await opening;

    assert.equal(fixture.state.pageEditState.text, 'Newer enhanced source');
    assert.equal(fixture.state.pageEditState.error, '');
    assert.equal(fixture.state.pageEditState.loading, false);

    await fixture.methods.refreshPageEditPreview();
    assert.equal(fixture.state.pageEditState.error, 'Older preview failed');
});
