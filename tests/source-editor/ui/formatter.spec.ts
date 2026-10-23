/**
 * @file tests/source-editor/ui/formatter.spec.ts
 * Purpose: tests / ui / formatter.spec module.
 *
 * Table of contents:
 * 1. Imports
 * 2. NativeNotification
 * 3. Constants and state
 * 4. Test scenarios
 * 5. chooseMore
 * 6. capture
 * 7. storedSettings
 * 8. nativeNotifications
 * 9. expectSuccessNotification
 * 10. mountFormatter
 */

import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { build } from 'esbuild';

import { FORMATTER_SETTINGS_STORAGE_KEY } from '../../../src/source-editor/platform/browser/formatter-settings.ts';
import {
    createDefaultFormatterSettings,
    type FormatterSettings,
} from '../../../src/source-editor/domain/formatter-settings.ts';
import type { MediaWikiNotificationOptions } from '../../../src/library/notifications/contracts.ts';
import english from '../../../src/source-editor/i18n/en.json' with { type: 'json' };
import japanese from '../../../src/source-editor/i18n/ja.json' with { type: 'json' };
import russian from '../../../src/source-editor/i18n/ru.json' with { type: 'json' };
import simplifiedChinese from '../../../src/source-editor/i18n/zh-Hans.json' with { type: 'json' };

interface NativeNotification {
    message: string;
    options: MediaWikiNotificationOptions;
}

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const initialSource = '==Heading==\nText   ';
const screenshotLocales = [
    {
        locale: 'en',
        editSource: 'Edit source',
        editorTab: 'Highlighting settings',
    },
    {
        locale: 'zh-Hant',
        editSource: '編輯原始碼',
        editorTab: '語法凸顯設定',
    },
    {
        locale: 'zh-Hans',
        editSource: '编辑源代码',
        editorTab: '高亮设定',
    },
] as const;
let runtime: string;

test.beforeAll(async () => {
    const result = await build({
        absWorkingDir: projectRoot,
        stdin: {
            contents:
                'import * as Vue from "vue/dist/vue.esm-bundler.js"; import * as Codex from "@wikimedia/codex"; export const vue = {...Vue, createMwApp: Vue.createApp}; export const codex = Codex;',
            resolveDir: projectRoot,
        },
        bundle: true,
        format: 'iife',
        globalName: 'SourceEditorTestUI',
        define: {
            'process.env.NODE_ENV': '"production"',
            __VUE_OPTIONS_API__: 'true',
            __VUE_PROD_DEVTOOLS__: 'false',
            __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
        },
        write: false,
    });
    runtime = result.outputFiles[0].text;
});

test.describe('documentation screenshots', () => {
    test.skip(process.env.DOCUMENTATION_SCREENSHOTS !== '1', 'Opt-in capture');
    test.use({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });

    for (const fixture of screenshotLocales) {
        test(`${fixture.locale} captures citation, link preview, and both panel tabs`, async ({
            page,
        }, testInfo) => {
            await page.emulateMedia({ reducedMotion: 'reduce' });
            const source = await readFile(
                `${projectRoot}tests/source-editor/fixtures/nintendo.wikitext`,
                'utf8',
            );
            const preview = JSON.parse(
                await readFile(
                    `${projectRoot}tests/source-editor/fixtures/nintendo-switch.summary.json`,
                    'utf8',
                ),
            );
            await mountFormatter(page, {
                locale: fixture.locale,
                wikiId: 'zhwiki',
                source,
                open: false,
                settings: {
                    ...createDefaultFormatterSettings(),
                    linkPreviews: true,
                },
            });
            await page.addStyleTag({
                content: `#editform::before { content: ${JSON.stringify(`任天堂 · ${fixture.editSource}`)}; display: block; font-size: 28px; margin-bottom: 12px; } .kanade-source-editor-frame { width: 100%; height: 600px; }`,
            });
            await page
                .locator('.kanade-source-editor-frame')
                .evaluate((element) => {
                    (element as HTMLIFrameElement).style.height = '600px';
                    const editor = (
                        element as HTMLIFrameElement
                    ).contentDocument?.querySelector<HTMLElement>(
                        '.kanade-source-editor-editor',
                    );
                    if (editor) editor.style.fontSize = '16px';
                });
            await page.route('**/w/api.php**', async (route) => {
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        query: {
                            pages: [
                                {
                                    pageid: preview.pageid,
                                    title: preview.title,
                                },
                            ],
                        },
                    }),
                });
            });
            await page.route(
                '**/api/rest_v1/page/summary/**',
                async (route) => {
                    await route.fulfill({
                        contentType: 'application/json',
                        body: JSON.stringify(preview),
                    });
                },
            );
            const imageDir = testInfo.outputPath('documentation-screenshots');
            await mkdir(imageDir, { recursive: true });
            const frame = page.frameLocator('.kanade-source-editor-frame');
            await frame
                .locator('[data-kanade-source-editor-reference]')
                .filter({ hasText: 'トヨタの5倍超' })
                .first()
                .hover();
            await expect(
                frame.locator('.kanade-source-editor-tooltip'),
            ).toBeVisible();
            await expect(
                frame.locator('.kanade-source-editor-tooltip'),
            ).toContainText('トヨタの5倍超');
            await expect(
                frame.locator('.kanade-source-editor-tooltip__value').first(),
            ).toHaveCSS('font-family', 'monospace');
            await expect(
                frame.locator('.kanade-source-editor-tooltip__key').first(),
            ).toHaveCSS('font-family', 'sans-serif');
            await page.screenshot({
                path: `${imageDir}/screenshot01.${fixture.locale}.png`,
                animations: 'disabled',
            });
            await page.mouse.move(0, 0);
            await frame
                .locator(
                    '[data-kanade-source-editor-page-preview-title="任天堂Switch"]',
                )
                .first()
                .hover();
            await expect(
                frame.locator('.kanade-source-editor-page-preview'),
            ).toBeVisible();
            await expect(
                frame.locator('.kanade-source-editor-page-preview__extract'),
            ).toHaveText(preview.extract);
            await expect(
                frame.locator(
                    '.kanade-source-editor-page-preview__description',
                ),
            ).toHaveText(preview.description);
            await page.screenshot({
                path: `${imageDir}/screenshot02.${fixture.locale}.png`,
                animations: 'disabled',
            });
            await page.mouse.move(0, 0);
            await expect(
                frame.locator('.kanade-source-editor-page-preview'),
            ).toBeHidden();
            await page.locator('#kanade-source-editor-panel a').click();
            await expect(page.getByRole('dialog')).toBeVisible();
            await expect(page.getByRole('dialog')).toHaveAttribute(
                'lang',
                fixture.locale,
            );
            await page.screenshot({
                path: `${imageDir}/screenshot03.${fixture.locale}.png`,
                animations: 'disabled',
            });
            await page
                .getByRole('tab', { name: fixture.editorTab, exact: true })
                .click();
            await page.screenshot({
                path: `${imageDir}/screenshot04.${fixture.locale}.png`,
                animations: 'disabled',
            });
            await expect(page.locator('#wpTextbox1')).toHaveValue(source);
        });
    }
});

test('Source Editor gadget and userscript installations share one editor and launcher', async ({
    page,
}) => {
    const source = 'Unchanged <ref>{{Cite web|title=Source}}</ref>';
    await mountFormatter(page, { source, open: false, wikiId: 'enwiki' });
    await page.evaluate(() => {
        (globalThis as any).__firstSourceEditorStartup = (window as any)[
            Symbol.for('kanade.source-editor.startup')
        ];
    });
    for (const artifact of ['source_editor.min.js', 'source_editor.user.js']) {
        await page.addScriptTag({ path: `${projectRoot}dist/${artifact}` });
    }
    await page.evaluate(async () => {
        await (window as any)[Symbol.for('kanade.source-editor.startup')];
    });
    expect(
        await page.evaluate(
            () =>
                (globalThis as any).__firstSourceEditorStartup ===
                (window as any)[Symbol.for('kanade.source-editor.startup')],
        ),
    ).toBe(true);
    await expect(page.locator('.kanade-source-editor-frame')).toHaveCount(1);
    await expect(page.locator('#p-cactions a')).toHaveCount(1);
    await expect(page.locator('#kanade-source-editor-panel')).toHaveCount(1);
    await expect(page.locator('#wpTextbox1')).toHaveValue(source);
    await page.locator('#kanade-source-editor-panel a').click();
    await expect(
        page.getByRole('dialog', { name: 'Source Editor', exact: true }),
    ).toHaveCount(1);
    await page.getByRole('tab', { name: 'References', exact: true }).click();
    await expect(
        page.getByRole('button', { name: 'Manage references', exact: true }),
    ).toHaveCount(1);
});

for (const [wikiId, locale, entered, expected] of [
    ['enwiki', 'zh-Hans', '2026-07', 'July 2026'],
    ['zhwiki', 'en', 'July 2026', '2026-07'],
    ['examplewiki', 'en', 'July 2026', 'July 2026'],
] as const) {
    test(`${wikiId} applies citation date policy independently of the interface language`, async ({
        page,
    }) => {
        const source = `Lead <ref>{{cite web|title=Example|url=https://example.test|date=${entered}}}</ref>\n<references />`;
        await mountFormatter(page, { source, wikiId, locale });
        const dialog = page.getByRole('dialog');
        const messages = locale === 'zh-Hans' ? simplifiedChinese : english;
        await dialog
            .getByRole('checkbox', {
                name: messages['dialog.formatReferences'],
                exact: true,
            })
            .check();
        await dialog.locator('.kanade-source-editor-dialog__primary').click();
        await expect(dialog).toBeHidden();
        await expect(page.locator('#wpTextbox1')).toHaveValue(
            new RegExp(`date = ${expected}`, 'u'),
        );
    });
}

for (const [contentLanguage, locale, foreignExamples, alwaysExamples] of [
    ['zh', 'en', 'en, ja, ru', 'zh, en, ja, ru'],
    ['en', 'zh-Hans', 'de, ja, ru', 'en, de, ja, ru'],
    ['zh', 'ja', 'en, ja, ru', 'zh, en, ja, ru'],
    ['en', 'ru', 'de, ja, ru', 'en, de, ja, ru'],
] as const) {
    test(`shared Source Editor formatting uses ${contentLanguage} content language with ${locale} interface and restores saved citation choices`, async ({
        page,
    }) => {
        const source =
            '<ref>{{Cite web|title=English title|language=en}}</ref>';
        await mountFormatter(page, {
            source,
            wikiId: 'zhwiki',
            contentLanguage,
            locale,
        });
        const messages = {
            en: english,
            ja: japanese,
            ru: russian,
            'zh-Hans': simplifiedChinese,
        }[locale];
        const dialog = page.locator('.kanade-source-editor-dialog');
        await expect(dialog).toHaveAccessibleName(messages['dialog.title']);
        const bounds = await dialog.boundingBox();
        expect(bounds?.width).toBeGreaterThan(900);
        expect(bounds?.width).toBeLessThanOrEqual(1024);
        await expect(
            dialog.getByRole('tab', {
                name: messages['dialog.formattingTab'],
                exact: true,
            }),
        ).toHaveAttribute('aria-selected', 'true');
        const citations = dialog.getByRole('group', {
            name: messages['dialog.referenceFormatting'],
            exact: true,
        });
        await citations
            .getByRole('checkbox', {
                name: messages['dialog.formatReferences'],
                exact: true,
            })
            .check();
        const scriptTitle = citations.getByRole('group', {
            name: messages['tools.scriptTitle'],
            exact: true,
        });
        await expect(scriptTitle.getByRole('checkbox')).toBeEnabled();
        await expect(scriptTitle.getByRole('radio')).toHaveCount(3);
        await expect(scriptTitle).toContainText(foreignExamples);
        await expect(scriptTitle).toContainText(alwaysExamples);
        await scriptTitle
            .getByRole('radio', {
                name: messages['tools.scriptTitleAlways'],
                exact: true,
            })
            .check();
        await dialog.locator('.kanade-source-editor-dialog__save').click();
        await expect
            .poll(
                async () =>
                    (await storedSettings(page))?.citationFormatting
                        .scriptTitleMode,
            )
            .toBe('always');
        await expect(page.locator('#wpTextbox1')).toHaveValue(source);
        await dialog.locator('.kanade-source-editor-dialog__cancel').click();
        await page.locator('#kanade-source-editor-panel a').click();
        await expect(
            scriptTitle.getByRole('radio', {
                name: messages['tools.scriptTitleAlways'],
                exact: true,
            }),
        ).toBeChecked();
        await dialog
            .getByRole('tab', {
                name: messages['dialog.referencesTab'],
                exact: true,
            })
            .click();
        await expect(dialog.getByRole('checkbox')).toHaveCount(0);
        await dialog
            .getByRole('button', {
                name: messages['dialog.manageReferences'],
                exact: true,
            })
            .click();
        const manager = page.locator('.kanade-source-editor-source-manager');
        await manager
            .getByRole('tab', { name: messages['tabs.tools'], exact: true })
            .click();
        await expect(manager.getByRole('checkbox')).toHaveCount(0);
        await manager
            .getByRole('button', {
                name: messages['tools.openFormattingSettings'],
                exact: true,
            })
            .click();
        await expect(manager).toBeHidden();
        await expect(dialog).toBeVisible();
        await expect(
            scriptTitle.getByRole('radio', {
                name: messages['tools.scriptTitleAlways'],
                exact: true,
            }),
        ).toBeChecked();
        await expect(page.locator('#wpTextbox1')).toHaveValue(source);
    });
}

