/**
 * @file src/vg-stub-creator/domain/processor.ts
 * Purpose: Normalizes form data and flushes registered article modules.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Exports
 * 4. createArticleData
 * 5. formatArticleFormField
 * 6. isArticleListField
 * 7. getArticleSourceFields
 * 8. normalizeForm
 * 9. buildArticleData
 * 10. createModuleContext
 * 11. getModuleCitations
 * 12. matchesModuleCitation
 * 13. hasCitationPrefix
 * 14. buildSourceReferenceTags
 */

import { buildArticleProse, buildArticleRenderers } from './wiki.ts';
import { ARTICLE_MODULES } from './modules.ts';
import { normalizeArticleFormInput } from './article-input.ts';

import type {
    ArticleForm,
    ArticleModule,
    ArticleModuleContext,
    ArticleProcessorOptions,
    ProcessedArticleData,
} from './models.ts';
import {
    buildReferenceReuseTag,
    nameCitationReferences,
} from './reference-wikitext.ts';
import * as wikitext from './wikitext/index.ts';
const { trimValue } = wikitext;

export {
    completeMetadataFieldValue,
    isCompletableMetadataField,
} from './data.ts';
export type {
    ArticleForm,
    ArticleProcessorOptions,
    ProcessedArticleData,
} from './models.ts';

/**
 * Creates normalized article records and their rendered output.
 *
 * @param form - Raw dialog form values.
 * @param options - Processor options.
 * @param options.defaultName - Fallback article title.
 * @returns Normalized article data.
 */
export function createArticleData(
    form: ArticleForm,
    options: ArticleProcessorOptions = {},
): ProcessedArticleData {
    form = normalizeArticleFormInput(form);
    const sourceReferences = nameCitationReferences(
        form.sourceReferences || [],
    );
    const sourceTags = buildSourceReferenceTags(sourceReferences);
    const contextOptions = {
        ...options,
        rawForm: form,
    };
    const context = createModuleContext(sourceReferences, contextOptions);
    const normalizedForm = normalizeForm(form, context);
    const mapCallback = function callback(
        module: (typeof ARTICLE_MODULES)[number],
    ) {
        const record = module.flush(normalizedForm, context);

        return [module.key, record];
    };
    const mappedValues = ARTICLE_MODULES.map(mapCallback);
    const records = Object.fromEntries(mappedValues);

    const processorInput = {
        form: normalizedForm,
        records,
        sourceReferences,
        sourceTags,
    };
    const articleData = buildArticleData(processorInput);

    return articleData;
}

/**
 * Formats one live form field through its owning article module.
 *
 * @param form - Current form values.
 * @param key - Form field key.
 * @param value - Raw field value.
 * @returns Canonical field value.
 */
export function formatArticleFormField(
    form: any,
    key: string,
    value: any,
): any {
    const findCallback = (item: (typeof ARTICLE_MODULES)[number]) =>
        item.fields.includes(key);
    const module = ARTICLE_MODULES.find(findCallback);

    if (module == null) {
        return trimValue(value);
    }

    return module.formatField(key, value, form);
}

/**
 * Checks whether a registered field accepts multiple list items.
 *
 * @param key - Form field key.
 * @returns Whether the field is a multi-item list.
 */
export function isArticleListField(key: string): boolean {
    const someCallbackA = (module: (typeof ARTICLE_MODULES)[number]) =>
        module.listFields.includes(key);
    return ARTICLE_MODULES.some(someCallbackA);
}

/**
 * Gets static source URL fields declared by registered article modules.
 *
 * @returns Source reference field definitions.
 */
export function getArticleSourceFields(): Array<
    ArticleModule['sourceFields'][number]
> {
    return ARTICLE_MODULES.flatMap((module) => module.sourceFields);
}

/**
 * Normalizes a form through every registered article module.
 *
 * @param form - Raw form values.
 * @param context - Shared module context.
 * @returns Fully normalized form.
 */
