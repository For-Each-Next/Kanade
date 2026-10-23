/**
 * @file src/vg-stub-creator/platform/mediawiki/categories.ts
 * Purpose: Builds category review rows from terminology and wiki evidence.
 * Contents: Category discovery, redirects, plans, and manual rows.
 */

import * as terminologies from '../../domain/terminologies/index.ts';
import {
    normalizeTitleKey,
    resolvePageTitles,
    stripNamespace,
} from './title-resolver.ts';
import { sortCategoryRowsByProse } from '../../domain/wiki.ts';
import * as wikitext from '../../domain/wikitext/index.ts';
const { trimValue, uniqueValues } = wikitext;

const CATEGORY_NAMESPACE = 14;
const CATEGORY_REDIRECT_PROPS = [
    'category_redirect_target',
    'categoryredirect',
    'category_redirect',
];
const CATEGORY_STATUS = {
    exists: 'OK',
    missing: 'Not exists',
    unchecked: '',
};
const LEGACY_MANUAL_CATEGORY_SOURCE = 'manual added';
const MODIFIED_SOURCE_SUFFIX = ' †';
const SOURCE_DATA = 'known';
const SOURCE_FETCH = 'found';
const SOURCE_FITTING = 'suggested';
const SOURCE_MANUAL = 'manual';

/**
 * Creates a blank manual category review row.
 *
 * @returns Category review row.
 */
export function createManualCategoryRow(): any {
    const result = createCategoryRow({
        source: SOURCE_MANUAL,
    });
    return result;
}

/**
 * Updates an editable category title and refreshes its source marker.
 *
 * @param row - Category review row.
 * @param category - New category title.
 * @returns Updated category review row.
 */
export function updateCategoryRowCategory(row: any, category: string): any {
    const result = normalizeCategoryRow({
        ...row,
        category,
    });
    return result;
}

/**
 * Builds category review rows from form values and article metadata.
 *
 * @param params - Normalized article parameters.
 * @param previousRows - Existing category rows.
 * @param options - API options.
 * @param options.fetcher - Fetch implementation.
 * @param options.cache - Resolution cache keyed by category
 * title.
 * @returns Category review rows.
 */
export async function buildCategoryRows(
    params: any,
    previousRows: Array<any> = [],
    options: any = {},
): Promise<Array<any>> {
    const generatedRows = await buildGeneratedCategoryRows(params, options);
    const mergedGeneratedRows = mergePreviousGeneratedRows(
        generatedRows,
        previousRows,
    );
    const resolvedGeneratedRows = await resolveCheckableCategoryRows(
        mergedGeneratedRows,
        options,
    );
    const manualRows = getManualCategoryRows(previousRows);
    const resolvedManualRows = await resolveCategoryRows(manualRows, options);
    const rows = [
        ...resolvedGeneratedRows,
        ...enrichManualCategoryRows(resolvedManualRows, resolvedGeneratedRows),
    ];

    const normalizedRows = rows.map(normalizeCategoryRow);
    const uniqueRows = uniqueCategoryRows(normalizedRows);
    const result = sortRowsByArticleProse(uniqueRows, params);
    return result;
}

/**
 * Builds fallback category review rows from article metadata.
 *
 * @param params - Normalized article parameters.
 * @returns Category review rows.
 */
export function buildFallbackCategoryRows(params: any): Array<any> {
    const metadata = getArticleCategoryMetadata(params);
    const rows = [
        ...buildFallbackRoleRows(metadata.companies),
        ...buildFallbackRoleRows(metadata.platform),
        ...buildSourceCategoryRows(SOURCE_DATA, metadata.release.categories, {
            stubTagEnabled: true,
            stubTags: metadata.release.stubTags,
        }),
    ];
    const normalizedRows = rows.map(normalizeCategoryRow);
    const normalized = uniqueCategoryRows(normalizedRows);

    return sortRowsByArticleProse(normalized, params);
}

/**
 * Builds fallback rows for one article metadata role.
 *
 * @param metadata - Article metadata.
 * @returns Fallback rows for one article metadata role.
 */
