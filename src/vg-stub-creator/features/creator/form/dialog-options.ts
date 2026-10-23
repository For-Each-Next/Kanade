/**
 * @file src/vg-stub-creator/features/creator/form/dialog-options.ts
 * Purpose: Defines the creator dialog's injected application capabilities.
 *
 * Table of contents:
 * 1. Imports
 * 2. DialogOperationState
 * 3. DialogPreview
 * 4. DialogPreSavePlan
 * 5. DialogSubmission
 * 6. CreatorDialogOptions
 */

import type {
    BrowserApplicationPorts,
    CategoryReviewRow,
    PendingSaveDraft,
    ReviewLinkSession,
} from '../../../app/contracts/application.ts';
import type {
    ArticleForm,
    SaveProgressStatus,
} from '../../../domain/models.ts';
import type { PageTitleMatch } from '../../../domain/pre-save-actions.ts';

interface DialogOperationState {
    error: string;
    loading: boolean;
}

export interface DialogPreview {
    html: string;
    summary: string;
    text: string;
}

type DialogPreSavePlan = Pick<PendingSaveDraft, 'actions' | 'move'>;

interface DialogSubmission extends Omit<PendingSaveDraft, 'title'> {
    progress?: {
        fail(error: unknown): void;
        report(error: unknown): void;
        set(id: string, status: SaveProgressStatus): void;
        start(title: string, pending: PendingSaveDraft): void;
    };
}

/** Current dialog options; form imports remain untrusted until restoration normalizes them. */
export interface CreatorDialogOptions {
    currentTitle: string;
    defaultName: string;
    currentPageExists: boolean;
    initialForm?: unknown;
    initialOpen?: boolean;
    initialEnwikiLookup?: boolean;
    citationPrefetchDelay?: number;
    createReviewLinkSession(): ReviewLinkSession;
    getPageUrl(title: string): string;
    getHistoryEntries(): unknown[];
    getFieldPlaceholder: BrowserApplicationPorts['workflows']['getArticleFieldPlaceholder'];
    getFieldPreview(form: ArticleForm, previewKey: string): string;
    getProseSinographs(form: ArticleForm): number;
    getProseWikitext(form: ArticleForm): string;
    onActivate(): void;
    onClearHistory(): void;
    onDeleteHistoryEntry: BrowserApplicationPorts['history']['deleteFormHistoryEntry'];
    onFormChange(form: ArticleForm): void;
    onSubmitHistory(form: ArticleForm, title: string): void;
    onCreateCategoryRow: BrowserApplicationPorts['categories']['createManualCategoryRow'];
    onCategoryRowsRefresh(
        form: ArticleForm & { categoryRows: CategoryReviewRow[] },
        state: DialogOperationState,
        options: {
            bypassCache?: boolean;
            recheck?: boolean;
            resetStubTags?: boolean;
        },
    ): Promise<void>;
    onMoveTarget(
        form: ArticleForm,
        title: string,
        state: DialogOperationState,
    ): Promise<void>;
    onPrepareCompanyCategory: BrowserApplicationPorts['categories']['prepareCompanyCategoryText'];
    onUpdateCategoryRowCategory: BrowserApplicationPorts['categories']['updateCategoryRowCategory'];
    onCheckPageTitle(title: string): Promise<PageTitleMatch>;
    onCheckRedirectRows(
        rows: Array<{ title: string }>,
        title: string,
    ): Promise<
        ReturnType<BrowserApplicationPorts['workflows']['buildRedirectRows']>
    >;
    onPrepareRedirectRows(
        form: ArticleForm,
        title: string,
    ): Promise<
        ReturnType<BrowserApplicationPorts['workflows']['buildRedirectRows']>
    >;
    onPrepareReview: BrowserApplicationPorts['workflows']['prepareNavboxRows'];
    onFetchPageText: BrowserApplicationPorts['preview']['fetchPageText'];
    onParseArticlePreview: BrowserApplicationPorts['preview']['parseArticlePreviewText'];
    onParsePreview: BrowserApplicationPorts['preview']['parsePreviewText'];
    onPreview(
        form: ArticleForm,
        state: DialogOperationState,
    ): Promise<DialogPreview | undefined>;
    onEnwikiTitleChange: BrowserApplicationPorts['sources']['fetchEnwikiMetadata'];
    onPrepareCitations(
        form: ArticleForm,
        options?: { refetchSourceUrls?: string[] },
    ): ReturnType<
        BrowserApplicationPorts['sources']['prepareManagedCitationRows']
    >;
    onPreSavePrepare(
        form: ArticleForm & { redirectRows: Array<{ title: string }> },
        title: string,
    ): Promise<DialogPreSavePlan>;
    onSourceUrlChange(url: string): void;
    onSteamNamesFetch(
        url: string,
        options?: { includeJapanese?: boolean },
    ): ReturnType<BrowserApplicationPorts['sources']['fetchSteamNameRows']>;
    onSubmit(
        form: ArticleForm,
        state: DialogOperationState,
        closeDialog: () => void,
        pending: DialogSubmission,
        preview?: Pick<DialogPreview, 'summary' | 'text'>,
    ): Promise<void>;
}
