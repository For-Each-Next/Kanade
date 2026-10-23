<!--
@file src/vg-stub-creator/features/creator/dialogs/move-dialog.vue
Purpose: Reviews an article move target before preparing save actions.
Contents: Template.
-->

<template>
    <cdx-dialog
        class="kanade-vg-stub-creator-move-dialog"
        :lang="interfaceLocale"
        :title="msg('form.moveTitle')"
        v-model:open="moveOpen"
        @update:open="!$event &amp;&amp; closeMoveDialog()"
    >
        <cdx-message
            class="kanade-vg-stub-creator-message"
            type="notice"
            v-if="movePreviewConfirmation"
        >
            {{ msg('form.movePrompt') }}
        </cdx-message>
        <cdx-message
            class="kanade-vg-stub-creator-message"
            type="warning"
            v-if="moveTargetState.exists"
        >
            {{ msg('form.moveConflict') }}
        </cdx-message>
        <cdx-field
            class="kanade-vg-stub-creator-form-field"
            :messages="{ error: moveTargetValidationError }"
            :status="moveTargetValidationError ? 'error' : 'default'"
        >
            <cdx-text-input
                :placeholder="msg('text.pageNamePlaceholder')"
                ref="moveTargetInput"
                :model-value="moveTarget"
                :status="moveTargetValidationError ? 'error' : 'default'"
                @update:model-value="updateMoveTarget($event)"
            ></cdx-text-input>
            <template v-slot:label>{{ msg('text.pageName') }}</template>
        </cdx-field>
        <cdx-message
            class="kanade-vg-stub-creator-message"
            type="error"
            v-if="sourceFetchState.error"
        >
            {{ sourceFetchState.error }}
        </cdx-message>
        <template #footer>
            <div class="kanade-vg-stub-creator-dialog-footer">
                <div class="kanade-vg-stub-creator-dialog-footer-actions">
                    <cdx-button
                        v-if="compactActions"
                        type="button"
                        action="progressive"
                        :disabled="
                            sourceFetchState.loading || moveTargetState.loading
                        "
                        weight="primary"
                        @click="submitMoveTarget"
                    >
                        {{
                            sourceFetchState.loading || moveTargetState.loading
                                ? msg('text.opening')
                                : msg('text.openPageName')
                        }}
                    </cdx-button>
                    <cdx-button type="button" @click="closeMoveDialog">
                        {{ msg('common.close') }}
                    </cdx-button>
                    <cdx-button
                        type="button"
                        :disabled="
                            sourceFetchState.loading || moveTargetState.loading
                        "
                        v-if="movePreviewConfirmation"
                        @click="previewWithoutMoving"
                    >
                        {{ msg('text.previewWithoutMoving') }}
                    </cdx-button>
                    <cdx-button
                        v-if="!compactActions"
                        type="button"
                        action="progressive"
                        :disabled="
                            sourceFetchState.loading || moveTargetState.loading
                        "
                        weight="primary"
                        @click="submitMoveTarget"
                    >
                        {{
                            sourceFetchState.loading || moveTargetState.loading
                                ? msg('text.opening')
                                : msg('text.openPageName')
                        }}
                    </cdx-button>
                </div>
            </div>
        </template>
    </cdx-dialog>
</template>
