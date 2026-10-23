/**
 * @file src/vg-stub-creator/app/main.ts
 * Purpose: Composes the browser UI with article and pre-save workflows.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. start
 * 4. createBrowserPorts
 * 5. createMediaWikiClientPorts
 * 6. createFormHistoryPorts
 * 7. getLocalStorage
 * 8. createPreviewPorts
 * 9. getConfiguredPageName
 * 10. createReviewLinkPorts
 * 11. createCategoryPorts
 * 12. createEditingPorts
 * 13. createSaveProgressPorts
 * 14. createSourcePorts
 * 15. createWorkflowPorts
 * 16. createComposedArticleWorkflow
 * 17. runComposedSelectedActions
 * 18. formatPreSaveMessage
 * 19. createZhwikiApiClient
 * 20. projectMovedTitleData
 */

import {
    buildCategoryRows,
    buildFallbackCategoryRows,
    createManualCategoryRow,
    updateCategoryRowCategory,
} from '../platform/mediawiki/categories.ts';
import * as categoryCache from '../platform/browser/storage/category-cache.ts';
import {
    prepareCompanyCategoryText,
    saveCategoryPage,
    saveCompanyCategory,
} from '../platform/mediawiki/category-pages.ts';
import {
    NEW_PAGE_LIST_TITLE,
    registerNewPage,
} from '../platform/mediawiki/new-page-list.ts';
import {
    addTalkPageBanner,
    connectWikidataSitelink,
    createRedirect,
    movePage,
    savePageEdit,
} from '../platform/mediawiki/wiki-writes.ts';
import {
    resolveNavboxTitles,
    resolveReviewedNavboxRows,
} from '../platform/mediawiki/navboxes.ts';
import {
    clearMovedEdit,
    clearPendingSaveData,
    clearPreviewFormData,
    getMovedEdit,
    getPendingSaveData,
    getPreviewFormData,
    setPendingSaveOperationStatus,
    storeMovedEdit,
    storePendingSaveData,
    storePreviewFormData,
} from '../platform/browser/storage/session.ts';
import { createFormHistoryStore } from '../platform/browser/storage/form-history.ts';
import { createReviewLinkSession } from '../platform/browser/storage/review-link-session.ts';
import {
    interceptEditSave,
    readEditSummary,
    readEditText,
    shouldPreserveEditor,
    submitPreviewForm,
    writeEditSummary,
    writeEditText,
} from '../platform/browser/editor.ts';
import { createPreviewController } from '../platform/mediawiki/preview.ts';
import { buildEditSummary } from '../domain/edit-summary.ts';
import { updateMovedTitleText } from '../domain/title-move.ts';
import {
    clearSaveProgress,
    failSaveProgress,
    initializeSaveProgress,
    reportSaveProgressError,
    setSaveProgressStep,
} from '../platform/browser/storage/save-progress-controller.ts';
import { fetchEnwikiMetadata } from '../platform/network/crosswiki.ts';
import {
    createCitationStore,
    fetchSourceReferences,
    prepareManagedCitationRows,
} from '../platform/network/index.ts';
import { fetchSteamNameRows } from '../platform/network/steam-names.ts';
import {
    ZHWIKI_API_URL,
    buildZhwikiCreationUrl,
    readZhwikiActivationForm,
    resolveZhwikiCreationTitle,
} from '../platform/network/zhwiki-activation.ts';
import type {
    BrowserApplicationPorts,
    BrowserApplication,
    CategoryAdapterPorts,
    EditingAdapterPorts,
    MediaWikiClientPorts,
    PreviewAdapterPorts,
    ReviewLinkAdapterPorts,
    SaveProgressAdapterPorts,
    SourceAdapterPorts,
} from './contracts/application.ts';
import {
    createArticleWorkflow,
    flushArticleData,
    getArticleFieldPreview,
    getFormProseSinographs,
} from './workflows/article.ts';
import {
    buildPreSaveActions,
    buildRedirectRows,
    buildRedirectRowsFromTitles,
    buildRedirectTitles,
    getRedirectTitleCheckTitles,
    type PreSaveMessageId,
} from '../domain/pre-save-actions.ts';
import { runSelectedActions } from './workflows/pre-save.ts';
import { fetchExistingPageTitles } from '../platform/mediawiki/page-title-checks.ts';
import { normalizePageTitle } from '../domain/wiki-titles.ts';
import { preparePendingSaveResume } from './workflows/pre-save-checkpoint.ts';
import { saveReviewedArticle } from './workflows/pre-save-write.ts';
import { createBrowserApplication } from './interface.ts';
import { msg } from '../i18n/index.ts';
import {
    createLogger,
    type Logger,
    type LoggerOptions,
} from '../../library/logging/logger.ts';
import { createActionNotifier } from '../platform/mediawiki/notifications.ts';

