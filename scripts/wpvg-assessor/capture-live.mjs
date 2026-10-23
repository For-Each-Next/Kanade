/**
 * @file scripts/wpvg-assessor/capture-live.mjs
 * Purpose: Capture the assessment interface on live Chinese Wikipedia without saves.
 * Contents: Browser network route, live page setup, localized views, and provenance.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { format } from 'prettier';
import { configuredCaptureProxy } from '../capture-browser.mjs';
import { isWikiWriteRequest } from '../capture-request.mjs';
import { documentationScreenshotFilename } from '../documentation-images.mjs';

const directory = 'docs/wpvg-assessor/images';
const bundle = await readFile('dist/wpvg_assessor.min.js', 'utf8');
const bundleSha256 = createHash('sha256').update(bundle).digest('hex');
const supportedLocales = ['en', 'zh-Hans', 'zh-Hant'];
const captureGroups = [
    ['BanG Dream! 少女樂團派對', [1, 2]],
    ['Category:未评级电子游戏条目', [3]],
    ['WikiProject:电子游戏/新进条目', [4]],
];
const args = process.argv.slice(2);
assert.ok(
    args.every(
        (argument) =>
            argument.startsWith('--locales=') ||
            argument.startsWith('--titles='),
    ),
    'Supported options: --locales=en,zh-Hans,zh-Hant and --titles=Category:未评级电子游戏条目',
);
const locales =
    args
        .find((argument) => argument.startsWith('--locales='))
        ?.slice(10)
        .split(',') ?? supportedLocales;
const titles =
    args
        .find((argument) => argument.startsWith('--titles='))
        ?.slice(9)
        .split(',') ?? captureGroups.map(([title]) => title);
assert.ok(locales.every((locale) => supportedLocales.includes(locale)));
assert.ok(
    titles.every((title) =>
        captureGroups.some(([candidate]) => candidate === title),
    ),
);
let previous = {};
try {
    previous = JSON.parse(
        await readFile(`${directory}/live-captures.json`, 'utf8'),
    );
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}
const previousPages = await Promise.all(
    (previous.pages ?? []).map(async (page) => ({
        ...page,
        bundleArtifact: page.bundleArtifact ?? previous.bundleArtifact,
        bundleSha256: page.bundleSha256 ?? previous.bundleSha256,
        browserVersion: page.browserVersion ?? previous.browserVersion,
        captures: await Promise.all(
            page.captures.map(async (capture) => ({
                ...capture,
                bundleArtifact:
                    capture.bundleArtifact ??
                    page.bundleArtifact ??
                    previous.bundleArtifact,
                bundleSha256:
                    capture.bundleSha256 ??
                    page.bundleSha256 ??
                    previous.bundleSha256,
                imageSha256:
                    capture.imageSha256 ??
                    createHash('sha256')
                        .update(await readFile(`${directory}/${capture.image}`))
                        .digest('hex'),
                deviceScaleFactor: capture.deviceScaleFactor ?? 1,
            })),
        ),
    })),
);
const ledger = {
    ...previous,
    capturedAt: new Date().toISOString(),
    method: 'Chromium navigation to actual Chinese Wikipedia pages, native MediaWiki/Vue/Codex/API/assets, built bundle injection, and browser screenshots. No simulated page content or API responses. No wiki saves.',
    bundleArtifact: 'dist/wpvg_assessor.min.js',
    bundleSha256,
    pages: previousPages,
    failures: [...(previous.failures ?? [])],
};

async function openLivePage(browser, title, locale) {
    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        deviceScaleFactor: 1,
        colorScheme: 'light',
        locale,
    });
    const page = await context.newPage();
    const edits = [];
    const revisions = new Map();
    const metadataReads = [];
    page.on('response', (response) => {
        if (!response.url().includes('/api.php') || !response.ok()) return;
        metadataReads.push(
            response
                .json()
                .then((data) => {
                    const pages = data.query?.pages;
                    for (const source of Array.isArray(pages)
                        ? pages
                        : Object.values(pages ?? {})) {
                        for (const revision of source.revisions ?? []) {
                            if (
                                typeof source.title === 'string' &&
                                Number.isSafeInteger(revision.revid)
                            ) {
                                revisions.set(source.title, {
                                    title: source.title,
                                    revisionId: revision.revid,
                                    timestamp: revision.timestamp,
                                });
                            }
                        }
                    }
                })
                .catch(() => {}),
        );
    });
    const requestedLanguage =
        { 'zh-Hans': 'zh-cn', 'zh-Hant': 'zh-tw' }[locale] ?? locale;
    const url = new URL('https://zh.wikipedia.org/w/index.php');
    url.search = new URLSearchParams({
        title,
        uselang: requestedLanguage,
        useskin: 'vector-2022',
    }).toString();
    await context.route('**/*', async (route) => {
        const request = route.request();
        if (isWikiWriteRequest(request)) {
            edits.push({ method: request.method(), url: request.url() });
            await route.abort('blockedbyclient');
        } else {
            await route.continue();
        }
    });
    try {
        const response = await page.goto(url.href, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
        });
        assert.ok(
            response?.ok(),
            `Wikipedia returned HTTP ${response?.status()}`,
        );
        await page.waitForFunction(
            () => window.mw?.loader?.using && window.mw?.config?.get,
            undefined,
            { timeout: 45000 },
        );
        await page.evaluate(() =>
            window.mw.loader.using(['mediawiki.api', 'mediawiki.util']),
        );
        await page.addScriptTag({ content: bundle });
        const opener = page.locator('#kanade-wpvg-assessor-launcher a');
        await expect(opener).toHaveCount(1, { timeout: 45000 });
        await opener.evaluate((element) => element.click());
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible({ timeout: 45000 });
        await expect(dialog).toHaveAttribute('lang', locale);
        const config = await page.evaluate(() =>
            Object.fromEntries(
                [
                    'wgPageName',
                    'wgRevisionId',
                    'wgUserLanguage',
                    'wgContentLanguage',
                    'skin',
                ].map((key) => [key, window.mw.config.get(key)]),
            ),
        );
        return {
            context,
            page,
            dialog,
            edits,
            revisions,
            metadataReads,
            info: {
                title,
                locale,
                url: page.url(),
                config,
                captures: [],
                bundleArtifact: ledger.bundleArtifact,
                bundleSha256,
                browserVersion: browser.version(),
            },
        };
    } catch (error) {
        await context.close();
        throw error;
    }
}

