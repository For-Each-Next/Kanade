/**
 * @file src/source-editor/index.ts
 * Purpose: Expose Source Editor's deterministic editing and reference operations without startup.
 *
 * Contents: Public article, reference, and citation operations.
 */

export {
    formatArticleSource,
    type ArticleFormattingOptions,
    type ArticleFormattingResult,
    type ReferenceFormattingOptions,
} from './domain/formatting.ts';
export {
    formatWikitext,
    type FormatterOptions,
    type FormatterResult,
    type FirstParameterLayout,
    type SubsequentParameterLayout,
} from './domain/formatter.ts';
export * from './domain/api.ts';
export { wikitext } from '../library/wikitext/index.ts';

export {
    resolveWikiPolicy,
    type WikiPolicy,
    type CitationDatePolicy,
} from './domain/wiki-policy.ts';