for (const [locale, messages] of [
    ['en', english],
    ['ru', russian],
] as const) {
    test(`${locale} citation rows use the available dialog width without overflowing native controls`, async ({
        page,
    }) => {
        const source =
            '<ref name="web">{{Cite web|title=' +
            'A long citation title '.repeat(12) +
            '|url=https://example.org/' +
            'long-path-segment/'.repeat(30) +
            '|website=Example|author=Example Author}}</ref>';
        await page.setViewportSize({ width: 1366, height: 768 });
        await mountFormatter(page, { source, wikiId: 'enwiki', locale });
        // ResourceLoader can append host styles after the tool's own CSS.
        await page.addStyleTag({
            path: fileURLToPath(
                import.meta
                    .resolve('@wikimedia/codex/dist/codex.style-bidi.css'),
            ),
        });
        expect(
            (await page.locator('.kanade-source-editor-dialog').boundingBox())
                ?.width,
        ).toBe(1024);
        await page
            .getByRole('tab', {
                name: messages['dialog.referencesTab'],
                exact: true,
            })
            .click();
        await page
            .getByRole('button', {
                name: messages['dialog.manageReferences'],
                exact: true,
            })
            .click();
        const manager = page.locator('.kanade-source-editor-source-manager');
        await expect(manager).toBeVisible();
        expect((await manager.boundingBox())?.width).toBe(1024);
        await manager
            .getByRole('button', {
                name: messages['lookup.editSource'],
                exact: true,
            })
            .first()
            .click();
        const draft = page.locator(
            '.kanade-source-editor-source-manager__draft-dialog',
        );
        await expect(draft).toBeVisible();
        for (const [width, height] of [
            [1366, 768],
            [880, 768],
            [683, 768],
            [375, 667],
        ]) {
            await page.setViewportSize({ width, height });
            await expectCitationRowLayout(draft, width >= 880);
            const footer = draft.locator('.cdx-dialog__footer');
            const footerDimensions = await footer.evaluate((element) => ({
                width: element.clientWidth,
                scroll: element.scrollWidth,
            }));
            expect(
                footerDimensions.scroll,
                'Citation actions remain within the dialog in long translations',
            ).toBeLessThanOrEqual(footerDimensions.width + 1);
            await capture(page, `citation-layout-${locale}-${width}`);
        }
        await page.setViewportSize({ width: 1366, height: 768 });
        await draft
            .locator('.kanade-source-editor-source-manager__parameter-editor')
            .evaluate((element) => {
                (element as HTMLElement).style.maxWidth = '260px';
            });
        await expectCitationRowLayout(draft, false);
        await expect(page.locator('#wpTextbox1')).toHaveValue(source);
    });
}

test('Source Editor source-manager edits share the editor selection and undo history', async ({
    page,
}) => {
    const source =
        'Lead selected words.\n<ref name="web">{{Cite web|title=Original title|url=https://example.org/source|website=Example}}</ref>\nEnd.';
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mountFormatter(page, { source, wikiId: 'enwiki', open: false });
    const textarea = page.locator('#wpTextbox1');
    const editor = page
        .frameLocator('.kanade-source-editor-frame')
        .locator('.kanade-source-editor-editor');
    await editor.focus();
    await editor.evaluate((element) => {
        const document = element.ownerDocument;
        const text = document
            .createTreeWalker(element, NodeFilter.SHOW_TEXT)
            .nextNode();
        if (!text) throw new Error('The source editor has no text.');
        const range = document.createRange();
        range.setStart(text, 5);
        range.setEnd(text, 13);
        const selection = document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    });
    await expect
        .poll(() =>
            textarea.evaluate((element) => [
                (element as HTMLTextAreaElement).selectionStart,
                (element as HTMLTextAreaElement).selectionEnd,
            ]),
        )
        .toEqual([5, 13]);
    await expect(page.locator('#p-cactions a')).toHaveCount(1);
    await expect(page.locator('#kanade-source-editor-panel')).toHaveCount(1);
    await page.locator('#kanade-source-editor-panel a').click();
    await page.getByRole('tab', { name: 'References', exact: true }).click();
    await capture(page, 'source-editor-references-panel');
    await page
        .getByRole('button', { name: 'Manage references', exact: true })
        .click();
    const manager = page.locator('.kanade-source-editor-source-manager');
    await expect(manager).toBeVisible();
    await capture(page, 'source-editor-references-manager');
    await manager
        .getByRole('button', { name: 'Edit source', exact: true })
        .first()
        .click();
    const draft = page.getByRole('dialog', {
        name: 'Edit citation source',
        exact: true,
    });
    await expect(draft).toBeVisible();
    await expect(
        draft
            .locator('.kanade-source-editor-source-manager__footer-actions')
            .getByRole('button', { name: 'Cancel', exact: true }),
    ).toHaveClass(/cdx-button--weight-quiet/u);
    for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await expectReferenceEditorLayout(draft);
        await capture(page, `source-editor-reference-editor-${width}`);
    }
    await draft
        .getByRole('textbox', { name: /title content/u })
        .fill('Revised citation title');
    await draft
        .getByRole('button', { name: 'Save citation', exact: true })
        .click();
    await expect(draft).toBeHidden();
    await expect(textarea).toHaveValue(/Revised citation title/u);
    const accepted = await textarea.inputValue();
    expect(accepted).toMatch(/^Lead selected words\.\n/u);
    expect(accepted).toMatch(/\nEnd\.$/u);
    await manager
        .locator('.cdx-dialog__footer')
        .getByRole('button', { name: 'Close', exact: true })
        .click();
    await expect(manager).toBeHidden();
    await expect(editor).toHaveText(accepted);
    await expect
        .poll(() =>
            textarea.evaluate((element) => [
                (element as HTMLTextAreaElement).selectionStart,
                (element as HTMLTextAreaElement).selectionEnd,
            ]),
        )
        .toEqual([5, 13]);
    await editor.focus();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(textarea).toHaveValue(source);
    await expect(editor).toHaveText(source);
    expect(
        await editor.evaluate((element) =>
            element.ownerDocument.getSelection()?.toString(),
        ),
    ).toBe('selected');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(textarea).toHaveValue(accepted);
    await expect(editor).toHaveText(accepted);
    expect(errors).toEqual([]);
});

for (const direction of ['ltr', 'rtl']) {
    test(`dialog actions follow reading and keyboard order in ${direction}`, async ({
        page,
    }) => {
        await mountFormatter(page, { direction });
        const cancel = page
            .getByRole('dialog')
            .locator('.kanade-source-editor-dialog__cancel');
        const save = page
            .getByRole('dialog')
            .locator('.kanade-source-editor-dialog__save');
        const primary = page
            .getByRole('dialog')
            .locator('.kanade-source-editor-dialog__primary');
        const more = page.getByRole('button', {
            name: 'More options',
            exact: true,
        });
        await expect(save).toHaveAccessibleName('Save settings');
        await expect(save).toHaveAttribute('type', 'button');
        await expect(save).toHaveClass(/cdx-button--weight-normal/u);
        await expect(save).toHaveClass(/cdx-button--action-default/u);
        await expect(
            page.getByRole('dialog').locator('.cdx-button--weight-primary'),
        ).toHaveCount(1);
        await more.focus();
        await page.keyboard.press('Tab');
        await expect(cancel).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(save).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(primary).toBeFocused();
        const cancelBox = await cancel.boundingBox();
        const saveBox = await save.boundingBox();
        const primaryBox = await primary.boundingBox();
        expect(
            direction === 'ltr'
                ? cancelBox!.x < saveBox!.x && saveBox!.x < primaryBox!.x
                : cancelBox!.x > saveBox!.x && saveBox!.x > primaryBox!.x,
        ).toBe(true);
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(
            page
                .getByRole('dialog')
                .locator('.kanade-source-editor-dialog__actions button')
                .first(),
        ).toHaveClass(/kanade-source-editor-dialog__primary/u);
        await primary.focus();
        await page.keyboard.press('Tab');
        await expect(save).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(more).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(cancel).toBeFocused();
        const stackedPrimaryBox = (await primary.boundingBox())!;
        const stackedSaveBox = (await save.boundingBox())!;
        const stackedMoreBox = (await more.boundingBox())!;
        const stackedCancelBox = (await cancel.boundingBox())!;
        expect(stackedPrimaryBox.y).toBeLessThan(stackedSaveBox.y);
        expect(stackedSaveBox.y).toBeLessThan(stackedCancelBox.y);
        expect(stackedSaveBox.x).toBeCloseTo(stackedPrimaryBox.x, 0);
        expect(stackedSaveBox.width).toBeCloseTo(stackedPrimaryBox.width, 0);
        expect(stackedMoreBox.y).toBeCloseTo(stackedCancelBox.y, 0);
        expect(
            direction === 'ltr'
                ? stackedMoreBox.x < stackedCancelBox.x
                : stackedMoreBox.x > stackedCancelBox.x,
        ).toBe(true);
    });
}

test('opens the native portlet link with Enter and preserves skin markup', async ({
    page,
}) => {
    await mountFormatter(page, { open: false });
    const item = page.locator('#kanade-source-editor-panel');
    const link = item.getByRole('link');
    await expect(item).toHaveJSProperty('tagName', 'LI');
    await expect(link).toHaveClass('skin-portlet-link');
    await expect(link.locator('span')).toHaveClass('skin-portlet-label');
    await expect(item.getByRole('button')).toHaveCount(0);
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveAccessibleName(
        'Source Editor',
    );
});

