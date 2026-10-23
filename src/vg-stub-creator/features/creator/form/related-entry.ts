/**
 * @file src/vg-stub-creator/features/creator/form/related-entry.ts
 * Purpose: Classifies one related-page entry without losing template invocation parameters.
 *
 * Table of contents:
 * 1. Imports
 * 2. RelatedEntry
 * 3. parseRelatedEntry
 * 4. parseTemplateEntry
 */

import {
    hasNamespacePrefix,
    stripNamespacePrefix,
} from '../../../../library/wiki-titles/wikipedia.ts';
import { wikitext } from '../../../../library/wikitext/index.ts';
import {
    getWikilinkParts,
    trimValue,
} from '../../../domain/wikitext/field-values.ts';
import { readRelatedTemplate, type RelatedItemKind } from './related-items.ts';

/** A normalized value accepted by one of the existing related review-row contracts. */
export interface RelatedEntry {
    kind: RelatedItemKind;
    value: string;
}

/** Defaults plain names to categories and recognizes explicit template syntax. */
export function parseRelatedEntry(value: unknown): RelatedEntry | null {
    const text = trimValue(value);
    if (text === '') return null;

    const template = readRelatedTemplate(text);
    if (template != null) {
        const title = stripNamespacePrefix(template.name, 'zhwiki', 10);
        return parseTemplateEntry(title, template.params.length > 0, text);
    }

    const entered = getWikilinkParts(text)?.target || text;
    if (hasNamespacePrefix(entered, 'zhwiki', 10)) {
        const invocation = stripNamespacePrefix(entered, 'zhwiki', 10);
        const parsed = wikitext.template.parse(invocation);
        return parseTemplateEntry(
            parsed.name,
            parsed.params.length > 0,
            `{{${invocation}}}`,
        );
    }

    const category = stripNamespacePrefix(entered, 'zhwiki', 14);
    return category === '' ? null : { kind: 'category', value: category };
}

/** Parameterized stub calls stay complete template calls to preserve their approved text. */
function parseTemplateEntry(
    title: string,
    parameterized: boolean,
    invocation: string,
): RelatedEntry | null {
    if (title === '') return null;
    return !parameterized && /-stub$/iu.test(title)
        ? { kind: 'stubTag', value: title }
        : { kind: 'navbox', value: invocation };
}
