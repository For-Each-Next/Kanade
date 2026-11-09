/**
 * @file tests/wpvg-assessor/ui/staging.spec.ts
 * Purpose: Exercise reviewed queue editing, selection, explicit saves, and compact reading.
 * Contents: Offline cross-tab, recovery, keyboard, and responsive batch scenarios.
 */
import {
    chooseOption,
    expect,
    getPosts,
    navigateAssessor,
    openAssessor,
    test,
} from './fixtures.ts';
import type { Page } from '@playwright/test';

const readySource = (page: Page) =>
    page.getByRole('textbox', {
        name: 'Ready-to-save lead-section source',
        exact: true,
    });
const talkSummary = (page: Page) =>
    page.getByRole('textbox', { name: 'Talk-page edit summary', exact: true });
const listSummary = (page: Page) =>
    page.getByRole('textbox', {
        name: 'New-page list edit summary',
        exact: true,
    });
const stage = (page: Page) =>
    page.getByRole('switch', { name: 'Stage', exact: true });
const submit = (page: Page, count = 0) =>
    page.getByRole('button', {
        name: count > 0 ? `Submit (+${count})` : 'Submit',
        exact: true,
    });
const confirm = (page: Page) =>
    page.getByRole('button', { name: 'Confirm and save', exact: true });
const batchDialog = (page: Page) =>
    page.getByRole('dialog', { name: 'Confirm batch save', exact: true });
const back = (page: Page) =>
    batchDialog(page).getByRole('button', { name: 'Back', exact: true }).last();

async function stageFirstPage(page: Page) {
    await chooseOption(page, 'Shared class', 'B');
    await talkSummary(page).fill('Reviewed first assessment');
    await listSummary(page).fill('Reviewed first registration');
    await stage(page).check();
    await expect(stage(page)).toBeChecked();
    await expect(stage(page)).toBeEnabled();
}

test('reviewed cross-tab drafts require confirmation and preserve custom registration on Back', async ({
    page,
    context,
}) => {
    await openAssessor(page);
    await stageFirstPage(page);
    const second = await context.newPage();
    await openAssessor(second, { pageTitle: 'Second game', holdTalk: true });
    await chooseOption(second, 'Shared class', 'C');
    await talkSummary(second).fill('Reviewed second assessment');
    await listSummary(second).fill('Reviewed second registration');
    await expect(submit(second, 1)).toBeEnabled();
    await submit(second, 1).click();
    await expect(batchDialog(second)).toBeVisible();
    await expect(batchDialog(second)).toContainText(
        'Reviewed first assessment',
    );
    await expect(batchDialog(second)).toContainText(
        'Reviewed first registration; Reviewed second registration',
    );
    expect(await getPosts(second)).toEqual([]);
    await back(second).click();
    await expect(listSummary(second)).toHaveValue(
        'Reviewed second registration',
    );
    await expect(talkSummary(second)).toHaveValue('Reviewed second assessment');
    await submit(second, 1).click();
    await confirm(second).click();
    await expect
        .poll(() => getPosts(second), { timeout: 10000 })
        .toHaveLength(2);
    await expect(confirm(second)).toBeDisabled();
    await second.keyboard.press('Escape');
    await expect(batchDialog(second)).toBeVisible();
    const posts = await getPosts(second);
    expect(posts.map((post) => post.title)).toEqual([
        'WikiProject:电子游戏/新进条目',
        'Talk:Example game',
    ]);
    expect(posts[0].summary).toBe(
        'Reviewed first registration; Reviewed second registration',
    );
    expect(posts[1].summary).toBe('Reviewed first assessment');
});

test('editing a queued page applies its exact source and summary without writing the wiki', async ({
    page,
}) => {
    await openAssessor(page);
    await stageFirstPage(page);
    await navigateAssessor(page, 'Second game');
    await chooseOption(page, 'Shared class', 'C');
    await submit(page, 1).click();
    await page
        .getByRole('button', { name: 'Edit Talk:Example game', exact: true })
        .click();
    const editor = page.getByRole('dialog', {
        name: 'Edit queued assessment (Example game)',
        exact: true,
    });
    await expect(editor).toBeVisible();
    const source = `${await readySource(page).inputValue()}\n<!-- Exact queued edit -->`;
    await readySource(page).fill(source);
    await talkSummary(page).fill('Edited queue summary');
    await editor
        .getByRole('button', { name: 'Apply changes', exact: true })
        .click();
    await expect(batchDialog(page)).toBeVisible();
    await expect(batchDialog(page)).toContainText('Edited queue summary');
    expect(await getPosts(page)).toEqual([]);
    await back(page).click();
    await page
        .getByRole('button', { name: 'Cancel', exact: true })
        .last()
        .click();
    await navigateAssessor(page, 'Example game');
    await expect(readySource(page)).toHaveValue(source);
    await expect(talkSummary(page)).toHaveValue('Edited queue summary');
});

