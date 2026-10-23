/**
 * @file src/source-editor/features/source-manager/controller.ts
 * Purpose: Cursor-aware source insertion and citation-field management dialog.
 *
 * Contents: Dialog lifecycle, source drafts, consistency analysis, and CS1 review.
 */

import { detectCitationLayout } from '../../domain/manager.ts';
import {
    buildExistingSourceReference,
    buildExistingSourceSubReference,
    canonicalizeSourceDraft,
    changeSourceDraftTemplate,
    createManualSourceDraft,
    ensureNextAuthorDraftRows,
    type ExistingSource,
    findExistingSources,
    formatSourceDraftRows,
    formatSourceDraftScriptTitle,
    getSourceDraftParameterAliasInfo,
    hasSourceDraftCitationIdentity,
    listExistingSources,
    listExistingSourceSections,
    listSourceDraftParameterCollisions,
    type ParsedSourceInput,
    parseSourceDraft,
    parseSourceInput,
    parseSourceUrl,
    replaceExistingSource,
    replaceExistingSourceSubReferences,
    serializeSourceDraft,
    type SourceDraft,
    type SourceDraftRow,
    type SourceSection,
    StaleSourceError,
} from '../../domain/source-manager.ts';
import type * as validation from '../../domain/source-validation.ts';
import {
    type Cs1ValidationResult,
    getIgnoredUnknownCs1ParameterName,
    isUnsupportedParameterCs1Category,
    orderCs1ItemsBySeverity,
    parseCs1ValidationResult,
} from '../../domain/cs1-validation.ts';
import {
    applySourceAnalysisReplacements,
    type SourceAnalysisCell,
    type SourceAnalysisReplacement,
} from '../../domain/source-analysis.ts';
import { interfaceLocale, type MessageId, msg } from '../../i18n/index.ts';
import { sourceAnalysisMessages } from './messages.ts';
import {
    getCanonicalTemplateNameFromKey,
    type TemplateNameContext,
} from '../../domain/templates.ts';
import type { CitationLayout } from '../../domain/types.ts';
import {
    type Cs1CheckedSource,
    type Cs1ExistingSourceReview,
    type Cs1ReviewWorkflow,
} from '../../app/contracts/cs1-review.ts';
import {
    registerSourceManagerComponents,
    type ResourceLoaderRequire,
    type VueModule,
} from './codex.ts';
import { appendAnalysisUndo, getAnalysisUndoText } from './analysis-session.ts';
import {
    type AppliedAnalysisFinding,
    type AppliedAnalysisTarget,
    buildAnalysisTabs,
    type EditableCitationSourceAnalysis,
    type EditableSourceAnalysisFinding,
    isAnalysisFindingInTab,
    refreshSourceAnalysis,
    type SelectableSourceAnalysisOccurrence,
    type SelectedAnalysisFinding,
} from './analysis-state.ts';
import {
    createAliasDraftActions,
    createAuthorDraftActions,
} from './draft-alias-actions.ts';
import {
    buildSourceSectionSelectors,
    type SourceSectionSelector,
} from './list-presentation.ts';
import {
    applyResolvedMetadata,
    buildMetadataWarnings,
    createArchiveSeed,
    createLookupFallbackDraft,
    formatMetadataFailure,
    setSourceDraftValue,
} from './metadata-draft.ts';
import {
    type OpenSourceManagerDialog,
    type ReferenceStyle,
    type SourceManagerDependencies,
    type SourceManagerOptions,
    type SourceManagerWikiContext,
} from '../../app/contracts/source-manager.ts';
import {
    clearCheckedCs1Errors,
    clearDraftValidationSummary,
    createSourceManagerState,
    getCurrentCs1DraftFingerprint,
    type PreloadedCheckerSource,
    type SourceCheckerTool,
    type SourceManagerState,
} from './state.ts';
import {
    type AnalysisReplacementActions,
    type AnalysisToolActions,
    type CheckerToolActions,
    type CloseDialogActions,
    type DraftDialogActions,
    type MainDialogActions,
    type ParameterAliasActions,
    SOURCE_MANAGER_TEMPLATE,
    type ToolActions,
} from './dialogs.ts';
import { installSourceManagerStyles } from './styles.ts';
import type { EditBox } from '../../app/contracts/editor.ts';
import type { ActionNotificationType } from '../../../library/notifications/contracts.ts';
import {
    cdxIconAdd,
    cdxIconCheck,
    cdxIconClose,
    cdxIconEdit,
    cdxIconKey,
    cdxIconLink,
    cdxIconMagicWand,
    cdxIconMerge,
    cdxIconNewWindow,
    cdxIconReferenceExisting,
    cdxIconUpdate,
} from '@wikimedia/codex-icons';
import * as templateOptions from './template-options.ts';

export { buildSourceSectionSelectors };
export type {
    OpenSourceManagerDialog,
    ReferenceStyle,
    SourceManagerDependencies,
    SourceManagerOptions,
} from '../../app/contracts/source-manager.ts';

const HOST_ID = 'kanade-source-editor-source-manager';
const CUSTOM_ANALYSIS_REPLACEMENT = '\u0000custom-analysis-value';
const AUTOSIZE_DIALOG_TEXTAREA_SELECTOR = [
    '.kanade-source-editor-source-manager__draft-dialog .cdx-text-area__textarea',
    '.kanade-source-editor-source-manager__parameter-alias-dialog .cdx-text-area__textarea',
    '.kanade-source-editor-source-manager__reference-reuse-dialog .cdx-text-area__textarea',
].join(', ');
const URL_STATUSES = ['live', 'dead', 'unfit'] as const;
const URL_DRAFT_PARAMETERS = new Set([
    'url',
    'archive-url',
    'archiveurl',
    'chapter-url',
    'conference-url',
    'conferenceurl',
    'contribution-url',
    'contributionurl',
    'eventurl',
    'layurl',
    'link',
    'mapurl',
    'section-url',
    'sectionurl',
    'transcript-url',
    'transcripturl',
]);
let removeActiveSourceManager: (() => void) | null = null;
let sourceManagerGeneration = 0;
let analysisChangeSequence = 0;

interface SourceManagerActionContext extends SourceManagerDependencies {
    cleanup: () => void;
    close: () => void;
    editor: EditBox;
    isActive: () => boolean;
    state: SourceManagerState;
    templateNameContext: TemplateNameContext;
}

interface SourceManagerActionServices extends SourceManagerDependencies {
    cleanup: () => void;
    isActive: () => boolean;
    templateNameContext: TemplateNameContext;
}

interface SourceManagerConfiguration extends SourceManagerDependencies {
    stackedActions?: { value: boolean };
    isActive: () => boolean;
    options: SourceManagerOptions;
    templateNameContext: TemplateNameContext;
}

interface SourceDraftWriteResult {
    changePosition: number;
    changeSummary: SourceDraftChangeSummary;
    previousSource: ExistingSource | null;
}

interface SourceDraftChangeSummary {
    added: string[];
    created: boolean;
    fromTemplate: string;
    removed: string[];
    textChanged: boolean;
    toTemplate: string;
    updated: string[];
}

/**
 * Creates a dialog opener with its review workflow injected.
 *
 * @param dependencies - Source-manager workflow dependencies.
 * @returns Bound dialog opener.
 */
export function createOpenSourceManagerDialog(
    dependencies: SourceManagerDependencies,
): OpenSourceManagerDialog {
    return async function openSourceManagerDialog(
        editor,
        options = {},
    ): Promise<void> {
        const generation = ++sourceManagerGeneration;
        installSourceManagerStyles();
        const require = (await dependencies.loadModules([
            'vue',
            '@wikimedia/codex',
            'mediawiki.api',
        ])) as ResourceLoaderRequire;
        if (generation !== sourceManagerGeneration) {
            return;
        }
        const templateNameContext =
            await dependencies.loadTemplateNameContext();
        if (generation !== sourceManagerGeneration) {
            return;
        }
        removeActiveSourceManager?.();
        mountSourceManager(
            editor,
            require,
            options,
            dependencies,
            templateNameContext,
        );
    };
}

/**
 * Mounts the source manager into a temporary document host.
 *
 * @param editor - Editor value.
 * @param require - Require value.
 * @param options - Operation options.
 * @param dependencies - Dependencies value.
 * @param templateNameContext - Wiki-scoped template-name context.
 */
function mountSourceManager(
    editor: EditBox,
    require: ResourceLoaderRequire,
    options: SourceManagerOptions,
    dependencies: SourceManagerDependencies,
    templateNameContext: TemplateNameContext,
): void {
    const Vue = require('vue');
    const Codex = require('@wikimedia/codex');
    const host = document.createElement('div');
    host.id = HOST_ID;
    const actionLayout = window.matchMedia('(max-width: 639px)');
    const stackedActions = Vue.ref(actionLayout.matches);
    let application: ReturnType<VueModule['createMwApp']> | null = null;
    let cleaned = false;
    const updateActionLayout = (): void => {
        const focusedElement = document.activeElement;
        stackedActions.value = actionLayout.matches;
        queueMicrotask(() => {
            if (
                !cleaned &&
                focusedElement instanceof HTMLElement &&
                focusedElement.isConnected &&
                document.activeElement !== focusedElement
            ) {
                focusedElement.focus({ preventScroll: true });
            }
        });
    };
    const cleanup = function cleanup(): void {
        if (cleaned) {
            return;
        }
        cleaned = true;
        actionLayout.removeEventListener('change', updateActionLayout);
        const mountedApplication = application;
        application = null;
        try {
            mountedApplication?.unmount();
        } finally {
            host.remove();
            if (removeActiveSourceManager === cleanup) {
                removeActiveSourceManager = null;
            }
        }
    };
    try {
        document.documentElement.append(host);
        actionLayout.addEventListener('change', updateActionLayout);
        const component = createSourceManagerComponent(Vue, editor, cleanup, {
            ...dependencies,
            isActive: () => !cleaned,
            options,
            stackedActions,
            templateNameContext,
        });
        application = Vue.createMwApp(component);
        registerSourceManagerComponents(application, Codex);
        application.mount(host);
        if (!cleaned) removeActiveSourceManager = cleanup;
    } catch (error) {
        try {
            cleanup();
        } catch (cleanupError) {
            dependencies.logger.warn('dialog.cleanup.failed', {
                error: cleanupError,
            });
        }
        throw error;
    }
    // Codex activates its focus trap through two Vue render ticks.
    // Focus the lookup on the next frame, after that initialization completes.
    requestAnimationFrame(function focusSourceInput(): void {
        if (cleaned) {
            return;
        }
        document
            .querySelector<HTMLInputElement>(
                '.kanade-source-editor-source-manager__source-lookup input',
            )
            ?.focus({ preventScroll: true });
    });
}

/**
 * Creates the source-manager Vue component.
 *
 * @param Vue - Vue value.
 * @param editor - Editor value.
 * @param cleanup - Cleanup value.
 * @param configuration - Operation configuration.
 * @returns Created the source-manager Vue component.
 */
function createSourceManagerComponent(
    Vue: VueModule,
    editor: EditBox,
    cleanup: () => void,
    configuration: SourceManagerConfiguration,
): unknown {
    const setup = function setup(): Record<string, unknown> {
        const { options } = configuration;
        const stackedActions = configuration.stackedActions ?? Vue.ref(false);
        const getDialogActionOrder = (actions: string[]): string[] =>
            stackedActions.value ? actions.toReversed() : actions;
        const state = createSourceManagerState(
            Vue,
            editor,
            {
                options,
                wiki: configuration.wiki,
                templateNameContext: configuration.templateNameContext,
            },
            configuration.wiki.wikiId,
            formatError,
        );
        const actions = createSourceManagerActions(editor, state, {
            ...configuration,
            cleanup,
        });
        const draftRowKey = createDraftRowKey();
        const setSourceManagerContent = createSourceManagerContentBinding();
        return {
            getDialogActionOrder,
            analysisTabs: Vue.computed(() => buildAnalysisTabs(state)),
            canCheckCs1Tool: ['enwiki', 'zhwiki'].includes(state.wiki.wikiId),
            formattingSettingsAvailable:
                configuration.openFormattingSettings !== undefined,
            draftRowKey,
            addParameterIcon: cdxIconAdd,
            closeIcon: cdxIconClose,
            confirmIcon: cdxIconCheck,
            editSourceIcon: cdxIconEdit,
            hasCitationIdentity: Vue.computed(
                () =>
                    state.draft.value != null &&
                    hasSourceDraftCitationIdentity(state.draft.value),
            ),
            interfaceLocale,
            joinAuthorIcon: cdxIconMerge,
            linkIcon: cdxIconLink,
            parameterAliasIcon: cdxIconKey,
            cs1WikiLabel:
                state.wiki.wikiId === 'zhwiki'
                    ? msg('checker.chinese')
                    : msg('checker.english'),
            magicWandIcon: cdxIconMagicWand,
            msg,
            setSourceManagerContent,
            openUrlIcon: cdxIconNewWindow,
            customAnalysisReplacement: CUSTOM_ANALYSIS_REPLACEMENT,
            sourceTableColumns: [
                {
                    id: 'reference',
                    label: msg('lookup.authorYear'),
                    width: '28%',
                },
                { id: 'source', label: msg('lookup.sourceColumn') },
                {
                    id: 'actions',
                    label: msg('lookup.actions'),
                    width: '6rem',
                },
            ],
            sourceTemplateLabel: (value: string) =>
                getCanonicalTemplateNameFromKey(
                    value,
                    configuration.templateNameContext,
                ),
            splitAuthorIcon: cdxIconMerge,
            switchStatusIcon: cdxIconUpdate,
            templateOptions: Vue.computed(() =>
                templateOptions.getSourceDraftTemplateOptions(
                    state.draft.value?.template,
                ),
            ),
            useSourceIcon: cdxIconReferenceExisting,
            ...actions,
            ...state,
        };
    };
    return Vue.defineComponent({
        name: 'CitationSourceManager',
        setup,
        template: SOURCE_MANAGER_TEMPLATE,
    });
}

