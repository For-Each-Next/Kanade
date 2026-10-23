/**
 * @file src/rev-copy/app/browser.ts
 * Purpose: Start once after the MediaWiki ResourceLoader and DOM are ready.
 *
 * Contents: Singleton startup, host readiness, and page-context installation.
 */

function waitForMediaWiki(): Promise<void> {
    return new Promise((resolve) => {
        const queue: NonNullable<Window['RLQ']> = window.RLQ ?? [];
        window.RLQ = queue;
        queue.push(() => resolve());
    });
}

async function startRevCopy(): Promise<void> {
    await waitForMediaWiki();
    await mw.loader.using([
        'mediawiki.util',
        'mediawiki.api',
        'mediawiki.notification',
    ]);
    if (document.readyState === 'loading') {
        await new Promise<void>((resolve) => {
            document.addEventListener('DOMContentLoaded', () => resolve(), {
                once: true,
            });
        });
    }
    const { init } = await import('./main');
    init();
}

const STARTUP_KEY = Symbol.for('kanade.rev-copy.startup');
const page = window as unknown as Record<PropertyKey, unknown>;
if (!page[STARTUP_KEY]) {
    const startup = startRevCopy();
    page[STARTUP_KEY] = startup;
    void startup.catch((error) => {
        if (page[STARTUP_KEY] === startup) delete page[STARTUP_KEY];
        console.error('[Revision Copy] Initialization failed', error);
    });
}

export {};
