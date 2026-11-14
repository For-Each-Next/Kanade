/**
 * @file src/source-editor/domain/wiki-site.ts
 * Purpose: Site syntax required to safely transform wikitext.
 *
 * Table of contents:
 * 1. Imports
 * 2. WikiNamespaceState
 */

import type { NamespaceSource } from '../../library/wiki-titles/canonical.ts';
import type { TemplateMagicWordCatalog } from '../../library/wikitext/magic-words.ts';

export interface WikiNamespaceState {
    /** Whether redirect rewrites preserve embed semantics. */
    redirectsSafe: boolean;
    source: NamespaceSource;
    /** Site syntax used to classify template-like constructs. */
    templateMagicWords: TemplateMagicWordCatalog | null;
    /** Whether template redirects are safe to rewrite. */
    templateRedirectsSafe: boolean;
}
