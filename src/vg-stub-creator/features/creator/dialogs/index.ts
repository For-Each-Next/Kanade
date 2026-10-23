/**
 * @file src/vg-stub-creator/features/creator/dialogs/index.ts
 * Purpose: Assembles VG Stub Creator dialogs in one shared setup scope.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 */

import categoryViewDialog from './category-view-dialog.ts';
import {
    assembleVgStubCreatorDialogs,
    type VgStubCreatorDialogBundle,
} from './dialog-bundle.ts';
import historyDialog from './history-dialog.ts';
import historyJsonDialog from './history-json-dialog.ts';
import mainDialog from './main-dialog.ts';
import moveDialog from './move-dialog.ts';
import pageEditDialog from './page-edit-dialog.ts';
import preSaveDialog from './pre-save-dialog.ts';
import previewDialog from './preview-dialog.ts';

const dialogs: readonly VgStubCreatorDialogBundle[] = [
    mainDialog,
    preSaveDialog,
    categoryViewDialog,
    pageEditDialog,
    moveDialog,
    previewDialog,
    historyDialog,
    historyJsonDialog,
];
const sharedStyles =
    typeof __VG_STUB_CREATOR_SHARED_DIALOG_STYLES__ === 'undefined'
        ? ''
        : __VG_STUB_CREATOR_SHARED_DIALOG_STYLES__;
const dialogApplication = assembleVgStubCreatorDialogs(dialogs, sharedStyles);

export const VG_STUB_CREATOR_DIALOG_STYLES = dialogApplication.styles;
export const VG_STUB_CREATOR_DIALOG_TEMPLATE = dialogApplication.template;
