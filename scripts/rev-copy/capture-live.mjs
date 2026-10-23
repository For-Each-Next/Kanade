/**
 * @file scripts/rev-copy/capture-live.mjs
 * Purpose: Capture and check the built gadget on actual Wikimedia pages without host mocks.
 *
 * Table of contents:
 * 1. Inputs and ordinary network proxy discovery
 * 2. Real navigation, MediaWiki startup, and revision verification
 * 3. Live page and skin captures
 * 4. Provenance and command-line entry point
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
    args.every((arg) => arg === '--skip-skins' || arg.startsWith('--only=')),
    'Supported options: --skip-skins or --only=<comma-separated profile keys>',
);
const only = args
    .find((arg) => arg.startsWith('--only='))
    ?.slice(7)
    .split(',');
const popupLabels = Object.fromEntries(
    await Promise.all(
        ['en', 'zh-Hans'].map(async (language) => {
            const messages = JSON.parse(
                await readFile(
                    join(root, `src/rev-copy/i18n/${language}.json`),
                    'utf8',
                ),
            );
            return [
                language,
                [
                    messages.sectionCopyPage,
                    messages.sectionCopyPermalink,
                    messages.sectionCopyBoth,
                    messages.sectionAdvanced,
                ],
            ];
        }),
    ),
);
const screenshotFiles = {
    english: documentationScreenshotFilename('en'),
    'zh-hans': documentationScreenshotFilename('zh-Hans'),
    advanced: documentationScreenshotFilename('zh-Hant'),
    'advanced-en': 'screenshot04.en.png',
    'advanced-narrow': 'screenshot05.zh-Hant.png',
    'advanced-mobile': 'screenshot06.zh-Hant.png',
    commons: 'screenshot07.en.png',
};
const article = '信賴鈴音_～蕭邦之夢～';
const englishSource = {
    key: 'english-skin-source',
    url: 'https://en.wikipedia.org/wiki/Eternal_Sonata?useskin=timeless&uselang=en',
    prefix: 'w:en:',
    skin: 'timeless',
    interfaceLanguage: 'en',
};
const sources = [
    {
        key: 'english',
        url: 'https://en.wikipedia.org/wiki/Eternal_Sonata?useskin=vector-2022&uselang=en',
        prefix: 'w:en:',
        skin: 'vector-2022',
        interfaceLanguage: 'en',
        retainSource: true,
    },
    {
        key: 'zh-hans',
        url: `https://zh.wikipedia.org/zh-cn/${article}?useskin=vector-2022&uselang=zh-cn`,
        prefix: '',
        skin: 'vector-2022',
        interfaceLanguage: 'zh-cn',
        sectionId: '遊戲操作',
        popupActions: popupLabels['zh-Hans'],
    },
    ...['advanced', 'advanced-narrow', 'advanced-mobile'].map((key) => ({
        key,
        url: `https://zh.wikipedia.org/zh-tw/${article}?useskin=vector-2022&uselang=zh-tw`,
        prefix: '',
        skin: 'vector-2022',
        interfaceLanguage: 'zh-tw',
        advanced: true,
    })),
    {
        key: 'advanced-en',
        url: 'https://en.wikipedia.org/wiki/Nintendo?useskin=vector-2022&uselang=en',
        prefix: 'w:en:',
        skin: 'vector-2022',
        interfaceLanguage: 'en',
        sourceLanguage: 'ja',
        targetLanguage: 'en',
        attributionPattern: /^This page was translated from/u,
        retainSource: true,
        advanced: true,
    },
    {
        key: 'commons',
        url: 'https://en.wikipedia.org/wiki/Intel_1103?useskin=vector-2022&uselang=en',
        prefix: 'w:en:',
        skin: 'vector-2022',
        interfaceLanguage: 'en',
        sourceReference: 'c:Category:Intel 1103',
        sourceInterwiki: 'c',
        attributionPattern: /^This page was copied from/u,
        mode: 'copy',
        retainSource: true,
        advanced: true,
    },
];
assert.ok(
    !only || only.every((key) => sources.some((source) => source.key === key)),
    'Choose one of the supported screenshot profiles.',
);
const bundle = await readFile(join(root, 'dist/rev_copy.min.js'), 'utf8');
const bundleSha256 = createHash('sha256').update(bundle).digest('hex');
const provenancePath = join(root, 'docs/rev-copy/images/live-captures.json');
let previous = {};
try {
    previous = JSON.parse(await readFile(provenancePath, 'utf8'));
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}
const provenance = {
    ...previous,
    capturedAt: new Date().toISOString(),
    method: 'Actual headless Chromium page.goto, actual MediaWiki/API/CSS/assets, production bundle injection, and page.screenshot. Requests are intercepted only to block wiki writes; no response substitution, setContent, host replacement, or MediaWiki/clipboard mocks.',
    viewport: { width: 1366, height: 768, deviceScaleFactor: 1 },
    bundleSha256,
    bundleArtifact: 'dist/rev_copy.min.js',
    // A targeted recapture cannot erase provenance for retained images or skin checks.
    // Each record keeps its own capture time and bundle hash.
    pages: { ...previous.pages },
    skinChecks: previous.skinChecks ?? [],
    failures: (previous.failures ?? []).filter(
        ({ key }) =>
            !sources.some(
                (source) => source.key === key && (!only || only.includes(key)),
            ) &&
            (only || args.includes('--skip-skins') || !key.startsWith('skin-')),
    ),
};

async function actualAssetReadiness(page) {
    await page.waitForFunction(
        () =>
            [...document.querySelectorAll('link[rel="stylesheet"]')].every(
                (link) => link.sheet,
            ),
        undefined,
        { timeout: 20000 },
    );
    return page.evaluate(async () => {
        const images = [
            ...document.querySelectorAll('#mw-content-text img'),
        ].filter((image) => {
            const box = image.getBoundingClientRect();
            return (
                box.width &&
                box.height &&
                box.top < window.innerHeight &&
                box.bottom > 0
            );
        });
        await Promise.race([
            Promise.all([
                document.fonts.ready,
                ...images.map((image) =>
                    image.complete
                        ? Promise.resolve()
                        : new Promise((resolve) => {
                              image.addEventListener('load', resolve, {
                                  once: true,
                              });
                              image.addEventListener('error', resolve, {
                                  once: true,
                              });
                          }),
                ),
            ]),
            new Promise((resolve) => setTimeout(resolve, 12000)),
        ]);
        return {
            readyState: document.readyState,
            fonts: document.fonts.status,
            visibleImages: images.map((image) => ({
                url: image.currentSrc,
                loaded: image.complete && image.naturalWidth > 0,
            })),
            stylesheets: [
                ...document.querySelectorAll('link[rel="stylesheet"]'),
            ].map((link) => ({ url: link.href, loaded: Boolean(link.sheet) })),
        };
    });
}

async function headingPositions(page) {
    return page.evaluate(() =>
        Object.fromEntries(
            [
                document.querySelector(
                    'h1#firstHeading, h1.mw-first-heading, h1.firstHeading',
                ),
                ...document.querySelectorAll(
                    '#mw-content-text h2, #mw-content-text h3',
                ),
            ]
                .filter(Boolean)
                .map((heading, index) => {
                    const walker = document.createTreeWalker(
                        heading,
                        NodeFilter.SHOW_TEXT,
                        {
                            acceptNode: (node) =>
                                node.textContent.trim() &&
                                !node.parentElement.closest(
                                    '.kanade-rev-copy-section-control, .mw-editsection',
                                )
                                    ? NodeFilter.FILTER_ACCEPT
                                    : NodeFilter.FILTER_REJECT,
                        },
                    );
                    const node = walker.nextNode();
                    if (!node) return [index, null];
                    const range = document.createRange();
                    range.selectNodeContents(node);
                    const box = range.getBoundingClientRect();
                    return [
                        (heading.tagName === 'H1' ? 'top' : heading.id) ||
                            heading.querySelector('.mw-headline[id]')?.id ||
                            heading.closest('[id]')?.id ||
                            index,
                        { left: box.left, right: box.right },
                    ];
                }),
        ),
    );
}

async function saveProvenance() {
    await writeFile(
        provenancePath,
        await format(JSON.stringify(provenance), {
            parser: 'json',
            tabWidth: 4,
        }),
    );
}

async function navigate(browser, source) {
    const attempts = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
        const context = await browser.newContext({
            viewport: { width: 1366, height: 768 },
            deviceScaleFactor: 1,
            timezoneId: 'Asia/Shanghai',
            colorScheme: 'light',
            serviceWorkers: 'block',
        });
        const blockedWrites = [];
        await context.route('**/*', async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const body = new URLSearchParams(request.postData() ?? '');
            const action = body.get('action') ?? url.searchParams.get('action');
            if (isWikiWriteRequest(request)) {
                blockedWrites.push({
                    url: request.url(),
                    action,
                    method: request.method(),
                });
                await route.abort('blockedbyclient');
                return;
            }
            await route.continue();
        });
        const page = await context.newPage();
        const failedRequests = [];
        page.on('requestfailed', (request) =>
            failedRequests.push({
                url: request.url(),
                error: request.failure()?.errorText,
                type: request.resourceType(),
            }),
        );
        try {
            console.log(
                `Live navigation: ${source.key}, attempt ${attempt}, ${source.url}`,
            );
            const response = await page.goto(source.url, {
                waitUntil: 'domcontentloaded',
                timeout: 45000,
            });
            assert.ok(
                response?.ok(),
                `Upstream HTTP status ${response?.status()}`,
            );
            await page.waitForFunction(
                () =>
                    typeof window.mw !== 'undefined' &&
                    window.mw.loader?.using &&
                    window.mw.config?.get,
                undefined,
                { timeout: 45000 },
            );
            await page.evaluate(() =>
                window.mw.loader.using(['mediawiki.api', 'mediawiki.util']),
            );
            const assets = await actualAssetReadiness(page);
            const originalHeadings = await headingPositions(page);
            let originalNarrowHeadings;
            if (source.skin === 'minerva') {
                await page.setViewportSize({ width: 375, height: 667 });
                originalNarrowHeadings = await headingPositions(page);
                await page.setViewportSize({ width: 1366, height: 768 });
            }
            console.log(
                `Actual MediaWiki ready: ${source.key}, ${await page.title()}`,
            );
            return {
                context,
                page,
                failedRequests,
                attempts,
                assets,
                originalHeadings,
                originalNarrowHeadings,
                blockedWrites,
            };
        } catch (error) {
            attempts.push({
                attempt,
                error: error.message,
                failedRequests: failedRequests.slice(-8),
            });
            console.log(
                `Live navigation failed: ${source.key}, ${error.message.split('\n')[0]}`,
            );
            await context.close();
        }
    }
    throw new Error(
        `Actual page failed after 3 normal network attempts: ${source.key}: ${JSON.stringify(attempts)}`,
    );
}

