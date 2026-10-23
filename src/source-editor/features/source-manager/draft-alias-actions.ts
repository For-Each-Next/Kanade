/**
 * @file src/source-editor/features/source-manager/draft-alias-actions.ts
 * Purpose: Author-row and reference-name alias actions for source drafts.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. AuthorDraftActions
 * 4. ParameterAliasMutationActions
 * 5. ParameterAliasPresentationActions
 * 6. AliasSuggestionDraftActions
 * 7. AliasDraftActions
 * 8. createAuthorDraftActions
 * 9. flashAuthorRows
 * 10. createAliasDraftActions
 * 11. createParameterAliasDialogActions
 * 12. focusInvalidParameterAliasField
 * 13. applyParameterAliasDialogValues
 * 14. listSelectedReferenceNameDirectives
 * 15. mergeReferenceNameDirectives
 * 16. createParameterAliasPresentationActions
 * 17. createAliasSuggestionDraftActions
 * 18. getParameterAliasDialogRow
 * 19. getParameterAliasLabel
 * 20. getParameterAliasActionLabel
 * 21. hasReferenceNameExclusion
 * 22. getParameterAliasCaption
 * 23. getParameterAliasDialogError
 * 24. getParameterAliasValidationError
 * 25. canApplyParameterAlias
 * 26. findAvailableAliasSuggestion
 * 27. buildAliasSuggestionKey
 * 28. normalizeDraftName
 */

import {
    canJoinAuthorDraftRow,
    canSplitAuthorDraftRow,
    ensureNextAuthorDraftRows,
    findCreatorAliasSuggestions,
    isAuthorDraftParameter,
    isLastAuthorDraftParameter,
    joinAuthorDraftRow,
    splitAuthorDraftRow,
    type CreatorAliasSuggestion,
    type SourceDraftRow,
} from '../../domain/source-manager.ts';
import { msg } from '../../i18n/index.ts';
import type { DraftDialogActions, ParameterAliasActions } from './dialogs.ts';
import {
    clearDraftValidationSummary,
    type SourceManagerState,
} from './state.ts';

const REFERENCE_NAME_DIRECTIVES = [
    '!no-author',
    '!no-date',
    '!no-part',
] as const;
const AUTHOR_FLASH_DURATION_MS = 700;
const PARAMETER_ALIAS_INVALID_SELECTOR =
    '.kanade-source-editor-source-manager__parameter-alias-original .cdx-text-area__textarea';

type AuthorDraftActions = Pick<
    DraftDialogActions,
    | 'canJoinAuthor'
    | 'canSplitAuthor'
    | 'isAuthorDraftParameter'
    | 'isLastAuthorDraftParameter'
    | 'joinAuthor'
    | 'splitAuthor'
    | 'updateParameterValue'
>;
type ParameterAliasMutationActions = Pick<
    ParameterAliasActions,
    | 'applyParameterAlias'
    | 'closeParameterAliasDialog'
    | 'onParameterAliasDialogOpenChange'
> & {
    openParameterAliasDialog(index: number): void;
};
type ParameterAliasPresentationActions = Pick<
    ParameterAliasActions,
    | 'canApplyParameterAlias'
    | 'getParameterAliasDialogError'
    | 'getParameterAliasDialogLabel'
    | 'getParameterAliasOriginalValueLabel'
> & {
    getParameterAliasActionLabel(row: SourceDraftRow): string;
    getParameterAliasCaption(parameter: string, alias: string): string;
    hasReferenceNameExclusion(row: SourceDraftRow): boolean;
};

type AliasSuggestionDraftActions = Pick<
    DraftDialogActions,
    'dismissAliasSuggestion' | 'getAliasSuggestion' | 'useAliasSuggestion'
>;

type AliasDraftActions = AliasSuggestionDraftActions &
    ParameterAliasMutationActions &
    ParameterAliasPresentationActions;

/**
 * Creates author-row splitting and automatic next-slot actions.
 *
 * @param state - Mutable operation state.
 * @returns Author splitting and automatic next-slot actions.
 */
