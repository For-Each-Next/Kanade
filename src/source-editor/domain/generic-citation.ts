/**
 * @file src/source-editor/domain/generic-citation.ts
 * Purpose: Formats Cite-prefixed templates without applying CS1-only behavior.
 *
 * Table of contents:
 * 1. Imports
 * 2. formatGenericCitationTemplate
 * 3. serializeGenericCitation
 * 4. prepareGenericCitation
 * 5. prepareGenericParams
 * 6. buildCanonicalNameMap
 * 7. sortGenericParams
 * 8. isSafeGenericCitationMetadata
 * 9. isSafeTemplateName
 * 10. isSafeParameterName
 * 11. formatCitationWithPositionals
 */

import { wikitext } from '../../library/wikitext/index.ts';

import { normalizeEnglishLanguageCodes } from './language-codes.ts';
import { formatBlockCitation, formatInlineCitation } from './post-formatter.ts';
import {
    DEFAULT_TEMPLATE_NAME_CONTEXT,
    getCanonicalTemplateName,
    isCitePrefixedTemplate,
    type TemplateNameContext,
} from './templates.ts';
import type {
    CitationLayout,
    CitationParam,
    CitationTemplate,
    CitationTemplateData,
} from './types.ts';

/**
 * Formats one generic citation with optional live TemplateData.
 *
 * Parameter values, duplicates, and empty rows are retained.
 *
 * @param raw - Raw value.
 * @param layout - Citation layout.
 * @param metadata - Citation metadata.
 * @returns Formatted generic citation with optional live TemplateData.
 */
export function formatGenericCitationTemplate(
    raw: string,
    layout: CitationLayout,
    metadata?: CitationTemplateData,
    templateNameContext: TemplateNameContext = DEFAULT_TEMPLATE_NAME_CONTEXT,
): { citation: CitationTemplate; text: string } {
    const parsed = wikitext(raw).templates.parser();
    const params = parsed.params.map(function toCitationParam(param) {
        return {
            name: param.name,
            positional: param.positional,
            value: param.positional ? param.rawValue : param.value,
        };
    });
    const citation = prepareGenericCitation(
        { name: parsed.name, params },
        metadata,
        templateNameContext,
    );
    const text = serializeGenericCitation(
        citation,
        layout,
        templateNameContext,
    );
    return { citation, text };
}

/**
 * Serializes a generic citation while retaining positional values.
 *
 * @param citation - Citation value.
 * @param layout - Citation layout.
 * @returns Generic citation retaining positional values.
 */
export function serializeGenericCitation(
    citation: CitationTemplate,
    layout: CitationLayout,
    templateNameContext: TemplateNameContext = DEFAULT_TEMPLATE_NAME_CONTEXT,
): string {
    const hasPositional = citation.params.some((param) => param.positional);
    if (hasPositional) {
        return formatCitationWithPositionals(
            citation,
            layout,
            templateNameContext,
        );
    }
    return layout === 'inline'
        ? formatInlineCitation(citation, true)
        : formatBlockCitation(citation, true);
}

/**
 * Applies only a canonical name, aliases, and declared parameter order.
 *
 * @param citation - Citation value.
 * @param metadata - Citation metadata.
 * @returns Operation result.
 */
function prepareGenericCitation(
    citation: CitationTemplate,
    metadata?: CitationTemplateData,
    templateNameContext: TemplateNameContext = DEFAULT_TEMPLATE_NAME_CONTEXT,
): CitationTemplate {
    const safeMetadata =
        metadata != null &&
        isSafeGenericCitationMetadata(metadata, templateNameContext)
            ? metadata
            : undefined;
    const name =
        safeMetadata?.canonicalName ??
        getCanonicalTemplateName(citation.name, templateNameContext);
    const canonicalNames =
        safeMetadata == null
            ? new Map<string, string>()
            : buildCanonicalNameMap(safeMetadata);
    const { params, sortNames } = prepareGenericParams(
        citation.params,
        canonicalNames,
    );
    if (safeMetadata == null || params.some((param) => param.positional)) {
        return { name, params };
    }
    return {
        name,
        params: sortGenericParams(params, sortNames, safeMetadata.paramOrder),
    };
}

