/**
 * @file src/vg-stub-creator/domain/wikitext/reference-data.ts
 * Purpose: Resolves values against ordered reference definitions.
 *
 * Table of contents:
 * 1. Imports
 * 2. ReferenceAlias
 * 3. ReferenceDefinition
 * 4. getReferenceValues
 * 5. getReferenceDefinition
 * 6. matchesReferenceAlias
 * 7. normalizeAlias
 */

import { getWikilinkValue } from './field-values.ts';

type ReferenceAlias = string | RegExp;

/** Common identity fields supported by lookup reference data. */
interface ReferenceDefinition {
    aliases?: readonly ReferenceAlias[];
    label?: string;
    page?: string;
}

/** Flattens one array-valued property from matched reference data. */
export function getReferenceValues<Definition extends object>(
    references: Array<Definition>,
    key: string,
): Array<string> {
    return references.flatMap(function getValues(reference) {
        const values = Reflect.get(reference, key) as string[] | undefined;
        return values || [];
    });
}

/** Gets the first reference matching its display name, page, or alias. */
export function getReferenceDefinition<Definition extends ReferenceDefinition>(
    definitions: readonly Definition[],
    value: string,
): Definition | undefined {
    const unwrappedValue = getWikilinkValue(value);
    const normalizedValue = normalizeAlias(unwrappedValue);
    if (normalizedValue === '') return undefined;

    return definitions.find(
        (definition) =>
            [definition.page, definition.label].some(
                (name) =>
                    name != null && normalizeAlias(name) === normalizedValue,
            ) ||
            (definition.aliases ?? []).some((alias) =>
                matchesReferenceAlias(alias, unwrappedValue, normalizedValue),
            ),
    );
}

function matchesReferenceAlias(
    alias: ReferenceAlias,
    value: string,
    normalizedValue: string,
): boolean {
    if (typeof alias === 'string') {
        return normalizeAlias(alias) === normalizedValue;
    }

    alias.lastIndex = 0;
    const match = alias.exec(value);
    return match?.[0] === value;
}

function normalizeAlias(alias: string): string {
    return alias.toLocaleLowerCase();
}
