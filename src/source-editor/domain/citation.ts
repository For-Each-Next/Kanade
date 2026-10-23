/**
 * @file src/source-editor/domain/citation.ts
 * Purpose: Canonicalizes and orders citation data and derives ref names.
 *
 * Table of contents:
 * 1. Imports
 * 2. Exports
 * 3. Constants and state
 * 4. CitationIdentity
 * 5. CitationParameterCollision
 * 6. ResolvedCitationParam
 * 7. CitationAuthorSelection
 * 8. CitationValueSelection
 * 9. formatCitationTemplate
 * 10. canonicalizeCitation
 * 11. findCitationParameterCollisions
 * 12. getCitationParameterGroupNames
 * 13. suffixCitationParameterCollisions
 * 14. withoutEmptyCitationParams
 * 15. resolveCitationParams
 * 16. resolveCitationOutputParamGroups
 * 17. getCanonicalCitationParamName
 * 18. getRepeatedMarkerBase
 * 19. countCitationParamNames
 * 20. suffixRepeatedCitationParams
 * 21. getRepeatedCitationParamOutputBases
 * 22. getUnusedRepeatMarkerName
 * 23. normalizeParamKey
 * 24. buildRepeatedCitationParamName
 * 25. getAlphabeticSuffix
 * 26. normalizeNameOverrideSpacing
 * 27. formatNameOverrideComment
 * 28. sortCitationParams
 * 29. getFirstCitationParamIndexes
 * 30. getCitationParamSortOrder
 * 31. getAuthorParamOrder
 * 32. normalizeEnglishDate
 * 33. buildIsoDate
 * 34. getCitationIdentity
 * 35. getCitationNameContributors
 * 36. isCreatorParam
 * 37. mapSourceIdentityParam
 * 38. getSourceIdentityKey
 * 39. addFirstAuthorInitials
 * 40. appendCitationLocator
 * 41. getCitationAuthor
 * 42. selectCitationAuthor
 * 43. selectCitationTitleAuthor
 * 44. formatTitleNameFallback
 * 45. stripScriptTitleLanguage
 * 46. formatTitleFallback
 * 47. collectCitationAuthors
 * 48. getCitationAuthorIndex
 * 49. getCitationAuthorCandidates
 * 50. authorNameValue
 * 51. formatAuthorList
 * 52. getCitationYear
 * 53. selectCitationYear
 * 54. getSourceLocator
 * 55. selectSourceLocator
 * 56. normalizeLocatorTime
 * 57. canonicalizeSourceUrl
 * 58. nameValue
 * 59. extractNameOverride
 * 60. hasFieldDirective
 * 61. cleanValue
 * 62. buildCanonicalNameMap
 * 63. addNumberedAuthorAliases
 * 64. addCanonicalAliases
 */

import {
    citeBookTemplateData,
    citeWebTemplateData,
} from '../config/citation-template-data/index.ts';
import { wikitext } from '../../library/wikitext/index.ts';

import { resolveWikiPolicy, type WikiPolicy } from './wiki-policy.ts';
import { normalizeEnglishLanguageCodes } from './language-codes.ts';
import type {
    CitationLayout,
    CitationParam,
    CitationTemplate,
    CitationTemplateData,
} from './types.ts';
import {
    formatBlockCitation,
    formatInlineCitation,
    getCitationOutputParams,
} from './post-formatter.ts';
import { applyPreFormatHandlers } from './pre-formatter.ts';
import {
    DEFAULT_TEMPLATE_NAME_CONTEXT,
    getCanonicalTemplateName,
    normalizeTemplateName,
    type TemplateNameContext,
} from './templates.ts';

export { formatBlockCitation, formatInlineCitation } from './post-formatter.ts';

const DATE_PARAMS = new Set([
    'access-date',
    'archive-date',
    'date',
    'doi-broken-date',
    'orig-date',
    'publication-date',
]);

const SOURCE_IDENTITY_PARAMS = new Set([
    'agency',
    'arxiv',
    'asin',
    'bibcode',
    'biorxiv',
    'citeseerx',
    'conference',
    'date',
    'department',
    'developer',
    'doi',
    'encyclopedia',
    'event',
    'id',
    'institution',
    'isbn',
    'issn',
    'journal',
    'jstor',
    'lccn',
    'magazine',
    'mr',
    'network',
    'newspaper',
    'number',
    'oclc',
    'ol',
    'organization',
    'orig-date',
    'osti',
    'pmc',
    'pmid',
    'podcast',
    'program',
    'publication-date',
    'publisher',
    'rfc',
    'script-title',
    'series',
    'ssrn',
    'title',
    'trans-title',
    'university',
    'url',
    'user',
    'website',
    'work',
    'year',
    'zbl',
]);

const CREATOR_PARAM_PATTERNS = [
    /^(?:author|editor|first|host|last)(?:-first|-last)?\d*$/u,
    /^(?:contributor|interviewer)(?:-first|-last)?\d*$/u,
    /^(?:cartography|translator)(?:-first|-last)?\d*$/u,
];
const CITATION_AUTHOR_INDEX_PATTERNS = [
    /^author-(?:last|surname)(\d*)$/u,
    /^author(\d+)-(?:last|surname)$/u,
    /^(?:last|surname|author|subject|host)(\d*)$/u,
];

