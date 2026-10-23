/**
 * @file tests/source-editor/formatter-open.test.ts
 * Purpose: Formatter dialog ownership and direct-format settings, writes, and async guards.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 * 3. reportFormatterLoadFailure
 * 4. createServices
 * 5. installFormatterEnvironment
 * 6. installFormatterGlobals
 * 7. captureGlobals
 * 8. restoreGlobals
 * 9. createLogOutput
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveWikiPolicy } from '../../src/source-editor/domain/wiki-policy.ts';

import {
    createLogger,
    type LogOutput,
} from '../../src/library/logging/logger.ts';

import type { ActionNotification } from '../../src/library/notifications/contracts.ts';
import type { EditorServices } from '../../src/source-editor/app/editor-contracts.ts';

import {
    createDefaultFormatterSettings,
    getEditorFeatureSettings,
    type FormatterSettings,
} from '../../src/source-editor/domain/formatter-settings.ts';
import type { createFormatterDialogBindings } from '../../src/source-editor/features/formatter/dialog.ts';
import { createFormatterActions } from '../../src/source-editor/app/formatter.ts';

test(
    'reports rejected formatter dialog loads through injected ports',
    reportFormatterLoadFailure,
);

test('Source Editor opens references when VisualEditor source mode replaces the native textarea', async () => {
    const errors: unknown[][] = [];
    const notifications: ActionNotification[] = [];
    const modules: string[][] = [];
    const restore = installFormatterEnvironment(modules);
    const services = createServices(errors, notifications);
    let referencesOpened = 0;
    services.openReferences = async () => {
        referencesOpened += 1;
    };
    try {
        document.getElementById = () => null;
        await createFormatterActions(services, () => undefined).open();
        assert.equal(referencesOpened, 1);
        assert.deepEqual(modules, []);
        assert.deepEqual(notifications, []);
        assert.deepEqual(errors, []);
    } finally {
        restore();
    }
});

test('Source Editor handles a rejected source-mode references load without an unhandled rejection', async () => {
    const errors: unknown[][] = [];
    const notifications: ActionNotification[] = [];
    const restore = installFormatterEnvironment([]);
    const services = createServices(errors, notifications);
    services.openReferences = async () => {
        throw new Error('References unavailable');
    };
    try {
        document.getElementById = () => null;
        await assert.doesNotReject(
            createFormatterActions(services, () => undefined).open,
        );
        assert.equal(errors.length, 1);
        assert.match(String(errors[0]?.[0]), /references\.open\.failed/u);
    } finally {
        restore();
    }
});

test('equal formatter loads share the runtime while only the latest owner mounts or reports failure', async () => {
    const errors: unknown[][] = [];
    const notifications: ActionNotification[] = [];
    const requests: Array<{
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
    }> = [];
    const restore = installFormatterEnvironment(
        [],
        () =>
            new Promise((resolve, reject) => {
                requests.push({ resolve, reject });
            }),
    );
    const openFormatter = createFormatterActions(
        createServices(errors, notifications),
        () => undefined,
    ).open;

    try {
        const first = openFormatter();
        const second = openFormatter();
        const third = openFormatter();
        assert.equal(requests.length, 1);
        requests[0]!.reject(new Error('Shared runtime failed'));
        await Promise.all([first, second, third]);
        assert.equal(errors.length, 1);
        assert.equal(notifications.length, 1);

        const rendered: FormatterDialogBindings[] = [];
        const retry = openFormatter();
        const latest = openFormatter();
        assert.equal(requests.length, 2);
        requests[1]!.resolve(createDialogRuntime(rendered));
        await Promise.all([retry, latest]);
        assert.equal(rendered.length, 1);
        rendered[0]!.onClose();
        assert.equal(errors.length, 1);
        assert.equal(notifications.length, 1);
    } finally {
        restore();
    }
});

test('accepted citation and editor settings are restored when reopening the panel', async () => {
    const errors: unknown[][] = [];
    const notifications: ActionNotification[] = [];
    const rendered: FormatterDialogBindings[] = [];
    const restore = installFormatterEnvironment([], async () =>
        createDialogRuntime(rendered),
    );
    const services = createServices(errors, notifications);
    const accepted: FormatterSettings[] = [];
    Object.defineProperty(services, 'contentLanguage', { value: 'zh-Hant' });
    const persisted: FormatterSettings[] = [];
    services.applyFormatterSettings = (settings) => {
        accepted.push(structuredClone(settings));
    };
    services.saveFormatterSettings = (settings) => {
        persisted.push(structuredClone(settings));
    };
    const openFormatter = createFormatterActions(
        services,
        () => undefined,
    ).open;
    try {
        mw.config.get = ((key: string) =>
            key === 'wgContentLanguage'
                ? 'zh-Hant'
                : key === 'wgUserLanguage'
                  ? 'en'
                  : undefined) as typeof mw.config.get;
        await openFormatter();
        const first = rendered[0];
        assert.equal(
            first.scriptTitleExampleLanguages('all-foreign'),
            'en, ja, ru',
        );
        first.activeTab.value = 'editor';
        first.largeFont.value = true;
        first.formatReferences.value = true;
        first.referenceLayout.value = 'block';
        first.compactReferences.value = true;
        first.separateReferenceDefinitions.value = true;
        first.formatScriptTitles.value = false;
        first.scriptTitleMode.value = 'always';
        await first.apply();
        first.onClose();
        assert.equal(accepted.length, 1);
        assert.equal(accepted[0].largeFont, true);
        assert.deepEqual(accepted[0].citationFormatting, {
            enabled: true,
            layout: 'block',
            compactReferences: true,
            separateReferenceDefinitions: true,
            formatScriptTitles: false,
            scriptTitleMode: 'always',
        });
        assert.deepEqual(persisted, []);

        await openFormatter();
        const second = rendered[1];
        assert.equal(second.largeFont.value, true);
        assert.equal(second.formatReferences.value, true);
        assert.equal(second.referenceLayout.value, 'block');
        assert.equal(second.compactReferences.value, true);
        assert.equal(second.separateReferenceDefinitions.value, true);
        assert.equal(second.formatScriptTitles.value, false);
        assert.equal(second.scriptTitleMode.value, 'always');
        second.largeFont.value = false;
        second.scriptTitleMode.value = 'non-latin';
        second.onClose();
        assert.equal(accepted.length, 1);
        await openFormatter();
        assert.equal(rendered[2].largeFont.value, true);
        assert.equal(rendered[2].scriptTitleMode.value, 'always');
        rendered[2].onClose();
        assert.deepEqual(errors, []);
    } finally {
        restore();
    }
});

test('saving a panel draft persists every group without accepting it in memory', async () => {
    const errors: unknown[][] = [];
    const rendered: FormatterDialogBindings[] = [];
    const restore = installFormatterEnvironment([], async () =>
        createDialogRuntime(rendered),
    );
    const services = createServices(errors, []);
    const accepted: FormatterSettings[] = [];
    const persisted: FormatterSettings[] = [];
    let stored = createDefaultFormatterSettings();
    services.loadFormatterSettings = () => structuredClone(stored);
    services.applyFormatterSettings = (settings) => {
        accepted.push(structuredClone(settings));
    };
    services.saveFormatterSettings = (settings) => {
        stored = structuredClone(settings);
        persisted.push(stored);
    };
    const openFormatter = createFormatterActions(
        services,
        () => undefined,
    ).open;
    try {
        await openFormatter();
        const first = rendered[0];
        first.largeFont.value = true;
        first.formatHtmlTags.value = true;
        first.formatReferences.value = true;
        first.referenceLayout.value = 'block';
        first.scriptTitleMode.value = 'all-foreign';
        await first.saveSettings();
        assert.equal(first.open.value, true);
        assert.deepEqual(accepted, []);
        assert.equal(persisted.length, 1);
        assert.equal(persisted[0].largeFont, true);
        assert.equal(persisted[0].formatter.formatHtmlTags, true);
        assert.equal(persisted[0].citationFormatting.layout, 'block');
        assert.equal(
            persisted[0].citationFormatting.scriptTitleMode,
            'all-foreign',
        );
        first.largeFont.value = false;
        first.scriptTitleMode.value = 'always';
        first.onClose();
        assert.deepEqual(accepted, []);
        await openFormatter();
        assert.equal(rendered[1].largeFont.value, true);
        assert.equal(rendered[1].formatHtmlTags.value, true);
        assert.equal(rendered[1].referenceLayout.value, 'block');
        assert.equal(rendered[1].scriptTitleMode.value, 'all-foreign');
        rendered[1].onClose();
        assert.deepEqual(errors, []);
    } finally {
        restore();
    }
});

test('opening references carries the accepted shared settings into its workflow', async () => {
    const errors: unknown[][] = [];
    const rendered: FormatterDialogBindings[] = [];
    const restore = installFormatterEnvironment([], async () =>
        createDialogRuntime(rendered),
    );
    const services = createServices(errors, []);
    const accepted: FormatterSettings[] = [];
    const handedOff: FormatterSettings[] = [];
    let opened = 0;
    services.applyFormatterSettings = (settings) => {
        accepted.push(structuredClone(settings));
    };
    services.openReferences = async (settings) => {
        opened += 1;
        assert.ok(settings);
        handedOff.push(structuredClone(settings));
        assert.deepEqual(accepted, []);
        assert.equal(settings.citationFormatting.layout, 'block');
        assert.equal(settings.citationFormatting.scriptTitleMode, 'always');
    };
    try {
        await createFormatterActions(services, () => undefined).open();
        rendered[0].formatReferences.value = true;
        rendered[0].referenceLayout.value = 'block';
        rendered[0].scriptTitleMode.value = 'always';
        await rendered[0].openReferences();
        assert.equal(opened, 1);
        assert.equal(rendered[0].open.value, false);
        assert.equal(accepted.length, 1);
        assert.deepEqual(accepted, handedOff);
        assert.deepEqual(errors, []);
    } finally {
        restore();
    }
});

test('a rejected references workflow does not accept the panel draft', async () => {
    const errors: unknown[][] = [];
    const rendered: FormatterDialogBindings[] = [];
    const restore = installFormatterEnvironment([], async () =>
        createDialogRuntime(rendered),
    );
    const services = createServices(errors, []);
    const accepted: FormatterSettings[] = [];
    let opened = 0;
    services.applyFormatterSettings = (settings) => {
        accepted.push(structuredClone(settings));
    };
    services.openReferences = async () => {
        opened += 1;
        if (opened === 1) throw new Error('References unavailable');
    };
    try {
        await createFormatterActions(services, () => undefined).open();
        rendered[0].referenceLayout.value = 'block';
        rendered[0].scriptTitleMode.value = 'always';
        await rendered[0].openReferences();
        assert.equal(rendered[0].open.value, true);
        assert.equal(rendered[0].referenceLayout.value, 'block');
        assert.equal(rendered[0].scriptTitleMode.value, 'always');
        assert.equal(accepted.length, 0);
        assert.equal(errors.length, 1);
        await rendered[0].openReferences();
        assert.equal(rendered[0].open.value, false);
        assert.equal(accepted.length, 1);
        assert.equal(accepted[0].citationFormatting.scriptTitleMode, 'always');
    } finally {
        restore();
    }
});

test('the panel formats selected citations using the target content language', async () => {
    const errors: unknown[][] = [];
    const notifications: ActionNotification[] = [];
    const rendered: FormatterDialogBindings[] = [];
    const restore = installFormatterEnvironment([], async () =>
        createDialogRuntime(rendered),
    );
    const services = createServices(errors, notifications);
    const loadedSources: string[] = [];
    Object.defineProperty(services, 'contentLanguage', { value: 'zh-Hant' });
    services.loadCitationFormattingContext = async (source) => {
        loadedSources.push(source);
        return {};
    };
    const selected =
        '<ref>{{cite web|title=English title|language=en}}</ref>' +
        '<ref>{{cite web|title=中文標題|language=zh-Hant}}</ref>';
    const prefix = 'Before the selection\n';
    const suffix = '\nAfter the selection';
    const replacements: Array<{ start: number; end: number; value: string }> =
        [];
    try {
        const textarea = document.getElementById(
            'wpTextbox1',
        ) as HTMLTextAreaElement;
        textarea.value = `${prefix}${selected}${suffix}`;
        const range = {
            start: prefix.length,
            end: prefix.length + selected.length,
        };
        mw.config.get = ((key: string) =>
            ({
                wgWikiID: 'enwiki',
                wgContentLanguage: 'zh-Hant',
                wgUserLanguage: 'en',
            })[
                key as 'wgWikiID' | 'wgContentLanguage' | 'wgUserLanguage'
            ]) as typeof mw.config.get;
        await createFormatterActions(services, () => ({
            clearCache() {},
            getFeatureSettings: () =>
                getEditorFeatureSettings(createDefaultFormatterSettings()),
            getSelection: () => range,
            replace(start, end, value) {
                replacements.push({ start, end, value });
                textarea.value =
                    textarea.value.slice(0, start) +
                    value +
                    textarea.value.slice(end);
            },
            setFeatureSettings() {},
        })).open();
        rendered[0].formatReferences.value = true;
        rendered[0].scriptTitleMode.value = 'all-foreign';
        await rendered[0].apply();
        assert.deepEqual(loadedSources, [selected]);
        assert.equal(replacements.length, 1);
        assert.equal(replacements[0].start, range.start);
        assert.equal(replacements[0].end, range.end);
        assert.ok(textarea.value.startsWith(prefix));
        assert.ok(textarea.value.endsWith(suffix));
        assert.match(textarea.value, /script-title\s*=\s*en:English title/u);
        assert.match(textarea.value, /title\s*=\s*中文標題/u);
        assert.doesNotMatch(textarea.value, /script-title\s*=\s*zh:/u);
        assert.equal(rendered[0].open.value, false);
        assert.equal(notifications.at(-1)?.key, 'format-result');
        assert.deepEqual(errors, []);
    } finally {
        restore();
    }
});

test('citation metadata loading cannot overwrite source changed while formatting', async () => {
    const errors: unknown[][] = [];
    const rendered: FormatterDialogBindings[] = [];
    const restore = installFormatterEnvironment([], async () =>
        createDialogRuntime(rendered),
    );
    const services = createServices(errors, []);
    const accepted: FormatterSettings[] = [];
    let finish!: () => void;
    services.loadCitationFormattingContext = () =>
        new Promise((resolve) => {
            finish = () => resolve({});
        });
    services.applyFormatterSettings = (settings) => {
        accepted.push(settings);
    };
    try {
        const textarea = document.getElementById(
            'wpTextbox1',
        ) as HTMLTextAreaElement;
        textarea.value = '<ref>{{cite web|title=Original|language=ja}}</ref>';
        await createFormatterActions(services, () => undefined).open();
        rendered[0].formatReferences.value = true;
        rendered[0].referenceLayout.value = 'block';
        const applying = rendered[0].apply();
        textarea.value = 'User changed the article';
        finish();
        await applying;
        assert.equal(textarea.value, 'User changed the article');
        assert.equal(rendered[0].open.value, true);
        assert.equal(rendered[0].referenceLayout.value, 'block');
        assert.deepEqual(accepted, []);
        assert.equal(errors.length, 1);
        assert.ok(rendered[0].error.value);
        rendered[0].onClose();
    } finally {
        restore();
    }
});

test('direct formatting uses saved settings, then accepted session settings while discarding cancelled drafts', async () => {
    const errors: unknown[][] = [];
    const notifications: ActionNotification[] = [];
    const modules: string[][] = [];
    const rendered: FormatterDialogBindings[] = [];
    const restore = installFormatterEnvironment(modules, async () =>
        createDialogRuntime(rendered),
    );
    const services = createServices(errors, notifications);
    const saved = createDefaultFormatterSettings();
    saved.formatter.formatHtmlTags = true;
    services.loadFormatterSettings = () => structuredClone(saved);
    const persisted: FormatterSettings[] = [];
    services.saveFormatterSettings = (settings) => persisted.push(settings);
    const actions = createFormatterActions(services, () => undefined);
    const source = '< ref     name=222      /    >';
    try {
        const textarea = document.getElementById(
            'wpTextbox1',
        ) as HTMLTextAreaElement;
        textarea.value = source;
        await actions.format();
        assert.equal(textarea.value, '<ref name="222" />');
        assert.deepEqual(modules, []);
        assert.equal(rendered.length, 0);
        assert.equal(notifications.at(-1)?.type, 'success');

        await actions.open('editor');
        rendered[0].formatHtmlTags.value = false;
        await rendered[0].apply();
        textarea.value = source;
        await actions.format();
        assert.equal(textarea.value, source);
        assert.equal(notifications.at(-1)?.type, 'info');

        await actions.open();
        rendered[1].formatHtmlTags.value = true;
        rendered[1].onClose();
        await actions.format();
        assert.equal(textarea.value, source);
        assert.equal(saved.formatter.formatHtmlTags, true);
        assert.deepEqual(persisted, []);
        assert.deepEqual(errors, []);
    } finally {
        restore();
    }
});

test('duplicate direct clicks share one source change while citation metadata is pending', async () => {
    const errors: unknown[][] = [];
    const notifications: ActionNotification[] = [];
    const modules: string[][] = [];
    const restore = installFormatterEnvironment(modules);
    const services = createServices(errors, notifications);
    const settings = createDefaultFormatterSettings();
    settings.citationFormatting.enabled = true;
    services.loadFormatterSettings = () => settings;
    let requests = 0;
    let finish!: () => void;
    services.loadCitationFormattingContext = () => {
        requests += 1;
        return new Promise((resolve) => {
            finish = () => resolve({});
        });
    };
    const actions = createFormatterActions(services, () => undefined);
    try {
        const textarea = document.getElementById(
            'wpTextbox1',
        ) as HTMLTextAreaElement;
        textarea.value = '==Heading==\nText   ';
        const first = actions.format();
        await actions.format();
        assert.equal(requests, 1);
        assert.equal(notifications.length, 1);
        assert.equal(notifications[0].type, 'info');
        finish();
        await first;
        assert.equal(textarea.value, '== Heading ==\n\nText');
        assert.equal(notifications.length, 2);
        assert.equal(notifications.at(-1)?.key, 'format-result');
        assert.equal(notifications.at(-1)?.type, 'success');
        assert.deepEqual(modules, []);
        assert.deepEqual(errors, []);
    } finally {
        restore();
    }
});

for (const phase of ['citation metadata', 'redirects'] as const) {
    for (const change of [
        'source',
        'selection',
        'page',
        'textarea',
        'controller',
        'composition',
    ] as const) {
        test(`direct formatting rejects a changed ${change} while ${phase} are pending`, async () => {
            const errors: unknown[][] = [];
            const notifications: ActionNotification[] = [];
            const restore = installFormatterEnvironment([]);
            const services = createServices(errors, notifications);
            const settings = createDefaultFormatterSettings();
            settings.citationFormatting.enabled = phase === 'citation metadata';
            settings.resolveRedirects = phase === 'redirects';
            services.loadFormatterSettings = () => settings;
            let finish!: () => void;
            services.loadCitationFormattingContext = () =>
                new Promise((resolve) => {
                    finish = () => resolve({});
                });
            services.resolveRedirects = (source) =>
                new Promise((resolve) => {
                    finish = () => resolve(source);
                });
            const textarea = document.getElementById(
                'wpTextbox1',
            ) as HTMLTextAreaElement;
            const source = '==Heading==\nText   ';
            textarea.value = source;
            let writes = 0;
            const controller = {
                clearCache() {},
                getFeatureSettings: () => getEditorFeatureSettings(settings),
                getSelection: () => ({
                    start: textarea.selectionStart,
                    end: textarea.selectionEnd,
                }),
                replace() {
                    writes += 1;
                },
                setFeatureSettings() {},
            };
            let currentController = controller;
            const actions = createFormatterActions(
                services,
                () => currentController,
            );
            try {
                const formatting = actions.format();
                if (change === 'source')
                    textarea.value = 'User changed the article';
                if (change === 'selection') textarea.selectionEnd = 3;
                if (change === 'page')
                    mw.config.get = (() =>
                        'Another_page') as unknown as typeof mw.config.get;
                if (change === 'textarea') document.getElementById = () => null;
                if (change === 'controller')
                    currentController = { ...controller };
                if (change === 'composition') {
                    textarea.dispatchEvent(new Event('compositionstart'));
                    textarea.dispatchEvent(new Event('compositionend'));
                }
                finish();
                await formatting;
                assert.equal(writes, 0);
                assert.equal(
                    textarea.value,
                    change === 'source' ? 'User changed the article' : source,
                );
                assert.equal(notifications.at(-1)?.type, 'error');
                assert.equal(
                    notifications.some(({ type }) => type === 'success'),
                    false,
                );
                assert.equal(errors.length, 1);
            } finally {
                restore();
            }
        });
    }
}

for (const failure of [
    'component creation',
    'application creation',
    'registration',
    'mount',
    'unmount',
]) {
    test(`dialog ${failure} failures remove the host and permit another open`, async () => {
        const errors: unknown[][] = [];
        const notifications: ActionNotification[] = [];
        const hosts = new Set<object>();
        let shouldFail = true;
        let unmountCount = 0;
        const failAt = (stage: string) => {
            if (
                shouldFail &&
                (failure === stage ||
                    (failure === 'unmount' && stage === 'mount'))
            ) {
                throw new Error(`Failure during ${stage}`);
            }
        };
        const Vue = {
            defineComponent(component: unknown) {
                failAt('component creation');
                return component;
            },
            createMwApp() {
                failAt('application creation');
                return {
                    component() {
                        failAt('registration');
                    },
                    mount() {
                        failAt('mount');
                    },
                    unmount() {
                        unmountCount += 1;
                        failAt('unmount');
                    },
                };
            },
        };
        const restore = installFormatterEnvironment(
            [],
            async () => (name: string) => (name === 'vue' ? Vue : {}),
            hosts,
        );
        const openFormatter = createFormatterActions(
            createServices(errors, notifications),
            () => undefined,
        ).open;

        try {
            await openFormatter();
            assert.equal(hosts.size, 0);
            assert.equal(errors.length, 1);
            assert.equal(notifications.length, 1);
            assert.equal(
                unmountCount,
                failure === 'component creation' ||
                    failure === 'application creation'
                    ? 0
                    : 1,
            );
            shouldFail = false;
            await openFormatter();
            assert.equal(hosts.size, 1);
            assert.equal(errors.length, 1);
        } finally {
            restore();
        }
    });
}

async function reportFormatterLoadFailure(): Promise<void> {
    const errors: unknown[][] = [];
    const notifications: ActionNotification[] = [];
    const requestedModules: string[][] = [];
    const restore = installFormatterEnvironment(requestedModules);
    const services = createServices(errors, notifications);
    const openFormatter = createFormatterActions(
        services,
        () => undefined,
    ).open;

    try {
        await assert.doesNotReject(openFormatter);
    } finally {
        restore();
    }

    assert.deepEqual(requestedModules, [['vue', '@wikimedia/codex']]);
    assert.match(
        String(errors[0]?.[0]),
        /\[kanade-source-editor-test\] dialog\.open\.failed$/u,
    );
    assert.deepEqual(notifications, [
        {
            key: 'dialog-open-failed',
            message: 'Could not open Source Editor. Open the tool again.',
            type: 'error',
        },
    ]);
}

function createServices(
    errors: unknown[][],
    notifications: ActionNotification[],
): EditorServices {
    return {
        wikiPolicy: resolveWikiPolicy(''),
        async findMissingLinks() {
            return {
                checkedTitles: new Set(),
                linkClasses: [],
                missingTitles: new Set(),
            };
        },
        getHighlightOptions() {
            return {};
        },
        isSectionEditing: () => false,
        loadFormatterSettings: createDefaultFormatterSettings,
        async loadNamespaces() {},
        async loadPageSource() {
            return '';
        },
        async loadPageSummary() {
            return { kind: 'unavailable' };
        },
        logger: createLogger('kanade-source-editor-test', {
            level: 'error',
            output: createLogOutput(errors),
        }),
        notify(notification) {
            notifications.push(notification);
        },
        resetFormatterSettings() {},
        async resolveRedirects(source) {
            return source;
        },
        saveFormatterSettings() {},
    };
}

function installFormatterEnvironment(
    requestedModules: string[][],
    load: () => Promise<unknown> = () =>
        Promise.reject(new Error('Codex unavailable')),
    hosts = new Set<object>(),
): () => void {
    class FakeTextArea extends EventTarget {
        readonly marker = 'textarea';
        readonly isConnected = true;
        value = 'Plain source';
        selectionStart = 0;
        selectionEnd = 0;
        setRangeText(value: string, start: number, end: number): void {
            this.value =
                this.value.slice(0, start) + value + this.value.slice(end);
            this.selectionStart = start;
            this.selectionEnd = start + value.length;
        }
        focus(): void {}
    }

    const textarea = new FakeTextArea();
    const properties = [
        'document',
        'HTMLTextAreaElement',
        'mw',
        'window',
    ] as const;
    const originals = captureGlobals(properties);
    installFormatterGlobals(
        FakeTextArea,
        textarea,
        requestedModules,
        load,
        hosts,
    );
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: new EventTarget(),
    });
    return () => restoreGlobals(properties, originals);
}

type FormatterDialogBindings = ReturnType<typeof createFormatterDialogBindings>;

function createDialogRuntime(rendered: FormatterDialogBindings[]) {
    const Vue = {
        defineComponent(component: unknown) {
            return component;
        },
        ref<T>(value: T) {
            return { value };
        },
        createMwApp(component: { setup(): FormatterDialogBindings }) {
            rendered.push(component.setup());
            return {
                component() {},
                mount() {},
                unmount() {},
            };
        },
    };
    return (name: string) => (name === 'vue' ? Vue : {});
}

function installFormatterGlobals(
    TextArea: new () => object,
    textarea: object,
    requestedModules: string[][],
    load: () => Promise<unknown>,
    hosts: Set<object>,
): void {
    Object.defineProperty(globalThis, 'HTMLTextAreaElement', {
        configurable: true,
        value: TextArea,
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: {
            createElement() {
                return {
                    id: '',
                    remove() {
                        hosts.delete(this);
                    },
                };
            },
            documentElement: {
                append(host: object) {
                    hosts.add(host);
                },
            },
            getElementById() {
                return textarea;
            },
        },
    });
    Object.defineProperty(globalThis, 'mw', {
        configurable: true,
        value: {
            config: { get: () => undefined },
            util: { getUrl: (title: string) => `/wiki/${title}` },
            loader: {
                using(modules: string[]) {
                    requestedModules.push(modules);
                    return load();
                },
            },
        },
    });
}

function captureGlobals<const Name extends PropertyKey>(
    properties: readonly Name[],
): Map<Name, PropertyDescriptor | undefined> {
    return new Map(
        properties.map((name) => [
            name,
            Object.getOwnPropertyDescriptor(globalThis, name),
        ]),
    );
}

function restoreGlobals<const Name extends PropertyKey>(
    properties: readonly Name[],
    originals: ReadonlyMap<Name, PropertyDescriptor | undefined>,
): void {
    for (const name of properties) {
        const descriptor = originals.get(name);
        if (descriptor == null) {
            Reflect.deleteProperty(globalThis, name);
        } else {
            Object.defineProperty(globalThis, name, descriptor);
        }
    }
}

function createLogOutput(errors: unknown[][]): LogOutput {
    return {
        debug() {},
        error(...values) {
            errors.push(values);
        },
        info() {},
        warn() {},
    };
}
