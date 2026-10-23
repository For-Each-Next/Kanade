/**
 * @file src/vg-stub-creator/app/interface.ts
 * Purpose: Owns creator startup, host integration, and reviewed save coordination.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. createBrowserApplication
 */

import { loadHostModules } from '../../library/mediawiki-runtime/modules.ts';
import type { VueCore } from '../../library/mediawiki-runtime/contracts.ts';

import { createDialogComponent } from '../features/creator/form/index.ts';
import type {
    CreatorDialogOptions,
    DialogPreview,
} from '../features/creator/form/dialog-options.ts';
import {
    registerCodexComponents,
    type VgStubCreatorCodexComponents,
} from '../features/creator/codex.ts';
import { getBasePageTitle } from '../features/creator/form/external-links.ts';
import { addDialogStyles } from '../features/creator/styles.ts';
import {
    buildWhatLinksHerePageTitle,
    selectArticleSubmissionTitle,
} from '../features/creator/navigation.ts';
import {
    addEnwikiCreateTrigger,
    addMissingPageEditTrigger,
    addViewPageTrigger,
    canShowZhwikiLauncher,
} from '../features/creator/page-trigger.ts';
import type {
    BrowserApplication,
    BrowserApplicationPorts,
    CategoryCacheStorePort,
    CategoryReviewRow,
    CitationStorePort,
    PendingSaveDraft,
    PendingSaveSession,
} from './contracts/application.ts';
import type {
    ArticleForm,
    PreSaveAction,
    SaveProgressStatus,
} from '../domain/models.ts';
import { msg } from '../i18n/index.ts';
import { getErrorMessage, toError } from '../features/creator/error-message.ts';
import * as wikitext from '../domain/wikitext/index.ts';
import { formatNamespaceTitle } from '../../library/wiki-titles/wikipedia.ts';

const { trimValue } = wikitext;

const CITATION_PREFETCH_DELAY = 800;

/**
 * Creates an isolated browser application bound to explicit ports.
 *
 * @param ports - Workflow and adapter implementations.
 * @returns Startable browser application.
 */
