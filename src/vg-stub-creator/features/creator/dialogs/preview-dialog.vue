<!--
@file src/vg-stub-creator/features/creator/dialogs/preview-dialog.vue
Purpose: Reviews generated article source, preview, and edit summary.
Contents: Template.
-->

<template>
    <cdx-dialog
        class="kanade-vg-stub-creator-preview-dialog"
        :lang="interfaceLocale"
        :title="getArticlePreviewTitle()"
        v-if="previewOpen"
        v-model:open="previewOpen"
        @update:open="!$event &amp;&amp; closePreviewDialog()"
    >
        <div class="kanade-vg-stub-creator-preview-layout">
            <cdx-field
                :messages="{ error: previewValidationError }"
                :status="previewValidationError ? 'error' : 'default'"
            >
                <cdx-text-area
                    class="kanade-vg-stub-creator-preview-text"
                    ref="previewTextArea"
                    :status="previewValidationError ? 'error' : 'default'"
                    v-model="previewText"
                    rows="18"
                    spellcheck="false"
                    @update:model-value="previewValidationError = ''"
                ></cdx-text-area>
                <template #label>{{ msg('preview.wikitext') }}</template>
            </cdx-field>
            <section class="kanade-vg-stub-creator-preview-result">
                <h3 class="kanade-vg-stub-creator-preview-result-title">
                    {{ msg('preview.rendered') }}
                </h3>
                <div
                    class="kanade-vg-stub-creator-preview-rendered mw-parser-output"
                    v-html="previewHtml"
                ></div>
            </section>
        </div>
        <cdx-field class="kanade-vg-stub-creator-preview-summary">
            <cdx-text-input
                v-bind:disabled="sourceFetchState.loading"
                v-model="previewSummary"
            ></cdx-text-input>
            <template v-slot:label>{{ msg('preview.editSummary') }}</template>
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
                        :disabled="sourceFetchState.loading"
                        weight="primary"
                        @click="submitPreviewText"
                    >
                        {{ msg('preview.continue') }}
                    </cdx-button>
                    <cdx-button type="button" @click="closePreviewDialog">
                        {{ msg('preview.dismiss') }}
                    </cdx-button>
                    <cdx-button
                        type="button"
                        :disabled="sourceFetchState.loading"
                        @click="refreshParsedPreview"
                    >
                        {{
                            sourceFetchState.loading
                                ? msg('preview.updating')
                                : msg('preview.updatePreview')
                        }}
                    </cdx-button>
                    <cdx-button
                        v-if="!compactActions"
                        type="button"
                        action="progressive"
                        :disabled="sourceFetchState.loading"
                        weight="primary"
                        @click="submitPreviewText"
                    >
                        {{ msg('preview.continue') }}
                    </cdx-button>
                </div>
            </div>
        </template>
    </cdx-dialog>
</template>