test('Codex tabs expose relevant controls and a live template example', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mountFormatter(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAccessibleName('Source Editor');
    await expect(page.getByRole('tab')).toHaveCount(4);
    await expect(
        page.getByRole('tab', { name: 'Formatting', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
        page.getByRole('button', { name: 'Format page', exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole('checkbox', {
            name: 'Fix template aliases',
            exact: true,
        }),
    ).toBeHidden();
    await capture(page, 'formatting-en');
    await page
        .getByRole('checkbox', {
            name: 'Replace redirects with target page titles',
            exact: true,
        })
        .check();
    await expect(
        page.getByRole('checkbox', {
            name: 'Fix template aliases',
            exact: true,
        }),
    ).toBeVisible();

    const formattingTab = page.getByRole('tab', {
        name: 'Formatting',
        exact: true,
    });
    await formattingTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(
        page.getByRole('tab', { name: 'References', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(
        page.getByRole('tab', { name: 'Highlighting settings', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(
        page.getByRole('tab', { name: 'Tools', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
        page.getByRole('textbox', { name: 'Find 1', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(formattingTab).toHaveAttribute('aria-selected', 'true');
    const example = dialog.locator('pre');
    const original = await example.innerText();
    await page
        .getByRole('radio', { name: 'Align values', exact: true })
        .check();
    await page.getByRole('radio', { name: 'Align names', exact: true }).check();
    await expect.poll(() => example.innerText()).not.toBe(original);
    await expect(
        page.getByRole('group', { name: /^Character width for alignment/ }),
    ).toBeVisible();
    const threeToFive = await example.innerText();
    await page.getByRole('radio', { name: '1:2', exact: true }).check();
    await expect.poll(() => example.innerText()).not.toBe(threeToFive);
    const tracks = (await example.innerText()).split('\n');
    expect(tracks).toHaveLength(12);
    expect(tracks[0]).toBe('{{Tracklists');
    expect(tracks[3]).toMatch(/title1.*春日来信.*note1.*length1/u);
    expect(tracks[8]).toMatch(/title1.*漫长的旅途.*note1.*length1/u);
    const indentation = page.getByRole('checkbox', {
        name: 'Indent nested templates',
        exact: true,
    });
    const indentSpaces = page.getByRole('spinbutton', {
        name: 'Spaces per indentation level',
        exact: true,
    });
    const skipFirstLevel = page.getByRole('checkbox', {
        name: 'Leave the first nesting level unindented',
        exact: true,
    });
    await expect(indentation).not.toBeChecked();
    await expect(indentSpaces).toHaveValue('2');
    await expect(indentSpaces).toHaveAttribute('min', '0');
    await expect(indentSpaces).toBeDisabled();
    await expect(skipFirstLevel).toBeDisabled();
    await indentation.check();
    await indentSpaces.fill('12');
    expect(await example.innerText()).toMatch(
        /^ {24}\| heading\s*= Side A.*\| comment\s*= \.\.\.$/mu,
    );
    await skipFirstLevel.check();
    expect(await example.innerText()).toMatch(
        /^ {12}\| heading\s*= Side A.*\| comment\s*= \.\.\.$/mu,
    );
    await indentation.uncheck();
    await indentation.check();
    await expect(indentSpaces).toHaveValue('12');
    await expect(skipFirstLevel).toBeChecked();
    await indentSpaces.fill('0');
    await expect(skipFirstLevel).toBeEnabled();
    expect(await example.innerText()).toMatch(
        /^\| heading\s*= Side A.*\| comment\s*= \.\.\.$/mu,
    );
    await indentSpaces.fill('-1');
    await indentSpaces.blur();
    await expect(indentSpaces).toHaveValue('0');
    await indentSpaces.fill('');
    await indentSpaces.blur();
    await expect(indentSpaces).toHaveValue('2');
    await indentSpaces.fill('9007199254740991');
    await expect(example).toContainText('{{Tracklists');
    await indentSpaces.fill('2');
    const ids = await dialog
        .locator('[id]')
        .evaluateAll((elements) => elements.map((element) => element.id));
    expect(new Set(ids).size).toBe(ids.length);
    await example.scrollIntoViewIfNeeded();
    await capture(page, 'templates-en');

    await page
        .getByRole('tab', { name: 'Highlighting settings', exact: true })
        .click();
    await expect(
        page.getByText(
            'Change how the editor looks and shows previews. These options do not change the wikitext.',
            { exact: true },
        ),
    ).toBeInViewport();
    await expect(
        page.getByRole('button', { name: 'Apply settings', exact: true }),
    ).toBeVisible();
    const groups = page
        .getByRole('tabpanel', {
            name: 'Highlighting settings',
            exact: true,
        })
        .getByRole('group');
    const expectedGroups = [
        {
            name: 'Syntax highlighting',
            controls: [
                'Use Source Editor to highlight wikitext pages',
                'Use CodeMirror for other content models',
            ],
        },
        {
            name: 'Text and colors',
            controls: [
                'Use larger text',
                'Use smaller text for references and notes',
                'Alternate pink and blue for consecutive references',
            ],
        },
        {
            name: 'Links',
            controls: [
                /^Hold (?:Ctrl|Command) and click link source to open a new tab$/u,
                'Show page previews on hover',
                'Automatically mark missing page titles in red',
            ],
        },
        {
            name: 'Reference popups',
            controls: [
                'Reference tag inspection',
                'Read the full page source when editing a section',
                'Enable editing while inspecting references',
                'Use lightweight reference editing',
            ],
        },
    ];
    await expect(groups).toHaveCount(expectedGroups.length);
    for (const [index, expected] of expectedGroups.entries()) {
        const group = groups.nth(index);
        await expect(group).toHaveAccessibleName(expected.name);
        const controls = group.getByRole('checkbox');
        await expect(controls).toHaveCount(expected.controls.length);
        for (const [controlIndex, name] of expected.controls.entries()) {
            await expect(controls.nth(controlIndex)).toHaveAccessibleName(name);
        }
    }
    await capture(page, 'editor-en');
    await page
        .getByRole('checkbox', {
            name: 'Reference tag inspection',
            exact: true,
        })
        .uncheck();
    await expect(
        page.getByRole('checkbox', {
            name: 'Read the full page source when editing a section',
            exact: true,
        }),
    ).toBeDisabled();
    await page
        .getByRole('button', { name: 'More options', exact: true })
        .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();
    await capture(page, 'menu-en');
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expectSuccessNotification(
        page,
        'cache-cleared',
        'Cache cleared. Data will reload as needed.',
    );
    await page
        .getByRole('button', { name: 'Cancel', exact: true })
        .last()
        .click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#wpTextbox1')).toHaveValue(initialSource);
    expect(errors).toEqual([]);
});

test('cancel and Escape discard display changes and restore keyboard focus', async ({
    page,
}) => {
    await mountFormatter(page);
    const editor = page
        .frameLocator('.kanade-source-editor-frame')
        .locator('.kanade-source-editor-editor');
    const before = await editor.evaluate(
        (element) => getComputedStyle(element).fontSize,
    );
    await page
        .getByRole('tab', { name: 'Highlighting settings', exact: true })
        .click();
    await page
        .getByRole('checkbox', { name: 'Use larger text', exact: true })
        .check();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(
        await editor.evaluate((element) => getComputedStyle(element).fontSize),
    ).toBe(before);
    await expect(page.locator('#kanade-source-editor-panel a')).toBeFocused();
    await page.locator('#kanade-source-editor-panel a').click();
    await page
        .getByRole('tab', { name: 'Highlighting settings', exact: true })
        .click();
    await expect(
        page.getByRole('checkbox', { name: 'Use larger text', exact: true }),
    ).not.toBeChecked();
});

test('overlapping formatter loads create one dialog and one cleanup owner', async ({
    page,
}) => {
    await mountFormatter(page, { open: false });
    await page.evaluate(() => {
        const original = mw.loader.using;
        const pending: Array<() => void> = [];
        (globalThis as any).__completeDialogLoads = () =>
            pending.splice(0).forEach((resolve) => resolve());
        mw.loader.using = ((modules: string[]) =>
            new Promise((resolve) => {
                pending.push(() => resolve(original(modules)));
            })) as unknown as typeof mw.loader.using;
    });
    await page.locator('#kanade-source-editor-panel a').click();
    await page.locator('#kanade-source-editor-panel a').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.evaluate(() => (globalThis as any).__completeDialogLoads());
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.locator('#kanade-source-editor-dialog-host')).toHaveCount(
        1,
    );

    await page
        .getByRole('button', { name: 'Cancel', exact: true })
        .last()
        .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#kanade-source-editor-dialog-host')).toHaveCount(
        0,
    );
});

test('editor settings apply without formatting and persist only when requested', async ({
    page,
}) => {
    await mountFormatter(page);
    await page
        .getByRole('tab', { name: 'Highlighting settings', exact: true })
        .click();
    const codeMirror = page.getByRole('checkbox', {
        name: 'Use CodeMirror for other content models',
        exact: true,
    });
    await expect(codeMirror).not.toBeChecked();
    await expect(
        page.getByRole('link', { name: 'CodeMirror' }),
    ).toHaveAttribute(
        'href',
        'https://www.mediawiki.org/wiki/Extension:CodeMirror',
    );
    await codeMirror.check();
    await page
        .getByRole('checkbox', { name: 'Use larger text', exact: true })
        .check();
    await page
        .getByRole('button', { name: 'Apply settings', exact: true })
        .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#wpTextbox1')).toHaveValue(initialSource);
    expect(await storedSettings(page)).toBeNull();
    await page.locator('#kanade-source-editor-panel a').click();
    await page
        .getByRole('tab', { name: 'Highlighting settings', exact: true })
        .click();
    await expect(
        page.getByRole('checkbox', { name: 'Use larger text', exact: true }),
    ).toBeChecked();
    await expect(codeMirror).toBeChecked();
    await codeMirror.uncheck();
    await page
        .getByRole('checkbox', { name: 'Use larger text', exact: true })
        .uncheck();
    const save = page.getByRole('button', {
        name: 'Save settings',
        exact: true,
    });
    await save.focus();
    await page.keyboard.press('Enter');
    await expectSuccessNotification(
        page,
        'settings-saved',
        'Settings saved in this browser.',
    );
    expect((await storedSettings(page))?.largeFont).toBe(false);
    expect((await storedSettings(page))?.useCodeMirrorForOtherModels).toBe(
        false,
    );
    // Saving changed choices again must work, too.
    await page
        .getByRole('checkbox', { name: 'Use larger text', exact: true })
        .check();
    await codeMirror.check();
    await save.focus();
    await page.keyboard.press('Space');
    await expectSuccessNotification(
        page,
        'settings-saved',
        'Settings saved in this browser.',
        2,
    );
    expect((await storedSettings(page))?.largeFont).toBe(true);
    expect((await storedSettings(page))?.useCodeMirrorForOtherModels).toBe(
        true,
    );
    await expect(page.locator('#wpTextbox1')).toHaveValue(initialSource);
    await page
        .getByRole('button', { name: 'Cancel', exact: true })
        .last()
        .click();
    expect((await storedSettings(page))?.largeFont).toBe(true);
});

test('Ctrl/Cmd-click navigation can be disabled, saved, and re-enabled', async ({
    page,
}) => {
    const source = 'A [[Example navigation target]] B';
    const setting = page.getByRole('checkbox', {
        name: /^Hold (?:Ctrl|Command) and click link source to open a new tab$/u,
        exact: true,
    });
    const openHighlighting = async () => {
        await page
            .getByRole('tab', { name: 'Highlighting settings', exact: true })
            .click();
    };
    const apply = page.getByRole('button', {
        name: 'Apply settings',
        exact: true,
    });
    const recordOpens = () =>
        page.evaluate(() => {
            const opened: string[] = [];
            (globalThis as any).__openedLinks = opened;
            window.open = (url) => {
                opened.push(String(url));
                return null;
            };
        });
    const clickLink = async () => {
        const link = page
            .frameLocator('.kanade-source-editor-frame')
            .locator(
                '.kanade-source-editor-editor [data-kanade-source-editor-href="/wiki/Example_navigation_target"]',
            )
            .filter({ hasText: 'Example navigation target' });
        await link.evaluate((element) =>
            element.ownerDocument.getSelection()?.removeAllRanges(),
        );
        await link.click({
            modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'],
        });
    };
    const openedLinks = () =>
        page.evaluate(() => (globalThis as any).__openedLinks);

    await mountFormatter(page, { source });
    await recordOpens();
    await openHighlighting();
    await expect(setting).toBeChecked();
    await setting.uncheck();
    await apply.click();
    await clickLink();
    expect(await openedLinks()).toEqual([]);
    await expect(page.locator('#wpTextbox1')).toHaveValue(source);

    await page.locator('#kanade-source-editor-panel a').click();
    await openHighlighting();
    await expect(setting).not.toBeChecked();
    await page
        .getByRole('button', { name: 'Save settings', exact: true })
        .click();
    expect((await storedSettings(page))?.ctrlClickLinks).toBe(false);

    await mountFormatter(page, { source });
    await recordOpens();
    await openHighlighting();
    await expect(setting).not.toBeChecked();
    await page
        .getByRole('button', { name: 'Cancel', exact: true })
        .last()
        .click();
    await clickLink();
    expect(await openedLinks()).toEqual([]);

    await page.locator('#kanade-source-editor-panel a').click();
    await openHighlighting();
    await setting.check();
    const highlighting = page.getByRole('checkbox', {
        name: 'Use Source Editor to highlight wikitext pages',
        exact: true,
    });
    await highlighting.uncheck();
    await expect(setting).toBeDisabled();
    await highlighting.check();
    await expect(setting).toBeChecked();
    await apply.click();
    await clickLink();
    expect(await openedLinks()).toEqual(['/wiki/Example_navigation_target']);
    await expect(page.locator('#wpTextbox1')).toHaveValue(source);
});

for (const [platform, modifier] of [
    ['MacIntel', 'Command'],
    ['Win32', 'Ctrl'],
] as const) {
    test(`link navigation names ${modifier} on ${platform} and limits its description to Chinese Wikipedia`, async ({
        page,
    }) => {
        for (const wikiId of ['zhwiki', 'examplewiki']) {
            await mountFormatter(page, { locale: 'en', platform, wikiId });
            await page
                .getByRole('tab', {
                    name: 'Highlighting settings',
                    exact: true,
                })
                .click();
            await expect(
                page.getByRole('checkbox', {
                    name: `Hold ${modifier} and click link source to open a new tab`,
                    exact: true,
                }),
            ).toBeVisible();
            const description = page.getByText(
                'Also supports the foreign page title in interlanguage link templates.',
                { exact: true },
            );
            if (wikiId === 'zhwiki') {
                await expect(description).toBeVisible();
            } else {
                await expect(description).toHaveCount(0);
            }
            const documentation = page.getByRole('link', {
                name: 'interlanguage link templates',
                exact: true,
            });
            await expect(documentation).toHaveCount(
                wikiId === 'zhwiki' ? 3 : 1,
            );
            for (const link of await documentation.all()) {
                await expect(link).toHaveAttribute(
                    'href',
                    wikiId === 'zhwiki'
                        ? '/wiki/Category:内部链接助手模板'
                        : 'https://zh.wikipedia.org/wiki/Category:%E5%86%85%E9%83%A8%E9%93%BE%E6%8E%A5%E5%8A%A9%E6%89%8B%E6%A8%A1%E6%9D%BF',
                );
                await expect(link).toHaveAttribute('target', '_blank');
                await expect(link).toHaveAttribute(
                    'rel',
                    'noopener noreferrer',
                );
            }
            await expect(page.getByRole('dialog')).not.toContainText(
                '{{link-en}}',
            );
            await expect(page.getByRole('dialog')).not.toContainText('{{tsl}}');
        }
    });
}

test('alternating reference backgrounds follow applied settings and survive saving', async ({
    page,
}) => {
    const source =
        '<ref>First</ref><ref name="second" />{{sfn|a}}<ref name="third">Third</ref>' +
        ' prose {{efn|Note one}}{{efn|Note two}}' +
        ' prose <ref>Mixed ref</ref>{{efn|Mixed note}}' +
        ' prose {{efn|Outer note <ref>Nested ref</ref>}}{{efn|Next note}}';
    await mountFormatter(page, { source });
    const editor = page
        .frameLocator('.kanade-source-editor-frame')
        .locator('.kanade-source-editor-editor');
    const setting = page.getByRole('checkbox', {
        name: 'Alternate pink and blue for consecutive references',
        exact: true,
    });
    const apply = page.getByRole('button', {
        name: 'Apply settings',
        exact: true,
    });
    const openHighlighting = async () => {
        await page
            .getByRole('tab', { name: 'Highlighting settings', exact: true })
            .click();
    };
    const styleAt = (text: string) =>
        editor.evaluate((element, offset) => {
            let remaining = offset;
            for (const node of element.childNodes) {
                const length = node.textContent?.length ?? 0;
                if (remaining < length) {
                    const style = getComputedStyle(
                        node instanceof Element ? node : element,
                    );
                    return {
                        background: style.backgroundColor,
                        color: style.color,
                    };
                }
                remaining -= length;
            }
            throw new Error('Reference text was not rendered');
        }, source.indexOf(text));

    await openHighlighting();
    await expect(setting).not.toBeChecked();
    const normal = await styleAt('First');
    const second = await styleAt('second');
    expect(normal.background).toBe('rgb(243, 225, 247)');
    expect(second.background).toBe(normal.background);
    const templateBackground = 'rgb(246, 246, 246)';
    expect((await styleAt('Note one')).background).toBe(templateBackground);
    expect((await styleAt('Note two')).background).toBe(templateBackground);
    expect((await styleAt('Nested ref')).background).toBe(normal.background);
    await setting.check();
    await page
        .getByRole('button', { name: 'Save settings', exact: true })
        .click();
    expect((await storedSettings(page))?.alternateReferenceColors).toBe(true);
    expect(await styleAt('second')).toEqual(second);
    await apply.click();
    await expect
        .poll(async () => (await styleAt('second')).background)
        .not.toBe(normal.background);
    const alternate = await styleAt('second');
    expect(alternate.background).toBe('rgb(230, 242, 255)');
    expect(alternate.color).toBe(second.color);
    expect((await styleAt('Note one')).background).toBe(templateBackground);
    expect((await styleAt('Note two')).background).toBe(templateBackground);
    expect((await styleAt('Mixed ref')).background).toBe(normal.background);
    expect((await styleAt('Mixed note')).background).toBe(templateBackground);
    expect((await styleAt('Outer note')).background).toBe(templateBackground);
    expect((await styleAt('Nested ref')).background).toBe(normal.background);
    expect((await styleAt('Next note')).background).toBe(templateBackground);
    expect((await styleAt('sfn')).background).toBe(alternate.background);
    expect((await styleAt('Third')).background).toBe(normal.background);
    await expect(page.locator('#wpTextbox1')).toHaveValue(source);

    await mountFormatter(page, { source });
    await openHighlighting();
    await expect(setting).toBeChecked();
    expect((await styleAt('second')).background).toBe(alternate.background);
    const highlighting = page.getByRole('checkbox', {
        name: 'Use Source Editor to highlight wikitext pages',
        exact: true,
    });
    await highlighting.uncheck();
    await expect(setting).toBeDisabled();
    await apply.click();
    await expect(page.locator('.kanade-source-editor-frame')).toHaveCount(0);
    await expect(page.locator('#wpTextbox1')).toBeVisible();
    await page.locator('#kanade-source-editor-panel a').click();
    await openHighlighting();
    await highlighting.check();
    await expect(setting).toBeChecked();
    await apply.click();
    await expect
        .poll(async () => (await styleAt('second')).background)
        .toBe(alternate.background);

    await page.locator('#kanade-source-editor-panel a').click();
    await openHighlighting();
    await setting.uncheck();
    await apply.click();
    await expect
        .poll(async () => (await styleAt('second')).background)
        .toBe(normal.background);
    await expect(page.locator('#wpTextbox1')).toHaveValue(source);
});

test('Efn and NoteTag retain small template shading while embedded references alternate colors', async ({
    page,
}) => {
    const source =
        '游戏中的角色向玩家道别<ref name=":4" /><ref name="DREAM" ' +
        'details="{{URL|https://example.test/interview|55億年後になくなる地球}}. 完結編 :2" />' +
        '{{Efn|部分游戏内容译名综合参考自以下来源：' +
        '{{lang|en|[[Note link]]}} https://example.test/note &nbsp; ' +
        '<ref>{{Cite web |title=MOTHER系列参战斗士 琉加 #37 {{!}} 任天堂明星大乱斗 特别版 ' +
        '|url=https://example.test/fighter |language=zh-Hans}}</ref>' +
        '<ref name=":2" details="{{URL|https://example.test/guide|地球冒险3}}. 攻略人行道 :90-93" />' +
        '<ref name="UCG" details="阿修罗. {{url|https://example.test/mother3|Mother3 攻略透解}} :58-63" />' +
        '<ref>{{Cite journal |author=张永 |title=地球冒险3 接上期 ' +
        '|url=https://example.test/journal |journal=掌机迷 |page=78-83}}</ref>}}。' +
        ' {{outer|{{NoteTag|Nested note {{lang|en|Nested value}}}}}}';
    await mountFormatter(page, {
        source,
        settings: {
            ...createDefaultFormatterSettings(),
            alternateReferenceColors: true,
        },
    });
    const editor = page
        .frameLocator('.kanade-source-editor-frame')
        .locator('.kanade-source-editor-editor');
    const pink = 'rgb(243, 225, 247)';
    const blue = 'rgb(230, 242, 255)';
    const gray = 'rgb(246, 246, 246)';
    const nestedGray = 'rgb(228, 228, 228)';
    const deeperGray = 'rgb(218, 218, 218)';
    const expectedStyles = [
        [':4', pink],
        ['DREAM', blue],
        ['55億年後', blue],
        ['Efn', gray],
        ['部分游戏内容', gray],
        ['lang', nestedGray],
        ['en|', nestedGray],
        ['Note link', nestedGray],
        ['https://example.test/note', gray],
        ['&nbsp;', gray],
        ['<ref>{{Cite web', pink],
        ['MOTHER系列', pink],
        ['任天堂明星', pink],
        ['<ref name=":2"', blue],
        ['攻略人行道', blue],
        ['<ref name="UCG"', pink],
        ['Mother3 攻略', pink],
        ['<ref>{{Cite journal', blue],
        ['掌机迷', blue],
        ['</ref>}}', blue],
        ['}}。', gray],
        ['NoteTag', nestedGray],
        ['Nested note', nestedGray],
        ['Nested value', deeperGray],
    ] as const;
    const styles = () =>
        editor.evaluate(
            (element, offsets) =>
                offsets.map((offset) => {
                    let remaining = offset;
                    for (const node of element.childNodes) {
                        const length = node.textContent?.length ?? 0;
                        if (remaining < length) {
                            const style = getComputedStyle(
                                node instanceof Element ? node : element,
                            );
                            return {
                                background: style.backgroundColor,
                                fontSize: Number.parseFloat(style.fontSize),
                            };
                        }
                        remaining -= length;
                    }
                    throw new Error('Explanatory note text was not rendered');
                }),
            expectedStyles.map(([text]) => source.indexOf(text)),
        );
    const editorFontSize = await editor.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
    );
    const smallStyles = await styles();
    for (const [index, [text, background]] of expectedStyles.entries()) {
        expect(smallStyles[index]?.background, text).toBe(background);
        expect(smallStyles[index]?.fontSize, text).toBeCloseTo(
            editorFontSize * 0.86,
            2,
        );
    }

    await page
        .getByRole('tab', { name: 'Highlighting settings', exact: true })
        .click();
    await page
        .getByRole('checkbox', {
            name: 'Use smaller text for references and notes',
            exact: true,
        })
        .uncheck();
    await page
        .getByRole('button', { name: 'Apply settings', exact: true })
        .click();
    const fullStyles = await styles();
    for (const [index, [text, background]] of expectedStyles.entries()) {
        expect(fullStyles[index]?.background, text).toBe(background);
        expect(fullStyles[index]?.fontSize, text).toBe(editorFontSize);
    }
    await expect(editor).toHaveText(source);
    await expect(page.locator('#wpTextbox1')).toHaveValue(source);
});

test('reference editing stays visible under its disabled parent and retains saved choices', async ({
    page,
}) => {
    const source = '<ref>{{cite book|title=Book}}</ref>';
    await mountFormatter(page, { source, open: false });
    const frame = page.frameLocator('.kanade-source-editor-frame');
    const editor = frame.locator('.kanade-source-editor-editor');
    const reference = editor
        .locator('[data-kanade-source-editor-reference]')
        .first();
    const tooltip = frame.locator('.kanade-source-editor-tooltip');
    const setting = page.getByRole('checkbox', {
        name: 'Enable editing while inspecting references',
        exact: true,
    });
    const previews = page.getByRole('checkbox', {
        name: 'Reference tag inspection',
        exact: true,
    });
    const highlighting = page.getByRole('checkbox', {
        name: 'Use Source Editor to highlight wikitext pages',
        exact: true,
    });
    const lightweight = page.getByRole('checkbox', {
        name: 'Use lightweight reference editing',
        exact: true,
    });
    const fullPage = page.getByRole('checkbox', {
        name: 'Read the full page source when editing a section',
        exact: true,
    });
    const apply = page.getByRole('button', {
        name: 'Apply settings',
        exact: true,
    });
    const openHighlighting = async () => {
        await page.locator('#kanade-source-editor-panel a').click();
        await page
            .getByRole('tab', { name: 'Highlighting settings', exact: true })
            .click();
    };

    await reference.hover();
    await expect(
        tooltip.getByRole('button', {
            name: "Edit field 'title'",
            exact: true,
        }),
    ).toBeVisible();
    await expect(
        tooltip.getByRole('button', { name: 'Manage reference', exact: true }),
    ).toHaveCount(0);
    await editor.press('Escape');
    await openHighlighting();
    await expect(setting).toBeChecked();
    await expect(lightweight).not.toBeChecked();
    const parentBounds = await previews.boundingBox();
    const editingBounds = await setting.boundingBox();
    const fullPageBounds = await fullPage.boundingBox();
    const lightweightBounds = await lightweight.boundingBox();
    expect(parentBounds).not.toBeNull();
    expect(editingBounds).not.toBeNull();
    expect(fullPageBounds).not.toBeNull();
    expect(lightweightBounds).not.toBeNull();
    expect(editingBounds!.x).toBeCloseTo(parentBounds!.x, 0);
    expect(fullPageBounds!.x).toBeCloseTo(parentBounds!.x, 0);
    expect(lightweightBounds!.x).toBeCloseTo(editingBounds!.x, 0);
    await lightweight.check();
    await fullPage.check();
    await setting.uncheck();
    await expect(lightweight).toBeDisabled();
    await expect(lightweight).toBeChecked();
    await previews.uncheck();
    await expect(setting).toBeVisible();
    await expect(setting).toBeDisabled();
    await expect(fullPage).toBeVisible();
    await expect(fullPage).toBeDisabled();
    await expect(fullPage).toBeChecked();
    await expect(lightweight).toBeDisabled();
    await previews.check();
    await expect(setting).not.toBeChecked();
    await expect(fullPage).toBeEnabled();
    await expect(fullPage).toBeChecked();
    await highlighting.uncheck();
    await expect(setting).toBeDisabled();
    await highlighting.check();
    await expect(setting).toBeEnabled();
    await expect(setting).not.toBeChecked();
    await page
        .getByRole('button', { name: 'Save settings', exact: true })
        .click();
    expect((await storedSettings(page))?.referenceEditing).toBe(false);
    expect((await storedSettings(page))?.referencePreviews).toBe(true);
    expect((await storedSettings(page))?.referenceLightweightEditing).toBe(
        true,
    );
    expect((await storedSettings(page))?.fullPageReferencePreviews).toBe(true);
    await apply.click();
    await reference.hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Book');
    await expect(
        tooltip.getByRole('button', { name: /^Edit field /u }),
    ).toHaveCount(0);
    await expect(
        tooltip.getByRole('button', { name: 'Manage reference', exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('#wpTextbox1')).toHaveValue(source);

    await mountFormatter(page, { source, open: false });
    await reference.hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Book');
    await expect(
        tooltip.getByRole('button', { name: /^Edit field /u }),
    ).toHaveCount(0);
    await expect(
        tooltip.getByRole('button', { name: 'Manage reference', exact: true }),
    ).toHaveCount(0);
    await editor.press('Escape');
    await openHighlighting();
    await expect(setting).not.toBeChecked();
    await chooseMore(page, 'Reset settings');
    await expect(setting).toBeChecked();
    await expect(lightweight).not.toBeChecked();
    await expect(fullPage).not.toBeChecked();
    await apply.click();
    await reference.hover();
    await expect(
        tooltip.getByRole('button', {
            name: "Edit field 'title'",
            exact: true,
        }),
    ).toBeVisible();
    await expect(page.locator('#wpTextbox1')).toHaveValue(source);
});

test('section sub-references combine local details with the full-page parent', async ({
    page,
}) => {
    const source = '<ref name="Parent" details="p. 48" />';
    await mountFormatter(page, {
        source,
        section: true,
        open: false,
        pageSource:
            '<ref name="Parent">{{cite book|title=Outside section}}</ref>\n' +
            source,
        settings: {
            ...createDefaultFormatterSettings(),
            fullPageReferencePreviews: true,
        },
    });
    const frame = page.frameLocator('.kanade-source-editor-frame');
    const reference = frame
        .locator('[data-kanade-source-editor-reference]')
        .first();
    const tooltip = frame.locator('.kanade-source-editor-tooltip');

    await reference.hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Sub-reference content');
    await expect(tooltip).toContainText('p. 48');
    await expect(tooltip).toContainText('Outside section');
    await expect(
        tooltip.locator('.kanade-source-editor-tooltip__missing'),
    ).toHaveCount(0);
    await expect(frame.locator('.kanade-source-editor-editor')).toHaveText(
        source,
    );
    await expect(page.locator('#wpTextbox1')).toHaveValue(source);
});

test('Reset settings removes saved choices and restores both tabs without applying them', async ({
    page,
}) => {
    const settings = createDefaultFormatterSettings();
    settings.largeFont = true;
    settings.linkPreviews = true;
    settings.resolveRedirects = true;
    settings.formatter.indentBlockTemplates = true;
    settings.formatter.indentSpaces = 4;
    settings.formatter.skipFirstLevelIndentation = true;
    await mountFormatter(page, { settings });
    await page.evaluate(() =>
        localStorage.setItem('another-gadget.settings', 'keep this value'),
    );
    const editor = page
        .frameLocator('.kanade-source-editor-frame')
        .locator('.kanade-source-editor-editor');
    const initialFontSize = await editor.evaluate(
        (element) => getComputedStyle(element).fontSize,
    );
    // Establish an applied session override before resetting its saved base.
    await page
        .getByRole('tab', { name: 'Highlighting settings', exact: true })
        .click();
    await page
        .getByRole('checkbox', {
            name: 'Reference tag inspection',
            exact: true,
        })
        .uncheck();
    await page
        .getByRole('button', { name: 'Apply settings', exact: true })
        .click();
    await page.locator('#kanade-source-editor-panel a').click();
    const indentation = page.getByRole('checkbox', {
        name: 'Indent nested templates',
        exact: true,
    });
    const indentSpaces = page.getByRole('spinbutton', {
        name: 'Spaces per indentation level',
        exact: true,
    });
    await indentSpaces.fill('12');
    await chooseMore(page, 'Reset settings');

    await expectSuccessNotification(
        page,
        'settings-reset',
        'Settings reset. Saved settings were removed from this browser.',
    );
    expect(await storedSettings(page)).toBeNull();
    expect(
        await page.evaluate(() =>
            localStorage.getItem('another-gadget.settings'),
        ),
    ).toBe('keep this value');
    await expect(indentation).not.toBeChecked();
    await expect(indentSpaces).toHaveValue('2');
    await expect(indentSpaces).toBeDisabled();
    await expect(
        page.getByRole('checkbox', {
            name: 'Leave the first nesting level unindented',
            exact: true,
        }),
    ).not.toBeChecked();
    await expect(
        page.getByRole('checkbox', {
            name: 'Replace redirects with target page titles',
            exact: true,
        }),
    ).not.toBeChecked();
    await page
        .getByRole('tab', { name: 'Highlighting settings', exact: true })
        .click();
    await expect(
        page.getByRole('checkbox', { name: 'Use larger text', exact: true }),
    ).not.toBeChecked();
    await expect(
        page.getByRole('checkbox', {
            name: 'Show page previews on hover',
            exact: true,
        }),
    ).not.toBeChecked();
    await expect(
        page.getByRole('checkbox', {
            name: 'Reference tag inspection',
            exact: true,
        }),
    ).toBeChecked();
    await expect(page.locator('#wpTextbox1')).toHaveValue(initialSource);
    expect(
        await editor.evaluate((element) => getComputedStyle(element).fontSize),
    ).toBe(initialFontSize);

    // Reopening keeps formatter defaults and reflects the unchanged editor.
    await page
        .getByRole('button', { name: 'Cancel', exact: true })
        .last()
        .click();
    await page.locator('#kanade-source-editor-panel a').click();
    await expect(indentation).not.toBeChecked();
    await expect(indentSpaces).toHaveValue('2');
    await page
        .getByRole('tab', { name: 'Highlighting settings', exact: true })
        .click();
    await expect(
        page.getByRole('checkbox', { name: 'Use larger text', exact: true }),
    ).toBeChecked();
    await expect(
        page.getByRole('checkbox', {
            name: 'Reference tag inspection',
            exact: true,
        }),
    ).not.toBeChecked();
    expect(await storedSettings(page)).toBeNull();
});

test('failed Reset settings preserves saved settings and the current draft', async ({
    page,
}) => {
    const settings = createDefaultFormatterSettings();
    settings.formatter.indentBlockTemplates = true;
    settings.formatter.indentSpaces = 4;
    await mountFormatter(page, { settings });
    const indentSpaces = page.getByRole('spinbutton', {
        name: 'Spaces per indentation level',
        exact: true,
    });
    await indentSpaces.fill('12');
    await page.evaluate(() => {
        Storage.prototype.removeItem = () => {
            throw new Error('Fixture removal unavailable');
        };
    });
    await chooseMore(page, 'Reset settings');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.cdx-message--error')).toContainText(
        'Could not reset settings. Try again.',
    );
    expect(await nativeNotifications(page)).toEqual([]);
    expect(await storedSettings(page)).toEqual(settings);
    await expect(indentSpaces).toHaveValue('12');
    await expect(indentSpaces).toBeEnabled();
    await expect(
        page.getByRole('checkbox', {
            name: 'Indent nested templates',
            exact: true,
        }),
    ).toBeChecked();
    await expect(
        page.getByRole('button', { name: 'Format page', exact: true }),
    ).toBeEnabled();
    await expect(page.locator('#wpTextbox1')).toHaveValue(initialSource);
});

test('format selection uses the range captured before dialog focus moves', async ({
    page,
}) => {
    const source = '[[ Selected ]]\n\n[[ Untouched ]]';
    await mountFormatter(page, { source, open: false });
    const editor = page
        .frameLocator('.kanade-source-editor-frame')
        .locator('.kanade-source-editor-editor');
    await editor.focus();
    await editor.evaluate((element) => {
        const range = element.ownerDocument.createRange();
        range.selectNodeContents(element);
        const walker = element.ownerDocument.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
        );
        let remaining = '[[ Selected ]]'.length;
        while (walker.nextNode()) {
            const length = walker.currentNode.textContent?.length ?? 0;
            if (remaining <= length) {
                range.setEnd(walker.currentNode, remaining);
                break;
            }
            remaining -= length;
        }
        const selection = element.ownerDocument.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    });
    await page.locator('#kanade-source-editor-panel a').click();
    await page
        .getByRole('button', { name: 'Format selection', exact: true })
        .click();
    await expect(page.locator('#wpTextbox1')).toHaveValue(
        '[[Selected]]\n\n[[ Untouched ]]',
    );
    expect(
        await page
            .locator('#editform')
            .evaluate((form: HTMLFormElement) =>
                new FormData(form).get('wpTextbox1'),
            ),
    ).toBe('[[Selected]]\n\n[[ Untouched ]]');
});

for (const [locale, label] of [
    ['en', 'Format'],
    ['zh-Hant', '格式化'],
] as const) {
    test(`the ${locale} Format shortcut formats a selection directly and preserves editor undo`, async ({
        page,
    }) => {
        const source = '[[ Selected ]]\n\n[[ Untouched ]]';
        await mountFormatter(page, { source, locale, open: false });
        const textarea = page.locator('#wpTextbox1');
        const editor = page
            .frameLocator('.kanade-source-editor-frame')
            .locator('.kanade-source-editor-editor');
        await editor.focus();
        await editor.evaluate((element) => {
            const range = element.ownerDocument.createRange();
            range.selectNodeContents(element);
            const walker = element.ownerDocument.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
            );
            let remaining = '[[ Selected ]]'.length;
            while (walker.nextNode()) {
                const length = walker.currentNode.textContent?.length ?? 0;
                if (remaining <= length) {
                    range.setEnd(walker.currentNode, remaining);
                    break;
                }
                remaining -= length;
            }
            const selection = element.ownerDocument.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
        });
        await expect
            .poll(() =>
                textarea.evaluate((element: HTMLTextAreaElement) => [
                    element.selectionStart,
                    element.selectionEnd,
                ]),
            )
            .toEqual([0, '[[ Selected ]]'.length]);
        const shortcut = page.locator(
            '#kanade-quick-access [data-kanade-quick-access-action="source-editor"]',
        );
        await expect(shortcut).toHaveAccessibleName(label);
        await shortcut.click();
        await expect(textarea).toHaveValue('[[Selected]]\n\n[[ Untouched ]]');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        expect((await nativeNotifications(page)).at(-1)?.options.type).toBe(
            'success',
        );
        await editor.focus();
        await page.keyboard.press('ControlOrMeta+z');
        await expect(textarea).toHaveValue(source);
        await expect(editor).toHaveText(source);
        expect(await storedSettings(page)).toBeNull();
    });
}

test('the Format shortcut preserves native input composition and works after composition ends', async ({
    page,
}) => {
    const settings = createDefaultFormatterSettings();
    settings.syntaxHighlighting = false;
    await mountFormatter(page, { settings, open: false });
    const textarea = page.locator('#wpTextbox1');
    const shortcut = page.locator(
        '#kanade-quick-access [data-kanade-quick-access-action="source-editor"]',
    );
    await textarea.dispatchEvent('compositionstart');
    await shortcut.click();
    await expect(textarea).toHaveValue(initialSource);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await textarea.dispatchEvent('compositionend');
    await shortcut.focus();
    await page.keyboard.press('Enter');
    await expect(textarea).toHaveValue('== Heading ==\n\nText');
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const { width, height, locale, messages } of [
    { width: 375, height: 667, locale: 'en', messages: english },
    { width: 683, height: 768, locale: 'ru', messages: russian },
    { width: 1366, height: 768, locale: 'en', messages: english },
]) {
    test(`numbered regex pairs preserve sequence, options, focus, and bounds at ${width}px in ${locale}`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height });
        await mountFormatter(page, { source: 'a A', locale });
        await page
            .getByRole('tab', {
                name: messages['dialog.toolsTab'],
                exact: true,
            })
            .click();
        const find = (number: number) =>
            page.getByRole('textbox', {
                name: messages['regex.pattern'].replace(
                    '{number}',
                    String(number),
                ),
                exact: true,
            });
        const replace = (number: number) =>
            page.getByRole('textbox', {
                name: messages['regex.replacement'].replace(
                    '{number}',
                    String(number),
                ),
                exact: true,
            });
        await expect(find(1)).toBeVisible();
        await expect(find(2)).toBeVisible();
        await expect(
            page.getByRole('textbox', {
                name: messages['regex.flags'],
                exact: true,
            }),
        ).toHaveCount(0);
        await find(1).fill('a');
        await replace(1).fill('b');
        await find(2).fill('b');
        await replace(2).fill('c');
        await page
            .getByText(messages['regex.options'], { exact: true })
            .click();
        await page
            .getByRole('textbox', {
                name: messages['regex.flags'],
                exact: true,
            })
            .fill('gi');
        await page
            .getByRole('button', {
                name: messages['regex.preview'],
                exact: true,
            })
            .click();
        await expect(
            page.getByRole('textbox', {
                name: messages['regex.output'],
                exact: true,
            }),
        ).toHaveValue('c c');
        await expect(page.locator('#wpTextbox1')).toHaveValue('a A');
        await page
            .getByRole('button', { name: messages['regex.apply'], exact: true })
            .click();
        await expect(page.locator('#wpTextbox1')).toHaveValue('c c');
        await page
            .getByRole('button', { name: messages['regex.undo'], exact: true })
            .click();
        await expect(page.locator('#wpTextbox1')).toHaveValue('a A');
        await page
            .getByRole('button', {
                name: messages['regex.addRule'],
                exact: true,
            })
            .click();
        await expect(find(3)).toBeFocused();
        await page
            .getByRole('button', {
                name: messages['regex.removeRule'].replace('{number}', '2'),
                exact: true,
            })
            .click();
        await expect(find(2)).toBeFocused();
        await expect(find(1)).toHaveValue('a');
        await replace(2).fill('line');
        await replace(2).press('End');
        await replace(2).press('Enter');
        await expect(replace(2)).toHaveValue('line\n');
        const bounds = await page
            .locator('.kanade-source-editor-dialog')
            .evaluate((dialog) => {
                const rectangle = dialog.getBoundingClientRect();
                return {
                    left: rectangle.left,
                    right: rectangle.right,
                    overflow: dialog.scrollWidth > dialog.clientWidth + 1,
                };
            });
        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(width);
        expect(bounds.overflow).toBe(false);
    });
}

test('regex tools open compact options and focus invalid flags', async ({
    page,
}) => {
    await mountFormatter(page, { source: 'a' });
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    await page.getByRole('textbox', { name: 'Find 1', exact: true }).fill('a');
    await page.getByText('Options', { exact: true }).click();
    await page.getByRole('textbox', { name: 'Flags', exact: true }).fill('gg');
    await page.getByText('Options', { exact: true }).click();
    await page
        .getByRole('button', { name: 'Preview replacements', exact: true })
        .click();
    await expect(
        page.getByRole('textbox', { name: 'Flags', exact: true }),
    ).toBeFocused();
    await expect(
        page.getByText('Use each supported JavaScript flag at most once:', {
            exact: false,
        }),
    ).toBeVisible();
    await expect(page.locator('#wpTextbox1')).toHaveValue('a');
});

test('regex tools preview and apply only the captured selection, with guarded undo', async ({
    page,
}) => {
    await mountFormatter(page, { source: 'a aa a', open: false });
    const editor = page
        .frameLocator('.kanade-source-editor-frame')
        .locator('.kanade-source-editor-editor');
    await editor.focus();
    await editor.evaluate((element) => {
        const walker = element.ownerDocument.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
        );
        walker.nextNode();
        const range = element.ownerDocument.createRange();
        range.setStart(walker.currentNode, 2);
        range.setEnd(walker.currentNode, 4);
        const selection = element.ownerDocument.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    });
    await page.locator('#kanade-source-editor-panel a').click();
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    await expect(
        page.getByText(
            'Replaces only the selection captured when this panel opened.',
        ),
    ).toBeAttached();
    await page
        .getByRole('textbox', { name: 'Find 1', exact: true })
        .fill('(a)');
    await page
        .getByRole('textbox', { name: 'Replace 1', exact: true })
        .fill('$1b');
    await page
        .getByRole('button', { name: 'Preview replacements', exact: true })
        .click();
    await expect(
        page.getByRole('textbox', { name: 'Resulting source', exact: true }),
    ).toHaveValue('abab');
    await expect(page.getByText('Matches: 2', { exact: true })).toBeVisible();
    await expect(page.locator('#wpTextbox1')).toHaveValue('a aa a');
    await page
        .getByRole('button', { name: 'Apply replacements', exact: true })
        .click();
    await expect(page.locator('#wpTextbox1')).toHaveValue('a abab a');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page
        .getByRole('button', { name: 'Undo replacement', exact: true })
        .click();
    await expect(page.locator('#wpTextbox1')).toHaveValue('a aa a');
    await expect(
        page.getByRole('button', { name: 'Apply replacements', exact: true }),
    ).toBeDisabled();
});

test('regex tools reject stale sources and preserve later edits', async ({
    page,
}) => {
    await mountFormatter(page, { source: 'a aa a' });
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    await page.getByRole('textbox', { name: 'Find 1', exact: true }).fill('a');
    await page
        .getByRole('textbox', { name: 'Replace 1', exact: true })
        .fill('b');
    await page
        .getByRole('button', { name: 'Preview replacements', exact: true })
        .click();
    await expect(
        page.getByRole('textbox', { name: 'Resulting source', exact: true }),
    ).toHaveValue('b bb b');
    await page
        .locator('#wpTextbox1')
        .evaluate((textarea: HTMLTextAreaElement) => {
            textarea.value = 'Later edit';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        });
    await page
        .getByRole('button', { name: 'Apply replacements', exact: true })
        .click();
    await expect(
        page.getByText('The source or page changed after this panel opened.', {
            exact: false,
        }),
    ).toBeVisible();
    await expect(page.locator('#wpTextbox1')).toHaveValue('Later edit');
});

test('regex tools stop catastrophic expressions without blocking the dialog', async ({
    page,
}) => {
    await mountFormatter(page, { source: 'a'.repeat(100) + '!' });
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    await page
        .getByRole('textbox', { name: 'Find 1', exact: true })
        .fill('(a+)+$');
    await page
        .getByRole('textbox', { name: 'Replace 1', exact: true })
        .fill('b');
    await page
        .getByRole('button', { name: 'Preview replacements', exact: true })
        .click();
    await expect(
        page.getByText('The expression took too long and was stopped.', {
            exact: false,
        }),
    ).toBeVisible();
    await page.getByRole('textbox', { name: 'Find 1', exact: true }).fill('!$');
    await page
        .getByRole('button', { name: 'Preview replacements', exact: true })
        .click();
    await expect(
        page.getByRole('textbox', { name: 'Resulting source', exact: true }),
    ).toHaveValue('a'.repeat(100) + 'b');
    await page
        .locator('.kanade-source-editor-dialog__regex-actions')
        .getByRole('button', { name: 'Cancel', exact: true })
        .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('regex tools expose invalid patterns and worker-start errors while preserving drafts', async ({
    page,
}) => {
    await mountFormatter(page, { source: 'a aa a' });
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    await page.getByRole('textbox', { name: 'Find 1', exact: true }).fill('[');
    await page
        .getByRole('button', { name: 'Preview replacements', exact: true })
        .click();
    await expect(
        page.getByRole('textbox', { name: 'Find 1', exact: true }),
    ).toBeFocused();
    await expect(
        page.getByText(
            'This expression or flag combination is not supported.',
            { exact: false },
        ),
    ).toBeVisible();
    await page.evaluate(() => {
        globalThis.Worker = class {
            constructor() {
                throw new Error('Worker blocked by fixture');
            }
        } as unknown as typeof Worker;
    });
    await page.getByRole('textbox', { name: 'Find 1', exact: true }).fill('a');
    await page
        .getByRole('button', { name: 'Preview replacements', exact: true })
        .click();
    await expect(
        page.getByText(
            'This browser could not start the isolated replacement worker.',
            { exact: false },
        ),
    ).toBeVisible();
    await expect(
        page.getByRole('textbox', { name: 'Find 1', exact: true }),
    ).toHaveValue('a');
    await expect(page.locator('#wpTextbox1')).toHaveValue('a aa a');
});

test('section edits name the formatting scope explicitly', async ({ page }) => {
    await mountFormatter(page, { section: true });
    await page
        .getByRole('button', { name: 'Format section', exact: true })
        .click();
    await expect(page.locator('#wpTextbox1')).toHaveValue(
        '== Heading ==\n\nText',
    );
});

test('storage errors remain readable and formatting can continue without saving', async ({
    page,
}) => {
    await mountFormatter(page);
    await page.evaluate(() => {
        Storage.prototype.setItem = () => {
            throw new Error('Fixture storage unavailable');
        };
    });
    await page
        .getByRole('button', { name: 'Save settings', exact: true })
        .click();
    const message = page.getByRole('dialog').locator('.cdx-message--error');
    await expect(message).toContainText(
        'You can still apply them for this edit.',
    );
    await expect(message).toBeInViewport();
    expect(await nativeNotifications(page)).toEqual([]);
    const styles = await message.evaluate((element) => {
        const style = getComputedStyle(element);
        return { padding: style.paddingTop, border: style.borderTopWidth };
    });
    expect(styles).toEqual({ padding: '12px', border: '1px' });
    await expect(page.locator('#wpTextbox1')).toHaveValue(initialSource);
    await page
        .getByRole('button', { name: 'Format page', exact: true })
        .click();
    await expect(page.locator('#wpTextbox1')).toHaveValue(
        '== Heading ==\n\nText',
    );
});

test('pending redirect lookup locks the draft and announces progress', async ({
    page,
}) => {
    await mountFormatter(page, { source: '[[ Old ]]' });
    await page.evaluate(() => {
        (globalThis as any).mw.Api.prototype.get = () =>
            new Promise((resolve) => {
                (globalThis as any).__finishLookup = () =>
                    resolve({ query: { pages: [{ title: 'Old' }] } });
            });
    });
    await page
        .getByRole('checkbox', {
            name: 'Replace redirects with target page titles',
            exact: true,
        })
        .check();
    await page
        .getByRole('button', { name: 'Format page', exact: true })
        .click();
    await expect(
        page.getByRole('button', { name: 'Applying changes…', exact: true }),
    ).toBeDisabled();
    await expect(
        page.getByRole('button', { name: 'Save settings', exact: true }),
    ).toBeDisabled();
    await expect(
        page.getByRole('checkbox', {
            name: 'Replace redirects with target page titles',
            exact: true,
        }),
    ).toBeDisabled();
    await expect(page.getByRole('progressbar')).toHaveAccessibleName(
        'Applying changes…',
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('#wpTextbox1')).toHaveValue('[[ Old ]]');
    await page.evaluate(() => (globalThis as any).__finishLookup());
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#wpTextbox1')).toHaveValue('[[Old]]');
});

test('a pending formatter lookup cannot overwrite newer native source', async ({
    page,
}) => {
    await mountFormatter(page, { source: '[[ Old ]]' });
    await page.evaluate(() => {
        (globalThis as any).mw.Api.prototype.get = () =>
            new Promise((resolve) => {
                (globalThis as any).__finishLookup = () =>
                    resolve({ query: { pages: [{ title: 'Old' }] } });
            });
    });
    await page
        .getByRole('checkbox', {
            name: 'Replace redirects with target page titles',
            exact: true,
        })
        .check();
    await page
        .getByRole('button', { name: 'Format page', exact: true })
        .click();
    await expect(
        page.getByRole('button', { name: 'Applying changes…', exact: true }),
    ).toBeDisabled();
    await page
        .locator('#wpTextbox1')
        .evaluate((textarea: HTMLTextAreaElement) => {
            textarea.value = 'newer source from another tool';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        });
    await page.evaluate(() => (globalThis as any).__finishLookup());

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Format page', exact: true }),
    ).toBeEnabled();
    await expect(page.locator('#wpTextbox1')).toHaveValue(
        'newer source from another tool',
    );
});

for (const [locale, saveLabel] of [
    ['en', 'Save settings'],
    ['zh-Hans', '保存设置'],
    ['zh-Hant', '儲存設定'],
    ['ja', japanese['dialog.saveSettings']],
    ['ru', russian['dialog.saveSettings']],
] as const) {
    test(`${locale} keeps content and actions usable at a narrow width`, async ({
        page,
    }) => {
        await page.setViewportSize({ width: 360, height: 740 });
        await mountFormatter(page, { locale });
        const dialog = page.getByRole('dialog');
        await expect(dialog).toHaveAttribute('lang', locale);
        for (const [index, name] of [
            'formatting',
            'references',
            'editor',
        ].entries()) {
            await page.getByRole('tab').nth(index).click();
            await expect(
                dialog
                    .getByRole('tabpanel')
                    .locator('fieldset, input, p, button')
                    .first(),
            ).toBeInViewport();
            const size = await dialog.evaluate((element) => ({
                width: element.clientWidth,
                scroll: element.scrollWidth,
            }));
            expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
            const actions = dialog.locator('.cdx-dialog__footer button');
            await expect(actions).toHaveCount(4);
            await expect(actions.nth(0)).toHaveClass(
                /kanade-source-editor-dialog__primary/u,
            );
            await expect(actions.nth(1)).toHaveClass(
                /kanade-source-editor-dialog__save/u,
            );
            await expect(actions.nth(1)).toHaveAccessibleName(saveLabel);
            await expect(actions.nth(3)).toHaveClass(
                /kanade-source-editor-dialog__cancel/u,
            );
            for (const button of await actions.all()) {
                await expect(button).toBeInViewport();
            }
            await capture(page, `${name}-${locale}-mobile`);
        }
        await dialog
            .locator('.kanade-source-editor-dialog__more button')
            .click();
        await expect(page.getByRole('menu')).toBeInViewport();
        await expect(page.getByRole('menu').getByRole('option')).toHaveCount(2);
        for (const item of await page
            .getByRole('menu')
            .getByRole('option')
            .all()) {
            await expect(item).toBeInViewport();
        }
        await capture(page, `menu-${locale}-mobile`);
    });
}

test('RTL layout keeps its reading direction and literal examples intact', async ({
    page,
}) => {
    await mountFormatter(page, { direction: 'rtl' });
    const dialog = page.getByRole('dialog');
    await dialog.locator('pre').scrollIntoViewIfNeeded();
    expect(
        await dialog.evaluate((element) => getComputedStyle(element).direction),
    ).toBe('rtl');
    await expect(dialog.locator('pre')).toHaveAttribute('dir', 'ltr');
    await capture(page, 'templates-rtl');
});

for (const wikiId of ['enwiki', 'zhwiki', 'examplewiki']) {
    test(`${wikiId} offers HTML formatting and both width ratios while gating conversion rules`, async ({
        page,
    }) => {
        const settings = createDefaultFormatterSettings();
        settings.formatter.normalizeConversion = true;
        const conversionSource = '-{ zh-cn:简体;zh-tw:繁體 }-';
        const source =
            `${conversionSource}\n< ref     name=222      /    >\n` +
            '< ref     name=222   style="key1 : a; key2:b "       >123</ ref>';
        await mountFormatter(page, { wikiId, settings, source });
        await expect(
            page.getByRole('group', {
                name: 'Formatting options',
                exact: true,
            }),
        ).toBeVisible();
        const html = page.getByRole('checkbox', {
            name: 'Format HTML tags',
            exact: true,
        });
        await expect(html).not.toBeChecked();
        await html.check();
        const conversion = page.getByRole('checkbox', {
            name: 'Format language conversion rules',
            exact: true,
        });
        if (wikiId === 'zhwiki') {
            await expect(conversion).toBeChecked();
        } else {
            await expect(conversion).toHaveCount(0);
        }
        await page
            .getByRole('radio', { name: 'Align values', exact: true })
            .check();
        await page.getByRole('radio', { name: '3:5', exact: true }).check();
        await page.getByRole('radio', { name: '1:2', exact: true }).check();
        await page
            .getByRole('button', { name: 'Save settings', exact: true })
            .click();
        expect(
            (await storedSettings(page))?.formatter.characterWidthRatio,
        ).toBe('2:1');
        expect(
            (await storedSettings(page))?.formatter.normalizeConversion,
        ).toBe(wikiId === 'zhwiki');
        expect((await storedSettings(page))?.formatter.formatHtmlTags).toBe(
            true,
        );
        await page
            .getByRole('button', { name: 'Format page', exact: true })
            .click();
        const converted =
            wikiId === 'zhwiki'
                ? '-{zh-cn:简体; zh-tw:繁體;}-'
                : conversionSource;
        const expected =
            `${converted}\n<ref name="222" />\n` +
            '<ref name="222" style="key1: a; key2: b;">123</ref>';
        await expect(page.locator('#wpTextbox1')).toHaveValue(expected);
        await expect(
            page
                .frameLocator('.kanade-source-editor-frame')
                .locator('.kanade-source-editor-editor'),
        ).toHaveText(expected);
    });
}

test('disabled native CodeMirror keeps its textarea hidden until Source Editor highlighting is disabled', async ({
    page,
}) => {
    await mountFormatter(page, { nativeCodeMirror: true, open: false });
    const textarea = page.locator('#wpTextbox1');
    const wrapper = page.locator(
        '.ext-codemirror-wrapper.ext-codemirror-wrapper--hidden',
    );
    await expect(page.locator('.kanade-source-editor-frame')).toBeVisible();
    await expect(textarea).toBeHidden();
    await expect(textarea).toHaveValue(initialSource);
    await expect(textarea).toHaveJSProperty('readOnly', false);
    await expect(wrapper.locator('#wpTextbox1')).toHaveCount(1);
    await expect(wrapper.locator('.cm-editor')).toBeHidden();

    await page.locator('#kanade-source-editor-panel a').click();
    await page
        .getByRole('tab', { name: 'Highlighting settings', exact: true })
        .click();
    await page
        .getByRole('checkbox', {
            name: 'Use Source Editor to highlight wikitext pages',
            exact: true,
        })
        .uncheck();
    await page
        .getByRole('button', { name: 'Apply settings', exact: true })
        .click();
    await expect(page.locator('.kanade-source-editor-frame')).toHaveCount(0);
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue(initialSource);
    await expect(textarea).toHaveJSProperty('readOnly', false);
    await expect(wrapper.locator('#wpTextbox1')).toHaveCount(1);
    await expect(wrapper.locator('.cm-editor')).toBeHidden();
});

test('disabling highlighting restores the native textarea and retains display choices', async ({
    page,
}) => {
    const settings = {
        ...createDefaultFormatterSettings(),
        largeFont: true,
    };
    await mountFormatter(page, { settings });
    const textarea = page.locator('#wpTextbox1');
    const nativeFontSize = await textarea.evaluate(
        (element) => getComputedStyle(element).fontSize,
    );
    const editor = page
        .frameLocator('.kanade-source-editor-frame')
        .locator('.kanade-source-editor-editor');
    const enhancedFontSize = await editor.evaluate(
        (element) => getComputedStyle(element).fontSize,
    );
    const highlighting = page.getByRole('checkbox', {
        name: 'Use Source Editor to highlight wikitext pages',
        exact: true,
    });
    const largeFont = page.getByRole('checkbox', {
        name: 'Use larger text',
        exact: true,
    });
    await expect(editor.locator('span').first()).toBeVisible();
    await page
        .getByRole('tab', { name: 'Highlighting settings', exact: true })
        .click();
    await highlighting.uncheck();
    for (const name of ['Text and colors', 'Links', 'Reference popups']) {
        const controls = page
            .getByRole('group', { name, exact: true })
            .getByRole('checkbox');
        for (const control of await controls.all()) {
            await expect(control).toBeDisabled();
        }
    }
    await expect(largeFont).toBeChecked();
    await expect(
        page.getByRole('checkbox', {
            name: 'Use CodeMirror for other content models',
            exact: true,
        }),
    ).toBeEnabled();
    await expect(
        page.getByRole('checkbox', {
            name: 'Reference tag inspection',
            exact: true,
        }),
    ).toBeChecked();
    await page
        .getByRole('button', { name: 'Apply settings', exact: true })
        .click();
    await expect(page.locator('.kanade-source-editor-frame')).toHaveCount(0);
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue(initialSource);
    expect(
        await textarea.evaluate(
            (element) => getComputedStyle(element).fontSize,
        ),
    ).toBe(nativeFontSize);
    await textarea.focus();
    await textarea.evaluate((element: HTMLTextAreaElement) => {
        element.setSelectionRange(element.value.length, element.value.length);
    });
    await textarea.press('!');
    await expect(textarea).toHaveValue(`${initialSource}!`);
    await page.locator('#kanade-source-editor-panel a').click();
    await page
        .getByRole('tab', { name: 'Highlighting settings', exact: true })
        .click();
    await expect(highlighting).not.toBeChecked();
    await expect(largeFont).toBeDisabled();
    await expect(largeFont).toBeChecked();
    await chooseMore(page, 'Reset settings');
    await expect(highlighting).toBeChecked();
    await expect(largeFont).not.toBeChecked();
    await page
        .getByRole('button', { name: 'Cancel', exact: true })
        .last()
        .click();
    await expect(page.locator('.kanade-source-editor-frame')).toHaveCount(0);
    await expect(textarea).toBeVisible();
    await page.locator('#kanade-source-editor-panel a').click();
    await page
        .getByRole('tab', { name: 'Highlighting settings', exact: true })
        .click();
    await expect(highlighting).not.toBeChecked();
    await expect(largeFont).toBeDisabled();
    await expect(largeFont).toBeChecked();
    await highlighting.check();
    await expect(largeFont).toBeEnabled();
    await expect(
        page.getByRole('checkbox', {
            name: 'Reference tag inspection',
            exact: true,
        }),
    ).toBeEnabled();
    await page
        .getByRole('button', { name: 'Apply settings', exact: true })
        .click();
    await expect(textarea).toBeHidden();
    await expect(textarea).toHaveValue(`${initialSource}!`);
    await expect(editor).toHaveText(`${initialSource}!`);
    await expect(editor.locator('span').first()).toBeVisible();
    expect(
        await editor.evaluate((element) => getComputedStyle(element).fontSize),
    ).toBe(enhancedFontSize);
});

test('Clear cache refreshes missing titles and page summaries without changing source or settings', async ({
    page,
}) => {
    const source = '[[Cached]] [[Missing]]';
    const settings = {
        ...createDefaultFormatterSettings(),
        linkPreviews: true,
    };
    await mountFormatter(page, { source, settings, open: false });
    let missing = true;
    let summaries = 0;
    await page.route(/\/w\/api\.php(?:\?|$)/u, async (route) => {
        const title = new URL(route.request().url()).searchParams.get('titles');
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                query: {
                    pages: [
                        {
                            title,
                            ...(title === 'Missing' && missing
                                ? { missing: true }
                                : { pageid: 1 }),
                        },
                    ],
                },
            }),
        });
    });
    await page.route('**/api/rest_v1/page/summary/**', async (route) => {
        summaries += 1;
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                title: 'Cached',
                extract: `Summary ${summaries}`,
            }),
        });
    });
    const frame = page.frameLocator('.kanade-source-editor-frame');
    const absent = frame.locator(
        '[data-kanade-source-editor-page-preview-title="Missing"]',
    );
    const cached = frame.locator(
        '[data-kanade-source-editor-page-preview-title="Cached"]',
    );
    const extract = frame.locator(
        '.kanade-source-editor-page-preview__extract',
    );
    await absent.hover();
    await expect(absent).toHaveClass(
        /kanade-source-editor-token--page-missing/u,
    );
    await cached.hover();
    await expect(extract).toHaveText('Summary 1');
    await page.mouse.move(2, 2);
    await expect(extract).toHaveCount(0);
    await cached.hover();
    await expect(extract).toHaveText('Summary 1');
    expect(summaries).toBe(1);

    missing = false;
    await page.locator('#kanade-source-editor-panel a').click();
    await chooseMore(page, 'Clear cache');
    await expect(absent).not.toHaveClass(
        /kanade-source-editor-token--page-missing/u,
    );
    await expectSuccessNotification(
        page,
        'cache-cleared',
        'Cache cleared. Data will reload as needed.',
    );
    expect(await storedSettings(page)).toEqual(settings);
    await expect(page.locator('#wpTextbox1')).toHaveValue(source);
    await page
        .getByRole('button', { name: 'Cancel', exact: true })
        .last()
        .click();
    await cached.hover();
    await expect(extract).toHaveText('Summary 2');
    await absent.hover();
    await expect(extract).toHaveText('Summary 3');
    await expect(absent).not.toHaveClass(
        /kanade-source-editor-token--page-missing/u,
    );
});

test('page summaries requested before Clear cache cannot replace fresh cached results', async ({
    page,
}) => {
    await mountFormatter(page, {
        source: '[[Cached]]',
        open: false,
        settings: { ...createDefaultFormatterSettings(), linkPreviews: true },
    });
    let finishOld!: () => void;
    const oldResponse = new Promise<void>((resolve) => {
        finishOld = resolve;
    });
    let oldFinished = false;
    let summaries = 0;
    await page.route(/\/w\/api\.php(?:\?|$)/u, (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                query: { pages: [{ title: 'Cached', pageid: 1 }] },
            }),
        }),
    );
    await page.route('**/api/rest_v1/page/summary/**', async (route) => {
        summaries += 1;
        const stale = summaries === 1;
        if (stale) await oldResponse;
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                title: 'Cached',
                extract: stale ? 'Stale summary' : 'Fresh summary',
            }),
        });
        if (stale) oldFinished = true;
    });
    const frame = page.frameLocator('.kanade-source-editor-frame');
    const title = frame.locator(
        '[data-kanade-source-editor-page-preview-title="Cached"]',
    );
    const extract = frame.locator(
        '.kanade-source-editor-page-preview__extract',
    );
    await title.hover();
    await expect.poll(() => summaries).toBe(1);
    await page.locator('#kanade-source-editor-panel a').click();
    await chooseMore(page, 'Clear cache');
    await page
        .getByRole('button', { name: 'Cancel', exact: true })
        .last()
        .click();
    await title.hover();
    await expect(extract).toHaveText('Fresh summary');
    finishOld();
    await expect.poll(() => oldFinished).toBe(true);
    await page.mouse.move(2, 2);
    await expect(extract).toHaveCount(0);
    await title.hover();
    await expect(extract).toHaveText('Fresh summary');
    expect(summaries).toBe(2);
});

