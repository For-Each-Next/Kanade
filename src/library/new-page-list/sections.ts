/**
 * @file src/library/new-page-list/sections.ts
 * Purpose: Shares year and date insertion rules for project new-page lists.
 * Contents: Date-line lookup, descending insertion, blank tails, and year insertion.
 */

interface ListDate {
    day: number;
    month: number;
}

/**
 * Finds the first matching date using the caller's date-line grammar.
 * The pattern captures month and day in its first two groups.
 */
export function findMatchingDateLine(
    lines: Array<string>,
    pattern: RegExp,
    date: ListDate,
): number {
    return lines.findIndex((line) => {
        const match = line.match(pattern);
        return (
            match != null &&
            Number(match[1]) === date.month &&
            Number(match[2]) === date.day
        );
    });
}

/**
 * Finds the first earlier date for descending insertion.
 * The caller's pattern captures month and day in its first two groups.
 */
export function findDateInsertIndex(
    lines: Array<string>,
    pattern: RegExp,
    date: ListDate,
): number {
    return lines.findIndex((line) => {
        const match = line.match(pattern);
        if (match == null) return false;

        const month = Number(match[1]);
        return (
            month < date.month ||
            (month === date.month && Number(match[2]) < date.day)
        );
    });
}

/** Finds a blank tail while retaining the first line of a section. */
export function findTrailingBlankLines(lines: Array<string>): number {
    let index = lines.length;
    while (index > 1 && lines[index - 1].trim() === '') {
        index -= 1;
    }
    return index;
}

/** Inserts a generated year before the first year heading, or after the preamble. */
export function insertYearSection(
    text: string,
    year: number,
    block: string,
): string {
    const firstYear = /^== \d{4}年 ==\s*$/mu.exec(text);
    const section = `== ${year}年 ==\n${block}\n\n`;

    if (firstYear == null) {
        return `${text.replace(/\s*$/u, '')}\n\n${section}`;
    }

    return (
        text.slice(0, firstYear.index) + section + text.slice(firstYear.index)
    );
}
