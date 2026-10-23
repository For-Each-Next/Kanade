/**
 * @file src/source-editor/app/editor-integration.ts
 * Purpose: Discovers MediaWiki source editors and installs their contributions.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. CodeMirrorEditor
 * 4. CodeMirrorConstructor
 * 5. CodeMirrorModes
 * 6. CodeMirrorRequire
 * 7. startEditorIntegration
 * 8. initialize
 * 9. installEditor
 * 10. shouldSkipEditorInstall
 * 11. installCodeMirror
 * 12. getCodeMirrorModules
 * 13. isCodeMirrorForTextarea
 * 14. getSourceEditorSelection
 * 15. refreshCurrentEditor
 * 16. installTool
 * 17. addToolToPortlet
 * 18. isWikitextSourcePage
 * 19. waitForDocument
 */

import type { EditorServices } from './editor-contracts.ts';
import { registerEditBoxBackend } from '../platform/editor-backend.ts';
import { dispatchNativeInput } from '../platform/browser/events.ts';
import {
    getEditorFeatureSettings,
    type EditorFeatureSettings,
} from '../domain/formatter-settings.ts';
import {
    type CodeMirrorMode,
    selectSourceEditor,
    type SourceEditorSelection,
} from '../domain/editor-selection.ts';
import { msg } from '../i18n/index.ts';
import {
    createEditorController,
    type EditorController,
} from '../features/editor/controller.ts';
import { isIncompatibleEditor } from '../features/editor/surface.ts';
import { createFormatterActions } from './formatter.ts';
import {
    FORMATTER_DIALOG_STYLES,
    type FormatterDialogTab,
} from '../features/formatter/dialog.ts';
import { registerQuickAccessAction } from '../../library/quick-access/registry.ts';
import { installSourceEditorStyles } from '../features/editor/styles.ts';

const TEXTAREA_ID = 'wpTextbox1';
const TOOL_ID = 'kanade-source-editor-panel';

interface CodeMirrorEditor {
    textarea: HTMLTextAreaElement;

    initialize(): void;

    toggle(force?: boolean): void;
}

interface CodeMirrorConstructor {
    new (
        textarea: HTMLTextAreaElement,
        languageSupport?: unknown,
    ): CodeMirrorEditor;
}

interface CodeMirrorModes {
    css?(): unknown;

    javascript?(): unknown;

    json?(): unknown;

    lua?(): unknown;

    vue?(): unknown;
}

interface CodeMirrorRequire {
    (module: 'ext.CodeMirror'): CodeMirrorConstructor;

    (module: 'ext.CodeMirror.modes'): CodeMirrorModes;
}

const controllers = new WeakMap<HTMLTextAreaElement, EditorController>();
const pendingEditors = new WeakSet<HTMLTextAreaElement>();
const editorSettings = new WeakMap<
    HTMLTextAreaElement,
    EditorFeatureSettings
>();
/**
 * Discovers source editors and adds the formatter action.
 *
 * @param services - Injected service adapters.
 */
export function startEditorIntegration(
    services: EditorServices,
): Promise<void> {
    return initialize(services);
}

