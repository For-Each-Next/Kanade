/**
 * @file tests/source-editor/startup.test.ts
 * Purpose: Verify one Source Editor startup defers host access until document readiness.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

test('startup defers host utilities until the editor and ResourceLoader are ready', async (context) => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const previous = new Map<string, PropertyDescriptor | undefined>();
    let waitsForDocument = false;
    const stubs = {
        window: {
            sourceEditorConfig: { logLevel: 'silent' },
            location: { origin: 'https://wiki.example.test' },
        },
        document: {
            readyState: 'loading',
            addEventListener() {
                waitsForDocument = true;
            },
        },
        mw: {
            config: { get: () => undefined },
            loader: {
                using: async () =>
                    assert.fail(
                        'ResourceLoader must wait for document readiness',
                    ),
            },
        },
    };
    for (const [key, value] of Object.entries(stubs)) {
        previous.set(key, Object.getOwnPropertyDescriptor(globals, key));
        Object.defineProperty(globals, key, {
            configurable: true,
            value,
            writable: true,
        });
    }
    context.after(() => {
        for (const [key, descriptor] of previous) {
            if (descriptor == null) {
                delete globals[key];
            } else {
                Object.defineProperty(globals, key, descriptor);
            }
        }
    });

    const { outputFiles } = await build({
        entryPoints: ['src/source-editor/app/main.ts'],
        bundle: true,
        format: 'esm',
        platform: 'node',
        loader: { '.css': 'text' },
        write: false,
    });
    const source = `${outputFiles[0].text}\n//# sourceURL=kanade-source-editor-startup-fixture.js`;
    const { start } = (await import(
        `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
    )) as typeof import('../../src/source-editor/app/main.ts');
    const startup = start();
    assert.ok(startup instanceof Promise);
    assert.equal(start(), startup, 'overlapping installs share one startup');
    assert.equal(waitsForDocument, true);
});
