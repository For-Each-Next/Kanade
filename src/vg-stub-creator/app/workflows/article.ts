/**
 * @file src/vg-stub-creator/app/workflows/article.ts
 * Purpose: Coordinates article form data, review handlers, and final wikitext.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. ArticleWorkflowPorts
 * 4. ArticleWorkflowMessages
 * 5. ArticleWorkflow
 * 6. createArticleWorkflow
 * 7. flushArticleData
 * 8. buildStubText
 * 9. buildStubFromForm
 * 10. buildStubTextFromForm
 * 11. prepareNavboxRows
 * 12. prepareCategoryRows
 * 13. getArticleFieldPreview
 * 14. getArticleFieldPlaceholder
 * 15. getFormProseSinographs
 * 16. getFormNavboxText
 * 17. getConfiguredNavboxTitles
 * 18. isTerminologyNavboxRecord
 * 19. getRecordNavboxes
 * 20. resolveGeneratedNavboxTitles
 * 21. prepareWikitextData
 * 22. requireArticleWorkflowPorts
 * 23. requireArticleWorkflowMessages
 * 24. buildAttributionPreviewText
 */

import * as processor from '../../domain/processor.ts';
import { normalizeArticleFormInput } from '../../domain/article-input.ts';
import type { ProcessedArticleData } from '../../domain/models.ts';
import {
    buildArticleWikitext,
    buildDefaultSortKey,
    buildNavboxText,
    buildReviewedNavboxText,
    buildSentence1Text,
    formatText,
    sortCategoryRowsByProse,
} from '../../domain/wiki.ts';
import * as wikitext from '../../domain/wikitext/index.ts';
const { trimValue } = wikitext;

export interface ArticleWorkflowPorts {
    buildCategoryRows(
        articleData: any,
        previousRows: Array<any>,
        options: any,
    ): Promise<Array<any>>;
    buildFallbackCategoryRows(articleData: any): Array<any>;
    fetchSourceReferences(form: any, citationStore: any): Promise<any>;
    resolveNavboxTitles(series: string, options?: any): Promise<Array<string>>;
    resolveReviewedNavboxRows(
        values: Array<any>,
        options?: any,
    ): Promise<Array<any>>;
}

export interface ArticleWorkflowMessages {
    enterEnwikiTitle: string;
    noWikidataItem: string;
}

export interface ArticleWorkflow {
    buildStubFromForm(
        form: any,
        citationStore: any,
        options?: any,
    ): Promise<any>;
    buildStubTextFromForm(
        form: any,
        citationStore: any,
        options?: any,
    ): Promise<string>;
    getArticleFieldPlaceholder(
        form: any,
        field: any,
        options?: any,
    ): string | undefined;
    prepareCategoryRows(
        form: any,
        previousRows?: Array<any>,
        options?: any,
    ): Promise<Array<any>>;
    prepareNavboxRows(form: any, rebuild: boolean): Promise<Array<any>>;
}

export function createArticleWorkflow(
    ports: ArticleWorkflowPorts,
    messages: ArticleWorkflowMessages,
): ArticleWorkflow {
    return {
        buildStubFromForm(form, citationStore, options) {
            return buildStubFromForm(form, citationStore, options, ports);
        },
        buildStubTextFromForm(form, citationStore, options) {
            return buildStubTextFromForm(form, citationStore, options, ports);
        },
        getArticleFieldPlaceholder(form, field, options) {
            return getArticleFieldPlaceholder(form, field, options, messages);
        },
        prepareCategoryRows(form, previousRows, options) {
            return prepareCategoryRows(form, previousRows, options, ports);
        },
        prepareNavboxRows(form, rebuild) {
            return prepareNavboxRows(form, rebuild, ports);
        },
    };
}

/**
 * Builds normalized article data from raw form values.
 *
 * @param form - Raw dialog form values.
 * @param options - Article builder options.
 * @param options.defaultName - Fallback article title.
 * @returns Normalized article data.
 */
export function flushArticleData(
    form: any,
    options: any = {},
): ProcessedArticleData {
    const articleData = processor.createArticleData(form, options);

    return articleData;
}

/**
 * Builds final article wikitext from normalized article data.
 *
 * @param articleData - Normalized article data.
 * @returns Generated Chinese Wikipedia wikitext.
 */
export function buildStubText(
    articleData: ProcessedArticleData,
    buildFallbackCategoryRows: (data: any) => Array<any> = () => [],
): string {
    const wikitextData = prepareWikitextData(
        articleData,
        buildFallbackCategoryRows,
    );
    const text = buildArticleWikitext(wikitextData);

    return text;
}

/**
 * Builds final article text and processed data from a form.
 *
 * @param form - Dialog form values.
 * @param citationStore - Citation fetch/cache store.
 * @param options - Article builder options.
 * @param options.defaultName - Fallback article title.
 * @returns Generated text and article data.
 */
