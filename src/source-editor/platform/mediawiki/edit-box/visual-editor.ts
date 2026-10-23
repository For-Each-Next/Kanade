/**
 * @file src/source-editor/platform/mediawiki/edit-box/visual-editor.ts
 * Purpose: Preserve Source Editor selection and viewport in VisualEditor source mode.
 * Contents: Source-offset conversion and selection/scroll restoration.
 */

import type {
    VisualEditorScrollContainer,
    VisualEditorSurface,
} from '../../../../library/mediawiki-edit-box/contracts.ts';
import { writeVisualEditor } from '../../../../library/mediawiki-edit-box/visual-editor.ts';
import { clampEditBoxOffset } from './native.ts';

export function writeVisualEditorPreservingPosition(
    surface: VisualEditorSurface,
    text: string,
): void {
    const model = surface.getModel();
    const selection = model.getFragment().getSelection?.().getRange();
    const sourceSelection = getSourceSelection(surface, selection);
    const scrollContainer = surface.getView().getSurface?.().$scrollContainer;
    const scrollLeft = scrollContainer?.scrollLeft();
    const scrollTop = scrollContainer?.scrollTop();

    writeVisualEditor(surface, text);
    restoreVisualEditorSelection(surface, sourceSelection, text);
    restoreVisualEditorScroll(scrollContainer, scrollLeft, scrollTop);
}

function getSourceSelection(
    surface: VisualEditorSurface,
    selection: { end: number; start: number } | undefined,
): { end: number; start: number } | null {
    if (selection == null) {
        return null;
    }
    const model = surface.getModel();
    return {
        end: model.getSourceOffsetFromOffset(selection.end),
        start: model.getSourceOffsetFromOffset(selection.start),
    };
}

function restoreVisualEditorSelection(
    surface: VisualEditorSurface,
    selection: { end: number; start: number } | null,
    text: string,
): void {
    if (selection == null) {
        return;
    }
    const model = surface.getModel();
    const range = model.getRangeFromSourceOffsets(
        clampEditBoxOffset(selection.start, text),
        clampEditBoxOffset(selection.end, text),
    );
    model.getLinearFragment(range, true).select();
}

function restoreVisualEditorScroll(
    container: VisualEditorScrollContainer | undefined,
    scrollLeft: number | undefined,
    scrollTop: number | undefined,
): void {
    if (container == null || scrollLeft == null || scrollTop == null) {
        return;
    }
    container.scrollLeft(scrollLeft);
    container.scrollTop(scrollTop);
}
