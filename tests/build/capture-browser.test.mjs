/**
 * @file tests/build/capture-browser.test.mjs
 * Purpose: Verify live captures use explicit and native proxy settings consistently.
 * Contents: Canonical override and unavailable system settings.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { configuredCaptureProxy } from '../../scripts/capture-browser.mjs';

test('canonical override works on every platform and skips system discovery', () => {
    assert.deepEqual(
        configuredCaptureProxy({
            environment: { KANADE_BROWSER_PROXY: 'http://shared:8080' },
            platform: 'linux',
        }),
        { server: 'http://shared:8080' },
    );
    assert.deepEqual(
        configuredCaptureProxy({
            environment: {
                KANADE_BROWSER_PROXY: 'http://shared:8080',
            },
            platform: 'darwin',
            readSystemProxy: () => {
                throw new Error('Explicit proxy must skip discovery');
            },
        }),
        { server: 'http://shared:8080' },
    );
});

test('macOS proxy requires an enabled HTTPS host and port', () => {
    const options = { environment: {}, platform: 'darwin' };
    assert.deepEqual(
        configuredCaptureProxy({
            ...options,
            readSystemProxy: () =>
                '<dictionary> {\nHTTPSEnable : 1\nHTTPSProxy : localhost\nHTTPSPort : 7890\n}',
        }),
        { server: 'http://localhost:7890' },
    );
    for (const settings of [
        'HTTPSEnable : 0\nHTTPSProxy : localhost\nHTTPSPort : 7890',
        'HTTPSEnable : 1\nHTTPSProxy : localhost',
        '',
    ])
        assert.equal(
            configuredCaptureProxy({
                ...options,
                readSystemProxy: () => settings,
            }),
            undefined,
        );
    assert.equal(
        configuredCaptureProxy({
            ...options,
            readSystemProxy: () => {
                throw new Error('System settings unavailable');
            },
        }),
        undefined,
    );
    assert.equal(
        configuredCaptureProxy({ environment: {}, platform: 'linux' }),
        undefined,
    );
});
