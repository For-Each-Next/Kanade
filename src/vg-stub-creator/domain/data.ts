/**
 * @file src/vg-stub-creator/domain/data.ts
 * Purpose: Article metadata builders for years, genres, companies, platforms, and series.
 * Contents: Deterministic metadata rendering and shared local normalization.
 */

import { get as getTerminology } from './terminologies/index.ts';
import { formatText, getTextTemplate } from './wiki.ts';
import type { ArticleDataValue } from './models.ts';
import * as wikitext from './wikitext/index.ts';

const {
    buildLinkText,
    getReferenceValues,
    getWikilinkParts,
    getWikilinkValue,
    isWikilinkValue,
    splitFieldValues,
    splitLookupFieldValues,
    trimValue,
    uniqueValues,
} = wikitext;

const COMPLETABLE_METADATA_FIELDS: Record<string, string | null> = {
    developers: 'company',
    genres: 'genre',
    platforms: 'platform',
    publishers: 'company',
    series: null,
};

function getRequiredWikilinkParts(value: string): wikitext.WikilinkParts {
    const parts = getWikilinkParts(value);

    if (parts == null) {
        throw new Error('Expected a complete wikilink value.');
    }

    return parts;
}

/**
 * Checks whether a metadata field supports item completion.
 *
 * @param key - Lookup key.
 * @returns Whether a metadata field supports item completion.
 */
export function isCompletableMetadataField(key: string): boolean {
    return Object.hasOwn(COMPLETABLE_METADATA_FIELDS, key);
}

/**
 * Resolves completed metadata items to canonical terminology wikilinks.
 *
 * @param key - Metadata form key.
 * @param value - Current field value.
 * @param completeLast - Whether to resolve the unfinished final item.
 * @returns Field text with completed items normalized.
 */
export function completeMetadataFieldValue(
    key: string,
    value: any,
    completeLast: boolean = false,
): string {
    const stringValue = String(value ?? '');
    const text = normalizeExplicitWikilinkSeparators(stringValue);

    if (!isCompletableMetadataField(key)) {
        return text;
    }

    const type = COMPLETABLE_METADATA_FIELDS[key];
    const parts = splitMetadataFieldValue(text);
    const output = [];

    for (let index = 0; index < parts.length; index += 2) {
        const item = parts[index];
        const completed = completeLast || index + 1 < parts.length;
        let normalizedItem = normalizeIncompleteMetadataItem(item, index);

        if (completed) {
            normalizedItem = resolveMetadataItem(type, item);
        }
        output.push(normalizedItem);

        if (index + 1 < parts.length) {
            output.push('; ');
        }
    }

    return output.join('');
}

/**
 * Splits top-level metadata items while preserving wikilink content.
 *
 * @param value - Metadata field value.
 * @returns Alternating metadata items and separators.
 */
function splitMetadataFieldValue(value: string): string[] {
    const parts = [];
    let item = '';
    let inWikilink = false;

    for (let index = 0; index < value.length; index++) {
        const pair = value.slice(index, index + 2);

        if (pair === '[[') {
            inWikilink = true;
            item += pair;
            index++;
            continue;
        }

        if (pair === ']]' && inWikilink) {
            inWikilink = false;
            item += pair;
            index++;
            continue;
        }

        if (!inWikilink && /[,，;；\r\n]/u.test(value[index])) {
            parts.push(item, value[index]);
            item = '';

            if (pair === '\r\n') {
                index++;
            }
            continue;
        }

        item += value[index];
    }

    parts.push(item);
    return parts;
}

/**
 * Removes separator whitespace from an unfinished metadata item.
 *
 * @param item - Unfinished metadata item.
 * @param index - Item position in the alternating parts array.
 * @returns Metadata item with stable leading whitespace.
 */
function normalizeIncompleteMetadataItem(item: string, index: number): string {
    return index === 0 ? item : item.trimStart();
}

/**
 * Treats commas between explicit wikilinks as item separators.
 *
 * @param value - Input value.
 * @returns Result when the function
 *   treats commas between explicit wikilinks as item
 *   separators.
 */
function normalizeExplicitWikilinkSeparators(value: string): string {
    return value.replace(/(\]\])\s*[,，、]\s*(?=\[\[)/gu, '$1; ');
}