async function verifyActualRow(page, source) {
    await page.addScriptTag({ content: bundle });
    const row = page.locator('#kanade-rev-copy-row');
    await expect(row).toBeVisible({ timeout: 45000 });
    const info = await page.evaluate(async () => {
        const configKeys = [
            'skin',
            'wgPageName',
            'wgRevisionId',
            'wgCurRevisionId',
            'wgDiffOldId',
            'wgDiffNewId',
            'wgContentLanguage',
            'wgUserLanguage',
            'wgUserVariant',
            'wgNamespaceNumber',
            'wgAction',
        ];
        const config = Object.fromEntries(
            configKeys.map((key) => [key, window.mw.config.get(key)]),
        );
        const revisionId =
            Number(config.wgDiffNewId) > 0
                ? Number(config.wgDiffNewId)
                : Number(config.wgRevisionId);
        if (revisionId <= 0) return { config, revisionId, timestamp: null };
        const response = await new window.mw.Api().get({
            action: 'query',
            prop: 'revisions',
            revids: revisionId,
            rvprop: 'ids|timestamp',
            formatversion: 2,
        });
        const revision = response.query?.pages
            ?.flatMap((item) => item.revisions ?? [])
            .find((item) => item.revid === revisionId);
        return { config, revisionId, timestamp: revision?.timestamp ?? null };
    });
    const pageTitle = info.config.wgPageName.replaceAll('_', ' ');
    if (source.interfaceLanguage) {
        assert.equal(info.config.wgUserLanguage, source.interfaceLanguage);
        const wikiLanguage = source.interfaceLanguage.startsWith('zh-')
            ? 'zh'
            : source.interfaceLanguage;
        assert.equal(
            new URL(page.url()).hostname,
            `${wikiLanguage}.wikipedia.org`,
            'The Wikipedia edition must match the interface language.',
        );
    }
    if (source.skin)
        assert.equal(
            info.config.skin,
            source.skin,
            'The actual skin must match the requested screenshot profile.',
        );
    const expectedPage = `[[:${source.prefix}${pageTitle}]]`;
    await expect(row.locator('.kanade-rev-copy-page')).toHaveText(expectedPage);
    assert.equal(
        await row
            .locator('.kanade-rev-copy-page')
            .evaluate((element) => element.tagName),
        'CODE',
    );
    if (source.pageOnly) {
        await expect(row.locator('.kanade-rev-copy-revision')).toBeHidden();
        await expect(
            row.locator('[data-kanade-rev-copy-action="copy"]'),
        ).toHaveAttribute('aria-disabled', 'false');
    } else {
        assert.ok(
            info.timestamp,
            'The actual Action API must return the displayed revision timestamp.',
        );
        const label = await page.evaluate(
            ({ timestamp, language }) =>
                new Intl.DateTimeFormat(language, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hourCycle: 'h23',
                    timeZone: 'UTC',
                }).format(new Date(timestamp)),
            {
                timestamp: info.timestamp,
                language: info.config.wgContentLanguage,
            },
        );
        const target =
            Number(info.config.wgDiffNewId) > 0
                ? Number(info.config.wgDiffOldId) > 0
                    ? `Special:Diff/${info.config.wgDiffOldId}/${info.revisionId}`
                    : `Special:Diff/${info.revisionId}`
                : `Special:PermaLink/${info.revisionId}`;
        const expectedPermalink = `[[:${source.prefix}${target}|${label}]]`;
        await expect(row.locator('.kanade-rev-copy-permalink')).toHaveText(
            expectedPermalink,
            { timeout: 45000 },
        );
        await expect(
            row.locator('[data-kanade-rev-copy-action="copy"]'),
        ).toHaveAttribute('aria-disabled', 'false');
        assert.equal(
            await row
                .locator('.kanade-rev-copy-permalink')
                .evaluate((element) => element.tagName),
            'CODE',
        );
        info.expectedPermalink = expectedPermalink;
        info.expectedAll = `${expectedPage} (${expectedPermalink})`;
    }
    await expect(row).not.toContainText('UTC');
    info.fonts = await row.evaluate((element) => ({
        wikitext: getComputedStyle(
            element.querySelector('.kanade-rev-copy-page'),
        ).fontFamily,
        action: getComputedStyle(
            element.querySelector('.kanade-rev-copy-action'),
        ).fontFamily,
    }));
    assert.match(info.fonts.wikitext, /monospace/iu);
    assert.notEqual(
        info.fonts.wikitext,
        info.fonts.action,
        'Copy action links must keep their normal interface font.',
    );
    if (!source.pageOnly) {
        info.fonts.parentheses = await row
            .locator('.kanade-rev-copy-revision-wikitext')
            .evaluate((element) => getComputedStyle(element).fontFamily);
        assert.equal(
            info.fonts.parentheses,
            info.fonts.wikitext,
            'The parentheses must share the literal wikitext monospace font.',
        );
    }
    await expect(page.locator('#kanade-rev-copy-row')).toHaveCount(1);
    info.expectedPage = expectedPage;
    info.boundary = await row.evaluate((element) => ({
        parentId: element.parentElement.id,
        parentClass: element.parentElement.className,
        nextId: element.nextElementSibling?.id,
        marginTop: getComputedStyle(element).marginTop,
        marginBottom: getComputedStyle(element).marginBottom,
    }));
    assert.equal(info.boundary.marginTop, '0px');
    assert.equal(info.boundary.marginBottom, '0px');
    return info;
}

