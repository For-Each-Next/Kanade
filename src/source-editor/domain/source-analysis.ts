/**
 * @file src/source-editor/domain/source-analysis.ts
 * Purpose: Article-wide citation summaries and opt-in consistency replacements.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. SourceAnalysisFindingCategory
 * 4. SourceAnalysisCell
 * 5. SourceAnalysisValue
 * 6. SourceAnalysisOccurrence
 * 7. SourceAnalysisFinding
 * 8. CitationSourceAnalysis
 * 9. SourceAnalysisMessages
 * 10. SourceAnalysisReplacement
 * 11. FieldOccurrence
 * 12. analyzeCitationSources
 * 13. applySourceAnalysisReplacements
 * 14. findDomainFieldInconsistencies
 * 15. groupDomainFieldOccurrences
 * 16. buildDomainFieldFinding
 * 17. getDomainFieldCategory
 * 18. findAuthorFormattingInconsistencies
 * 19. groupAuthorOccurrences
 * 20. buildAuthorFinding
 * 21. findAliasInconsistencies
 * 22. groupAliasOccurrences
 * 23. getAliasParameterFamily
 * 24. getAliasSubjectIdentity
 * 25. buildAliasOccurrence
 * 26. buildAliasFinding
 * 27. countAliasValues
 * 28. buildAnalysisOccurrence
 * 29. getSourceDomain
 * 30. countOccurrenceValues
 * 31. countAnalysisValues
 * 32. normalizeDisplayValue
 * 33. normalizeParameterName
 * 34. groupSourceAnalysisReplacements
 * 35. isEmptySourceAnalysisReplacement
 * 36. registerSourceAnalysisReplacement
 * 37. assertCurrentSource
 * 38. cloneSourceDraft
 * 39. applyDraftReplacements
 */

import { cleanValue } from './citation.ts';
import {
    serializeSourceDraftPreservingNames,
    type ExistingSource,
    type SourceDraft,
} from './source-manager.ts';
import { normalizeSourceUrl } from './source-url.ts';
import { getCanonicalTemplateNameFromKey } from './templates.ts';
import { applyReplacements } from './wikitext.ts';

const PUBLICATION_PARAMETERS = new Set([
    'journal',
    'magazine',
    'newspaper',
    'periodical',
    'website',
    'work',
]);
const ALIAS_ORGANIZATION_PARAMETERS = new Set([
    'agency',
    'department',
    'institution',
    'organization',
    'publisher',
]);
const CREATOR_PARAMETER_PREFIX =
    '^(?:author|last|editor|interviewer|contributor|translator|' +
    'host|developer|user)';
const SUMMARY_CREATOR_PARAMETER = new RegExp(
    `${CREATOR_PARAMETER_PREFIX}(?:\\d*|(?:-last\\d*|\\d+-last))$`,
    'u',
);
const REPLACEABLE_AUTHOR_PARAMETER = new RegExp(
    `${CREATOR_PARAMETER_PREFIX}\\d*$`,
    'u',
);

export type SourceAnalysisFindingCategory =
    'alias' | 'author' | 'publication' | 'publisher';

export type SourceAnalysisCell = 'alias' | 'value';

export interface SourceAnalysisValue {
    count: number;
    value: string;
}

export interface SourceAnalysisOccurrence {
    cell: SourceAnalysisCell;
    displayValue: string;
    id: string;
    parameter: string;
    referenceName: string;
    rowIndex: number;
    sourceId: string;
    template: string;
    title: string;
    value: string;
}

export interface SourceAnalysisFinding {
    category: SourceAnalysisFindingCategory;
    domain: string;
    id: string;
    label: string;
    occurrences: SourceAnalysisOccurrence[];
    options: SourceAnalysisValue[];
    reason: string;
    subject: string;
    suggestedValue: string;
}

export interface CitationSourceAnalysis {
    findings: SourceAnalysisFinding[];
}

/**
 * Supplies locale-specific analysis labels, explanations, and errors.
 */
export interface SourceAnalysisMessages {
    aliasLabel(sourceKey: boolean, value: string): string;
    aliasReason(sourceKey: boolean, hasMissing: boolean): string;
    authorLabel(author: string): string;
    authorReason(): string;
    domainLabel(category: 'publication' | 'publisher', domain: string): string;
    domainReason(sameDisplayValue: boolean): string;
    fieldChanged(): string;
    replacementConflict(): string;
    sourceChanged(): string;
    sourceMissing(): string;
    untitledSource(): string;
}

