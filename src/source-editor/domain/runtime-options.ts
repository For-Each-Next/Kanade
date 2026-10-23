/**
 * @file src/source-editor/domain/runtime-options.ts
 * Purpose: Validate the immutable options captured when Source Editor starts.
 * Contents: Runtime option contract, safe defaults, and boundary normalization.
 */

import type { LogLevel } from '../../library/logging/logger.ts';

export interface SourceEditorOptions {
    readonly highlightDelay: number;
    readonly maxLiveHighlightLength: number;
    readonly referenceTooltipDelay: number;
    readonly pagePreviewDelay: number;
    readonly logLevel: LogLevel;
}

export const DEFAULT_SOURCE_EDITOR_OPTIONS: SourceEditorOptions = Object.freeze(
    {
        highlightDelay: 100,
        maxLiveHighlightLength: 1_024_768,
        referenceTooltipDelay: 700,
        pagePreviewDelay: 700,
        logLevel: 'warn',
    },
);

/** Invalid individual options use defaults without retaining the caller's object. */
export function resolveSourceEditorOptions(
    value: unknown,
): SourceEditorOptions {
    const record =
        typeof value === 'object' && value !== null && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {};
    const defaults = DEFAULT_SOURCE_EDITOR_OPTIONS;
    function delay(
        key: 'highlightDelay' | 'referenceTooltipDelay' | 'pagePreviewDelay',
    ): number {
        const candidate = record[key];
        return typeof candidate === 'number' &&
            Number.isSafeInteger(candidate) &&
            candidate >= 0 &&
            candidate <= 60_000
            ? candidate
            : defaults[key];
    }
    const limit = record.maxLiveHighlightLength;
    const level = record.logLevel;
    return Object.freeze({
        highlightDelay: delay('highlightDelay'),
        referenceTooltipDelay: delay('referenceTooltipDelay'),
        pagePreviewDelay: delay('pagePreviewDelay'),
        maxLiveHighlightLength:
            typeof limit === 'number' &&
            (limit === Infinity || (Number.isSafeInteger(limit) && limit >= 0))
                ? limit
                : defaults.maxLiveHighlightLength,
        logLevel:
            typeof level === 'string' &&
            ['silent', 'error', 'warn', 'info', 'debug'].includes(level)
                ? (level as LogLevel)
                : defaults.logLevel,
    });
}
