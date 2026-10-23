/**
 * @file src/wpvg-assessor/platform/mediawiki/language.ts
 * Purpose: Reads the host interface language for the pure catalog translator.
 *
 * Contents: Host interface-language selection.
 */

export function getInterfaceLanguage(): string {
    return typeof mw === 'undefined'
        ? 'en'
        : String(mw.config.get('wgUserLanguage') || 'en');
}