function buildFallbackRoleRows(metadata: {
    assumedCategories: string[];
    categories: string[];
    assumedStubTags: string[];
    stubTags: string[];
}): Array<unknown> {
    const result = buildSourceCategoryRows(
        SOURCE_DATA,
        metadata.assumedCategories || metadata.categories,
        {
            stubTagEnabled: true,
            stubTags: metadata.assumedStubTags || metadata.stubTags,
        },
    );
    return result;
}

/**
 * Resolves category rows through the MediaWiki API.
 *
 * @param rows - Category rows.
 * @param options - API options.
 * @param options.fetcher - Fetch implementation.
 * @param options.cache - Resolution cache keyed by category
 * title.
 * @returns Resolved category rows.
 */
async function resolveCategoryRows(
    rows: Array<any>,
    options: any = {},
): Promise<Array<any>> {
    const normalizedRows = rows.map(normalizeCategoryRow);
    const categoryTitles = normalizedRows
        .map((row) => row.category)
        .filter(Boolean);
    const categories = uniqueValues(categoryTitles);

    if (categories.length === 0) {
        return normalizedRows;
    }

    const resolutions = await resolveCategories(categories, options);

    const resolveRow = function resolveRow(row: any) {
        const categoryKey = normalizeCategoryKey(row.category);
        const resolution = resolutions[categoryKey];
        const values = {
            ...row,
            category: resolution?.category || row.category,
            enabled: getResolvedCategoryEnabled(row, resolution),
            status: resolution?.status || CATEGORY_STATUS.unchecked,
        };
        const result = normalizeCategoryRow(values);
        return result;
    };
    const result = normalizedRows.map(resolveRow);
    return result;
}

/**
 * Builds generated category rows.
 *
 * @param params - Normalized article parameters.
 * @param options - API options.
 * @returns Generated category rows.
 */
async function buildGeneratedCategoryRows(
    params: any,
    options: any,
): Promise<Array<any>> {
    const metadata = getArticleCategoryMetadata(params);
    const companyRows = buildCategoryItems(metadata.companies.categoryItems, {
        source: SOURCE_DATA,
    });
    const seriesRows = (metadata.series.categoryPlans || []).map(
        createCategoryPlan,
    );
    const metadataRows = buildGeneratedMetadataRows(metadata);
    const candidates = getGeneratedCategoryCandidates(
        companyRows,
        seriesRows,
        metadataRows,
    );
    const resolutions = await resolveCategories(candidates, options);

    const result = [
        ...resolveCategoryPlans(companyRows, resolutions),
        ...resolveCategoryPlans(seriesRows, resolutions),
        ...applyCategoryResolutions(metadataRows, resolutions),
    ];
    return result;
}

/**
 * Builds generated platform and release category rows.
 *
 * @param metadata - Article metadata.
 * @returns Generated platform and release category rows.
 */
function buildGeneratedMetadataRows(metadata: {
    platform: {
        assumedCategories: string[];
        categories: string[];
        count: number;
        assumedStubTags: string[];
        stubTags: string[];
    };
    release: { categories: string[]; stubTags: string[] };
}): Array<{ category: string }> {
    const platformRows = buildSourceCategoryRows(
        SOURCE_DATA,
        metadata.platform.assumedCategories || metadata.platform.categories,
        {
            stubTagEnabled: metadata.platform.count === 1,
            stubTags:
                metadata.platform.assumedStubTags || metadata.platform.stubTags,
        },
    );
    const releaseRows = buildSourceCategoryRows(
        SOURCE_DATA,
        metadata.release.categories,
        { stubTagEnabled: true, stubTags: metadata.release.stubTags },
    );

    return [...platformRows, ...releaseRows];
}

/**
 * Gets unique category candidates needed by generated rows.
 *
 * @param companies - Companies value.
 * @param series - Series value.
 * @param metadata - Article metadata.
 * @returns Unique category candidates needed by generated rows.
 */
