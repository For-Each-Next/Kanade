/**
 * @file tests/build/ui/independent.spec.ts
 * Purpose: Exercise independent tool installations with real interfaces on offline wiki hosts.
 *
 * Contents: Host workflows, source/copy behavior, and duplicate-startup protection.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const initialSource = '==Heading==\nText   ';
const unexpectedRequests = new WeakMap<Page, string[]>();
const pageErrors = new WeakMap<Page, string[]>();
type Artifact =
    `${'source_editor' | 'rev_copy' | 'vg_stub_creator' | 'wpvg_assessor'}.${'min.js' | 'user.js'}`;

interface WikiOptions {
    host: string;
    wikiId: string;
    action?: 'edit' | 'view';
    articleId?: number;
    holdResources?: boolean;
    delayedMediaWiki?: boolean;
}

test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    pageErrors.set(page, errors);
    page.on('pageerror', (error) => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
    expect(pageErrors.get(page), 'No uncaught browser errors').toEqual([]);
    expect(
        unexpectedRequests.get(page),
        'No test may contact a live wiki',
    ).toEqual([]);
});

test('independent userscripts copy the displayed revision and activate only enwiki workflows', async ({
    page,
}) => {
    await mountWiki(page, { host: 'en.wikipedia.org', wikiId: 'enwiki' });
    await installTools(page, 'user.js');
    await expect(page.locator('.kanade-rev-copy-row')).toHaveCount(1);
    await expect(page.locator('#ca-create-zhwiki-vg-stub')).toHaveCount(1);
    await expect(
        page.locator(
            '#kanade-quick-access [data-kanade-quick-access-action="rev-copy"]',
        ),
    ).toHaveCount(0);
    await expect(
        page.locator(
            '#kanade-quick-access [data-kanade-quick-access-action="vg-stub-creator"]',
        ),
    ).toHaveCount(0);
    await expect(page.locator('#ca-create-zhwiki-vg-stub a')).toHaveAttribute(
        'target',
        '_blank',
    );
    await expect(
        page.locator(
            '#kanade-wpvg-assessor-launcher, #kanade-source-editor-panel',
        ),
    ).toHaveCount(0);
    await expect(page.locator('.kanade-rev-copy-row')).toContainText('2026');
    await page
        .locator('.kanade-rev-copy-row')
        .getByRole('button', { name: 'copy', exact: true })
        .click();
    await expect
        .poll(() =>
            page.evaluate(() => (globalThis as any).__independent.copied),
        )
        .toEqual([expect.stringContaining('Special:PermaLink/123')]);
    const state = await snapshot(page);
    expect(state.starts.assessor).toBe(false);
    expect(state.writes).toEqual([]);
});

test('independent compact scripts open Chinese Wikipedia tools and format the backing source', async ({
    page,
}) => {
    await mountWiki(page, {
        host: 'zh.wikipedia.org',
        wikiId: 'zhwiki',
        action: 'edit',
    });
    await installTools(page, 'min.js');
    await expect(
        page.locator(
            '.kanade-source-editor-frame[data-kanade-source-editor-ready="true"]',
        ),
    ).toBeVisible();
    await expect(page.locator('#kanade-vg-stub-creator-launcher')).toHaveCount(
        1,
    );
    await expect(
        page.locator('[data-kanade-quick-access-action="vg-stub-creator"]'),
    ).toHaveCount(0);
    await expect(page.locator('#kanade-wpvg-assessor-launcher')).toHaveCount(1);
    await expect(
        page.locator('[data-kanade-quick-access-action="wpvg-assessor"]'),
    ).toHaveCount(0);
    await expect(page.locator('.kanade-rev-copy-row')).toHaveCount(0);

    await page.locator('#kanade-source-editor-panel a').click();
    const sourceEditor = page.getByRole('dialog', {
        name: 'Source Editor',
        exact: true,
    });
    await expect(sourceEditor).toBeVisible();
    await sourceEditor
        .getByRole('button', { name: 'Format page', exact: true })
        .click();
    await expect(page.locator('#wpTextbox1')).toHaveValue(
        '== Heading ==\n\nText',
    );
    await expect(sourceEditor).not.toBeVisible();

    await page.locator('#kanade-vg-stub-creator-launcher').click();
    const creator = page.getByRole('dialog');
    await expect(creator).toBeVisible();
    await creator.getByRole('button', { name: 'Close', exact: true }).click();

    await page.locator('#kanade-wpvg-assessor-launcher a').click();
    const assessor = page.getByRole('dialog', {
        name: 'Article Assessor (Example game)',
        exact: true,
    });
    await expect(
        assessor.getByRole('textbox', {
            name: 'Ready-to-save lead-section source',
            exact: true,
        }),
    ).toHaveValue(/WikiProject Video games/u);
    await expect(page.locator('#wpTextbox1')).toHaveValue(
        '== Heading ==\n\nText',
    );
    expect((await snapshot(page)).writes).toEqual([]);
});

for (const [action, artifact] of [
    ['view', 'min.js'],
    ['edit', 'user.js'],
] as const) {
    test(`independent ${artifact} scripts preserve Commons ${action} host ownership`, async ({
        page,
    }) => {
        await mountWiki(page, {
            host: 'commons.wikimedia.org',
            wikiId: 'commonswiki',
            action,
        });
        await installTools(page, artifact);
        if (action === 'view')
            await expect(page.locator('.kanade-rev-copy-row')).toHaveCount(1);
        else {
            await expect(
                page.locator(
                    '.kanade-source-editor-frame[data-kanade-source-editor-ready="true"]',
                ),
            ).toBeVisible();
            await page.locator('#kanade-source-editor-panel a').click();
            await expect(
                page.getByRole('dialog', {
                    name: 'Source Editor',
                    exact: true,
                }),
            ).toBeVisible();
            await expect(page.locator('#wpTextbox1')).toHaveValue(
                initialSource,
            );
        }
        await expect(
            page.locator(
                '#kanade-vg-stub-creator-launcher, #ca-create-zhwiki-vg-stub, #kanade-wpvg-assessor-launcher',
            ),
        ).toHaveCount(0);
        const state = await snapshot(page);
        expect(state.starts.creator).toBe(false);
        expect(state.starts.assessor).toBe(false);
        expect(state.writes).toEqual([]);
    });
}

for (const compactFirst of [false, true]) {
    test(`readable and compact installations share each startup owner (${compactFirst ? 'compact first' : 'readable first'})`, async ({
        page,
    }) => {
        await mountWiki(page, {
            host: 'zh.wikipedia.org',
            wikiId: 'zhwiki',
            action: 'edit',
        });
        const first = compactFirst ? 'min.js' : 'user.js';
        const second = compactFirst ? 'user.js' : 'min.js';
        await installTools(page, first);
        await expect(
            page.locator(
                '.kanade-source-editor-frame[data-kanade-source-editor-ready="true"]',
            ),
        ).toBeVisible();
        await expect(
            page.locator('#kanade-vg-stub-creator-launcher'),
        ).toHaveCount(1);
        await expect(
            page.locator('#kanade-wpvg-assessor-launcher'),
        ).toHaveCount(1);
        await expect(page.locator('#kanade-quick-access')).toHaveCount(1);
        await expect(
            page.locator(
                '#kanade-quick-access [data-kanade-quick-access-action]',
            ),
        ).toHaveCount(2);
        await expect(
            page.locator('[data-kanade-quick-access-action="wpvg-assessor"]'),
        ).toHaveCount(0);
        const before = await snapshot(page);
        await page.evaluate(() => {
            (globalThis as any).__independent.owners = [
                (window as any)[Symbol.for('kanade.source-editor.startup')],
                (window as any)[Symbol.for('kanade.rev-copy.startup')],
                (window as any)[Symbol.for('kanade.vg-stub-creator.startup')],
                (window as any)[Symbol.for('kanade.wpvg-assessor.startup')],
            ];
        });
        await installTools(page, second);
        await expect(page.locator('.kanade-source-editor-frame')).toHaveCount(
            1,
        );
        await expect(page.locator('#kanade-source-editor-panel')).toHaveCount(
            1,
        );
        await expect(
            page.locator('#kanade-vg-stub-creator-launcher'),
        ).toHaveCount(1);
        await expect(
            page.locator('#kanade-wpvg-assessor-launcher'),
        ).toHaveCount(1);
        await expect(
            page.locator('[data-kanade-quick-access-action="wpvg-assessor"]'),
        ).toHaveCount(0);
        expect(
            await page.evaluate(() => {
                const owners = (globalThis as any).__independent.owners;
                return owners.every(
                    (owner: unknown, index: number) =>
                        owner ===
                        [
                            (window as any)[
                                Symbol.for('kanade.source-editor.startup')
                            ],
                            (window as any)[
                                Symbol.for('kanade.rev-copy.startup')
                            ],
                            (window as any)[
                                Symbol.for('kanade.vg-stub-creator.startup')
                            ],
                            (window as any)[
                                Symbol.for('kanade.wpvg-assessor.startup')
                            ],
                        ][index],
                );
            }),
        ).toBe(true);
        const after = await snapshot(page);
        expect(after.loads).toEqual(before.loads);
        expect(after.hooks).toEqual(before.hooks);
        expect(after.portletMounts).toEqual(before.portletMounts);
        await page.locator('#kanade-wpvg-assessor-launcher a').click();
        await expect(
            page.getByRole('dialog', {
                name: 'Article Assessor (Example game)',
                exact: true,
            }),
        ).toHaveCount(1);
        expect((await snapshot(page)).writes).toEqual([]);
    });
}

test('independent userscripts wait for MediaWiki and ResourceLoader before mounting tools', async ({
    page,
}) => {
    await mountWiki(page, {
        host: 'zh.wikipedia.org',
        wikiId: 'zhwiki',
        action: 'edit',
        delayedMediaWiki: true,
        holdResources: true,
    });
    for (const basename of [
        'source_editor',
        'vg_stub_creator',
        'wpvg_assessor',
    ] as const)
        await install(page, `${basename}.user.js`);
    await expect(
        page.locator(
            '.kanade-source-editor-frame, #kanade-vg-stub-creator-launcher, #kanade-wpvg-assessor-launcher',
        ),
    ).toHaveCount(0);
    await page.evaluate(() => {
        (globalThis as any).mw = (globalThis as any).__independent.mediaWiki;
    });
    await expect
        .poll(() =>
            page.evaluate(() => (globalThis as any).__independent.loads.length),
        )
        .toBeGreaterThan(0);
    await expect(
        page.locator(
            '.kanade-source-editor-frame, #kanade-vg-stub-creator-launcher, #kanade-wpvg-assessor-launcher',
        ),
    ).toHaveCount(0);
    await page.evaluate(() =>
        (globalThis as any).__independent.releaseResources(),
    );
    await expect(
        page.locator(
            '.kanade-source-editor-frame[data-kanade-source-editor-ready="true"]',
        ),
    ).toBeVisible();
    await expect(page.locator('#kanade-vg-stub-creator-launcher')).toHaveCount(
        1,
    );
    await expect(page.locator('#kanade-wpvg-assessor-launcher')).toHaveCount(1);
    expect((await snapshot(page)).writes).toEqual([]);
});

for (const [width, height] of [
    [375, 667],
    [683, 768],
    [1366, 768],
]) {
    test(`bottom-right quick access fits ${width}px, opens Tools with Enter, and restores focus`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height });
        await mountWiki(page, {
            host: 'zh.wikipedia.org',
            wikiId: 'zhwiki',
            action: 'edit',
        });
        await installTools(page, 'user.js');
        const dock = page.locator('#kanade-quick-access');
        const tools = dock.locator(
            '[data-kanade-quick-access-action="source-editor-tools"]',
        );
        const actions = dock.locator('[data-kanade-quick-access-action]');
        await expect(tools).toBeVisible();
        await expect(
            dock.locator('[data-kanade-quick-access-action]'),
        ).toHaveCount(2);
        expect(
            await dock
                .locator('[data-kanade-quick-access-action]')
                .evaluateAll((items) =>
                    items.map((item) =>
                        item.getAttribute('data-kanade-quick-access-action'),
                    ),
                ),
        ).toEqual(['source-editor', 'source-editor-tools']);
        await expect(
            page.locator('[data-kanade-quick-access-action="rev-copy"]'),
        ).toHaveCount(0);
        const box = await dock.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width - 15);
        expect(box!.y + box!.height).toBeLessThanOrEqual(height - 15);
        const bounds = await actions.evaluateAll((items) =>
            items.map((item) => {
                const bounds = item.getBoundingClientRect();
                return {
                    left: bounds.left,
                    right: bounds.right,
                    top: bounds.top,
                    bottom: bounds.bottom,
                };
            }),
        );
        expect(bounds[1].top, 'Quick actions share a horizontal row').toBe(
            bounds[0].top,
        );
        if (width > 375)
            expect(new Set(bounds.map(({ top }) => top)).size).toBe(1);
        for (let index = 0; index < bounds.length; index += 1) {
            const current = bounds[index];
            expect(current.left).toBeGreaterThanOrEqual(0);
            expect(current.right).toBeLessThanOrEqual(width);
            if (index > 0) {
                const previous = bounds[index - 1];
                expect(
                    current.top >= previous.bottom ||
                        (current.top === previous.top &&
                            current.left >= previous.right),
                    'Wrapped visual order follows DOM reading order without overlap',
                ).toBe(true);
            }
        }
        await actions.first().focus();
        for (let index = 1; index < (await actions.count()); index += 1) {
            await page.keyboard.press('Tab');
            await expect(actions.nth(index)).toBeFocused();
        }
        await tools.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', {
            name: 'Source Editor',
            exact: true,
        });
        await expect(dialog).toBeVisible();
        await expect(
            dialog.getByRole('tab', { name: 'Tools', exact: true }),
        ).toHaveAttribute('aria-selected', 'true');
        await expect
            .poll(() =>
                dialog.evaluate((element) =>
                    element.contains(document.activeElement)
                        ? 'dialog'
                        : `${document.activeElement?.tagName}:${document.activeElement?.id}:${document.activeElement?.getAttribute('data-kanade-quick-access-action')}`,
                ),
            )
            .toBe('dialog');
        await dialog
            .getByRole('textbox', { name: 'Find 1', exact: true })
            .click();
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(tools).toBeFocused();
        expect((await snapshot(page)).writes).toEqual([]);
    });
}

/** Mirror the installation choices for the fixture's Wikimedia host. */
async function installTools(
    page: Page,
    extension: 'min.js' | 'user.js',
): Promise<void> {
    const host = new URL(page.url()).hostname;
    const basenames = ['source_editor', 'rev_copy'] as const;
    for (const basename of basenames)
        await install(page, `${basename}.${extension}`);
    if (host === 'en.wikipedia.org' || host === 'zh.wikipedia.org')
        await install(page, `vg_stub_creator.${extension}`);
    if (host === 'zh.wikipedia.org')
        await install(page, `wpvg_assessor.${extension}`);
}

