/**
 * @file src/source-editor/config/citation-template-data/types.ts
 * Purpose: Metadata fields retained from citation-template TemplateData.
 *
 * Table of contents:
 * 1. CitationTemplateData
 * 2. CitationTemplateDataMap
 */

export interface CitationTemplateData {
    aliases: Record<string, string[]>;
    canonicalName?: string;
    dateParams?: string[];
    paramOrder: string[];
}

/** Citation metadata keyed by normalized template name. */
export type CitationTemplateDataMap = Record<string, CitationTemplateData>;