// The factory binds callbacks to one application port instance.
export function createBrowserApplication(
    ports: BrowserApplicationPorts,
): BrowserApplication {
    const {
        createCategoryCacheStore,
        createManualCategoryRow,
        prepareCompanyCategoryText,
        registerNewPage,
        saveCategoryPage,
        saveCompanyCategory,
        updateCategoryRowCategory,
    } = ports.categories;
    const { createLocalApi, createWikidataApi } = ports.clients;
    const {
        buildEditSummary,
        clearMovedEdit,
        clearPendingSaveData,
        clearPreviewFormData,
        getMovedEdit,
        getPendingSaveData,
        getPreviewFormData,
        interceptEditSave,
        normalizePageTitle,
        readEditSummary,
        readEditText,
        setPendingSaveOperationStatus,
        shouldPreserveEditor,
        storeMovedEdit,
        storePendingSaveData,
        storePreviewFormData,
        submitPreviewForm,
        updateMovedTitleText,
        writeEditSummary,
        writeEditText,
    } = ports.editing;
    const logger = ports.feedback.logger;
    const notifyAction = ports.feedback.notifyAction;
    const {
        clearFormHistory,
        deleteFormHistoryEntry,
        readFormDraftEntry,
        readFormDraftForPage,
        readFormHistory,
        saveFormDraft,
        saveFormHistory,
    } = ports.history;
    const { fetchPageText, parseArticlePreviewText, parsePreviewText } =
        ports.preview;
    const { createSession: createReviewLinkSession } = ports.reviewLinks;
    const {
        clearSaveProgress,
        failSaveProgress,
        initializeSaveProgress,
        reportSaveProgressError,
        setSaveProgressStep,
    } = ports.saveProgress;
    const {
        buildZhwikiCreationUrl,
        createCitationStore,
        createZhwikiApiClient,
        fetchEnwikiMetadata,
        fetchSteamNameRows,
        prepareManagedCitationRows,
        readZhwikiActivationForm,
        resolveZhwikiCreationTitle,
    } = ports.sources;
    const {
        buildArticleStubFromForm,
        buildPreSaveActions,
        buildRedirectRows,
        buildRedirectRowsFromTitles,
        buildRedirectTitles,
        countFormProseSinographs,
        createArticleData,
        fetchExistingPageTitles,
        getArticleFieldPlaceholder,
        getArticleFieldPreview,
        getRedirectTitleCheckTitles,
        prepareCategoryRows,
        prepareNavboxRows,
        preparePendingSaveResume,
        runSelectedActions,
        saveReviewedArticle,
    } = ports.workflows;
    /**
     * Checks whether the current view displays a missing page.
     *
     * @returns Whether the current action views an uncreated
     * page.
     */
    function isMissingPageView(): boolean {
        const result =
            mw.config.get('wgAction') === 'view' &&
            mw.config.get('wgArticleId') === 0;
        return result;
    }

    /**
     * Checks whether an action can show a new-page edit form.
     *
     * @param action - MediaWiki action.
     * @returns Whether the action edits or submits page text.
     */
    function isEditAction(action: string): boolean {
        return action === 'edit' || action === 'submit';
    }

    /**
     * Checks whether the page is an English Wikipedia article view.
     *
     * @returns Whether the enwiki launcher should be shown.
     */
    function isEnwikiArticleView(): boolean {
        if (mw.config.get('wgDBname') !== 'enwiki') {
            return false;
        }

        if (mw.config.get('wgAction') !== 'view') {
            return false;
        }

        return (
            mw.config.get('wgNamespaceNumber') === 0 &&
            mw.config.get('wgArticleId') !== 0
        );
    }

    /**
     * Checks whether the gadget is running on Chinese Wikipedia.
     *
     * @returns Whether the full creation dialog can run.
     */
    function isZhwiki(): boolean {
        return mw.config.get('wgDBname') === 'zhwiki';
    }

    /**
     * Checks whether the Chinese Wikipedia launcher supports this page.
     *
     * @returns Whether the page is an article, draft, or the current
     * user's own user-space page.
     */
    function isZhwikiLauncherPage(): boolean {
        return canShowZhwikiLauncher({
            namespaceNumber: mw.config.get('wgNamespaceNumber'),
            pageTitle: mw.config.get('wgTitle') || '',
            userName: mw.config.get('wgUserName'),
        });
    }

    /**
     * Creates the DOM host used by the Vue application.
     *
     * @returns Element appended to the document body.
     */
    function createHost(): HTMLElement {
        const host = document.createElement('div');

        document.getElementsByTagName('body')[0].append(host);

        return host;
    }

    /**
     * Gets the default article name from the current page title.
     *
     * @returns Page title without a trailing disambiguation
     * suffix.
     */
    function getDefaultName(): string {
        const configValue = mw.config.get('wgTitle') || '';
        return String(configValue).replace(/ \(.+?\)$/u, '');
    }

    /**
     * Builds the local wiki URL for a page title.
     *
     * @param title - Page title.
     * @returns Local wiki page URL.
     */
    function getPageUrl(title: string): string {
        return mw.util.getUrl(title);
    }

    const getFormProseSinographs = function callback(form: ArticleForm) {
        const formDefaultNameResultE = {
            defaultName: getFormDefaultName(form),
        };
        const result = countFormProseSinographs(form, formDefaultNameResultE);
        return result;
    };

    const getFormProseWikitext = function callback(form: ArticleForm) {
        const formDefaultNameResultD = {
            defaultName: getFormDefaultName(form),
        };
        const result = createArticleData(form, formDefaultNameResultD).prose
            .text;
        return result;
    };

    /**
     * Gets placeholder text for one form field.
     *
     * @param form - Dialog form values.
     * @param field - Dialog field definition.
     * @param field.key - Form key for the field.
     * @returns Placeholder text.
     */
    function getFieldPlaceholder(form: any, field: any): string | undefined {
        const formDefaultNameResultC = {
            defaultName: getFormDefaultName(form),
        };
        const result = getArticleFieldPlaceholder(
            form,
            field,
            formDefaultNameResultC,
        );
        return result;
    }

    /**
     * Builds a small live wikitext preview for one dialog field.
     *
     * @param form - Dialog form values.
     * @param previewKey - Shared preview group key.
     * @returns Preview wikitext, or an empty string.
     */
    function getFieldPreview(form: any, previewKey: string): string {
        const formDefaultNameResultB = {
            defaultName: getFormDefaultName(form),
        };
        const result = getArticleFieldPreview(
            form,
            previewKey,
            formDefaultNameResultB,
        );
        return result;
    }

    /**
     * Gets the current page title when MediaWiki globals are available.
     *
     * @returns Default article title, or an empty string.
     */
    function getDefaultNameFallback(): string {
        if (typeof mw === 'undefined') {
            return '';
        }

        return getDefaultName();
    }

    /**
     * Gets the default display title for current form values.
     *
     * @param form - Dialog form values.
     * @returns Default display title.
     */
    function getFormDefaultName(form: any): string {
        return getBasePageTitle(form?.pageName) || getDefaultNameFallback();
    }

    /**
     * Generates wikitext for an editable in-dialog preview.
     *
     * @param form - Dialog form values.
     * @param sourceFetchState - Source fetch status state.
     * @param citationStore - Citation fetch/cache store.
     * @returns Generated preview text, summary,
     * and
     * HTML.
     */
    async function previewForm(
        form: any,
        sourceFetchState: any,
        citationStore: any,
    ): Promise<any | undefined> {
        sourceFetchState.error = '';
        sourceFetchState.loading = true;
        const finishTimer = logger.startTimer('preview.build');

        try {
            const stub = await buildStubFromForm(form, citationStore);
            const text = stub.text;
            const editSummaryMetadataResultA = createEditSummaryMetadata(
                form,
                stub,
            );
            const summary = buildEditSummary(editSummaryMetadataResultA);

            const result = {
                html: await parseArticlePreviewText(text, form),
                summary,
                text,
            };
            finishTimer({ outcome: 'success' });
            return result;
        } catch (error) {
            sourceFetchState.error = getErrorMessage(error);
            logger.warn('preview.failed', error);
            finishTimer({ outcome: 'failure' });
            return undefined;
        } finally {
            sourceFetchState.loading = false;
        }
    }

    /**
     * Generates wikitext and submits the MediaWiki edit form.
     *
     * @param context - Submit dependencies and values.
     * @param context.form - Dialog form values.
     * @param context.sourceFetchState - Source fetch status state.
     * @param context.closeDialog - Dialog close callback.
     * @param context.preSave - Configured pre-save fixes.
     * @param context.citationStore - Citation fetch/cache store.
     * @param context.preview - User-reviewed preview text.
     * @param context.preview.summary - User-reviewed edit summary.
     * @param context.preview.text - User-reviewed wikitext.
     * @returns Resolves after save submission starts.
     */
    async function submitForm(context: any): Promise<void> {
        const { sourceFetchState, preSave } = context;
        sourceFetchState.error = '';
        sourceFetchState.loading = true;
        const finishTimer = logger.startTimer('submission.run');

        try {
            const submission = await prepareFormSubmission(context);
            await executePreparedSubmission(submission, preSave);
            finishTimer({ outcome: 'success' });
        } catch (error) {
            preSave.progress?.fail(error);
            sourceFetchState.error = getErrorMessage(error);
            logger.error('submission.failed', error);
            notifyAction({
                key: 'submission-failed',
                message: sourceFetchState.error,
                type: 'error',
            });
            finishTimer({ outcome: 'failure' });
        } finally {
            sourceFetchState.loading = false;
        }
    }

    async function executePreparedSubmission(
        submission: any,
        preSave: any,
    ): Promise<void> {
        const api = createLocalApi();
        preSave.progress?.start(submission.title, submission.pending);
        const checkpoint = storePendingSaveData(submission.pending);
        initializeSaveProgress(checkpoint);
        await runCheckpointedOperation(
            'save',
            preSave.progress?.set.bind(preSave.progress),
            saveReviewedArticle.bind(null, api, {
                exists: submission.exists,
                summary: submission.summary,
                text: submission.text,
                title: submission.title,
            }),
        );
        await completeSubmittedFollowUpActions(
            api,
            submission.pending,
            preSave,
            submission.title,
        );
    }

    /**
     * Prepares generated text, summary, and follow-up actions.
     *
     * @param context - Operation context.
     * @returns Result when the function
     *   prepares generated text, summary, and follow-up
     *   actions.
     */
    async function prepareFormSubmission(context: any): Promise<any> {
        const { form, citationStore, preSave, preview } = context;
        const moveTitle = trimValue(preSave?.move?.to);
        const shouldMove = shouldMoveSubmission(preSave, moveTitle);
        const submittedForm = shouldMove ? { ...form, name: moveTitle } : form;
        let previewText: string | null = null;

        if (typeof preview?.text === 'string') {
            previewText = preview.text;
        }
        const preserveEditor = previewText == null && shouldPreserveEditor();
        let stub = null;

        if (previewText == null && !preserveEditor) {
            stub = await buildStubFromForm(submittedForm, citationStore);
        }
        let summary = getGeneratedEditSummary(submittedForm, stub);

        if (typeof preview?.summary === 'string') {
            summary = preview.summary;
        }
        const text = previewText ?? stub?.text ?? readEditText();
        const title = getSubmissionTitle(context, shouldMove);
        const pending = createPendingSubmission(
            preSave,
            shouldMove,
            moveTitle,
            title,
        );

        return {
            exists: context.currentPageExists === true,
            pending,
            summary,
            text,
            title,
        };
    }

    /**
     * Gets the page that receives the submitted article text.
     *
     * New articles can be saved directly under an entered free title.
     * Existing articles and explicit moves must start from the
     * current page.
     *
     * @param context - Submit context.
     * @param shouldMove - Whether a page move follows the save.
     * @returns Submission page title.
     */
    function getSubmissionTitle(context: any, shouldMove: boolean): string {
        const pageNameResultC = {
            currentPageExists: context.currentPageExists === true,
            currentTitle: getPageName(),
            enteredTitle: trimValue(context.form?.pageName),
            shouldMove,
        };
        const result = selectArticleSubmissionTitle(pageNameResultC);
        return result;
    }

    /**
     * Checks whether submission includes a page move.
     *
     * @param preSave - Pre save value.
     * @param moveTitle - Move title value.
     * @returns Whether submission includes a page move.
     */
    function shouldMoveSubmission(preSave: any, moveTitle: string): boolean {
        if (preSave?.move?.enabled !== true || moveTitle === '') {
            return false;
        }

        const currentPage = getPageName();
        return (
            normalizePageTitle(moveTitle) !== normalizePageTitle(currentPage)
        );
    }

    /**
     * Gets the generated or preserved edit summary.
     *
     * @param form - Form values.
     * @param stub - Stub value.
     * @returns The generated or preserved edit summary.
     */
    function getGeneratedEditSummary(form: any, stub: any): string {
        if (stub == null) {
            return readEditSummary();
        }

        const editSummaryMetadataResult = createEditSummaryMetadata(form, stub);
        return buildEditSummary(editSummaryMetadataResult);
    }

    /**
     * Creates follow-up state for a submitted article.
     *
     * @param preSave - Pre save value.
     * @param shouldMove - Whether should move.
     * @param moveTitle - Move title value.
     * @param title - Page title that receives the submitted text.
     * @returns Follow-up state for a submitted article.
     */
    function createPendingSubmission(
        preSave: {
            move: { enabled: boolean; leaveRedirect?: boolean };
            actions: PreSaveAction[];
            progressGroups: unknown[];
            registration: { enabled?: boolean };
        },
        shouldMove: boolean,
        moveTitle: string,
        title: string,
    ): PendingSaveDraft {
        let move: { enabled: boolean; leaveRedirect?: boolean; to?: string } = {
            enabled: false,
        };

        if (shouldMove) {
            move = { ...preSave.move, to: moveTitle };
        }
        const result = {
            actions: preSave.actions,
            move,
            progressGroups: preSave.progressGroups,
            registration: preSave.registration,
            title,
        };
        return result;
    }

    /**
     * Runs follow-up actions and navigates after a successful save.
     *
     * @param api - MediaWiki API client.
     * @param pending - Pending value.
     * @param preSave - Pre save value.
     * @param title - Article title that received the saved text.
     */
    async function completeSubmittedFollowUpActions(
        api: mw.Api,
        pending: unknown,
        preSave: { progress: { report: (arg0: string) => void } },
        title: string,
    ) {
        const result = await runSubmittedFollowUpActions(
            api,
            pending,
            title,
            preSave.progress,
        );

        if (result.failed.length > 0) {
            const progress = preSave.progress;

            if (progress?.report != null) {
                const failureMessage = formatPendingActionFailures(
                    result.failed,
                );
                progress.report(failureMessage);
                notifyAction({
                    key: 'follow-up-failed',
                    message: failureMessage,
                    type: 'warning',
                });
            }
            logger.warn('submission.follow-up-failed', {
                failedCount: result.failed.length,
            });
            return;
        }

        logger.info('submission.completed');
        clearPendingSaveData();
        clearSaveProgress();
        notifyAction({
            key: 'submission-completed',
            message: msg('feedback.saveComplete'),
            type: 'success',
        });
        navigateToWhatLinksHere(result.title);
    }

    async function runCheckpointedOperation(
        id: string,
        setDialogProgress: ProgressCallback | undefined,
        operation: () => Promise<void>,
    ): Promise<void> {
        updateCheckpointProgress(id, 'running', setDialogProgress);
        try {
            await operation();
            updateCheckpointProgress(id, 'complete', setDialogProgress);
        } catch (error) {
            updateCheckpointProgress(id, 'failed', setDialogProgress);
            throw error;
        }
    }

    /**
     * Runs follow-up actions after saving an article.
     *
     * @param api - MediaWiki API client.
     * @param pending - Pending follow-up actions.
     * @param title - Submitted article title.
     * @param progress - In-dialog progress reporter.
     * @returns Follow-up action result.
     */
    async function runSubmittedFollowUpActions(
        api: any,
        pending: any,
        title: string,
        progress: any,
    ): Promise<any> {
        const setDialogProgress = progress?.set.bind(progress);
        const setProgress = createCheckpointProgressCallback(setDialogProgress);
        const actionOptions = createFollowUpActionOptions(
            api,
            pending,
            title,
            setProgress,
            { setBundledProgress: setDialogProgress },
        );
        const actions = pending.actions || [];
        const result = await runSelectedActions(actions, actionOptions);

        return result;
    }

    /**
     * Creates shared options for running post-save actions.
     *
     * @param api - MediaWiki API client.
     * @param pending - Pending value.
     * @param title - Page title.
     * @param setProgress - Progress update callback.
     * @param progressOptions - Resume and display-only progress state.
     * @returns Shared options for running post-save actions.
     */
    function createFollowUpActionOptions(
        api: mw.Api,
        pending: { move: PendingSaveDraft['move'] },
        title: string,
        setProgress: ProgressCallback,
        progressOptions: FollowUpProgressOptions = {},
    ): Parameters<
        BrowserApplicationPorts['workflows']['runSelectedActions']
    >[1] {
        const wikidataApi = createWikidataApi();
        const actionProgress = createActionProgressCallbacks(setProgress);
        const moveProgress = createMoveProgressCallbacks(setProgress);
        const result = {
            api,
            confirmedActions: progressOptions.confirmedActions ?? [],
            move: pending.move,
            onBeforeWikidataActions: registerBeforeWikidataActions.bind(
                null,
                api,
                pending,
                setProgress,
            ),
            onBundledActionProgress: setBundledActionProgress.bind(
                null,
                progressOptions.setBundledProgress,
            ),
            saveCategory: saveCategoryWithApi.bind(null, api),
            saveCompanyCategory: saveCompanyCategoryWithApi.bind(null, api),
            title,
            wikidataApi,
            ...actionProgress,
            ...moveProgress,
        };
        return result;
    }

    /**
     * Binds progress callbacks for individual follow-up actions.
     *
     * @param setProgress - Progress update callback.
     * @returns Bound action callbacks.
     */
    function createActionProgressCallbacks(setProgress: ProgressCallback) {
        return {
            onActionComplete: setActionProgress.bind(
                null,
                setProgress,
                'complete',
            ),
            onActionFailed: setActionProgress.bind(null, setProgress, 'failed'),
            onActionSkipped: setActionProgress.bind(
                null,
                setProgress,
                'skipped',
            ),
            onActionStart: setActionProgress.bind(null, setProgress, 'running'),
        };
    }

    /**
     * Binds progress callbacks for the optional page move.
     *
     * @param setProgress - Progress update callback.
     * @returns Bound move callbacks.
     */
    function createMoveProgressCallbacks(setProgress: ProgressCallback) {
        return {
            onMoveComplete: setMoveProgress.bind(null, setProgress, 'complete'),
            onMoveFailed: setMoveProgress.bind(null, setProgress, 'failed'),
            onMoveStart: setMoveProgress.bind(null, setProgress, 'running'),
        };
    }

    /**
     * Reports a follow-up action's progress state.
     */
    type ProgressCallback = (id: string, status: SaveProgressStatus) => unknown;

    function createCheckpointProgressCallback(
        setDialogProgress?: ProgressCallback,
    ): ProgressCallback {
        return function updateProgress(id, status) {
            updateCheckpointProgress(id, status, setDialogProgress);
        };
    }

    function updateCheckpointProgress(
        id: string,
        status: SaveProgressStatus,
        setDialogProgress?: ProgressCallback,
    ): void {
        setDialogProgress?.(id, status);
        setSaveProgressStep(id, status);
        setPendingSaveOperationStatus(id, toCheckpointStatus(status));
    }

    function toCheckpointStatus(status: SaveProgressStatus) {
        if (status === 'complete' || status === 'skipped') {
            return 'confirmed' as const;
        }
        if (status === 'running') {
            return 'running' as const;
        }
        if (status === 'failed') {
            return 'uncertain' as const;
        }
        return 'pending' as const;
    }

    /**
     * Describes pending post-save work.
     */
    interface PendingFollowUpActions {
        move: unknown;
        registration?: { enabled?: boolean };
    }

    /**
     * Describes a completed post-save action.
     */
    interface CompletedFollowUpAction {
        category?: string;
        company?: string;
        id: string;
        type: string;
    }

    interface FollowUpProgressOptions {
        confirmedActions?: PreSaveAction[];
        setBundledProgress?: ProgressCallback;
    }

    /**
     * Describes the result of running post-save actions.
     */
    interface FollowUpActionResult {
        completed: CompletedFollowUpAction[];
        title: string;
    }

    /**
     * Updates one action progress status.
     *
     * @param setProgress - Set progress value.
     * @param status - Status value.
     * @param action - Action value.
     */
    function setActionProgress(
        setProgress: ProgressCallback,
        status: SaveProgressStatus,
        action: { id: string },
    ): void {
        setProgress(action.id, status);
    }

    /** Updates a bundled substep without changing its checkpoint. */
    function setBundledActionProgress(
        setProgress: ProgressCallback | undefined,
        action: { id: string },
        status: 'complete' | 'failed' | 'running',
    ): void {
        setProgress?.(action.id, status);
    }

    /**
     * Updates move progress status.
     *
     * @param setProgress - Set progress value.
     * @param status - Status value.
     */
    function setMoveProgress(
        setProgress: ProgressCallback,
        status: SaveProgressStatus,
    ): void {
        setProgress('move', status);
    }

    /**
     * Registers pending pages before Wikidata actions run.
     *
     * @param api - MediaWiki API client.
     * @param pending - Pending value.
     * @param setProgress - Set progress value.
     * @param result - Operation result.
     * @returns Result when the function
     *   registers pending pages before wikidata actions
     *   run.
     */
    function registerBeforeWikidataActions(
        api: mw.Api,
        pending: PendingFollowUpActions,
        setProgress: ProgressCallback,
        result: FollowUpActionResult,
    ): Promise<void> {
        return registerPendingNewPage(api, pending, result, setProgress);
    }

    /**
     * Saves a category with a bound API client.
     *
     * @param api - MediaWiki API client.
     * @param category - Category page title.
     * @param text - Category wikitext.
     * @returns Resolves after the category is saved.
     */
    function saveCategoryWithApi(
        api: mw.Api,
        category: string,
        text: string,
    ): Promise<void> {
        return saveCategoryPage(category, text, undefined, api);
    }

    /**
     * Saves a company category with bound API clients.
     *
     * @param api - MediaWiki API client.
     * @param category - Company category page title.
     * @param text - Company category wikitext.
     * @param englishName - English company name.
     * @param options - Progress reporting options.
     * @returns Resolves after the company category is saved.
     */
    function saveCompanyCategoryWithApi(
        api: mw.Api,
        category: string,
        text: string,
        englishName: string,
        options: {
            onProgress: (operation: string, status: string) => void;
        },
    ): Promise<void> {
        const wikidataApi = createWikidataApi();
        const result = saveCompanyCategory(category, text, englishName, {
            api,
            onProgress: options.onProgress,
            wikidataApi,
        });
        return result;
    }

    /**
     * Registers the article and completed company categories locally.
     *
     * @param api - MediaWiki API client.
     * @param pending - Pending follow-up actions.
     * @param result - Completed action result state.
     * @param setProgress - Progress update callback.
     * @returns Resolves after registration finishes.
     */
    async function registerPendingNewPage(
        api: mw.Api,
        pending: PendingFollowUpActions,
        result: FollowUpActionResult,
        setProgress: ProgressCallback,
    ): Promise<void> {
        if (pending.registration?.enabled !== true) {
            return;
        }

        setProgress('new-page-list', 'running');
        try {
            const categories = getCompanyCategoryActions(result.completed);
            await registerNewPage(api, result.title, categories);
            setProgress('new-page-list', 'complete');
        } catch (error) {
            setProgress('new-page-list', 'failed');
            throw error;
        }
    }

    /**
     * Handles refresh pre save category wikidata.
     *
     * Refreshes missing company-category Wikidata IDs before showing
     * pre-save work.
     *
     * @param form - Dialog form values.
     * @returns Resolves after category metadata is
     * refreshed.
     */
    async function refreshPreSaveCategoryWikidata(form: any): Promise<void> {
        const rows = Array.isArray(form.categoryRows) ? form.categoryRows : [];
        const pendingRows = rows.filter(shouldRefreshCategoryWikidata);

        const mappedValues = pendingRows.map(refreshCategoryWikidata);
        await Promise.all(mappedValues);
    }

    /**
     * Checks whether a staged company category needs Wikidata metadata.
     *
     * @param row - Category review row.
     * @returns Whether Wikidata should be refreshed.
     */
    function shouldRefreshCategoryWikidata(row: any): boolean {
        if (row?.enabled === false || row?.pendingCreation == null) {
            return false;
        }

        if (trimValue(row.pendingCreation.englishName) === '') {
            return false;
        }

        return trimValue(row.pendingCreation.wikidataId) === '';
    }

    /**
     * Refreshes the Wikidata ID for one staged company category.
     *
     * @param row - Category review row.
     * @returns Resolves after the row is updated.
     */
    async function refreshCategoryWikidata(row: any): Promise<void> {
        try {
            const title = normalizeEnglishCategoryTitle(
                row.pendingCreation.englishName,
            );
            const metadata = await fetchEnwikiMetadata(title);

            row.pendingCreation.wikidataId = trimValue(metadata.wikidataId);
        } catch (_error) {
            row.pendingCreation.wikidataId = '';
        }
    }

    /**
     * Handles get company category actions.
     *
     * Gets completed company-category action titles for page-list
     * registration.
     *
     * @param actions - Completed follow-up actions.
     * @returns Category titles.
     */
    function getCompanyCategoryActions(actions: Array<any>): Array<string> {
        const result = actions
            .filter(isCompanyCategoryAction)
            .map(function callback(action) {
                return action.category;
            });
        return result;
    }

    /**
     * Checks whether an action represents a company-category creation.
     *
     * @param action - Completed follow-up action.
     * @returns Whether the action should register a new page.
     */
    function isCompanyCategoryAction(action: any): boolean {
        return action.type === 'category' && trimValue(action.company) !== '';
    }

    /**
     * Normalizes an English category title for metadata lookup.
     *
     * @param title - User-entered English category title.
     * @returns Category title with namespace.
     */
    function normalizeEnglishCategoryTitle(title: string): string {
        const value = trimValue(title);

        return value === '' ? value : formatNamespaceTitle(value, 'enwiki', 14);
    }

    /**
     * Creates an article submit callback with the citation cache bound.
     *
     * @param citationStore - Citation fetch/cache store.
     * @param submit - Submit implementation.
     * @param currentPageExists - Whether the current article exists.
     * @returns Dialog submit callback.
     */
    function createSubmitHandler(
        citationStore: any,
        submit: (...args: any[]) => any = submitForm,
        currentPageExists = true,
    ): (...args: any[]) => any {
        const binding = { citationStore, currentPageExists, submit };
        return invokeSubmitHandler.bind(null, binding);
    }

    /**
     * Invokes the internal or injected submit implementation.
     *
     * @param binding - Binding value.
     * @param {...unknown} args - Args value.
     * @returns Result when the function
     *   invokes the internal or injected submit
     *   implementation.
     */
    function invokeSubmitHandler(
        binding: {
            citationStore: unknown;
            currentPageExists: boolean;
            submit: (...args: unknown[]) => unknown;
        },
        ...args: unknown[]
    ): unknown {
        const [form, sourceFetchState, closeDialog, preSave, preview] = args;
        const context = {
            citationStore: binding.citationStore,
            closeDialog,
            currentPageExists: binding.currentPageExists,
            form,
            preSave,
            preview,
            sourceFetchState,
        };

        if (binding.submit === submitForm) {
            return binding.submit(context);
        }

        const result = binding.submit(
            form,
            sourceFetchState,
            closeDialog,
            preSave,
            binding.citationStore,
            preview,
        );
        return result;
    }

    /**
     * Builds generated wikitext and metadata from dialog form values.
     *
     * @param form - Dialog form values.
     * @param citationStore - Citation fetch/cache store.
     * @returns Generated stub text and article
     * parameters.
     */
    async function buildStubFromForm(
        form: any,
        citationStore: any,
    ): Promise<any> {
        const formDefaultNameResultA = {
            defaultName: getFormDefaultName(form),
        };
        const result = buildArticleStubFromForm(
            form,
            citationStore,
            formDefaultNameResultA,
        );
        return result;
    }

    /**
     * Creates edit summary metadata from dialog form values.
     *
     * @param form - Dialog form values.
     * @param form.englishName - English game title.
     * @param form.enwikiTitle - English Wikipedia page title.
     * @param form.name - Main page title.
     * @param form.originalName - Original game title.
     * @param form.wikidataId - Wikidata entity ID.
     * @param form.year - Release year.
     * @param stub - Generated stub data.
     * @param stub.articleData - Article metadata.
     * @returns Edit summary metadata.
     */
    function createEditSummaryMetadata(form: any, stub: any): any {
        const result = {
            displayName: getEditSummaryDisplayName(form),
            enwikiTitle: trimValue(form.enwikiTitle),
            proseSinographs: stub.articleData.prose.sinographs,
            wikidataId: trimValue(form.wikidataId),
            year: trimValue(form.year),
        };
        return result;
    }

    /**
     * Gets the title shown in the edit summary name text.
     *
     * @param form - Dialog form values.
     * @param form.englishName - English game title.
     * @param form.originalName - Original game title.
     * @returns Summary display title.
     */
    function getEditSummaryDisplayName(form: any): string {
        const result =
            trimValue(form.originalName) ||
            trimValue(form.englishName) ||
            trimValue(form.name);
        return result;
    }

    /**
     * Refreshes reviewed category rows from current generated metadata.
     *
     * @param form - Dialog form values.
     * @param categoryState - Category refresh status state.
     * @param categoryStore - Category resolution store.
     * @param options - Category refresh options.
     * @returns Resolves after category rows are refreshed.
     */
    async function refreshFormCategoryRows(
        form: ArticleForm & { categoryRows: CategoryReviewRow[] },
        categoryState: { error: string; loading: boolean },
        categoryStore: CategoryCacheStorePort,
        options: { bypassCache: boolean } = { bypassCache: false },
    ): Promise<void> {
        categoryState.error = '';
        categoryState.loading = true;

        try {
            if (options.bypassCache) {
                categoryStore.clear();
            }

            const rows = await buildRefreshedCategoryRows(
                form,
                categoryStore,
                options,
            );
            mergeRefreshedCategoryRows(form, rows);
            categoryStore.save();
        } catch (error) {
            categoryState.error = getErrorMessage(error);
        } finally {
            categoryState.loading = false;
        }
    }

    /**
     * Builds category rows using current cache options.
     *
     * @param form - Form values.
     * @param store - Store value.
     * @param options - Operation options.
     * @returns Category rows using current cache options.
     */
    async function buildRefreshedCategoryRows(
        form: ArticleForm & { categoryRows: CategoryReviewRow[] },
        store: { cache: Record<string, unknown> },
        options: { bypassCache: boolean },
    ): Promise<CategoryReviewRow[]> {
        const formDefaultNameResult = {
            article: { defaultName: getFormDefaultName(form) },
            categories: {
                bypassCache: options.bypassCache,
                cache: store.cache,
            },
        };
        const result = await prepareCategoryRows(
            form,
            form.categoryRows,
            formDefaultNameResult,
        );
        return result;
    }

    /**
     * Merges refreshed rows into the reactive category array.
     *
     * @param form - Form values.
     * @param rows - Row values.
     */
    function mergeRefreshedCategoryRows(
        form: { categoryRows: unknown[] },
        rows: unknown[],
    ): void {
        const mapCallback = function callback(row: unknown, index: number) {
            const current = form.categoryRows[index];

            if (current == null) {
                return row;
            }

            Object.assign(current, row);
            return current;
        };
        const merged = rows.map(mapCallback);
        form.categoryRows.splice(0, form.categoryRows.length, ...merged);
    }

    /**
     * Saves the current form data with a target page title.
     *
     * @param form - Dialog form values.
     * @param page - Target page title.
     */
    function saveCurrentFormHistory(form: any, page: string): void {
        saveFormHistory(
            {
                ...form,
                name: page,
            },
            page,
        );
    }

    /**
     * Reads explicit history entries plus the temporary draft.
     *
     * @returns Form history manager entries.
     */
    function readFormHistoryEntries(): Array<any> {
        return [readFormDraftEntry(), ...readFormHistory()].filter(Boolean);
    }

    /**
     * Opens the dialog from the toolbox link click.
     *
     * @param event - Browser event from the toolbox link.
     * @returns Result when the function
     *   opens the dialog from the toolbox link click.
     */
    function handleToolboxClick(event: any): void {
        event.preventDefault();
        (window as any).vgStubCreatorDialog.open();
    }

    /**
     * Adds the dialog trigger link to the MediaWiki toolbox.
     *
     * @returns Result when the function
     *   adds the dialog trigger link to the mediawiki
     *   toolbox.
     */
    function addToolboxLink(): void {
        if (isMissingPageView()) {
            addMissingPageEditTrigger(mw.util, handleToolboxClick);
            return;
        }

        addViewPageTrigger(mw.util, handleToolboxClick);
    }

    /**
     * Handles open target page.
     *
     * Generates form data and opens it in a target new-page edit form.
     *
     * @param form - Dialog form values.
     * @param title - Target page title.
     * @param sourceFetchState - Source fetch status state.
     * @param citationStore - Citation fetch/cache store.
     * @param options - Target-page opening options.
     * @returns Resolves after generated text is stored.
     */
    async function openTargetPage(
        form: any,
        title: string,
        sourceFetchState: any,
        citationStore: any,
        options: any = {},
    ): Promise<void> {
        sourceFetchState.error = '';
        const targetTitle = trimValue(title);

        if (targetTitle === '') {
            return;
        }

        sourceFetchState.loading = true;

        try {
            const pending = await prepareMovedEdit(
                form,
                targetTitle,
                citationStore,
                options,
            );
            storeMovedEdit(pending);
            navigateToTargetEditor(targetTitle);
        } catch (error) {
            sourceFetchState.error = getErrorMessage(error);
            sourceFetchState.loading = false;
        }
    }

    /**
     * Prepares moved article text and metadata for a target editor.
     *
     * @param form - Form values.
     * @param title - Page title.
     * @param citationStore - Citation store value.
     * @param options - Operation options.
     * @returns Result when the function
     *   prepares moved article text and metadata for a
     *   target editor.
     */
    async function prepareMovedEdit(
        form: Record<string, unknown>,
        title: string,
        citationStore: CitationStorePort,
        options: { preview: boolean },
    ) {
        const targetForm = { ...form, pageName: title };
        const preserveEditor = shouldPreserveEditor();
        const stubs = await buildMovedEditStubs(
            form,
            targetForm,
            citationStore,
            preserveEditor,
        );
        let text = stubs.target.text;

        if (preserveEditor) {
            const readEditTextResult = readEditText();
            text = updateMovedTitleText(
                readEditTextResult,
                stubs.current.articleData,
                stubs.target.articleData,
            );
        }
        const result = {
            form: targetForm,
            preview: options.preview,
            summary: preserveEditor ? readEditSummary() : undefined,
            summaryMetadata: createEditSummaryMetadata(
                targetForm,
                stubs.target,
            ),
            text,
            title,
        };
        return result;
    }

    /**
     * Builds target and optional current-title stubs for a move.
     *
     * @param form - Form values.
     * @param targetForm - Target form value.
     * @param store - Store value.
     * @param preserve - Preserve value.
     * @returns Target and optional current-title stubs for a move.
     */
    async function buildMovedEditStubs(
        form: unknown,
        targetForm: unknown,
        store: unknown,
        preserve: boolean,
    ) {
        if (!preserve) {
            const target = await buildStubFromForm(targetForm, store);
            return { current: null, target };
        }

        const [current, target] = await Promise.all([
            buildStubFromForm(form, store),
            buildStubFromForm(targetForm, store),
        ]);
        return { current, target };
    }

    /**
     * Navigates to the target page editor.
     *
     * @param title - Page title.
     */
    function navigateToTargetEditor(title: string): void {
        window.location.href = mw.util.getUrl(title, {
            action: 'edit',
            redlink: '1',
        });
    }

    /**
     * Restores moved stub text into the target new-page editor.
     *
     * @returns Result when the function
     *   restores moved stub text into the target new-page
     *   editor.
     */
    function restoreMovedEditText(): void {
        const pageNameResultB = getPageName();
        const pending = getMovedEdit(pageNameResultB);

        if (pending == null) {
            return;
        }

        writeEditText(pending.text);
        const editSummaryResult =
            pending.summary ?? buildEditSummary(pending.summaryMetadata || {});
        writeEditSummary(editSummaryResult);
        clearMovedEdit();

        if (pending.preview === true) {
            const pageNameResultA = getPageName();
            storePreviewFormData(pending.form, pageNameResultA);
            submitPreviewForm();
        }
    }

    /**
     * Gets the current full page name.
     *
     * @returns Current full page name.
     */
    function getPageName(): string {
        return mw.config.get('wgPageName').replace(/_/gu, ' ');
    }

    /**
     * Tracks whether an English Wikipedia launch is already resolving.
     */
    let enwikiLaunchPending = false;

    /**
     * Adds the English Wikipedia launcher that starts zhwiki creation.
     */
    function initEnwikiLauncher(): void {
        const enwikiTitle = getPageName();
        const fallbackUrl = buildZhwikiCreationUrl(enwikiTitle);
        const callback = handleEnwikiLaunch.bind(
            null,
            enwikiTitle,
            fallbackUrl,
        );
        addEnwikiCreateTrigger(mw.util, callback, fallbackUrl);
    }

    /**
     * Resolves and opens the Chinese Wikipedia creation target.
     *
     * @param enwikiTitle - Enwiki title value.
     * @param fallbackUrl - Fallback url value.
     * @param event - DOM event.
     */
    async function handleEnwikiLaunch(
        enwikiTitle: string,
        fallbackUrl: string | URL,
        event: { preventDefault: () => void },
    ) {
        event.preventDefault();

        if (enwikiLaunchPending) {
            return;
        }

        enwikiLaunchPending = true;
        const tab = window.open(fallbackUrl, '_blank');

        try {
            const api = createZhwikiApiClient();
            const target = await resolveZhwikiCreationTitle(enwikiTitle, api);
            const url = buildZhwikiCreationUrl(enwikiTitle, target);
            openResolvedZhwikiTarget(tab, url);
        } catch (_error) {
            if (tab == null) {
                window.open(fallbackUrl, '_blank', 'noopener');
            }
        } finally {
            enwikiLaunchPending = false;
        }
    }

    /**
     * Updates a pre-opened tab or opens the resolved target.
     *
     * @param tab - Tab value.
     * @param url - Request URL.
     */
    function openResolvedZhwikiTarget(tab: Window | null, url: string): void {
        if (tab != null) {
            tab.location.href = url;
            return;
        }

        window.open(url, '_blank', 'noopener');
    }

    /**
     * Mounts the Codex dialog and registers the toolbox trigger.
     *
     * @param require - ResourceLoader module resolver.
     * @returns Result when the function
     *   mounts the codex dialog and registers the toolbox
     *   trigger.
     */
    function init(require: (...args: any[]) => any): void {
        const context = createInitContext(require);
        addDialogStyles();
        const dialogOptions = createDialogOptions(context);
        const component = createDialogComponent(context.Vue, dialogOptions);
        const app = context.Vue.createMwApp(component);

        registerCodexComponents(app, context.Codex);
        const hostResult = createHost();
        app.mount(hostResult);
        finishInitialization(context);
    }

    let saveInterceptorActive = false;

    /**
     * Describes dialog initialization dependencies and restored state.
     */
    interface InitContext {
        Codex: VgStubCreatorCodexComponents;
        Vue: Pick<VueCore, 'createMwApp'>;
        activationForm?: unknown;
        categoryStore: CategoryCacheStorePort;
        citationStore: CitationStorePort;
        currentPageExists: boolean;
        currentPageName: string;
        defaultName: string;
        movedEdit?: { form: unknown; preview?: boolean };
        previewFormData?: { form: unknown };
    }

    /**
     * Creates shared initialization dependencies and restored state.
     *
     * @param require - ResourceLoader module resolver.
     * @returns Shared initialization dependencies and restored state.
     */
    function createInitContext(require: {
        (module: '@wikimedia/codex'): VgStubCreatorCodexComponents;
        (module: 'vue'): InitContext['Vue'];
    }): InitContext {
        const currentPageName = getPageName();
        let previewFormData: { form: unknown } | undefined;

        if (mw.config.get('wgAction') === 'submit') {
            previewFormData = getPreviewFormData(currentPageName);
        }
        saveInterceptorActive = false;
        const result = {
            Codex: require('@wikimedia/codex'),
            Vue: require('vue'),
            activationForm: readZhwikiActivationForm(window.location.search),
            categoryStore: createCategoryCacheStore(currentPageName),
            citationStore: createCitationStore(),
            currentPageExists: mw.config.get('wgArticleId') !== 0,
            currentPageName,
            defaultName: getDefaultName(),
            movedEdit: getMovedEdit(currentPageName),
            previewFormData,
        };
        return result;
    }

    /**
     * Activates edit-save interception once.
     */
    function activateTool(): void {
        if (saveInterceptorActive) {
            return;
        }

        const interceptEditSaveCallback = function submitDialog() {
            return (window as any).vgStubCreatorDialog.submit();
        };
        interceptEditSave(interceptEditSaveCallback);
        saveInterceptorActive = true;
    }

    /**
     * Creates the complete dialog option object.
     *
     * @param context - Operation context.
     * @returns The complete dialog option object.
     */
    function createDialogOptions(context: InitContext): CreatorDialogOptions {
        const result = {
            ...createBaseDialogOptions(context),
            ...createCategoryDialogOptions(context),
            ...createReviewDialogOptions(context),
            ...createSourceDialogOptions(context),
        };
        return result;
    }

    /**
     * Creates basic form and history dialog options.
     *
     * @param context - Operation context.
     * @returns Basic form and history dialog options.
     */
    function createBaseDialogOptions(context: {
        currentPageExists: boolean;
        currentPageName: string;
        defaultName: string;
        activationForm?: unknown;
        previewFormData?: { form: unknown };
        movedEdit?: { form: unknown; preview?: boolean };
    }) {
        const result = {
            citationPrefetchDelay: CITATION_PREFETCH_DELAY,
            createReviewLinkSession,
            currentPageExists: context.currentPageExists,
            currentTitle: context.currentPageName,
            defaultName: context.defaultName,
            getPageUrl,
            getHistoryEntries: readFormHistoryEntries,
            getFieldPlaceholder,
            getFieldPreview,
            getProseSinographs: getFormProseSinographs,
            getProseWikitext: getFormProseWikitext,
            initialForm: getInitialDialogForm(context),
            initialOpen: shouldInitiallyOpenDialog(context),
            initialEnwikiLookup: context.activationForm != null,
            onActivate: activateTool,
            onClearHistory: clearFormHistory,
            onCreateCategoryRow: createManualCategoryRow,
            onDeleteHistoryEntry: deleteFormHistoryEntry,
            onFormChange: saveDraftForPage.bind(null, context.currentPageName),
            onSubmitHistory: saveCurrentFormHistory,
        };
        return result;
    }

    /**
     * Creates category and page movement dialog options.
     *
     * @param context - Operation context.
     * @returns Category and page movement dialog options.
     */
    function createCategoryDialogOptions(context: {
        categoryStore: CategoryCacheStorePort;
        citationStore: CitationStorePort;
    }) {
        const result = {
            onCategoryRowsRefresh: refreshCategoryRowsForDialog.bind(
                null,
                context.categoryStore,
            ),
            onMoveTarget: openTargetPageForDialog.bind(
                null,
                context.citationStore,
            ),
            onPrepareCompanyCategory: prepareCompanyCategoryText,
            onUpdateCategoryRowCategory: updateCategoryRowCategory,
        };
        return result;
    }

    /**
     * Creates preview and review dialog options.
     *
     * @param context - Operation context.
     * @returns Preview and review dialog options.
     */
    function createReviewDialogOptions(context: {
        citationStore: CitationStorePort;
    }) {
        const result = {
            onCheckPageTitle: checkDialogPageTitle,
            onCheckRedirectRows: checkDialogRedirectRows,
            onFetchPageText: fetchPageText,
            onParseArticlePreview: parseArticlePreviewText,
            onParsePreview: parsePreviewText,
            onPrepareRedirectRows: prepareDialogRedirectRows,
            onPrepareReview: prepareNavboxRows,
            onPreview: previewFormForDialog.bind(null, context.citationStore),
        };
        return result;
    }

    /**
     * Creates citation, metadata, and submit dialog options.
     *
     * @param context - Operation context.
     * @returns Citation, metadata, and submit dialog options.
     */
    function createSourceDialogOptions(context: {
        citationStore: CitationStorePort;
        currentPageExists: boolean;
    }) {
        const result = {
            onEnwikiTitleChange: fetchEnwikiMetadata,
            onPrepareCitations: prepareDialogCitations.bind(
                null,
                context.citationStore,
            ),
            onPreSavePrepare: prepareDialogPreSave,
            onSourceUrlChange: context.citationStore.prefetch.bind(
                context.citationStore,
            ),
            onSteamNamesFetch: fetchDialogSteamNames.bind(
                null,
                context.citationStore,
            ),
            onSubmit: createSubmitHandler(
                context.citationStore,
                submitForm,
                context.currentPageExists,
            ),
        };
        return result;
    }

    /**
     * Gets the highest-priority restored form.
     *
     * @param context - Operation context.
     * @returns The highest-priority restored form.
     */
    function getInitialDialogForm(context: {
        activationForm?: unknown;
        previewFormData?: { form: unknown };
        movedEdit?: { form: unknown };
        currentPageName: string;
    }): unknown {
        let result = context.activationForm;

        if (!result) {
            result = context.previewFormData?.form;
        }

        if (!result) {
            result = context.movedEdit?.form;
        }

        if (!result) {
            result = readFormDraftForPage(context.currentPageName);
        }
        return result;
    }

    /**
     * Checks whether restored state should open the dialog.
     *
     * @param context - Operation context.
     * @returns Whether restored state should open the dialog.
     */
    function shouldInitiallyOpenDialog(context: {
        activationForm?: unknown;
        previewFormData?: unknown;
        movedEdit?: { preview?: boolean };
    }): boolean {
        const hasInitialForm = Boolean(context.activationForm);
        const hasPreview = Boolean(context.previewFormData);
        const hasMovedEdit = hasRestoredMovedEdit(context.movedEdit);
        return hasInitialForm || hasPreview || hasMovedEdit;
    }

    /**
     * Checks whether a moved edit should restore the dialog.
     *
     * @param movedEdit - Moved edit value.
     * @returns Whether a moved edit should restore the dialog.
     */
    function hasRestoredMovedEdit(movedEdit?: { preview?: boolean }): boolean {
        return movedEdit != null && movedEdit.preview !== true;
    }

    /**
     * Persists a form draft for one bound page.
     *
     * @param page - Page value.
     * @param form - Form values.
     */
    function saveDraftForPage(page: string, form: unknown): void {
        saveFormDraft(form, page);
    }

    /**
     * Refreshes dialog category rows with the bound cache store.
     *
     * @param store - Store value.
     * @param form - Form values.
     * @param state - Mutable operation state.
     * @param refreshOptions - Refresh options value.
     * @returns Result when the function
     *   refreshes dialog category rows with the bound
     *   cache store.
     */
    function refreshCategoryRowsForDialog(
        store: CategoryCacheStorePort,
        form: ArticleForm & { categoryRows: CategoryReviewRow[] },
        state: { error: string; loading: boolean },
        refreshOptions: { bypassCache?: boolean },
    ) {
        return refreshFormCategoryRows(form, state, store, {
            bypassCache: refreshOptions.bypassCache === true,
        });
    }

    /**
     * Opens a dialog target page with the bound citation store.
     *
     * @param store - Store value.
     * @param form - Form values.
     * @param title - Page title.
     * @param state - Mutable operation state.
     * @returns Result when the function
     *   opens a dialog target page with the bound citation
     *   store.
     */
    function openTargetPageForDialog(
        store: unknown,
        form: unknown,
        title: string,
        state: unknown,
    ) {
        return openTargetPage(form, title, state, store);
    }

    /**
     * Checks one proposed page title for existence and conversion.
     *
     * @param title - Page title.
     * @returns Result when the function
     *   checks one proposed page title for existence and
     *   conversion.
     */
    async function checkDialogPageTitle(title: string): Promise<any> {
        const api = createLocalApi();
        const [match] = await fetchExistingPageTitles(api, [title]);
        if (match == null || typeof match.exists !== 'boolean') {
            throw new Error(
                `Title request failed: No checked result for ${title}.`,
            );
        }
        const result = {
            exists: match.exists,
            requestedTitle: title,
            title: match.title,
        };
        return result;
    }

    /**
     * Prepares generated redirect rows for the dialog.
     *
     * @param form - Form values.
     * @param title - Page title.
     * @returns Result when the function
     *   prepares generated redirect rows for the dialog.
     */
    async function prepareDialogRedirectRows(
        form: ArticleForm,
        title: string,
    ): ReturnType<CreatorDialogOptions['onPrepareRedirectRows']> {
        const redirectTitles = buildRedirectTitles(form, title);
        const redirectTitleCheckTitlesResulB =
            getRedirectTitleCheckTitles(redirectTitles);
        const api = createLocalApi();
        const existing = await fetchExistingPageTitles(
            api,
            redirectTitleCheckTitlesResulB,
        );
        return buildRedirectRows(form, title, existing);
    }

    /**
     * Rechecks edited redirect rows for the dialog.
     *
     * @param rows - Row values.
     * @param title - Page title.
     * @returns Result when the function
     *   rechecks edited redirect rows for the dialog.
     */
    async function checkDialogRedirectRows(
        rows: Array<{ title: string }>,
        title: string,
    ): ReturnType<CreatorDialogOptions['onCheckRedirectRows']> {
        const redirectTitles = rows.map((row) => row.title);
        const redirectTitleCheckTitlesResulA =
            getRedirectTitleCheckTitles(redirectTitles);
        const api = createLocalApi();
        const existing = await fetchExistingPageTitles(
            api,
            redirectTitleCheckTitlesResulA,
        );
        return buildRedirectRowsFromTitles(redirectTitles, title, existing);
    }

    /**
     * Builds a dialog preview with the bound citation store.
     *
     * @param store - Store value.
     * @param form - Form values.
     * @param state - Mutable operation state.
     * @returns A dialog preview with the bound citation store.
     */
    function previewFormForDialog(
        store: CitationStorePort,
        form: ArticleForm,
        state: { error: string; loading: boolean },
    ): Promise<DialogPreview | undefined> {
        return previewForm(form, state, store);
    }

    /**
     * Prepares managed citations with the bound citation store.
     *
     * @param store - Store value.
     * @param form - Form values.
     * @param options - Operation options.
     * @returns Result when the function
     *   prepares managed citations with the bound citation
     *   store.
     */
    function prepareDialogCitations(
        store: CitationStorePort,
        form: ArticleForm,
        options: { refetchSourceUrls?: string[] } = {},
    ): ReturnType<CreatorDialogOptions['onPrepareCitations']> {
        return prepareManagedCitationRows(form, store, options);
    }

    /**
     * Prepares the final reviewed follow-up action list.
     *
     * @param form - Form values.
     * @param title - Page title.
     * @returns Result when the function
     *   prepares the final reviewed follow-up action list.
     */
    async function prepareDialogPreSave(
        form: { redirectRows: Array<{ title: string }> },
        title: string,
    ): ReturnType<CreatorDialogOptions['onPreSavePrepare']> {
        await refreshPreSaveCategoryWikidata(form);
        let redirectTitles = buildRedirectTitles(form, title);

        if (Array.isArray(form.redirectRows)) {
            redirectTitles = form.redirectRows.map((row) => row.title);
        }
        const redirectTitleCheckTitlesResult =
            getRedirectTitleCheckTitles(redirectTitles);
        const api = createLocalApi();
        const existing = await fetchExistingPageTitles(
            api,
            redirectTitleCheckTitlesResult,
        );
        const metadata = { finalTitle: title, form, title };
        const actions = buildPreSaveActions(metadata, existing);
        return { actions, move: { enabled: false, to: title } };
    }

    /**
     * Fetches Steam name rows with the bound citation store.
     *
     * @param store - Store value.
     * @param url - Request URL.
     * @param options - Operation options.
     * @returns Steam name rows with the bound citation store.
     */
    function fetchDialogSteamNames(
        store: CitationStorePort,
        url: string,
        options: { includeJapanese?: boolean } = {},
    ): ReturnType<CreatorDialogOptions['onSteamNamesFetch']> {
        return fetchSteamNameRows(url, store, options);
    }

    /**
     * Clears restored state and registers page triggers.
     *
     * @param context - Operation context.
     */
    function finishInitialization(context: {
        previewFormData?: { form: unknown };
        movedEdit?: { form: unknown; preview?: boolean };
    }): void {
        if (context.previewFormData != null) {
            clearPreviewFormData();
        }

        if (context.movedEdit != null) {
            activateTool();
        }

        addToolboxLink();
        restoreMovedEditText();
    }

    /**
     * Runs preselected follow-up actions on the new article.
     *
     * @returns Result when the function
     *   runs the preselected follow-up actions on the
     *   newly created article.
     */
    async function runPendingSaveActions(): Promise<void> {
        const pageName = getPageName();
        const pending = getPendingSaveData(pageName);

        if (pending == null) {
            return;
        }

        initializeSaveProgress(pending);
        const resume = preparePendingSaveResume(pending);
        if (hasCriticalRecoveryBlock(resume.blockedOperationIds)) {
            reportBlockedRecovery(resume.blockedOperationIds);
            return;
        }

        try {
            const api = createLocalApi();
            const options = createFollowUpActionOptions(
                api,
                { ...pending, ...resume },
                resume.title,
                createCheckpointProgressCallback(),
                { confirmedActions: resume.confirmedActions },
            );
            const result = await runSelectedActions(resume.actions, options);

            if (completePendingSaveProgress(result)) {
                clearPendingSaveData();
                navigateToWhatLinksHere(result.title);
            }
        } catch (error) {
            failSaveProgress(toError(error));
            const message = getErrorMessage(error);
            logger.error('pending-save.failed', error);
            notifyAction({
                key: 'pending-save-failed',
                message,
                type: 'error',
            });
        }
    }

    /**
     * Completes or reports restored follow-up action progress.
     *
     * @param result - Operation result.
     */
    function completePendingSaveProgress(result: {
        failed: unknown[];
        title: string;
    }): boolean {
        if (result.failed.length > 0) {
            const pendingActionFailuresResult = formatPendingActionFailures(
                result.failed,
            );
            reportSaveProgressError(pendingActionFailuresResult);
            return false;
        }

        const pending = getPendingSaveData(result.title);
        const incomplete = Object.values(pending?.operations ?? {}).some(
            (status) => status !== 'confirmed',
        );
        if (incomplete) {
            reportBlockedRecovery(
                preparePendingSaveResume(pending as PendingSaveSession)
                    .blockedOperationIds,
            );
            return false;
        }
        clearSaveProgress();
        return true;
    }

    function hasCriticalRecoveryBlock(ids: string[]): boolean {
        return ids.includes('save') || ids.includes('move');
    }

    function reportBlockedRecovery(ids: string[]): void {
        const message = formatPendingActionFailures(ids.map((id) => ({ id })));
        reportSaveProgressError(message);
        logger.warn('pending-save.recovery-blocked', {
            itemCount: ids.length,
        });
        notifyAction({
            key: 'pending-save-recovery-blocked',
            message,
            type: 'warning',
        });
    }

    /**
     * Navigates to backlinks for the completed article.
     *
     * @param title - Page title.
     */
    function navigateToWhatLinksHere(title: string): void {
        const page = buildWhatLinksHerePageTitle(title);
        window.location.href = mw.util.getUrl(page);
    }

    /**
     * Formats a report for follow-up actions requiring manual review.
     *
     * @param actions - Failed follow-up actions.
     * @returns Failure report.
     */
    function formatPendingActionFailures(actions: Array<any>): string {
        const filterCallback = (label: unknown) => trimValue(label) !== '';
        const labels = actions
            .map((action) => action.label || action.id)
            .filter(filterCallback);

        if (labels.length === 0) {
            return msg('errors.followUpFailed');
        }

        const joinedText = {
            actions: labels.join('; '),
        };
        const result = msg('errors.followUpFailedDetails', joinedText);
        return result;
    }

    /**
     * Checks whether the current page has deferred save actions.
     *
     * @param action - Current MediaWiki action.
     * @returns Whether deferred save actions should resume.
     */
    function hasPendingSaveForCurrentPage(action: string): boolean {
        if (!isZhwiki() || action !== 'view') {
            return false;
        }

        if (mw.config.get('wgArticleId') === 0) {
            return false;
        }

        const pageName = getPageName();
        return getPendingSaveData(pageName) != null;
    }

    /**
     * Starts the browser UI using this application's bound ports.
     */
    function startBrowserApplication(): void {
        const currentAction = mw.config.get('wgAction');
        const hasPendingSave = hasPendingSaveForCurrentPage(currentAction);
        logger.debug('startup.route', {
            action: currentAction,
            pendingSave: hasPendingSave,
        });

        if (isEnwikiArticleView()) {
            loadHostModules(mw.loader, [
                'mediawiki.ForeignApi',
                'mediawiki.util',
            ])
                .then(initEnwikiLauncher)
                .catch(reportStartupFailure);
        } else if (hasPendingSave) {
            loadHostModules(mw.loader, [
                'mediawiki.api',
                'mediawiki.ForeignApi',
                'mediawiki.util',
            ])
                .then(runPendingSaveActions)
                .catch(reportStartupFailure);
        } else if (
            isZhwiki() &&
            isZhwikiLauncherPage() &&
            (isEditAction(currentAction) || isMissingPageView())
        ) {
            loadDialogApplication();
        }
    }

    /**
     * Loads the editor dialog's ResourceLoader dependencies.
     */
    function loadDialogApplication(): void {
        loadHostModules(mw.loader, [
            'mediawiki.api',
            'mediawiki.ForeignApi',
            'mediawiki.util',
            'vue',
            '@wikimedia/codex',
        ])
            .then(init)
            .catch(reportStartupFailure);
    }

    /** Reports an asynchronous ResourceLoader/startup failure. */
    function reportStartupFailure(error: unknown): void {
        const message = getErrorMessage(error);
        logger.error('startup.failed', error);
        notifyAction({
            key: 'startup-failed',
            message,
            type: 'error',
        });
    }

    return {
        start: startBrowserApplication,
    };
}
