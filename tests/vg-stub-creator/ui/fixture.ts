/**
 * @file tests/vg-stub-creator/ui/fixture.ts
 * Purpose: Provides the offline MediaWiki, Vue, and Codex creator browser fixture.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. WikiFixtureOptions
 * 4. loadCreator
 * 5. installCreatorScript
 * 6. releaseResourceLoader
 * 7. readResourceLoads
 * 8. installWikiFixture
 * 9. openCreator
 * 10. readWrites
 * 11. readTitleChecks
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

const projectRoot = resolve(new URL('../../../', import.meta.url).pathname);
const origin = 'https://vg-creator.test';

export interface WikiFixtureOptions {
    locale?: string;
    database?: string;
    namespace?: number;
    title?: string;
    articleId?: number;
    deferResourceLoader?: boolean;
    existingTitles?: string[];
    failedTitles?: string[];
    titleConversions?: Record<string, Record<string, string>>;
    citationMetadata?: Record<string, Record<string, unknown>>;
}

/** Install the built tool with local runtimes and offline MediaWiki adapters. */
export async function loadCreator(
    page: Page,
    options: WikiFixtureOptions = {},
): Promise<void> {
    await page.route('**/*', async (route) => {
        const request = route.request();
        if (!request.url().startsWith(origin)) {
            await route.abort();
            return;
        }
        const url = new URL(request.url());
        const citationPath = '/api/rest_v1/data/citation/zotero/';
        if (
            request.method() === 'GET' &&
            url.pathname.startsWith(citationPath)
        ) {
            const source = decodeURIComponent(
                url.pathname.slice(citationPath.length),
            );
            const citation = options.citationMetadata?.[source];
            if (!citation) {
                await route.abort();
                return;
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([citation]),
            });
            return;
        }
        if (request.method() === 'GET' && url.pathname === '/w/api.php') {
            const titles = (url.searchParams.get('titles') ?? '').split('|');
            const conversions = url.searchParams.has('converttitles')
                ? (options.titleConversions?.[
                      url.searchParams.get('variant') ?? ''
                  ] ?? {})
                : {};
            await page.evaluate((params) => {
                const fixture = globalThis as unknown as {
                    __wikiReads: Record<string, unknown>[];
                };
                fixture.__wikiReads.push(params);
            }, Object.fromEntries(url.searchParams));
            if (titles.some((title) => options.failedTitles?.includes(title))) {
                await route.abort();
                return;
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    query: {
                        converted: titles
                            .filter((title) => conversions[title])
                            .map((title) => ({
                                from: title,
                                to: conversions[title],
                            })),
                        pages: titles.map((requestedTitle, index) => ({
                            title:
                                conversions[requestedTitle] || requestedTitle,
                            ...(options.existingTitles?.includes(
                                conversions[requestedTitle] || requestedTitle,
                            )
                                ? { pageid: index + 1 }
                                : { missing: true, pageid: -(index + 1) }),
                        })),
                    },
                }),
            });
            return;
        }
        const preview = request.method() === 'POST';
        const body = preview
            ? '<div id="wikiPreview"><div class="mw-parser-output"><p>Rendered offline game article.</p></div></div>'
            : '<!doctype html><html><head><meta charset="utf-8"></head><body><nav id="page-actions"><ul></ul></nav><main id="content"><h1>Star Harbor</h1></main></body></html>';
        await route.fulfill({ status: 200, contentType: 'text/html', body });
    });
    await page.goto(`${origin}/wiki/Star_Harbor`);
    await page.addStyleTag({
        path: fileURLToPath(
            import.meta.resolve('@wikimedia/codex/dist/codex.style.css'),
        ),
    });
    await page.addStyleTag({
        content: `
        body { margin: 0; font-family: sans-serif; }
        #content { padding: 1.5rem; }
        #page-actions { padding: 1rem 1.5rem; border-bottom: 1px solid #a2a9b1; }
        *, *::before, *::after {
            animation: none !important;
            transition: none !important;
            caret-color: transparent !important;
        }
    `,
    });
    await page.addScriptTag({
        path: fileURLToPath(import.meta.resolve('vue/dist/vue.global.prod.js')),
    });
    await page.addScriptTag({
        path: fileURLToPath(
            import.meta.resolve('@wikimedia/codex/dist/codex.umd.cjs'),
        ),
    });
    await page.evaluate(installWikiFixture, options);
    await installCreatorScript(page);
}

export async function installCreatorScript(
    page: Page,
    filename:
        | 'vg_stub_creator.min.js'
        | 'vg_stub_creator.user.js' = 'vg_stub_creator.min.js',
): Promise<void> {
    await page.addScriptTag({ path: resolve(projectRoot, 'dist', filename) });
}

export async function releaseResourceLoader(page: Page): Promise<void> {
    await page.evaluate(() => {
        const fixture = globalThis as unknown as {
            __wikiReleaseResources(): void;
        };
        fixture.__wikiReleaseResources();
    });
}

export async function readResourceLoads(page: Page): Promise<string[][]> {
    return page.evaluate(() => {
        const fixture = globalThis as unknown as {
            __wikiResourceLoads: string[][];
        };
        return fixture.__wikiResourceLoads;
    });
}

