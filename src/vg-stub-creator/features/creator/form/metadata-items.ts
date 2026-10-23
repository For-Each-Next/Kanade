/**
 * @file src/vg-stub-creator/features/creator/form/metadata-items.ts
 * Purpose: Preserves selectable metadata items and associates their reviewed related pages.
 *
 * Table of contents:
 * 1. Imports
 * 2. MetadataField
 * 3. MetadataItemRow
 * 4. MetadataItemDetails
 * 5. MetadataItemOwner
 * 6. Constants and state
 * 7. createMetadataItemRow
 * 8. getMetadataFieldRows
 * 9. syncMetadataItemRows
 * 10. serializeMetadataItemRows
 * 11. getMetadataItemDetails
 * 12. getRelatedItemOwner
 * 13. nextMetadataItemId
 * 14. getMetadataValues
 * 15. normalizeMetadataValue
 * 16. getMetadataValueIdentity
 */

import {
    completeMetadataFieldValue,
    createArticleData,
    formatArticleFormField,
} from '../../../domain/processor.ts';
import {
    getWikilinkValue,
    splitFieldValues,
    trimValue,
} from '../../../domain/wikitext/field-values.ts';
import {
    buildRelatedMetadata,
    findStubTagCategory,
    matchesRelatedItem,
    RELATED_FIELDS,
} from './related-items.ts';
import type { RelatedFieldMetadata, RelatedItemKind } from './related-items.ts';

export type MetadataField = (typeof RELATED_FIELDS)[number];

/** Persisted editor choices; IDs remain stable when the item's name changes. */
export interface MetadataItemRow {
    id: string;
    value: string;
    enabled: boolean;
}

/** Display values and related identities derived through normalized article records. */
export interface MetadataItemDetails {
    displayText: string;
    linkTarget: string;
    related: RelatedFieldMetadata;
}

export interface MetadataItemOwner extends MetadataItemDetails {
    id: string;
    enabled?: boolean;
}

const issuedIds = new Set<string>();
let itemSequence = 0;

/** Creates a selectable row with terminology completion and no assumed article links. */
export function createMetadataItemRow(
    field: MetadataField,
    value: unknown,
    developers: string = '',
): MetadataItemRow {
    const entered =
        field === 'publishers' && trimValue(value) === '=' ? developers : value;

    return {
        id: nextMetadataItemId(),
        value: normalizeMetadataValue(field, entered),
        enabled: true,
    };
}

/** Initializes article text fields while retaining restored rows and unchecked items. */
export function getMetadataFieldRows(
    form: Record<string, any>,
    field: MetadataField,
): MetadataItemRow[] {
    if (
        form.metadataItemRows == null ||
        typeof form.metadataItemRows !== 'object' ||
        Array.isArray(form.metadataItemRows)
    ) {
        form.metadataItemRows = {};
    }

    for (const rows of Object.values(form.metadataItemRows)) {
        if (Array.isArray(rows)) {
            for (const row of rows) {
                if (typeof row?.id === 'string') issuedIds.add(row.id);
            }
        }
    }

    if (!Array.isArray(form.metadataItemRows[field])) {
        form.metadataItemRows[field] = getMetadataValues(form, field).map(
            (value) => createMetadataItemRow(field, value),
        );
    }

    const rows: MetadataItemRow[] = form.metadataItemRows[field];
    for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];
        if (row == null || typeof row !== 'object') {
            rows.splice(index, 1);
            continue;
        }
        if (typeof row.id !== 'string' || row.id === '') {
            row.id = nextMetadataItemId();
        }
        if (typeof row.value !== 'string') row.value = trimValue(row.value);
        row.enabled = row.enabled !== false;
    }
    return rows;
}

/** Applies authoritative imported field text, preserving matching IDs and unchecked rows. */
export function syncMetadataItemRows(
    form: Record<string, any>,
    field?: MetadataField,
): void {
    for (const key of field == null ? RELATED_FIELDS : [field]) {
        const rows = getMetadataFieldRows(form, key);
        const incoming = getMetadataValues(form, key);
        const selected = rows
            .filter((row) => row.enabled)
            .map((row) => normalizeMetadataValue(key, row.value));

        if (
            incoming.length === selected.length &&
            incoming.every(
                (value, index) =>
                    getMetadataValueIdentity(value) ===
                    getMetadataValueIdentity(selected[index]),
            )
        ) {
            continue;
        }

        const remaining = [...rows];
        const imported = incoming.map((value) => {
            const index = remaining.findIndex(
                (row) =>
                    getMetadataValueIdentity(
                        normalizeMetadataValue(key, row.value),
                    ) === getMetadataValueIdentity(value),
            );
            if (index === -1) return createMetadataItemRow(key, value);

            const [row] = remaining.splice(index, 1);
            row.value = value;
            row.enabled = true;
            return row;
        });
        rows.splice(
            0,
            rows.length,
            ...imported,
            ...remaining.filter((row) => !row.enabled),
        );
    }
}

