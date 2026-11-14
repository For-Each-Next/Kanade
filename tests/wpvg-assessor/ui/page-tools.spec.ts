/**
 * @file tests/wpvg-assessor/ui/page-tools.spec.ts
 * Purpose: Verify assessor page tools open each eligible workflow without a floating action.
 * Contents: Context-specific labels, keyboard activation, close focus, and read-only opening.
 */

import { expect, getFixtureMessages, getPosts, test } from './fixtures.ts';

const WIKI_FIXTURE = 'https://zh.wikipedia.org/tests/ui/index.html';

// Serve the local fixture under the production origin so URL validation stays real.
test.beforeEach(async ({ page }) => {
    const paths = new Set([
        '/tests/ui/index.html',
        '/tests/ui/mediawiki.js',
        '/fixtures/vue.js',
        '/fixtures/codex.js',
        '/fixtures/codex.css',
        '/dist/wpvg_assessor.min.js',
    ]);
    await page.route('https://zh.wikipedia.org/**', async (route) => {
        const url = new URL(route.request().url());
        if (!paths.has(url.pathname)) {
            await route.fallback();
            return;
        }
        const response = await page.request.get(
            `http://127.0.0.1:4176${url.pathname}${url.search}`,
        );
        await route.fulfill({ response });
    });
});

for (const context of [
    {
        pageTitle: 'Example game',
        action: 'tool.name',
        dialog: 'Article Assessor (Example game)',
        compact: true,
    },
    {
        pageTitle: 'Category:未评级电子游戏条目',
        action: 'tool.batchName',
        dialog: 'Batch assess articles',
        compact: false,
    },
    {
        pageTitle: 'WikiProject:电子游戏/新进条目',
        action: 'tool.archiveName',
        dialog: 'Archive tool',
        compact: false,
    },
] as const) {
    test(`page-tools ${context.action} opens the current workflow and restores keyboard focus`, async ({
        page,
    }) => {
        await page.addInitScript((options) => {
            (globalThis as any).__fixtureOptions = options;
        }, context);
        await page.goto(WIKI_FIXTURE);
        const { msg } = getFixtureMessages();
        const launcher = page.locator('#kanade-wpvg-assessor-launcher a');
        await expect(launcher).toHaveText(msg(context.action));
        await expect(launcher).toHaveJSProperty('tagName', 'A');
        await expect(page.locator('#kanade-quick-access')).toHaveCount(0);
        await launcher.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole(context.compact ? 'region' : 'dialog', {
            name: context.compact ? msg('dialog.miniMode') : context.dialog,
            exact: true,
        });
        await expect(dialog).toBeVisible();
        if (context.compact) {
            await expect(
                dialog.getByRole('heading', {
                    name: context.dialog,
                    exact: true,
                }),
            ).toBeFocused();
            await expect(dialog.getByRole('switch')).toHaveCount(0);
            await dialog
                .getByRole('button', { name: "Don't stage", exact: true })
                .click();
        } else await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(launcher).toBeFocused();
        expect(await getPosts(page)).toEqual([]);
    });
}

for (const context of [
    {
        pageTitle: 'Example game',
        dialog: 'Article Assessor (Example game)',
        compact: true,
    },
    {
        pageTitle: 'Category:未评级电子游戏条目',
        dialog: 'Batch assess articles',
        compact: false,
    },
    {
        pageTitle: 'WikiProject:电子游戏/新进条目',
        dialog: 'Archive tool',
        compact: false,
    },
] as const) {
    test(`query opens the ${context.dialog} workflow without saving`, async ({
        page,
    }) => {
        await page.addInitScript((options) => {
            (globalThis as any).__fixtureOptions = options;
        }, context);
        await page.goto(`${WIKI_FIXTURE}?host=a%20b&wpvg-assessor=1#review`);
        const dialog = page.getByRole(context.compact ? 'region' : 'dialog', {
            name: context.compact
                ? 'Article Assessor compact mode'
                : context.dialog,
            exact: true,
        });
        await expect(dialog).toBeVisible();
        await expect(page).toHaveURL(`${WIKI_FIXTURE}?host=a%20b#review`);
        expect(await getPosts(page)).toEqual([]);
        if (context.compact)
            await dialog
                .getByRole('button', { name: "Don't stage", exact: true })
                .click();
        else await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(
            page.locator('#kanade-wpvg-assessor-launcher a'),
        ).toBeFocused();
        await page.reload();
        await expect(
            page.locator('#kanade-wpvg-assessor-launcher a'),
        ).toBeVisible();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(
            page.getByRole('region', {
                name: 'Article Assessor compact mode',
                exact: true,
            }),
        ).toHaveCount(0);
    });
}

for (const query of [
    'wpvg-assessor=0',
    'wpvg-assessor',
    'wpvg-assessor=1&wpvg-assessor=1',
    'other=1',
]) {
    test(`query ${query} does not open a dialog`, async ({ page }) => {
        await page.goto(`${WIKI_FIXTURE}?${query}`);
        await expect(
            page.locator('#kanade-wpvg-assessor-launcher a'),
        ).toBeVisible();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(
            page.getByRole('region', {
                name: 'Article Assessor compact mode',
                exact: true,
            }),
        ).toHaveCount(0);
        expect(await getPosts(page)).toEqual([]);
    });
}

test('query does not start the assessor on an unsupported wiki', async ({
    page,
}) => {
    await page.addInitScript(() => {
        (globalThis as any).__fixtureOptions = { wikiId: 'enwiki' };
    });
    await page.goto(`${WIKI_FIXTURE}?wpvg-assessor=1`);
    await expect(page.locator('#kanade-wpvg-assessor-launcher')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(`${WIKI_FIXTURE}?wpvg-assessor=1`);
    expect(await getPosts(page)).toEqual([]);
});