export function createAuthorDraftActions(
    state: SourceManagerState,
): AuthorDraftActions {
    function canJoinAuthor(index: number): boolean {
        const draft = state.draft.value;
        return draft != null && canJoinAuthorDraftRow(draft, index);
    }
    function canSplitAuthor(index: number): boolean {
        const draft = state.draft.value;
        return draft != null && canSplitAuthorDraftRow(draft, index);
    }
    function joinAuthor(index: number): void {
        const draft = state.draft.value;
        const row = draft?.rows[index];
        if (draft != null && row != null && joinAuthorDraftRow(draft, index)) {
            flashAuthorRows(state, [row]);
        }
    }
    function splitAuthor(index: number): void {
        const draft = state.draft.value;
        const row = draft?.rows[index];
        if (draft != null && row != null && splitAuthorDraftRow(draft, index)) {
            const currentIndex = draft.rows.indexOf(row);
            const first = draft.rows[currentIndex + 1];
            flashAuthorRows(state, first == null ? [row] : [row, first]);
        }
    }
    function updateParameterValue(index: number, value: string): void {
        const draft = state.draft.value;
        if (draft?.rows[index] == null) {
            return;
        }
        clearDraftValidationSummary(state);
        draft.rows[index].value = value;
        ensureNextAuthorDraftRows(draft);
    }
    return {
        canJoinAuthor,
        canSplitAuthor,
        isAuthorDraftParameter,
        isLastAuthorDraftParameter,
        joinAuthor,
        splitAuthor,
        updateParameterValue,
    };
}

function flashAuthorRows(
    state: SourceManagerState,
    rows: SourceDraftRow[],
): void {
    const highlighted = new Set(rows);
    state.flashingAuthorRows.value = highlighted;
    setTimeout(function clearAuthorFlash(): void {
        if (state.flashingAuthorRows.value === highlighted) {
            state.flashingAuthorRows.value = new Set();
        }
    }, AUTHOR_FLASH_DURATION_MS);
}

/**
 * Creates opt-in actions for previously used creator aliases.
 *
 * @param state - Mutable operation state.
 * @param scheduleTextAreaAutosize - Schedule text area autosize value.
 * @returns Created opt-in actions for previously used creator aliases.
 */
export function createAliasDraftActions(
    state: SourceManagerState,
    scheduleTextAreaAutosize: () => void,
): AliasDraftActions {
    return {
        ...createParameterAliasDialogActions(state, scheduleTextAreaAutosize),
        ...createParameterAliasPresentationActions(state),
        ...createAliasSuggestionDraftActions(state),
    };
}

/**
 * Creates mutating actions for the compact parameter-alias dialog.
 *
 * @param state - Mutable operation state.
 * @param scheduleTextAreaAutosize - Schedule text area autosize value.
 * @returns Mutating actions for the parameter-alias dialog.
 */
function createParameterAliasDialogActions(
    state: SourceManagerState,
    scheduleTextAreaAutosize: () => void,
): ParameterAliasMutationActions {
    function closeParameterAliasDialog(): void {
        state.parameterAliasDialogOpen.value = false;
        state.parameterAliasDialogDirectives.value = [];
        state.parameterAliasDialogOriginalValue.value = '';
        state.parameterAliasDialogRowIndex.value = null;
        state.parameterAliasDialogValidationAttempted.value = false;
        state.parameterAliasDialogValue.value = '';
    }
    function openParameterAliasDialog(index: number): void {
        const row = state.draft.value?.rows[index];
        if (row == null) {
            return;
        }
        state.parameterAliasDialogRowIndex.value = index;
        state.parameterAliasDialogDirectives.value =
            listSelectedReferenceNameDirectives(row.directive);
        state.parameterAliasDialogOriginalValue.value = row.value;
        state.parameterAliasDialogValidationAttempted.value = false;
        state.parameterAliasDialogValue.value = row.alias;
        state.parameterAliasDialogOpen.value = true;
        scheduleTextAreaAutosize();
    }
    function onParameterAliasDialogOpenChange(open: boolean): void {
        if (!open) {
            closeParameterAliasDialog();
        }
    }
    function applyParameterAlias(): void {
        state.parameterAliasDialogValidationAttempted.value = true;
        if (applyParameterAliasDialogValues(state)) {
            closeParameterAliasDialog();
            return;
        }
        focusInvalidParameterAliasField();
    }
    return {
        applyParameterAlias,
        closeParameterAliasDialog,
        onParameterAliasDialogOpenChange,
        openParameterAliasDialog,
    };
}

