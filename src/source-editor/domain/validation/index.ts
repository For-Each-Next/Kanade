/**
 * @file src/source-editor/domain/validation/index.ts
 * Purpose: src / domain / validation / index module.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. getCitationValidationConfig
 * 4. Exports
 */

import { ENWIKI_CITATION_VALIDATION } from './enwiki.ts';
import type { CitationValidationConfig } from './types.ts';
import { ZHWIKI_CITATION_VALIDATION } from './zhwiki.ts';

const CITATION_VALIDATION_CONFIGS = [
    ENWIKI_CITATION_VALIDATION,
    ZHWIKI_CITATION_VALIDATION,
] as const;

/**
 * Selects citation rules for one MediaWiki database name.
 *
 * @param wikiId - Wiki id value.
 * @returns Selected citation rules for one MediaWiki database name.
 */
export function getCitationValidationConfig(
    wikiId: string,
): CitationValidationConfig {
    const normalized = wikiId.toLowerCase();
    return (
        CITATION_VALIDATION_CONFIGS.find((config) =>
            config.wikiIds.includes(normalized),
        ) ?? ENWIKI_CITATION_VALIDATION
    );
}

export type { CitationValidationConfig } from './types.ts';
