/**
 * @file src/source-editor/features/formatter/dialog.ts
 * Purpose: Build-injected Codex formatter-dialog component.
 *
 * Table of contents:
 * 1. Imports
 * 2. FormatterDialogSelection
 * 3. FirstParameterMode
 * 4. FormatterDialogOperation
 * 5. SubsequentParameterMode
 * 6. DialogTab
 * 7. FormattingScope
 * 8. FormatterDialogOptions
 * 9. PreferenceSettings
 * 10. PreferenceBindings
 * 11. DialogBindings
 * 12. Constants and state
 * 13. createFormatterDialogComponent
 * 14. createFormatterDialogBindings
 * 15. normalizeIndentation
 */

import {
    type CharacterWidthRatio,
    type FirstParameterLayout,
    type SubsequentParameterLayout,
    formatWikitext,
} from '../../domain/formatter.ts';
import {
    createDefaultFormatterSettings,
    type FormatterSettings,
} from '../../domain/formatter-settings.ts';
import { interfaceLocale, msg } from '../../i18n/index.ts';
import {
    getScriptTitleExampleLanguages,
    type ScriptTitleMode,
} from '../../domain/script-title-policy.ts';
import type { VueModule, VueRef } from './codex.ts';

export interface FormatterDialogSelection extends FormatterSettings {
    references?: { layout: 'inline' | 'block' };
}

type FirstParameterMode = FirstParameterLayout | 'preserve';
type FormatterDialogOperation = 'format' | 'save-settings' | 'reset-settings';
type SubsequentParameterMode = SubsequentParameterLayout | 'preserve';
export type FormatterDialogTab = 'formatting' | 'references';
type FormattingScope = 'selection' | 'section' | 'page';

export interface FormatterDialogOptions {
    initialTab?: FormatterDialogTab;
    canNormalizeConversion: boolean;
    initialSelection: FormatterDialogSelection;
    redirectPolicyUrl: string;
    scope: FormattingScope;
    contentLanguage?: string;

    onClose(selection?: FormatterDialogSelection): void;

    onError(error: unknown, operation: FormatterDialogOperation): void;

    onReset(): void;

    onSave(selection: FormatterDialogSelection): Promise<void> | void;

    onSubmit(selection: FormatterDialogSelection): Promise<void>;

    onOpenReferences?(selection: FormatterDialogSelection): Promise<void>;
}

type PreferenceSettings = Omit<
    FormatterSettings,
    'formatter' | 'citationFormatting'
>;
type PreferenceBindings = {
    [Key in keyof PreferenceSettings]: VueRef<PreferenceSettings[Key]>;
};

interface DialogBindings extends PreferenceBindings {
    formatReferences: VueRef<boolean>;
    referenceLayout: VueRef<'inline' | 'block'>;
    compactReferences: VueRef<boolean>;
    convertAuthorNames: VueRef<boolean>;
    separateReferenceDefinitions: VueRef<boolean>;
    formatScriptTitles: VueRef<boolean>;
    scriptTitleMode: VueRef<ScriptTitleMode>;
    scriptTitleExampleLanguages(mode: ScriptTitleMode): string;
    referencesAvailable: boolean;
    openReferences(): Promise<void>;
    activeTab: VueRef<FormatterDialogTab>;
    announcement: VueRef<{ id: number; message: string } | null>;
    applying: VueRef<boolean>;
    controls: VueRef<HTMLElement | null>;
    canNormalizeConversion: boolean;
    characterWidthRatio: VueRef<CharacterWidthRatio>;
    error: VueRef<string>;
    firstParameterMode: VueRef<FirstParameterMode>;
    formatHtmlTags: VueRef<boolean>;
    indentBlockTemplates: VueRef<boolean>;
    indentSpaces: VueRef<string | number>;
    interfaceLocale: string;
    msg: typeof msg;
    menuItems: Array<{
        label: string;
        value: string;
    }>;
    menuSelection: VueRef<string | number | null>;
    normalizeConversion: VueRef<boolean>;
    open: VueRef<boolean>;
    redirectPolicyUrl: string;
    savingSettings: VueRef<boolean>;
    stackedActions: VueRef<boolean>;
    skipFirstLevelIndentation: VueRef<boolean>;
    subsequentParameterMode: VueRef<SubsequentParameterMode>;

