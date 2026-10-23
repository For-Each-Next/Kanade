/**
 * @file src/vg-stub-creator/features/creator/dialogs/page-edit-dialog.ts
 * Purpose: Build-injected staged page editor dialog bundle.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Exports
 */

import type { VgStubCreatorDialogBundle } from './dialog-bundle.ts';

const pageEditDialog: VgStubCreatorDialogBundle = {
    styles:
        typeof __VG_STUB_CREATOR_PAGE_EDIT_DIALOG_STYLES__ === 'undefined'
            ? ''
            : __VG_STUB_CREATOR_PAGE_EDIT_DIALOG_STYLES__,
    template:
        typeof __VG_STUB_CREATOR_PAGE_EDIT_DIALOG_TEMPLATE__ === 'undefined'
            ? ''
            : __VG_STUB_CREATOR_PAGE_EDIT_DIALOG_TEMPLATE__,
};

export default pageEditDialog;
