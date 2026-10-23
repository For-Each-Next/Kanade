/**
 * @file src/vg-stub-creator/app/contracts/application.ts
 * Purpose: Declares the browser UI's composition ports.
 *
 * Table of contents:
 * 1. Imports
 * 2. ApplicationFeedbackPorts
 * 3. CategoryReviewRow
 * 4. RedirectReviewRow
 * 5. PageLookupPort
 * 6. MediaWikiApiPort
 * 7. MediaWikiClientPorts
 * 8. ArticleFieldPort
 * 9. GeneratedArticleStub
 * 10. PendingSaveOperationStatus
 * 11. PendingSaveDraft
 * 12. PendingSaveSession
 * 13. PendingSaveResume
 * 14. ReviewedArticleSave
 * 15. MovedEditSession
 * 16. PreviewFormSession
 * 17. SaveProgressState
 * 18. EnwikiMetadata
 * 19. SteamNameRow
 * 20. CategoryCacheStorePort
 * 21. CitationStorePort
 * 22. PreviewAdapterPorts
 * 23. FormHistoryAdapterPorts
 * 24. ReviewLinkSession
 * 25. ReviewLinkAdapterPorts
 * 26. BrowserWorkflowPorts
 * 27. CategoryAdapterPorts
 * 28. EditingAdapterPorts
 * 29. SaveProgressAdapterPorts
 * 30. SourceAdapterPorts
 * 31. BrowserApplicationPorts
 * 32. BrowserApplication
 */

import type { PreSaveExecutionOptions } from '../workflows/pre-save.ts';
import type { EditSummaryMetadata } from '../../domain/edit-summary.ts';
import type { PageTitleMatch } from '../../domain/pre-save-actions.ts';
import type {
    ArticleForm,
    ArticleProcessorOptions,
    PreSaveAction,
    PreSaveExecutionResult,
    ProcessedArticleData,
    SaveProgressStatus,
} from '../../domain/models.ts';
import type { Logger } from '../../../library/logging/logger.ts';
import type { ActionNotifier } from '../../../library/notifications/contracts.ts';

interface ApplicationFeedbackPorts {
    logger: Logger;
    notifyAction: ActionNotifier;
}

export interface CategoryReviewRow {
    category?: string;
    company?: string;
    enabled?: boolean;
    pendingCreation?: {
        englishName?: string;
        wikidataId?: string;
    };
    [field: string]: unknown;
}

interface RedirectReviewRow {
    exists?: boolean;
    title: string;
    [field: string]: unknown;
}

interface PageLookupPort {
    get(params: Record<string, unknown>): PromiseLike<any>;
}

export interface MediaWikiApiPort extends PageLookupPort {
    post(params: Record<string, unknown>): PromiseLike<any>;
    postWithToken(
        token: string,
        params: Record<string, unknown>,
    ): PromiseLike<any>;
}

export interface MediaWikiClientPorts {
    createLocalApi(): mw.Api;
    createWikidataApi(): mw.ForeignApi;
}

interface ArticleFieldPort {
    key: string;
    [field: string]: unknown;
}

interface GeneratedArticleStub {
    articleData: ProcessedArticleData;
    text: string;
}

export type PendingSaveOperationStatus =
    'confirmed' | 'pending' | 'running' | 'uncertain';

export interface PendingSaveDraft {
    actions: PreSaveAction[];
    move: {
        enabled?: boolean;
        leaveRedirect?: boolean;
        to?: unknown;
    };
    progressGroups?: unknown[];
    registration?: { enabled?: boolean };
    title: string;
}

export interface PendingSaveSession {
    actions: PreSaveAction[];
    move: PendingSaveDraft['move'];
    operations: Record<string, PendingSaveOperationStatus>;
    progressGroups?: unknown[];
    registration?: { enabled?: boolean };
    title: string;
    version: 1;
}

export interface PendingSaveResume {
    actions: PreSaveAction[];
    confirmedActions: PreSaveAction[];
    blockedOperationIds: string[];
    move: PendingSaveDraft['move'];
    registration: { enabled?: boolean };
    title: string;
}

export interface ReviewedArticleSave {
    exists: boolean;
    summary: string;
    text: string;
    title: string;
}

export interface MovedEditSession {
    form: ArticleForm;
    preview?: boolean;
    summary?: string;
    summaryMetadata?: EditSummaryMetadata;
    text: string;
    title: string;
}

