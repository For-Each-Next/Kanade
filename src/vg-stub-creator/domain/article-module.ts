/**
 * @file src/vg-stub-creator/domain/article-module.ts
 * Purpose: Defines and normalizes article-module records.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. createDataRecord
 * 4. createDataValue
 * 5. defineArticleModule
 * 6. createBlankDataRecord
 * 7. cloneRecordArrays
 * 8. flushModule
 * 9. formatModuleField
 * 10. normalizeModule
 * 11. pickFields
 */

import type {
    ArticleDataRecord,
    ArticleDataValue,
    ArticleModule,
    ArticleModuleContext,
    ArticleModuleDefinition,
} from './models.ts';
import * as wikitext from './wikitext/index.ts';

const { trimValue } = wikitext;

/**
 * Creates the shared named record emitted by every article data module.
 *
 * @param key - Stable module key.
 * @param data - Module-specific record values.
 * @returns Uniform article data record.
 */
function createDataRecord(
    key: string,
    data: Record<string, any> = {},
): ArticleDataRecord {
    const record = createBlankDataRecord(key, data);

    cloneRecordArrays(record);
    record.values = record.values.map(createDataValue);

    if (record.sourceUrls.length === 0) {
        record.sourceUrls = record.citations
            .map((citation) => citation.sourceUrl)
            .filter((url): url is string => Boolean(url));
    }

    return record;
}

/**
 * Creates one normalized value carried by an article data record.
 *
 * @param data - Module-specific value data.
 * @returns Uniform article data value.
 */
function createDataValue(data: Record<string, any> = {}): ArticleDataValue {
    const normalizedText =
        data.normalizedText == null ? '' : String(data.normalizedText);

    return {
        ...data,
        displayText:
            data.displayText == null
                ? normalizedText
                : String(data.displayText),
        linkTarget: data.linkTarget == null ? '' : String(data.linkTarget),
        metadata: data.metadata || {},
        normalizedText,
        wikitext:
            data.wikitext == null ? normalizedText : String(data.wikitext),
    };
}

/**
 * Defines one registered article data module.
 *
 * @param definition - Article module definition.
 * @returns Immutable runtime article module.
 */
export function defineArticleModule(
    definition: ArticleModuleDefinition,
): ArticleModule {
    if (trimValue(definition.key) === '') {
        throw new Error('Article modules require a key.');
    }

    const fields = Object.freeze([...(definition.fields || [])]);
    const listFields = Object.freeze([...(definition.listFields || [])]);
    const sourceFields = Object.freeze([...(definition.sourceFields || [])]);
    const module: ArticleModule = {
        fields,
        flush: flushModule.bind(null, definition, fields),
        formatField: formatModuleField.bind(null, definition),
        key: definition.key,
        listFields,
        normalize: normalizeModule.bind(null, definition),
        sourceFields,
    };

    return Object.freeze(module);
}

/**
 * Creates a data record with independent shared collections.
 *
 * @param key - Key value.
 * @param data - Data value.
 * @returns Created data record with independent shared collections.
 */
function createBlankDataRecord(
    key: string,
    data: Record<string, any>,
): ArticleDataRecord {
    const record = {
        assumedCategories: [],
        assumedStubTags: [],
        categoryItems: [],
        categoryPlans: [],
        citations: [],
        inputText: {},
        issues: [],
        key,
        metadata: {},
        navboxes: [],
        normalizedText: {},
        sourceUrls: [],
        values: [],
        wikitext: {},
        ...data,
    } as ArticleDataRecord;
    return record;
}

/**
 * Clones mutable array values owned by a data record.
 *
 * @param record - Record value.
 */
function cloneRecordArrays(record: ArticleDataRecord): void {
    record.assumedCategories = [...(record.assumedCategories || [])];
    record.assumedStubTags = [...(record.assumedStubTags || [])];
    record.categoryItems = [...(record.categoryItems || [])];
    record.categoryPlans = [...(record.categoryPlans || [])];
    record.citations = [...(record.citations || [])];
    record.issues = [...(record.issues || [])];
    record.navboxes = [...(record.navboxes || [])];
    record.sourceUrls = [...(record.sourceUrls || [])];
    record.values = [...(record.values || [])];
}

/**
 * Builds one module data record.
 *
 * @param definition - Definition value.
 * @param fields - Fields value.
 * @param form - Form value.
 * @param context - Context value.
 * @returns Built module data record.
 */
function flushModule(
    definition: ArticleModuleDefinition,
    fields: readonly string[],
    form: Record<string, any>,
    context: ArticleModuleContext,
): ArticleDataRecord {
    const data = definition.flush?.(form, context) || {};
    const normalizedText = pickFields(form, fields);
    const inputText = pickFields(context.rawForm, fields);

    return createDataRecord(definition.key, {
        inputText,
        normalizedText,
        ...data,
    });
}

/**
 * Formats a live module field.
 *
 * @param definition - Definition value.
 * @param key - Key value.
 * @param value - Value to process.
 * @param form - Form value.
 * @returns Formatted live module field.
 */
function formatModuleField(
    definition: ArticleModuleDefinition,
    key: string,
    value: unknown,
    form: Record<string, any>,
): unknown {
    return definition.formatField?.(key, value, form) ?? value;
}

/**
 * Normalizes one module's form values.
 *
 * @param definition - Definition value.
 * @param form - Form value.
 * @param context - Context value.
 * @returns Normalized module's form values.
 */
function normalizeModule(
    definition: ArticleModuleDefinition,
    form: Record<string, any>,
    context: ArticleModuleContext,
): Record<string, any> {
    return definition.normalize?.(form, context) || {};
}

/**
 * Gets the owned form fields from one form object.
 *
 * @param form - Form value.
 * @param fields - Fields value.
 * @returns Operation result.
 */
function pickFields(
    form: Record<string, any>,
    fields: readonly string[],
): Record<string, unknown> {
    return Object.fromEntries(
        fields
            .filter((field) => Object.hasOwn(form, field))
            .map((field) => [field, form[field]]),
    );
}