/** Measures the tab bar so each source header sticks directly beneath it. */
function createSourceManagerContentBinding(): (element: unknown) => void {
    let currentContent: HTMLElement | null = null;
    let observer: ResizeObserver | null = null;
    return function setSourceManagerContent(element: unknown): void {
        if (element === currentContent) return;
        observer?.disconnect();
        observer = null;
        currentContent = element as HTMLElement | null;
        const content = currentContent;
        const tabs = content?.querySelector<HTMLElement>('.cdx-tabs__header');
        if (content == null || tabs == null) return;
        function updateTabHeight(): void {
            if (currentContent !== content) return;
            const height = tabs!.getBoundingClientRect().height;
            if (height > 0) {
                content!.style.setProperty(
                    '--kanade-source-editor-source-manager-tabs-height',
                    `${height}px`,
                );
            }
        }
        updateTabHeight();
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(updateTabHeight);
            observer.observe(tabs);
        }
    };
}

/**
 * Creates stable Vue keys for mutable citation parameter rows.
 *
 * @returns Created stable Vue keys for mutable citation parameter rows.
 */
function createDraftRowKey(): (row: SourceDraftRow) => number {
    const keys = new WeakMap<SourceDraftRow, number>();
    let nextKey = 0;
    return function getDraftRowKey(row): number {
        let key = keys.get(row);
        if (key == null) {
            key = nextKey;
            nextKey += 1;
            keys.set(row, key);
        }
        return key;
    };
}

/** Sizes visible Codex text areas before the dialog is painted. */
function scheduleVisibleTextAreaAutosize(): void {
    requestAnimationFrame(function autosizeVisibleTextAreas(): void {
        const textareas = document.querySelectorAll<HTMLTextAreaElement>(
            AUTOSIZE_DIALOG_TEXTAREA_SELECTOR,
        );
        for (const textarea of textareas) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    });
}

/**
 * Runs one explicit, article-wide CS1 parse check.
 *
 * @param context - Context value.
 */
async function fetchArticleCs1Issues(
    context: SourceManagerActionContext,
): Promise<void> {
    const { editor, state } = context;
    if (state.cs1ToolStatus.value === 'checking') {
        return;
    }
    refreshExistingSources(editor, state);
    const sources = state.existingSources.value.filter(
        (source) => source.status === 'standard',
    );
    state.cs1ToolMessages.value = [];
    state.cs1ToolSources.value = [];
    state.cs1ToolStatus.value = 'checking';
    if (sources.length === 0) {
        state.cs1ToolStatus.value = 'complete';
        return;
    }
    try {
        const review = await context.cs1Review.checkArticleSources(
            sources,
            getCs1CheckOptions(context.wiki),
        );
        state.cs1ToolSources.value = review.sources;
        state.cs1ToolMessages.value = review.messages;
        state.cs1ToolStatus.value = 'complete';
    } catch {
        state.cs1ToolStatus.value = 'unavailable';
    }
}

function getCs1CheckOptions(wiki: SourceManagerWikiContext) {
    return {
        pageTitle: wiki.pageTitle || msg('tool.validationTitle'),
        wikiPolicy: wiki.wikiPolicy,
    };
}

/**
 * Creates source lookup, insertion, and editing actions.
 *
 * @param editor - Editor value.
 * @param state - Mutable operation state.
 * @param services - Injected service adapters.
 * @returns Created source lookup, insertion, and editing actions.
 */
function createSourceManagerActions(
    editor: EditBox,
    state: SourceManagerState,
    services: SourceManagerActionServices,
) {
    const { cleanup } = services;
    let openFormattingAfterClose = false;
    const close = function close(): void {
        state.open.value = false;
        queueMicrotask(cleanup);
        if (openFormattingAfterClose) {
            openFormattingAfterClose = false;
            queueMicrotask(function returnToFormatting(): void {
                void services.openFormattingSettings?.();
            });
        }
    };
    const context = { ...services, close, editor, state };
    const navigation = createNavigationActions(context);
    return {
        async openFormattingSettings(): Promise<void> {
            if (
                !state.open.value ||
                state.loading.value ||
                !services.openFormattingSettings
            )
                return;
            if (state.analysisUndo.value != null) {
                openFormattingAfterClose = true;
                navigation.close();
                return;
            }
            close();
            await services.openFormattingSettings();
        },
        ...navigation,
        cancelCloseConfirmation(): void {
            openFormattingAfterClose = false;
            navigation.cancelCloseConfirmation();
        },
        onCloseConfirmationOpenChange(open: boolean): void {
            if (!open) openFormattingAfterClose = false;
            navigation.onCloseConfirmationOpenChange(open);
        },
        ...createLookupActions(context),
        ...createDraftActions(context),
        ...createToolActions(context),
    };
}

function showActionNotification(
    context: Pick<SourceManagerDependencies, 'notifyAction'>,
    key: string,
    type: ActionNotificationType,
    message: string,
): void {
    context.notifyAction({ key, message, type });
}

function notifyError(
    context: Pick<SourceManagerDependencies, 'notifyAction'>,
    key: string,
    message: string,
): void {
    showActionNotification(context, key, 'error', message);
}

function notifySuccess(
    context: Pick<SourceManagerDependencies, 'notifyAction'>,
    key: string,
    message: string,
): void {
    showActionNotification(context, key, 'success', message);
}

function notifyWarning(
    context: Pick<SourceManagerDependencies, 'notifyAction'>,
    key: string,
    message: string,
): void {
    showActionNotification(context, key, 'warning', message);
}

/**
 * Creates dialog navigation actions.
 *
 * @param context - Context value.
 * @returns Created dialog navigation actions.
 */
function createNavigationActions(context: SourceManagerActionContext) {
    return {
        ...createManagerCloseActions(context),
        ...createDraftPopupNavigationActions(context),
        ...createCloseConfirmationActions(context),
    };
}

function createManagerCloseActions(
    context: SourceManagerActionContext,
): Pick<MainDialogActions, 'cancelAllChanges' | 'close' | 'onOpenChange'> {
    function cancelAllChanges(): void {
        cancelAllSourceManagerChanges(context);
    }
    function requestClose(): void {
        if (context.state.analysisUndo.value != null) {
            context.state.closeConfirmationOpen.value = true;
            return;
        }
        context.close();
    }
    function onOpenChange(value: boolean): void {
        if (value) {
            return;
        }
        if (context.state.analysisUndo.value != null) {
            context.state.open.value = true;
            context.state.closeConfirmationOpen.value = true;
            return;
        }
        queueMicrotask(context.cleanup);
    }
    return { cancelAllChanges, close: requestClose, onOpenChange };
}

/**
 * Restores all safe editor writes made since the dialog opened.
 *
 * @param context - Context value.
 */
function cancelAllSourceManagerChanges(
    context: SourceManagerActionContext,
): void {
    const { editor, state } = context;
    const snapshot = state.sessionUndo.value;
    if (
        snapshot == null ||
        getAnalysisUndoText(snapshot, editor.read()) == null
    ) {
        showActionNotification(
            context,
            'cancel-unavailable',
            'warning',
            msg('feedback.cancelUnavailable'),
        );
        return;
    }
    if (snapshot.beforeText !== snapshot.afterText) {
        context.writePreservingPosition(editor, snapshot.beforeText);
    }
    clearAnalysisUndo(state);
    context.close();
    queueMicrotask(function focusEditor(): void {
        editor.focus();
    });
}

function createDraftPopupNavigationActions(
    context: SourceManagerActionContext,
): Pick<DraftDialogActions, 'closeDraftPopup' | 'onDraftPopupOpenChange'> {
    function closeDraftPopup(): void {
        const { state } = context;
        const reviewTool = state.draftReviewTool.value;
        resetSourceDraft(state);
        if (reviewTool != null) {
            showCheckerResults(state, reviewTool);
        }
    }
    function onDraftPopupOpenChange(open: boolean): void {
        if (!open && context.state.draft.value != null) {
            closeDraftPopup();
        }
    }
    return { closeDraftPopup, onDraftPopupOpenChange };
}

function createCloseConfirmationActions(
    context: SourceManagerActionContext,
): CloseDialogActions {
    function cancelCloseConfirmation(): void {
        context.state.closeConfirmationOpen.value = false;
    }
    function keepAnalysisChangesAndClose(): void {
        context.state.analysisUndo.value = null;
        context.state.closeConfirmationOpen.value = false;
        context.close();
    }
    function undoAnalysisChangesAndClose(): void {
        if (restoreAnalysisSession(context)) {
            context.state.closeConfirmationOpen.value = false;
            context.close();
        }
    }
    function onCloseConfirmationOpenChange(open: boolean): void {
        if (!open) {
            cancelCloseConfirmation();
        }
    }
    return {
        cancelCloseConfirmation,
        keepAnalysisChangesAndClose,
        onCloseConfirmationOpenChange,
        undoAnalysisChangesAndClose,
    };
}

/**
 * Creates parameter-editing and draft-save actions.
 *
 * @param context - Context value.
 * @returns Created parameter-editing and draft-save actions.
 */