async function chooseMore(page: Page, name: string): Promise<void> {
    await page
        .getByRole('button', { name: 'More options', exact: true })
        .click();
    await page
        .getByRole('menu')
        .getByRole('option', { name, exact: true })
        .click();
}

async function capture(page: Page, name: string): Promise<void> {
    for (const dialog of await page.getByRole('dialog').all()) {
        const body = dialog.locator('.cdx-dialog__body');
        const dimensions = await body.evaluate((element) => ({
            width: element.clientWidth,
            scrollWidth: element.scrollWidth,
        }));
        expect(
            dimensions.scrollWidth,
            `${name}: dialog body must not clip its form horizontally`,
        ).toBeLessThanOrEqual(dimensions.width + 1);
    }
    const dir = process.env.KANADE_SCREENSHOT_DIR;
    if (dir) {
        await mkdir(dir, { recursive: true });
        await page.evaluate(async () => {
            await new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                ),
            );
            await Promise.allSettled(
                document
                    .getAnimations()
                    .filter(
                        (animation) =>
                            animation.effect?.getTiming().iterations !==
                            Infinity,
                    )
                    .map((animation) => animation.finished),
            );
        });
        await page.screenshot({
            path: `${dir}/${name}.png`,
            animations: 'disabled',
        });
    }
}

