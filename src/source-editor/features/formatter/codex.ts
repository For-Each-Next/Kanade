/**
 * @file src/source-editor/features/formatter/codex.ts
 * Purpose: Minimal Vue and Codex contracts used by Source Editor.
 *
 * Table of contents:
 * 1. VueRef
 * 2. VueApp
 * 3. VueModule
 * 4. CodexComponents
 * 5. ResourceLoaderRequire
 * 6. registerFormatterComponents
 */

import type {
    VueApp,
    VueCore,
} from '../../../library/mediawiki-runtime/contracts.ts';
export type {
    VueApp,
    VueRef,
} from '../../../library/mediawiki-runtime/contracts.ts';

export interface VueModule extends VueCore {
    onMounted?(callback: () => void): void;
    onUnmounted?(cleanup: () => void): void;
}

export interface CodexComponents {
    CdxButton: unknown;
    CdxCheckbox: unknown;
    CdxDialog: unknown;
    CdxField: unknown;
    CdxIcon: unknown;
    CdxMessage: unknown;
    CdxMenuButton: unknown;
    CdxProgressBar: unknown;
    CdxRadio: unknown;
    CdxTab: unknown;
    CdxTabs: unknown;
    CdxTextInput: unknown;
    CdxTextArea: unknown;
}

export interface ResourceLoaderRequire {
    (module: 'vue'): VueModule;

    (module: '@wikimedia/codex'): CodexComponents;
}

/**
 * Registers the small Codex component set used by the formatter.
 *
 * @param app - App value.
 * @param Codex - Codex value.
 */
export function registerFormatterComponents(
    app: VueApp,
    Codex: CodexComponents,
): void {
    app.component('CdxButton', Codex.CdxButton);
    app.component('CdxCheckbox', Codex.CdxCheckbox);
    app.component('CdxDialog', Codex.CdxDialog);
    app.component('CdxField', Codex.CdxField);
    app.component('CdxIcon', Codex.CdxIcon);
    app.component('CdxMessage', Codex.CdxMessage);
    app.component('CdxMenuButton', Codex.CdxMenuButton);
    app.component('CdxProgressBar', Codex.CdxProgressBar);
    app.component('CdxRadio', Codex.CdxRadio);
    app.component('CdxTab', Codex.CdxTab);
    app.component('CdxTabs', Codex.CdxTabs);
    app.component('CdxTextInput', Codex.CdxTextInput);
    app.component('CdxTextArea', Codex.CdxTextArea);
}
