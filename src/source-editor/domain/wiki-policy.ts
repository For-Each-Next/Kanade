/**
 * @file src/source-editor/domain/wiki-policy.ts
 * Purpose: Select explicit project rules independently of interface or source language.
 *
 * Contents: Policy contracts, supported project policies, and citation date normalization.
 */

import { isGregorianCalendarDate } from './calendar-date.ts';

export interface CitationDatePolicy {
    /** Normalize known dates without changing their precision or guessing missing parts. */
    normalize(value: string): string;
}

export interface WikiPolicy {
    readonly id: 'enwiki' | 'zhwiki' | 'generic';
    readonly citationDates: CitationDatePolicy;
}

const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
] as const;

const POLICIES: Record<WikiPolicy['id'], WikiPolicy> = {
    enwiki: {
        id: 'enwiki',
        citationDates: { normalize: (value) => normalizeDate(value, 'named') },
    },
    zhwiki: {
        id: 'zhwiki',
        citationDates: { normalize: (value) => normalizeDate(value, 'iso') },
    },
    generic: {
        id: 'generic',
        citationDates: { normalize: (value) => value },
    },
};

/** Only verified project identities opt into local citation conventions. */
export function resolveWikiPolicy(wikiId: string): WikiPolicy {
    return wikiId === 'enwiki' || wikiId === 'zhwiki'
        ? POLICIES[wikiId]
        : POLICIES.generic;
}

interface DateParts {
    year: string;
    month: number;
    day?: number;
}

function normalizeDate(value: string, monthStyle: 'named' | 'iso'): string {
    const original = value.trim();
    const suffix = original.match(/(\s*<!--[\s\S]*?-->\s*)$/u)?.[1] ?? '';
    const date =
        suffix === '' ? original : original.slice(0, -suffix.length).trim();
    const parts = parseDate(date);
    if (
        parts == null ||
        !isGregorianCalendarDate(parts.year, parts.month, parts.day ?? 1)
    ) {
        return value;
    }
    const { year, month, day } = parts;
    // CS1 numeric dates are Gregorian. Keep historical and uncertain input intact.
    if (Number(year) < 1583) return value;
    if (day == null && monthStyle === 'named') {
        return `${MONTHS[month - 1]} ${year}${suffix}`;
    }
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    return day == null
        ? `${yearMonth}${suffix}`
        : `${yearMonth}-${String(day).padStart(2, '0')}${suffix}`;
}

function parseDate(value: string): DateParts | null {
    const numeric = value.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/u);
    if (numeric != null)
        return parts(numeric[1], Number(numeric[2]), numeric[3]);
    const chinese = value.match(/^(\d{4})年(\d{1,2})月(?:(\d{1,2})日)?$/u);
    if (chinese != null)
        return parts(chinese[1], Number(chinese[2]), chinese[3]);
    const monthFirst = value.match(
        /^([A-Za-z]+)\s+(?:(\d{1,2}),?\s+)?(\d{4})$/u,
    );
    if (monthFirst != null)
        return parts(monthFirst[3], monthNumber(monthFirst[1]), monthFirst[2]);
    const dayFirst = value.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/u);
    return dayFirst == null
        ? null
        : parts(dayFirst[3], monthNumber(dayFirst[2]), dayFirst[1]);
}

function parts(
    year: string,
    month: number,
    day: string | undefined,
): DateParts {
    return day == null ? { year, month } : { year, month, day: Number(day) };
}

function monthNumber(name: string): number {
    const normalized = name.toLowerCase();
    return (
        MONTHS.findIndex(
            (month) =>
                month.toLowerCase() === normalized ||
                month.slice(0, 3).toLowerCase() === normalized,
        ) + 1
    );
}
