/**
 * @file src/source-editor/domain/citation-metadata.ts
 * Purpose: Maps raw Citoid metadata into local citation-template wikitext.
 * Contents: Local metadata normalization, parameter mapping, and citation formatting.
 */

import type { WikiPolicy } from './wiki-policy.ts';
import { getCitationTemplateName } from '../../library/citation-metadata/templates.ts';
import { isRecord } from '../../library/data-validation/records.ts';
import {
    canonicalizeCitation,
    formatBlockCitation,
    formatInlineCitation,
} from './citation.ts';
import { citationTemplateData as templateData } from '../config/citation-template-data/index.ts';
import type { CitationParam, CitationTemplate } from './types.ts';

const ACCESS_DATE_LENGTH = 10;

/** Raw Zotero-style metadata fields used by Source Editor. */
export interface RawCitationMetadata extends Record<string, unknown> {
    DOI?: unknown;
    ISBN?: unknown;
    ISSN?: unknown;
    PMCID?: unknown;
    PMID?: unknown;
    bookTitle?: unknown;
    creators?: unknown;
    date?: unknown;
    edition?: unknown;
    extra?: unknown;
    issue?: unknown;
    itemType?: unknown;
    language?: unknown;
    oclc?: unknown;
    pages?: unknown;
    place?: unknown;
    publicationTitle?: unknown;
    publisher?: unknown;
    series?: unknown;
    title?: unknown;
    url?: unknown;
    via?: unknown;
    volume?: unknown;
    websiteTitle?: unknown;
}

/** Options controlling raw citation-metadata mapping. */
export interface CitationMetadataFormatOptions {
    wikiPolicy?: WikiPolicy;
    bibliographic?: boolean;
    now?: Date;
    url?: string;
}

interface RawCitationCreator extends Record<string, unknown> {
    creatorType?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    name?: unknown;
}

/**
 * Builds locally canonicalized wikitext from raw Citoid metadata.
 *
 * @param metadata - Unprocessed Zotero-style Citoid metadata.
 * @param options - URL, access date, and identifier-query options.
 * @returns Citation template wikitext using local TemplateData.
 */
export function buildCitationTemplate(
    metadata: RawCitationMetadata,
    options: CitationMetadataFormatOptions = {},
): string {
    const template = getCitationTemplateName(getText(metadata.itemType));
    const params = buildCitationParams(metadata, options);
    const citation: CitationTemplate = { name: template, params };
    const canonical = canonicalizeCitation(
        citation,
        templateData[template] ?? templateData['cite web'],
        options.wikiPolicy,
    );

    return template === 'cite web'
        ? formatBlockCitation(canonical)
        : formatInlineCitation(canonical);
}

/**
 * Maps raw metadata fields to supported CS1 parameters.
 *
 * @param metadata - Citation metadata.
 * @param options - Operation options.
 * @returns Mapped raw metadata fields to supported CS1 parameters.
 */
function buildCitationParams(
    metadata: RawCitationMetadata,
    options: CitationMetadataFormatOptions,
): CitationParam[] {
    const bibliographic = options.bibliographic === true;
    const sourceUrl = getSourceUrl(metadata.url, options.url);
    const bookSection = metadata.itemType === 'bookSection';
    const journalArticle = metadata.itemType === 'journalArticle';
    const values: Record<string, string> = {
        'access-date':
            !bibliographic || sourceUrl !== ''
                ? formatAccessDate(options.now)
                : '',
        author: formatCreators(metadata.creators, 'author'),
        date: getText(metadata.date),
        language: getText(metadata.language),
        publisher: getText(metadata.publisher),
        title: normalizeCitationTitle(metadata.title),
        url: sourceUrl,
        via: getText(metadata.via),
        website:
            getText(metadata.websiteTitle) ||
            getText(metadata.publicationTitle),
    };
    if (bibliographic) {
        Object.assign(
            values,
            buildBibliographicValues(metadata, bookSection, journalArticle),
        );
    }

    return Object.entries(values)
        .filter((entry) => entry[1] !== '')
        .map(buildCitationParam);
}

/**
 * Adds fields returned for DOI, ISBN, ISSN, and similar lookups.
 *
 * @param metadata - Citation metadata.
 * @param bookSection - Book section value.
 * @param journalArticle - Journal article value.
 * @returns Operation result.
 */
