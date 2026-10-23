/**
 * @file src/vg-stub-creator/domain/wiki-titles.ts
 * Purpose: Normalize Creator's reviewed page identities without changing its comparison contract.
 *
 * Contents: Page-title display normalization and case-insensitive reviewed-action keys.
 */

/** Normalizes page-title whitespace without changing case or namespace identity. */
export function normalizePageTitle(value: unknown): string {
    return String(value ?? '')
        .trim()
        .replace(/_/gu, ' ');
}

/** Builds the existing case-insensitive comparison key used by reviewed actions. */
export function normalizePageTitleKey(value: unknown): string {
    return normalizePageTitle(value).toLocaleLowerCase();
}