export interface SourceAnalysisReplacement {
    cell: SourceAnalysisCell;
    oldValue: string;
    parameter: string;
    replacement: string;
    rowIndex: number;
    sourceId: string;
}

interface FieldOccurrence extends SourceAnalysisOccurrence {
    category: 'publication' | 'publisher';
    domain: string;
}

const ENGLISH_ANALYSIS_MESSAGES: SourceAnalysisMessages = {
    aliasLabel(sourceKey, value) {
        const label = sourceKey ? 'Source key' : 'Reference-name text';
        return `${label} · ${value}`;
    },
    aliasReason(sourceKey, hasMissing) {
        if (sourceKey) {
            return hasMissing
                ? 'Some repeated uses have a source key and others do not.'
                : 'Repeated uses have different source-key comments.';
        }
        return hasMissing
            ? 'Some repeated uses have reference-name text and others do not.'
            : 'Repeated uses have different reference-name text.';
    },
    authorLabel(author) {
        return `Author formatting · ${author}`;
    },
    authorReason() {
        return (
            'The same author name uses different wikitext, link, case, or ' +
            'spacing style.'
        );
    },
    domainLabel(category, domain) {
        const field =
            category === 'publication' ? 'Website or work' : 'Publisher';
        return `${domain} · ${field}`;
    },
    domainReason(sameDisplayValue) {
        return sameDisplayValue
            ? 'Only link, case, spacing, or wikitext style differs.'
            : 'Citations for the same website use different names.';
    },
    fieldChanged() {
        return (
            'A selected citation field changed after the check opened. ' +
            'Run the check again.'
        );
    },
    replacementConflict() {
        return (
            'One citation field has more than one replacement. Review the ' +
            'selections and apply them again.'
        );
    },
    sourceChanged() {
        return (
            'A citation source changed after the check opened. Run the ' +
            'check again.'
        );
    },
    sourceMissing() {
        return (
            'A selected citation source is no longer present. Run the ' +
            'check again.'
        );
    },
    untitledSource() {
        return 'Untitled source';
    },
};

/**
 * Builds summary counts and likely formatting inconsistencies.
 *
 * @param enteredSources - Entered sources value.
 * @param messages - Messages value.
 * @returns Built summary counts and likely formatting inconsistencies.
 */
export function analyzeCitationSources(
    enteredSources: ExistingSource[],
    messages: SourceAnalysisMessages = ENGLISH_ANALYSIS_MESSAGES,
): CitationSourceAnalysis {
    const sources = enteredSources.filter(
        (source) => source.status === 'standard',
    );
    return {
        findings: [
            ...findDomainFieldInconsistencies(sources, messages),
            ...findAuthorFormattingInconsistencies(sources, messages),
            ...findAliasInconsistencies(sources, messages),
        ],
    };
}

/**
 * Applies selected replacements and preserves unselected sources.
 *
 * @param text - Text to process.
 * @param sources - Sources value.
 * @param replacements - Source replacements.
 * @param messages - Messages value.
 * @returns Resulting text.
 */
export function applySourceAnalysisReplacements(
    text: string,
    sources: ExistingSource[],
    replacements: SourceAnalysisReplacement[],
    messages: SourceAnalysisMessages = ENGLISH_ANALYSIS_MESSAGES,
): string {
    const sourcesById = new Map(sources.map((source) => [source.id, source]));
    const replacementsBySource = groupSourceAnalysisReplacements(
        replacements,
        messages,
    );
    const textReplacements = [];
    for (const [sourceId, selected] of replacementsBySource) {
        const source = sourcesById.get(sourceId);
        if (source == null) {
            throw new Error(messages.sourceMissing());
        }
        assertCurrentSource(text, source, messages);
        const draft = cloneSourceDraft(source.draft);
        applyDraftReplacements(draft, selected, messages);
        const layout = source.rawTemplate.includes('\n') ? 'block' : 'inline';
        textReplacements.push({
            end: source.templateEnd,
            start: source.templateStart,
            text: serializeSourceDraftPreservingNames(draft, layout),
        });
    }
    return applyReplacements(text, textReplacements);
}

/**
 * Finds publication and publisher variants for each exact URL host.
 *
 * @param sources - Sources value.
 * @param messages - Messages value.
 * @returns Publication and publisher variants for each exact URL host.
 */
function findDomainFieldInconsistencies(
    sources: ExistingSource[],
    messages: SourceAnalysisMessages,
): SourceAnalysisFinding[] {
    const grouped = groupDomainFieldOccurrences(sources, messages);
    return [...grouped.values()].flatMap((occurrences) =>
        buildDomainFieldFinding(occurrences, messages),
    );
}