const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php';
const APPLICATION_KEY = Symbol.for('kanade.vg-stub-creator.startup');

/**
 * Starts the composed VG Stub Creator application.
 */
export function start(): void {
    const runtime = globalThis as typeof globalThis &
        Record<symbol, BrowserApplication | undefined> & {
            vgStubCreatorConfig?: { logging?: LoggerOptions['config'] };
        };
    if (runtime[APPLICATION_KEY] != null) {
        return;
    }
    const logger = createLogger('vg-stub-creator', {
        config: runtime.vgStubCreatorConfig?.logging,
    });
    const ports = createBrowserPorts(logger.child('ui'));
    const application = createBrowserApplication(ports);

    // Claim the page before ResourceLoader begins so simultaneous installations
    // share one UI and one checkpoint coordinator.
    runtime[APPLICATION_KEY] = application;

    try {
        application.start();
    } catch (error) {
        delete runtime[APPLICATION_KEY];
        logger.error('startup.failed', error);
        throw error;
    }
}

/**
 * Composes every browser-facing port.
 *
 * @returns Browser application ports.
 */
function createBrowserPorts(logger: Logger): BrowserApplicationPorts {
    const clients = createMediaWikiClientPorts();
    return {
        categories: createCategoryPorts(),
        clients,
        editing: createEditingPorts(),
        feedback: {
            logger,
            notifyAction: createActionNotifier('vg-stub-creator'),
        },
        history: createFormHistoryPorts(),
        preview: createPreviewPorts(clients),
        reviewLinks: createReviewLinkPorts(),
        saveProgress: createSaveProgressPorts(),
        sources: createSourcePorts(),
        workflows: createWorkflowPorts(),
    };
}

/** Creates MediaWiki API clients at the application boundary. */
function createMediaWikiClientPorts(): MediaWikiClientPorts {
    return {
        createLocalApi: () => new mw.Api(),
        createWikidataApi: () => new mw.ForeignApi(WIKIDATA_API_URL),
    };
}

/** Creates form-history operations bound to local browser storage. */
function createFormHistoryPorts() {
    return createFormHistoryStore(getLocalStorage, {
        temporaryDraft: msg('history.temporaryDraft'),
        untitled: msg('history.untitled'),
    });
}

/** Gets local storage without making availability a startup risk. */
function getLocalStorage(): Storage | undefined {
    try {
        return typeof localStorage === 'undefined' ? undefined : localStorage;
    } catch {
        return undefined;
    }
}

/** Creates MediaWiki preview operations with translated failures. */
function createPreviewPorts(
    clients: MediaWikiClientPorts,
): PreviewAdapterPorts {
    return createPreviewController({
        createApi: clients.createLocalApi,
        getPageName: getConfiguredPageName,
        messages: {
            previewHttp: (status) => msg('errors.previewHttp', { status }),
            previewMissing: msg('errors.previewMissing'),
            unableRead: (title) => msg('errors.unableRead', { title }),
        },
    });
}

/** Reads the current normalized page name for preview context. */
function getConfiguredPageName(): string {
    return mw.config.get('wgPageName').replace(/_/gu, ' ');
}

/** Creates tab-scoped review-link sessions. */
function createReviewLinkPorts(): ReviewLinkAdapterPorts {
    return {
        createSession: () =>
            createReviewLinkSession(function getSessionStorage() {
                return sessionStorage;
            }),
    };
}

/**
 * Composes category adapter ports.
 *
 * @returns Category adapter ports.
 */
function createCategoryPorts(): CategoryAdapterPorts {
    return {
        createCategoryCacheStore: categoryCache.createCategoryCacheStore,
        createManualCategoryRow,
        prepareCompanyCategoryText,
        registerNewPage(api, articleTitle, companyCategories, date) {
            return registerNewPage(
                api,
                articleTitle,
                companyCategories,
                date,
                msg('errors.unableRead', { title: NEW_PAGE_LIST_TITLE }),
            );
        },
        saveCategoryPage,
        saveCompanyCategory,
        updateCategoryRowCategory,
    };
}

/**
 * Composes editing adapter ports.
 *
 * @returns Editing adapter ports.
 */