    apply(): Promise<void>;

    actionOrder(): Array<'cancel' | 'save' | 'primary' | 'more'>;

    onMenuAction(value: string | number | null): void;

    onTabChange(): void;

    onIndentSpacesBlur(): void;

    saveSettings(): Promise<void>;

    resetSettings(): void;

    onClose(): void;

    onOpenChange(value: boolean): void;

    hasAlignment(): boolean;

    primaryLabel(): string;

    templatePreview(): string;

    updateFirstParameterMode(value: FirstParameterMode): void;

    updateSubsequentParameterMode(value: SubsequentParameterMode): void;
}

const FORMATTER_DIALOG_TEMPLATE =
    typeof __SOURCE_EDITOR_PANEL_DIALOG_TEMPLATE__ === 'undefined'
        ? ''
        : __SOURCE_EDITOR_PANEL_DIALOG_TEMPLATE__;

export const FORMATTER_DIALOG_STYLES =
    typeof __SOURCE_EDITOR_PANEL_DIALOG_STYLES__ === 'undefined'
        ? ''
        : __SOURCE_EDITOR_PANEL_DIALOG_STYLES__;

const TEMPLATE_PREVIEW_SOURCE =
    '{{Tracklists\n' +
    '  | 1 = {{tracklist\n' +
    '    | heading  = Side A | comment = ...\n' +
    '    | title1 = 春日来信 | note1 = 现场版   | length1 = 3:45\n' +
    '    | title2 = Home     | note2 = Acoustic | length2 = 2:56\n' +
    '  }}\n' +
    '  | 2 = {{tracklist\n' +
    '    | heading  = Side B | comment = ...\n' +
    '    | title1 = 漫长的旅途    | note1 = 录音室版 | length1 = 4:08\n' +
    '    | title2 = Morning light | note2 = Live     | length2 = 3:32\n' +
    '  }}\n' +
    '}}';

/**
 * Creates the formatter dialog mounted by the editor adapter.
 *
 * @param Vue - Vue value.
 * @param options - Operation options.
 * @returns Created the formatter dialog mounted by the editor adapter.
 */
export function createFormatterDialogComponent(
    Vue: VueModule,
    options: FormatterDialogOptions,
): unknown {
    function setup(): DialogBindings {
        return createFormatterDialogBindings(Vue, options);
    }

    return Vue.defineComponent({
        name: 'SourceEditorPanel',
        setup,
        template: FORMATTER_DIALOG_TEMPLATE,
    });
}

