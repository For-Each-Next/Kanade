/**
 * @file src/source-editor/features/source-manager/codex.ts
 * Purpose: Minimal MediaWiki Vue and Codex contracts used by Source Editor.
 *
 * Table of contents:
 * 1. VueModule
 * 2. VueApp
 * 3. CodexComponents
 * 4. ResourceLoaderRequire
 * 5. registerSourceManagerComponents
 */

import type {
    VueApp,
    VueCore,
} from '../../../library/mediawiki-runtime/contracts.ts';
export type { VueApp } from '../../../library/mediawiki-runtime/contracts.ts';

export interface VueModule extends VueCore {
    computed<T>(getter: () => T): { readonly value: T };
}

export interface CodexComponents {
    CdxButton: unknown;
    CdxCheckbox: unknown;
    CdxCombobox: unknown;
    CdxDialog: unknown;
    CdxField: unknown;
    CdxIcon: unknown;
    CdxMessage: unknown;
    CdxProgressBar: unknown;
    CdxRadio: unknown;
    CdxSelect: unknown;
    CdxTab: unknown;
    CdxTable: unknown;
    CdxTabs: unknown;
    CdxTextArea: unknown;
    CdxTextInput: unknown;
}

export interface ResourceLoaderRequire {
    (module: 'vue'): VueModule;
    (module: '@wikimedia/codex'): CodexComponents;
}

/**
 * Registers the Codex surface used by the formatter templates.
 *
 * @param app - App value.
 * @param Codex - Codex value.
 */
export function registerSourceManagerComponents(
    app: VueApp,
    Codex: CodexComponents,
): void {
    app.component('CdxButton', Codex.CdxButton);
    app.component('CdxCheckbox', Codex.CdxCheckbox);
    app.component('CdxCombobox', Codex.CdxCombobox);
    app.component('CdxDialog', Codex.CdxDialog);
    app.component('CdxField', Codex.CdxField);
    app.component('CdxIcon', Codex.CdxIcon);
    app.component('CdxMessage', Codex.CdxMessage);
    app.component('CdxProgressBar', Codex.CdxProgressBar);
    app.component('CdxRadio', Codex.CdxRadio);
    app.component('CdxSelect', Codex.CdxSelect);
    app.component('CdxTab', Codex.CdxTab);
    app.component('CdxTable', Codex.CdxTable);
    app.component('CdxTabs', Codex.CdxTabs);
    app.component('CdxTextArea', Codex.CdxTextArea);
    app.component('CdxTextInput', Codex.CdxTextInput);
}
