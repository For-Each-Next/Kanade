/**
 * @file src/library/mediawiki-edit-box/code-mirror.ts
 * Purpose: MediaWiki CodeMirror 6 discovery and editing operations.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. registerCodeMirrorHooks
 * 4. findCodeMirror
 * 5. readCodeMirror
 * 6. writeCodeMirror
 * 7. replaceCodeMirrorSelection
 * 8. focusCodeMirror
 * 9. trackCodeMirror
 * 10. trackCodeMirrorToggle
 * 11. removeCodeMirrorForTextarea
 * 12. isCodeMirrorTarget
 * 13. isCodeMirrorUsable
 */

import type { CodeMirrorEditor } from './contracts.ts';

import { getVisualEditorSurface } from './visual-editor.ts';

const codeMirrorEditors = new Set<CodeMirrorEditor>();
let hooksRegistered = false;

export function registerCodeMirrorHooks(): void {
    if (hooksRegistered || typeof mw === 'undefined') {
        return;
    }
    hooksRegistered = true;
    mw.hook('ext.CodeMirror.ready').add(trackCodeMirror);
    mw.hook('ext.CodeMirror.toggle').add(trackCodeMirrorToggle);
    mw.hook('ext.CodeMirror.destroy').add(removeCodeMirrorForTextarea);
}

export function findCodeMirror(
    element: HTMLTextAreaElement | null,
): CodeMirrorEditor | null {
    const surface = getVisualEditorSurface();
    for (const editor of codeMirrorEditors) {
        if (
            isCodeMirrorTarget(editor, element, surface) &&
            isCodeMirrorUsable(editor)
        ) {
            return editor;
        }
    }
    return null;
}

export function readCodeMirror(editor: CodeMirrorEditor): string {
    return editor.view?.state?.doc?.toString() ?? '';
}

export function writeCodeMirror(editor: CodeMirrorEditor, text: string): void {
    const view = editor.view;
    const doc = view?.state?.doc;
    if (typeof view?.dispatch !== 'function' || doc == null) {
        throw new Error('The active CodeMirror document is unavailable.');
    }
    view.dispatch({
        changes: { from: 0, insert: text, to: doc.length },
    });
}

export function replaceCodeMirrorSelection(
    editor: CodeMirrorEditor,
    text: string,
): void {
    const view = editor.view;
    const doc = view?.state?.doc;
    if (typeof view?.dispatch !== 'function' || doc == null) {
        throw new Error('The active CodeMirror document is unavailable.');
    }
    const selection = view.state?.selection?.main;
    const from = selection?.from ?? doc.length;
    const to = selection?.to ?? from;
    view.dispatch({
        changes: { from, insert: text, to },
        scrollIntoView: true,
        selection: { anchor: from + text.length },
    });
}

export function focusCodeMirror(editor: CodeMirrorEditor): void {
    if (typeof editor.focus === 'function') {
        editor.focus();
        return;
    }
    editor.view?.focus?.();
}

function trackCodeMirror(editor: CodeMirrorEditor): void {
    codeMirrorEditors.add(editor);
}

function trackCodeMirrorToggle(
    enabled: boolean,
    editor: CodeMirrorEditor,
): void {
    if (enabled) {
        codeMirrorEditors.add(editor);
        return;
    }
    codeMirrorEditors.delete(editor);
}

function removeCodeMirrorForTextarea(textarea: HTMLTextAreaElement): void {
    for (const editor of codeMirrorEditors) {
        if (editor.textarea === textarea) {
            codeMirrorEditors.delete(editor);
        }
    }
}

function isCodeMirrorTarget(
    editor: CodeMirrorEditor,
    element: HTMLTextAreaElement | null,
    surface: ReturnType<typeof getVisualEditorSurface>,
): boolean {
    const matchesTextarea = Boolean(element) && editor.textarea === element;
    const matchesSurface = Boolean(surface) && editor.surface === surface;
    return matchesTextarea || matchesSurface;
}

function isCodeMirrorUsable(editor: CodeMirrorEditor): boolean {
    return (editor.isActive ?? true) && Boolean(editor.view);
}
