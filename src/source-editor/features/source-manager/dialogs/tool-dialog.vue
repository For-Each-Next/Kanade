<!--
@file src/source-editor/features/source-manager/dialogs/tool-dialog.vue
Purpose: src / features / source manager / dialogs / tool dialog module.

Table of contents:
1. Template
-->

<template>
    <cdx-dialog
        v-model:open="toolPopupOpen"
        class="kanade-source-editor-source-manager__tool-dialog"
        :title="
            toolPopup === 'analysis'
                ? msg('analysis.title')
                : toolPopup === 'cs1'
                  ? msg('checker.cs1Title')
                  : msg('checker.nonCs1Title')
        "
        :lang="interfaceLocale"
        :fixed-height="704"
        :close-button-label="msg('common.close')"
        use-close-button
        @update:open="onToolPopupOpenChange"
    >
        <div class="kanade-source-editor-source-manager__dialog-body-content">
            <template v-if="toolPopup === 'analysis'">
                <p
                    class="kanade-source-editor-source-analysis__intro"
                    tabindex="0"
                >
                    {{ msg('analysis.intro') }}
                </p>
                <cdx-tabs
                    v-model:active="activeAnalysisTab"
                    class="kanade-source-editor-source-analysis__tabs"
                    :framed="true"
                >
                    <cdx-tab
                        v-for="tab in analysisTabs"
                        :key="tab.name"
                        :name="tab.name"
                        :label="tab.label"
                    >
                        <cdx-message
                            v-if="
                                tab.findings.length === 0 &&
                                tab.appliedFindings.length === 0
                            "
                            type="success"
                        >
                            {{ msg('analysis.none') }}
                        </cdx-message>
                        <div
                            v-else
                            class="kanade-source-editor-source-analysis__findings"
                        >
                            <div
                                v-for="finding in tab.findings"
                                :key="finding.id"
                                class="kanade-source-editor-source-analysis__finding"
                                :style="{ order: finding.displayOrder }"
                            >
                                <header
                                    class="kanade-source-editor-source-analysis__finding-heading"
                                >
                                    <h4>{{ finding.title }}</h4>
                                    <p>{{ finding.description }}</p>
                                </header>
                                <cdx-field
                                    class="kanade-source-editor-source-analysis__value-options"
                                    :is-fieldset="true"
                                >
                                    <template #label>
                                        {{
                                            finding.category === 'alias'
                                                ? msg('analysis.aliasField')
                                                : msg('analysis.valueField')
                                        }}
                                    </template>
                                    <div
                                        class="kanade-source-editor-source-analysis__radio-options"
                                    >
                                        <cdx-radio
                                            v-for="option in finding.options"
                                            :key="option.value"
                                            v-model="finding.replacementChoice"
                                            :name="
                                                'analysis-value-' + finding.id
                                            "
                                            :input-value="option.value"
                                            :inline="true"
                                            @update:model-value="
                                                selectAllAnalysisOccurrences(
                                                    finding,
                                                )
                                            "
                                        >
                                            <bdi>
                                                {{
                                                    option.value ||
                                                    msg('analysis.emptyValue')
                                                }}
                                            </bdi>
                                        </cdx-radio>
                                        <div
                                            class="kanade-source-editor-source-analysis__custom-option"
                                        >
                                            <cdx-radio
                                                v-model="
                                                    finding.replacementChoice
                                                "
                                                :name="
                                                    'analysis-value-' +
                                                    finding.id
                                                "
                                                :input-value="
                                                    customAnalysisReplacement
                                                "
                                                :inline="true"
                                                @update:model-value="
                                                    selectAllAnalysisOccurrences(
                                                        finding,
                                                    )
                                                "
                                            >
                                                {{
                                                    msg('analysis.customValue')
                                                }}
                                            </cdx-radio>
                                            <cdx-text-input
                                                v-model="
                                                    finding.customReplacement
                                                "
                                                :disabled="
                                                    finding.replacementChoice !==
                                                    customAnalysisReplacement
                                                "
                                                :aria-label="
                                                    msg('analysis.customValue')
                                                "
                                            />
                                        </div>
                                    </div>
                                </cdx-field>
                                <ul
                                    class="kanade-source-editor-source-analysis__occurrences"
                                >
                                    <li
                                        v-for="occurrence in finding.occurrences"
                                        :key="occurrence.id"
                                    >
                                        <cdx-checkbox
                                            v-model="occurrence.selected"
                                            :disabled="
                                                isAnalysisOccurrenceUnchanged(
                                                    finding,
                                                    occurrence,
                                                )
                                            "
                                        >
                                            <span
                                                class="kanade-source-editor-source-analysis__occurrence-heading"
                                            >
                                                <strong>
                                                    {{
                                                        occurrence.referenceName ||
                                                        msg(
                                                            'common.unnamedReference',
                                                        )
                                                    }}
                                                </strong>
                                                <code
                                                    >|{{
                                                        occurrence.parameter
                                                    }}=</code
                                                >
                                                <code>{{
                                                    occurrence.displayValue
                                                }}</code>
                                                <code
                                                    v-if="
                                                        occurrence.cell ===
                                                        'alias'
                                                    "
                                                >
                                                    {{ occurrence.value ? '<!-- # ' +
                                            occurrence.value +
                                            ' -->' : msg( 'analysis.noHashAlias'
                                                    ) }}
                                                </code>
                                            </span>
                                            <small>
                                                {{ occurrence.template }} ·
                                                {{ occurrence.title }}
                                            </small>
                                        </cdx-checkbox>
                                    </li>
                                </ul>
                                <div
                                    class="kanade-source-editor-source-analysis__selection-actions"
                                >
                                    <template
                                        v-for="dialogAction in getDialogActionOrder(
                                            ['select', 'clear', 'apply'],
                                        )"
                                        :key="dialogAction"
                                    >
                                        <cdx-button
                                            v-if="dialogAction === 'select'"
                                            type="button"
                                            weight="quiet"
                                            @click="
                                                selectAllAnalysisOccurrences(
                                                    finding,
                                                )
                                            "
                                        >
                                            {{ msg('analysis.selectAll') }}
                                        </cdx-button>
                                        <cdx-button
                                            v-if="dialogAction === 'clear'"
                                            type="button"
                                            weight="quiet"
                                            @click="
                                                clearAnalysisSelection(finding)
                                            "
                                        >
                                            {{ msg('common.clear') }}
                                        </cdx-button>
                                        <cdx-button
                                            v-if="dialogAction === 'apply'"
                                            action="progressive"
                                            weight="primary"
                                            type="button"
                                            :disabled="
                                                countSelectedFindingReplacements(
                                                    finding,
                                                ) === 0
                                            "
                                            @click="
                                                applyAnalysisFinding(finding)
                                            "
                                        >
                                            {{ msg('analysis.applyCase') }}
                                        </cdx-button>
                                    </template>
                                </div>
                            </div>
                            <div
                                v-for="applied in tab.appliedFindings"
                                :key="applied.changeId"
                                class="kanade-source-editor-source-analysis__finding kanade-source-editor-source-analysis__finding--changed"
                                :style="{
                                    order: applied.finding.displayOrder,
                                }"
                            >
                                <header
                                    class="kanade-source-editor-source-analysis__finding-heading"
                                >
                                    <h4>{{ applied.finding.title }}</h4>
                                    <p>{{ applied.finding.description }}</p>
                                </header>
                                <div
                                    class="kanade-source-editor-source-analysis__changed-row"
                                >
                                    <span>
                                        <strong>{{
                                            msg('analysis.changed')
                                        }}</strong>
                                        <code>
                                            {{
                                                getAnalysisReplacement(
                                                    applied.finding,
                                                )
                                            }}
                                        </code>
                                    </span>
                                    <cdx-button
                                        type="button"
                                        @click="
                                            revertAppliedAnalysisFinding(
                                                applied.changeId,
                                            )
                                        "
                                    >
                                        {{ msg('analysis.revert') }}
                                    </cdx-button>
                                </div>
                                <ul
                                    class="kanade-source-editor-source-analysis__occurrences"
                                >
                                    <li
                                        v-for="occurrence in applied.finding
                                            .occurrences"
                                        v-show="occurrence.selected"
                                        :key="occurrence.id"
                                    >
                                        <span
                                            class="kanade-source-editor-source-analysis__occurrence-heading"
                                        >
                                            <strong>
                                                {{
                                                    occurrence.referenceName ||
                                                    msg(
                                                        'common.unnamedReference',
                                                    )
                                                }}
                                            </strong>
                                            <code
                                                >|{{
                                                    occurrence.parameter
                                                }}=</code
                                            >
                                            <code>{{
                                                occurrence.displayValue
                                            }}</code>
                                        </span>
                                        <small>
                                            {{ occurrence.template }} ·
                                            {{ occurrence.title }}
                                        </small>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </cdx-tab>
                </cdx-tabs>
            </template>
            <template v-else-if="toolPopup === 'cs1'">
                <p>
                    {{ msg('checker.cs1Description', { wiki: cs1WikiLabel }) }}
                </p>
                <cdx-progress-bar
                    v-if="cs1ToolStatus === 'checking'"
                    :aria-label="msg('checker.checking')"
                />
                <div
                    v-else-if="cs1ToolStatus === 'unavailable'"
                    class="kanade-source-editor-source-manager__cs1-message-frame"
                >
                    <cdx-message type="error">
                        {{ msg('checker.unavailable') }}
                    </cdx-message>
                </div>
                <div
                    v-else-if="
                        cs1ToolStatus === 'complete' &&
                        cs1ToolMessages.length === 0 &&
                        cs1ToolSources.length === 0
                    "
                    class="kanade-source-editor-source-manager__cs1-message-frame"
                >
                    <cdx-message type="success">
                        {{ msg('checker.noIssues') }}
                    </cdx-message>
                </div>
                <div
                    v-if="
                        cs1ToolStatus === 'complete' &&
                        cs1ToolMessages.length > 0
                    "
                    class="kanade-source-editor-source-manager__cs1-message-frame"
                >
                    <cdx-message type="warning">
                        <ul>
                            <li
                                v-for="message in cs1ToolMessages"
                                :key="message"
                            >
                                {{ message }}
                            </li>
                        </ul>
                    </cdx-message>
                </div>
                <ol
                    v-if="
                        cs1ToolStatus === 'complete' &&
                        cs1ToolSources.length > 0
                    "
                    class="kanade-source-editor-source-manager__existing-list"
                >
                    <li
                        v-for="result in cs1ToolSources"
                        :key="result.source.id"
                        class="kanade-source-editor-source-manager__existing-row"
                        :class="{
                            'kanade-source-editor-source-manager__existing-row--error':
                                result.severity === 'error',
                            'kanade-source-editor-source-manager__existing-row--maintenance':
                                result.severity === 'maintenance',
                        }"
                    >
                        <div
                            class="kanade-source-editor-source-manager__existing-summary"
                        >
                            <small
                                class="kanade-source-editor-source-manager__existing-name"
                                :title="
                                    result.source.referenceName ||
                                    msg('common.unnamed')
                                "
                            >
                                ({{
                                    result.source.referenceName ||
                                    msg('common.unnamed')
                                }})
                            </small>
                            <span
                                class="kanade-source-editor-source-manager__existing-title"
                                :title="
                                    result.source.title ||
                                    result.source.url ||
                                    msg('common.untitledSource')
                                "
                            >
                                {{
                                    result.source.title ||
                                    result.source.url ||
                                    msg('common.untitledSource')
                                }}
                            </span>
                            <small
                                class="kanade-source-editor-source-manager__existing-meta"
                                :title="result.messages.join(' · ')"
                            >
                                <code>
                                    {{
                                        sourceTemplateLabel(
                                            result.source.draft.template,
                                        )
                                    }}
                                </code>
                                · {{ result.messages.join(' · ') }}
                            </small>
                        </div>
                        <div
                            class="kanade-source-editor-source-manager__source-actions"
                        >
                            <cdx-button
                                :title="msg('lookup.editSource')"
                                weight="quiet"
                                type="button"
                                :aria-label="msg('lookup.editSource')"
                                @click="reviewCs1Source(result.source.id)"
                            >
                                <cdx-icon :icon="editSourceIcon" />
                            </cdx-button>
                        </div>
                    </li>
                </ol>
            </template>
            <template v-else-if="toolPopup === 'non-cs1'">
                <p>{{ msg('checker.nonCs1Description') }}</p>
                <cdx-message v-if="nonCs1Sources.length === 0" type="success">
                    {{ msg('checker.noNonCs1') }}
                </cdx-message>
                <ol
                    v-else
                    class="kanade-source-editor-source-manager__existing-list"
                >
                    <li
                        v-for="source in nonCs1Sources"
                        :key="source.id"
                        class="kanade-source-editor-source-manager__existing-row kanade-source-editor-source-manager__existing-row--non-standard"
                    >
                        <div
                            class="kanade-source-editor-source-manager__existing-summary"
                        >
                            <small
                                class="kanade-source-editor-source-manager__existing-name"
                                :title="
                                    source.referenceName ||
                                    msg('common.unnamed')
                                "
                            >
                                ({{
                                    source.referenceName ||
                                    msg('common.unnamed')
                                }})
                            </small>
                            <span
                                class="kanade-source-editor-source-manager__existing-title"
                                :title="
                                    source.title ||
                                    source.referenceName ||
                                    msg('common.unnamedReference')
                                "
                            >
                                {{
                                    source.title ||
                                    source.referenceName ||
                                    msg('common.unnamedReference')
                                }}
                            </span>
                            <small
                                class="kanade-source-editor-source-manager__existing-meta"
                                :title="
                                    msg('checker.nonCs1Source') +
                                    ' · ' +
                                    formatSourceUsageTitle(source)
                                "
                            >
                                <code>{{ msg('checker.nonCs1Source') }}</code>
                                ·
                                <span :title="formatSourceUsageTitle(source)">
                                    {{ source.usageCount }}×
                                </span>
                            </small>
                        </div>
                        <div
                            class="kanade-source-editor-source-manager__source-actions"
                        >
                            <cdx-button
                                :title="msg('checker.convertSource')"
                                weight="quiet"
                                type="button"
                                :aria-label="msg('checker.convertSource')"
                                @click="reviewNonCs1Source(source.id)"
                            >
                                <cdx-icon :icon="editSourceIcon" />
                            </cdx-button>
                        </div>
                    </li>
                </ol>
            </template>
        </div>
        <template #footer>
            <div class="kanade-source-editor-source-manager__footer-actions">
                <template
                    v-for="dialogAction in getDialogActionOrder([
                        'close',
                        'primary',
                    ])"
                    :key="dialogAction"
                >
                    <cdx-button
                        v-if="dialogAction === 'close'"
                        type="button"
                        @click="closeToolPopup"
                        >{{ msg('common.close') }}</cdx-button
                    >
                    <cdx-button
                        v-if="
                            dialogAction === 'primary' &&
                            toolPopup !== 'non-cs1'
                        "
                        action="progressive"
                        weight="primary"
                        type="button"
                        :disabled="
                            toolPopup === 'analysis'
                                ? countSelectedAnalysisReplacements() === 0
                                : cs1ToolStatus === 'checking'
                        "
                        @click="
                            toolPopup === 'analysis'
                                ? applyAnalysisReplacements()
                                : recheckCs1Tool()
                        "
                        >{{
                            toolPopup === 'analysis'
                                ? msg('analysis.applySelected')
                                : msg('checker.recheckArticle')
                        }}</cdx-button
                    >
                </template>
            </div>
        </template>
    </cdx-dialog>
</template>