/**
 * Resolves one completed metadata item.
 *
 * @param type - Type value.
 * @param value - Input value.
 * @returns One completed metadata item.
 */
function resolveMetadataItem(type: string | null, value: string): string {
    const item = trimValue(value);

    if (item === '' || type == null) {
        return item;
    }

    const wikilinkValueResult = getWikilinkValue(item);
    return getTerminology(type, wikilinkValueResult, 'link') || item;
}

/**
 * Defines the module-level build year metadata.
 *
 * @param value - Input value.
 * @returns Result when the function
 *   defines the module-level build year metadata.
 */
export function buildYearMetadata(value: string | null) {
    const normalized = normalizeYearFieldValue(value);
    const reference = getYearReference(normalized);
    const metadata = {
        categories: reference.categories,
        navboxes: reference.navboxes,
        phrase: reference.phrase,
        value: normalized,
    };

    return metadata;
}

/**
 * Defines the module-level normalize year field value.
 *
 * @param value - Input value.
 * @returns Result when the function
 *   defines the module-level normalize year field
 *   value.
 */
export function normalizeYearFieldValue(value: string | null) {
    const entered = value == null ? '' : String(value).trim();
    const planned = entered.startsWith('~');
    const rawYear = planned ? entered.slice(1).trim() : entered;
    const yearMatch = rawYear.match(/\b\d{4}\b/u);
    const candidate = yearMatch?.[0] || rawYear;
    const normalized =
        getTerminology('year', candidate, 'label') || addYearSuffix(candidate);

    if (planned) {
        return normalized === '' ? '~' : `~${normalized}`;
    }

    return normalized;
}

/**
 * Adds the canonical suffix to an otherwise unknown four-digit year.
 *
 * @param value - Input value.
 * @returns Result when the function
 *   adds the canonical suffix to an otherwise unknown
 *   four-digit year.
 */
function addYearSuffix(value: string): string {
    return /^\d{4}$/u.test(value) ? `${value}年` : value;
}

/**
 * Defines the module-level get year reference.
 *
 * @param value - Input value.
 * @returns Result when the function
 *   defines the module-level get year reference.
 */
function getYearReference(value: string) {
    const year = trimValue(value);
    const definition = getTerminology('year', year);

    if (year === '') {
        const result = {
            categories: [],
            navboxes: [],
            phrase: '',
        };
        return result;
    }

    if (year === '~') {
        const result = {
            categories: [getTextTemplate('patterns.yearFuture')],
            navboxes: [],
            phrase: getTextTemplate('patterns.yearUnreleased'),
        };
        return result;
    }

    if (year.startsWith('~')) {
        const slicedValueA = year.slice(1);
        return getPlannedYearReference(slicedValueA);
    }

    const reference = {
        categories: definition?.categories || [],
        navboxes: definition?.navboxes || [],
        phrase: formatText('patterns.yearReleased', {
            year: definition?.label || year,
        }),
    };

    return reference;
}

/**
 * Defines the module-level get planned year reference.
 *
 * @param value - Input value.
 * @returns Result when the function
 *   defines the module-level get planned year
 *   reference.
 */
function getPlannedYearReference(value: string) {
    const year = trimValue(value);
    const definition = getTerminology('year', year);
    const textResultB = [
        getTextTemplate('patterns.yearFuture'),
        ...(definition?.categories || []),
    ];
    const reference = {
        categories: uniqueValues(textResultB),
        navboxes: definition?.navboxes || [],
        phrase: formatText('patterns.yearPlanned', {
            year: definition?.label || year,
        }),
    };

    return reference;
}

/**
 * Defines the module-level build genre metadata.
 *
 * @param value - Input value.
 * @returns Result when the function
 *   defines the module-level build genre metadata.
 */
export function buildGenreMetadata(value: string) {
    const genres = splitFieldValues(value);
    const items = genres.map(buildGenreItem);
    const references = getGenreReferences(value);
    const links = getMetadataLinks(items);
    const referenceValuesResultF = getReferenceValues(references, 'categories');
    const referenceValuesResultG = getReferenceValues(references, 'navboxes');
    const referenceValuesResultH = getReferenceValues(references, 'stubTags');
    const metadata = {
        categories: uniqueValues(referenceValuesResultF),
        items,
        links,
        navboxes: uniqueValues(referenceValuesResultG),
        stubTags: uniqueValues(referenceValuesResultH),
        text: items.map((item) => item.wikitext).join('、'),
        values: genres,
    };

    return metadata;
}