export interface PreviewFormSession {
    form: ArticleForm;
    title: string;
}

export interface SaveProgressState {
    error: string;
    open?: boolean;
    steps: Array<{
        id: string;
        status: SaveProgressStatus;
        [field: string]: unknown;
    }>;
    title?: string;
    version?: 1;
}

interface EnwikiMetadata {
    metacriticId: string;
    openCriticId: string;
    pageExists: boolean | null;
    steamId: string;
    title: string;
    wikidataId: string;
}

interface SteamNameRow {
    label: string;
    markets: string[];
    name: string;
    official: boolean;
    previewOnly: boolean;
    sourceUrl: string;
}

export interface CategoryCacheStorePort {
    cache: Record<string, unknown>;
    clear(): void;
    save(): void;
}

export interface CitationStorePort {
    fetch(url: string): Promise<string>;
    prefetch(url: string): void;
    refetch(url: string): Promise<string>;
}

export interface PreviewAdapterPorts {
    fetchPageText(title: string): Promise<string>;
    parseArticlePreviewText(text: string, form: ArticleForm): Promise<string>;
    parsePreviewText(text: string, title?: string): Promise<string>;
}

export interface FormHistoryAdapterPorts {
    clearFormHistory(): void;
    deleteFormHistoryEntry(id: string): void;
    readFormDraftEntry(): any | undefined;
    readFormDraftForPage(page: string): any | undefined;
    readFormHistory(): Array<any>;
    saveFormDraft(form: any, page?: string): void;
    saveFormHistory(form: any, page: string, citations?: any): void;
}

export interface ReviewLinkSession {
    claim(): boolean;
}

export interface ReviewLinkAdapterPorts {
    createSession(): ReviewLinkSession;
}

interface BrowserWorkflowPorts {
    buildArticleStubFromForm(
        form: ArticleForm,
        citationStore: CitationStorePort,
        options?: ArticleProcessorOptions,
    ): Promise<GeneratedArticleStub>;
    buildPreSaveActions(
        selection: {
            finalTitle?: string;
            form: ArticleForm;
            title: string;
        },
        existingRedirectTitles?: PageTitleMatch[],
    ): PreSaveAction[];
    buildRedirectRows(
        form: ArticleForm,
        articleTitle: string,
        existingRedirectTitles?: PageTitleMatch[],
    ): RedirectReviewRow[];
    buildRedirectRowsFromTitles(
        titles: string[],
        articleTitle: string,
        existingRedirectTitles?: PageTitleMatch[],
    ): RedirectReviewRow[];
    buildRedirectTitles(form: ArticleForm, articleTitle: string): string[];
    countFormProseSinographs(
        form: ArticleForm,
        options?: ArticleProcessorOptions,
    ): number;
    createArticleData(
        form: ArticleForm,
        options?: ArticleProcessorOptions,
    ): ProcessedArticleData;
    fetchExistingPageTitles(
        api: PageLookupPort,
        titles: string[],
    ): Promise<PageTitleMatch[]>;
    getArticleFieldPlaceholder(
        form: ArticleForm,
        field: ArticleFieldPort,
        options?: ArticleProcessorOptions,
    ): string | undefined;
    getArticleFieldPreview(
        form: ArticleForm,
        previewKey: string,
        options?: ArticleProcessorOptions,
    ): string;
    getRedirectTitleCheckTitles(titles: string[]): string[];
    prepareCategoryRows(
        form: ArticleForm,
        previousRows?: CategoryReviewRow[],
        options?: unknown,
    ): Promise<CategoryReviewRow[]>;
    prepareNavboxRows(
        form: ArticleForm,
        rebuild: boolean,
    ): Promise<Array<Record<string, unknown>>>;
    preparePendingSaveResume(pending: PendingSaveSession): PendingSaveResume;
    runSelectedActions(
        actions: PreSaveAction[],
        options: Omit<
            PreSaveExecutionOptions,
            'writes' | 'categoryUnavailableMessage'
        >,
    ): Promise<PreSaveExecutionResult>;
    saveReviewedArticle(api: mw.Api, save: ReviewedArticleSave): Promise<void>;
}

