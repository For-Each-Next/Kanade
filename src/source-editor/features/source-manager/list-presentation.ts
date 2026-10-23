/**
 * @file src/source-editor/features/source-manager/list-presentation.ts
 * Purpose: Filtering and table presentation for existing citation sources.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. SourceSectionSelector
 * 4. SourceTableRow
 * 5. SourceTableGroup
 * 6. SourceListDerivedInputs
 * 7. SourceListDerivedState
 * 8. createSourceListDerivedState
 * 9. toSourceTableRow
 * 10. toSubReferenceTableRows
 * 11. toSubReferenceTableRow
 * 12. formatSourceAuthorYear
 * 13. isNonEmpty
 * 14. formatSourceUsageTitle
 * 15. formatSourceUsageSection
 * 16. buildSourceSectionSelectors
 * 17. hasLeadingSourceSection
 * 18. buildLeadingSourceSection
 * 19. buildSourceSectionSelector
 * 20. formatSourceSectionOption
 */

import {
    filterExistingSources,
    getSourceDraftCitationNameCells,
    getSourceDraftCitationNameParts,
    type ExistingSource,
    type ExistingSourceSubReference,
    type SourceSection,
} from '../../domain/source-manager.ts';
import { getCanonicalTemplateNameFromKey } from '../../domain/templates.ts';
import { msg, type MessageId } from '../../i18n/index.ts';
import type { VueModule } from './codex.ts';

const UNUSED_SOURCE_SECTION_ID = 'unused';

export interface SourceSectionSelector {
    label: string;
    level: number;
    menuItems: Array<{
        label: string;
        sectionId: string;
        value: string;
    }>;
    selected: string;
}

export interface SourceTableRow {
    actions: string;
    details: string;
    detailsTitle: string;
    group: string;
    id: string;
    reference: string;
    source: string;
    sourceId: string;
    subReferenceId: string;
    subReferenceIds: string[];
    subReferenceCount: number;
    titleLanguage: string;
    usageCount: number;
    usageTitle: string;
    usageSummary: string;
}

export interface SourceTableGroup {
    source: SourceTableRow;
    subReferences: SourceTableRow[];
}

interface SourceListDerivedInputs {
    sourceInput: { value: string };
    existingSourceSections: { value: SourceSection[] };
    existingSources: { value: ExistingSource[] };
    sourceSectionPath: { value: string[] };
}

export interface SourceListDerivedState {
    filteredExistingSources: { readonly value: ExistingSource[] };
    formatSourceUsageTitle(source: ExistingSource): string;
    nonCs1Sources: { readonly value: ExistingSource[] };
    sectionFilterLabel: { readonly value: string };
    sourceSectionSelectors: {
        readonly value: SourceSectionSelector[];
    };
    sourceTablePaginationKey: { readonly value: string };
    sourceTableRows: { readonly value: SourceTableRow[] };
    sourceTableGroups: { readonly value: SourceTableGroup[] };
}

/**
 * Builds filtering and choice values for the existing-source list.
 *
 * @param Vue - Vue value.
 * @param state - Mutable operation state.
 * @returns Filtering and choice values for the source list.
 */
export function createSourceListDerivedState(
    Vue: VueModule,
    state: SourceListDerivedInputs,
): SourceListDerivedState {
    function getFilteredExistingSources(): ExistingSource[] {
        const selectedSection = state.sourceSectionPath.value.at(-1) ?? '';
        return filterExistingSources(
            state.existingSources.value,
            state.sourceInput.value,
            selectedSection,
        );
    }
    const filteredExistingSources = Vue.computed(getFilteredExistingSources);
    function formatFilterLabel(label: MessageId, applied: boolean): string {
        const text = msg(label);
        return applied
            ? msg('lookup.appliedFilterLabel', {
                  count: filteredExistingSources.value.length,
                  label: text,
              })
            : text;
    }
    function getNonCs1Sources(): ExistingSource[] {
        return state.existingSources.value.filter(
            function isNonStandardSource(source) {
                return source.status === 'non-standard';
            },
        );
    }
    function getSelectors(): SourceSectionSelector[] {
        return buildSourceSectionSelectors(
            state.existingSourceSections.value,
            state.sourceSectionPath.value,
            state.existingSources.value,
        );
    }
    function getSectionFilterLabel(): string {
        return formatFilterLabel(
            'lookup.filterSection',
            state.sourceSectionPath.value.length > 0,
        );
    }
    function getSourceUsageTitle(source: ExistingSource): string {
        return formatSourceUsageTitle(
            source,
            state.existingSourceSections.value,
        );
    }
    function getSourceTableGroups(): SourceTableGroup[] {
        return filteredExistingSources.value.map((source) => {
            const row = toSourceTableRow(
                source,
                state.existingSourceSections.value,
            );
            return {
                source: row,
                subReferences: toSubReferenceTableRows(
                    row,
                    source.subReferences ?? [],
                    state.existingSourceSections.value,
                ),
            };
        });
    }
    function getSourceTableRows(): SourceTableRow[] {
        return sourceTableGroups.value.flatMap((group) => [
            group.source,
            ...group.subReferences,
        ]);
    }
    function getSourceTablePaginationKey(): string {
        return [
            state.sourceInput.value,
            ...state.sourceSectionPath.value,
            String(filteredExistingSources.value.length),
            String(sourceTableRows.value.length),
        ].join('\u0000');
    }
    const sourceTableGroups = Vue.computed(getSourceTableGroups);
    const sourceTableRows = Vue.computed(getSourceTableRows);
    return {
        filteredExistingSources,
        formatSourceUsageTitle: getSourceUsageTitle,
        nonCs1Sources: Vue.computed(getNonCs1Sources),
        sectionFilterLabel: Vue.computed(getSectionFilterLabel),
        sourceSectionSelectors: Vue.computed(getSelectors),
        sourceTablePaginationKey: Vue.computed(getSourceTablePaginationKey),
        sourceTableRows,
        sourceTableGroups,
    };
}