/**
 * Defines the module-level build genre item.
 *
 * @param value - Input value.
 * @returns Result when the function
 *   defines the module-level build genre item.
 */
function buildGenreItem(value: string): ArticleDataValue {
    if (isWikilinkValue(value)) {
        return buildLinkedItem(value);
    }

    const reference = getTerminology('genre', value);

    if (reference == null) {
        const result = {
            displayText: value,
            normalizedText: value,
            wikitext: value,
        };
        return result;
    }

    const item: ArticleDataValue = {
        displayText: getTerminology('genre', value, 'short name'),
        normalizedText: value,
        wikitext: getTerminology('genre', value, 'link'),
    };
    const page = getTerminology('genre', value, 'page');

    if (page != null) {
        item.linkTarget = page;
    }

    return item;
}

/** Collects the display links exposed by genre, platform, and series metadata. */
function getMetadataLinks(items: ArticleDataValue[]) {
    return items
        .filter((item) => item.linkTarget != null)
        .map((item) => ({
            displayText: item.displayText,
            target: item.linkTarget,
            wikitext: item.wikitext,
        }));
}

/** Builds a metadata item from an explicit wikilink. */
function buildLinkedItem(value: string): ArticleDataValue {
    const parts = getRequiredWikilinkParts(value);

    const result = {
        displayText: parts.label || parts.target,
        linkTarget: parts.target,
        normalizedText: value,
        wikitext: value,
    };
    return result;
}

/**
 * Defines the module-level get genre references.
 *
 * @param value - Input value.
 * @returns Result when the function
 *   defines the module-level get genre references.
 */
function getGenreReferences(value: string) {
    const mapCallbackI = (genre: string) => getTerminology('genre', genre);
    const references = splitFieldValues(value)
        .map(mapCallbackI)
        .filter(Boolean);

    return references;
}

/**
 * Handles build company data.
 *
 * Builds company values and category assumptions without composing
 * prose.
 *
 * @param companies - Company-related parameters.
 * @param companies.developers - Developer names.
 * @param companies.publishers - Publisher names.
 * @returns Company role values and category metadata.
 */
export function buildCompanyData(companies: any): any {
    const references = getCompanyReferences(companies);
    const developerItems = buildCompanyItems(
        companies.developers,
        references.developers,
    );
    const publisherValue = getPublisherValue(companies);
    const publisherItems = buildCompanyItems(
        publisherValue,
        references.publishers,
    );
    const referenceValuesResultC = getReferenceValues(
        references.all,
        'categories',
    );
    const referenceValuesResultD = getReferenceValues(
        references.all,
        'navboxes',
    );
    const referenceValuesResultE = getReferenceValues(
        references.all,
        'stubTags',
    );
    const data = {
        categoryItems: buildCompanyCategoryItems(companies),
        categories: uniqueValues(referenceValuesResultC),
        developers: buildCompanyRoleData(developerItems, companies.developers),
        publishers: buildCompanyRoleData(publisherItems, publisherValue),
        references,
        sameCompanies: companies.publishers === '=',
        navboxes: uniqueValues(referenceValuesResultD),
        stubTags: uniqueValues(referenceValuesResultE),
    };

    return data;
}

/**
 * Builds normalized data for one company role.
 *
 * @param items - Items value.
 * @param value - Input value.
 * @returns Normalized data for one company role.
 */
function buildCompanyRoleData(
    items: Array<{ wikitext: string }>,
    value: string,
): Record<string, unknown> {
    const mappedValues = items.map((item) => item.wikitext);
    const data = {
        items,
        text: joinCompanyTextList(mappedValues),
        values: splitFieldValues(value),
    };

    return data;
}

/**
 * Joins company names for attribution prose.
 *
 * @param values - Company name wikitext values.
 * @returns Joined company names.
 */
function joinCompanyTextList(values: Array<string>): string {
    if (values.length === 2) {
        const textResultA = getTextTemplate('shared.conjunction');
        return values.join(textResultA);
    }

    const textResult = getTextTemplate('shared.enumerationSeparator');
    return values.join(textResult);
}

/**
 * Builds structured display values for one company field.
 *
 * @param value - User-entered company values.
 * @param references - Matched company metadata.
 * @returns Company display values.
 */