async function initialize(services: EditorServices): Promise<void> {
    await waitForDocument();
    const selection = getSourceEditorSelection(
        services.loadFormatterSettings().useCodeMirrorForOtherModels,
    );
    if (selection.editor === 'none') {
        return;
    }
    if (selection.editor === 'codemirror') {
        await installCodeMirror(selection.mode);
        return;
    }
    await mw.loader.using([
        'mediawiki.api',
        'mediawiki.util',
        '@wikimedia/codex',
    ]);
    installSourceEditorStyles(FORMATTER_DIALOG_STYLES);
    const namespaceLoad = services.loadNamespaces();
    const formatter = createFormatterActions(
        services,
        (textarea) => controllers.get(textarea),
        (textarea, settings) => {
            editorSettings.set(textarea, { ...settings });
            if (settings.syntaxHighlighting) {
                controllers.get(textarea)?.setFeatureSettings(settings);
            }
            installEditor(services);
        },
        (textarea) => editorSettings.get(textarea),
    );
    services.registerPanelOpener?.(formatter.open);
    let quickAccessEditor: HTMLTextAreaElement | null = null;
    let releaseQuickAccess: (() => void) | undefined;
    function refreshQuickAccess(): void {
        const candidate = document.getElementById(TEXTAREA_ID);
        const textarea =
            candidate instanceof HTMLTextAreaElement && isWikitextSourcePage()
                ? candidate
                : null;
        if (textarea === quickAccessEditor) return;
        releaseQuickAccess?.();
        releaseQuickAccess = undefined;
        quickAccessEditor = textarea;
        if (!textarea) return;
        let sourceComposing = false;
        const beginComposition = (): void => {
            sourceComposing = true;
        };
        const endComposition = (): void => {
            sourceComposing = false;
        };
        textarea.addEventListener('compositionstart', beginComposition);
        textarea.addEventListener('compositionend', endComposition);
        const releaseFormat = registerQuickAccessAction({
            id: 'source-editor',
            label: msg('tool.format'),
            title: msg('tool.formatDescription'),
            activate: () => {
                if (sourceComposing) {
                    services.notify({
                        key: 'format-result',
                        message: msg('feedback.failed'),
                        type: 'warning',
                    });
                    return;
                }
                return formatter.format();
            },
        });
        const releaseTools = registerQuickAccessAction({
            id: 'source-editor-tools',
            label: msg('dialog.toolsTab'),
            activate: () => formatter.open('tools'),
        });
        releaseQuickAccess = () => {
            textarea.removeEventListener('compositionstart', beginComposition);
            textarea.removeEventListener('compositionend', endComposition);
            releaseFormat();
            releaseTools();
        };
    }
    installEditor(services);
    installTool(formatter.open);
    refreshQuickAccess();
    mw.hook('wikipage.content').add(function refresh(): void {
        installEditor(services);
        installTool(formatter.open);
        refreshQuickAccess();
    });
    mw.hook('ve.wikitextInteractive').add(function install(): void {
        installEditor(services);
    });
    void namespaceLoad.then(refreshCurrentEditor, function report(error) {
        services.logger.warn('namespaces.load.failed', { error });
    });
}

function installEditor(services: EditorServices): void {
    const textarea = document.getElementById(TEXTAREA_ID);
    if (!(textarea instanceof HTMLTextAreaElement)) {
        return;
    }
    const existing = controllers.get(textarea);
    const settings =
        editorSettings.get(textarea) ??
        getEditorFeatureSettings(services.loadFormatterSettings());
    editorSettings.set(textarea, settings);
    if (
        shouldSkipEditorInstall(textarea, existing, settings.syntaxHighlighting)
    ) {
        return;
    }
    pendingEditors.add(textarea);
    void createEditorController(
        textarea,
        {
            ...services,
            editorHost: {
                registerBackend: registerEditBoxBackend,
                dispatchNativeInput,
            },
        },
        (controller) => {
            if (controllers.get(textarea) === controller) {
                controllers.delete(textarea);
            }
        },
        settings,
    ).then(
        function register(controller): void {
            pendingEditors.delete(textarea);
            const currentSettings = editorSettings.get(textarea) ?? settings;
            if (
                !controller.isAttached() ||
                controllers.has(textarea) ||
                !currentSettings.syntaxHighlighting ||
                !isWikitextSourcePage() ||
                isIncompatibleEditor(textarea, true)
            ) {
                controller.destroy();
                return;
            }
            controllers.set(textarea, controller);
            controller.setFeatureSettings(currentSettings);
        },
        function report(error): void {
            pendingEditors.delete(textarea);
            services.logger.error('editor.initialize.failed', { error });
        },
    );
}

