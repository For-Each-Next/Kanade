<!--
@file src/vg-stub-creator/features/creator/dialogs/history-json-dialog.vue
Purpose: Imports and exports draft history as reviewed JSON.
Contents: Template.
-->

<template>
    <cdx-dialog
        class="kanade-vg-stub-creator-history-json-dialog"
        :default-action="{
            disabled: historyLoading,
            label: msg('common.close'),
        }"
        :lang="interfaceLocale"
        :primary-action="{
            actionType: 'progressive',
            disabled: historyLoading,
            label: historyLoading ? msg('form.loading') : msg('form.load'),
        }"
        v-model:open="historyJsonOpen"
        :title="msg('form.historyData')"
        @default="closeHistoryJsonDialog"
        @primary="importHistoryJson"
        @update:open="!$event &amp;&amp; closeHistoryJsonDialog()"
    >
        <cdx-progress-bar
            :aria-label="msg('form.historyLoading')"
            v-if="historyLoading"
        ></cdx-progress-bar>
        <cdx-field class="kanade-vg-stub-creator-form-field">
            <cdx-text-area
                class="kanade-vg-stub-creator-history-json-text"
                :readonly="!historyJsonEditable"
                v-model="historyJsonText"
                rows="12"
                spellcheck="false"
            ></cdx-text-area>
            <template #label>{{ msg('form.historyData') }}</template>
        </cdx-field>
        <cdx-message
            class="kanade-vg-stub-creator-message"
            type="error"
            v-if="historyJsonError"
        >
            {{ historyJsonError }}
        </cdx-message>
    </cdx-dialog>
</template>