/**
 * Projects citation definitions into the Codex Table columns.
 *
 * @param source - Source text.
 * @param sections - Sections value.
 * @returns Operation result.
 */
function toSourceTableRow(
    source: ExistingSource,
    sections: SourceSection[],
): SourceTableRow {
    const details =
        source.status === 'non-standard'
            ? msg('lookup.nonStandard')
            : getCanonicalTemplateNameFromKey(source.draft.template);
    const usageTitle = formatSourceUsageTitle(source, sections);
    const subReferenceCount = source.subReferences?.length ?? 0;
    return {
        actions: '',
        details,
        detailsTitle: [
            source.referenceName,
            details,
            source.group === ''
                ? ''
                : msg('lookup.group', { group: source.group }),
            usageTitle,
        ]
            .filter(isNonEmpty)
            .join(' · '),
        group: source.group,
        id: source.id,
        reference: formatSourceAuthorYear(source),
        source: source.title || source.url || msg('common.untitledSource'),
        sourceId: source.id,
        subReferenceId: '',
        subReferenceIds: [],
        subReferenceCount,
        titleLanguage: source.titleLanguage,
        usageCount: source.usageCount,
        usageTitle,
        usageSummary:
            subReferenceCount > 0
                ? msg('lookup.sourceUsageWithSubReferences', {
                      count: source.usageCount,
                      subCount: subReferenceCount,
                  })
                : `${source.usageCount}×`,
    };
}

/**
 * Groups matching details beneath one source in their first-use order.
 *
 * @param sourceRow - Parent source's table row.
 * @param subReferences - Native sub-reference occurrences.
 * @param sections - Article sections.
 * @returns One row for each exact decoded details value.
 */
function toSubReferenceTableRows(
    sourceRow: SourceTableRow,
    subReferences: ExistingSourceSubReference[],
    sections: SourceSection[],
): SourceTableRow[] {
    const grouped = new Map<string, ExistingSourceSubReference[]>();
    for (const subReference of subReferences) {
        const occurrences = grouped.get(subReference.details) ?? [];
        occurrences.push(subReference);
        grouped.set(subReference.details, occurrences);
    }
    return [...grouped.values()].map((occurrences) =>
        toSubReferenceTableRow(sourceRow, occurrences, sections),
    );
}

/**
 * Presents one details value with the usage count of all matching occurrences.
 *
 * @param sourceRow - Parent source's table row.
 * @param occurrences - Matching native sub-reference occurrences.
 * @param sections - Article sections.
 * @returns Row with matching occurrences' actions, details, and usage sections.
 */
function toSubReferenceTableRow(
    sourceRow: SourceTableRow,
    occurrences: ExistingSourceSubReference[],
    sections: SourceSection[],
): SourceTableRow {
    const subReference = occurrences[0]!;
    const usageCount = occurrences.length;
    const usageTitle = formatSourceUsageTitle(
        {
            sectionIds: occurrences.flatMap(
                (occurrence) => occurrence.sectionIds,
            ),
            usageCount,
        },
        sections,
    );
    return {
        ...sourceRow,
        details: '',
        detailsTitle: usageTitle,
        id: `${sourceRow.id}:${subReference.id}`,
        source: subReference.details,
        subReferenceId: subReference.id,
        subReferenceIds: occurrences.map((occurrence) => occurrence.id),
        subReferenceCount: 0,
        titleLanguage: '',
        usageCount,
        usageTitle,
        usageSummary: `${usageCount}×`,
    };
}

/**
 * Uses available citation identity metadata for the compact source label.
 *
 * @param source - Source definition.
 * @returns Author and year, or the source's reference name.
 */
function formatSourceAuthorYear(source: ExistingSource): string {
    if (source.status === 'standard') {
        try {
            if (getSourceDraftCitationNameCells(source.draft).size === 0) {
                return source.referenceName || msg('common.unnamed');
            }
            const { author, year } = getSourceDraftCitationNameParts(
                source.draft,
            );
            const identity = [author, year].filter(isNonEmpty).join(', ');
            if (identity !== '') {
                return identity;
            }
        } catch {
            // Unsupported citation content still has a usable reference label.
        }
    }
    return source.referenceName || msg('common.unnamed');
}

