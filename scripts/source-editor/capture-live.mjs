/**
 * @file scripts/source-editor/capture-live.mjs
 * Purpose: Capture Source Editor on actual Wikimedia source views without simulated host data or wiki saves.
 * Contents: Browser setup, verified article source, formatting preferences, and provenance.
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
    'Supported options: --locales=en,zh-Hans,zh-Hant and --views=03',
);
const supportedLocales = ['en', 'zh-Hans', 'zh-Hant'];
const supportedViews = ['03'];
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
    editor: { title: '任天堂', revisionId: 94167581 },
};
const captureWikis = {
    'zh-Hans': chineseWiki,
    'zh-Hant': chineseWiki,
    en: {
        language: 'en',
        editor: { title: 'Nintendo', revisionId: 1379167316 },
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
        await page.addScriptTag({ content: bundle });
        await expect(page.locator('#kanade-source-editor-panel')).toBeAttached({
            timeout: 45000,
        });
        await page.emulateMedia({ reducedMotion: 'reduce' });
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
    await expect(page.locator('#wpTextbox1')).toHaveJSProperty(
        'readOnly',
        info.originalReadOnly,
    );
    await Promise.all(pendingResponses);
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
    const image = documentationScreenshotFilename(
        info.locale,
        supportedViews.indexOf(index),
    );
    await page.screenshot({
        path: join(imageDirectory, image),
        animations: 'disabled',
    });
    const imageBytes = await readFile(join(imageDirectory, image));
    const imageSha256 = createHash('sha256').update(imageBytes).digest('hex');
    ledger.captures[image] = {
        ...info,
        ...details,
        image,
        imageSha256,
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
    const session = await openSource(
        browser,
        captureWikis[locale].editor,
        locale,
    );
    const { page } = session;
    try {
        const panel = await openPanel(page, messages);
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
        });
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
            ['editor', captureEditor, ['03']],
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
if (
    ledger.failures.some(
        (failure) =>
            locales.includes(failure.locale) &&
            failure.kind === 'editor' &&
            failure.views?.some((view) => views.has(view)),
    )
)
    process.exitCode = 1;
