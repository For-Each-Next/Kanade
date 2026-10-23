/**
 * @file src/wpvg-assessor/features/assessment/dialogs/loading-dialog.ts
 * Purpose: Loading dialog shown while complete initial state is prepared.
 *
 * Contents: Loading component, cancel action, and scoped build assets.
 */

import { interfaceLocale, msg } from '../../../i18n/index.ts';
import type { VueModule, VueRef } from '../codex.ts';

const LOADING_DIALOG_TEMPLATE =
    typeof __WPVG_ASSESSOR_LOADING_DIALOG_TEMPLATE__ === 'undefined'
        ? ''
        : __WPVG_ASSESSOR_LOADING_DIALOG_TEMPLATE__;

export const LOADING_DIALOG_STYLES =
    typeof __WPVG_ASSESSOR_LOADING_DIALOG_STYLES__ === 'undefined'
        ? ''
        : __WPVG_ASSESSOR_LOADING_DIALOG_STYLES__;

interface LoadingBindings {
    interfaceLocale: string;
    msg: typeof msg;
    onOpenChange(value: boolean): void;
    open: VueRef<boolean>;
}

/**
 * Creates progress UI shown while assessment state is loading.
 *
 * @param onClose - On close value.
 * @returns Created progress UI shown while assessment state is loading.
 */
export function createLoadingDialogComponent(
    Vue: VueModule,
    onClose: () => void,
): unknown {
    function setup(): LoadingBindings {
        const open = Vue.ref(true);
        return {
            interfaceLocale,
            msg,
            onOpenChange(value) {
                open.value = value;
                if (!value) {
                    queueMicrotask(onClose);
                }
            },
            open,
        };
    }
    return Vue.defineComponent({
        name: 'WpvgAssessorLoadingDialog',
        setup,
        template: LOADING_DIALOG_TEMPLATE,
    });
}
