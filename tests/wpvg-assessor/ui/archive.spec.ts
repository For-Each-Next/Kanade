/**
 * @file tests/wpvg-assessor/ui/archive.spec.ts
 * Purpose: Archiver-only routing, exact previews, safe writes, and partial-save recovery.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 */

import {
    archiveAnnualText,
    archiveCrossYearListText,
    archiveListText,
    archiveSourceTitle,
    annualArchiveTitle,
    olderAnnualArchiveTitle,
} from './archive-fixture.ts';
import {
    expect,
    getFixtureMessages,
    getPosts,
    openArchiver,
    test,
} from './fixtures.ts';

const { msg } = getFixtureMessages();

test('the new-page list opens only the archiver and moves whole eligible months', async ({
    page,
}) => {
    const dialog = await openArchiver(page, {
        listText: archiveListText,
        archivePages: { [annualArchiveTitle]: archiveAnnualText },
    });
    await expect(
        page.getByRole('link', { name: 'Article Assessor', exact: true }),
    ).toHaveCount(0);
    await expect(dialog.getByRole('combobox')).toHaveCount(0);
    await expect(
        dialog.getByText('Archive records dated 2026-08-31 or earlier (UTC).', {
            exact: true,
        }),
    ).toBeVisible();
    const source = dialog.getByRole('region', {
        name: msg('archive.source'),
        exact: true,
    });
    await expect(source).toContainText('* 9月1日 - {{vgc|九月示例游戏}}');
    await expect(source).not.toContainText('8月31日');
    const annual = dialog.getByRole('region', {
        name: msg('archive.destination', { title: annualArchiveTitle }),
        exact: true,
    });
    await expect(annual).toContainText(
        '* 8月31日 - [[:八月示例游戏]]{{Dykico}}',
    );
    await expect(annual).toContainText('[[:Category:示例游戏分类]]');
    await expect(annual).toContainText('[[:File:Example game cover.png]]');
    await expect(annual).toContainText('=== 8月 ===');
    await expect(annual).toContainText('=== 7月 ===');
    await expect(annual).toContainText(
        '=== 6月 ===\n* 6月30日 - [[:六月已存档游戏]]{{Dykico}}',
    );
    await expect(annual).toContainText('{{Archive header|custom=keep}}');
    expect(await dialog.locator('pre').count()).toBe(2);
    expect(await getPosts(page)).toEqual([]);
    const calls = await page.evaluate(
        () => (globalThis as any).__fixture.calls,
    );
    expect(
        calls.every(
            (call: any) =>
                call.action === 'query' &&
                call.prop === 'revisions' &&
                !String(call.titles).startsWith('Talk:'),
        ),
    ).toBe(true);
    expect(
        calls.filter((call: any) => call.titles === annualArchiveTitle),
    ).toHaveLength(1);
    await dialog
        .getByRole('button', { name: msg('archive.save'), exact: true })
        .click();
    await expect(
        dialog.getByText(msg('archive.saved'), { exact: true }),
    ).toBeVisible();
    const posts = await getPosts(page);
    expect(posts.map((post) => post.title)).toEqual([
        annualArchiveTitle,
        archiveSourceTitle,
    ]);
    expect(posts[0]!.text).toBe(await annual.textContent());
    expect(posts[1]!.text).toBe(await source.textContent());
    expect(posts.every((post) => !post.title.startsWith('Talk:'))).toBe(true);
});

test('a partial cross-year archive save retains the source and resumes without duplicate records', async ({
    page,
}) => {
    const dialog = await openArchiver(page, {
        listText: archiveCrossYearListText,
        archivePages: { [annualArchiveTitle]: archiveAnnualText },
        failArchiveTitle: olderAnnualArchiveTitle,
    });
    const save = dialog.getByRole('button', {
        name: msg('archive.save'),
        exact: true,
    });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(
        dialog.getByText(/Archive pages confirmed saved/u),
    ).toBeVisible();
    await expect(save).toBeDisabled();
    expect(
        await page.evaluate(() => (globalThis as any).__fixture.listText),
    ).toBe(archiveCrossYearListText);
    await page.evaluate(() => {
        (globalThis as any).__fixture.failArchiveTitle = null;
    });
    await dialog
        .getByRole('button', { name: msg('archive.reload'), exact: true })
        .click();
    await expect(save).toBeEnabled();
    await save.click();
    await expect(
        dialog.getByText(msg('archive.saved'), { exact: true }),
    ).toBeVisible();
    const posts = await getPosts(page);
    expect(
        posts.filter((post) => post.title === annualArchiveTitle),
    ).toHaveLength(1);
    expect(
        posts.filter((post) => post.title === olderAnnualArchiveTitle),
    ).toHaveLength(2);
    expect(posts.at(-1)!.title).toBe(archiveSourceTitle);
});

