/**
 * @file tests/source-editor/regex-tools.test.ts
 * Purpose: Verify regex review, selection scope, stale guards, and undo ownership.
 * Contents: Session source protection and draft lifecycle regressions.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    executeRegexReplacement,
    type RegexReplacementResult,
} from '../../src/source-editor/domain/regex-replacement.ts';
import {
    createRegexToolsBindings,
    createRegexToolsSession,
} from '../../src/source-editor/features/formatter/regex-tools.ts';
import type { VueModule } from '../../src/source-editor/features/formatter/codex.ts';

const draft = { pattern: 'a', replacement: 'b', flags: 'g' };

function harness(range = { start: 0, end: 0 }) {
    let source = 'a aa a';
    let attached = true;
    let writes = 0;
    const session = createRegexToolsSession({
        source,
        range,
        read: () => source,
        isCurrent: () => attached,
        write(start, end, value) {
            writes++;
            source = source.slice(0, start) + value + source.slice(end);
        },
        startTask: (request) => ({
            result: Promise.resolve(executeRegexReplacement(request)),
            cancel() {},
        }),
    });
    return {
        session,
        get source() {
            return source;
        },
        set source(value) {
            source = value;
        },
        get writes() {
            return writes;
        },
        detach() {
            attached = false;
        },
    };
}

test('selection preview leaves source unchanged and explicit apply supports guarded undo', async () => {
    const fixture = harness({ start: 2, end: 4 });
    assert.deepEqual(await fixture.session.preview([draft]), {
        ok: true,
        output: 'bb',
        matches: 2,
    });
    assert.equal(fixture.source, 'a aa a');
    assert.equal(fixture.writes, 0);
    assert.deepEqual(fixture.session.apply(), { ok: true, changed: true });
    assert.equal(fixture.source, 'a bb a');
    assert.equal(fixture.session.undo(), true);
    assert.equal(fixture.source, 'a aa a');
    assert.equal(fixture.session.undo(), false);
});

test('ordered pairs preview one result and apply and undo the sequence as one source edit', async () => {
    const fixture = harness({ start: 2, end: 4 });
    assert.deepEqual(
        await fixture.session.preview([
            draft,
            { pattern: 'bb', replacement: 'final', flags: 'g' },
        ]),
        { ok: true, output: 'final', matches: 3 },
    );
    assert.equal(fixture.source, 'a aa a');
    assert.equal(fixture.writes, 0);
    assert.deepEqual(fixture.session.apply(), { ok: true, changed: true });
    assert.equal(fixture.source, 'a final a');
    assert.equal(fixture.writes, 1);
    assert.equal(fixture.session.undo(), true);
    assert.equal(fixture.source, 'a aa a');
});

test('a later invalid pair rejects the entire sequence without preserving a partial review', async () => {
    const fixture = harness();
    await fixture.session.preview([draft]);
    assert.deepEqual(
        await fixture.session.preview([
            draft,
            { pattern: '[', replacement: 'final', flags: 'g' },
        ]),
        { ok: false, error: 'invalid-pattern', ruleIndex: 1 },
    );
    assert.deepEqual(fixture.session.apply(), {
        ok: false,
        error: 'source-changed',
    });
    assert.equal(fixture.source, 'a aa a');
    assert.equal(fixture.writes, 0);
});

test('the match limit applies to the complete ordered sequence', async () => {
    const source = 'a'.repeat(6_000);
    const session = createRegexToolsSession({
        source,
        range: { start: 0, end: 0 },
        read: () => source,
        isCurrent: () => true,
        write() {
            assert.fail('An over-limit sequence must not write');
        },
        startTask: (request) => ({
            result: Promise.resolve(executeRegexReplacement(request)),
            cancel() {},
        }),
    });
    assert.deepEqual(
        await session.preview([
            draft,
            { pattern: 'b', replacement: 'c', flags: 'g' },
        ]),
        { ok: false, error: 'too-many-matches', ruleIndex: 1 },
    );
    assert.deepEqual(session.apply(), { ok: false, error: 'source-changed' });
});

test('source edits, owner changes, and invalidated drafts prevent accepting stale reviews', async () => {
    for (const mutate of [
        (fixture: ReturnType<typeof harness>) => {
            fixture.source += '!';
        },
        (fixture: ReturnType<typeof harness>) => fixture.detach(),
        (fixture: ReturnType<typeof harness>) => fixture.session.invalidate(),
    ]) {
        const fixture = harness();
        await fixture.session.preview([draft]);
        mutate(fixture);
        assert.deepEqual(fixture.session.apply(), {
            ok: false,
            error: 'source-changed',
        });
        assert.equal(fixture.writes, 0);
    }
    const fixture = harness();
    await fixture.session.preview([draft]);
    fixture.session.apply();
    fixture.source += '!';
    assert.equal(fixture.session.undo(), false);
    assert.equal(fixture.source, 'b bb b!');
});

test('late previews are discarded after invalidation or a source change', async () => {
    let finish!: (result: RegexReplacementResult) => void;
    let cancelled = false;
    let source = 'a';
    const session = createRegexToolsSession({
        source,
        range: { start: 0, end: 0 },
        read: () => source,
        isCurrent: () => true,
        write() {
            assert.fail('No write expected');
        },
        startTask: () => ({
            result: new Promise((resolve) => {
                finish = resolve;
            }),
            cancel() {
                cancelled = true;
            },
        }),
    });
    const pending = session.preview([draft]);
    session.invalidate();
    finish({ ok: true, output: 'b', matches: 1 });
    assert.deepEqual(await pending, { ok: false, error: 'cancelled' });
    assert.equal(cancelled, true);
    const stale = session.preview([draft]);
    source = 'new';
    finish({ ok: true, output: 'b', matches: 1 });
    assert.deepEqual(await stale, { ok: false, error: 'source-changed' });
});

test('invalidating a running later pair cancels it and prevents partial review or later work', async () => {
    let finish!: (result: RegexReplacementResult) => void;
    let started = 0;
    let cancelled = 0;
    const session = createRegexToolsSession({
        source: 'a',
        range: { start: 0, end: 0 },
        read: () => 'a',
        isCurrent: () => true,
        write() {
            assert.fail('A partial sequence must not write source');
        },
        startTask: () => {
            started++;
            return {
                result:
                    started === 1
                        ? Promise.resolve({
                              ok: true as const,
                              output: 'b',
                              matches: 1,
                          })
                        : new Promise((resolve) => {
                              finish = resolve;
                          }),
                cancel() {
                    cancelled++;
                },
            };
        },
    });
    const pending = session.preview([draft, draft, draft]);
    await Promise.resolve();
    assert.equal(started, 2);
    session.invalidate();
    finish({ ok: true, output: 'c', matches: 1 });
    assert.deepEqual(await pending, { ok: false, error: 'cancelled' });
    assert.equal(cancelled, 1);
    assert.equal(started, 2);
    assert.deepEqual(session.apply(), { ok: false, error: 'source-changed' });
});

test('ignored writes cannot report a successful apply or undo', async () => {
    let source = 'a';
    let acceptsWrites = false;
    const session = createRegexToolsSession({
        source,
        range: { start: 0, end: 0 },
        read: () => source,
        isCurrent: () => true,
        write(_start, _end, value) {
            if (acceptsWrites) source = value;
        },
        startTask: (request) => ({
            result: Promise.resolve(executeRegexReplacement(request)),
            cancel() {},
        }),
    });
    await session.preview([draft]);
    assert.deepEqual(session.apply(), { ok: false, error: 'source-changed' });
    assert.equal(source, 'a');
    acceptsWrites = true;
    assert.deepEqual(session.apply(), { ok: true, changed: true });
    acceptsWrites = false;
    assert.equal(session.undo(), false);
    assert.equal(source, 'b');
    acceptsWrites = true;
    assert.equal(session.undo(), true);
    assert.equal(source, 'a');
});

test('an unavailable executor preserves source and returns actionable feedback', async () => {
    const session = createRegexToolsSession({
        source: 'a',
        range: { start: 0, end: 0 },
        read: () => 'a',
        isCurrent: () => true,
        write() {
            assert.fail('An unavailable worker must not write source');
        },
    });
    assert.deepEqual(await session.preview([draft]), {
        ok: false,
        error: 'unavailable',
    });
    assert.deepEqual(session.apply(), { ok: false, error: 'source-changed' });
});

test('input completions reuse previews while draft changes and disposal cancel them', async () => {
    const fixture = harness();
    let previews = 0;
    const original = fixture.session.preview;
    fixture.session.preview = (value) => {
        previews++;
        return original(value);
    };
    const Vue = { ref: <T>(value: T) => ({ value }) } as VueModule;
    const bindings = createRegexToolsBindings(Vue, fixture.session);
    bindings.regexRules.value[0].pattern = 'a';
    bindings.regexRules.value[0].replacement = 'b';
    await bindings.regexPreview(false);
    await bindings.regexPreview(false);
    assert.equal(previews, 1);
    bindings.regexRules.value[0].replacement = 'c';
    bindings.regexChanged();
    assert.equal(bindings.regexResult.value, null);
    bindings.regexApply();
    assert.equal(fixture.writes, 0);
    await bindings.regexPreview();
    bindings.regexApply();
    assert.equal(fixture.source, 'c cc c');
    bindings.regexUndo();
    assert.equal(fixture.source, 'a aa a');
    bindings.disposeRegex();
    await bindings.regexPreview();
    assert.equal(previews, 2);
});

test('numbered pair drafts skip unused rows, preserve deletion, and invalidate on add or removal', async () => {
    const fixture = harness();
    const Vue = { ref: <T>(value: T) => ({ value }) } as VueModule;
    const bindings = createRegexToolsBindings(Vue, fixture.session);
    assert.equal(bindings.regexRules.value.length, 2);
    bindings.regexRules.value[1].pattern = 'a';
    await bindings.regexPreview();
    assert.equal(bindings.regexResult.value?.output, '  ');
    bindings.regexAddRule();
    assert.equal(bindings.regexRules.value.length, 3);
    assert.equal(bindings.regexResult.value, null);
    bindings.regexRules.value[2].pattern = '[';
    await bindings.regexPreview();
    assert.equal(bindings.regexRules.value[0].error, '');
    assert.equal(bindings.regexRules.value[1].error, '');
    assert.match(bindings.regexRules.value[2].error, /not supported/u);
    const first = bindings.regexRules.value[0].id;
    const second = bindings.regexRules.value[1].id;
    bindings.regexRemoveRule(first);
    assert.equal(bindings.regexRules.value[0].id, second);
    assert.equal(bindings.regexRules.value[0].pattern, 'a');
    assert.equal(bindings.regexRules.value[1].error, '');
    bindings.regexRemoveRule(bindings.regexRules.value[1].id);
    bindings.regexRemoveRule(second);
    assert.equal(bindings.regexRules.value.length, 1);
    bindings.disposeRegex();
});

test('composition Enter is preserved and completed single-line Enter prepares only a preview', async () => {
    const fixture = harness();
    let previews = 0;
    let prevented = 0;
    const original = fixture.session.preview;
    fixture.session.preview = (value) => {
        previews++;
        return original(value);
    };
    const Vue = { ref: <T>(value: T) => ({ value }) } as VueModule;
    const bindings = createRegexToolsBindings(Vue, fixture.session);
    bindings.regexRules.value[0].pattern = 'a';
    bindings.regexComplete({
        isComposing: true,
        keyCode: 13,
        preventDefault() {
            prevented++;
        },
    } as KeyboardEvent);
    assert.equal(previews, 0);
    assert.equal(prevented, 0);
    bindings.regexCompositionStart();
    bindings.regexComplete({
        isComposing: false,
        keyCode: 13,
        preventDefault() {
            prevented++;
        },
    } as KeyboardEvent);
    assert.equal(previews, 0);
    assert.equal(prevented, 0);
    bindings.regexCompositionEnd();
    await new Promise((resolve) => setTimeout(resolve, 1));
    bindings.regexComplete({
        isComposing: false,
        keyCode: 13,
        preventDefault() {
            prevented++;
        },
    } as KeyboardEvent);
    assert.equal(previews, 1);
    assert.equal(prevented, 1);
    assert.equal(fixture.writes, 0);
    bindings.disposeRegex();
});
