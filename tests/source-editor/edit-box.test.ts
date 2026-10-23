/**
 * @file tests/source-editor/edit-box.test.ts
 * Purpose: Verify Source Editor's position-preserving MediaWiki edit-box extensions.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 * 4. CodeMirrorTransaction
 * 5. CodeMirrorFixtureState
 * 6. VisualEditorFixtureState
 * 7. createCodeMirrorFixture
 * 8. createCodeMirrorView
 * 9. applyCodeMirrorTransaction
 * 10. createVisualEditorFixture
 * 11. createVisualEditorModel
 * 12. createVisualEditorView
 * 13. createVisualEditorFragments
 * 14. createRootVisualEditorFragment
 * 15. createCurrentVisualEditorFragment
 * 16. createRestoredVisualEditorFragment
 * 17. installMediaWikiHookMock
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import * as editBox from '../../src/source-editor/platform/mediawiki/edit-box/index.ts';

const { createEditBox, registerEditBoxHooks, writePreservingPosition } =
    editBox;

test('Source Editor ignores a backend without position-preserving writes', () => {
    const textarea = { value: 'native source' } as HTMLTextAreaElement;
    const key = Symbol.for('mediawiki-gadgets.edit-box-backend');
    (textarea as unknown as Record<PropertyKey, unknown>)[key] = {
        focus() {},
        read: () => 'unsupported backend source',
        write() {},
        replaceSelection() {},
    };
    assert.equal(createEditBox(textarea).read(), 'native source');
});

test('preserves native selection and viewport during a full write', () => {
    const events: string[] = [];
    const textarea = new EventTarget() as HTMLTextAreaElement;
    textarea.value = 'before source';
    textarea.selectionStart = 4;
    textarea.selectionEnd = 12;
    textarea.selectionDirection = 'backward';
    textarea.scrollLeft = 7;
    textarea.scrollTop = 180;
    textarea.setSelectionRange = (start, end, direction) => {
        textarea.selectionStart = start ?? 0;
        textarea.selectionEnd = end ?? textarea.selectionStart;
        textarea.selectionDirection = direction ?? 'none';
    };
    textarea.addEventListener('input', (event) => events.push(event.type));
    textarea.addEventListener('change', (event) => events.push(event.type));

    const editor = createEditBox(textarea);
    writePreservingPosition(editor, 'short');

    assert.equal(textarea.value, 'short');
    assert.equal(textarea.selectionStart, 4);
    assert.equal(textarea.selectionEnd, 5);
    assert.equal(textarea.selectionDirection, 'backward');
    assert.equal(textarea.scrollLeft, 7);
    assert.equal(textarea.scrollTop, 180);
    assert.deepEqual(events, ['input', 'change']);
});

test('uses a registered enhanced editor backend', () => {
    const calls: string[] = [];
    const textarea = { value: 'native source' } as HTMLTextAreaElement;
    const backend: editBox.EditBoxBackend = {
        focus() {
            calls.push('focus');
        },
        read() {
            calls.push('read');
            return 'enhanced source';
        },
        replaceSelection(value) {
            calls.push(`replace:${value}`);
        },
        write(value) {
            calls.push(`write:${value}`);
        },
        writePreservingPosition(value) {
            calls.push(`preserve:${value}`);
        },
    };
    const backendKey = Symbol.for('mediawiki-gadgets.edit-box-backend');
    const target = textarea as unknown as Record<PropertyKey, unknown>;
    target[backendKey] = backend;
    const editor = createEditBox(textarea);

    assert.equal(editor.read(), 'enhanced source');
    editor.replaceSelection('citation');
    editor.write('updated');
    writePreservingPosition(editor, 'formatted');
    editor.focus();

    assert.deepEqual(calls, [
        'read',
        'replace:citation',
        'write:updated',
        'preserve:formatted',
        'focus',
    ]);

    delete target[backendKey];
    assert.equal(editor.read(), 'native source');
});

const testCodeMirrorBackend = () => {
    const hooks = installMediaWikiHookMock();
    registerEditBoxHooks();
    const textarea = { value: 'stale' } as HTMLTextAreaElement;
    const fixture = createCodeMirrorFixture(textarea);
    const { codeMirror, scrollDOM, state } = fixture;
    hooks.get('ext.CodeMirror.ready')?.(codeMirror);

    const editor = createEditBox(textarea);
    const initialText = editor.read();
    assert.equal(initialText, 'CodeMirror source');
    editor.replaceSelection('Wiki');

    assert.equal(editor.read(), 'CodeWiki source');
    assert.deepEqual(state.transactions[0], {
        changes: { from: 4, insert: 'Wiki', to: 10 },
        scrollIntoView: true,
        selection: { anchor: 8 },
    });
    assert.deepEqual(state.selection, { from: 8, to: 8 });

    scrollDOM.scrollLeft = 9;
    scrollDOM.scrollTop = 220;
    writePreservingPosition(editor, 'updated source');
    editor.focus();

    const updatedText = editor.read();
    assert.equal(updatedText, 'updated source');
    assert.deepEqual(state.transactions[1], {
        changes: { from: 0, insert: 'updated source', to: 15 },
        selection: { anchor: 8, head: 8 },
    });
    assert.deepEqual(state.selection, { from: 8, to: 8 });
    assert.equal(scrollDOM.scrollLeft, 9);
    assert.equal(scrollDOM.scrollTop, 220);
    assert.equal(textarea.value, 'stale');
    assert.equal(state.focused, true);
    hooks.get('ext.CodeMirror.toggle')?.(false, codeMirror);
    delete (globalThis as { mw?: unknown }).mw;
};
test('uses an active CodeMirror document', testCodeMirrorBackend);

const testVisualEditorBackend = () => {
    const fixture = createVisualEditorFixture();
    const { state, surface } = fixture;
    class Range {
        public readonly end: number | undefined;
        public readonly start: number;

        public constructor(start: number, end?: number) {
            this.end = end;
            this.start = start;
        }
    }
    function getSurface(): editBox.VisualEditorSurface {
        return surface;
    }
    (globalThis as { ve?: unknown }).ve = {
        Range,
        init: { target: { active: true, getSurface } },
    };

    const editor = createEditBox(null);
    const initialText = editor.read();
    assert.equal(initialText, 'VisualEditor source');
    editor.replaceSelection('Wiki');

    assert.equal(editor.read(), 'VisualWiki source');
    assert.equal(state.currentFragmentCalls, 1);
    assert.equal(state.collapsedToEnd, 1);
    assert.equal(state.selected, 1);
    assert.equal(state.selectionStart, 10);
    assert.equal(state.selectionEnd, 10);

    writePreservingPosition(editor, 'updated source');
    editor.focus();

    const updatedText = editor.read();
    assert.equal(updatedText, 'updated source');
    assert.equal(state.rangeStart, 0);
    assert.equal(state.restoredSelectionStart, 10);
    assert.equal(state.restoredSelectionEnd, 10);
    assert.equal(state.scrollLeft, 13);
    assert.equal(state.scrollTop, 260);
    assert.equal(state.focused, true);
    delete (globalThis as { ve?: unknown }).ve;
};
test(
    "uses VisualEditor's active source surface without a textarea",
    testVisualEditorBackend,
);

interface CodeMirrorTransaction {
    changes: { from: number; insert: string; to: number };
    scrollIntoView?: boolean;
    selection?: { anchor: number; head?: number };
}

interface CodeMirrorFixtureState {
    focused: boolean;
    selection: { from: number; to: number };
    text: string;
    transactions: CodeMirrorTransaction[];
}

interface VisualEditorFixtureState {
    collapsedToEnd: number;
    currentFragmentCalls: number;
    focused: boolean;
    rangeStart: number;
    restoredSelectionEnd: number;
    restoredSelectionStart: number;
    scrollLeft: number;
    scrollTop: number;
    selected: number;
    selectionEnd: number;
    selectionStart: number;
    text: string;
}

/**
 * Creates a stateful CodeMirror test wrapper.
 *
 * @param textarea - Bound native textarea.
 * @returns CodeMirror wrapper and observable state.
 */
