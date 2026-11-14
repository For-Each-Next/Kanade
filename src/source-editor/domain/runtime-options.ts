/**
 * @file src/source-editor/domain/runtime-options.ts
 * Purpose: Validate the immutable options captured when Source Editor starts.
 * Contents: Runtime option contract, safe defaults, and boundary normalization.
 */

import type { LogLevel } from '../../library/logging/logger.ts';

export interface SourceEditorOptions {
    readonly logLevel: LogLevel;
}

export const DEFAULT_SOURCE_EDITOR_OPTIONS: SourceEditorOptions = Object.freeze(
    {
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
    const level = record.logLevel;
    return Object.freeze({
        logLevel:
            typeof level === 'string' &&
            ['silent', 'error', 'warn', 'info', 'debug'].includes(level)
                ? (level as LogLevel)
                : defaults.logLevel,
    });
}
