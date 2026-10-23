/**
 * @file src/vg-stub-creator/types/globals.d.ts
 * Purpose: Build globals and template context for VG Stub Creator.
 *
 * Table of contents:
 * 1. Imports
 * 2. RawTemplateContext
 * 3. TemplateForm
 * 4. TemplateGroup
 * 5. TemplateContext
 * 6. Ambient declarations
 * 7. Exports
 */

import type { VgStubCreatorTemplateBindings } from '../features/creator/form/component.ts';

type RawTemplateContext = {
    [
        Key in keyof VgStubCreatorTemplateBindings
    ]: VgStubCreatorTemplateBindings[Key] extends {
        value: infer Value;
    }
        ? Value
        : VgStubCreatorTemplateBindings[Key];
};
type TemplateForm = Record<string, any> & {
    citationRows: Array<any>;
    localizedNames: Array<any>;
};
type TemplateGroup = Record<string, any> & {
    nameGroupKey: 'localizedNames' | null;
};
type TemplateContext = Omit<
    RawTemplateContext,
    'form' | 'groups' | 'historyEntries'
> & {
    form: TemplateForm;
    groups: Array<TemplateGroup>;
    historyEntries: Array<any>;
};

declare global {
    const __VG_STUB_CREATOR_SHARED_DIALOG_STYLES__: string;
    const __VG_STUB_CREATOR_MAIN_DIALOG_TEMPLATE__: string;
    const __VG_STUB_CREATOR_MAIN_DIALOG_STYLES__: string;
    const __VG_STUB_CREATOR_PRE_SAVE_DIALOG_TEMPLATE__: string;
    const __VG_STUB_CREATOR_PRE_SAVE_DIALOG_STYLES__: string;
    const __VG_STUB_CREATOR_CATEGORY_VIEW_DIALOG_TEMPLATE__: string;
    const __VG_STUB_CREATOR_CATEGORY_VIEW_DIALOG_STYLES__: string;
    const __VG_STUB_CREATOR_PAGE_EDIT_DIALOG_TEMPLATE__: string;
    const __VG_STUB_CREATOR_PAGE_EDIT_DIALOG_STYLES__: string;
    const __VG_STUB_CREATOR_MOVE_DIALOG_TEMPLATE__: string;
    const __VG_STUB_CREATOR_MOVE_DIALOG_STYLES__: string;
    const __VG_STUB_CREATOR_PREVIEW_DIALOG_TEMPLATE__: string;
    const __VG_STUB_CREATOR_PREVIEW_DIALOG_STYLES__: string;
    const __VG_STUB_CREATOR_HISTORY_DIALOG_TEMPLATE__: string;
    const __VG_STUB_CREATOR_HISTORY_DIALOG_STYLES__: string;
    const __VG_STUB_CREATOR_HISTORY_JSON_DIALOG_TEMPLATE__: string;
    const __VG_STUB_CREATOR_HISTORY_JSON_DIALOG_STYLES__: string;
}

declare module '@vue/runtime-core' {
    interface ComponentCustomProperties extends TemplateContext {}
}

export {};
