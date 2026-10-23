/**
 * @file src/vg-stub-creator/features/creator/dialogs/main-dialog.ts
 * Purpose: Build-injected main VG Stub Creator dialog bundle.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Exports
 */

import type { VgStubCreatorDialogBundle } from './dialog-bundle.ts';

const mainDialog: VgStubCreatorDialogBundle = {
    styles:
        typeof __VG_STUB_CREATOR_MAIN_DIALOG_STYLES__ === 'undefined'
            ? ''
            : __VG_STUB_CREATOR_MAIN_DIALOG_STYLES__,
    template:
        typeof __VG_STUB_CREATOR_MAIN_DIALOG_TEMPLATE__ === 'undefined'
            ? ''
            : __VG_STUB_CREATOR_MAIN_DIALOG_TEMPLATE__,
};

export default mainDialog;