function buildCompanyItems(value: string, references: Array<any>): Array<any> {
    const mapCallbackH = function callback(item: string) {
        return buildCompanyItem(references, item);
    };
    const items = splitFieldValues(value).map(mapCallbackH);

    return items;
}

/**
 * Builds one structured company value.
 *
 * @param references - Matched company metadata.
 * @param value - User-entered company value.
 * @returns Company display value.
 */
function buildCompanyItem(references: Array<any>, value: string): any {
    if (isWikilinkValue(value)) {
        const item = buildLinkedItem(value);

        return item;
    }

    const reference = references.find((item) => item.source === value);

    if (reference == null) {
        const item: ArticleDataValue = {
            displayText: value,
            normalizedText: value,
            wikitext: value,
        };

        return item;
    }

    const item: ArticleDataValue = {
        displayText: getTerminology('company', value, 'label'),
        normalizedText: value,
        wikitext: getTerminology('company', value, 'link'),
    };
    const page = getTerminology('company', value, 'page');

    if (page != null) {
        item.linkTarget = page;
    }

    return item;
}

/**
 * Gets the publisher value, expanding the equality marker.
 *
 * @param companies - Company-related parameters.
 * @returns Publisher values.
 */
function getPublisherValue(companies: any): string {
    if (companies.publishers === '=') {
        return companies.developers;
    }

    return companies.publishers;
}

/**
 * Builds category rows and lookup plans for company values.
 *
 * @param companies - Company-related parameters.
 * @returns Company category items.
 */
function buildCompanyCategoryItems(companies: any): Array<any> {
    const developers = buildCompanyLookupValues(companies.developers || '');
    const publisherValueResultA = getPublisherValue(companies) || '';
    const publishers = buildCompanyLookupValues(publisherValueResultA);
    const sharedCompanies = getSharedValues(developers, publishers);
    const values = uniqueCompanyLookupValues([...developers, ...publishers]);

    const flatMapCallbackA = function callback(company: any) {
        const valueKeyResult = normalizeValueKey(company.lookup);
        const hasIncludedValue = {
            company: company.title,
            stubTagEnabled: sharedCompanies.includes(valueKeyResult),
        };
        const result = buildCompanyCategoryItemsForValue(
            company.lookup,
            hasIncludedValue,
        );
        return result;
    };
    const result = values.flatMap(flatMapCallbackA);
    return result;
}

/**
 * Builds company lookup and link-target values from one form field.
 *
 * @param value - Company field value.
 * @returns Company lookup values.
 */
function buildCompanyLookupValues(value: string): Array<any> {
    const mapCallbackG = function callback(company: string) {
        const parts = getWikilinkParts(company);

        const result = {
            lookup: getWikilinkValue(company),
            title: parts?.target || getWikilinkValue(company),
        };
        return result;
    };
    const result = splitFieldValues(value).map(mapCallbackG);
    return result;
}

/**
 * Deduplicates company values by lookup title.
 *
 * @param values - Company lookup values.
 * @returns Unique company lookup values.
 */
function uniqueCompanyLookupValues(values: Array<any>): Array<any> {
    const seen = new Set();

    const filterCallbackA = function callback(value: any) {
        const key = normalizeValueKey(value.lookup);

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    };
    const result = values.filter(filterCallbackA);
    return result;
}

/**
 * Builds category items for one company value.
 *
 * @param company - Company value.
 * @param options - Category item options.
 * @param options.company - Company page title.
 * @param options.stubTagEnabled - Whether stub tags default
 * on.
 * @returns Company category items.
 */
function buildCompanyCategoryItemsForValue(
    company: string,
    options: any = {},
): Array<any> {
    const reference = getTerminology('company', company);
    const companyTitle = getCompanyTitle(company, options.company);

    if (reference != null && (reference.categories || []).length > 0) {
        const mapCallbackF = function callback(
            category: unknown,
            index: string | number,
        ) {
            const stubTag = reference.stubTags?.[index] || '';

            const result = {
                category,
                company: companyTitle,
                stubTag,
                stubTagEnabled: Boolean(options.stubTagEnabled && stubTag),
            };
            return result;
        };
        const result = reference.categories.map(mapCallbackF);
        return result;
    }

    const disambiguationBaseTitleResult = {
        title: getDisambiguationBaseTitle(company),
    };
    const result = [
        {
            candidates: buildCompanyCategoryCandidates(company),
            company: companyTitle,
            fallback: formatText(
                'patterns.titleGame',
                disambiguationBaseTitleResult,
            ),
        },
    ];
    return result;
}