function getGeneratedCategoryCandidates(
    companies: unknown[],
    series: unknown[],
    metadata: Array<{ category: string }>,
) {
    const candidates = [
        ...companies.flatMap(getCategoryPlanCandidates),
        ...series.flatMap(getCategoryPlanCandidates),
        ...metadata.map((row) => row.category),
    ].filter(Boolean);

    return uniqueValues(candidates);
}

/**
 * Gets category metadata from normalized article records.
 *
 * @param params - Normalized processed article data.
 * @returns Category metadata grouped by owning part.
 */
function getArticleCategoryMetadata(params: any): any {
    return getRecordArticleCategoryMetadata(params.records);
}

/**
 * Gets category metadata from article data records.
 *
 * @param records - Records value.
 * @returns Category metadata from article data records.
 */
function getRecordArticleCategoryMetadata(records: {
    companies: unknown;
    platform: Record<string, unknown> & { metadata: { count: number } };
    genre: { assumedCategories: string[]; assumedStubTags: string[] };
    year: { assumedCategories: string[]; assumedStubTags: string[] };
    series: unknown;
}): unknown {
    const result = {
        companies: records.companies,
        platform: {
            ...records.platform,
            count: records.platform.metadata.count,
        },
        release: {
            categories: uniqueValues([
                ...records.genre.assumedCategories,
                ...records.year.assumedCategories,
            ]),
            stubTags: uniqueValues([
                ...records.genre.assumedStubTags,
                ...records.year.assumedStubTags,
            ]),
        },
        series: records.series,
    };
    return result;
}

/**
 * Handles sort rows by article prose.
 *
 * Sorts category rows by their first related mention in generated
 * prose.
 *
 * @param rows - Category review rows.
 * @param params - Normalized processed article data.
 * @returns Prose-ordered category rows.
 */
function sortRowsByArticleProse(rows: Array<any>, params: any): Array<any> {
    return sortCategoryRowsByProse(rows, params.prose?.text || '');
}

/**
 * Builds rows for one generated category source.
 *
 * @param source - Category source label.
 * @param categories - Category titles.
 * @param options - Stub tag options.
 * @param options.stubTagEnabled - Whether stub tags default
 * on.
 * @param options.stubTags - Corresponding stub tags.
 * @returns Category rows.
 */
function buildSourceCategoryRows(
    source: string,
    categories: Array<string>,
    options: any = {},
): Array<any> {
    const createRow = function createRow(category: string, index: number) {
        const stubTag = options.stubTags?.[index] || '';

        const values = {
            category,
            source,
            stubTag,
            stubTagEnabled: Boolean(options.stubTagEnabled && stubTag),
        };
        const result = createCategoryRow(values);
        return result;
    };
    const result = (categories || []).map(createRow);
    return result;
}

/**
 * Builds category rows and lookup plans from sector category items.
 *
 * @param items - Sector category rows or lookup plans.
 * @param options - Category row options.
 * @param options.source - Category row source label.
 * @returns Category rows or lookup plans.
 */
function buildCategoryItems(
    items: Array<any> = [],
    options: any = {},
): Array<any> {
    const buildItem = function buildItem(item: any) {
        if (Array.isArray(item.candidates)) {
            return createCategoryPlan(item);
        }

        const result = createCategoryRow({
            source: options.source,
            ...item,
        });
        return result;
    };
    const result = items.map(buildItem);
    return result;
}

/**
 * Creates one generated category lookup plan.
 *
 * @param values - Plan values.
 * @param values.candidates - Candidate category titles.
 * @param values.fallback - Fallback category title.
 * @returns Category lookup plan.
 */
function createCategoryPlan(values: any): any {
    const result = {
        candidates: uniqueValues(values.candidates || []),
        company: values.company || '',
        fallback: values.fallback,
    };
    return result;
}

/**
 * Gets candidate titles from generated rows and lookup plans.
 *
 * @param item - Category row or lookup plan.
 * @returns Candidate category titles.
 */
function getCategoryPlanCandidates(item: any): Array<string> {
    if (Array.isArray(item.candidates)) {
        return item.candidates;
    }

    return item.category ? [item.category] : [];
}