function createCodeMirrorFixture(textarea: HTMLTextAreaElement) {
    const state: CodeMirrorFixtureState = {
        focused: false,
        selection: { from: 4, to: 10 },
        text: 'CodeMirror source',
        transactions: [],
    };
    const scrollDOM = { scrollLeft: 0, scrollTop: 0 };
    const view = createCodeMirrorView(state, scrollDOM);
    const codeMirror: editBox.CodeMirrorEditor = {
        isActive: true,
        textarea,
        view,
    };
    return { codeMirror, scrollDOM, state };
}

function createCodeMirrorView(
    state: CodeMirrorFixtureState,
    scrollDOM: { scrollLeft: number; scrollTop: number },
): NonNullable<editBox.CodeMirrorEditor['view']> {
    const doc = {
        get length() {
            return state.text.length;
        },
        toString() {
            return state.text;
        },
    };
    return {
        dispatch(transaction: CodeMirrorTransaction) {
            applyCodeMirrorTransaction(state, transaction);
            scrollDOM.scrollLeft = 0;
            scrollDOM.scrollTop = 0;
        },
        focus() {
            state.focused = true;
        },
        state: {
            doc,
            selection: {
                get main() {
                    return state.selection;
                },
            },
        },
        scrollDOM,
    };
}

function applyCodeMirrorTransaction(
    state: CodeMirrorFixtureState,
    transaction: CodeMirrorTransaction,
): void {
    const { from, insert, to } = transaction.changes;
    state.transactions.push(transaction);
    state.text = state.text.slice(0, from) + insert + state.text.slice(to);
    if (transaction.selection != null) {
        state.selection = {
            from: transaction.selection.anchor,
            to: transaction.selection.head ?? transaction.selection.anchor,
        };
    }
}