async function install(page: Page, artifact: Artifact): Promise<void> {
    await page.addScriptTag({ path: `${root}dist/${artifact}` });
}

async function snapshot(page: Page) {
    return page.evaluate(() => {
        const state = (globalThis as any).__independent;
        return {
            loads: state.loads,
            hooks: Object.fromEntries(
                Object.entries(state.hooks).map(([name, listeners]) => [
                    name,
                    (listeners as unknown[]).length,
                ]),
            ),
            portletMounts: state.portletMounts,
            reads: (globalThis as any).__fixture.calls,
            writes: (globalThis as any).__fixture.posts,
            starts: {
                sourceEditor:
                    (window as any)[
                        Symbol.for('kanade.source-editor.startup')
                    ] != null,
                revCopy:
                    (window as any)[Symbol.for('kanade.rev-copy.startup')] !=
                    null,
                creator:
                    (window as any)[
                        Symbol.for('kanade.vg-stub-creator.startup')
                    ] != null,
                assessor:
                    (window as any)[
                        Symbol.for('kanade.wpvg-assessor.startup')
                    ] != null,
            },
        };
    });
}

async function mountWiki(page: Page, options: WikiOptions): Promise<void> {
    const origin = `https://${options.host}`;
    const requests: string[] = [];
    unexpectedRequests.set(page, requests);
    page.on('request', (request) => {
        if (request.url() !== `${origin}/wiki/Example_game`)
            requests.push(request.url());
    });
    await page.route('**/*', (route) =>
        route.request().url() === `${origin}/wiki/Example_game`
            ? route.fulfill({
                  contentType: 'text/html',
                  body: '<!doctype html>',
              })
            : route.abort('blockedbyclient'),
    );
    await page.goto(`${origin}/wiki/Example_game`);
    await page.setContent(
        '<main id="content"><h1 id="firstHeading">Example game</h1><nav id="p-cactions"></nav><nav id="p-views"></nav><nav id="p-tb"></nav><div id="mw-content-text"><div class="mw-parser-output"><h2 id="Gameplay">Gameplay</h2><p>Offline article content.</p></div></div><form id="editform"><textarea id="wpTextbox1" name="wpTextbox1" aria-label="Wikitext editor"></textarea></form><div id="notifications" role="status"></div></main>',
    );
    await page.locator('#wpTextbox1').fill(initialSource);
    await page.addStyleTag({
        path: fileURLToPath(
            import.meta.resolve('@wikimedia/codex/dist/codex.style.css'),
        ),
    });
    await page.addScriptTag({
        path: fileURLToPath(import.meta.resolve('vue/dist/vue.global.prod.js')),
    });
    await page.addScriptTag({
        path: fileURLToPath(
            import.meta.resolve('@wikimedia/codex/dist/codex.umd.cjs'),
        ),
    });
    await page.evaluate(({ wikiId }) => {
        (globalThis as any).__fixtureOptions = { wikiId, expired: true };
    }, options);
    await page.addScriptTag({
        content: await readFile(
            `${root}tests/wpvg-assessor/ui/mediawiki.js`,
            'utf8',
        ),
    });
    await page.evaluate(installHostBoundary, options);
}

