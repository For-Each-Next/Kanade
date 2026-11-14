/**
 * @file tests/source-editor/formatter-editor.test.ts
 * Purpose: Verify formatter compatibility with MediaWiki-owned editors and native preferences.
 * Contents: Live CodeMirror reads, selection transactions, undo, toggles, and composition guards.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
    JSDOM: new (html: string) => { window: Window & typeof globalThis };
};
import { getFormatterEditor } from '../../src/source-editor/platform/mediawiki/formatter-editor.ts';
import type { CodeMirrorEditor } from '../../src/library/mediawiki-edit-box/contracts.ts';
import { createFormatterActions } from '../../src/source-editor/app/formatter.ts';
import { createDefaultFormatterSettings } from '../../src/source-editor/domain/formatter-settings.ts';
import { resolveWikiPolicy } from '../../src/source-editor/domain/wiki-policy.ts';
import { createLogger } from '../../src/library/logging/logger.ts';
import type { EditorServices } from '../../src/source-editor/app/editor-contracts.ts';

// One host lifetime per process: the real MediaWiki hooks remember and replay ready instances.
test('formatter follows native CodeMirror without enabling it or changing preferences', async (t) => {
    const dom = new JSDOM('<textarea id="wpTextbox1"></textarea>');
    const textarea = dom.window.document.querySelector('textarea')!;
    const keys = [
        'window',
        'document',
        'HTMLTextAreaElement',
        'mw',
        'Event',
    ] as const;
    const previous = new Map(
        keys.map((key) => [
            key,
            Object.getOwnPropertyDescriptor(globalThis, key),
        ]),
    );
    const hooks = new Map<string, ((...args: any[]) => void)[]>();
    const settings: Record<string, string> = { wgPageName: 'Sandbox' };
    const host = {
        config: { get: (key: string) => settings[key] },
        hook(name: string) {
            return {
                add(callback: (...args: any[]) => void) {
                    hooks.set(name, [...(hooks.get(name) ?? []), callback]);
                },
            };
        },
    };
    for (const [key, value] of Object.entries({
        window: dom.window,
        document: dom.window.document,
        HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
        Event: dom.window.Event,
        mw: host,
    })) {
        Object.defineProperty(globalThis, key, {
            configurable: true,
            writable: true,
            value,
        });
    }
    t.after(() => {
        dom.window.close();
        for (const [key, descriptor] of previous) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
    });
    const fire = (name: string, ...args: unknown[]) => {
        for (const callback of hooks.get(name) ?? []) callback(...args);
    };
    textarea.value = '[[ Native ]]';
    const native = getFormatterEditor(textarea);
    assert.equal(native.read(), textarea.value);
    textarea.dispatchEvent(new dom.window.Event('compositionstart'));
    assert.throws(() => native.replace(0, 1, 'bad'));
    assert.equal(textarea.value, '[[ Native ]]');
    textarea.dispatchEvent(new dom.window.Event('compositionend'));
    native.replace(0, textarea.value.length, 'Native');
    assert.equal(textarea.value, 'Native');

    let source = '[[ Selected ]]\n[[ Untouched ]]';
    let selection = { from: 0, to: '[[ Selected ]]'.length };
    const history: { source: string; selection: typeof selection }[] = [];
    let focused = false;
    let transactionCount = 0;
    const state = () => ({
        doc: { length: source.length, toString: () => source },
        selection: { main: { ...selection } },
    });
    const cm: CodeMirrorEditor = {
        textarea,
        isActive: true,
        view: {
            composing: false,
            state: state(),
            focus: () => {
                focused = true;
            },
        },
    };
    cm.view!.dispatch = (transaction) => {
        history.push({ source, selection });
        transactionCount += 1;
        source =
            source.slice(0, transaction.changes.from) +
            transaction.changes.insert +
            source.slice(transaction.changes.to);
        if (transaction.selection)
            selection = {
                from: transaction.selection.anchor,
                to: transaction.selection.head ?? transaction.selection.anchor,
            };
        cm.view!.state = state();
    };
    fire('ext.CodeMirror.ready', cm);
    const active = getFormatterEditor(textarea);
    assert.notEqual(active, native);
    assert.equal(native.isAttached(), false);
    assert.equal(
        active.read(),
        source,
        'never reads the stale hidden textarea',
    );
    assert.deepEqual(active.getSelection(), {
        start: selection.from,
        end: selection.to,
    });
    const notifications: string[] = [];
    const services: EditorServices = {
        wikiPolicy: resolveWikiPolicy(''),
        logger: createLogger('formatter-test', { level: 'silent' }),
        notify: (value) => {
            notifications.push(value.type);
        },
        isSectionEditing: () => false,
        loadFormatterSettings: createDefaultFormatterSettings,
        resetFormatterSettings() {},
        saveFormatterSettings() {},
        resolveRedirects: async (value) => value,
    };
    await createFormatterActions(services, getFormatterEditor).format();
    assert.equal(source, '[[Selected]]\n[[ Untouched ]]');
    assert.equal(
        transactionCount,
        1,
        'format is one undoable host transaction',
    );
    assert.equal(
        textarea.value,
        'Native',
        'host owns textarea synchronization',
    );
    assert.equal(focused, true);
    assert.deepEqual(selection, { from: 0, to: '[[Selected]]'.length });
    const undo = history.pop()!;
    source = undo.source;
    selection = undo.selection;
    cm.view!.state = state();
    assert.equal(source, '[[ Selected ]]\n[[ Untouched ]]');
    cm.view!.composing = true;
    await createFormatterActions(services, getFormatterEditor).format();
    assert.equal(transactionCount, 1);
    assert.equal(notifications.at(-1), 'error');
    cm.view!.composing = false;

    // Reject superseded work even when a host undo returns to identical source and selection.
    const saved = createDefaultFormatterSettings();
    saved.resolveRedirects = true;
    services.loadFormatterSettings = () => saved;
    let finish!: (value: string) => void;
    services.resolveRedirects = () =>
        new Promise((resolve) => {
            finish = resolve;
        });
    const pending = createFormatterActions(
        services,
        getFormatterEditor,
    ).format();
    cm.view!.state = state();
    finish('[[Selected]]');
    await pending;
    assert.equal(transactionCount, 1);
    assert.equal(notifications.at(-1), 'error');

    fire('ext.CodeMirror.toggle', false, cm);
    const fallback = getFormatterEditor(textarea);
    assert.notEqual(fallback, active);
    assert.equal(active.isAttached(), false);
    assert.equal(fallback.read(), 'Native');
    assert.throws(() => active.replace(0, 1, 'bad'));
    fire('ext.CodeMirror.toggle', true, cm);
    assert.equal(getFormatterEditor(textarea).read(), source);
    fire('ext.CodeMirror.destroy', textarea);
    assert.equal(getFormatterEditor(textarea).read(), 'Native');
    assert.deepEqual(
        [...hooks.keys()],
        [
            'ext.CodeMirror.ready',
            'ext.CodeMirror.toggle',
            'ext.CodeMirror.destroy',
        ],
    );
    assert.equal(dom.window.document.querySelector('iframe'), null);
});