async function expectCitationRowLayout(
    dialog: Locator,
    columns: boolean,
): Promise<void> {
    const rows = await dialog
        .locator('.kanade-source-editor-source-manager__parameter-row')
        .evaluateAll((elements) =>
            elements.map((row) => {
                const rect = (selector: string) => {
                    const bounds = row
                        .querySelector(selector)!
                        .getBoundingClientRect();
                    return {
                        left: bounds.left,
                        right: bounds.right,
                        top: bounds.top,
                        bottom: bounds.bottom,
                    };
                };
                return {
                    name: rect(
                        '.kanade-source-editor-source-manager__parameter-name',
                    ),
                    value: rect('textarea'),
                    actions: rect(
                        '.kanade-source-editor-source-manager__parameter-cell--actions',
                    ),
                    overflow: row.scrollWidth > row.clientWidth + 1,
                };
            }),
        );
    expect(rows.length).toBeGreaterThan(0);
    for (const { name, value, actions, overflow } of rows) {
        expect(overflow, 'Citation row stays within its available width').toBe(
            false,
        );
        if (columns) {
            expect(name.top).toBeCloseTo(value.top, 0);
            expect(value.top).toBeCloseTo(actions.top, 0);
            expect(name.right).toBeLessThanOrEqual(value.left);
            expect(value.right).toBeLessThanOrEqual(actions.left);
        } else {
            expect(name.bottom).toBeLessThanOrEqual(value.top);
            expect(value.bottom).toBeLessThanOrEqual(actions.top);
        }
    }
}

