/**
 * @file src/vg-stub-creator/features/creator/dialogs/pre-save-dialog.ts
 * Purpose: Build-injected pre-save review dialog bundle.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Exports
 */

import type { VgStubCreatorDialogBundle } from './dialog-bundle.ts';

const preSaveDialog: VgStubCreatorDialogBundle = {
    styles:
        typeof __VG_STUB_CREATOR_PRE_SAVE_DIALOG_STYLES__ === 'undefined'
            ? ''
            : __VG_STUB_CREATOR_PRE_SAVE_DIALOG_STYLES__,
    template:
        typeof __VG_STUB_CREATOR_PRE_SAVE_DIALOG_TEMPLATE__ === 'undefined'
            ? ''
            : __VG_STUB_CREATOR_PRE_SAVE_DIALOG_TEMPLATE__,
};

export default preSaveDialog;
