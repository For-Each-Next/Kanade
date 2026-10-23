/**
 * @file src/vg-stub-creator/platform/mediawiki/language.ts
 * Purpose: Read the interface language at the host boundary.
 *
 * Table of contents:
 * 1. getMediaWikiInterfaceLanguage
 */

export function getMediaWikiInterfaceLanguage(): string {
    return typeof mw === 'undefined'
        ? 'en'
        : String(mw.config.get('wgUserLanguage') || 'en');
}
