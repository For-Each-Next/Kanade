/**
 * @file tests/library/mediawiki-edit-box.test.ts
 * Purpose: Verify common MediaWiki editor dispatch without live source edits.
 * Contents: Native source events, selection replacement, backends, and host lifecycle.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createEditBox,
    getEditBox,
    registerEditBoxHooks,
} from '../../src/library/mediawiki-edit-box/index.ts';
import type { CodeMirrorEditor } from '../../src/library/mediawiki-edit-box/contracts.ts';

const testNativeTextareaBackend = () => {
    const events: string[] = [];
    let focused = false;
    function focus(): void {
        focused = true;
    }
    const eventTarget = new EventTarget();
    const textarea = Object.assign(eventTarget, {
        focus,
        value: 'before',
    }) as unknown as HTMLTextAreaElement;
    const recordEvent = (event: Event) => events.push(event.type);
    textarea.addEventListener('input', recordEvent);
    textarea.addEventListener('change', recordEvent);

    const editor = createEditBox(textarea);
    const initialText = editor.read();
    assert.equal(initialText, 'before');

    editor.write('after');
    editor.focus();

    assert.equal(textarea.value, 'after');
    assert.deepEqual(events, ['input', 'change']);
    assert.equal(focused, true);
};
test('reads and writes a native source textarea', testNativeTextareaBackend);

test('replaces selected and collapsed native textarea ranges', () => {
    const events: string[] = [];
    const textarea = new EventTarget() as HTMLTextAreaElement;
    textarea.value = 'before';
    textarea.selectionStart = 1;
    textarea.selectionEnd = 4;
    textarea.setSelectionRange = (start: number, end: number) => {
        textarea.selectionStart = start;
        textarea.selectionEnd = end;
    };
    textarea.addEventListener('input', (event) => events.push(event.type));
    textarea.addEventListener('change', (event) => events.push(event.type));

    const editor = createEditBox(textarea);
    editor.replaceSelection('X');

    assert.equal(textarea.value, 'bXre');
    assert.equal(textarea.selectionStart, 2);
    assert.equal(textarea.selectionEnd, 2);

    editor.replaceSelection('!');

    assert.equal(textarea.value, 'bX!re');
    assert.equal(textarea.selectionStart, 3);
    assert.equal(textarea.selectionEnd, 3);
    assert.deepEqual(events, ['input', 'change', 'input', 'change']);
});

test('reads and updates the enhanced editor through its backing textarea', () => {
    const calls: string[] = [];
    const textarea = new EventTarget() as HTMLTextAreaElement;
    textarea.value = 'native text';
    const key = Symbol.for('mediawiki-gadgets.edit-box-backend');
    const target = textarea as unknown as Record<PropertyKey, unknown>;
    let current = 'current enhanced source';
    target[key] = {
        read: () => current,
        write(text: string) {
            current = text;
            textarea.value = text;
        },
        replaceSelection(text: string) {
            calls.push(text);
        },
        focus() {
            calls.push('focus');
        },
    };
    const root = { querySelector: () => textarea } as unknown as Document;
    const editor = getEditBox(root)!;
    assert.equal(editor.read(), current);
    editor.write('reviewed source');
    editor.replaceSelection('citation');
    editor.focus();
    assert.equal(current, 'reviewed source');
    assert.equal(textarea.value, current);
    assert.deepEqual(calls, ['citation', 'focus']);
    delete target[key];
    textarea.value = 'restored native editor';
    assert.equal(editor.read(), textarea.value);
});

test('CodeMirror toggles and destruction select the live editor for each operation', (t) => {
    const hooks = new Map<string, (...args: unknown[]) => void>();
    const registered: string[] = [];
    (globalThis as { mw?: unknown }).mw = {
        hook(name: string) {
            return {
                add(callback: (...args: unknown[]) => void) {
                    registered.push(name);
                    hooks.set(name, callback);
                },
            };
        },
    };
    t.after(() => delete (globalThis as { mw?: unknown }).mw);
    registerEditBoxHooks();
    registerEditBoxHooks();
    assert.deepEqual(registered, [
        'ext.CodeMirror.ready',
        'ext.CodeMirror.toggle',
        'ext.CodeMirror.destroy',
    ]);
    const textarea = { value: 'native source' } as HTMLTextAreaElement;
    const unrelated = { value: 'other source' } as HTMLTextAreaElement;
    const transactions: unknown[] = [];
    let text = 'CodeMirror source';
    let focused = false;
    const codeMirror: CodeMirrorEditor = {
        textarea,
        view: {
            state: {
                doc: {
                    get length() {
                        return text.length;
                    },
                    toString: () => text,
                },
                selection: { main: { from: 4, to: 10 } },
            },
            dispatch(transaction) {
                transactions.push(transaction);
                const { from, insert, to } = transaction.changes;
                text = text.slice(0, from) + insert + text.slice(to);
            },
            focus: () => {
                focused = true;
            },
        },
    };
    hooks.get('ext.CodeMirror.ready')!(codeMirror);
    const editor = createEditBox(textarea);
    assert.equal(editor.read(), 'CodeMirror source');
    assert.equal(createEditBox(unrelated).read(), 'other source');
    editor.replaceSelection('Wiki');
    assert.equal(editor.read(), 'CodeWiki source');
    assert.deepEqual(transactions[0], {
        changes: { from: 4, insert: 'Wiki', to: 10 },
        scrollIntoView: true,
        selection: { anchor: 8 },
    });
    editor.write('reviewed source');
    assert.equal(editor.read(), 'reviewed source');
    editor.focus();
    assert.equal(focused, true);
    hooks.get('ext.CodeMirror.toggle')!(false, codeMirror);
    assert.equal(editor.read(), 'native source');
    hooks.get('ext.CodeMirror.toggle')!(true, codeMirror);
    assert.equal(editor.read(), 'reviewed source');
    hooks.get('ext.CodeMirror.destroy')!(unrelated);
    assert.equal(editor.read(), 'reviewed source');
    hooks.get('ext.CodeMirror.destroy')!(textarea);
    assert.equal(editor.read(), 'native source');
});
