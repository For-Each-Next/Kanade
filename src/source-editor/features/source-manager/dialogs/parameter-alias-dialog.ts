/**
 * @file src/source-editor/features/source-manager/dialogs/parameter-alias-dialog.ts
 * Purpose: Build-injected reference-name alias dialog bundle.
 *
 * Table of contents:
 * 1. Imports
 * 2. ParameterAliasActions
 * 3. ParameterAliasContext
 * 4. Constants and state
 * 5. Exports
 */

import type { SourceEditorI18n } from '../../../i18n/index.ts';

import type { CitationDialogBundle } from './dialog-bundle.ts';

export interface ParameterAliasActions {
    applyParameterAlias(): void;
    canApplyParameterAlias(): boolean;
    closeParameterAliasDialog(): void;
    getParameterAliasDialogError(): string;
    getParameterAliasDialogLabel(): string;
    getParameterAliasOriginalValueLabel(): string;
    onParameterAliasDialogOpenChange(open: boolean): void;
}

/**
 * Bindings exposed to the build-injected parameter-alias template.
 */
export type ParameterAliasContext = ParameterAliasActions & {
    interfaceLocale: string;
    loading: boolean;
    msg: SourceEditorI18n['msg'];
    parameterAliasDialogDirectives: string[];
    parameterAliasDialogOpen: boolean;
    parameterAliasDialogOriginalValue: string;
    parameterAliasDialogValue: string;
};

const parameterAliasDialog: CitationDialogBundle = {
    styles:
        typeof __SOURCE_EDITOR_REFERENCE_PARAMETER_ALIAS_DIALOG_STYLES__ ===
        'undefined'
            ? ''
            : __SOURCE_EDITOR_REFERENCE_PARAMETER_ALIAS_DIALOG_STYLES__,
    template:
        typeof __SOURCE_EDITOR_REFERENCE_PARAMETER_ALIAS_DIALOG_TEMPLATE__ ===
        'undefined'
            ? ''
            : __SOURCE_EDITOR_REFERENCE_PARAMETER_ALIAS_DIALOG_TEMPLATE__,
};

export default parameterAliasDialog;
