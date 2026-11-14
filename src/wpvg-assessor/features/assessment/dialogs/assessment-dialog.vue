<template>
    <cdx-dialog
        v-if="!batchEditor"
        :open="open && !batchConfirmOpen && !minimized"
        class="kanade-wpvg-assessor-dialog"
        :title="dialogTitle"
        :lang="interfaceLocale"
        :close-button-label="msg('dialog.close')"
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
                <div class="kanade-wpvg-assessor-controls">
                    <section aria-labelledby="kanade-wpvg-assessor-class-title">
                        <h2
                            id="kanade-wpvg-assessor-class-title"
                            class="kanade-wpvg-assessor-section-title"
                            ref="assessmentHeading"
                            :tabindex="assessmentHeadingTabIndex"
                            @focus="onAssessmentHeadingFocus"
                        >
                            {{ msg('dialog.class') }}
                        </h2>
                        <cdx-field
                            class="kanade-wpvg-assessor-section"
                            :is-fieldset="true"
                            :hide-label="true"
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
                                    >{{ option.label }}</cdx-radio
                                >
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
                                        >{{
                                            msg('dialog.customClass')
                                        }}</cdx-radio
                                    >
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
                    </section>
                    <section
                        aria-labelledby="kanade-wpvg-assessor-projects-title"
                    >
                        <h2
                            id="kanade-wpvg-assessor-projects-title"
                            class="kanade-wpvg-assessor-section-title"
                        >
                            {{ msg('dialog.otherProjects') }}
                        </h2>
                        <cdx-field
                            class="kanade-wpvg-assessor-section"
                            :is-fieldset="true"
                            :hide-label="true"
                            :disabled="saving || preparing"
                        >
                            <template #label>{{
                                msg('dialog.otherProjects')
                            }}</template>
                            <div class="kanade-wpvg-assessor-check-list">
                                <cdx-checkbox
                                    :model-value="videoGamesSelected"
                                    :inline="true"
                                    :disabled="saving || preparing"
                                    name="videoGamesProject"
                                    @update:model-value="setVideoGamesSelected"
                                    >{{
                                        msg('summary.videoGames')
                                    }}</cdx-checkbox
                                >
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
                                    >{{ option.label }}</cdx-checkbox
                                >
                            </div>
                        </cdx-field>
                    </section>
                    <section
                        v-if="videoGamesSelected"
                        class="kanade-wpvg-assessor-video-games"
                        aria-labelledby="kanade-wpvg-assessor-video-games-title"
                    >
                        <h2
                            id="kanade-wpvg-assessor-video-games-title"
                            class="kanade-wpvg-assessor-section-title"
                        >
                            {{ msg('summary.videoGames') }}
                        </h2>
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
                                    >{{ option.label }}</cdx-radio
                                >
                            </div>
                        </cdx-field>
                        <cdx-field
                            class="kanade-wpvg-assessor-section"
                            :is-fieldset="true"
                            :disabled="saving || preparing"
                        >
                            <template #label>{{
                                msg('dialog.taskForces')
                            }}</template>
                            <div class="kanade-wpvg-assessor-check-list">
                                <cdx-checkbox
                                    v-for="option in taskForceOptions"
                                    :key="option.id"
                                    :model-value="
                                        assessment.taskForces[option.id]
                                    "
                                    :inline="true"
                                    :disabled="saving || preparing"
                                    :name="'taskForces-' + option.id"
                                    @update:model-value="
                                        setSelection(
                                            'taskForces',
                                            option.id,
                                            $event,
                                        )
                                    "
                                    >{{ option.label }}</cdx-checkbox
                                >
                            </div>
                        </cdx-field>
                        <cdx-field
                            class="kanade-wpvg-assessor-section"
                            :is-fieldset="true"
                            :disabled="saving || preparing"
                        >
                            <template #label>{{
                                msg('dialog.maintenance')
                            }}</template>
                            <div class="kanade-wpvg-assessor-check-list">
                                <cdx-checkbox
                                    v-for="option in maintenanceOptions"
                                    :key="option.id"
                                    :model-value="
                                        assessment.maintenance[option.id]
                                    "
                                    :inline="true"
                                    :disabled="saving || preparing"
                                    :name="'maintenance-' + option.id"
                                    @update:model-value="
                                        setSelection(
                                            'maintenance',
                                            option.id,
                                            $event,
                                        )
                                    "
                                    >{{ option.label }}</cdx-checkbox
                                >
                            </div>
                        </cdx-field>
                        <cdx-field
                            class="kanade-wpvg-assessor-registration"
                            :is-fieldset="true"
                            :disabled="saving || preparing"
                        >
                            <template #label>{{
                                msg('dialog.newPageList')
                            }}</template>
                            <cdx-message
                                v-if="registrationDisabled"
                                type="notice"
                                :inline="true"
                                >{{ registrationLabel }}</cdx-message
                            >
                            <cdx-checkbox
                                v-else
                                :model-value="shouldRegister"
                                :disabled="saving || preparing"
                                name="registerNewPage"
                                @update:model-value="setRegister"
                                >{{ registrationLabel }}</cdx-checkbox
                            >
                        </cdx-field>
                    </section>
                </div>
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
    <section
        v-if="open && minimized && !batchEditor"
        class="kanade-wpvg-assessor-mini"
        role="region"
        :aria-label="msg('dialog.miniMode')"
        :lang="interfaceLocale"
    >
        <div class="kanade-wpvg-assessor-mini__layout">
            <h1
                class="kanade-wpvg-assessor-mini__title"
                ref="miniHeading"
                tabindex="-1"
            >
                {{ dialogTitle }}
            </h1>
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
                    <section
                        aria-labelledby="kanade-wpvg-assessor-mini-class-title"
                    >
                        <h2
                            id="kanade-wpvg-assessor-mini-class-title"
                            class="kanade-wpvg-assessor-section-title"
                        >
                            {{ msg('dialog.class') }}
                        </h2>
                        <cdx-field
                            class="kanade-wpvg-assessor-section"
                            :is-fieldset="true"
                            :hide-label="true"
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
                                    name="mini-className"
                                    @update:model-value="selectClass"
                                    >{{ option.label }}</cdx-radio
                                >
                                <div
                                    class="kanade-wpvg-assessor-custom-class-row"
                                >
                                    <cdx-radio
                                        :model-value="classSelection"
                                        input-value=""
                                        :disabled="saving || preparing"
                                        :inline="true"
                                        name="mini-className"
                                        @update:model-value="selectClass"
                                        >{{
                                            msg('dialog.customClass')
                                        }}</cdx-radio
                                    >
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
                    </section>
                    <section
                        aria-labelledby="kanade-wpvg-assessor-mini-projects-title"
                    >
                        <h2
                            id="kanade-wpvg-assessor-mini-projects-title"
                            class="kanade-wpvg-assessor-section-title"
                        >
                            {{ msg('dialog.otherProjects') }}
                        </h2>
                        <cdx-field
                            class="kanade-wpvg-assessor-section"
                            :is-fieldset="true"
                            :hide-label="true"
                            :disabled="saving || preparing"
                        >
                            <template #label>{{
                                msg('dialog.otherProjects')
                            }}</template>
                            <div class="kanade-wpvg-assessor-check-list">
                                <cdx-checkbox
                                    :model-value="videoGamesSelected"
                                    :inline="true"
                                    :disabled="saving || preparing"
                                    name="mini-videoGamesProject"
                                    @update:model-value="setVideoGamesSelected"
                                    >{{
                                        msg('summary.videoGames')
                                    }}</cdx-checkbox
                                >
                                <cdx-checkbox
                                    v-for="option in otherProjectOptions"
                                    :key="option.id"
                                    :model-value="
                                        assessment.otherProjects[option.id]
                                    "
                                    :disabled="saving || preparing"
                                    :inline="true"
                                    :name="'mini-otherProject-' + option.id"
                                    @update:model-value="
                                        setSelection(
                                            'otherProjects',
                                            option.id,
                                            $event,
                                        )
                                    "
                                    >{{ option.label }}</cdx-checkbox
                                >
                            </div>
                        </cdx-field>
                    </section>
                    <section
                        v-if="videoGamesSelected"
                        class="kanade-wpvg-assessor-video-games"
                        aria-labelledby="kanade-wpvg-assessor-mini-video-games-title"
                    >
                        <h2
                            id="kanade-wpvg-assessor-mini-video-games-title"
                            class="kanade-wpvg-assessor-section-title"
                        >
                            {{ msg('summary.videoGames') }}
                        </h2>
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
                                    name="mini-importance"
                                    @update:model-value="setImportance"
                                    >{{ option.label }}</cdx-radio
                                >
                            </div>
                        </cdx-field>
                        <cdx-field
                            class="kanade-wpvg-assessor-section"
                            :is-fieldset="true"
                            :disabled="saving || preparing"
                        >
                            <template #label>{{
                                msg('dialog.taskForces')
                            }}</template>
                            <div class="kanade-wpvg-assessor-mini__choices">
                                <cdx-checkbox
                                    v-for="option in taskForceOptions"
                                    :key="option.id"
                                    :model-value="
                                        assessment.taskForces[option.id]
                                    "
                                    :inline="false"
                                    :disabled="saving || preparing"
                                    :name="'mini-taskForces-' + option.id"
                                    @update:model-value="
                                        setSelection(
                                            'taskForces',
                                            option.id,
                                            $event,
                                        )
                                    "
                                    >{{ option.label }}</cdx-checkbox
                                >
                            </div>
                        </cdx-field>
                        <cdx-field
                            class="kanade-wpvg-assessor-section"
                            :is-fieldset="true"
                            :disabled="saving || preparing"
                        >
                            <template #label>{{
                                msg('dialog.maintenance')
                            }}</template>
                            <div class="kanade-wpvg-assessor-mini__choices">
                                <cdx-checkbox
                                    v-for="option in maintenanceOptions"
                                    :key="option.id"
                                    :model-value="
                                        assessment.maintenance[option.id]
                                    "
                                    :inline="false"
                                    :disabled="saving || preparing"
                                    :name="'mini-maintenance-' + option.id"
                                    @update:model-value="
                                        setSelection(
                                            'maintenance',
                                            option.id,
                                            $event,
                                        )
                                    "
                                    >{{ option.label }}</cdx-checkbox
                                >
                            </div>
                        </cdx-field>
                        <cdx-field
                            class="kanade-wpvg-assessor-registration"
                            :is-fieldset="true"
                            :disabled="saving || preparing"
                        >
                            <template #label>{{
                                msg('dialog.newPageList')
                            }}</template>
                            <cdx-message
                                v-if="registrationDisabled"
                                type="notice"
                                :inline="true"
                                >{{ registrationLabel }}</cdx-message
                            >
                            <cdx-checkbox
                                v-else
                                :model-value="shouldRegister"
                                :disabled="saving || preparing"
                                name="mini-registerNewPage"
                                @update:model-value="setRegister"
                                >{{ registrationLabel }}</cdx-checkbox
                            >
                        </cdx-field>
                    </section>
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
                <cdx-button :disabled="saving || preparing" @click="onCancel">
                    {{ cancelLabel }}
                </cdx-button>
                <cdx-button ref="miniExpandButton" @click="onExpand">
                    {{ msg('dialog.expand') }}
                </cdx-button>
            </div>
        </div>
    </section>
    <component v-if="batchEditor" :is="batchEditor" />
</template>
