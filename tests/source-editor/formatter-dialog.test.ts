/**
 * @file tests/source-editor/formatter-dialog.test.ts
 * Purpose: tests / formatter dialog.test module.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 * 4. harness
 * 5. createVueHarness
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { compileTemplate, parse } from '@vue/compiler-sfc';

import {
    createDefaultFormatterSettings,
    type CitationFormattingSettings,
} from '../../src/source-editor/domain/formatter-settings.ts';
import { initializeSourceEditorI18n } from '../../src/source-editor/i18n/index.ts';
import type {
    VueApp,
    VueModule,
} from '../../src/source-editor/features/formatter/codex.ts';
import {
    createFormatterDialogBindings,
    type FormatterDialogOptions,
    type FormatterDialogSelection,
} from '../../src/source-editor/features/formatter/dialog.ts';

const dialogPath = new URL(
    '../../src/source-editor/features/formatter/dialog.vue',
    import.meta.url,
);
const template = await readFile(dialogPath, 'utf8');

test('dialog template compiles and renders translated content as text', async () => {
    const parsed = parse(template, { filename: dialogPath.pathname });
    const source = parsed.descriptor.template?.content;
    assert.deepEqual(parsed.errors, []);
    assert.ok(source);
    assert.equal(parsed.descriptor.script, null);
    assert.deepEqual(parsed.descriptor.styles, []);
    assert.deepEqual(
        compileTemplate({
            filename: dialogPath.pathname,
            id: 'kanade-source-editor-formatter',
            source,
        }).errors,
        [],
    );
    assert.doesNotMatch(source, /v-html/u);

    const catalogs = await Promise.all(
        ['en', 'zh-Hans', 'zh-Hant'].map(
            async (locale) =>
                JSON.parse(
                    await readFile(
                        new URL(
                            `../../src/source-editor/i18n/${locale}.json`,
                            import.meta.url,
                        ),
                        'utf8',
                    ),
                ) as Record<string, string>,
        ),
    );
    for (const catalog of catalogs) {
        assert.deepEqual(
            Object.keys(catalog).sort(),
            Object.keys(catalogs[0]).sort(),
        );
        for (const value of Object.values(catalog)) {
            assert.ok(value.trim());
        }
        for (const [, key] of source.matchAll(/['"](dialog\.[\w]+)['"]/gu)) {
            assert.ok(catalog[key], `Missing ${key}`);
        }
        assert.notEqual(
            catalog['dialog.alignNames'],
            catalog['dialog.alignNamesAndValues'],
        );
    }
});

test('formatting applies a draft once without persisting it by default', async () => {
    const { bindings, formatted, saved, closed } = harness();
    bindings.largeFont.value = true;
    bindings.formatHtmlTags.value = true;
    bindings.indentBlockTemplates.value = true;
    bindings.indentSpaces.value = 3;
    await bindings.apply();
    await bindings.apply();
    bindings.onClose();

    assert.equal(formatted.length, 1);
    assert.equal(formatted[0].formatter.indentSpaces, 3);
    assert.equal(formatted[0].formatter.formatHtmlTags, true);
    assert.equal(formatted[0].largeFont, true);
    assert.deepEqual(closed, formatted);
    assert.deepEqual(saved, []);
    assert.equal(bindings.open.value, false);
});

test('applying editor settings never runs the formatter', async () => {
    const { bindings, formatted, saved, closed } = harness();
    bindings.activeTab.value = 'editor';
    bindings.alternateReferenceColors.value = true;
    bindings.ctrlClickLinks.value = false;
    bindings.useCodeMirrorForOtherModels.value = true;
    bindings.referenceEditing.value = false;
    bindings.referenceLightweightEditing.value = true;
    bindings.largeFont.value = true;
    bindings.resolveRedirects.value = true;
    bindings.updateFirstParameterMode('compact');
    await bindings.apply();

    assert.deepEqual(formatted, []);
    assert.deepEqual(saved, []);
    assert.equal(closed.length, 1);
    assert.equal(closed[0]?.alternateReferenceColors, true);
    assert.equal(closed[0]?.ctrlClickLinks, false);
    assert.equal(closed[0]?.referenceEditing, false);
    assert.equal(closed[0]?.referenceLightweightEditing, true);
    assert.equal(closed[0]?.useCodeMirrorForOtherModels, true);
    assert.equal(closed[0]?.largeFont, true);
    assert.equal(closed[0]?.resolveRedirects, true);
    assert.equal(closed[0]?.formatter.firstParameterLayout, 'compact');
});

test('citation choices restore and save alongside article and editor settings', async () => {
    const initialSelection = createDefaultFormatterSettings();
    initialSelection.citationFormatting = {
        enabled: false,
        layout: 'block',
        compactReferences: true,
        separateReferenceDefinitions: true,
        formatScriptTitles: false,
        scriptTitleMode: 'always',
    };
    const { bindings, saved, formatted, closed } = harness({
        initialSelection,
    });
    assert.equal(bindings.formatReferences.value, false);
    assert.equal(bindings.referenceLayout.value, 'block');
    assert.equal(bindings.compactReferences.value, true);
    assert.equal(bindings.separateReferenceDefinitions.value, true);
    assert.equal(bindings.formatScriptTitles.value, false);
    assert.equal(bindings.scriptTitleMode.value, 'always');
    bindings.formatHtmlTags.value = true;
    bindings.largeFont.value = true;
    await bindings.saveSettings();
    assert.deepEqual(
        saved[0].citationFormatting,
        initialSelection.citationFormatting,
    );
    assert.equal(saved[0].formatter.formatHtmlTags, true);
    assert.equal(saved[0].largeFont, true);
    assert.equal(saved[0].references, undefined);
    assert.deepEqual(formatted, []);
    assert.deepEqual(closed, []);

    const reopened = harness({ initialSelection: saved[0] });
    reopened.bindings.activeTab.value = 'editor';
    reopened.bindings.formatReferences.value = true;
    await reopened.bindings.apply();
    assert.deepEqual(reopened.closed[0]?.citationFormatting, {
        ...initialSelection.citationFormatting,
        enabled: true,
    });
    assert.deepEqual(reopened.closed[0]?.references, { layout: 'block' });
    assert.deepEqual(reopened.formatted, []);
    assert.deepEqual(reopened.saved, []);
});

test('citation language examples follow the target content language with either interface locale', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'mw');
    try {
        for (const [locale, contentLanguage, foreign, always] of [
            ['en', 'zh-Hant', 'en, ja, ru', 'zh, en, ja, ru'],
            ['zh-Hans', 'en', 'de, ja, ru', 'en, de, ja, ru'],
        ] as const) {
            Object.defineProperty(globalThis, 'mw', {
                configurable: true,
                value: {
                    config: {
                        get(key: string) {
                            return key === 'wgUserLanguage'
                                ? locale
                                : key === 'wgContentLanguage'
                                  ? contentLanguage
                                  : undefined;
                        },
                    },
                },
            });
            initializeSourceEditorI18n();
            const { bindings } = harness({ contentLanguage });
            assert.equal(bindings.interfaceLocale, locale);
            assert.equal(
                bindings.scriptTitleExampleLanguages('non-latin'),
                'ja, ru',
            );
            assert.equal(
                bindings.scriptTitleExampleLanguages('all-foreign'),
                foreign,
            );
            assert.equal(
                bindings.scriptTitleExampleLanguages('always'),
                always,
            );
        }
    } finally {
        if (original == null) Reflect.deleteProperty(globalThis, 'mw');
        else Object.defineProperty(globalThis, 'mw', original);
        initializeSourceEditorI18n();
    }
});

for (const dismissal of ['cancel', 'escape'] as const) {
    test(`${dismissal} discards all drafts without applying or saving`, async () => {
        const { bindings, closed, saved, formatted } = harness();
        bindings.ctrlClickLinks.value = false;
        bindings.largeFont.value = true;
        bindings.resolveRedirects.value = true;
        bindings.formatReferences.value = true;
        bindings.referenceLayout.value = 'block';
        bindings.compactReferences.value = true;
        bindings.scriptTitleMode.value = 'always';
        if (dismissal === 'cancel') {
            bindings.onClose();
        } else {
            bindings.open.value = false;
            bindings.onOpenChange(false);
        }
        bindings.onOpenChange(false);
        await bindings.apply();
        assert.deepEqual(closed, [undefined]);
        assert.deepEqual(saved, []);
        assert.deepEqual(formatted, []);
        assert.equal(bindings.open.value, false);
    });
}

test('preserve modes and dependent choices retain their configuration', async () => {
    const initial = createDefaultFormatterSettings();
    const { bindings, saved } = harness({ initialSelection: initial });
    bindings.activeTab.value = 'editor';
    bindings.indentBlockTemplates.value = true;
    bindings.indentSpaces.value = 12;
    bindings.skipFirstLevelIndentation.value = true;
    bindings.updateFirstParameterMode('compact');
    bindings.updateSubsequentParameterMode('align-names-and-values');
    bindings.indentBlockTemplates.value = false;
    bindings.updateFirstParameterMode('preserve');
    bindings.updateSubsequentParameterMode('preserve');
    bindings.resolveTemplateRedirects.value = true;
    bindings.referenceEditing.value = false;
    bindings.referenceLightweightEditing.value = true;
    bindings.referencePreviews.value = false;
    bindings.fullPageReferencePreviews.value = true;
    await bindings.saveSettings();

    const selection = saved[0];
    assert.deepEqual(selection.formatter, {
        ...initial.formatter,
        indentSpaces: 12,
        skipFirstLevelIndentation: true,
        firstParameterLayout: 'compact',
        subsequentParameterLayout: 'align-names-and-values',
    });
    assert.equal(selection.resolveRedirects, false);
    assert.equal(selection.resolveTemplateRedirects, true);
    assert.equal(selection.referencePreviews, false);
    assert.equal(selection.referenceEditing, false);
    assert.equal(selection.referenceLightweightEditing, true);
    assert.equal(selection.fullPageReferencePreviews, true);
});

test('indentation defaults to two spaces and restores saved widths above four', async () => {
    const defaults = harness().bindings;
    assert.equal(defaults.indentBlockTemplates.value, false);
    assert.equal(defaults.indentSpaces.value, 2);
    const initialSelection = createDefaultFormatterSettings();
    initialSelection.formatter.indentBlockTemplates = true;
    initialSelection.formatter.indentSpaces = 12;
    const { bindings, saved } = harness({ initialSelection });
    assert.equal(bindings.indentBlockTemplates.value, true);
    assert.equal(bindings.indentSpaces.value, 12);
    await bindings.saveSettings();
    assert.equal(saved[0].formatter.indentSpaces, 12);
});

test('indentation accepts zero and normalizes incomplete or invalid number drafts', async () => {
    for (const [input, expected] of [
        [0, 0],
        ['12', 12],
        [-1, 0],
        ['', 2],
        [1.5, 2],
        [Infinity, 2],
    ] as const) {
        const { bindings, saved } = harness();
        bindings.indentBlockTemplates.value = true;
        bindings.indentSpaces.value = input;
        await bindings.saveSettings();
        assert.equal(saved[0].formatter.indentSpaces, expected);
        bindings.onIndentSpacesBlur();
        assert.equal(bindings.indentSpaces.value, expected);
    }
});

test('layout example responds to choices without changing the editor', () => {
    const { bindings, formatted, closed } = harness();
    const original = bindings.templatePreview();
    assert.equal(bindings.hasAlignment(), false);
    bindings.updateFirstParameterMode('align-values');
    bindings.updateSubsequentParameterMode('align-names');
    assert.equal(bindings.hasAlignment(), true);
    assert.notEqual(bindings.templatePreview(), original);
    const fiveToThree = bindings.templatePreview();
    bindings.characterWidthRatio.value = '2:1';
    assert.notEqual(bindings.templatePreview(), fiveToThree);
    const alignedNames = bindings.templatePreview();
    bindings.updateSubsequentParameterMode('align-names-and-values');
    assert.notEqual(bindings.templatePreview(), alignedNames);
    bindings.updateSubsequentParameterMode('align-names');
    const tracks = bindings.templatePreview().split('\n');
    assert.equal(tracks[0], '{{Tracklists');
    assert.equal(tracks.length, 12);
    assert.match(tracks[3], /title1.*春日来信.*note1.*length1/u);
    assert.match(tracks[8], /title1.*漫长的旅途.*note1.*length1/u);
    assert.match(tracks[1], /1.*\{\{tracklist/u);
    assert.match(tracks[6], /2.*\{\{tracklist/u);
    assert.match(tracks[2], /heading\s*= Side A.*\| comment\s*= \.\.\.$/u);
    assert.match(tracks[7], /heading\s*= Side B.*\| comment\s*= \.\.\.$/u);
    bindings.indentBlockTemplates.value = true;
    bindings.indentSpaces.value = 3;
    assert.match(
        bindings.templatePreview(),
        /^ {6}\| heading\s*= Side A.*\| comment\s*= \.\.\.$/mu,
    );
    bindings.skipFirstLevelIndentation.value = true;
    assert.match(
        bindings.templatePreview(),
        /^ {3}\| heading\s*= Side A.*\| comment\s*= \.\.\.$/mu,
    );
    bindings.indentSpaces.value = Number.MAX_SAFE_INTEGER;
    assert.doesNotThrow(() => bindings.templatePreview());
    bindings.updateFirstParameterMode('compact');
    bindings.updateSubsequentParameterMode('preserve');
    assert.equal(bindings.hasAlignment(), false);
    assert.deepEqual(formatted, []);
    assert.deepEqual(closed, []);
});

test('saving settings keeps the dialog open and does not apply the draft', async () => {
    const { bindings, closed, formatted, saved } = harness();
    const initialAnnouncement = bindings.announcement.value;
    assert.equal(initialAnnouncement, null);
    bindings.alternateReferenceColors.value = true;
    bindings.ctrlClickLinks.value = false;
    bindings.syntaxHighlighting.value = false;
    bindings.useCodeMirrorForOtherModels.value = true;
    bindings.formatReferences.value = true;
    bindings.referenceLayout.value = 'block';
    bindings.compactReferences.value = true;
    bindings.separateReferenceDefinitions.value = true;
    bindings.formatScriptTitles.value = false;
    bindings.scriptTitleMode.value = 'always';
    bindings.formatHtmlTags.value = true;
    await bindings.saveSettings();
    assert.equal(bindings.menuSelection.value, null);
    assert.equal(bindings.open.value, true);
    assert.equal(saved[0].alternateReferenceColors, true);
    assert.equal(saved[0].ctrlClickLinks, false);
    assert.equal(saved[0].formatter.formatHtmlTags, true);
    assert.equal(saved[0].syntaxHighlighting, false);
    assert.equal(saved[0].useCodeMirrorForOtherModels, true);
    assert.deepEqual(saved[0].citationFormatting, {
        enabled: true,
        layout: 'block',
        compactReferences: true,
        separateReferenceDefinitions: true,
        formatScriptTitles: false,
        scriptTitleMode: 'always',
    });
    assert.equal(bindings.error.value, '');
    assert.ok(bindings.announcement.value);
    assert.match(bindings.announcement.value.message, /saved in this browser/u);
    assert.ok(Number.isInteger(bindings.announcement.value.id));
    assert.deepEqual(closed, []);
    assert.deepEqual(formatted, []);
    bindings.onClose();
    assert.deepEqual(closed, [undefined]);
    assert.equal(saved.length, 1);
});

test('reset restores every draft setting without applying or closing', async () => {
    let resets = 0;
    const { bindings, closed, formatted, saved } = harness({
        onReset() {
            resets += 1;
            assert.equal(bindings.indentSpaces.value, 12);
            assert.equal(bindings.largeFont.value, true);
        },
    });
    assert.deepEqual(
        bindings.menuItems.map(({ value }) => value),
        ['clear-cache', 'reset-settings'],
    );
    assert.ok(!('action' in bindings.menuItems.at(-1)!));
    bindings.activeTab.value = 'editor';
    bindings.alternateReferenceColors.value = true;
    bindings.ctrlClickLinks.value = false;
    bindings.characterWidthRatio.value = '2:1';
    bindings.updateFirstParameterMode('compact');
    bindings.updateSubsequentParameterMode('align-names-and-values');
    bindings.indentBlockTemplates.value = true;
    bindings.indentSpaces.value = 12;
    bindings.normalizeConversion.value = true;
    bindings.formatHtmlTags.value = true;
    bindings.skipFirstLevelIndentation.value = true;
    bindings.fullPageReferencePreviews.value = true;
    bindings.highlightMissing.value = true;
    bindings.largeFont.value = true;
    bindings.linkPreviews.value = true;
    bindings.referenceEditing.value = false;
    bindings.referenceLightweightEditing.value = true;
    bindings.referencePreviews.value = false;
    bindings.resolveRedirects.value = true;
    bindings.resolveTemplateRedirects.value = true;
    bindings.smallReferenceText.value = false;
    bindings.syntaxHighlighting.value = false;
    bindings.useCodeMirrorForOtherModels.value = true;
    bindings.formatReferences.value = true;
    bindings.referenceLayout.value = 'block';
    bindings.compactReferences.value = true;
    bindings.separateReferenceDefinitions.value = true;
    bindings.formatScriptTitles.value = false;
    bindings.scriptTitleMode.value = 'always';
    bindings.error.value = 'Previous action failed';

    await bindings.onMenuAction('reset-settings');

    assert.equal(resets, 1);
    assert.equal(bindings.activeTab.value, 'editor');
    assert.equal(bindings.menuSelection.value, null);
    assert.equal(bindings.open.value, true);
    assert.equal(bindings.error.value, '');
    assert.ok(bindings.announcement.value);
    assert.match(bindings.announcement.value.message, /reset/iu);
    assert.deepEqual(closed, []);
    assert.deepEqual(formatted, []);
    assert.deepEqual(saved, []);
    await bindings.saveSettings();
    assert.deepEqual(saved, [createDefaultFormatterSettings()]);
});

test('Ctrl/Cmd-click defaults on and restores a saved disabled choice', () => {
    assert.equal(harness().bindings.ctrlClickLinks.value, true);
    const initialSelection = createDefaultFormatterSettings();
    initialSelection.ctrlClickLinks = false;

    assert.equal(
        harness({ initialSelection }).bindings.ctrlClickLinks.value,
        false,
    );
});

test('link navigation labels use the supplied platform modifier', () => {
    for (const linkModifierKey of ['Ctrl', 'Command'] as const) {
        const { bindings } = harness({ linkModifierKey });
        assert.equal(
            bindings.msg('dialog.ctrlClickLinks', {
                modifier: bindings.linkModifierKey,
            }),
            `Hold ${linkModifierKey} and click link source to open a new tab`,
        );
    }
});

test('the reference color setting defaults off and restores a saved choice', () => {
    assert.equal(harness().bindings.alternateReferenceColors.value, false);
    const initialSelection = createDefaultFormatterSettings();
    initialSelection.alternateReferenceColors = true;

    assert.equal(
        harness({ initialSelection }).bindings.alternateReferenceColors.value,
        true,
    );
});

test('reference editing defaults on and restores a saved disabled choice', () => {
    assert.equal(harness().bindings.referenceEditing.value, true);
    const initialSelection = createDefaultFormatterSettings();
    initialSelection.referenceEditing = false;

    assert.equal(
        harness({ initialSelection }).bindings.referenceEditing.value,
        false,
    );
});

test('lightweight editing defaults off and restores a saved enabled choice', () => {
    assert.equal(harness().bindings.referenceLightweightEditing.value, false);
    const initialSelection = createDefaultFormatterSettings();
    initialSelection.referenceLightweightEditing = true;

    assert.equal(
        harness({ initialSelection }).bindings.referenceLightweightEditing
            .value,
        true,
    );
});

test('CodeMirror preference defaults off and restores a saved choice', () => {
    assert.equal(harness().bindings.useCodeMirrorForOtherModels.value, false);
    const initialSelection = createDefaultFormatterSettings();
    initialSelection.useCodeMirrorForOtherModels = true;

    assert.equal(
        harness({ initialSelection }).bindings.useCodeMirrorForOtherModels
            .value,
        true,
    );
});

test('HTML formatting defaults off and restores a saved choice', () => {
    assert.equal(harness().bindings.formatHtmlTags.value, false);
    const initialSelection = createDefaultFormatterSettings();
    initialSelection.formatter.formatHtmlTags = true;

    assert.equal(
        harness({ initialSelection }).bindings.formatHtmlTags.value,
        true,
    );
});

test('a failed reset preserves the draft and leaves an inline error', async () => {
    const failure = new Error('storage unavailable');
    let resets = 0;
    const { bindings, closed, errors, formatted, saved } = harness({
        onReset() {
            resets += 1;
            throw failure;
        },
    });
    bindings.activeTab.value = 'editor';
    bindings.largeFont.value = true;
    bindings.indentBlockTemplates.value = true;
    bindings.indentSpaces.value = 12;
    bindings.updateFirstParameterMode('compact');
    await bindings.saveSettings();
    const original = saved[0];

    await bindings.onMenuAction('reset-settings');

    assert.equal(resets, 1);
    assert.deepEqual(errors, [[failure, 'reset-settings']]);
    assert.match(bindings.error.value, /Could not reset/u);
    assert.equal(bindings.announcement.value, null);
    assert.equal(bindings.activeTab.value, 'editor');
    assert.equal(bindings.open.value, true);
    assert.deepEqual(closed, []);
    assert.deepEqual(formatted, []);
    assert.equal(saved.length, 1);
    await bindings.saveSettings();
    assert.deepEqual(saved[1], original);
});

test('busy saving ignores duplicate actions and dismissal, and uses a snapshot', async () => {
    let finishSave!: () => void;
    const saving = new Promise<void>((resolve) => {
        finishSave = resolve;
    });
    const snapshots: FormatterDialogSelection[] = [];
    let clears = 0;
    let resets = 0;
    const { bindings, closed, formatted } = harness({
        onSave(selection) {
            snapshots.push(selection);
            return saving;
        },
        onClearCache() {
            clears += 1;
        },
        onReset() {
            resets += 1;
        },
    });
    bindings.largeFont.value = true;
    bindings.formatReferences.value = true;
    bindings.referenceLayout.value = 'block';
    bindings.compactReferences.value = true;
    bindings.separateReferenceDefinitions.value = true;
    bindings.formatScriptTitles.value = false;
    bindings.scriptTitleMode.value = 'always';
    const citationSnapshot: CitationFormattingSettings = {
        enabled: true,
        layout: 'block',
        compactReferences: true,
        separateReferenceDefinitions: true,
        formatScriptTitles: false,
        scriptTitleMode: 'always',
    };
    const pending = bindings.saveSettings();
    assert.equal(bindings.applying.value, false);
    assert.equal(bindings.savingSettings.value, true);
    const pendingAnnouncement = bindings.announcement.value;
    assert.equal(pendingAnnouncement, null);
    bindings.onClose();
    bindings.open.value = false;
    bindings.onOpenChange(false);
    await bindings.apply();
    await bindings.saveSettings();
    await bindings.onMenuAction('clear-cache');
    await bindings.onMenuAction('reset-settings');
    bindings.resetSettings();
    assert.equal(bindings.open.value, true);
    assert.equal(bindings.largeFont.value, true);
    assert.deepEqual(closed, []);
    bindings.largeFont.value = false;
    bindings.formatReferences.value = false;
    bindings.referenceLayout.value = 'inline';
    bindings.scriptTitleMode.value = 'non-latin';
    bindings.activeTab.value = 'editor';
    finishSave();
    await pending;
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].largeFont, true);
    assert.deepEqual(snapshots[0].citationFormatting, citationSnapshot);
    assert.deepEqual(formatted, []);
    assert.deepEqual(closed, []);
    assert.equal(clears, 0);
    assert.equal(resets, 0);
    assert.equal(bindings.savingSettings.value, false);
    assert.ok(bindings.announcement.value);
    assert.match(bindings.announcement.value.message, /saved in this browser/u);
});

test('storage failure leaves the draft open and permits applying without saving', async () => {
    const failure = new Error('storage unavailable');
    const { bindings, closed, formatted, errors } = harness({
        onSave() {
            throw failure;
        },
    });
    await bindings.saveSettings();
    assert.deepEqual(errors, [[failure, 'save-settings']]);
    assert.deepEqual(formatted, []);
    assert.deepEqual(closed, []);
    assert.equal(bindings.open.value, true);
    assert.equal(bindings.applying.value, false);
    assert.equal(bindings.savingSettings.value, false);
    assert.match(bindings.error.value, /still apply/u);
    assert.equal(bindings.announcement.value, null);
    await bindings.apply();
    assert.equal(formatted.length, 1);
    assert.deepEqual(closed, formatted);
    assert.equal(bindings.error.value, '');
});

test('formatting locks its action and draft snapshot until it completes', async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
        finish = resolve;
    });
    const snapshots: FormatterDialogSelection[] = [];
    const { bindings, closed, saved } = harness({
        async onSubmit(selection) {
            snapshots.push(selection);
            await pending;
        },
    });
    bindings.largeFont.value = true;
    bindings.formatReferences.value = true;
    bindings.referenceLayout.value = 'block';
    bindings.scriptTitleMode.value = 'always';
    const applying = bindings.apply();
    bindings.largeFont.value = false;
    bindings.formatReferences.value = false;
    bindings.referenceLayout.value = 'inline';
    bindings.scriptTitleMode.value = 'non-latin';
    bindings.activeTab.value = 'editor';
    await bindings.apply();
    await bindings.saveSettings();
    bindings.onClose();
    assert.deepEqual(closed, []);
    assert.deepEqual(saved, []);
    assert.equal(bindings.applying.value, true);
    finish();
    await applying;
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].largeFont, true);
    assert.equal(snapshots[0].citationFormatting.enabled, true);
    assert.equal(snapshots[0].citationFormatting.layout, 'block');
    assert.equal(snapshots[0].citationFormatting.scriptTitleMode, 'always');
    assert.deepEqual(closed, snapshots);
});

test('opening references accepts one snapshot without formatting or saving', async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
        finish = resolve;
    });
    const snapshots: FormatterDialogSelection[] = [];
    const { bindings, formatted, closed, saved } = harness({
        async onOpenReferences(selection) {
            snapshots.push(selection);
            await pending;
        },
    });
    assert.equal(bindings.referencesAvailable, true);
    bindings.formatReferences.value = true;
    bindings.referenceLayout.value = 'block';
    bindings.scriptTitleMode.value = 'always';
    bindings.largeFont.value = true;
    const opening = bindings.openReferences();
    bindings.formatReferences.value = false;
    bindings.scriptTitleMode.value = 'non-latin';
    bindings.largeFont.value = false;
    bindings.onClose();
    await bindings.openReferences();
    await bindings.saveSettings();
    assert.equal(bindings.applying.value, true);
    assert.deepEqual(closed, []);
    finish();
    await opening;
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].largeFont, true);
    assert.equal(snapshots[0].citationFormatting.enabled, true);
    assert.equal(snapshots[0].citationFormatting.scriptTitleMode, 'always');
    assert.deepEqual(closed, snapshots);
    assert.deepEqual(formatted, []);
    assert.deepEqual(saved, []);
    assert.equal(bindings.open.value, false);
});

test('a failed references handoff retains the settings draft for retry', async () => {
    const failure = new Error('References unavailable');
    let attempts = 0;
    const { bindings, closed, formatted, saved, errors } = harness({
        async onOpenReferences() {
            attempts += 1;
            if (attempts === 1) throw failure;
        },
    });
    bindings.referenceLayout.value = 'block';
    bindings.scriptTitleMode.value = 'all-foreign';
    await bindings.openReferences();
    assert.equal(bindings.open.value, true);
    assert.equal(bindings.applying.value, false);
    assert.equal(bindings.referenceLayout.value, 'block');
    assert.equal(bindings.scriptTitleMode.value, 'all-foreign');
    assert.equal(errors[0]?.[0], failure);
    assert.ok(bindings.error.value);
    assert.equal(closed.length, 0);
    await bindings.openReferences();
    assert.equal(attempts, 2);
    assert.equal(closed[0]?.citationFormatting.layout, 'block');
    assert.equal(closed[0]?.citationFormatting.scriptTitleMode, 'all-foreign');
    assert.deepEqual(formatted, []);
    assert.deepEqual(saved, []);
});

test('cache menu action acts immediately without saving, applying, or closing', async () => {
    let clears = 0;
    const { bindings, closed, saved, formatted } = harness({
        onClearCache() {
            assert.equal(bindings.announcement.value, null);
            clears += 1;
        },
    });
    await bindings.onMenuAction('clear-cache');
    const firstAnnouncement = bindings.announcement.value;
    assert.ok(firstAnnouncement);
    assert.match(firstAnnouncement.message, /Cache cleared/u);
    await bindings.onMenuAction('clear-cache');
    assert.ok(bindings.announcement.value);
    assert.match(bindings.announcement.value.message, /Cache cleared/u);
    assert.equal(bindings.announcement.value.id, firstAnnouncement.id + 1);
    assert.equal(clears, 2);
    assert.equal(bindings.menuSelection.value, null);
    assert.equal(bindings.open.value, true);
    assert.equal(bindings.error.value, '');
    assert.deepEqual(closed, []);
    assert.deepEqual(saved, []);
    assert.deepEqual(formatted, []);
});

test('cache failures leave the dialog usable', async () => {
    const failure = new Error('cache unavailable');
    const { bindings, closed, errors, formatted, saved } = harness({
        onClearCache() {
            throw failure;
        },
    });
    await bindings.onMenuAction('clear-cache');
    assert.deepEqual(errors, [[failure, 'clear-cache']]);
    assert.match(bindings.error.value, /Could not clear/u);
    assert.equal(bindings.announcement.value, null);
    assert.equal(bindings.open.value, true);
    assert.deepEqual(closed, []);
    assert.deepEqual(formatted, []);
    assert.deepEqual(saved, []);
    await bindings.apply();
    assert.equal(formatted.length, 1);
    assert.deepEqual(closed, formatted);
    assert.equal(bindings.error.value, '');
});

test('other wikis allow HTML formatting and both width ratios but gate conversion rules', async () => {
    const initialSelection = createDefaultFormatterSettings();
    initialSelection.formatter.normalizeConversion = true;
    const { bindings, saved, formatted } = harness({
        canNormalizeConversion: false,
        initialSelection,
    });
    assert.equal(bindings.normalizeConversion.value, false);
    bindings.normalizeConversion.value = true;
    bindings.formatHtmlTags.value = true;
    bindings.updateFirstParameterMode('align-values');
    bindings.updateSubsequentParameterMode('align-names');
    assert.equal(bindings.hasAlignment(), true);
    for (const ratio of ['5:3', '2:1'] as const) {
        bindings.characterWidthRatio.value = ratio;
        await bindings.saveSettings();
        assert.equal(saved.at(-1)?.formatter.characterWidthRatio, ratio);
        assert.equal(saved.at(-1)?.formatter.normalizeConversion, false);
        assert.equal(saved.at(-1)?.formatter.formatHtmlTags, true);
    }
    await bindings.apply();
    assert.equal(formatted[0].formatter.normalizeConversion, false);
    assert.equal(formatted[0].formatter.formatHtmlTags, true);
});

test('format failure preserves drafts for retry without committing editor settings', async () => {
    const failure = new Error('lookup failed');
    const { bindings, closed, errors } = harness({
        async onSubmit() {
            throw failure;
        },
    });
    bindings.largeFont.value = true;
    await bindings.apply();
    assert.deepEqual(errors, [[failure, 'format']]);
    assert.deepEqual(closed, []);
    assert.equal(bindings.open.value, true);
    assert.equal(bindings.largeFont.value, true);
    assert.equal(bindings.applying.value, false);
    assert.match(bindings.error.value, /Could not format/u);
    assert.equal(bindings.announcement.value, null);
});

function harness(overrides: Partial<FormatterDialogOptions> = {}) {
    const saved: FormatterDialogSelection[] = [];
    const formatted: FormatterDialogSelection[] = [];
    const closed: (FormatterDialogSelection | undefined)[] = [];
    const errors: unknown[][] = [];
    const bindings = createFormatterDialogBindings(createVueHarness(), {
        canNormalizeConversion: true,
        supportsLinkHelpers: true,
        initialSelection: createDefaultFormatterSettings(),
        linkHelperDocumentationUrl: '/wiki/Category:内部链接助手模板',
        linkModifierKey: 'Ctrl',
        redirectPolicyUrl: '/wiki/WP:DONOTFIXIT',
        scope: 'page',
        onClearCache() {},
        onReset() {},
        onClose(selection) {
            closed.push(selection);
        },
        onSave(selection) {
            saved.push(selection);
        },
        async onSubmit(selection) {
            formatted.push(selection);
        },
        onError(error, operation) {
            errors.push([error, operation]);
        },
        ...overrides,
    });
    return { bindings, saved, formatted, closed, errors };
}

function createVueHarness(): VueModule {
    return {
        createMwApp(): VueApp {
            throw new Error('Not mounted in unit tests');
        },
        defineComponent(component: unknown): unknown {
            return component;
        },
        ref<T>(value: T) {
            return { value };
        },
    };
}
