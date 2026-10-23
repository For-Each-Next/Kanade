/**
 * @file src/vg-stub-creator/domain/models.ts
 * Purpose: Defines article, module, and reviewed save contracts.
 * Contents: Normalized records, form inputs, processing interfaces, and follow-up actions.
 */

/**
 * Shared data contracts for the VG Stub Creator workflow.
 *
 * These records describe values after they cross a package boundary.
 * Raw MediaWiki responses remain adapter-owned. They are normalized
 * before they are assigned to one of these contracts.
 */

/**
 * A citation attached to one or more article fields.
 */
interface SourceReference {
    key: string;
    name: string;
    sourceUrl?: string;
    [property: string]: unknown;
}

/**
 * A source URL field registered by an article module.
 */
interface ArticleSourceField {
    key: string;
    label: string;
    sourceKey: string;
}

/**
 * One normalized value carried by an article data record.
 */
export interface ArticleDataValue {
    displayText: string;
    linkTarget?: string;
    metadata?: Record<string, unknown>;
    normalizedText: string;
    wikitext: string;
    [property: string]: unknown;
}

/**
 * A normalized record emitted by every article module.
 */
export interface ArticleDataRecord {
    assumedCategories: string[];
    assumedStubTags: string[];
    categoryItems: Array<Record<string, unknown>>;
    categoryPlans: Array<Record<string, unknown>>;
    citations: SourceReference[];
    inputText: Record<string, unknown>;
    issues: Array<Record<string, unknown>>;
    key: string;
    metadata: Record<string, any>;
    navboxes: Array<any>;
    normalizedText: Record<string, unknown>;
    sourceUrls: string[];
    values: ArticleDataValue[];
    wikitext: Record<string, any>;
    [property: string]: unknown;
}

/**
 * Mutable dialog values accepted by the article processor.
 *
 * The named fields are the stable workflow surface.
 * Feature-specific review rows remain unknown until normalized.
 */
export interface ArticleForm {
    additionalProse?: string;
    categoryRows?: unknown[];
    citationRows?: unknown[];
    commonNames?: unknown[];
    developers?: string;
    englishName?: string;
    enwikiTitle?: string;
    genres?: string;
    localizedNames?: unknown[];
    metacriticScore?: string;
    name?: string;
    nameAliases?: unknown[];
    navboxRows?: unknown[];
    navboxText?: string;
    noteTaRows?: unknown[];
    officialNames?: unknown[];
    openCriticRecommend?: string;
    originalLanguage?: string;
    originalName?: string;
    pageName?: string;
    platforms?: string;
    publishers?: string;
    redirectRows?: unknown[];
    series?: string;
    sortKey?: string;
    sourceReferences?: SourceReference[];
    stubTagRows?: unknown[];
    wikidataId?: string;
    year?: string;
    [field: string]: unknown;
}

/**
 * Options accepted while normalizing an article form.
 */
export interface ArticleProcessorOptions {
    defaultName?: string;
}

/**
 * Generated prose and its review metadata.
 */
interface ArticleProse {
    fragments: Record<string, any>;
    sinographs: number;
    text: string;
}

/**
 * Complete normalized article data consumed by renderers and review
 * handlers.
 */
export interface ProcessedArticleData {
    form: ArticleForm;
    prose: ArticleProse;
    records: Record<string, ArticleDataRecord>;
    renderers: Record<string, any>;
    sourceReferences: SourceReference[];
    sourceTags: SourceTags;
}

/**
 * Generated reference tags keyed by article field.
 */
export type SourceTags = Record<string, string | undefined>;

/**
 * Aggregate review score values used by prose renderers.
 */
interface AggregateScoreMetadata {
    metacritic: {
        platform: string;
        score: string;
    };
    openCritic: {
        recommend: string;
    };
}

/**
 * Article record containing aggregate review scores.
 */
export interface AggregateScoreRecord {
    metadata: AggregateScoreMetadata;
}

/**
 * Shared services exposed to article modules while they normalize and
 * flush.
 */
export interface ArticleModuleContext {
    defaultName: string;
    getCitations(filters?: {
        keys?: string[];
        prefixes?: string[];
    }): SourceReference[];
    rawForm: ArticleForm;
}

/**
 * Declarative configuration for one article data module.
 */
export interface ArticleModuleDefinition {
    fields?: readonly string[];
    flush?: (...args: any[]) => Record<string, any>;
    formatField?: (...args: any[]) => unknown;
    key: string;
    listFields?: readonly string[];
    normalize?: (...args: any[]) => Record<string, any>;
    sourceFields?: readonly ArticleSourceField[];
}

/**
 * Runtime article module consumed by the processor.
 */
export interface ArticleModule {
    fields: readonly string[];
    flush(
        form: Record<string, any>,
        context: ArticleModuleContext,
    ): ArticleDataRecord;
    formatField(
        key: string,
        value: unknown,
        form: Record<string, any>,
    ): unknown;
    key: string;
    listFields: readonly string[];
    normalize(
        form: Record<string, any>,
        context: ArticleModuleContext,
    ): Record<string, any>;
    sourceFields: readonly ArticleSourceField[];
}

/**
 * Status values persisted for a save-progress step.
 */
export type SaveProgressStatus =
    'complete' | 'failed' | 'pending' | 'running' | 'skipped';

/**
 * Fields shared by every reviewed follow-up action.
 */
interface BasePreSaveAction {
    displayLabel: string;
    id: string;
    label: string;
    pageTitle: string;
    selected: boolean;
}

interface InterwikiAction extends BasePreSaveAction {
    type: 'interwiki';
    wikidataId: string;
}

interface TalkBannerAction extends BasePreSaveAction {
    type: 'talk-banner';
}

interface RedirectAction extends BasePreSaveAction {
    exists: boolean;
    redirectTitle: string;
    targetTitle: string;
    type: 'redirect';
}

interface CategoryAction extends BasePreSaveAction {
    category: string;
    company: string;
    englishName: string;
    text: string;
    type: 'category';
    wikidataId: string;
}

interface PageEditAction extends BasePreSaveAction {
    create: boolean;
    englishName?: string;
    summary: string;
    text: string;
    title: string;
    type: 'page-edit';
}

/**
 * One reviewed operation that may run after the article is saved.
 */
export type PreSaveAction =
    | CategoryAction
    | InterwikiAction
    | PageEditAction
    | RedirectAction
    | TalkBannerAction;

/**
 * Result of executing selected follow-up actions.
 */
export interface PreSaveExecutionResult {
    completed: PreSaveAction[];
    failed: PreSaveAction[];
    title: string;
}