test('unchecked rows remain queued and removed rows stay out of a refreshed batch', async ({
    page,
}) => {
    await openAssessor(page);
    await stageFirstPage(page);
    await navigateAssessor(page, 'Second game');
    await submit(page, 1).click();
    await page
        .getByRole('checkbox', {
            name: 'Select Talk:Example game for this save',
            exact: true,
        })
        .uncheck();
    await expect(batchDialog(page)).toContainText(
        'Review the 1 selected articles',
    );
    await expect(
        batchDialog(page).getByText('Reviewed first registration', {
            exact: true,
        }),
    ).toHaveCount(0);
    await page
        .getByRole('checkbox', {
            name: 'Select Talk:Second game for this save',
            exact: true,
        })
        .uncheck();
    await expect(confirm(page)).toBeDisabled();
    await page
        .getByRole('checkbox', { name: 'Select all articles', exact: true })
        .check();
    await page
        .getByRole('button', {
            name: 'Remove Talk:Example game from the queue',
            exact: true,
        })
        .click();
    await expect(
        batchDialog(page).getByRole('rowheader', {
            name: 'Talk:Example game',
            exact: true,
        }),
    ).toHaveCount(0);
    await expect(batchDialog(page)).toContainText(
        'Removed Talk:Example game from the queue.',
    );
    await expect(
        page.getByRole('button', {
            name: 'Edit Talk:Second game',
            exact: true,
        }),
    ).toBeFocused();
    await back(page).click();
    await expect(submit(page)).toBeEnabled();
    expect(await getPosts(page)).toEqual([]);
});

test('Stage synchronizes edits before closing and Unstage keeps the current form', async ({
    page,
}) => {
    await openAssessor(page);
    await stageFirstPage(page);
    await talkSummary(page).fill('Latest staged summary');
    await readySource(page).fill(
        `${await readySource(page).inputValue()}\n<!-- Saved on close -->`,
    );
    const reviewed = await readySource(page).inputValue();
    await page
        .getByRole('button', { name: 'Cancel', exact: true })
        .last()
        .click();
    await page
        .getByRole('link', { name: 'Article Assessor', exact: true })
        .click();
    await expect(readySource(page)).toHaveValue(reviewed);
    await expect(talkSummary(page)).toHaveValue('Latest staged summary');
    await stage(page).uncheck();
    await expect(stage(page)).not.toBeChecked();
    await expect(readySource(page)).toHaveValue(reviewed);
    await expect(talkSummary(page)).toHaveValue('Latest staged summary');
    expect(await getPosts(page)).toEqual([]);
});

for (const viewport of [
    { width: 375, height: 667 },
    { width: 683, height: 768 },
    { width: 1366, height: 768 },
]) {
    test(`batch save progress stays visible after scrolling review at ${viewport.width}`, async ({
        page,
    }) => {
        await page.setViewportSize(viewport);
        await page.clock.install({ time: new Date('2026-10-04T12:00:00Z') });
        await openAssessor(page, { holdTalk: true });
        await stageFirstPage(page);
        await navigateAssessor(page, 'Second game');
        await chooseOption(page, 'Shared class', 'C');
        await submit(page, 1).click();
        const batch = batchDialog(page);
        await expect(batch).toBeVisible();
        await batch.locator('.cdx-dialog__body').evaluate((body) => {
            body.scrollTop = body.scrollHeight;
        });
        await confirm(page).click();
        await expect.poll(() => getPosts(page)).toHaveLength(1);
        await page.clock.fastForward(6500);
        await expect.poll(() => getPosts(page)).toHaveLength(2);
        await expect(
            batch.getByRole('progressbar', {
                name: 'Saving batch',
                exact: true,
            }),
        ).toBeInViewport({ ratio: 1 });
        await expect(
            batch.getByText('1/3 edits completed', { exact: true }),
        ).toBeInViewport({ ratio: 1 });
        await expect(
            batch.getByText('Saving Talk:Example game...', { exact: true }),
        ).toBeInViewport({ ratio: 1 });
    });

    test(`compact mode keeps keyboard actions and queued review reachable at ${viewport.width}`, async ({
        page,
    }) => {
        await page.setViewportSize(viewport);
        await openAssessor(page);
        await stageFirstPage(page);
        await talkSummary(page).fill('Retained compact summary');
        await page
            .getByRole('button', { name: 'Collapse', exact: true })
            .click();
        const compact = page.getByRole('region', {
            name: 'Article Assessor compact mode',
            exact: true,
        });
        await expect(compact).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Expand', exact: true }),
        ).toBeFocused();
        const heading = compact.getByRole('heading', {
            name: 'Article Assessor (Example game)',
            exact: true,
        });
        await expect(heading).toBeInViewport({ ratio: 1 });
        for (const name of ['Submit', 'Cancel', 'Expand']) {
            await expect(
                compact.getByRole('button', { name, exact: true }),
            ).toBeInViewport({ ratio: 1 });
        }
        await expect(
            compact.getByRole('switch', { name: 'Stage', exact: true }),
        ).toBeInViewport({ ratio: 1 });
        await compact
            .locator('.kanade-wpvg-assessor-mini__body')
            .evaluate((body) => {
                body.scrollTop = body.scrollHeight;
            });
        await expect(heading).toBeInViewport({ ratio: 1 });
        await expect(
            compact.getByRole('button', { name: 'Expand', exact: true }),
        ).toBeInViewport({ ratio: 1 });
        const bounds = await compact.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
        await page
            .getByRole('button', { name: 'Expand', exact: true })
            .press('Enter');
        await expect(talkSummary(page)).toHaveValue('Retained compact summary');
        await expect(stage(page)).toBeChecked();
        expect(await getPosts(page)).toEqual([]);
    });
}
