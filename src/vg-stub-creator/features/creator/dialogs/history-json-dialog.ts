/**
 * @file src/vg-stub-creator/features/creator/dialogs/history-json-dialog.ts
 * Purpose: Build-injected history JSON editor dialog bundle.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Exports
 */

import type { VgStubCreatorDialogBundle } from './dialog-bundle.ts';

const historyJsonDialog: VgStubCreatorDialogBundle = {
    styles:
        typeof __VG_STUB_CREATOR_HISTORY_JSON_DIALOG_STYLES__ === 'undefined'
            ? ''
            : __VG_STUB_CREATOR_HISTORY_JSON_DIALOG_STYLES__,
    template:
        typeof __VG_STUB_CREATOR_HISTORY_JSON_DIALOG_TEMPLATE__ === 'undefined'
            ? ''
            : __VG_STUB_CREATOR_HISTORY_JSON_DIALOG_TEMPLATE__,
};

export default historyJsonDialog;
