/**
 * @file src/source-editor/types/globals.d.ts
 * Purpose: Build globals and Vue template context for all Source Editor features.
 *
 * Table of contents:
 * 1. Imports
 * 2. RawTemplateContext
 * 3. TemplateContext
 * 4. Ambient declarations
 * 5. Exports
 */

import type * as Dialog from '../features/formatter/dialog.ts';
import type { SourceEditorOptions } from '../domain/runtime-options.ts';
import type {
    CloseDialogContext,
    DraftDialogContext,
    MainDialogContext,
    ParameterAliasContext,
    ToolDialogContext,
} from '../features/source-manager/dialogs.ts';

type RawTemplateContext = ReturnType<
    typeof Dialog.createFormatterDialogBindings
>;
type EditorTemplateContext = {
    [Key in keyof RawTemplateContext]: RawTemplateContext[Key] extends {
        value: infer Value;
    }
        ? Value
        : RawTemplateContext[Key];
};

type ReferenceTemplateContext = {
    getDialogActionOrder(actions: string[]): string[];
} & CloseDialogContext &
    DraftDialogContext &
    MainDialogContext &
    ParameterAliasContext &
    ToolDialogContext;

type TemplateContext = EditorTemplateContext & ReferenceTemplateContext;

declare global {
    const __SOURCE_EDITOR_SOURCE_MANAGER_STYLES__: string;
    const __SOURCE_EDITOR_REFERENCE_MAIN_DIALOG_TEMPLATE__: string;
    const __SOURCE_EDITOR_REFERENCE_MAIN_DIALOG_STYLES__: string;
    const __SOURCE_EDITOR_REFERENCE_DRAFT_DIALOG_TEMPLATE__: string;
    const __SOURCE_EDITOR_REFERENCE_DRAFT_DIALOG_STYLES__: string;
    const __SOURCE_EDITOR_REFERENCE_PARAMETER_ALIAS_DIALOG_TEMPLATE__: string;
    const __SOURCE_EDITOR_REFERENCE_PARAMETER_ALIAS_DIALOG_STYLES__: string;
    const __SOURCE_EDITOR_REFERENCE_TOOL_DIALOG_TEMPLATE__: string;
    const __SOURCE_EDITOR_REFERENCE_TOOL_DIALOG_STYLES__: string;
    const __SOURCE_EDITOR_REFERENCE_CLOSE_DIALOG_TEMPLATE__: string;
    const __SOURCE_EDITOR_REFERENCE_CLOSE_DIALOG_STYLES__: string;
    const __GADGET_VERSION__: string;
    const __SOURCE_EDITOR_EDITOR_STYLES__: string;
    const __SOURCE_EDITOR_PANEL_DIALOG_TEMPLATE__: string;
    const __SOURCE_EDITOR_PANEL_DIALOG_STYLES__: string;
    const __SOURCE_EDITOR_REFERENCE_ICONS__: Record<
        | 'cdxIconEdit'
        | 'cdxIconEditUndo'
        | 'cdxIconAdd'
        | 'cdxIconAlert'
        | 'cdxIconUndo',
        { path: string; flipInRtl: boolean; rtlPath?: string }
    >;

    interface Window {
        wikEd?: {
            useWikEd?: boolean;
        };
        sourceEditorConfig?: Partial<SourceEditorOptions>;
    }
}

declare module '@vue/runtime-core' {
    interface ComponentCustomProperties extends TemplateContext {}
}

export {};
