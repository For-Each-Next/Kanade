/**
 * @file src/source-editor/config/citation-template-data/index.ts
 * Purpose: Product-owned generated citation TemplateData facade.
 *
 * Table of contents:
 * 1. Imports
 * 2. Exports
 */

import citationTemplateData from './generated/index.ts';
import citeBookTemplateData from './generated/cite-book.ts';
import citeWebTemplateData from './generated/cite-web.ts';

export type { CitationTemplateData, CitationTemplateDataMap } from './types.ts';

export { citationTemplateData, citeBookTemplateData, citeWebTemplateData };
