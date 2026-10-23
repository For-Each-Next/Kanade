/**
 * @file src/source-editor/platform/mediawiki/interface-language.ts
 * Purpose: Reads the interface language selected by the current MediaWiki user.
 *
 * Table of contents:
 * 1. getMediaWikiInterfaceLanguage
 */

export function getMediaWikiInterfaceLanguage(): string {
    if (typeof mw === 'undefined') {
        return 'en';
    }
    return String(mw.config.get('wgUserLanguage') || 'en');
}
