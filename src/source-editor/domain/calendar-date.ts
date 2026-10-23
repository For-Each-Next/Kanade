/**
 * @file src/source-editor/domain/calendar-date.ts
 * Purpose: Gregorian calendar validation shared by citation date workflows.
 *
 * Table of contents:
 * 1. isGregorianCalendarDate
 * 2. isCalendarDayWithinUtcMonth
 */

/**
 * Checks whether numeric components identify a valid Gregorian day.
 *
 * @param year - Calendar year.
 * @param month - One-based calendar month.
 * @param day - One-based day of month.
 * @returns Whether the supplied day exists.
 */
export function isGregorianCalendarDate(
    year: number | string,
    month: number | string,
    day: number | string,
): boolean {
    const numericYear = Number(year);
    const numericMonth = Number(month);
    const numericDay = Number(day);
    const date = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay));
    return (
        numericDay >= 1 &&
        date.getUTCFullYear() === numericYear &&
        date.getUTCMonth() === numericMonth - 1 &&
        date.getUTCDate() === numericDay
    );
}

/**
 * Checks a day against the UTC month length used by legacy CS1 input.
 *
 * This retains JavaScript's historical handling of years below 100.
 *
 * @param year - Year value.
 * @param month - Month value.
 * @param day - Day value.
 * @returns Whether the condition is met.
 */
export function isCalendarDayWithinUtcMonth(
    year: number | string,
    month: number | string,
    day: number | string,
): boolean {
    const numericYear = Number(year);
    const numericMonth = Number(month);
    const numericDay = Number(day);
    if (numericMonth < 1 || numericMonth > 12 || numericDay < 1) {
        return false;
    }
    const lastDay = new Date(
        Date.UTC(numericYear, numericMonth, 0),
    ).getUTCDate();
    return numericDay <= lastDay;
}
