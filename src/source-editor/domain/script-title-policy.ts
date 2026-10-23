/**
 * @file src/source-editor/domain/script-title-policy.ts
 * Purpose: Select citation script-title languages from the target content language.
 *
 * Contents: Eligibility modes, target-language policy, and illustrative language codes.
 */

export type ScriptTitleMode = 'all-foreign' | 'always' | 'non-latin';

export interface ScriptTitlePolicy {
    readonly contentLanguage: string;
    /** Return a safe primary language prefix when this policy permits conversion. */
    getLanguagePrefix(language: string, mode: ScriptTitleMode): string | null;
}

const LANGUAGE_CODE_PATTERN = /^([a-z]{2,3})(?:-[a-z0-9]{1,8})*$/iu;
const NON_LATIN_SCRIPT_LANGUAGE_CODES = new Set([
    'ab',
    'am',
    'ar',
    'as',
    'az',
    'be',
    'bg',
    'bn',
    'bo',
    'bs',
    'ce',
    'chr',
    'cu',
    'dv',
    'dz',
    'el',
    'fa',
    'grc',
    'gu',
    'he',
    'hi',
    'hy',
    'ja',
    'ka',
    'kaa',
    'kk',
    'km',
    'kn',
    'ko',
    'ku',
    'ky',
    'lo',
    'mk',
    'ml',
    'mn',
    'mni',
    'mr',
    'my',
    'ne',
    'or',
    'ota',
    'pa',
    'ps',
    'ru',
    'sd',
    'si',
    'sr',
    'syc',
    'ta',
    'te',
    'tg',
    'th',
    'ti',
    'tkr',
    'tt',
    'ug',
    'uk',
    'ur',
    'uz',
    'yi',
    'yue',
    'zh',
    'zgh',
]);

/** Resolve title eligibility independently of the interface language or wiki date policy. */
export function resolveScriptTitlePolicy(
    contentLanguage: string,
): ScriptTitlePolicy {
    const localLanguage = getPrimaryLanguage(contentLanguage);
    return {
        contentLanguage: localLanguage,
        getLanguagePrefix(language, mode) {
            const primaryLanguage = getPrimaryLanguage(language);
            if (primaryLanguage === '') {
                return null;
            }
            if (mode === 'always') {
                return primaryLanguage;
            }
            // A foreign-language decision needs a verified target language.
            if (
                localLanguage === '' ||
                primaryLanguage === localLanguage ||
                (mode === 'non-latin' &&
                    !NON_LATIN_SCRIPT_LANGUAGE_CODES.has(primaryLanguage))
            ) {
                return null;
            }
            return primaryLanguage;
        },
    };
}

/** Show representative eligible languages without deriving site rules from UI wording. */
export function getScriptTitleExampleLanguages(
    contentLanguage: string,
    mode: ScriptTitleMode,
): string[] {
    const localLanguage = getPrimaryLanguage(contentLanguage);
    if (localLanguage === '' && mode !== 'always') {
        return [];
    }
    const nonLatin = ['ja', 'ru', 'zh', 'ar']
        .filter((language) => language !== localLanguage)
        .slice(0, 2);
    if (mode === 'non-latin') {
        return nonLatin;
    }
    const foreignLanguage = localLanguage === 'en' ? 'de' : 'en';
    const foreignLanguages = [foreignLanguage, ...nonLatin];
    return mode === 'always' && localLanguage !== ''
        ? [localLanguage, ...foreignLanguages]
        : foreignLanguages;
}

function getPrimaryLanguage(language: string): string {
    return (
        language.trim().match(LANGUAGE_CODE_PATTERN)?.[1].toLowerCase() ?? ''
    );
}
