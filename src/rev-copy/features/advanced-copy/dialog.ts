/**
 * @file src/rev-copy/features/advanced-copy/dialog.ts
 * Purpose: Present localized attribution options and selectable wikitext in a Codex dialog.
 *
 * Contents: Public contracts, form state, asynchronous actions, Codex rendering, and lifecycle.
 */

import type { Messages } from '../../i18n';
import type { CodexRuntime } from '../../app/contracts/advanced-copy.ts';
import { combinePageReferenceInput } from '../../domain/page-reference';
import styles from './styles.css';

interface AdvancedCopySelection {
    mode: 'translate' | 'copy';
    notice: boolean;
    sourceSummary: boolean;
    partial: boolean;
    modified: boolean;
}

interface AdvancedCopyResult {
    wikitext: string;
    fromTitle: string;
    toTitle: string;
}

export interface AdvancedCopyOptions {
    loadRuntime(): Promise<CodexRuntime>;
    notifyCopySuccess(message: string): Promise<void>;
    messages: Messages;
    currentPageTitle: string;
    currentSitePrefix: string;
    generate(
        from: string,
        to: string,
        options: AdvancedCopySelection,
    ): Promise<AdvancedCopyResult>;
    copy(text: string): Promise<void>;
}

export interface AdvancedCopy {
    open(sectionId?: string): Promise<void>;
    dispose(): void;
}

let dialogSequence = 0;

