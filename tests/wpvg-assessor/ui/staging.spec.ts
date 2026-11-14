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
    prepareAssessmentView,
    test,
} from './fixtures.ts';
import type { Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const readySource = (page: Page) =>
    page.getByRole('textbox', {
        name: 'Ready-to-save lead-section source',
        exact: true,
    });
const talkSummary = (page: Page) =>
    page.getByRole('textbox', { name: 'Talk-page edit summary', exact: true });
const submit = (page: Page, count = 0) =>
    page.getByRole('button', {
        name: count > 0 ? `Next (+${count})` : 'Next',
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
    await expect(page.getByRole('switch')).toHaveCount(0);
    await expect
        .poll(() =>
            page.evaluate(() => {
                const key = Object.keys(localStorage).find((value) =>
                    value.startsWith('wpvg-assessor.assessment-queue.v1:'),
                );
                return key == null ? '' : (localStorage.getItem(key) ?? '');
            }),
        )
        .toContain('Reviewed first assessment');
}

/** Seed an earlier authored registration summary through the existing persisted draft format. */
async function restoreAuthoredRegistrationSummary(
    page: Page,
    talkTitle: string,
    summary: string,
) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.evaluate(
        ({ talkTitle, summary }) => {
            const key = Object.keys(localStorage).find((key) =>
                key.startsWith('wpvg-assessor.assessment-queue.v1:'),
            )!;
            const queue = JSON.parse(localStorage.getItem(key)!);
            const draft = queue.drafts.find(
                (entry: any) => entry.state.talkTitle === talkTitle,
            );
            if (!draft)
                throw new Error(`Missing staged review for ${talkTitle}`);
            draft.review.listSummary = summary;
            localStorage.setItem(key, JSON.stringify(queue));
        },
        { talkTitle, summary },
    );
    await page
        .getByRole('link', { name: 'Article Assessor', exact: true })
        .click();
    await prepareAssessmentView(page, {
        pageTitle: talkTitle.replace(/^Talk:/u, ''),
    });
}

test('reviewed cross-tab drafts require confirmation and preserve custom registration on Back', async ({
    page,
    context,
}) => {
    await openAssessor(page);
    await stageFirstPage(page);
    await restoreAuthoredRegistrationSummary(
        page,
        'Talk:Example game',
        'Reviewed first registration',
    );
    const second = await context.newPage();
    await openAssessor(second, { pageTitle: 'Second game', holdTalk: true });
    await chooseOption(second, 'Shared class', 'C');
    await talkSummary(second).fill('Reviewed second assessment');
    await restoreAuthoredRegistrationSummary(
        second,
        'Talk:Second game',
        'Reviewed second registration',
    );
    await expect(submit(second, 1)).toBeEnabled();
    await submit(second, 1).click();
    await expect(batchDialog(second)).toBeVisible();
    await expect(batchDialog(second)).toContainText(
        'Reviewed first assessment',
    );
    await expect(
        batchDialog(second).getByRole('region', { name: /New-page/u }),
    ).toHaveCount(0);
    await expect(batchDialog(second)).not.toContainText(
        'Reviewed first registration',
    );
    expect(await getPosts(second)).toEqual([]);
    await back(second).click();
    await expect(
        second.getByRole('textbox', {
            name: 'New-page list edit summary',
            exact: true,
        }),
    ).toHaveCount(0);
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
    await page.keyboard.press('Escape');
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

test('closing flushes exact edits while Don’t stage removes only the current draft', async ({
    page,
}) => {
    await openAssessor(page);
    await stageFirstPage(page);
    await navigateAssessor(page, 'Second game');
    await talkSummary(page).fill('Latest staged summary');
    await readySource(page).fill(
        `${await readySource(page).inputValue()}\n<!-- Saved on close -->`,
    );
    const reviewed = await readySource(page).inputValue();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page
        .getByRole('link', { name: 'Article Assessor', exact: true })
        .click();
    await prepareAssessmentView(page, { pageTitle: 'Second game' });
    await expect(readySource(page)).toHaveValue(reviewed);
    await expect(talkSummary(page)).toHaveValue('Latest staged summary');
    await talkSummary(page).fill('Discard the pending debounce');
    await page
        .getByRole('button', { name: "Don't stage", exact: true })
        .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect
        .poll(() => getQueuedTitles(page))
        .toEqual(['Talk:Example game']);
    expect(await getPosts(page)).toEqual([]);
});

async function getQueuedTitles(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const key = Object.keys(localStorage).find((value) =>
            value.startsWith('wpvg-assessor.assessment-queue.v1:'),
        );
        return key == null
            ? []
            : JSON.parse(localStorage.getItem(key)!).drafts.map(
                  (draft: any) => draft.state.talkTitle,
              );
    });
}

test('Don’t stage waits for a queued storage write before removing the draft', async ({
    page,
}) => {
    await openAssessor(page);
    await stageFirstPage(page);
    await page.evaluate(async () => {
        const key = Object.keys(localStorage).find((value) =>
            value.startsWith('wpvg-assessor.assessment-queue.v1:'),
        )!;
        await new Promise<void>((locked) => {
            void navigator.locks.request(key, async () => {
                locked();
                await new Promise<void>((release) => {
                    (globalThis as any).__releaseDraftLock = release;
                });
            });
        });
    });
    await talkSummary(page).fill('Write waiting for the lock');
    await expect
        .poll(() =>
            page.evaluate(
                async () =>
                    (await navigator.locks.query()).pending?.length ?? 0,
            ),
        )
        .toBeGreaterThan(0);
    await page
        .getByRole('button', { name: "Don't stage", exact: true })
        .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.evaluate(() => (globalThis as any).__releaseDraftLock());
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect.poll(() => getQueuedTitles(page)).toEqual([]);
    expect(await getPosts(page)).toEqual([]);
});

for (const viewport of [
    { width: 375, height: 667 },
    { width: 683, height: 768 },
    { width: 1366, height: 768 },
]) {
    test(`assessor starts compact with staged radio edits and the native surface at ${viewport.width}`, async ({
        page,
    }) => {
        await page.setViewportSize(viewport);
        const compact = await openAssessor(page, { compact: true });
        await expect(page.getByRole('switch')).toHaveCount(0);
        const screenshotDirectory = process.env.WPVG_SCREENSHOT_DIR;
        if (screenshotDirectory) {
            await mkdir(screenshotDirectory, { recursive: true });
            await page.screenshot({
                path: `${screenshotDirectory}/assessment-compact-${viewport.width}.png`,
                animations: 'disabled',
            });
        }
        await expect(
            compact.getByRole('heading', {
                name: 'Article Assessor (Example game)',
                exact: true,
            }),
        ).toBeFocused();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(compact).not.toHaveClass(/\bcdx-message\b/u);
        const colors = await compact.evaluate((surface) => {
            const probe = document.createElement('div');
            probe.style.backgroundColor = 'var(--background-color-base, #fff)';
            document.body.append(probe);
            const expected = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return {
                actual: getComputedStyle(surface).backgroundColor,
                expected,
            };
        });
        expect(colors.actual).toBe(colors.expected);
        const bodySize = await compact
            .locator('.kanade-wpvg-assessor-mini__body')
            .evaluate((body) => ({
                width: body.clientWidth,
                scrollWidth: body.scrollWidth,
            }));
        expect(bodySize.scrollWidth).toBeLessThanOrEqual(bodySize.width + 1);
        await expect(compact.getByRole('combobox')).toHaveCount(0);
        const classGroup = compact.getByRole('group', {
            name: 'Shared class',
            exact: true,
        });
        const importanceGroup = compact.getByRole('group', {
            name: 'Importance',
            exact: true,
        });
        const projectGroup = compact.getByRole('group', {
            name: 'Supported WikiProjects',
            exact: true,
        });
        await expect(
            compact.getByRole('heading', {
                level: 1,
                name: 'Article Assessor (Example game)',
                exact: true,
            }),
        ).toBeVisible();
        expect(
            (await compact.locator('h2').allTextContents()).map((text) =>
                text.trim(),
            ),
        ).toEqual(['Shared class', 'Supported WikiProjects', 'Video games']);
        const fields = await compact
            .getByRole('group')
            .evaluateAll((groups) =>
                groups.map((group) =>
                    group
                        .querySelector('legend')
                        ?.textContent?.replace(/\s+/gu, ' ')
                        .trim(),
                ),
            );
        expect(fields).toEqual([
            'Shared class',
            'Supported WikiProjects',
            'Importance',
            'Task forces of WPVG',
            'Maintenance',
            'New-page registration',
        ]);
        await expect(compact.locator('legend h2, legend h3')).toHaveCount(0);
        await expect(
            compact.getByRole('checkbox', {
                name: /^Register in the Video games new-page list/u,
            }),
        ).toBeChecked();
        await expect(
            compact.getByRole('textbox', {
                name: 'New-page list edit summary',
                exact: true,
            }),
        ).toHaveCount(0);
        const videoGames = projectGroup.getByRole('checkbox', {
            name: 'Video games',
            exact: true,
        });
        await expect(videoGames).toBeChecked();
        await expect(
            projectGroup.getByRole('checkbox', { name: 'ACG', exact: true }),
        ).toBeEnabled();
        const adjacentProjects = await projectGroup
            .getByRole('checkbox')
            .evaluateAll((inputs) =>
                inputs.map((input) =>
                    (input as HTMLInputElement).labels?.[0]?.textContent
                        ?.replace(/\s+/gu, ' ')
                        .trim(),
                ),
            );
        expect(adjacentProjects.indexOf('ACG')).toBe(
            adjacentProjects.indexOf('Video games') + 1,
        );
        await expect(
            classGroup.getByRole('radio', { name: 'Start', exact: true }),
        ).toBeChecked();
        await expect(
            importanceGroup.getByRole('radio', { name: 'Low', exact: true }),
        ).toBeChecked();
        await classGroup.getByRole('radio', { name: 'B', exact: true }).check();
        await importanceGroup
            .getByRole('radio', { name: 'High', exact: true })
            .check();
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const key = Object.keys(localStorage).find((value) =>
                        value.startsWith('wpvg-assessor.assessment-queue.v1:'),
                    );
                    return key == null ? '' : (localStorage.getItem(key) ?? '');
                }),
            )
            .toContain('importance=High');
        expect(await getPosts(page)).toEqual([]);
        await page.reload();
        await page
            .getByRole('link', { name: 'Article Assessor', exact: true })
            .click();
        await expect(compact).toBeVisible();
        await expect(page.getByRole('switch')).toHaveCount(0);
        await expect(
            classGroup.getByRole('radio', { name: 'B', exact: true }),
        ).toBeChecked();
        await expect(
            importanceGroup.getByRole('radio', { name: 'High', exact: true }),
        ).toBeChecked();
        expect(await getPosts(page)).toEqual([]);
    });

    test(`compact Video games selection hides its branch while other projects remain editable at ${viewport.width}`, async ({
        page,
    }) => {
        await page.setViewportSize(viewport);
        const compact = await openAssessor(page, { compact: true });
        await chooseOption(page, 'Importance', 'High');
        const videoGames = compact.getByRole('checkbox', {
            name: 'Video games',
            exact: true,
        });
        await videoGames.uncheck();
        for (const name of [
            'Importance',
            'Task forces of WPVG',
            'Maintenance',
        ]) {
            await expect(
                compact.getByRole('group', { name, exact: true }),
            ).toHaveCount(0);
        }
        await expect(
            compact.getByRole('checkbox', {
                name: /^Register in the Video games new-page list/u,
            }),
        ).toHaveCount(0);
        await compact
            .getByRole('checkbox', { name: 'ACG', exact: true })
            .check();
        await chooseOption(page, 'Shared class', 'B');
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const key = Object.keys(localStorage).find((value) =>
                        value.startsWith('wpvg-assessor.assessment-queue.v1:'),
                    );
                    return key == null ? '' : (localStorage.getItem(key) ?? '');
                }),
            )
            .toContain('ACG專題');
        await videoGames.check();
        await expect(
            compact
                .getByRole('group', { name: 'Importance', exact: true })
                .getByRole('radio', { name: 'High', exact: true }),
        ).toBeChecked();
        await expect(
            compact.getByRole('checkbox', {
                name: /^Register in the Video games new-page list/u,
            }),
        ).not.toBeChecked();
        expect(await getPosts(page)).toEqual([]);
    });

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
        for (const name of ['Next', "Don't stage", 'Expand']) {
            await expect(
                compact.getByRole('button', { name, exact: true }),
            ).toBeInViewport({ ratio: 1 });
        }
        await expect(compact.getByRole('switch')).toHaveCount(0);
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
        await expect(page.getByRole('switch')).toHaveCount(0);
        expect(await getPosts(page)).toEqual([]);
    });
}
