/**
 * @file src/source-editor/features/editor/controller.ts
 * Purpose: Owns editing, native-source synchronization, history, and teardown.
 *
 * Table of contents:
 * 1. Imports
 * 2. createEditorController
 * 3. EditorController
 */

import type { EditorHost } from '../../app/contracts/editor-backend.ts';
import { DEFAULT_SOURCE_EDITOR_OPTIONS } from '../../domain/runtime-options.ts';
import type { EditorServices } from '../../app/editor-contracts.ts';
import type { EditorFeatureSettings } from '../../domain/formatter-settings.ts';
import {
    createEditorContributions,
    type EditorContributions,
} from './contributions.ts';
import {
    getSelectionOffsets,
    readEditableText,
    restoreAttribute,
    setSelectionOffsets,
} from './dom.ts';
import {
    EditorHistory,
    type EditorSnapshot,
    getHistoryDirection,
} from './history.ts';
import {
    createCompositionSubmitHandler,
    restoreNativeSelectionAndFocus,
} from './lifecycle.ts';
import {
    createEditorSurface,
    type EditorSurface,
    isEditorFrameAttached,
    isIncompatibleEditor,
} from './surface.ts';

/** Creates a controller only after its isolated document is ready. */
export async function createEditorController(
    textarea: HTMLTextAreaElement,
    services: EditorServices,
    onDestroy: (controller: EditorController) => void,
    initialSettings: EditorFeatureSettings,
): Promise<EditorController> {
    const surface = await createEditorSurface(textarea);
    try {
        return new EditorController(
            textarea,
            surface,
            services,
            onDestroy,
            initialSettings,
        );
    } catch (error) {
        surface.frame.remove();
        throw error;
    }
}

export class EditorController {
    private readonly host: EditorHost;
    private readonly textarea: HTMLTextAreaElement;
    private readonly surface: EditorSurface;
    private readonly contributions: EditorContributions;
    private readonly history: EditorHistory;
    private readonly listeners = new AbortController();
    private readonly observer: MutationObserver;
    private readonly highlightDelay: number;
    private readonly onDestroy: (controller: EditorController) => void;
    private readonly flushComposition: () => void;
    private readonly nativeAriaHidden: string | null;
    private readonly nativeTabIndex: string | null;
    private readonly hadNativeClass: boolean;
    private composing = false;
    private rendering = false;
    private applyingHistory = false;
    private dispatchingInput = false;
    private destroyed = false;
    private timer = 0;
    private unregisterBackend: (() => void) | undefined;

    constructor(
        textarea: HTMLTextAreaElement,
        surface: EditorSurface,
        services: EditorServices,
        onDestroy: (controller: EditorController) => void,
        initialSettings: EditorFeatureSettings,
    ) {
        this.highlightDelay = (
            services.runtimeOptions ?? DEFAULT_SOURCE_EDITOR_OPTIONS
        ).highlightDelay;
        if (!services.editorHost)
            throw new Error('The editor host is unavailable.');
        this.host = services.editorHost;
        this.textarea = textarea;
        this.surface = surface;
        this.onDestroy = onDestroy;
        this.nativeAriaHidden = textarea.getAttribute('aria-hidden');
        this.nativeTabIndex = textarea.getAttribute('tabindex');
        this.hadNativeClass = textarea.classList.contains(
            'kanade-source-editor-native',
        );
        this.history = new EditorHistory(this.nativeSnapshot());
        this.contributions = createEditorContributions(
            textarea,
            surface,
            services,
            () => this.refresh(),
            (start, end, value) => this.replace(start, end, value),
            initialSettings,
        );
        this.flushComposition = createCompositionSubmitHandler({
            dispatchInput: () => this.dispatchInput(),
            isComposing: () => this.composing,
            readEditorSnapshot: () => ({
                ...getSelectionOffsets(surface.editor, this.nativeSnapshot()),
                source: readEditableText(surface.editor),
            }),
            recordSnapshot: (snapshot) => {
                textarea.setSelectionRange(snapshot.start, snapshot.end);
                this.history.record(this.nativeSnapshot());
            },
            writeNativeSource(source) {
                textarea.value = source;
            },
        });
        this.observer = new MutationObserver(() => {
            if (!this.isAttached()) {
                this.destroy();
            }
        });
        try {
            this.attach();
        } catch (error) {
            this.destroy();
            throw error;
        }
    }

    clearCache(): void {
        this.contributions.clearCache();
    }