function shouldSkipEditorInstall(
    textarea: HTMLTextAreaElement,
    existing: EditorController | undefined,
    enabled: boolean,
): boolean {
    if (!enabled || !isWikitextSourcePage()) {
        existing?.destroy();
        controllers.delete(textarea);
        return true;
    }
    if (existing != null) {
        if (existing.isAttached() && !isIncompatibleEditor(textarea, true)) {
            return true;
        }
        existing.destroy();
        controllers.delete(textarea);
    }
    return isIncompatibleEditor(textarea) || pendingEditors.has(textarea);
}

async function installCodeMirror(mode: CodeMirrorMode | null): Promise<void> {
    const element = document.getElementById(TEXTAREA_ID);
    if (!(element instanceof HTMLTextAreaElement)) {
        return;
    }
    const textarea: HTMLTextAreaElement = element;
    if (isIncompatibleEditor(textarea)) {
        return;
    }
    const readyHook = mw.hook('ext.CodeMirror.ready');
    const existing = { editor: null as CodeMirrorEditor | null };

    function observeEditor(candidate: unknown): void {
        if (isCodeMirrorForTextarea(candidate, textarea)) {
            existing.editor = candidate;
        }
    }

    readyHook.add(observeEditor);
    try {
        const modules = getCodeMirrorModules(mode);
        const require = (await mw.loader.using(modules)) as CodeMirrorRequire;
        if (isIncompatibleEditor(textarea)) {
            return;
        }
        if (existing.editor != null) {
            existing.editor.toggle(true);
            return;
        }
        const CodeMirror = require('ext.CodeMirror');
        const modeFactory =
            mode == null ? undefined : require('ext.CodeMirror.modes')[mode];
        const languageSupport = modeFactory?.();
        const editor =
            languageSupport == null
                ? new CodeMirror(textarea)
                : new CodeMirror(textarea, languageSupport);
        editor.initialize();
    } finally {
        readyHook.remove(observeEditor);
    }
}

function getCodeMirrorModules(mode: CodeMirrorMode | null): string[] {
    return mode == null
        ? ['ext.CodeMirror']
        : ['ext.CodeMirror', 'ext.CodeMirror.modes'];
}

function isCodeMirrorForTextarea(
    candidate: unknown,
    textarea: HTMLTextAreaElement,
): candidate is CodeMirrorEditor {
    return (
        typeof candidate === 'object' &&
        candidate != null &&
        'textarea' in candidate &&
        candidate.textarea === textarea
    );
}

function getSourceEditorSelection(
    useCodeMirrorForOtherModels = false,
): SourceEditorSelection {
    return selectSourceEditor(
        String(mw.config.get('wgPageContentModel') ?? ''),
        String(mw.config.get('wgAction') ?? ''),
        String(mw.config.get('cmMode') ?? ''),
        useCodeMirrorForOtherModels,
    );
}

function refreshCurrentEditor(): void {
    const textarea = document.getElementById(TEXTAREA_ID);
    if (textarea instanceof HTMLTextAreaElement) {
        controllers.get(textarea)?.refresh();
    }
}

function installTool(
    openFormatter: (initialTab?: FormatterDialogTab) => Promise<void>,
): void {
    if (document.getElementById(TOOL_ID) != null || !isWikitextSourcePage()) {
        return;
    }
    const item = addToolToPortlet('p-cactions') ?? addToolToPortlet('p-tb');
    const link = item?.matches('a') ? item : item?.querySelector('a');
    if (link == null) return;
    link.addEventListener('click', function activate(event): void {
        event.preventDefault();
        void openFormatter();
    });
}

function addToolToPortlet(portlet: string): HTMLElement | null {
    return mw.util.addPortletLink(
        portlet,
        '#',
        msg('tool.name'),
        TOOL_ID,
        msg('tool.description'),
    );
}

function isWikitextSourcePage(): boolean {
    return getSourceEditorSelection().editor === 'source-editor';
}

function waitForDocument(): Promise<void> {
    if (document.readyState !== 'loading') {
        return Promise.resolve();
    }
    return new Promise(function ready(resolve) {
        document.addEventListener(
            'DOMContentLoaded',
            function resolveReady(): void {
                resolve();
            },
            { once: true },
        );
    });
}
