/**
 * @file src/source-editor/domain/source-validation.ts
 * Purpose: Validation for editable CS1 citation parameters.
 *
 * Table of contents:
 * 1. Imports
 * 2. SourceDraftLike
 * 3. SourceDraftRowLike
 * 4. SourceDraftRowErrors
 * 5. SourceDraftErrors
 * 6. SourceValidationMessages
 * 7. Constants and state
 * 8. getSourceDraftErrors
 * 9. getValidationTemplateData
 * 10. validateDraftRelationships
 * 11. DraftRowValidationContext
 * 12. validateDraftRow
 * 13. validateDraftRowName
 * 14. isSafeDraftParameterName
 * 15. validateDraftRowAlias
 * 16. validateDraftRowValue
 * 17. addCellError
 * 18. buildGlobalSupportedNames
 * 19. buildGlobalCanonicalNames
 * 20. normalizeParameterName
 * 21. ArchiveValidationContext
 * 22. validateArchivePair
 * 23. getTrimmedValue
 * 24. MissingArchiveField
 * 25. addMissingArchiveError
 * 26. validateParameterDependencies
 * 27. validateDynamicDependency
 * 28. buildDraftRowIndex
 * 29. DependencyValidationContext
 * 30. validateDependency
 * 31. isValidCitationDate
 * 32. isValidChineseDate
 * 33. isValidIsoDate
 * 34. isValidEnglishDate
 * 35. isValidNamedMonthDate
 */

import { resolveWikiPolicy, type WikiPolicy } from './wiki-policy.ts';
import { isCalendarDayWithinUtcMonth } from './calendar-date.ts';
import { citationTemplateData as templateData } from '../config/citation-template-data/index.ts';
import { getCitationValidationConfig } from './validation/index.ts';

interface SourceDraftLike {
    rows: SourceDraftRowLike[];
    template: string;
}

interface SourceDraftRowLike {
    alias: string;
    name: string;
    value: string;
}

export interface SourceDraftRowErrors {
    alias?: string;
    name?: string;
    value?: string;
}

export type SourceDraftErrors = Map<number, SourceDraftRowErrors>;

/**
 * Defines validation messages without coupling the domain to a locale.
 */
export interface SourceValidationMessages {
    addParameter(message: string, parameter: string): string;
    aliasRequiresValue(): string;
    archiveDateRequiresUrl(): string;
    archiveUrlRequiresDate(): string;
    dependency(source: string, targets: string[]): string;
    dependencyWithParameter(
        source: string,
        targets: string[],
        parameter: string,
    ): string;
    invalidDate(parameter: string): string;
    invalidParameterName(): string;
    parameterRequired(): string;
    unsupportedParameter(parameter: string): string;
}

const ENGLISH_VALIDATION_MESSAGES: SourceValidationMessages = {
    addParameter(message, parameter) {
        return `${message} Add the ${parameter} parameter.`;
    },
    aliasRequiresValue() {
        return 'Enter the original text before setting reference-name text.';
    },
    archiveDateRequiresUrl() {
        return 'Add an archive URL for the archive date.';
    },
    archiveUrlRequiresDate() {
        return 'Add a date for the archive URL.';
    },
    dependency(source, targets) {
        return `${source} requires ${targets.join(' or ')}.`;
    },
    dependencyWithParameter(source, targets, parameter) {
        const message = `${source} requires ${targets.join(' or ')}.`;
        return `${message} Add the ${parameter} parameter.`;
    },
    invalidDate(parameter) {
        return `Enter a correct date for ${parameter}.`;
    },
    invalidParameterName() {
        return (
            'Enter a parameter name without wikitext markup ' +
            'or line breaks.'
        );
    },
    parameterRequired() {
        return 'Enter a parameter name.';
    },
    unsupportedParameter(parameter) {
        return `CS1 does not support the ${parameter} parameter.`;
    },
};