/**
 * Materializes generated lookup plans using pre-fetched resolutions.
 *
 * @param items - Category rows and lookup plans.
 * @param resolutions - Category resolutions keyed by title.
 * @returns Category rows.
 */
function resolveCategoryPlans(items: Array<any>, resolutions: any): Array<any> {
    const resolvePlan = function resolvePlan(item: any) {
        if (!Array.isArray(item.candidates)) {
            return applyCategoryResolution(item, resolutions);
        }

        const resolveCandidate = function resolveCandidate(candidate: string) {
            return resolutions[normalizeCategoryKey(candidate)];
        };
        const resolution = item.candidates
            .map(resolveCandidate)
            .find(function findExisting(candidateResolution: {
                exists: boolean;
            }) {
                return candidateResolution?.exists;
            });

        if (resolution != null) {
            const result = createCategoryRow({
                category: resolution.category,
                company: item.company,
                source: SOURCE_FETCH,
                status: resolution.status,
            });
            return result;
        }

        const result = createCategoryRow({
            category: item.fallback,
            company: item.company,
            enabled: false,
            source: SOURCE_FITTING,
            status: CATEGORY_STATUS.unchecked,
        });
        return result;
    };
    const result = items.map(resolvePlan);
    return result;
}

/**
 * Applies pre-fetched resolutions to category rows.
 *
 * @param rows - Category rows.
 * @param resolutions - Category resolutions keyed by title.
 * @returns Category rows with resolved titles/statuses.
 */
function applyCategoryResolutions(
    rows: Array<any>,
    resolutions: any,
): Array<any> {
    const resolveRow = (row: any) => applyCategoryResolution(row, resolutions);
    return rows.map(resolveRow);
}

/**
 * Applies one pre-fetched resolution to a category row.
 *
 * @param row - Category row.
 * @param resolutions - Category resolutions keyed by title.
 * @returns Category row with resolved title/status.
 */
function applyCategoryResolution(row: any, resolutions: any): any {
    const resolution = resolutions[normalizeCategoryKey(row.category)];
    const isEdited =
        normalizeCategoryKey(row.category) !==
        normalizeCategoryKey(row.originalCategory);

    const values = {
        ...row,
        category: resolution?.category || row.category,
        enabled: getResolvedCategoryEnabled(row, resolution),
        originalCategory:
            !isEdited && resolution?.category != null
                ? resolution.category
                : row.originalCategory,
        status: resolution?.status || CATEGORY_STATUS.unchecked,
    };
    const result = normalizeCategoryRow(values);
    return result;
}

/**
 * Disables category rows whose resolved page does not exist.
 *
 * @param row - Category row before resolution.
 * @param resolution - Resolved category metadata.
 * @returns Whether the resolved category row is enabled.
 */
function getResolvedCategoryEnabled(row: any, resolution: any): boolean {
    if (resolution?.exists === false) {
        return false;
    }

    return row.enabled !== false;
}

/**
 * Creates one category review row.
 *
 * @param values - Row values.
 * @param values.category - Category title without namespace.
 * @param values.company - Company page title for category
 * creation.
 * @param values.enabled - Whether the row should render.
 * @param values.originalCategory - Original generated
 * category.
 * @param values.source - Category source label.
 * @param values.stubTag - Corresponding stub tag title.
 * @param values.stubTagEnabled - Whether to render the stub
 * tag.
 * @param values.originalStubTagEnabled - Original stub tag
 * state.
 * @returns Category review row.
 */
function createCategoryRow(values: any = {}): any {
    const result = normalizeCategoryRow({
        category: '',
        enabled: true,
        originalCategory: values.category || '',
        source: '',
        status: CATEGORY_STATUS.unchecked,
        stubTag: '',
        stubTagEnabled: false,
        originalStubTagEnabled: values.stubTagEnabled === true,
        ...values,
    });
    return result;
}

/**
 * Normalizes one category review row.
 *
 * @param row - Category row.
 * @returns Normalized category row.
 */
