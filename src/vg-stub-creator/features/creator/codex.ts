/**
 * @file src/vg-stub-creator/features/creator/codex.ts
 * Purpose: Codex registration shared by production and UI test hosts.
 *
 * Table of contents:
 * 1. VgStubCreatorCodexComponents
 * 2. registerCodexComponents
 */

/** Lists the Codex components used by VG Stub Creator templates. */
export interface VgStubCreatorCodexComponents {
    CdxButton: unknown;
    CdxButtonGroup: unknown;
    CdxCard: unknown;
    CdxCheckbox: unknown;
    CdxDialog: unknown;
    CdxField: unknown;
    CdxIcon: unknown;
    CdxInfoChip: unknown;
    CdxMenuButton: unknown;
    CdxMessage: unknown;
    CdxProgressBar: unknown;
    CdxProgressIndicator: unknown;
    CdxSelect: unknown;
    CdxTab: unknown;
    CdxTable: unknown;
    CdxTabs: unknown;
    CdxTextArea: unknown;
    CdxTextInput: unknown;
}

/**
 * Registers the Codex controls consumed by the dialog bundle.
 *
 * @param app - Vue application instance.
 * @param codex - Loaded Codex module.
 */
export function registerCodexComponents(
    app: { component: (name: string, component: unknown) => void },
    codex: VgStubCreatorCodexComponents,
): void {
    app.component('CdxDialog', codex.CdxDialog);
    app.component('CdxButton', codex.CdxButton);
    app.component('CdxButtonGroup', codex.CdxButtonGroup);
    app.component('CdxCard', codex.CdxCard);
    app.component('CdxCheckbox', codex.CdxCheckbox);
    app.component('CdxField', codex.CdxField);
    app.component('CdxIcon', codex.CdxIcon);
    app.component('CdxInfoChip', codex.CdxInfoChip);
    app.component('CdxMenuButton', codex.CdxMenuButton);
    app.component('CdxMessage', codex.CdxMessage);
    app.component('CdxProgressBar', codex.CdxProgressBar);
    app.component('CdxProgressIndicator', codex.CdxProgressIndicator);
    app.component('CdxSelect', codex.CdxSelect);
    app.component('CdxTab', codex.CdxTab);
    app.component('CdxTabs', codex.CdxTabs);
    app.component('CdxTable', codex.CdxTable);
    app.component('CdxTextArea', codex.CdxTextArea);
    app.component('CdxTextInput', codex.CdxTextInput);
}
