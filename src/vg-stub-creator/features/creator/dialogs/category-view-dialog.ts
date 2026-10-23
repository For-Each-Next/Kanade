/**
 * @file src/vg-stub-creator/features/creator/dialogs/category-view-dialog.ts
 * Purpose: Build-injected category-page viewer dialog bundle.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Exports
 */

import type { VgStubCreatorDialogBundle } from './dialog-bundle.ts';

const categoryViewDialog: VgStubCreatorDialogBundle = {
    styles:
        typeof __VG_STUB_CREATOR_CATEGORY_VIEW_DIALOG_STYLES__ === 'undefined'
            ? ''
            : __VG_STUB_CREATOR_CATEGORY_VIEW_DIALOG_STYLES__,
    template:
        typeof __VG_STUB_CREATOR_CATEGORY_VIEW_DIALOG_TEMPLATE__ === 'undefined'
            ? ''
            : __VG_STUB_CREATOR_CATEGORY_VIEW_DIALOG_TEMPLATE__,
};

export default categoryViewDialog;
