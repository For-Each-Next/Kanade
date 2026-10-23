<!--
@file src/source-editor/features/source-manager/dialogs/main-dialog.vue
Purpose: Source browsing, lookup, reference reuse, and shared-tool navigation.

Contents: Main reference manager and reference-details dialog templates.
-->

<template>
    <cdx-dialog
        v-model:open="open"
        class="kanade-source-editor-source-manager"
        :title="msg('references.title')"
        :subtitle="msg('references.description')"
        :lang="interfaceLocale"
        :fixed-height="704"
        :close-button-label="msg('common.close')"
        use-close-button
        @update:open="onOpenChange"
    >
        <div
            :ref="setSourceManagerContent"
            class="kanade-source-editor-source-manager__dialog-body-content"
        >
            <cdx-message
                v-if="error"
                type="error"
                class="kanade-source-editor-source-manager__status"
            >
                {{ error }}
            </cdx-message>
            <cdx-message
                v-if="warning"
                type="warning"
                class="kanade-source-editor-source-manager__status"
            >
                {{ warning }}
            </cdx-message>
            <div>
                <cdx-tabs
                    v-model:active="activeLookupTab"
                    class="kanade-source-editor-source-manager__tabs"
                    :framed="true"
                >
                    <cdx-tab
                        name="sources"
                        :label="
                            msg('tabs.sourcesList', {
                                count: existingSources.length,
                            })
                        "
                    >
                        <div
                            class="kanade-source-editor-source-manager__source-filters"
                        >
                            <form
                                class="kanade-source-editor-source-manager__source-lookup"
                                @submit.prevent="resolveEnteredSource()"
                            >
                                <cdx-field
                                    class="kanade-source-editor-source-manager__filter-field"
                                    :status="
                                        error === msg('lookup.sourceRequired')
                                            ? 'error'
                                            : 'default'
                                    "
                                    :messages="{
                                        error:
                                            error ===
                                            msg('lookup.sourceRequired')
                                                ? error
                                                : '',
                                    }"
                                >
                                    <template #label>
                                        {{ msg('lookup.source') }}
                                    </template>
                                    <template #description>
                                        <span
                                            class="kanade-source-editor-source-manager__visually-hidden"
                                        >
                                            {{ msg('lookup.sourceHelpText') }}
                                        </span>
                                    </template>
                                    <div
                                        class="kanade-source-editor-source-manager__source-lookup-controls"
                                    >
                                        <cdx-text-input
                                            v-model="sourceInput"
                                            input-type="search"
                                            :disabled="loading"
                                            :placeholder="
                                                msg('lookup.sourcePlaceholder')
                                            "
                                            autofocus
                                        />
                                        <cdx-button
                                            action="progressive"
                                            weight="primary"
                                            :disabled="loading"
                                            type="submit"
                                        >
                                            {{ msg('lookup.findSource') }}
                                        </cdx-button>
                                    </div>
                                </cdx-field>
                            </form>
                            <cdx-field
                                v-if="sourceSectionSelectors.length > 0"
                                class="kanade-source-editor-source-manager__filter-field"
                                :is-fieldset="true"
                            >
                                <template #label>
                                    {{ sectionFilterLabel }}
                                </template>
                                <div
                                    class="kanade-source-editor-source-manager__filter-controls"
                                >
                                    <cdx-field
                                        v-for="selector in sourceSectionSelectors"
                                        :key="selector.level"
                                    >
                                        <template #label>{{
                                            selector.label
                                        }}</template>
                                        <cdx-combobox
                                            :selected="selector.selected"
                                            :menu-items="selector.menuItems"
                                            :menu-config="{
                                                visibleItemLimit: 8,
                                            }"
                                            :aria-label="selector.label"
                                            @update:selected="
                                                selectSourceSection(
                                                    selector,
                                                    $event,
                                                )
                                            "
                                        />
                                    </cdx-field>
                                </div>
                            </cdx-field>
                        </div>
                        <p
                            class="kanade-source-editor-source-manager__source-help"
                            aria-hidden="true"
                        >
                            {{ msg('lookup.sourceHelpText') }}
                        </p>
                        <div
                            v-if="loading"
                            class="kanade-source-editor-source-manager__loading"
                        >
                            <small>{{ msg('lookup.loading') }}</small>
                            <cdx-progress-bar
                                :aria-label="msg('lookup.loading')"
                            />
                        </div>
                        <p v-if="existingSources.length === 0">
                            {{ msg('lookup.noDefinitions') }}
                        </p>
                        <p v-else-if="filteredExistingSources.length === 0">
                            {{ msg('lookup.noMatches') }}
                        </p>
                        <div
                            v-else-if="
                                sourceTableGroups.some(
                                    (group) => group.subReferences.length > 0,
                                )
                            "
                            class="kanade-source-editor-source-manager__source-table kanade-source-editor-source-manager__source-groups cdx-table"
                            role="table"
                            :aria-label="msg('lookup.tableCaption')"
                        >
                            <div
                                class="kanade-source-editor-source-manager__source-group-headings"
                                role="row"
                            >
                                <div
                                    v-for="column in sourceTableColumns"
                                    :key="column.id"
                                    role="columnheader"
                                >
                                    {{ column.label }}
                                </div>
                            </div>
                            <div
                                v-for="group in sourceTableGroups"
                                :key="group.source.sourceId"
                                class="kanade-source-editor-source-manager__source-group"
                                role="rowgroup"
                            >
                                <div
                                    class="kanade-source-editor-source-manager__source-group-main"
                                    :class="{
                                        'kanade-source-editor-source-manager__source-group-main--with-sub-references':
                                            group.subReferences.length > 0,
                                    }"
                                    role="row"
                                >
                                    <div
                                        class="kanade-source-editor-source-manager__source-reference"
                                        role="rowheader"
                                        :title="group.source.detailsTitle"
                                    >
                                        <span
                                            class="kanade-source-editor-source-manager__source-reference-name"
                                        >
                                            {{ group.source.reference }}
                                        </span>
                                        <small
                                            class="kanade-source-editor-source-manager__source-details"
                                            :title="group.source.usageTitle"
                                        >
                                            {{ group.source.usageSummary }}
                                        </small>
                                    </div>
                                    <div
                                        class="kanade-source-editor-source-manager__source-title"
                                        role="cell"
                                        :lang="
                                            group.source.titleLanguage ||
                                            undefined
                                        "
                                        :title="group.source.source"
                                    >
                                        {{ group.source.source }}
                                    </div>
                                    <div role="cell">
                                        <div
                                            class="kanade-source-editor-source-manager__source-actions"
                                        >
                                            <cdx-button
                                                action="progressive"
                                                weight="quiet"
                                                type="button"
                                                :disabled="loading"
                                                :aria-label="
                                                    msg('lookup.useSource')
                                                "
                                                :title="
                                                    canReuseListedSourceWithDetails(
                                                        group.source.sourceId,
                                                    )
                                                        ? msg(
                                                              'lookup.useSourceHint',
                                                          )
                                                        : msg(
                                                              'lookup.useSource',
                                                          )
                                                "
                                                @click="
                                                    insertListedSource(
                                                        group.source.sourceId,
                                                        $event,
                                                    )
                                                "
                                            >
                                                <cdx-icon
                                                    :icon="useSourceIcon"
                                                />
                                            </cdx-button>
                                            <cdx-button
                                                weight="quiet"
                                                type="button"
                                                :disabled="loading"
                                                :aria-label="
                                                    msg('lookup.editSource')
                                                "
                                                :title="
                                                    msg('lookup.editSource')
                                                "
                                                @click="
                                                    editListedSource(
                                                        group.source.sourceId,
                                                    )
                                                "
                                            >
                                                <cdx-icon
                                                    :icon="editSourceIcon"
                                                />
                                            </cdx-button>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    v-for="subReference in group.subReferences"
                                    :key="subReference.subReferenceId"
                                    class="kanade-source-editor-source-manager__sub-reference-row"
                                    role="row"
                                >
                                    <div role="rowheader">
                                        <span
                                            class="kanade-source-editor-source-manager__sub-reference-count"
                                            :title="subReference.usageTitle"
                                        >
                                            {{ subReference.usageSummary }}
                                        </span>
                                        <span
                                            class="kanade-source-editor-source-manager__visually-hidden"
                                        >
                                            {{ subReference.reference }}
                                        </span>
                                    </div>
                                    <div
                                        class="kanade-source-editor-source-manager__source-title kanade-source-editor-source-manager__sub-reference-details"
                                        role="cell"
                                        :title="subReference.usageTitle"
                                    >
                                        {{ subReference.source }}
                                    </div>
                                    <div role="cell">
                                        <div
                                            class="kanade-source-editor-source-manager__source-actions"
                                        >
                                            <cdx-button
                                                action="progressive"
                                                weight="quiet"
                                                type="button"
                                                :disabled="loading"
                                                :aria-label="
                                                    msg(
                                                        'lookup.reuseSubReference',
                                                    )
                                                "
                                                :title="
                                                    msg(
                                                        'lookup.reuseSubReference',
                                                    )
                                                "
                                                @click="
                                                    reuseListedSubReference(
                                                        subReference.sourceId,
                                                        subReference.subReferenceId,
                                                    )
                                                "
                                            >
                                                <cdx-icon
                                                    :icon="useSourceIcon"
                                                />
                                            </cdx-button>
                                            <cdx-button
                                                weight="quiet"
                                                type="button"
                                                :disabled="loading"
                                                :aria-label="
                                                    msg(
                                                        'lookup.editSubReference',
                                                    )
                                                "
                                                :title="
                                                    msg(
                                                        'lookup.editSubReference',
                                                    )
                                                "
                                                @click="
                                                    editListedSubReference(
                                                        subReference.sourceId,
                                                        subReference.subReferenceId,
                                                    )
                                                "
                                            >
                                                <cdx-icon
                                                    :icon="editSourceIcon"
                                                />
                                            </cdx-button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <cdx-table
                            v-else
                            :key="sourceTablePaginationKey"
                            class="kanade-source-editor-source-manager__source-table"
                            :caption="msg('lookup.tableCaption')"
                            :hide-caption="true"
                            :use-row-headers="true"
                            :columns="sourceTableColumns"
                            :data="sourceTableRows"
                            :paginate="
                                sourceTableRows.length > 100 &&
                                sourceTableRows.every(
                                    (row) => row.subReferenceId === '',
                                )
                            "
                            :pagination-size-default="100"
                            :pagination-size-options="[
                                { value: 10 },
                                { value: 20 },
                                { value: 50 },
                                { value: 100 },
                            ]"
                        >
                            <template #item-reference="{ item, row }">
                                <span
                                    v-if="row.subReferenceId"
                                    class="kanade-source-editor-source-manager__visually-hidden"
                                >
                                    {{ item }}
                                </span>
                                <div
                                    v-else
                                    class="kanade-source-editor-source-manager__source-reference"
                                >
                                    <span
                                        class="kanade-source-editor-source-manager__source-reference-name"
                                        :title="row.detailsTitle"
                                    >
                                        {{ item }}
                                    </span>
                                    <small
                                        class="kanade-source-editor-source-manager__source-details"
                                        :title="row.usageTitle"
                                    >
                                        {{ row.usageSummary }}
                                    </small>
                                </div>
                            </template>
                            <template #item-source="{ item, row }">
                                <span
                                    class="kanade-source-editor-source-manager__source-title"
                                    :class="{
                                        'kanade-source-editor-source-manager__sub-reference-details':
                                            row.subReferenceId !== '',
                                    }"
                                    :lang="row.titleLanguage || undefined"
                                    :title="
                                        row.subReferenceId
                                            ? row.usageTitle
                                            : item
                                    "
                                >
                                    <template v-if="row.subReferenceId">
                                        ({{ item }})
                                    </template>
                                    <template v-else>{{ item }}</template>
                                </span>
                            </template>
                            <template #item-actions="{ row }">
                                <div
                                    class="kanade-source-editor-source-manager__source-actions"
                                >
                                    <cdx-button
                                        v-if="!row.subReferenceId"
                                        action="progressive"
                                        weight="quiet"
                                        type="button"
                                        :disabled="loading"
                                        :aria-label="msg('lookup.useSource')"
                                        :title="
                                            canReuseListedSourceWithDetails(
                                                row.sourceId,
                                            )
                                                ? msg('lookup.useSourceHint')
                                                : msg('lookup.useSource')
                                        "
                                        @click="
                                            insertListedSource(
                                                row.sourceId,
                                                $event,
                                            )
                                        "
                                    >
                                        <cdx-icon :icon="useSourceIcon" />
                                    </cdx-button>
                                    <cdx-button
                                        v-else
                                        action="progressive"
                                        weight="quiet"
                                        type="button"
                                        :disabled="loading"
                                        :aria-label="
                                            msg('lookup.reuseSubReference')
                                        "
                                        :title="msg('lookup.reuseSubReference')"
                                        @click="
                                            reuseListedSubReference(
                                                row.sourceId,
                                                row.subReferenceId,
                                            )
                                        "
                                    >
                                        <cdx-icon :icon="useSourceIcon" />
                                    </cdx-button>
                                    <cdx-button
                                        weight="quiet"
                                        type="button"
                                        :disabled="loading"
                                        :aria-label="
                                            row.subReferenceId
                                                ? msg('lookup.editSubReference')
                                                : msg('lookup.editSource')
                                        "
                                        :title="
                                            row.subReferenceId
                                                ? msg('lookup.editSubReference')
                                                : msg('lookup.editSource')
                                        "
                                        @click="
                                            row.subReferenceId
                                                ? editListedSubReference(
                                                      row.sourceId,
                                                      row.subReferenceId,
                                                  )
                                                : editListedSource(row.sourceId)
                                        "
                                    >
                                        <cdx-icon :icon="editSourceIcon" />
                                    </cdx-button>
                                </div>
                            </template>
                        </cdx-table>
                    </cdx-tab>
                    <cdx-tab name="tools" :label="msg('tabs.tools')">
                        <div class="kanade-source-editor-source-manager__tools">
                            <cdx-field v-if="formattingSettingsAvailable">
                                <template #label>{{
                                    msg('tools.advanced')
                                }}</template>
                                <template #description>{{
                                    msg('tools.sharedFormattingDescription')
                                }}</template>
                                <cdx-button
                                    type="button"
                                    :disabled="loading"
                                    @click="openFormattingSettings"
                                >
                                    {{ msg('tools.openFormattingSettings') }}
                                </cdx-button>
                            </cdx-field>
                            <section
                                class="kanade-source-editor-source-manager__tool-section"
                            >
                                <h3>{{ msg('tools.checks') }}</h3>
                                <p>{{ msg('tools.checksDescription') }}</p>
                                <div
                                    class="kanade-source-editor-source-manager__tool-launchers"
                                >
                                    <cdx-button
                                        type="button"
                                        @click="openAnalysisTool"
                                    >
                                        {{ msg('tools.analyze') }}
                                    </cdx-button>
                                    <cdx-button
                                        v-if="canCheckCs1Tool"
                                        type="button"
                                        :disabled="cs1ToolStatus === 'checking'"
                                        @click="openCs1Tool"
                                    >
                                        {{ msg('tools.checkCs1') }}
                                    </cdx-button>
                                    <cdx-button
                                        type="button"
                                        @click="openNonCs1Tool"
                                    >
                                        {{ msg('tools.checkNonCs1') }}
                                    </cdx-button>
                                </div>
                            </section>
                        </div>
                    </cdx-tab>
                </cdx-tabs>
            </div>
        </div>
        <template #footer>
            <div class="kanade-source-editor-source-manager__footer">
                <p class="kanade-source-editor-source-manager__footer-note">
                    {{ msg('tool.editorScope') }}
                </p>
                <div
                    class="kanade-source-editor-source-manager__footer-actions"
                >
                    <template
                        v-for="dialogAction in getDialogActionOrder([
                            'undo',
                            'close',
                        ])"
                        :key="dialogAction"
                    >
                        <cdx-button
                            v-if="dialogAction === 'undo'"
                            weight="quiet"
                            type="button"
                            :disabled="loading"
                            @click="cancelAllChanges"
                        >
                            {{ msg('tool.undoSession') }}
                        </cdx-button>
                        <cdx-button
                            v-if="dialogAction === 'close'"
                            type="button"
                            @click="close"
                        >
                            {{ msg('common.close') }}
                        </cdx-button>
                    </template>
                </div>
            </div>
        </template>
    </cdx-dialog>
    <cdx-dialog
        v-model:open="referenceReuseDialogOpen"
        class="kanade-source-editor-source-manager__reference-reuse-dialog"
        :title="
            referenceReuseSubReference
                ? msg('lookup.editSubReference')
                : msg('lookup.useWithDetails')
        "
        :lang="interfaceLocale"
        :close-button-label="msg('common.cancel')"
        use-close-button
        @update:open="onReferenceReuseDialogOpenChange"
    >
        <div class="kanade-source-editor-source-manager__dialog-body-content">
            <cdx-message v-if="referenceReuseError" type="error">
                {{ referenceReuseError }}
            </cdx-message>
            <p
                class="kanade-source-editor-source-manager__reference-reuse-name"
            >
                {{ referenceReuseSource?.referenceName }}
                <small v-if="referenceReuseSource?.group">
                    {{
                        msg('lookup.group', {
                            group: referenceReuseSource.group,
                        })
                    }}
                </small>
            </p>
            <cdx-field>
                <template #label>
                    {{ msg('lookup.referenceDetails') }}
                </template>
                <template #description>
                    {{ msg('lookup.referenceDetailsDescription') }}
                </template>
                <cdx-text-area
                    v-model="referenceReuseDetails"
                    :autosize="true"
                    rows="2"
                    :disabled="loading"
                    :aria-label="msg('lookup.referenceDetails')"
                    autofocus
                />
            </cdx-field>
            <p v-if="referenceReuseSubReferences.length > 1">
                {{
                    msg('lookup.editSubReferenceUses', {
                        count: referenceReuseSubReferences.length,
                    })
                }}
            </p>
            <section
                class="kanade-source-editor-source-manager__reference-reuse-preview"
            >
                <h3
                    class="kanade-source-editor-source-manager__section-heading"
                >
                    {{ msg('lookup.referencePreview') }}
                </h3>
                <code>{{ getReferenceReusePreview() }}</code>
            </section>
        </div>
        <template #footer>
            <div
                class="kanade-source-editor-source-manager__reference-reuse-actions kanade-source-editor-source-manager__footer-actions"
            >
                <template
                    v-for="dialogAction in getDialogActionOrder([
                        'cancel',
                        'use',
                    ])"
                    :key="dialogAction"
                >
                    <cdx-button
                        v-if="dialogAction === 'cancel'"
                        type="button"
                        @click="closeReferenceReuseDialog"
                    >
                        {{ msg('common.cancel') }}
                    </cdx-button>
                    <cdx-button
                        v-if="dialogAction === 'use'"
                        class="kanade-source-editor-source-manager__primary-action"
                        action="progressive"
                        weight="primary"
                        type="button"
                        :disabled="loading || referenceReuseSource == null"
                        @click="insertReferenceWithDetails"
                    >
                        {{
                            referenceReuseSubReference
                                ? msg('common.saveChanges')
                                : msg('lookup.useSource')
                        }}
                    </cdx-button>
                </template>
            </div>
        </template>
    </cdx-dialog>
</template>
