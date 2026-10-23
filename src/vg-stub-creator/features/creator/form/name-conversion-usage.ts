/**
 * @file src/vg-stub-creator/features/creator/form/name-conversion-usage.ts
 * Purpose: Summarizes emitted name conversion values without changing editor drafts.
 *
 * Table of contents:
 * 1. Imports
 * 2. NameConversionUsage
 * 3. ConversionValues
 * 4. NameConversionChip
 * 5. getNameConversionChips
 * 6. getNameConversionUsage
 * 7. getCombinedConversionOwner
 * 8. getConversionRows
 * 9. readConversionValues
 * 10. hasMarket
 * 11. isRecord
 */

import { isRecord } from '../../../../library/data-validation/records.ts';

import {
    buildNameNoteTaConversionText,
    getNameNoteTaVariants,
    getNameRole,
    getNameSources,
    getOfficialNameNoteTaSources,
    type NameNoteTaVariant,
    type NameSource,
} from '../../../domain/name-roles.ts';
import {
    splitFieldValues,
    trimValue,
} from '../../../domain/wikitext/field-values.ts';

export interface NameConversionUsage {
    variant: NameNoteTaVariant;
    value: string;
    modified: boolean;
}

type ConversionValues = Partial<Record<NameNoteTaVariant, string>>;

export interface NameConversionChip {
    key: string;
    variant?: string;
    label: string;
    value: string;
}

/** Shows emitted regional rules and retained manual clauses as compact text. */
export function getNameConversionChips(
    form: Record<string, unknown>,
): NameConversionChip[] {
    return getConversionRows(form).flatMap((row, index) => {
        if (/^G\d+$/u.test(trimValue(row.key))) return [];
        const text = trimValue(row.value);
        if (text === '') return [];
        return splitFieldValues(`${text};`).map((entry, clause) => {
            const match = entry.match(/^(zh(?:-[a-z]+)?)\s*:\s*(.*)$/isu);
            const code = match?.[1].toLowerCase();
            const value =
                match == null ? trimValue(entry) : trimValue(match[2]);
            return {
                key: `${index}:${clause}:${code ?? row.key}`,
                variant: code,
                label:
                    match == null
                        ? value
                        : `[${code!.replace(/^zh-/u, '')}] ${value}`,
                value: trimValue(entry),
            };
        });
    });
}

/** Reads actual conversion text and attributes each combined region to its winning source. */
export function getNameConversionUsage(
    form: Record<string, unknown>,
    sourceId: string,
): NameConversionUsage[] {
    const sources = getNameSources(form);
    if (!sources.some((source) => source.id === sourceId)) return [];
    const role = getNameRole(form, sourceId, 'noteTa');
    if (!role.enabled) return [];

    const rows = getConversionRows(form);
    const individual = rows.find(
        (row) => row.source === `name-role:${sourceId}`,
    );
    const separate = role.noteTaVariants == null && role.modified;
    const officialSources = getOfficialNameNoteTaSources(form, sources);
    const combined = rows.find((row) => row.source === 'names');
    const generated = separate
        ? role.value
        : buildNameNoteTaConversionText(
              form,
              officialSources.map(
                  (source) =>
                      (form.localizedNames as Record<string, unknown>[])[
                          source.index!
                      ],
              ),
          );
    const emittedRow = separate ? individual : combined;
    const values = readConversionValues(emittedRow?.value ?? generated);
    const generatedValues = readConversionValues(
        emittedRow?.generatedValue ?? generated,
    );
    const drafts = getNameNoteTaVariants(form, sourceId);

    return (Object.keys(values) as NameNoteTaVariant[]).flatMap((variant) => {
        const value = values[variant];
        if (!value) return [];
        if (
            !separate &&
            getCombinedConversionOwner(form, officialSources, variant) !==
                sourceId
        ) {
            return [];
        }
        return [
            {
                variant,
                value: `${variant}:${value};`,
                modified:
                    (separate
                        ? role.modified
                        : trimValue(drafts[variant]?.value) !== '') ||
                    value !== generatedValues[variant],
            },
        ];
    });
}

/** Uses edit chronology and stable role order before falling back to the first official name. */
function getCombinedConversionOwner(
    form: Record<string, unknown>,
    officialSources: NameSource[],
    variant: NameNoteTaVariant,
): string | undefined {
    let owner: string | undefined;
    let latestOrder = -1;
    const seen = new Set<string>();
    for (const row of Array.isArray(form.nameRoleRows)
        ? form.nameRoleRows
        : []) {
        if (!isRecord(row) || row.role !== 'noteTa') continue;
        const sourceId = trimValue(row.sourceId);
        if (seen.has(sourceId)) continue;
        seen.add(sourceId);
        const role = getNameRole(form, sourceId, 'noteTa');
        if (!role.enabled || role.noteTaVariants == null) continue;
        const draft = getNameNoteTaVariants(form, sourceId)[variant];
        if (trimValue(draft?.effectiveValue) === '') continue;
        const order = role.noteTaVariants[variant]?.order ?? 0;
        if (order >= latestOrder) {
            owner = sourceId;
            latestOrder = order;
        }
    }
    if (owner != null || form.noteTaNamesRemoved === true) return owner;
    const markets =
        variant === 'zh-cn'
            ? ['hans', 'cn']
            : variant === 'zh-tw'
              ? ['hant', 'tw']
              : variant === 'zh-hk'
                ? ['hk']
                : [];
    return officialSources.find((source) =>
        hasMarket((form.localizedNames as unknown[])[source.index!], markets),
    )?.id;
}

/** Ignores malformed stored rows while preserving all input objects. */
function getConversionRows(
    form: Record<string, unknown>,
): Record<string, unknown>[] {
    return Array.isArray(form.noteTaRows)
        ? form.noteTaRows.filter(isRecord)
        : [];
}

/** Recognizes regional aliases without splitting semicolons inside wikilinks. */
function readConversionValues(value: unknown): ConversionValues {
    const values: ConversionValues = {};
    for (const entry of splitFieldValues(trimValue(value))) {
        const match = entry.match(
            /^(zh(?:-(?:cn|hans|tw|hant|hk|sg|mo|my))?)\s*:\s*(.*)$/isu,
        );
        if (match == null) continue;
        const tag = match[1].toLowerCase();
        const variant: NameNoteTaVariant =
            tag === 'zh-hans'
                ? 'zh-cn'
                : tag === 'zh-hant'
                  ? 'zh-tw'
                  : (tag as NameNoteTaVariant);
        values[variant] = trimValue(match[2]);
    }
    return values;
}

/** Uses the same explicit market-array precedence as article generation. */
function hasMarket(row: unknown, markets: string[]): boolean {
    if (!isRecord(row)) return false;
    const selected = row.markets;
    return Array.isArray(selected)
        ? markets.some((market) => selected.includes(market))
        : markets.some((market) => row[market] === true);
}
