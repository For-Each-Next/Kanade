/**
 * @file src/source-editor/features/source-manager/state.ts
 * Purpose: Reactive state and derived values for the citation source manager.
 *
 * Contents: Source-list state, citation drafts, validation, and review snapshots.
 */

import { resolveWikiPolicy } from '../../domain/wiki-policy.ts';
import type { Cs1CheckedSource } from '../../app/contracts/cs1-review.ts';
import {
    getCs1DraftFingerprint,
    mergeSourceDraftErrors,
} from '../../domain/cs1-validation.ts';
import type { SourceAnalysisCell } from '../../domain/source-analysis.ts';
import {
    type ExistingSource,
    type ExistingSourceSubReference,
    getSourceDraftCitationNameCells,
    getSourceDraftCitationNameParts,
    listExistingSources,
    listExistingSourceSections,
    listSourceDraftParameterCollisions,
    listSourceDraftParameterNames,
    type ScriptTitleMode,
    serializeSourceDraftForEdit,
    type SourceDraft,
    type SourceDraftCitationNameCell,
    type SourceDraftCitationNameParts,
    type SourceDraftRow,
    type SourceSection,
} from '../../domain/source-manager.ts';
import {
    getSourceDraftErrors,
    type SourceDraftErrors,
} from '../../domain/source-validation.ts';
import type { CitationLayout } from '../../domain/types.ts';
import type { TemplateNameContext } from '../../domain/templates.ts';
import { msg } from '../../i18n/index.ts';
import { sourceValidationMessages } from './messages.ts';
import type { EditBox } from '../../app/contracts/editor.ts';
import type { AnalysisUndoSnapshot } from './analysis-session.ts';
import {
    type AppliedAnalysisFinding,
    createEditableSourceAnalysis,
    type EditableCitationSourceAnalysis,
} from './analysis-state.ts';
import type { VueModule } from './codex.ts';
import {
    createSourceListDerivedState,
    type SourceListDerivedState,
} from './list-presentation.ts';
import type {
    ReferenceStyle,
    SourceManagerOptions,
    SourceManagerWikiContext,
} from '../../app/contracts/source-manager.ts';
import { buildSourcePreview, type SourcePreviewPart } from './preview.ts';

export type Cs1ToolStatus = 'checking' | 'complete' | 'idle' | 'unavailable';
export type SourceToolPopup = 'analysis' | 'cs1' | 'non-cs1' | null;
export type SourceCheckerTool = Extract<SourceToolPopup, 'cs1' | 'non-cs1'>;

export interface PreloadedCheckerSource {
    checkedHtml: string;
    checkedMessages: string[];
    sourceIndex: number;
}

export interface SourceManagerState extends SourceListDerivedState {
    readonly wiki: SourceManagerWikiContext;
    activeAnalysisTab: { value: SourceAnalysisCell };
    activeLookupTab: { value: string };
    appliedAnalysisFindings: { value: AppliedAnalysisFinding[] };
    analysisFindingOrder: { value: string[] };
    analysisUndo: { value: AnalysisUndoSnapshot | null };
    citationLayout: { value: CitationLayout };
    citationNameCells: {
        readonly value: Map<number, SourceDraftCitationNameCell>;
    };
    citationNameParts: {
        readonly value: SourceDraftCitationNameParts;
    };
    checkedCs1CellErrors: { value: SourceDraftErrors };
    checkedCs1Source: { value: string };
    closeConfirmationOpen: { value: boolean };
    cs1ToolMessages: { value: string[] };
    cs1ToolSources: { value: Cs1CheckedSource[] };
    cs1ToolStatus: { value: Cs1ToolStatus };
    dismissedAliasSuggestions: { value: Set<string> };
    draft: { value: SourceDraft | null };
    draftCellErrors: { readonly value: SourceDraftErrors };
    draftCs1Checking: { value: boolean };
    draftPopupOpen: { value: boolean };
    draftReviewQueue: { value: PreloadedCheckerSource[] };
    draftReviewTool: { value: SourceCheckerTool | null };
    draftSourcePreview: { readonly value: SourcePreviewPart[] };
    editingSource: { value: ExistingSource | null };
    error: { value: string };
    existingSourceSections: { value: SourceSection[] };
    existingSources: { value: ExistingSource[] };
    formatScriptTitles: { value: boolean };
    flashingAuthorRows: { value: Set<SourceDraftRow> };
    loading: { value: boolean };
    open: { value: boolean };
    parameterAliasDialogDirectives: { value: string[] };
    parameterAliasDialogOpen: { value: boolean };
    parameterAliasDialogOriginalValue: { value: string };
    parameterAliasDialogRowIndex: { value: number | null };
    parameterAliasDialogValidationAttempted: { value: boolean };
    parameterAliasDialogValue: { value: string };
    parameterNameOptions: {
        readonly value: Array<{ label: string; value: string }>;
    };
    referenceStyle: { value: ReferenceStyle };
    referenceReuseDetails: { value: string };
    referenceReuseDialogOpen: { value: boolean };
    referenceReuseError: { value: string };
    referenceReuseSource: { value: ExistingSource | null };
    referenceReuseSubReference: { value: ExistingSourceSubReference | null };
    referenceReuseSubReferences: { value: ExistingSourceSubReference[] };
    scriptTitleMode: { value: ScriptTitleMode };
    sessionUndo: { value: AnalysisUndoSnapshot | null };
    sourceAnalysis: { value: EditableCitationSourceAnalysis };
    sourceInput: { value: string };
    sourceSectionPath: { value: string[] };
    toolPopup: { value: SourceToolPopup };
    toolPopupOpen: { value: boolean };
    templateNameContext: TemplateNameContext;
    warning: { value: string };
}

