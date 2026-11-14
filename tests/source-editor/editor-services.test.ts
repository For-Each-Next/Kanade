/**
 * @file tests/source-editor/editor-services.test.ts
 * Purpose: tests / editor services.test module.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 * 3. dependencies
 * 4. namespaceState
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createEditorServices } from '../../src/source-editor/app/editor-services.ts';
import type { EditorServiceDependencies } from '../../src/source-editor/app/service-ports.ts';
import { createDefaultFormatterSettings } from '../../src/source-editor/domain/formatter-settings.ts';
import type { WikiNamespaceState } from '../../src/source-editor/domain/wiki-site.ts';
import { createLogger } from '../../src/library/logging/logger.ts';
import { decodeNamespaceCatalog } from '../../src/library/wiki-titles/canonical.ts';

test('service creation stays offline until a formatting action requests redirects', async () => {
    const state = namespaceState();
    let requests = 0;
    const services = createEditorServices(
        dependencies({
            namespaces: {
                async load() {
                    requests += 1;
                    return state;
                },
            },
        }),
    );
    assert.equal(requests, 0);
    await services.resolveRedirects('[[Old]]', { includeTemplates: false });
    assert.equal(requests, 1);
});

test('redirect resolution skips the network until namespace semantics are known', async () => {
    const state = namespaceState({ redirectsSafe: false });
    const services = createEditorServices(
        dependencies({
            namespaces: { load: async () => state },
            lookupLinks: async () =>
                assert.fail('An unsafe site must not query redirects'),
        }),
    );
    const source = '[[Old]] {{Old}}';

    assert.equal(
        await services.resolveRedirects(source, { includeTemplates: true }),
        source,
    );
});

test('missing magic words disable template rewrites while article redirects still work', async () => {
    const state = namespaceState({
        templateMagicWords: null,
        templateRedirectsSafe: false,
    });
    const requested: string[][] = [];
    const services = createEditorServices(
        dependencies({
            namespaces: { load: async () => state },
            async lookupLinks(titles) {
                requested.push(titles);
                return {
                    missing: new Set(),
                    missingLinkClasses: [],
                    redirects: new Map([
                        ['Old', 'New'],
                        ['Template:Old', 'Template:New'],
                    ]),
                };
            },
        }),
    );

    assert.equal(
        await services.resolveRedirects('[[Old]] {{Old}}', {
            includeTemplates: true,
        }),
        '[[New|Old]] {{Old}}',
    );
    assert.deepEqual(requested, [['Old']]);
});

test('loaded site syntax enables requested template redirects without changing protected text', async () => {
    const loaded = namespaceState();
    const requested: string[][] = [];
    const services = createEditorServices(
        dependencies({
            namespaces: { load: async () => loaded },
            async lookupLinks(titles) {
                requested.push(titles);
                return {
                    missing: new Set(),
                    missingLinkClasses: [],
                    redirects: new Map([
                        ['Old', 'New'],
                        ['Template:Old', 'Template:New'],
                    ]),
                };
            },
        }),
    );

    assert.equal(
        await services.resolveRedirects(
            '[[Old]] {{Old}} <!-- {{Old}} --><nowiki>[[Old]]</nowiki>',
            { includeTemplates: true },
        ),
        '[[New|Old]] {{New}} <!-- {{Old}} --><nowiki>[[Old]]</nowiki>',
    );
    assert.deepEqual(requested, [['Old', 'Template:Old']]);
});

test('redirect lookup failures propagate while accepted settings remain available', async () => {
    const failure = new Error('offline');
    const services = createEditorServices(
        dependencies({
            lookupLinks: async () => {
                throw failure;
            },
        }),
    );
    const settings = createDefaultFormatterSettings();
    settings.resolveRedirects = true;
    services.applyFormatterSettings?.(settings);
    await assert.rejects(
        services.resolveRedirects('[[Old]]', { includeTemplates: false }),
        (error) => error === failure,
    );
    assert.deepEqual(services.loadFormatterSettings(), settings);
});

test('resetting settings deletes saved configuration and propagates storage failures', () => {
    let clearCalls = 0;
    const failure = new Error('Storage is unavailable');
    const services = createEditorServices(
        dependencies({
            settings: {
                clear() {
                    clearCalls += 1;
                    if (clearCalls > 1) {
                        throw failure;
                    }
                },
                load: createDefaultFormatterSettings,
                save() {
                    assert.fail(
                        'Reset must delete saved settings, not save defaults',
                    );
                },
            },
        }),
    );

    services.resetFormatterSettings();
    assert.equal(clearCalls, 1);
    assert.throws(() => services.resetFormatterSettings(), failure);
    assert.equal(clearCalls, 2);
});

function dependencies(
    overrides: Partial<EditorServiceDependencies> = {},
): EditorServiceDependencies {
    const state = namespaceState();
    const logger = createLogger('test', { level: 'silent' });
    return {
        databaseName: 'enwiki',
        namespaces: { load: async () => state },
        settings: {
            clear() {},
            load: createDefaultFormatterSettings,
            save() {},
        },
        logger,
        uiLogger: logger,
        notify() {},
        isSectionEditing: () => false,
        lookupLinks: async () => ({
            missing: new Set(),
            missingLinkClasses: [],
            redirects: new Map(),
        }),
        ...overrides,
    };
}

function namespaceState(
    overrides: Partial<WikiNamespaceState> = {},
): WikiNamespaceState {
    const aliases = {
        caseInsensitive: new Set<string>(),
        caseSensitive: new Set<string>(),
    };
    return {
        source: decodeNamespaceCatalog('enwiki', {
            query: {
                namespacealiases: [],
                namespaces: {
                    0: { id: 0, name: '' },
                    6: { canonical: 'File', id: 6, name: 'File' },
                    10: { canonical: 'Template', id: 10, name: 'Template' },
                    14: { canonical: 'Category', id: 14, name: 'Category' },
                },
            },
        }),
        redirectsSafe: true,
        templateRedirectsSafe: true,
        templateMagicWords: {
            functions: aliases,
            invoke: aliases,
            variables: aliases,
            modifiers: {
                message: aliases,
                raw: aliases,
                substitution: aliases,
            },
        },
        ...overrides,
    };
}