async function verifyHeadingPopup(
    page,
    sectionId,
    originalHeadings,
    expectedActions = popupLabels.en,
) {
    await page.keyboard.press('Escape');
    const trigger = page.locator(
        `.kanade-rev-copy-section-trigger[href="#${encodeURIComponent(sectionId)}"]`,
    );
    await expect(trigger).toBeVisible();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.hover();
    const geometry = await trigger.evaluate((element) => {
        const heading = element.closest('h1, h2, h3');
        const walker = document.createTreeWalker(
            heading,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) =>
                    node.textContent.trim() &&
                    !node.parentElement.closest(
                        '.kanade-rev-copy-section-control, .mw-editsection',
                    )
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT,
            },
        );
        const range = document.createRange();
        range.selectNodeContents(walker.nextNode());
        const text = range.getBoundingClientRect();
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2,
        );
        return {
            headingTag: heading.tagName,
            textLeft: text.left,
            textRight: text.right,
            triggerLeft: box.left,
            triggerRight: box.right,
            overflow: getComputedStyle(heading).overflow,
            parentOverflow: getComputedStyle(heading.parentElement).overflow,
            font: getComputedStyle(element).fontSize,
            hit: hit === element || element.contains(hit),
            direction: getComputedStyle(heading).direction,
            viewportWidth: window.innerWidth,
        };
    });
    assert.ok(
        originalHeadings[sectionId],
        `The original ${sectionId} heading must be recorded before gadget injection.`,
    );
    assert.ok(
        Math.abs(geometry.textLeft - originalHeadings[sectionId].left) <= 0.5,
        `The original ${sectionId} heading text must retain its horizontal position.`,
    );
    assert.ok(
        geometry.triggerRight < geometry.textLeft,
        `The ${sectionId} # must hang left of the heading text.`,
    );
    assert.ok(
        geometry.triggerLeft >= 0 &&
            geometry.triggerRight <= geometry.viewportWidth,
        `The ${sectionId} # must stay within the viewport.`,
    );
    assert.ok(
        geometry.hit,
        `The ${sectionId} # must remain visible and receive pointer input.`,
    );
    // A previous heading's popup can remain visible during the hover delay.
    // Wait for this owner before checking its choices or taking the screenshot.
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const popup = page.locator('.kanade-rev-copy-section-popup');
    await expect(popup).toBeVisible();
    await expect(popup.locator('.kanade-rev-copy-section-action')).toHaveText(
        expectedActions,
    );
    return {
        geometry,
        actions: await popup
            .locator('.kanade-rev-copy-section-action')
            .allTextContents(),
    };
}

