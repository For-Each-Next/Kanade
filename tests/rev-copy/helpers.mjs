/**
 * @file tests/rev-copy/helpers.mjs
 * Purpose: Compile isolated source modules and run the browser entry in an offline host.
 *
 * Table of contents:
 * 1. Imports
 * 2. loadModule
 * 3. createHost
 * 4. settle
 */

import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

export async function loadModule(entry) {
    const { outputFiles } = await build({
        entryPoints: [entry],
        bundle: true,
        format: 'esm',
        platform: 'node',
        write: false,
    });
    return import(
        `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
    );
}

const { outputFiles } = await build({
    entryPoints: ['src/rev-copy/app/browser.ts'],
    bundle: true,
    format: 'iife',
    write: false,
    loader: { '.css': 'text' },
});
const browserSource = outputFiles[0].text;

export function createHost({
    config = {},
    html = '<h1>Intel 1103</h1><div class="vector-body-before-content"></div><div id="mw-content-text">Article</div>',
    response,
    clipboardError = false,
    url = 'https://zh.wikipedia.org/wiki/Intel_1103',
    ready = true,
    gadgetConfig,
} = {}) {
    const dom = new JSDOM(
        `<!doctype html><html><head></head><body>${html}</body></html>`,
        {
            url,
            runScripts: 'outside-only',
            pretendToBeVisual: true,
        },
    );
    const { window } = dom;
    const values = {
        wgAction: 'view',
        wgNamespaceNumber: 0,
        wgRevisionId: 123,
        wgCurRevisionId: 999,
        wgPageName: 'Intel_1103',
        wgContentLanguage: 'zh',
        wgUserLanguage: 'en',
        wgServerName: 'zh.wikipedia.org',
        ...config,
    };
    const requests = [];
    const copies = [];
    const notifications = [];
    const errors = [];
    const hooks = [];
    const queue = [];
    window.RLQ = {
        push(callback) {
            if (ready) callback();
            else queue.push(callback);
        },
    };
    window.revCopyConfig = gadgetConfig;
    window.console.error = (...args) => errors.push(args);
    Object.defineProperty(window.navigator, 'clipboard', {
        value: {
            async writeText(text) {
                if (clipboardError) throw new Error('Permission denied');
                copies.push(text);
            },
        },
    });
    window.mw = {
        config: { get: (name) => values[name] },
        loader: { using: async () => {} },
        util: {
            getUrl: (title) =>
                `/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`,
        },
        notify: (message, options) => notifications.push({ message, options }),
        hook: () => ({ add: (callback) => hooks.push(callback) }),
        Api: class {
            async get(params) {
                requests.push(params);
                if (response) return response(params, requests.length);
                return {
                    query: {
                        pages: [
                            {
                                revisions: [
                                    {
                                        revid: params.revids,
                                        timestamp: '2026-09-05T12:00:26Z',
                                    },
                                ],
                            },
                        ],
                    },
                };
            }
        },
    };
    const start = () => window.eval(browserSource);
    const fireContent = () => hooks.forEach((hook) => hook());
    return {
        dom,
        window,
        document: window.document,
        values,
        requests,
        copies,
        notifications,
        errors,
        start,
        fireContent,
        queue,
    };
}

export async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 10));
}
