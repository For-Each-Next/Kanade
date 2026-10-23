<!--
@file src/vg-stub-creator/features/creator/dialogs/history-dialog.vue
Purpose: Lists recoverable drafts and their history actions.
Contents: Template.
-->

<template>
    <cdx-dialog
        :lang="interfaceLocale"
        :title="msg('form.historyTitle')"
        v-model:open="historyOpen"
        @update:open="!$event &amp;&amp; closeHistoryDialog()"
    >
        <cdx-progress-bar
            :aria-label="msg('form.historyLoading')"
            v-if="historyLoading"
        ></cdx-progress-bar>
        <p v-if="historyEntries.length === 0">
            {{ msg('form.historyEmpty') }}
        </p>
        <div
            v-if="historyEntries.length &gt; 0"
            class="kanade-vg-stub-creator-history-list"
        >
            <div
                v-bind:key="entry.id"
                v-for="(entry, index) in historyEntries"
                class="kanade-vg-stub-creator-history-entry"
            >
                <div>
                    <div>
                        {{ index + 1 }}. {{ formatHistoryEntryPage(entry) }}
                    </div>
                    <div class="kanade-vg-stub-creator-history-saved-at">
                        {{ entry.metadata.savedAt }}
                    </div>
                </div>
                <cdx-button
                    type="button"
                    action="progressive"
                    :disabled="historyLoading"
                    @click="fillHistoryEntry(entry)"
                >
                    {{
                        historyLoading ? msg('form.loading') : msg('form.load')
                    }}
                </cdx-button>
                <cdx-button
                    type="button"
                    :disabled="historyLoading"
                    @click="openHistoryJsonDialog(entry)"
                >
                    {{ msg('form.export') }}
                </cdx-button>
                <cdx-button
                    type="button"
                    action="destructive"
                    :disabled="historyLoading"
                    v-if="!entry.metadata.temporary"
                    @click="deleteHistoryEntry(entry.id)"
                >
                    {{ msg('common.delete') }}
                </cdx-button>
                <cdx-button
                    type="button"
                    :disabled="historyLoading"
                    v-if="entry.metadata.temporary"
                    @click="updateTemporaryHistoryEntry"
                >
                    {{ msg('form.update') }}
                </cdx-button>
            </div>
        </div>
        <template #footer>
            <div class="kanade-vg-stub-creator-dialog-footer">
                <div
                    v-if="!compactActions"
                    class="kanade-vg-stub-creator-dialog-footer-peer-actions"
                >
                    <cdx-button
                        type="button"
                        action="destructive"
                        :disabled="
                            historyLoading || !hasPersistentHistoryEntries()
                        "
                        @click="clearHistory"
                    >
                        {{ msg('form.clear') }}
                    </cdx-button>
                </div>
                <div class="kanade-vg-stub-creator-dialog-footer-actions">
                    <cdx-button
                        v-if="compactActions"
                        type="button"
                        action="progressive"
                        weight="primary"
                        :disabled="historyLoading"
                        @click="openHistoryImportDialog"
                    >
                        {{ msg('form.import') }}
                    </cdx-button>
                    <cdx-button
                        type="button"
                        :disabled="historyLoading"
                        @click="closeHistoryDialog"
                    >
                        {{ msg('common.close') }}
                    </cdx-button>
                    <cdx-button
                        v-if="!compactActions"
                        type="button"
                        action="progressive"
                        weight="primary"
                        :disabled="historyLoading"
                        @click="openHistoryImportDialog"
                    >
                        {{ msg('form.import') }}
                    </cdx-button>
                </div>

                <div
                    v-if="compactActions"
                    class="kanade-vg-stub-creator-dialog-footer-peer-actions"
                >
                    <cdx-button
                        type="button"
                        action="destructive"
                        :disabled="
                            historyLoading || !hasPersistentHistoryEntries()
                        "
                        @click="clearHistory"
                    >
                        {{ msg('form.clear') }}
                    </cdx-button>
                </div>
            </div>
        </template>
    </cdx-dialog>
</template>
