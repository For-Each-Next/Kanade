/**
 * @file src/library/wikitext/template-parameters.ts
 * Purpose: Triple-brace template-parameter syntax queries.
 *
 * Table of contents:
 * 1. Imports
 * 2. TemplateParameterRange
 * 3. BraceEntry
 * 4. findTemplateParameterRanges
 */

import {
    findOpaqueRanges,
    type SourceRange,
    type WikitextOptions,
} from './opaque-ranges.ts';

export interface TemplateParameterRange extends SourceRange {
    depth: number;
}

interface BraceEntry {
    depth?: number;
    kind: 'parameter' | 'template';
    start: number;
}

/**
 * Finds balanced triple-brace template parameters.
 *
 * @param source - Wikitext to scan.
 * @param options - Literal tags to protect.
 * @returns Balanced template-parameter ranges in source order.
 */
export function findTemplateParameterRanges(
    source: string,
    options: WikitextOptions = {},
): TemplateParameterRange[] {
    const opaque = findOpaqueRanges(source, options);
    const stack: BraceEntry[] = [];
    const ranges: TemplateParameterRange[] = [];
    let opaqueIndex = 0;
    let index = 0;

    while (index < source.length - 2) {
        while (opaque[opaqueIndex]?.end <= index) {
            opaqueIndex += 1;
        }
        const hidden = opaque[opaqueIndex];
        if (hidden != null && index >= hidden.start) {
            index = hidden.end;
            continue;
        }
        const top = stack.at(-1);
        if (top?.kind === 'parameter' && source.startsWith('}}}', index)) {
            stack.pop();
            ranges.push({
                depth: top.depth ?? 0,
                end: index + 3,
                start: top.start,
            });
            index += 3;
            continue;
        }
        if (top?.kind === 'template' && source.startsWith('}}', index)) {
            stack.pop();
            index += 2;
            continue;
        }
        if (source.startsWith('{{{', index)) {
            stack.push({
                depth: stack.filter((entry) => entry.kind === 'parameter')
                    .length,
                kind: 'parameter',
                start: index,
            });
            index += 3;
            continue;
        }
        if (source.startsWith('{{', index)) {
            stack.push({ kind: 'template', start: index });
            index += 2;
            continue;
        }
        index += 1;
    }
    return ranges.toSorted(
        (left, right) => left.start - right.start || right.end - left.end,
    );
}
