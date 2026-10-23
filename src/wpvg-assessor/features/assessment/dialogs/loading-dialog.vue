<!--
@file src/wpvg-assessor/features/assessment/dialogs/loading-dialog.vue
Purpose: src / features / assessment / dialogs / loading dialog module.

Table of contents:
1. Template
-->

<template>
    <cdx-dialog
        v-model:open="open"
        class="kanade-wpvg-assessor-loading-dialog"
        :title="msg('tool.name')"
        :lang="interfaceLocale"
        :close-button-label="msg('dialog.cancel')"
        :use-close-button="true"
        @update:open="onOpenChange"
    >
        <div
            class="kanade-wpvg-assessor-loading-dialog__progress"
            aria-live="polite"
        >
            <span>{{ msg('dialog.loadingAssessment') }}</span>
            <cdx-progress-bar :aria-label="msg('dialog.loadingAssessment')" />
        </div>
    </cdx-dialog>
</template>
