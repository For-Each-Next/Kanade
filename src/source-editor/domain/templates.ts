/**
 * @file src/source-editor/domain/templates.ts
 * Purpose: Supported English Wikipedia CS1/CS2 citation templates.
 *
 * Table of contents:
 * 1. Imports
 * 2. TemplateNameContext
 * 3. Constants and state
 * 4. createTemplateNameContext
 * 5. normalizeTemplateName
 * 6. normalizeTemplateDisplayName
 * 7. stripTemplatePrefix
 * 8. stripCanonicalTemplatePrefix
 * 9. normalizeTemplateIdentity
 * 10. getCanonicalTemplateName
 * 11. getCanonicalTemplateNameFromKey
 * 12. isCitationTemplate
 * 13. isEditableCitationTemplate
 * 14. isMetadataFreeCitationTemplate
 * 15. isCitePrefixedTemplate
 */

import {
    type NamespaceSource,
    normalizeNamespacePrefix,
    stripNamespacePrefix,
} from '../../library/wiki-titles/wikipedia.ts';

/** Namespace rules used while interpreting template transclusions. */
export interface TemplateNameContext {
    /** Current-wiki catalog, or null for the offline fallback. */
    readonly namespaceSource: NamespaceSource | null;
}

/**
 * Offline-safe behavior retained for deterministic package consumers.
 *
 * Without wiki data, operations recognize bare names and the canonical
 * Template namespace prefix only.
 */
export const DEFAULT_TEMPLATE_NAME_CONTEXT: TemplateNameContext = Object.freeze(
    { namespaceSource: null },
);

/** Creates immutable current-wiki template-name rules. */
export function createTemplateNameContext(
    namespaceSource: NamespaceSource,
): TemplateNameContext {
    return Object.freeze({ namespaceSource });
}

export const SUPPORTED_CITATION_TEMPLATES = [
    'Citation',
    'Cite arXiv',
    'Cite AV media',
    'Cite AV media notes',
    'Cite bioRxiv',
    'Cite book',
    'Cite CiteSeerX',
    'Cite conference',
    'Cite document',
    'Cite encyclopedia',
    'Cite episode',
    'Cite interview',
    'Cite journal',
    'Cite magazine',
    'Cite mailing list',
    'Cite map',
    'Cite medRxiv',
    'Cite news',
    'Cite newsgroup',
    'Cite podcast',
    'Cite press release',
    'Cite report',
    'Cite serial',
    'Cite sign',
    'Cite speech',
    'Cite SSRN',
    'Cite tech report',
    'Cite thesis',
    'Cite tweet',
    'Cite web',
    'Cite video game',
] as const;

const indexCanonicalName = function indexCanonicalName(name: string) {
    return [normalizeTemplateIdentity(name), name] as const;
};
const canonicalTemplateEntries =
    SUPPORTED_CITATION_TEMPLATES.map(indexCanonicalName);
const CANONICAL_TEMPLATE_NAMES = new Map(canonicalTemplateEntries);
const CANONICAL_TEMPLATE_KEY_NAMES = new Map(
    SUPPORTED_CITATION_TEMPLATES.map(
        (name) => [normalizeTemplateName(name), name] as const,
    ),
);

const SUPPORTED_TEMPLATE_SET = new Set(
    SUPPORTED_CITATION_TEMPLATES.map((name) => normalizeTemplateIdentity(name)),
);

/**
 * Normalizes a template title for comparison and metadata lookup.
 *
 * @param value - Entered template title.
 * @param context
 * @returns Normalized template name.
 */
export function normalizeTemplateName(
    value: string,
    context: TemplateNameContext = DEFAULT_TEMPLATE_NAME_CONTEXT,
): string {
    return normalizeTemplateDisplayName(value, context).toLowerCase();
}

/**
 * Normalizes title syntax while preserving meaningful letter casing.
 *
 * @param value - Value to process.
 * @param context
 * @returns Value.
 */
function normalizeTemplateDisplayName(
    value: string,
    context: TemplateNameContext,
): string {
    return stripTemplatePrefix(value, context).replace(/[_\s]+/gu, ' ');
}

function stripTemplatePrefix(
    value: string,
    context: TemplateNameContext,
): string {
    const source = context.namespaceSource;
    return source == null
        ? stripCanonicalTemplatePrefix(value)
        : stripNamespacePrefix(value, source, 10);
}