function normalizeCategoryRow(row: any): any {
    const originalCategory = normalizeCategoryTitle(
        row.originalCategory || row.category,
    );
    const category = normalizeCategoryTitle(row.category);
    const source = normalizeSourceLabel(row.source, category, originalCategory);

    const result = {
        category,
        company: trimValue(row.company),
        enabled: row.enabled !== false,
        originalCategory,
        source,
        status: trimValue(row.status),
        stubTag: trimValue(row.stubTag),
        stubTagEnabled: row.stubTagEnabled === true,
        originalStubTagEnabled:
            row.originalStubTagEnabled == null
                ? row.stubTagEnabled === true
                : row.originalStubTagEnabled === true,
    };
    return result;
}

/**
 * Adds a modified marker to source labels for edited generated rows.
 *
 * @param source - Source label.
 * @param category - Current category.
 * @param originalCategory - Original generated category.
 * @returns Source label.
 */
function normalizeSourceLabel(
    source: string,
    category: string,
    originalCategory: string,
): string {
    const escapedSuffix = escapeRegExp(MODIFIED_SOURCE_SUFFIX);
    const modifiedSuffixPattern = new RegExp(`${escapedSuffix}$`, 'u');
    const cleanSource = trimValue(source).replace(modifiedSuffixPattern, '');

    if (
        cleanSource === SOURCE_MANUAL ||
        cleanSource === LEGACY_MANUAL_CATEGORY_SOURCE
    ) {
        return cleanSource;
    }

    if (category === '' || originalCategory === '') {
        return cleanSource;
    }

    const categoryKey = normalizeCategoryKey(category);
    const originalCategoryKey = normalizeCategoryKey(originalCategory);
    if (categoryKey === originalCategoryKey) {
        return cleanSource;
    }

    return `${cleanSource}${MODIFIED_SOURCE_SUFFIX}`;
}

/**
 * Gets previous manual category rows.
 *
 * @param rows - Existing category rows.
 * @returns Manual category rows.
 */
function getManualCategoryRows(rows: Array<any>): Array<any> {
    return rows.filter(isManualCategoryRow);
}

/**
 * Handles enrich manual category rows.
 *
 * Copies generated stub-tag metadata onto matching manual category
 * rows.
 *
 * @param manualRows - Resolved manual category rows.
 * @param generatedRows - Resolved generated category
 * rows.
 * @returns Manual rows with matching stub metadata.
 */
function enrichManualCategoryRows(
    manualRows: Array<any>,
    generatedRows: Array<any>,
): Array<any> {
    const hasStubTag = (row: any) => trimValue(row.stubTag) !== '';
    const createCategoryEntry = function createCategoryEntry(
        row: any,
    ): [string, any] {
        return [normalizeCategoryKey(row.category), row];
    };
    const generatedEntries = generatedRows
        .filter(hasStubTag)
        .map(createCategoryEntry);
    const generatedByCategory = new Map<string, any>(generatedEntries);

    const enrichRow = function enrichRow(row: any) {
        if (trimValue(row.stubTag) !== '') {
            return row;
        }

        const categoryKey = normalizeCategoryKey(row.category);
        const generated =
            generatedByCategory.get(categoryKey) ||
            getConfiguredCategoryStubMetadata(row.category);

        if (generated == null) {
            return row;
        }

        const result = normalizeCategoryRow({
            ...row,
            originalStubTagEnabled: generated.originalStubTagEnabled,
            stubTag: generated.stubTag,
            stubTagEnabled: generated.stubTagEnabled,
        });
        return result;
    };
    const result = manualRows.map(enrichRow);
    return result;
}

/**
 * Gets configured stub metadata for a category title.
 *
 * @param category - Category title.
 * @returns Matching stub metadata.
 */
function getConfiguredCategoryStubMetadata(category: string): any | undefined {
    for (const definitions of terminologies.getDefinitionCollections()) {
        const metadata = findConfiguredCategoryStubMetadata(
            definitions,
            category,
        );

        if (metadata != null) {
            return metadata;
        }
    }

    return undefined;
}