async function capturePage(browser, source) {
    const session = await navigate(browser, source);
    const {
        context,
        page,
        failedRequests,
        attempts,
        assets,
        originalHeadings,
    } = session;
    try {
        const info = await verifyActualRow(page, source);
        if (source.retainSource) {
            info.source = await page.evaluate(async (revisionId) => {
                const response = await new window.mw.Api().get({
                    action: 'query',
                    prop: 'revisions',
                    revids: revisionId,
                    rvprop: 'ids|timestamp|content',
                    rvslots: 'main',
                    formatversion: 2,
                });
                const revision = response.query?.pages
                    ?.flatMap((item) => item.revisions ?? [])
                    .find((item) => item.revid === revisionId);
                return revision ?? null;
            }, info.revisionId);
            assert.equal(typeof info.source?.slots?.main?.content, 'string');
        }
        if (new URL(source.url).hostname === 'zh.wikipedia.org') {
            const nativeClose = page.locator('.va-variant-prompt__close');
            try {
                await nativeClose.waitFor({ state: 'visible', timeout: 5000 });
            } catch {
                /* This site prompt is optional. */
            }
            if (await nativeClose.isVisible()) {
                await nativeClose.click();
                await expect(page.locator('.va-variant-prompt')).toBeHidden();
                info.nativeVariantPromptDismissed = true;
            }
            const notice = page.locator('#siteNotice');
            if (await notice.isVisible()) {
                const localNotice = page.locator('#localNotice');
                const target = (await localNotice.isVisible())
                    ? localNotice
                    : notice;
                info.nativeTopNotice = {
                    selector: await target.evaluate(
                        (element) => `#${element.id}`,
                    ),
                    originalText: (await target.innerText()).slice(0, 500),
                };
                const controls = notice.locator(
                    'button, [role="button"], a, [class*="close" i], [id*="close" i]',
                );
                const closeIndex = await controls.evaluateAll((elements) =>
                    elements.findIndex((element) => {
                        const box = element.getBoundingClientRect();
                        const description = [
                            element.className,
                            element.id,
                            element.getAttribute('title'),
                            element.getAttribute('aria-label'),
                            element.textContent.length < 80
                                ? element.textContent
                                : '',
                        ].join(' ');
                        return (
                            box.width &&
                            box.height &&
                            /close|dismiss|关闭|關閉|閉じる|×|✕/iu.test(
                                description,
                            )
                        );
                    }),
                );
                if (closeIndex >= 0) {
                    info.nativeTopNotice.method =
                        'Actual native close control click';
                    info.nativeTopNotice.control = await controls
                        .nth(closeIndex)
                        .evaluate((element) => ({
                            tag: element.tagName,
                            class: element.className,
                            id: element.id,
                            ariaLabel: element.getAttribute('aria-label'),
                        }));
                    await controls.nth(closeIndex).click();
                } else {
                    info.nativeTopNotice.method =
                        'User-authorized local screenshot preparation: original native top-notice container hidden in the actual page after no native close control was found';
                    await target.evaluate((element) => {
                        element.hidden = true;
                        element.style.display = 'none';
                    });
                }
                await expect(target).toBeHidden();
            }
        }
        const row = page.locator('#kanade-rev-copy-row');
        const box = await row.boundingBox();
        if (box.y + box.height > 650)
            await page.evaluate(
                (top) => window.scrollTo(0, Math.max(0, top - 220)),
                box.y,
            );
        if (source.sectionId) {
            const heading = await verifyHeadingPopup(
                page,
                source.sectionId,
                originalHeadings,
                source.popupActions,
            );
            info.headingGeometry = heading.geometry;
            info.sectionId = source.sectionId;
            info.popupActions = heading.actions;
        }
        if (source.advanced) {
            if (source.key === 'advanced-narrow') {
                await page.setViewportSize({ width: 683, height: 768 });
            } else if (source.key === 'advanced-mobile') {
                await page.setViewportSize({ width: 375, height: 667 });
            }
            const action = row.locator(
                '[data-kanade-rev-copy-action="advanced"]',
            );
            await action.focus();
            await page.keyboard.press('Enter');
            const dialog = page.locator('.kanade-rev-copy-advanced-dialog');
            await expect(dialog).toBeVisible({ timeout: 45000 });
            const output = dialog.locator('textarea');
            await expect(output).toBeVisible();
            const input = dialog.locator('input[name$="-from"]');
            const prefix = dialog.locator('input[name$="-from-prefix"]');
            const reference = source.sourceReference?.split(':');
            await prefix.fill(reference?.[0] ?? source.sourceLanguage ?? 'ja');
            await input.fill(reference?.slice(1).join(':') ?? '');
            if (source.targetLanguage) {
                await dialog
                    .locator('input[name$="-to-prefix"]')
                    .fill(source.targetLanguage);
            }
            if (source.mode === 'copy') {
                await dialog
                    .locator('.cdx-toggle-button-group button')
                    .nth(1)
                    .click();
                await expect(prefix).toHaveAttribute('placeholder', 'en');
                const targetPrefix = dialog.locator(
                    'input[name$="-to-prefix"]',
                );
                await expect(targetPrefix).toHaveValue('');
                await expect(targetPrefix).toHaveAttribute('placeholder', 'en');
            }
            if (source.key === 'advanced-narrow') {
                await dialog.locator('input[type="radio"]').nth(1).check();
            }
            await input.press('Enter');
            const targetLink =
                source.key === 'advanced-narrow'
                    ? /w:zh:Special:PermaLink\/\d+/u
                    : new RegExp(
                          `${source.sourceInterwiki ?? `w:${source.sourceLanguage ?? 'ja'}`}:Special:PermaLink/\\d+`,
                          'u',
                      );
            await expect(output)
                .toHaveValue(targetLink, {
                    timeout: 45000,
                })
                .catch(async (error) => {
                    const feedback = await dialog
                        .locator('.cdx-dialog__footer')
                        .innerText();
                    throw new Error(
                        `${error.message}\nDialog feedback: ${feedback}`,
                    );
                });
            info.attribution = await output.inputValue();
            if (source.key !== 'advanced-narrow')
                assert.doesNotMatch(info.attribution, /[.。]$/u);
            assert.match(
                info.attribution,
                source.key === 'advanced-narrow'
                    ? /^== 中国語版ウィキペディアへの翻訳 ==/u
                    : (source.attributionPattern ?? /翻譯自/u),
            );
            assert.match(info.attribution, targetLink);
            await output.scrollIntoViewIfNeeded();
            info.dialog = await dialog.evaluate((element) => {
                const box = element.getBoundingClientRect();
                return {
                    width: box.width,
                    left: box.left,
                    right: box.right,
                    viewportWidth: window.innerWidth,
                    documentWidth: document.documentElement.scrollWidth,
                };
            });
            assert.ok(info.dialog.left >= 0);
            assert.ok(info.dialog.right <= info.dialog.viewportWidth);
            info.viewport = page.viewportSize();
        }
        info.blockedWrites = session.blockedWrites;
        assert.equal(
            info.blockedWrites.length,
            0,
            'A read-only capture must not attempt wiki writes.',
        );
        if (!source.pageOnly) {
            const filename = screenshotFiles[source.key];
            await page.screenshot({
                path: join(root, 'docs/rev-copy/images', filename),
                animations: 'disabled',
            });
            info.image = filename;
            info.imageSha256 = createHash('sha256')
                .update(
                    await readFile(
                        join(root, 'docs/rev-copy/images', filename),
                    ),
                )
                .digest('hex');
        }
        info.finalUrl = page.url();
        info.title = await page.title();
        info.capturedAt = new Date().toISOString();
        info.bundleSha256 = bundleSha256;
        info.networkAttempts = attempts;
        info.failedRequests = failedRequests;
        info.assets = assets;
        provenance.pages[source.key] = info;
        console.log(
            `Live verified: ${source.key}, skin ${info.config.skin}, revision ${info.revisionId}, ${info.expectedPermalink ?? 'page-only row'}`,
        );
        return { ...session, info };
    } catch (error) {
        await context.close();
        throw error;
    }
}

