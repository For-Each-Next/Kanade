/**
 * @file src/rev-copy/platform/browser/content-boundary.ts
 * Purpose: Place the row at each skin's boundary before the page body.
 *
 * Contents: Skin insertion targets and owned row mounting.
 */

export function mountBeforeContent(
    element: HTMLElement,
    root: Document = document,
): boolean {
    const boundary = root.querySelector(
        '.vector-body-before-content, #content > .pre-content',
    );
    if (boundary) {
        boundary.append(element);
        return true;
    }
    // These host wrappers occur after title/subtitle/notices and before page text.
    const content = root.querySelector(
        '#mw-content-text, #bodyContent .mw-body-content, #content .mw-body-content',
    );
    if (!content?.parentElement) return false;
    content.before(element);
    return true;
}
