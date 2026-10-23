<!--
@file src/source-editor/features/source-manager/dialogs/close-confirmation-dialog.vue
Purpose: src / features / source manager / dialogs / close confirmation dialog module.

Table of contents:
1. Template
-->

<template>
    <cdx-dialog
        v-model:open="closeConfirmationOpen"
        class="kanade-source-editor-source-manager__confirmation-dialog"
        :title="msg('analysis.closeConfirmationTitle')"
        :lang="interfaceLocale"
        @update:open="onCloseConfirmationOpenChange"
    >
        <div class="kanade-source-editor-source-manager__dialog-body-content">
            <cdx-message type="warning">
                {{ msg('analysis.closeConfirmationBody') }}
            </cdx-message>
        </div>
        <template #footer>
            <div class="kanade-source-editor-source-manager__footer-actions">
                <template
                    v-for="dialogAction in getDialogActionOrder([
                        'undo',
                        'continue',
                        'keep',
                    ])"
                    :key="dialogAction"
                >
                    <cdx-button
                        v-if="dialogAction === 'undo'"
                        weight="quiet"
                        type="button"
                        @click="undoAnalysisChangesAndClose"
                        >{{ msg('analysis.undoAndClose') }}</cdx-button
                    >
                    <cdx-button
                        v-if="dialogAction === 'continue'"
                        type="button"
                        @click="cancelCloseConfirmation"
                        >{{ msg('analysis.continueEditing') }}</cdx-button
                    >
                    <cdx-button
                        v-if="dialogAction === 'keep'"
                        class="kanade-source-editor-source-manager__primary-action"
                        action="progressive"
                        weight="primary"
                        type="button"
                        @click="keepAnalysisChangesAndClose"
                        >{{ msg('analysis.keepAndClose') }}</cdx-button
                    >
                </template>
            </div>
        </template>
    </cdx-dialog>
</template>