function installWikiFixture(options: WikiFixtureOptions): void {
    const globals = globalThis as unknown as {
        Vue: { createApp: unknown; createMwApp: unknown };
        codex: unknown;
        mw: unknown;
        __wikiWrites: Record<string, unknown>[];
        __wikiReads: Record<string, unknown>[];
        __wikiNotices: string[];
        __wikiResourceLoads: string[][];
        __wikiReleaseResources(): void;
    };
    globals.Vue.createMwApp = globals.Vue.createApp;
    globals.__wikiWrites = [];
    globals.__wikiReads = [];
    globals.__wikiNotices = [];
    globals.__wikiResourceLoads = [];
    let releaseResources = () => {};
    const resources = options.deferResourceLoader
        ? new Promise<void>((resolveResources) => {
              releaseResources = resolveResources;
          })
        : Promise.resolve();
    globals.__wikiReleaseResources = releaseResources;
    const title = options.title ?? 'Star Harbor';
    const values: Record<string, unknown> = {
        wgAction: 'view',
        wgArticleId: options.articleId ?? 0,
        wgDBname: options.database ?? 'zhwiki',
        wgNamespaceNumber: options.namespace ?? 0,
        wgPageName: title.replaceAll(' ', '_'),
        wgTitle: title,
        wgUserLanguage: options.locale ?? 'en',
        wgUserName: 'Example editor',
    };

    class FixtureApi {
        async get(params: Record<string, unknown>) {
            globals.__wikiReads.push(params);
            const titles = String(params.titles ?? title).split('|');
            const conversions = params.converttitles
                ? (options.titleConversions?.[String(params.variant ?? '')] ??
                  {})
                : {};
            if (
                titles.some((pageTitle) =>
                    options.failedTitles?.includes(pageTitle),
                )
            ) {
                throw new Error('Mocked title lookup failure');
            }
            return {
                curtimestamp: '2026-01-02T12:00:00Z',
                query: {
                    converted: titles
                        .filter((pageTitle) => conversions[pageTitle])
                        .map((pageTitle) => ({
                            from: pageTitle,
                            to: conversions[pageTitle],
                        })),
                    pages: titles.map((pageTitle, index) => ({
                        title: conversions[pageTitle] || pageTitle,
                        ...(options.existingTitles?.includes(
                            conversions[pageTitle] || pageTitle,
                        )
                            ? { pageid: index + 1 }
                            : { missing: true, pageid: -(index + 1) }),
                    })),
                    categorymembers: [],
                },
            };
        }

        async post(params: Record<string, unknown>) {
            if (params.action === 'parse') {
                return { parse: { text: '<p>Rendered offline preview.</p>' } };
            }
            throw new Error('Unexpected mocked API post');
        }

        async postWithToken(_token: string, params: Record<string, unknown>) {
            globals.__wikiWrites.push(params);
            throw new Error('Writes are disabled in browser tests');
        }
    }

    globals.mw = {
        config: { get: (key: string) => values[key] },
        Api: FixtureApi,
        ForeignApi: FixtureApi,
        hook: () => ({ add() {}, remove() {} }),
        notify(message: string) {
            globals.__wikiNotices.push(message);
        },
        loader: {
            using(modules: string | string[]) {
                if (String(modules).includes('ext.CodeMirror')) {
                    return Promise.reject(
                        new Error('No CodeMirror in fixture'),
                    );
                }
                globals.__wikiResourceLoads.push(
                    Array.isArray(modules) ? modules : [modules],
                );
                return resources.then(
                    () =>
                        function requireModule(name: string) {
                            if (name === 'vue') return globals.Vue;
                            if (name === '@wikimedia/codex')
                                return globals.codex;
                            throw new Error(
                                `Unexpected ResourceLoader module: ${name}`,
                            );
                        },
                );
            },
        },
        util: {
            addCSS(css: string) {
                const style = document.createElement('style');
                style.textContent = css;
                document.head.append(style);
                return { ownerNode: style };
            },
            addPortletLink(
                _portlet: string,
                href: string,
                label: string,
                id: string,
            ) {
                const item = document.createElement('li');
                item.id = id;
                item.dataset.portlet = _portlet;
                const link = document.createElement('a');
                link.href = href;
                link.textContent = label;
                item.append(link);
                document.querySelector('#page-actions ul')?.append(item);
                return item;
            },
            getUrl(pageTitle: string, params: Record<string, string> = {}) {
                const url = new URL(
                    `/wiki/${encodeURIComponent(pageTitle)}`,
                    location.origin,
                );
                for (const [key, value] of Object.entries(params)) {
                    url.searchParams.set(key, value);
                }
                return url.toString();
            },
        },
    };
}

export async function openCreator(page: Page): Promise<void> {
    await page.locator('#kanade-vg-stub-creator-launcher').click();
    await page.getByRole('dialog').waitFor();
}

export async function readWrites(page: Page): Promise<unknown[]> {
    return page.evaluate(() => {
        const fixture = globalThis as unknown as { __wikiWrites: unknown[] };
        return fixture.__wikiWrites;
    });
}

/** Read the page titles actually checked by both fixture API adapters. */
export async function readTitleChecks(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const fixture = globalThis as unknown as {
            __wikiReads: Record<string, unknown>[];
        };
        return fixture.__wikiReads.flatMap((params) =>
            typeof params.titles === 'string' ? params.titles.split('|') : [],
        );
    });
}
