/**
 * @file src/source-editor/features/source-manager/dialogs/close-confirmation-dialog.ts
 * Purpose: Build-injected manager-close confirmation dialog bundle.
 *
 * Table of contents:
 * 1. Imports
 * 2. CloseDialogActions
 * 3. CloseDialogContext
 * 4. Constants and state
 * 5. Exports
 */

import type { SourceEditorI18n } from '../../../i18n/index.ts';

import type { CitationDialogBundle } from './dialog-bundle.ts';

export interface CloseDialogActions {
    cancelCloseConfirmation(): void;
    keepAnalysisChangesAndClose(): void;
    onCloseConfirmationOpenChange(open: boolean): void;
    undoAnalysisChangesAndClose(): void;
}

/**
 * Public bindings exposed to the build-injected confirmation template.
 */
export type CloseDialogContext = CloseDialogActions & {
    closeConfirmationOpen: boolean;
    interfaceLocale: string;
    msg: SourceEditorI18n['msg'];
};

const closeConfirmationDialog: CitationDialogBundle = {
    styles:
        typeof __SOURCE_EDITOR_REFERENCE_CLOSE_DIALOG_STYLES__ === 'undefined'
            ? ''
            : __SOURCE_EDITOR_REFERENCE_CLOSE_DIALOG_STYLES__,
    template:
        typeof __SOURCE_EDITOR_REFERENCE_CLOSE_DIALOG_TEMPLATE__ === 'undefined'
            ? ''
            : __SOURCE_EDITOR_REFERENCE_CLOSE_DIALOG_TEMPLATE__,
};

export default closeConfirmationDialog;