/**
 * Finds configured stub metadata in one definition collection.
 *
 * @param definitions - Terminology definitions.
 * @param category - Category title.
 * @returns Matching stub metadata.
 */
function findConfiguredCategoryStubMetadata(
    definitions: Array<{ categories?: string[]; stubTags?: string[] }>,
    category: string,
): any | undefined {
    const categoryKey = normalizeCategoryKey(category);

    for (const definition of definitions) {
        const findCategoryIndex = function findCategoryIndex(item: string) {
            return normalizeCategoryKey(item) === categoryKey;
        };
        const index = (definition.categories || []).findIndex(
            findCategoryIndex,
        );
        const stubTag = definition.stubTags?.[index];

        if (index >= 0 && trimValue(stubTag) !== '') {
            const result = {
                originalStubTagEnabled: true,
                stubTag,
                stubTagEnabled: true,
            };
            return result;
        }
    }

    return undefined;
}

/**
 * Checks whether a row was manually added.
 *
 * @param row - Category review row.
 * @returns Whether the row is manual.
 */
function isManualCategoryRow(row: any): boolean {
    const baseSource = getBaseSource(row.source);
    const result = [SOURCE_MANUAL, LEGACY_MANUAL_CATEGORY_SOURCE].includes(
        baseSource,
    );
    return result;
}

/**
 * Merges user edits into regenerated rows.
 *
 * @param generatedRows - Generated category rows.
 * @param previousRows - Existing category rows.
 * @returns Merged category rows.
 */
function mergePreviousGeneratedRows(
    generatedRows: Array<any>,
    previousRows: Array<any>,
): Array<any> {
    const mergeRow = function mergeRow(row: any) {
        const findPrevious = function findPrevious(item: any) {
            return hasSameGeneratedRow(row, item);
        };
        const previous = previousRows.find(findPrevious);

        if (previous == null) {
            return row;
        }

        const result = {
            ...row,
            category: previous.category,
            enabled: previous.enabled,
            pendingCreation: previous.pendingCreation,
            stubTagEnabled:
                previous.stubTagEnabled == null
                    ? row.stubTagEnabled
                    : previous.stubTagEnabled,
        };
        return result;
    };
    const result = generatedRows.map(mergeRow);
    return result;
}

/**
 * Handles resolve checkable category rows.
 *
 * Resolves rows whose title should be checked, preserving unchecked
 * suggestions.
 *
 * @param rows - Category rows.
 * @param options - API options.
 * @returns Category rows with refreshed
 * statuses.
 */
async function resolveCheckableCategoryRows(
    rows: Array<any>,
    options: any,
): Promise<Array<any>> {
    const checkableRows = rows.filter(shouldCheckCategoryRow);
    const resolvedRows = await resolveCategoryRows(checkableRows, options);
    const createIdentityEntry = function createIdentityEntry(
        row: any,
    ): [string, any] {
        return [getCategoryRowIdentity(row), row];
    };
    const resolvedEntries = resolvedRows.map(createIdentityEntry);
    const resolvedByOriginal = Object.fromEntries(resolvedEntries);

    const restoreResolvedRow = function restoreResolvedRow(row: any) {
        return resolvedByOriginal[getCategoryRowIdentity(row)] || row;
    };
    const result = rows.map(restoreResolvedRow);
    return result;
}

/**
 * Checks whether a category row should be verified through the API.
 *
 * @param row - Category review row.
 * @returns Whether the row should be checked.
 */
function shouldCheckCategoryRow(row: any): boolean {
    const result =
        normalizeCategoryTitle(row.category) !== '' &&
        normalizeCategoryKey(row.category) !==
            normalizeCategoryKey(row.originalCategory);
    return result;
}

/**
 * Gets an identity key for matching rows across API resolution.
 *
 * @param row - Category review row.
 * @returns Category row identity.
 */
function getCategoryRowIdentity(row: any): string {
    const result = [
        '',
        getBaseSource(row.source),
        '\n',
        normalizeCategoryKey(row.originalCategory),
        '',
    ].join('');
    return result;
}