const POSITION_QUERY_PARAMS = new Set([
    'begin',
    'chapter',
    'page',
    'section',
    'start',
    't',
    'time',
    'time_continue',
    'timestamp',
]);

const CREDITED_ORGANIZATION_PARAMS = ['agency', 'organization'];
const PUBLISHER_PARAMS = ['publisher', 'institution'];
const PERIODICAL_PARAMS = [
    'periodical',
    'journal',
    'newspaper',
    'magazine',
    'work',
    'website',
    'encyclopedia',
    'encyclopaedia',
    'dictionary',
];
const CITATION_DATE_KEYS = ['date', 'year', 'publication-date'];
const CITATION_CREATOR_FALLBACK_KEYS = [
    'interviewer-last',
    'cartography',
    'translator-last',
    'contributor-last',
    'developer',
    'user',
    ...CREDITED_ORGANIZATION_PARAMS,
    ...PUBLISHER_PARAMS,
    ...PERIODICAL_PARAMS,
];
const SOURCE_LOCATOR_ENTRIES: Array<[string, string]> = [
    ['page', 'p.'],
    ['pages', 'pp.'],
    ['quote-page', 'p.'],
    ['quote-pages', 'pp.'],
    ['chapter', 'chapter'],
    ['section', 'section'],
    ['at', ''],
    ['time', 'at time'],
    ['timestamp', 'at time'],
    ['minutes', 'min.'],
    ['duration', 'at time'],
    ['level', 'level'],
    ['scene', 'scene'],
];

const PARAM_ORDER_SCALE = 1_000;
const citeWebParamOrderEntries = citeWebTemplateData.paramOrder.map(
    (name, index) => [name, index] as const,
);
const CITE_WEB_PARAM_ORDER = new Map(citeWebParamOrderEntries);

const citeBookParamOrderEntries = citeBookTemplateData.paramOrder.map(
    (name, index) => [name, index] as const,
);
const CITE_BOOK_PARAM_ORDER = new Map(citeBookParamOrderEntries);

const PRINT_CITATION_TEMPLATES = new Set([
    'cite book',
    'cite conference',
    'cite document',
    'cite encyclopedia',
    'cite journal',
    'cite magazine',
    'cite report',
    'cite tech report',
    'cite thesis',
]);

export interface CitationIdentity {
    author: string;
    baseName: string;
    forceLocator?: boolean;
    locator: string;
    sourceSignature: string;
    year: string;
}

export interface CitationParameterCollision {
    canonicalParameter: string;
    firstParameter: string;
    renamedParameter: string;
    secondParameter: string;
}

interface ResolvedCitationParam extends CitationParam {
    enteredName: string;
    sourceIndex: number;
}

interface CitationAuthorSelection {
    keys: string[];
    value: string;
}

interface CitationValueSelection {
    key: string;
    value: string;
}

/**
 * Parses, canonicalizes, orders, and formats one citation template.
 *
 * @param raw - Complete citation template text.
 * @param metadata - TemplateData metadata.
 * @param layout - Citation-template output layout.
 * @returns Canonical citation and formatted text.
 */
export function formatCitationTemplate(
    raw: string,
    metadata: CitationTemplateData,
    layout: CitationLayout = 'block',
    templateNameContext: TemplateNameContext = DEFAULT_TEMPLATE_NAME_CONTEXT,
    wikiPolicy: WikiPolicy = resolveWikiPolicy(''),
): {
    citation: CitationTemplate;
    parameterCollisions: CitationParameterCollision[];
    text: string;
} {
    const parsed = wikitext(raw).templates.parser();
    const name = getCanonicalTemplateName(parsed.name, templateNameContext);
    const params = parsed.params.map(function mapParam(param) {
        const result = {
            name: param.name,
            value: param.value,
        };
        return result;
    });
    const entered = { name, params };
    const parameterCollisions = findCitationParameterCollisions(
        entered,
        metadata,
    );
    const citation = canonicalizeCitation(entered, metadata, wikiPolicy);
    const text =
        layout === 'inline'
            ? formatInlineCitation(citation)
            : formatBlockCitation(citation);
    return { citation, parameterCollisions, text };
}

/**
 * Canonicalizes aliases, date values, and TemplateData parameter order.
 *
 * @param citation - Parsed citation.
 * @param metadata - TemplateData metadata.
 * @returns Canonical citation.
 */
export function canonicalizeCitation(
    citation: CitationTemplate,
    metadata: CitationTemplateData,
    wikiPolicy: WikiPolicy = resolveWikiPolicy(''),
): CitationTemplate {
    const resolved = resolveCitationParams(
        withoutEmptyCitationParams(citation),
        metadata,
        wikiPolicy,
    );
    const sorted = sortCitationParams(citation.name, resolved, metadata);
    const suffixed = suffixRepeatedCitationParams(
        citation.name,
        sorted,
        metadata,
    );
    const params = suffixed.map(function toCitationParam(param) {
        return { name: param.name, value: param.value };
    });
    return { name: citation.name, params };
}

/**
 * Finds names that resolve to an already populated canonical field.
 *
 * @param citation - Parsed citation.
 * @param metadata - TemplateData metadata.
 * @returns Collisions in entered parameter order.
 */
