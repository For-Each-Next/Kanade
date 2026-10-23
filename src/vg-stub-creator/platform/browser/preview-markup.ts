/**
 * @file src/vg-stub-creator/platform/browser/preview-markup.ts
 * Purpose: Serializes MediaWiki preview content without its outer container.
 *
 * Table of contents:
 * 1. serializeElementContent
 */

/**
 * Serializes every child of an HTML element.
 *
 * @param element - Preview container.
 * @returns Serialized child markup.
 */
export function serializeElementContent(element: Element): string {
    const serializer = new XMLSerializer();
    const serializeNode = (node: Node) => serializer.serializeToString(node);
    return Array.from(element.childNodes, serializeNode).join('');
}
