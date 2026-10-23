/**
 * @file tests/vg-stub-creator/source-editor.test.ts
 * Purpose: Verifies isolated source-editor ownership, delayed loading, and teardown.
 *
 * Table of contents:
 * 1. Imports
 * 2. textarea
 * 3. deferred
 * 4. createRuntime
 * 5. flush
 * 6. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createSourceEditorManager,
    type SourceEditor,
} from '../../src/vg-stub-creator/features/creator/form/source-editor.ts';

function textarea(): HTMLTextAreaElement {
    return { tagName: 'TEXTAREA', value: '' } as HTMLTextAreaElement;
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((complete) => {
        resolve = complete;
    });
    return { promise, resolve };
}

function createRuntime(
    options: { failInitialize?: boolean; textareaOnly?: boolean } = {},
) {
    const instances: Editor[] = [];
    class Editor implements SourceEditor {
        initialized = 0;
        destroyed = 0;
        value: string;
        readonly textarea: HTMLTextAreaElement;
        view?: NonNullable<SourceEditor['view']>;

        constructor(textarea: HTMLTextAreaElement, _mode: unknown) {
            this.textarea = textarea;
            this.value = textarea.value;
            if (!options.textareaOnly) {
                const readText = () => this.value;
                this.view = {
                    state: {
                        doc: {
                            get length() {
                                return readText().length;
                            },
                            toString() {
                                return readText();
                            },
                        },
                    },
                    dispatch: ({ changes }) => {
                        this.value = changes.insert;
                    },
                };
            }
            instances.push(this);
        }

        initialize(): void {
            this.initialized += 1;
            if (options.failInitialize)
                throw new Error('Fixture initialization failure');
        }

        destroy(): void {
            this.destroyed += 1;
        }
    }

    function require(module: 'ext.CodeMirror'): typeof Editor;
    function require(module: 'ext.CodeMirror.mode.mediawiki'): () => unknown;
    function require(
        module: 'ext.CodeMirror' | 'ext.CodeMirror.mode.mediawiki',
    ): typeof Editor | (() => unknown) {
        return module === 'ext.CodeMirror' ? Editor : () => ({});
    }
    return { require, instances };
}

async function flush(): Promise<void> {
    await new Promise<void>((resolve) => setImmediate(resolve));
}

test('a delayed source-editor load cannot attach after disposal', async () => {
    const runtime = createRuntime();
    const loaded = deferred<typeof runtime.require>();
    const manager = createSourceEditorManager({
        nextTick: (callback) => callback(),
        isOpen: () => true,
        load: () => loaded.promise,
    });
    manager.queue('preview', { value: textarea() }, { value: 'Draft' });
    manager.dispose();
    loaded.resolve(runtime.require);
    await flush();
    assert.equal(runtime.instances.length, 0);
});

test('closing and reopening before loading keeps only the new textarea owner', async () => {
    const runtime = createRuntime();
    const first = deferred<typeof runtime.require>();
    const second = deferred<typeof runtime.require>();
    let requests = 0;
    let open = true;
    const manager = createSourceEditorManager({
        nextTick: (callback) => callback(),
        isOpen: () => open,
        load: () => (++requests === 1 ? first.promise : second.promise),
    });
    manager.queue('preview', { value: textarea() }, { value: 'Old draft' });
    open = false;
    manager.destroy('preview');
    open = true;
    const current = textarea();
    manager.queue('preview', { value: current }, { value: 'Current draft' });
    first.resolve(runtime.require);
    second.resolve(runtime.require);
    await flush();
    assert.equal(runtime.instances.length, 1);
    assert.equal(runtime.instances[0].textarea, current);
    assert.equal(runtime.instances[0].value, 'Current draft');
    manager.dispose();
    assert.equal(runtime.instances[0].destroyed, 1);
});

test('two managers keep their text and teardown independent', async () => {
    const runtime = createRuntime();
    const options = {
        nextTick: (callback: () => void) => callback(),
        isOpen: () => true,
        load: () => Promise.resolve(runtime.require),
    };
    const first = createSourceEditorManager(options);
    const second = createSourceEditorManager(options);
    const firstText = { value: 'First' };
    const secondText = { value: 'Second' };
    first.queue('preview', { value: textarea() }, firstText);
    second.queue('preview', { value: textarea() }, secondText);
    await flush();
    first.setText('preview', 'First edited');
    first.sync('preview');
    assert.equal(firstText.value, 'First edited');
    assert.equal(secondText.value, 'Second');
    first.dispose();
    assert.equal(runtime.instances[0].destroyed, 1);
    assert.equal(runtime.instances[1].destroyed, 0);
    runtime.instances[1].value = 'Second edited';
    second.destroy('preview');
    assert.equal(secondText.value, 'Second edited');
    assert.equal(runtime.instances[1].destroyed, 1);
    second.dispose();
    assert.equal(runtime.instances[1].destroyed, 1);
});

test('textarea-only editors preserve user input when synchronized and destroyed', async () => {
    const runtime = createRuntime({ textareaOnly: true });
    const manager = createSourceEditorManager({
        nextTick: (callback) => callback(),
        isOpen: () => true,
        load: () => Promise.resolve(runtime.require),
    });
    const control = textarea();
    const text = { value: 'Initial' };
    manager.queue('pageEdit', { value: { $el: control } }, text);
    await flush();
    manager.setText('pageEdit', 'Changed');
    assert.equal(control.value, 'Changed');
    control.value = 'User draft';
    manager.destroy('pageEdit');
    assert.equal(text.value, 'User draft');
    assert.equal(runtime.instances[0].destroyed, 1);
    manager.dispose();
});

test('failed enhancement retains the textarea and destroys partially initialized editors', async () => {
    const runtime = createRuntime({ failInitialize: true });
    const control = textarea();
    const manager = createSourceEditorManager({
        nextTick: (callback) => callback(),
        isOpen: () => true,
        load: () => Promise.resolve(runtime.require),
    });
    manager.queue('preview', { value: control }, { value: 'Retained draft' });
    await flush();
    assert.equal(control.value, 'Retained draft');
    assert.equal(runtime.instances[0].initialized, 1);
    assert.equal(runtime.instances[0].destroyed, 1);
    manager.dispose();
    assert.equal(runtime.instances[0].destroyed, 1);
});

test('unavailable CodeMirror leaves the backing textarea usable', async () => {
    const control = textarea();
    const manager = createSourceEditorManager({
        nextTick: (callback) => callback(),
        isOpen: () => true,
        load: () => undefined,
    });
    manager.queue('preview', { value: control }, { value: 'Plain text' });
    await flush();
    assert.equal(control.value, 'Plain text');
    manager.dispose();
});
