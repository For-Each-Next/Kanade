/**
 * @file src/source-editor/domain/post-formatter.ts
 * Purpose: Applies final author labels and serializes ordered citation metadata.
 *
 * Table of contents:
 * 1. Imports
 * 2. formatBlockCitation
 * 3. formatInlineCitation
 * 4. getSerializableCitationParams
 * 5. getCitationOutputParams
 * 6. countAuthors
 * 7. getOutputParamName
 */

import type { CitationParam, CitationTemplate } from './types.ts';
import { getCanonicalTemplateNameFromKey } from './templates.ts';

/**
 * Formats a citation with one parameter per line.
 *
 * @param citation - Canonical citation.
 * @param preserveParameterNames
 * @returns Block-style template text.
 */
export function formatBlockCitation(
    citation: CitationTemplate,
    preserveParameterNames: boolean = false,
): string {
    const templateName = getCanonicalTemplateNameFromKey(citation.name);
    const outputParams = getSerializableCitationParams(
        citation,
        preserveParameterNames,
    );
    const formatParam = function formatParam(param: CitationParam) {
        return `  | ${param.name} = ${param.value}`;
    };
    const rows = outputParams.map(formatParam);
    if (rows.length === 0) {
        return `{{${templateName}}}`;
    }
    return [`{{${templateName}`, ...rows, '}}'].join('\n');
}

/**
 * Formats a citation on one line with spaced separators and closing braces.
 *
 * @param citation - Canonical citation.
 * @param preserveParameterNames
 * @returns Inline-style template text.
 */
export function formatInlineCitation(
    citation: CitationTemplate,
    preserveParameterNames: boolean = false,
): string {
    const templateName = getCanonicalTemplateNameFromKey(citation.name);
    const outputParams = getSerializableCitationParams(
        citation,
        preserveParameterNames,
    );
    const formatParam = function formatParam(param: CitationParam) {
        return `${param.name} = ${param.value}`;
    };
    const params = outputParams.map(formatParam);
    if (params.length === 0) {
        return `{{${templateName} }}`;
    }
    return `{{${templateName} | ${params.join(' | ').trimEnd()} }}`;
}

function getSerializableCitationParams(
    citation: CitationTemplate,
    preserveParameterNames: boolean,
): CitationParam[] {
    return preserveParameterNames
        ? citation.params
        : getCitationOutputParams(citation);
}

/**
 * Applies final output labels and optionally retains empty parameters.
 *
 * @param citation - Canonical citation.
 * @param includeEmpty - Whether empty parameters should be retained.
 * @returns Parameters with output-ready names.
 */
export function getCitationOutputParams(
    citation: CitationTemplate,
    includeEmpty: boolean = false,
): CitationParam[] {
    const authorCount = countAuthors(citation.params);
    const buildOutputParam = function buildOutputParam(
        param: CitationParam,
    ): CitationParam {
        const name = getOutputParamName(param, citation.params, authorCount);
        return { name, value: param.value };
    };
    const params = includeEmpty
        ? citation.params
        : citation.params.filter((param) => param.value !== '');
    const result = params.map(buildOutputParam);
    return result;
}

/**
 * Counts populated canonical last-name slots.
 *
 * @param params - Canonical citation parameters.
 * @returns Number of author slots.
 */
function countAuthors(params: CitationParam[]): number {
    const isPopulatedLast = function isPopulatedLast(param: CitationParam) {
        return /^last(?:\d+)?$/u.test(param.name) && param.value !== '';
    };
    const result = params.filter(isPopulatedLast).length;
    return result;
}

/**
 * Chooses structured or unstructured author labels for output.
 *
 * @param param - Canonical parameter being formatted.
 * @param params - All canonical citation parameters.
 * @param authorCount - Number of populated author slots.
 * @returns Output parameter name.
 */
function getOutputParamName(
    param: CitationParam,
    params: CitationParam[],
    authorCount: number,
): string {
    const match = param.name.match(/^(last|first)(\d*)$/u);
    if (match == null) {
        return param.name;
    }
    const index = match[2] || '1';
    const suffix = index === '1' ? '' : index;
    const hasFirst = params.some(function isPopulatedFirst(candidate) {
        return candidate.name === `first${suffix}` && candidate.value !== '';
    });
    if (match[1] === 'last' && !hasFirst) {
        const result =
            authorCount === 1 && index === '1' ? 'author' : `author${index}`;
        return result;
    }
    if (authorCount > 1 && index === '1') {
        return `${match[1]}1`;
    }
    return param.name;
}
