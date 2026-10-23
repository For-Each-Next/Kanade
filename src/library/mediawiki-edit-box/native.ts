/**
 * @file src/library/mediawiki-edit-box/native.ts
 * Purpose: Apply accepted native-source edits and notify host form listeners.
 * Contents: Full writes, selection replacement, and input/change events.
 */

export function writeNative(element: HTMLTextAreaElement, text: string): void {
    element.value = text;
    dispatchValueEvents(element);
}

export function replaceNativeSelection(
    element: HTMLTextAreaElement,
    text: string,
): void {
    const from = element.selectionStart ?? element.value.length;
    const to = element.selectionEnd ?? from;
    const caret = from + text.length;
    element.value =
        element.value.slice(0, from) + text + element.value.slice(to);
    element.setSelectionRange(caret, caret);
    dispatchValueEvents(element);
}

export function dispatchValueEvents(element: HTMLElement): void {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
}
