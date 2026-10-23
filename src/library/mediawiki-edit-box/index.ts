/**
 * @file src/library/mediawiki-edit-box/index.ts
 * Purpose: Reads and updates the host wiki's active source editor.
 * Contents: Editor discovery, source changes, selection, and focus.
 */

import {
    findCodeMirror,
    focusCodeMirror,
    readCodeMirror,
    registerCodeMirrorHooks,
    replaceCodeMirrorSelection,
    writeCodeMirror,
} from './code-mirror.ts';
import type { EditBox, EditBoxBackend } from './contracts.ts';
import { replaceNativeSelection, writeNative } from './native.ts';
import { getVisualEditorSurface, writeVisualEditor } from './visual-editor.ts';

export type { EditBox } from './contracts.ts';

const EDIT_BOX_SELECTOR = '#wpTextbox1';
const EDIT_BOX_BACKEND_KEY = Symbol.for('mediawiki-gadgets.edit-box-backend');

/** Starts tracking MediaWiki CodeMirror instances. */
export function registerEditBoxHooks(): void {
    registerCodeMirrorHooks();
}

/** Gets an adapter for the page's active source editor. */
export function getEditBox(
    root: Document = document,
    readBackend: typeof getEditBoxBackend = getEditBoxBackend,
): EditBox | null {
    registerEditBoxHooks();
    const element = root.querySelector<HTMLTextAreaElement>(EDIT_BOX_SELECTOR);
    const surface = getVisualEditorSurface();
    if (element == null && surface == null) {
        return null;
    }
    return createEditBox(element, readBackend);
}

/** Creates an adapter that resolves the editor for each operation. */
export function createEditBox(
    element: HTMLTextAreaElement | null,
    readBackend: typeof getEditBoxBackend = getEditBoxBackend,
): EditBox {
    return {
        element,
        focus(): void {
            const backend = readBackend(element);
            if (backend != null) {
                backend.focus();
                return;
            }
            const codeMirror = findCodeMirror(element);
            if (codeMirror != null) {
                focusCodeMirror(codeMirror);
                return;
            }
            const surface = getVisualEditorSurface();
            if (surface != null) {
                surface.getView().focus();
                return;
            }
            element?.focus();
        },

        read(): string {
            const backend = readBackend(element);
            if (backend != null) {
                return backend.read();
            }
            const codeMirror = findCodeMirror(element);
            if (codeMirror != null) {
                return readCodeMirror(codeMirror);
            }
            const surface = getVisualEditorSurface();
            if (surface != null) {
                return String(surface.getDom());
            }
            return element?.value ?? '';
        },

        replaceSelection(text: string): void {
            const backend = readBackend(element);
            if (backend != null) {
                backend.replaceSelection(text);
                return;
            }
            const codeMirror = findCodeMirror(element);
            if (codeMirror != null) {
                replaceCodeMirrorSelection(codeMirror, text);
                return;
            }
            const surface = getVisualEditorSurface();
            if (surface != null) {
                replaceVisualEditorSelection(surface, text);
                return;
            }
            if (element != null) {
                replaceNativeSelection(element, text);
            }
        },

        write(text: string): void {
            const backend = readBackend(element);
            if (backend != null) {
                backend.write(text);
                return;
            }
            const codeMirror = findCodeMirror(element);
            if (codeMirror != null) {
                writeCodeMirror(codeMirror, text);
                return;
            }
            const surface = getVisualEditorSurface();
            if (surface != null) {
                writeVisualEditor(surface, text);
                return;
            }
            if (element != null) {
                writeNative(element, text);
            }
        },
    };
}

/** Reads the current MediaWiki source text. */
export function readEditBox(): string {
    return getEditBox()?.read() ?? '';
}

function replaceVisualEditorSelection(
    surface: NonNullable<ReturnType<typeof getVisualEditorSurface>>,
    text: string,
): void {
    surface
        .getModel()
        .getFragment()
        .insertContent(text)
        .collapseToEnd()
        .select();
}

function getEditBoxBackend(
    element: HTMLTextAreaElement | null,
): EditBoxBackend | null {
    if (element == null) {
        return null;
    }
    const target = element as unknown as Record<PropertyKey, unknown>;
    const backend = target[EDIT_BOX_BACKEND_KEY];
    return isEditBoxBackend(backend) ? backend : null;
}

function isEditBoxBackend(value: unknown): value is EditBoxBackend {
    return (
        typeof value === 'object' &&
        value != null &&
        'focus' in value &&
        typeof value.focus === 'function' &&
        'read' in value &&
        typeof value.read === 'function' &&
        'replaceSelection' in value &&
        typeof value.replaceSelection === 'function' &&
        'write' in value &&
        typeof value.write === 'function'
    );
}
