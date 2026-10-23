/**
 * @file scripts/vg-stub-creator/capture-live.mjs
 * Purpose: Capture the production creator on actual Wikipedia without publishing edits.
 * Contents: Live host startup, supplied form interactions, screenshot profiles, and provenance.
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
const directory = join(root, 'docs/vg-stub-creator/images');
const artifact = 'dist/vg_stub_creator.user.js';
const bundle = await readFile(join(root, artifact), 'utf8');
const example = JSON.parse(
    await readFile(
        join(root, 'tests/vg-stub-creator/fixtures/toem-2.screenshot.json'),
        'utf8',
    ),
);
const languages = ['en', 'zh-Hans', 'zh-Hant'];
const desktopOnly = process.argv.includes('--desktop-only');
const factsOnly = process.argv.includes('--facts-only');
const only = process.argv
    .slice(2)
    .filter((value) => !['--desktop-only', '--facts-only'].includes(value));
assert.ok(!desktopOnly || !factsOnly, 'Choose one capture subset.');
assert.ok(only.every((language) => languages.includes(language)));
const selectedLanguages = only.length ? only : languages;
const sourceTitle = '信賴鈴音 ～蕭邦之夢～';
const sourceRevision = 94743103;
const provenancePath = join(directory, 'live-captures.json');
let previous = {};
try {
    previous = JSON.parse(await readFile(provenancePath, 'utf8'));
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}
const provenance = {
    capturedAt: new Date().toISOString(),
    method: 'Actual Chromium navigation to Wikipedia, native MediaWiki configuration and ResourceLoader Vue/Codex, production userscript injection, visible form interactions, and page screenshots. No replacement host, HTML reconstruction, or simulated API responses. A request guard aborts write actions; native preview POSTs remain read-only.',
    artifact,
    bundleSha256: createHash('sha256').update(bundle).digest('hex'),
    suppliedInput: 'tests/vg-stub-creator/fixtures/toem-2.screenshot.json',
    inputMeaning:
        'User-supplied illustrative Toem 2 values, not independently verified factual metadata. Wikipedia page checks and any source lookups use live services and retain actual success, failure, or unconfirmed results.',
    sourceTitle,
    sourceRevision,
    captures: [...(previous.captures ?? [])],
    failures: [...(previous.failures ?? [])],
};

async function saveProvenance() {
    await writeFile(
        provenancePath,
        await format(JSON.stringify(provenance), {
            parser: 'json',
            tabWidth: 4,
        }),
    );
}

async function scrollBodyTo(locator) {
    await locator.evaluate((element) => {
        const body = element.closest('.cdx-dialog__body');
        if (body)
            body.scrollTop +=
                element.getBoundingClientRect().top -
                body.getBoundingClientRect().top -
                16;
    });
}

async function captureLanguage(browser, language) {
    const messages = JSON.parse(
        await readFile(
            join(root, `src/vg-stub-creator/i18n/${language}.json`),
            'utf8',
        ),
    );
    const context = await browser.newContext({
        viewport: { width: 1024, height: 768 },
        deviceScaleFactor: 1,
        timezoneId: 'Asia/Shanghai',
        colorScheme: 'light',
    });
    const blockedWrites = [];
    const previewApiRequests = [];
    const navigationAttempts = [];
    await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const data = request.postData() ?? '';
        const params = new URLSearchParams(data);
        const action = url.searchParams.get('action') || params.get('action');
        if (request.method() === 'POST' && action === 'parse')
            previewApiRequests.push({
                action,
                title: params.get('title'),
                preview: params.has('preview'),
                textSha256: createHash('sha256')
                    .update(params.get('text') ?? '')
                    .digest('hex'),
            });
        if (isWikiWriteRequest(request)) {
            blockedWrites.push({ url: request.url(), action });
            await route.abort('blockedbyclient');
        } else {
            await route.continue();
        }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('console', (message) => {
        if (message.type() === 'warning' || message.type() === 'error')
            console.log(`Browser ${language}: ${message.text().slice(0, 500)}`);
    });
    const failedRequests = [];
    const httpErrors = [];
    page.on('response', (response) => {
        if (response.status() >= 400)
            httpErrors.push({
                url: response.url(),
                status: response.status(),
                retryAfter: response.headers()['retry-after'] ?? null,
            });
    });
    page.on('requestfailed', (request) => {
        failedRequests.push({
            url: request.url(),
            error: request.failure()?.errorText,
        });
    });
    const interfaceLanguage =
        language === 'zh-Hans'
            ? 'zh-cn'
            : language === 'zh-Hant'
              ? 'zh-tw'
              : language;
    const url = new URL('https://zh.wikipedia.org/w/index.php');
    url.search = new URLSearchParams({
        title: sourceTitle,
        oldid: String(sourceRevision),
        action: 'edit',
        useskin: 'vector-2022',
        uselang: interfaceLanguage,
    }).toString();
    console.log(`Live creator navigation: ${language}, ${url}`);
    try {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await page.goto(url.href, {
                    waitUntil: 'domcontentloaded',
                    timeout: 45000,
                });
                assert.equal(response?.status(), 200);
                navigationAttempts.push({ attempt, status: response.status() });
                break;
            } catch (error) {
                navigationAttempts.push({ attempt, error: error.message });
                if (attempt === 3) throw error;
                console.log(
                    `Retrying actual Wikipedia navigation: ${language}, attempt ${attempt + 1}`,
                );
            }
        }
        await page.waitForFunction(
            () => window.mw?.loader?.using && window.mw.config?.get,
            undefined,
            { timeout: 45000 },
        );
        await page.addScriptTag({ content: bundle });
        const welcome = page.locator('.ve-init-mw-welcomeDialog');
        try {
            await welcome.waitFor({ state: 'visible', timeout: 5000 });
        } catch {
            // Existing browser profiles need no first-edit welcome dismissal.
        }
        if (await welcome.isVisible())
            await welcome.locator('.oo-ui-buttonElement-button').last().click();
        await page
            .locator('#kanade-vg-stub-creator-launcher a, #t-vg-stub-creator a')
            .click();
        const main = page.locator('.kanade-vg-stub-creator-dialog');
        await expect(main).toBeVisible({ timeout: 45000 });
        await expect(main).toHaveAttribute('lang', language);
        const config = await page.evaluate(() =>
            Object.fromEntries(
                [
                    'wgDBname',
                    'wgPageName',
                    'wgAction',
                    'wgArticleId',
                    'wgRevisionId',
                    'wgUserLanguage',
                    'wgContentLanguage',
                    'skin',
                ].map((key) => [key, window.mw.config.get(key)]),
            ),
        );
        assert.equal(config.wgDBname, 'zhwiki');
        const nativeSource = await page.locator('#wpTextbox1').inputValue();
        const originalReadOnly = await page
            .locator('#wpTextbox1')
            .evaluate((element) => element.readOnly);
        const source = await page.evaluate(async (revisionId) => {
            const result = await new window.mw.Api().get({
                action: 'query',
                prop: 'revisions',
                revids: revisionId,
                rvprop: 'ids|timestamp|content',
                rvslots: 'main',
                formatversion: 2,
            });
            return result.query.pages[0].revisions[0];
        }, sourceRevision);
        assert.equal(source.revid, sourceRevision);
        const revisionContent = source.slots.main.content;
        assert.ok(
            nativeSource === revisionContent ||
                nativeSource === `${revisionContent}\n`,
            'The native source must match the pinned revision, allowing only MediaWiki’s terminal newline.',
        );
        source.revisionContentSha256 = createHash('sha256')
            .update(revisionContent)
            .digest('hex');
        source.nativeSourceSha256 = createHash('sha256')
            .update(nativeSource)
            .digest('hex');
        source.nativeTerminalNewline = nativeSource !== revisionContent;
        source.originalReadOnly = originalReadOnly;
        delete source.slots;
        const enwiki = main.getByRole('textbox', {
            name: messages['metadata.enwikiPage'],
            exact: true,
        });
        try {
            await expect(enwiki).toBeVisible({ timeout: 10000 });
        } catch (error) {
            // The native first-edit welcome can open after the tool launcher.
            if (!(await welcome.isVisible())) throw error;
            await welcome.locator('.oo-ui-buttonElement-button').last().click();
            await expect(enwiki).toBeVisible({ timeout: 30000 });
        }
        await enwiki.fill(example.enwikiTitle);
        await enwiki.blur();
        for (const [fieldKey, messageKey] of [
            ['developers', 'metadata.developers'],
            ['publishers', 'metadata.publishers'],
            ['platforms', 'metadata.platforms'],
            ['year', 'metadata.releaseYear'],
            ['genres', 'metadata.genres'],
        ]) {
            const field = main.locator(
                `[data-kanade-vg-stub-creator-field="${fieldKey}"]`,
            );
            const input = field.getByRole('textbox', {
                name: messages[messageKey],
                exact: true,
            });
            await input.fill(example[fieldKey]);
            await input.blur();
            await expect(input).toHaveValue('');
        }
        const platforms = main.locator(
            '[data-kanade-vg-stub-creator-field="platforms"]',
        );
        const developers = main.locator(
            '[data-kanade-vg-stub-creator-field="developers"]',
        );
        await main
            .getByRole('tab', { name: messages['titles.tab'], exact: true })
            .click();
        const englishName = main
            .locator('[data-kanade-vg-stub-creator-field="englishName"]')
            .getByRole('textbox', {
                name: messages['titles.englishTitle'],
                exact: true,
            });
        await englishName.fill(example.englishName);
        await englishName.blur();
        const localizedCard = main
            .locator('[data-kanade-vg-stub-creator-name-kind="localized"]')
            .first();
        const localizedName = localizedCard.getByRole('textbox', {
            name: messages['names.localizedName'] + ' 1',
            exact: true,
        });
        await localizedName.fill(example.localizedName.name);
        await localizedName.blur();
        await localizedCard
            .getByRole('checkbox', {
                name: messages['names.official'],
                exact: true,
            })
            .setChecked(true);
        await localizedCard
            .getByRole('checkbox', { name: 'Hans', exact: true })
            .setChecked(true);
        const localizedSource = localizedCard.getByRole('textbox', {
            name: messages['names.sourceUrls'] + ' 1',
            exact: true,
        });
        await localizedSource.fill(example.localizedName.sourceUrl);
        await localizedSource.blur();
        await localizedCard
            .locator('[data-kanade-vg-stub-creator-name-set-uses]')
            .click();
        for (const role of ['pageName', 'displayTitle']) {
            const group = localizedCard.locator(
                `[data-kanade-vg-stub-creator-name-role="${role}"]`,
            );
            const value = group.getByRole('textbox');
            await value.fill('');
            await value.press('Enter');
            await group.getByRole('checkbox').check();
        }
        await localizedCard
            .locator('[data-kanade-vg-stub-creator-name-role="noteTa"]')
            .getByRole('checkbox')
            .check();
        await main
            .getByRole('tab', { name: messages['text.tab'], exact: true })
            .click();
        for (const [fieldKey, messageKey] of [
            ['metacriticScore', 'text.metacriticScore'],
            ['openCriticRecommend', 'text.openCritic'],
            ['additionalProse', 'text.additionalProse'],
        ]) {
            const input = main
                .locator(`[data-kanade-vg-stub-creator-field="${fieldKey}"]`)
                .getByRole('textbox', {
                    name: messages[messageKey],
                    exact: true,
                });
            await input.fill(example[fieldKey]);
            await input.blur();
        }
        let metadataLookup;
        async function screenshot(index, state) {
            await expect(page.locator('#wpTextbox1')).toHaveValue(nativeSource);
            await expect(page.locator('#wpTextbox1')).toHaveJSProperty(
                'readOnly',
                originalReadOnly,
            );
            assert.deepEqual(
                blockedWrites,
                [],
                'Captures must never submit wiki writes.',
            );
            await page.mouse.move(0, 0);
            await page.evaluate(() => document.fonts.ready);
            const filename = documentationScreenshotFilename(
                language,
                Number(index) - 1,
            );
            await page.screenshot({
                path: join(directory, filename),
                animations: 'disabled',
            });
            const capture = {
                image: filename,
                imageSha256: createHash('sha256')
                    .update(await readFile(join(directory, filename)))
                    .digest('hex'),
                state,
                language,
                viewport: page.viewportSize(),
                deviceScaleFactor: 1,
                url: page.url(),
                config,
                source,
                capturedAt: new Date().toISOString(),
                bundleSha256: provenance.bundleSha256,
                failedRequests: structuredClone(failedRequests),
                httpErrors: structuredClone(httpErrors),
                blockedWrites: structuredClone(blockedWrites),
                previewApiRequests: structuredClone(previewApiRequests),
                navigationAttempts: structuredClone(navigationAttempts),
                metadataLookup,
            };
            provenance.captures = provenance.captures.filter(
                (previousCapture) => previousCapture.image !== filename,
            );
            provenance.captures.push(capture);
            await saveProvenance();
            console.log(`Live creator screenshot: ${filename}`);
        }
        await main
            .getByRole('tab', { name: messages['metadata.tab'], exact: true })
            .click();
        await main.locator('.cdx-dialog__body').evaluate((body) => {
            body.scrollTop = 0;
        });
        const metadataHelp = main.locator(
            '.kanade-vg-stub-creator-enwiki-help',
        );
        let metadataSettled = true;
        try {
            await expect(metadataHelp).not.toContainText(
                messages['metadata.checking'],
                { timeout: 60000 },
            );
        } catch {
            metadataSettled = false;
            console.log(`Live metadata remains pending: ${language}`);
        }
        metadataLookup = {
            settled: metadataSettled,
            visibleText: await metadataHelp.innerText(),
        };
        let reviewReady = true;
        try {
            await expect(
                main.getByRole('button', {
                    name: messages['form.review'],
                    exact: true,
                }),
            ).toBeEnabled({ timeout: 60000 });
        } catch {
            reviewReady = false;
            console.log(`Live article review remains loading: ${language}`);
        }
        metadataLookup.reviewReady = reviewReady;
        await expect(
            main.getByRole('button', {
                name: messages['review.refresh'],
                exact: true,
            }),
        ).toBeEnabled({ timeout: 60000 });
        await screenshot(
            '01',
            'Supplied Facts input on an actual Wikipedia source view; page/category checks use live APIs.',
        );
        if (desktopOnly) {
            assert.deepEqual(
                blockedWrites,
                [],
                'No capture control must attempt a live wiki write.',
            );
            return;
        }
        await scrollBodyTo(platforms);
        await screenshot(
            '02',
            'Platform, release-year, and genre rows with the native related-page refresh and reset controls.',
        );
        await page.setViewportSize({ width: 390, height: 844 });
        await scrollBodyTo(developers);
        await screenshot('03', 'Facts input at a mobile viewport.');
        if (factsOnly) {
            assert.deepEqual(
                blockedWrites,
                [],
                'No capture control must attempt a live wiki write.',
            );
            return;
        }
        await page.setViewportSize({ width: 1024, height: 768 });
        await main
            .getByRole('tab', { name: messages['titles.tab'], exact: true })
            .click();
        await main.locator('.cdx-dialog__body').evaluate((body) => {
            body.scrollTop = 0;
        });
        await expect(
            main.getByText(messages['names.rolePageChecking'], { exact: true }),
        ).toHaveCount(0, { timeout: 60000 });
        await screenshot(
            '04',
            'Steam helper and Google links for the supplied English name; no helper results are invented.',
        );
        await scrollBodyTo(localizedCard);
        await screenshot(
            '05',
            'Expanded localized-name uses with real Wikipedia page status.',
        );
        await page.setViewportSize({ width: 390, height: 844 });
        await scrollBodyTo(localizedCard);
        await screenshot(
            '06',
            'Expanded localized-name uses at a mobile viewport.',
        );
        await page.setViewportSize({ width: 1024, height: 768 });
        const englishCard = main.locator(
            '[data-kanade-vg-stub-creator-name-kind="english"]',
        );
        await englishCard
            .locator('[data-kanade-vg-stub-creator-name-set-uses]')
            .click();
        const redirects = englishCard.locator(
            '[data-kanade-vg-stub-creator-name-role="redirect"]',
        );
        await redirects
            .getByRole('button', {
                name: messages['names.addRedirect'],
                exact: true,
            })
            .click();
        const extra = redirects
            .locator('[data-kanade-vg-stub-creator-name-redirect-row]')
            .getByRole('textbox')
            .last();
        await extra.fill(example.englishName + ' (video game)');
        await extra.press('Enter');
        await expect(
            main.getByText(messages['names.rolePageChecking'], { exact: true }),
        ).toHaveCount(0, { timeout: 60000 });
        await scrollBodyTo(englishCard);
        await screenshot(
            '07',
            'Illustrative alternative name with real Wikipedia redirect/page check, without saving.',
        );
        // This final example reviews generated text without waiting for optional
        // external citation metadata; the prior views retain the supplied URL.
        await localizedCard
            .getByRole('button', {
                name: messages['form.removeReference'].replace(
                    '{url}',
                    example.localizedName.sourceUrl,
                ),
                exact: true,
            })
            .click();
        await main
            .getByRole('button', { name: messages['form.review'], exact: true })
            .click();
        const withoutMoving = page.getByRole('button', {
            name: messages['text.previewWithoutMoving'],
            exact: true,
        });
        try {
            await withoutMoving.waitFor({ state: 'visible', timeout: 5000 });
        } catch {
            // Matching source and draft titles need no move-choice dialog.
        }
        if (await withoutMoving.isVisible()) await withoutMoving.click();
        const article = page.getByRole('textbox', {
            name: messages['preview.wikitext'],
            exact: true,
        });
        await expect(article).toBeVisible({ timeout: 120000 });
        await expect(article).toHaveValue(/摄影冒险2/u);
        const parsedDraft = previewApiRequests.findLast(
            (request) => request.preview,
        );
        if (parsedDraft) assert.equal(parsedDraft.title, example.pageName);
        await article.evaluate((textarea) => {
            textarea.scrollTop = 0;
        });
        await screenshot(
            '08',
            'Generated supplied-example wikitext after clearing the manually supplied Steam URL, reviewed through actual MediaWiki preview; article remains unpublished.',
        );
        assert.deepEqual(
            blockedWrites,
            [],
            'No capture control must attempt a live wiki write.',
        );
    } catch (error) {
        console.error(
            `Visible creator state: ${(await page.locator('body').innerText()).slice(-4000)}`,
        );
        throw error;
    } finally {
        await context.close();
    }
}

await mkdir(directory, { recursive: true });
const proxy = configuredCaptureProxy();
const browser = await chromium.launch({
    headless: true,
    args: ['--disable-http2'],
    ...(proxy ? { proxy } : {}),
});
provenance.browserVersion = browser.version();
try {
    for (const language of selectedLanguages) {
        try {
            await captureLanguage(browser, language);
            provenance.failures = provenance.failures.filter(
                (failure) =>
                    failure.language !== language ||
                    (desktopOnly && !failure.desktopOnly) ||
                    (factsOnly && !failure.factsOnly),
            );
        } catch (error) {
            provenance.failures = provenance.failures.filter(
                (failure) =>
                    failure.language !== language ||
                    (desktopOnly && !failure.desktopOnly) ||
                    (factsOnly && !failure.factsOnly),
            );
            provenance.failures.push({
                language,
                desktopOnly,
                factsOnly,
                error: error.message,
            });
            console.error(
                `Live creator capture failed: ${language}: ${error.message}`,
            );
        }
        await saveProvenance();
    }
} finally {
    await browser.close();
    await saveProvenance();
}
if (provenance.failures.length) process.exitCode = 1;