/**
 * Gets the preferred article title for a company.
 *
 * @param company - Company value.
 * @param fallback - Fallback value.
 * @returns The preferred article title for a company.
 */
function getCompanyTitle(company: string, fallback: string): string {
    const page = getTerminology('company', company, 'page');

    if (page) {
        return page;
    }

    const label = getTerminology('company', company, 'label');
    return label || fallback || company;
}

/**
 * Gets normalized values present in both input lists.
 *
 * @param values - Primary values.
 * @param candidates - Candidate values.
 * @returns Shared normalized values.
 */
function getSharedValues(
    values: Array<{ lookup: string }>,
    candidates: Array<{ lookup: string }>,
): Array<string> {
    const mapCallbackE = function callback(value: { lookup: string }) {
        return normalizeValueKey(value.lookup);
    };
    const candidateKeys = candidates.map(mapCallbackE);

    const mapCallbackD = (value: { lookup: string }) =>
        normalizeValueKey(value.lookup);
    const filterCallback = (value: string) => candidateKeys.includes(value);
    const result = values.map(mapCallbackD).filter(filterCallback);
    return result;
}

/**
 * Normalizes a user field value for comparison.
 *
 * @param value - Field value.
 * @returns Normalized comparison key.
 */
function normalizeValueKey(value: string): string {
    return getWikilinkValue(value).toLocaleLowerCase();
}

/**
 * Builds company category candidates.
 *
 * @param company - Company value.
 * @returns Candidate category titles.
 */
function buildCompanyCategoryCandidates(company: string): Array<string> {
    const flattenedValuesA = [
        company,
        getDisambiguationBaseTitle(company),
    ].flatMap(buildTitleCategoryCandidates);
    const result = uniqueValues(flattenedValuesA);
    return result;
}

/**
 * Builds category candidates for one company or series title.
 *
 * @param title - Company title.
 * @returns Candidate category titles.
 */
function buildTitleCategoryCandidates(title: string): Array<string> {
    const result = [
        formatText('patterns.titleVideoGames', { title }),
        formatText('patterns.titleGame', { title }),
        title,
    ];
    return result;
}

/**
 * Removes a trailing disambiguation bracket from a title.
 *
 * @param title - Title.
 * @returns Base title.
 */
function getDisambiguationBaseTitle(title: string): string {
    return title.replace(/\s*\([^()]+\)\s*$/u, '');
}

/**
 * Gets reference metadata for company parameters.
 *
 * @param companies - Company-related parameters.
 * @param companies.developers - Developer names.
 * @param companies.publishers - Publisher names.
 * @returns Matched company metadata by role.
 */
function getCompanyReferences(companies: any): any {
    const developers = getCompanyRoleReferences(companies.developers);
    const publisherValueResult = getPublisherValue(companies);
    const publishers = getCompanyRoleReferences(publisherValueResult);

    const result = {
        all: [...developers, ...publishers],
        developers,
        publishers,
    };
    return result;
}

/**
 * Gets reference metadata for one company role.
 *
 * @param value - User-entered company values.
 * @returns Matched company metadata.
 */
function getCompanyRoleReferences(value: string): Array<any> {
    const mapCallbackC = function callback(source: string) {
        const reference = getTerminology('company', source);

        return reference == null ? undefined : { ...reference, source };
    };
    const result = splitFieldValues(value).map(mapCallbackC).filter(Boolean);
    return result;
}

/**
 * Builds normalized display, link, and category metadata for platforms.
 *
 * @param value - Raw platform field value.
 * @returns Platform values and metadata.
 */
export function buildPlatformMetadata(value: any): any {
    const references = getPlatformReferences(value);
    const platformValues = splitFieldValues(value);
    const mapCallbackB = function callback(item: string) {
        return buildPlatformItem(references, item);
    };
    const items = platformValues.map(mapCallbackB);
    const links = getMetadataLinks(items);
    const referenceValuesResult = getReferenceValues(references, 'categories');
    const referenceValuesResultA = getReferenceValues(references, 'navboxes');
    const referenceValuesResultB = getReferenceValues(references, 'stubTags');
    const metadata = {
        categories: uniqueValues(referenceValuesResult),
        count: splitLookupFieldValues(value || '').length,
        items,
        links,
        navboxes: uniqueValues(referenceValuesResultA),
        stubTags: uniqueValues(referenceValuesResultB),
        text: items.map((item) => item.wikitext).join('、'),
        values: platformValues,
    };

    return metadata;
}

