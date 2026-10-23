/**
 * @file src/vg-stub-creator/features/creator/error-message.ts
 * Purpose: Normalizes caught values at UI and workflow boundaries.
 *
 * Table of contents:
 * 1. getErrorMessage
 * 2. toError
 */

/**
 * Gets a useful message from any JavaScript rejection value.
 *
 * @param error - Caught value.
 * @returns Displayable error message.
 */
export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Converts any rejection value to an Error for reporting adapters.
 *
 * @param error - Caught value.
 * @returns The original Error or a wrapped value.
 */
export function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}
