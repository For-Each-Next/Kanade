/**
 * @file src/rev-copy/index.ts
 * Purpose: Export pure link, page-reference, and attribution rules without starting the gadget.
 *
 * Contents: Pure public link, reference, and attribution exports.
 */

export {
    buildPageLink,
    buildRevisionLinks,
    formatRevisionTimestamp,
} from './domain/revision-links';
export type { RevisionLinks, RevisionLinkInput } from './domain/revision-links';
export {
    identifyWikiSite,
    normalizeHomeWiki,
    getInterwikiPrefix,
} from './domain/wiki-site';
export type { WikiSite } from './domain/wiki-site';
export { parsePageReference } from './domain/page-reference';
export type { AttributionPage, PageReference } from './domain/page-reference';
export { generateAttribution } from './domain/attribution';
export type { AttributionOptions } from './domain/attribution';