export function findCitationParameterCollisions(
    citation: CitationTemplate,
    metadata: CitationTemplateData,
): CitationParameterCollision[] {
    const resolved = resolveCitationParams(
        withoutEmptyCitationParams(citation),
        metadata,
    );
    const suffixed = suffixRepeatedCitationParams(
        citation.name,
        resolved,
        metadata,
    );
    const firstByName = new Map<string, string>();
    const collisions: CitationParameterCollision[] = [];
    for (const [index, param] of resolved.entries()) {
        const first = firstByName.get(param.name);
        if (first == null) {
            firstByName.set(param.name, param.enteredName);
            continue;
        }
        collisions.push({
            canonicalParameter: param.name,
            firstParameter: first,
            renamedParameter: suffixed[index]?.name ?? param.name,
            secondParameter: param.enteredName,
        });
    }
    return collisions;
}

/**
 * Resolves each entered parameter to its canonical sorting group.
 *
 * Repeat markers such as `journal-a` stay in the `journal` group when
 * the base parameter is present. This keeps rows stable across passes.
 *
 * @param citation - Parsed citation.
 * @param metadata - TemplateData metadata.
 * @returns Canonical group names in entered parameter order.
 */
export function getCitationParameterGroupNames(
    citation: CitationTemplate,
    metadata: CitationTemplateData,
): string[] {
    return resolveCitationParams(citation, metadata).map((param) => param.name);
}

/**
 * Suffixes colliding groups while retaining other spelling, values,
 * and order.
 *
 * @param citation - Parsed citation.
 * @param metadata - TemplateData metadata.
 * @returns Citation with colliding groups made explicit.
 */
export function suffixCitationParameterCollisions(
    citation: CitationTemplate,
    metadata: CitationTemplateData,
): CitationTemplate {
    const resolved = resolveCitationParams(citation, metadata);
    const counts = countCitationParamNames(resolved);
    if (![...counts.values()].some((count) => count > 1)) {
        return citation;
    }
    const collidingIndexes = new Set(
        resolved
            .filter((param) => (counts.get(param.name) ?? 0) > 1)
            .map((param) => param.sourceIndex),
    );
    const groups = Map.groupBy(resolved, (param) => param.name);
    const grouped = [...groups.values()].flat();
    const suffixed = suffixRepeatedCitationParams(
        citation.name,
        grouped,
        metadata,
    );
    const params = suffixed.map(function restoreUnchangedParam(param) {
        if (collidingIndexes.has(param.sourceIndex)) {
            return { name: param.name, value: param.value };
        }
        return citation.params[param.sourceIndex];
    });
    return { name: citation.name, params };
}

/** Empty fields are omitted from formatted output and cannot reserve a repeat slot. */
function withoutEmptyCitationParams(
    citation: CitationTemplate,
): CitationTemplate {
    return {
        ...citation,
        params: citation.params.filter((param) => param.value.trim() !== ''),
    };
}

function resolveCitationParams(
    citation: CitationTemplate,
    metadata: CitationTemplateData,
    wikiPolicy: WikiPolicy = resolveWikiPolicy(''),
): ResolvedCitationParam[] {
    const canonicalNames = buildCanonicalNameMap(metadata);
    const migrated = applyPreFormatHandlers(citation.params);
    const normalNames = migrated.map((param) =>
        getCanonicalCitationParamName(param.name, canonicalNames),
    );
    const presentNames = new Map(
        normalNames.map((name) => [name.toLowerCase(), name] as const),
    );
    const resolved = migrated.map(function resolveParam(param, sourceIndex) {
        const enteredName = citation.params[sourceIndex].name.trim();
        const normalName = normalNames[sourceIndex];
        const name = getRepeatedMarkerBase(
            param.name,
            normalName,
            canonicalNames,
            presentNames,
        );
        let value = normalizeNameOverrideSpacing(param.value.trim());
        const isDate =
            DATE_PARAMS.has(name) || metadata.dateParams?.includes(name);
        if (isDate) {
            value = wikiPolicy.citationDates.normalize(param.value.trim());
        }
        if (name === 'language') {
            value = normalizeEnglishLanguageCodes(value);
        }
        return { enteredName, name, sourceIndex, value };
    });
    return resolveCitationOutputParamGroups(
        citation.name,
        resolved,
        canonicalNames,
    );
}

function resolveCitationOutputParamGroups(
    template: string,
    params: ResolvedCitationParam[],
    canonicalNames: Map<string, string>,
): ResolvedCitationParam[] {
    const firstByName = new Map<string, ResolvedCitationParam>();
    for (const param of params) {
        if (!firstByName.has(param.name)) {
            firstByName.set(param.name, param);
        }
    }
    const representatives = [...firstByName.values()];
    const output = getCitationOutputParams(
        {
            name: template,
            params: representatives.map((param) => ({
                name: param.name,
                value: param.value,
            })),
        },
        true,
    );
    const outputGroupByName = new Map<string, string>();
    for (const [index, param] of representatives.entries()) {
        const outputName = output[index]?.name ?? param.name;
        const canonicalOutput =
            canonicalNames.get(outputName.toLowerCase()) ?? outputName;
        outputGroupByName.set(param.name, canonicalOutput);
    }
    return params.map(function useOutputGroup(param) {
        return {
            ...param,
            name: outputGroupByName.get(param.name) ?? param.name,
        };
    });
}

