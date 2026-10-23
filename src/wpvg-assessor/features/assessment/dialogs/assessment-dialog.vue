<!--
@file src/wpvg-assessor/features/assessment/dialogs/assessment-dialog.vue
Purpose: src / features / assessment / dialogs / assessment dialog module.

Table of contents:
1. Template
-->

<template>
    <cdx-dialog
        v-model:open="open"
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

            <section
                v-if="stagedTalkReviews.length"
                class="kanade-wpvg-assessor-staged-reviews"
                aria-labelledby="kanade-wpvg-assessor-staged-title"
            >
                <h2
                    id="kanade-wpvg-assessor-staged-title"
                    class="kanade-wpvg-assessor-section-title"
                >
                    {{ msg('dialog.stagedTalkChanges') }}
                </h2>
                <details
                    v-for="review in stagedTalkReviews"
                    :key="review.talkTitle"
                    class="kanade-wpvg-assessor-staged-review"
                >
                    <summary>{{ review.title }} — {{ review.summary }}</summary>
                    <cdx-field class="kanade-wpvg-assessor-section">
                        <template #label>{{
                            msg('dialog.readySource')
                        }}</template>
                        <pre class="kanade-wpvg-assessor-staged-source">{{
                            review.previewText
                        }}</pre>
                    </cdx-field>
                    <div class="kanade-wpvg-assessor-section">
                        <h4 class="kanade-wpvg-assessor-field-title">
                            {{ msg('dialog.leadDiff') }}
                        </h4>
                        <wikitext-comparison
                            :after-label="msg('dialog.afterSave')"
                            :before-label="msg('dialog.currentSource')"
                            :comparison="review.comparison"
                            :label="msg('dialog.leadDiff')"
                            :no-changes-label="msg('registration.noChanges')"
                        />
                    </div>
                    <div class="kanade-wpvg-assessor-section">
                        <h4 class="kanade-wpvg-assessor-field-title">
                            {{ msg('dialog.talkSummary') }}
                        </h4>
                        <p class="kanade-wpvg-assessor-staged-summary">
                            {{ review.summary }}
                        </p>
                    </div>
                </details>
            </section>
        </div>
    </cdx-dialog>
</template>
