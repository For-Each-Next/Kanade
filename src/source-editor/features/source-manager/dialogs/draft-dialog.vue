<!--
@file src/source-editor/features/source-manager/dialogs/draft-dialog.vue
Purpose: src / features / source manager / dialogs / draft dialog module.

Table of contents:
1. Template
-->

<template>
    <cdx-dialog
        v-model:open="draftPopupOpen"
        class="kanade-source-editor-source-manager__draft-dialog"
        :title="
            editingSource
                ? msg('draft.editSourceTitle')
                : msg('draft.createSourceTitle')
        "
        :lang="interfaceLocale"
        :fixed-height="704"
        :close-button-label="msg('common.cancel')"
        use-close-button
        @update:open="onDraftPopupOpenChange"
    >
        <div class="kanade-source-editor-source-manager__dialog-body-content">
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
            <div
                v-if="draftCs1Checking"
                class="kanade-source-editor-source-manager__loading kanade-source-editor-source-manager__draft-cs1-progress"
                aria-live="polite"
            >
                <small>{{ msg('checker.checking') }}</small>
                <cdx-progress-bar :aria-label="msg('checker.checking')" />
            </div>
            <div
                v-if="draft"
                class="kanade-source-editor-source-manager__draft-editor"
                :aria-busy="loading"
            >
                <section
                    v-if="
                        editingSource && editingSource.status === 'non-standard'
                    "
                    class="kanade-source-editor-source-manager__original-source"
                >
                    <h3>{{ msg('draft.originalSource') }}</h3>
                    <p>{{ msg('draft.originalDescription') }}</p>
                    <pre>{{ editingSource.rawReference }}</pre>
                </section>
                <div class="kanade-source-editor-source-manager__draft-header">
                    <cdx-field
                        class="kanade-source-editor-source-manager__template-field"
                        :disabled="loading"
                    >
                        <template #label>
                            {{ msg('draft.citationTemplate') }}
                        </template>
                        <cdx-select
                            :selected="draft.template"
                            :menu-items="templateOptions"
                            :menu-config="{ visibleItemLimit: 8 }"
                            @update:selected="changeDraftTemplate"
                        />
                    </cdx-field>
                    <section
                        v-if="hasCitationIdentity"
                        class="kanade-source-editor-source-manager__reference-identity"
                        aria-labelledby="cf-reference-identity-label"
                    >
                        <h3
                            id="cf-reference-identity-label"
                            class="kanade-source-editor-source-manager__section-heading"
                        >
                            {{ msg('draft.referenceName') }}
                        </h3>
                        <p
                            class="kanade-source-editor-source-manager__reference-name-preview"
                        >
                            {{
                                [
                                    citationNameParts.author,
                                    citationNameParts.year,
                                    citationNameParts.part,
                                ]
                                    .filter(Boolean)
                                    .join(', ')
                            }}
                        </p>
                    </section>
                </div>
                <section
                    class="kanade-source-editor-source-manager__parameter-section"
                    aria-labelledby="cf-parameter-section-label"
                >
                    <h3
                        id="cf-parameter-section-label"
                        class="kanade-source-editor-source-manager__section-heading"
                    >
                        {{ msg('draft.parametersCaption') }}
                    </h3>
                    <p
                        class="kanade-source-editor-source-manager__section-description"
                    >
                        {{ msg('draft.parametersDescription') }}
                    </p>
                    <div
                        class="kanade-source-editor-source-manager__parameter-editor"
                    >
                        <div
                            class="kanade-source-editor-source-manager__parameter-table-header"
                        >
                            <div
                                class="kanade-source-editor-source-manager__parameter-table-actions"
                            >
                                <cdx-button
                                    type="button"
                                    :disabled="loading"
                                    :title="msg('draft.addParameter')"
                                    :aria-label="msg('draft.addParameter')"
                                    @click="addParameter"
                                >
                                    {{ msg('draft.addParameter') }}
                                </cdx-button>
                                <cdx-button
                                    type="button"
                                    :disabled="loading"
                                    weight="quiet"
                                    :title="msg('draft.sortParameters')"
                                    :aria-label="msg('draft.sortParameters')"
                                    @click="sortParameters"
                                >
                                    {{ msg('draft.sortParameters') }}
                                </cdx-button>
                                <cdx-button
                                    v-if="
                                        editingSource &&
                                        editingSource.status === 'standard' &&
                                        !draftReviewTool
                                    "
                                    type="button"
                                    :disabled="loading"
                                    weight="quiet"
                                    :title="msg('draft.duplicate')"
                                    :aria-label="msg('draft.duplicate')"
                                    @click="duplicateDraft"
                                >
                                    {{ msg('draft.duplicate') }}
                                </cdx-button>
                            </div>
                        </div>
                        <div
                            class="kanade-source-editor-source-manager__parameter-list"
                        >
                            <div
                                v-for="(row, index) in draft.rows"
                                :key="draftRowKey(row)"
                                class="kanade-source-editor-source-manager__parameter-row"
                                :class="{
                                    'kanade-source-editor-source-manager__parameter-row--reference-name':
                                        citationNameCells.has(index),
                                    'kanade-source-editor-source-manager__parameter-row--author-change':
                                        flashingAuthorRows.has(row),
                                }"
                            >
                                <div
                                    class="kanade-source-editor-source-manager__parameter-cell kanade-source-editor-source-manager__parameter-cell--name"
                                >
                                    <cdx-field :hide-label="true">
                                        <template #label>{{
                                            msg('draft.parameterName')
                                        }}</template>
                                        <cdx-combobox
                                            :title="
                                                getParameterNameTooltip(
                                                    row.name,
                                                )
                                            "
                                            v-model:selected="row.name"
                                            class="kanade-source-editor-source-manager__parameter-name"
                                            :menu-items="parameterNameOptions"
                                            :menu-config="{
                                                visibleItemLimit: 8,
                                            }"
                                            :status="
                                                draftCellErrors.get(index)?.name
                                                    ? 'error'
                                                    : 'default'
                                            "
                                            :disabled="loading"
                                            :aria-label="
                                                getDraftFieldLabel(
                                                    index,
                                                    'name',
                                                    row.name,
                                                )
                                            "
                                            :placeholder="
                                                msg(
                                                    'draft.parameterPlaceholder',
                                                )
                                            "
                                            @update:selected="
                                                clearDraftValidationError
                                            "
                                        >
                                            <template #no-results>
                                                {{
                                                    msg('draft.customParameter')
                                                }}
                                            </template>
                                        </cdx-combobox>
                                        <small
                                            v-if="
                                                draftCellErrors.get(index)?.name
                                            "
                                            :id="
                                                'cf-parameter-name-error-' +
                                                index
                                            "
                                            class="kanade-source-editor-source-manager__field-error"
                                        >
                                            {{
                                                draftCellErrors.get(index)?.name
                                            }}
                                        </small>
                                    </cdx-field>
                                </div>
                                <div
                                    class="kanade-source-editor-source-manager__parameter-cell kanade-source-editor-source-manager__parameter-cell--value"
                                >
                                    <cdx-field :hide-label="true">
                                        <template #label>{{
                                            msg('draft.value')
                                        }}</template>
                                        <cdx-text-area
                                            :model-value="row.value"
                                            :autosize="true"
                                            rows="1"
                                            wrap="soft"
                                            :status="
                                                draftCellErrors.get(index)
                                                    ?.value
                                                    ? 'error'
                                                    : 'default'
                                            "
                                            :disabled="loading"
                                            :aria-label="
                                                getDraftFieldLabel(
                                                    index,
                                                    'value',
                                                    row.name,
                                                )
                                            "
                                            @update:model-value="
                                                updateParameterValue(
                                                    index,
                                                    $event,
                                                )
                                            "
                                        />
                                        <small
                                            v-if="row.alias.trim() !== ''"
                                            class="kanade-source-editor-source-manager__parameter-alias-caption"
                                        >
                                            {{
                                                getParameterAliasCaption(
                                                    row.name,
                                                    row.alias,
                                                )
                                            }}
                                        </small>
                                        <small
                                            v-if="
                                                draftCellErrors.get(index)
                                                    ?.value
                                            "
                                            :id="
                                                'cf-parameter-value-error-' +
                                                index
                                            "
                                            class="kanade-source-editor-source-manager__field-error"
                                        >
                                            {{
                                                draftCellErrors.get(index)
                                                    ?.value
                                            }}
                                        </small>
                                        <small
                                            v-if="
                                                hasCitationIdentity &&
                                                draftCellErrors.get(index)
                                                    ?.alias
                                            "
                                            :id="
                                                'cf-parameter-alias-error-' +
                                                index
                                            "
                                            class="kanade-source-editor-source-manager__field-error"
                                        >
                                            {{
                                                draftCellErrors.get(index)
                                                    ?.alias
                                            }}
                                        </small>
                                        <div
                                            v-if="
                                                hasCitationIdentity &&
                                                getAliasSuggestion(index)
                                            "
                                            class="kanade-source-editor-source-manager__alias-suggestion"
                                        >
                                            <small>
                                                {{
                                                    msg(
                                                        'draft.aliasSuggestion',
                                                        {
                                                            alias:
                                                                getAliasSuggestion(
                                                                    index,
                                                                )?.alias ?? '',
                                                        },
                                                    )
                                                }}
                                            </small>
                                            <div
                                                class="kanade-source-editor-source-manager__alias-suggestion-actions"
                                            >
                                                <cdx-button
                                                    action="progressive"
                                                    weight="quiet"
                                                    type="button"
                                                    :disabled="loading"
                                                    :title="msg('common.use')"
                                                    :aria-label="
                                                        msg('common.use')
                                                    "
                                                    @click="
                                                        useAliasSuggestion(
                                                            index,
                                                        )
                                                    "
                                                >
                                                    <cdx-icon
                                                        :icon="confirmIcon"
                                                    />
                                                </cdx-button>
                                                <cdx-button
                                                    weight="quiet"
                                                    type="button"
                                                    :disabled="loading"
                                                    :title="
                                                        msg('common.dismiss')
                                                    "
                                                    :aria-label="
                                                        msg('common.dismiss')
                                                    "
                                                    @click="
                                                        dismissAliasSuggestion(
                                                            index,
                                                        )
                                                    "
                                                >
                                                    <cdx-icon
                                                        :icon="closeIcon"
                                                    />
                                                </cdx-button>
                                            </div>
                                        </div>
                                    </cdx-field>
                                </div>
                                <div
                                    class="kanade-source-editor-source-manager__parameter-cell kanade-source-editor-source-manager__parameter-cell--actions"
                                >
                                    <div
                                        class="kanade-source-editor-source-manager__parameter-actions"
                                        role="group"
                                        :aria-label="msg('lookup.actions')"
                                    >
                                        <cdx-button
                                            type="button"
                                            weight="quiet"
                                            :disabled="loading"
                                            :title="
                                                msg(
                                                    'draft.insertParameterBelow',
                                                )
                                            "
                                            :aria-label="
                                                msg(
                                                    'draft.insertParameterBelow',
                                                )
                                            "
                                            @click="insertParameterBelow(index)"
                                        >
                                            <cdx-icon
                                                :icon="addParameterIcon"
                                            />
                                        </cdx-button>
                                        <cdx-button
                                            v-if="hasCitationIdentity"
                                            type="button"
                                            :title="
                                                getParameterAliasActionLabel(
                                                    row,
                                                )
                                            "
                                            class="kanade-source-editor-source-manager__parameter-alias-action"
                                            :class="{
                                                'kanade-source-editor-source-manager__parameter-alias-action--excluded':
                                                    hasReferenceNameExclusion(
                                                        row,
                                                    ),
                                            }"
                                            weight="quiet"
                                            :disabled="loading"
                                            :aria-label="
                                                getParameterAliasActionLabel(
                                                    row,
                                                )
                                            "
                                            @click="
                                                openParameterAliasDialog(index)
                                            "
                                        >
                                            <cdx-icon
                                                :icon="parameterAliasIcon"
                                            />
                                        </cdx-button>
                                        <a
                                            v-if="
                                                isUrlDraftParameter(row.name) &&
                                                getOpenableDraftUrl(row.value)
                                            "
                                            class="kanade-source-editor-source-manager__external-link"
                                            :href="
                                                getOpenableDraftUrl(row.value)
                                            "
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            :title="
                                                msg('draft.openUrlLabel', {
                                                    parameter: row.name,
                                                })
                                            "
                                            :aria-label="
                                                msg('draft.openUrlLabel', {
                                                    parameter: row.name,
                                                })
                                            "
                                        >
                                            <cdx-icon :icon="openUrlIcon" />
                                        </a>
                                        <cdx-button
                                            v-if="
                                                row.name
                                                    .trim()
                                                    .toLowerCase() ===
                                                'url-status'
                                            "
                                            :title="msg('draft.switchStatus')"
                                            weight="quiet"
                                            type="button"
                                            :disabled="loading"
                                            :aria-label="
                                                msg('draft.switchStatusLabel')
                                            "
                                            @click="switchUrlStatus(index)"
                                        >
                                            <cdx-icon
                                                :icon="switchStatusIcon"
                                            />
                                        </cdx-button>
                                        <cdx-button
                                            v-if="
                                                isDateAutofillParameter(
                                                    row.name,
                                                )
                                            "
                                            :title="
                                                getDateAutofillTooltip(row.name)
                                            "
                                            weight="quiet"
                                            type="button"
                                            :disabled="loading"
                                            :aria-label="
                                                getDateAutofillTooltip(row.name)
                                            "
                                            @click="autofillDate(index)"
                                        >
                                            <cdx-icon :icon="magicWandIcon" />
                                        </cdx-button>
                                        <cdx-button
                                            v-if="
                                                isLinkableDraftParameter(
                                                    row.name,
                                                )
                                            "
                                            :title="msg('draft.checkLink')"
                                            weight="quiet"
                                            type="button"
                                            :disabled="
                                                loading ||
                                                row.value.trim() === ''
                                            "
                                            :aria-label="
                                                msg('draft.checkLinkLabel', {
                                                    parameter: row.name,
                                                })
                                            "
                                            @click="linkOrganization(index)"
                                        >
                                            <cdx-icon :icon="linkIcon" />
                                        </cdx-button>
                                        <cdx-button
                                            v-if="
                                                hasCitationIdentity &&
                                                isAuthorDraftParameter(row.name)
                                            "
                                            :title="msg('draft.splitAuthor')"
                                            weight="quiet"
                                            type="button"
                                            :disabled="
                                                loading ||
                                                !canSplitAuthor(index)
                                            "
                                            :aria-label="
                                                msg('draft.splitAuthorLabel', {
                                                    parameter: row.name,
                                                })
                                            "
                                            @click="splitAuthor(index)"
                                        >
                                            <cdx-icon
                                                class="kanade-source-editor-source-manager__split-author-icon"
                                                :icon="splitAuthorIcon"
                                            />
                                        </cdx-button>
                                        <cdx-button
                                            v-else-if="
                                                hasCitationIdentity &&
                                                isLastAuthorDraftParameter(
                                                    row.name,
                                                )
                                            "
                                            :title="msg('draft.joinAuthor')"
                                            weight="quiet"
                                            type="button"
                                            :disabled="
                                                loading || !canJoinAuthor(index)
                                            "
                                            :aria-label="
                                                msg('draft.joinAuthorLabel', {
                                                    parameter: row.name,
                                                })
                                            "
                                            @click="joinAuthor(index)"
                                        >
                                            <cdx-icon :icon="joinAuthorIcon" />
                                        </cdx-button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <section
                    class="kanade-source-editor-source-manager__source-preview-section"
                    aria-labelledby="kanade-source-editor-source-preview-label"
                >
                    <h3
                        id="kanade-source-editor-source-preview-label"
                        class="kanade-source-editor-source-manager__section-heading"
                    >
                        {{ msg('draft.sourceCode') }}
                    </h3>
                    <code
                        class="kanade-source-editor-source-manager__source-preview"
                        ><span
                            v-for="(part, index) in draftSourcePreview"
                            :key="index"
                            :class="
                                'kanade-source-editor-source-manager__source-preview--' +
                                part.kind
                            "
                            >{{ part.text }}</span
                        ></code
                    >
                </section>
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
                            'cancel',
                            'apply',
                            'save',
                        ])"
                        :key="dialogAction"
                    >
                        <cdx-button
                            v-if="dialogAction === 'cancel'"
                            type="button"
                            weight="quiet"
                            :disabled="loading"
                            :title="msg('common.cancel')"
                            :aria-label="msg('common.cancel')"
                            @click="closeDraftPopup"
                        >
                            {{ msg('common.cancel') }}
                        </cdx-button>
                        <cdx-button
                            v-if="dialogAction === 'apply' && editingSource"
                            type="button"
                            :disabled="loading"
                            :title="msg('draft.applyAndContinue')"
                            :aria-label="msg('draft.applyAndContinue')"
                            @click="applyDraft"
                        >
                            {{ msg('draft.applyAndContinue') }}
                        </cdx-button>
                        <cdx-button
                            v-if="dialogAction === 'save'"
                            class="kanade-source-editor-source-manager__primary-action"
                            action="progressive"
                            weight="primary"
                            type="button"
                            :disabled="loading"
                            :title="msg('draft.saveCitation')"
                            :aria-label="msg('draft.saveCitation')"
                            @click="saveDraft"
                        >
                            {{ msg('draft.saveCitation') }}
                        </cdx-button>
                    </template>
                </div>
            </div>
        </template>
    </cdx-dialog>
</template>
