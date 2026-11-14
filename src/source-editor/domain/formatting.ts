/**
 * @file src/source-editor/domain/formatting.ts
 * Purpose: Apply explicit article and citation formatting choices in a shared order.
 *
 * Contents: Formatting contracts and the deterministic Source Editor pipeline.
 */

import { formatWikitext, type FormatterOptions } from './formatter.ts';
import { convertCitationAuthorNames } from './citation-authors.ts';
import {
    formatCitations,
    manageCitationsWithResult,
    type CitationFormatResult,
    type CitationLayout,
    type CitationManagementContext,
} from './api.ts';

export interface ReferenceFormattingOptions extends CitationManagementContext {
    layout: CitationLayout;
    /** Split only explicit family, given author names; never infer natural-order names. */
    convertAuthorNames?: boolean;
    /** Omission preserves existing reference-call syntax. */
    compactReferences?: boolean;
}

export interface ArticleFormattingOptions {
    wikitext?: FormatterOptions;
    references?: ReferenceFormattingOptions;
}

export interface ArticleFormattingResult {
    text: string;
    references?: CitationFormatResult;
}

/** Specific citation layout follows general template layout; no operation is implicit. */
export function formatArticleSource(
    source: string,
    options: ArticleFormattingOptions,
): ArticleFormattingResult {
    let text = options.wikitext
        ? formatWikitext(source, options.wikitext).text
        : source;
    if (options.references == null) return { text };
    const { layout, compactReferences, convertAuthorNames, ...context } =
        options.references;
    if (convertAuthorNames) {
        text = convertCitationAuthorNames(text, context.templateNameContext);
    }
    const references =
        compactReferences === undefined
            ? formatCitations(
                  text,
                  layout,
                  context.leadSectionLabel,
                  context.runtimeTemplateData,
                  context.templateNameContext,
                  context.separateReferenceDefinitions,
                  context.wikiPolicy,
              )
            : manageCitationsWithResult(
                  text,
                  [],
                  compactReferences,
                  layout,
                  context,
              );
    text = references.text;
    return { text, references };
}