/**
 * Removes the canonical Template prefix without assuming a local alias.
 *
 * @param value - Entered template title.
 * @returns Title without a recognized template prefix.
 */
function stripCanonicalTemplatePrefix(value: string): string {
    const title = value.trim();
    const entered = title.startsWith(':') ? title.slice(1).trimStart() : title;
    const separator = entered.indexOf(':');
    if (separator < 0) {
        return title;
    }
    const prefix = entered.slice(0, separator);
    return normalizeNamespacePrefix(prefix) === 'template'
        ? entered.slice(separator + 1).trim()
        : title;
}

/**
 * Normalizes syntax and MediaWiki's first-character title casing.
 *
 * @param value - Value to process.
 * @param context
 * @returns Normalized syntax with MediaWiki title casing.
 */
function normalizeTemplateIdentity(
    value: string,
    context: TemplateNameContext = DEFAULT_TEMPLATE_NAME_CONTEXT,
): string {
    const entered = normalizeTemplateDisplayName(value, context);
    if (entered === '') {
        return '';
    }
    return entered[0].toUpperCase() + entered.slice(1);
}

/**
 * Returns the canonical display casing of an editable template name.
 *
 * @param value - Entered or normalized template title.
 * @param context
 * @returns Canonically cased template name.
 */
export function getCanonicalTemplateName(
    value: string,
    context: TemplateNameContext = DEFAULT_TEMPLATE_NAME_CONTEXT,
): string {
    const identity = normalizeTemplateIdentity(value, context);
    const supported = CANONICAL_TEMPLATE_NAMES.get(identity);
    if (supported != null) {
        return supported;
    }
    return identity;
}

/**
 * Returns a canonical display name for a stored lowercase metadata key.
 *
 * @param value - Value to process.
 * @param context
 * @returns Canonical display name for a lowercase metadata key.
 */
export function getCanonicalTemplateNameFromKey(
    value: string,
    context: TemplateNameContext = DEFAULT_TEMPLATE_NAME_CONTEXT,
): string {
    const normalized = normalizeTemplateName(value, context);
    if (value === normalized) {
        const supported = CANONICAL_TEMPLATE_KEY_NAMES.get(normalized);
        if (supported != null) {
            return supported;
        }
    }
    return getCanonicalTemplateName(value, context);
}

/**
 * Returns whether a template is in the supported CS1 set.
 *
 * @param value - Entered template title.
 * @param context
 * @returns Whether the template is supported.
 */
export function isCitationTemplate(
    value: string,
    context: TemplateNameContext = DEFAULT_TEMPLATE_NAME_CONTEXT,
): boolean {
    return SUPPORTED_TEMPLATE_SET.has(
        normalizeTemplateIdentity(value, context),
    );
}

/**
 * Returns whether a citation template can be edited as a source draft.
 *
 * @param value - Value to process.
 * @param context
 * @returns Whether a citation template can be edited as a source draft.
 */
export function isEditableCitationTemplate(
    value: string,
    context: TemplateNameContext = DEFAULT_TEMPLATE_NAME_CONTEXT,
): boolean {
    return (
        isCitationTemplate(value, context) ||
        isCitePrefixedTemplate(value, context)
    );
}

/**
 * Returns whether an editable template lacks local TemplateData.
 *
 * @param value - Value to process.
 * @param context
 * @returns Whether an editable template lacks local TemplateData.
 */
export function isMetadataFreeCitationTemplate(
    value: string,
    context: TemplateNameContext = DEFAULT_TEMPLATE_NAME_CONTEXT,
): boolean {
    return (
        !isCitationTemplate(value, context) &&
        isCitePrefixedTemplate(value, context)
    );
}

/**
 * Returns whether a title uses the Cite template-name family.
 *
 * @param value - Value to process.
 * @param context
 * @returns Whether a title uses the Cite template-name family.
 */
export function isCitePrefixedTemplate(
    value: string,
    context: TemplateNameContext = DEFAULT_TEMPLATE_NAME_CONTEXT,
): boolean {
    const normalized = normalizeTemplateName(value, context);
    return /^cite(?:\s|$)/u.test(normalized);
}
