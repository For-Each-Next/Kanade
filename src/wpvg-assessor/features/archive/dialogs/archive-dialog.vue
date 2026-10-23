<!--
@file src/wpvg-assessor/features/archive/dialogs/archive-dialog.vue
Purpose: Annual archive destinations and the exact retained list source.

Table of contents:
1. Template
-->

<template>
    <cdx-dialog
        v-model:open="archiveOpen"
        class="kanade-wpvg-assessor-archive-dialog"
        :title="msg('archive.title')"
        :lang="interfaceLocale"
        :use-close-button="true"
        :close-button-label="msg('archive.cancel')"
        @update:open="onArchiveOpenChange"
    >
        <div
            class="kanade-wpvg-assessor-archive-body"
            :aria-busy="archiveLoading || archiveSaving"
        >
            <p>{{ msg('archive.description') }}</p>
            <div aria-live="polite" aria-atomic="true">
                <cdx-message v-if="archiveError" type="error">{{
                    archiveError
                }}</cdx-message>
                <cdx-message v-if="archiveSaved" type="success">{{
                    msg('archive.saved')
                }}</cdx-message>
                <template v-if="archiveLoading || archiveSaving">
                    <p>
                        {{
                            archiveSaving
                                ? msg('archive.saving')
                                : msg('archive.loading')
                        }}
                    </p>
                    <cdx-progress-bar
                        :aria-label="
                            archiveSaving
                                ? msg('archive.saving')
                                : msg('archive.loading')
                        "
                    />
                </template>
            </div>
            <template v-if="archiveReview">
                <p>
                    {{ msg('archive.cutoff', { date: archiveReview.cutoff }) }}
                </p>
                <cdx-message
                    v-if="archiveReview.recordCount === 0"
                    type="notice"
                    >{{ msg('archive.empty') }}</cdx-message
                >
                <template v-else>
                    <p>
                        {{
                            msg('archive.count', {
                                count: archiveReview.recordCount,
                                archives: archiveReview.archives.length,
                            })
                        }}
                    </p>
                    <section class="kanade-wpvg-assessor-archive-page">
                        <h2>{{ msg('archive.source') }}</h2>
                        <a :href="archivePageUrl(archiveReview.source.title)">{{
                            archiveReview.source.title
                        }}</a>
                        <pre
                            tabindex="0"
                            role="region"
                            :aria-label="msg('archive.source')"
                            >{{ archiveReview.source.proposedText }}</pre>
                    </section>
                    <section
                        v-for="destination in archiveReview.archives"
                        :key="destination.title"
                        class="kanade-wpvg-assessor-archive-page"
                    >
                        <h2>
                            {{
                                msg('archive.destination', {
                                    title: destination.title,
                                })
                            }}
                        </h2>
                        <a :href="archivePageUrl(destination.title)">{{
                            destination.title
                        }}</a>
                        <pre
                            tabindex="0"
                            role="region"
                            :aria-label="
                                msg('archive.destination', {
                                    title: destination.title,
                                })
                            "
                            >{{ destination.proposedText }}</pre>
                    </section>
                    <cdx-field
                        :disabled="
                            archiveSaving || archiveLoading || archiveSaved
                        "
                    >
                        <template #label>{{
                            msg('archive.summaryLabel')
                        }}</template>
                        <cdx-text-input
                            v-model="archiveSummary"
                            :disabled="
                                archiveSaving || archiveLoading || archiveSaved
                            "
                        />
                    </cdx-field>
                </template>
            </template>
        </div>
        <template #footer>
            <div class="kanade-wpvg-assessor-archive-actions">
                <cdx-button
                    v-for="action in archiveActions"
                    :key="action.id"
                    type="button"
                    :action="action.action"
                    :weight="action.weight"
                    :disabled="action.disabled"
                    @click="onArchiveAction(action.id)"
                    >{{ action.label }}</cdx-button
                >
            </div>
        </template>
    </cdx-dialog>
</template>