interface DraftDerivedInputs {
    checkedCs1CellErrors: SourceManagerState['checkedCs1CellErrors'];
    checkedCs1Source: SourceManagerState['checkedCs1Source'];
    citationLayout: SourceManagerState['citationLayout'];
    draft: SourceManagerState['draft'];
}

interface DraftDerivedState {
    citationNameCells: SourceManagerState['citationNameCells'];
    citationNameParts: SourceManagerState['citationNameParts'];
    draftCellErrors: SourceManagerState['draftCellErrors'];
    draftSourcePreview: SourceManagerState['draftSourcePreview'];
    parameterNameOptions: SourceManagerState['parameterNameOptions'];
}

interface InitialSourceListState {
    existingSourceSections: SourceManagerState['existingSourceSections'];
    existingSources: SourceManagerState['existingSources'];
    sourceAnalysis: SourceManagerState['sourceAnalysis'];
    sourceSectionPath: SourceManagerState['sourceSectionPath'];
}

type FormatError = (error: unknown) => string;

interface SourceManagerStateConfiguration {
    readonly wiki: SourceManagerWikiContext;
    options: SourceManagerOptions;
    templateNameContext: TemplateNameContext;
}

/**
 * Creates initial reactive state from the current editor contents.
 *
 * @param Vue - Vue value.
 * @param editor - Editor value.
 * @param configuration - Operation configuration.
 * @param wikiId - Wiki id value.
 * @param formatError - Format error value.
 * @returns Initial reactive state from current editor contents.
 */
export function createSourceManagerState(
    Vue: VueModule,
    editor: EditBox,
    configuration: SourceManagerStateConfiguration,
    wikiId: string,
    formatError: FormatError,
): SourceManagerState {
    const { options, templateNameContext } = configuration;
    const initialText = editor.read();
    const sourceList = createInitialSourceListState(
        Vue,
        initialText,
        templateNameContext,
    );
    const cs1State = createInitialCs1ToolState(Vue);
    const citationLayout = Vue.ref(options.citationLayout ?? 'inline');
    const draft = Vue.ref<SourceDraft | null>(null);
    const referenceStyle = Vue.ref(options.referenceStyle ?? 'ref');
    const sourceInput = Vue.ref('');
    const derived = {
        ...createDraftDerivedState(
            Vue,
            {
                ...cs1State,
                citationLayout,
                draft,
            },
            wikiId,
            formatError,
        ),
        ...createSourceListDerivedState(Vue, { ...sourceList, sourceInput }),
    };
    const interfaceState = createInitialInterfaceState(Vue, initialText);
    return {
        wiki: configuration.wiki,
        ...derived,
        ...interfaceState,
        ...sourceList,
        ...cs1State,
        citationLayout,
        dismissedAliasSuggestions: Vue.ref(new Set<string>()),
        draft,
        editingSource: Vue.ref<ExistingSource | null>(null),
        error: Vue.ref(''),
        formatScriptTitles: Vue.ref(options.formatScriptTitles ?? true),
        flashingAuthorRows: Vue.ref(new Set<SourceDraftRow>()),
        loading: Vue.ref(false),
        referenceStyle,
        scriptTitleMode: Vue.ref<ScriptTitleMode>(
            options.scriptTitleMode ?? 'non-latin',
        ),
        sourceInput,
        templateNameContext,
        warning: Vue.ref(''),
    };
}

