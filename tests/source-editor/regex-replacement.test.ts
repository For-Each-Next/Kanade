/**
 * @file tests/source-editor/regex-replacement.test.ts
 * Purpose: Verify bounded JavaScript substitutions and isolated-worker cleanup.
 * Contents: Replacement semantics, resource caps, cancellation, and timeout.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { executeRegexReplacement } from '../../src/source-editor/domain/regex-replacement.ts';
import { startRegexReplacement } from '../../src/source-editor/platform/browser/regex-replacement.ts';

for (const [source, pattern, flags, replacement] of [
    ['aba ABA', '(a)(b)?', 'gi', '$$/$&/$1/$2/$3/$10/$01/$00/$99'],
    ['before abc after', '(?<letter>a)(b)?', 'g', "$<letter>/$<missing>/$`/$'"],
    ['a a', 'a', '', 'b'],
    ['abc', 'z', 'g', ''],
    ['abc', '(?=.)', 'g', '-'],
    ['😀a', '(?:)', 'gu', '_'],
    ['😀a', '(?:)', 'g', '_'],
    ['a\nb\na', '^a$', 'gm', 'first\nsecond'],
    ['abbb', '(a)|(b)', 'gy', '$1/$2/$12'],
    ['a', '(a)', 'g', '$<literal>'],
] as const) {
    test(`replacement agrees with JavaScript: ${pattern}/${flags} ${replacement}`, () => {
        const result = executeRegexReplacement({
            source,
            pattern,
            flags,
            replacement,
        });
        assert.equal(result.ok, true);
        if (!result.ok) return;
        assert.equal(
            result.output,
            source.replace(new RegExp(pattern, flags), replacement),
        );
    });
}

test('replacement validates patterns and flags without interpreting replacement code', () => {
    const request = {
        source: 'aa',
        pattern: 'a',
        replacement: 'globalThis.secret()',
        flags: 'g',
    };
    assert.deepEqual(executeRegexReplacement(request), {
        ok: true,
        output: 'globalThis.secret()globalThis.secret()',
        matches: 2,
    });
    for (const [draft, error] of [
        [{ pattern: '' }, 'pattern-required'],
        [{ pattern: '[' }, 'invalid-pattern'],
        [{ flags: 'gg' }, 'invalid-flags'],
        [{ flags: 'x' }, 'invalid-flags'],
        [{ flags: 'uv' }, 'invalid-flags'],
    ] as const)
        assert.deepEqual(executeRegexReplacement({ ...request, ...draft }), {
            ok: false,
            error,
        });
});

test('replacement bounds input, match count, cumulative output, and a single expanded substitution', () => {
    const request = { source: 'a', pattern: 'a', replacement: 'x', flags: 'g' };
    assert.deepEqual(
        executeRegexReplacement({ ...request, source: 'a'.repeat(2_000_001) }),
        { ok: false, error: 'input-too-large' },
    );
    assert.deepEqual(
        executeRegexReplacement({ ...request, source: 'a'.repeat(10_001) }),
        { ok: false, error: 'too-many-matches' },
    );
    assert.deepEqual(
        executeRegexReplacement({
            ...request,
            source: 'a'.repeat(100),
            replacement: 'x'.repeat(100_000),
        }),
        { ok: false, error: 'output-too-large' },
    );
    assert.deepEqual(
        executeRegexReplacement({
            ...request,
            source: 'a'.repeat(100_000),
            replacement: "$'".repeat(50_000),
        }),
        { ok: false, error: 'output-too-large' },
    );
});

test('worker result, cancellation, errors, and timeout all terminate the worker', async (context) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
    class FakeWorker {
        static instances: FakeWorker[] = [];
        onmessage?: (event: { data: unknown }) => void;
        onerror?: () => void;
        onmessageerror?: () => void;
        terminated = false;
        constructor() {
            FakeWorker.instances.push(this);
        }
        postMessage(): void {}
        terminate(): void {
            this.terminated = true;
        }
    }
    Object.defineProperty(globalThis, 'Worker', {
        configurable: true,
        value: FakeWorker,
    });
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const request = { source: 'a', pattern: 'a', replacement: 'b', flags: 'g' };
    try {
        const success = startRegexReplacement(request);
        FakeWorker.instances[0].onmessage?.({
            data: { ok: true, output: 'b', matches: 1 },
        });
        assert.deepEqual(await success.result, {
            ok: true,
            output: 'b',
            matches: 1,
        });
        const cancel = startRegexReplacement(request);
        cancel.cancel();
        assert.deepEqual(await cancel.result, {
            ok: false,
            error: 'cancelled',
        });
        const failure = startRegexReplacement(request);
        FakeWorker.instances[2].onerror?.();
        assert.deepEqual(await failure.result, {
            ok: false,
            error: 'unavailable',
        });
        const timeout = startRegexReplacement(request);
        context.mock.timers.tick(1500);
        assert.deepEqual(await timeout.result, { ok: false, error: 'timeout' });
        assert.ok(FakeWorker.instances.every((worker) => worker.terminated));
    } finally {
        if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor);
        else Reflect.deleteProperty(globalThis, 'Worker');
    }
});
