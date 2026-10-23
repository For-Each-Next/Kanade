/**
 * @file src/vg-stub-creator/features/creator/form/component.ts
 * Purpose: Composes isolated creator dialog state and behavior.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. createDialogComponent
 * 4. VgStubCreatorTemplateBindings
 */

import {
    getCitationParamRows,
    getCitationParamTableRows,
    getCitationTabLabel,
    getCitationTabName,
    getCitationTabsKey,
} from './citation-editor.ts';
import type { CreatorDialogOptions } from './dialog-options.ts';

import { cdxIconNewWindow } from '@wikimedia/codex-icons';
import type { ReviewLinkSession } from '../../../app/contracts/application.ts';
import { buildNavboxEditSummary } from '../../../domain/edit-summary.ts';
import { syncNameRoles } from '../../../domain/name-roles.ts';
import {
    completeMetadataFieldValue,
    formatArticleFormField,
    isArticleListField,
    isCompletableMetadataField,
} from '../../../domain/processor.ts';
import { updateSaveProgress } from '../../../domain/save-progress.ts';
import { formatNamespaceTitle } from '../../../../library/wiki-titles/wikipedia.ts';
import * as wikitext from '../../../domain/wikitext/index.ts';
import { interfaceLocale, msg, msgParts } from '../../../i18n/index.ts';
import { VG_STUB_CREATOR_DIALOG_TEMPLATE } from '../dialogs/index.ts';
import { getErrorMessage } from '../error-message.ts';
import {
    createPreSaveGroups,
    serializePreSaveProgressGroups,
} from '../pre-save.ts';
import {
    createSaveProgress,
    getSaveProgressGroups,
    isSaveProgressComplete,
} from '../save-progress.ts';
import {
    ARTICLE_PARAMETER_GROUPS,
    CITATION_TABLE_COLUMNS,
    CODEMIRROR_MODULES,
    HISTORY_EXPORT_ERROR,
    MAIN_ACTION_MENU_ITEMS,
    NAME_MARKETS,
    PRE_SAVE_STATUS_ICONS,
    STEAM_NAME_BUTTONS,
    TABLE_ACTION_ICONS,
} from './constants.ts';
import {
    buildMetacriticSearchUrl,
    buildMetacriticUrl,
    buildOpenCriticSearchUrl,
    buildOpenCriticUrl,
    buildSteamSearchUrl,
    buildSteamUrl,
    buildWikidataSearchUrl,
    createBlankEnwikiMetadata,
    createEnwikiTipPlaceholders,
    extractEnwikiTitleFromUrl,
    getBasePageTitle,
    getWikidataLookupStatus,
    normalizeEnwikiTitleValue,
} from './external-links.ts';
import {
    applyCategoryPatches,
    applyNavboxPatches,
    buildStubTagRowsFromCategories,
    cloneValue,
    createFormValues,
    createNavboxRow,
    createRedirectRow,
    ensureNavboxRows,
    ensureRedirectRows,
    ensureStubTagRows,
    ensureTrailingCategoryRow,
    ensureTrailingNavboxRow,
    ensureTrailingRedirectRow,
    ensureTrailingStubTagRow,
    getArticleField,
    getHistoryEntryForm,
    getSteamNameSuggestions,
    hasPreparedNavboxRows,
    isBlankCategoryRow,
    isBlankNavboxRow,
    isBlankRedirectRow,
    isCategoryRowFixed,
    isNavboxRowFixed,
    isRedirectRowFixed,
    markCategoryRowsFixed,
    markCategoryRowsUnfixed,
    normalizeListFieldValue,
    openDialog,
    replaceFormValues,
    setNavboxRowText,
    setRedirectRowTitle,
    shouldSkipFixedRows,
    syncGeneratedNameNoteTaRow,
    syncStubTagRowsFromCategories,
} from './form-model.ts';
import { syncMetadataItemRows } from './metadata-items.ts';
import {
    buildRelatedFieldMetadata,
    getNavboxTitle,
    getRelatedIdentity,
    getRelatedItemField,
    RELATED_FIELDS,
    trimStubTagValue,
} from './related-items.ts';
import {
    createSourceEditorManager,
    getCodeMirrorLoader,
} from './source-editor.ts';

import { createCitationEditor } from './citation-editor.ts';
import { createMetadataEditor } from './metadata-editor.ts';
import { createNameEditor } from './name-editor.ts';
import { createSourceUrlEditor } from './source-url-editor.ts';

let dialogInstanceCount = 0;