/**
 * Defines the module-level build platform item.
 *
 * @param references - References value.
 * @param value - Input value.
 * @returns Result when the function
 *   defines the module-level build platform item.
 */
function buildPlatformItem(
    references: Array<{ source: string }>,
    value: string,
): ArticleDataValue {
    if (isWikilinkValue(value)) {
        return buildLinkedItem(value);
    }

    const reference = references.find((item) => item.source === value);

    if (reference == null) {
        const result = {
            displayText: value,
            normalizedText: value,
            wikitext: value,
        };
        return result;
    }

    const item: ArticleDataValue = {
        displayText: getTerminology('platform', value, 'label'),
        normalizedText: value,
        wikitext: getTerminology('platform', value, 'link'),
    };
    const page = getTerminology('platform', value, 'page');

    if (page != null) {
        item.linkTarget = page;
    }

    return item;
}

/**
 * Defines the module-level get platform references.
 *
 * @param value - Input value.
 * @returns Result when the function
 *   defines the module-level get platform references.
 */
function getPlatformReferences(
    value: string,
): Array<Record<string, unknown> & { source: string }> {
    const mapCallbackA = function callback(source: string) {
        const reference = getTerminology('platform', source);

        return reference == null ? undefined : { ...reference, source };
    };
    const references = splitFieldValues(value)
        .map(mapCallbackA)
        .filter(Boolean);

    return references;
}

/**
 * Builds normalized display, link, and category metadata for series.
 *
 * @param value - Raw series field value.
 * @returns Series values and metadata.
 */
export function buildSeriesMetadata(value: any): any {
    const values = normalizeSeriesValues(value || '');
    const items = values.map(buildSeriesItem);
    const links = getMetadataLinks(items);
    const seriesWikitext = items.map((item) => item.wikitext);
    const enumerationSeparator = getTextTemplate('shared.enumerationSeparator');
    const metadata = {
        categoryPlans: buildSeriesCategoryPlans(values),
        items,
        links,
        text: seriesWikitext.join(enumerationSeparator),
        values,
    };

    return metadata;
}

/**
 * Defines the module-level build series item.
 *
 * @param series - Series value.
 * @returns Result when the function
 *   defines the module-level build series item.
 */
function buildSeriesItem(series: string): ArticleDataValue {
    const marker = getSeriesMarker(series);
    const value = marker.value;

    if (marker.derivativeWork) {
        return buildDerivativeWorkItem(value);
    }

    return buildSeriesTitleItem(value);
}

/**
 * Defines the module-level build series title item.
 *
 * @param series - Series value.
 * @returns Result when the function
 *   defines the module-level build series title item.
 */
function buildSeriesTitleItem(series: string): ArticleDataValue {
    if (!isWikilinkValue(series)) {
        const displayText = formatText('patterns.seriesDisplayTitle', {
            title: series,
        });
        const item = {
            displayText,
            normalizedText: series,
            wikitext: displayText,
        };

        return item;
    }

    return buildLinkedSeriesTitleItem(series);
}

/**
 * Builds a series-title item from an explicit wikilink.
 *
 * @param series - Series value.
 * @returns A series-title item from an explicit wikilink.
 */
function buildLinkedSeriesTitleItem(series: string): ArticleDataValue {
    const parts = getRequiredWikilinkParts(series);
    const label = parts.label || parts.target;
    const linkTarget =
        parts.label === ''
            ? formatText('patterns.titleSeries', { title: parts.target })
            : parts.target;
    const displayText = formatText('patterns.seriesDisplayTitle', {
        title: label,
    });
    const result = {
        displayText,
        linkTarget,
        normalizedText: series,
        wikitext: buildLinkText(linkTarget, displayText),
    };
    return result;
}

/**
 * Defines the module-level build derivative work item.
 *
 * @param series - Series value.
 * @returns Result when the function
 *   defines the module-level build derivative work
 *   item.
 */
