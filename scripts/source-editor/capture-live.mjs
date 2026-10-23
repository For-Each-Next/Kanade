/**
 * @file scripts/source-editor/capture-live.mjs
 * Purpose: Capture Source Editor on actual Wikimedia source views without simulated host data or wiki saves.
 * Contents: Browser setup, verified article source, editor and reference views, and provenance.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { format } from 'prettier';
import { configuredCaptureProxy } from '../capture-browser.mjs';
import { isWikiWriteRequest } from '../capture-request.mjs';
import { documentationScreenshotFilename } from '../documentation-images.mjs';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const args = process.argv.slice(2);
assert.ok(
    args.every(
        (argument) =>
            argument.startsWith('--locales=') ||
            argument.startsWith('--views='),
    ),
    'Supported options: --locales=en,zh-Hans,zh-Hant and --views=01,02,03,04,05,06,07,08,09,10,11',
);
const supportedLocales = ['en', 'zh-Hans', 'zh-Hant'];
const supportedViews = [
    '03',
    '01',
    '02',
    '04',
    '05',
    '06',
    '07',
    '08',
    '09',
    '10',
    '11',
];
const locales =
    args
        .find((argument) => argument.startsWith('--locales='))
        ?.slice(10)
        .split(',') ?? supportedLocales;
const views = new Set(
    args
        .find((argument) => argument.startsWith('--views='))
        ?.slice(8)
        .split(',') ?? supportedViews,
);
assert.ok(locales.every((locale) => supportedLocales.includes(locale)));
assert.ok([...views].every((view) => supportedViews.includes(view)));
const bundleArtifact = 'dist/source_editor.min.js';
const bundle = await readFile(join(root, bundleArtifact), 'utf8');
const bundleSha256 = createHash('sha256').update(bundle).digest('hex');
const imageDirectory = join(root, 'docs/source-editor/images');
const ledgerPath = join(imageDirectory, 'live-captures.json');
let previous = {};
try {
    previous = JSON.parse(await readFile(ledgerPath, 'utf8'));
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}
const ledger = {
    ...previous,
    capturedAt: new Date().toISOString(),
    method: 'Actual Wikimedia source pages, native MediaWiki/Vue/Codex/API/assets, current bundle injection, and Chromium screenshots. No simulated article text or API responses. No wiki saves.',
    bundleArtifact,
    bundleSha256,
    captures: { ...previous.captures },
    failures: [...(previous.failures ?? [])],
};
const chineseWiki = {
    language: 'zh',
    editor: {
        title: '任天堂',
        revisionId: 94167581,
        citationText: 'トヨタの5倍超',
        previewTitle: '任天堂Switch',
    },
    manager: {
        title: '信賴鈴音 ～蕭邦之夢～',
        revisionId: 94743103,
        citationText: 'Noguchi & Hatsushiba, 2007',
    },
    highlighting: { title: '任天堂Switch', revisionId: 94119527 },
};
const captureWikis = {
    'zh-Hans': chineseWiki,
    'zh-Hant': chineseWiki,
    en: {
        language: 'en',
        editor: {
            title: 'Nintendo',
            revisionId: 1379167316,
            citationText:
                'President Tatsumi Kimishima on the Future of Nintendo',
            previewTitle: 'Nintendo Switch',
        },
        manager: {
            title: 'Eternal Sonata',
            revisionId: 1376010866,
            citationText: 'Trusty Bell Launch Party',
        },
        highlighting: { title: 'Nintendo Switch', revisionId: 1378957550 },
    },
};

async function saveLedger() {
    await writeFile(
        ledgerPath,
        await format(JSON.stringify(ledger), { parser: 'json', tabWidth: 4 }),
    );
}

async function openSource(browser, article, locale) {
    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        deviceScaleFactor: 1,
        colorScheme: 'light',
        locale,
        serviceWorkers: 'block',
    });
    const writes = [];
    const apiResponses = [];
    const assets = [];
    const pageErrors = [];
    const pendingResponses = [];
    const nativeDismissals = [];
    const nativeEditorActions = [];
    const page = await context.newPage();
    await page.addLocatorHandler(
        page.locator('.ve-init-mw-welcomeDialog'),
        async (dialog) => {
            const action = dialog.locator('.oo-ui-buttonElement-button').last();
            nativeDismissals.push({
                dialog: 'MediaWiki first-edit welcome',
                action: await action.innerText(),
            });
            await action.click();
        },
    );
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const query = new URLSearchParams(url.search);
        const body = new URLSearchParams(request.postData() ?? '');
        const action = body.get('action') ?? query.get('action');
        if (isWikiWriteRequest(request)) {
            writes.push({
                url: request.url(),
                action,
                method: request.method(),
            });
            await route.abort('blockedbyclient');
            return;
        }
        await route.continue();
    });
    page.on('response', (response) => {
        const url = response.url();
        if (url.includes('/load.php') || /\.(?:css|woff2?)(?:\?|$)/u.test(url))
            assets.push({ url, status: response.status() });
        if (url.includes('/api/rest_v1/page/summary/'))
            pendingResponses.push(
                (async () => {
                    let data;
                    try {
                        data = await response.json();
                    } catch {
                        return;
                    }
                    apiResponses.push({ url, status: response.status(), data });
                })(),
            );
    });
    const wiki = captureWikis[locale];
    const url = new URL(`https://${wiki.language}.wikipedia.org/w/index.php`);
    url.search = new URLSearchParams({
        title: article.title,
        oldid: String(article.revisionId),
        action: 'edit',
        veswitched: '1',
        uselang: { 'zh-Hans': 'zh-cn', 'zh-Hant': 'zh-tw' }[locale] ?? locale,
        useskin: 'vector-2022',
    }).toString();
    try {
        const response = await page.goto(url.href, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
        });
        assert.ok(
            response?.ok(),
            `Wikimedia returned HTTP ${response?.status()}`,
        );
        await page.waitForFunction(
            () => window.mw?.loader?.using && window.mw?.config?.get,
            undefined,
            { timeout: 45000 },
        );
        await page.evaluate(() =>
            window.mw.loader.using(['mediawiki.api', 'mediawiki.util']),
        );
        const source = await page.locator('#wpTextbox1').inputValue();
        const revision = await page.evaluate(async (revisionId) => {
            const response = await new window.mw.Api().get({
                action: 'query',
                prop: 'revisions',
                revids: revisionId,
                rvprop: 'ids|timestamp|content',
                rvslots: 'main',
                formatversion: 2,
            });
            return response.query.pages[0].revisions[0];
        }, article.revisionId);
        assert.equal(revision.revid, article.revisionId);
        const revisionContent = revision.slots.main.content;
        assert.ok(
            source === revisionContent || source === `${revisionContent}\n`,
            'The native textarea must contain the full exact revision, allowing only MediaWiki’s terminal newline.',
        );
        const config = await page.evaluate(() =>
            Object.fromEntries(
                [
                    'wgPageName',
                    'wgRevisionId',
                    'wgCurRevisionId',
                    'wgUserLanguage',
                    'wgContentLanguage',
                    'wgWikiID',
                    'skin',
                ].map((key) => [key, window.mw.config.get(key)]),
            ),
        );
        assert.equal(config.wgWikiID, `${wiki.language}wiki`);
        const originalReadOnly = await page
            .locator('#wpTextbox1')
            .evaluate((element) => element.readOnly);
        if (wiki.language === 'en') {
            await expect(page.locator('.cm-editor')).toBeVisible({
                timeout: 45000,
            });
            const toggle = page.getByTitle('Syntax highlighting', {
                exact: true,
            });
            nativeEditorActions.push({
                control: 'Syntax highlighting',
                label: await toggle.innerText(),
                action: 'Disable native CodeMirror through its toolbar toggle',
            });
            await toggle.click();
            await expect(page.locator('#wpTextbox1')).toBeVisible();
            await expect(page.locator('#wpTextbox1')).toHaveValue(source);
            await expect(page.locator('#wpTextbox1')).toHaveJSProperty(
                'readOnly',
                originalReadOnly,
            );
        }
        await page.addScriptTag({ content: bundle });
        await expect(
            page.locator(
                '.kanade-source-editor-frame[data-kanade-source-editor-ready="true"]',
            ),
        ).toBeVisible({ timeout: 45000 });
        await expect(page.locator('#wpTextbox1')).toBeHidden();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page
            .locator('.kanade-source-editor-frame')
            .evaluate((element) => element.scrollIntoView({ block: 'start' }));
        return {
            context,
            page,
            source,
            writes,
            apiResponses,
            assets,
            pageErrors,
            pendingResponses,
            info: {
                article: article.title,
                revisionId: revision.revid,
                timestamp: revision.timestamp,
                sourceSha256: createHash('sha256').update(source).digest('hex'),
                sourceBytes: Buffer.byteLength(source),
                revisionContentSha256: createHash('sha256')
                    .update(revisionContent)
                    .digest('hex'),
                revisionContentBytes: Buffer.byteLength(revisionContent),
                nativeTerminalNewline: source !== revisionContent,
                originalReadOnly,
                nativeDismissals,
                nativeEditorActions,
                locale,
                url: page.url(),
                config,
            },
        };
    } catch (error) {
        await context.close();
        throw error;
    }
}

async function openPanel(page, messages) {
    await page
        .locator('#kanade-source-editor-panel a')
        .evaluate((element) => element.click());
    const panel = page.locator('.kanade-source-editor-dialog');
    await expect(panel).toBeVisible({ timeout: 45000 });
    await expect(panel).toHaveAttribute('lang', messages.locale);
    return panel;
}

async function capture(session, index, details = {}) {
    const {
        page,
        source,
        writes,
        info,
        pendingResponses,
        apiResponses,
        assets,
        pageErrors,
    } = session;
    assert.deepEqual(writes, [], 'Captures must never submit wiki writes.');
    await expect(page.locator('#wpTextbox1')).toHaveValue(source);
    await expect(page.locator('#wpTextbox1')).toBeHidden();
    await expect(page.locator('#wpTextbox1')).toHaveJSProperty(
        'readOnly',
        info.originalReadOnly,
    );
    await Promise.all(pendingResponses);
    await page.evaluate(() => document.fonts.ready);
    if (!details.keepHover) await page.mouse.move(0, 0);
    const image = documentationScreenshotFilename(
        info.locale,
        supportedViews.indexOf(index),
    );
    const captureRegion = details.editorSurface
        ? await page.locator('.kanade-source-editor-frame').boundingBox()
        : null;
    if (details.editorSurface) assert.ok(captureRegion);
    await page.screenshot({
        path: join(imageDirectory, image),
        animations: 'disabled',
        ...(captureRegion ? { clip: captureRegion } : {}),
    });
    const imageBytes = await readFile(join(imageDirectory, image));
    const imageSha256 = createHash('sha256').update(imageBytes).digest('hex');
    ledger.captures[image] = {
        ...info,
        ...details,
        image,
        imageSha256,
        ...(captureRegion
            ? {
                  requestedCaptureRegion: captureRegion,
                  captureRegion: {
                      ...captureRegion,
                      width: imageBytes.readUInt32BE(16),
                      height: imageBytes.readUInt32BE(20),
                  },
              }
            : {}),
        viewport: page.viewportSize(),
        deviceScaleFactor: 1,
        capturedAt: new Date().toISOString(),
        bundleArtifact,
        bundleSha256,
        apiResponses: [...apiResponses],
        assets: [...assets],
        pageErrors: [...pageErrors],
        writes: [...writes],
        dialogs: await page
            .locator('.cdx-dialog:visible')
            .evaluateAll((dialogs) =>
                dialogs.map((dialog) => ({
                    className: dialog.className,
                    bodyScrollTop:
                        dialog.querySelector('.cdx-dialog__body')?.scrollTop ??
                        null,
                })),
            ),
    };
    await saveLedger();
    console.log(
        `Live captured ${image}: ${info.article}, revision ${info.revisionId}`,
    );
}

async function captureEditor(browser, locale, messages) {
    const article = captureWikis[locale].editor;
    const session = await openSource(browser, article, locale);
    const { page } = session;
    try {
        // Apply the supported preview preference through its real control, without formatting article source.
        let panel = await openPanel(page, messages);
        await panel
            .getByRole('tab', {
                name: messages['dialog.editorTab'],
                exact: true,
            })
            .click();
        await panel
            .getByRole('checkbox', {
                name: messages['dialog.linkPreviews'],
                exact: true,
            })
            .check();
        await panel
            .getByRole('button', {
                name: messages['dialog.applySettings'],
                exact: true,
            })
            .click();
        await expect(panel).toBeHidden();
        const frame = page.frameLocator('.kanade-source-editor-frame');
        await page
            .locator('.kanade-source-editor-frame')
            .evaluate((element) => element.scrollIntoView({ block: 'start' }));
        if (views.has('01')) {
            const reference = frame
                .locator('[data-kanade-source-editor-reference]')
                .filter({ hasText: article.citationText })
                .first();
            const tooltip = frame.locator('.kanade-source-editor-tooltip');
            await expect(async () => {
                await reference.hover();
                await expect(tooltip).toBeVisible({ timeout: 2000 });
            }).toPass({ timeout: 45000 });
            await expect(tooltip).toContainText(article.citationText);
            await expect(
                tooltip.locator(
                    '.kanade-source-editor-tooltip__surface > button.cdx-button',
                ),
            ).toHaveCount(0);
            await expect(
                tooltip.locator('.kanade-source-editor-tooltip__edit').first(),
            ).toBeVisible();
            await capture(session, '01', {
                state: 'Live source citation inspection',
                editorSurface: true,
                keepHover: true,
                managementButtonPresent: false,
            });
        }
        if (views.has('02')) {
            await page.mouse.move(0, 0);
            const link = frame
                .locator(
                    `[data-kanade-source-editor-page-preview-title="${article.previewTitle}"]`,
                )
                .first();
            const preview = frame.locator('.kanade-source-editor-page-preview');
            await expect(async () => {
                await link.hover();
                await expect(preview).toBeVisible({ timeout: 2000 });
                await expect(
                    preview.locator(
                        '.kanade-source-editor-page-preview__extract',
                    ),
                ).not.toHaveText('', { timeout: 2000 });
            }).toPass({ timeout: 45000 });
            await capture(session, '02', {
                state: 'Live Nintendo Switch introduction preview',
                editorSurface: true,
                keepHover: true,
                previewText: await preview.innerText(),
            });
        }
        await page.mouse.move(0, 0);
        panel = await openPanel(page, messages);
        if (views.has('03')) {
            await panel
                .getByRole('tab', {
                    name: messages['dialog.formattingTab'],
                    exact: true,
                })
                .click();
            await panel
                .getByRole('checkbox', {
                    name: messages['dialog.formatReferences'],
                    exact: true,
                })
                .check();
            await panel.locator('.cdx-dialog__body').evaluate((element) => {
                element.scrollTop = 0;
            });
            await capture(session, '03', {
                state: 'Shared article and citation formatting preferences',
                panelText: await panel.innerText(),
                layout: await panel.evaluate((element) => {
                    const rectangle = (node) => {
                        const { x, y, width, height } =
                            node.getBoundingClientRect();
                        return { x, y, width, height };
                    };
                    const body = element.querySelector('.cdx-dialog__body');
                    return {
                        bodyScrollTop: body.scrollTop,
                        body: rectangle(body),
                        formattingGroups: [
                            ...element.querySelectorAll(
                                '.kanade-source-editor-dialog__formatting-groups > fieldset',
                            ),
                        ].map((group) => ({
                            text: group.innerText,
                            rectangle: rectangle(group),
                            legend: group.querySelector('legend')
                                ? rectangle(group.querySelector('legend'))
                                : null,
                        })),
                    };
                }),
            });
        }
        if (views.has('04')) {
            await panel
                .getByRole('tab', {
                    name: messages['dialog.editorTab'],
                    exact: true,
                })
                .click();
            await capture(session, '04', {
                state: 'Highlighting and source preview preferences',
                panelText: await panel.innerText(),
            });
        }
    } finally {
        await session.context.close();
    }
}

async function captureManager(browser, locale, messages) {
    const article = captureWikis[locale].manager;
    const session = await openSource(browser, article, locale);
    const { page } = session;
    try {
        const panel = await openPanel(page, messages);
        await panel
            .getByRole('tab', {
                name: messages['dialog.referencesTab'],
                exact: true,
            })
            .click();
        await panel
            .getByRole('button', {
                name: messages['dialog.manageReferences'],
                exact: true,
            })
            .click();
        const manager = page.locator('.kanade-source-editor-source-manager');
        await expect(manager).toBeVisible({ timeout: 45000 });
        if (views.has('05'))
            await capture(session, '05', {
                state: 'Live article sources and section filters',
            });
        if (views.has('06')) {
            await page.setViewportSize({ width: 683, height: 768 });
            await page
                .locator('.kanade-source-editor-frame')
                .evaluate((element) =>
                    element.scrollIntoView({ block: 'start' }),
                );
            await capture(session, '06', {
                state: 'Live article sources in a narrow desktop view',
            });
            await page.setViewportSize({ width: 1366, height: 768 });
        }
        if (views.has('07')) {
            const citation = manager
                .getByRole('row')
                .filter({ hasText: article.citationText })
                .first();
            await citation
                .getByRole('button', {
                    name: messages['lookup.editSource'],
                    exact: true,
                })
                .click();
            const draft = page.locator(
                '.kanade-source-editor-source-manager__draft-dialog',
            );
            await expect(draft).toBeVisible();
            await draft.getByRole('heading').first().click();
            const cancel = draft
                .locator('.kanade-source-editor-source-manager__footer-actions')
                .getByRole('button', {
                    name: messages['common.cancel'],
                    exact: true,
                });
            await expect(cancel).toHaveClass(/cdx-button--weight-quiet/u);
            await capture(session, '07', {
                state: 'Existing live citation draft with quiet Cancel',
                draftText: await draft.innerText(),
            });
            await cancel.click();
            await expect(draft).toBeHidden();
        }
        if (views.has('08')) {
            await manager
                .getByRole('tab', { name: messages['tabs.tools'], exact: true })
                .click();
            await capture(session, '08', {
                state: 'Citation checks and navigation to shared formatting settings',
                managerText: await manager.innerText(),
            });
        }
    } finally {
        await session.context.close();
    }
}

async function captureHighlighting(browser, locale, messages) {
    const session = await openSource(
        browser,
        captureWikis[locale].highlighting,
        locale,
    );
    try {
        const { page } = session;
        await expect(
            page
                .frameLocator('.kanade-source-editor-frame')
                .locator('.kanade-source-editor-editor'),
        ).toContainText('Nintendo Switch');
        const panel = await openPanel(page, messages);
        await panel
            .getByRole('tab', {
                name: messages['dialog.editorTab'],
                exact: true,
            })
            .click();
        await capture(session, '09', {
            state: 'Highlighting preferences over native Nintendo Switch source',
            panelText: await panel.innerText(),
        });
    } finally {
        await session.context.close();
    }
}

async function captureTextUtilities(browser, locale, messages) {
    const session = await openSource(
        browser,
        captureWikis[locale].editor,
        locale,
    );
    const { page } = session;
    try {
        const controls = page.locator('#kanade-quick-access');
        const editorAction = controls.locator(
            '[data-kanade-quick-access-action="source-editor"]',
        );
        const toolsAction = controls.locator(
            '[data-kanade-quick-access-action="source-editor-tools"]',
        );
        await expect(editorAction).toBeVisible();
        await expect(toolsAction).toBeVisible();
        if (views.has('11')) {
            await page.setViewportSize({ width: 375, height: 667 });
            await page
                .locator('.kanade-source-editor-frame')
                .evaluate((element) =>
                    element.scrollIntoView({ block: 'start' }),
                );
            await expect(editorAction).toBeInViewport();
            await expect(toolsAction).toBeInViewport();
            await capture(session, '11', {
                state: 'Horizontal bottom-right Format and Tools controls on mobile',
                quickAccess: await controls.evaluate((element) => {
                    const rectangle = (node) => {
                        const { x, y, width, height } =
                            node.getBoundingClientRect();
                        return { x, y, width, height };
                    };
                    return {
                        rectangle: rectangle(element),
                        actions: [
                            ...element.querySelectorAll(
                                '[data-kanade-quick-access-action]',
                            ),
                        ].map((action) => ({
                            id: action.getAttribute(
                                'data-kanade-quick-access-action',
                            ),
                            label: action.textContent,
                            rectangle: rectangle(action),
                        })),
                    };
                }),
            });
            await page.setViewportSize({ width: 1366, height: 768 });
        }
        if (views.has('10')) {
            await toolsAction.click();
            const panel = page.locator('.kanade-source-editor-dialog');
            await expect(panel).toBeVisible();
            await expect(
                panel.getByRole('tab', {
                    name: messages['dialog.toolsTab'],
                    exact: true,
                }),
            ).toHaveAttribute('aria-selected', 'true');
            const inputOnly = session.info.originalReadOnly;
            const pattern = inputOnly ? '' : String.raw`\bNintendo\b|任天堂`;
            const replacement = inputOnly ? '' : '$& [preview]';
            let outputSha256;
            for (const number of ['1', '2']) {
                for (const key of ['regex.pattern', 'regex.replacement'])
                    await expect(
                        panel.getByRole('textbox', {
                            name: messages[key].replace('{number}', number),
                            exact: true,
                        }),
                    ).toBeVisible();
            }
            if (!inputOnly) {
                await panel
                    .getByRole('textbox', {
                        name: messages['regex.pattern'].replace(
                            '{number}',
                            '1',
                        ),
                        exact: true,
                    })
                    .fill(pattern);
                await panel
                    .getByRole('textbox', {
                        name: messages['regex.replacement'].replace(
                            '{number}',
                            '1',
                        ),
                        exact: true,
                    })
                    .fill(replacement);
                await panel
                    .getByRole('button', {
                        name: messages['regex.preview'],
                        exact: true,
                    })
                    .click();
                const output = panel.getByRole('textbox', {
                    name: messages['regex.output'],
                    exact: true,
                });
                await expect(output).toBeVisible();
                await expect(output).toHaveValue(/\[preview\]/u);
                outputSha256 = createHash('sha256')
                    .update(await output.inputValue())
                    .digest('hex');
            }
            await panel.locator('.cdx-dialog__body').evaluate((element) => {
                element.scrollTop = 0;
            });
            await capture(session, '10', {
                state: inputOnly
                    ? 'Initial regular-expression replacement inputs on native read-only source'
                    : 'Regular-expression replacement preview without applying source changes',
                regex: {
                    pattern,
                    flags: 'g',
                    replacement,
                    inputOnly,
                    previewOnly: !inputOnly,
                    ...(outputSha256 ? { outputSha256 } : {}),
                },
                panelText: await panel.innerText(),
            });
            await panel
                .locator('.cdx-dialog__footer')
                .getByRole('button', {
                    name: messages['dialog.cancel'],
                    exact: true,
                })
                .click();
            await expect(panel).toBeHidden();
        }
    } finally {
        await session.context.close();
    }
}

await mkdir(imageDirectory, { recursive: true });
const proxy = configuredCaptureProxy();
const browser = await chromium.launch({
    headless: true,
    args: ['--disable-http2'],
    ...(proxy ? { proxy } : {}),
});
ledger.browserVersion = browser.version();
try {
    for (const locale of locales) {
        const messages = {
            ...JSON.parse(
                await readFile(
                    join(root, `src/source-editor/i18n/${locale}.json`),
                    'utf8',
                ),
            ),
            locale,
        };
        for (const [kind, run, ownedViews] of [
            ['editor', captureEditor, ['01', '02', '03', '04']],
            ['manager', captureManager, ['05', '06', '07', '08']],
            ['highlighting', captureHighlighting, ['09']],
            ['text-utilities', captureTextUtilities, ['10', '11']],
        ]) {
            const selectedViews = ownedViews.filter((view) => views.has(view));
            if (!selectedViews.length) continue;
            const startedAt = new Date().toISOString();
            try {
                console.log(`Live navigation ${locale}: ${kind}`);
                await run(browser, locale, messages);
            } catch (error) {
                ledger.failures.push({
                    locale,
                    kind,
                    views: selectedViews,
                    error: error.message,
                });
                console.error(
                    `Live capture failed ${locale} ${kind}: ${error.message}`,
                );
            }
            const completedViews = selectedViews.filter(
                (view) =>
                    ledger.captures[
                        documentationScreenshotFilename(
                            locale,
                            supportedViews.indexOf(view),
                        )
                    ]?.capturedAt >= startedAt,
            );
            ledger.failures = ledger.failures.flatMap((failure) => {
                if (failure.locale !== locale || failure.kind !== kind)
                    return [failure];
                const remaining = (failure.views ?? ownedViews).filter(
                    (view) => !completedViews.includes(view),
                );
                return remaining.length
                    ? [{ ...failure, views: remaining }]
                    : [];
            });
            await saveLedger();
        }
    }
} finally {
    await browser.close();
    await saveLedger();
}
if (ledger.failures.length) process.exitCode = 1;
