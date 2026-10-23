/**
 * @file src/source-editor/domain/language-codes.ts
 * Purpose: src / domain / citations / language codes module.
 *
 * Table of contents:
 * 1. Constants and state
 * 2. normalizeEnglishLanguageCodes
 * 3. normalizeLanguageValue
 */

/**
 * Normalizes English ISO language names for reusable gadget workflows.
 *
 * The small table covers common languages in citation data.
 */

const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{1,8})*$/iu;
const WIKITEXT_SYNTAX_PATTERN = /(?:\{\{|\}\}|\[\[|\]\]|[<>|])/u;
const LANGUAGE_CODES_BY_ENGLISH_NAME = new Map([
    ['arabic', 'ar'],
    ['bengali', 'bn'],
    ['chinese', 'zh'],
    ['dutch', 'nl'],
    ['english', 'en'],
    ['french', 'fr'],
    ['german', 'de'],
    ['hindi', 'hi'],
    ['indonesian', 'id'],
    ['italian', 'it'],
    ['japanese', 'ja'],
    ['korean', 'ko'],
    ['mandarin chinese', 'zh'],
    ['marathi', 'mr'],
    ['persian', 'fa'],
    ['polish', 'pl'],
    ['portuguese', 'pt'],
    ['punjabi', 'pa'],
    ['russian', 'ru'],
    ['spanish', 'es'],
    ['swahili', 'sw'],
    ['tamil', 'ta'],
    ['telugu', 'te'],
    ['turkish', 'tr'],
    ['urdu', 'ur'],
    ['vietnamese', 'vi'],
    ['yue chinese', 'yue'],
]);

/**
 * Replaces recognized English language names with compact ISO codes.
 *
 * Existing code-like values and unrecognized names are retained.
 *
 * @param value - A comma-separated citation language value.
 * @returns Safely normalized language codes and comma spacing.
 */
export function normalizeEnglishLanguageCodes(value: string): string {
    const trimmed = value.trim();
    if (trimmed === '' || WIKITEXT_SYNTAX_PATTERN.test(trimmed)) {
        return trimmed;
    }
    const values = trimmed.split(',').map((item) => item.trim());
    if (values.some((item) => item === '')) {
        return trimmed;
    }
    return values.map(normalizeLanguageValue).join(', ');
}

/**
 * Normalizes one name while giving existing tags precedence.
 *
 * @param value - Value to process.
 * @returns Normalized name while giving existing tags precedence.
 */
function normalizeLanguageValue(value: string): string {
    if (LANGUAGE_CODE_PATTERN.test(value)) {
        return value;
    }
    const lookup = value.toLowerCase();
    return LANGUAGE_CODES_BY_ENGLISH_NAME.get(lookup) ?? value;
}
