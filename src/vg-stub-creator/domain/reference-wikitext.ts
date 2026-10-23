/**
 * @file src/vg-stub-creator/domain/reference-wikitext.ts
 * Purpose: Builds named MediaWiki reference wikitext.
 *
 * Table of contents:
 * 1. CitationReference
 * 2. ReferencesSectionOptions
 * 3. nameCitationReferences
 * 4. createNamedCitationReference
 * 5. buildNamedReferenceTag
 * 6. buildReferenceReuseTag
 * 7. buildReferencesSection
 * 8. escapeReferenceName
 */

export interface CitationReference {
    citation: string;
    name: string;
    [key: string]: unknown;
}

interface ReferencesSectionOptions {
    heading: string;
    responsive?: boolean;
}

/**
 * Assigns deterministic names to citation references.
 *
 * @param references - References value.
 * @returns Result when the function
 *   assigns deterministic names to citation
 *   references.
 */
export function nameCitationReferences<
    Reference extends Partial<CitationReference>,
>(references: Reference[]): Array<Reference & CitationReference> {
    return references.map(createNamedCitationReference);
}

/**
 * Creates one named citation reference.
 *
 * @param reference - Reference value.
 * @param index - Zero-based item index.
 * @returns One named citation reference.
 */
function createNamedCitationReference<
    Reference extends Partial<CitationReference>,
>(reference: Reference, index: number): Reference & CitationReference {
    const result = {
        ...reference,
        citation: reference.citation || '',
        name: reference.name || `:${index + 1}`,
    };
    return result;
}

/**
 * Builds a full named `<ref>...</ref>` tag.
 *
 * @param reference - Reference value.
 * @returns A full named `<ref>...</ref>` tag.
 */
function buildNamedReferenceTag(reference: CitationReference): string {
    const result = [
        '<ref name="',
        escapeReferenceName(reference.name),
        '">',
        reference.citation,
        '</ref>',
    ].join('');
    return result;
}

/**
 * Builds a self-closing tag that reuses a named reference.
 *
 * @param name - Display name.
 * @returns A self-closing tag that reuses a named reference.
 */
export function buildReferenceReuseTag(name: string): string {
    return `<ref name="${escapeReferenceName(name)}" />`;
}

/**
 * Builds a references section containing full named references.
 *
 * @param references - References value.
 * @param options - Operation options.
 * @returns A references section containing full named references.
 */
export function buildReferencesSection(
    references: CitationReference[],
    options: ReferencesSectionOptions,
): string {
    if (references.length === 0) {
        return '';
    }
    const responsive = options.responsive === false ? '' : ' responsive';
    const result = [
        `== ${options.heading} ==`,
        '',
        `<references${responsive}>`,
        references.map(buildNamedReferenceTag).join('\n'),
        '</references>',
    ].join('\n');
    return result;
}

/**
 * Escapes a reference name for a wikitext tag attribute.
 *
 * @param name - Display name.
 * @returns A reference name for a wikitext tag attribute.
 */
function escapeReferenceName(name: string): string {
    return String(name).replace(/&/gu, '&amp;').replace(/"/gu, '&quot;');
}
