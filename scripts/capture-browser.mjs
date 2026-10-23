/**
 * @file scripts/capture-browser.mjs
 * Purpose: Resolve the browser network route for live documentation captures.
 * Contents: Canonical proxy setting and macOS discovery.
 */

import { execFileSync } from 'node:child_process';

export function configuredCaptureProxy({
    environment = process.env,
    platform = process.platform,
    readSystemProxy = () =>
        execFileSync('scutil', ['--proxy'], { encoding: 'utf8' }),
} = {}) {
    const explicit = environment.KANADE_BROWSER_PROXY;
    if (explicit) return { server: explicit };
    if (platform !== 'darwin') return undefined;
    try {
        const settings = readSystemProxy();
        const enabled = settings.match(/HTTPSEnable\s*:\s*(\d+)/u)?.[1] === '1';
        const host = settings.match(/HTTPSProxy\s*:\s*(\S+)/u)?.[1];
        const port = settings.match(/HTTPSPort\s*:\s*(\d+)/u)?.[1];
        return enabled && host && port
            ? { server: `http://${host}:${port}` }
            : undefined;
    } catch {
        // Keep the ordinary browser route when system proxy discovery is unavailable.
        return undefined;
    }
}