export function createAdvancedCopy(options: AdvancedCopyOptions): AdvancedCopy {
    const messages = options.messages;
    const name = `kanade-rev-copy-advanced-${++dialogSequence}`;
    const selection: AdvancedCopySelection = {
        mode: 'translate',
        notice: false,
        sourceSummary: false,
        partial: false,
        modified: false,
    };
    const endpoints = {
        from: { prefix: '', page: '', title: '' },
        to: { prefix: '', page: '', title: '' },
    };
    let output = '';
    let feedback = '';
    let feedbackType: 'error' | 'success' = 'error';
    let generating = false;
    let copying = false;
    let opened = false;
    let disposed = false;
    let version = 0;
    let runtime: CodexRuntime | undefined;
    let loading: Promise<void> | undefined;
    let mount: HTMLDivElement | undefined;
    let style: HTMLStyleElement | undefined;
    let opener: HTMLElement | undefined;
    let context: string | undefined;
    let generationKey: string | undefined;
    let generationTimer: number | undefined;
    let generationAfterComposition = false;
    const composing = new Set<string>();
    const currentPrefix = options.currentSitePrefix.replace(/^w:/u, '');
    const sourcePrefix = currentPrefix === 'zh' ? 'en' : currentPrefix;

    function defaultPrefix(kind: 'from' | 'to'): string {
        if (selection.mode === 'copy') return currentPrefix;
        return kind === 'from'
            ? context
                ? currentPrefix
                : sourcePrefix
            : 'zh';
    }

    function effectivePrefix(kind: 'from' | 'to'): string {
        return endpoints[kind].prefix.trim() || defaultPrefix(kind);
    }

    function current(ticket: number): boolean {
        return !disposed && opened && version === ticket;
    }

    function invalidate(): void {
        version += 1;
        output = '';
        endpoints.from.title = '';
        endpoints.to.title = '';
        feedback = '';
        generating = false;
        generationKey = undefined;
    }

    function changed(regenerate = false): void {
        invalidate();
        if (regenerate) void generate();
        else draw();
    }

    function cancelScheduledGeneration(): void {
        if (generationTimer !== undefined) window.clearTimeout(generationTimer);
        generationTimer = undefined;
    }

    function scheduleGeneration(): void {
        if (disposed || !opened) return;
        cancelScheduledGeneration();
        generationTimer = window.setTimeout(() => {
            generationTimer = undefined;
            if (composing.size > 0) {
                generationAfterComposition = true;
                return;
            }
            void generate();
        }, 0);
    }

    function close(): void {
        opened = false;
        composing.clear();
        generationAfterComposition = false;
        cancelScheduledGeneration();
        invalidate();
        draw();
        void runtime?.nextTick().then(() => {
            if (!opened && opener?.isConnected) opener.focus();
        });
    }

    function holdActionFocus(): HTMLElement | undefined {
        const dialog = document.getElementById(name);
        const primary = dialog?.querySelector(
            '.cdx-dialog__footer__primary-action',
        );
        if (
            document.activeElement !== primary &&
            document.activeElement !== document.body
        ) {
            return;
        }
        const form = dialog?.querySelector<HTMLElement>(
            '.kanade-rev-copy-advanced-form',
        );
        form?.focus();
        return form ?? undefined;
    }

    function finishActionFocus(
        held: HTMLElement | undefined,
        ticket: number,
    ): void {
        if (!held) return;
        void runtime?.nextTick().then(() => {
            if (!current(ticket) || document.activeElement !== held) return;
            const dialog = document.getElementById(name);
            const next = dialog?.querySelector<HTMLElement>(
                output
                    ? '.kanade-rev-copy-advanced-output textarea'
                    : '.cdx-dialog__footer__primary-action',
            );
            next?.focus();
        });
    }

    async function generate(): Promise<void> {
        cancelScheduledGeneration();
        if (disposed || !opened || composing.size > 0) return;
        const key = JSON.stringify([
            effectivePrefix('from'),
            endpoints.from.page,
            effectivePrefix('to'),
            endpoints.to.page,
            selection,
        ]);
        if (generationKey === key && (generating || output)) return;
        invalidate();
        const ticket = version;
        generationKey = key;
        generating = true;
        draw();
        try {
            const result = await options.generate(
                combinePageReferenceInput(
                    endpoints.from.prefix,
                    endpoints.from.page,
                    options.currentSitePrefix,
                    defaultPrefix('from'),
                ),
                combinePageReferenceInput(
                    endpoints.to.prefix,
                    endpoints.to.page,
                    options.currentSitePrefix,
                    defaultPrefix('to'),
                ),
                { ...selection },
            );
            if (!current(ticket)) return;
            if (!result.wikitext)
                throw new Error('No attribution text was generated.');
            output = result.wikitext;
            endpoints.from.title = result.fromTitle;
            endpoints.to.title = result.toTitle;
        } catch {
            if (!current(ticket)) return;
            feedback = messages.advancedGenerateFailed;
            feedbackType = 'error';
        } finally {
            if (current(ticket)) {
                generating = false;
                draw();
            }
        }
    }

    async function copy(): Promise<void> {
        if (disposed || !opened || !output || generating || copying) return;
        const ticket = version;
        const heldFocus = holdActionFocus();
        copying = true;
        feedback = '';
        draw();
        try {
            await options.copy(output);
            if (!current(ticket)) return;
            feedback = messages.copied;
            feedbackType = 'success';
            void options.notifyCopySuccess(messages.copied);
        } catch {
            if (!current(ticket)) return;
            feedback = messages.copyFailed;
            feedbackType = 'error';
        } finally {
            copying = false;
            if (!disposed && opened) draw();
            if (current(ticket)) {
                finishActionFocus(heldFocus, ticket);
            }
        }
    }

    function draw(): void {
        if (!runtime || !mount || disposed) return;
        const { h, render, components: c } = runtime;
        const translation = selection.mode === 'translate';
        const purposes = [
            {
                value: 'summary',
                label: translation
                    ? messages.advancedTranslationSummary
                    : messages.advancedCopySummary,
            },
            ...(!translation
                ? [{ value: 'cut-summary', label: messages.advancedCutSummary }]
                : []),
            {
                value: 'notice',
                label: translation
                    ? messages.advancedTranslationNotice
                    : messages.advancedCopyNotice,
            },
        ];
        const field = (
            label: string,
            control: () => unknown,
            props: Record<string, unknown> = {},
            help?: string,
        ) =>
            h(c.CdxField, props, {
                label: () => label,
                default: control,
                ...(help ? { 'help-text': () => help } : {}),
            });
        const pageInput = (kind: 'from' | 'to') => {
            const endpoint = endpoints[kind];
            const label =
                kind === 'from' ? messages.advancedFrom : messages.advancedTo;
            const inputId = `${name}-${kind}`;
            const localSite =
                effectivePrefix(kind).replace(/^w:/u, '').toLowerCase() ===
                currentPrefix;
            const input = (field: 'prefix' | 'page') => {
                const prefix = field === 'prefix';
                const id = prefix ? `${inputId}-prefix` : inputId;
                const value = endpoint[field];
                return h(c.CdxTextInput, {
                    class: 'kanade-rev-copy-advanced-page-input',
                    id,
                    modelValue: value,
                    name: id,
                    placeholder: prefix
                        ? defaultPrefix(kind)
                        : endpoint.title ||
                          (localSite
                              ? options.currentPageTitle.replaceAll('_', ' ')
                              : messages.advancedPageName),
                    'aria-label': `${label}: ${prefix ? messages.advancedSitePrefix : messages.advancedPageName}`,
                    dir: prefix ? 'ltr' : 'auto',
                    onPaste: scheduleGeneration,
                    onBlur: scheduleGeneration,
                    onCompositionstart: () => {
                        composing.add(id);
                        changed();
                    },
                    onCompositionend: () => {
                        composing.delete(id);
                        if (
                            composing.size === 0 &&
                            generationAfterComposition
                        ) {
                            generationAfterComposition = false;
                            scheduleGeneration();
                        }
                    },
                    onKeydown: (event: KeyboardEvent) => {
                        if (
                            event.key !== 'Enter' ||
                            event.isComposing ||
                            event.keyCode === 229 ||
                            composing.has(id)
                        )
                            return;
                        event.preventDefault();
                        void generate();
                    },
                    'onUpdate:modelValue': (nextValue: string) => {
                        if (nextValue === value) return;
                        endpoint[field] = nextValue;
                        changed();
                    },
                });
            };
            return h(
                c.CdxField,
                {
                    class: 'kanade-rev-copy-advanced-page-field',
                    isFieldset: true,
                },
                {
                    label: () => label,
                    default: () =>
                        h(
                            'div',
                            { class: 'kanade-rev-copy-advanced-page-inputs' },
                            [input('prefix'), input('page')],
                        ),
                },
            );
        };
        const checkbox = (key: 'partial' | 'modified', label: string) =>
            h(
                c.CdxCheckbox,
                {
                    modelValue: selection[key],
                    inline: true,
                    'onUpdate:modelValue': (value: boolean) => {
                        if (selection[key] === value) return;
                        selection[key] = value;
                        changed(true);
                    },
                },
                { default: () => label },
            );
        render(
            h(
                c.CdxDialog,
                {
                    class: 'kanade-rev-copy-advanced-dialog',
                    id: name,
                    open: opened,
                    title: messages.advancedTitle,
                    subtitle: messages.advancedDescription,
                    useCloseButton: true,
                    closeButtonLabel: messages.advancedClose,
                    defaultAction: { label: messages.advancedClose },
                    primaryAction: {
                        label: messages.advancedCopyWikitext,
                        actionType: 'progressive',
                        disabled: !output || generating || copying,
                    },
                    'onUpdate:open': (value: boolean) => {
                        if (!value) close();
                    },
                    onDefault: close,
                    onPrimary: () => void copy(),
                },
                {
                    default: () =>
                        h(
                            'form',
                            {
                                class: 'kanade-rev-copy-advanced-form',
                                tabindex: -1,
                                'aria-busy': generating,
                                onSubmit: (event: Event) => {
                                    event.preventDefault();
                                    void generate();
                                },
                            },
                            [
                                field(
                                    messages.advancedMode,
                                    () =>
                                        h(c.CdxToggleButtonGroup, {
                                            modelValue: selection.mode,
                                            buttons: [
                                                {
                                                    value: 'translate',
                                                    label: messages.advancedTranslate,
                                                },
                                                {
                                                    value: 'copy',
                                                    label: messages.advancedCopy,
                                                },
                                            ],
                                            'aria-label': messages.advancedMode,
                                            'onUpdate:modelValue': (
                                                value: string | null,
                                            ) => {
                                                if (
                                                    value === 'translate' ||
                                                    value === 'copy'
                                                ) {
                                                    if (
                                                        selection.mode === value
                                                    )
                                                        return;
                                                    selection.mode = value;
                                                    if (value === 'translate') {
                                                        selection.sourceSummary = false;
                                                    }
                                                    changed(true);
                                                }
                                            },
                                        }),
                                    { isFieldset: true },
                                ),
                                field(
                                    messages.advancedPurpose,
                                    () =>
                                        purposes.map(({ value, label }) =>
                                            h(
                                                c.CdxRadio,
                                                {
                                                    name: `${name}-purpose`,
                                                    modelValue: selection.notice
                                                        ? 'notice'
                                                        : selection.sourceSummary
                                                          ? 'cut-summary'
                                                          : 'summary',
                                                    inputValue: value,
                                                    inline: true,
                                                    'onUpdate:modelValue': (
                                                        selected: string,
                                                    ) => {
                                                        if (
                                                            selection.notice ===
                                                                (selected ===
                                                                    'notice') &&
                                                            selection.sourceSummary ===
                                                                (selected ===
                                                                    'cut-summary')
                                                        )
                                                            return;
                                                        selection.notice =
                                                            selected ===
                                                            'notice';
                                                        selection.sourceSummary =
                                                            selected ===
                                                            'cut-summary';
                                                        changed(true);
                                                    },
                                                },
                                                {
                                                    default: () => label,
                                                },
                                            ),
                                        ),
                                    { isFieldset: true },
                                ),
                                pageInput('from'),
                                pageInput('to'),
                                field(
                                    messages.advancedOptions,
                                    () => [
                                        checkbox(
                                            'partial',
                                            translation
                                                ? messages.advancedPartialTranslation
                                                : messages.advancedPartialCopy,
                                        ),
                                        checkbox(
                                            'modified',
                                            messages.advancedModified,
                                        ),
                                    ],
                                    { isFieldset: true },
                                ),
                                field(
                                    messages.advancedOutput,
                                    () =>
                                        h(
                                            'div',
                                            {
                                                class: 'kanade-rev-copy-advanced-output-control',
                                            },
                                            [
                                                h(c.CdxTextArea, {
                                                    modelValue: output,
                                                    readonly: true,
                                                    rows: selection.notice
                                                        ? 5
                                                        : 3,
                                                    dir: 'auto',
                                                }),
                                                h(
                                                    'div',
                                                    {
                                                        class: 'kanade-rev-copy-advanced-progress',
                                                        role: generating
                                                            ? 'progressbar'
                                                            : undefined,
                                                        'aria-label': generating
                                                            ? messages.advancedGenerating
                                                            : undefined,
                                                    },
                                                    generating
                                                        ? h(c.CdxProgressBar, {
                                                              inline: true,
                                                              'aria-hidden': true,
                                                          })
                                                        : null,
                                                ),
                                            ],
                                        ),
                                    {
                                        class: 'kanade-rev-copy-advanced-output',
                                        'aria-busy': generating,
                                    },
                                    selection.notice
                                        ? messages.advancedNoticeHelp
                                        : selection.sourceSummary
                                          ? messages.advancedSourceSummaryHelp
                                          : messages.advancedSummaryHelp,
                                ),
                            ],
                        ),
                    ...(feedback
                        ? {
                              'footer-text': () =>
                                  h(
                                      c.CdxMessage,
                                      { type: feedbackType, inline: true },
                                      { default: () => feedback },
                                  ),
                          }
                        : {}),
                },
            ),
            mount,
        );
    }

    return {
        async open(sectionId) {
            if (disposed || opened) return;
            if (loading) return loading;
            const nextContext = sectionId ?? '';
            if (nextContext !== context) {
                context = nextContext;
                endpoints.from.page = sectionId ? `#${sectionId}` : '';
                endpoints.to.page = '';
                endpoints.from.prefix = '';
                endpoints.to.prefix = '';
                selection.mode = 'translate';
                selection.notice = false;
                selection.sourceSummary = false;
                selection.partial = false;
                selection.modified = false;
                invalidate();
            }
            opener =
                document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : undefined;
            loading = (async () => {
                try {
                    runtime ??= await options.loadRuntime();
                    if (disposed || (sectionId && !opener?.isConnected)) return;
                    if (!mount) {
                        mount = document.createElement('div');
                        mount.className = 'kanade-rev-copy-advanced-mount';
                        document.body.append(mount);
                        style = document.createElement('style');
                        style.textContent = styles;
                        document.head.append(style);
                    }
                    opened = true;
                    draw();
                    void generate();
                } catch {
                    if (!disposed) {
                        mw.notify(messages.advancedLoadFailed, {
                            type: 'error',
                        });
                    }
                }
            })();
            try {
                await loading;
            } finally {
                loading = undefined;
            }
        },
        dispose() {
            if (disposed) return;
            const restoreFocus = opened;
            disposed = true;
            opened = false;
            composing.clear();
            generationAfterComposition = false;
            cancelScheduledGeneration();
            invalidate();
            if (runtime && mount) runtime.render(null, mount);
            mount?.remove();
            style?.remove();
            if (restoreFocus && opener?.isConnected) opener.focus();
        },
    };
}