function createEditingPorts(): EditingAdapterPorts {
    return {
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
        submitPreviewForm() {
            submitPreviewForm(msg('errors.previewFormUnavailable'));
        },
        updateMovedTitleText(text, current, target) {
            return updateMovedTitleText(
                text,
                projectMovedTitleData(current),
                projectMovedTitleData(target),
            );
        },
        writeEditSummary,
        writeEditText(text) {
            writeEditText(text, msg('errors.editorUnavailable'));
        },
    };
}

/**
 * Composes persistent save-progress adapter ports.
 *
 * @returns Save-progress adapter ports.
 */
function createSaveProgressPorts(): SaveProgressAdapterPorts {
    return {
        clearSaveProgress,
        failSaveProgress,
        initializeSaveProgress,
        reportSaveProgressError,
        setSaveProgressStep,
    };
}

/**
 * Composes external source adapter ports.
 *
 * @returns Source adapter ports.
 */
function createSourcePorts(): SourceAdapterPorts {
    return {
        buildZhwikiCreationUrl,
        createCitationStore,
        createZhwikiApiClient,
        fetchEnwikiMetadata,
        fetchSteamNameRows(sourceUrl, citationStore, options) {
            return fetchSteamNameRows(sourceUrl, citationStore, {
                ...options,
                invalidUrlMessage: msg('errors.steamUrl'),
                labels: {
                    japanese: msg('names.japanese'),
                    simplified: msg('names.simplifiedFull'),
                    traditional: msg('names.traditionalFull'),
                },
            });
        },
        prepareManagedCitationRows,
        readZhwikiActivationForm,
        resolveZhwikiCreationTitle,
    };
}

/**
 * Composes article and pre-save workflow ports.
 *
 * @returns Workflow ports.
 */
function createWorkflowPorts(): BrowserApplicationPorts['workflows'] {
    const article = createComposedArticleWorkflow();
    return {
        buildArticleStubFromForm: article.buildStubFromForm,
        buildPreSaveActions(selection, existingRedirectTitles) {
            return buildPreSaveActions(
                selection,
                existingRedirectTitles,
                formatPreSaveMessage,
            );
        },
        buildRedirectRows,
        buildRedirectRowsFromTitles,
        buildRedirectTitles,
        countFormProseSinographs: getFormProseSinographs,
        createArticleData: flushArticleData,
        fetchExistingPageTitles,
        getArticleFieldPlaceholder: article.getArticleFieldPlaceholder,
        getArticleFieldPreview,
        getRedirectTitleCheckTitles,
        prepareCategoryRows: article.prepareCategoryRows,
        prepareNavboxRows: article.prepareNavboxRows,
        preparePendingSaveResume,
        runSelectedActions: runComposedSelectedActions,
        saveReviewedArticle,
    };
}

function createComposedArticleWorkflow() {
    return createArticleWorkflow(
        {
            buildCategoryRows,
            buildFallbackCategoryRows,
            fetchSourceReferences,
            resolveNavboxTitles,
            resolveReviewedNavboxRows,
        },
        {
            enterEnwikiTitle: msg('metadata.enterEnwikiTitle'),
            noWikidataItem: msg('metadata.noWikidataItem'),
        },
    );
}

function runComposedSelectedActions(
    actions: Parameters<typeof runSelectedActions>[0],
    options: Parameters<
        BrowserApplicationPorts['workflows']['runSelectedActions']
    >[1],
) {
    return runSelectedActions(actions, {
        ...options,
        categoryUnavailableMessage: msg('errors.categorySaveUnavailable'),
        writes: {
            addTalkPageBanner,
            connectWikidataSitelink,
            createRedirect,
            movePage,
            savePageEdit,
        },
    });
}

function formatPreSaveMessage(
    id: PreSaveMessageId,
    values?: Record<string, string | number>,
): string {
    return msg(id, values);
}

/**
 * Creates the zhwiki API client after ResourceLoader is available.
 *
 * @returns Cross-wiki MediaWiki client.
 */
function createZhwikiApiClient(): mw.ForeignApi {
    return new mw.ForeignApi(ZHWIKI_API_URL);
}

/** Projects normalized article data onto the stable public title-move contract. */
function projectMovedTitleData(
    data: import('../domain/models.ts').ProcessedArticleData,
) {
    return {
        name: data.form.name,
        leadNameText: data.prose.fragments.sentence1.s1a.titles,
        infoboxText: data.renderers.infobox,
        defaultSortText: data.renderers.defaultSort,
    };
}
