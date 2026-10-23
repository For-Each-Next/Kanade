/**
 * @file src/vg-stub-creator/features/creator/form/related-items.ts
 * Purpose: Associates reviewed related pages with the metadata that contributes them.
 *
 * Table of contents:
 * 1. Imports
 * 2. RelatedItemKind
 * 3. RelatedFieldMetadata
 * 4. Constants and state
 * 5. buildRelatedFieldMetadata
 * 6. buildRelatedMetadata
 * 7. getRelatedItemField
 * 8. matchesRelatedItem
 * 9. findStubTagCategory
 * 10. getRelatedRowValues
 * 11. getNavboxTitle
 * 12. readRelatedTemplate
 * 13. trimStubTagValue
 * 14. getRelatedIdentity
 * 15. getRecordRelatedValues
 */

import { createArticleData } from '../../../domain/processor.ts';
import type { ArticleDataRecord } from '../../../domain/models.ts';
import { stripNamespacePrefix } from '../../../../library/wiki-titles/wikipedia.ts';
import { wikitext } from '../../../../library/wikitext/index.ts';
import { trimValue } from '../../../domain/wikitext/field-values.ts';

export type RelatedItemKind = 'category' | 'navbox' | 'stubTag';

export interface RelatedFieldMetadata {
    category: Set<string>;
    company: Set<string>;
    navbox: Set<string>;
    stubTag: Set<string>;
}

export const RELATED_FIELDS = [
    'developers',
    'publishers',
    'series',
    'platforms',
    'year',
    'genres',
] as const;

const RELATED_FIELD_SOURCES: Record<string, string> = {
    developer: 'developers',
    publisher: 'publishers',
    series: 'series',
    platform: 'platforms',
    year: 'year',
    genre: 'genres',
};

/** Builds field ownership from normalized article records, before review selections. */
export function buildRelatedFieldMetadata(
    form: Record<string, any>,
): Record<string, RelatedFieldMetadata> {
    return Object.fromEntries(
        RELATED_FIELDS.map((field) => {
            const input = {
                [field]: form[field],
                ...(field === 'publishers' && form.publishers === '='
                    ? { developers: form.developers }
                    : {}),
            };
            const records = Object.values(createArticleData(input).records);
            return [field, buildRelatedMetadata(records)];
        }),
    );
}

/** Collects related-page identities from normalized records for one item or field. */
export function buildRelatedMetadata(
    records: readonly ArticleDataRecord[],
): RelatedFieldMetadata {
    const values = {
        category: new Set<string>(),
        company: new Set<string>(),
        navbox: new Set<string>(),
        stubTag: new Set<string>(),
    };

    for (const record of records) {
        for (const category of getRecordRelatedValues(record)) {
            values.category.add(getRelatedIdentity(category, 'category'));
        }

        for (const company of record.categoryItems) {
            if (company.company) {
                values.company.add(getRelatedIdentity(company.company));
            }
        }

        for (const navbox of record.navboxes) {
            values.navbox.add(getRelatedIdentity(navbox, 'navbox'));
        }

        for (const stubTag of record.assumedStubTags) {
            values.stubTag.add(getRelatedIdentity(stubTag, 'stubTag'));
        }
    }

    return values;
}

/** Keeps every reviewed row visible, including older unassociated manual rows. */
export function getRelatedItemField(
    row: any,
    kind: RelatedItemKind,
    metadata: Record<string, RelatedFieldMetadata>,
    categories: any[],
): string {
    if (RELATED_FIELDS.some((field) => field === row?.relatedField)) {
        return row.relatedField;
    }

    if (kind === 'category') {
        const source = String(row?.source || '').replace(/ †$/u, '');

        if (RELATED_FIELD_SOURCES[source]) {
            return RELATED_FIELD_SOURCES[source];
        }
    }

    for (const field of RELATED_FIELDS) {
        if (matchesRelatedItem(row, kind, metadata[field])) {
            return field;
        }
    }

    if (kind === 'stubTag') {
        const category = findStubTagCategory(row, categories);

        if (category) {
            return getRelatedItemField(
                category,
                'category',
                metadata,
                categories,
            );
        }
    }

    return 'genres';
}

/** Matches original and reviewed identities without replacing the editor's displayed text. */
export function matchesRelatedItem(
    row: Record<string, unknown> | null | undefined,
    kind: RelatedItemKind,
    metadata: RelatedFieldMetadata | undefined,
): boolean {
    return (
        row != null &&
        metadata != null &&
        (getRelatedRowValues(row, kind).some((value) =>
            metadata[kind].has(getRelatedIdentity(value, kind)),
        ) ||
            (kind === 'category' &&
                Boolean(row.company) &&
                metadata.company.has(getRelatedIdentity(row.company))))
    );
}

/** Finds the category that contributes a reviewed stub suggestion. */
export function findStubTagCategory<Row extends Record<string, unknown>>(
    row: Record<string, unknown> | null | undefined,
    categories: readonly Row[],
): Row | undefined {
    const identities = getRelatedRowValues(row, 'stubTag').map((value) =>
        getRelatedIdentity(value, 'stubTag'),
    );
    return categories.find((category) =>
        identities.includes(getRelatedIdentity(category.stubTag, 'stubTag')),
    );
}

/** Reads only the identities relevant to one kind of related page. */
function getRelatedRowValues(
    row: Record<string, unknown> | null | undefined,
    kind: RelatedItemKind,
): unknown[] {
    const values =
        kind === 'category'
            ? [row?.originalCategory, row?.category]
            : kind === 'navbox'
              ? [row?.sourceTitle, row?.title, row?.text]
              : [row?.originalStubTag, row?.stubTag];
    return values.filter(Boolean);
}

/** Extracts a template title while preserving complete invocations in their owning row. */
export function getNavboxTitle(value: unknown): string {
    const text = trimValue(value);
    const template = readRelatedTemplate(text);
    return stripNamespacePrefix(template?.name || text, 'zhwiki', 10);
}

/** Reads one complete invocation without accepting adjacent calls or unfinished source. */
export function readRelatedTemplate(value: string) {
    const template = wikitext(value).template.getFirst();
    return template?.start === 0 && template.end === value.length
        ? template
        : undefined;
}

/** Removes braces from a stub template name. */
export function trimStubTagValue(value: unknown): string {
    return trimValue(value).replace(/^\{\{/u, '').replace(/\}\}$/u, '').trim();
}

/** Normalizes category and template identities without changing display values. */
export function getRelatedIdentity(
    value: unknown,
    kind?: RelatedItemKind,
): string {
    const text =
        kind === 'category'
            ? stripNamespacePrefix(String(value || ''), 'zhwiki', 14)
            : kind === 'navbox'
              ? getNavboxTitle(value)
              : kind === 'stubTag'
                ? stripNamespacePrefix(trimStubTagValue(value), 'zhwiki', 10)
                : String(value || '');

    return text.trim().replace(/_/gu, ' ').toLocaleLowerCase();
}

/** Includes terminology categories and lookup-plan candidates in field ownership. */
function getRecordRelatedValues(record: ArticleDataRecord): unknown[] {
    return [
        ...record.assumedCategories,
        ...record.categoryItems.flatMap((item) => [
            item.category,
            item.fallback,
            ...(Array.isArray(item.candidates) ? item.candidates : []),
        ]),
        ...record.categoryPlans.flatMap((item) => [
            item.fallback,
            ...(Array.isArray(item.candidates) ? item.candidates : []),
        ]),
    ].filter(Boolean);
}
