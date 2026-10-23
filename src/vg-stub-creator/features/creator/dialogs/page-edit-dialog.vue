<!--
@file src/vg-stub-creator/features/creator/dialogs/page-edit-dialog.vue
Purpose: Reviews related-page source and previews before staging a save action.

Table of contents:
1. Template
-->

<template>
    <cdx-dialog
        class="kanade-vg-stub-creator-preview-dialog"
        :lang="interfaceLocale"
        :title="getPageEditDialogTitle()"
        v-if="pageEditOpen"
        v-model:open="pageEditOpen"
        @update:open="!$event &amp;&amp; closePageEditDialog()"
    >
        <cdx-field
            class="kanade-vg-stub-creator-form-field"
            v-if="pageEditState.create &amp;&amp; (pageEditState.kind === 'category' || pageEditState.kind === 'navbox')"
        >
            <cdx-text-input
                v-bind:disabled="pageEditState.loading"
                v-bind:placeholder="getPageEditEnglishPlaceholder()"
                v-model="pageEditState.englishName"
            ></cdx-text-input>
            <template v-slot:label>{{ getPageEditEnglishLabel() }}</template>
        </cdx-field>
        <div class="kanade-vg-stub-creator-preview-layout">
            <cdx-field
                :messages="{ error: pageEditValidationError }"
                :status="pageEditValidationError ? 'error' : 'default'"
            >
                <cdx-text-area
                    class="kanade-vg-stub-creator-preview-text"
                    ref="pageEditTextArea"
                    :disabled="pageEditState.loading"
                    :status="pageEditValidationError ? 'error' : 'default'"
                    v-model="pageEditState.text"
                    rows="18"
                    spellcheck="false"
                    @update:model-value="pageEditValidationError = ''"
                ></cdx-text-area>
                <template #label>{{ msg('preview.wikitext') }}</template>
            </cdx-field>
            <section class="kanade-vg-stub-creator-preview-result">
                <h3 class="kanade-vg-stub-creator-preview-result-title">
                    {{ msg('preview.rendered') }}
                </h3>
                <div
                    class="kanade-vg-stub-creator-preview-rendered mw-parser-output"
                    v-html="pageEditState.html"
                ></div>
            </section>
        </div>
        <cdx-message
            class="kanade-vg-stub-creator-message"
            type="error"
            v-if="pageEditState.error"
        >
            {{ pageEditState.error }}
        </cdx-message>
        <template #footer>
            <div class="kanade-vg-stub-creator-dialog-footer">
                <div
                    v-if="!compactActions"
                    class="kanade-vg-stub-creator-dialog-footer-peer-actions"
                >
                    <cdx-button
                        type="button"
                        action="destructive"
                        :disabled="pageEditState.loading"
                        v-if="pageEditState.pending"
                        @click="resetPageEdit"
                    >
                        {{ msg('common.reset') }}
                    </cdx-button>
                </div>
                <div class="kanade-vg-stub-creator-dialog-footer-actions">
                    <cdx-button
                        v-if="compactActions"
                        type="button"
                        action="progressive"
                        :disabled="pageEditState.loading"
                        weight="primary"
                        @click="stagePageEdit"
                    >
                        {{ msg('preview.stage') }}
                    </cdx-button>
                    <cdx-button type="button" @click="closePageEditDialog">
                        {{ msg('preview.cancel') }}
                    </cdx-button>
                    <cdx-button
                        type="button"
                        :disabled="pageEditState.loading"
                        @click="refreshPageEditPreview"
                    >
                        {{
                            pageEditState.loading
                                ? msg('preview.updating')
                                : msg('preview.updatePreview')
                        }}
                    </cdx-button>
                    <cdx-button
                        v-if="!compactActions"
                        type="button"
                        action="progressive"
                        :disabled="pageEditState.loading"
                        weight="primary"
                        @click="stagePageEdit"
                    >
                        {{ msg('preview.stage') }}
                    </cdx-button>
                </div>

                <div
                    v-if="compactActions"
                    class="kanade-vg-stub-creator-dialog-footer-peer-actions"
                >
                    <cdx-button
                        type="button"
                        action="destructive"
                        :disabled="pageEditState.loading"
                        v-if="pageEditState.pending"
                        @click="resetPageEdit"
                    >
                        {{ msg('common.reset') }}
                    </cdx-button>
                </div>
            </div>
        </template>
    </cdx-dialog>
</template>