    destroy(): void {
        if (this.destroyed) {
            return;
        }
        const { editor, frame } = this.surface;
        const hadEditorFocus =
            editor.ownerDocument.activeElement === editor ||
            this.surface.overlay.contains(editor.ownerDocument.activeElement);
        this.destroyed = true;
        this.unregisterBackend?.();
        this.cancelRender();
        this.listeners.abort();
        this.observer.disconnect();
        try {
            this.flushComposition();
        } finally {
            try {
                this.contributions.destroy();
            } finally {
                restoreAttribute(
                    this.textarea,
                    'aria-hidden',
                    this.nativeAriaHidden,
                );
                restoreAttribute(
                    this.textarea,
                    'tabindex',
                    this.nativeTabIndex,
                );
                if (!this.hadNativeClass) {
                    this.textarea.classList.remove(
                        'kanade-source-editor-native',
                    );
                }
                frame.remove();
                this.onDestroy(this);
                restoreNativeSelectionAndFocus(
                    {
                        focus: () =>
                            this.textarea.focus({ preventScroll: true }),
                        isAvailable: () =>
                            this.textarea.isConnected &&
                            !isIncompatibleEditor(this.textarea),
                        setSelection: (start, end) =>
                            this.textarea.setSelectionRange(start, end),
                    },
                    hadEditorFocus ? this.getSelection() : null,
                );
            }
        }
    }

    getFeatureSettings(): EditorFeatureSettings {
        return this.contributions.getSettings();
    }

    getSelection(): { end: number; start: number } {
        return {
            end: this.textarea.selectionEnd,
            start: this.textarea.selectionStart,
        };
    }

    isAttached(): boolean {
        return (
            !this.destroyed &&
            isEditorFrameAttached(this.surface.frame, this.textarea)
        );
    }

    refresh(): void {
        this.cancelRender();
        if (!this.composing && !this.destroyed) {
            this.timer = window.setTimeout(
                () => this.render(true),
                this.highlightDelay,
            );
        }
    }

    replace(start: number, end: number, value: string, collapse = false): void {
        this.assertWritable();
        const selection = this.getSelection();
        this.history.setSelection(selection.start, selection.end);
        this.textarea.setRangeText(
            value,
            start,
            end,
            collapse ? 'end' : 'select',
        );
        this.history.record(this.nativeSnapshot());
        this.dispatchInput();
        this.render();
        this.surface.editor.focus({ preventScroll: true });
    }

    setFeatureSettings(settings: EditorFeatureSettings): void {
        this.contributions.setSettings(settings);
    }

