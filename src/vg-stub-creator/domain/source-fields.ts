/**
 * @file src/vg-stub-creator/domain/source-fields.ts
 * Purpose: Extracts entered citation source fields from article forms.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. getEnteredSourceReferenceFields
 * 4. getEnteredSourceUrls
 * 5. getEnteredNameSourceReferenceFields
 */

import { getArticleSourceFields } from './processor.ts';
import { normalizeArticleFormInput } from './article-input.ts';
import { buildNameSourceReferenceKey } from './wiki.ts';
import * as wikitext from './wikitext/index.ts';

const { splitSourceUrls, trimValue } = wikitext;

/**
 * Gets all source reference fields with entered URLs.
 *
 * @param form - Dialog form values.
 * @returns Entered source fields.
 */
export function getEnteredSourceReferenceFields(form: any): Array<any> {
    form = normalizeArticleFormInput(form);
    const expandSourceField = function expandSourceField(field: any) {
        return splitSourceUrls(form[field.sourceKey]).map(
            (sourceUrl: string) => ({
                ...field,
                sourceUrl,
            }),
        );
    };

    return [
        ...getArticleSourceFields().flatMap(expandSourceField),
        ...getEnteredNameSourceReferenceFields(form),
    ];
}

/**
 * Gets all unique source URLs currently entered in the form.
 *
 * @param form - Dialog form values.
 * @returns Unique source URLs.
 */
export function getEnteredSourceUrls(form: any): Array<string> {
    const enteredUrls = getEnteredSourceReferenceFields(form)
        .map((field) => trimValue(field.sourceUrl))
        .filter(Boolean);
    return [...new Set(enteredUrls)];
}

/**
 * Gets source fields for localized name rows with entered URLs.
 *
 * @param form - Dialog form values.
 * @returns Entered localized-name source fields.
 */
function getEnteredNameSourceReferenceFields(form: any): Array<any> {
    const expandNameGroup = function expandNameGroup(key: string) {
        const expandNameRow = function expandNameRow(
            row: { sourceUrl: unknown; name: unknown },
            index: number,
        ) {
            return splitSourceUrls(row.sourceUrl).map((sourceUrl: string) => ({
                key: buildNameSourceReferenceKey(key, index),
                name: row.name,
                sourceUrl,
            }));
        };
        const hasNameAndSource = function hasNameAndSource(field: {
            name: unknown;
            sourceUrl: unknown;
        }) {
            return (
                trimValue(field.name) !== '' &&
                trimValue(field.sourceUrl) !== ''
            );
        };

        return (form[key] || [])
            .flatMap(expandNameRow)
            .filter(hasNameAndSource);
    };

    return ['localizedNames', 'nameAliases'].flatMap(expandNameGroup);
}