function prepareGenericParams(
    citationParams: CitationParam[],
    canonicalNames: Map<string, string>,
): { params: CitationParam[]; sortNames: string[] } {
    const prepared = citationParams.map(function prepareParam(param) {
        const enteredName = param.name.trim();
        return {
            canonicalName: param.positional
                ? enteredName
                : (canonicalNames.get(enteredName) ?? enteredName),
            enteredName,
            positional: param.positional,
            value: param.value,
        };
    });
    const targetCounts = Map.groupBy(prepared, (param) => param.canonicalName);
    const params = prepared.map(function canonicalizeParam(param) {
        const hasCollision =
            (targetCounts.get(param.canonicalName)?.length ?? 0) > 1;
        return {
            name: hasCollision ? param.enteredName : param.canonicalName,
            positional: param.positional,
            value:
                !param.positional && param.canonicalName === 'language'
                    ? normalizeEnglishLanguageCodes(param.value)
                    : param.value,
        };
    });
    const sortNames = prepared.map((param) => param.canonicalName);
    return { params, sortNames };
}

function buildCanonicalNameMap(
    metadata: CitationTemplateData,
): Map<string, string> {
    const result = new Map<string, string>();
    const canonicalNames = new Set([
        ...metadata.paramOrder,
        ...Object.keys(metadata.aliases),
    ]);
    for (const canonical of canonicalNames) {
        result.set(canonical, canonical);
    }
    const aliasTargets = new Map<string, Set<string>>();
    for (const canonical of canonicalNames) {
        const aliases = Object.hasOwn(metadata.aliases, canonical)
            ? metadata.aliases[canonical]
            : [];
        for (const alias of aliases) {
            if (canonicalNames.has(alias)) {
                continue;
            }
            const targets = aliasTargets.get(alias) ?? new Set<string>();
            targets.add(canonical);
            aliasTargets.set(alias, targets);
        }
    }
    for (const [alias, targets] of aliasTargets) {
        if (targets.size === 1) {
            result.set(alias, [...targets][0]);
        }
    }
    return result;
}

function sortGenericParams(
    params: CitationParam[],
    sortNames: string[],
    paramOrder: string[],
): CitationParam[] {
    const order = new Map(
        paramOrder.map((name, index) => [name, index] as const),
    );
    return params
        .map((param, index) => ({
            index,
            order: order.get(sortNames[index]) ?? Number.MAX_SAFE_INTEGER,
            param,
        }))
        .sort(
            (left, right) =>
                left.order - right.order || left.index - right.index,
        )
        .map((item) => item.param);
}

function isSafeGenericCitationMetadata(
    metadata: CitationTemplateData,
    templateNameContext: TemplateNameContext,
): boolean {
    if (
        metadata.canonicalName != null &&
        !isSafeTemplateName(metadata.canonicalName, templateNameContext)
    ) {
        return false;
    }
    if (!metadata.paramOrder.every(isSafeParameterName)) {
        return false;
    }
    return Object.entries(metadata.aliases).every(
        ([name, aliases]) =>
            isSafeParameterName(name) && aliases.every(isSafeParameterName),
    );
}

function isSafeTemplateName(
    value: string,
    templateNameContext: TemplateNameContext,
): boolean {
    return (
        isCitePrefixedTemplate(value, templateNameContext) &&
        !/[#<>[\]|{}\r\n]/u.test(value)
    );
}

function isSafeParameterName(value: string): boolean {
    return (
        value !== '' &&
        value === value.trim() &&
        // Reject control characters that cannot form a safe wikitext name.
        // eslint-disable-next-line no-control-regex
        !/[#<>[\]|{}=\u0000-\u001f\u007f]/u.test(value)
    );
}

function formatCitationWithPositionals(
    citation: CitationTemplate,
    layout: CitationLayout,
    templateNameContext: TemplateNameContext,
): string {
    let result = `{{${getCanonicalTemplateName(
        citation.name,
        templateNameContext,
    )}`;
    let previousWasPositional = false;
    for (const param of citation.params) {
        if (param.positional) {
            result += `|${param.value}`;
            previousWasPositional = true;
            continue;
        }
        const separator = previousWasPositional
            ? '| '
            : layout === 'block'
              ? '\n  | '
              : ' | ';
        result += `${separator}${param.name} = ${param.value}`;
        previousWasPositional = false;
    }
    const lastWasPositional = citation.params.at(-1)?.positional === true;
    // Trailing whitespace is part of an unnamed parameter's value.
    if (layout === 'inline' && !lastWasPositional) {
        return `${result.trimEnd()} }}`;
    }
    return layout === 'block' && !lastWasPositional
        ? `${result}\n}}`
        : `${result}}}`;
}
