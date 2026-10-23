/**
 * @file src/rev-copy/types/host.d.ts
 * Purpose: Declare the gadget's browser configuration and ResourceLoader queue.
 *
 * Contents: Browser configuration, singleton state, and ResourceLoader declarations.
 */

interface Window {
    RLQ?: { push(callback: () => void): unknown };
    revCopyConfig?: {
        homeWiki?: string;
        displayWikitext?: boolean;
    };
}
