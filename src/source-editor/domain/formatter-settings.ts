/**
 * @file src/source-editor/domain/formatter-settings.ts
 * Purpose: Validated Source Editor editor, article, and citation preferences shared by UI and storage.
 *
 * Contents: Formatter preferences, defaults, and persisted-value validation.
 */
import { isRecord } from '../../library/data-validation/records.ts';

import type {
    FirstParameterLayout,
    FormatterOptions,
    SubsequentParameterLayout,
} from './formatter.ts';
import type { ScriptTitleMode } from './source-manager.ts';

export interface CitationFormattingSettings {
    convertAuthorNames: boolean;
    enabled: boolean;
    layout: 'inline' | 'block';
    compactReferences: boolean;
    separateReferenceDefinitions: boolean;
    formatScriptTitles: boolean;
    scriptTitleMode: ScriptTitleMode;
}

export interface FormatterSettings {
    citationFormatting: CitationFormattingSettings;
    formatter: FormatterOptions;
    resolveRedirects: boolean;
    resolveTemplateRedirects: boolean;
}

/** Creates choices used when no saved configuration is valid. */
export function createDefaultFormatterSettings(): FormatterSettings {
    return {
        citationFormatting: createDefaultCitationFormattingSettings(),
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
        resolveRedirects: false,
        resolveTemplateRedirects: false,
    };
}

function createDefaultCitationFormattingSettings(): CitationFormattingSettings {
    return {
        enabled: false,
        convertAuthorNames: false,
        layout: 'inline',
        compactReferences: false,
        separateReferenceDefinitions: false,
        formatScriptTitles: true,
        scriptTitleMode: 'non-latin',
    };
}

/** Validates and copies one persisted formatter configuration. */
export function parseFormatterSettings(
    value: unknown,
): FormatterSettings | undefined {
    if (!isRecord(value)) {
        return undefined;
    }
    const formatter = parseFormatterOptions(value.formatter);
    const citationFormatting = parseCitationFormattingSettings(
        value.citationFormatting,
    );
    if (
        formatter == null ||
        citationFormatting == null ||
        typeof value.resolveRedirects !== 'boolean' ||
        typeof value.resolveTemplateRedirects !== 'boolean'
    ) {
        return undefined;
    }
    // Older v1 records can contain retired editor preferences. Preserve valid
    // formatting choices without carrying those preferences into new saves.
    return {
        citationFormatting,
        formatter,
        resolveRedirects: value.resolveRedirects,
        resolveTemplateRedirects: value.resolveTemplateRedirects,
    };
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
        (value.convertAuthorNames !== undefined &&
            typeof value.convertAuthorNames !== 'boolean') ||
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
        convertAuthorNames: value.convertAuthorNames === true,
        layout: value.layout,
        compactReferences: value.compactReferences,
        separateReferenceDefinitions: value.separateReferenceDefinitions,
        formatScriptTitles: value.formatScriptTitles,
        scriptTitleMode: value.scriptTitleMode,
    };
}