function installHostBoundary(options: WikiOptions): void {
    const globals = globalThis as any;
    const mw = globals.mw;
    const state = (globals.__independent = {
        copied: [] as string[],
        loads: [] as string[][],
        hooks: {} as Record<string, unknown[]>,
        portletMounts: [] as string[],
        mediaWiki: mw,
        releaseResources: () => {},
    });
    const previousGet = mw.config.get;
    const values: Record<string, unknown> = {
        wgAction: options.action ?? 'view',
        wgArticleId: options.articleId ?? (options.action === 'edit' ? 0 : 1),
        wgCurRevisionId: 0,
        wgRevisionId: 123,
        wgContentLanguage: 'en',
        wgServerName: options.host,
        wgTitle: 'Example game',
    };
    mw.config.get = (key: string) =>
        key in values ? values[key] : previousGet(key);
    const NativeApi = mw.Api;
    mw.Api = class extends NativeApi {
        async get(params: Record<string, unknown>) {
            if (params.revids != null) {
                globals.__fixture.calls.push(params);
                return {
                    query: {
                        pages: [
                            {
                                title: 'Example game',
                                revisions: [
                                    {
                                        revid: 123,
                                        timestamp: '2026-07-01T12:00:00Z',
                                    },
                                ],
                            },
                        ],
                    },
                };
            }
            if (params.meta === 'siteinfo') {
                globals.__fixture.calls.push(params);
                return {
                    query: {
                        namespaces: {},
                        namespacealiases: [],
                        magicwords: [],
                        functionhooks: [],
                        variables: [],
                    },
                };
            }
            if (params.action === 'templatedata') {
                globals.__fixture.calls.push(params);
                return { pages: {} };
            }
            return super.get(params);
        }
        async post(params: Record<string, unknown>) {
            if (params.action === 'parse')
                return { parse: { text: '<p>Offline article preview.</p>' } };
            throw new Error('Unexpected offline API post');
        }
        async postWithToken(_token: string, params: Record<string, unknown>) {
            globals.__fixture.posts.push(params);
            throw new Error(
                'Live writes are disabled for the independent-installation fixture',
            );
        }
    };
    mw.ForeignApi = mw.Api;
    const loaded = options.holdResources
        ? new Promise<void>((resolve) => {
              state.releaseResources = resolve;
          })
        : Promise.resolve();
    mw.loader.using = (modules: string | string[]) => {
        state.loads.push(Array.isArray(modules) ? modules : [modules]);
        return loaded.then(() => (name: string) => {
            if (name === 'vue')
                return { ...globals.Vue, createMwApp: globals.Vue.createApp };
            if (name === '@wikimedia/codex') return globals.codex;
            throw new Error(`Unexpected module: ${name}`);
        });
    };
    mw.hook = (name: string) => {
        const listeners = (state.hooks[name] ??= []);
        return {
            add(listener: unknown) {
                listeners.push(listener);
                return this;
            },
            remove(listener: unknown) {
                const index = listeners.indexOf(listener);
                if (index >= 0) listeners.splice(index, 1);
                return this;
            },
        };
    };
    const originalPortletLink = mw.util.addPortletLink;
    mw.util.addPortletLink = (...args: any[]) => {
        state.portletMounts.push(args[3]);
        return originalPortletLink(...args);
    };
    mw.util.getUrl = (
        title: string,
        parameters: Record<string, string> = {},
    ) => {
        const url = new URL(
            `/wiki/${encodeURIComponent(title)}`,
            location.origin,
        );
        for (const [key, value] of Object.entries(parameters))
            url.searchParams.set(key, value);
        return url.href;
    };
    mw.util.wikiScript = () => '/w/api.php';
    mw.util.addCSS = (css: string) => {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.append(style);
        return { ownerNode: style };
    };
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
            async writeText(text: string) {
                state.copied.push(text);
            },
        },
    });
    globals.RLQ = {
        push(callback: () => void) {
            callback();
        },
    };
    globals.sourceEditorConfig = { highlightDelay: 0 };
    if (options.delayedMediaWiki) delete globals.mw;
}
