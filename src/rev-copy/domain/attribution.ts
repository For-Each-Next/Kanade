/**
 * @file src/rev-copy/domain/attribution.ts
 * Purpose: Generate safe, revision-specific translation and copying attribution.
 * Contents: Options, wikitext links, validation, and localized summaries/notices.
 */

import {
    attributionCatalogs,
    getAttributionLocale,
    getWikimediaProjectLabel,
    getWikipediaLabel,
} from './attribution-messages';
import type { AttributionMode } from './attribution-messages';
import type { AttributionPage } from './page-reference';
import { formatRevisionTimestamp } from './revision-links';
import { normalizeHomeWiki } from './wiki-site';
import type { WikiSite } from './wiki-site';

export interface AttributionOptions {
    mode: AttributionMode;
    notice: boolean;
    /** Copy mode only: summarize content removed from the source page. */
    sourceSummary?: boolean;
    partial: boolean;
    modified: boolean;
    interfaceLanguage: string;
}

function escapeAttributionText(value: string): string {
    const entities: Readonly<Record<string, string>> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '[': '&#91;',
        ']': '&#93;',
        '|': '&#124;',
        '{': '&#123;',
        '}': '&#125;',
        "'": '&#39;',
        '~': '&#126;',
        '\r': ' ',
        '\n': ' ',
    };
    return value.replace(
        /[&<>\[\]|{}'~\r\n]/gu,
        (character) => entities[character],
    );
}

function attributionLink(
    page: AttributionPage,
    home: WikiSite,
    revision = false,
    label?: string,
): string {
    const site = normalizeHomeWiki(page.site.interwiki);
    const prefix = site === normalizeHomeWiki(home.interwiki) ? '' : `${site}:`;
    const title = revision
        ? `Special:PermaLink/${page.revisionId}`
        : page.pageTitle.replace(/_/gu, ' ');
    const fragment = page.sectionId
        ? `#${escapeAttributionText(page.sectionId)}`
        : '';
    const text = label === undefined ? '' : `|${escapeAttributionText(label)}`;
    return `[[:${prefix}${escapeAttributionText(title)}${fragment}${text}]]`;
}

function requireRevision(
    page: AttributionPage,
    role: string,
): asserts page is AttributionPage & { revisionId: number; timestamp: string } {
    if (!Number.isSafeInteger(page.revisionId) || (page.revisionId ?? 0) <= 0) {
        throw new Error(`An available ${role} revision ID is required.`);
    }
    if (
        !page.timestamp ||
        !Number.isFinite(new Date(page.timestamp).getTime())
    ) {
        throw new Error(`An available ${role} revision timestamp is required.`);
    }
}

function interpolate(
    template: string,
    values: Readonly<Record<string, string>>,
): string {
    return template.replace(
        /\{([a-z]+)\}/gu,
        (_match, key: string) => values[key],
    );
}

export function generateAttribution(
    from: AttributionPage,
    to: AttributionPage,
    options: AttributionOptions,
): string {
    if (options.sourceSummary && options.mode !== 'copy') {
        throw new Error('A source edit summary is available only for copying.');
    }
    if (options.sourceSummary && options.notice) {
        throw new Error(
            'Choose either a source edit summary or a talk notice.',
        );
    }
    if (!from.pageTitle.trim() || !to.pageTitle.trim()) {
        throw new Error('Source and destination page titles are required.');
    }
    requireRevision(from, 'source');
    if (options.notice) requireRevision(to, 'destination');

    const home = options.notice || options.sourceSummary ? from.site : to.site;
    const locale = getAttributionLocale(
        home.language,
        options.interfaceLanguage,
    );
    const messages = attributionCatalogs[locale];
    if (options.sourceSummary) {
        const template = messages.sourceSummary;
        let targetRevision = '';
        if (to.revisionId !== undefined) {
            requireRevision(to, 'destination');
            targetRevision = interpolate(template.revision, {
                revision: attributionLink(
                    to,
                    home,
                    true,
                    formatRevisionTimestamp(to.timestamp, locale),
                ),
            });
        }
        const text = options.partial
            ? (template.partialText ?? template.text)
            : template.text;
        return interpolate(text, {
            to: attributionLink(to, home),
            targetrevision: targetRevision,
            partial: options.partial
                ? (template.partial ?? messages.partial)
                : '',
            modified: options.modified
                ? (template.modified ?? messages.modified)
                : '',
        });
    }
    const wikipedia = to.site.interwiki.startsWith('w:')
        ? getWikipediaLabel(
              to.site.language,
              locale,
              to.site.interwiki,
              'destination',
          )
        : getWikimediaProjectLabel(
              normalizeHomeWiki(to.site.interwiki),
              locale,
          );
    const revisionLabel = formatRevisionTimestamp(from.timestamp, locale);
    const values = {
        from: attributionLink(from, home),
        revision: attributionLink(from, home, true, revisionLabel),
        wiki: options.notice ? attributionLink(to, home, true, wikipedia) : '',
        action: messages.action[options.mode],
        partial: options.partial ? messages.partial : '',
        modified: options.modified ? messages.modified : '',
    };
    if (!options.notice) return interpolate(messages.summary, values);
    const heading = interpolate(messages.heading[options.mode], {
        wiki: escapeAttributionText(wikipedia),
    });
    const notice =
        typeof messages.notice === 'string'
            ? messages.notice
            : messages.notice[options.mode];
    return `== ${heading} ==\n\n${interpolate(notice, values)} --~~~~`;
}