async function capture(session, index, locale) {
    const { page, dialog, edits, info, revisions, metadataReads } = session;
    await page.evaluate(() => document.fonts.ready);
    await dialog.locator('.cdx-dialog__body').evaluate((element) => {
        element.scrollTop = 0;
    });
    const height = await dialog.evaluate((element) => {
        const body = element.querySelector('.cdx-dialog__body');
        return Math.ceil(
            element.getBoundingClientRect().height +
                body.scrollHeight -
                body.clientHeight +
                48,
        );
    });
    await page.setViewportSize({ width: 1366, height: Math.max(768, height) });
    const image = documentationScreenshotFilename(
        locale,
        [3, 1, 2, 4].indexOf(index),
    );
    assert.deepEqual(edits, [], 'Capture must not submit wiki edits.');
    await page.screenshot({
        path: `${directory}/${image}`,
        animations: 'disabled',
    });
    await Promise.allSettled(metadataReads);
    info.sourceRevisions = [...revisions.values()];
    info.captures.push({
        image,
        imageSha256: createHash('sha256')
            .update(await readFile(`${directory}/${image}`))
            .digest('hex'),
        bundleArtifact: ledger.bundleArtifact,
        bundleSha256,
        deviceScaleFactor: 1,
        viewport: page.viewportSize(),
        capturedAt: new Date().toISOString(),
    });
    console.log(
        `Live captured ${image}: ${info.title}, revision ${info.config.wgRevisionId}`,
    );
}

