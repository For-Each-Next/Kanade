/**
 * @file src/wpvg-assessor/features/assessment/codex.ts
 * Purpose: Minimal MediaWiki Vue and Codex contracts used by Article Assessor.
 *
 * Contents: Vue/Codex host contracts and component registration.
 */

import type {
    VueApp,
    VueCore,
    VueRef,
} from '../../../library/mediawiki-runtime/contracts.ts';
export type {
    VueApp,
    VueRef,
} from '../../../library/mediawiki-runtime/contracts.ts';

export interface VueModule extends VueCore {
    computed<T>(getter: () => T): VueRef<T>;
    onMounted(callback: () => void): void;
    onUnmounted(callback: () => void): void;
    reactive<T extends object>(value: T): T;
}

export interface CodexComponents {
    CdxButton: unknown;
    CdxButtonGroup: unknown;
    CdxCheckbox: unknown;
    CdxCombobox: unknown;
    CdxDialog: unknown;
    CdxField: unknown;
    CdxMessage: unknown;
    CdxProgressBar: unknown;
    CdxRadio: unknown;
    CdxSelect: unknown;
    CdxTextArea: unknown;
    CdxTextInput: unknown;
}

export interface ResourceLoaderRequire {
    (module: 'vue'): VueModule;
    (module: '@wikimedia/codex'): CodexComponents;
}

/**
 * Registers the Codex components used by the assessment dialog.
 *
 * @param Codex - Codex value.
 */
export function registerPageAssessorComponents(
    app: VueApp,
    Codex: CodexComponents,
): void {
    app.component('CdxButton', Codex.CdxButton);
    app.component('CdxButtonGroup', Codex.CdxButtonGroup);
    app.component('CdxCheckbox', Codex.CdxCheckbox);
    app.component('CdxCombobox', Codex.CdxCombobox);
    app.component('CdxDialog', Codex.CdxDialog);
    app.component('CdxField', Codex.CdxField);
    app.component('CdxMessage', Codex.CdxMessage);
    app.component('CdxProgressBar', Codex.CdxProgressBar);
    app.component('CdxRadio', Codex.CdxRadio);
    app.component('CdxSelect', Codex.CdxSelect);
    app.component('CdxTextArea', Codex.CdxTextArea);
    app.component('CdxTextInput', Codex.CdxTextInput);
}