function groupDomainFieldOccurrences(
    sources: ExistingSource[],
    messages: SourceAnalysisMessages,
): Map<string, FieldOccurrence[]> {
    const grouped = new Map<string, FieldOccurrence[]>();
    for (const source of sources) {
        const domain = getSourceDomain(source);
        if (domain === '') {
            continue;
        }
        for (const [rowIndex, row] of source.draft.rows.entries()) {
            const parameter = normalizeParameterName(row.name);
            const category = getDomainFieldCategory(parameter);
            if (category == null || row.value.trim() === '') {
                continue;
            }
            const occurrence = buildAnalysisOccurrence(
                source,
                rowIndex,
                parameter,
                row.value.trim(),
                messages,
            );
            const key = `${category}\u0000${domain}`;
            const matches = grouped.get(key) ?? [];
            matches.push({ ...occurrence, category, domain });
            grouped.set(key, matches);
        }
    }
    return grouped;
}

function buildDomainFieldFinding(
    occurrences: FieldOccurrence[],
    messages: SourceAnalysisMessages,
): SourceAnalysisFinding[] {
    const options = countOccurrenceValues(occurrences);
    if (options.length < 2) {
        return [];
    }
    const { category, domain } = occurrences[0];
    const displayValues = new Set(
        options.map((option) => normalizeDisplayValue(option.value)),
    );
    return [
        {
            category,
            domain,
            id: `${category}:${domain}`,
            label: messages.domainLabel(category, domain),
            occurrences,
            options,
            reason: messages.domainReason(displayValues.size === 1),
            subject: domain,
            suggestedValue: options[0].value,
        },
    ];
}

function getDomainFieldCategory(
    parameter: string,
): 'publication' | 'publisher' | null {
    if (PUBLICATION_PARAMETERS.has(parameter)) {
        return 'publication';
    }
    return parameter === 'publisher' ? 'publisher' : null;
}

/**
 * Finds repeated author text with differing presentation markup.
 *
 * @param sources - Sources value.
 * @param messages - Messages value.
 * @returns Repeated author text with differing presentation markup.
 */
function findAuthorFormattingInconsistencies(
    sources: ExistingSource[],
    messages: SourceAnalysisMessages,
): SourceAnalysisFinding[] {
    const grouped = groupAuthorOccurrences(sources, messages);
    return [...grouped.entries()].flatMap((entry) =>
        buildAuthorFinding(entry, messages),
    );
}

function groupAuthorOccurrences(
    sources: ExistingSource[],
    messages: SourceAnalysisMessages,
): Map<string, SourceAnalysisOccurrence[]> {
    const grouped = new Map<string, SourceAnalysisOccurrence[]>();
    for (const source of sources) {
        for (const [rowIndex, row] of source.draft.rows.entries()) {
            const parameter = normalizeParameterName(row.name);
            const value = row.value.trim();
            if (!REPLACEABLE_AUTHOR_PARAMETER.test(parameter) || value === '') {
                continue;
            }
            const identity = normalizeDisplayValue(value);
            const occurrences = grouped.get(identity) ?? [];
            occurrences.push(
                buildAnalysisOccurrence(
                    source,
                    rowIndex,
                    parameter,
                    value,
                    messages,
                ),
            );
            grouped.set(identity, occurrences);
        }
    }
    return grouped;
}

function buildAuthorFinding(
    [identity, occurrences]: [string, SourceAnalysisOccurrence[]],
    messages: SourceAnalysisMessages,
): SourceAnalysisFinding[] {
    const options = countOccurrenceValues(occurrences);
    if (identity === '' || options.length < 2) {
        return [];
    }
    const display = cleanValue(options[0].value);
    return [
        {
            category: 'author',
            domain: '',
            id: `author:${identity}`,
            label: messages.authorLabel(display),
            occurrences,
            options,
            reason: messages.authorReason(),
            subject: display,
            suggestedValue: options[0].value,
        },
    ];
}

/**
 * Finds inconsistent hashtag aliases for repeated displayed values.
 *
 * @param sources - Sources value.
 * @param messages - Messages value.
 * @returns Inconsistent hashtag aliases for repeated displayed values.
 */
function findAliasInconsistencies(
    sources: ExistingSource[],
    messages: SourceAnalysisMessages,
): SourceAnalysisFinding[] {
    const grouped = groupAliasOccurrences(sources, messages);
    return [...grouped.entries()].flatMap((entry) =>
        buildAliasFinding(entry, messages),
    );
}

