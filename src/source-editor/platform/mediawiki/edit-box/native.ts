/**
 * @file src/source-editor/platform/mediawiki/edit-box/native.ts
 * Purpose: Preserve Source Editor selection and viewport when replacing native source.
 * Contents: Position-preserving writes, scroll restoration, and offset clamping.
 */

import { dispatchValueEvents } from '../../../../library/mediawiki-edit-box/native.ts';

export function writeNativePreservingPosition(
    element: HTMLTextAreaElement,
    text: string,
): void {
    const selectionStart = element.selectionStart;
    const selectionEnd = element.selectionEnd;
    const selectionDirection = element.selectionDirection;
    const scrollLeft = element.scrollLeft;
    const scrollTop = element.scrollTop;

    element.value = text;
    element.setSelectionRange(
        clampEditBoxOffset(selectionStart, text),
        clampEditBoxOffset(selectionEnd, text),
        selectionDirection,
    );
    dispatchValueEvents(element);
    restoreDomScroll(element, scrollLeft, scrollTop);
}

export function restoreDomScroll(
    element:
        | {
              scrollLeft: number;
              scrollTop: number;
          }
        | undefined,
    scrollLeft: number | undefined,
    scrollTop: number | undefined,
): void {
    if (element == null || scrollLeft == null || scrollTop == null) {
        return;
    }
    element.scrollLeft = scrollLeft;
    element.scrollTop = scrollTop;
}

export function clampEditBoxOffset(offset: number, text: string): number {
    return Math.max(0, Math.min(offset, text.length));
}
