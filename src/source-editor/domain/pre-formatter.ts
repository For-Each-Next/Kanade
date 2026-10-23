/**
 * @file src/source-editor/domain/pre-formatter.ts
 * Purpose: Normalizes legacy parameter names and values before canonicalization.
 *
 * Table of contents:
 * 1. Imports
 * 2. PreFormatHandler
 * 3. Constants and state
 * 4. applyPreFormatHandlers
 * 5. applyHandler
 * 6. migrateDeadUrlParameter
 * 7. normalizeDeadUrlStatus
 * 8. formatTimeParameter
 * 9. formatColonTime
 */

import type { CitationParam } from './types.ts';

type PreFormatHandler = (param: CitationParam) => CitationParam;

const PRE_FORMAT_HANDLERS: PreFormatHandler[] = [
    migrateDeadUrlParameter,
    formatTimeParameter,
];

/**
 * Applies all pre-format parameter migrations in declaration order.
 *
 * @param params - Parsed citation parameters.
 * @returns Migrated citation parameters.
 */
export function applyPreFormatHandlers(
    params: CitationParam[],
): CitationParam[] {
    const applyHandlers = function applyHandlers(param: CitationParam) {
        const migrated = PRE_FORMAT_HANDLERS.reduce(applyHandler, param);
        return migrated;
    };
    const result = params.map(applyHandlers);
    return result;
}

/**
 * Applies one pre-format handler to the current parameter value.
 *
 * @param current - Current citation parameter.
 * @param handler - Next migration handler.
 * @returns Migrated citation parameter.
 */
function applyHandler(
    current: CitationParam,
    handler: PreFormatHandler,
): CitationParam {
    return handler(current);
}

/**
 * Migrates removed dead-url spellings and their boolean values.
 *
 * @param param - Parsed citation parameter.
 * @returns Migrated or unchanged parameter.
 */
function migrateDeadUrlParameter(param: CitationParam): CitationParam {
    const name = param.name.trim().toLowerCase();
    if (!['dead-url', 'deadlink', 'deadurl'].includes(name)) {
        return param;
    }
    const result = {
        name: 'url-status',
        value: normalizeDeadUrlStatus(param.value),
    };
    return result;
}

/**
 * Converts the old dead-url boolean to a url-status value.
 *
 * @param value - Removed dead-url parameter value.
 * @returns Equivalent url-status value when recognized.
 */
function normalizeDeadUrlStatus(value: string): string {
    const trimmed = value.trim();
    const normalized = trimmed.toLowerCase();
    if (['no', 'false', '0'].includes(normalized)) {
        return 'live';
    }
    if (['yes', 'true', '1'].includes(normalized)) {
        return 'dead';
    }
    return trimmed;
}

/**
 * Formats colon-delimited citation times with typographic unit marks.
 *
 * @param param - Parsed citation parameter.
 * @returns Parameter with a formatted time value when recognized.
 */
function formatTimeParameter(param: CitationParam): CitationParam {
    if (param.name.trim().toLowerCase() !== 'time') {
        return param;
    }
    const value = param.value.trim();
    const match = value.match(
        /^(\d+:\d{2}(?::\d{2})?)(?:\s*([–—-])\s*(\d+:\d{2}(?::\d{2})?))?$/u,
    );
    if (match == null) {
        return param;
    }
    const start = formatColonTime(match[1]);
    let formatted = start;
    if (match[3] != null) {
        formatted = `${start}${match[2]}${formatColonTime(match[3])}`;
    }
    return { name: param.name, value: formatted };
}

/**
 * Formats one H:MM:SS or M:SS value.
 *
 * @param value - Colon-delimited time.
 * @returns Time with hour, minute, and second marks.
 */
function formatColonTime(value: string): string {
    const parts = value.split(':');
    if (parts.length === 3) {
        return `${parts[0]}ʰ${parts[1]}′${parts[2]}″`;
    }
    return `${parts[0]}′${parts[1]}″`;
}
