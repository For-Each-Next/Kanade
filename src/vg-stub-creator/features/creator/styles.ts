/**
 * @file src/vg-stub-creator/features/creator/styles.ts
 * Purpose: Installs styles for the vg-stub-creator dialogs.
 *
 * Table of contents:
 * 1. Imports
 * 2. addDialogStyles
 */

import { VG_STUB_CREATOR_DIALOG_STYLES } from './dialogs/index.ts';

/**
 * Adds dialog styles to the current page.
 *
 * @returns Result when the function
 *   adds dialog styles to the current page.
 */
export function addDialogStyles(): void {
    if (VG_STUB_CREATOR_DIALOG_STYLES !== '') {
        mw.util.addCSS(VG_STUB_CREATOR_DIALOG_STYLES);
    }
}