function createInitialInterfaceState(Vue: VueModule, initialText: string) {
    return {
        activeAnalysisTab: Vue.ref<SourceAnalysisCell>('value'),
        activeLookupTab: Vue.ref('sources'),
        appliedAnalysisFindings: Vue.ref<AppliedAnalysisFinding[]>([]),
        analysisFindingOrder: Vue.ref<string[]>([]),
        analysisUndo: Vue.ref<AnalysisUndoSnapshot | null>(null),
        closeConfirmationOpen: Vue.ref(false),
        draftPopupOpen: Vue.ref(false),
        open: Vue.ref(true),
        parameterAliasDialogDirectives: Vue.ref<string[]>([]),
        parameterAliasDialogOpen: Vue.ref(false),
        parameterAliasDialogOriginalValue: Vue.ref(''),
        parameterAliasDialogRowIndex: Vue.ref<number | null>(null),
        parameterAliasDialogValidationAttempted: Vue.ref(false),
        parameterAliasDialogValue: Vue.ref(''),
        referenceReuseDetails: Vue.ref(''),
        referenceReuseDialogOpen: Vue.ref(false),
        referenceReuseError: Vue.ref(''),
        referenceReuseSource: Vue.ref<ExistingSource | null>(null),
        referenceReuseSubReference: Vue.ref<ExistingSourceSubReference | null>(
            null,
        ),
        referenceReuseSubReferences: Vue.ref<ExistingSourceSubReference[]>([]),
        sessionUndo: Vue.ref<AnalysisUndoSnapshot>({
            afterText: initialText,
            beforeText: initialText,
        }),
        toolPopup: Vue.ref<SourceToolPopup>(null),
        toolPopupOpen: Vue.ref(false),
    };
}

function createInitialCs1ToolState(Vue: VueModule) {
    return {
        checkedCs1CellErrors: Vue.ref<SourceDraftErrors>(new Map()),
        checkedCs1Source: Vue.ref(''),
        cs1ToolMessages: Vue.ref<string[]>([]),
        cs1ToolSources: Vue.ref<Cs1CheckedSource[]>([]),
        cs1ToolStatus: Vue.ref<Cs1ToolStatus>('idle'),
        draftCs1Checking: Vue.ref(false),
        draftReviewQueue: Vue.ref<PreloadedCheckerSource[]>([]),
        draftReviewTool: Vue.ref<SourceCheckerTool | null>(null),
    };
}

/**
 * Creates reactive source-list values from the current editor text.
 *
 * @param Vue - Vue value.
 * @param text - Text to process.
 * @param templateNameContext - Wiki-scoped template-name context.
 * @returns Reactive source-list values from current editor text.
 */
function createInitialSourceListState(
    Vue: VueModule,
    text: string,
    templateNameContext: TemplateNameContext,
): InitialSourceListState {
    const existingSources = Vue.ref(
        listExistingSources(text, templateNameContext),
    );
    return {
        existingSourceSections: Vue.ref(
            listExistingSourceSections(text, existingSources.value),
        ),
        existingSources,
        sourceAnalysis: Vue.ref(createEditableSourceAnalysis([])),
        sourceSectionPath: Vue.ref<string[]>([]),
    };
}

/**
 * Builds live name and source-code values for the current draft.
 *
 * @param Vue - Vue value.
 * @param state - Mutable operation state.
 * @param wikiId - Wiki id value.
 * @param formatError - Format error value.
 * @returns Live name and source-code values for the current draft.
 */