export function createFormatterDialogBindings(
    Vue: VueModule,
    options: FormatterDialogOptions,
): DialogBindings {
    const open = Vue.ref(true);
    const actionLayout =
        typeof matchMedia === 'function'
            ? matchMedia('(max-width: 639px)')
            : undefined;
    const stackedActions = Vue.ref(actionLayout?.matches ?? false);
    const onActionLayoutChange = (event: MediaQueryListEvent): void => {
        stackedActions.value = event.matches;
    };
    actionLayout?.addEventListener('change', onActionLayoutChange);
    const releaseActionLayout = (): void => {
        actionLayout?.removeEventListener('change', onActionLayoutChange);
    };
    Vue.onUnmounted?.(releaseActionLayout);
    const controls = Vue.ref<HTMLElement | null>(null);
    const activeTab = Vue.ref<FormatterDialogTab>(
        options.initialTab ?? 'formatting',
    );
    let initialFocusFrame: number | undefined;
    Vue.onMounted?.(() => {
        // Codex can initially focus a tab-scroll control that disappears after
        // measuring the tab strip. Keep focus on the selected, stable tab.
        initialFocusFrame = requestAnimationFrame(() => {
            initialFocusFrame = undefined;
            controls.value
                ?.querySelector<HTMLElement>(
                    '[role="tab"][aria-selected="true"]',
                )
                ?.focus({ preventScroll: true });
        });
    });
    Vue.onUnmounted?.(() => {
        if (initialFocusFrame !== undefined)
            cancelAnimationFrame(initialFocusFrame);
    });
    const announcement = Vue.ref<{ id: number; message: string } | null>(null);
    let announcementId = 0;
    const applying = Vue.ref(false);
    const savingSettings = Vue.ref(false);
    const menuSelection = Vue.ref<string | number | null>(null);
    const error = Vue.ref('');
    const initial = options.initialSelection;
    const formatReferences = Vue.ref(
        initial.citationFormatting.enabled || initial.references !== undefined,
    );
    const referenceLayout = Vue.ref<'inline' | 'block'>(
        initial.references?.layout ?? initial.citationFormatting.layout,
    );
    const convertAuthorNames = Vue.ref(
        initial.citationFormatting.convertAuthorNames,
    );
    const compactReferences = Vue.ref(
        initial.citationFormatting.compactReferences,
    );
    const separateReferenceDefinitions = Vue.ref(
        initial.citationFormatting.separateReferenceDefinitions,
    );
    const formatScriptTitles = Vue.ref(
        initial.citationFormatting.formatScriptTitles,
    );
    const scriptTitleMode = Vue.ref<ScriptTitleMode>(
        initial.citationFormatting.scriptTitleMode,
    );
    const indentBlockTemplates = Vue.ref(
        initial.formatter.indentBlockTemplates,
    );
    const indentSpaces = Vue.ref<string | number>(
        normalizeIndentation(initial.formatter.indentSpaces),
    );
    const firstParameterMode = Vue.ref<FirstParameterMode>(
        initial.formatter.formatFirstParameter
            ? initial.formatter.firstParameterLayout
            : 'preserve',
    );
    let lastFirstParameterLayout = initial.formatter.firstParameterLayout;
    const subsequentParameterMode = Vue.ref<SubsequentParameterMode>(
        initial.formatter.formatSubsequentParameters
            ? initial.formatter.subsequentParameterLayout
            : 'preserve',
    );
    let lastSubsequentParameterLayout =
        initial.formatter.subsequentParameterLayout;
    // Stored formatter ratios are Chinese:Latin; the UI displays Latin:Chinese.
    const characterWidthRatio = Vue.ref<CharacterWidthRatio>(
        initial.formatter.characterWidthRatio,
    );
    const skipFirstLevelIndentation = Vue.ref(
        initial.formatter.skipFirstLevelIndentation === true,
    );
    const normalizeConversion = Vue.ref(
        options.canNormalizeConversion && initial.formatter.normalizeConversion,
    );
    const formatHtmlTags = Vue.ref(initial.formatter.formatHtmlTags);
    const preferences: PreferenceBindings = {
        resolveRedirects: Vue.ref(initial.resolveRedirects),
        resolveTemplateRedirects: Vue.ref(initial.resolveTemplateRedirects),
    };
    let closed = false;

    function createSelection(): FormatterDialogSelection {
        const selectedFirstMode = firstParameterMode.value;
        const selectedSubsequentMode = subsequentParameterMode.value;
        return {
            citationFormatting: {
                enabled: formatReferences.value,
                layout: referenceLayout.value,
                compactReferences: compactReferences.value,
                convertAuthorNames: convertAuthorNames.value,
                separateReferenceDefinitions:
                    separateReferenceDefinitions.value,
                formatScriptTitles: formatScriptTitles.value,
                scriptTitleMode: scriptTitleMode.value,
            },
            ...(formatReferences.value
                ? { references: { layout: referenceLayout.value } }
                : {}),
            ...(Object.fromEntries(
                Object.entries(preferences).map(([key, ref]) => [
                    key,
                    ref.value,
                ]),
            ) as PreferenceSettings),
            formatter: {
                characterWidthRatio: characterWidthRatio.value,
                firstParameterLayout:
                    selectedFirstMode === 'preserve'
                        ? lastFirstParameterLayout
                        : selectedFirstMode,
                formatFirstParameter: selectedFirstMode !== 'preserve',
                formatHtmlTags: formatHtmlTags.value,
                formatSubsequentParameters:
                    selectedSubsequentMode !== 'preserve',
                indentBlockTemplates: indentBlockTemplates.value,
                indentSpaces: normalizeIndentation(indentSpaces.value),
                normalizeConversion:
                    options.canNormalizeConversion && normalizeConversion.value,
                skipFirstLevelIndentation: skipFirstLevelIndentation.value,
                subsequentParameterLayout:
                    selectedSubsequentMode === 'preserve'
                        ? lastSubsequentParameterLayout
                        : selectedSubsequentMode,
            },
        };
    }

    function closeDialog(selection?: FormatterDialogSelection): void {
        if (closed) {
            return;
        }
        closed = true;
        releaseActionLayout();
        open.value = false;
        options.onClose(selection);
    }

    function onClose(): void {
        if (applying.value || savingSettings.value) {
            return;
        }
        closeDialog();
    }

    async function apply(): Promise<void> {
        if (applying.value || savingSettings.value || closed) {
            return;
        }
        applying.value = true;
        error.value = '';
        announcement.value = null;
        // Snapshot the entire draft before any asynchronous operation.
        const selection = createSelection();
        try {
            await options.onSubmit(selection);
        } catch (caught) {
            options.onError(caught, 'format');
            error.value = msg('feedback.failed');
            return;
        } finally {
            applying.value = false;
        }
        closeDialog(selection);
    }

    async function saveSettings(): Promise<void> {
        if (applying.value || savingSettings.value || closed) {
            return;
        }
        savingSettings.value = true;
        error.value = '';
        announcement.value = null;
        try {
            await options.onSave(createSelection());
            announcement.value = {
                id: ++announcementId,
                message: msg('feedback.settingsSaved'),
            };
        } catch (caught) {
            options.onError(caught, 'save-settings');
            error.value = msg('feedback.settingsSaveFailed');
        } finally {
            savingSettings.value = false;
        }
    }

    async function openReferences(): Promise<void> {
        if (
            closed ||
            applying.value ||
            savingSettings.value ||
            !options.onOpenReferences
        )
            return;
        applying.value = true;
        error.value = '';
        const selection = createSelection();
        try {
            await options.onOpenReferences(selection);
            closeDialog(selection);
        } catch (caught) {
            options.onError(caught, 'format');
            error.value = msg('feedback.openFailed');
        } finally {
            applying.value = false;
        }
    }

    function resetSettings(): void {
        if (applying.value || savingSettings.value || closed) {
            return;
        }
        error.value = '';
        announcement.value = null;
        try {
            options.onReset();
            const defaults = createDefaultFormatterSettings();
            formatReferences.value = false;
            referenceLayout.value = defaults.citationFormatting.layout;
            compactReferences.value =
                defaults.citationFormatting.compactReferences;
            convertAuthorNames.value =
                defaults.citationFormatting.convertAuthorNames;
            separateReferenceDefinitions.value =
                defaults.citationFormatting.separateReferenceDefinitions;
            formatScriptTitles.value =
                defaults.citationFormatting.formatScriptTitles;
            scriptTitleMode.value = defaults.citationFormatting.scriptTitleMode;
            for (const key of Object.keys(preferences) as Array<
                keyof PreferenceSettings
            >) {
                preferences[key].value = defaults[key];
            }
            characterWidthRatio.value = defaults.formatter.characterWidthRatio;
            lastFirstParameterLayout = defaults.formatter.firstParameterLayout;
            firstParameterMode.value = defaults.formatter.formatFirstParameter
                ? lastFirstParameterLayout
                : 'preserve';
            lastSubsequentParameterLayout =
                defaults.formatter.subsequentParameterLayout;
            subsequentParameterMode.value = defaults.formatter
                .formatSubsequentParameters
                ? lastSubsequentParameterLayout
                : 'preserve';
            indentBlockTemplates.value =
                defaults.formatter.indentBlockTemplates;
            indentSpaces.value = defaults.formatter.indentSpaces;
            normalizeConversion.value = defaults.formatter.normalizeConversion;
            formatHtmlTags.value = defaults.formatter.formatHtmlTags;
            skipFirstLevelIndentation.value =
                defaults.formatter.skipFirstLevelIndentation === true;
            announcement.value = {
                id: ++announcementId,
                message: msg('feedback.settingsReset'),
            };
        } catch (caught) {
            options.onError(caught, 'reset-settings');
            error.value = msg('feedback.settingsResetFailed');
        }
    }

    return {
        formatReferences,
        referenceLayout,
        compactReferences,
        convertAuthorNames,
        separateReferenceDefinitions,
        formatScriptTitles,
        scriptTitleMode,
        scriptTitleExampleLanguages(mode) {
            return getScriptTitleExampleLanguages(
                options.contentLanguage ?? '',
                mode,
            ).join(', ');
        },
        referencesAvailable: options.onOpenReferences !== undefined,
        openReferences,
        ...preferences,
        activeTab,
        announcement,
        applying,
        apply,
        actionOrder() {
            return stackedActions.value
                ? ['primary', 'save', 'more', 'cancel']
                : ['cancel', 'save', 'primary'];
        },
        canNormalizeConversion: options.canNormalizeConversion,
        controls,
        characterWidthRatio,
        error,
        firstParameterMode,
        formatHtmlTags,
        hasAlignment() {
            return (
                firstParameterMode.value === 'align-values' ||
                subsequentParameterMode.value === 'align-names' ||
                subsequentParameterMode.value === 'align-names-and-values'
            );
        },
        indentBlockTemplates,
        indentSpaces,
        interfaceLocale,
        msg,
        menuItems: [
            {
                label: msg('dialog.resetSettings'),
                value: 'reset-settings',
            },
        ],
        menuSelection,
        onMenuAction(value) {
            menuSelection.value = null;
            if (value === 'reset-settings') {
                resetSettings();
            }
        },
        onTabChange() {
            controls.value?.closest('.cdx-dialog__body')?.scrollTo({ top: 0 });
        },
        onIndentSpacesBlur() {
            indentSpaces.value = normalizeIndentation(indentSpaces.value);
        },
        normalizeConversion,
        onClose,
        onOpenChange(value) {
            if (value) {
                return;
            }
            if (applying.value || savingSettings.value) {
                open.value = true;
                return;
            }
            closeDialog();
        },
        open,
        primaryLabel() {
            if (applying.value) {
                return msg('dialog.working');
            }
            return msg(
                options.scope === 'selection'
                    ? 'dialog.formatSelection'
                    : options.scope === 'section'
                      ? 'dialog.formatSection'
                      : 'dialog.formatPage',
            );
        },
        redirectPolicyUrl: options.redirectPolicyUrl,
        resetSettings,
        savingSettings,
        stackedActions,
        saveSettings,
        skipFirstLevelIndentation,
        subsequentParameterMode,
        templatePreview() {
            try {
                return formatWikitext(
                    TEMPLATE_PREVIEW_SOURCE,
                    createSelection().formatter,
                ).text;
            } catch {
                // An unrenderable draft must not prevent correcting the input.
                return TEMPLATE_PREVIEW_SOURCE;
            }
        },
        updateFirstParameterMode(value) {
            firstParameterMode.value = value;
            if (value !== 'preserve') {
                lastFirstParameterLayout = value;
            }
        },
        updateSubsequentParameterMode(value) {
            subsequentParameterMode.value = value;
            if (value !== 'preserve') {
                lastSubsequentParameterLayout = value;
            }
        },
    };
}

function normalizeIndentation(value: string | number): number {
    const spaces =
        typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
    return Number.isSafeInteger(spaces) ? Math.max(0, spaces) : 2;
}
