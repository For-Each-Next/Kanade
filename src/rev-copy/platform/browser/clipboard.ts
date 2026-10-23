/**
 * @file src/rev-copy/platform/browser/clipboard.ts
 * Purpose: Copy wikitext through the browser's clipboard API.
 *
 * Contents: Clipboard availability and asynchronous text writing.
 */

export async function copyText(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
}