/**
 * Checks whether two generated rows represent the same source category.
 *
 * @param row - Generated row.
 * @param previous - Previous row.
 * @returns Whether the rows match.
 */
function hasSameGeneratedRow(row: any, previous: any): boolean {
    const result =
        getBaseSource(row.source) === getBaseSource(previous.source) &&
        normalizeCategoryKey(row.originalCategory) ===
            normalizeCategoryKey(previous.originalCategory);
    return result;
}

/**
 * Gets a source label without the modified suffix.
 *
 * @param source - Source label.
 * @returns Base source label.
 */
function getBaseSource(source: string): string {
    const escapedSuffix = escapeRegExp(MODIFIED_SOURCE_SUFFIX);
    const modifiedSuffixPattern = new RegExp(`${escapedSuffix}$`, 'u');
    const result = trimValue(source).replace(modifiedSuffixPattern, '');
    return result;
}

/**
 * Resolves category titles.
 *
 * @param categories - Category titles without
 * namespace.
 * @param options - API options.
 * @returns Resolutions keyed by normalized category
 * title.
 */
async function resolveCategories(
    categories: Array<string>,
    options: any,
): Promise<any> {
    const titleResolutionOptions = {
        getRedirectTarget: getCategoryRedirectTarget,
        namespace: CATEGORY_NAMESPACE,
        pageProps: CATEGORY_REDIRECT_PROPS.join('|'),
        prop: 'info|pageprops',
    };
    const values = await resolvePageTitles(
        categories,
        titleResolutionOptions,
        options,
    );
    const buildResolutionEntry = function buildResolutionEntry([
        key,
        resolution,
    ]: [string, any]): [string, any] {
        return [key, buildCategoryResolution(resolution)];
    };
    const entries = Object.entries(values) as Array<[string, any]>;
    const resolutionEntries = entries.map(buildResolutionEntry);
    const resolutions = Object.fromEntries(resolutionEntries);

    return resolutions;
}

/**
 * Adds category-specific fields to a title resolution.
 *
 * @param resolution - Resolution value.
 * @returns Result when the function
 *   adds category-specific fields to a title
 *   resolution.
 */
function buildCategoryResolution(resolution: {
    exists: unknown;
    title: unknown;
}): unknown {
    let status = CATEGORY_STATUS.missing;

    if (resolution.exists) {
        status = CATEGORY_STATUS.exists;
    }
    const result = {
        ...resolution,
        category: resolution.title,
        status,
    };
    return result;
}

/**
 * Gets a category redirect target from page props.
 *
 * @param page - API page.
 * @returns Redirect target.
 */
function getCategoryRedirectTarget(page: any): string | undefined {
    const props = page?.pageprops || {};
    const target = CATEGORY_REDIRECT_PROPS.map((key) => props[key]).find(
        Boolean,
    );

    return target == null ? undefined : normalizeCategoryTitle(target);
}

/**
 * Formats a category title for API lookup.
 *
 * @param value - Category title.
 * @returns API page title.
 */
function normalizeCategoryTitle(value: unknown): string {
    return stripNamespace(value, CATEGORY_NAMESPACE);
}

/**
 * Normalizes a category title for lookup.
 *
 * @param value - Raw category value.
 * @returns Category key.
 */
function normalizeCategoryKey(value: any): string {
    return normalizeTitleKey(value, CATEGORY_NAMESPACE);
}

/**
 * Deduplicates category rows by category title.
 *
 * @param rows - Category rows.
 * @returns Unique category rows.
 */
function uniqueCategoryRows(rows: Array<any>): Array<any> {
    const seen = new Set();

    const keepUniqueRow = function keepUniqueRow(row: any) {
        const key = normalizeCategoryKey(row.category);

        if (key === '' || seen.has(key)) {
            return false;
        }

        seen.add(key);

        return true;
    };
    const result = rows.filter(keepUniqueRow);
    return result;
}

/**
 * Escapes a string for RegExp construction.
 *
 * @param value - Value to escape.
 * @returns Escaped value.
 */
function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
