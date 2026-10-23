/**
 * @file src/rev-copy/platform/mediawiki/response.ts
 * Purpose: Validate revision timestamps at the MediaWiki response boundary.
 *
 * Contents: Exact whole-second UTC revision timestamp validation.
 */

export function isRevisionTimestamp(value: unknown): value is string {
    if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value)
    ) {
        return false;
    }
    const date = new Date(value);
    return (
        Number.isFinite(date.getTime()) &&
        date.toISOString() === value.replace(/Z$/u, '.000Z')
    );
}