function focusInvalidParameterAliasField(): void {
    document
        .querySelector<HTMLTextAreaElement>(PARAMETER_ALIAS_INVALID_SELECTOR)
        ?.focus({ preventScroll: true });
}

/**
 * Applies both editable values held by the reference-naming dialog.
 *
 * @param state - Mutable operation state.
 * @returns Whether the condition is met.
 */
function applyParameterAliasDialogValues(state: SourceManagerState): boolean {
    const draft = state.draft.value;
    const row = getParameterAliasDialogRow(state);
    if (draft == null || row == null || !canApplyParameterAlias(state)) {
        return false;
    }
    clearDraftValidationSummary(state);
    row.value = state.parameterAliasDialogOriginalValue.value;
    row.alias = state.parameterAliasDialogValue.value.trim();
    row.directive = mergeReferenceNameDirectives(
        row.directive,
        state.parameterAliasDialogDirectives.value,
    );
    ensureNextAuthorDraftRows(draft);
    return true;
}

function listSelectedReferenceNameDirectives(directive: string): string[] {
    const tokens = new Set(directive.trim().split(/\s+/u));
    return REFERENCE_NAME_DIRECTIVES.filter((entry) => tokens.has(entry));
}

function mergeReferenceNameDirectives(
    current: string,
    selected: string[],
): string {
    const known = new Set<string>(REFERENCE_NAME_DIRECTIVES);
    const unknown = current
        .trim()
        .split(/\s+/u)
        .filter((entry) => entry !== '' && !known.has(entry));
    const selectedSet = new Set(selected);
    const ordered = REFERENCE_NAME_DIRECTIVES.filter((entry) =>
        selectedSet.has(entry),
    );
    return [...ordered, ...unknown].join(' ');
}

/**
 * Creates labels and validation for the parameter-alias dialog.
 *
 * @param state - Mutable operation state.
 * @returns Labels and validation for the parameter-alias dialog.
 */
function createParameterAliasPresentationActions(
    state: SourceManagerState,
): ParameterAliasPresentationActions {
    function canApply(): boolean {
        return canApplyParameterAlias(state);
    }
    function getDialogError(): string {
        return getParameterAliasDialogError(state);
    }
    function getDialogLabel(): string {
        const row = getParameterAliasDialogRow(state);
        return row == null
            ? msg('draft.alias')
            : getParameterAliasLabel(row.name);
    }
    function getOriginalValueLabel(): string {
        const row = getParameterAliasDialogRow(state);
        return msg('draft.originalValueLabel', {
            parameter: row?.name || msg('draft.parameter'),
        });
    }
    return {
        canApplyParameterAlias: canApply,
        getParameterAliasActionLabel,
        getParameterAliasCaption,
        getParameterAliasDialogError: getDialogError,
        getParameterAliasDialogLabel: getDialogLabel,
        getParameterAliasOriginalValueLabel: getOriginalValueLabel,
        hasReferenceNameExclusion,
    };
}

/**
 * Creates opt-in actions for previously used creator aliases.
 *
 * @param state - Mutable operation state.
 * @returns Created opt-in actions for previously used creator aliases.
 */
function createAliasSuggestionDraftActions(
    state: SourceManagerState,
): AliasSuggestionDraftActions {
    function getAliasSuggestion(index: number): CreatorAliasSuggestion | null {
        return findAvailableAliasSuggestion(state, index);
    }
    function useAliasSuggestion(index: number): void {
        const draft = state.draft.value;
        const row = draft?.rows[index];
        const suggestion = getAliasSuggestion(index);
        if (row != null && suggestion != null) {
            clearDraftValidationSummary(state);
            row.alias = suggestion.alias;
        }
    }
    function dismissAliasSuggestion(index: number): void {
        const draft = state.draft.value;
        const row = draft?.rows[index];
        const suggestion = getAliasSuggestion(index);
        if (row == null || suggestion == null) {
            return;
        }
        const dismissed = new Set(state.dismissedAliasSuggestions.value);
        dismissed.add(buildAliasSuggestionKey(index, row, suggestion));
        state.dismissedAliasSuggestions.value = dismissed;
    }
    return {
        dismissAliasSuggestion,
        getAliasSuggestion,
        useAliasSuggestion,
    };
}

/**
 * Gets the draft row targeted by the compact alias dialog.
 *
 * @param state - Mutable operation state.
 * @returns Operation result.
 */