/**
 * Creates a stateful VisualEditor source surface.
 *
 * @returns VisualEditor surface and observable state.
 */
function createVisualEditorFixture() {
    const state: VisualEditorFixtureState = {
        collapsedToEnd: 0,
        currentFragmentCalls: 0,
        focused: false,
        rangeStart: -1,
        restoredSelectionEnd: -1,
        restoredSelectionStart: -1,
        scrollLeft: 13,
        scrollTop: 260,
        selected: 0,
        selectionEnd: 12,
        selectionStart: 6,
        text: 'VisualEditor source',
    };
    const { currentFragment, rootFragment } =
        createVisualEditorFragments(state);
    const model = createVisualEditorModel(state, currentFragment, rootFragment);
    const view = createVisualEditorView(state);
    const surface: editBox.VisualEditorSurface = {
        getDom: () => state.text,
        getMode: () => 'source',
        getModel: () => model,
        getView: () => view,
    };
    return { state, surface };
}

function createVisualEditorModel(
    state: VisualEditorFixtureState,
    currentFragment: editBox.VisualEditorFragment,
    rootFragment: editBox.VisualEditorFragment,
) {
    function getLinearFragment(
        range: { end?: number; start: number },
        noAutoSelect: boolean,
    ): editBox.VisualEditorFragment {
        assert.equal(noAutoSelect, true);
        if (range.end != null) {
            return createRestoredVisualEditorFragment(state, range);
        }
        state.rangeStart = range.start;
        return rootFragment;
    }
    return {
        getFragment: () => currentFragment,
        getLinearFragment,
        getRangeFromSourceOffsets(start: number, end = start) {
            return { end, start };
        },
        getSourceOffsetFromOffset(offset: number) {
            return offset;
        },
    };
}

function createVisualEditorView(state: VisualEditorFixtureState) {
    function focus(): void {
        state.focused = true;
    }
    function scrollLeft(): number;
    function scrollLeft(value: number): void;
    function scrollLeft(value?: number): number | void {
        if (value == null) {
            return state.scrollLeft;
        }
        state.scrollLeft = value;
    }
    function scrollTop(): number;
    function scrollTop(value: number): void;
    function scrollTop(value?: number): number | void {
        if (value == null) {
            return state.scrollTop;
        }
        state.scrollTop = value;
    }
    return {
        focus,
        getSurface() {
            return { $scrollContainer: { scrollLeft, scrollTop } };
        },
    };
}

function createVisualEditorFragments(state: VisualEditorFixtureState) {
    return {
        currentFragment: createCurrentVisualEditorFragment(state),
        rootFragment: createRootVisualEditorFragment(state),
    };
}

function createRootVisualEditorFragment(
    state: VisualEditorFixtureState,
): editBox.VisualEditorFragment {
    return {
        collapseToEnd() {
            return this;
        },
        expandLinearSelection(scope: string) {
            assert.equal(scope, 'root');
            return this;
        },
        insertContent(value: string) {
            state.text = value;
            state.scrollLeft = 0;
            state.scrollTop = 0;
            return this;
        },
        select() {
            return this;
        },
    };
}

function createCurrentVisualEditorFragment(
    state: VisualEditorFixtureState,
): editBox.VisualEditorFragment {
    return {
        collapseToEnd() {
            state.collapsedToEnd += 1;
            return this;
        },
        expandLinearSelection() {
            throw new Error('The current fragment should not be expanded.');
        },
        getSelection() {
            return {
                getRange() {
                    return {
                        end: state.selectionEnd,
                        start: state.selectionStart,
                    };
                },
            };
        },
        insertContent(value: string) {
            state.currentFragmentCalls += 1;
            state.text =
                state.text.slice(0, state.selectionStart) +
                value +
                state.text.slice(state.selectionEnd);
            state.selectionStart += value.length;
            state.selectionEnd = state.selectionStart;
            return this;
        },
        select() {
            state.selected += 1;
            return this;
        },
    };
}

function createRestoredVisualEditorFragment(
    state: VisualEditorFixtureState,
    range: { end?: number; start: number },
): editBox.VisualEditorFragment {
    return {
        collapseToEnd() {
            return this;
        },
        expandLinearSelection() {
            throw new Error('A restored selection should not be expanded.');
        },
        insertContent() {
            throw new Error('A restored selection should not insert content.');
        },
        select() {
            state.restoredSelectionStart = range.start;
            state.restoredSelectionEnd = range.end ?? range.start;
            return this;
        },
    };
}

/**
 * Installs a minimal MediaWiki hook registry.
 *
 * @returns Hook callbacks keyed by hook name.
 */
function installMediaWikiHookMock(): Map<string, (...args: any[]) => void> {
    const hooks = new Map<string, (...args: any[]) => void>();
    function hook(name: string) {
        function add(callback: (...args: any[]) => void): void {
            hooks.set(name, callback);
        }
        return { add };
    }
    (globalThis as { mw?: unknown }).mw = { hook };
    return hooks;
}
