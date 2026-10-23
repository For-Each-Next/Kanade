/**
 * @file src/vg-stub-creator/platform/network/index.ts
 * Purpose: Public entry point for external source adapters.
 *
 * Table of contents:
 * 1. Exports
 */

export { createCitationStore } from './citation-store.ts';
export {
    fetchSourceReferences,
    prepareManagedCitationRows,
} from './source-references.ts';
