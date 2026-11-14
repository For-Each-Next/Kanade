/**
 * @file src/source-editor/app/formatter.ts
 * Purpose: Share reviewed and one-click formatting within the current editor integration.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. FormatterEditor
 * 4. createFormatterActions
 */

import { loadHostModules } from '../../library/mediawiki-runtime/modules.ts';

import type { EditorServices } from './editor-contracts.ts';
import { formatArticleSource } from '../domain/formatting.ts';
import { formatSourceScriptTitles } from '../domain/source-manager.ts';
import { msg } from '../i18n/index.ts';
import {
    createFormatterDialogComponent,
    type FormatterDialogSelection,
    type FormatterDialogTab,
} from '../features/formatter/dialog.ts';
import {
    registerFormatterComponents,
    type ResourceLoaderRequire,
    type VueApp,
} from '../features/formatter/codex.ts';
import { dispatchNativeInput } from '../platform/browser/events.ts';

const TEXTAREA_ID = 'wpTextbox1';
const HOST_ID = 'kanade-source-editor-dialog-host';

interface FormatterEditor {
    read?(): string;
    getVersion?(): unknown;
    isComposing?(): boolean;
    getSelection(): { start: number; end: number };
    isAttached?(): boolean;
    replace(start: number, end: number, value: string): void;
}

