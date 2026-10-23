/**
 * @file src/source-editor/domain/api.ts
 * Purpose: Side-effect-free citation operations for composition and tests.
 *
 * Table of contents:
 * 1. Imports
 * 2. CitationManagementContext
 * 3. formatCitations
 * 4. manageCitations
 * 5. manageCitationsWithResult
 * 6. Exports
 */

import { resolveWikiPolicy, type WikiPolicy } from './wiki-policy.ts';
import { citationTemplateData as templateData } from '../config/citation-template-data/index.ts';
import {
    applyNameOverrides,
    compactReferenceCalls,
    expandCompactReferenceCalls,
    type NameOverrideUpdate,
} from './manager.ts';
import {
    formatCitationWikitext,
    type CitationFormatResult,
} from './citation-formatter.ts';
import type { CitationLayout, CitationTemplateDataMap } from './types.ts';
import {
    DEFAULT_TEMPLATE_NAME_CONTEXT,
    type TemplateNameContext,
} from './templates.ts';

export interface CitationManagementContext {
    wikiPolicy?: WikiPolicy;
    leadSectionLabel?: string;
    runtimeTemplateData?: CitationTemplateDataMap;
    separateReferenceDefinitions?: boolean;
    templateNameContext?: TemplateNameContext;
}

/**
 * Formats article wikitext with generated local TemplateData.
 *
 * @param text - Text to process.
 * @param layout - Citation layout.
 * @param leadSectionLabel - Lead section label value.
 * @param runtimeTemplateData - Runtime template data value.
 * @param separateReferenceDefinitions - Whether full definitions are separated by a blank line.
 * @returns Article wikitext formatted with local TemplateData.
 */
export function formatCitations(
    text: string,
    layout: CitationLayout = 'block',
    leadSectionLabel: string = 'Lead',
    runtimeTemplateData: CitationTemplateDataMap = {},
    templateNameContext: TemplateNameContext = DEFAULT_TEMPLATE_NAME_CONTEXT,
    separateReferenceDefinitions: boolean = false,
    wikiPolicy: WikiPolicy = resolveWikiPolicy(''),
): CitationFormatResult {
    const activeTemplateData = { ...runtimeTemplateData, ...templateData };
    return formatCitationWikitext(
        text,
        activeTemplateData,
        layout,
        leadSectionLabel,
        templateNameContext,
        separateReferenceDefinitions,
        wikiPolicy,
    );
}

/**
 * Applies name edits, formatting, and the selected reuse-tag style.
 *
 * @param text - Text to process.
 * @param updates - Updates value.
 * @param useCompactReferences - Use compact references value.
 * @param layout - Citation layout.
 * @param leadSectionLabel - Lead section label value.
 * @returns Resulting text.
 */
export function manageCitations(
    text: string,
    updates: NameOverrideUpdate[],
    useCompactReferences: boolean,
    layout: CitationLayout = 'block',
    leadSectionLabel: string = 'Lead',
): string {
    return manageCitationsWithResult(
        text,
        updates,
        useCompactReferences,
        layout,
        leadSectionLabel,
    ).text;
}

/**
 * Applies manager edits while retaining citation-formatting counts.
 *
 * @param text - Text to process.
 * @param updates - Updates value.
 * @param useCompactReferences - Use compact references value.
 * @param layout - Citation layout.
 * @param context - Context value.
 * @returns Operation result.
 */
export function manageCitationsWithResult(
    text: string,
    updates: NameOverrideUpdate[],
    useCompactReferences: boolean,
    layout: CitationLayout = 'block',
    context: CitationManagementContext | string = 'Lead',
): CitationFormatResult {
    const templateNameContext =
        typeof context === 'string'
            ? DEFAULT_TEMPLATE_NAME_CONTEXT
            : (context.templateNameContext ?? DEFAULT_TEMPLATE_NAME_CONTEXT);
    const overridden = applyNameOverrides(text, updates, templateNameContext);
    const leadSectionLabel =
        typeof context === 'string'
            ? context
            : (context.leadSectionLabel ?? 'Lead');
    const runtimeTemplateData =
        typeof context === 'string' ? {} : (context.runtimeTemplateData ?? {});
    const separateReferenceDefinitions =
        typeof context === 'string'
            ? false
            : (context.separateReferenceDefinitions ?? false);
    const wikiPolicy =
        typeof context === 'string'
            ? resolveWikiPolicy('')
            : context.wikiPolicy;
    const formatted = formatCitations(
        overridden,
        layout,
        leadSectionLabel,
        runtimeTemplateData,
        templateNameContext,
        separateReferenceDefinitions,
        wikiPolicy,
    );
    formatted.text = useCompactReferences
        ? compactReferenceCalls(formatted.text, templateNameContext)
        : expandCompactReferenceCalls(formatted.text, templateNameContext);
    return formatted;
}

export {
    findUsedCitationTemplates,
    findUsedMetadataFreeCitationTemplates,
    formatCitationWikitext,
} from './citation-formatter.ts';
export { normalizeEnglishDate } from './citation.ts';
export { findNameOverrideFields } from './manager.ts';

export type { CitationFormatResult } from './citation-formatter.ts';
export type {
    NameOverrideField,
    NameOverrideOccurrence,
    NameOverrideUpdate,
    NameOverrideUsageItem,
} from './manager.ts';
export type {
    CitationLayout,
    CitationTemplateData,
    CitationTemplateDataMap,
} from './types.ts';