async function buildStubFromForm(
    form: any,
    citationStore: any,
    options: any = {},
    ports?: ArticleWorkflowPorts,
): Promise<any> {
    const dependencies = requireArticleWorkflowPorts(ports);
    form = normalizeArticleFormInput(form);
    const [sourceReferences, navboxText] = await Promise.all([
        dependencies.fetchSourceReferences(form, citationStore),
        getFormNavboxText(form, dependencies),
    ]);
    const articleData = flushArticleData(
        {
            ...form,
            navboxText,
            sourceReferences,
        },
        options,
    );

    const result = {
        articleData,
        text: buildStubText(
            articleData,
            dependencies.buildFallbackCategoryRows,
        ),
    };

    return result;
}

/**
 * Builds final article text from a form.
 *
 * @param form - Dialog form values.
 * @param citationStore - Citation fetch/cache store.
 * @param options - Article builder options.
 * @returns Generated article wikitext.
 */
async function buildStubTextFromForm(
    form: any,
    citationStore: any,
    options: any = {},
    ports?: ArticleWorkflowPorts,
): Promise<string> {
    return (await buildStubFromForm(form, citationStore, options, ports)).text;
}

/**
 * Builds or resolves editable navbox review rows.
 *
 * @param form - Dialog form values.
 * @param rebuild - Whether to regenerate from the series
 * field.
 * @returns Resolved navbox rows.
 */
async function prepareNavboxRows(
    form: any,
    rebuild: boolean,
    ports?: ArticleWorkflowPorts,
): Promise<Array<any>> {
    const dependencies = requireArticleWorkflowPorts(ports);
    const configuredTitles = getConfiguredNavboxTitles(form);
    let shouldGenerate = rebuild;

    if (!shouldGenerate) {
        if (!Array.isArray(form.navboxRows)) {
            shouldGenerate = true;
        } else if (form.navboxRows.length === 0) {
            const hasSeries = trimValue(form.series) !== '';
            shouldGenerate = hasSeries || configuredTitles.length > 0;
        }
    }
    const titles = shouldGenerate
        ? await resolveGeneratedNavboxTitles(
              form.series,
              configuredTitles,
              dependencies,
          )
        : [];
    const values = shouldGenerate
        ? buildNavboxText(titles).split('\n').filter(Boolean)
        : form.navboxRows;

    return dependencies.resolveReviewedNavboxRows(values);
}

/**
 * Handles prepare category rows.
 *
 * Sends article metadata through the category handler for interface
 * review.
 *
 * @param form - Current form values.
 * @param previousRows - Existing reviewed category
 * rows.
 * @param options - Workflow options.
 * @param options.article - Raw article-data options.
 * @param options.categories - Category resolver options.
 * @returns Reviewed category rows.
 */
async function prepareCategoryRows(
    form: any,
    previousRows: Array<any> = [],
    options: any = {},
    ports?: ArticleWorkflowPorts,
): Promise<Array<any>> {
    const dependencies = requireArticleWorkflowPorts(ports);
    const articleForm = {
        ...form,
        categoryRows: [],
    };
    const articleData = flushArticleData(articleForm, options.article || {});
    const rows = await dependencies.buildCategoryRows(
        articleData,
        previousRows,
        options.categories || {},
    );

    return sortCategoryRowsByProse(rows, articleData.prose.text);
}

/**
 * Gets a live generated fragment for one preview group.
 *
 * @param form - Dialog form values.
 * @param key - Preview group key.
 * @param options - Article builder options.
 * @returns Preview wikitext, or an empty string.
 */
export function getArticleFieldPreview(
    form: any,
    key: string,
    options: any = {},
): string {
    try {
        const articleData = flushArticleData(form, options);

        if (key === 'names') {
            return articleData.records.names.wikitext.leadName;
        }

        if (key === 'score') {
            return articleData.prose.fragments.sentence3;
        }

        if (key === 'attribution') {
            return buildAttributionPreviewText(articleData);
        }

        return '';
    } catch (_error) {
        return '';
    }
}

/**
 * Gets generated placeholder text for one form field.
 *
 * @param form - Dialog form values.
 * @param field - Dialog field definition.
 * @param field.key - Form field key.
 * @param options - Article builder options.
 * @param options.defaultName - Fallback article title.
 * @returns Placeholder text.
 */
