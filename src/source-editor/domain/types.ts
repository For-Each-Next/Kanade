/**
 * @file src/source-editor/domain/types.ts
 * Purpose: src / domain / types module.
 *
 * Table of contents:
 * 1. Imports
 * 2. Exports
 * 3. CitationParam
 * 4. CitationTemplate
 * 5. CitationLayout
 * 6. TextReplacement
 */

import type {
    CitationTemplateData,
    CitationTemplateDataMap,
} from '../config/citation-template-data/index.ts';
import type { SourceRange } from '../../library/wikitext/index.ts';

export type { CitationTemplateData, CitationTemplateDataMap };

/**
 * Canonicalized template parameter.
 */
export interface CitationParam {
    name: string;
    positional?: boolean;
    value: string;
}

/**
 * Parsed citation template.
 */
export interface CitationTemplate {
    name: string;
    params: CitationParam[];
}

/** Supported citation-template serialization layouts. */
export type CitationLayout = 'block' | 'inline';

/**
 * One replacement in a source string.
 */
export interface TextReplacement extends SourceRange {
    text: string;
}
