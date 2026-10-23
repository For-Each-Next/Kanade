/**
 * @file src/library/wikitext/source-ranges.ts
 * Purpose: Shared source-interval merging, masking, and replacement.
 *
 * Contents: Source intervals, replacement values, and offset-preserving operations.
 */

export interface SourceRange {
    end: number;
    start: number;
}

export interface SourceReplacement extends SourceRange {
    value: string;
}

/** Trims whitespace from an interval without changing its source coordinates. */
export function trimSourceRange(
    source: string,
    start: number,
    end: number,
): SourceRange {
    while (start < end && /\s/u.test(source[start] ?? '')) {
        start += 1;
    }
    while (start < end && /\s/u.test(source[end - 1] ?? '')) {
        end -= 1;
    }
    return { end, start };
}

/** Checks whether an editable interval is bounded by the supplied source. */
export function isValidSourceRange(
    source: string,
    range: SourceRange,
): boolean {
    return (
        Number.isInteger(range.start) &&
        Number.isInteger(range.end) &&
        range.start >= 0 &&
        range.end >= range.start &&
        range.end <= source.length
    );
}

/** Finds the current line's end without including its LF or CRLF terminator. */
export function findLineContentEnd(source: string, start: number): number {
    const newline = source.indexOf('\n', start);
    if (newline < 0) {
        return source.length;
    }
    return source[newline - 1] === '\r' ? newline - 1 : newline;
}

/** Skips spaces and tabs without crossing the caller's source boundary. */
export function skipHorizontalWhitespace(
    source: string,
    start: number,
    end: number,
): number {
    let index = start;
    while (index < end && /[\t ]/u.test(source[index] ?? '')) {
        index += 1;
    }
    return index;
}

/** Combines overlapping or touching intervals without mutating their inputs. */
export function mergeSourceRanges(
    ranges: readonly SourceRange[],
): SourceRange[] {
    const merged: SourceRange[] = [];
    for (const range of ranges.toSorted(
        (left, right) => left.start - right.start || right.end - left.end,
    )) {
        const previous = merged.at(-1);
        if (previous == null || previous.end < range.start) {
            merged.push({ ...range });
            continue;
        }
        previous.end = Math.max(previous.end, range.end);
    }
    return merged;
}

/** Blanks selected source intervals while preserving all source offsets. */
export function maskSourceRanges(
    source: string,
    ranges: readonly SourceRange[],
): string {
    let cursor = 0;
    let masked = '';
    for (const range of mergeSourceRanges(ranges)) {
        masked += source.slice(cursor, range.start);
        masked += ' '.repeat(range.end - range.start);
        cursor = range.end;
    }
    return masked + source.slice(cursor);
}

/** Applies non-overlapping edits using their original source offsets. */
export function replaceSourceRanges(
    source: string,
    replacements: readonly SourceReplacement[],
): string {
    let result = source;
    for (const replacement of replacements.toSorted(
        (left, right) => right.start - left.start,
    )) {
        result =
            result.slice(0, replacement.start) +
            replacement.value +
            result.slice(replacement.end);
    }
    return result;
}
