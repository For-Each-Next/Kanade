/**
 * @file src/source-editor/domain/formatter-settings.ts
 * Purpose: Validated Source Editor editor, article, and citation preferences shared by UI and storage.
 *
 * Table of contents:
 * 1. Imports
 * 2. CitationFormattingSettings and FormatterSettings
 * 3. EditorFeatureSettings
 * 4. Default citation and formatter settings
 * 5. getEditorFeatureSettings
 * 6. withEditorFeatureSettings
 * 7. parseFormatterSettings
 * 8. parseFormatterOptions
 * 9. parseEditorFeatures
 * 10. isRecord
 * 11. isFirstParameterLayout
 * 12. isSubsequentParameterLayout
 * 13. isCharacterWidthRatio
 * 14. isIndentSpaces
 * 15. parseCitationFormattingSettings
 */

import { isRecord } from '../../library/data-validation/records.ts';

import type {
    FirstParameterLayout,
    FormatterOptions,
    SubsequentParameterLayout,
} from './formatter.ts';
import type { ScriptTitleMode } from './source-manager.ts';

export interface CitationFormattingSettings {
    enabled: boolean;
    layout: 'inline' | 'block';
    compactReferences: boolean;
    separateReferenceDefinitions: boolean;
    formatScriptTitles: boolean;
    scriptTitleMode: ScriptTitleMode;
}

export interface FormatterSettings {
    citationFormatting: CitationFormattingSettings;
    alternateReferenceColors: boolean;
    ctrlClickLinks: boolean;
    fullPageReferencePreviews: boolean;
    formatter: FormatterOptions;
    highlightMissing: boolean;
    largeFont: boolean;
    linkPreviews: boolean;
    referenceEditing: boolean;
    referenceLightweightEditing: boolean;
    referencePreviews: boolean;
    resolveRedirects: boolean;
    resolveTemplateRedirects: boolean;
    smallReferenceText: boolean;
    syntaxHighlighting: boolean;
    useCodeMirrorForOtherModels: boolean;
}

export type EditorFeatureSettings = Pick<
    FormatterSettings,
    | 'alternateReferenceColors'
    | 'ctrlClickLinks'
    | 'fullPageReferencePreviews'
    | 'highlightMissing'
    | 'largeFont'
    | 'linkPreviews'
    | 'referenceEditing'
    | 'referenceLightweightEditing'
    | 'referencePreviews'
    | 'smallReferenceText'
    | 'syntaxHighlighting'
>;

/** Creates choices used when no saved configuration is valid. */
export function createDefaultFormatterSettings(): FormatterSettings {
    return {
        citationFormatting: createDefaultCitationFormattingSettings(),
        alternateReferenceColors: false,
        ctrlClickLinks: true,
        fullPageReferencePreviews: false,
        formatter: {
            characterWidthRatio: '5:3',
            firstParameterLayout: 'align-values',
            formatFirstParameter: false,
            formatHtmlTags: false,
            formatSubsequentParameters: false,
            indentBlockTemplates: false,
            indentSpaces: 2,
            normalizeConversion: false,
            skipFirstLevelIndentation: false,
            subsequentParameterLayout: 'align-names',
        },
        highlightMissing: false,
        largeFont: false,
        linkPreviews: false,
        referenceEditing: true,
        referenceLightweightEditing: false,
        referencePreviews: true,
        resolveRedirects: false,
        resolveTemplateRedirects: false,
        smallReferenceText: true,
        syntaxHighlighting: true,
        useCodeMirrorForOtherModels: false,
    };
}

function createDefaultCitationFormattingSettings(): CitationFormattingSettings {
    return {
        enabled: false,
        layout: 'inline',
        compactReferences: false,
        separateReferenceDefinitions: false,
        formatScriptTitles: true,
        scriptTitleMode: 'non-latin',
    };
}

/** Copies editor behaviors from a formatter configuration. */
export function getEditorFeatureSettings(
    settings: FormatterSettings,
): EditorFeatureSettings {
    return {
        alternateReferenceColors: settings.alternateReferenceColors,
        ctrlClickLinks: settings.ctrlClickLinks,
        fullPageReferencePreviews: settings.fullPageReferencePreviews,
        highlightMissing: settings.highlightMissing,
        largeFont: settings.largeFont,
        linkPreviews: settings.linkPreviews,
        referenceEditing: settings.referenceEditing,
        referenceLightweightEditing: settings.referenceLightweightEditing,
        referencePreviews: settings.referencePreviews,
        smallReferenceText: settings.smallReferenceText,
        syntaxHighlighting: settings.syntaxHighlighting,
    };
}

/** Replaces editor behaviors while preserving formatter choices. */
export function withEditorFeatureSettings(
    settings: FormatterSettings,
    features: EditorFeatureSettings,
): FormatterSettings {
    return { ...settings, ...features };
}

/** Validates and copies one persisted formatter configuration. */
export function parseFormatterSettings(
    value: unknown,
): FormatterSettings | undefined {
    if (!isRecord(value)) {
        return undefined;
    }
    const formatter = parseFormatterOptions(value.formatter);
    const features = parseEditorFeatures(value);
    const citationFormatting = parseCitationFormattingSettings(
        value.citationFormatting,
    );
    if (formatter == null || features == null || citationFormatting == null) {
        return undefined;
    }
    return { ...features, formatter, citationFormatting };
}

