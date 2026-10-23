/**
 * @file src/source-editor/domain/validation/types.ts
 * Purpose: Site-specific settings used by the citation draft validator.
 *
 * Table of contents:
 * 1. CitationValidationConfig
 */

export interface CitationValidationConfig {
    additionalParameters: readonly string[];
    dateStyle: 'english' | 'chinese';
    numberedParameters: readonly string[];
    wikiIds: readonly string[];
}