const CS1_DATE_PARAMETERS = [
    'access-date',
    'archive-date',
    'date',
    'doi-broken-date',
    'embargo',
    'lay-date',
    'orig-date',
    'pmc-embargo-date',
    'publication-date',
    'year',
] as const;
const ENGLISH_MONTH_NAMES: Array<[string, number]> = [
    ['january', 1],
    ['february', 2],
    ['march', 3],
    ['april', 4],
    ['may', 5],
    ['june', 6],
    ['july', 7],
    ['august', 8],
    ['september', 9],
    ['october', 10],
    ['november', 11],
    ['december', 12],
];
const ENGLISH_MONTHS = new Map(
    ENGLISH_MONTH_NAMES.flatMap(function addAbbreviation([name, month]) {
        return [
            [name, month],
            [name.slice(0, 3), month],
        ] as Array<[string, number]>;
    }),
);
const SEASONS = /^(?:spring|summer|autumn|fall|winter)\s+[1-9]\d{3}$/iu;
const GLOBAL_CANONICAL_NAMES = buildGlobalCanonicalNames();
const GLOBAL_SUPPORTED_NAMES = buildGlobalSupportedNames();
const PARAMETER_DEPENDENCIES = [
    { source: 'access-date', targets: ['url'] },
    { source: 'archive-url', targets: ['url'] },
    { source: 'asin-tld', targets: ['asin'] },
    { source: 'doi-broken-date', targets: ['doi'] },
    { source: 'format', targets: ['url'] },
    { source: 'pmc-embargo-date', targets: ['pmc'] },
] as const;

/**
 * Returns cell-level errors for an editable source draft.
 *
 * @param draft - Source draft to process.
 * @param wikiId - Wiki id value.
 * @param messages - Messages value.
 * @returns Cell-level errors for an editable source draft.
 */
export function getSourceDraftErrors(
    draft: SourceDraftLike,
    wikiId: string,
    messages: SourceValidationMessages = ENGLISH_VALIDATION_MESSAGES,
): SourceDraftErrors {
    const config = getCitationValidationConfig(wikiId);
    const metadataFree = !Object.hasOwn(templateData, draft.template);
    const metadata = getValidationTemplateData(draft.template, metadataFree);
    const canonicalNames = GLOBAL_CANONICAL_NAMES;
    const supportedNames = new Set([
        ...GLOBAL_SUPPORTED_NAMES,
        ...config.additionalParameters.map(normalizeParameterName),
    ]);
    const dateNames = new Set([
        ...(metadataFree ? [] : CS1_DATE_PARAMETERS),
        ...(metadata?.dateParams ?? []),
    ]);
    const numberedNames = new Set(config.numberedParameters);
    const errors: SourceDraftErrors = new Map();
    for (const [index, row] of draft.rows.entries()) {
        validateDraftRow(row, index, errors, {
            canonicalNames,
            dateNames,
            dateStyle: config.dateStyle,
            wikiPolicy: resolveWikiPolicy(wikiId),
            metadataFree,
            messages,
            numberedNames,
            supportedNames,
        });
    }
    validateDraftRelationships(
        draft,
        metadataFree,
        canonicalNames,
        errors,
        messages,
    );
    return errors;
}

function getValidationTemplateData(template: string, metadataFree: boolean) {
    return metadataFree
        ? null
        : (templateData[template] ?? templateData['cite web']);
}

function validateDraftRelationships(
    draft: SourceDraftLike,
    metadataFree: boolean,
    canonicalNames: Map<string, string>,
    errors: SourceDraftErrors,
    messages: SourceValidationMessages,
): void {
    if (metadataFree) {
        return;
    }
    validateArchivePair(draft.rows, { canonicalNames, errors, messages });
    validateParameterDependencies(draft.rows, canonicalNames, errors, messages);
}

interface DraftRowValidationContext {
    canonicalNames: Map<string, string>;
    dateNames: Set<string>;
    dateStyle: 'english' | 'chinese';
    wikiPolicy: WikiPolicy;
    metadataFree: boolean;
    messages: SourceValidationMessages;
    numberedNames: Set<string>;
    supportedNames: Set<string>;
}

/**
 * Validates the three editable cells in one parameter row.
 *
 * @param row - Row value.
 * @param index - Source index.
 * @param errors - Errors value.
 * @param context - Context value.
 */
