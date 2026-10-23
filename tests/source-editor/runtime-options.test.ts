/**
 * @file tests/source-editor/runtime-options.test.ts
 * Purpose: Protect startup defaults, validation, and immutable runtime configuration.
 * Contents: Invalid values, independently valid fields, bounds, and snapshot ownership.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DEFAULT_SOURCE_EDITOR_OPTIONS,
    resolveSourceEditorOptions,
} from '../../src/source-editor/domain/runtime-options.ts';

test('missing and malformed preload configuration retains safe defaults', () => {
    for (const value of [undefined, null, true, 'settings', [], 1]) {
        assert.deepEqual(
            resolveSourceEditorOptions(value),
            DEFAULT_SOURCE_EDITOR_OPTIONS,
        );
    }
    for (const value of [-1, 0.5, NaN, Infinity, '100', null, 60_001]) {
        assert.equal(
            resolveSourceEditorOptions({ highlightDelay: value })
                .highlightDelay,
            100,
        );
        assert.equal(
            resolveSourceEditorOptions({ pagePreviewDelay: value })
                .pagePreviewDelay,
            700,
        );
        assert.equal(
            resolveSourceEditorOptions({ referenceTooltipDelay: value })
                .referenceTooltipDelay,
            700,
        );
    }
    for (const value of [-1, 0.5, NaN, -Infinity, '100', null]) {
        assert.equal(
            resolveSourceEditorOptions({ maxLiveHighlightLength: value })
                .maxLiveHighlightLength,
            1_024_768,
        );
    }
});

test('valid options survive independently of invalid fields', () => {
    const options = resolveSourceEditorOptions({
        highlightDelay: 0,
        referenceTooltipDelay: 60_000,
        pagePreviewDelay: -1,
        maxLiveHighlightLength: Infinity,
        logLevel: 'debug',
    });
    assert.deepEqual(options, {
        highlightDelay: 0,
        referenceTooltipDelay: 60_000,
        pagePreviewDelay: 700,
        maxLiveHighlightLength: Infinity,
        logLevel: 'debug',
    });
    assert.equal(
        resolveSourceEditorOptions({ maxLiveHighlightLength: 0 })
            .maxLiveHighlightLength,
        0,
    );
    assert.equal(
        resolveSourceEditorOptions({ logLevel: 'DEBUG' }).logLevel,
        'warn',
    );
});

test('startup captures a frozen copy rather than retaining mutable configuration', () => {
    const input = {
        highlightDelay: 10,
        logLevel: 'silent',
        ignored: 'not retained',
    };
    const options = resolveSourceEditorOptions(input);
    input.highlightDelay = 60_000;
    assert.equal(options.highlightDelay, 10);
    assert.equal('ignored' in options, false);
    assert.equal(Object.isFrozen(options), true);
    assert.throws(() => {
        (options as { highlightDelay: number }).highlightDelay = 500;
    }, TypeError);
});