function createDraftActions(
    context: SourceManagerActionContext,
): Omit<DraftDialogActions, 'closeDraftPopup' | 'onDraftPopupOpenChange'> &
    ParameterAliasActions {
    const { state } = context;
    function addParameter(): void {
        state.draft.value?.rows.push(createBlankDraftRow());
    }
    function insertParameterBelow(index: number): void {
        const draft = state.draft.value;
        if (draft?.rows[index] == null) {
            return;
        }
        draft.rows.splice(index + 1, 0, createBlankDraftRow());
        // Blank rows leave checked wikitext unchanged but shift its field errors.
        state.checkedCs1CellErrors.value = new Map(
            Array.from(
                state.checkedCs1CellErrors.value,
                ([rowIndex, errors]) => [
                    rowIndex > index ? rowIndex + 1 : rowIndex,
                    errors,
                ],
            ),
        );
        clearDraftValidationError();
    }
    function clearDraftValidationError(): void {
        clearDraftValidationSummary(state);
    }
    function changeDraftTemplate(template: string | null): void {
        clearDraftValidationError();
        updateDraftTemplate(state, template);
    }
    function sortParameters(): void {
        const draft = state.draft.value;
        if (draft != null) {
            const collisionNotice = formatDraftParameterCollisionNotice(draft);
            if (state.formatScriptTitles.value) {
                formatSourceDraftScriptTitle(
                    draft,
                    state.wiki.wikiId,
                    state.scriptTitleMode.value,
                    state.wiki.contentLanguage,
                );
            }
            canonicalizeSourceDraft(draft, state.wiki.wikiPolicy);
            state.warning.value = appendWarning(
                state.warning.value,
                collisionNotice,
            );
            showActionNotification(
                context,
                'parameters-sorted',
                'success',
                msg('feedback.parametersSorted'),
            );
        }
    }
    async function autofillDate(index: number): Promise<void> {
        await autofillDraftDate(context, index);
    }
    async function linkOrganization(index: number): Promise<void> {
        await linkDraftOrganization(context, index);
    }
    function getDraftFieldLabel(
        index: number,
        field: keyof validation.SourceDraftRowErrors,
        parameter: string,
    ): string {
        return buildDraftFieldLabel(state, index, field, parameter);
    }
    function getParameterNameTooltip(parameter: string): string {
        const draft = state.draft.value;
        if (draft == null) {
            return '';
        }
        const info = getSourceDraftParameterAliasInfo(draft, parameter);
        if (info == null || (!info.isAlias && info.aliases.length === 0)) {
            return '';
        }
        const aliases = info.aliases.join(', ');
        return info.isAlias
            ? msg('draft.parameterAliasOf', {
                  aliases,
                  canonical: info.canonical,
                  parameter,
              })
            : msg('draft.parameterAliases', { aliases });
    }
    function duplicateDraft(): void {
        if (
            state.draft.value == null ||
            state.editingSource.value == null ||
            state.editingSource.value.status !== 'standard'
        ) {
            return;
        }
        state.editingSource.value = null;
        state.error.value = '';
        state.warning.value = msg('lookup.duplicateWarning');
        showActionNotification(
            context,
            'source-duplicated',
            'success',
            msg('feedback.sourceDuplicated'),
        );
    }
    async function applyDraft(): Promise<void> {
        const reviewTool = state.draftReviewTool.value;
        const draft = state.draft.value;
        if (draft != null) {
            formatSourceDraftRows(draft);
        }
        if (!saveSourceDraft(context, false) || reviewTool !== 'cs1') {
            return;
        }
        await recheckAppliedCs1Draft(context);
    }
    async function saveDraft(): Promise<void> {
        if (state.draftReviewTool.value != null) {
            saveReviewedDraft(context);
            return;
        }
        if (state.editingSource.value != null) {
            saveSourceDraft(context, true);
            return;
        }
        await saveNewSourceDraft(context);
    }
    function switchUrlStatus(index: number): void {
        const row = state.draft.value?.rows[index];
        if (row == null) {
            return;
        }
        const current = normalizeDraftName(row.value);
        const currentIndex = URL_STATUSES.indexOf(
            current as (typeof URL_STATUSES)[number],
        );
        row.value = URL_STATUSES[(currentIndex + 1) % URL_STATUSES.length];
    }
    return {
        ...createAuthorDraftActions(state),
        ...createAliasDraftActions(state, scheduleVisibleTextAreaAutosize),
        addParameter,
        applyDraft,
        autofillDate,
        changeDraftTemplate,
        clearDraftValidationError,
        duplicateDraft,
        getDraftFieldLabel,
        getOpenableDraftUrl,
        getParameterNameTooltip,
        getDateAutofillTooltip,
        isDateAutofillParameter,
        isLinkableDraftParameter,
        isUrlDraftParameter,
        insertParameterBelow,
        linkOrganization,
        saveDraft,
        sortParameters,
        switchUrlStatus,
    };
}

/**
 * Whether a citation parameter contains a URL.
 *
 * @param parameter - Parameter value.
 * @returns Whether the condition is met.
 */
function isUrlDraftParameter(parameter: string): boolean {
    return URL_DRAFT_PARAMETERS.has(normalizeDraftName(parameter));
}

/**
 * Gets a safe HTTP(S) href that preserves entered archive links.
 *
 * @param value - Value to process.
 * @returns Resulting text.
 */
function getOpenableDraftUrl(value: string): string {
    const parsed = parseSourceUrl(value);
    return parsed?.archiveUrl || parsed?.originalUrl || '';
}

/**
 * Builds an accessible draft-field label with help or an error.
 *
 * @param state - Mutable operation state.
 * @param index - Source index.
 * @param field - Field value.
 * @param parameter - Parameter value.
 * @returns Built accessible draft-field label with help or an error.
 */
function buildDraftFieldLabel(
    state: SourceManagerState,
    index: number,
    field: keyof validation.SourceDraftRowErrors,
    parameter: string,
): string {
    const label = getDraftFieldLabelText(field, parameter);
    const error = state.draftCellErrors.value.get(index)?.[field];
    const nameCell = state.citationNameCells.value.get(index);
    const help =
        error == null && field === 'value' && nameCell != null
            ? msg(
                  nameCell === 'value'
                      ? 'draft.nameValueHelp'
                      : 'draft.nameAliasHelp',
              )
            : '';
    const context = error ?? help;
    return context === ''
        ? label
        : msg('draft.fieldContext', { label, message: context });
}

/**
 * Gets the base label for one compact citation-table control.
 *
 * @param field - Field value.
 * @param parameter - Parameter value.
 * @returns Resulting text.
 */
function getDraftFieldLabelText(
    field: keyof validation.SourceDraftRowErrors,
    parameter: string,
): string {
    if (field === 'name') {
        return msg('draft.parameterName');
    }
    if (field === 'value') {
        return msg('draft.valueLabel', { parameter });
    }
    return normalizeDraftName(parameter) === 'url'
        ? msg('draft.sourceKeyLabel')
        : msg('draft.aliasLabel', { parameter });
}

/**
 * Creates explicit checker-popup actions for the Tools tab.
 *
 * @param context - Context value.
 * @returns Created explicit checker-popup actions for the Tools tab.
 */
function createToolActions(context: SourceManagerActionContext): ToolActions {
    return {
        ...createAnalysisToolActions(context),
        ...createCheckerToolActions(context),
    };
}

/**
 * Creates citation-analysis popup and replacement actions.
 *
 * @param context - Context value.
 * @returns Created citation-analysis popup and replacement actions.
 */
function createAnalysisToolActions(
    context: SourceManagerActionContext,
): AnalysisToolActions {
    function openAnalysisTool(): void {
        refreshAndOpenAnalysisTool(context.state);
    }
    return {
        ...createAnalysisReplacementActions(context),
        clearAnalysisSelection,
        getAnalysisReplacement,
        isAnalysisOccurrenceUnchanged,
        openAnalysisTool,
        selectAllAnalysisOccurrences,
    };
}

function refreshAndOpenAnalysisTool(state: SourceManagerState): void {
    refreshSourceAnalysis(state);
    state.activeAnalysisTab.value = getInitialAnalysisTab(state);
    state.toolPopup.value = 'analysis';
    state.toolPopupOpen.value = true;
}

function getInitialAnalysisTab(state: SourceManagerState): SourceAnalysisCell {
    const findings = [
        ...state.sourceAnalysis.value.findings,
        ...state.appliedAnalysisFindings.value.map((entry) => entry.finding),
    ];
    const hasValueFinding = findings.some((finding) =>
        isAnalysisFindingInTab(finding, 'value'),
    );
    return hasValueFinding || findings.length === 0 ? 'value' : 'alias';
}

function createAnalysisReplacementActions(
    context: SourceManagerActionContext,
): AnalysisReplacementActions {
    function countSelectedAnalysisReplacements(): number {
        return listSelectedAnalysisReplacements(
            context.state.sourceAnalysis.value,
            context.state.activeAnalysisTab.value,
        ).length;
    }
    function countSelectedFindingReplacements(
        finding: EditableSourceAnalysisFinding,
    ): number {
        return listSelectedFindingReplacements(finding).length;
    }
    function applyAnalysisReplacements(): void {
        applyAllSelectedAnalysisFindings(context);
    }
    function applyAnalysisFinding(
        finding: EditableSourceAnalysisFinding,
    ): void {
        applyOneSelectedAnalysisFinding(context, finding);
    }
    function revertAppliedAnalysisFinding(changeId: number): void {
        revertAnalysisFinding(context, changeId);
    }
    return {
        applyAnalysisFinding,
        applyAnalysisReplacements,
        countSelectedAnalysisReplacements,
        countSelectedFindingReplacements,
        revertAppliedAnalysisFinding,
    };
}

function applyAllSelectedAnalysisFindings(
    context: SourceManagerActionContext,
): void {
    const selected = listSelectedAnalysisFindings(
        context.state.sourceAnalysis.value,
        context.state.activeAnalysisTab.value,
    );
    applySelectedAnalysisFindings(context, selected);
}

function applyOneSelectedAnalysisFinding(
    context: SourceManagerActionContext,
    finding: EditableSourceAnalysisFinding,
): void {
    applySelectedAnalysisFindings(context, [
        {
            finding,
            replacements: listSelectedFindingReplacements(finding),
        },
    ]);
}

/**
 * Creates the CS1 and non-CS1 checker popup actions.
 *
 * @param context - Context value.
 * @returns Created the CS1 and non-CS1 checker popup actions.
 */
function createCheckerToolActions(
    context: SourceManagerActionContext,
): CheckerToolActions {
    const { state } = context;
    const recheckCs1Tool = () => fetchArticleCs1Issues(context);
    async function openCs1Tool(): Promise<void> {
        state.toolPopup.value = 'cs1';
        state.toolPopupOpen.value = true;
        await recheckCs1Tool();
    }
    function openNonCs1Tool(): void {
        state.toolPopup.value = 'non-cs1';
        state.toolPopupOpen.value = true;
    }
    function closeToolPopup(): void {
        state.toolPopupOpen.value = false;
    }
    function onToolPopupOpenChange(open: boolean): void {
        if (!open) {
            state.toolPopupOpen.value = false;
        }
    }
    function reviewNonCs1Source(sourceId: string): void {
        closeToolPopup();
        reviewNonCs1CheckedSource(state, sourceId);
    }
    function reviewCs1Source(sourceId: string): void {
        closeToolPopup();
        reviewCs1CheckedSource(state, sourceId);
    }
    return {
        closeToolPopup,
        onToolPopupOpenChange,
        openCs1Tool,
        openNonCs1Tool,
        recheckCs1Tool,
        reviewCs1Source,
        reviewNonCs1Source,
    };
}

function selectAllAnalysisOccurrences(
    finding: EditableSourceAnalysisFinding,
): void {
    for (const occurrence of finding.occurrences) {
        occurrence.selected = true;
    }
}

function clearAnalysisSelection(finding: EditableSourceAnalysisFinding): void {
    for (const occurrence of finding.occurrences) {
        occurrence.selected = false;
    }
}

function getAnalysisReplacement(
    finding: EditableSourceAnalysisFinding,
): string {
    return finding.replacementChoice === CUSTOM_ANALYSIS_REPLACEMENT
        ? finding.customReplacement
        : finding.replacementChoice;
}

function isAnalysisOccurrenceUnchanged(
    finding: EditableSourceAnalysisFinding,
    occurrence: SelectableSourceAnalysisOccurrence,
): boolean {
    return occurrence.value === getAnalysisReplacement(finding);
}

/**
 * Writes selected analysis cases as one editor operation.
 *
 * @param context - Context value.
 * @param selectedFindings - Selected findings value.
 */
function applySelectedAnalysisFindings(
    context: SourceManagerActionContext,
    selectedFindings: SelectedAnalysisFinding[],
): void {
    const selected = selectedFindings.filter(
        (entry) => entry.replacements.length > 0,
    );
    const replacements = selected.flatMap((entry) => entry.replacements);
    if (replacements.length === 0) {
        showActionNotification(
            context,
            'analysis-selection-required',
            'info',
            msg('analysis.selectOne'),
        );
        return;
    }
    try {
        writeSelectedAnalysisFindings(context, selected, replacements);
    } catch (error) {
        showActionNotification(
            context,
            'analysis-apply-failed',
            'error',
            formatError(error),
        );
        return;
    }
    const message = formatPluralMessage(
        replacements.length,
        'analysis.replacedOne',
        'analysis.replacedMany',
    );
    showActionNotification(context, 'analysis-applied', 'success', message);
}

function writeSelectedAnalysisFindings(
    context: SourceManagerActionContext,
    selected: SelectedAnalysisFinding[],
    replacements: SourceAnalysisReplacement[],
): void {
    const { editor, state } = context;
    const appliedFindings = buildAppliedAnalysisFindings(state, selected);
    const beforeText = editor.read();
    const text = applySourceAnalysisReplacements(
        beforeText,
        state.existingSources.value,
        replacements,
        sourceAnalysisMessages,
    );
    context.writePreservingPosition(editor, text);
    recordSessionWrite(state, beforeText, text);
    recordAnalysisUndo(state, beforeText, text);
    state.appliedAnalysisFindings.value.push(...appliedFindings);
    refreshExistingSources(editor, state);
    refreshSourceAnalysis(state);
}

/**
 * Captures source identities used to reverse each applied case.
 *
 * @param state - Mutable operation state.
 * @param selected - Selected value.
 * @returns Source identities used to reverse each applied case.
 */
function buildAppliedAnalysisFindings(
    state: SourceManagerState,
    selected: SelectedAnalysisFinding[],
): AppliedAnalysisFinding[] {
    const sources = new Map(
        state.existingSources.value.map((source) => [source.id, source]),
    );
    return selected.map(function buildAppliedFinding(entry) {
        const targets = entry.replacements.map(
            function buildTarget(replacement) {
                const source = sources.get(replacement.sourceId);
                if (source == null) {
                    throw new Error(msg('analysis.sourceMissing'));
                }
                return {
                    cell: replacement.cell,
                    oldValue: replacement.oldValue,
                    parameter: replacement.parameter,
                    replacement: replacement.replacement,
                    rowIndex: replacement.rowIndex,
                    sourceGroup: source.group,
                    sourceId: source.id,
                    sourceReferenceName: source.referenceName,
                    sourceTemplateStart: source.templateStart,
                };
            },
        );
        analysisChangeSequence += 1;
        return {
            changeId: analysisChangeSequence,
            finding: entry.finding,
            targets,
        };
    });
}

