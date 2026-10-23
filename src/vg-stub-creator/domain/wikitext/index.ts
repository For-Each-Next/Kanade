/**
 * @file src/vg-stub-creator/domain/wikitext/index.ts
 * Purpose: Public facade for Stub Creator's wikitext capabilities.
 *
 * Table of contents:
 * 1. Exports
 */

export {
    buildLinkText,
    buildTemplateCall,
    buildTemplateText,
    type TemplateParam,
    type TemplateParamValue,
} from './builders.ts';
export {
    formatPrefixedValue,
    getWikilinkParts,
    getWikilinkValue,
    hasFirstLevelFieldSeparator,
    isWikilinkValue,
    parsePrefixedValue,
    splitFieldValues,
    splitLookupFieldValues,
    splitSourceUrls,
    trimValue,
    uniqueValues,
    type PrefixedValue,
    type WikilinkParts,
} from './field-values.ts';
export {
    getReferenceDefinition,
    getReferenceValues,
} from './reference-data.ts';
