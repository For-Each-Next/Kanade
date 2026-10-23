/**
 * @file src/source-editor/domain/protected-wikitext.ts
 * Purpose: Protected wikitext ranges skipped by citation transformations.
 *
 * Table of contents:
 * 1. Imports
 * 2. WikitextRange
 * 3. findReferenceAttributeRanges
 * 4. Constants and state
 * 5. findCitationFormattingProtectedRanges
 * 6. findCitationManagementProtectedRanges
 * 7. findSourceDiscoveryProtectedRanges
 * 8. findProtectedWikitextRanges
 * 9. isInWikitextRanges
 * 10. maskWikitextRanges
 */

import { wikitext } from '../../library/wikitext/index.ts';

export type WikitextRange = readonly [start: number, end: number];

/** Finds native reference openings, whose attribute templates are not citations. */
export function findReferenceAttributeRanges(text: string): WikitextRange[] {
    return wikitext(text)
        .reference.getAll()
        .map((tag) => [tag.start, tag.contentStart] as const);
}

/**
 * Literal tags historically skipped by end-to-end citation formatting.
 */
const CITATION_FORMATTING_LITERAL_TAGS = [
    'nowiki',
    'pre',
    'syntaxhighlight',
    'source',
    'code',
] as const;

/**
 * Literal tags historically skipped by citation-management transforms.
 */
const CITATION_MANAGEMENT_LITERAL_TAGS = [
    'nowiki',
    'pre',
    'source',
    'syntaxhighlight',
] as const;

/**
 * Literal tags skipped while discovering editable article sources.
 */
const SOURCE_DISCOVERY_LITERAL_TAGS = [
    'nowiki',
    'pre',
    'source',
    'syntaxhighlight',
    'math',
    'code',
    'templatedata',
    'templatestyles',
    'graph',
    'timeline',
    'score',
    'mapframe',
] as const;

/**
 * Finds ranges protected from end-to-end citation formatting.
 *
 * @param text - Text to process.
 * @returns Ranges protected from end-to-end citation formatting.
 */
export function findCitationFormattingProtectedRanges(
    text: string,
): WikitextRange[] {
    return findProtectedWikitextRanges(text, CITATION_FORMATTING_LITERAL_TAGS);
}

/**
 * Finds ranges protected from citation-management transformations.
 *
 * @param text - Text to process.
 * @returns Ranges protected from citation-management transformations.
 */
export function findCitationManagementProtectedRanges(
    text: string,
): WikitextRange[] {
    return findProtectedWikitextRanges(text, CITATION_MANAGEMENT_LITERAL_TAGS);
}

/**
 * Finds ranges protected while discovering editable sources.
 *
 * @param text - Text to process.
 * @returns Ranges protected while discovering editable sources.
 */
export function findSourceDiscoveryProtectedRanges(
    text: string,
): WikitextRange[] {
    return findProtectedWikitextRanges(text, SOURCE_DISCOVERY_LITERAL_TAGS);
}

/**
 * Finds comments and selected literal-tag regions.
 *
 * @param text - Article wikitext.
 * @param literalTags - Literal tag names protected by the caller.
 * @returns Protected ranges in source order.
 */
function findProtectedWikitextRanges(
    text: string,
    literalTags: readonly string[],
): WikitextRange[] {
    return wikitext(text, { literalTags })
        .opaque.getAll()
        .map((range) => [range.start, range.end] as const);
}

/**
 * Checks whether a source offset lies inside a protected range.
 *
 * @param index - Source offset.
 * @param ranges - Protected source ranges.
 * @returns Whether the offset is protected.
 */
export function isInWikitextRanges(
    index: number,
    ranges: readonly WikitextRange[],
): boolean {
    return ranges.some(([start, end]) => index >= start && index < end);
}

/**
 * Masks ranges with spaces while retaining every source offset.
 *
 * @param text - Article wikitext.
 * @param ranges - Non-overlapping protected ranges in source order.
 * @returns Offset-preserving masked text.
 */
export function maskWikitextRanges(
    text: string,
    ranges: readonly WikitextRange[],
): string {
    const parts: string[] = [];
    let cursor = 0;
    for (const [start, end] of ranges) {
        parts.push(text.slice(cursor, start), ' '.repeat(end - start));
        cursor = end;
    }
    parts.push(text.slice(cursor));
    return parts.join('');
}