/**
 * Reverses one applied case without discarding later cases.
 *
 * @param context - Context value.
 * @param changeId - Change id value.
 */
function revertAnalysisFinding(
    context: SourceManagerActionContext,
    changeId: number,
): void {
    const { editor, state } = context;
    const applied = state.appliedAnalysisFindings.value.find(
        (entry) => entry.changeId === changeId,
    );
    if (applied == null) {
        return;
    }
    try {
        const beforeText = editor.read();
        const replacements = buildReverseAnalysisReplacements(state, applied);
        const afterText = applySourceAnalysisReplacements(
            beforeText,
            state.existingSources.value,
            replacements,
            sourceAnalysisMessages,
        );
        context.writePreservingPosition(editor, afterText);
        recordSessionWrite(state, beforeText, afterText);
        recordAnalysisUndo(state, beforeText, afterText);
        state.appliedAnalysisFindings.value =
            state.appliedAnalysisFindings.value.filter(
                (entry) => entry.changeId !== changeId,
            );
        refreshExistingSources(editor, state);
        refreshSourceAnalysis(state);
        clearCompletedAnalysisUndo(state, afterText);
        notifyAnalysisReverted(context);
    } catch (error) {
        notifyAnalysisRevertFailed(context, error);
    }
}

function notifyAnalysisReverted(context: SourceManagerActionContext): void {
    notifySuccess(context, 'analysis-reverted', msg('analysis.revertComplete'));
}

function notifyAnalysisRevertFailed(
    context: SourceManagerActionContext,
    error: unknown,
): void {
    notifyError(context, 'analysis-revert-failed', formatError(error));
}

function buildReverseAnalysisReplacements(
    state: SourceManagerState,
    applied: AppliedAnalysisFinding,
): SourceAnalysisReplacement[] {
    return applied.targets.map(function reverseTarget(target) {
        const source = findAnalysisTargetSource(
            state.existingSources.value,
            target,
        );
        const rowIndex = findAnalysisTargetRow(source, target);
        return {
            cell: target.cell,
            oldValue: target.replacement,
            parameter: target.parameter,
            replacement: target.oldValue,
            rowIndex,
            sourceId: source.id,
        };
    });
}

function findAnalysisTargetSource(
    sources: ExistingSource[],
    target: AppliedAnalysisTarget,
): ExistingSource {
    const exact = sources.find((source) => source.id === target.sourceId);
    if (exact != null) {
        return exact;
    }
    const candidates = sources
        .filter(
            (source) =>
                source.group === target.sourceGroup &&
                source.referenceName === target.sourceReferenceName,
        )
        .toSorted(
            (left, right) =>
                Math.abs(left.templateStart - target.sourceTemplateStart) -
                Math.abs(right.templateStart - target.sourceTemplateStart),
        );
    const source = candidates[0];
    if (source == null) {
        throw new Error(msg('analysis.revertUnavailable'));
    }
    return source;
}

function findAnalysisTargetRow(
    source: ExistingSource,
    target: AppliedAnalysisTarget,
): number {
    const preferred = source.draft.rows[target.rowIndex];
    if (isAnalysisTargetRow(preferred, target)) {
        return target.rowIndex;
    }
    const rowIndex = source.draft.rows.findIndex((row) =>
        isAnalysisTargetRow(row, target),
    );
    if (rowIndex < 0) {
        throw new Error(msg('analysis.revertUnavailable'));
    }
    return rowIndex;
}

function isAnalysisTargetRow(
    row: SourceDraftRow | undefined,
    target: AppliedAnalysisTarget,
): boolean {
    if (row == null || normalizeDraftName(row.name) !== target.parameter) {
        return false;
    }
    const currentValue =
        target.cell === 'alias' ? row.alias.trim() : row.value.trim();
    return currentValue === target.replacement;
}

function clearCompletedAnalysisUndo(
    state: SourceManagerState,
    currentText: string,
): void {
    if (
        state.appliedAnalysisFindings.value.length === 0 &&
        state.analysisUndo.value?.beforeText === currentText
    ) {
        state.analysisUndo.value = null;
    }
}

/**
 * Records a chain of analysis-only writes as one session undo.
 *
 * @param state - Mutable operation state.
 * @param beforeText - Before text value.
 * @param afterText - After text value.
 */
function recordAnalysisUndo(
    state: SourceManagerState,
    beforeText: string,
    afterText: string,
): void {
    state.analysisUndo.value = appendAnalysisUndo(
        state.analysisUndo.value,
        beforeText,
        afterText,
    );
}

/**
 * Extends the whole-dialog undo snapshot after an editor write.
 *
 * @param state - Mutable operation state.
 * @param beforeText - Before text value.
 * @param afterText - After text value.
 */
function recordSessionWrite(
    state: SourceManagerState,
    beforeText: string,
    afterText: string,
): void {
    if (beforeText === afterText) {
        return;
    }
    const snapshot = state.sessionUndo.value;
    if (snapshot == null || snapshot.afterText !== beforeText) {
        state.sessionUndo.value = null;
        return;
    }
    state.sessionUndo.value = {
        afterText,
        beforeText: snapshot.beforeText,
    };
}

function clearAnalysisUndo(state: SourceManagerState): void {
    state.analysisUndo.value = null;
    state.appliedAnalysisFindings.value = [];
    state.analysisFindingOrder.value = [];
}

/**
 * Restores analysis writes unless a later editor change intervened.
 *
 * @param context - Context value.
 * @returns Whether the condition is met.
 */
function restoreAnalysisSession(context: SourceManagerActionContext): boolean {
    const { editor, state } = context;
    const snapshot = state.analysisUndo.value;
    if (snapshot == null) {
        return true;
    }
    const beforeText = getAnalysisUndoText(snapshot, editor.read());
    if (beforeText == null) {
        clearAnalysisUndo(state);
        showActionNotification(
            context,
            'analysis-undo-unavailable',
            'warning',
            msg('analysis.undoUnavailable'),
        );
        return false;
    }
    const currentText = editor.read();
    context.writePreservingPosition(editor, beforeText);
    recordSessionWrite(state, currentText, beforeText);
    clearAnalysisUndo(state);
    refreshExistingSources(editor, state);
    refreshSourceAnalysis(state);
    showActionNotification(
        context,
        'analysis-undo-complete',
        'success',
        msg('analysis.undoComplete'),
    );
    return true;
}

/**
 * Expands checked occurrences into domain-layer replacements.
 *
 * @param analysis - Analysis value.
 * @param tab - Tab value.
 * @returns Resulting values.
 */
function listSelectedAnalysisReplacements(
    analysis: EditableCitationSourceAnalysis,
    tab: SourceAnalysisCell,
): SourceAnalysisReplacement[] {
    return analysis.findings
        .filter((finding) => isAnalysisFindingInTab(finding, tab))
        .flatMap(listSelectedFindingReplacements);
}

function listSelectedAnalysisFindings(
    analysis: EditableCitationSourceAnalysis,
    tab: SourceAnalysisCell,
): SelectedAnalysisFinding[] {
    return analysis.findings
        .filter((finding) => isAnalysisFindingInTab(finding, tab))
        .map((finding) => ({
            finding,
            replacements: listSelectedFindingReplacements(finding),
        }));
}

/**
 * Expands checked occurrences from one finding into replacements.
 *
 * @param finding - Finding value.
 * @returns Resulting values.
 */
function listSelectedFindingReplacements(
    finding: EditableSourceAnalysisFinding,
): SourceAnalysisReplacement[] {
    if (
        finding.replacementChoice === CUSTOM_ANALYSIS_REPLACEMENT &&
        finding.customReplacement === ''
    ) {
        return [];
    }
    return finding.occurrences.flatMap(function toReplacement(occurrence) {
        if (
            !occurrence.selected ||
            isAnalysisOccurrenceUnchanged(finding, occurrence)
        ) {
            return [];
        }
        return [
            {
                cell: occurrence.cell,
                oldValue: occurrence.value,
                parameter: occurrence.parameter,
                replacement: getAnalysisReplacement(finding),
                rowIndex: occurrence.rowIndex,
                sourceId: occurrence.sourceId,
            },
        ];
    });
}

function reviewCs1CheckedSource(
    state: SourceManagerState,
    sourceId: string,
): void {
    const checked = state.cs1ToolSources.value.find(
        (result) => result.source.id === sourceId,
    );
    if (checked == null) {
        return;
    }
    const queue = preloadCs1ReviewQueue(state, sourceId);
    openCs1ReviewSource(state, sourceId, checked.html, checked.messages, queue);
}

/**
 * Opens a prechecked CS1 draft without another API request.
 *
 * @param state - Mutable operation state.
 * @param sourceId - Source id value.
 * @param checkedHtml - Checked html value.
 * @param checkedMessages - Checked messages value.
 * @param queue - Queue value.
 * @returns Whether the condition is met.
 */
function openCs1ReviewSource(
    state: SourceManagerState,
    sourceId: string,
    checkedHtml: string,
    checkedMessages: string[],
    queue: PreloadedCheckerSource[],
): boolean {
    openExistingSourceWhenIdle(state, sourceId);
    const draft = state.draft.value;
    if (draft == null) {
        return false;
    }
    state.draftReviewQueue.value = queue;
    state.draftReviewTool.value = 'cs1';
    const result = parseCs1ValidationResult(
        draft,
        checkedHtml,
        checkedMessages,
    );
    state.checkedCs1CellErrors.value = result.cellErrors;
    state.checkedCs1Source.value = getCurrentCs1DraftFingerprint(state);
    if (result.messages.length > 0) {
        state.warning.value = result.messages.join('\n');
    }
    return true;
}

/**
 * Opens one non-CS1 result in the sequential checker-edit workflow.
 *
 * @param state - Mutable operation state.
 * @param sourceId - Source id value.
 */
function reviewNonCs1CheckedSource(
    state: SourceManagerState,
    sourceId: string,
): void {
    const source = findExistingSourceById(state, sourceId);
    if (source == null) {
        return;
    }
    const queue = preloadNonCs1ReviewQueue(state, sourceId);
    openNonCs1ReviewSource(state, sourceId, queue);
}

/**
 * Opens a preloaded non-CS1 draft in the checker workflow.
 *
 * @param state - Mutable operation state.
 * @param sourceId - Source id value.
 * @param queue - Queue value.
 * @returns Whether the condition is met.
 */
function openNonCs1ReviewSource(
    state: SourceManagerState,
    sourceId: string,
    queue: PreloadedCheckerSource[],
): boolean {
    openExistingSourceWhenIdle(state, sourceId);
    if (state.draft.value == null) {
        return false;
    }
    state.draftReviewQueue.value = queue;
    state.draftReviewTool.value = 'non-cs1';
    return true;
}

/**
 * Preloads other CS1 results, wrapping after the final item.
 *
 * @param state - Mutable operation state.
 * @param sourceId - Source id value.
 * @returns Resulting values.
 */
function preloadCs1ReviewQueue(
    state: SourceManagerState,
    sourceId: string,
): PreloadedCheckerSource[] {
    const results = state.cs1ToolSources.value;
    const currentIndex = results.findIndex(
        (result) => result.source.id === sourceId,
    );
    if (currentIndex < 0) {
        return [];
    }
    const ordered = [
        ...results.slice(currentIndex + 1),
        ...results.slice(0, currentIndex),
    ];
    return ordered.flatMap(function preload(result) {
        return preloadCheckerSource(
            state,
            result.source,
            result.html,
            result.messages,
        );
    });
}

/**
 * Preloads other non-CS1 results, wrapping after the final item.
 *
 * @param state - Mutable operation state.
 * @param sourceId - Source id value.
 * @returns Resulting values.
 */
function preloadNonCs1ReviewQueue(
    state: SourceManagerState,
    sourceId: string,
): PreloadedCheckerSource[] {
    const sources = state.nonCs1Sources.value;
    const currentIndex = sources.findIndex((source) => source.id === sourceId);
    if (currentIndex < 0) {
        return [];
    }
    const ordered = [
        ...sources.slice(currentIndex + 1),
        ...sources.slice(0, currentIndex),
    ];
    return ordered.flatMap(function preload(source) {
        return preloadCheckerSource(state, source);
    });
}