async function expectReferenceEditorLayout(dialog: Locator): Promise<void> {
    const pairs = await dialog.evaluate((element) => {
        const rect = (target: Element) => {
            const bounds = target.getBoundingClientRect();
            return {
                left: bounds.left,
                right: bounds.right,
                top: bounds.top,
                bottom: bounds.bottom,
            };
        };
        return [
            [
                element.querySelector(
                    '.kanade-source-editor-source-manager__template-field [role="combobox"]',
                )!,
                element.querySelector(
                    '.kanade-source-editor-source-manager__reference-identity',
                )!,
            ],
            ...Array.from(
                element.querySelectorAll(
                    '.kanade-source-editor-source-manager__parameter-row',
                ),
                (row) => [
                    row.querySelector(
                        '.kanade-source-editor-source-manager__parameter-name',
                    )!,
                    row.querySelector('textarea')!,
                ],
            ),
        ].map(([first, second]) => [rect(first!), rect(second!)] as const);
    });
    for (const [first, second] of pairs) {
        expect(
            first.right <= second.left + 1 ||
                first.bottom <= second.top + 1 ||
                second.right <= first.left + 1,
            'Citation labels and controls must not overlap adjacent fields',
        ).toBe(true);
    }
}

async function storedSettings(page: Page): Promise<FormatterSettings | null> {
    return page.evaluate((key) => {
        const value = JSON.parse(localStorage.getItem(key) ?? 'null');
        return value?.schemaVersion === 1 ? value.settings : value;
    }, FORMATTER_SETTINGS_STORAGE_KEY);
}