/** Creates dialog and direct actions sharing accepted settings and source writes. */
export function createFormatterActions(
    services: EditorServices,
    getController: (
        textarea: HTMLTextAreaElement,
    ) => FormatterEditor | undefined,
): {
    open(initialTab?: FormatterDialogTab): Promise<void>;
    format(): Promise<void>;
} {
    const sessionFormatterSettings = new WeakMap<
        HTMLTextAreaElement,
        FormatterDialogSelection
    >();
    let activeDialogCleanup: (() => void) | null = null;
    let latestRequest = 0;
    let formattingPending = false;

    async function formatCurrentSource(): Promise<void> {
        if (formattingPending || activeDialogCleanup) return;
        const textarea = document.getElementById(TEXTAREA_ID);
        if (!(textarea instanceof HTMLTextAreaElement)) {
            services.notify({
                key: 'editor-missing',
                message: msg('feedback.noEditor'),
                type: 'warning',
            });
            return;
        }
        const request = ++latestRequest;
        const controller = getController(textarea);
        const version = controller?.getVersion?.();
        const range = controller?.getSelection() ?? {
            start: textarea.selectionStart,
            end: textarea.selectionEnd,
        };
        const pageIdentity = String(mw.config.get('wgPageName') ?? '');
        let invalidated = false;
        const invalidate = (): void => {
            invalidated = true;
        };
        const leavePage = (): void => {
            latestRequest += 1;
            invalidate();
        };
        const isCurrent = (): boolean =>
            request === latestRequest &&
            !invalidated &&
            document.getElementById(TEXTAREA_ID) === textarea &&
            String(mw.config.get('wgPageName') ?? '') === pageIdentity &&
            getController(textarea) === controller &&
            controller?.isAttached?.() !== false &&
            controller?.getVersion?.() === version &&
            !controller?.isComposing?.() &&
            (controller?.getSelection().start ?? textarea.selectionStart) ===
                range.start &&
            (controller?.getSelection().end ?? textarea.selectionEnd) ===
                range.end;
        textarea.addEventListener('compositionstart', invalidate);
        textarea.addEventListener('input', invalidate);
        window.addEventListener('pagehide', leavePage);
        formattingPending = true;
        try {
            const settings = getDialogInitialSelection(textarea);
            if (
                settings.citationFormatting.enabled ||
                settings.resolveRedirects
            ) {
                services.notify({
                    key: 'format-result',
                    message: msg('dialog.working'),
                    type: 'info',
                });
            }
            await applyFormatting(textarea, settings, range, isCurrent);
        } catch (error) {
            if (request !== latestRequest) return;
            services.logger.error('format.failed', { error });
            services.notify({
                key: 'format-result',
                message: msg('feedback.failed'),
                type: 'error',
            });
        } finally {
            formattingPending = false;
            textarea.removeEventListener('compositionstart', invalidate);
            textarea.removeEventListener('input', invalidate);
            window.removeEventListener('pagehide', leavePage);
        }
    }

    async function openFormatter(
        initialTab?: FormatterDialogTab,
    ): Promise<void> {
        const request = ++latestRequest;
        const textarea = document.getElementById(TEXTAREA_ID);
        if (!(textarea instanceof HTMLTextAreaElement)) {
            if (services.openReferences) {
                await services.openReferences().catch((error: unknown) => {
                    services.logger.error('references.open.failed', { error });
                });
                return;
            }
            services.notify({
                key: 'editor-missing',
                message: msg('feedback.noEditor'),
                type: 'warning',
            });
            return;
        }
        try {
            const controller = getController(textarea);
            const version = controller?.getVersion?.();
            const range = controller?.getSelection() ?? {
                end: textarea.selectionEnd,
                start: textarea.selectionStart,
            };
            const source = getController(textarea)?.read?.() ?? textarea.value;
            const pageIdentity = String(mw.config.get('wgPageName') ?? '');
            activeDialogCleanup?.();
            const require = (await loadHostModules(mw.loader, [
                'vue',
                '@wikimedia/codex',
            ])) as ResourceLoaderRequire;
            if (
                request === latestRequest &&
                textarea.isConnected &&
                getController(textarea) === controller &&
                controller?.getVersion?.() === version
            ) {
                mountFormatterDialog(
                    require,
                    textarea,
                    range,
                    source,
                    pageIdentity,
                    initialTab,
                );
            }
        } catch (error) {
            if (request !== latestRequest) {
                return;
            }
            services.logger.error('dialog.open.failed', { error });
            services.notify({
                key: 'dialog-open-failed',
                message: msg('feedback.openFailed'),
                type: 'error',
            });
        }
    }

    function mountFormatterDialog(
        require: ResourceLoaderRequire,
        textarea: HTMLTextAreaElement,
        range: { end: number; start: number },
        source: string,
        pageIdentity: string,
        initialTab?: FormatterDialogTab,
    ): void {
        const controller = getController(textarea);
        const version = controller?.getVersion?.();
        const Vue = require('vue');
        const Codex = require('@wikimedia/codex');
        const host = document.createElement('div');
        let application: VueApp | null = null;
        host.id = HOST_ID;
        document.documentElement.append(host);
        function cleanup(): void {
            const mountedApplication = application;
            application = null;
            try {
                mountedApplication?.unmount();
            } finally {
                host.remove();
                if (activeDialogCleanup === cleanup) {
                    activeDialogCleanup = null;
                }
            }
        }

        try {
            const isChineseWikipedia =
                (mw.config.get('wgWikiID') ?? mw.config.get('wgDBname')) ===
                'zhwiki';
            const component = createFormatterDialogComponent(Vue, {
                initialTab,
                canNormalizeConversion: isChineseWikipedia,
                initialSelection: getDialogInitialSelection(textarea),
                contentLanguage: services.contentLanguage,
                redirectPolicyUrl: mw.util.getUrl('WP:DONOTFIXIT'),
                scope:
                    range.start !== range.end
                        ? 'selection'
                        : services.isSectionEditing()
                          ? 'section'
                          : 'page',
                onClose(selection) {
                    if (selection != null) {
                        sessionFormatterSettings.set(textarea, selection);
                        services.applyFormatterSettings?.(selection);
                    }
                    cleanup();
                },
                onError(error, operation) {
                    services.logger.error(`${operation}.failed`, { error });
                },
                onReset() {
                    services.resetFormatterSettings();
                    sessionFormatterSettings.delete(textarea);
                    services.notify({
                        key: 'settings-reset',
                        message: msg('feedback.settingsReset'),
                        type: 'success',
                    });
                },
                onSave(selection) {
                    services.saveFormatterSettings(selection);
                    services.notify({
                        key: 'settings-saved',
                        message: msg('feedback.settingsSaved'),
                        type: 'success',
                    });
                },
                onSubmit: (selection) =>
                    applyFormatting(
                        textarea,
                        selection,
                        range,
                        () =>
                            getController(textarea) === controller &&
                            controller?.getVersion?.() === version &&
                            String(mw.config.get('wgPageName') ?? '') ===
                                pageIdentity &&
                            (getController(textarea)?.read?.() ??
                                textarea.value) === source,
                    ),
                ...(services.openReferences
                    ? {
                          onOpenReferences: (
                              selection: FormatterDialogSelection,
                          ) => services.openReferences!(selection),
                      }
                    : {}),
            });
            application = Vue.createMwApp(component);
            registerFormatterComponents(application, Codex);
            application.mount(host);
            activeDialogCleanup = cleanup;
        } catch (error) {
            cleanup();
            throw error;
        }
    }

    function getDialogInitialSelection(
        textarea: HTMLTextAreaElement,
    ): FormatterDialogSelection {
        return (
            sessionFormatterSettings.get(textarea) ??
            services.loadFormatterSettings()
        );
    }

    async function applyFormatting(
        textarea: HTMLTextAreaElement,
        selection: FormatterDialogSelection,
        range: { end: number; start: number },
        isCurrent: () => boolean = () => true,
    ): Promise<void> {
        const selected = range.start !== range.end;
        const controller = getController(textarea);
        const pageIdentity = String(mw.config.get('wgPageName') ?? '');
        const originalSource = controller?.read?.() ?? textarea.value;
        const source = selected
            ? originalSource.slice(range.start, range.end)
            : originalSource;
        assertCurrent();
        const citations = selection.citationFormatting;
        const citationContext = citations.enabled
            ? await services.loadCitationFormattingContext?.(source)
            : undefined;
        assertCurrent();
        const citationSource =
            citations.enabled && citations.formatScriptTitles
                ? formatSourceScriptTitles(
                      source,
                      String(
                          mw.config.get('wgWikiID') ??
                              mw.config.get('wgDBname') ??
                              '',
                      ),
                      citations.scriptTitleMode,
                      citationContext?.templateNameContext,
                      services.contentLanguage,
                  ).text
                : source;
        let formatted = formatArticleSource(citationSource, {
            wikitext: selection.formatter,
            references: !citations.enabled
                ? undefined
                : {
                      ...citationContext,
                      layout: citations.layout,
                      convertAuthorNames: citations.convertAuthorNames,
                      compactReferences: citations.compactReferences,
                      separateReferenceDefinitions:
                          citations.separateReferenceDefinitions,
                      leadSectionLabel: msg('sections.lead'),
                      wikiPolicy: services.wikiPolicy,
                  },
        }).text;
        if (selection.resolveRedirects) {
            formatted = await services.resolveRedirects(formatted, {
                includeTemplates: selection.resolveTemplateRedirects,
            });
        }
        assertCurrent();
        if (formatted !== source) {
            writeFormattedSource(textarea, range, formatted, selected);
        }
        notifyFormattingResult(formatted !== source, selected);

        function assertCurrent(): void {
            if (
                !isCurrent() ||
                !textarea.isConnected ||
                textarea.readOnly ||
                textarea.disabled ||
                getController(textarea) !== controller ||
                controller?.isAttached?.() === false ||
                controller?.isComposing?.() === true ||
                String(mw.config.get('wgPageName') ?? '') !== pageIdentity ||
                (controller?.read?.() ?? textarea.value) !== originalSource
            ) {
                throw new Error(
                    'The source changed or is unavailable. Run the formatter again.',
                );
            }
        }
    }

    function writeFormattedSource(
        textarea: HTMLTextAreaElement,
        range: { end: number; start: number },
        formatted: string,
        selected: boolean,
    ): void {
        if (!textarea.isConnected || textarea.readOnly || textarea.disabled) {
            throw new Error('The source editor is unavailable for changes.');
        }
        const controller = getController(textarea);
        const start = selected ? range.start : 0;
        const end = selected
            ? range.end
            : (controller?.read?.() ?? textarea.value).length;
        if (controller != null) {
            controller.replace(start, end, formatted);
            return;
        }
        textarea.setRangeText(formatted, start, end, 'select');
        dispatchNativeInput(textarea);
        textarea.focus({ preventScroll: true });
    }

    function notifyFormattingResult(changed: boolean, selected: boolean): void {
        const message = !changed
            ? msg('feedback.noChanges')
            : msg(selected ? 'feedback.selection' : 'feedback.whole');
        services.notify({
            key: 'format-result',
            message,
            type: changed ? 'success' : 'info',
        });
    }

    return { open: openFormatter, format: formatCurrentSource };
}
