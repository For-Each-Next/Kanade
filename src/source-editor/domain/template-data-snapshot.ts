/**
 * @file src/source-editor/domain/template-data-snapshot.ts
 * Purpose: Deterministic citation TemplateData snapshots and shared parameter validation.
 *
 * Contents: English-first snapshot merging, bounded names, and alias arrays.
 */

import { isRecord } from '../../library/data-validation/records.ts';

import type { CitationTemplateData } from '../config/citation-template-data/types.ts';

const PARAMETER_LIMIT = 512;
const STRING_LENGTH_LIMIT = 255;

/**
 * Prefers English metadata and appends Chinese-only parameter order entries.
 *
 * Each site's order includes canonical parameters omitted from `paramOrder`.
 * Chinese aliases and date types are used only when English data is absent.
 *
 * @param englishPage - English Wikipedia TemplateData page.
 * @param chinesePage - Chinese Wikipedia TemplateData page.
 * @returns Complete snapshot, or null when neither page is usable.
 */
export function mergeCitationTemplateDataSnapshots(
    englishPage: unknown,
    chinesePage: unknown,
): CitationTemplateData | null {
    const english = normalizeSnapshotPage(englishPage);
    const chinese = normalizeSnapshotPage(chinesePage);
    const metadata = english ?? chinese;
    if (metadata == null) {
        return null;
    }
    return {
        ...metadata,
        paramOrder:
            english == null
                ? metadata.paramOrder
                : [
                      ...new Set([
                          ...english.paramOrder,
                          ...(chinese?.paramOrder ?? []),
                      ]),
                  ],
    };
}

function normalizeSnapshotPage(value: unknown): CitationTemplateData | null {
    if (
        !isRecord(value) ||
        isApiFlag(value.missing) ||
        isApiFlag(value.notemplatedata) ||
        typeof value.title !== 'string' ||
        value.title.trim() === '' ||
        !isRecord(value.params)
    ) {
        return null;
    }
    const params = Object.entries(value.params);
    const order = readParameterNames(value.paramOrder);
    if (
        params.length === 0 ||
        params.length > PARAMETER_LIMIT ||
        order == null
    ) {
        return null;
    }
    const aliases: Array<[string, string[]]> = [];
    const dateParams: string[] = [];
    for (const [name, data] of params) {
        if (!isSafeParameterName(name) || !isRecord(data)) {
            return null;
        }
        const names = readParameterNames(data.aliases);
        if (names == null) {
            return null;
        }
        aliases.push([name, names]);
        if (data.type === 'date') {
            dateParams.push(name);
        }
    }
    return {
        aliases: Object.fromEntries(aliases),
        dateParams,
        paramOrder: [...new Set([...order, ...params.map(([name]) => name)])],
    };
}

/** Reads bounded TemplateData order or alias arrays without coercing names. */
export function readParameterNames(value: unknown): string[] | null {
    if (value == null) {
        return [];
    }
    if (
        !Array.isArray(value) ||
        value.length > PARAMETER_LIMIT ||
        !value.every(isSafeParameterName)
    ) {
        return null;
    }
    return [...value];
}

/** Validates a TemplateData parameter name before it can enter wikitext. */
export function isSafeParameterName(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value !== '' &&
        value.length <= STRING_LENGTH_LIMIT &&
        value === value.trim() &&
        // Reject control characters and delimiters unsafe in wikitext names.
        // eslint-disable-next-line no-control-regex
        !/[#<>[\]|{}=\u0000-\u001f\u007f]/u.test(value)
    );
}

function isApiFlag(value: unknown): boolean {
    return value === true || value === '';
}
