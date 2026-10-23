/**
 * @file tests/wpvg-assessor/ui/page-tools.spec.ts
 * Purpose: Verify assessor page tools open each eligible workflow without a floating action.
 * Contents: Context-specific labels, keyboard activation, close focus, and read-only opening.
 */

import { expect, getFixtureMessages, getPosts, test } from './fixtures.ts';

for (const context of [
    {
        pageTitle: 'Example game',
        action: 'tool.name',
        dialog: 'Article Assessor (Example game)',
    },
    {
        pageTitle: 'Category:未评级电子游戏条目',
        action: 'tool.batchName',
        dialog: 'Batch assess articles',
    },
    {
        pageTitle: 'WikiProject:电子游戏/新进条目',
        action: 'tool.archiveName',
        dialog: 'Archive tool',
    },
] as const) {
    test(`page-tools ${context.action} opens the current workflow and restores keyboard focus`, async ({
        page,
    }) => {
        await page.addInitScript((options) => {
            (globalThis as any).__fixtureOptions = options;
        }, context);
        await page.goto('/tests/ui/index.html');
        const { msg } = getFixtureMessages();
        const launcher = page.locator('#kanade-wpvg-assessor-launcher a');
        await expect(launcher).toHaveText(msg(context.action));
        await expect(launcher).toHaveJSProperty('tagName', 'A');
        await expect(page.locator('#kanade-quick-access')).toHaveCount(0);
        await launcher.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', {
            name: context.dialog,
            exact: true,
        });
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(launcher).toBeFocused();
        expect(await getPosts(page)).toEqual([]);
    });
}