export interface CategoryAdapterPorts {
    createCategoryCacheStore(page: string): CategoryCacheStorePort;
    createManualCategoryRow(): CategoryReviewRow;
    prepareCompanyCategoryText(
        row: CategoryReviewRow,
        api?: unknown,
    ): Promise<string>;
    registerNewPage(
        api: unknown,
        articleTitle: string,
        companyCategories?: string[],
        date?: Date,
    ): Promise<void>;
    saveCategoryPage(
        category: string,
        text: string,
        summary?: string,
        api?: unknown,
    ): Promise<void>;
    saveCompanyCategory(
        category: string,
        text: string,
        englishCategory?: string,
        options?: unknown,
    ): Promise<void>;
    updateCategoryRowCategory(
        row: CategoryReviewRow,
        category: string,
    ): CategoryReviewRow;
}

export interface EditingAdapterPorts {
    buildEditSummary(metadata: EditSummaryMetadata): string;
    clearMovedEdit(storage?: Storage): void;
    clearPendingSaveData(storage?: Storage): void;
    clearPreviewFormData(storage?: Storage): void;
    getMovedEdit(page: string, storage?: Storage): MovedEditSession | undefined;
    getPendingSaveData(
        page: string,
        storage?: Storage,
    ): PendingSaveSession | undefined;
    getPreviewFormData(
        page: string,
        storage?: Storage,
    ): PreviewFormSession | undefined;
    interceptEditSave(onSubmit: () => unknown): () => void;
    normalizePageTitle(title: unknown): string;
    readEditSummary(): string;
    readEditText(): string;
    shouldPreserveEditor(): boolean;
    setPendingSaveOperationStatus(
        id: string,
        status: PendingSaveOperationStatus,
        storage?: Storage,
    ): PendingSaveSession | undefined;
    storeMovedEdit(pending: MovedEditSession, storage?: Storage): void;
    storePendingSaveData(
        pending: PendingSaveDraft,
        storage?: Storage,
    ): PendingSaveSession;
    storePreviewFormData(
        form: ArticleForm,
        title: string,
        storage?: Storage,
    ): void;
    submitPreviewForm(): void;
    updateMovedTitleText(
        text: string,
        current: ProcessedArticleData,
        target: ProcessedArticleData,
    ): string;
    writeEditSummary(summary: string): void;
    writeEditText(text: string): void;
}

export interface SaveProgressAdapterPorts {
    clearSaveProgress(): void;
    failSaveProgress(error: Error): SaveProgressState | undefined;
    initializeSaveProgress(pending: PendingSaveSession): SaveProgressState;
    reportSaveProgressError(
        error: Error | string,
    ): SaveProgressState | undefined;
    setSaveProgressStep(
        id: string,
        status: SaveProgressStatus,
    ): SaveProgressState | undefined;
}

export interface SourceAdapterPorts {
    buildZhwikiCreationUrl(enwikiTitle: string, targetTitle?: string): string;
    createCitationStore(): CitationStorePort;
    createZhwikiApiClient(): PageLookupPort;
    fetchEnwikiMetadata(
        title: string,
        options?: { fetcher?: typeof fetch },
    ): Promise<EnwikiMetadata>;
    fetchSteamNameRows(
        sourceUrl: string,
        citationStore: CitationStorePort,
        options?: { includeJapanese?: boolean },
    ): Promise<SteamNameRow[]>;
    prepareManagedCitationRows(
        form: ArticleForm,
        citationStore: CitationStorePort,
        options?: { refetchSourceUrls?: string[] },
    ): Promise<Array<Record<string, unknown>>>;
    readZhwikiActivationForm(
        search: string | URLSearchParams,
    ): Pick<ArticleForm, 'enwikiTitle'> | null;
    resolveZhwikiCreationTitle(
        enwikiTitle: string,
        api: PageLookupPort,
    ): Promise<string>;
}

export interface BrowserApplicationPorts {
    categories: CategoryAdapterPorts;
    clients: MediaWikiClientPorts;
    editing: EditingAdapterPorts;
    feedback: ApplicationFeedbackPorts;
    history: FormHistoryAdapterPorts;
    preview: PreviewAdapterPorts;
    reviewLinks: ReviewLinkAdapterPorts;
    saveProgress: SaveProgressAdapterPorts;
    sources: SourceAdapterPorts;
    workflows: BrowserWorkflowPorts;
}

export interface BrowserApplication {
    start(): void;
}
