/**
 * @file src/source-editor/platform/mediawiki/edit-box/code-mirror.ts
 * Purpose: Preserve Source Editor selection and viewport when replacing CodeMirror source.
 * Contents: Position-preserving CodeMirror transactions.
 */

import type { CodeMirrorEditor } from '../../../../library/mediawiki-edit-box/contracts.ts';
import { clampEditBoxOffset, restoreDomScroll } from './native.ts';

export function writeCodeMirrorPreservingPosition(
    editor: CodeMirrorEditor,
    text: string,
): void {
    const view = editor.view;
    const doc = view?.state?.doc;
    if (typeof view?.dispatch !== 'function' || doc == null) {
        throw new Error('The active CodeMirror document is unavailable.');
    }
    const selection = view.state?.selection?.main;
    const anchor = selection?.anchor ?? selection?.from ?? 0;
    const head = selection?.head ?? selection?.to ?? anchor;
    const scrollLeft = view.scrollDOM?.scrollLeft;
    const scrollTop = view.scrollDOM?.scrollTop;
    view.dispatch({
        changes: { from: 0, insert: text, to: doc.length },
        selection: {
            anchor: clampEditBoxOffset(anchor, text),
            head: clampEditBoxOffset(head, text),
        },
    });
    restoreDomScroll(view.scrollDOM, scrollLeft, scrollTop);
}
