/**
 * @file tests/vg-stub-creator/source-url-editor.test.ts
 * Purpose: Verifies source-list completion, persisted drafts, safe links, and row focus.
 * Contents: Editor fixtures and source-entry regression scenarios.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { reactive } from 'vue';

import { createSourceUrlEditor } from '../../src/vg-stub-creator/features/creator/form/source-url-editor.ts';

function createFixture(initial: Record<string, string> = {}) {
    const values = { ...initial };
    const ticks: Array<() => void> = [];
    let completions = 0;
    const editor = createSourceUrlEditor({
        reactive,
        nextTick: (callback) => ticks.push(callback),
        read: (key) => values[key],
        write: (key, value) => {
            values[key] = value;
        },
        onComplete: () => {
            completions += 1;
        },
    });
    return {
        ...editor,
        values,
        completions: () => completions,
        flush: () => ticks.splice(0).forEach((callback) => callback()),
    };
}

function pasteEvent(text: string, start: number, end = start) {
    let prevented = false;
    return {
        event: {
            clipboardData: { getData: () => text },
            target: { selectionStart: start, selectionEnd: end },
            preventDefault: () => {
                prevented = true;
            },
        } as unknown as ClipboardEvent,
        prevented: () => prevented,
    };
}

test('pasted source lines keep URL punctuation, insertion order, and one copy of each URL', () => {
    const first = 'https://example.test/article?a=one,two;three&next=/path';
    const second = 'https://other.test/report?q=a+b#section';
    const fixture = createFixture({ sources: first });
    const paste = pasteEvent(` ${first}\r\n${second}\n${second}\n`, 0);

    fixture.methods.pasteSourceEntry('sources', paste.event);

    assert.equal(paste.prevented(), true);
    assert.deepEqual(fixture.methods.getSourceUrls('sources'), [first, second]);
    assert.equal(fixture.values.sources, `${first}\n${second}`);
    assert.equal(fixture.state.sourceEntryValues.sources, '');
    assert.equal(fixture.completions(), 1);
    fixture.methods.commitSourceEntry('sources');
    assert.equal(fixture.completions(), 1);
});

test('unfinished typing is retained in source-string drafts until completion', () => {
    const fixture = createFixture({ sources: 'https://saved.test' });
    fixture.methods.updateSourceEntry('sources', 'https://draft.test');

    assert.equal(
        fixture.values.sources,
        'https://saved.test\nhttps://draft.test',
    );
    assert.deepEqual(fixture.methods.getSourceUrls('sources'), [
        'https://saved.test',
    ]);
    assert.equal(fixture.hasPendingEntries(), true);
    assert.equal(fixture.completions(), 0);

    const restored = createFixture(fixture.values);
    assert.deepEqual(restored.methods.getSourceUrls('sources'), [
        'https://saved.test',
        'https://draft.test',
    ]);
    fixture.methods.commitSourceEntry('sources');
    assert.equal(fixture.hasPendingEntries(), false);
    assert.deepEqual(fixture.methods.getSourceUrls('sources'), [
        'https://saved.test',
        'https://draft.test',
    ]);
});

test('paste replaces the selected entry text before committing the complete source', () => {
    const fixture = createFixture({ sources: '' });
    fixture.methods.updateSourceEntry(
        'sources',
        'https://example.test/old?q=retained',
    );
    const paste = pasteEvent('new', 21, 24);
    fixture.methods.pasteSourceEntry('sources', paste.event);
    assert.equal(fixture.values.sources, 'https://example.test/new?q=retained');
    assert.equal(fixture.state.sourceEntryValues.sources, '');
});

test('composition Enter is preserved and ordinary Enter completes the source once', () => {
    const fixture = createFixture({ sources: '' });
    fixture.methods.updateSourceEntry('sources', 'https://example.test');
    let prevented = 0;
    const event = {
        isComposing: true,
        keyCode: 13,
        preventDefault: () => {
            prevented += 1;
        },
    } as unknown as KeyboardEvent;
    fixture.methods.commitSourceEntry('sources', event);
    fixture.methods.commitSourceEntry('sources', {
        ...event,
        isComposing: false,
        keyCode: 229,
    });
    assert.equal(prevented, 0);
    assert.equal(
        fixture.state.sourceEntryValues.sources,
        'https://example.test',
    );
    assert.equal(fixture.completions(), 0);

    fixture.methods.commitSourceEntry('sources', {
        ...event,
        isComposing: false,
    });
    assert.equal(prevented, 1);
    assert.equal(fixture.state.sourceEntryValues.sources, '');
    assert.equal(fixture.completions(), 1);
});

test('removing one source retains other sources and unfinished typing', () => {
    const fixture = createFixture({
        sources: 'https://first.test\nhttps://second.test',
    });
    fixture.methods.updateSourceEntry('sources', 'https://draft.test');
    fixture.methods.removeSourceUrl('sources', 'https://first.test');
    assert.equal(
        fixture.values.sources,
        'https://second.test\nhttps://draft.test',
    );
    assert.deepEqual(fixture.methods.getSourceUrls('sources'), [
        'https://second.test',
    ]);
    assert.equal(fixture.state.sourceEntryValues.sources, 'https://draft.test');
});

test('source links preserve saved non-URL text without allowing executable hrefs', () => {
    const fixture = createFixture({
        sources:
            'javascript:alert(1)\nretained draft source\nhttps://example.test/a',
    });
    assert.deepEqual(fixture.methods.getSourceUrls('sources'), [
        'javascript:alert(1)',
        'retained draft source',
        'https://example.test/a',
    ]);
    assert.equal(
        fixture.methods.getSourceUrlHref('https://example.test/a'),
        'https://example.test/a',
    );
    for (const url of [
        'javascript:alert(1)',
        'data:text/html,test',
        '//example.test',
        'https://',
        'https://example.test/ two',
    ])
        assert.equal(fixture.methods.getSourceUrlHref(url), undefined);
});

test('reset and disposal discard entry state without replacing persisted sources', () => {
    const fixture = createFixture({ sources: 'https://saved.test' });
    fixture.methods.updateSourceEntry('sources', 'https://draft.test');
    fixture.reset();
    assert.deepEqual(fixture.state.sourceEntryValues, {});
    fixture.methods.commitSourceEntry('sources');
    assert.equal(
        fixture.values.sources,
        'https://saved.test\nhttps://draft.test',
    );
    fixture.methods.updateSourceEntry('sources', 'https://another.test');
    fixture.dispose();
    const persisted = fixture.values.sources;
    fixture.methods.updateSourceEntry('sources', 'https://late.test');
    fixture.methods.commitSourceEntry('sources');
    fixture.methods.removeSourceUrl('sources', 'https://saved.test');
    assert.equal(fixture.values.sources, persisted);
    assert.deepEqual(fixture.state.sourceEntryValues, {});
});

test('replaced source values and removed name owners cannot receive an old entry', () => {
    const fixture = createFixture({ 'name:localized:1': '' });
    const key = 'name:localized:1';
    fixture.methods.updateSourceEntry(key, 'https://old.test');
    fixture.values[key] = 'https://restored.test';
    fixture.methods.commitSourceEntry(key);
    assert.equal(fixture.values[key], 'https://restored.test');
    assert.deepEqual(fixture.state.sourceEntryValues, {});
    fixture.methods.updateSourceEntry(key, 'https://later.test');
    delete fixture.values[key];
    fixture.methods.commitSourceEntry(key);
    assert.equal(fixture.values[key], undefined);
    assert.deepEqual(fixture.state.sourceEntryValues, {});
});
