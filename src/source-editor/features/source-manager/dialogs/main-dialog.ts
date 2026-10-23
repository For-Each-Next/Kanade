/**
 * @file src/source-editor/features/source-manager/dialogs/main-dialog.ts
 * Purpose: Build-injected main Source Editor dialog bundle.
 *
 * Contents: Source-list and reuse bindings, actions, and injected template bundle.
 */

import type { SourceEditorI18n } from '../../../i18n/index.ts';
import type {
    SourceSectionSelector,
    SourceTableRow,
} from '../list-presentation.ts';
import type { SourceManagerState } from '../state.ts';
import type { TableColumn } from '@wikimedia/codex';

import type { CitationDialogBundle } from './dialog-bundle.ts';

type MainDialogStateKey =
    | 'activeLookupTab'
    | 'cs1ToolStatus'
    | 'error'
    | 'existingSources'
    | 'filteredExistingSources'
    | 'loading'
    | 'open'
    | 'referenceReuseDetails'
    | 'referenceReuseDialogOpen'
    | 'referenceReuseError'
    | 'referenceReuseSource'
    | 'referenceReuseSubReference'
    | 'referenceReuseSubReferences'
    | 'sectionFilterLabel'
    | 'sourceInput'
    | 'sourceSectionSelectors'
    | 'sourceTablePaginationKey'
    | 'sourceTableRows'
    | 'sourceTableGroups'
    | 'warning';

type MainDialogStateBindings = {
    [Key in MainDialogStateKey]: SourceManagerState[Key] extends {
        readonly value: infer Value;
    }
        ? Value
        : never;
};

type CodexIcons = typeof import('@wikimedia/codex-icons');

export interface MainDialogActions {
    canReuseListedSourceWithDetails(sourceId: string): boolean;
    cancelAllChanges(): void;
    close(): void;
    closeReferenceReuseDialog(): void;
    editListedSource(sourceId: string): void;
    editListedSubReference(sourceId: string, subReferenceId: string): void;
    getReferenceReusePreview(): string;
    insertListedSource(sourceId: string, event?: MouseEvent): void;
    insertReferenceWithDetails(): void;
    onOpenChange(value: boolean): void;
    onReferenceReuseDialogOpenChange(value: boolean): void;
    openAnalysisTool(): void;
    openCs1Tool(): Promise<void>;
    openNonCs1Tool(): void;
    openFormattingSettings(): Promise<void>;
    openReferenceReuseDialog(sourceId: string): void;
    resolveEnteredSource(entered?: string): Promise<void>;
    reuseListedSubReference(sourceId: string, subReferenceId: string): void;
    selectSourceSection(
        selector: SourceSectionSelector,
        selected: string | number,
    ): void;
    setSourceManagerContent(element: unknown): void;
}

/** Bindings exposed to the build-injected main dialog template. */
export type MainDialogContext = MainDialogActions &
    MainDialogStateBindings &
    Pick<SourceEditorI18n, 'interfaceLocale' | 'msg'> & {
        canCheckCs1Tool: boolean;
        editSourceIcon: CodexIcons['cdxIconEdit'];
        formattingSettingsAvailable: boolean;
        sourceTableColumns: TableColumn[];
        useSourceIcon: CodexIcons['cdxIconReferenceExisting'];
    };

export interface MainDialogTableSlotScope {
    item: string;
    row: SourceTableRow;
}

const mainDialog: CitationDialogBundle = {
    styles:
        typeof __SOURCE_EDITOR_REFERENCE_MAIN_DIALOG_STYLES__ === 'undefined'
            ? ''
            : __SOURCE_EDITOR_REFERENCE_MAIN_DIALOG_STYLES__,
    template:
        typeof __SOURCE_EDITOR_REFERENCE_MAIN_DIALOG_TEMPLATE__ === 'undefined'
            ? ''
            : __SOURCE_EDITOR_REFERENCE_MAIN_DIALOG_TEMPLATE__,
};

export default mainDialog;
