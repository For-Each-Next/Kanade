/**
 * @file src/library/wikitext-highlighting/highlight-partition.ts
 * Purpose: Resolves overlapping highlights into lossless source segments.
 *
 * Contents: Range partitioning, syntax classes, and passive renderer annotations.
 */

import {
    mergeSourceRanges as mergeRanges,
    type SourceRange,
} from '../wikitext/index.ts';

export interface PagePreviewTarget {
    /** "local" or a lowercase two-letter Wikipedia language code. */
    wiki: string;
    title: string;
}

/** Text styling and passive annotations; consumers decide whether to use annotations. */
export interface HighlightSegment {
    classNames: string[];
    end: number;
    entity?: string;
    href?: string;
    missingTitle?: string;
    pagePreview?: PagePreviewTarget;
    referenceSource?: string;
    referenceStart?: number;
    start: number;
    text: string;
}

export interface HighlightRange extends SourceRange {
    className: string;
    entity?: string;
    href?: string;
    missingTitle?: string;
    pagePreview?: PagePreviewTarget;
    priority: number;
    referenceSource?: string;
    referenceStart?: number;
}

const NON_VISIBLE_LINK_TOKEN_CLASSES = new Set([
    'kanade-source-editor-token--html-tag',
    'kanade-source-editor-token--module-name',
    'kanade-source-editor-token--parameter',
    'kanade-source-editor-token--template-delimiter',
    'kanade-source-editor-token--template-name',
    'kanade-source-editor-token--wiki-markup',
]);
const SMALL_REFERENCE_TOKEN_CLASSES = new Set([
    'kanade-source-editor-token--reference',
    'kanade-source-editor-token--footnote',
]);

/** Produces ordered source segments from overlapping ranges. */
export function partitionHighlightRanges(
    source: string,
    ranges: HighlightRange[],
): HighlightSegment[] {
    const boundaries = new Set([0, source.length]);
    const starts = new Map<number, HighlightRange[]>();
    const ends = new Map<number, HighlightRange[]>();
    for (const range of ranges) {
        boundaries.add(range.start);
        boundaries.add(range.end);
        addRangeBoundary(starts, range.start, range);
        addRangeBoundary(ends, range.end, range);
    }
    const points = [...boundaries].sort((left, right) => left - right);
    const segments: HighlightSegment[] = [];
    const active = new Set<HighlightRange>();
    for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index];
        const end = points[index + 1];
        starts.get(start)?.forEach((range) => active.add(range));
        ends.get(start)?.forEach((range) => active.delete(range));
        if (start !== end) {
            segments.push(createSegment(source, start, end, [...active]));
        }
    }
    return segments;
}

function addRangeBoundary(
    boundaries: Map<number, HighlightRange[]>,
    point: number,
    range: HighlightRange,
): void {
    const matches = boundaries.get(point) ?? [];
    matches.push(range);
    boundaries.set(point, matches);
}

function createSegment(
    source: string,
    start: number,
    end: number,
    ranges: HighlightRange[],
): HighlightSegment {
    // The boundary sweep passes only ranges covering this entire segment.
    const active = ranges.sort((left, right) => right.priority - left.priority);
    const opaque = active.find((range) => range.priority === 100);
    const visible =
        opaque == null
            ? active
            : [...active.filter((range) => range.priority > 100), opaque];
    const classNames = [...new Set(visible.map((range) => range.className))];
    if (
        opaque?.className === 'kanade-source-editor-token--comment' &&
        active.some((range) =>
            SMALL_REFERENCE_TOKEN_CLASSES.has(range.className),
        )
    ) {
        // Comments stay opaque and retain their own palette, while still
        // inheriting the editor's optional small reference/note text size.
        classNames.push('kanade-source-editor-token--small-reference-comment');
    }
    const pagePreview = visible.find(
        (range) => range.pagePreview != null,
    )?.pagePreview;
    const reference = visible.find((range) => range.referenceSource != null);
    return {
        classNames,
        end,
        entity: visible.find((range) => range.entity != null)?.entity,
        href: visible.find((range) => range.href != null)?.href,
        missingTitle: getVisibleMissingTitle(visible, classNames),
        ...(pagePreview == null ? {} : { pagePreview }),
        referenceSource: reference?.referenceSource,
        ...(reference?.referenceStart == null
            ? {}
            : { referenceStart: reference.referenceStart }),
        start,
        text: source.slice(start, end),
    };
}

function getVisibleMissingTitle(
    ranges: HighlightRange[],
    classNames: string[],
): string | undefined {
    if (classNames.some((name) => NON_VISIBLE_LINK_TOKEN_CLASSES.has(name))) {
        return undefined;
    }
    return ranges.find((range) => range.missingTitle != null)?.missingTitle;
}

/** Combines non-empty highlight intervals without mutating their inputs. */
export function mergeSourceRanges(ranges: SourceRange[]): SourceRange[] {
    return mergeRanges(ranges.filter((range) => range.start < range.end));
}