async function checkAvailableSkins(browser) {
    provenance.skinChecks = [];
    const source = englishSource;
    const { context, page } = await navigate(browser, source);
    let skins;
    try {
        skins = await page.evaluate(
            async () =>
                (
                    await new window.mw.Api().get({
                        action: 'query',
                        meta: 'siteinfo',
                        siprop: 'skins',
                        formatversion: 2,
                    })
                ).query.skins,
        );
        provenance.availableSkins = skins;
    } finally {
        await context.close();
    }
    for (const skin of skins.filter((item) => !item.unusable)) {
        const skinSource = {
            ...source,
            key: `skin-${skin.code}`,
            url: `${source.url.split('?')[0]}?useskin=${encodeURIComponent(skin.code)}&uselang=en`,
            skin: skin.code,
        };
        try {
            const {
                context,
                page,
                originalHeadings,
                originalNarrowHeadings,
                blockedWrites,
            } = await navigate(browser, skinSource);
            try {
                const info = await verifyActualRow(page, skinSource);
                assert.equal(
                    info.config.skin,
                    skin.code,
                    'The actual selected skin must match the requested usable skin.',
                );
                const section = await verifyHeadingPopup(
                    page,
                    'Development',
                    originalHeadings,
                );
                info.headingGeometry = section.geometry;
                info.sectionPopupActions = section.actions;
                const lead = await verifyHeadingPopup(
                    page,
                    'top',
                    originalHeadings,
                );
                info.leadHeadingGeometry = lead.geometry;
                info.leadPopupActions = lead.actions;
                await page.keyboard.press('Escape');
                info.sectionPointerPassed = true;
                info.leadPointerPassed = true;
                if (skin.code === 'minerva') {
                    await page.setViewportSize({ width: 375, height: 667 });
                    const narrowSection = await verifyHeadingPopup(
                        page,
                        'Development',
                        originalNarrowHeadings,
                    );
                    info.narrowHeadingGeometry = narrowSection.geometry;
                    info.narrowSectionPopupActions = narrowSection.actions;
                    const narrowLead = await verifyHeadingPopup(
                        page,
                        'top',
                        originalNarrowHeadings,
                    );
                    info.narrowLeadHeadingGeometry = narrowLead.geometry;
                    info.narrowLeadPopupActions = narrowLead.actions;
                    await page.keyboard.press('Escape');
                }
                info.blockedWrites = blockedWrites;
                assert.equal(
                    blockedWrites.length,
                    0,
                    'Live skin checks must not attempt wiki writes.',
                );
                provenance.skinChecks.push({
                    skin: skin.code,
                    status: 'passed',
                    url: page.url(),
                    ...info,
                    bundleSha256,
                    verifiedAt: new Date().toISOString(),
                    headingOverflow: await page
                        .locator('#mw-content-text h2')
                        .evaluateAll((headings) =>
                            headings.map((heading) => ({
                                id:
                                    heading.id ||
                                    heading.querySelector('.mw-headline[id]')
                                        ?.id,
                                overflow: getComputedStyle(heading).overflow,
                                parentOverflow: getComputedStyle(
                                    heading.parentElement,
                                ).overflow,
                            })),
                        ),
                });
                console.log(`Actual live skin passed: ${skin.code}`);
            } finally {
                await context.close();
            }
        } catch (error) {
            provenance.skinChecks.push({
                skin: skin.code,
                status: 'failed',
                error: error.message,
                bundleSha256,
                verifiedAt: new Date().toISOString(),
            });
            provenance.failures.push({
                key: skinSource.key,
                error: error.message,
            });
            console.error(
                `Actual live skin failed: ${skin.code}: ${error.message.split('\n')[0]}`,
            );
        }
    }
}

await mkdir(join(root, 'docs/rev-copy/images'), { recursive: true });
const proxy = configuredCaptureProxy();
console.log(
    proxy
        ? `Using configured browser proxy: ${new URL(proxy.server).origin}`
        : 'Using the ordinary browser network route.',
);
const browser = await chromium.launch({
    headless: true,
    args: ['--disable-http2'],
    ...(proxy ? { proxy } : {}),
});
provenance.browserVersion = browser.version();
provenance.browserArguments = ['--disable-http2'];
try {
    for (const source of sources.filter(
        (item) => !only || only.includes(item.key),
    )) {
        try {
            const result = await capturePage(browser, source);
            await result.context.close();
        } catch (error) {
            provenance.failures.push({ key: source.key, error: error.message });
            console.error(
                `Live check failed: ${source.key}: ${error.message.split('\n')[0]}`,
            );
        }
        await saveProvenance();
    }
    if (!args.includes('--skip-skins') && !only)
        await checkAvailableSkins(browser);
} finally {
    await browser.close();
    await saveProvenance();
}
if (provenance.failures.length) process.exitCode = 1;
console.log(`Actual live capture provenance: ${provenancePath}`);
