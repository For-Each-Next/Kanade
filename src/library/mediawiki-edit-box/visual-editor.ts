/**
 * @file src/library/mediawiki-edit-box/visual-editor.ts
 * Purpose: Discovers the host VisualEditor source surface.
 * Contents: VisualEditor instance and source-model discovery.
 */

import type { VisualEditorGlobal, VisualEditorSurface } from './contracts.ts';

export function getVisualEditorSurface(): VisualEditorSurface | null {
    const visualEditor = (
        globalThis as typeof globalThis & { ve?: VisualEditorGlobal }
    ).ve;
    const target = visualEditor?.init?.target;
    const surface = target?.getSurface?.() ?? null;

    if (target?.active !== true || surface?.getMode() !== 'source') {
        return null;
    }
    return surface;
}

export function writeVisualEditor(
    surface: VisualEditorSurface,
    text: string,
): void {
    const visualEditor = (
        globalThis as typeof globalThis & { ve?: VisualEditorGlobal }
    ).ve;
    const Range = visualEditor?.Range;
    if (Range == null) {
        throw new Error('The VisualEditor source range API is unavailable.');
    }
    const range = new Range(0);
    surface
        .getModel()
        .getLinearFragment(range, true)
        .expandLinearSelection('root')
        .insertContent(text);
}