/** Writes selected metadata into the established article form contract. */
export function serializeMetadataItemRows(
    form: Record<string, any>,
    field: MetadataField,
): string {
    const values = getMetadataFieldRows(form, field)
        .filter((row) => row.enabled && trimValue(row.value) !== '')
        .map((row) => normalizeMetadataValue(field, row.value));
    let text = values.join('; ');

    if (field === 'publishers' && form.publishers === '=') {
        const developers = getMetadataValues(form, 'developers');
        if (
            values.length === developers.length &&
            values.every(
                (value, index) =>
                    getMetadataValueIdentity(value) ===
                    getMetadataValueIdentity(developers[index]),
            )
        ) {
            text = '=';
        }
    }

    form[field] = text;
    return text;
}

/** Uses normalized records for canonical item labels, links, and related-page ownership. */
export function getMetadataItemDetails(
    form: Record<string, any>,
    field: MetadataField,
    row: MetadataItemRow,
): MetadataItemDetails {
    const entered =
        field === 'publishers' && row.value === '='
            ? form.developers
            : row.value;
    const data = createArticleData({
        [field]: normalizeMetadataValue(field, entered),
    });
    const records = Object.values(data.records);
    const value = records.flatMap((record) => record.values)[0];

    return {
        displayText: (value?.displayText || trimValue(entered)).replace(
            /\[\[([^[\]]+)\]\]/gu,
            (link) => getWikilinkValue(link),
        ),
        linkTarget: value?.linkTarget || '',
        related: buildRelatedMetadata(records),
    };
}

/** Keeps manually placed and renamed related rows attached to their stable metadata owner. */
export function getRelatedItemOwner(
    row: Record<string, any>,
    kind: RelatedItemKind,
    items: readonly MetadataItemOwner[],
    categories: readonly Record<string, any>[],
): string {
    if (trimValue(row.relatedItemId) !== '') {
        return items.some((item) => item.id === row.relatedItemId)
            ? row.relatedItemId
            : '';
    }

    const contributors = items.filter((candidate) =>
        matchesRelatedItem(row, kind, candidate.related),
    );
    const item =
        contributors.find((candidate) => candidate.enabled !== false) ||
        contributors[0];
    if (item != null) return item.id;

    if (kind === 'stubTag') {
        const category = findStubTagCategory(row, categories);
        if (category != null) {
            return getRelatedItemOwner(category, 'category', items, categories);
        }
    }

    return '';
}

/** Allocates local stable IDs without conflicting with restored rows. */
function nextMetadataItemId(): string {
    let id: string;
    do {
        itemSequence += 1;
        id = `metadata-item-${itemSequence}`;
    } while (issuedIds.has(id));
    issuedIds.add(id);
    return id;
}

/** Parses article list values and expands the same-company publisher shorthand. */
function getMetadataValues(
    form: Record<string, any>,
    field: MetadataField,
): string[] {
    const text = trimValue(
        field === 'publishers' && trimValue(form.publishers) === '='
            ? form.developers
            : form[field],
    );
    const values = field === 'year' ? [text] : splitFieldValues(text);
    const seen = new Set<string>();

    return values
        .filter(Boolean)
        .map((value) => normalizeMetadataValue(field, value))
        .filter((value) => {
            const identity = getMetadataValueIdentity(value);
            if (seen.has(identity)) return false;
            seen.add(identity);
            return true;
        });
}

/** Completes terminology aliases while preserving undefined terms as plain text. */
function normalizeMetadataValue(field: MetadataField, value: unknown): string {
    const text = trimValue(value);
    return field === 'year'
        ? String(formatArticleFormField({}, field, text))
        : completeMetadataFieldValue(field, text, true);
}

function getMetadataValueIdentity(value: string): string {
    return value.trim().replace(/_/gu, ' ').toLocaleLowerCase();
}