/**
 * Captures one check result by stable source-list position.
 *
 * @param state - Mutable operation state.
 * @param source - Source text.
 * @param checkedHtml - Checked html value.
 * @param checkedMessages - Checked messages value.
 * @returns Captured check result by stable source-list position.
 */
function preloadCheckerSource(
    state: SourceManagerState,
    source: ExistingSource,
    checkedHtml: string = '',
    checkedMessages: string[] = [],
): PreloadedCheckerSource[] {
    const sourceIndex = state.existingSources.value.findIndex(
        (candidate) => candidate.id === source.id,
    );
    return sourceIndex < 0
        ? []
        : [{ checkedHtml, checkedMessages, sourceIndex }];
}

/**
 * Returns whether a row supports one-click date filling.
 *
 * @param name - Name to process.
 * @returns Whether a row supports one-click date filling.
 */
function isDateAutofillParameter(name: string): boolean {
    return isAccessDateParameter(name) || isArchiveDateParameter(name);
}

function isAccessDateParameter(name: string): boolean {
    return ['access-date', 'accessdate'].includes(normalizeDraftName(name));
}

function isArchiveDateParameter(name: string): boolean {
    return ['archive-date', 'archivedate'].includes(normalizeDraftName(name));
}

function getDateAutofillTooltip(name: string): string {
    return isAccessDateParameter(name)
        ? msg('draft.fillToday')
        : msg('draft.fillArchiveDate');
}

/**
 * Checks whether an organization field can become a local link.
 *
 * @param name - Name to process.
 * @returns Whether an organization field can become a local link.
 */
function isLinkableDraftParameter(name: string): boolean {
    return [
        'agency',
        'department',
        'institution',
        'journal',
        'magazine',
        'newspaper',
        'organization',
        'periodical',
        'publisher',
        'website',
        'work',
    ].includes(normalizeDraftName(name));
}

/**
 * Fills today's date or derives archive fields from an archive URL.
 *
 * @param context - Context value.
 * @param index - Source index.
 */
async function autofillDraftDate(
    context: SourceManagerActionContext,
    index: number,
): Promise<void> {
    const { state } = context;
    const draft = state.draft.value;
    const row = draft?.rows[index];
    if (draft == null || row == null || state.loading.value) {
        return;
    }
    if (isAccessDateParameter(row.name)) {
        row.value = formatLocalIsoDate(new Date());
        showActionNotification(
            context,
            'access-date-filled',
            'success',
            msg('feedback.accessDateFilled'),
        );
        return;
    }
    await autofillArchiveDate(context, draft, row);
}

/**
 * Resolves archive fields from an available snapshot.
 *
 * @param context - Context value.
 * @param draft - Source draft to process.
 * @param row - Row value.
 */
async function autofillArchiveDate(
    context: SourceManagerActionContext,
    draft: SourceDraft,
    row: SourceDraftRow,
): Promise<void> {
    const { state } = context;
    state.loading.value = true;
    try {
        const archiveUrl = getDraftRowValue(draft, 'archive-url');
        const parsed = parseSourceUrl(archiveUrl);
        if (parsed?.archiveDate) {
            row.value = parsed.archiveDate;
            notifyArchiveDateFilled(context);
            return;
        }
        const sourceUrl = getDraftRowValue(draft, 'url');
        const archive = await context.fetchAvailableArchive(sourceUrl);
        if (!isCurrentDraftRow(state, draft, row)) {
            return;
        }
        if (archive == null) {
            notifyArchiveSnapshotUnavailable(context);
            return;
        }
        setSourceDraftValue(draft, 'archive-url', archive.archiveUrl);
        row.value = archive.archiveDate;
        notifyArchiveFieldsFilled(context);
    } catch {
        reportArchiveCheckFailure(context, draft, row);
    } finally {
        state.loading.value = false;
    }
}

function notifyArchiveDateFilled(context: SourceManagerActionContext): void {
    notifySuccess(
        context,
        'archive-date-filled',
        msg('feedback.archiveDateFilled'),
    );
}

function notifyArchiveSnapshotUnavailable(
    context: SourceManagerActionContext,
): void {
    notifyError(
        context,
        'archive-snapshot-unavailable',
        msg('draft.noArchiveSnapshot'),
    );
}

function notifyArchiveFieldsFilled(context: SourceManagerActionContext): void {
    notifySuccess(
        context,
        'archive-fields-filled',
        msg('feedback.archiveFieldsFilled'),
    );
}

/**
 * Validates and redirect-normalizes an organization wikilink.
 *
 * @param context - Context value.
 * @param index - Source index.
 */
async function linkDraftOrganization(
    context: SourceManagerActionContext,
    index: number,
): Promise<void> {
    const { state } = context;
    const draft = state.draft.value;
    const row = draft?.rows[index];
    if (draft == null || row == null || state.loading.value) {
        return;
    }
    const enteredValue = row.value;
    state.loading.value = true;
    try {
        const linkedValue = await context.resolveWikiLink(enteredValue);
        if (
            !isCurrentDraftRow(state, draft, row) ||
            row.value !== enteredValue
        ) {
            return;
        }
        row.value = linkedValue;
        showActionNotification(
            context,
            'article-link-checked',
            'success',
            msg('feedback.articleLinkChecked'),
        );
    } catch {
        if (isCurrentDraftRow(state, draft, row)) {
            showActionNotification(
                context,
                'article-link-check-failed',
                'error',
                msg('feedback.linkCheckFailed'),
            );
        }
    } finally {
        state.loading.value = false;
    }
}

/**
 * Reports an archive failure only for an active draft row.
 *
 * @param context - Context value.
 * @param draft - Source draft to process.
 * @param row - Row value.
 */
function reportArchiveCheckFailure(
    context: SourceManagerActionContext,
    draft: SourceDraft,
    row: SourceDraftRow,
): void {
    if (isCurrentDraftRow(context.state, draft, row)) {
        showActionNotification(
            context,
            'archive-check-failed',
            'error',
            msg('feedback.archiveCheckFailed'),
        );
    }
}

/**
 * Checks whether an awaited action still targets this draft row.
 *
 * @param state - Mutable operation state.
 * @param draft - Source draft to process.
 * @param row - Row value.
 * @returns Whether an awaited action still targets this draft row.
 */
function isCurrentDraftRow(
    state: SourceManagerState,
    draft: SourceDraft,
    row: SourceDraftRow,
): boolean {
    return state.draft.value === draft && draft.rows.includes(row);
}

/**
 * Gets one case-insensitive draft row value.
 *
 * @param draft - Source draft to process.
 * @param name - Name to process.
 * @returns Resulting text.
 */
function getDraftRowValue(draft: SourceDraft, name: string): string {
    const normalized = normalizeDraftName(name);
    return (
        draft.rows.find((row) => normalizeDraftName(row.name) === normalized)
            ?.value ?? ''
    );
}

function normalizeDraftName(name: string): string {
    return name.trim().toLowerCase();
}

/**
 * Formats today using the user's local calendar date.
 *
 * @param date - Date value.
 * @returns Formatted today using the user's local calendar date.
 */
