/**
 * @file tests/source-editor/formatter-settings.test.ts
 * Purpose: Verify shared Source Editor preference persistence, schema migration, validation, and storage failures.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 * 3. createInvalidSettings
 * 4. createConfiguredSettings
 * 5. MemorySettingsStorage
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createFormatterSettingsStore,
    FORMATTER_SETTINGS_SCHEMA_VERSION,
    FORMATTER_SETTINGS_STORAGE_KEY,
} from '../../src/source-editor/platform/browser/formatter-settings.ts';
import {
    createDefaultFormatterSettings,
    type FormatterSettings,
} from '../../src/source-editor/domain/formatter-settings.ts';

test('formatter settings round trip through local storage', () => {
    const storage = new MemorySettingsStorage();
    const store = createFormatterSettingsStore(() => storage);
    const settings = createConfiguredSettings();

    assert.deepEqual(store.load(), createDefaultFormatterSettings());
    assert.equal(store.load().formatter.formatHtmlTags, false);
    store.save(settings);

    assert.deepEqual(store.load(), settings);
    assert.deepEqual(
        JSON.parse(storage.getItem(FORMATTER_SETTINGS_STORAGE_KEY) ?? ''),
        { schemaVersion: FORMATTER_SETTINGS_SCHEMA_VERSION, settings },
    );
});

test('unversioned preferences are ignored without importing or deleting browser records', () => {
    const serialized = JSON.stringify(createConfiguredSettings());
    const storage = new MemorySettingsStorage(serialized);
    storage.setItem('retired-tool.settings', serialized);
    const store = createFormatterSettingsStore(() => storage);
    assert.deepEqual(store.load(), createDefaultFormatterSettings());
    assert.equal(storage.getItem(FORMATTER_SETTINGS_STORAGE_KEY), serialized);
    store.clear();
    assert.equal(storage.getItem('retired-tool.settings'), serialized);
});

test('unknown saved schemas and malformed envelopes use defaults without overwriting them', () => {
    for (const value of [
        { schemaVersion: 2, settings: createConfiguredSettings() },
        { schemaVersion: '1', settings: createConfiguredSettings() },
        { schemaVersion: 1 },
        { schemaVersion: 1, settings: null },
        { schemaVersion: 1, settings: [] },
    ]) {
        const serialized = JSON.stringify(value);
        const storage = new MemorySettingsStorage(serialized);
        const store = createFormatterSettingsStore(() => storage);

        assert.deepEqual(store.load(), createDefaultFormatterSettings());
        assert.equal(
            storage.getItem(FORMATTER_SETTINGS_STORAGE_KEY),
            serialized,
        );
    }
});

test('all script-title choices round trip without saving source or session values', () => {
    const storage = new MemorySettingsStorage();
    const store = createFormatterSettingsStore(() => storage);
    for (const scriptTitleMode of [
        'non-latin',
        'all-foreign',
        'always',
    ] as const) {
        const settings = createConfiguredSettings();
        settings.citationFormatting.scriptTitleMode = scriptTitleMode;
        store.save({
            ...settings,
            source: 'unsaved article',
            draft: 'unsaved citation',
        } as FormatterSettings);
        assert.deepEqual(store.load(), settings);
        const serialized =
            storage.getItem(FORMATTER_SETTINGS_STORAGE_KEY) ?? '';
        assert.doesNotMatch(serialized, /unsaved article|unsaved citation/u);
        const loaded = store.load();
        loaded.citationFormatting.layout = 'inline';
        assert.equal(store.load().citationFormatting.layout, 'block');
    }
});

test('invalid citation preferences are rejected without replacing saved settings', () => {
    const storage = new MemorySettingsStorage();
    const store = createFormatterSettingsStore(() => storage);
    const valid = createConfiguredSettings();
    store.save(valid);
    const before = storage.getItem(FORMATTER_SETTINGS_STORAGE_KEY);
    for (const citationFormatting of [
        null,
        [],
        {},
        ...[
            { enabled: 'yes' },
            { convertAuthorNames: 'yes' },
            { convertAuthorNames: null },
            { layout: 'table' },
            { compactReferences: 1 },
            { separateReferenceDefinitions: null },
            { formatScriptTitles: 'true' },
            { scriptTitleMode: 'unknown' },
        ].map((changes) => ({ ...valid.citationFormatting, ...changes })),
    ]) {
        assert.throws(
            () =>
                store.save({
                    ...valid,
                    citationFormatting,
                } as FormatterSettings),
            /invalid/u,
        );
        assert.equal(storage.getItem(FORMATTER_SETTINGS_STORAGE_KEY), before);
    }
});

test('failed preference writes retain the previously saved configuration', () => {
    const storage = new MemorySettingsStorage();
    const store = createFormatterSettingsStore(() => storage);
    const settings = createConfiguredSettings();
    store.save(settings);
    storage.setItem = () => {
        throw new Error('storage write denied');
    };
    assert.throws(
        () => store.save(createDefaultFormatterSettings()),
        /write denied/u,
    );
    assert.deepEqual(store.load(), settings);
});

test('clearing saved settings restores defaults and preserves unrelated data', () => {
    const storage = new MemorySettingsStorage();
    const store = createFormatterSettingsStore(() => storage);
    storage.setItem('another-gadget.settings', 'keep this value');
    store.save(createConfiguredSettings());

    store.clear();

    assert.equal(storage.getItem(FORMATTER_SETTINGS_STORAGE_KEY), null);
    assert.deepEqual(store.load(), createDefaultFormatterSettings());
    assert.equal(storage.getItem('another-gadget.settings'), 'keep this value');
    assert.doesNotThrow(() => store.clear());
});

test('failed removal propagates its error and retains saved settings', () => {
    const failure = new Error('removal denied');
    const settings = createConfiguredSettings();
    const storage = new MemorySettingsStorage(serializeSettings(settings));
    storage.removeItem = () => {
        throw failure;
    };
    const store = createFormatterSettingsStore(() => storage);

    assert.throws(
        () => store.clear(),
        (error) => error === failure,
    );
    assert.deepEqual(store.load(), settings);
});

test('indentation widths including zero and larger values round trip', () => {
    const storage = new MemorySettingsStorage();
    const store = createFormatterSettingsStore(() => storage);

    for (const indentSpaces of [0, 2, 5, 12]) {
        const settings = createConfiguredSettings();
        settings.formatter.indentSpaces = indentSpaces;
        store.save(settings);

        assert.deepEqual(store.load(), settings);
    }
});

test('saving invalid indentation widths fails validation', () => {
    const storage = new MemorySettingsStorage();
    const store = createFormatterSettingsStore(() => storage);

    for (const indentSpaces of [
        -1,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.MAX_SAFE_INTEGER + 1,
    ]) {
        const settings = createConfiguredSettings();
        settings.formatter.indentSpaces = indentSpaces;

        assert.throws(() => store.save(settings), /invalid/u);
    }
    assert.equal(storage.getItem(FORMATTER_SETTINGS_STORAGE_KEY), null);
});

test('saving an incomplete configuration fails validation', () => {
    const storage = new MemorySettingsStorage();
    const store = createFormatterSettingsStore(() => storage);
    const settings = createConfiguredSettings();
    delete settings.formatter.skipFirstLevelIndentation;

    assert.throws(() => store.save(settings), /invalid/u);
    assert.equal(storage.getItem(FORMATTER_SETTINGS_STORAGE_KEY), null);
});

test('old v1 settings preserve formatter choices and discard retired editor preferences', () => {
    const settings = createConfiguredSettings();
    const stored = {
        ...settings,
        syntaxHighlighting: false,
        ctrlClickLinks: 'retired',
        linkPreviews: true,
        referenceEditing: false,
        useCodeMirrorForOtherModels: true,
    };
    const serialized = serializeSettings(stored);
    const storage = new MemorySettingsStorage(serialized);
    const store = createFormatterSettingsStore(() => storage);

    assert.deepEqual(store.load(), settings);
    assert.equal(storage.getItem(FORMATTER_SETTINGS_STORAGE_KEY), serialized);
    store.save(store.load());
    assert.deepEqual(
        JSON.parse(storage.getItem(FORMATTER_SETTINGS_STORAGE_KEY) ?? ''),
        {
            schemaVersion: 1,
            settings,
        },
    );
});

test('older citation settings keep author conversion disabled', () => {
    const settings = createConfiguredSettings();
    const stored = {
        ...settings,
        citationFormatting: { ...settings.citationFormatting },
    };
    delete (
        stored.citationFormatting as Partial<
            FormatterSettings['citationFormatting']
        >
    ).convertAuthorNames;
    const store = createFormatterSettingsStore(
        () => new MemorySettingsStorage(serializeSettings(stored)),
    );
    assert.deepEqual(store.load(), {
        ...settings,
        citationFormatting: {
            ...settings.citationFormatting,
            convertAuthorNames: false,
        },
    });
});

test('older settings retain their choices without formatting HTML tags', () => {
    const stored: Omit<FormatterSettings, 'formatter'> & {
        formatter: Partial<FormatterSettings['formatter']>;
    } = createConfiguredSettings();
    delete stored.formatter.formatHtmlTags;
    const store = createFormatterSettingsStore(
        () => new MemorySettingsStorage(serializeSettings(stored)),
    );

    assert.deepEqual(store.load(), {
        ...stored,
        formatter: { ...stored.formatter, formatHtmlTags: false },
    });
});

test('invalid stored settings fall back to defaults', () => {
    const invalidValues = [
        '{broken',
        ...createInvalidSettings().map(serializeSettings),
    ];

    for (const serialized of invalidValues) {
        const storage = new MemorySettingsStorage(serialized);
        const store = createFormatterSettingsStore(() => storage);

        assert.deepEqual(store.load(), createDefaultFormatterSettings());
    }
});

function createInvalidSettings(): unknown[] {
    const valid = createConfiguredSettings();
    return [
        { ...valid, formatter: { ...valid.formatter, formatHtmlTags: 'yes' } },
        { ...valid, formatter: { ...valid.formatter, formatHtmlTags: null } },
        { ...valid, resolveRedirects: 'yes' },
        { ...valid, resolveTemplateRedirects: null },
        {
            ...valid,
            formatter: { ...valid.formatter, indentSpaces: -1 },
        },
        {
            ...valid,
            formatter: { ...valid.formatter, indentSpaces: 1.5 },
        },
        {
            ...valid,
            formatter: {
                ...valid.formatter,
                indentSpaces: Number.MAX_SAFE_INTEGER + 1,
            },
        },
        {
            ...valid,
            formatter: {
                ...valid.formatter,
                subsequentParameterLayout: 'unknown',
            },
        },
        {
            ...valid,
            formatter: {
                ...valid.formatter,
                skipFirstLevelIndentation: undefined,
            },
        },
    ];
}

test('unavailable storage never blocks formatter defaults', () => {
    const unavailable = createFormatterSettingsStore(() => undefined);
    const inaccessible = createFormatterSettingsStore(() => {
        throw new Error('storage denied');
    });

    assert.deepEqual(unavailable.load(), createDefaultFormatterSettings());
    assert.deepEqual(inaccessible.load(), createDefaultFormatterSettings());
    assert.throws(
        () => unavailable.save(createDefaultFormatterSettings()),
        /unavailable/u,
    );
    assert.throws(
        () => inaccessible.save(createDefaultFormatterSettings()),
        /storage denied/u,
    );
    assert.throws(() => unavailable.clear(), /unavailable/u);
    assert.throws(() => inaccessible.clear(), /storage denied/u);
});

function createConfiguredSettings(): FormatterSettings {
    return {
        citationFormatting: {
            enabled: true,
            convertAuthorNames: true,
            layout: 'block',
            compactReferences: true,
            separateReferenceDefinitions: true,
            formatScriptTitles: true,
            scriptTitleMode: 'all-foreign',
        },
        formatter: {
            characterWidthRatio: '2:1',
            firstParameterLayout: 'compact',
            formatFirstParameter: true,
            formatHtmlTags: true,
            formatSubsequentParameters: true,
            indentBlockTemplates: true,
            indentSpaces: 4,
            normalizeConversion: true,
            skipFirstLevelIndentation: true,
            subsequentParameterLayout: 'align-names-and-values',
        },
        resolveRedirects: true,
        resolveTemplateRedirects: true,
    };
}

class MemorySettingsStorage {
    private readonly values = new Map<string, string>();

    constructor(value: string | null = null) {
        if (value != null) {
            this.values.set(FORMATTER_SETTINGS_STORAGE_KEY, value);
        }
    }

    getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    removeItem(key: string): void {
        this.values.delete(key);
    }

    setItem(key: string, value: string): void {
        this.values.set(key, value);
    }
}

function serializeSettings(settings: unknown): string {
    return JSON.stringify({ schemaVersion: 1, settings });
}
