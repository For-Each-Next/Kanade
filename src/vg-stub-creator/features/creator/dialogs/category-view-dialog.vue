<!--
@file src/vg-stub-creator/features/creator/dialogs/category-view-dialog.vue
Purpose: Displays the selected category page for read-only review.
Contents: Template.
-->

<template>
    <cdx-dialog
        class="kanade-vg-stub-creator-category-view-dialog"
        :default-action="{ label: msg('common.close') }"
        :lang="interfaceLocale"
        :title="categoryViewState.title"
        v-model:open="categoryViewOpen"
        @default="closeCategoryView"
        @update:open="!$event &amp;&amp; closeCategoryView()"
    >
        <iframe
            class="kanade-vg-stub-creator-category-view"
            :src="categoryViewState.url"
            :title="categoryViewState.title"
        ></iframe>
    </cdx-dialog>
</template>