function createDraftDerivedState(
    Vue: VueModule,
    state: DraftDerivedInputs,
    wikiId: string,
    formatError: FormatError,
): DraftDerivedState {
    function getCitationNameCells(): Map<number, SourceDraftCitationNameCell> {
        const draft = state.draft.value;
        return draft == null
            ? new Map<number, SourceDraftCitationNameCell>()
            : getSourceDraftCitationNameCells(draft);
    }
    function getDraftSourcePreview(): SourcePreviewPart[] {
        return buildDraftSourcePreview(
            state.draft.value,
            state.citationLayout.value,
            formatError,
            wikiId,
        );
    }
    function getCitationNameParts(): SourceDraftCitationNameParts {
        const draft = state.draft.value;
        if (draft == null) {
            return { author: '', part: '', year: '' };
        }
        try {
            return getSourceDraftCitationNameParts(draft);
        } catch {
            return { author: '', part: '', year: '' };
        }
    }
    function getDraftCellErrors(): SourceDraftErrors {
        const draft = state.draft.value;
        if (draft == null) {
            return new Map();
        }
        const local = getSourceDraftErrors(
            draft,
            wikiId,
            sourceValidationMessages,
        );
        if (
            getCurrentCs1DraftFingerprint(state) !==
            state.checkedCs1Source.value
        ) {
            return omitCollisionMarkerNameErrors(draft, local);
        }
        const merged = mergeSourceDraftErrors(
            local,
            state.checkedCs1CellErrors.value,
        );
        return omitCollisionMarkerNameErrors(draft, merged);
    }
    function getParameterNameOptions(): Array<{
        label: string;
        value: string;
    }> {
        const draft = state.draft.value;
        if (draft == null) {
            return [];
        }
        return listSourceDraftParameterNames(draft).map((name) => ({
            label: name,
            value: name,
        }));
    }
    return {
        citationNameCells: Vue.computed(getCitationNameCells),
        citationNameParts: Vue.computed(getCitationNameParts),
        draftCellErrors: Vue.computed(getDraftCellErrors),
        draftSourcePreview: Vue.computed(getDraftSourcePreview),
        parameterNameOptions: Vue.computed(getParameterNameOptions),
    };
}

function omitCollisionMarkerNameErrors(
    draft: SourceDraft,
    errors: SourceDraftErrors,
): SourceDraftErrors {
    const markers = new Set(
        listSourceDraftParameterCollisions(draft).map((collision) =>
            collision.renamedParameter.toLowerCase(),
        ),
    );
    if (markers.size === 0) {
        return errors;
    }
    const result = new Map(errors);
    for (const [index, rowErrors] of result) {
        const entered = draft.rows[index]?.name.trim().toLowerCase();
        if (entered == null || !markers.has(entered)) {
            continue;
        }
        const remaining = { ...rowErrors };
        delete remaining.name;
        if (Object.keys(remaining).length === 0) {
            result.delete(index);
        } else {
            result.set(index, remaining);
        }
    }
    return result;
}

/**
 * Gets the stable source text represented by the current draft.
 *
 * @param state - Mutable operation state.
 * @returns Resulting text.
 */
export function getCurrentCs1DraftFingerprint(
    state: Pick<SourceManagerState, 'draft'>,
): string {
    const draft = state.draft.value;
    if (draft == null) {
        return '';
    }
    try {
        return getCs1DraftFingerprint(draft);
    } catch {
        return '';
    }
}

/**
 * Clears server-side CS1 errors after the draft changes.
 *
 * @param state - Mutable operation state.
 */
export function clearCheckedCs1Errors(state: SourceManagerState): void {
    state.checkedCs1CellErrors.value = new Map();
    state.checkedCs1Source.value = '';
}

/**
 * Clears the summary superseded by field-level validation.
 *
 * @param state - Mutable operation state.
 */
export function clearDraftValidationSummary(state: SourceManagerState): void {
    if (state.error.value === msg('draft.invalidSummary')) {
        state.error.value = '';
    }
}

/**
 * Builds a safely segmented preview from the current source draft.
 *
 * @param draft - Source draft to process.
 * @param layout - Citation layout.
 * @param formatError - Format error value.
 * @returns Safely segmented preview from the current source draft.
 */
function buildDraftSourcePreview(
    draft: SourceDraft | null,
    layout: CitationLayout,
    formatError: FormatError,
    wikiId: string,
): SourcePreviewPart[] {
    if (draft == null) {
        return [];
    }
    try {
        return buildSourcePreview(
            serializeSourceDraftForEdit(
                draft,
                layout,
                resolveWikiPolicy(wikiId),
            ),
        );
    } catch (error) {
        return [
            {
                kind: 'text',
                text: msg('draft.previewUnavailable', {
                    error: formatError(error),
                }),
            },
        ];
    }
}