    private attach(): void {
        const { editor, frame } = this.surface;
        const hadNativeFocus = document.activeElement === this.textarea;
        const options = { signal: this.listeners.signal };
        editor.ownerDocument.addEventListener(
            'selectionchange',
            () => this.preserveSelection(),
            options,
        );
        editor.addEventListener(
            'blur',
            () => this.preserveSelection(),
            options,
        );
        editor.addEventListener(
            'beforeinput',
            () => this.preserveSelection(),
            options,
        );
        editor.addEventListener('input', () => this.synchronize(), options);
        editor.addEventListener(
            'compositionstart',
            () => {
                this.cancelRender();
                this.contributions.dismiss();
                this.preserveSelection();
                this.composing = true;
            },
            options,
        );
        editor.addEventListener(
            'compositionend',
            () => {
                this.composing = false;
                this.synchronize();
            },
            options,
        );
        editor.addEventListener(
            'keydown',
            (event) => this.handleHistoryShortcut(event),
            options,
        );
        this.textarea.addEventListener(
            'input',
            () => this.updateFromNative(),
            options,
        );
        this.textarea.form?.addEventListener('submit', this.flushComposition, {
            ...options,
            capture: true,
        });
        this.render();
        frame.dataset.kanadeSourceEditorReady = 'true';
        if (hadNativeFocus) {
            editor.focus({ preventScroll: true });
        }
        this.textarea.classList.add('kanade-source-editor-native');
        this.textarea.setAttribute('aria-hidden', 'true');
        this.textarea.setAttribute('tabindex', '-1');
        this.unregisterBackend = this.host.registerBackend(this.textarea, {
            focus: () => {
                const selection = this.nativeSnapshot();
                editor.focus({ preventScroll: true });
                setSelectionOffsets(editor, selection.start, selection.end);
            },
            read: () => this.textarea.value,
            replaceSelection: (text) => {
                const { start, end } = this.getSelection();
                this.replace(start, end, text, true);
            },
            write: (text) => this.writeFromTool(text, false),
            writePreservingPosition: (text) => this.writeFromTool(text, true),
        });
        this.observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
        });
    }

    private writeFromTool(text: string, preservePosition: boolean): void {
        this.assertWritable();
        const nativeSelection = this.getSelection();
        this.history.setSelection(nativeSelection.start, nativeSelection.end);
        const editor = this.surface.editor;
        const left = editor.scrollLeft;
        const top = editor.scrollTop;
        const selection = preservePosition
            ? nativeSelection
            : { start: text.length, end: text.length };
        this.textarea.value = text;
        this.textarea.setSelectionRange(
            Math.min(selection.start, text.length),
            Math.min(selection.end, text.length),
        );
        this.history.record(this.nativeSnapshot());
        this.dispatchInput();
        this.contributions.sourceChanged();
        this.render();
        if (preservePosition) {
            editor.scrollLeft = left;
            editor.scrollTop = top;
        }
    }

    private assertWritable(): void {
        if (this.destroyed) {
            throw new Error('The source editor has been closed.');
        }
        if (this.composing) {
            throw new Error(
                'Finish composing text before applying an editor action.',
            );
        }
    }

    private cancelRender(): void {
        window.clearTimeout(this.timer);
        this.timer = 0;
    }

    private render(preserveFocusedSelection = false): void {
        this.cancelRender();
        if (this.composing || this.destroyed) {
            return;
        }
        const { editor } = this.surface;
        if (
            preserveFocusedSelection &&
            editor.ownerDocument.activeElement === editor &&
            readEditableText(editor) === this.textarea.value
        ) {
            // A selection can change before its selectionchange event arrives.
            // Background work must preserve that live range; explicit native or
            // tool writes keep the selection supplied by their own operation.
            this.preserveSelection();
        }
        const selection = this.nativeSnapshot();
        const { scrollLeft, scrollTop } = editor;
        this.rendering = true;
        try {
            this.contributions.render();
            setSelectionOffsets(editor, selection.start, selection.end);
            editor.scrollLeft = scrollLeft;
            editor.scrollTop = scrollTop;
        } finally {
            this.rendering = false;
        }
    }

    private preserveSelection(): void {
        if (!this.rendering && !this.composing && !this.applyingHistory) {
            this.mirrorSelection();
            const { start, end } = this.getSelection();
            this.history.setSelection(start, end);
        }
    }

    private mirrorSelection(): void {
        const selection = getSelectionOffsets(
            this.surface.editor,
            this.getSelection(),
        );
        if (
            selection.start !== this.textarea.selectionStart ||
            selection.end !== this.textarea.selectionEnd
        ) {
            this.textarea.setSelectionRange(selection.start, selection.end);
        }
    }

    private synchronize(): void {
        if (this.rendering || this.destroyed) {
            return;
        }
        this.contributions.dismiss();
        // Keep form submission current even between IME composition updates.
        this.textarea.value = readEditableText(this.surface.editor);
        this.mirrorSelection();
        if (this.composing) {
            return;
        }
        this.history.record(this.nativeSnapshot());
        this.dispatchInput();
        this.refresh();
    }

    private updateFromNative(): void {
        if (this.rendering || this.applyingHistory || this.destroyed) {
            return;
        }
        if (!this.dispatchingInput) {
            this.history.record(this.nativeSnapshot());
        }
        if (this.composing) {
            this.contributions.dismiss();
        } else {
            this.contributions.sourceChanged();
            if (this.dispatchingInput) {
                this.refresh();
            } else {
                this.render();
            }
        }
    }

    private dispatchInput(): void {
        this.dispatchingInput = true;
        try {
            this.host.dispatchNativeInput(this.textarea);
        } finally {
            this.dispatchingInput = false;
        }
    }

    private handleHistoryShortcut(event: KeyboardEvent): void {
        const direction = getHistoryDirection(event);
        if (
            direction == null ||
            event.isComposing ||
            this.composing ||
            this.surface.editor.ownerDocument.activeElement !==
                this.surface.editor
        ) {
            return;
        }
        const snapshot =
            direction === 'undo' ? this.history.undo() : this.history.redo();
        if (snapshot == null) {
            return;
        }
        event.preventDefault();
        this.applyingHistory = true;
        try {
            this.textarea.value = snapshot.source;
            this.textarea.setSelectionRange(snapshot.start, snapshot.end);
            this.dispatchInput();
            this.contributions.sourceChanged();
            this.render();
            this.surface.editor.focus({ preventScroll: true });
        } finally {
            this.applyingHistory = false;
        }
    }

    private nativeSnapshot(): EditorSnapshot {
        return {
            source: this.textarea.value,
            start: this.textarea.selectionStart,
            end: this.textarea.selectionEnd,
        };
    }
}
