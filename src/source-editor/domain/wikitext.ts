/**
 * @file src/source-editor/domain/wikitext.ts
 * Purpose: Wikitext replacements owned by Source Editor.
 *
 * Table of contents:
 * 1. Imports
 * 2. applyReplacements
 */

import type { TextReplacement } from './types.ts';
import { replaceSourceRanges } from '../../library/wikitext/index.ts';

/**
 * Applies non-overlapping replacements from the end of a string.
 *
 * @param text - Text to process.
 * @param replacements - Source replacements.
 * @returns Resulting text.
 */
export function applyReplacements(
    text: string,
    replacements: TextReplacement[],
): string {
    return replaceSourceRanges(
        text,
        replacements.map(({ end, start, text: value }) => ({
            end,
            start,
            value,
        })),
    );
}
