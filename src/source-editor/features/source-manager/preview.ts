/**
 * @file src/source-editor/features/source-manager/preview.ts
 * Purpose: Semantic segmentation for citation-source previews.
 *
 * Table of contents:
 * 1. Imports
 * 2. SourcePreviewPart
 * 3. SourcePreviewRange
 * 4. buildSourcePreview
 * 5. findParameterNameRanges
 * 6. findAliasCommentRanges
 */

import { wikitext } from '../../../library/wikitext/index.ts';

export interface SourcePreviewPart {
    kind: 'alias' | 'parameter' | 'text';
    text: string;
}

interface SourcePreviewRange {
    end: number;
    kind: 'alias' | 'parameter';
    start: number;
}

/**
 * Marks parameter names and alias comments for safe preview styling.
 *
 * @param source - Serialized citation-template wikitext.
 * @returns Ordered text segments with semantic display kinds.
 */
export function buildSourcePreview(source: string): SourcePreviewPart[] {
    const ranges = [
        ...findParameterNameRanges(source),
        ...findAliasCommentRanges(source),
    ].sort((left, right) => left.start - right.start);
    const result: SourcePreviewPart[] = [];
    let cursor = 0;
    for (const range of ranges) {
        if (range.start > cursor) {
            result.push({
                kind: 'text',
                text: source.slice(cursor, range.start),
            });
        }
        result.push({
            kind: range.kind,
            text: source.slice(range.start, range.end),
        });
        cursor = range.end;
    }
    if (cursor < source.length) {
        result.push({ kind: 'text', text: source.slice(cursor) });
    }
    return result;
}

/**
 * Locates top-level parameter labels in formatted citation source.
 *
 * @param source - Source text.
 * @returns Resulting values.
 */
function findParameterNameRanges(source: string): SourcePreviewRange[] {
    if (!source.startsWith('{{') || !source.endsWith('}}')) {
        return [];
    }
    const parts = wikitext(source.slice(2, -2)).split('|');
    let cursor = 2 + (parts.shift()?.length ?? 0);
    return parts.flatMap(function findParameterName(part) {
        cursor += 1;
        const start = cursor + (part.match(/^\s*/u)?.[0].length ?? 0);
        const separator = part.indexOf('=');
        const end =
            separator < 0
                ? start
                : cursor + part.slice(0, separator).trimEnd().length;
        cursor += part.length;
        return end > start ? [{ end, kind: 'parameter' as const, start }] : [];
    });
}

/**
 * Locates hashtag alias comments in formatted citation source.
 *
 * @param source - Source text.
 * @returns Resulting values.
 */
function findAliasCommentRanges(source: string): SourcePreviewRange[] {
    const pattern = /<!--(?:(?!-->)[\s\S])*?#(?:(?!-->)[\s\S])*?-->/gu;
    return [...source.matchAll(pattern)].map(function toRange(match) {
        return {
            end: match.index + match[0].length,
            kind: 'alias' as const,
            start: match.index,
        };
    });
}