function getCanonicalCitationParamName(
    enteredName: string,
    canonicalNames: Map<string, string>,
): string {
    const trimmed = enteredName.trim();
    return canonicalNames.get(trimmed.toLowerCase()) ?? trimmed;
}

function getRepeatedMarkerBase(
    enteredName: string,
    normalName: string,
    canonicalNames: Map<string, string>,
    presentNames: Map<string, string>,
): string {
    const lookupName = enteredName.trim().toLowerCase();
    if (canonicalNames.has(lookupName)) {
        return normalName;
    }
    const match = lookupName.match(/^(.*?)-([a-z]+)$/u);
    if (match == null) {
        return normalName;
    }
    const base = canonicalNames.get(match[1]) ?? match[1];
    return presentNames.get(base.toLowerCase()) ?? normalName;
}

function countCitationParamNames(
    params: readonly Pick<CitationParam, 'name'>[],
): Map<string, number> {
    const counts = new Map<string, number>();
    for (const param of params) {
        counts.set(param.name, (counts.get(param.name) ?? 0) + 1);
    }
    return counts;
}

function suffixRepeatedCitationParams<T extends CitationParam>(
    template: string,
    params: T[],
    metadata: CitationTemplateData,
): T[] {
    const counts = new Map<string, number>();
    const outputBases = getRepeatedCitationParamOutputBases(template, params);
    const reserved = new Set(
        [...params.map((param) => param.name), ...outputBases.values()].map(
            normalizeParamKey,
        ),
    );
    const canonicalNames = buildCanonicalNameMap(metadata);
    const supported = new Set(
        [...canonicalNames.keys(), ...canonicalNames.values()].map(
            normalizeParamKey,
        ),
    );
    const used = new Set<string>();
    return params.map(function suffixRepeatedParam(param) {
        const occurrence = (counts.get(param.name) ?? 0) + 1;
        counts.set(param.name, occurrence);
        const base = outputBases.get(param.name) ?? param.name;
        if (occurrence === 1) {
            used.add(normalizeParamKey(param.name));
            used.add(normalizeParamKey(base));
            return param;
        }
        const name = getUnusedRepeatMarkerName(
            base,
            occurrence,
            reserved,
            supported,
            used,
        );
        used.add(normalizeParamKey(name));
        return { ...param, name };
    });
}

function getRepeatedCitationParamOutputBases<T extends CitationParam>(
    template: string,
    params: T[],
): Map<string, string> {
    const firstByName = new Map<string, T>();
    for (const param of params) {
        if (!firstByName.has(param.name)) {
            firstByName.set(param.name, param);
        }
    }
    const representatives = [...firstByName.values()];
    const output = getCitationOutputParams(
        {
            name: template,
            params: representatives.map((param) => ({
                name: param.name,
                value: param.value,
            })),
        },
        true,
    );
    const result = new Map<string, string>();
    for (const [index, param] of representatives.entries()) {
        result.set(param.name, output[index]?.name ?? param.name);
    }
    return result;
}

function getUnusedRepeatMarkerName(
    base: string,
    occurrence: number,
    reserved: Set<string>,
    supported: Set<string>,
    used: Set<string>,
): string {
    let suffix = occurrence - 1;
    let name = buildRepeatedCitationParamName(base, suffix);
    while (
        reserved.has(normalizeParamKey(name)) ||
        supported.has(normalizeParamKey(name)) ||
        used.has(normalizeParamKey(name))
    ) {
        suffix += 1;
        name = buildRepeatedCitationParamName(base, suffix);
    }
    return name;
}

function normalizeParamKey(name: string): string {
    return name.toLowerCase();
}

function buildRepeatedCitationParamName(base: string, suffix: number): string {
    return `${base}-${getAlphabeticSuffix(suffix)}`;
}

function getAlphabeticSuffix(index: number): string {
    let remaining = index;
    let result = '';
    while (remaining > 0) {
        remaining -= 1;
        result = String.fromCodePoint(97 + (remaining % 26)) + result;
        remaining = Math.floor(remaining / 26);
    }
    return result;
}

/**
 * Normalizes spacing around a reference-name override comment.
 *
 * @param value - Entered citation field value.
 * @returns Value with normalized override spacing.
 */
