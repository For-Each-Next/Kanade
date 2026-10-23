/**
 * @file tests/wpvg-assessor/ui/screenshots.spec.ts
 * Purpose: Localized offline screenshot regressions saved to temporary test output.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 * 3. Constants and state
 * 4. fitDocumentationScreenshot
 */

import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import {
    chooseOption,
    expect,
    getFixtureMessages,
    getPosts,
    openAssessor,
    openArchiver,
    openCategoryAssessor,
    test,
} from './fixtures.ts';
import {
    annualArchiveTitle,
    archiveAnnualText,
    archiveListText,
} from './archive-fixture.ts';

test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
test.skip(
    process.env.DOCUMENTATION_SCREENSHOTS !== '1',
    'Run DOCUMENTATION_SCREENSHOTS=1 node scripts/test-ui.mjs --grep documentation to inspect offline screenshot fixtures in temporary test output.',
);

const article = JSON.parse(
    await readFile(
        new URL('../fixtures/bang-dream.source.json', import.meta.url),
        'utf8',
    ),
);
const articleSource = await readFile(
    new URL('../fixtures/bang-dream.wikitext', import.meta.url),
    'utf8',
);
const openingParagraph = articleSource
    .split('\n')
    .find((line) => line.startsWith("《'''BanG Dream!"))!;
let paragraph = openingParagraph;
while (/\{\{[^{}]*\}\}/u.test(paragraph))
    paragraph = paragraph.replace(/\{\{[^{}]*\}\}/gu, '');
paragraph = paragraph
    .replace(
        /\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/gu,
        (_match, title, label) => label ?? title,
    )
    .replaceAll("'''", '')
    .replace(/（\s*）/gu, '');
const escapeHtml = (text: string) =>
    text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
const articleHtml = (excerptHeading: string) =>
    '<h1>' +
    escapeHtml(article.title) +
    '</h1><p>' +
    escapeHtml(paragraph) +
    '</p><h2>' +
    escapeHtml(excerptHeading) +
    '</h2><pre style="white-space:pre-wrap">' +
    escapeHtml(articleSource.split('\n').slice(8, 24).join('\n')) +
    '</pre>';
const lead = (
    await readFile(
        new URL('../fixtures/bang-dream-talk-lead.wikitext', import.meta.url),
        'utf8',
    )
).trimEnd();