function buildDerivativeWorkItem(series: string): ArticleDataValue {
    if (!isWikilinkValue(series)) {
        const displayText = formatText('patterns.derivativeWorkDisplayTitle', {
            title: series,
        });

        const result = {
            displayText,
            normalizedText: series,
            wikitext: displayText,
        };
        return result;
    }

    const parts = getRequiredWikilinkParts(series);
    const label = parts.label || parts.target;
    const displayLink = buildLinkText(parts.target, label);
    const displayText = formatText('patterns.derivativeWorkDisplayTitle', {
        title: displayLink,
    });

    const result = {
        displayText,
        linkTarget: parts.target,
        normalizedText: series,
        wikitext: displayText,
    };
    return result;
}

/**
 * Defines the module-level normalize series values.
 *
 * @param series - Series value.
 * @returns Result when the function
 *   defines the module-level normalize series values.
 */
function normalizeSeriesValues(series: string) {
    const values = splitFieldValues(series).map(normalizeSeriesValue);

    return values;
}

/**
 * Defines the module-level normalize series value.
 *
 * @param series - Series value.
 * @returns Result when the function
 *   defines the module-level normalize series value.
 */
function normalizeSeriesValue(series: string) {
    const marker = getSeriesMarker(series);
    const value = marker.value;

    if (!isWikilinkValue(value)) {
        const trimSeriesSuffixResult = trimSeriesSuffix(value);
        return addSeriesMarker(trimSeriesSuffixResult, marker);
    }

    const parts = getRequiredWikilinkParts(value);
    const target = trimSeriesSuffix(parts.target);
    const label = trimSeriesSuffix(parts.label);

    if (label === '') {
        return addSeriesMarker(`[[${target}]]`, marker);
    }

    const linkTextResult = buildLinkText(target, label);
    return addSeriesMarker(linkTextResult, marker);
}

/**
 * Defines the module-level get series marker.
 *
 * @param series - Series value.
 * @returns Result when the function
 *   defines the module-level get series marker.
 */
function getSeriesMarker(series: string) {
    const value = trimValue(series);
    const derivativeWork = value.endsWith('*');

    if (!derivativeWork) {
        const result = {
            derivativeWork,
            value,
        };
        return result;
    }

    const slicedValue = value.slice(0, -1);
    const result = {
        derivativeWork,
        value: trimValue(slicedValue),
    };
    return result;
}

/**
 * Defines the module-level add series marker.
 *
 * @param value - Input value.
 * @param marker - Marker value.
 * @returns Result when the function
 *   defines the module-level add series marker.
 */
function addSeriesMarker(
    value: string,
    marker: { derivativeWork: unknown; value?: string },
) {
    if (!marker.derivativeWork) {
        return value;
    }

    return `${value}*`;
}

/**
 * Removes a redundant Chinese series suffix from one value.
 *
 * @param value - Input value.
 * @returns Series value without a trailing suffix.
 */
export function trimSeriesSuffix(value: string): string {
    return trimValue(value).replace(/系列$/u, '');
}

/**
 * Defines the module-level build series category plans.
 *
 * @param series - Series value.
 * @returns Result when the function
 *   defines the module-level build series category
 *   plans.
 */
function buildSeriesCategoryPlans(series: string[]) {
    const mapCallback = (value: string) => getSeriesMarker(value).value;
    const flatMapCallback = (value: string) => splitLookupFieldValues(value);
    const plans = series
        .map(mapCallback)
        .flatMap(flatMapCallback)
        .map(buildSeriesCategoryPlan);

    return plans;
}

/**
 * Defines the module-level build series category plan.
 *
 * @param series - Series value.
 * @returns Result when the function
 *   defines the module-level build series category
 *   plan.
 */
function buildSeriesCategoryPlan(series: string) {
    const plan = {
        candidates: buildSeriesCategoryCandidates(series),
        fallback: formatText('patterns.titleVideoGames', { title: series }),
    };

    return plan;
}

/**
 * Defines the module-level build series category candidates.
 *
 * @param title - Page title.
 * @returns Result when the function
 *   defines the module-level build series category
 *   candidates.
 */
function buildSeriesCategoryCandidates(title: string) {
    const flattenedValues = [
        formatText('patterns.titleSeries', { title }),
        title,
    ].flatMap(buildTitleCategoryCandidates);
    const candidates = uniqueValues(flattenedValues);

    return candidates;
}