function groupAliasOccurrences(
    sources: ExistingSource[],
    messages: SourceAnalysisMessages,
): Map<string, SourceAnalysisOccurrence[]> {
    const grouped = new Map<string, SourceAnalysisOccurrence[]>();
    for (const source of sources) {
        for (const [rowIndex, row] of source.draft.rows.entries()) {
            const parameter = normalizeParameterName(row.name);
            const family = getAliasParameterFamily(parameter);
            const displayValue = row.value.trim();
            if (family == null || displayValue === '') {
                continue;
            }
            const identity = getAliasSubjectIdentity(parameter, displayValue);
            if (identity === '') {
                continue;
            }
            const key = `${family}\u0000${identity}`;
            const occurrences = grouped.get(key) ?? [];
            occurrences.push(
                buildAliasOccurrence(source, rowIndex, parameter, messages),
            );
            grouped.set(key, occurrences);
        }
    }
    return grouped;
}

function getAliasParameterFamily(parameter: string): string | null {
    if (parameter === 'url') {
        return 'source-key';
    }
    if (SUMMARY_CREATOR_PARAMETER.test(parameter)) {
        return 'creator';
    }
    if (PUBLICATION_PARAMETERS.has(parameter)) {
        return 'publication';
    }
    if (ALIAS_ORGANIZATION_PARAMETERS.has(parameter)) {
        return 'organization';
    }
    return ['script-title', 'title'].includes(parameter) ? 'title' : null;
}

function getAliasSubjectIdentity(
    parameter: string,
    displayValue: string,
): string {
    return parameter === 'url'
        ? normalizeSourceUrl(displayValue)
        : normalizeDisplayValue(displayValue);
}

function buildAliasOccurrence(
    source: ExistingSource,
    rowIndex: number,
    parameter: string,
    messages: SourceAnalysisMessages,
): SourceAnalysisOccurrence {
    const row = source.draft.rows[rowIndex];
    const occurrence = buildAnalysisOccurrence(
        source,
        rowIndex,
        parameter,
        row.value.trim(),
        messages,
    );
    return {
        ...occurrence,
        cell: 'alias',
        displayValue: row.value.trim(),
        value: row.alias.trim(),
    };
}

function buildAliasFinding(
    [key, occurrences]: [string, SourceAnalysisOccurrence[]],
    messages: SourceAnalysisMessages,
): SourceAnalysisFinding[] {
    const options = countAliasValues(occurrences);
    const populated = options.filter((option) => option.value !== '');
    if (
        occurrences.length < 2 ||
        populated.length === 0 ||
        options.length < 2
    ) {
        return [];
    }
    const sourceKey = key.startsWith('source-key\u0000');
    const display = cleanValue(occurrences[0].displayValue);
    const hasMissing = options.some((option) => option.value === '');
    return [
        {
            category: 'alias',
            domain: '',
            id: `alias:${key}`,
            label: messages.aliasLabel(sourceKey, display),
            occurrences,
            options,
            reason: messages.aliasReason(sourceKey, hasMissing),
            subject: display,
            suggestedValue: populated[0].value,
        },
    ];
}

function countAliasValues(
    occurrences: SourceAnalysisOccurrence[],
): SourceAnalysisValue[] {
    const counted = new Map<string, SourceAnalysisValue & { order: number }>();
    for (const [order, occurrence] of occurrences.entries()) {
        const value = occurrence.value.trim().normalize('NFC');
        const existing = counted.get(value);
        if (existing == null) {
            counted.set(value, { count: 1, order, value });
        } else {
            existing.count += 1;
        }
    }
    return [...counted.values()]
        .sort(
            (left, right) =>
                Number(left.value === '') - Number(right.value === '') ||
                right.count - left.count ||
                left.order - right.order,
        )
        .map(({ count, value }) => ({ count, value }));
}

function buildAnalysisOccurrence(
    source: ExistingSource,
    rowIndex: number,
    parameter: string,
    value: string,
    messages: SourceAnalysisMessages,
): SourceAnalysisOccurrence {
    return {
        cell: 'value',
        displayValue: value,
        id: `${source.id}:${rowIndex}`,
        parameter,
        referenceName: source.referenceName,
        rowIndex,
        sourceId: source.id,
        template: getCanonicalTemplateNameFromKey(source.draft.template),
        title: source.title || source.url || messages.untitledSource(),
        value,
    };
}

