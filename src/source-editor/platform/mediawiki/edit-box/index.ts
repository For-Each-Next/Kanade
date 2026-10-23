/**
 * @file src/source-editor/platform/mediawiki/edit-box/index.ts
 * Purpose: Extend shared MediaWiki editor access with position-preserving Source Editor writes.
 * Contents: Backend selection, common editor adapters, and position-preserving dispatch.
 */

import { getEditBoxBackend } from '../../editor-backend.ts';
import {
    createEditBox as createHostEditBox,
    getEditBox as getHostEditBox,
} from '../../../../library/mediawiki-edit-box/index.ts';
import { findCodeMirror } from '../../../../library/mediawiki-edit-box/code-mirror.ts';
import { getVisualEditorSurface } from '../../../../library/mediawiki-edit-box/visual-editor.ts';
import type { EditBox } from '../../../app/contracts/editor.ts';
import { writeCodeMirrorPreservingPosition } from './code-mirror.ts';
import { writeNativePreservingPosition } from './native.ts';
import { writeVisualEditorPreservingPosition } from './visual-editor.ts';

export type {
    CodeMirrorEditor,
    VisualEditorFragment,
    VisualEditorSurface,
} from '../../../../library/mediawiki-edit-box/contracts.ts';
export { registerEditBoxHooks } from '../../../../library/mediawiki-edit-box/index.ts';
export type { EditBox } from '../../../app/contracts/editor.ts';
export type { EditBoxBackend } from '../../../app/contracts/editor-backend.ts';

/** Gets the active editor using Source Editor's position-preserving backend contract. */
export function getEditBox(root: Document = document): EditBox | null {
    return getHostEditBox(root, getEditBoxBackend);
}

/** Resolves the active editor for every operation, including after host toggles. */
export function createEditBox(element: HTMLTextAreaElement | null): EditBox {
    return createHostEditBox(element, getEditBoxBackend);
}

/** Replaces editor text while retaining its selection and viewport. */
export function writePreservingPosition(editor: EditBox, text: string): void {
    const backend = getEditBoxBackend(editor.element);
    if (backend != null) {
        backend.writePreservingPosition(text);
        return;
    }
    const codeMirror = findCodeMirror(editor.element);
    if (codeMirror != null) {
        writeCodeMirrorPreservingPosition(codeMirror, text);
        return;
    }
    const surface = getVisualEditorSurface();
    if (surface != null) {
        writeVisualEditorPreservingPosition(surface, text);
        return;
    }
    if (editor.element != null) {
        writeNativePreservingPosition(editor.element, text);
        return;
    }
    editor.write(text);
}
