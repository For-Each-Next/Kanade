/**
 * @file src/vg-stub-creator/features/creator/form/source-editor.ts
 * Purpose: Adapts Codex textareas and MediaWiki CodeMirror instances.
 *
 * Table of contents:
 * 1. SourceEditor
 * 2. getCodeMirrorLoader
 * 3. findTextareaElement
 * 4. getCodeMirrorText
 * 5. setCodeMirrorText
 * 6. SourceEditorManagerOptions
 * 7. TextBinding
 * 8. createSourceEditorManager
 */

export interface SourceEditor {
    initialize(): void;
    destroy(): void;
    view?: {
        state: { doc: { length: number; toString(): string } };
        dispatch(transaction: {
            changes: { from: number; to: number; insert: string };
        }): void;
    };
}

/**
 * Gets the MediaWiki ResourceLoader object when it can load CodeMirror.
 *
 * @returns ResourceLoader object.
 */
export function getCodeMirrorLoader(): any | undefined {
    if (typeof mw === 'undefined' || typeof mw.loader?.using !== 'function') {
        return undefined;
    }

    return mw.loader;
}

/**
 * Finds the native textarea for a Codex TextArea ref.
 *
 * @param element - Vue template ref value.
 * @returns Textarea element.
 */
function findTextareaElement(element: any): HTMLTextAreaElement | undefined {
    if (element == null) {
        return undefined;
    }

    if (element.tagName === 'TEXTAREA') {
        return element;
    }

    if (element.$el != null) {
        return findTextareaElement(element.$el);
    }

    if (typeof element.querySelector === 'function') {
        return element.querySelector('textarea') || undefined;
    }

    return undefined;
}

/**
 * Reads text from a CodeMirror wrapper or its backing textarea.
 *
 * @param editor - CodeMirror editor instance.
 * @param textarea - Backing textarea.
 * @returns Current source text.
 */
export function getCodeMirrorText(
    editor: SourceEditor,
    textarea: HTMLTextAreaElement,
): string {
    if (editor.view?.state?.doc != null) {
        return String(editor.view.state.doc);
    }

    return textarea.value;
}

/**
 * Writes text to a CodeMirror wrapper or its backing textarea.
 *
 * @param editor - CodeMirror editor instance.
 * @param textarea - Backing textarea.
 * @param text - Source text.
 */
export function setCodeMirrorText(
    editor: SourceEditor,
    textarea: HTMLTextAreaElement,
    text: string,
): void {
    const view = editor.view;
    const doc = view?.state?.doc;

    if (typeof view?.dispatch === 'function' && doc != null) {
        view.dispatch({
            changes: {
                from: 0,
                insert: text,
                to: doc.length,
            },
        });
        return;
    }

    textarea.value = text;
}

/** Resources and state owned by one dialog's source editors. */
export interface SourceEditorManagerOptions {
    nextTick(callback: () => void): unknown;
    isOpen(key: string): boolean;
    load():
        | Promise<{
              (
                  module: 'ext.CodeMirror',
              ): new (
                  textarea: HTMLTextAreaElement,
                  mode: unknown,
              ) => SourceEditor;
              (module: 'ext.CodeMirror.mode.mediawiki'): () => unknown;
          }>
        | undefined;
}

type TextBinding = { value: string };

/** Owns CodeMirror loads and releases them when a dialog closes or is disposed. */
export function createSourceEditorManager(options: SourceEditorManagerOptions) {
    const editors = new Map<
        string,
        {
            editor: SourceEditor;
            textarea: HTMLTextAreaElement;
            text: TextBinding;
        }
    >();
    const loads = new Map<string, object>();
    let disposed = false;

    function sync(key: string, text?: TextBinding): void {
        const state = editors.get(key);
        if (state)
            (text ?? state.text).value = getCodeMirrorText(
                state.editor,
                state.textarea,
            );
    }

    function destroy(key: string): void {
        loads.delete(key);
        const state = editors.get(key);
        if (!state) return;
        sync(key);
        editors.delete(key);
        state.editor.destroy();
    }

    async function initialize(
        key: string,
        textareaRef: { value: unknown },
        text: TextBinding,
    ): Promise<void> {
        const textarea = findTextareaElement(textareaRef.value);
        if (
            disposed ||
            !options.isOpen(key) ||
            !textarea ||
            editors.has(key) ||
            loads.has(key)
        )
            return;
        textarea.value = text.value;
        const request = {};
        loads.set(key, request);
        const isCurrent = () =>
            !disposed &&
            loads.get(key) === request &&
            options.isOpen(key) &&
            findTextareaElement(textareaRef.value) === textarea;
        let editor: SourceEditor | undefined;
        try {
            const require = await options.load();
            if (!require || !isCurrent()) return;
            const CodeMirror = require('ext.CodeMirror');
            editor = new CodeMirror(
                textarea,
                require('ext.CodeMirror.mode.mediawiki')(),
            );
            if (!isCurrent()) {
                editor.destroy();
                return;
            }
            editor.initialize();
            if (!isCurrent()) {
                editor.destroy();
                return;
            }
            editors.set(key, { editor, textarea, text });
        } catch {
            editor?.destroy();
        } finally {
            if (loads.get(key) === request) loads.delete(key);
        }
    }

    return {
        queue(
            key: string,
            textarea: { value: unknown },
            text: TextBinding,
        ): void {
            options.nextTick(() => {
                void initialize(key, textarea, text);
            });
        },
        sync,
        setText(key: string, text: string): void {
            const state = editors.get(key);
            if (state) setCodeMirrorText(state.editor, state.textarea, text);
        },
        destroy,
        dispose(): void {
            disposed = true;
            loads.clear();
            for (const key of editors.keys()) destroy(key);
        },
    };
}