for (const { locale, suffix, excerptHeading } of [
    { locale: 'en', suffix: '', excerptHeading: 'Article source excerpt' },
    {
        locale: 'zh-Hans',
        suffix: '.zh-Hans',
        excerptHeading: '条目源代码节录',
    },
    {
        locale: 'zh-Hant',
        suffix: '.zh-Hant',
        excerptHeading: '條目原始碼節錄',
    },
]) {
    const { msg } = getFixtureMessages(locale);

    test(`documentation: ${locale} assessment controls and reviewed source at 1280px`, async ({
        page,
    }, testInfo) => {
        const directory = testInfo.outputPath('documentation-screenshots');
        await mkdir(directory, { recursive: true });
        const dialog = await openAssessor(page, {
            expired: true,
            lead,
            locale,
            pageTitle: article.title,
        });
        await expect(dialog).toHaveAttribute('lang', locale);
        const sharedClass = page.getByRole('textbox', {
            name: msg('dialog.customClassValue'),
            exact: true,
        });
        await expect(sharedClass).toHaveValue(msg('assessmentClass.fa'));
        await expect(dialog).toBeVisible();
        await fitDocumentationScreenshot(page, dialog);
        await page.screenshot({
            path: resolve(directory, `screenshot-01${suffix}.png`),
            animations: 'disabled',
        });
        await chooseOption(
            page,
            msg('dialog.importance'),
            msg('assessmentImportance.mid'),
        );
        await expect(sharedClass).toHaveValue(msg('assessmentClass.fa'));
        await expect(
            page.getByRole('textbox', {
                name: msg('dialog.readySource'),
                exact: true,
            }),
        ).toHaveValue(/WikiProject Video games\s*\|importance=Mid/u);
        await fitDocumentationScreenshot(page, dialog);
        await page.screenshot({
            path: resolve(directory, `screenshot-02${suffix}.png`),
            animations: 'disabled',
        });
        expect(await getPosts(page)).toEqual([]);
    });

    test(`documentation: ${locale} category assessment at 1280px`, async ({
        page,
    }, testInfo) => {
        const directory = testInfo.outputPath('documentation-screenshots');
        await mkdir(directory, { recursive: true });
        const dialog = await openCategoryAssessor(page, {
            categoryMembers: [article.title],
            articleHtml: { [article.title]: articleHtml(excerptHeading) },
            lead,
            locale,
        });
        await expect(dialog).toHaveAttribute('lang', locale);
        await expect(dialog.locator('iframe')).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Stub', exact: true }),
        ).toBeVisible();
        await expect(
            page.getByText(msg('batch.class'), { exact: true }),
        ).toBeVisible();
        await expect(
            page
                .frameLocator('iframe')
                .getByRole('heading', { name: excerptHeading, exact: true }),
        ).toBeVisible();
        await fitDocumentationScreenshot(page, dialog);
        await page.screenshot({
            path: resolve(directory, `screenshot-03${suffix}.png`),
            animations: 'disabled',
        });
        expect(await getPosts(page)).toEqual([]);
    });

    test(`documentation: ${locale} annual archive review at 1280px`, async ({
        page,
    }, testInfo) => {
        const directory = testInfo.outputPath('documentation-screenshots');
        await mkdir(directory, { recursive: true });
        const dialog = await openArchiver(page, {
            listText: archiveListText,
            archivePages: { [annualArchiveTitle]: archiveAnnualText },
            locale,
        });
        await expect(dialog).toHaveAttribute('lang', locale);
        await expect(
            dialog.getByRole('button', {
                name: msg('archive.save'),
                exact: true,
            }),
        ).toBeEnabled();
        await expect(dialog.locator('pre')).toHaveCount(2);
        await expect(
            dialog.getByRole('region', {
                name: msg('archive.destination', { title: annualArchiveTitle }),
                exact: true,
            }),
        ).toContainText(
            '=== 6月 ===\n* 6月30日 - [[:六月已存档游戏]]{{Dykico}}',
        );
        await fitDocumentationScreenshot(page, dialog);
        await page.screenshot({
            path: resolve(directory, `screenshot-04${suffix}.png`),
            animations: 'disabled',
        });
        expect(await getPosts(page)).toEqual([]);
    });
}

async function fitDocumentationScreenshot(page: Page, dialog: Locator) {
    await page.evaluate(() => document.fonts.ready);
    const source = dialog.locator('textarea');
    if ((await source.count()) > 0) {
        // This field supports native vertical resizing; expose the entire reviewed lead.
        await source.evaluate((element: HTMLTextAreaElement) => {
            element.style.height = `${element.scrollHeight + 2}px`;
        });
    }
    const body = dialog.locator('.cdx-dialog__body');
    const requiredHeight = await body.evaluate((element) => {
        const dialogHeight = element
            .closest("[role='dialog']")!
            .getBoundingClientRect().height;
        return Math.ceil(
            dialogHeight + element.scrollHeight - element.clientHeight + 48,
        );
    });
    await page.setViewportSize({ width: 1280, height: requiredHeight });
    const iframe = dialog.locator('iframe');
    if ((await iframe.count()) > 0) {
        const extraHeight = await page
            .frameLocator('iframe')
            .locator('html')
            .evaluate((element) => element.scrollHeight - element.clientHeight);
        if (extraHeight > 0) {
            await page.setViewportSize({
                width: 1280,
                height: requiredHeight + extraHeight,
            });
        }
        await expect
            .poll(() =>
                page
                    .frameLocator('iframe')
                    .locator('html')
                    .evaluate(
                        (element) =>
                            element.scrollHeight - element.clientHeight,
                    ),
            )
            .toBeLessThanOrEqual(1);
    }
    if ((await source.count()) > 0) {
        await expect
            .poll(() =>
                source.evaluate(
                    (element) => element.scrollHeight - element.clientHeight,
                ),
            )
            .toBeLessThanOrEqual(1);
    }
    await expect
        .poll(() =>
            body.evaluate(
                (element) => element.scrollHeight - element.clientHeight,
            ),
        )
        .toBeLessThanOrEqual(1);
    await expect(dialog).toBeInViewport({ ratio: 1 });
    await expect(dialog.locator('.cdx-dialog__footer')).toBeInViewport({
        ratio: 1,
    });
}
