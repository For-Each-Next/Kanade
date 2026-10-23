/**
 * @file src/vg-stub-creator/types/codex-components.d.ts
 * Purpose: Shared Codex component types used in Vue templates.
 *
 * Table of contents:
 * 1. CodexModule
 * 2. OpenTemplateSlot
 * 3. OpenTemplateSlots
 * 4. ComponentWithOpenSlots
 * 5. Ambient declarations
 * 6. Exports
 */

type CodexModule = typeof import('@wikimedia/codex');
type OpenTemplateSlot = (scope: any) => unknown;
type OpenTemplateSlots = {
    [name: string]: OpenTemplateSlot | undefined;
};
type ComponentWithOpenSlots<Component> = Component & {
    new (): {
        $slots: OpenTemplateSlots;
    };
};

declare module '@vue/runtime-core' {
    interface GlobalComponents {
        CdxButton: CodexModule['CdxButton'];
        CdxButtonGroup: CodexModule['CdxButtonGroup'];
        CdxCard: ComponentWithOpenSlots<CodexModule['CdxCard']>;
        CdxCheckbox: CodexModule['CdxCheckbox'];
        CdxCombobox: ComponentWithOpenSlots<CodexModule['CdxCombobox']>;
        CdxDialog: ComponentWithOpenSlots<CodexModule['CdxDialog']>;
        CdxField: ComponentWithOpenSlots<CodexModule['CdxField']>;
        CdxIcon: CodexModule['CdxIcon'];
        CdxInfoChip: CodexModule['CdxInfoChip'];
        CdxMenuButton: CodexModule['CdxMenuButton'];
        CdxMessage: CodexModule['CdxMessage'];
        CdxProgressBar: CodexModule['CdxProgressBar'];
        CdxProgressIndicator: CodexModule['CdxProgressIndicator'];
        CdxRadio: CodexModule['CdxRadio'];
        CdxSelect: CodexModule['CdxSelect'];
        CdxTab: CodexModule['CdxTab'];
        CdxTable: ComponentWithOpenSlots<CodexModule['CdxTable']>;
        CdxTabs: CodexModule['CdxTabs'];
        CdxTextArea: CodexModule['CdxTextArea'];
        CdxTextInput: CodexModule['CdxTextInput'];
    }
}

export {};