function isNonEmpty(value: string): boolean {
    return value !== '';
}

/**
 * Formats exact sections shown for a source usage count.
 *
 * @param source - Source text.
 * @param sections - Sections value.
 * @returns Formatted exact sections shown for a source usage count.
 */
export function formatSourceUsageTitle(
    source: Pick<ExistingSource, 'sectionIds' | 'usageCount'>,
    sections: SourceSection[],
): string {
    if (source.usageCount === 0) {
        return msg('lookup.sourceNotUsed');
    }
    const usedIds = new Set(source.sectionIds);
    const labels = sections
        .filter((section) => usedIds.has(section.id))
        .map(formatSourceUsageSection);
    return msg('lookup.sourceUsedIn', { sections: labels.join('; ') });
}

/**
 * Formats one exact source-use section for a compact native title.
 *
 * @param section - Section value.
 * @returns Value.
 */
function formatSourceUsageSection(section: SourceSection): string {
    const title = section.id === '0' ? msg('sections.lead') : section.title;
    return `§${section.id} ${title}`.trim();
}

/**
 * Builds one combobox for each selected section hierarchy level.
 *
 * @param sections - Sections value.
 * @param path - File path.
 * @param sources - Sources value.
 * @returns Built combobox for each selected section hierarchy level.
 */
export function buildSourceSectionSelectors(
    sections: SourceSection[],
    path: string[],
    sources: ExistingSource[],
): SourceSectionSelector[] {
    const selectors: SourceSectionSelector[] = [];
    let parentId = '';
    for (let level = 0; level <= path.length; level += 1) {
        let children = sections.filter(
            (section) => section.parentId === parentId,
        );
        if (children.length === 0) {
            break;
        }
        if (hasLeadingSourceSection(parentId, sources)) {
            children = [
                buildLeadingSourceSection(parentId, level),
                ...children,
            ];
        }
        const selected = path[level] ?? '';
        selectors.push(buildSourceSectionSelector(children, level, selected));
        if (
            selected === '' ||
            !children.some((section) => section.id === selected)
        ) {
            break;
        }
        if (selected.endsWith('.0')) {
            break;
        }
        parentId = selected;
    }
    return selectors;
}

/**
 * Checks whether a selected heading has citations in its own lead.
 *
 * @param parentId - Parent id value.
 * @param sources - Sources value.
 * @returns Whether a selected heading has citations in its own lead.
 */
function hasLeadingSourceSection(
    parentId: string,
    sources: ExistingSource[],
): boolean {
    if (
        parentId === '' ||
        parentId === '0' ||
        parentId === UNUSED_SOURCE_SECTION_ID
    ) {
        return false;
    }
    return sources.some((source) => source.sectionIds.includes(parentId));
}

/**
 * Creates the `.0` option for a selected heading's own lead.
 *
 * @param parentId - Parent id value.
 * @param level - Level value.
 * @returns Created the `.0` option for a selected heading's own lead.
 */
function buildLeadingSourceSection(
    parentId: string,
    level: number,
): SourceSection {
    const title =
        level === 1
            ? msg('sections.sectionLead')
            : msg('sections.subsectionLead');
    const id = `${parentId}.0`;
    return {
        depth: level,
        id,
        parentId,
        start: -1,
        title,
    };
}

/**
 * Builds the choices for one section-filter hierarchy level.
 *
 * @param sections - Sections value.
 * @param level - Level value.
 * @param selected - Selected value.
 * @returns Built the choices for one section-filter hierarchy level.
 */
function buildSourceSectionSelector(
    sections: SourceSection[],
    level: number,
    selected: string,
): SourceSectionSelector {
    const allLabel =
        level === 0
            ? msg('sections.allSections')
            : msg('sections.allSubsections');
    const sectionOptions = sections.map(function toOption(section) {
        const label = formatSourceSectionOption(section);
        return {
            label,
            sectionId: section.id,
            value: label,
        };
    });
    const allOption = {
        label: allLabel,
        sectionId: '',
        value: allLabel,
    };
    return {
        label:
            level === 0 ? msg('sections.section') : msg('sections.subsection'),
        level,
        menuItems: [allOption, ...sectionOptions],
        selected:
            sectionOptions.find((option) => option.sectionId === selected)
                ?.label ?? allLabel,
    };
}

/**
 * Formats structural section data for the localized filter menu.
 *
 * @param section - Section value.
 * @returns Section data for the localized filter menu.
 */
function formatSourceSectionOption(section: SourceSection): string {
    if (section.id === UNUSED_SOURCE_SECTION_ID) {
        return msg('sections.unusedReferences');
    }
    const title = section.id === '0' ? msg('sections.lead') : section.title;
    return `§ ${section.id} ${title}`.trim();
}