function getParameterAliasDialogRow(
    state: SourceManagerState,
): SourceDraftRow | null {
    const index = state.parameterAliasDialogRowIndex.value;
    return index == null ? null : (state.draft.value?.rows[index] ?? null);
}

/**
 * Gets the localized alias or source-key label for a parameter.
 *
 * @param parameter - Parameter value.
 * @returns Resulting text.
 */
function getParameterAliasLabel(parameter: string): string {
    return normalizeDraftName(parameter) === 'url'
        ? msg('draft.sourceKeyLabel')
        : msg('draft.aliasLabel', { parameter });
}

/**
 * Gets an accessible action label for the parameter alias button.
 *
 * @param row - Row value.
 * @returns Resulting text.
 */
function getParameterAliasActionLabel(row: SourceDraftRow): string {
    const label = getParameterAliasLabel(row.name);
    const directives = listSelectedReferenceNameDirectives(row.directive);
    return directives.length === 0
        ? msg('draft.editAliasLabel', { label })
        : msg('draft.editAliasExcludedLabel', {
              directives: directives.join(', '),
              label,
          });
}

/**
 * Marks rows excluded from at least one reference-name component.
 *
 * @param row - Row value.
 * @returns Whether the condition is met.
 */
function hasReferenceNameExclusion(row: SourceDraftRow): boolean {
    return listSelectedReferenceNameDirectives(row.directive).length > 0;
}

/**
 * Describes the alias or source key beneath a value control.
 *
 * @param parameter - Parameter value.
 * @param alias - Alias value.
 * @returns Resulting text.
 */
function getParameterAliasCaption(parameter: string, alias: string): string {
    return msg('draft.fieldContext', {
        label: getParameterAliasLabel(parameter),
        message: alias,
    });
}

/**
 * Gets the current alias-dialog validation error.
 *
 * @param state - Mutable operation state.
 * @returns Resulting text.
 */
function getParameterAliasDialogError(state: SourceManagerState): string {
    if (!state.parameterAliasDialogValidationAttempted.value) {
        return '';
    }
    return getParameterAliasValidationError(state);
}

function getParameterAliasValidationError(state: SourceManagerState): string {
    const row = getParameterAliasDialogRow(state);
    if (
        row == null ||
        state.parameterAliasDialogValue.value.trim() === '' ||
        state.parameterAliasDialogOriginalValue.value.trim() !== ''
    ) {
        return '';
    }
    return msg('draft.aliasNeedsValue', {
        parameter: row.name || msg('draft.parameter'),
    });
}

/**
 * Whether the current alias-dialog value can be applied.
 *
 * @param state - Mutable operation state.
 * @returns Whether the condition is met.
 */
function canApplyParameterAlias(state: SourceManagerState): boolean {
    return (
        getParameterAliasDialogRow(state) != null &&
        getParameterAliasValidationError(state) === ''
    );
}

/**
 * Gets the first prior alias that was not dismissed for this row.
 *
 * @param state - Mutable operation state.
 * @param index - Source index.
 * @returns Operation result.
 */
function findAvailableAliasSuggestion(
    state: SourceManagerState,
    index: number,
): CreatorAliasSuggestion | null {
    const row = state.draft.value?.rows[index];
    if (
        row == null ||
        state.editingSource.value != null ||
        row.alias.trim() !== ''
    ) {
        return null;
    }
    const suggestions = findCreatorAliasSuggestions(
        state.existingSources.value,
        row,
    );
    return (
        suggestions.find(function isNotDismissed(suggestion) {
            const key = buildAliasSuggestionKey(index, row, suggestion);
            return !state.dismissedAliasSuggestions.value.has(key);
        }) ?? null
    );
}

/**
 * Builds a draft-local key for one dismissible alias suggestion.
 *
 * @param index - Source index.
 * @param row - Row value.
 * @param suggestion - Suggestion value.
 * @returns Built draft-local key for one dismissible alias suggestion.
 */
function buildAliasSuggestionKey(
    index: number,
    row: SourceDraftRow,
    suggestion: CreatorAliasSuggestion,
): string {
    return [index, row.name, row.value, suggestion.alias].join('\u0000');
}

function normalizeDraftName(name: string): string {
    return name.trim().toLowerCase().replaceAll('_', '-');
}