function buildBibliographicValues(
    metadata: RawCitationMetadata,
    bookSection: boolean,
    journalArticle: boolean,
): Record<string, string> {
    const websiteTitle = getText(metadata.websiteTitle);
    const website = journalArticle
        ? websiteTitle
        : websiteTitle || getText(metadata.publicationTitle);
    return {
        chapter: bookSection ? normalizeCitationTitle(metadata.title) : '',
        doi: getIdentifierText(metadata.DOI),
        edition: getText(metadata.edition),
        isbn: getIdentifierText(metadata.ISBN),
        issn: getIdentifierText(metadata.ISSN),
        issue: getText(metadata.issue),
        journal: journalArticle ? getText(metadata.publicationTitle) : '',
        location: getText(metadata.place),
        oclc:
            getText(metadata.oclc) ||
            getExtraIdentifier(metadata.extra, 'OCLC'),
        pages: getText(metadata.pages),
        pmc:
            getText(metadata.PMCID) ||
            getExtraIdentifier(metadata.extra, 'PMCID').replace(/^PMC/iu, ''),
        pmid:
            getText(metadata.PMID) ||
            getExtraIdentifier(metadata.extra, 'PMID'),
        series: getText(metadata.series),
        title: normalizeCitationTitle(
            bookSection ? metadata.bookTitle : metadata.title,
        ),
        volume: getText(metadata.volume),
        website,
    };
}

/**
 * Creates one safe citation parameter from a mapped entry.
 *
 * @param entry - Entry to process.
 * @returns Created safe citation parameter from a mapped entry.
 */
function buildCitationParam([name, value]: [string, string]): CitationParam {
    return { name, value: escapeTemplateValue(value) };
}

/**
 * Prevents remote values from injecting another template parameter.
 *
 * @param value - Value to process.
 * @returns Resulting text.
 */
function escapeTemplateValue(value: string): string {
    return value.replace(/\|/gu, '{{!}}');
}

/**
 * Chooses the original entered URL over a URL rewritten by Citoid.
 *
 * @param metadataUrl - Metadata url value.
 * @param enteredUrl - Entered url value.
 * @returns Original URL when Citoid supplied a rewritten URL.
 */
function getSourceUrl(metadataUrl: unknown, enteredUrl: string | undefined) {
    return enteredUrl == null ? getText(metadataUrl) : enteredUrl.trim();
}

/**
 * Joins every author creator into one CS1 author value.
 *
 * @param value - Value to process.
 * @param creatorType - Creator type value.
 * @returns Resulting text.
 */
function formatCreators(value: unknown, creatorType: string): string {
    if (!Array.isArray(value)) {
        return '';
    }
    return value
        .filter(isRecord)
        .filter((creator) => creator.creatorType === creatorType)
        .map(formatCreator)
        .filter(Boolean)
        .join('; ');
}

/**
 * Formats a corporate or personal creator name.
 *
 * @param creator - Creator value.
 * @returns Formatted corporate or personal creator name.
 */
function formatCreator(creator: RawCitationCreator): string {
    const name = getText(creator.name);
    if (name !== '') {
        return name;
    }
    return [getText(creator.firstName), getText(creator.lastName)]
        .filter(Boolean)
        .join(' ');
}

/**
 * Formats the first scalar identifier returned by Citoid.
 *
 * @param value - Value to process.
 * @returns Formatted the first scalar identifier returned by Citoid.
 */
function getIdentifierText(value: unknown): string {
    if (!Array.isArray(value)) {
        return getText(value);
    }
    const candidate = value.find((item) => item != null);
    return getText(candidate);
}

/**
 * Reads an identifier from Zotero's newline-delimited extra field.
 *
 * @param extra - Extra value.
 * @param name - Name to process.
 * @returns Read identifier from Zotero's newline-delimited extra field.
 */
function getExtraIdentifier(extra: unknown, name: string): string {
    const pattern = new RegExp(`(?:^|\\n)${name}:\\s*(\\S+)`, 'iu');
    return getText(extra).match(pattern)?.[1] ?? '';
}

/**
 * Removes generated titles that contain only a URL.
 *
 * @param value - Value to process.
 * @returns Resulting text.
 */
function normalizeCitationTitle(value: unknown): string {
    const title = getText(value);
    try {
        new URL(title);
        return '';
    } catch {
        return title;
    }
}

/**
 * Converts one optional access date to an ISO calendar date.
 *
 * @param now - Now value.
 * @returns Converted optional access date to an ISO calendar date.
 */
function formatAccessDate(now: Date | undefined): string {
    return (now ?? new Date()).toISOString().slice(0, ACCESS_DATE_LENGTH);
}

/**
 * Reads one Citoid scalar without stringifying objects.
 *
 * @param value - Value to process.
 * @returns Read Citoid scalar without stringifying objects.
 */
function getText(value: unknown): string {
    if (typeof value === 'string') {
        return value.trim();
    }
    if (typeof value === 'number') {
        return String(value);
    }
    return '';
}