async function nativeNotifications(page: Page): Promise<NativeNotification[]> {
    return page.evaluate(() => (globalThis as any).__notifications);
}

async function expectSuccessNotification(
    page: Page,
    key: string,
    message: string,
    count = 1,
): Promise<void> {
    await expect
        .poll(() => nativeNotifications(page))
        .toEqual(
            Array.from({ length: count }, () => ({
                message,
                options: {
                    autoHide: true,
                    autoHideSeconds: 'short',
                    tag: `source-editor:${key}`,
                    type: 'success',
                },
            })),
        );
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const announcement = dialog
        .locator('.cdx-dialog__body')
        .getByRole('status');
    await expect(announcement).toHaveText(message);
    await expect(announcement).toHaveAttribute('aria-live', 'polite');
    await expect(announcement).toHaveAttribute('aria-atomic', 'true');
    await expect(announcement).toHaveClass(
        /kanade-source-editor-dialog__sr-only/u,
    );
    expect(
        await announcement.evaluate(
            (element) =>
                element.closest('[inert], [aria-hidden="true"]') === null,
        ),
    ).toBe(true);
    await expect(
        dialog.locator(
            '.cdx-dialog__footer .kanade-source-editor-dialog__feedback',
        ),
    ).toHaveCount(0);
    await expect(page.locator('.mw-notification-area-overlay')).toBeEmpty();
}