await mkdir(directory, { recursive: true });
const proxy = configuredCaptureProxy();
const browser = await chromium.launch({
    headless: true,
    args: ['--disable-http2'],
    ...(proxy ? { proxy } : {}),
});
ledger.browserVersion = browser.version();
try {
    for (const locale of locales) {
        const messages = JSON.parse(
            await readFile(`src/wpvg-assessor/i18n/${locale}.json`, 'utf8'),
        );
        for (const [title, indices] of captureGroups.filter(([title]) =>
            titles.includes(title),
        )) {
            let session;
            try {
                console.log(`Live navigation ${locale}: ${title}`);
                session = await openLivePage(browser, title, locale);
                const { page, dialog } = session;
                if (indices[0] === 1) {
                    const importance = dialog.getByRole('group', {
                        name: messages['dialog.importance'],
                        exact: true,
                    });
                    await expect(
                        importance.getByRole('radio').first(),
                    ).toBeEnabled({ timeout: 45000 });
                    await capture(session, 1, locale);
                    await importance
                        .getByRole('radio', {
                            name: messages['assessmentImportance.mid'],
                            exact: true,
                        })
                        .check();
                    await expect(
                        dialog.getByRole('textbox', {
                            name: messages['dialog.readySource'],
                            exact: true,
                        }),
                    ).toHaveValue(/importance=Mid/u);
                    await capture(session, 2, locale);
                } else if (indices[0] === 3) {
                    await expect(dialog.locator('iframe')).toBeVisible({
                        timeout: 60000,
                    });
                    await expect(
                        page.frameLocator('iframe').locator('body'),
                    ).toContainText(/\S/u, { timeout: 60000 });
                    const preview = page.frameLocator('iframe');
                    // The reading frame disables scripts, so wait from Node rather than scheduling frame timers.
                    await expect
                        .poll(
                            () =>
                                preview
                                    .locator('body')
                                    .evaluate(() =>
                                        [...document.images].every(
                                            (image) => image.complete,
                                        ),
                                    ),
                            { timeout: 45000 },
                        )
                        .toBe(true);
                    session.info.previewImages = await preview
                        .locator('body')
                        .evaluate(() =>
                            [...document.images].map((image) => ({
                                url: image.currentSrc,
                                loaded:
                                    image.complete && image.naturalWidth > 0,
                            })),
                        );
                    assert.ok(
                        session.info.previewImages.length === 0 ||
                            session.info.previewImages.some(
                                (image) => image.loaded,
                            ),
                        'Native Wikimedia preview images must load.',
                    );
                    await capture(session, 3, locale);
                } else {
                    await expect(
                        dialog.getByRole('button', {
                            name: messages['archive.reload'],
                            exact: true,
                        }),
                    ).toBeEnabled({ timeout: 60000 });
                    await expect(
                        dialog.getByText(messages['archive.loading'], {
                            exact: true,
                        }),
                    ).toHaveCount(0, { timeout: 60000 });
                    await capture(session, 4, locale);
                }
                assert.deepEqual(session.edits, []);
                session.info.edits = [...session.edits];
                ledger.pages = ledger.pages.filter(
                    (page) => !(page.title === title && page.locale === locale),
                );
                ledger.pages.push(session.info);
                ledger.failures = ledger.failures.filter(
                    (failure) =>
                        !(failure.title === title && failure.locale === locale),
                );
            } catch (error) {
                ledger.failures = ledger.failures.filter(
                    (failure) =>
                        !(failure.title === title && failure.locale === locale),
                );
                ledger.failures.push({ title, locale, error: error.message });
                console.error(
                    `Live capture failed ${locale} ${title}: ${error.message}`,
                );
            } finally {
                await session?.context.close();
                await writeFile(
                    `${directory}/live-captures.json`,
                    await format(JSON.stringify(ledger), {
                        parser: 'json',
                        tabWidth: 4,
                    }),
                );
            }
        }
    }
} finally {
    await browser.close();
}
if (ledger.failures.length) process.exitCode = 1;
