/**
 * @file src/vg-stub-creator/platform/browser/editor.ts
 * Purpose: Writes generated content into the MediaWiki edit form.
 *
 * Table of contents:
 * 1. Imports
 * 2. writeEditText
 * 3. readEditText
 * 4. hasEditText
 * 5. shouldPreserveEditor
 * 6. writeEditSummary
 * 7. readEditSummary
 * 8. submitPreviewForm
 * 9. interceptEditSave
 */

import { dispatchValueEvents } from '../../../library/mediawiki-edit-box/native.ts';

import * as editBox from '../../../library/mediawiki-edit-box/index.ts';

/**
 * Replaces the MediaWiki edit textarea with generated wikitext.
 *
 * @param text - Generated article wikitext.
 * @returns Result when the function
 *   replaces the mediawiki edit textarea with
 *   generated wikitext.
 */
export function writeEditText(
    text: string,
    unavailableMessage: string = 'MediaWiki edit textbox is unavailable.',
): void {
    const editor = editBox.getEditBox();

    if (editor == null) {
        throw new Error(unavailableMessage);
    }

    editor.write(text);
    editor.focus();
}

/**
 * Reads the current MediaWiki edit textarea.
 *
 * @returns Current editor wikitext.
 */
export function readEditText(): string {
    return editBox.readEditBox();
}

/**
 * Checks whether the MediaWiki editor already contains wikitext.
 *
 * @returns Whether existing editor text should be preserved.
 */
function hasEditText(): boolean {
    return readEditText() !== '';
}

/**
 * Checks whether save should keep the current editor text and summary.
 *
 * @returns Whether existing editor values are authoritative.
 */
export function shouldPreserveEditor(): boolean {
    return document.getElementById('editform') != null && hasEditText();
}

/**
 * Replaces the MediaWiki edit summary.
 *
 * @param summary - Generated edit summary.
 * @returns Result when the function
 *   replaces the mediawiki edit summary.
 */
export function writeEditSummary(summary: string): void {
    const summaryInput = document.getElementById(
        'wpSummary',
    ) as HTMLInputElement | null;

    if (summaryInput == null) {
        return;
    }

    summaryInput.value = summary;
    dispatchValueEvents(summaryInput);
}

/**
 * Reads the current MediaWiki edit summary.
 *
 * @returns Current edit summary.
 */
export function readEditSummary(): string {
    const summaryInput = document.getElementById(
        'wpSummary',
    ) as HTMLInputElement | null;

    return summaryInput?.value || '';
}

/**
 * Submits the MediaWiki edit form through its preview button.
 *
 * @returns Result when the function
 *   submits the mediawiki edit form through its
 *   preview button.
 */
export function submitPreviewForm(
    unavailableMessage: string = 'MediaWiki preview form is unavailable.',
): void {
    const editForm = document.getElementById(
        'editform',
    ) as HTMLFormElement | null;
    const previewButton = document.getElementById('wpPreview');

    if (editForm == null || previewButton == null) {
        throw new Error(unavailableMessage);
    }

    editForm.requestSubmit(previewButton);
}

/**
 * Routes native MediaWiki save submissions through a review callback.
 *
 * @param onSubmit - Intercepted save callback.
 * @returns Listener removal callback.
 */
export function interceptEditSave(
    onSubmit: (...args: any[]) => any,
): (...args: any[]) => any {
    const editForm = document.getElementById('editform');

    if (editForm == null) {
        return function removeNoopListener() {};
    }

    const handleSubmit = function handleSubmit(event: Event) {
        const submitter = (event as SubmitEvent).submitter;
        const submitterId =
            submitter instanceof HTMLElement ? submitter.id : undefined;
        if (submitterId != null && submitterId !== 'wpSave') {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        onSubmit();
    };

    editForm.addEventListener('submit', handleSubmit, true);

    const result = function removeSaveListener() {
        editForm.removeEventListener('submit', handleSubmit, true);
    };
    return result;
}
