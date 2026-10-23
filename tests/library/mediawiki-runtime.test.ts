/**
 * @file tests/library/mediawiki-runtime.test.ts
 * Purpose: Verify host-module request reuse without owning dialogs or tool startup.
 * Contents: Equal module sets, failed-load retry, loader isolation, and disposal ownership.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { loadHostModules } from '../../src/library/mediawiki-runtime/modules.ts';
import type { HostModuleRequire } from '../../src/library/mediawiki-runtime/contracts.ts';

const requireModule: HostModuleRequire = (name) => ({ name });

test('equal module sets reuse pending and fulfilled requests', async () => {
    let release!: (require: HostModuleRequire) => void;
    const requests: string[][] = [];
    const loader = {
        using(modules: string[]) {
            requests.push(modules);
            return new Promise<HostModuleRequire>((resolve) => {
                release = resolve;
            });
        },
    };
    const first = loadHostModules(loader, ['vue', '@wikimedia/codex']);
    const second = loadHostModules(loader, ['@wikimedia/codex', 'vue', 'vue']);
    assert.equal(first, second);
    await Promise.resolve();
    assert.deepEqual(requests, [['vue', '@wikimedia/codex']]);
    release(requireModule);
    assert.equal(await first, requireModule);
    assert.equal(loadHostModules(loader, ['vue', '@wikimedia/codex']), first);
});

test('failed host loads can retry with the same modules', async () => {
    let attempts = 0;
    const loader = {
        using() {
            if (++attempts === 1) throw new Error('Host unavailable');
            return Promise.resolve(requireModule);
        },
    };
    await assert.rejects(loadHostModules(loader, ['vue']), /Host unavailable/u);
    assert.equal(await loadHostModules(loader, ['vue']), requireModule);
    assert.equal(attempts, 2);
});

test('different module sets and host identities retain independent requests', async () => {
    let requests = 0;
    const using = async () => {
        requests++;
        return requireModule;
    };
    const first = { using };
    const second = { using };
    await Promise.all([
        loadHostModules(first, ['vue']),
        loadHostModules(first, ['vue', '@wikimedia/codex']),
        loadHostModules(second, ['vue']),
    ]);
    assert.equal(requests, 3);
});

test('disposing a consumer does not cancel another consumer of the same host load', async () => {
    let release!: (require: HostModuleRequire) => void;
    const loader = {
        using: () =>
            new Promise<HostModuleRequire>((resolve) => {
                release = resolve;
            }),
    };
    let disposed = false;
    let firstMounts = 0;
    let secondMounts = 0;
    const first = loadHostModules(loader, ['vue']).then(() => {
        if (!disposed) firstMounts++;
    });
    const second = loadHostModules(loader, ['vue']).then(() => {
        secondMounts++;
    });
    disposed = true;
    await Promise.resolve();
    release(requireModule);
    await Promise.all([first, second]);
    assert.equal(firstMounts, 0);
    assert.equal(secondMounts, 1);
});
