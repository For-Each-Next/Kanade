/**
 * @file src/vg-stub-creator/index.ts
 * Purpose: Pure operations available to integrations without starting the browser UI.
 *
 * Table of contents:
 * 1. Exports
 */

export { buildEditSummary } from './domain/edit-summary.ts';
export type { EditSummaryMetadata } from './domain/edit-summary.ts';
export {
    buildLinkText,
    buildTemplateText,
    splitFieldValues,
} from './domain/wikitext/index.ts';
export { updateMovedTitleText } from './domain/title-move.ts';
export type { ArticleDataRecord, ArticleForm } from './domain/models.ts';