function normalizeNameOverrideSpacing(value: string): string {
    const result = value.replace(
        /\s*<!--\s*([^]*?#\s*[^]*?)\s*-->/gu,
        formatNameOverrideComment,
    );
    return result;
}

/**
 * Formats one reference-name override comment.
 *
 * @param _match - Complete matched comment.
 * @param content - Comment content.
 * @returns Normalized override comment.
 */
function formatNameOverrideComment(_match: string, content: string): string {
    const hashIndex = content.indexOf('#');
    const prefix = content.slice(0, hashIndex).trim();
    const override = content.slice(hashIndex + 1).trim();
    const directive = prefix === '' ? '' : `${prefix} `;
    return ` <!-- ${directive}# ${override} -->`;
}

/**
 * Applies the template's TemplateData order, then a generic fallback.
 *
 * @param template - Citation template name.
 * @param params - Canonical citation parameters.
 * @param metadata - TemplateData metadata.
 * @returns Sorted citation parameters.
 */
function sortCitationParams<T extends CitationParam>(
    template: string,
    params: T[],
    metadata: CitationTemplateData,
): T[] {
    const orderEntries = metadata.paramOrder.map(
        (name, index) => [name, index] as const,
    );
    const templateOrder = new Map(orderEntries);
    let fallbackOrder = CITE_WEB_PARAM_ORDER;
    if (PRINT_CITATION_TEMPLATES.has(normalizeTemplateName(template))) {
        fallbackOrder = CITE_BOOK_PARAM_ORDER;
    }
    const firstIndexByName = getFirstCitationParamIndexes(params);
    const result = params
        .map(function addSortOrder(param, index) {
            const sortOrder = getCitationParamSortOrder(
                param.name,
                templateOrder,
                fallbackOrder,
                metadata.paramOrder.length,
            );
            return {
                groupIndex: firstIndexByName.get(param.name) ?? index,
                index,
                order: sortOrder,
                param,
            };
        })
        .sort(
            (left, right) =>
                left.order - right.order ||
                left.groupIndex - right.groupIndex ||
                left.index - right.index,
        )
        .map((entry) => entry.param);
    return result;
}

function getFirstCitationParamIndexes(
    params: CitationParam[],
): Map<string, number> {
    const result = new Map<string, number>();
    for (const [index, param] of params.entries()) {
        if (!result.has(param.name)) {
            result.set(param.name, index);
        }
    }
    return result;
}

/**
 * Gets the effective sort order for one citation parameter.
 *
 * @param name - Canonical citation parameter name.
 * @param templateOrder - Active template's exact TemplateData order.
 * @param fallbackOrder - Web or print order for additional fields.
 * @param templateSize - Number of template-defined parameters.
 * @returns Parameter sort order.
 */
function getCitationParamSortOrder(
    name: string,
    templateOrder: Map<string, number>,
    fallbackOrder: Map<string, number>,
    templateSize: number,
): number {
    const authorOrder = getAuthorParamOrder(name);
    if (authorOrder != null) {
        return authorOrder;
    }
    const templateIndex = templateOrder.get(name);
    if (templateIndex != null) {
        return templateIndex * PARAM_ORDER_SCALE;
    }
    const titleIndex = templateOrder.get('title');
    if (titleIndex != null && name === 'script-title') {
        return titleIndex * PARAM_ORDER_SCALE + 1;
    }
    const fallbackIndex = fallbackOrder.get(name);
    return fallbackIndex == null
        ? Number.MAX_SAFE_INTEGER
        : (templateSize + 1) * PARAM_ORDER_SCALE + fallbackIndex;
}

/**
 * Keeps every numbered author/interviewee slot in one leading group.
 *
 * @param name - Name to process.
 * @returns Operation result.
 */
export function getAuthorParamOrder(name: string): number | null {
    const match = name.match(/^(last|first|author-link)(\d*)$/u);
    if (match == null) {
        return null;
    }
    const index = Number(match[2] || '1');
    const fieldOrder = ['last', 'first', 'author-link'].indexOf(match[1]);
    return (index - 1) * 3 + fieldOrder;
}

/**
 * Normalizes unambiguous English dates to ISO 8601 precision.
 *
 * @param value - Entered date text.
 * @returns ISO date when the input is unambiguous.
 */
export function normalizeEnglishDate(value: string): string {
    return resolveWikiPolicy('zhwiki').citationDates.normalize(value.trim());
}

/**
 * Derives the APA-style author/date identity and source locator.
 *
 * @param citation - Canonical citation.
 * @param includeInitials - Whether to add the first author's initials.
 * @returns Semantic reference identity.
 */
export function getCitationIdentity(
    citation: CitationTemplate,
    includeInitials: boolean = false,
): CitationIdentity {
    const valueEntries = citation.params.map(function createValueEntry(param) {
        return [param.name, param.value] as const;
    });
    const values = Object.fromEntries(valueEntries);
    const enteredAuthor = getCitationAuthor(values);
    let author = enteredAuthor;
    if (includeInitials) {
        author = addFirstAuthorInitials(enteredAuthor, values);
    }
    const year = getCitationYear(values);
    const locator = getSourceLocator(values);
    const baseName = `${author}, ${year}`;
    const isSourceIdentity = function isSourceIdentity(param: CitationParam) {
        const result =
            SOURCE_IDENTITY_PARAMS.has(param.name) ||
            isCreatorParam(param.name);
        return result;
    };
    const signatureParams = citation.params.filter(isSourceIdentity);
    const signatureValues = signatureParams.map(mapSourceIdentityParam);
    const sourceKey = getSourceIdentityKey(citation.params);
    const sourceSignature =
        sourceKey === ''
            ? JSON.stringify([citation.name, signatureValues])
            : JSON.stringify(['source-url', sourceKey]);
    return { author, baseName, locator, sourceSignature, year };
}

/**
 * Gets the active citation fields that form the visible reference name.
 *
 * @param citation - Canonical citation.
 * @returns Canonical parameter names contributing the author, year, or
 * locator.
 */
export function getCitationNameContributors(
    citation: CitationTemplate,
): Set<string> {
    const entries = citation.params.map(
        (param) => [param.name, param.value] as const,
    );
    const values = Object.fromEntries(entries);
    const author = selectCitationAuthor(values);
    const authorKeys =
        author.keys.length > 2 ? author.keys.slice(0, 1) : author.keys;
    const year = selectCitationYear(values);
    const locator = selectSourceLocator(values);
    return new Set([
        ...authorKeys,
        ...(year == null ? [] : [year.key]),
        ...(locator == null ? [] : [locator.key]),
    ]);
}

/**
 * Checks whether a parameter names a source creator.
 *
 * @param name - Canonical parameter name.
 * @returns Whether the parameter contributes to source identity.
 */
function isCreatorParam(name: string): boolean {
    if (getCitationAuthorIndex(name) != null) {
        return true;
    }
    for (const pattern of CREATOR_PARAM_PATTERNS) {
        if (pattern.test(name)) {
            return true;
        }
    }
    return false;
}

/**
 * Converts one identity parameter to its comparison representation.
 *
 * @param param - Canonical citation parameter.
 * @returns Name and normalized value.
 */
function mapSourceIdentityParam(param: CitationParam): [string, string] {
    if (param.name === 'url') {
        return [param.name, canonicalizeSourceUrl(param.value)];
    }
    return [param.name, cleanValue(param.value)];
}

/**
 * Resolves a shared source key from a citation URL.
 *
 * @param params - Canonical citation parameters.
 * @returns Normalized comment override or actual URL fallback.
 */
function getSourceIdentityKey(params: CitationParam[]): string {
    const url = params.find((param) => param.name === 'url');
    if (url == null) {
        return '';
    }
    const override = extractNameOverride(url.value);
    return canonicalizeSourceUrl(override || url.value);
}

/**
 * Prefixes a structured first author's initials for disambiguation.
 *
 * @param author - Family-name-based author key.
 * @param values - Citation values keyed by canonical name.
 * @returns Author key with initials when available.
 */
function addFirstAuthorInitials(
    author: string,
    values: Record<string, string>,
): string {
    const first = cleanValue(values.first || '');
    const extractInitial = (part: string) => part.match(/\p{L}/u)?.[0];
    const initials = first
        .split(/[\s-]+/u)
        .map(extractInitial)
        .filter((letter) => letter != null)
        .map((letter) => `${letter}.`)
        .join(' ');
    return initials === '' ? author : `${initials} ${author}`;
}

/**
 * Appends an APA-style part-of-source locator to a ref name.
 *
 * @param name - Author/date reference name.
 * @param locator - Part-of-source locator.
 * @returns Reference name with its locator.
 */
export function appendCitationLocator(name: string, locator: string): string {
    return locator === '' ? name : `${name}, ${locator}`;
}

/**
 * Selects the author component using a general CS1 fallback chain.
 *
 * @param values - Citation values keyed by canonical name.
 * @returns Author component for the reference name.
 */
function getCitationAuthor(values: Record<string, string>): string {
    return selectCitationAuthor(values).value;
}

/**
 * Selects the author text together with the fields that supplied it.
 *
 * @param values - Values value.
 * @returns Value.
 */
function selectCitationAuthor(
    values: Record<string, string>,
): CitationAuthorSelection {
    const authors = collectCitationAuthors(values);
    if (authors.length > 0) {
        return {
            keys: authors.map((author) => author.key),
            value: formatAuthorList(
                authors.map((author) => authorNameValue(author.value)),
            ),
        };
    }
    for (const key of CITATION_CREATOR_FALLBACK_KEYS) {
        if (
            values[key]?.trim() &&
            !hasFieldDirective(values[key], 'no-author')
        ) {
            return { keys: [key], value: nameValue(values[key]) };
        }
    }
    return selectCitationTitleAuthor(values);
}

/**
 * Selects a normal or script title as the final fallback.
 *
 * @param values - Values value.
 * @returns Selected normal or script title as the final fallback.
 */
function selectCitationTitleAuthor(
    values: Record<string, string>,
): CitationAuthorSelection {
    const candidates = [
        { key: 'title', value: values.title },
        {
            key: 'script-title',
            value: stripScriptTitleLanguage(values['script-title'] || ''),
        },
    ];
    const selected = candidates.find(
        (candidate) =>
            candidate.value?.trim() &&
            !hasFieldDirective(candidate.value, 'no-author'),
    );
    return selected == null
        ? { keys: [], value: 'Untitled source' }
        : {
              keys: [selected.key],
              value: formatTitleNameFallback(selected.value),
          };
}

/**
 * Applies a title alias before using the shortened quoted fallback.
 *
 * @param title - Wiki title.
 * @returns Resulting text.
 */
function formatTitleNameFallback(title: string): string {
    const override = extractNameOverride(title);
    return override === '' ? formatTitleFallback(title) : cleanValue(override);
}

/**
 * Removes the required language-code prefix from a script title.
 *
 * @param value - Value to process.
 * @returns Resulting text.
 */
function stripScriptTitleLanguage(value: string): string {
    return value.replace(/^[a-z]{2,3}(?:-[a-z0-9]+)*:/iu, '');
}

/**
 * Builds a short reference-name fallback from a citation title.
 *
 * @param title - Entered citation title.
 * @returns Short quoted title or the untitled marker.
 */
function formatTitleFallback(title: string): string {
    const words = cleanValue(title).split(/\s+/u).filter(Boolean);
    const shortened =
        words.length < 3 ? words.join(' ') : words.slice(0, 2).join(' ');
    return shortened === '' ? 'Untitled source' : `“${shortened}”`;
}

/**
 * Collects sequential author, subject, and host values.
 *
 * @param values - Citation values.
 * @returns Creator names in entered order.
 */
function collectCitationAuthors(
    values: Record<string, string>,
): CitationValueSelection[] {
    const result: CitationValueSelection[] = [];
    const indexes = new Set<number>();
    for (const name of Object.keys(values)) {
        const index = getCitationAuthorIndex(name);
        if (index != null) {
            indexes.add(index);
        }
    }
    const sortedIndexes = [...indexes].sort((left, right) => left - right);
    for (const index of sortedIndexes) {
        const candidates = getCitationAuthorCandidates(index);
        const identifiesAuthor = function identifiesAuthor(candidate: string) {
            return (
                values[candidate]?.trim() &&
                !hasFieldDirective(values[candidate], 'no-author')
            );
        };
        const key = candidates.find(identifiesAuthor);
        if (key == null) {
            continue;
        }
        result.push({ key, value: values[key] });
    }
    return result;
}

/**
 * Gets the positive creator position encoded by an author-family field.
 *
 * @param name - Name to process.
 * @returns Operation result.
 */
function getCitationAuthorIndex(name: string): number | null {
    for (const pattern of CITATION_AUTHOR_INDEX_PATTERNS) {
        const match = name.match(pattern);
        if (match == null) {
            continue;
        }
        const index = Number(match[1] || '1');
        return Number.isSafeInteger(index) && index > 0 ? index : null;
    }
    return null;
}

/**
 * Lists accepted author-family parameter spellings for one creator
 * position.
 *
 * @param index - Source index.
 * @returns Value.
 */
function getCitationAuthorCandidates(index: number): string[] {
    const number = String(index);
    const numbered = [
        `author-last${number}`,
        `author${number}-last`,
        `author-surname${number}`,
        `author${number}-surname`,
        `last${number}`,
        `surname${number}`,
        `author${number}`,
        `subject${number}`,
        `host${number}`,
    ];
    if (index > 1) {
        return numbered;
    }
    return [
        'author-last',
        numbered[0],
        numbered[1],
        'author-surname',
        numbered[2],
        numbered[3],
        'last',
        numbered[4],
        'surname',
        numbered[5],
        'author',
        numbered[6],
        'subject',
        numbered[7],
        'host',
        numbered[8],
    ];
}

/**
 * Extracts an explicitly comma-delimited family name for a creator key.
 *
 * @param value - Display citation value or hashtag override.
 * @returns Creator family name when explicitly supplied.
 */
function authorNameValue(value: string): string {
    const name = nameValue(value);
    const family = name.match(/^([^,]+),\s*\S/u)?.[1].trim();
    return family || name;
}

/**
 * Formats one, two, or many authors for an APA-style key.
 *
 * @param authors - Author family names.
 * @returns Formatted author component.
 */
function formatAuthorList(authors: string[]): string {
    if (authors.length === 1) {
        return authors[0];
    }
    if (authors.length === 2) {
        return `${authors[0]} & ${authors[1]}`;
    }
    return `${authors[0]} et al.`;
}

/**
 * Extracts a citation year or the APA no-date marker.
 *
 * @param values - Citation values.
 * @returns Four-digit year or n.d.
 */
function getCitationYear(values: Record<string, string>): string {
    const selected = selectCitationYear(values);
    const entered = selected?.value ?? '';
    const clean = cleanValue(entered);
    return clean.match(/\b(\d{4})\b/u)?.[1] || 'n.d.';
}

/**
 * Selects the first eligible date field.
 *
 * @param values - Values value.
 * @returns Selected the first eligible date field.
 */
function selectCitationYear(
    values: Record<string, string>,
): CitationValueSelection | null {
    for (const key of CITATION_DATE_KEYS) {
        const value = values[key];
        if (value?.trim() && !hasFieldDirective(value, 'no-date')) {
            return { key, value };
        }
    }
    return null;
}

/**
 * Selects a page, time, or interactive-media locator.
 *
 * @param values - Citation values.
 * @returns Part-of-source locator.
 */
function getSourceLocator(values: Record<string, string>): string {
    return selectSourceLocator(values)?.value ?? '';
}

/**
 * Selects and formats the first eligible source locator.
 *
 * @param values - Values value.
 * @returns Selected and formats the first eligible source locator.
 */
function selectSourceLocator(
    values: Record<string, string>,
): CitationValueSelection | null {
    for (const [key, prefix] of SOURCE_LOCATOR_ENTRIES) {
        if (hasFieldDirective(values[key] || '', 'no-part')) {
            continue;
        }
        let value = cleanValue(values[key] || '');
        if (['time', 'timestamp', 'duration'].includes(key)) {
            value = normalizeLocatorTime(value);
        }
        if (value !== '') {
            const formatted = prefix === '' ? value : `${prefix} ${value}`;
            return { key, value: formatted };
        }
    }
    return null;
}

/**
 * Restores colon notation for a time used in a reference name.
 *
 * @param value - Display-formatted citation time.
 * @returns Colon-delimited locator time.
 */
function normalizeLocatorTime(value: string): string {
    const result = value
        .replace(/(\d+)ʰ(\d{2})′(\d{2})″/gu, '$1:$2:$3')
        .replace(/(\d+)′(\d{2})″/gu, '$1:$2');
    return result;
}

/**
 * Removes source-position data from a URL.
 *
 * @param value - Entered source URL.
 * @returns Deterministic URL used only for source comparison.
 */
function canonicalizeSourceUrl(value: string): string {
    const clean = cleanValue(value).replace(/&amp;/gu, '&');
    try {
        const url = new URL(clean);
        url.hash = '';
        for (const name of [...url.searchParams.keys()]) {
            const normalizedName = name.toLowerCase();
            if (POSITION_QUERY_PARAMS.has(normalizedName)) {
                url.searchParams.delete(name);
            }
        }
        url.searchParams.sort();
        return url.toString();
    } catch {
        return clean.replace(/#.*$/u, '');
    }
}

/**
 * Applies a hashtag-comment reference-name override.
 *
 * @param value - Display citation value.
 * @returns Value used in the reference name.
 */
function nameValue(value: string): string {
    const override = extractNameOverride(value);
    return cleanValue(override || value) || 'Untitled source';
}

/**
 * Extracts a hashtag reference-name override from comments.
 *
 * @param value - Citation field value.
 * @returns Entered override, if present.
 */
function extractNameOverride(value: string): string {
    const comments = value.matchAll(/<!--([\s\S]*?)-->/gu);
    for (const comment of comments) {
        const hashIndex = comment[1].indexOf('#');
        if (hashIndex >= 0) {
            return comment[1].slice(hashIndex + 1).trim();
        }
    }
    return '';
}

/**
 * Checks whether a citation field comment contains a directive.
 *
 * @param value - Citation field value.
 * @param directive - Directive name without the leading
 *   exclamation mark.
 * @returns Whether the directive is present.
 */
function hasFieldDirective(value: string, directive: string): boolean {
    const comments = value.matchAll(/<!--([\s\S]*?)-->/gu);
    const token = `!${directive}`;
    for (const comment of comments) {
        const words = comment[1].split(/\s+/u);
        if (words.includes(token)) {
            return true;
        }
    }
    return false;
}

/**
 * Removes common wikitext markup from a reference-name value.
 *
 * @param value - Wikitext value.
 * @returns Plain compact text.
 */
export function cleanValue(value: string): string {
    const result = value
        .replace(/<!--[\s\S]*?-->/gu, '')
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/gu, '$2')
        .replace(/\[\[([^\]]+)\]\]/gu, '$1')
        .replace(/'{2,}/gu, '')
        .replace(/<[^>]+>/gu, '')
        .replace(/\s+/gu, ' ')
        .trim();
    return result;
}

/**
 * Maps canonical parameter names and aliases to canonical names.
 *
 * @param metadata - TemplateData metadata.
 * @returns Case-normalized canonical-name map.
 */
function buildCanonicalNameMap(
    metadata: CitationTemplateData,
): Map<string, string> {
    const result = new Map<string, string>();
    const aliasNames = Object.keys(metadata.aliases);
    const canonicalNames = new Set([...metadata.paramOrder, ...aliasNames]);
    for (const canonical of canonicalNames) {
        const normalizedCanonical = canonical.toLowerCase();
        const representative = result.get(normalizedCanonical) ?? canonical;
        if (!result.has(normalizedCanonical)) {
            result.set(normalizedCanonical, representative);
        }
        addCanonicalAliases(
            result,
            representative,
            metadata.aliases[canonical],
        );
    }
    addNumberedAuthorAliases(result, canonicalNames);
    return result;
}

/**
 * Adds numbered author aliases for canonical family-name parameters.
 *
 * @param names - Mutable canonical-name map.
 * @param canonicalNames - Available canonical parameter names.
 */
function addNumberedAuthorAliases(
    names: Map<string, string>,
    canonicalNames: Set<string>,
): void {
    for (const canonical of canonicalNames) {
        let authorIndex: string | undefined;
        if (canonical === 'last') {
            authorIndex = '1';
        } else {
            const numberedLast = canonical.match(/^last([1-9]\d*)$/u)?.[1];
            if (numberedLast != null && numberedLast !== '1') {
                authorIndex = numberedLast;
            }
        }
        if (authorIndex != null) {
            names.set(`author${authorIndex}`, canonical);
        }
    }
}

/**
 * Adds case-normalized aliases for one canonical citation parameter.
 *
 * @param names - Mutable canonical-name map.
 * @param canonical - Canonical parameter name.
 * @param aliases - Configured aliases.
 */
function addCanonicalAliases(
    names: Map<string, string>,
    canonical: string,
    aliases: string[] | undefined,
): void {
    for (const alias of aliases || []) {
        const normalizedAlias = alias.toLowerCase();
        if (!names.has(normalizedAlias)) {
            names.set(normalizedAlias, canonical);
        }
    }
}