function getSourceDomain(source: ExistingSource): string {
    try {
        const hostname = new URL(source.url).hostname
            .toLowerCase()
            .replace(/\.$/u, '');
        return hostname.replace(/^www\./u, '');
    } catch {
        return '';
    }
}

function countOccurrenceValues(
    occurrences: SourceAnalysisOccurrence[],
): SourceAnalysisValue[] {
    return countAnalysisValues(
        occurrences.map((occurrence) => occurrence.value),
    );
}

function countAnalysisValues(values: string[]): SourceAnalysisValue[] {
    const counted = new Map<string, SourceAnalysisValue & { order: number }>();
    for (const [order, entered] of values.entries()) {
        const value = entered.trim().normalize('NFC');
        if (value === '') {
            continue;
        }
        const existing = counted.get(value);
        if (existing == null) {
            counted.set(value, { count: 1, order, value });
        } else {
            existing.count += 1;
        }
    }
    return [...counted.values()]
        .sort(
            (left, right) =>
                right.count - left.count ||
                left.order - right.order ||
                left.value.localeCompare(right.value),
        )
        .map(({ count, value }) => ({ count, value }));
}

function normalizeDisplayValue(value: string): string {
    return cleanValue(value)
        .normalize('NFC')
        .toLowerCase()
        .replace(/\s+/gu, ' ')
        .trim();
}

function normalizeParameterName(name: string): string {
    return name.trim().toLowerCase();
}

function groupSourceAnalysisReplacements(
    replacements: SourceAnalysisReplacement[],
    messages: SourceAnalysisMessages,
): Map<string, SourceAnalysisReplacement[]> {
    const result = new Map<string, SourceAnalysisReplacement[]>();
    const enteredCells = new Map<string, SourceAnalysisReplacement>();
    for (const replacement of replacements) {
        if (isEmptySourceAnalysisReplacement(replacement)) {
            continue;
        }
        const added = registerSourceAnalysisReplacement(
            enteredCells,
            replacement,
            messages,
        );
        if (!added) {
            continue;
        }
        const selected = result.get(replacement.sourceId) ?? [];
        selected.push(replacement);
        result.set(replacement.sourceId, selected);
    }
    return result;
}

function isEmptySourceAnalysisReplacement(
    replacement: SourceAnalysisReplacement,
): boolean {
    const emptyValue =
        replacement.cell === 'value' && replacement.replacement.trim() === '';
    const unchanged = replacement.replacement === replacement.oldValue;
    return emptyValue || unchanged;
}

function registerSourceAnalysisReplacement(
    enteredCells: Map<string, SourceAnalysisReplacement>,
    replacement: SourceAnalysisReplacement,
    messages: SourceAnalysisMessages,
): boolean {
    const rowKey = `${replacement.sourceId}\u0000${replacement.rowIndex}`;
    const cellKey = `${rowKey}\u0000${replacement.cell}`;
    const existing = enteredCells.get(cellKey);
    if (existing != null && existing.replacement !== replacement.replacement) {
        throw new Error(messages.replacementConflict());
    }
    if (existing != null) {
        return false;
    }
    enteredCells.set(cellKey, replacement);
    return true;
}

function assertCurrentSource(
    text: string,
    source: ExistingSource,
    messages: SourceAnalysisMessages,
): void {
    const current = text.slice(source.templateStart, source.templateEnd);
    if (current !== source.rawTemplate) {
        throw new Error(messages.sourceChanged());
    }
}

function cloneSourceDraft(draft: SourceDraft): SourceDraft {
    return {
        rows: draft.rows.map((row) => ({ ...row })),
        template: draft.template,
    };
}

function applyDraftReplacements(
    draft: SourceDraft,
    replacements: SourceAnalysisReplacement[],
    messages: SourceAnalysisMessages,
): void {
    for (const replacement of replacements) {
        const row = draft.rows[replacement.rowIndex];
        const currentValue =
            replacement.cell === 'alias'
                ? row?.alias.trim()
                : row?.value.trim();
        if (
            row == null ||
            normalizeParameterName(row.name) !== replacement.parameter ||
            currentValue !== replacement.oldValue
        ) {
            throw new Error(messages.fieldChanged());
        }
    }
    for (const replacement of replacements) {
        const row = draft.rows[replacement.rowIndex];
        if (replacement.cell === 'alias') {
            row.alias = replacement.replacement;
        } else {
            row.value = replacement.replacement;
        }
    }
}
