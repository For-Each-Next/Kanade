/**
 * @file src/source-editor/features/source-manager/dialogs.ts
 * Purpose: Assembles five dialogs in shared setup scope.
 *
 * Table of contents:
 * 1. Imports
 * 2. Exports
 * 3. Constants and state
 */

import closeConfirmationDialog from './dialogs/close-confirmation-dialog.ts';
import {
    assembleCitationDialogs,
    type CitationDialogBundle,
} from './dialogs/dialog-bundle.ts';
import draftDialog from './dialogs/draft-dialog.ts';
import mainDialog from './dialogs/main-dialog.ts';
import parameterAliasDialog from './dialogs/parameter-alias-dialog.ts';
import toolDialog from './dialogs/tool-dialog.ts';

export type {
    CloseDialogActions,
    CloseDialogContext,
} from './dialogs/close-confirmation-dialog.ts';
export type {
    DraftDialogActions,
    DraftDialogContext,
} from './dialogs/draft-dialog.ts';
export type {
    MainDialogActions,
    MainDialogContext,
    MainDialogTableSlotScope,
} from './dialogs/main-dialog.ts';
export type {
    ParameterAliasActions,
    ParameterAliasContext,
} from './dialogs/parameter-alias-dialog.ts';
export type {
    AnalysisReplacementActions,
    AnalysisToolActions,
    CheckerToolActions,
    ToolActions,
    ToolDialogActions,
    ToolDialogContext,
} from './dialogs/tool-dialog.ts';

const dialogs: readonly CitationDialogBundle[] = [
    mainDialog,
    draftDialog,
    parameterAliasDialog,
    toolDialog,
    closeConfirmationDialog,
];
const sourceManagerDialogs = assembleCitationDialogs(dialogs);

export const SOURCE_MANAGER_DIALOG_STYLES = sourceManagerDialogs.styles;
export const SOURCE_MANAGER_TEMPLATE = sourceManagerDialogs.template;
