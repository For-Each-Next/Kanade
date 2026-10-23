/**
 * @file src/vg-stub-creator/domain/article-input.ts
 * Purpose: Converts saved name inputs into the current article form without losing reviewed data.
 *
 * Table of contents:
 * 1. Imports
 * 2. normalizeArticleFormInput
 * 3. isRecord
 */

import { isRecord } from '../../library/data-validation/records.ts';

import type { ArticleForm } from './models.ts';

/** Converts retired name groups once at a raw-form boundary. */
export function normalizeArticleFormInput<T extends ArticleForm>(form: T): T {
    if (
        !Object.hasOwn(form, 'officialNames') &&
        !Object.hasOwn(form, 'commonNames')
    ) {
        return form;
    }

    const { officialNames, commonNames, ...current } = form;
    const hasLocalizedNames = Array.isArray(form.localizedNames);
    // Mixed inputs historically contributed extra source evidence and redirects,
    // while their current localized names alone controlled article display.
    const destination = hasLocalizedNames ? 'nameAliases' : 'localizedNames';
    const rows: Record<string, unknown>[] =
        hasLocalizedNames && Array.isArray(form.nameAliases)
            ? form.nameAliases.filter(isRecord)
            : [];
    const keys = new Map<string, string>();
    const groups = [
        { key: 'officialNames', rows: officialNames, official: true },
        { key: 'commonNames', rows: commonNames, official: false },
    ];
    for (const group of groups) {
        if (!Array.isArray(group.rows)) continue;
        group.rows.forEach((row, index) => {
            if (!isRecord(row)) return;
            keys.set(`${group.key}.${index}`, `${destination}.${rows.length}`);
            rows.push({ ...row, official: group.official });
        });
    }
    return {
        ...current,
        [destination]: rows,
        ...(Array.isArray(form.sourceReferences)
            ? {
                  sourceReferences: form.sourceReferences.map((reference) => ({
                      ...reference,
                      key: keys.get(reference.key) ?? reference.key,
                  })),
              }
            : {}),
    } as T;
}
