/**
 * @file src/source-editor/features/source-manager/dialogs/draft-dialog.ts
 * Purpose: Build-injected citation draft dialog bundle.
 *
 * Table of contents:
 * 1. Imports
 * 2. CodexIcons
 * 3. DraftStateValue
 * 4. DraftDialogActions
 * 5. DraftDialogContext
 * 6. Constants and state
 * 7. Exports
 */

import type {
    CreatorAliasSuggestion,
    SourceDraftRow,
} from '../../../domain/source-manager.ts';
import type * as validation from '../../../domain/source-validation.ts';
import type { SourceEditorI18n } from '../../../i18n/index.ts';
import type * as options from '../template-options.ts';
import type { SourceManagerState } from '../state.ts';

import type { CitationDialogBundle } from './dialog-bundle.ts';

type CodexIcons = typeof import('@wikimedia/codex-icons');

type DraftStateValue<Key extends keyof SourceManagerState> =
    SourceManagerState[Key] extends {
        readonly value: infer Value;
    }
        ? Value
        : never;

export interface DraftDialogActions {
    addParameter(): void;
    applyDraft(): Promise<void>;
    autofillDate(index: number): Promise<void>;
    canJoinAuthor(index: number): boolean;
    canSplitAuthor(index: number): boolean;
    changeDraftTemplate(template: string | null): void;
    clearDraftValidationError(): void;
    closeDraftPopup(): void;
    dismissAliasSuggestion(index: number): void;
    duplicateDraft(): void;
    getAliasSuggestion(index: number): CreatorAliasSuggestion | null;
    getDateAutofillTooltip(name: string): string;
    getDraftFieldLabel(
        index: number,
        field: keyof validation.SourceDraftRowErrors,
        parameter: string,
    ): string;
    getOpenableDraftUrl(value: string): string;
    getParameterAliasActionLabel(row: SourceDraftRow): string;
    getParameterAliasCaption(parameter: string, alias: string): string;
    getParameterNameTooltip(parameter: string): string;
    hasReferenceNameExclusion(row: SourceDraftRow): boolean;
    insertParameterBelow(index: number): void;
    isAuthorDraftParameter(name: string): boolean;
    isDateAutofillParameter(name: string): boolean;
    isLastAuthorDraftParameter(name: string): boolean;
    isLinkableDraftParameter(name: string): boolean;
    isUrlDraftParameter(parameter: string): boolean;
    joinAuthor(index: number): void;
    linkOrganization(index: number): Promise<void>;
    onDraftPopupOpenChange(open: boolean): void;
    openParameterAliasDialog(index: number): void;
    saveDraft(): Promise<void>;
    sortParameters(): void;
    splitAuthor(index: number): void;
    switchUrlStatus(index: number): void;
    updateParameterValue(index: number, value: string): void;
    useAliasSuggestion(index: number): void;
}

/** Bindings exposed to the build-injected source-draft template. */
export type DraftDialogContext = DraftDialogActions & {
    addParameterIcon: CodexIcons['cdxIconAdd'];
    citationNameCells: DraftStateValue<'citationNameCells'>;
    citationNameParts: DraftStateValue<'citationNameParts'>;
    closeIcon: CodexIcons['cdxIconClose'];
    confirmIcon: CodexIcons['cdxIconCheck'];
    draft: DraftStateValue<'draft'>;
    draftCellErrors: DraftStateValue<'draftCellErrors'>;
    draftCs1Checking: DraftStateValue<'draftCs1Checking'>;
    draftPopupOpen: DraftStateValue<'draftPopupOpen'>;
    draftReviewTool: DraftStateValue<'draftReviewTool'>;
    draftRowKey: (row: SourceDraftRow) => number;
    draftSourcePreview: DraftStateValue<'draftSourcePreview'>;
    editingSource: DraftStateValue<'editingSource'>;
    error: string;
    flashingAuthorRows: DraftStateValue<'flashingAuthorRows'>;
    hasCitationIdentity: boolean;
    interfaceLocale: string;
    joinAuthorIcon: CodexIcons['cdxIconMerge'];
    linkIcon: CodexIcons['cdxIconLink'];
    loading: boolean;
    magicWandIcon: CodexIcons['cdxIconMagicWand'];
    msg: SourceEditorI18n['msg'];
    openUrlIcon: CodexIcons['cdxIconNewWindow'];
    parameterAliasIcon: CodexIcons['cdxIconKey'];
    parameterNameOptions: DraftStateValue<'parameterNameOptions'>;
    splitAuthorIcon: CodexIcons['cdxIconMerge'];
    switchStatusIcon: CodexIcons['cdxIconUpdate'];
    templateOptions: ReturnType<typeof options.getSourceDraftTemplateOptions>;
    warning: string;
};

const draftDialog: CitationDialogBundle = {
    styles:
        typeof __SOURCE_EDITOR_REFERENCE_DRAFT_DIALOG_STYLES__ === 'undefined'
            ? ''
            : __SOURCE_EDITOR_REFERENCE_DRAFT_DIALOG_STYLES__,
    template:
        typeof __SOURCE_EDITOR_REFERENCE_DRAFT_DIALOG_TEMPLATE__ === 'undefined'
            ? ''
            : __SOURCE_EDITOR_REFERENCE_DRAFT_DIALOG_TEMPLATE__,
};

export default draftDialog;