export function createDialogComponent(Vue: any, options: CreatorDialogOptions) {
    const nameUsageIdPrefix = `kanade-vg-stub-creator-${++dialogInstanceCount}`;

    let currentTitle: string;

    let activeTab: any;

    let form: any;

    let categoryState: any;

    let reviewState: any;

    let pageEditOpen: any;

    let pageEditState: any;

    let pageEditValidationError: any;

    let categoryViewOpen: any;

    let categoryViewState: any;

    let historyEntries: any;

    let historyJsonError: any;

    let historyJsonEditable: any;

    let historyJsonOpen: any;

    let historyJsonText: any;

    let historyLoading: any;

    let historyOpen: any;

    let mainActionMenuSelection: any;

    let moveTarget: any;

    let moveTargetInput: any;

    let moveTargetState: any;

    let moveTargetValidationError: any;

    let moveOpen: any;

    let movePreviewConfirmation: any;

    let previewWithoutMoveTitle: any;

    let preSaveMoveEnabled: any;

    let preSaveMoveTitle: any;

    let preSaveOpen: any;

    let preSaveActions: any;

    let preSaveGroups: any;

    let preSaveProgress: any;

    let preSaveProgressGroups: any;

    let stubTagRows: any;

    let previewOpen: any;

    let previewTextArea: any;

    let previewText: any;

    let previewValidationError: any;

    let previewSummary: any;

    let previewHtml: any;

    let previewLoading: any;

    let previewLoadingMessage: any;

    let previewSubmitted: any;

    let pageEditTextArea: any;

    let enwikiLookupLoading: any;

    let enwikiLookupSerial: any;

    let enwikiMetadata: any;

    let moveTargetRequest: number;

    let pageEditRequest: number;

    let sourceFetchState: any;

    let open: any;

    let compactActions: any;

    let actionLayoutQuery: MediaQueryList | undefined;

    let reviewLinkSession: ReviewLinkSession;

    let componentMounted: boolean;

    let navboxRowsPrepared: boolean;

    let navboxRowsRequest: number;

    let categoryRowsRequest: number;

    let redirectRowsRequest: number;

    let reviewRefreshRequest: number;

    let linkNavigationModifier: any;

    let disposeLinkNavigationEvents: (() => void) | undefined;

    let redirectNamesQueryKey: string;

    const pageEditTextBinding = {
        get value() {
            return pageEditState.text;
        },
        set value(text) {
            pageEditState.text = text;
        },
    };

    type PreSaveStatus = keyof typeof PRE_SAVE_STATUS_ICONS;

    /**
     * Normalizes persisted or adapter-provided progress status values.
     *
     * @param status - Raw progress status.
     * @returns Known status key.
     */
    function normalizePreSaveStatus(status: string): PreSaveStatus {
        return Object.hasOwn(PRE_SAVE_STATUS_ICONS, status)
            ? (status as PreSaveStatus)
            : 'pending';
    }

    /**
     * Initializes primary form and review state.
     */
    function initializePrimaryState(): void {
        currentTitle = trimValue(options.currentTitle) || options.defaultName;
        activeTab = Vue.ref(ARTICLE_PARAMETER_GROUPS[0].key);
        const formValuesResultA = createFormValues();
        form = Vue.reactive(formValuesResultA);
        const loadingStateResultC = createLoadingState();
        categoryState = Vue.reactive(loadingStateResultC);
        const loadingStateResultA = createLoadingState();
        reviewState = Vue.reactive(loadingStateResultA);
        pageEditOpen = Vue.ref(false);
        const pageEditStateResult = createPageEditState();
        pageEditState = Vue.reactive(pageEditStateResult);
        pageEditValidationError = Vue.ref('');
        categoryViewOpen = Vue.ref(false);
        categoryViewState = Vue.reactive({ title: '', url: '' });
    }

    /**
     * Initializes history, move, and pre-save state.
     */
    function initializeActionState(): void {
        const historyEntriesResult = options.getHistoryEntries();
        historyEntries = Vue.ref(historyEntriesResult);
        historyJsonError = Vue.ref('');
        historyJsonEditable = Vue.ref(false);
        historyJsonOpen = Vue.ref(false);
        historyJsonText = Vue.ref('');
        historyLoading = Vue.ref(false);
        historyOpen = Vue.ref(false);
        mainActionMenuSelection = Vue.ref(null);
        moveTarget = Vue.ref(currentTitle);
        moveTargetInput = Vue.ref(null);
        const moveTargetStateResult = createMoveTargetState();
        moveTargetState = Vue.reactive(moveTargetStateResult);
        moveTargetValidationError = Vue.ref('');
        moveOpen = Vue.ref(false);
        movePreviewConfirmation = Vue.ref(false);
        previewWithoutMoveTitle = Vue.ref('');
        preSaveMoveEnabled = Vue.ref(false);
        preSaveMoveTitle = Vue.ref(currentTitle);
        preSaveOpen = Vue.ref(false);
        preSaveActions = Vue.reactive([]);
        preSaveGroups = Vue.computed(getCurrentPreSaveGroups);
        preSaveProgress = Vue.ref(null);
        preSaveProgressGroups = Vue.computed(getCurrentProgressGroups);
    }

    /**
     * Initializes preview, source, and metadata state.
     */
    function initializePreviewState(): void {
        stubTagRows = Vue.computed(() => form.stubTagRows || []);
        previewOpen = Vue.ref(false);
        previewTextArea = Vue.ref(null);
        previewText = Vue.ref('');
        previewValidationError = Vue.ref('');
        previewSummary = Vue.ref('');
        previewHtml = Vue.ref('');
        previewLoading = Vue.ref(false);
        const messageC = msg('preview.preparing');
        previewLoadingMessage = Vue.ref(messageC);
        previewSubmitted = Vue.ref(false);
        pageEditTextArea = Vue.ref(null);
        enwikiLookupLoading = Vue.ref(false);
        enwikiLookupSerial = Vue.ref(0);
        const blankEnwikiMetadataResultB = createBlankEnwikiMetadata();
        enwikiMetadata = Vue.reactive(blankEnwikiMetadataResultB);
        const loadingStateResult = createLoadingState();
        sourceFetchState = Vue.reactive(loadingStateResult);
        open = Vue.ref(options.initialOpen === true);
        actionLayoutQuery = window.matchMedia?.('(max-width: 639px)');
        compactActions = Vue.ref(actionLayoutQuery?.matches === true);
    }

    /**
     * Initializes all mutable dialog state.
     */
    function initializeDialogState(): void {
        reviewLinkSession = options.createReviewLinkSession();
        componentMounted = true;
        navboxRowsRequest = 0;
        categoryRowsRequest = 0;
        redirectRowsRequest = 0;
        reviewRefreshRequest = 0;
        linkNavigationModifier = Vue.ref(false);
        redirectNamesQueryKey = '';
        moveTargetRequest = 0;
        pageEditRequest = 0;

        if (options.initialForm != null) {
            replaceFormValues(form, options.initialForm);
        }

        syncMetadataItemRows(form);

        navboxRowsPrepared = hasPreparedNavboxRows(form);
        nameEditor.syncPageNameFields();
        syncNameRoles(form);
        nameEditor.adoptNameOutputRoles();
        syncGeneratedNameNoteTaRow(form);
    }

    /**
     * Registers dialog watchers and external controls.
     */
    function initializeDialogBehavior(): void {
        registerDialogGlobal();

        if (options.initialOpen === true) {
            options.onActivate();
        }

        if (shouldLoadInitialEnwikiMetadata()) {
            void refreshEnwikiMetadata();
        }
    }

    /** Keeps visual and keyboard action order aligned at every viewport size. */
    function updateActionLayout(event: MediaQueryListEvent): void {
        compactActions.value = event.matches;
    }

    /**
     * Creates a standard loading state object.
     *
     * @returns A standard loading state object.
     */
    function createLoadingState(): any {
        return { error: '', loading: false };
    }

    /**
     * Creates page-edit dialog state.
     *
     * @returns Page-edit dialog state.
     */
    function createPageEditState(): any {
        const result = {
            create: false,
            company: '',
            englishName: '',
            error: '',
            html: '',
            kind: '',
            loading: false,
            pending: false,
            previousStatus: '',
            row: null,
            text: '',
            title: '',
        };
        return result;
    }

    /**
     * Creates move-target lookup state.
     *
     * @returns Move-target lookup state.
     */
    function createMoveTargetState(): any {
        return { checkedTitle: '', exists: false, loading: false };
    }

    /**
     * Gets current grouped pre-save actions.
     *
     * @returns Current grouped pre-save actions.
     */
    function getCurrentPreSaveGroups(): any {
        return createPreSaveGroups(preSaveActions, form);
    }

    /**
     * Gets current save progress groups.
     *
     * @returns Current save progress groups.
     */
    function getCurrentProgressGroups(): any {
        return getSaveProgressGroups(preSaveProgress.value);
    }

    /**
     * Watches form mutations and queues dependent work.
     */
    function watchFormChanges(): void {
        const watchCallbackC = function callback(currentForm: unknown) {
            syncNameRoles(currentForm as Record<string, unknown>);
            syncGeneratedNameNoteTaRow(currentForm);
            options.onFormChange(currentForm as Record<string, unknown>);
            if (sourceUrlEditor.hasPendingEntries()) {
                citationEditor.queueCitationPrefetch.cancel();
            } else {
                citationEditor.queueCitationPrefetch(
                    currentForm as Record<string, unknown>,
                );
            }
        };
        Vue.watch(form, watchCallbackC, { deep: true });
        Vue.watch(
            () => RELATED_FIELDS.map((field) => form[field]),
            (values: unknown[], previous: unknown[]) => {
                RELATED_FIELDS.forEach((field, index) => {
                    if (values[index] !== previous[index]) {
                        syncMetadataItemRows(form, field);
                    }
                });
                if (form.publishers === '=' && values[0] !== previous[0]) {
                    syncMetadataItemRows(form, 'publishers');
                }
            },
        );
        citationEditor.queueCitationPrefetch(form);
    }

    /**
     * Watches tab changes that require refreshed data.
     */
    function watchActiveTab(): void {
        const watchCallbackB = function callback(tab: string) {
            if (tab === 'references') {
                void citationEditor.refreshCitationRows();
            }

            if (tab === 'metadata') {
                void metadataEditor.refreshRelatedItems();
            }

            if (tab === 'titles') {
                void runReviewRefresh(() => refreshRedirectRows());
                void nameEditor.refreshNamePageChecks();
            }
        };
        Vue.watch(activeTab, watchCallbackB);
    }

    /**
     * Watches the article preview editor dialog.
     */
    function watchPreviewEditor(): void {
        const watchCallbackA = function callback(isOpen: unknown) {
            if (isOpen) {
                queueSourceEditor('preview', previewTextArea, previewText);
                return;
            }

            destroySourceEditor('preview');
        };
        Vue.watch(previewOpen, watchCallbackA);
    }

    /**
     * Watches the follow-up page editor dialog.
     */
    function watchPageEditEditor(): void {
        const watchCallback = function callback(isOpen: unknown) {
            if (!isOpen) {
                destroySourceEditor('pageEdit');
                return;
            }

            queueSourceEditor(
                'pageEdit',
                pageEditTextArea,
                pageEditTextBinding,
            );
        };
        Vue.watch(pageEditOpen, watchCallback);
    }

    /**
     * Registers source editor cleanup for component unmount.
     */
    function registerUnmountHandler(): void {
        if (typeof Vue.onBeforeUnmount !== 'function') {
            return;
        }

        const onBeforeUnmountCallback = function callback() {
            componentMounted = false;
            disposeLinkNavigationEvents?.();
            disposeLinkNavigationEvents = undefined;
            metadataEditor.dispose();
            nameEditor.dispose();
            citationEditor.dispose();
            sourceUrlEditor.dispose();
            enwikiLookupSerial.value += 1;
            if ((window as any).vgStubCreatorDialog === dialogController)
                delete (window as any).vgStubCreatorDialog;
            moveTargetRequest += 1;
            pageEditRequest += 1;
            actionLayoutQuery?.removeEventListener(
                'change',
                updateActionLayout,
            );

            sourceEditorManager.dispose();
        };
        Vue.onBeforeUnmount(onBeforeUnmountCallback);
    }

    /** Tracks navigation modifiers even while the pointer stays over one field link. */
    function registerLinkNavigationEvents(): void {
        const host = window;
        if (typeof host.addEventListener !== 'function') return;
        disposeLinkNavigationEvents?.();
        const modifier = linkNavigationModifier;
        const update = (event: KeyboardEvent) => {
            modifier.value = event.ctrlKey || event.metaKey;
        };
        const reset = () => {
            modifier.value = false;
        };
        host.addEventListener('keydown', update, true);
        host.addEventListener('keyup', update, true);
        host.addEventListener('blur', reset);
        disposeLinkNavigationEvents = () => {
            host.removeEventListener('keydown', update, true);
            host.removeEventListener('keyup', update, true);
            host.removeEventListener('blur', reset);
            reset();
        };
    }

    /**
     * Registers the external singleton dialog controller.
     */
    function registerDialogGlobal(): void {
        (window as any).vgStubCreatorDialog = dialogController;
    }

    /**
     * Opens the dialog through its global controller.
     */
    function openExternalDialog(): void {
        if (!componentMounted) return;
        options.onActivate();
        openDialog(open);
        void metadataEditor.refreshRelatedItems();
    }

    /**
     * Opens pre-save review through the global controller.
     */
    async function submitExternalDialog(): Promise<void> {
        if (!componentMounted) return;
        open.value = true;
        await openPreSave();
    }

    /**
     * Checks whether initial English Wikipedia metadata is required.
     *
     * @returns Whether initial English Wikipedia metadata is required.
     */
    function shouldLoadInitialEnwikiMetadata(): boolean {
        const result =
            options.initialEnwikiLookup === true &&
            trimValue(form.enwikiTitle) !== '';
        return result;
    }

    /**
     * Opens pre-save review state for the current form.
     */
    async function openPreSave() {
        await refreshReview({
            recheck: true,
        });
        sourceFetchState.error = '';
        sourceFetchState.loading = true;
        preSaveMoveTitle.value = getCurrentTitle();
        preSaveProgress.value = null;
        preSaveOpen.value = true;

        try {
            const currentTitleResultH = getCurrentTitle();
            const prepared = await options.onPreSavePrepare(
                form,
                currentTitleResultH,
            );

            preSaveActions.splice(
                0,
                preSaveActions.length,
                ...(prepared.actions || []),
            );
            preSaveMoveEnabled.value = false;
            preSaveMoveTitle.value =
                trimValue(prepared.move?.to) || getCurrentTitle();
        } catch (error) {
            sourceFetchState.error = getErrorMessage(error);
        } finally {
            sourceFetchState.loading = false;
        }
    }

    /**
     * Creates the running save-progress state for a submit attempt.
     *
     * @param title - Current page title.
     * @param pending - Pending follow-up actions.
     * @returns Running save progress state.
     */
    function createRunningSaveProgress(title: string, pending: any): any {
        const progress = createSaveProgress(
            title,
            pending.actions || [],
            pending.move || {},
            pending.registration || {},
            pending.progressGroups || [],
        );

        return updateSaveProgress(progress, 'save', 'running');
    }

    /**
     * Creates callbacks used by the submit path to update this dialog.
     *
     * @returns Progress reporter callbacks.
     */
    function createPreSaveProgressReporter(): any {
        const reporter = {
            fail: failPreSaveProgress,
            report: reportPreSaveProgress,
            set: setPreSaveProgressStep,
            start: startPreSaveProgress,
        };
        return reporter;
    }

    /**
     * Marks the active pre-save step as failed.
     *
     * @param error - Caught error.
     */
    function failPreSaveProgress(error: unknown): void {
        if (preSaveProgress.value == null) {
            return;
        }

        const steps: Array<{ id: string; status: string }> =
            preSaveProgress.value.steps;
        const running = steps.find((step) => step.status === 'running');
        reportPreSaveProgress(error);

        if (running != null) {
            setPreSaveProgressStep(running.id, 'failed');
        }
    }

    /**
     * Records a pre-save error without changing step state.
     *
     * @param error - Caught error.
     */
    function reportPreSaveProgress(error: unknown): void {
        if (preSaveProgress.value == null) {
            return;
        }

        preSaveProgress.value = {
            ...preSaveProgress.value,
            error: error instanceof Error ? error.message : String(error),
        };
    }

    /**
     * Starts save progress for the current submit attempt.
     *
     * @param title - Page title.
     * @param pending - Pending value.
     */
    function startPreSaveProgress(title: string, pending: unknown): void {
        preSaveProgress.value = createRunningSaveProgress(title, pending);
    }

    /**
     * Updates one in-dialog progress step.
     *
     * @param id - Progress step ID.
     * @param status - New status.
     * @returns Result when the function
     *   updates one in-dialog progress step.
     */
    function setPreSaveProgressStep(id: string, status: string): void {
        if (preSaveProgress.value == null) {
            return;
        }

        preSaveProgress.value = updateSaveProgress(
            preSaveProgress.value,
            id,
            status,
        );
    }

    /**
     * Handles create reviewed submit pending.
     *
     * Creates the pending follow-up action payload for a reviewed
     * submit.
     *
     * @returns Pending submit payload.
     */
    function createReviewedSubmitPending(): any {
        const result = {
            actions: preSaveActions,
            move: {
                enabled: false,
                to: getCurrentTitle(),
            },
            progressGroups: serializePreSaveProgressGroups(preSaveGroups.value),
            progress: createPreSaveProgressReporter(),
            registration: {
                enabled: form.registerNewPage !== false,
            },
        };
        return result;
    }

    /**
     * Describes one persisted save-progress step.
     */
    interface VisibleProgressStep {
        id: unknown;
        label: unknown;
    }

    /**
     * Describes save-progress steps grouped by target page.
     */
    interface VisibleProgressGroup {
        steps: VisibleProgressStep[];
        targetPage: unknown;
    }

    /**
     * Builds one progress row shown in the pre-save dialog.
     *
     * @param step - Persisted save-progress step.
     * @returns Pre-save dialog row.
     */
    function createVisiblePreSaveRow(step: VisibleProgressStep) {
        const result = {
            key: step.id,
            label: step.label,
            step,
            type: 'progress',
        };
        return result;
    }

    /**
     * Builds one visible pre-save progress group.
     *
     * @param group - Persisted target-page progress group.
     * @returns Pre-save dialog group.
     */
    function createVisiblePreSaveGroup(group: VisibleProgressGroup) {
        const result = {
            key: group.targetPage,
            rows: group.steps.map(createVisiblePreSaveRow),
            title: group.targetPage,
        };
        return result;
    }

    /**
     * Checks whether submit must first move to another title.
     *
     * @param moveTitle - Move title value.
     * @returns Whether submit must first move to another title.
     */
    function shouldMoveBeforeSubmit(moveTitle: string): boolean {
        const result =
            preSaveMoveEnabled.value &&
            moveTitle !== '' &&
            moveTitle !== getCurrentTitle();
        return result;
    }

    /**
     * Moves the pending article target before submission.
     *
     * @param moveTitle - Move title value.
     */
    async function submitMoveTarget(moveTitle: string): Promise<void> {
        await options.onMoveTarget(form, moveTitle, sourceFetchState);

        if (sourceFetchState.error === '') {
            preSaveOpen.value = false;
        }
    }

    /**
     * Gets the edited preview payload when one was submitted.
     *
     * @returns The edited preview payload when one was submitted.
     */
    function getReviewedPreview(): any | undefined {
        if (!previewSubmitted.value) {
            return undefined;
        }

        return { summary: previewSummary.value, text: previewText.value };
    }

    /**
     * Formats one live field input value.
     *
     * @param field - Field value.
     * @param value - Input value.
     * @returns One live field input value.
     */
    function getFormattedFieldValue(field: any, value: string): string {
        const completed = completeWikiLinkBrackets(
            field.key,
            value,
            form[field.key],
        );
        let normalized = completed;

        if (field.key === 'enwikiTitle') {
            normalized = normalizeEnwikiTitleValue(completed);
        }

        if (isCompletableMetadataField(field.key)) {
            return completeMetadataFieldValue(field.key, normalized);
        }

        return formatArticleFormField(form, field.key, normalized);
    }

    /**
     * Refreshes state derived from an updated field.
     *
     * @param key - Lookup key.
     */
    function updateFieldDependencies(key: string): void {
        if (
            key === 'pageName' &&
            trimValue(form.pageName) !== previewWithoutMoveTitle.value
        ) {
            moveTargetRequest += 1;
            previewWithoutMoveTitle.value = '';
            moveTargetState.checkedTitle = '';
            moveTargetState.exists = null;
            moveTargetState.loading = false;
        }

        if (key === 'enwikiTitle') {
            void refreshEnwikiMetadata();
        }

        if (WIKI_LINK_COMPLETION_FIELDS.has(key)) {
            navboxRowsPrepared = false;
        }
    }

    /**
     * Creates Vue component options from initialized dialog state.
     *
     * @returns Vue component options from initialized dialog state.
     */
    type VgStubCreatorSetupBindings = ReturnType<typeof getCoreSetupState> &
        ReturnType<typeof getFieldSetupState> &
        ReturnType<typeof getHistorySetupState> &
        ReturnType<typeof getPreviewSetupState>;

    function createComponentDefinition() {
        const result = {
            methods,
            /**
             * Exposes dialog state and actions to the template.
             *
             * @returns Component state consumed by the template.
             */
            setup(): VgStubCreatorSetupBindings {
                watchFormChanges();
                watchActiveTab();
                watchPreviewEditor();
                watchPageEditEditor();
                registerUnmountHandler();
                registerLinkNavigationEvents();
                actionLayoutQuery?.addEventListener(
                    'change',
                    updateActionLayout,
                );
                if (open.value) {
                    void metadataEditor.refreshRelatedItems();
                }
                const state = {
                    ...getCoreSetupState(),
                    ...getFieldSetupState(),
                    ...getHistorySetupState(),
                    ...getPreviewSetupState(),
                };
                return state;
            },
            template: VG_STUB_CREATOR_DIALOG_TEMPLATE,
        };
        return result;
    }

    /**
     * Gets core dialog setup bindings.
     *
     * @returns Core dialog setup bindings.
     */
    function getCoreSetupState() {
        const state = {
            activeCitationTab: citationEditor.state.activeCitationTab,
            activeTab,
            categoryState,
            categoryViewOpen,
            categoryViewState,
            pageEditOpen,
            pageEditState,
            pageEditTextArea,
            pageEditValidationError,
            citationTableColumns: CITATION_TABLE_COLUMNS,
            citationState: citationEditor.state.citationState,
            compactActions,
            linkNavigationModifier,
            groups: ARTICLE_PARAMETER_GROUPS,
            form,
            nameRoleOptions: (
                [
                    'pageName',
                    'redirect',
                    'noteTa',
                    'sortKey',
                    'displayTitle',
                ] as const
            ).map((key) => ({
                key,
                label: msg(
                    (
                        {
                            pageName: 'names.useAsPageName',
                            displayTitle: 'names.useAsDisplayTitle',
                            redirect: 'names.useAsRedirect',
                            sortKey: 'names.useAsSortKey',
                            noteTa: 'names.useAsNoteTA',
                        } as const
                    )[key],
                ),
            })),
            metadataEntryValues: metadataEditor.state.metadataEntryValues,
            sourceEntryValues: sourceUrlEditor.state.sourceEntryValues,
            relatedEntryValues: metadataEditor.state.relatedEntryValues,
            fetchedSteamNameRows: nameEditor.state.fetchedSteamNameRows,
            externalLinkIcon: cdxIconNewWindow,
            nameUsageIdPrefix,
            interfaceLocale,
            msg,
            msgParts,
        };
        return state;
    }

    /**
     * Gets form field helper setup bindings.
     *
     * @returns Form field helper setup bindings.
     */
    function getFieldSetupState() {
        const state = {
            getSteamNameSuggestions,
            getCitationParamRows,
            getCitationParamTableRows,
            getCitationTabsKey,
            getCitationTabName,
            getCitationTabLabel,

            getMetadataFieldLabel: methods.getMetadataFieldLabel,
            getArticleField,
            getArticlePreviewTitle,
            getFieldPlaceholder: options.getFieldPlaceholder.bind(null, form),
            getFieldPreview,
            getGroupPreview,
            getProseReviewDescription,
            getNameSearchRows: nameEditor.getNameSearchRows,
            getEnwikiTipLinks,
            getWikidataText,
            getWikidataStatusText,
        };
        return state;
    }

    /**
     * Gets history and navigation setup bindings.
     *
     * @returns History and navigation setup bindings.
     */
    function getHistorySetupState() {
        const state = {
            historyEntries,
            historyJsonEditable,
            historyJsonError,
            historyJsonOpen,
            historyJsonText,
            historyLoading,
            historyOpen,
            mainActionMenuItems: MAIN_ACTION_MENU_ITEMS,
            mainActionMenuSelection,
            moveOpen,
            movePreviewConfirmation,
            moveTarget,
            moveTargetInput,
            moveTargetState,
            moveTargetValidationError,
            nameMarkets: NAME_MARKETS,
            open,
            reviewState,
        };
        return state;
    }

    /**
     * Gets save and preview setup bindings.
     *
     * @returns Save and preview setup bindings.
     */
    function getPreviewSetupState() {
        const state = {
            preSaveMoveEnabled,
            preSaveMoveTitle,
            preSaveOpen,
            preSaveActions,
            preSaveGroups,
            preSaveProgress,
            preSaveProgressGroups,
            previewOpen,
            previewText,
            previewValidationError,
            previewSummary,
            previewHtml,
            previewLoading,
            previewLoadingMessage,
            previewSubmitted,
            previewTextArea,
            sourceFetchState,
            steamNameButtons: STEAM_NAME_BUTTONS,
            steamUrl: nameEditor.state.steamUrl,
            tableActionIcons: TABLE_ACTION_ICONS,
            stubTagRows,
        };
        return state;
    }

    /**
     * Releases generated preview text and HTML after dismissal.
     *
     * @returns Result when the function
     *   releases generated preview text and html after
     *   dismissal.
     */
    function clearPreviewState(): void {
        previewText.value = '';
        previewSummary.value = '';
        previewHtml.value = '';
    }

    /**
     * Releases fetched page edit text and parsed HTML after dismissal.
     *
     * @returns Result when the function
     *   releases fetched page edit text and parsed html
     *   after dismissal.
     */
    function clearPageEditState(): void {
        pageEditRequest += 1;
        Object.assign(pageEditState, {
            error: '',
            html: '',
            loading: false,
            row: null,
            text: '',
            title: '',
        });
    }

    /**
     * Validates a required dialog field and focuses its control on failure.
     *
     * @param value - Current field value.
     * @param errorRef - Reactive validation message.
     * @param controlRef - Vue control reference.
     * @returns Whether the field contains non-whitespace text.
     */
    function validateRequiredField(
        value: unknown,
        errorRef: { value: string },
        controlRef: { value: unknown },
    ): boolean {
        if (trimValue(value) !== '') {
            errorRef.value = '';
            return true;
        }

        errorRef.value = msg('validation.required');
        focusDialogControl(controlRef);
        return false;
    }

    /**
     * Focuses the first native control exposed by a Codex component ref.
     *
     * @param controlRef - Vue control reference.
     */
    function focusDialogControl(controlRef: { value: any }): void {
        const focus = function focusRequiredControl() {
            const root = controlRef.value?.$el || controlRef.value;
            const controlSelector = [
                "input:not([type='hidden'])",
                'textarea',
                "[contenteditable='true']",
            ].join(', ');
            const control = root?.matches?.(controlSelector)
                ? root
                : root?.querySelector?.(controlSelector);

            control?.focus?.();
        };

        if (typeof Vue.nextTick === 'function') {
            void Vue.nextTick(focus);
            return;
        }

        focus();
    }

    /**
     * Refreshes category rows through the owning module.
     *
     * @param refreshOptions - Refresh options value.
     * @returns Resolves after rows are refreshed.
     */
    async function refreshCategoryRows(
        refreshOptions: any = {},
    ): Promise<void> {
        const originalForm = form;
        const state = categoryState;
        const categoryRows: any[] = form.categoryRows;

        const filterCallbackD = (row: unknown) => !isBlankCategoryRow(row);
        const filteredValues = categoryRows.filter(filterCallbackD);
        if (
            shouldSkipFixedRows(
                refreshOptions,
                filteredValues,
                isCategoryRowFixed,
            )
        ) {
            syncStubTagRowsFromCategories(form);
            return;
        }

        const request = ++categoryRowsRequest;
        const snapshot = categoryRows.map((row) => ({
            row,
            identity: getCategoryReviewIdentity(row),
            category: trimValue(row.category),
            stubTag: trimValue(row.stubTag),
        }));
        const queryKey = getCategoryRefreshQueryKey(form);
        const stubTagRows = form.stubTagRows;
        const stubTagKey = JSON.stringify(stubTagRows);
        const initialForm = cloneValue(form);
        const requestState = { error: '', loading: false };
        state.error = '';
        state.loading = true;

        try {
            await options.onCategoryRowsRefresh(
                initialForm,
                requestState,
                refreshOptions,
            );
        } catch (error) {
            requestState.error = getErrorMessage(error);
        } finally {
            if (form === originalForm && request === categoryRowsRequest) {
                state.loading = false;
            }
        }

        if (
            !componentMounted ||
            form !== originalForm ||
            request !== categoryRowsRequest ||
            getCategoryRefreshQueryKey(form) !== queryKey ||
            form.categoryRows !== categoryRows ||
            snapshot.length !== categoryRows.length ||
            snapshot.some(
                (item, index) =>
                    item.row !== categoryRows[index] ||
                    item.identity !==
                        getCategoryReviewIdentity(categoryRows[index]) ||
                    item.category !==
                        trimValue(categoryRows[index]?.category) ||
                    item.stubTag !== trimValue(categoryRows[index]?.stubTag),
            ) ||
            (refreshOptions.resetStubTags === true &&
                (form.stubTagRows !== stubTagRows ||
                    JSON.stringify(form.stubTagRows) !== stubTagKey))
        ) {
            return;
        }

        state.error = requestState.error;

        if (requestState.error) {
            return;
        }

        applyCategoryPatches(
            initialForm.categoryRows,
            initialForm.historyPatches?.categories,
        );
        mergePreparedCategoryRows(initialForm.categoryRows);
        markCategoryRowsFixed(form.categoryRows);
        ensureTrailingCategoryRow(form);

        if (refreshOptions.resetStubTags === true) {
            form.stubTagRows = null;
        }

        syncStubTagRowsFromCategories(form);
    }

    /** Builds the article-input signature used by category lookup requests. */
    function getCategoryRefreshQueryKey(values: any): string {
        return JSON.stringify({
            ...values,
            categoryRows: null,
            metadataItemRows: null,
            citationRows: null,
            navboxRows: null,
            redirectRows: null,
            stubTagRows: null,
        });
    }

    /** Matches a category's source and original title or company across refreshes. */
    function getCategoryReviewIdentity(row: any): string {
        const source = trimValue(row?.source).replace(/ †$/u, '');
        const title = trimValue(
            row?.company || row?.originalCategory || row?.category,
        )
            .replace(/_/gu, ' ')
            .toLocaleLowerCase();
        return `${source}\n${title}`;
    }

    /** Applies confirmed category metadata while preserving reviewed row state. */
    function mergePreparedCategoryRows(rows: any[]): void {
        const currentRows: any[] = form.categoryRows;
        const matchedRows = new Set<any>();
        const merged = rows.map((row) => {
            const identity = getCategoryReviewIdentity(row);
            const current = currentRows.find(
                (candidate) =>
                    !matchedRows.has(candidate) &&
                    getCategoryReviewIdentity(candidate) === identity,
            );
            const values = { ...row };
            delete values.pendingEdit;
            delete values.pendingCreation;

            if (current == null) {
                return values;
            }

            matchedRows.add(current);
            const enabled = current.enabled;
            const stubTagEnabled = current.stubTagEnabled;
            const pendingEdit = current.pendingEdit;
            const pendingCreation = current.pendingCreation;
            Object.assign(current, values);
            current.enabled = enabled;
            current.stubTagEnabled = stubTagEnabled ?? row.stubTagEnabled;

            if (pendingCreation != null) {
                current.pendingCreation = pendingCreation;
                current.status = 'Pending creation';
            } else if (pendingEdit != null) {
                current.pendingEdit = pendingEdit;
                current.status = pendingEdit.create
                    ? 'Pending creation'
                    : 'Pending edit';
            }

            return current;
        });
        const retained = currentRows.filter(
            (row) =>
                !matchedRows.has(row) &&
                !isBlankCategoryRow(row) &&
                (trimValue(row.source).startsWith('manual') ||
                    row.relatedItemId ||
                    row.relatedModified === true ||
                    row.relatedDisabledByItem != null ||
                    row.pendingEdit != null ||
                    row.pendingCreation != null),
        );
        currentRows.splice(0, currentRows.length, ...merged, ...retained);
    }

    /**
     * Gets category refresh options for a review refresh.
     *
     * @param refreshOptions - Requested refresh options.
     * @returns Category refresh options.
     */
    function getCategoryRefreshOptions(refreshOptions: any): any {
        if (refreshOptions.recheck !== true) {
            return refreshOptions;
        }

        const result = {
            ...refreshOptions,
            bypassCache: true,
        };
        return result;
    }

    /**
     * Displays failures from review refresh actions without replacing reviewed rows.
     *
     * @param refresh - Offline-capable review refresh operation.
     * @returns Resolves after the latest refresh feedback is updated.
     */
    async function runReviewRefresh(
        refresh: () => Promise<void>,
    ): Promise<void> {
        const originalForm = form;
        const state = reviewState;
        const request = ++reviewRefreshRequest;
        state.error = '';
        state.loading = true;

        try {
            await refresh();
        } catch (error) {
            if (
                componentMounted &&
                form === originalForm &&
                request === reviewRefreshRequest
            ) {
                state.error = getErrorMessage(error);
            }
        } finally {
            if (form === originalForm && request === reviewRefreshRequest) {
                state.loading = false;
            }
        }
    }

    /**
     * Refreshes categories and generated review details.
     *
     * @param refreshOptions - Refresh options value.
     * @returns Resolves after review data is refreshed.
     */
    async function refreshReview(refreshOptions: any = {}): Promise<void> {
        await runReviewRefresh(async () => {
            const categoryRefreshOptionsResult =
                getCategoryRefreshOptions(refreshOptions);
            await Promise.all([
                refreshCategoryRows(categoryRefreshOptionsResult),
                refreshRedirectRows(refreshOptions),
                refreshNavboxRows(
                    refreshOptions.recheck === true,
                    false,
                    refreshOptions,
                ),
            ]);
            await metadataEditor.checkRelatedPageRows();
        });
    }

    /**
     * Merges a refreshed navbox row with the current editable row.
     *
     * @param row - Refreshed navbox row.
     * @param matchedRows - Current rows already matched by this refresh.
     * @returns Merged row.
     */
    function updatePreparedNavboxRow(row: any, matchedRows: Set<any>): any {
        const key = getNavboxTitle(row.sourceTitle || row.title)
            .replace(/_/gu, ' ')
            .toLocaleLowerCase();
        const current = form.navboxRows.find(
            (candidate: any) =>
                !matchedRows.has(candidate) &&
                [candidate.sourceTitle, candidate.title, candidate.text].some(
                    (value) =>
                        value && getRelatedIdentity(value, 'navbox') === key,
                ),
        );

        if (current == null) {
            return row;
        }

        matchedRows.add(current);
        if (row.relatedGenerated === true && current.relatedModified === true) {
            return current;
        }
        const enabled = current.enabled;
        const pendingEdit = current.pendingEdit;
        Object.assign(current, row);
        current.enabled = enabled;

        if (pendingEdit != null) {
            current.pendingEdit = pendingEdit;
            current.status = pendingEdit.create
                ? 'Pending creation'
                : 'Pending edit';
        }

        return current;
    }

    /**
     * Generates navbox rows when needed or explicitly requested.
     *
     * @param force - Whether to replace reviewed rows.
     * @param rebuild - Rebuild value.
     * @param refreshOptions - Refresh options value.
     * @returns Resolves after navbox rows are
     * refreshed.
     */
    async function refreshNavboxRows(
        force: boolean,
        rebuild = false,
        refreshOptions: Record<string, unknown> = {},
    ): Promise<void> {
        if (!force && navboxRowsPrepared) {
            return;
        }

        if (shouldSkipNavboxRefresh(force, rebuild, refreshOptions)) {
            navboxRowsPrepared = true;
            return;
        }

        const originalForm = form;
        const currentRows = form.navboxRows;
        const title = getCurrentTitle();
        const metadataKey = JSON.stringify(
            RELATED_FIELDS.map((field) => form[field]),
        );
        const request = ++navboxRowsRequest;
        const snapshot = (currentRows || []).map((row: any) => ({
            row,
            removed: row.relatedRemoved === true,
            title: trimValue(row.title),
            text: trimValue(row.text),
        }));
        const initialForm = cloneValue(form);
        const rows = await getPreparedNavboxRows(rebuild, initialForm);

        if (
            !componentMounted ||
            form !== originalForm ||
            request !== navboxRowsRequest ||
            form.navboxRows !== currentRows ||
            getCurrentTitle() !== title ||
            JSON.stringify(RELATED_FIELDS.map((field) => form[field])) !==
                metadataKey ||
            snapshot.length !== (currentRows?.length ?? 0) ||
            snapshot.some(
                (item: any, index: number) =>
                    item.row !== currentRows[index] ||
                    item.removed !==
                        (currentRows[index]?.relatedRemoved === true) ||
                    item.title !== trimValue(currentRows[index]?.title) ||
                    item.text !== trimValue(currentRows[index]?.text),
            )
        ) {
            return;
        }

        if (Array.isArray(form.navboxRows)) {
            mergePreparedNavboxRows(
                rows,
                refreshOptions.preserveManual === true,
            );
            return;
        }

        form.navboxRows = rows;
        ensureTrailingNavboxRow(form);
        navboxRowsPrepared = true;
    }

    /**
     * Checks whether fixed navbox rows should be preserved.
     *
     * @param force - Force value.
     * @param rebuild - Rebuild value.
     * @param refreshOptions - Refresh behavior.
     * @returns Whether fixed navbox rows should be preserved.
     */
    function shouldSkipNavboxRefresh(
        force: boolean,
        rebuild: boolean,
        refreshOptions: Record<string, unknown>,
    ): boolean {
        const navboxRows: unknown[] = form.navboxRows || [];
        const filterCallbackC = (row: unknown) => !isBlankNavboxRow(row);
        const rows = navboxRows.filter(filterCallbackC);
        const result =
            force &&
            !rebuild &&
            shouldSkipFixedRows(refreshOptions, rows, isNavboxRowFixed);
        return result;
    }

    /**
     * Builds patched generated navbox rows.
     *
     * @param rebuild - Rebuild value.
     * @param initialForm - Snapshot used to prepare the requested rows.
     * @returns Patched generated navbox rows.
     */
    async function getPreparedNavboxRows(
        rebuild: boolean,
        initialForm: any,
    ): Promise<any[]> {
        const prepared = await options.onPrepareReview(initialForm, rebuild);
        const generated = rebuild || !Array.isArray(initialForm.navboxRows);
        const metadata = buildRelatedFieldMetadata(initialForm);
        const mapCallbackD = function callback(row: any) {
            const relatedField = getRelatedItemField(
                row,
                'navbox',
                metadata,
                initialForm.categoryRows,
            );
            const knownField = RELATED_FIELDS.some((field) =>
                [row.sourceTitle, row.title, row.text].some((value) =>
                    metadata[field].navbox.has(
                        getRelatedIdentity(value, 'navbox'),
                    ),
                ),
            );
            return {
                ...createNavboxRow(row, true),
                sourceTitle: trimValue(row.sourceTitle),
                ...(generated
                    ? {
                          relatedGenerated: true,
                          relatedField:
                              !knownField &&
                              trimValue(initialForm.series) !== ''
                                  ? 'series'
                                  : relatedField,
                      }
                    : {}),
            };
        };
        const rows = prepared.map(mapCallbackD);
        return applyNavboxPatches(
            rows,
            initialForm.historyPatches?.navboxes,
        ).map((row, index) => ({
            ...row,
            sourceTitle: rows[index].sourceTitle,
        }));
    }

    /**
     * Merges generated navboxes into the current reactive rows.
     *
     * @param rows - Row values.
     */
    function mergePreparedNavboxRows(
        rows: Array<any>,
        preserveManual = false,
    ): void {
        const matchedRows = new Set<any>();
        const merged = rows.map((row) =>
            updatePreparedNavboxRow(row, matchedRows),
        );
        const retained = preserveManual
            ? form.navboxRows.filter(
                  (row: any) =>
                      !matchedRows.has(row) &&
                      (!isBlankNavboxRow(row) ||
                          metadataEditor.methods.isRelatedItemEditing(row)) &&
                      (row.relatedGenerated !== true ||
                          row.relatedItemId ||
                          row.relatedModified === true ||
                          row.relatedDisabledByItem != null ||
                          row.pendingEdit != null),
              )
            : [];
        form.navboxRows.splice(
            0,
            form.navboxRows.length,
            ...merged,
            ...retained,
        );
        ensureTrailingNavboxRow(form);
        navboxRowsPrepared = true;
    }

    /**
     * Refreshes generated redirect review rows.
     *
     * @param refreshOptions - Refresh options value.
     * @returns Resolves after redirect rows are
     * refreshed.
     */
    async function refreshRedirectRows(
        refreshOptions: { rebuild?: boolean; recheck?: boolean } = {},
    ): Promise<void> {
        const namesKey = getNamesRefreshQueryKey(form);
        if (
            Array.isArray(form.redirectRows) &&
            refreshOptions.rebuild !== true &&
            (namesKey === redirectNamesQueryKey ||
                options.onPrepareRedirectRows == null)
        ) {
            await checkRedirectRows(refreshOptions);
            return;
        }

        if (options.onPrepareRedirectRows == null) {
            return;
        }

        const currentTitleResultB = getCurrentTitle();
        const originalForm = form;
        const previousRows = form.redirectRows;
        const request = ++redirectRowsRequest;
        const initialForm = cloneValue(form);
        const snapshot = (previousRows || []).map((row: any) => ({
            row,
            title: trimValue(row.title),
        }));
        const preparedRows: unknown[] = await options.onPrepareRedirectRows(
            initialForm,
            currentTitleResultB,
        );

        if (
            !componentMounted ||
            form !== originalForm ||
            request !== redirectRowsRequest ||
            form.redirectRows !== previousRows ||
            snapshot.length !== (previousRows?.length || 0) ||
            snapshot.some(
                (item: any, index: number) =>
                    item.row !== previousRows[index] ||
                    item.title !== trimValue(previousRows[index]?.title),
            ) ||
            getCurrentTitle() !== currentTitleResultB ||
            getNamesRefreshQueryKey(form) !== namesKey
        ) {
            return;
        }

        const rows = preparedRows.map((row: unknown) => {
            const generated = createRedirectRow(row, true);
            generated.generatedTitle = generated.title;
            return generated;
        });
        if (refreshOptions.rebuild === true || !Array.isArray(previousRows)) {
            form.redirectRows = rows;
        } else {
            const matchedRows = new Set<any>();
            const merged = rows.map((row: any) => {
                const identity = getRelatedIdentity(row.title);
                const current = previousRows.find(
                    (candidate: any) =>
                        !matchedRows.has(candidate) &&
                        getRelatedIdentity(candidate.title) === identity,
                );
                if (current != null) {
                    matchedRows.add(current);
                }
                return mergeCheckedRedirectRow(row, current);
            });
            const retained = previousRows.filter(
                (row: any) =>
                    !matchedRows.has(row) &&
                    (!isBlankRedirectRow(row) ||
                        (row.manualAdded === true && row.nameSourceId)) &&
                    (row.manualAdded === true ||
                        !row.generatedTitle ||
                        row.enabled === false ||
                        row.pendingEdit != null ||
                        getRelatedIdentity(row.title) !==
                            getRelatedIdentity(row.generatedTitle)),
            );
            previousRows.splice(0, previousRows.length, ...merged, ...retained);
        }
        redirectNamesQueryKey = namesKey;
        ensureTrailingRedirectRow(form);
    }

    /** Identifies the article names and target that contribute redirect suggestions. */
    function getNamesRefreshQueryKey(values: any): string {
        return JSON.stringify([
            values.pageName,
            values.name,
            values.originalName,
            values.englishName,
            values.localizedNames,
            (values.nameRoleRows || []).filter(
                (row: any) => row.role === 'redirect',
            ),
        ]);
    }

    /**
     * Checks current redirect review rows in place.
     *
     * @param refreshOptions - Refresh options value.
     * @returns Resolves after redirect rows are fixed.
     */
    async function checkRedirectRows(refreshOptions = {}): Promise<void> {
        if (options.onCheckRedirectRows == null) {
            return;
        }

        let currentRows: any[] = [];

        if (Array.isArray(form.redirectRows)) {
            currentRows = form.redirectRows;
        }
        const filterCallbackB = (row: any) => !isBlankRedirectRow(row);
        const rowsToCheck = currentRows.filter(filterCallbackB);

        if (
            shouldSkipFixedRows(refreshOptions, rowsToCheck, isRedirectRowFixed)
        ) {
            return;
        }

        const currentTitleResultA = getCurrentTitle();
        const originalForm = form;
        const request = ++redirectRowsRequest;
        const snapshot = currentRows.map((row) => ({
            row,
            title: trimValue(row.title),
        }));
        const titlesToCheck = rowsToCheck.map((row) => ({
            title: trimValue(row.title),
        }));
        const checkedRows: unknown[] = await options.onCheckRedirectRows(
            titlesToCheck,
            currentTitleResultA,
        );

        if (
            !componentMounted ||
            form !== originalForm ||
            request !== redirectRowsRequest ||
            form.redirectRows !== currentRows ||
            getCurrentTitle() !== currentTitleResultA ||
            snapshot.length !== currentRows.length ||
            snapshot.some(
                (item, index) =>
                    item.row !== currentRows[index] ||
                    item.title !== trimValue(currentRows[index]?.title),
            )
        ) {
            return;
        }

        const mapCallbackB = (row: unknown) => createRedirectRow(row, true);
        const rows = checkedRows.map(mapCallbackB);

        const checkedByTitle = new Map(
            rows.map((row) => [getRelatedIdentity(row.title), row]),
        );
        const matchedTitles = new Set<string>();
        const checked = currentRows.flatMap((current) => {
            const identity = getRelatedIdentity(current.title);
            const row = checkedByTitle.get(identity);
            if (row != null) {
                matchedTitles.add(identity);
                return [mergeCheckedRedirectRow(row, current)];
            }
            return current.manualAdded === true || current.pendingEdit != null
                ? [current]
                : [];
        });
        const unmatched = rows.filter(
            (row) => !matchedTitles.has(getRelatedIdentity(row.title)),
        );
        currentRows.splice(0, currentRows.length, ...checked, ...unmatched);
        ensureTrailingRedirectRow(form);
    }

    /**
     * Preserves editable state for a checked redirect row.
     *
     * @param row - Row values.
     * @param current - Current editable row for the checked title.
     * @returns Result when the function
     *   preserves editable state for a checked redirect
     *   row.
     */
    function mergeCheckedRedirectRow(row: any, current: any): any {
        if (current == null) {
            return row;
        }

        const enabled = current.enabled;
        const pendingEdit = current.pendingEdit;
        Object.assign(current, row);
        current.enabled = enabled;

        if (pendingEdit != null) {
            current.pendingEdit = pendingEdit;
            current.status = pendingEdit.create
                ? 'Pending creation'
                : 'Pending edit';
        }

        return current;
    }

    /**
     * Opens a source editor for a page action staged at final submit.
     *
     * @param params - Page edit parameters.
     * @param params.create - Whether the page is missing.
     * @param params.kind - Edited row kind.
     * @param params.row - Review row to update.
     * @param params.title - Full page title.
     * @returns Resolves after the editor is populated.
     */
    async function openPageEdit(params: any): Promise<void> {
        const request = ++pageEditRequest;
        const openPageEditStateResult = createOpenPageEditState(params);
        Object.assign(pageEditState, openPageEditStateResult);
        pageEditValidationError.value = '';
        pageEditOpen.value = true;
        queueSourceEditor('pageEdit', pageEditTextArea, pageEditTextBinding);

        try {
            await loadPageEditText(params, request);
        } catch (error) {
            if (isCurrentPageEdit(request)) {
                pageEditState.error = getErrorMessage(error);
            }
        } finally {
            if (isCurrentPageEdit(request)) {
                pageEditState.loading = false;
            }
        }
    }

    /** Accepts reads only while their page editor still owns the request. */
    function isCurrentPageEdit(request: number): boolean {
        return (
            componentMounted &&
            pageEditOpen.value === true &&
            pageEditRequest === request
        );
    }

    /**
     * Creates initial state for an opened page editor.
     *
     * @param params - Params value.
     * @returns Initial state for an opened page editor.
     */
    function createOpenPageEditState(params: any): any {
        const row = params.row;
        let company = '';

        if (params.kind === 'category') {
            company = trimValue(row.company);
        }
        const result = {
            create: params.create,
            company,
            englishName: trimValue(
                row.pendingEdit?.englishName ||
                    row.pendingCreation?.englishName,
            ),
            error: '',
            html: '',
            kind: params.kind,
            loading: true,
            pending: row.pendingEdit != null,
            previousStatus: row.pendingEdit?.previousStatus || row.status,
            row,
            text: '',
            title: params.title,
        };
        return result;
    }

    /**
     * Loads and parses the source used by a page editor.
     *
     * @param params - Params value.
     */
    async function loadPageEditText(
        params: any,
        request: number,
    ): Promise<void> {
        const staged = getStagedPageText(params.row, params.kind);
        const text = staged ?? (await getPageEditFallbackText(params));
        if (!isCurrentPageEdit(request)) return;
        pageEditState.text = text;
        setSourceEditorText('pageEdit', text);
        await parsePageEditPreview(request, text, params.title);
    }

    /** Retains newer source edits while an older preview response is pending. */
    async function parsePageEditPreview(
        request: number,
        text: string,
        title: string,
    ): Promise<void> {
        try {
            const html = await options.onParsePreview(text, title);
            if (isCurrentPageEditSource(request, text)) {
                pageEditState.html = html;
            }
        } catch (error) {
            if (isCurrentPageEditSource(request, text)) {
                pageEditState.error = getErrorMessage(error);
            }
        }
    }

    /** Checks the backing source as well as the reactive textarea draft. */
    function isCurrentPageEditSource(request: number, text: string): boolean {
        if (!isCurrentPageEdit(request)) return false;
        syncSourceEditorText('pageEdit', pageEditTextBinding);
        return pageEditState.text === text;
    }

    /**
     * Gets source text when no staged page edit exists.
     *
     * @param params - Params value.
     * @returns Source text when no staged page edit exists.
     */
    async function getPageEditFallbackText(params: any): Promise<string> {
        if (params.create) {
            return await getNewPageEditText(params);
        }

        return await options.onFetchPageText(params.title);
    }

    /**
     * Gets already staged source text for a review row.
     *
     * @param row - Review row.
     * @param kind - Review row kind.
     * @returns Staged source text.
     */
    function getStagedPageText(row: any, kind: string): string | undefined {
        if (kind === 'category' && row.pendingCreation != null) {
            return String(row.pendingCreation.text || '');
        }

        if (row.pendingEdit != null) {
            return String(row.pendingEdit.text || '');
        }

        return undefined;
    }

    /**
     * Handles get page edit create state.
     *
     * Gets whether a review-row source editor should create or modify a
     * page.
     *
     * @param row - Review row.
     * @param fallbackCreate - Status-derived create state.
     * @returns Whether the editor should stage a create.
     */
    function getPageEditCreateState(
        row: any,
        fallbackCreate: boolean,
    ): boolean {
        if (row?.pendingEdit != null) {
            return row.pendingEdit.create === true;
        }

        if (row?.pendingCreation != null) {
            return true;
        }

        return fallbackCreate;
    }

    /**
     * Gets the initial source for a missing page.
     *
     * @param params - Page edit parameters.
     * @returns Initial source text.
     */
    async function getNewPageEditText(params: any): Promise<string> {
        if (
            params.kind === 'category' &&
            trimValue(params.row.company) !== ''
        ) {
            return options.onPrepareCompanyCategory(params.row);
        }

        if (params.kind === 'redirect') {
            return `#REDIRECT [[${getCurrentTitle()}]]\n`;
        }

        return '';
    }

    /**
     * Stages the current page edit for the final submit.
     *
     * @returns Result when the function
     *   stages the current page edit for the final submit.
     */
    function stagePageEdit(): void {
        const row = pageEditState.row;

        if (row == null) {
            return;
        }

        if (pageEditState.kind === 'category' && pageEditState.create) {
            stageCategoryCreation(row);
            return;
        }

        row.pendingEdit = createPendingPageEdit(row);
        row.enabled = true;
        row.status = 'Pending edit';

        if (pageEditState.create) {
            row.status = 'Pending creation';
        }
        closePageEditor();
    }

    /**
     * Stages a new company category page.
     *
     * @param row - Row values.
     */
    function stageCategoryCreation(row: any): void {
        row.pendingCreation = {
            englishName: trimValue(pageEditState.englishName),
            previousStatus: row.pendingCreation?.previousStatus || row.status,
            text: pageEditState.text,
        };
        row.enabled = true;
        row.status = 'Pending creation';
        closePageEditor();
    }

    /**
     * Creates a staged generic page edit payload.
     *
     * @param row - Row values.
     * @returns A staged generic page edit payload.
     */
    function createPendingPageEdit(row: any): any {
        const englishName = trimValue(pageEditState.englishName);
        const pending = {
            create: pageEditState.create,
            ...(englishName === '' ? {} : { englishName }),
            previousStatus:
                row.pendingEdit?.previousStatus || pageEditState.previousStatus,
            summary: buildPageEditSummary(pageEditState),
            text: pageEditState.text,
            title: pageEditState.title,
        };
        return pending;
    }

    /**
     * Closes and clears the page source editor.
     */
    function closePageEditor(): void {
        destroySourceEditor('pageEdit');
        pageEditOpen.value = false;
        clearPageEditState();
    }

    /**
     * Cancels staged source changes for the current review row.
     *
     * @returns Result when the function
     *   cancels staged source changes for the current
     *   review row.
     */
    function resetPageEdit(): void {
        const row = pageEditState.row;

        if (row == null || row.pendingEdit == null) {
            return;
        }

        row.status =
            row.pendingEdit.previousStatus || pageEditState.previousStatus;
        delete row.pendingEdit;
        destroySourceEditor('pageEdit');
        pageEditOpen.value = false;
        clearPageEditState();
    }

    /**
     * Builds the edit summary for one staged page edit.
     *
     * @param state - Page edit state.
     * @returns Edit summary text.
     */
    function buildPageEditSummary(state: any): string {
        if (state.kind === 'navbox') {
            return buildNavboxEditSummary(state, getCurrentTitle());
        }

        const action = state.create ? 'create' : 'modify';
        return `${action} '${state.title}'`;
    }

    /**
     * Gets the current page title.
     *
     * @returns Current page title.
     */
    function getCurrentTitle(): string {
        return trimValue(form.pageName) || currentTitle;
    }

    /**
     * Handles move field url to source.
     *
     * Moves a URL entered into a source-backed value field to its
     * source field.
     *
     * @param field - Article parameter field.
     * @param field.key - Form key for the article value.
     * @param field.sourceField - Source reference field.
     * @param field.sourceField.sourceKey - Form key for the
     * source
     * URL.
     * @param value - Raw input value.
     * @returns Whether the URL was moved.
     */
    function moveFieldUrlToSource(field: any, value: string): boolean {
        const sourceKey = field.sourceField?.sourceKey;
        const sourceUrl = trimValue(value);

        if (sourceKey == null || !/^https?:\/\/\S+$/iu.test(sourceUrl)) {
            return false;
        }

        const existingValue = trimValue(form[sourceKey]);
        form[sourceKey] =
            existingValue === '' ? sourceUrl : `${existingValue}\n${sourceUrl}`;
        form[field.key] = '';

        return true;
    }

    /**
     * Gets the editable article preview dialog title.
     *
     * @returns Preview dialog title.
     */
    function getArticlePreviewTitle(): string {
        const currentTitleResult = { title: getCurrentTitle() };
        return msg('preview.createPageTitle', currentTitleResult);
    }

    /**
     * Builds a small wikitext preview for one field.
     *
     * @param field - Article parameter field.
     * @returns Preview wikitext, or an empty string.
     */
    function getFieldPreview(field: any): string {
        if (options.getFieldPreview == null) {
            return '';
        }

        return (
            options.getFieldPreview(form, field.previewKey || field.key) || ''
        );
    }

    /**
     * Builds a small wikitext preview for one group.
     *
     * @param group - Article parameter group.
     * @returns Preview wikitext, or an empty string.
     */
    function getGroupPreview(group: any): string {
        if (options.getFieldPreview == null || !group.previewKey) {
            return '';
        }

        return options.getFieldPreview(form, group.previewKey) || '';
    }

    /**
     * Formats the generated prose length for the full-text preview.
     *
     * @returns The generated prose length for the full-text preview.
     */
    function getProseReviewDescription(): string {
        const proseSinographsResult = {
            count: options.getProseSinographs(form),
        };
        const result = msg('preview.sinographs', proseSinographsResult);
        return result;
    }

    /**
     * Gets the Wikidata note text.
     *
     * @returns Wikidata ID or lookup status text.
     */
    function getWikidataText(): string {
        const result =
            form.wikidataId ||
            options.getFieldPlaceholder(form, {
                key: 'wikidataId',
            }) ||
            '';
        return result;
    }

    /**
     * Formats the Wikidata lookup note beside the metadata fields.
     *
     * @returns The Wikidata lookup note beside the metadata fields.
     */
    function getWikidataStatusText(): string {
        if (trimValue(form.enwikiTitle) === '' && !form.wikidataId) {
            return '';
        }
        const wikidataTextResult = { value: getWikidataText() };
        return msg('metadata.wikidataText', wikidataTextResult);
    }

    /**
     * Gets external links discovered from the English Wikipedia title.
     *
     * @returns Tip link definitions.
     */
    function getEnwikiTipLinks(): Array<any> {
        if (trimValue(form.enwikiTitle) === '') {
            return [];
        }
        if (enwikiLookupLoading.value) {
            const messageA = msg('metadata.checking');
            return createEnwikiTipPlaceholders(messageA);
        }

        const title = getBasePageTitle(form.enwikiTitle);
        const links = [
            createWikidataTipLink(title),
            createServiceTipLink(
                'Metacritic',
                enwikiMetadata.metacriticId,
                title,
            ),
            createServiceTipLink(
                'OpenCritic',
                enwikiMetadata.openCriticId,
                title,
            ),
            createServiceTipLink('Steam', enwikiMetadata.steamId, title),
        ];
        return links;
    }

    /**
     * Creates the Wikidata lookup tip link.
     *
     * @param title - Page title.
     * @returns The Wikidata lookup tip link.
     */
    function createWikidataTipLink(title: string): any {
        const id = form.wikidataId;
        let url = getOptionalSearchUrl(title, buildWikidataSearchUrl);

        if (id) {
            url = `https://www.wikidata.org/wiki/${encodeURIComponent(id)}`;
        }
        const result = {
            label: 'Wikidata',
            value: id || getWikidataLookupStatus(enwikiMetadata.pageExists),
            url,
        };
        return result;
    }

    /**
     * Creates one external review service tip link.
     *
     * @param label - Label value.
     * @param id - Id value.
     * @param title - Page title.
     * @returns One external review service tip link.
     */
    function createServiceTipLink(
        label: string,
        id: string,
        title: string,
    ): unknown {
        let url = getServiceSearchUrl(label, title);

        if (id) {
            url = buildServiceUrl(label, id);
        }
        const result = {
            label,
            value:
                id ||
                (title ? msg('metadata.search') : msg('metadata.notFound')),
            url,
        };
        return result;
    }

    /**
     * Builds a direct external review service URL.
     *
     * @param label - Label value.
     * @param id - Id value.
     * @returns A direct external review service URL.
     */
    function buildServiceUrl(label: string, id: string): string {
        if (label === 'Metacritic') {
            return buildMetacriticUrl(id);
        }

        if (label === 'OpenCritic') {
            return buildOpenCriticUrl(id);
        }

        return buildSteamUrl(id);
    }

    /**
     * Builds an external review service search URL.
     *
     * @param label - Label value.
     * @param title - Page title.
     * @returns An external review service search URL.
     */
    function getServiceSearchUrl(label: string, title: string): string {
        if (title === '') {
            return '';
        }

        if (label === 'Metacritic') {
            return buildMetacriticSearchUrl(title);
        }

        if (label === 'OpenCritic') {
            return buildOpenCriticSearchUrl(title);
        }

        return buildSteamSearchUrl(title);
    }

    /**
     * Calls a search URL builder only for a nonblank title.
     *
     * @param title - Page title.
     * @param buildUrl - Search URL builder.
     * @returns Result when the function
     *   calls a search url builder only for a nonblank
     *   title.
     */
    function getOptionalSearchUrl(
        title: string,
        buildUrl: (title: string) => string,
    ): string {
        return title === '' ? '' : buildUrl(title);
    }

    /**
     * Opens Metacritic and OpenCritic lookup links in new tabs.
     *
     * @returns Result when the function
     *   opens metacritic and opencritic lookup links in
     *   new tabs.
     */
    function openEnwikiReviewLinks(): void {
        if (typeof window?.open !== 'function') {
            return;
        }

        const filterCallbackA = function callback(link: {
            label: string;
            url: string;
        }) {
            return (
                ['Metacritic', 'OpenCritic'].includes(link.label) && link.url
            );
        };
        const reviewLinks = getEnwikiTipLinks()
            .filter(filterCallbackA)
            .map((link) => link.url);

        if (reviewLinks.length !== 2 || !claimReviewLinksOpeningForTab()) {
            return;
        }

        const mapCallbackA = (url: string) => window.open(url, '_blank');
        const openedTabs = reviewLinks
            .map(mapCallbackA)
            .filter((tab) => tab != null);

        const firstTab = openedTabs[0];

        if (typeof firstTab?.focus === 'function') {
            firstTab.focus();
        }
    }

    /**
     * Claims the one-time review-link opening for this browser tab.
     *
     * @returns Whether this component may open the links.
     */
    function claimReviewLinksOpeningForTab(): boolean {
        return reviewLinkSession.claim();
    }

    /**
     * Refreshes form values derived from the English Wikipedia title.
     *
     * @returns Resolves after the lookup is handled.
     */
    async function refreshEnwikiMetadata(): Promise<void> {
        const title = trimValue(form.enwikiTitle);
        const serial = enwikiLookupSerial.value + 1;

        resetEnwikiMetadataLookup(title, serial);

        if (title === '' || options.onEnwikiTitleChange == null) {
            return;
        }

        const metadata = await fetchEnwikiMetadata(title);

        if (serial !== enwikiLookupSerial.value) {
            return;
        }

        applyEnwikiMetadata(metadata);
        applyEnwikiSourceUrls();
        const fetchSteam = prepareEnwikiSteamNames();
        enwikiLookupLoading.value = false;
        openEnwikiReviewLinks();

        if (fetchSteam) {
            await nameEditor.fetchSteamNames();
        }

        if (open.value) {
            await metadataEditor.refreshRelatedItems(true);
        }
    }

    /**
     * Clears metadata before starting an English Wikipedia lookup.
     *
     * @param title - Page title.
     * @param serial - Serial value.
     */
    function resetEnwikiMetadataLookup(title: string, serial: number): void {
        enwikiLookupSerial.value = serial;
        enwikiLookupLoading.value =
            title !== '' && options.onEnwikiTitleChange != null;
        form.wikidataId = '';
        const blankEnwikiMetadataResultA = createBlankEnwikiMetadata();
        Object.assign(enwikiMetadata, blankEnwikiMetadataResultA);
    }

    /**
     * Fetches English Wikipedia metadata with an empty fallback.
     *
     * @param title - Page title.
     * @returns English Wikipedia metadata with an empty fallback.
     */
    async function fetchEnwikiMetadata(title: string): Promise<any> {
        try {
            return await options.onEnwikiTitleChange(title);
        } catch (_error) {
            return {};
        }
    }

    /**
     * Applies fetched English Wikipedia metadata to form state.
     *
     * @param metadata - Article metadata.
     */
    function applyEnwikiMetadata(metadata: any): void {
        const hasPageState =
            metadata.pageExists === true || metadata.pageExists === false;
        const trimmedValue = {
            metacriticId: trimValue(metadata.metacriticId),
            openCriticId: trimValue(metadata.openCriticId),
            pageExists: hasPageState ? metadata.pageExists : null,
            steamId: trimValue(metadata.steamId),
        };
        Object.assign(enwikiMetadata, trimmedValue);
        form.wikidataId = trimValue(metadata.wikidataId);

        if (trimValue(form.englishName) === '') {
            form.englishName = getBasePageTitle(metadata.title);
        }
    }

    /**
     * Fills blank review source URLs from fetched service IDs.
     */
    function applyEnwikiSourceUrls(): void {
        if (
            trimValue(form.metacriticScoreSourceUrl) === '' &&
            enwikiMetadata.metacriticId
        ) {
            form.metacriticScoreSourceUrl = buildMetacriticUrl(
                enwikiMetadata.metacriticId,
            );
        }

        if (
            trimValue(form.openCriticRecommendSourceUrl) === '' &&
            enwikiMetadata.openCriticId
        ) {
            form.openCriticRecommendSourceUrl = buildOpenCriticUrl(
                enwikiMetadata.openCriticId,
            );
        }
    }

    /**
     * Prepares a Steam name lookup when a new app ID is available.
     *
     * @returns Result when the function
     *   prepares a steam name lookup when a new app id is
     *   available.
     */
    function prepareEnwikiSteamNames(): boolean {
        const shouldFetch =
            trimValue(nameEditor.state.steamUrl.value) === '' &&
            enwikiMetadata.steamId;

        if (shouldFetch) {
            nameEditor.state.steamUrl.value = buildSteamUrl(
                enwikiMetadata.steamId,
            );
            nameEditor.state.fetchedSteamNameRows.value = [];
        }

        return Boolean(shouldFetch);
    }

    /**
     * Restores form values from history and refreshes enwiki metadata.
     *
     * @param values - Restored form values.
     * @returns Resolves after enwiki metadata is
     * refreshed.
     */
    async function restoreHistoryForm(values: any): Promise<void> {
        enwikiLookupSerial.value += 1;
        enwikiLookupLoading.value = false;
        clearFormState();
        replaceFormValues(form, values);
        syncMetadataItemRows(form);
        nameEditor.adoptNameOutputRoles();
        syncGeneratedNameNoteTaRow(form);
        navboxRowsPrepared = false;
        await refreshEnwikiMetadata();
        if (open.value) {
            await metadataEditor.refreshRelatedItems();
            await runReviewRefresh(() => refreshRedirectRows());
        }
    }

    /**
     * Clears form values and helper state.
     *
     * @returns Result when the function
     *   clears form values and helper state.
     */
    function clearFormState(): void {
        closePageEditor();
        metadataEditor.reset();
        nameEditor.reset();
        citationEditor.reset();
        sourceUrlEditor.reset();
        redirectNamesQueryKey = '';
        moveTargetRequest += 1;
        categoryRowsRequest += 1;
        navboxRowsRequest += 1;
        redirectRowsRequest += 1;
        reviewRefreshRequest += 1;
        const formValuesResult = {
            ...createFormValues(),
            publishers: '',
        };
        replaceFormValues(form, formValuesResult);
        syncMetadataItemRows(form);
        nameEditor.syncPageNameFields();
        nameEditor.adoptNameOutputRoles();
        syncGeneratedNameNoteTaRow(form);
        activeTab.value = ARTICLE_PARAMETER_GROUPS[0].key;
        const blankEnwikiMetadataResult = createBlankEnwikiMetadata();
        Object.assign(enwikiMetadata, blankEnwikiMetadataResult);
        categoryState.error = '';
        categoryState.loading = false;
        reviewState.error = '';
        reviewState.loading = false;
        sourceFetchState.error = '';
        sourceFetchState.loading = false;
        navboxRowsPrepared = false;
        form.redirectRows = null;
    }

    const WIKI_LINK_COMPLETION_FIELDS = new Set([
        'developers',
        'publishers',
        'series',
        'platforms',
        'genres',
    ]);

    /**
     * Completes wiki-link brackets for selected metadata list fields.
     *
     * @param key - Form field key.
     * @param value - Current input value.
     * @param previousValue - Previous stored field value.
     * @returns Input value with the matching wiki-link brackets
     * inserted.
     */
    function completeWikiLinkBrackets(
        key: string,
        value: any,
        previousValue: any,
    ): string {
        const text = String(value ?? '');

        if (!WIKI_LINK_COMPLETION_FIELDS.has(key)) {
            return text;
        }

        const stringValue = String(previousValue ?? '');
        const insertion = getInsertedText(stringValue, text);

        if (insertion == null) {
            return text;
        }

        const openingMarkerIndex = getInsertedMarkerIndex(
            text,
            insertion,
            '[[',
        );

        if (openingMarkerIndex >= 0) {
            return completeOpeningWikiLink(text, openingMarkerIndex);
        }

        const closingMarkerIndex = getInsertedMarkerIndex(
            text,
            insertion,
            ']]',
        );

        if (closingMarkerIndex >= 0) {
            return completeClosingWikiLink(text, closingMarkerIndex);
        }

        return text;
    }

    /**
     * Finds the single inserted range between two text values.
     *
     * @param previousText - Previous text.
     * @param text - Current text.
     * @returns Inserted text and index, or null when not a
     * simple
     * insertion.
     */
    function getInsertedText(previousText: string, text: string): any | null {
        if (text.length <= previousText.length) {
            return null;
        }

        let start = 0;

        while (
            start < previousText.length &&
            previousText[start] === text[start]
        ) {
            start += 1;
        }

        let previousEnd = previousText.length;
        let textEnd = text.length;

        while (
            previousEnd > start &&
            textEnd > start &&
            previousText[previousEnd - 1] === text[textEnd - 1]
        ) {
            previousEnd -= 1;
            textEnd -= 1;
        }

        if (previousEnd !== start) {
            return null;
        }

        const result = {
            index: start,
            text: text.slice(start, textEnd),
        };
        return result;
    }

    /**
     * Locates a completed marker touched by the current insertion.
     *
     * @param text - Current text.
     * @param insertion - Inserted text and index.
     * @param marker - Marker to find.
     * @returns Marker index, or -1 when the insertion did not
     * complete
     * it.
     */
    function getInsertedMarkerIndex(
        text: string,
        insertion: any,
        marker: string,
    ): number {
        const start = Math.max(0, insertion.index - marker.length + 1);
        const end = insertion.index + insertion.text.length;

        for (let index = start; index <= end - marker.length; index += 1) {
            if (text.slice(index, index + marker.length) === marker) {
                return index;
            }
        }

        return -1;
    }

    /**
     * Completes an opening wiki-link marker by adding its close marker.
     *
     * @param text - Current input text.
     * @param markerIndex - Index where "[[" was inserted.
     * @returns Completed input text.
     */
    function completeOpeningWikiLink(
        text: string,
        markerIndex: number,
    ): string {
        const segmentEnd = findListSegmentEnd(text, markerIndex + 2);
        const segmentAfterMarker = text.slice(markerIndex + 2, segmentEnd);

        if (segmentAfterMarker.includes(']]')) {
            return text;
        }

        const trailingWhitespace = segmentAfterMarker.match(/\s*$/u)?.[0] ?? '';
        const insertIndex = segmentEnd - trailingWhitespace.length;

        const result = [
            '',
            text.slice(0, insertIndex),
            ']]',
            text.slice(insertIndex),
            '',
        ].join('');
        return result;
    }

    /**
     * Completes a closing wiki-link marker by adding its open marker.
     *
     * @param text - Current input text.
     * @param markerIndex - Index where "]]" was inserted.
     * @returns Completed input text.
     */
    function completeClosingWikiLink(
        text: string,
        markerIndex: number,
    ): string {
        const segmentStart = findListSegmentStart(text, markerIndex);
        const segmentBeforeMarker = text.slice(segmentStart, markerIndex);

        if (segmentBeforeMarker.includes('[[')) {
            return text;
        }

        if (trimValue(segmentBeforeMarker) === '') {
            return text;
        }

        const leadingWhitespace = segmentBeforeMarker.match(/^\s*/u)?.[0] ?? '';
        const insertIndex = segmentStart + leadingWhitespace.length;

        const result = [
            '',
            text.slice(0, insertIndex),
            '[[',
            text.slice(insertIndex),
            '',
        ].join('');
        return result;
    }

    /**
     * Handles find list segment start.
     *
     * Finds the start index of the current semicolon/newline-delimited
     * item.
     *
     * @param text - Current input text.
     * @param index - Index inside the current item.
     * @returns Segment start index.
     */
    function findListSegmentStart(text: string, index: number): number {
        const before = text.slice(0, index);
        const lastIndexOfResult = before.lastIndexOf(';');
        const lastIndexOfResultA = before.lastIndexOf('；');
        const lastIndexOfResultB = before.lastIndexOf('\n');
        const lastIndexOfResultC = before.lastIndexOf('\r');
        const separatorIndex = Math.max(
            lastIndexOfResult,
            lastIndexOfResultA,
            lastIndexOfResultB,
            lastIndexOfResultC,
        );

        return separatorIndex < 0 ? 0 : separatorIndex + 1;
    }

    /**
     * Finds the end index of the current semicolon/newline-delimited item.
     *
     * @param text - Current input text.
     * @param index - Index inside the current item.
     * @returns Segment end index.
     */
    function findListSegmentEnd(text: string, index: number): number {
        const match = text.slice(index).match(/[;；\r\n]/u);

        return match == null ? text.length : index + (match.index ?? 0);
    }

    const { hasFirstLevelFieldSeparator, trimValue } = wikitext;

    initializePrimaryState();

    initializeActionState();

    initializePreviewState();

    const nameEditor = createNameEditor({
        get Vue() {
            return Vue;
        },
        get form() {
            return form;
        },
        set form(value) {
            form = value;
        },
        get options() {
            return options;
        },
        get updateFieldDependencies() {
            return updateFieldDependencies;
        },
        get componentMounted() {
            return componentMounted;
        },
        get currentTitle() {
            return currentTitle;
        },
        set currentTitle(value) {
            currentTitle = value;
        },
        get sourceFetchState() {
            return sourceFetchState;
        },
        set sourceFetchState(value) {
            sourceFetchState = value;
        },
        get runReviewRefresh() {
            return runReviewRefresh;
        },
        get refreshRedirectRows() {
            return refreshRedirectRows;
        },
        get activeTab() {
            return activeTab;
        },
        set activeTab(value) {
            activeTab = value;
        },
        get checkRedirectRows() {
            return checkRedirectRows;
        },
        removeRedirectRow: (...args) =>
            (methods.removeRedirectRow as (...values: any[]) => any)(...args),
    });

    const metadataEditor = createMetadataEditor({
        get Vue() {
            return Vue;
        },
        get form() {
            return form;
        },
        set form(value) {
            form = value;
        },
        get options() {
            return options;
        },
        get componentMounted() {
            return componentMounted;
        },
        get focusDialogControl() {
            return focusDialogControl;
        },
        get runReviewRefresh() {
            return runReviewRefresh;
        },
        get refreshCategoryRows() {
            return refreshCategoryRows;
        },
        get refreshNavboxRows() {
            return refreshNavboxRows;
        },
        get reviewState() {
            return reviewState;
        },
        set reviewState(value) {
            reviewState = value;
        },
        get categoryState() {
            return categoryState;
        },
        set categoryState(value) {
            categoryState = value;
        },
        get updateFieldDependencies() {
            return updateFieldDependencies;
        },
        get linkNavigationModifier() {
            return linkNavigationModifier;
        },
        set linkNavigationModifier(value) {
            linkNavigationModifier = value;
        },
        getCategoryPageUrl: (...args) =>
            (methods.getCategoryPageUrl as (...values: any[]) => any)(...args),
        getNavboxPageUrl: (...args) =>
            (methods.getNavboxPageUrl as (...values: any[]) => any)(...args),
        getStubTagPageUrl: (...args) =>
            (methods.getStubTagPageUrl as (...values: any[]) => any)(...args),
        getReviewPageActionAriaLabel: (...args) =>
            (methods.getReviewPageActionAriaLabel as (...values: any[]) => any)(
                ...args,
            ),
        updateNavboxRow: (...args) =>
            (methods.updateNavboxRow as (...values: any[]) => any)(...args),
        updateStubTagRow: (...args) =>
            (methods.updateStubTagRow as (...values: any[]) => any)(...args),
        openCategoryEdit: (...args) =>
            (methods.openCategoryEdit as (...values: any[]) => any)(...args),
        openNavboxEdit: (...args) =>
            (methods.openNavboxEdit as (...values: any[]) => any)(...args),
        openStubTagEdit: (...args) =>
            (methods.openStubTagEdit as (...values: any[]) => any)(...args),
    });

    const citationEditor = createCitationEditor({
        get Vue() {
            return Vue;
        },
        get form() {
            return form;
        },
        set form(value) {
            form = value;
        },
        get options() {
            return options;
        },
        get sourceFetchState() {
            return sourceFetchState;
        },
        set sourceFetchState(value) {
            sourceFetchState = value;
        },
    });

    const sourceUrlEditor = createSourceUrlEditor({
        reactive: (value) => Vue.reactive(value),
        nextTick: (callback) =>
            typeof Vue.nextTick === 'function'
                ? Vue.nextTick(callback)
                : callback(),
        read(key) {
            if (!key.startsWith('name:')) return String(form[key] || '');
            const card = nameEditor.methods
                .getNameCards()
                .find((candidate) => candidate.id === key.slice(5));
            return card?.sourceUrl;
        },
        write(key, value) {
            if (!key.startsWith('name:')) {
                form[key] = value;
                return;
            }
            const card = nameEditor.methods
                .getNameCards()
                .find((candidate) => candidate.id === key.slice(5));
            if (!card) return;
            nameEditor.methods.updateNameCardValue(card, 'sourceUrl', value);
            nameEditor.methods.commitNameCard(card, 'sourceUrl');
        },
        onComplete() {
            if (!sourceUrlEditor.hasPendingEntries())
                citationEditor.queueCitationPrefetch(form);
        },
    });

    const methods = {
        ...nameEditor.methods,
        ...metadataEditor.methods,
        ...citationEditor.methods,
        ...sourceUrlEditor.methods,
        /** Associates a source entry with the name's stable identity rather than its row index. */
        getNameSourceEntryKey(card: { id: string }): string {
            return `name:${card.id}`;
        },
        /**
         * Closes the Codex dialog without writing text.
         *
         * @returns Result when the function
         *   closes the codex dialog without writing text.
         */
        closeDialog(): void {
            open.value = false;
        },

        /** Closes the pre-save review without starting a write. */
        closePreSaveDialog(): void {
            preSaveOpen.value = false;
        },

        /**
         * Gets the main dialog title.
         *
         * @returns Main dialog title.
         */
        getDialogTitle(): string {
            const currentTitleResultG = { title: getCurrentTitle() };
            return msg('form.title', currentTitleResultG);
        },

        /**
         * Gets the staged category or navbox editor title.
         *
         * @returns The staged category or navbox editor title.
         */
        getPageEditDialogTitle(): string {
            const values = { title: pageEditState.title };
            if (pageEditState.create) {
                return msg('preview.createPageTitle', values);
            }

            return msg('preview.modifyPageTitle', values);
        },

        /**
         * Gets the English Wikipedia helper label for a staged page.
         *
         * @returns The English Wikipedia helper label for a staged page.
         */
        getPageEditEnglishLabel(): string {
            if (pageEditState.kind === 'navbox') {
                return msg('review.pageEditEnwikiTemplate');
            }

            return msg('review.pageEditEnwikiCategory');
        },

        /**
         * Gets the English Wikipedia helper placeholder for a staged page.
         *
         * @returns The English Wikipedia helper placeholder for a staged
         *   page.
         */
        getPageEditEnglishPlaceholder(): string {
            if (pageEditState.kind === 'navbox') {
                return msg('review.pageEditEnwikiTemplatePlaceholder');
            }

            return msg('review.pageEditEnwikiCategoryPlaceholder');
        },

        /**
         * Clears all form and helper data across every tab.
         *
         * @returns Result when the function
         *   clears all form and helper data across every
         *   tab.
         */
        clearForm(): void {
            clearFormState();
        },

        /**
         * Handles a selected main action menu item.
         *
         * @param value - Selected menu item value.
         * @returns Resolves after the action finishes.
         */
        async handleMainActionSelect(value: string): Promise<void> {
            mainActionMenuSelection.value = null;

            if (value === 'history') {
                this.openHistoryDialog();
                return;
            }

            if (value === 'reload') {
                await this.reloadForm();
                return;
            }

            if (value === 'clear') {
                this.clearForm();
            }
        },

        /**
         * Reloads derived form data from the current inputs.
         *
         * @returns Resolves after refreshes complete.
         */
        async reloadForm(): Promise<void> {
            await refreshEnwikiMetadata();
            await citationEditor.refreshCitationRows();
            await refreshReview({
                recheck: true,
            });
        },

        /**
         * Opens an editable generated wikitext preview after review.
         *
         * @returns Resolves after preview text is
         * ready.
         */
        async previewForm(): Promise<void> {
            previewLoading.value = true;
            previewLoadingMessage.value = msg('progress.preparingCitations');

            try {
                await citationEditor.refreshCitationRows();
                previewLoadingMessage.value = msg('progress.checkingPages');
                await refreshReview();
                previewLoadingMessage.value = msg('progress.buildingPreview');
                const currentTitleResultF = getCurrentTitle();
                options.onSubmitHistory(form, currentTitleResultF);
                historyEntries.value = options.getHistoryEntries();
                const preview = await options.onPreview(form, sourceFetchState);

                if (preview == null) {
                    return;
                }

                previewText.value = preview.text || '';
                previewSummary.value = preview.summary || '';
                previewHtml.value = preview.html || '';
                previewValidationError.value = '';
                previewSubmitted.value = false;
                previewOpen.value = true;
                queueSourceEditor('preview', previewTextArea, previewText);
            } finally {
                previewLoading.value = false;
                previewLoadingMessage.value = msg('preview.preparing');
            }
        },

        /**
         * Refreshes the parsed HTML preview from the editable wikitext.
         *
         * @returns Resolves after parsed HTML is
         * refreshed.
         */
        async refreshParsedPreview(): Promise<void> {
            syncSourceEditorText('preview', previewText);
            sourceFetchState.error = '';
            sourceFetchState.loading = true;

            try {
                const parseArticlePreview =
                    options.onParseArticlePreview || options.onParsePreview;

                previewHtml.value = await parseArticlePreview(
                    previewText.value,
                    form,
                );
            } catch (error) {
                sourceFetchState.error = getErrorMessage(error);
            } finally {
                sourceFetchState.loading = false;
            }
        },

        /**
         * Closes the editable preview dialog.
         *
         * @returns Result when the function
         *   closes the editable preview dialog.
         */
        closePreviewDialog(): void {
            destroySourceEditor('preview');
            previewOpen.value = false;
            previewValidationError.value = '';
            clearPreviewState();
        },

        /**
         * Opens pre-save checks for the edited preview text.
         *
         * @returns Resolves after checklist
         * preparation.
         */
        async submitPreviewText(): Promise<void> {
            syncSourceEditorText('preview', previewText);

            if (
                !validateRequiredField(
                    previewText.value,
                    previewValidationError,
                    previewTextArea,
                )
            ) {
                return;
            }

            previewSubmitted.value = true;
            destroySourceEditor('preview');
            previewOpen.value = false;
            await openPreSave();
        },

        /**
         * Opens the editable preview before final submission.
         *
         * @returns Resolves after preview text is
         * ready.
         */
        async submitForm(): Promise<void> {
            if (await this.shouldConfirmPageNameMove()) {
                this.openMovePreviewConfirmation();
                return;
            }

            await this.previewForm();
        },

        /**
         * Saves the article after confirming the pre-save fixes.
         *
         * @returns Resolves after save submission
         * starts.
         */
        async confirmSubmit(): Promise<void> {
            syncSourceEditorText('preview', previewText);
            const currentTitleResultE = getCurrentTitle();
            options.onSubmitHistory(form, currentTitleResultE);
            historyEntries.value = options.getHistoryEntries();

            const moveTitle = trimValue(preSaveMoveTitle.value);

            if (shouldMoveBeforeSubmit(moveTitle)) {
                await submitMoveTarget(moveTitle);
                return;
            }

            const reviewedSubmitPendingResult = createReviewedSubmitPending();
            const reviewedPreviewResult = getReviewedPreview();
            await options.onSubmit(
                form,
                sourceFetchState,
                this.closeDialog,
                reviewedSubmitPendingResult,
                reviewedPreviewResult,
            );

            if (sourceFetchState.error === '') {
                previewSubmitted.value = false;
            }
        },

        /**
         * Opens the form history dialog.
         *
         * @returns Result when the function
         *   opens the form history dialog.
         */
        openHistoryDialog(): void {
            historyEntries.value = options.getHistoryEntries();
            historyOpen.value = true;
        },

        /**
         * Gets the label for the currently running pre-save step.
         *
         * @returns Running step label.
         */
        getPreSaveCurrentStepLabel(): string {
            const step = preSaveProgress.value?.steps.find(
                function callback(item: { status: string }) {
                    return (
                        item.status === 'running' || item.status === 'retrying'
                    );
                },
            );

            return step == null ? msg('progress.saving') : step.label;
        },

        /**
         * Gets the icon used for a pre-save progress status.
         *
         * @param status - Progress status.
         * @returns Codex icon definition.
         */
        getPreSaveStatusIcon(status: string): any {
            return PRE_SAVE_STATUS_ICONS[normalizePreSaveStatus(status)];
        },

        /**
         * Gets the status icon CSS class for one progress row.
         *
         * @param status - Progress status.
         * @returns CSS class list.
         */
        getPreSaveStatusIconClass(status: string): string {
            const normalized = normalizePreSaveStatus(status);

            const result = [
                'kanade-vg-stub-creator-pre-save-status-ic',
                'on kanade-vg-stub-creator-pre-save-status',
                '-icon--',
                normalized,
                '',
            ].join('');
            return result;
        },

        /**
         * Gets the CSS class for one progress row.
         *
         * @param step - Progress step.
         * @returns CSS class list.
         */
        getPreSaveProgressRowClass(step: any): string {
            if (step == null) {
                return '';
            }

            const status = trimValue(step?.status);
            const active = ['failed', 'running'].includes(status);

            let result = 'kanade-vg-stub-creator-pre-save-progress-row';

            if (active) {
                result = [
                    'kanade-vg-stub-creator-pre-save-progress-',
                    'row kanade-vg-stub-creator-pre-save-progr',
                    'ess-row--',
                    status,
                    '',
                ].join('');
            }
            return result;
        },

        /**
         * Gets the groups currently shown in the pre-save dialog.
         *
         * @returns Checkbox or progress groups.
         */
        getVisiblePreSaveGroups(): Array<any> {
            if (preSaveProgress.value == null) {
                return preSaveGroups.value;
            }

            const groups: VisibleProgressGroup[] = preSaveProgressGroups.value;
            const result = groups.map(createVisiblePreSaveGroup);
            return result;
        },

        /**
         * Checks whether the pre-save progress is still running.
         *
         * @returns Whether progress has active work.
         */
        isPreSaveProgressRunning(): boolean {
            const result =
                preSaveProgress.value != null &&
                !isSaveProgressComplete(preSaveProgress.value);
            return result;
        },

        /**
         * Closes the form history dialog.
         *
         * @returns Result when the function
         *   closes the form history dialog.
         */
        closeHistoryDialog(): void {
            historyOpen.value = false;
        },

        /**
         * Checks whether stored history contains a non-temporary entry.
         *
         * @returns Whether clearable history is available.
         */
        hasPersistentHistoryEntries(): boolean {
            const isPersistent = function isPersistent(entry: any): boolean {
                return !entry.metadata.temporary;
            };
            return historyEntries.value.some(isPersistent);
        },

        /**
         * Formats one history entry page label for display.
         *
         * @param entry - History entry.
         * @returns Display page label.
         */
        formatHistoryEntryPage(entry: any): string {
            const page = trimValue(entry.metadata?.page);

            if (entry.metadata?.temporary === true) {
                const messageB = {
                    page: page || msg('history.untitled'),
                };
                const result = msg('history.temporaryPage', messageB);
                return result;
            }

            return page || msg('history.untitled');
        },

        /**
         * Fills the current form from a history entry.
         *
         * @param entry - History entry.
         * @returns Resolves after the restored form is
         * refreshed.
         */
        async fillHistoryEntry(entry: any): Promise<void> {
            historyLoading.value = true;

            try {
                const historyEntryFormResult = getHistoryEntryForm(entry);
                await restoreHistoryForm(historyEntryFormResult);
                await citationEditor.refreshCitationRows();
                await refreshReview();
                historyOpen.value = false;
            } finally {
                historyLoading.value = false;
            }
        },

        /**
         * Opens an editable JSON representation of a history entry.
         *
         * @param entry - History entry.
         * @returns Result when the function
         *   opens an editable json representation of a
         *   history entry.
         */
        openHistoryJsonDialog(entry: any): void {
            historyJsonError.value = '';
            historyJsonEditable.value = entry.metadata?.temporary === true;
            historyJsonText.value = JSON.stringify(entry, null, 2);
            historyJsonOpen.value = true;
        },

        /**
         * Opens the history JSON dialog for importing values.
         *
         * @returns Result when the function
         *   opens the history json dialog for importing
         *   values.
         */
        openHistoryImportDialog(): void {
            historyJsonError.value = '';
            historyJsonEditable.value = true;
            historyJsonText.value = '';
            historyJsonOpen.value = true;
        },

        /**
         * Closes the history JSON dialog.
         *
         * @returns Result when the function
         *   closes the history json dialog.
         */
        closeHistoryJsonDialog(): void {
            historyJsonOpen.value = false;
            historyJsonText.value = '';
        },

        /**
         * Imports form values from the history JSON dialog.
         *
         * @returns Result when the function
         *   imports form values from the history json
         *   dialog.
         */
        async importHistoryJson(): Promise<void> {
            historyJsonError.value = '';

            try {
                const data = JSON.parse(historyJsonText.value);
                const importedForm = getHistoryEntryForm(data);

                if (
                    importedForm == null ||
                    typeof importedForm !== 'object' ||
                    Array.isArray(importedForm)
                ) {
                    historyJsonError.value = HISTORY_EXPORT_ERROR;
                    return;
                }

                historyLoading.value = true;
                await restoreHistoryForm(importedForm);
                await citationEditor.refreshCitationRows();
                await refreshReview();
                historyJsonOpen.value = false;
                historyOpen.value = false;
            } catch (error) {
                historyJsonError.value = getErrorMessage(error);
            } finally {
                historyLoading.value = false;
            }
        },

        /**
         * Deletes one history entry.
         *
         * @param id - History entry ID.
         * @returns Result when the function
         *   deletes one history entry.
         */
        deleteHistoryEntry(id: string): void {
            options.onDeleteHistoryEntry(id);
            historyEntries.value = options.getHistoryEntries();
        },

        /**
         * Updates the temporary draft row from current form values.
         *
         * @returns Result when the function
         *   updates the temporary draft row from current
         *   form values.
         */
        updateTemporaryHistoryEntry(): void {
            options.onFormChange(form);
            historyEntries.value = options.getHistoryEntries();
        },

        /**
         * Clears all form history entries.
         *
         * @returns Result when the function
         *   clears all form history entries.
         */
        clearHistory(): void {
            options.onClearHistory();
            historyEntries.value = options.getHistoryEntries();
        },

        /**
         * Opens the move target dialog.
         *
         * @returns Result when the function
         *   opens the move target dialog.
         */
        openMoveDialog(): void {
            moveTarget.value = getCurrentTitle();
            moveTargetValidationError.value = '';
            movePreviewConfirmation.value = false;
            moveOpen.value = true;
            void this.checkMoveTarget();
        },

        /**
         * Handles open move preview confirmation.
         *
         * Opens the move target dialog before previewing a renamed
         * page.
         *
         * @returns *
         */
        openMovePreviewConfirmation(): void {
            moveTarget.value = getCurrentTitle();
            moveTargetValidationError.value = '';
            movePreviewConfirmation.value = true;
            moveOpen.value = true;

            if (moveTargetState.checkedTitle !== moveTarget.value) {
                void this.checkMoveTarget();
            }
        },

        /**
         * Closes the move target dialog.
         *
         * @returns Result when the function
         *   closes the move target dialog.
         */
        closeMoveDialog(): void {
            moveOpen.value = false;
            movePreviewConfirmation.value = false;
            moveTargetValidationError.value = '';
        },

        /**
         * Updates the move target title from live input.
         *
         * @param value - Raw input value.
         * @returns Result when the function
         *   updates the move target title from live input.
         */
        updateMoveTarget(value: string): void {
            moveTargetRequest += 1;
            moveTarget.value = trimValue(value);
            moveTargetValidationError.value = '';
            moveTargetState.checkedTitle = '';
            moveTargetState.exists = null;
            moveTargetState.loading = false;
        },

        /**
         * Checks whether the current move target page exists.
         *
         * @returns Resolves after status is refreshed.
         */
        async checkMoveTarget(): Promise<void> {
            if (options.onCheckPageTitle == null) {
                return;
            }

            const title = trimValue(moveTarget.value);
            const request = ++moveTargetRequest;
            const originalForm = form;
            const isCurrent = () =>
                componentMounted &&
                form === originalForm &&
                request === moveTargetRequest &&
                trimValue(moveTarget.value) === title;

            moveTargetState.checkedTitle = '';
            moveTargetState.exists = null;
            moveTargetState.loading = false;

            if (title === '') {
                return;
            }

            moveTargetState.loading = true;

            try {
                const result = await options.onCheckPageTitle(title);

                if (!isCurrent()) {
                    return;
                }

                moveTargetState.checkedTitle = title;
                moveTargetState.exists =
                    result?.exists === true
                        ? true
                        : result?.exists === false
                          ? false
                          : null;
            } catch (error) {
                if (isCurrent())
                    sourceFetchState.error = getErrorMessage(error);
            } finally {
                if (isCurrent()) moveTargetState.loading = false;
            }
        },

        /**
         * Handles can move page name.
         *
         * Checks whether the entered page name differs from the current
         * page.
         *
         * @returns Whether the move action should be shown.
         */
        canMovePageName(): boolean {
            const title = trimValue(form.pageName);

            if (title === '' || title === currentTitle) {
                return false;
            }

            if (options.currentPageExists === true) {
                return true;
            }

            const result =
                moveTargetState.exists === true &&
                moveTargetState.checkedTitle === title;
            return result;
        },

        /**
         * Checks whether preview needs an explicit move decision first.
         *
         * @returns Resolves to whether preview needs confirmation.
         */
        async shouldConfirmPageNameMove(): Promise<boolean> {
            const title = trimValue(form.pageName);

            if (
                title === '' ||
                title === currentTitle ||
                title === previewWithoutMoveTitle.value
            ) {
                return false;
            }

            if (options.currentPageExists === true) {
                return true;
            }

            moveTarget.value = title;
            await this.checkMoveTarget();

            return moveTargetState.exists === true;
        },

        /**
         * Continues previewing after the user chooses not to move.
         *
         * @returns Resolves after preview text is
         * ready.
         */
        async previewWithoutMoving(): Promise<void> {
            previewWithoutMoveTitle.value = trimValue(form.pageName);
            moveOpen.value = false;
            movePreviewConfirmation.value = false;
            await this.previewForm();
        },

        /**
         * Handles submit move target.
         *
         * Generates current data and opens it in the target page
         * editor.
         *
         * @returns Resolves after navigation starts.
         */
        async submitMoveTarget(): Promise<void> {
            if (
                !validateRequiredField(
                    moveTarget.value,
                    moveTargetValidationError,
                    moveTargetInput,
                )
            ) {
                return;
            }

            await this.checkMoveTarget();
            await refreshCategoryRows();
            form.pageName = trimValue(moveTarget.value);
            movePreviewConfirmation.value = false;
            const currentTitleResultD = getCurrentTitle();
            options.onSubmitHistory(form, currentTitleResultD);
            historyEntries.value = options.getHistoryEntries();
            const currentTitleResultC = getCurrentTitle();
            await options.onMoveTarget(
                form,
                currentTitleResultC,
                sourceFetchState,
            );
        },

        /**
         * Normalizes multiline article field values.
         *
         * @param field - Article parameter field.
         * @param field.key - Form key for the field.
         * @returns Multiline article field values.
         */
        normalizeFieldValue(field: any): void {
            const value =
                field.key === 'enwikiTitle'
                    ? normalizeEnwikiTitleValue(form[field.key])
                    : form[field.key];

            const completed = completeMetadataFieldValue(
                field.key,
                value,
                true,
            );
            let formatted = formatArticleFormField(form, field.key, completed);

            if (isArticleListField(field.key)) {
                formatted = normalizeListFieldValue(formatted);
            }
            form[field.key] = formatted;

            if (
                ['pageName', 'name', 'originalName', 'englishName'].includes(
                    field.key,
                )
            ) {
                void runReviewRefresh(() => refreshRedirectRows());
            }
        },

        /**
         * Updates one article field from live input.
         *
         * @param field - Article parameter field.
         * @param value - Raw input value.
         * @returns Result when the function
         *   updates one article field from live input.
         */
        updateFieldValue(field: any, value: string): void {
            if (moveFieldUrlToSource(field, value)) {
                markCategoryRowsUnfixed(form.categoryRows);
                return;
            }

            form[field.key] = getFormattedFieldValue(field, value);
            nameEditor.releaseNameOutputRole(field.key);
            updateFieldDependencies(field.key);
            markCategoryRowsUnfixed(form.categoryRows);
        },

        /**
         * Normalizes pasted multiline article field values.
         *
         * @param field - Article parameter field.
         * @param field.key - Form key for the field.
         * @param event - Clipboard paste event.
         * @returns Pasted multiline article field values.
         */
        normalizePastedFieldValue(field: any, event: any): void {
            const clipboardData =
                event.clipboardData || event.originalEvent.clipboardData;
            const text = clipboardData.getData('text');

            if (field.key === 'enwikiTitle') {
                const title = extractEnwikiTitleFromUrl(text);

                if (title === '') {
                    return;
                }

                event.preventDefault();
                form[field.key] = formatArticleFormField(
                    form,
                    field.key,
                    title,
                );
                void refreshEnwikiMetadata();
                markCategoryRowsUnfixed(form.categoryRows);
                return;
            }

            if (!isArticleListField(field.key)) {
                return;
            }

            if (!hasFirstLevelFieldSeparator(text)) {
                return;
            }

            event.preventDefault();
            const completed = completeMetadataFieldValue(field.key, text, true);
            const articleFormFieldResult = formatArticleFormField(
                form,
                field.key,
                completed,
            );
            form[field.key] = normalizeListFieldValue(articleFormFieldResult);
            markCategoryRowsUnfixed(form.categoryRows);
        },

        /**
         * Refreshes generated category rows.
         *
         * @returns Resolves after category rows are
         * refreshed.
         */
        async refreshCategoryRows(): Promise<void> {
            await refreshCategoryRows();
        },

        /**
         * Handles rebuild category rows.
         *
         * Rebuilds category rows, bypassing the stored category query
         * cache.
         *
         * @returns Resolves after category rows are
         * rebuilt.
         */
        async rebuildCategoryRows(): Promise<void> {
            await refreshCategoryRows({
                bypassCache: true,
                recheck: true,
                resetStubTags: true,
            });
        },

        /**
         * Resets stub-tag rows from current category metadata.
         *
         * @returns Result when the function
         *   resets stub-tag rows from current category
         *   metadata.
         */
        resetStubTagRows(): void {
            form.stubTagRows = buildStubTagRowsFromCategories(
                form.categoryRows,
            );
            ensureTrailingStubTagRow(form);
            void runReviewRefresh(() => metadataEditor.checkStubTagRows());
        },

        /**
         * Updates one stub-tag row.
         *
         * @param index - Stub-tag row index.
         * @param stubTag - Stub template name.
         * @returns Result when the function
         *   updates one stub-tag row.
         */
        updateStubTagRow(index: number, stubTag: string): void {
            const row = ensureStubTagRows(form)[index];

            if (row != null) {
                row.stubTag = trimStubTagValue(stubTag);
                ensureTrailingStubTagRow(form);
            }
        },

        /**
         * Resets generated redirect rows.
         *
         * @returns Resolves after rows are refreshed.
         */
        async rebuildRedirectRows(): Promise<void> {
            await runReviewRefresh(() =>
                refreshRedirectRows({ recheck: true, rebuild: true }),
            );
        },

        /**
         * Updates one redirect row title from live input.
         *
         * @param index - Redirect row index.
         * @param value - Raw title input.
         * @returns Result when the function
         *   updates one redirect row title from live
         *   input.
         */
        updateRedirectRowTitle(index: number, value: string): void {
            const row = form.redirectRows?.[index];

            if (row != null) {
                setRedirectRowTitle(row, value);
                row.title = value;
                ensureTrailingRedirectRow(form);
            }
        },

        /**
         * Removes one redirect row.
         *
         * @param index - Redirect row index.
         * @returns Result when the function
         *   removes one redirect row.
         */
        removeRedirectRow(index: number): void {
            ensureRedirectRows(form).splice(index, 1);
            ensureTrailingRedirectRow(form);
        },

        /**
         * Updates one navbox row.
         *
         * @param index - Navbox row index.
         * @param navbox - Navbox wikitext.
         * @returns Result when the function
         *   updates one navbox row.
         */
        updateNavboxRow(index: number, navbox: string): void {
            const row = ensureNavboxRows(form)[index];

            setNavboxRowText(row, navbox);
            row.title = getNavboxTitle(navbox);
            row.status = '';
            ensureTrailingNavboxRow(form);
        },

        /**
         * Regenerates navbox rows from the current series field.
         *
         * @returns Resolves after suggestions are
         * refreshed.
         */
        async rebuildNavboxRows(): Promise<void> {
            await runReviewRefresh(() => refreshNavboxRows(true, true));
        },

        /**
         * Refreshes generated redirect rows.
         *
         * @returns Resolves after redirect rows are
         * refreshed.
         */
        async refreshRedirectRows(): Promise<void> {
            await runReviewRefresh(() => refreshRedirectRows());
        },

        /**
         * Checks the current redirect rows.
         *
         * @returns Resolves after redirect rows are
         * fixed.
         */
        async checkRedirectRows(): Promise<void> {
            await runReviewRefresh(() => checkRedirectRows());
        },

        /**
         * Opens an editable navbox template source preview.
         *
         * @param row - Navbox review row.
         * @returns Resolves after the editor is ready.
         */
        async openNavboxEdit(row: any): Promise<void> {
            const pageEditCreateStateResultB = {
                create: getPageEditCreateState(row, row.status !== 'OK'),
                kind: 'navbox',
                row,
                title: formatNamespaceTitle(row.title, 'zhwiki', 10),
            };
            await openPageEdit(pageEditCreateStateResultB);
        },

        /**
         * Opens an editable redirect page source preview.
         *
         * @param row - Redirect review row.
         * @returns Resolves after the editor is ready.
         */
        async openRedirectEdit(row: any): Promise<void> {
            const pageEditCreateStateResultA = {
                create: getPageEditCreateState(row, row.exists !== true),
                kind: 'redirect',
                row,
                title: trimValue(row.title),
            };
            await openPageEdit(pageEditCreateStateResultA);
        },

        /**
         * Opens an editable stub template source preview.
         *
         * @param row - Stub-tag review row.
         * @returns Resolves after the editor is ready.
         */
        async openStubTagEdit(row: any): Promise<void> {
            await runReviewRefresh(() => metadataEditor.checkStubTagRow(row));
            if (reviewState.error) {
                return;
            }
            const trimStubTagValueResult = {
                create: getPageEditCreateState(
                    row,
                    row.status === 'Not exists' || row.status === 'Missing',
                ),
                kind: 'stubTag',
                row,
                title: formatNamespaceTitle(
                    trimStubTagValue(row.stubTag),
                    'zhwiki',
                    10,
                ),
            };
            await openPageEdit(trimStubTagValueResult);
        },

        /**
         * Opens an editable category source preview.
         *
         * @param row - Category review row.
         * @returns Resolves after the editor is ready.
         */
        async openCategoryEdit(row: any): Promise<void> {
            const category = trimValue(row.category);

            const pageEditCreateStateResult = {
                create: getPageEditCreateState(row, row.status !== 'OK'),
                kind: 'category',
                row,
                title: formatNamespaceTitle(category, 'zhwiki', 14),
            };
            await openPageEdit(pageEditCreateStateResult);
        },

        /**
         * Closes the category page viewer.
         *
         * @returns Result when the function
         *   closes the category page viewer.
         */
        closeCategoryView(): void {
            categoryViewOpen.value = false;
        },

        /**
         * Refreshes the edited page source preview.
         *
         * @returns Resolves after the preview is
         * refreshed.
         */
        async refreshPageEditPreview(): Promise<void> {
            syncSourceEditorText('pageEdit', pageEditTextBinding);
            const request = ++pageEditRequest;
            pageEditState.error = '';
            pageEditState.loading = true;

            try {
                await parsePageEditPreview(
                    request,
                    pageEditState.text,
                    pageEditState.title,
                );
            } finally {
                if (isCurrentPageEdit(request)) {
                    pageEditState.loading = false;
                }
            }
        },

        /**
         * Closes the page edit dialog without staging changes.
         *
         * @returns Result when the function
         *   closes the page edit dialog without staging
         *   changes.
         */
        closePageEditDialog(): void {
            destroySourceEditor('pageEdit');
            pageEditOpen.value = false;
            pageEditValidationError.value = '';
            clearPageEditState();
        },

        /**
         * Cancels staged source changes for the current review row.
         *
         * @returns Result when the function
         *   cancels staged source changes for the current
         *   review row.
         */
        resetPageEdit(): void {
            pageEditValidationError.value = '';
            resetPageEdit();
        },

        /**
         * Stages the edited page source for final submission.
         *
         * @returns Result when the function
         *   stages the edited page source for final
         *   submission.
         */
        stagePageEdit(): void {
            syncSourceEditorText('pageEdit', pageEditTextBinding);

            if (
                !validateRequiredField(
                    pageEditState.text,
                    pageEditValidationError,
                    pageEditTextArea,
                )
            ) {
                return;
            }

            stagePageEdit();
        },

        /**
         * Gets a category page URL for a review row.
         *
         * @param row - Category review row.
         * @returns Category page URL.
         */
        getCategoryPageUrl(row: any): string {
            const category = trimValue(row?.category);

            return category === ''
                ? ''
                : options.getPageUrl(
                      formatNamespaceTitle(category, 'zhwiki', 14),
                  );
        },

        /**
         * Gets a redirect page URL for a review row.
         *
         * @param row - Redirect review row.
         * @returns Redirect page URL.
         */
        getRedirectPageUrl(row: any): string {
            const title = trimValue(row?.title);

            return title === '' ? '' : options.getPageUrl(title);
        },

        /**
         * Gets a navbox template page URL for a review row.
         *
         * @param row - Navbox review row.
         * @returns Navbox template page URL.
         */
        getNavboxPageUrl(row: any): string {
            const title = trimValue(row?.title);

            return title === ''
                ? ''
                : options.getPageUrl(formatNamespaceTitle(title, 'zhwiki', 10));
        },

        /**
         * Gets a stub template page URL for a review row.
         *
         * @param row - Stub-tag review row.
         * @returns Stub template page URL.
         */
        getStubTagPageUrl(row: any): string {
            const stubTag = trimStubTagValue(row?.stubTag);

            return stubTag === ''
                ? ''
                : options.getPageUrl(
                      formatNamespaceTitle(stubTag, 'zhwiki', 10),
                  );
        },

        /**
         * Formats a Check-tab Page action label.
         *
         * @param row - Review row.
         * @param exists - Whether the target page exists.
         * @returns Lowercase action label.
         */
        getReviewPageActionLabel(row: any, exists: boolean): string {
            if (
                row?.pendingEdit != null ||
                row?.pendingCreation != null ||
                String(row?.status || '').startsWith('Pending')
            ) {
                return msg('review.pendingAction');
            }

            return exists
                ? msg('review.editAction')
                : msg('review.createAction');
        },

        /**
         * Formats an accessible label for a review page action.
         *
         * @param row - Row values.
         * @param exists - Exists value.
         * @returns An accessible label for a review page action.
         */
        getReviewPageActionAriaLabel(row: any, exists: boolean): string {
            const reviewPageActionLabelResult = {
                action: this.getReviewPageActionLabel(row, exists),
            };
            const result = msg(
                'review.pageAction',
                reviewPageActionLabelResult,
            );
            return result;
        },

        /**
         * Gets the current generated prose wikitext.
         *
         * @returns Generated prose wikitext.
         */
        getProseWikitext(): string {
            return options.getProseWikitext(form);
        },
    };
    const dialogController = {
        open: openExternalDialog,
        submit: submitExternalDialog,
    };
    const sourceEditorManager = createSourceEditorManager({
        nextTick: (callback) =>
            typeof Vue.nextTick === 'function'
                ? Vue.nextTick(callback)
                : callback(),
        isOpen: (key) =>
            componentMounted &&
            (key === 'preview'
                ? previewOpen.value === true
                : key === 'pageEdit' && pageEditOpen.value === true),
        load: () => getCodeMirrorLoader()?.using(CODEMIRROR_MODULES),
    });
    const {
        queue: queueSourceEditor,
        sync: syncSourceEditorText,
        setText: setSourceEditorText,
        destroy: destroySourceEditor,
    } = sourceEditorManager;
    initializeDialogState();
    initializeDialogBehavior();
    return createComponentDefinition();
}

export type VgStubCreatorTemplateBindings = ReturnType<
    typeof createDialogComponent
>['methods'] &
    ReturnType<ReturnType<typeof createDialogComponent>['setup']>;
