/**
 * @file src/vg-stub-creator/features/creator/dialogs/preview-dialog.ts
 * Purpose: Build-injected article preview dialog bundle.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Exports
 */

import type { VgStubCreatorDialogBundle } from './dialog-bundle.ts';

const previewDialog: VgStubCreatorDialogBundle = {
    styles:
        typeof __VG_STUB_CREATOR_PREVIEW_DIALOG_STYLES__ === 'undefined'
            ? ''
            : __VG_STUB_CREATOR_PREVIEW_DIALOG_STYLES__,
    template:
        typeof __VG_STUB_CREATOR_PREVIEW_DIALOG_TEMPLATE__ === 'undefined'
            ? ''
            : __VG_STUB_CREATOR_PREVIEW_DIALOG_TEMPLATE__,
};

export default previewDialog;
