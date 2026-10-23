/**
 * @file src/library/citation-metadata/templates.ts
 * Purpose: Map Zotero item types to the supported CS1 citation templates.
 * Contents: Shared template selection for metadata consumers.
 */

export function getCitationTemplateName(itemType: string): string {
    if (itemType === 'journalArticle') return 'cite journal';
    if (itemType === 'book' || itemType === 'bookSection') return 'cite book';
    if (itemType === 'newspaperArticle' || itemType === 'magazineArticle') {
        return 'cite news';
    }
    return 'cite web';
}