for (const width of [1280, 360]) {
    test(`archive keyboard close restores the portlet link at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const dialog = await openArchiver(page, { listText: archiveListText });
        await expect(
            dialog.getByRole('button', {
                name: msg('archive.save'),
                exact: true,
            }),
        ).toBeEnabled();
        const buttons = dialog.locator(
            '.kanade-wpvg-assessor-archive-actions button',
        );
        await expect(buttons.first()).toHaveText(
            width === 360 ? msg('archive.save') : msg('archive.cancel'),
        );
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        const tool = page.getByRole('link', {
            name: 'Archive tool',
            exact: true,
        });
        await expect(tool).toBeFocused();
        await tool.press('Enter');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('combobox')).toHaveCount(0);
        expect(await getPosts(page)).toEqual([]);
    });

    test(`a pending archive save stays open at ${width}px and detects a concurrent source revision`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const dialog = await openArchiver(page, {
            listText: archiveListText,
            holdArchive: true,
        });
        const save = dialog.getByRole('button', {
            name: msg('archive.save'),
            exact: true,
        });
        await expect(save).toBeEnabled();
        await save.click();
        await expect(save).toBeDisabled();
        await page.keyboard.press('Escape');
        await expect(dialog).toBeVisible();
        await dialog
            .locator('.cdx-dialog__header')
            .getByRole('button', { name: msg('archive.cancel'), exact: true })
            .click();
        await expect(dialog).toBeVisible();
        await expect(
            dialog
                .locator('.kanade-wpvg-assessor-archive-actions')
                .getByRole('button', {
                    name: msg('archive.cancel'),
                    exact: true,
                }),
        ).toBeDisabled();
        await page.evaluate(() => {
            const fixture = (globalThis as any).__fixture;
            fixture.listText = fixture.listText.replace(
                '* 10月3日 -',
                '* 10月4日 - {{Vgc|Concurrent game}}\n* 10月3日 -',
            );
            fixture.listRevisionId += 1;
            fixture.releaseArchive();
        });
        await expect(
            dialog.getByText(/Archive pages confirmed saved/u),
        ).toBeVisible();
        expect(
            await page.evaluate(() => (globalThis as any).__fixture.listText),
        ).toContain('Concurrent game');
        expect(
            await page.evaluate(() => (globalThis as any).__fixture.listText),
        ).toContain('8月31日');
        const posts = await getPosts(page);
        expect(posts.at(-1)!.title).toBe(archiveSourceTitle);
        expect(posts.at(-1)!.baserevid).toBe(600);
        expect(posts.at(-1)!.basetimestamp).toBeUndefined();
    });
}

test('closing a loading archiver discards stale responses', async ({
    page,
}) => {
    const dialog = await openArchiver(page, {
        listText: archiveListText,
        holdLoad: true,
    });
    await dialog
        .getByRole('button', { name: msg('archive.cancel'), exact: true })
        .last()
        .click();
    await page.evaluate(() => (globalThis as any).__fixture.releaseLoad());
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#kanade-wpvg-assessor-dialog-host')).toHaveCount(
        0,
    );
    expect(await getPosts(page)).toEqual([]);
});

test('source edits after review are rejected before any archive is written', async ({
    page,
}) => {
    const dialog = await openArchiver(page, { listText: archiveListText });
    const save = dialog.getByRole('button', {
        name: msg('archive.save'),
        exact: true,
    });
    await expect(save).toBeEnabled();
    await page.evaluate(() => {
        (globalThis as any).__fixture.listText += '\nConcurrent edit\n';
    });
    await save.click();
    await expect(dialog.getByText(/changed after review/iu)).toBeVisible();
    expect(await getPosts(page)).toEqual([]);
    await expect(save).toBeDisabled();
});

test('no eligible month leaves save unavailable', async ({ page }) => {
    const dialog = await openArchiver(page, {
        listText: '== 2026年 ==\n* 9月30日 - {{vgc|Recent game}}\n',
    });
    await expect(
        dialog.getByText(msg('archive.empty'), { exact: true }),
    ).toBeVisible();
    await expect(
        dialog.getByRole('button', { name: msg('archive.save'), exact: true }),
    ).toHaveCount(0);
    expect(await getPosts(page)).toEqual([]);
});