function getArticleFieldPlaceholder(
    form: any,
    field: any,
    options: any = {},
    messages?: ArticleWorkflowMessages,
): string | undefined {
    if (field.key === 'name') {
        return options.defaultName;
    }

    if (field.key === 'wikidataId') {
        const labels = requireArticleWorkflowMessages(messages);
        return trimValue(form.enwikiTitle) === ''
            ? labels.enterEnwikiTitle
            : labels.noWikidataItem;
    }

    if (field.key !== 'sortKey') {
        return undefined;
    }

    const normalized = flushArticleData(form, options).form;

    const result = buildDefaultSortKey({
        english: normalized.englishName,
        original: normalized.originalName,
        title: normalized.name,
    });
    return result;
}

/**
 * Counts generated prose from current form values.
 *
 * @param form - Dialog form values.
 * @param options - Article builder options.
 * @returns Hanzi-equivalent sinograph count.
 */
export function getFormProseSinographs(form: any, options: any = {}): number {
    return flushArticleData(form, options).prose.sinographs;
}

/**
 * Gets reviewed navbox text or generates it from the series field.
 *
 * @param form - Dialog form values.
 * @returns Navbox wikitext.
 */
async function getFormNavboxText(
    form: any,
    ports: ArticleWorkflowPorts,
): Promise<string> {
    if (!Array.isArray(form.navboxRows)) {
        const configuredNavboxTitlesResult = getConfiguredNavboxTitles(form);
        const titles = await resolveGeneratedNavboxTitles(
            form.series,
            configuredNavboxTitlesResult,
            ports,
        );
        const text = buildNavboxText(titles);

        return text;
    }

    return buildReviewedNavboxText(form.navboxRows);
}

/**
 * Gets navboxes declared by terminology-backed article parts.
 *
 * @param form - Raw dialog form values.
 * @returns Unique configured template titles.
 */
function getConfiguredNavboxTitles(form: any): Array<string> {
    const flushArticleDataResult = flushArticleData(form).records;
    const records: Array<any> = Object.values(flushArticleDataResult);
    const titles = records
        .filter(isTerminologyNavboxRecord)
        .flatMap(getRecordNavboxes);

    return [...new Set(titles)];
}

/**
 * Checks whether a part can contribute configured navboxes.
 *
 * @param record - Universal article part.
 * @returns Whether this is a non-review part.
 */
function isTerminologyNavboxRecord(record: any): boolean {
    return record.key !== 'review';
}

/**
 * Gets configured navboxes from one universal article part.
 *
 * @param record - Universal article part.
 * @returns Configured template titles.
 */
function getRecordNavboxes(record: any): Array<string> {
    return record.navboxes || [];
}

/**
 * Combines configured navboxes with resolved series templates.
 *
 * @param series - Raw series field value.
 * @param configuredTitles - Titles supplied by article parts.
 * @returns Unique generated template titles.
 */
async function resolveGeneratedNavboxTitles(
    series: string,
    configuredTitles: Array<string>,
    ports: ArticleWorkflowPorts,
): Promise<Array<string>> {
    const seriesTitles = await ports.resolveNavboxTitles(series);

    return [...new Set([...configuredTitles, ...seriesTitles])];
}

/**
 * Supplies fallback review data before invoking pure wikitext builders.
 *
 * @param articleData - Normalized article data.
 * @returns Wikitext-ready article data.
 */
function prepareWikitextData(
    articleData: ProcessedArticleData,
    buildFallbackCategoryRows: (data: any) => Array<any>,
): ProcessedArticleData {
    const review = articleData.records.review;
    const categoryRows =
        review.metadata.categoryRows.length > 0
            ? review.metadata.categoryRows
            : buildFallbackCategoryRows(articleData);
    const result = {
        ...articleData,
        records: {
            ...articleData.records,
            review: {
                ...review,
                metadata: { ...review.metadata, categoryRows },
            },
        },
    };

    return result;
}

function requireArticleWorkflowPorts(
    ports?: ArticleWorkflowPorts,
): ArticleWorkflowPorts {
    if (ports == null) {
        throw new Error('Article workflow ports were not composed.');
    }
    return ports;
}

function requireArticleWorkflowMessages(
    messages?: ArticleWorkflowMessages,
): ArticleWorkflowMessages {
    if (messages == null) {
        throw new Error('Article workflow messages were not composed.');
    }
    return messages;
}

/**
 * Builds combined generated prose for the attribution preview.
 *
 * @param articleData - Normalized article data.
 * @returns Attribution preview wikitext.
 */
function buildAttributionPreviewText(articleData: any): string {
    const fragments = articleData.prose.fragments;
    const sentence1 = fragments.sentence1;

    if (sentence1.s1a.yearGenre === '') {
        return fragments.sentence2;
    }

    const sentence1a = formatText('prose.sentence1a', {
        titles: '……',
        yearGenre: sentence1.s1a.yearGenre,
    });
    const previewSentence1 = buildSentence1Text(sentence1a, sentence1.s1b);
    const preview = `${previewSentence1}${fragments.sentence2}`;

    return preview;
}