function validateDraftRow(
    row: SourceDraftRowLike,
    index: number,
    errors: SourceDraftErrors,
    context: DraftRowValidationContext,
): void {
    const name = normalizeParameterName(row.name);
    const hasContent = row.value.trim() !== '' || row.alias.trim() !== '';
    if (name === '' && hasContent) {
        addCellError(
            errors,
            index,
            'name',
            context.messages.parameterRequired(),
        );
        return;
    }
    validateDraftRowName(row, index, errors, context);
    validateDraftRowAlias(row, index, errors, context.messages);
    validateDraftRowValue(row, index, errors, context);
}

function validateDraftRowName(
    row: SourceDraftRowLike,
    index: number,
    errors: SourceDraftErrors,
    context: DraftRowValidationContext,
): void {
    const name = normalizeParameterName(row.name);
    if (name !== '' && !isSafeDraftParameterName(row.name)) {
        addCellError(
            errors,
            index,
            'name',
            context.messages.invalidParameterName(),
        );
        return;
    }
    const numberedName = name.replace(/\d+/gu, '#');
    const supported =
        context.metadataFree ||
        context.supportedNames.has(name) ||
        context.numberedNames.has(numberedName);
    if (name !== '' && !supported) {
        const message = context.messages.unsupportedParameter(row.name.trim());
        addCellError(errors, index, 'name', message);
    }
}

