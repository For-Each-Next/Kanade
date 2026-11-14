/**
 * @file tests/source-editor/runtime-options.test.ts
 * Purpose: Protect startup logging defaults and immutable runtime configuration.
 * Contents: Boundary validation, retired option removal, and snapshot ownership.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DEFAULT_SOURCE_EDITOR_OPTIONS,
    resolveSourceEditorOptions,
} from '../../src/source-editor/domain/runtime-options.ts';

test('missing and malformed preload configuration retains safe logging defaults', () => {
    for (const value of [undefined, null, true, 'settings', [], 1]) {
        assert.deepEqual(
            resolveSourceEditorOptions(value),
            DEFAULT_SOURCE_EDITOR_OPTIONS,
        );
    }
    for (const logLevel of ['DEBUG', '', 1, null, false]) {
        assert.deepEqual(resolveSourceEditorOptions({ logLevel }), {
            logLevel: 'warn',
        });
    }
});

test('supported logging levels survive while retired highlighting options are ignored', () => {
    for (const logLevel of ['silent', 'error', 'warn', 'info', 'debug']) {
        assert.deepEqual(
            resolveSourceEditorOptions({
                logLevel,
                highlightDelay: 0,
                maxLiveHighlightLength: Infinity,
                referenceTooltipDelay: 700,
                pagePreviewDelay: 700,
            }),
            { logLevel },
        );
    }
});

test('startup captures a frozen copy rather than retaining mutable configuration', () => {
    const input = { logLevel: 'silent', ignored: 'not retained' };
    const options = resolveSourceEditorOptions(input);
    input.logLevel = 'debug';
    assert.equal(options.logLevel, 'silent');
    assert.equal('ignored' in options, false);
    assert.equal(Object.isFrozen(options), true);
    assert.throws(() => {
        (options as { logLevel: string }).logLevel = 'warn';
    }, TypeError);
});