function parseFormatterOptions(value: unknown): FormatterOptions | undefined {
    if (!isRecord(value)) {
        return undefined;
    }
    if (
        !isCharacterWidthRatio(value.characterWidthRatio) ||
        !isFirstParameterLayout(value.firstParameterLayout) ||
        typeof value.formatFirstParameter !== 'boolean' ||
        (value.formatHtmlTags !== undefined &&
            typeof value.formatHtmlTags !== 'boolean') ||
        typeof value.formatSubsequentParameters !== 'boolean' ||
        typeof value.indentBlockTemplates !== 'boolean' ||
        !isIndentSpaces(value.indentSpaces) ||
        typeof value.normalizeConversion !== 'boolean' ||
        typeof value.skipFirstLevelIndentation !== 'boolean' ||
        !isSubsequentParameterLayout(value.subsequentParameterLayout)
    ) {
        return undefined;
    }
    return {
        characterWidthRatio: value.characterWidthRatio,
        firstParameterLayout: value.firstParameterLayout,
        formatFirstParameter: value.formatFirstParameter,
        formatHtmlTags: value.formatHtmlTags === true,
        formatSubsequentParameters: value.formatSubsequentParameters,
        indentBlockTemplates: value.indentBlockTemplates,
        indentSpaces: value.indentSpaces,
        normalizeConversion: value.normalizeConversion,
        skipFirstLevelIndentation: value.skipFirstLevelIndentation,
        subsequentParameterLayout: value.subsequentParameterLayout,
    };
}

function parseEditorFeatures(
    value: Record<string, unknown>,
): Omit<FormatterSettings, 'formatter' | 'citationFormatting'> | undefined {
    if (
        (value.alternateReferenceColors !== undefined &&
            typeof value.alternateReferenceColors !== 'boolean') ||
        (value.ctrlClickLinks !== undefined &&
            typeof value.ctrlClickLinks !== 'boolean') ||
        typeof value.fullPageReferencePreviews !== 'boolean' ||
        typeof value.highlightMissing !== 'boolean' ||
        typeof value.largeFont !== 'boolean' ||
        typeof value.linkPreviews !== 'boolean' ||
        (value.referenceEditing !== undefined &&
            typeof value.referenceEditing !== 'boolean') ||
        (value.referenceLightweightEditing !== undefined &&
            typeof value.referenceLightweightEditing !== 'boolean') ||
        typeof value.referencePreviews !== 'boolean' ||
        typeof value.resolveRedirects !== 'boolean' ||
        typeof value.resolveTemplateRedirects !== 'boolean' ||
        typeof value.smallReferenceText !== 'boolean' ||
        (value.syntaxHighlighting !== undefined &&
            typeof value.syntaxHighlighting !== 'boolean') ||
        (value.useCodeMirrorForOtherModels !== undefined &&
            typeof value.useCodeMirrorForOtherModels !== 'boolean')
    ) {
        return undefined;
    }
    return {
        // Preserve choices saved before alternate reference colors existed.
        alternateReferenceColors: value.alternateReferenceColors === true,
        // Modified link clicks were enabled before this setting existed.
        ctrlClickLinks: value.ctrlClickLinks !== false,
        fullPageReferencePreviews: value.fullPageReferencePreviews,
        highlightMissing: value.highlightMissing,
        largeFont: value.largeFont,
        linkPreviews: value.linkPreviews,
        // Keep tooltip editing enabled for configurations saved before its toggle.
        referenceEditing: value.referenceEditing !== false,
        // The optional inline interaction remains off in older configurations.
        referenceLightweightEditing: value.referenceLightweightEditing === true,
        referencePreviews: value.referencePreviews,
        resolveRedirects: value.resolveRedirects,
        resolveTemplateRedirects: value.resolveTemplateRedirects,
        smallReferenceText: value.smallReferenceText,
        // Preserve configurations saved before the highlighting toggle existed.
        syntaxHighlighting: value.syntaxHighlighting !== false,
        // Older configurations did not request CodeMirror for other models.
        useCodeMirrorForOtherModels: value.useCodeMirrorForOtherModels === true,
    };
}

function isFirstParameterLayout(value: unknown): value is FirstParameterLayout {
    return value === 'align-values' || value === 'compact';
}

function isSubsequentParameterLayout(
    value: unknown,
): value is SubsequentParameterLayout {
    return (
        value === 'align-names' ||
        value === 'align-names-and-values' ||
        value === 'compact'
    );
}

function isCharacterWidthRatio(value: unknown): value is '2:1' | '5:3' {
    return value === '2:1' || value === '5:3';
}

function isIndentSpaces(value: unknown): value is number {
    return Number.isSafeInteger(value) && Number(value) >= 0;
}

function parseCitationFormattingSettings(
    value: unknown,
): CitationFormattingSettings | undefined {
    // Existing editor preferences predate the shared citation settings group.
    if (value === undefined) return createDefaultCitationFormattingSettings();
    if (
        !isRecord(value) ||
        typeof value.enabled !== 'boolean' ||
        (value.layout !== 'inline' && value.layout !== 'block') ||
        typeof value.compactReferences !== 'boolean' ||
        typeof value.separateReferenceDefinitions !== 'boolean' ||
        typeof value.formatScriptTitles !== 'boolean' ||
        (value.scriptTitleMode !== 'non-latin' &&
            value.scriptTitleMode !== 'all-foreign' &&
            value.scriptTitleMode !== 'always')
    ) {
        return undefined;
    }
    return {
        enabled: value.enabled,
        layout: value.layout,
        compactReferences: value.compactReferences,
        separateReferenceDefinitions: value.separateReferenceDefinitions,
        formatScriptTitles: value.formatScriptTitles,
        scriptTitleMode: value.scriptTitleMode,
    };
}