function normalizeForm(
    form: ArticleForm,
    context: ArticleModuleContext,
): ArticleForm {
    const reduceCallbackA = function callback(
        normalized: ArticleForm,
        module: (typeof ARTICLE_MODULES)[number],
    ) {
        const result = {
            ...normalized,
            ...module.normalize(normalized, context),
        };
        return result;
    };
    const result = ARTICLE_MODULES.reduce(reduceCallbackA, { ...form });
    return result;
}

/**
 * Builds the complete processed article output.
 *
 * @param input - Processor input.
 * @param input.form - Fully normalized form.
 * @param input.records - Data records keyed by module name.
 * @param input.sourceReferences - Named source
 * references.
 * @param input.sourceTags - Source tags keyed by field.
 * @returns Processed article data.
 */
function buildArticleData(input: {
    form: ArticleForm;
    records: ProcessedArticleData['records'];
    sourceReferences: ProcessedArticleData['sourceReferences'];
    sourceTags: ProcessedArticleData['sourceTags'];
}): ProcessedArticleData {
    const { form, records, sourceReferences, sourceTags } = input;
    return {
        form,
        records,
        prose: buildArticleProse(records, sourceTags),
        renderers: buildArticleRenderers(records, sourceTags),
        sourceReferences,
        sourceTags,
    };
}

/**
 * Creates helpers shared by all article modules.
 *
 * @param sourceReferences - Named source references.
 * @param options - Processor options.
 * @returns Shared part context.
 */
function createModuleContext(
    sourceReferences: ProcessedArticleData['sourceReferences'],
    options: ArticleProcessorOptions & { rawForm: ArticleForm },
): ArticleModuleContext {
    const context = {
        defaultName: trimValue(options.defaultName),
        getCitations: getModuleCitations.bind(null, sourceReferences),
        rawForm: options.rawForm || {},
    };

    return context;
}

/**
 * Gets citations matching exact keys or key prefixes.
 *
 * @param references - References value.
 * @param filters - Filters value.
 * @returns Citations matching exact keys or key prefixes.
 */
function getModuleCitations(
    references: ProcessedArticleData['sourceReferences'],
    filters: { keys?: string[]; prefixes?: string[] } = {},
): ProcessedArticleData['sourceReferences'] {
    const keys = filters.keys || [];
    const prefixes = filters.prefixes || [];
    const boundCallbackA = matchesModuleCitation.bind(null, keys, prefixes);
    return references.filter(boundCallbackA);
}

/**
 * Checks whether one citation matches configured filters.
 *
 * @param keys - Keys value.
 * @param prefixes - Prefixes value.
 * @param reference - Reference value.
 * @returns Whether one citation matches configured filters.
 */
function matchesModuleCitation(
    keys: string[],
    prefixes: string[],
    reference: { key: string },
): boolean {
    const someCallback = (prefix: string) =>
        hasCitationPrefix(reference.key, prefix);
    const result = keys.includes(reference.key) || prefixes.some(someCallback);
    return result;
}

/**
 * Checks whether a citation key starts with one prefix.
 *
 * @param key - Lookup key.
 * @param prefix - Prefix value.
 * @returns Whether a citation key starts with one prefix.
 */
function hasCitationPrefix(key: string, prefix: string): boolean {
    return key.startsWith(prefix);
}

/**
 * Builds source reference tags keyed by article field.
 *
 * @param references - Named source references.
 * @returns Source tags keyed by field.
 */
function buildSourceReferenceTags(references: Array<any>): any {
    const reduceCallback = function callback(
        tags: Record<string, string>,
        reference: any,
    ) {
        const tag = buildReferenceReuseTag(reference.name);

        tags[reference.key] = `${tags[reference.key] || ''}${tag}`;

        return tags;
    };
    const result = references.reduce(
        reduceCallback,
        {} as Record<string, string>,
    );
    return result;
}
