/**
 * @file src/wpvg-assessor/domain/new-page-summary.ts
 * Purpose: Builds English registration summaries for individual and staged pages.
 * Contents: Registration entries, byte-limited summaries, and legacy default detection.
 */

import { getTitleNamespaceId } from '../../library/wiki-titles/wikipedia.ts';

export interface RegistrationSummaryEntry {
    title: string;
    creationDate: Date;
    summary?: string;
}

const SUMMARY_SOURCE_LINK =
    '[[:m:User:For Each ... Next/global.js/vg page assessor.js|🍄]]';
const SUMMARY_BYTE_LIMIT = 255;
const encoder = new TextEncoder();
const PAGE_TYPES = [
    { namespace: 6, singular: 'file', plural: 'files' },
    { namespace: 14, singular: 'category', plural: 'categories' },
    { namespace: 10, singular: 'template', plural: 'templates' },
    { namespace: 828, singular: 'module', plural: 'modules' },
    { namespace: 118, singular: 'draft', plural: 'drafts' },
    { namespace: -1, singular: 'other page', plural: 'other pages' },
] as const;

/** Builds one English registration summary using the page's UTC creation date. */
export function buildNewPageListSummary(
    title: string,
    creationDate: Date,
): string {
    return buildGeneratedSummary([{ title, creationDate }], []);
}

/** Consolidates generated summaries while retaining separately reviewed custom text. */
export function buildNewPageListBatchSummary(
    entries: ReadonlyArray<RegistrationSummaryEntry>,
): string {
    const generated: RegistrationSummaryEntry[] = [];
    const custom = new Set<string>();
    for (const entry of entries) {
        const summary = entry.summary?.trim() ?? '';
        if (isGeneratedSummary(entry, summary)) {
            generated.push(entry);
        } else {
            custom.add(summary);
        }
    }
    return buildGeneratedSummary(generated, [...custom]);
}

function buildGeneratedSummary(
    entries: ReadonlyArray<RegistrationSummaryEntry>,
    custom: ReadonlyArray<string>,
): string {
    const full = formatSummary(entries.map(formatRegistration), custom);
    if (entries.length === 0 || fitsSummary(full)) {
        return full;
    }

    const articles: string[] = [];
    const counts = new Map<number, number>();
    for (const entry of entries) {
        const namespace = getTitleNamespaceId(entry.title, 'zhwiki');
        if (namespace === 0) {
            articles.push(formatRegistration(entry));
        } else {
            const group = PAGE_TYPES.some(
                (type) => type.namespace === namespace,
            )
                ? namespace
                : -1;
            counts.set(group, (counts.get(group) ?? 0) + 1);
        }
    }
    const countedPages = PAGE_TYPES.flatMap((type) => {
        const count = counts.get(type.namespace) ?? 0;
        return count === 0
            ? []
            : [`${count} ${count === 1 ? type.singular : type.plural}`];
    });
    const compact = (shown: number): string => {
        const remaining = articles.length - shown;
        const omitted =
            remaining === 0
                ? []
                : [
                      `${remaining} ${shown > 0 ? 'more ' : ''}${remaining === 1 ? 'article' : 'articles'}`,
                  ];
        return formatSummary(
            [...articles.slice(0, shown), ...omitted, ...countedPages],
            custom,
        );
    };
    const allArticles = compact(articles.length);
    if (fitsSummary(allArticles)) {
        return allArticles;
    }
    // Reserve the count suffix, marker, and reviewed custom text before adding links.
    let summary = compact(0);
    for (let shown = 1; shown < articles.length; shown += 1) {
        const candidate = compact(shown);
        if (!fitsSummary(candidate)) {
            break;
        }
        summary = candidate;
    }
    // Custom text remains intact even when it leaves no room within the limit.
    return summary;
}

function fitsSummary(summary: string): boolean {
    return encoder.encode(summary).length <= SUMMARY_BYTE_LIMIT;
}

function formatSummary(
    registrations: ReadonlyArray<string>,
    custom: ReadonlyArray<string>,
): string {
    if (registrations.length === 0) {
        return custom.join('; ');
    }
    const pages =
        registrations.length === 1
            ? registrations[0]
            : `${registrations.slice(0, -1).join(', ')} and ${registrations.at(-1)}`;
    return [`Register ${pages} ${SUMMARY_SOURCE_LINK}`, ...custom].join('; ');
}

function formatRegistration(entry: RegistrationSummaryEntry): string {
    const month = new Intl.DateTimeFormat('en-GB', {
        month: 'short',
        timeZone: 'UTC',
    }).format(entry.creationDate);
    return `[[${entry.title}]] (${month} ${entry.creationDate.getUTCDate()})`;
}

function isGeneratedSummary(
    entry: RegistrationSummaryEntry,
    summary: string,
): boolean {
    if (
        !summary ||
        summary === buildNewPageListSummary(entry.title, entry.creationDate)
    ) {
        return true;
    }
    // Existing cross-tab drafts can retain defaults generated by older locales.
    const englishDate = new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
    }).format(entry.creationDate);
    const chineseDate = `${entry.creationDate.getUTCMonth() + 1}月${entry.creationDate.getUTCDate()}日`;
    return [
        formatSummary([formatRegistration(entry)], []),
        `Register [[${entry.title}]] (${englishDate}) ${SUMMARY_SOURCE_LINK}`,
        `登记[[${entry.title}]]（${chineseDate}）${SUMMARY_SOURCE_LINK}`,
        `登記[[${entry.title}]]（${chineseDate}）${SUMMARY_SOURCE_LINK}`,
    ].includes(summary);
}
