/**
 * @file src/vg-stub-creator/platform/network/source-references.ts
 * Purpose: Collects source URLs and provides shared citation fetching.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. ManagedCitationRow
 * 4. ManagedCitationContext
 * 5. fetchSourceReferences
 * 6. prepareManagedCitationRows
 * 7. prepareManagedCitationRow
 * 8. selectManagedCitationParams
 * 9. getManagedCitation
 */

import {
    getEnteredSourceReferenceFields,
    getEnteredSourceUrls,
} from '../../domain/source-fields.ts';
import {
    buildCiteTemplateFromParts,
    parseCiteTemplate,
    sortCitationParams,
} from '../../domain/citations/index.ts';
import type { CitationStore } from './citation-store.ts';
import * as wikitext from '../../domain/wikitext/index.ts';
const { trimValue } = wikitext;

interface ManagedCitationRow {
    modified: boolean;
    params: unknown[];
    sourceUrl: string;
    template: string;
}

interface ManagedCitationContext {
    citationStore: CitationStore;
    existingRows: ManagedCitationRow[];
    refetchSourceUrls: Set<string>;
}

/**
 * Fetches named citation data for all entered source URLs.
 *
 * @param form - Dialog form values.
 * @param citationStore - Citation fetch/cache store.
 * @returns Source reference data.
 */
export async function fetchSourceReferences(
    form: any,
    citationStore: CitationStore,
): Promise<Array<any>> {
    const mapCallbackB = async function callback(field: any) {
        const result = {
            citation:
                getManagedCitation(form, field.sourceUrl) ||
                (await citationStore.fetch(field.sourceUrl)),
            key: field.key,
            sourceUrl: field.sourceUrl,
        };
        return result;
    };
    const mappedValuesA =
        getEnteredSourceReferenceFields(form).map(mapCallbackB);
    const result = Promise.all(mappedValuesA);
    return result;
}

/**
 * Handles prepare managed citation rows.
 *
 * Prepares editable citation rows for all currently entered source
 * URLs.
 *
 * @param form - Dialog form values.
 * @param citationStore - Citation fetch/cache store.
 * @param options - Citation preparation options.
 * @param options.refetchSourceUrls - Source URLs to
 * re-fetch.
 * @returns Managed citation rows.
 */
export async function prepareManagedCitationRows(
    form: any,
    citationStore: CitationStore,
    options: any = {},
): Promise<Array<any>> {
    const hasExistingRows = Array.isArray(form.citationRows);
    let existingRows: ManagedCitationRow[] = [];

    if (hasExistingRows) {
        existingRows = form.citationRows;
    }
    const normalizedRefetchUrls = (options.refetchSourceUrls || []).map(
        trimValue,
    );
    const refetchSourceUrls = new Set<string>(normalizedRefetchUrls);

    const context = { citationStore, existingRows, refetchSourceUrls };
    const mapCallbackA = async function callback(
        sourceUrl: string,
        index: number,
    ) {
        const result = await prepareManagedCitationRow(
            sourceUrl,
            index,
            context,
        );
        return result;
    };
    const mappedValues = getEnteredSourceUrls(form).map(mapCallbackA);
    const rows = await Promise.all(mappedValues);

    return rows;
}

/**
 * Prepares one editable managed citation row.
 *
 * @param sourceUrl - Source URL.
 * @param index - Zero-based item index.
 * @param context - Operation context.
 * @returns Result when the function
 *   prepares one editable managed citation row.
 */
async function prepareManagedCitationRow(
    sourceUrl: string,
    index: number,
    context: ManagedCitationContext,
) {
    const shouldRefetch = context.refetchSourceUrls.has(sourceUrl);
    let generatedCitation: string;

    if (shouldRefetch) {
        generatedCitation = await context.citationStore.refetch(sourceUrl);
    } else {
        generatedCitation = await context.citationStore.fetch(sourceUrl);
    }
    const generated = parseCiteTemplate(generatedCitation);
    const findCallbackA = function findExisting(row: ManagedCitationRow) {
        return trimValue(row.sourceUrl) === sourceUrl;
    };
    const existing = context.existingRows.find(findCallbackA);
    const generatedParams = generated.params;
    const params = selectManagedCitationParams(existing, generated);
    let template = generated.template;

    if (existing != null && trimValue(existing.template)) {
        template = existing.template;
    }

    const result = {
        generatedParams,
        index: index + 1,
        modified: existing?.modified === true,
        params,
        sourceUrl,
        template,
    };
    return result;
}

/**
 * Selects generated or user-modified citation parameters.
 *
 * @param existing - Existing value.
 * @param generated - Generated value.
 * @returns Generated or user-modified citation parameters.
 */
function selectManagedCitationParams(
    existing:
        { modified: boolean; template: string; params: unknown[] } | undefined,
    generated: { params: unknown[]; template: string },
): Array<unknown> {
    if (existing?.modified !== true) {
        return generated.params;
    }
    const template = existing.template || generated.template;
    return sortCitationParams(existing.params || [], template);
}

/**
 * Builds a managed citation for a source URL when the form has one.
 *
 * @param form - Dialog form values.
 * @param sourceUrl - Source URL.
 * @returns Managed citation wikitext, or empty string.
 */
function getManagedCitation(form: any, sourceUrl: string): string {
    if (!Array.isArray(form.citationRows)) {
        return '';
    }

    const findCallback = function findCitation(item: { sourceUrl: string }) {
        return trimValue(item.sourceUrl) === trimValue(sourceUrl);
    };
    const row = form.citationRows.find(findCallback);

    if (row == null) {
        return '';
    }

    return buildCiteTemplateFromParts(row);
}