function formatLocalIsoDate(date: Date): string {
    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Validates and inserts one new source, then restores the editor.
 *
 * @param context - Context value.
 */
async function saveNewSourceDraft(
    context: SourceManagerActionContext,
): Promise<void> {
    if (!(await validateNewSourceWithCs1(context))) {
        return;
    }
    if (!saveSourceDraft(context, true)) {
        return;
    }
    finishSourceManager(context);
}

/**
 * Uses installed CS1 modules as a new-source save gate.
 *
 * @param context - Context value.
 * @returns Operation result.
 */
async function validateNewSourceWithCs1(
    context: SourceManagerActionContext,
): Promise<boolean> {
    const { cs1Review, state } = context;
    const draft = getNewSourceDraftForCs1(state);
    if (draft == null) {
        return false;
    }
    if (!['enwiki', 'zhwiki'].includes(state.wiki.wikiId)) {
        return true;
    }
    const fingerprint = getCurrentCs1DraftFingerprint(state);
    state.draftCs1Checking.value = true;
    state.loading.value = true;
    try {
        const result = await checkNewSourceDraft(
            cs1Review,
            draft,
            context.wiki,
        );
        if (
            !context.isActive() ||
            !state.open.value ||
            state.draft.value !== draft ||
            getCurrentCs1DraftFingerprint(state) !== fingerprint
        ) {
            return false;
        }
        const issueCount = applyPartitionedNewSourceCs1Result(
            state,
            draft,
            result,
        );
        if (issueCount === 0) {
            return true;
        }
        notifyNewSourceCs1Issues(context, issueCount);
        return false;
    } catch {
        if (
            context.isActive() &&
            state.open.value &&
            state.draft.value === draft
        ) {
            notifyCheckerUnavailable(context);
        }
        return false;
    } finally {
        state.draftCs1Checking.value = false;
        state.loading.value = false;
    }
}

function notifyNewSourceCs1Issues(
    context: SourceManagerActionContext,
    issueCount: number,
): void {
    notifyWarning(
        context,
        'new-source-cs1-issues',
        formatNewSourceCs1IssueMessage(issueCount),
    );
}

function notifyCheckerUnavailable(context: SourceManagerActionContext): void {
    notifyError(context, 'checker-unavailable', msg('checker.unavailable'));
}

function getNewSourceDraftForCs1(
    state: SourceManagerState,
): SourceDraft | null {
    const draft = state.draft.value;
    if (draft == null || state.loading.value) {
        return null;
    }
    clearCheckedCs1Errors(state);
    if (state.draftCellErrors.value.size === 0) {
        return draft;
    }
    state.error.value = msg('draft.invalidSummary');
    return null;
}

interface PartitionedCs1Issues {
    blocking: Cs1ValidationResult;
    notices: string[];
}

interface Cs1IssuePartitionContext {
    blockingMessages: Set<string>;
    ignoreUnsupportedCategory: boolean;
    markers: Set<string>;
    notices: Set<string>;
}

function applyPartitionedNewSourceCs1Result(
    state: SourceManagerState,
    draft: SourceDraft,
    result: Cs1ValidationResult,
): number {
    const partitioned = partitionCollisionMarkerCs1Issues(draft, result);
    const issueCount = applyNewSourceCs1Result(state, partitioned.blocking);
    state.warning.value = appendWarning(
        state.warning.value,
        partitioned.notices.join('\n'),
    );
    return issueCount;
}

function partitionCollisionMarkerCs1Issues(
    draft: SourceDraft,
    result: Cs1ValidationResult,
): PartitionedCs1Issues {
    const markers = new Set(
        listSourceDraftParameterCollisions(draft).map((collision) =>
            collision.renamedParameter.toLowerCase(),
        ),
    );
    if (markers.size === 0) {
        return { blocking: result, notices: [] };
    }
    const context: Cs1IssuePartitionContext = {
        blockingMessages: new Set(),
        ignoreUnsupportedCategory: canIgnoreUnsupportedParameterCategory(
            result,
            markers,
        ),
        markers,
        notices: new Set(),
    };
    const cellErrors = partitionCs1CellErrors(result.cellErrors, context);
    const messages = partitionCs1UnmappedMessages(result.messages, context);
    return {
        blocking: {
            cellErrors,
            issueCount: context.blockingMessages.size,
            messages,
        },
        notices: [...context.notices],
    };
}

function partitionCs1UnmappedMessages(
    entered: string[],
    context: Cs1IssuePartitionContext,
): string[] {
    return entered.filter(function partitionMessage(message) {
        if (isCollisionMarkerCs1Issue(message, context.markers)) {
            context.notices.add(message);
            return false;
        }
        if (
            context.ignoreUnsupportedCategory &&
            isUnsupportedParameterCs1Category(message)
        ) {
            return false;
        }
        context.blockingMessages.add(message);
        return true;
    });
}

function partitionCs1CellErrors(
    entered: validation.SourceDraftErrors,
    context: Cs1IssuePartitionContext,
): validation.SourceDraftErrors {
    const result: validation.SourceDraftErrors = new Map();
    for (const [index, errors] of entered) {
        const remaining: validation.SourceDraftRowErrors = {};
        for (const cell of ['alias', 'name', 'value'] as const) {
            partitionCs1Messages(errors[cell], cell, remaining, context);
        }
        if (Object.keys(remaining).length > 0) {
            result.set(index, remaining);
        }
    }
    return result;
}

function partitionCs1Messages(
    entered: string | undefined,
    cell: keyof validation.SourceDraftRowErrors,
    remaining: validation.SourceDraftRowErrors,
    context: Cs1IssuePartitionContext,
): void {
    for (const message of entered?.split('\n') ?? []) {
        if (isCollisionMarkerCs1Issue(message, context.markers)) {
            context.notices.add(message);
            continue;
        }
        context.blockingMessages.add(message);
        const current = remaining[cell];
        remaining[cell] = current == null ? message : `${current}\n${message}`;
    }
}

function isCollisionMarkerCs1Issue(
    message: string,
    markers: Set<string>,
): boolean {
    const parameter = getIgnoredUnknownCs1ParameterName(message);
    return parameter != null && markers.has(parameter);
}

function canIgnoreUnsupportedParameterCategory(
    result: Cs1ValidationResult,
    markers: Set<string>,
): boolean {
    const parameters = listCs1ResultMessages(result).flatMap(
        function getIgnoredParameter(message) {
            const parameter = getIgnoredUnknownCs1ParameterName(message);
            return parameter == null ? [] : [parameter];
        },
    );
    const hasExpectedMarker = parameters.some((name) => markers.has(name));
    const hasUnexpectedParameter = parameters.some(
        (name) => !markers.has(name),
    );
    return hasExpectedMarker && !hasUnexpectedParameter;
}

function listCs1ResultMessages(result: Cs1ValidationResult): string[] {
    const messages = [...result.messages];
    for (const errors of result.cellErrors.values()) {
        for (const cell of ['alias', 'name', 'value'] as const) {
            messages.push(...(errors[cell]?.split('\n') ?? []));
        }
    }
    return messages;
}

/**
 * Runs the injected new-source checker for the current article.
 *
 * @param cs1Review - Cs1 review value.
 * @param draft - Source draft to process.
 * @returns Operation result.
 */
function checkNewSourceDraft(
    cs1Review: Cs1ReviewWorkflow,
    draft: SourceDraft,
    wiki: SourceManagerWikiContext,
): Promise<Cs1ValidationResult> {
    return cs1Review.checkNewSourceDraft(draft, getCs1CheckOptions(wiki));
}

function formatNewSourceCs1IssueMessage(issueCount: number): string {
    return formatPluralMessage(
        issueCount,
        'feedback.newSourceCs1IssueOne',
        'feedback.newSourceCs1IssueMany',
    );
}

function applyNewSourceCs1Result(
    state: SourceManagerState,
    result: Cs1ValidationResult,
): number {
    state.checkedCs1CellErrors.value = result.cellErrors;
    state.checkedCs1Source.value = getCurrentCs1DraftFingerprint(state);
    state.warning.value = result.messages.join('\n');
    return result.issueCount;
}

/**
 * Validates and applies the current source draft.
 *
 * @param context - Context value.
 * @param closeAfterSave - Close after save value.
 * @returns Whether the condition is met.
 */
function saveSourceDraft(
    context: SourceManagerActionContext,
    closeAfterSave: boolean,
): boolean {
    const { editor, state } = context;
    if (state.loading.value || !state.open.value || !context.isActive()) {
        return false;
    }
    const writeResult = writeSourceDraft(context);
    if (writeResult == null) {
        return false;
    }
    const message = closeAfterSave
        ? msg('feedback.sourceSaved')
        : formatAppliedSourceFeedback(writeResult.changeSummary);
    showActionNotification(context, 'source-saved', 'success', message);
    refreshExistingSources(editor, state);
    if (!closeAfterSave) {
        return finishAppliedSourceDraft(state, writeResult);
    }
    resetSourceDraft(state);
    state.activeLookupTab.value = 'sources';
    return true;
}

function finishAppliedSourceDraft(
    state: SourceManagerState,
    writeResult: SourceDraftWriteResult,
): boolean {
    if (rebindAppliedDraft(state, writeResult)) {
        return true;
    }
    const error = state.error.value;
    resetSourceDraft(state);
    state.error.value = error;
    state.activeLookupTab.value = 'sources';
    return false;
}

/**
 * Rechecks an applied CS1 review while keeping its draft open.
 *
 * @param context - Context value.
 */
async function recheckAppliedCs1Draft(
    context: SourceManagerActionContext,
): Promise<void> {
    const { state } = context;
    const draft = state.draft.value;
    const source = state.editingSource.value;
    if (draft == null || source == null || state.loading.value) {
        return;
    }
    clearCheckedCs1Errors(state);
    state.warning.value = '';
    state.draftCs1Checking.value = true;
    state.loading.value = true;
    try {
        const review = await context.cs1Review.checkExistingSourceDraft(
            draft,
            source,
            getCs1CheckOptions(context.wiki),
        );
        if (!isCurrentAppliedDraft(state, draft, source)) {
            return;
        }
        if (applyCs1DraftRecheckResult(context, source, review) === 0) {
            notifyCheckerNoIssues(context);
        }
    } catch {
        if (isCurrentAppliedDraft(state, draft, source)) {
            notifyCheckerUnavailable(context);
        }
    } finally {
        state.draftCs1Checking.value = false;
        state.loading.value = false;
    }
}

function notifyCheckerNoIssues(context: SourceManagerActionContext): void {
    notifySuccess(context, 'checker-no-issues', msg('checker.noIssues'));
}

function applyCs1DraftRecheckResult(
    context: SourceManagerActionContext,
    source: ExistingSource,
    review: Cs1ExistingSourceReview,
): number {
    const { state } = context;
    const { checkedSource, validation } = review;
    const result = validation;
    state.checkedCs1CellErrors.value = result.cellErrors;
    state.checkedCs1Source.value = getCurrentCs1DraftFingerprint(state);
    state.warning.value = result.messages.join('\n');
    updateAppliedCs1BatchResult(context, source, checkedSource);
    return result.issueCount;
}

function isCurrentAppliedDraft(
    state: SourceManagerState,
    draft: SourceDraft,
    source: ExistingSource,
): boolean {
    return (
        state.draft.value === draft &&
        state.editingSource.value?.id === source.id
    );
}

/**
 * Replaces the applied source's stale open-result entry.
 *
 * @param context - Context value.
 * @param source - Source text.
 * @param checked - Checked value.
 */
function updateAppliedCs1BatchResult(
    context: SourceManagerActionContext,
    source: ExistingSource,
    checked: Cs1CheckedSource | undefined,
): void {
    const { state } = context;
    syncCs1BatchResults(context, state.draftReviewQueue.value);
    if (checked == null) {
        return;
    }
    const sourceOrder = new Map(
        state.existingSources.value.map((candidate, index) => [
            candidate.id,
            index,
        ]),
    );
    state.cs1ToolSources.value = orderCs1ItemsBySeverity(
        [...state.cs1ToolSources.value, { ...checked, source }].toSorted(
            (left, right) =>
                (sourceOrder.get(left.source.id) ?? 0) -
                (sourceOrder.get(right.source.id) ?? 0),
        ),
    );
}

/**
 * Saves a checker result and returns to its result popup.
 *
 * @param context - Context value.
 */
function saveReviewedDraft(context: SourceManagerActionContext): void {
    const { editor, state } = context;
    const reviewTool = state.draftReviewTool.value;
    const reviewQueue = state.draftReviewQueue.value;
    if (state.loading.value || reviewTool == null) {
        return;
    }
    const writeResult = writeSourceDraft(context);
    if (writeResult == null) {
        return;
    }
    refreshExistingSources(editor, state);
    if (reviewTool === 'cs1') {
        syncCs1BatchResults(context, reviewQueue);
    }
    resetSourceDraft(state);
    showActionNotification(
        context,
        'source-saved',
        'success',
        msg('feedback.sourceSaved'),
    );
    showCheckerResults(state, reviewTool);
}

/**
 * Keeps unreviewed CS1 results from the original batch request.
 *
 * @param context - Context value.
 * @param queue - Queue value.
 */
function syncCs1BatchResults(
    context: SourceManagerActionContext,
    queue: PreloadedCheckerSource[],
): void {
    const { cs1Review, state } = context;
    state.cs1ToolSources.value = orderCs1ItemsBySeverity(
        queue
            .toSorted((left, right) => left.sourceIndex - right.sourceIndex)
            .flatMap(function restoreResult(preloaded) {
                const source =
                    state.existingSources.value[preloaded.sourceIndex];
                if (source == null || source.status !== 'standard') {
                    return [];
                }
                const checked = cs1Review.restoreCheckedSource(
                    source,
                    preloaded.checkedHtml,
                    preloaded.checkedMessages,
                );
                return checked == null ? [] : [checked];
            }),
    );
    if (state.cs1ToolSources.value.length === 0) {
        state.cs1ToolMessages.value = [];
    }
}

/**
 * Opens refreshed checker results over the manager lookup view.
 *
 * @param state - Mutable operation state.
 * @param reviewTool - Review tool value.
 */
function showCheckerResults(
    state: SourceManagerState,
    reviewTool: SourceCheckerTool,
): void {
    state.activeLookupTab.value = 'tools';
    state.toolPopup.value = reviewTool;
    state.toolPopupOpen.value = true;
}

/**
 * Validates and writes the current source draft.
 *
 * @param context - Context value.
 * @returns Operation result.
 */
function writeSourceDraft(
    context: SourceManagerActionContext,
): SourceDraftWriteResult | null {
    const { editor, state } = context;
    const draft = state.draft.value;
    if (draft == null) {
        return null;
    }
    const beforeText = editor.read();
    const previousSource = state.editingSource.value;
    const collisionNotice = formatDraftParameterCollisionNotice(draft);
    try {
        if (
            state.editingSource.value == null &&
            state.formatScriptTitles.value
        ) {
            formatSourceDraftScriptTitle(
                draft,
                state.wiki.wikiId,
                state.scriptTitleMode.value,
                state.wiki.contentLanguage,
            );
        }
        if (state.draftCellErrors.value.size > 0) {
            state.error.value = msg('draft.invalidSummary');
            return null;
        }
        validateDraft(draft);
        if (state.editingSource.value == null) {
            insertNewSource(
                editor,
                draft,
                state.citationLayout.value,
                context.wiki,
            );
        } else {
            updateExistingSource(context, draft);
        }
        clearAnalysisUndo(state);
    } catch (error) {
        state.error.value = formatError(error);
        return null;
    }
    if (collisionNotice !== '') {
        showActionNotification(
            context,
            'parameter-collision',
            'warning',
            collisionNotice,
        );
    }
    const afterText = editor.read();
    return finishSourceDraftWrite(
        state,
        draft,
        previousSource,
        beforeText,
        afterText,
    );
}

function finishSourceDraftWrite(
    state: SourceManagerState,
    draft: SourceDraft,
    previousSource: ExistingSource | null,
    beforeText: string,
    afterText: string,
): SourceDraftWriteResult {
    recordSessionWrite(state, beforeText, afterText);
    return {
        changePosition: findFirstDifference(beforeText, afterText),
        changeSummary: summarizeSourceDraftChange(
            previousSource?.draft ?? null,
            draft,
            beforeText !== afterText,
        ),
        previousSource,
    };
}

/**
 * Anchors an applied draft to its refreshed source definition.
 *
 * @param state - Mutable operation state.
 * @param writeResult - Write result value.
 * @returns Whether the condition is met.
 */
function rebindAppliedDraft(
    state: SourceManagerState,
    writeResult: SourceDraftWriteResult,
): boolean {
    const changedSource = state.existingSources.value.find(
        function containsChange(source) {
            return (
                writeResult.changePosition >= source.referenceStart &&
                writeResult.changePosition < source.referenceEnd
            );
        },
    );
    const savedSource =
        changedSource ?? findRefreshedSource(state, writeResult.previousSource);
    if (savedSource == null) {
        state.error.value = msg('lookup.sourceUnavailable');
        return false;
    }
    clearCheckedCs1Errors(state);
    state.editingSource.value = savedSource;
    state.error.value = '';
    state.warning.value = '';
    return true;
}

/**
 * Finds a named source after a no-op write.
 *
 * @param state - Mutable operation state.
 * @param previousSource - Previous source value.
 * @returns Named source after a no-op write.
 */
function findRefreshedSource(
    state: SourceManagerState,
    previousSource: ExistingSource | null,
): ExistingSource | null {
    if (previousSource == null) {
        return null;
    }
    const matches = state.existingSources.value.filter(
        function matchesPreviousSource(source) {
            return (
                source.group === previousSource.group &&
                source.referenceName === previousSource.referenceName
            );
        },
    );
    matches.sort(function compareDistance(left, right) {
        return (
            Math.abs(left.templateStart - previousSource.templateStart) -
            Math.abs(right.templateStart - previousSource.templateStart)
        );
    });
    return matches[0] ?? null;
}

function summarizeSourceDraftChange(
    previous: SourceDraft | null,
    current: SourceDraft,
    textChanged: boolean,
): SourceDraftChangeSummary {
    const before = listDraftParameterValues(previous);
    const after = listDraftParameterValues(current);
    return {
        added: [...after.keys()].filter((name) => !before.has(name)),
        created: previous == null,
        fromTemplate: previous?.template ?? '',
        removed: [...before.keys()].filter((name) => !after.has(name)),
        textChanged,
        toTemplate: current.template,
        updated: [...after].flatMap(([name, value]) =>
            before.has(name) && before.get(name) !== value ? [name] : [],
        ),
    };
}

function listDraftParameterValues(
    draft: SourceDraft | null,
): Map<string, string> {
    if (draft == null) {
        return new Map();
    }
    return new Map(
        draft.rows.flatMap(function getPopulatedRow(row) {
            const values = [row.value, row.alias, row.directive];
            return values.every((value) => value.trim() === '')
                ? []
                : [
                      [
                          normalizeDraftName(row.name),
                          JSON.stringify(values),
                      ] as const,
                  ];
        }),
    );
}

function formatAppliedSourceFeedback(
    summary: SourceDraftChangeSummary,
): string {
    if (summary.created) {
        return msg('feedback.sourceAppliedCreated');
    }
    const changes = listAppliedSourceChanges(summary);
    if (changes.length === 0) {
        return msg(
            summary.textChanged
                ? 'feedback.sourceAppliedReordered'
                : 'feedback.sourceAppliedNoChanges',
        );
    }
    return msg('feedback.sourceApplied', { changes: changes.join('; ') });
}

function listAppliedSourceChanges(summary: SourceDraftChangeSummary): string[] {
    const changes: string[] = [];
    if (
        normalizeDraftName(summary.fromTemplate) !==
        normalizeDraftName(summary.toTemplate)
    ) {
        changes.push(
            msg('feedback.sourceTemplateChanged', {
                after: getCanonicalTemplateNameFromKey(summary.toTemplate),
                before: getCanonicalTemplateNameFromKey(summary.fromTemplate),
            }),
        );
    }
    appendParameterChange(
        changes,
        summary.added,
        'feedback.sourceParametersAdded',
    );
    appendParameterChange(
        changes,
        summary.updated,
        'feedback.sourceParametersUpdated',
    );
    appendParameterChange(
        changes,
        summary.removed,
        'feedback.sourceParametersRemoved',
    );
    return changes;
}

function appendParameterChange(
    changes: string[],
    parameters: string[],
    messageId: MessageId,
): void {
    if (parameters.length > 0) {
        changes.push(msg(messageId, { parameters: parameters.join(', ') }));
    }
}

function findFirstDifference(beforeText: string, afterText: string): number {
    const limit = Math.min(beforeText.length, afterText.length);
    for (let index = 0; index < limit; index += 1) {
        if (beforeText[index] !== afterText[index]) {
            return index;
        }
    }
    return limit;
}

/**
 * Clears the draft view without changing the source-list state.
 *
 * @param state - Mutable operation state.
 */
function resetSourceDraft(state: SourceManagerState): void {
    state.dismissedAliasSuggestions.value = new Set();
    state.parameterAliasDialogOpen.value = false;
    state.parameterAliasDialogDirectives.value = [];
    state.parameterAliasDialogOriginalValue.value = '';
    state.parameterAliasDialogRowIndex.value = null;
    state.parameterAliasDialogValidationAttempted.value = false;
    state.parameterAliasDialogValue.value = '';
    state.draft.value = null;
    state.draftReviewQueue.value = [];
    state.draftReviewTool.value = null;
    state.editingSource.value = null;
    state.error.value = '';
    state.draftPopupOpen.value = false;
    state.warning.value = '';
}

/**
 * Applies a selected citation type without discarding entered rows.
 *
 * @param state - Mutable operation state.
 * @param template - Template wikitext.
 */
function updateDraftTemplate(
    state: SourceManagerState,
    template: string | null,
): void {
    const draft = state.draft.value;
    if (draft != null && template != null) {
        const changed = changeSourceDraftTemplate(
            draft,
            template,
            state.templateNameContext,
        );
        ensureNextAuthorDraftRows(changed);
        state.draft.value = changed;
    }
}

/**
 * Validates user-added names and aliases.
 *
 * @param draft - Source draft to process.
 */
function validateDraft(draft: SourceDraft): void {
    const empty = draft.rows.every((row) => row.value.trim() === '');
    if (empty) {
        throw new Error(msg('draft.emptyCitation'));
    }
    for (const row of draft.rows) {
        const hasContent = hasDraftRowUserContent(row);
        if (row.name.trim() === '' && hasContent) {
            throw new Error(msg('draft.missingParameterName'));
        }
        if (hasDraftAliasWithoutValue(row)) {
            throw new Error(
                msg('draft.aliasNeedsValue', {
                    parameter: row.name,
                }),
            );
        }
    }
}

/**
 * Checks whether an entered row has a visible value or alias.
 *
 * @param row - Row value.
 * @returns Whether an entered row has a visible value or alias.
 */
function hasDraftRowUserContent(row: SourceDraftRow): boolean {
    return row.value.trim() !== '' || row.alias.trim() !== '';
}

/**
 * Checks whether a row has an alias that cannot annotate a value.
 *
 * @param row - Row value.
 * @returns Whether a row has an alias that cannot annotate a value.
 */
function hasDraftAliasWithoutValue(row: SourceDraftRow): boolean {
    return row.alias.trim() !== '' && row.value.trim() === '';
}

/**
 * Creates generation and existing-source list actions.
 *
 * @param context - Context value.
 * @returns Created generation and existing-source list actions.
 */
function createLookupActions(
    context: SourceManagerActionContext,
): Pick<
    MainDialogActions,
    | 'canReuseListedSourceWithDetails'
    | 'closeReferenceReuseDialog'
    | 'editListedSource'
    | 'editListedSubReference'
    | 'insertListedSource'
    | 'reuseListedSubReference'
    | 'getReferenceReusePreview'
    | 'insertReferenceWithDetails'
    | 'onReferenceReuseDialogOpenChange'
    | 'resolveEnteredSource'
    | 'openReferenceReuseDialog'
    | 'selectSourceSection'
> {
    async function resolveEnteredSource(entered?: string): Promise<void> {
        await resolveSourceInput(context, entered);
    }
    function editListedSource(sourceId: string): void {
        openExistingSourceWhenIdle(context.state, sourceId);
    }
    function insertListedSource(sourceId: string, event?: MouseEvent): void {
        if (
            (event?.ctrlKey || event?.metaKey) &&
            canReuseListedSourceWithDetails(sourceId)
        ) {
            openReferenceReuseDialog(sourceId);
            return;
        }
        insertListedSourceWhenIdle(context, sourceId);
    }
    function editListedSubReference(
        sourceId: string,
        subReferenceId: string,
    ): void {
        if (context.state.loading.value) return;
        const source = findExistingSourceById(context.state, sourceId);
        const occurrence = source?.subReferences?.find(
            (candidate) => candidate.id === subReferenceId,
        );
        if (source == null || occurrence == null) {
            context.state.error.value = msg('lookup.sourceUnavailable');
            return;
        }
        context.state.referenceReuseSource.value = source;
        context.state.referenceReuseSubReference.value = occurrence;
        context.state.referenceReuseSubReferences.value =
            source.subReferences?.filter(
                (candidate) => candidate.details === occurrence.details,
            ) ?? [];
        context.state.referenceReuseDetails.value = occurrence.details;
        context.state.referenceReuseError.value = '';
        context.state.referenceReuseDialogOpen.value = true;
        scheduleVisibleTextAreaAutosize();
    }
    function reuseListedSubReference(
        sourceId: string,
        subReferenceId: string,
    ): void {
        if (context.state.loading.value) return;
        const source = findExistingSourceById(context.state, sourceId);
        const occurrence = source?.subReferences?.find(
            (candidate) => candidate.id === subReferenceId,
        );
        const text = context.editor.read();
        if (
            source == null ||
            occurrence == null ||
            text.slice(occurrence.referenceStart, occurrence.referenceEnd) !==
                occurrence.rawReference
        ) {
            context.state.error.value = msg('lookup.sourceUnavailable');
            return;
        }
        const currentSource = findCurrentReusableSource(source);
        if (currentSource == null) {
            context.state.error.value = msg('lookup.sourceUnavailable');
            return;
        }
        finishExistingSourceInsertion(
            context,
            currentSource,
            occurrence.details,
        );
    }
    function canReuseListedSourceWithDetails(sourceId: string): boolean {
        const source = findExistingSourceById(context.state, sourceId);
        return (
            source != null &&
            source.referenceKind !== 'short-footnote' &&
            source.referenceName !== ''
        );
    }
    function openReferenceReuseDialog(sourceId: string): void {
        if (
            context.state.loading.value ||
            !canReuseListedSourceWithDetails(sourceId)
        ) {
            return;
        }
        const source = findExistingSourceById(context.state, sourceId);
        if (source == null) return;
        context.state.referenceReuseSource.value = source;
        context.state.referenceReuseSubReference.value = null;
        context.state.referenceReuseSubReferences.value = [];
        context.state.referenceReuseDetails.value = '';
        context.state.referenceReuseError.value = '';
        context.state.referenceReuseDialogOpen.value = true;
        scheduleVisibleTextAreaAutosize();
    }
    function closeReferenceReuseDialog(): void {
        context.state.referenceReuseDialogOpen.value = false;
        context.state.referenceReuseSource.value = null;
        context.state.referenceReuseSubReference.value = null;
        context.state.referenceReuseSubReferences.value = [];
        context.state.referenceReuseDetails.value = '';
        context.state.referenceReuseError.value = '';
    }
    function onReferenceReuseDialogOpenChange(open: boolean): void {
        if (!open) closeReferenceReuseDialog();
    }
    function getReferenceReusePreview(): string {
        const source = context.state.referenceReuseSource.value;
        const occurrence = context.state.referenceReuseSubReference.value;
        if (occurrence != null) {
            return buildExistingSourceSubReference(
                occurrence,
                context.state.referenceReuseDetails.value,
            );
        }
        return source == null
            ? ''
            : buildExistingSourceReference(
                  source,
                  context.state.referenceStyle.value === 'r',
                  context.state.referenceReuseDetails.value,
              );
    }
    function insertReferenceWithDetails(): void {
        if (context.state.loading.value) return;
        const selected = context.state.referenceReuseSource.value;
        if (selected == null) return;
        const occurrence = context.state.referenceReuseSubReference.value;
        if (occurrence != null) {
            try {
                const beforeText = context.editor.read();
                const afterText = replaceExistingSourceSubReferences(
                    beforeText,
                    selected,
                    context.state.referenceReuseSubReferences.value,
                    context.state.referenceReuseDetails.value,
                    context.templateNameContext,
                );
                if (afterText !== beforeText) {
                    clearAnalysisUndo(context.state);
                    context.writePreservingPosition(context.editor, afterText);
                    recordSessionWrite(context.state, beforeText, afterText);
                    refreshExistingSources(context.editor, context.state);
                    showActionNotification(
                        context,
                        'sub-reference-updated',
                        'success',
                        msg('lookup.subReferenceUpdated'),
                    );
                }
                closeReferenceReuseDialog();
            } catch (error) {
                context.state.referenceReuseError.value =
                    error instanceof StaleSourceError
                        ? msg('lookup.sourceUnavailable')
                        : formatError(error);
            }
            return;
        }
        const source = findCurrentReusableSource(selected);
        if (source == null) {
            context.state.referenceReuseError.value = msg(
                'lookup.sourceUnavailable',
            );
            return;
        }
        finishExistingSourceInsertion(
            context,
            source,
            context.state.referenceReuseDetails.value,
        );
    }
    function findCurrentReusableSource(
        selected: ExistingSource,
    ): ExistingSource | undefined {
        return listExistingSources(
            context.editor.read(),
            context.templateNameContext,
        ).find(
            (candidate) =>
                candidate.referenceKind !== 'short-footnote' &&
                candidate.referenceName === selected.referenceName &&
                candidate.group === selected.group,
        );
    }
    return {
        canReuseListedSourceWithDetails,
        closeReferenceReuseDialog,
        editListedSource,
        editListedSubReference,
        insertListedSource,
        reuseListedSubReference,
        getReferenceReusePreview,
        insertReferenceWithDetails,
        onReferenceReuseDialogOpenChange,
        openReferenceReuseDialog,
        resolveEnteredSource,
        selectSourceSection(
            selector: SourceSectionSelector,
            selected: string | number,
        ): void {
            selectSourceSectionOption(context.state, selector, selected);
        },
    };
}

function selectSourceSectionOption(
    state: SourceManagerState,
    selector: SourceSectionSelector,
    selected: string | number,
): void {
    const entered = String(selected);
    const option = selector.menuItems.find(
        (item) =>
            item.value === entered ||
            item.label === entered ||
            item.sectionId === entered,
    );
    if (option != null) {
        updateSourceSectionSelection(state, selector.level, option.sectionId);
    }
}

/**
 * Updates one level of the hierarchical source-section filter.
 *
 * @param state - Mutable operation state.
 * @param level - Level value.
 * @param selected - Selected value.
 */
function updateSourceSectionSelection(
    state: SourceManagerState,
    level: number,
    selected: string | number,
): void {
    const value = String(selected);
    if (value === '') {
        state.sourceSectionPath.value =
            level === 0 ? [] : state.sourceSectionPath.value.slice(0, level);
        return;
    }
    state.sourceSectionPath.value = [
        ...state.sourceSectionPath.value.slice(0, level),
        value,
    ];
}

/**
 * Opens an existing draft only when no URL request can replace it.
 *
 * @param state - Mutable operation state.
 * @param sourceId - Source id value.
 */
function openExistingSourceWhenIdle(
    state: SourceManagerState,
    sourceId: string,
): void {
    if (!state.loading.value) {
        openExistingSource(state, sourceId);
    }
}

/**
 * Inserts a listed source only when URL lookup is idle.
 *
 * @param context - Context value.
 * @param sourceId - Source id value.
 */
function insertListedSourceWhenIdle(
    context: SourceManagerActionContext,
    sourceId: string,
): void {
    if (!context.state.loading.value) {
        insertListedExistingSource(context, sourceId);
    }
}

/**
 * Inserts one source chosen directly from the existing-source list.
 *
 * @param context - Context value.
 * @param sourceId - Source id value.
 */
function insertListedExistingSource(
    context: SourceManagerActionContext,
    sourceId: string,
): void {
    const source = findExistingSourceById(context.state, sourceId);
    if (source == null) {
        context.state.error.value = msg('lookup.sourceUnavailable');
        return;
    }
    finishExistingSourceInsertion(context, source);
}

function finishExistingSourceInsertion(
    context: SourceManagerActionContext,
    source: ExistingSource,
    details?: string,
): void {
    clearAnalysisUndo(context.state);
    insertExistingSource(
        context.editor,
        source,
        context.state.referenceStyle.value,
        details,
    );
    showActionNotification(
        context,
        'existing-source-inserted',
        'success',
        msg('lookup.existingInserted'),
    );
    finishSourceManager(context);
}

/**
 * Opens a manual draft or generates a source from the current input.
 *
 * @param context - Context value.
 * @param entered - Entered value.
 */
async function resolveSourceInput(
    context: SourceManagerActionContext,
    entered?: string,
): Promise<void> {
    const { editor, state } = context;
    if (state.loading.value || !state.open.value || !context.isActive()) {
        return;
    }
    const value = entered ?? state.sourceInput.value;
    if (value.trim() === '') {
        state.sourceInput.value = '';
        openDraft(
            state,
            createManualSourceDraft('cite web', state.templateNameContext),
        );
        return;
    }
    const parsed = parseSourceInput(value);
    if (parsed == null) {
        state.error.value = msg('lookup.sourceRequired');
        return;
    }
    state.sourceInput.value = value.trim();
    state.error.value = '';
    state.warning.value = '';
    const matches =
        parsed.originalUrl === ''
            ? []
            : findExistingSources(
                  editor.read(),
                  value,
                  state.templateNameContext,
              );
    const existing = chooseAutomaticSource(matches);
    if (existing != null) {
        clearAnalysisUndo(state);
        insertExistingSource(editor, existing, state.referenceStyle.value);
        showActionNotification(
            context,
            'existing-source-inserted',
            'success',
            msg('lookup.existingInserted'),
        );
        finishSourceManager(context);
        return;
    }
    if (matches.length > 0) {
        state.activeLookupTab.value = 'sources';
        state.sourceSectionPath.value = [];
        state.warning.value = msg('lookup.ambiguousSource');
        return;
    }
    await loadNewSourceDraft(context, parsed);
}

/**
 * Chooses an unambiguous reusable match for immediate insertion.
 *
 * @param matches - Matches value.
 * @returns Selected unambiguous reusable match for immediate insertion.
 */
function chooseAutomaticSource(
    matches: ExistingSource[],
): ExistingSource | null {
    const groups = new Set(matches.map((source) => source.group));
    if (groups.size > 1) {
        return null;
    }
    const named = matches.find((source) => source.referenceName !== '');
    return named ?? matches[0] ?? null;
}

/**
 * Opens one listed existing citation as a cloned editable draft.
 *
 * @param state - Mutable operation state.
 * @param sourceId - Source id value.
 */
function openExistingSource(state: SourceManagerState, sourceId: string): void {
    const source = findExistingSourceById(state, sourceId);
    if (source == null) {
        state.error.value = msg('lookup.sourceUnavailable');
        return;
    }
    clearCheckedCs1Errors(state);
    state.draftReviewTool.value = null;
    const draft = cloneDraft(source.draft);
    ensureNextAuthorDraftRows(draft);
    state.dismissedAliasSuggestions.value = new Set();
    state.editingSource.value = source;
    state.draft.value = draft;
    state.error.value = '';
    const warning =
        source.status === 'non-standard' ? msg('lookup.replaceWarning') : '';
    state.warning.value = appendWarning(
        warning,
        formatDraftParameterCollisionNotice(draft),
    );
    state.draftPopupOpen.value = true;
    scheduleVisibleTextAreaAutosize();
}

/**
 * Gets one existing source by its stable list identifier.
 *
 * @param state - Mutable operation state.
 * @param sourceId - Source id value.
 * @returns Operation result.
 */
function findExistingSourceById(
    state: SourceManagerState,
    sourceId: string,
): ExistingSource | null {
    return (
        state.existingSources.value.find(
            (candidate) => candidate.id === sourceId,
        ) ?? null
    );
}

/**
 * Fetches Citoid and archive data for a new source.
 *
 * @param context - Context value.
 * @param parsed - Parsed value.
 */
async function loadNewSourceDraft(
    context: SourceManagerActionContext,
    parsed: ParsedSourceInput,
): Promise<void> {
    const { state } = context;
    state.loading.value = true;
    const archiveSeed = createArchiveSeed(parsed);
    try {
        const metadata = await context.resolveSourceMetadata(
            parsed.search,
            archiveSeed,
        );
        if (!context.isActive() || !state.open.value) {
            return;
        }
        const draft = parseSourceDraft(
            metadata.citeTemplate,
            state.templateNameContext,
        );
        const liveOriginal =
            parsed.originalUrl !== '' &&
            archiveSeed == null &&
            metadata.metadataError === '';
        applyResolvedMetadata(draft, metadata, liveOriginal);
        const warnings = buildMetadataWarnings(metadata);
        state.warning.value = warnings.join(' ');
        openDraft(state, draft, warnings.length > 0);
    } catch (error) {
        if (!context.isActive() || !state.open.value) {
            return;
        }
        const draft = createLookupFallbackDraft(parsed);
        setSourceDraftValue(draft, 'archive-url', parsed.archiveUrl);
        setSourceDraftValue(draft, 'archive-date', parsed.archiveDate);
        state.warning.value = formatMetadataFailure(error, formatError);
        openDraft(state, draft, true);
    } finally {
        state.loading.value = false;
    }
}

/**
 * Opens a source draft without replacing the source-list view.
 *
 * @param state - Mutable operation state.
 * @param draft - Source draft to process.
 * @param preserveWarning - Preserve warning value.
 */
function openDraft(
    state: SourceManagerState,
    draft: SourceDraft,
    preserveWarning: boolean = false,
): void {
    ensureNextAuthorDraftRows(draft);
    clearCheckedCs1Errors(state);
    state.dismissedAliasSuggestions.value = new Set();
    state.draft.value = draft;
    state.draftReviewTool.value = null;
    state.editingSource.value = null;
    state.error.value = '';
    if (!preserveWarning) {
        state.warning.value = '';
    }
    state.warning.value = appendWarning(
        state.warning.value,
        formatDraftParameterCollisionNotice(draft),
    );
    state.draftPopupOpen.value = true;
    scheduleVisibleTextAreaAutosize();
}

/**
 * Re-reads source definitions and filters after an in-dialog save.
 *
 * @param editor - Editor value.
 * @param state - Mutable operation state.
 */
function refreshExistingSources(
    editor: EditBox,
    state: SourceManagerState,
): void {
    const text = editor.read();
    const sources = listExistingSources(text, state.templateNameContext);
    state.existingSources.value = sources;
    const sections = listExistingSourceSections(text, sources);
    state.existingSourceSections.value = sections;
    state.sourceSectionPath.value = retainExistingSectionPath(
        state.sourceSectionPath.value,
        sections,
    );
}

function retainExistingSectionPath(
    path: string[],
    sections: SourceSection[],
): string[] {
    const available = new Set(sections.map((section) => section.id));
    const retained = [];
    for (const sectionId of path) {
        if (!available.has(sectionId)) {
            break;
        }
        retained.push(sectionId);
    }
    return retained;
}

/**
 * Inserts a reuse or anonymous full ref at the active selection.
 *
 * @param editor - Editor value.
 * @param source - Source text.
 * @param style - Style value.
 */
function insertExistingSource(
    editor: EditBox,
    source: ExistingSource,
    style: ReferenceStyle,
    details?: string,
): void {
    const compact = style === 'r';
    editor.replaceSelection(
        buildExistingSourceReference(source, compact, details),
    );
}

/**
 * Inserts a newly built full reference at the active selection.
 *
 * @param editor - Editor value.
 * @param draft - Source draft to process.
 * @param layout - Citation layout.
 */
function insertNewSource(
    editor: EditBox,
    draft: SourceDraft,
    layout: CitationLayout,
    wiki: SourceManagerWikiContext,
): void {
    const citation = serializeSourceDraft(draft, layout, wiki.wikiPolicy);
    editor.replaceSelection(`<ref>${citation}</ref>`);
}

/**
 * Updates one citation while preserving its current layout.
 *
 * @param editor - Editor value.
 * @param state - Mutable operation state.
 * @param draft - Source draft to process.
 */
function updateExistingSource(
    context: SourceManagerActionContext,
    draft: SourceDraft,
): void {
    const { editor, state } = context;
    const current = editor.read();
    const source = state.editingSource.value as ExistingSource;
    const layout =
        source.status === 'non-standard'
            ? state.citationLayout.value
            : detectCitationLayout(
                  `<ref>${source.rawTemplate}</ref>`,
                  state.templateNameContext,
              );
    const replaced = replaceExistingSource(
        current,
        source,
        draft,
        layout,
        state.wiki.wikiPolicy,
    );
    context.writePreservingPosition(editor, replaced);
}

/**
 * Closes the modal before restoring editor focus.
 *
 * @param context - Context value.
 */
function finishSourceManager(context: SourceManagerActionContext): void {
    context.close();
    queueMicrotask(function focusEditor(): void {
        context.editor.focus();
    });
}

/**
 * Creates a user-addable empty parameter row.
 *
 * @returns Created user-addable empty parameter row.
 */
function createBlankDraftRow(): SourceDraftRow {
    return {
        alias: '',
        directive: '',
        main: false,
        name: '',
        value: '',
    };
}

/**
 * Clones a draft without mutating the source list.
 *
 * @param draft - Source draft to process.
 * @returns Operation result.
 */
function cloneDraft(draft: SourceDraft): SourceDraft {
    return {
        normalizationRequested: draft.normalizationRequested,
        rows: draft.rows.map((row) => ({ ...row })),
        template: draft.template,
    };
}

/**
 * Converts a rejected value into readable UI text.
 *
 * @param error - Error value to inspect.
 * @returns Converted rejected value into readable UI text.
 */
function formatError(error: unknown): string {
    if (error instanceof StaleSourceError) {
        return msg('errors.sourceChanged');
    }
    return error instanceof Error ? error.message : String(error);
}

function formatDraftParameterCollisionNotice(draft: SourceDraft): string {
    const collisions = listSourceDraftParameterCollisions(draft);
    if (collisions.length === 0) {
        return '';
    }
    const parameters = [
        ...new Set(collisions.map((item) => item.canonicalParameter)),
    ];
    return msg('draft.parameterCollisionNotice', {
        parameters: parameters.join(', '),
    });
}

function appendWarning(current: string, addition: string): string {
    if (addition === '' || current.includes(addition)) {
        return current;
    }
    return [current, addition].filter((message) => message !== '').join('\n');
}

/**
 * Formats a plural message for the active interface locale.
 *
 * @param count - Count value.
 * @param one - One value.
 * @param many - Many value.
 * @returns Formatted plural message for the active interface locale.
 */
function formatPluralMessage(
    count: number,
    one: MessageId,
    many: MessageId,
): string {
    const id =
        new Intl.PluralRules(interfaceLocale).select(count) === 'one'
            ? one
            : many;
    return msg(id, { count });
}
