<!--
@file src/source-editor/features/formatter/dialog.vue
Purpose: src / features / formatter / dialog module.

Table of contents:
1. Template
-->

<template>
    <cdx-dialog
        v-model:open="open"
        :close-button-label="msg('dialog.cancel')"
        :lang="interfaceLocale"
        :title="msg('dialog.title')"
        :fixed-height="704"
        class="kanade-source-editor-dialog"
        use-close-button
        @update:open="onOpenChange"
    >
        <!-- Native notifications can be inert while the modal is open. -->
        <div
            class="kanade-source-editor-dialog__sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
        >
            <span v-if="announcement" :key="announcement.id">{{
                announcement.message
            }}</span>
        </div>
        <div
            ref="controls"
            class="kanade-source-editor-dialog__controls"
            :inert="applying || savingSettings"
            :aria-busy="applying || savingSettings"
        >
            <cdx-tabs
                v-model:active="activeTab"
                :framed="true"
                @update:active="onTabChange"
            >
                <cdx-tab
                    name="formatting"
                    :label="msg('dialog.formattingTab')"
                    :disabled="applying || savingSettings"
                >
                    <div class="kanade-source-editor-dialog__formatting-groups">
                        <cdx-field
                            :disabled="applying || savingSettings"
                            :is-fieldset="true"
                            class="kanade-source-editor-dialog__section"
                        >
                            <template #label>{{
                                msg('dialog.formattingOptions')
                            }}</template>
                            <cdx-checkbox v-model="formatHtmlTags">
                                {{ msg('dialog.formatHtmlTags') }}
                                <template #description>{{
                                    msg('dialog.formatHtmlTagsDescription')
                                }}</template>
                            </cdx-checkbox>
                            <cdx-checkbox
                                v-if="canNormalizeConversion"
                                v-model="normalizeConversion"
                            >
                                {{ msg('dialog.normalizeConversion') }}
                                <template #description>{{
                                    msg('dialog.normalizeConversionDescription')
                                }}</template>
                            </cdx-checkbox>
                        </cdx-field>
                        <cdx-field
                            :disabled="applying || savingSettings"
                            :is-fieldset="true"
                            class="kanade-source-editor-dialog__section"
                        >
                            <template #label>{{
                                msg('dialog.redirectScope')
                            }}</template>
                            <template #description
                                >{{ msg('dialog.redirectDescription')
                                }}<a
                                    :href="redirectPolicyUrl"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    >{{ msg('dialog.redirectPolicy') }}</a
                                >{{
                                    msg('dialog.redirectDescriptionEnd')
                                }}</template
                            >
                            <cdx-checkbox v-model="resolveRedirects">
                                {{ msg('dialog.resolveRedirects') }}
                            </cdx-checkbox>
                            <div
                                v-if="resolveRedirects"
                                class="kanade-source-editor-dialog__dependent"
                            >
                                <cdx-checkbox
                                    v-model="resolveTemplateRedirects"
                                >
                                    {{ msg('dialog.resolveTemplateRedirects') }}
                                </cdx-checkbox>
                            </div>
                        </cdx-field>
                        <cdx-field
                            :disabled="applying || savingSettings"
                            :is-fieldset="true"
                            class="kanade-source-editor-dialog__section kanade-source-editor-dialog__wide-group"
                        >
                            <template #label>{{
                                msg('dialog.referenceFormatting')
                            }}</template>
                            <cdx-checkbox v-model="formatReferences">
                                {{ msg('dialog.formatReferences') }}
                                <template #description>{{
                                    msg('dialog.formatReferencesDescription')
                                }}</template>
                            </cdx-checkbox>
                            <div class="kanade-source-editor-dialog__columns">
                                <cdx-field
                                    :is-fieldset="true"
                                    :disabled="
                                        !formatReferences ||
                                        applying ||
                                        savingSettings
                                    "
                                >
                                    <template #label>{{
                                        msg('dialog.referenceLayout')
                                    }}</template>
                                    <cdx-radio
                                        v-model="referenceLayout"
                                        input-value="inline"
                                        name="kanade-source-editor-reference-layout"
                                    >
                                        {{ msg('dialog.inlineReferences') }}
                                    </cdx-radio>
                                    <cdx-radio
                                        v-model="referenceLayout"
                                        input-value="block"
                                        name="kanade-source-editor-reference-layout"
                                    >
                                        {{ msg('dialog.blockReferences') }}
                                    </cdx-radio>
                                    <cdx-checkbox v-model="compactReferences">
                                        {{ msg('tools.compactReferences') }}
                                    </cdx-checkbox>
                                    <cdx-checkbox v-model="convertAuthorNames">
                                        {{ msg('dialog.convertAuthorNames') }}
                                        <template #description>{{
                                            msg(
                                                'dialog.convertAuthorNamesDescription',
                                            )
                                        }}</template>
                                    </cdx-checkbox>
                                    <cdx-checkbox
                                        v-model="separateReferenceDefinitions"
                                    >
                                        {{
                                            msg(
                                                'tools.separateReferenceDefinitions',
                                            )
                                        }}
                                    </cdx-checkbox>
                                </cdx-field>
                                <cdx-field
                                    :is-fieldset="true"
                                    :disabled="
                                        !formatReferences ||
                                        applying ||
                                        savingSettings
                                    "
                                >
                                    <template #label>{{
                                        msg('tools.scriptTitle')
                                    }}</template>
                                    <cdx-checkbox v-model="formatScriptTitles">
                                        {{ msg('tools.formatScriptTitles') }}
                                    </cdx-checkbox>
                                    <cdx-radio
                                        v-model="scriptTitleMode"
                                        :disabled="!formatScriptTitles"
                                        input-value="non-latin"
                                        name="kanade-source-editor-script-title-mode"
                                    >
                                        {{ msg('tools.scriptTitleNonLatin') }}
                                        <template #description>{{
                                            msg('tools.scriptTitleLanguages', {
                                                languages:
                                                    scriptTitleExampleLanguages(
                                                        'non-latin',
                                                    ),
                                            })
                                        }}</template>
                                    </cdx-radio>
                                    <cdx-radio
                                        v-model="scriptTitleMode"
                                        :disabled="!formatScriptTitles"
                                        input-value="all-foreign"
                                        name="kanade-source-editor-script-title-mode"
                                    >
                                        {{ msg('tools.scriptTitleAllForeign') }}
                                        <template #description>{{
                                            msg('tools.scriptTitleLanguages', {
                                                languages:
                                                    scriptTitleExampleLanguages(
                                                        'all-foreign',
                                                    ),
                                            })
                                        }}</template>
                                    </cdx-radio>
                                    <cdx-radio
                                        v-model="scriptTitleMode"
                                        :disabled="!formatScriptTitles"
                                        input-value="always"
                                        name="kanade-source-editor-script-title-mode"
                                    >
                                        {{ msg('tools.scriptTitleAlways') }}
                                        <template #description>{{
                                            msg('tools.scriptTitleLanguages', {
                                                languages:
                                                    scriptTitleExampleLanguages(
                                                        'always',
                                                    ),
                                            })
                                        }}</template>
                                    </cdx-radio>
                                </cdx-field>
                            </div>
                        </cdx-field>
                        <cdx-field
                            :disabled="applying || savingSettings"
                            :is-fieldset="true"
                            class="kanade-source-editor-dialog__section kanade-source-editor-dialog__wide-group"
                        >
                            <template #label>
                                {{ msg('dialog.templateLayout') }}
                            </template>
                            <template #description>
                                {{ msg('dialog.templatesDescription') }}
                            </template>
                            <div class="kanade-source-editor-dialog__section">
                                <cdx-checkbox v-model="indentBlockTemplates">
                                    {{ msg('dialog.indentBlockTemplates') }}
                                </cdx-checkbox>
                                <div
                                    class="kanade-source-editor-dialog__dependent"
                                >
                                    <cdx-field
                                        class="kanade-source-editor-dialog__indentation-width"
                                        :disabled="
                                            !indentBlockTemplates ||
                                            applying ||
                                            savingSettings
                                        "
                                    >
                                        <template #label>{{
                                            msg('dialog.indentSpaces')
                                        }}</template>
                                        <cdx-text-input
                                            v-model="indentSpaces"
                                            input-type="number"
                                            min="0"
                                            step="1"
                                            :disabled="
                                                !indentBlockTemplates ||
                                                applying ||
                                                savingSettings
                                            "
                                            @blur="onIndentSpacesBlur"
                                        />
                                    </cdx-field>
                                    <cdx-checkbox
                                        v-model="skipFirstLevelIndentation"
                                        :disabled="!indentBlockTemplates"
                                    >
                                        {{
                                            msg(
                                                'dialog.skipFirstLevelIndentation',
                                            )
                                        }}
                                    </cdx-checkbox>
                                </div>
                            </div>
                            <div
                                class="kanade-source-editor-dialog__columns kanade-source-editor-dialog__section"
                            >
                                <cdx-field
                                    :disabled="applying || savingSettings"
                                    :is-fieldset="true"
                                >
                                    <template #label>{{
                                        msg('dialog.firstParameterGroup')
                                    }}</template>
                                    <cdx-radio
                                        :model-value="firstParameterMode"
                                        input-value="preserve"
                                        name="first-parameter-layout"
                                        @update:model-value="
                                            updateFirstParameterMode
                                        "
                                    >
                                        {{ msg('dialog.preserve') }}
                                    </cdx-radio>
                                    <cdx-radio
                                        :model-value="firstParameterMode"
                                        input-value="align-values"
                                        name="first-parameter-layout"
                                        @update:model-value="
                                            updateFirstParameterMode
                                        "
                                    >
                                        {{ msg('dialog.alignValues') }}
                                    </cdx-radio>
                                    <cdx-radio
                                        :model-value="firstParameterMode"
                                        input-value="compact"
                                        name="first-parameter-layout"
                                        @update:model-value="
                                            updateFirstParameterMode
                                        "
                                    >
                                        {{ msg('dialog.compact') }}
                                    </cdx-radio>
                                </cdx-field>
                                <cdx-field
                                    :disabled="applying || savingSettings"
                                    :is-fieldset="true"
                                >
                                    <template #label>{{
                                        msg('dialog.subsequentParameterGroup')
                                    }}</template>
                                    <cdx-radio
                                        :model-value="subsequentParameterMode"
                                        input-value="preserve"
                                        name="subsequent-parameter-layout"
                                        @update:model-value="
                                            updateSubsequentParameterMode
                                        "
                                    >
                                        {{ msg('dialog.preserve') }}
                                    </cdx-radio>
                                    <cdx-radio
                                        :model-value="subsequentParameterMode"
                                        input-value="align-names"
                                        name="subsequent-parameter-layout"
                                        @update:model-value="
                                            updateSubsequentParameterMode
                                        "
                                    >
                                        {{ msg('dialog.alignNames') }}
                                    </cdx-radio>
                                    <cdx-radio
                                        :model-value="subsequentParameterMode"
                                        input-value="align-names-and-values"
                                        name="subsequent-parameter-layout"
                                        @update:model-value="
                                            updateSubsequentParameterMode
                                        "
                                    >
                                        {{ msg('dialog.alignNamesAndValues') }}
                                    </cdx-radio>
                                    <cdx-radio
                                        :model-value="subsequentParameterMode"
                                        input-value="compact"
                                        name="subsequent-parameter-layout"
                                        @update:model-value="
                                            updateSubsequentParameterMode
                                        "
                                    >
                                        {{ msg('dialog.compact') }}
                                    </cdx-radio>
                                </cdx-field>
                            </div>
                            <cdx-field
                                :disabled="applying || savingSettings"
                                v-if="hasAlignment()"
                                :is-fieldset="true"
                                class="kanade-source-editor-dialog__section"
                            >
                                <template #label>{{
                                    msg('dialog.characterWidth')
                                }}</template>
                                <template #description>{{
                                    msg('dialog.characterWidthDescription')
                                }}</template>
                                <cdx-radio
                                    v-model="characterWidthRatio"
                                    input-value="5:3"
                                    name="character-width-ratio"
                                    inline
                                >
                                    {{
                                        msg('dialog.characterWidthThreeToFive')
                                    }}
                                </cdx-radio>
                                <cdx-radio
                                    v-model="characterWidthRatio"
                                    input-value="2:1"
                                    name="character-width-ratio"
                                    inline
                                >
                                    {{ msg('dialog.characterWidthOneToTwo') }}
                                </cdx-radio>
                            </cdx-field>
                            <figure
                                class="kanade-source-editor-dialog__example kanade-source-editor-dialog__section"
                            >
                                <figcaption>
                                    <strong>{{ msg('dialog.example') }}</strong>
                                </figcaption>
                                <pre
                                    dir="ltr"
                                    tabindex="0"
                                    :aria-label="msg('dialog.example')"
                                ><code>{{ templatePreview() }}</code></pre>
                            </figure>
                        </cdx-field>
                    </div>
                </cdx-tab>
                <cdx-tab
                    name="references"
                    :label="msg('dialog.referencesTab')"
                    :disabled="applying || savingSettings"
                >
                    <p class="kanade-source-editor-dialog__intro">
                        {{ msg('dialog.referencesDescription') }}
                    </p>
                    <cdx-button
                        v-if="referencesAvailable"
                        type="button"
                        @click="openReferences"
                    >
                        {{ msg('dialog.manageReferences') }}
                    </cdx-button>
                </cdx-tab>
            </cdx-tabs>
        </div>
        <template #footer>
            <div
                v-if="error || applying || savingSettings"
                class="kanade-source-editor-dialog__feedback"
            >
                <cdx-message v-if="error" type="error">{{ error }}</cdx-message>
                <div
                    v-if="applying || savingSettings"
                    role="status"
                    class="kanade-source-editor-dialog__progress"
                >
                    <span>{{
                        msg(savingSettings ? 'dialog.saving' : 'dialog.working')
                    }}</span>
                    <cdx-progress-bar
                        :aria-label="
                            msg(
                                savingSettings
                                    ? 'dialog.saving'
                                    : 'dialog.working',
                            )
                        "
                    />
                </div>
            </div>
            <div class="kanade-source-editor-dialog__footer-bar">
                <cdx-menu-button
                    v-if="!stackedActions"
                    v-model:selected="menuSelection"
                    :menu-items="menuItems"
                    :aria-label="msg('dialog.moreOptions')"
                    :disabled="applying || savingSettings"
                    class="kanade-source-editor-dialog__more"
                    weight="quiet"
                    @update:selected="onMenuAction"
                    >{{ msg('dialog.more') }}</cdx-menu-button
                >
                <div class="kanade-source-editor-dialog__actions">
                    <template v-for="action in actionOrder()" :key="action">
                        <cdx-menu-button
                            v-if="action === 'more'"
                            v-model:selected="menuSelection"
                            :menu-items="menuItems"
                            :aria-label="msg('dialog.moreOptions')"
                            :disabled="applying || savingSettings"
                            class="kanade-source-editor-dialog__more"
                            weight="quiet"
                            @update:selected="onMenuAction"
                            >{{ msg('dialog.more') }}</cdx-menu-button
                        >
                        <cdx-button
                            v-else
                            :class="
                                action === 'primary'
                                    ? 'kanade-source-editor-dialog__primary'
                                    : action === 'save'
                                      ? 'kanade-source-editor-dialog__save'
                                      : 'kanade-source-editor-dialog__cancel'
                            "
                            type="button"
                            :action="
                                action === 'primary' ? 'progressive' : 'default'
                            "
                            :weight="
                                action === 'primary'
                                    ? 'primary'
                                    : action === 'save'
                                      ? 'normal'
                                      : 'quiet'
                            "
                            :disabled="applying || savingSettings"
                            @click="
                                action === 'primary'
                                    ? apply()
                                    : action === 'save'
                                      ? saveSettings()
                                      : onClose()
                            "
                        >
                            {{
                                action === 'primary'
                                    ? primaryLabel()
                                    : msg(
                                          action === 'save'
                                              ? 'dialog.saveSettings'
                                              : 'dialog.cancel',
                                      )
                            }}
                        </cdx-button>
                    </template>
                </div>
            </div>
        </template>
    </cdx-dialog>
</template>