async function mountFormatter(
    page: Page,
    options: {
        locale?: string;
        direction?: string;
        source?: string;
        pageSource?: string;
        section?: boolean;
        open?: boolean;
        platform?: string;
        wikiId?: string;
        contentLanguage?: string;
        settings?: FormatterSettings;
        nativeCodeMirror?: boolean;
    } = {},
): Promise<void> {
    // Every request is served locally; the fixture never contacts a wiki.
    await page.route('**/*', (route) =>
        route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }),
    );
    await page.goto('https://example.test/wiki/Sandbox?action=edit');
    if (options.settings) {
        await page.evaluate(
            ({ key, settings }) =>
                localStorage.setItem(
                    key,
                    JSON.stringify({ schemaVersion: 1, settings }),
                ),
            {
                key: FORMATTER_SETTINGS_STORAGE_KEY,
                settings: options.settings,
            },
        );
    }
    await page.setContent(
        '<form id="editform"><div id="p-cactions"></div><textarea id="wpTextbox1" name="wpTextbox1" aria-label="Wikitext editor"></textarea></form><div class="mw-notification-area-overlay" role="status"></div>',
    );
    await page.locator('#wpTextbox1').fill(options.source ?? initialSource);
    if (options.nativeCodeMirror) {
        await page.locator('#wpTextbox1').evaluate((element) => {
            const wrapper = element.ownerDocument.createElement('div');
            wrapper.className =
                'ext-codemirror-wrapper ext-codemirror-wrapper--hidden';
            const editor = element.ownerDocument.createElement('div');
            editor.className = 'cm-editor';
            editor.textContent = 'Native CodeMirror editor';
            element.before(wrapper);
            wrapper.append(element, editor);
        });
        // Native CodeMirror's disabled-state rule outranks a single class selector.
        await page.addStyleTag({
            content:
                '.ext-codemirror-wrapper textarea { display: none !important; } ' +
                '.ext-codemirror-wrapper--hidden .cm-editor { display: none !important; } ' +
                '.ext-codemirror-wrapper--hidden textarea { display: initial !important; }',
        });
    }
    await page.addScriptTag({ content: runtime });
    await page.addStyleTag({
        path: fileURLToPath(
            import.meta.resolve('@wikimedia/codex/dist/codex.style-bidi.css'),
        ),
    });
    await page.addStyleTag({
        content:
            'body { font: 16px/1.6 sans-serif; margin: 24px; } #p-cactions { margin-bottom: 16px; }',
    });
    await page.evaluate(
        ({
            locale,
            direction,
            section,
            wikiId,
            contentLanguage,
            pageSource,
            platform,
        }) => {
            if (platform != null) {
                Object.defineProperty(navigator, 'platform', {
                    configurable: true,
                    value: platform,
                });
            }
            document.documentElement.lang = locale;
            document.documentElement.dir = direction;
            const settings: Record<string, unknown> = {
                wgAction: 'edit',
                wgPageContentModel: 'wikitext',
                wgUserLanguage: locale,
                wgDBname: wikiId,
                wgWikiID: wikiId,
                wgContentLanguage: contentLanguage,
                wgPageName: 'Sandbox',
                wgCurRevisionId: pageSource == null ? 0 : 123,
                wgNamespaceNumber: 0,
                wgTitle: 'Sandbox',
                wgSection: section ? '1' : undefined,
            };
            if (section) {
                const field = document.createElement('input');
                field.name = 'wpSection';
                field.value = '1';
                document.getElementById('editform')?.append(field);
            }
            const hook = {
                add() {
                    return hook;
                },
                remove() {
                    return hook;
                },
            };
            const notifications: NativeNotification[] = [];
            (globalThis as any).__notifications = notifications;
            (globalThis as any).mw = {
                Api: class {
                    async get(parameters: Record<string, unknown>) {
                        if (parameters.action === 'templatedata') {
                            return { pages: {} };
                        }
                        if (
                            parameters.prop === 'revisions' &&
                            pageSource != null
                        ) {
                            return {
                                query: {
                                    pages: [
                                        {
                                            revisions: [
                                                {
                                                    slots: {
                                                        main: {
                                                            content: pageSource,
                                                        },
                                                    },
                                                },
                                            ],
                                        },
                                    ],
                                },
                            };
                        }
                        if (parameters.meta === 'siteinfo')
                            return {
                                query: {
                                    namespaces: {},
                                    namespacealiases: [],
                                    magicwords: [],
                                    functionhooks: [],
                                    variables: [],
                                },
                            };
                        throw new Error(
                            'Unexpected API request in offline formatter fixture',
                        );
                    }
                },
                config: { get: (key: string) => settings[key] },
                hook: () => hook,
                loader: {
                    using: async () => (name: string) =>
                        name === 'vue'
                            ? (globalThis as any).SourceEditorTestUI.vue
                            : (globalThis as any).SourceEditorTestUI.codex,
                },
                notify(message: string, options: MediaWikiNotificationOptions) {
                    notifications.push({ message, options });
                },
                util: {
                    addCSS(css: string) {
                        const style = document.createElement('style');
                        style.textContent = css;
                        document.head.append(style);
                        return { ownerNode: style };
                    },
                    addPortletLink(
                        portlet: string,
                        href: string,
                        text: string,
                        id: string,
                        tooltip: string,
                    ) {
                        const parent = document.getElementById(portlet);
                        if (parent == null) return null;
                        const item = document.createElement('li');
                        item.id = id;
                        item.className = 'skin-portlet-item';
                        const link = document.createElement('a');
                        link.className = 'skin-portlet-link';
                        link.href = href;
                        link.title = tooltip;
                        const label = document.createElement('span');
                        label.className = 'skin-portlet-label';
                        label.textContent = text;
                        link.append(label);
                        item.append(link);
                        parent.append(item);
                        return item;
                    },
                    getUrl: (title: string) => `/wiki/${title}`,
                    wikiScript: () => '/w/api.php',
                },
            };
            (globalThis as any).sourceEditorConfig = { highlightDelay: 0 };
        },
        {
            locale: options.locale ?? 'en',
            direction: options.direction ?? 'ltr',
            section: options.section ?? false,
            wikiId: options.wikiId ?? 'examplewiki',
            contentLanguage:
                options.contentLanguage ??
                (options.wikiId === 'zhwiki' ? 'zh' : 'en'),
            pageSource: options.pageSource,
            platform: options.platform,
        },
    );
    await page.addScriptTag({
        content: await readFile(
            `${projectRoot}dist/source_editor.min.js`,
            'utf8',
        ),
    });
    if (options.settings?.syntaxHighlighting === false) {
        await page.evaluate(async () => {
            await (window as any)[Symbol.for('kanade.source-editor.startup')];
        });
        await expect(page.locator('#wpTextbox1')).toBeVisible();
    } else {
        await expect(
            page.locator(
                '.kanade-source-editor-frame[data-kanade-source-editor-ready="true"]',
            ),
        ).toBeVisible();
    }
    if (options.open !== false) {
        await page.locator('#kanade-source-editor-panel a').click();
        await expect(page.getByRole('dialog')).toBeVisible();
    }
}