function isSafeDraftParameterName(value: string): boolean {
    // Reject control characters that cannot form a safe wikitext name.
    // eslint-disable-next-line no-control-regex
    return !/[#<>[\]|{}=\u0000-\u001f\u007f]/u.test(value.trim());
}

function validateDraftRowAlias(
    row: SourceDraftRowLike,
    index: number,
    errors: SourceDraftErrors,
    messages: SourceValidationMessages,
): void {
    if (row.alias.trim() !== '' && row.value.trim() === '') {
        const message = messages.aliasRequiresValue();
        addCellError(errors, index, 'alias', message);
    }
}

function validateDraftRowValue(
    row: SourceDraftRowLike,
    index: number,
    errors: SourceDraftErrors,
    context: DraftRowValidationContext,
): void {
    const name = normalizeParameterName(row.name);
    const canonical = context.canonicalNames.get(name) ?? name;
    const invalidDate =
        row.value.trim() !== '' &&
        context.wikiPolicy.id !== 'generic' &&
        context.dateNames.has(canonical) &&
        !isValidCitationDate(row.value, context.dateStyle, canonical);
    if (invalidDate) {
        addCellError(
            errors,
            index,
            'value',
            context.messages.invalidDate(canonical),
        );
    }
}

/**
 * Adds a message without hiding a more specific earlier error.
 *
 * @param errors - Errors value.
 * @param index - Source index.
 * @param cell - Cell value.
 * @param message - Message value.
 */
function addCellError(
    errors: SourceDraftErrors,
    index: number,
    cell: keyof SourceDraftRowErrors,
    message: string,
): void {
    const row = errors.get(index) ?? {};
    row[cell] ??= message;
    errors.set(index, row);
}

/**
 * Builds the shared CS1 whitelist from all generated TemplateData.
 *
 * @returns Shared CS1 whitelist from generated TemplateData.
 */
function buildGlobalSupportedNames(): Set<string> {
    const names = new Set<string>();
    for (const metadata of Object.values(templateData)) {
        for (const name of metadata.paramOrder) {
            names.add(normalizeParameterName(name));
        }
        for (const [canonical, aliases] of Object.entries(metadata.aliases)) {
            names.add(normalizeParameterName(canonical));
            for (const alias of aliases) {
                names.add(normalizeParameterName(alias));
            }
        }
    }
    return names;
}

/**
 * Maps all generated TemplateData aliases to canonical parameters.
 *
 * @returns Value.
 */
function buildGlobalCanonicalNames(): Map<string, string> {
    const result = new Map<string, string>();
    for (const metadata of Object.values(templateData)) {
        for (const [canonical, aliases] of Object.entries(metadata.aliases)) {
            const normalizedCanonical = normalizeParameterName(canonical);
            result.set(normalizedCanonical, normalizedCanonical);
            for (const alias of aliases) {
                result.set(normalizeParameterName(alias), normalizedCanonical);
            }
        }
    }
    return result;
}

function normalizeParameterName(name: string): string {
    return name.trim().toLowerCase();
}

/** Validates the paired archive fields and marks the missing field. */
interface ArchiveValidationContext {
    canonicalNames: Map<string, string>;
    errors: SourceDraftErrors;
    messages: SourceValidationMessages;
}

function validateArchivePair(
    rows: SourceDraftRowLike[],
    context: ArchiveValidationContext,
): void {
    const byName = new Map<string, number>();
    for (const [index, row] of rows.entries()) {
        const name = normalizeParameterName(row.name);
        byName.set(context.canonicalNames.get(name) ?? name, index);
    }
    const archiveUrlIndex = byName.get('archive-url');
    const archiveDateIndex = byName.get('archive-date');
    const archiveUrl = getTrimmedValue(rows, archiveUrlIndex);
    const archiveDate = getTrimmedValue(rows, archiveDateIndex);
    if (archiveUrl !== '' && archiveDate === '') {
        addMissingArchiveError(context, {
            fallbackIndex: archiveUrlIndex,
            message: context.messages.archiveUrlRequiresDate(),
            missingName: 'archive-date',
            preferredIndex: archiveDateIndex,
        });
    }
    if (archiveDate !== '' && archiveUrl === '') {
        addMissingArchiveError(context, {
            fallbackIndex: archiveDateIndex,
            message: context.messages.archiveDateRequiresUrl(),
            missingName: 'archive-url',
            preferredIndex: archiveUrlIndex,
        });
    }
}

function getTrimmedValue(
    rows: SourceDraftRowLike[],
    index: number | undefined,
): string {
    return index == null ? '' : (rows[index]?.value.trim() ?? '');
}

interface MissingArchiveField {
    fallbackIndex: number | undefined;
    message: string;
    missingName: string;
    preferredIndex: number | undefined;
}

function addMissingArchiveError(
    context: ArchiveValidationContext,
    field: MissingArchiveField,
): void {
    if (field.preferredIndex != null) {
        addCellError(
            context.errors,
            field.preferredIndex,
            'value',
            field.message,
        );
    } else if (field.fallbackIndex != null) {
        addCellError(
            context.errors,
            field.fallbackIndex,
            'value',
            context.messages.addParameter(field.message, field.missingName),
        );
    }
}

/**
 * Validates CS1 parameters that depend on another parameter.
 *
 * @param rows - Rows value.
 * @param canonicalNames - Canonical names value.
 * @param errors - Errors value.
 * @param messages - Messages value.
 */
function validateParameterDependencies(
    rows: SourceDraftRowLike[],
    canonicalNames: Map<string, string>,
    errors: SourceDraftErrors,
    messages: SourceValidationMessages,
): void {
    const byName = buildDraftRowIndex(rows, canonicalNames);
    const context = { byName, errors, messages, rows };
    for (const dependency of PARAMETER_DEPENDENCIES) {
        validateDependency(context, dependency.source, [...dependency.targets]);
    }
    for (const [name, index] of byName) {
        if (getTrimmedValue(rows, index) === '') {
            continue;
        }
        validateDynamicDependency(context, name);
    }
}

/**
 * Validates dependencies encoded in a parameter name.
 *
 * @param context - Context value.
 * @param name - Name to process.
 */
function validateDynamicDependency(
    context: DependencyValidationContext,
    name: string,
): void {
    if (name.endsWith('-access')) {
        validateDependency(context, name, [name.slice(0, -'-access'.length)]);
    }
    if (name.endsWith('-format')) {
        const base = name.slice(0, -'-format'.length);
        validateDependency(context, name, [`${base}-url`]);
    }
    if (name.startsWith('trans-')) {
        const base = name.slice('trans-'.length);
        validateDependency(context, name, [base, `script-${base}`]);
    }
}

function buildDraftRowIndex(
    rows: SourceDraftRowLike[],
    canonicalNames: Map<string, string>,
): Map<string, number> {
    const byName = new Map<string, number>();
    for (const [index, row] of rows.entries()) {
        const name = normalizeParameterName(row.name);
        byName.set(canonicalNames.get(name) ?? name, index);
    }
    return byName;
}

interface DependencyValidationContext {
    byName: Map<string, number>;
    errors: SourceDraftErrors;
    messages: SourceValidationMessages;
    rows: SourceDraftRowLike[];
}

function validateDependency(
    context: DependencyValidationContext,
    sourceName: string,
    targetNames: string[],
): void {
    const sourceIndex = context.byName.get(sourceName);
    if (
        getTrimmedValue(context.rows, sourceIndex) === '' ||
        targetNames.some(
            (name) =>
                getTrimmedValue(context.rows, context.byName.get(name)) !== '',
        )
    ) {
        return;
    }
    const targetIndex = targetNames
        .map((name) => context.byName.get(name))
        .find((index) => index != null);
    const source = `|${sourceName}=`;
    const targets = targetNames.map((name) => `|${name}=`);
    const message = context.messages.dependency(source, targets);
    addCellError(
        context.errors,
        targetIndex ?? sourceIndex ?? 0,
        'value',
        targetIndex == null
            ? context.messages.dependencyWithParameter(
                  source,
                  targets,
                  targetNames[0],
              )
            : message,
    );
}

/**
 * Recognizes unambiguous date forms accepted by the two CS1 sites.
 *
 * @param entered - Entered value.
 * @param style - Style value.
 * @param canonicalName - Canonical name value.
 * @returns Whether the condition is met.
 */
function isValidCitationDate(
    entered: string,
    style: 'english' | 'chinese',
    canonicalName: string,
): boolean {
    const value = entered
        .replace(/<!--[\s\S]*?-->/gu, '')
        .trim()
        .replace(/\s+/gu, ' ');
    if (value === '') {
        return true;
    }
    if (/[{}[\]<>]/u.test(value)) {
        return true;
    }
    if (canonicalName === 'date' && /^(?:n\.d\.|nd)$/iu.test(value)) {
        return true;
    }
    const requireDay =
        canonicalName === 'access-date' || canonicalName === 'archive-date';
    if (!requireDay && (/^[1-9]\d{3}$/u.test(value) || SEASONS.test(value))) {
        return true;
    }
    const range = value.match(/^([1-9]\d{3})\s*[–—]\s*([1-9]\d{3})$/u);
    if (!requireDay && range != null) {
        return Number(range[1]) <= Number(range[2]);
    }
    if (style === 'chinese' && isValidChineseDate(value, requireDay)) {
        return true;
    }
    return (
        isValidIsoDate(value, style === 'chinese' && !requireDay) ||
        isValidEnglishDate(value, requireDay)
    );
}

function isValidChineseDate(value: string, requireDay: boolean): boolean {
    const match = value.match(
        /^([1-9]\d{3})年(?:(\d{1,2})月(?:(\d{1,2})日)?)?$/u,
    );
    if (match == null) {
        return false;
    }
    if (requireDay && match[3] == null) return false;
    const month = match[2] == null ? 1 : Number(match[2]);
    const day = match[3] == null ? 1 : Number(match[3]);
    return isCalendarDayWithinUtcMonth(match[1], month, day);
}

function isValidIsoDate(value: string, allowMonth: boolean): boolean {
    const match = value.match(/^([1-9]\d{3})-(\d{2})(?:-(\d{2}))?$/u);
    if (match == null) {
        return false;
    }
    if (Number(match[1]) < 1583 || (!allowMonth && match[3] == null))
        return false;
    return isCalendarDayWithinUtcMonth(match[1], match[2], match[3] ?? '1');
}

function isValidEnglishDate(value: string, requireDay: boolean): boolean {
    const monthFirst = value.match(
        /^([A-Za-z]+)\s+(?:(\d{1,2}),\s*)?([1-9]\d{3})$/u,
    );
    if (monthFirst != null) {
        if (requireDay && monthFirst[2] == null) return false;
        return isValidNamedMonthDate(
            monthFirst[3],
            monthFirst[1],
            monthFirst[2] ?? '1',
        );
    }
    const dayFirst = value.match(/^(\d{1,2})\s+([A-Za-z]+)\s+([1-9]\d{3})$/u);
    return (
        dayFirst != null &&
        isValidNamedMonthDate(dayFirst[3], dayFirst[2], dayFirst[1])
    );
}

function isValidNamedMonthDate(
    year: string,
    monthName: string,
    day: string,
): boolean {
    const month = ENGLISH_MONTHS.get(monthName.toLowerCase());
    return month != null && isCalendarDayWithinUtcMonth(year, month, day);
}
