/**
 * @file src/library/data-validation/records.ts
 * Purpose: Share object-shape checks at API, configuration, and storage boundaries.
 * Contents: Object guards and record readers with explicit missing-value contracts.
 */

/** Includes arrays for adapters that validate their properties separately. */
export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return isObject(value) && !Array.isArray(value);
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
    return isRecord(value) ? value : undefined;
}

export function readRecord(value: unknown): Record<string, unknown> | null {
    return asRecord(value) ?? null;
}
