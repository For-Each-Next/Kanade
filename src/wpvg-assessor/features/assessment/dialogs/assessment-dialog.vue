<template>
    <cdx-dialog
        v-if="!batchEditor"
        :open="open && !batchConfirmOpen && !minimized"
        class="kanade-wpvg-assessor-dialog"
        :title="dialogTitle"
        :lang="interfaceLocale"
        :close-button-label="msg('dialog.cancel')"
        @update:open="onOpenChange"
    >
        <template #footer>
            <div
                class="kanade-wpvg-assessor-dialog__actions"
                :class="{
                    'kanade-wpvg-assessor-dialog__actions--stacked':
                        stackedActions,
                }"
            >
                <cdx-toggle-switch
                    v-if="stagingAvailable"
                    class="kanade-wpvg-assessor-stage-toggle"
                    :model-value="currentStaged"
                    :disabled="saving || preparing"
                    @update:model-value="onStage"
                >
                    {{ msg('dialog.stage') }}
                </cdx-toggle-switch>
                <cdx-button
                    v-for="action in footerActions"
                    :key="action.id"
                    :action="action.action"
                    :weight="action.weight"
                    :disabled="action.disabled"
                    @click="action.activate"
                >
                    {{ action.label }}
                </cdx-button>
            </div>
        </template>
        <div class="kanade-wpvg-assessor-dialog__body">
            <div
                class="kanade-wpvg-assessor-status-region"
                aria-live="polite"
                aria-atomic="true"
            >
                <cdx-message
                    v-if="status"
                    class="kanade-wpvg-assessor-status"
                    :type="statusType"
                >
                    {{ status }}
                </cdx-message>
                <cdx-progress-bar
                    v-if="saving || preparing"
                    class="kanade-wpvg-assessor-save-progress"
                    :aria-label="status || msg('dialog.saving')"
                />
            </div>

            <div
                class="kanade-wpvg-assessor-assessment-grid"
                :aria-busy="saving || preparing"
            >
                <section
                    class="kanade-wpvg-assessor-controls"
                    aria-labelledby="kanade-wpvg-assessor-assessment-title"
                >
                    <h2
                        id="kanade-wpvg-assessor-assessment-title"
                        ref="assessmentHeading"
                        class="kanade-wpvg-assessor-section-title"
                        :tabindex="assessmentHeadingTabIndex"
                        @focus="onAssessmentHeadingFocus"
                    >
                        {{ msg('dialog.assessment') }}
                    </h2>
                    <div class="kanade-wpvg-assessor-rating-grid">
                        <cdx-field
                            class="kanade-wpvg-assessor-section"
                            :is-fieldset="true"
                            :disabled="saving || preparing"
                        >
                            <template #label>{{
                                msg('dialog.class')
                            }}</template>
                            <div class="kanade-wpvg-assessor-choice-list">
                                <cdx-radio
                                    v-for="option in classOptions"
                                    :key="option.value"
                                    :model-value="classSelection"
                                    :input-value="option.value"
                                    :disabled="saving || preparing"
                                    :inline="true"
                                    name="className"
                                    @update:model-value="selectClass"
                                >
                                    {{ option.label }}
                                </cdx-radio>
                                <div
                                    class="kanade-wpvg-assessor-custom-class-row"
                                >
                                    <cdx-radio
                                        :model-value="classSelection"
                                        input-value=""
                                        :disabled="saving || preparing"
                                        :inline="true"
                                        name="className"
                                        @update:model-value="selectClass"
                                    >
                                        {{ msg('dialog.customClass') }}
                                    </cdx-radio>
                                    <cdx-text-input
                                        class="kanade-wpvg-assessor-custom-class-input"
                                        :model-value="classInput"
                                        :aria-label="
                                            msg('dialog.customClassValue')
                                        "
                                        :disabled="
                                            saving ||
                                            preparing ||
                                            classSelection !== ''
                                        "
                                        @update:model-value="setClassName"
                                        @blur="commitClassName"
                                    />
                                </div>
                            </div>
                        </cdx-field>
                        <cdx-field
                            class="kanade-wpvg-assessor-section"
                            :is-fieldset="true"
                            :disabled="saving || preparing"
                        >
                            <template #label>{{
                                msg('dialog.importance')
                            }}</template>
                            <div class="kanade-wpvg-assessor-choice-list">
                                <cdx-radio
                                    v-for="option in importanceOptions"
                                    :key="option.value"
                                    :model-value="assessment.importance"
                                    :input-value="option.value"
                                    :disabled="saving || preparing"
                                    :inline="true"
                                    name="importance"
                                    @update:model-value="setImportance"
                                >
                                    {{ option.label }}
                                </cdx-radio>
                            </div>
                        </cdx-field>
                    </div>

                    <cdx-field
                        class="kanade-wpvg-assessor-section"
                        :is-fieldset="true"
                        :disabled="saving || preparing || videoGamesDisabled"
                    >
                        <template #label>{{
                            msg('dialog.taskForces')
                        }}</template>
                        <div class="kanade-wpvg-assessor-check-list">
                            <cdx-checkbox
                                v-for="option in taskForceOptions"
                                :key="option.id"
                                :model-value="assessment.taskForces[option.id]"
                                :inline="true"
                                :disabled="
                                    saving || preparing || videoGamesDisabled
                                "
                                :name="'taskForce-' + option.id"
                                @update:model-value="
                                    setSelection(
                                        'taskForces',
                                        option.id,
                                        $event,
                                    )
                                "
                            >
                                {{ option.label }}
                            </cdx-checkbox>
                        </div>
                    </cdx-field>

                    <cdx-field
                        class="kanade-wpvg-assessor-section"
                        :is-fieldset="true"
                        :disabled="saving || preparing || videoGamesDisabled"
                    >
                        <template #label>{{
                            msg('dialog.maintenance')
                        }}</template>
                        <div class="kanade-wpvg-assessor-check-list">
                            <cdx-checkbox
                                v-for="option in maintenanceOptions"
                                :key="option.id"
                                :model-value="assessment.maintenance[option.id]"
                                :inline="true"
                                :disabled="
                                    saving || preparing || videoGamesDisabled
                                "
                                :name="'maintenance-' + option.id"
                                @update:model-value="
                                    setSelection(
                                        'maintenance',
                                        option.id,
                                        $event,
                                    )
                                "
                            >
                                {{ option.label }}
                            </cdx-checkbox>
                        </div>
                    </cdx-field>

                    <cdx-field
                        class="kanade-wpvg-assessor-section"
                        :is-fieldset="true"
                        :disabled="saving || preparing"
                    >
                        <template #label>{{
                            msg('dialog.otherProjects')
                        }}</template>
                        <div class="kanade-wpvg-assessor-check-list">
                            <cdx-checkbox
                                v-for="option in otherProjectOptions"
                                :key="option.id"
                                :model-value="
                                    assessment.otherProjects[option.id]
                                "
                                :disabled="saving || preparing"
                                :inline="true"
                                :name="'otherProject-' + option.id"
                                @update:model-value="
                                    setSelection(
                                        'otherProjects',
                                        option.id,
                                        $event,
                                    )
                                "
                            >
                                {{ option.label }}
                            </cdx-checkbox>
                        </div>
                    </cdx-field>
                </section>

                <section
                    class="kanade-wpvg-assessor-source"
                    aria-labelledby="kanade-wpvg-assessor-review-title"
                >
                    <h2
                        id="kanade-wpvg-assessor-review-title"
                        class="kanade-wpvg-assessor-section-title"
                    >
                        {{ msg('dialog.reviewTalkPage') }}
                    </h2>
                    <cdx-field
                        class="kanade-wpvg-assessor-section kanade-wpvg-assessor-source-field"
                    >
                        <template #label>{{
                            msg('dialog.readySource')
                        }}</template>
                        <cdx-text-area
                            class="kanade-wpvg-assessor-compare-textarea"
                            :model-value="previewText"
                            :readonly="saving || preparing"
                            rows="8"
                            @update:model-value="onPreviewInput"
                        />
                    </cdx-field>

                    <div
                        class="kanade-wpvg-assessor-section kanade-wpvg-assessor-comparison-field"
                    >
                        <h3 class="kanade-wpvg-assessor-field-title">
                            {{ msg('dialog.leadDiff') }}
                        </h3>
                        <p
                            class="kanade-wpvg-assessor-description kanade-wpvg-assessor-comparison-help"
                        >
                            {{ msg('dialog.diffHelp') }}
                        </p>
                        <wikitext-comparison
                            :after-label="msg('dialog.afterSave')"
                            :before-label="msg('dialog.currentSource')"
                            :comparison="talkComparison"
                            :label="msg('dialog.leadDiff')"
                            :no-changes-label="msg('registration.noChanges')"
                        />
                    </div>

                    <cdx-field
                        class="kanade-wpvg-assessor-section kanade-wpvg-assessor-summary"
                    >
                        <template #label>{{
                            msg('dialog.talkSummary')
                        }}</template>
                        <cdx-text-input
                            :model-value="summary"
                            :readonly="saving || preparing"
                            @update:model-value="onSummaryInput"
                        />
                    </cdx-field>
                </section>
            </div>

            <section
                class="kanade-wpvg-assessor-registration"
                :aria-busy="saving || preparing"
                aria-labelledby="kanade-wpvg-assessor-registration-title"
            >
                <h2
                    id="kanade-wpvg-assessor-registration-title"
                    class="kanade-wpvg-assessor-section-title"
                >
                    {{ msg('dialog.newPageList') }}
                </h2>
                <cdx-message
                    v-if="registrationDisabled"
                    class="kanade-wpvg-assessor-registration-message"
                    type="notice"
                    :inline="true"
                >
                    {{ registrationLabel }}
                </cdx-message>
                <cdx-checkbox
                    v-else
                    class="kanade-wpvg-assessor-registration-choice"
                    :model-value="shouldRegister"
                    :disabled="saving || preparing"
                    name="registerNewPage"
                    @update:model-value="setRegister"
                >
                    {{ registrationLabel }}
                </cdx-checkbox>

                <div
                    v-if="showListReview"
                    class="kanade-wpvg-assessor-list-review"
                >
                    <div
                        class="kanade-wpvg-assessor-section kanade-wpvg-assessor-list-preview"
                    >
                        <h3 class="kanade-wpvg-assessor-field-title">
                            {{ msg('dialog.listChanges') }}
                        </h3>
                        <wikitext-comparison
                            :after-label="msg('dialog.afterSave')"
                            :before-label="msg('dialog.before')"
                            :comparison="listComparison"
                            :label="msg('dialog.listChanges')"
                            :no-changes-label="msg('registration.noChanges')"
                        />
                    </div>
                    <cdx-field
                        class="kanade-wpvg-assessor-section kanade-wpvg-assessor-list-summary"
                    >
                        <template #label>{{
                            msg('dialog.listSummary')
                        }}</template>
                        <cdx-text-input
                            :model-value="displayedListSummary"
                            :readonly="saving || preparing"
                            @update:model-value="setListSummary"
                        />
                    </cdx-field>
                </div>
            </section>
        </div>
    </cdx-dialog>
    <cdx-dialog
        v-if="!batchEditor"
        :open="batchConfirmOpen && !minimized"
        class="kanade-wpvg-assessor-dialog kanade-wpvg-assessor-batch-dialog"
        :title="msg('dialog.batchConfirmTitle')"
        :lang="interfaceLocale"
        :close-button-label="msg('dialog.batchBack')"
        @update:open="onBatchOpenChange"
    >
        <template #footer>
            <div
                class="kanade-wpvg-assessor-dialog__actions"
                :class="{
                    'kanade-wpvg-assessor-dialog__actions--stacked':
                        stackedActions,
                }"
            >
                <cdx-button weight="quiet" @click="onCollapse">
                    {{ msg('dialog.collapse') }}
                </cdx-button>
                <cdx-button
                    ref="batchBackButton"
                    :disabled="saving || batchRemovingTitle !== ''"
                    @click="onBatchCancel"
                >
                    {{ msg('dialog.batchBack') }}
                </cdx-button>
                <cdx-button
                    action="progressive"
                    weight="primary"
                    :disabled="
                        saving ||
                        preparing ||
                        !batchPrepared ||
                        batchSelectedCount === 0
                    "
                    @click="onConfirmBatch"
                >
                    {{ msg('dialog.batchConfirm') }}
                </cdx-button>
            </div>
        </template>
        <div
            ref="batchContent"
            class="kanade-wpvg-assessor-batch-content"
            role="region"
            tabindex="-1"
            :aria-label="msg('dialog.batchConfirmTitle')"
            :aria-busy="saving || preparing"
        >
            <div
                :inert="saving || undefined"
                :aria-hidden="saving ? true : undefined"
            >
                <cdx-message v-if="status" :type="statusType">
                    {{ status }}
                </cdx-message>
                <cdx-progress-bar
                    v-if="preparing"
                    :aria-label="msg('dialog.preparingBatch')"
                />
                <p>
                    {{
                        msg('dialog.batchConfirmHelp', {
                            count: batchSelectedCount,
                        })
                    }}
                </p>
                <p>{{ msg('dialog.batchUncheckedNotice') }}</p>
                <p>{{ msg('dialog.batchRateLimit') }}</p>
                <cdx-message
                    v-if="batchReviewRows.length && batchSelectedCount === 0"
                    type="notice"
                >
                    {{ msg('dialog.batchNoSelection') }}
                </cdx-message>
                <div class="kanade-wpvg-assessor-batch-table-scroll">
                    <table class="kanade-wpvg-assessor-batch-table">
                        <caption>
                            {{
                                msg('dialog.batchConfirmTitle')
                            }}
                        </caption>
                        <thead>
                            <tr>
                                <th
                                    scope="col"
                                    class="kanade-wpvg-assessor-batch-select"
                                >
                                    <cdx-checkbox
                                        :model-value="batchAllSelected"
                                        :indeterminate="batchPartiallySelected"
                                        :disabled="
                                            saving ||
                                            batchRemovingTitle !== '' ||
                                            batchReviewRows.length === 0
                                        "
                                        @update:model-value="onBatchSelectAll"
                                    >
                                        <span class="kanade-wpvg-assessor-sr">
                                            {{ msg('dialog.batchSelectAll') }}
                                        </span>
                                    </cdx-checkbox>
                                </th>
                                <th scope="col">
                                    {{ msg('dialog.batchPage') }}
                                </th>
                                <th scope="col">
                                    {{ msg('dialog.batchSummary') }}
                                </th>
                                <th scope="col">
                                    {{ msg('dialog.batchChanges') }}
                                </th>
                                <th
                                    scope="col"
                                    class="kanade-wpvg-assessor-batch-actions"
                                >
                                    {{ msg('dialog.batchActions') }}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="batchReviewRows.length === 0">
                                <td colspan="5">
                                    {{ msg('dialog.batchEmpty') }}
                                </td>
                            </tr>
                            <tr v-for="row in batchReviewRows" :key="row.title">
                                <td class="kanade-wpvg-assessor-batch-select">
                                    <cdx-checkbox
                                        :model-value="row.selected"
                                        :disabled="
                                            saving || batchRemovingTitle !== ''
                                        "
                                        @update:model-value="
                                            onBatchSelect(row.title, $event)
                                        "
                                    >
                                        <span class="kanade-wpvg-assessor-sr">
                                            {{
                                                msg(
                                                    'dialog.batchSelectArticle',
                                                    { title: row.title },
                                                )
                                            }}
                                        </span>
                                    </cdx-checkbox>
                                </td>
                                <th scope="row">{{ row.title }}</th>
                                <td>{{ row.changed ? row.summary : '—' }}</td>
                                <td>
                                    <details v-if="row.changed">
                                        <summary>
                                            {{
                                                msg('dialog.batchReviewChanges')
                                            }}
                                        </summary>
                                        <wikitext-comparison
                                            :after-label="msg('dialog.after')"
                                            :before-label="msg('dialog.before')"
                                            :comparison="row.comparison"
                                            :label="row.title"
                                            :no-changes-label="
                                                msg('registration.noChanges')
                                            "
                                        />
                                    </details>
                                    <span v-else>
                                        {{ msg('registration.noChanges') }}
                                    </span>
                                </td>
                                <td class="kanade-wpvg-assessor-batch-actions">
                                    <cdx-button
                                        class="kanade-wpvg-assessor-edit"
                                        weight="quiet"
                                        :disabled="
                                            saving ||
                                            preparing ||
                                            batchRemovingTitle !== ''
                                        "
                                        :aria-label="
                                            msg('dialog.batchEdit', {
                                                title: row.title,
                                            })
                                        "
                                        :title="
                                            msg('dialog.batchEdit', {
                                                title: row.title,
                                            })
                                        "
                                        @click="onBatchEdit(row.title)"
                                    >
                                        <cdx-icon :icon="cdxIconEdit" />
                                    </cdx-button>
                                    <cdx-button
                                        class="kanade-wpvg-assessor-trash"
                                        action="default"
                                        weight="quiet"
                                        :disabled="
                                            saving ||
                                            preparing ||
                                            batchRemovingTitle !== ''
                                        "
                                        :aria-label="
                                            msg('dialog.batchRemove', {
                                                title: row.title,
                                            })
                                        "
                                        :title="
                                            msg('dialog.batchRemove', {
                                                title: row.title,
                                            })
                                        "
                                        @click="onBatchRemove(row.title)"
                                    >
                                        <cdx-icon :icon="cdxIconTrash" />
                                    </cdx-button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <section
                    v-if="batchRegistrationReview"
                    class="kanade-wpvg-assessor-batch-registration"
                >
                    <h3 class="kanade-wpvg-assessor-field-title">
                        {{ msg('dialog.batchRegistration') }}
                    </h3>
                    <wikitext-comparison
                        :after-label="msg('dialog.after')"
                        :before-label="msg('dialog.before')"
                        :comparison="batchRegistrationReview.comparison"
                        :label="batchRegistrationReview.title"
                        :no-changes-label="msg('registration.noChanges')"
                    />
                    <h4 class="kanade-wpvg-assessor-field-title">
                        {{ msg('dialog.listSummary') }}
                    </h4>
                    <p>{{ batchRegistrationReview.summary }}</p>
                </section>
            </div>
            <div
                v-if="saving"
                class="kanade-wpvg-assessor-batch-overlay"
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                <div class="kanade-wpvg-assessor-batch-progress">
                    <strong>{{ msg('dialog.batchSaving') }}</strong>
                    <cdx-progress-bar
                        :value="
                            batchProgress.total > 0
                                ? (batchProgress.completed /
                                      batchProgress.total) *
                                  100
                                : 0
                        "
                        :aria-label="msg('dialog.batchSaving')"
                    />
                    <p>
                        {{
                            msg('dialog.batchProgress', {
                                completed: batchProgress.completed,
                                total: batchProgress.total,
                            })
                        }}
                    </p>
                    <p>{{ batchProgressMessage }}</p>
                </div>
            </div>
        </div>
    </cdx-dialog>
    <cdx-message
        type="notice"
        :inline="false"
        v-if="open && minimized && !batchEditor"
        class="kanade-wpvg-assessor-mini"
        role="region"
        :aria-label="msg('dialog.miniMode')"
        :lang="interfaceLocale"
    >
        <div class="kanade-wpvg-assessor-mini__layout">
            <h2 class="kanade-wpvg-assessor-mini__title">
                {{ dialogTitle }}
            </h2>
            <div class="kanade-wpvg-assessor-mini__body">
                <div
                    class="kanade-wpvg-assessor-mini__state"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    <template v-if="saving && batchConfirmOpen">
                        <cdx-progress-bar
                            :value="
                                batchProgress.total > 0
                                    ? (batchProgress.completed /
                                          batchProgress.total) *
                                      100
                                    : 0
                            "
                            :aria-label="msg('dialog.batchSaving')"
                        />
                        <p>
                            {{
                                msg('dialog.batchProgress', {
                                    completed: batchProgress.completed,
                                    total: batchProgress.total,
                                })
                            }}
                        </p>
                        <p>{{ batchProgressMessage }}</p>
                    </template>
                    <p v-else>{{ miniAssessmentLabel }}</p>
                    <template v-if="preparing || (saving && !batchConfirmOpen)">
                        <cdx-progress-bar
                            :aria-label="status || msg('dialog.saving')"
                        />
                        <p v-if="saving">
                            {{ status || msg('dialog.saving') }}
                        </p>
                    </template>
                </div>
                <cdx-message
                    v-if="status && !saving"
                    class="kanade-wpvg-assessor-mini__message"
                    :type="statusType"
                >
                    {{ status }}
                </cdx-message>
                <div
                    v-if="!saving"
                    class="kanade-wpvg-assessor-mini__form"
                    :aria-busy="preparing"
                >
                    <cdx-field>
                        <template #label>{{ msg('dialog.class') }}</template>
                        <cdx-select
                            :selected="classSelection"
                            :menu-items="miniClassOptions"
                            :disabled="preparing"
                            @update:selected="selectClass"
                        />
                        <cdx-text-input
                            v-if="classSelection === ''"
                            :model-value="classInput"
                            :aria-label="msg('dialog.customClassValue')"
                            :disabled="preparing"
                            @update:model-value="setClassName"
                            @blur="commitClassName"
                        />
                    </cdx-field>
                    <cdx-field>
                        <template #label>{{
                            msg('dialog.importance')
                        }}</template>
                        <cdx-select
                            :selected="assessment.importance"
                            :menu-items="importanceOptions"
                            :disabled="preparing"
                            @update:selected="setImportance"
                        />
                    </cdx-field>
                    <cdx-field
                        v-for="group in miniSelectionGroups"
                        :key="group.name"
                        :is-fieldset="true"
                        :disabled="
                            preparing ||
                            (videoGamesDisabled && group.videoGamesOnly)
                        "
                    >
                        <template #label>{{ msg(group.label) }}</template>
                        <div class="kanade-wpvg-assessor-mini__choices">
                            <cdx-checkbox
                                v-for="option in group.options"
                                :key="option.id"
                                :model-value="
                                    miniSelectionChecked(group.name, option.id)
                                "
                                :disabled="
                                    preparing ||
                                    (videoGamesDisabled && group.videoGamesOnly)
                                "
                                :name="'mini-' + group.name + '-' + option.id"
                                @update:model-value="
                                    setSelection(group.name, option.id, $event)
                                "
                            >
                                {{ option.label }}
                            </cdx-checkbox>
                        </div>
                    </cdx-field>
                    <cdx-field v-if="registrationEligible">
                        <template #label>{{
                            msg('dialog.newPageList')
                        }}</template>
                        <cdx-checkbox
                            :model-value="shouldRegister"
                            :disabled="preparing || registrationDisabled"
                            name="mini-register"
                            @update:model-value="setRegister"
                        >
                            {{ registrationLabel }}
                        </cdx-checkbox>
                    </cdx-field>
                </div>
            </div>
            <div class="kanade-wpvg-assessor-mini__actions">
                <cdx-button
                    v-if="!saving"
                    class="kanade-wpvg-assessor-mini__submit"
                    action="progressive"
                    weight="primary"
                    :disabled="preparing"
                    @click="onMiniSave"
                >
                    {{ submitLabel }}
                </cdx-button>
                <cdx-toggle-switch
                    v-if="stagingAvailable"
                    class="kanade-wpvg-assessor-mini__stage-toggle"
                    :model-value="currentStaged"
                    :disabled="saving || preparing"
                    @update:model-value="onStage"
                >
                    {{ msg('dialog.stage') }}
                </cdx-toggle-switch>
                <cdx-button :disabled="saving" @click="onCancel">
                    {{ msg('dialog.cancel') }}
                </cdx-button>
                <cdx-button ref="miniExpandButton" @click="onExpand">
                    {{ msg('dialog.expand') }}
                </cdx-button>
            </div>
        </div>
    </cdx-message>
    <component v-if="batchEditor" :is="batchEditor" />
</template>
