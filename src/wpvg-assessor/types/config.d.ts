/**
 * @file src/wpvg-assessor/types/config.d.ts
 * Purpose: Declare optional Article Assessor browser configuration.
 *
 * Contents: Optional browser logging configuration.
 */

import type { LogLevel } from '../../library/logging/logger.ts';

declare global {
    interface Window {
        wpvgAssessorConfig?: { logLevel?: LogLevel };
    }
}

export {};
