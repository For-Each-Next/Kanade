/**
 * @file src/source-editor/features/formatter/regex-tools.ts
 * Purpose: Own regex preview, source identity, explicit acceptance, and recovery.
 * Contents: Session contract and panel bindings.
 */

import type {
    RegexReplacementDraft,
    RegexReplacementError,
    RegexReplacementResult,
    RegexReplacementTask,
} from '../../domain/regex-replacement.ts';
import type { VueModule, VueRef } from './codex.ts';
import { cdxIconTrash } from '@wikimedia/codex-icons';
import { msg } from '../../i18n/index.ts';

type RegexToolsPreviewResult = RegexReplacementResult & {
    ruleIndex?: number;
};

export interface RegexToolsSession {
    preview(
        drafts: readonly RegexReplacementDraft[],
    ): Promise<RegexToolsPreviewResult>;
    apply():
        | { ok: true; changed: boolean }
        | { ok: false; error: RegexReplacementError };
    undo(): boolean;
    invalidate(): void;
}

export function createRegexToolsSession(options: {
    source: string;
    range: { start: number; end: number };
    read(): string;
    isCurrent(): boolean;
    write(start: number, end: number, value: string): void;
    startTask?(
        request: RegexReplacementDraft & { source: string },
    ): RegexReplacementTask;
}): RegexToolsSession {
    let baseline = options.source;
    let range = { ...options.range };
    const selected = range.start !== range.end;
    let task: RegexReplacementTask | null = null;
    let reviewed: Extract<RegexReplacementResult, { ok: true }> | null = null;
    let undo: { before: string; after: string; range: typeof range } | null =
        null;
    let generation = 0;
    function current(): boolean {
        return options.isCurrent() && options.read() === baseline;
    }
    function invalidate(): void {
        generation++;
        task?.cancel();
        task = null;
        reviewed = null;
    }
    return {
        invalidate,
        async preview(drafts) {
            invalidate();
            if (!current()) return { ok: false, error: 'source-changed' };
            const request = generation;
            if (!options.startTask) return { ok: false, error: 'unavailable' };
            let output = selected
                ? baseline.slice(range.start, range.end)
                : baseline;
            let matches = 0;
            if (!drafts.length)
                return { ok: false, error: 'pattern-required', ruleIndex: 0 };
            for (const [ruleIndex, draft] of drafts.entries()) {
                task = options.startTask({ ...draft, source: output });
                const result = await task.result;
                if (request !== generation)
                    return { ok: false, error: 'cancelled' };
                task = null;
                if (!current()) return { ok: false, error: 'source-changed' };
                if (!result.ok) return { ...result, ruleIndex };
                output = result.output;
                matches += result.matches;
                if (matches > 10_000)
                    return { ok: false, error: 'too-many-matches', ruleIndex };
            }
            const result = { ok: true as const, output, matches };
            reviewed = result;
            return result;
        },
        apply() {
            if (!current() || !reviewed)
                return { ok: false, error: 'source-changed' };
            const start = selected ? range.start : 0;
            const end = selected ? range.end : baseline.length;
            const after =
                baseline.slice(0, start) +
                reviewed.output +
                baseline.slice(end);
            const changed = after !== baseline;
            if (changed) {
                options.write(start, end, reviewed.output);
                if (options.read() !== after)
                    return { ok: false, error: 'source-changed' };
                undo = { before: baseline, after, range: { ...range } };
                baseline = after;
                range.end = start + reviewed.output.length;
            }
            invalidate();
            return { ok: true, changed };
        },
        undo() {
            if (!undo || !current() || options.read() !== undo.after)
                return false;
            options.write(0, baseline.length, undo.before);
            if (options.read() !== undo.before) return false;
            baseline = undo.before;
            range = undo.range;
            undo = null;
            invalidate();
            return true;
        },
    };
}

interface RegexRule {
    id: number;
    pattern: string;
    replacement: string;
    error: string;
}

export interface RegexToolsBindings {
    regexControls: VueRef<HTMLElement | null>;
    regexRules: VueRef<RegexRule[]>;
    regexRemoveIcon: typeof cdxIconTrash;
    regexFlags: VueRef<string>;
    regexPending: VueRef<boolean>;
    regexResult: VueRef<Extract<RegexReplacementResult, { ok: true }> | null>;
    regexError: VueRef<string>;
    regexFlagsError: VueRef<string>;
    regexCanUndo: VueRef<boolean>;
    regexNotice: VueRef<string>;
    regexChanged(): void;
    regexAddRule(): void;
    regexRemoveRule(id: number): void;
    regexPreview(force?: boolean): Promise<void>;
    regexApply(): void;
    regexUndo(): void;
    regexComplete(event?: KeyboardEvent): void;
    regexPaste(): void;
    regexCompositionStart(): void;
    regexCompositionEnd(): void;
    disposeRegex(): void;
}

export function createRegexToolsBindings(
    Vue: VueModule,
    session?: RegexToolsSession,
): RegexToolsBindings {
    const regexControls = Vue.ref<HTMLElement | null>(null);
    let nextRuleId = 0;
    function newRule(): RegexRule {
        return { id: nextRuleId++, pattern: '', replacement: '', error: '' };
    }
    const regexRules = Vue.ref<RegexRule[]>([newRule(), newRule()]);
    const regexFlags = Vue.ref('g');
    const regexPending = Vue.ref(false);
    const regexResult = Vue.ref<Extract<
        RegexReplacementResult,
        { ok: true }
    > | null>(null);
    const regexError = Vue.ref('');
    const regexFlagsError = Vue.ref('');
    const regexCanUndo = Vue.ref(false);
    const regexNotice = Vue.ref('');
    let generation = 0;
    let lastSignature = '';
    let disposed = false;
    let composing = false;
    let compositionTimer: ReturnType<typeof setTimeout> | undefined;
    let pasteTimer: ReturnType<typeof setTimeout> | undefined;
    function regexChanged(): void {
        generation++;
        session?.invalidate();
        regexPending.value = false;
        regexResult.value = null;
        regexError.value = '';
        for (const rule of regexRules.value) rule.error = '';
        regexFlagsError.value = '';
        regexNotice.value = '';
        lastSignature = '';
    }
    function focusRule(id?: number): void {
        const selector =
            id === undefined
                ? '[data-kanade-source-editor-regex-add]'
                : `[data-kanade-source-editor-regex-pattern="${id}"] input`;
        regexControls.value?.querySelector<HTMLElement>(selector)?.focus();
    }
    function showError(error: RegexReplacementError, rule?: RegexRule): void {
        const message = msg(`regex.error.${error}`);
        if (error === 'pattern-required' || error === 'invalid-pattern') {
            if (rule) rule.error = message;
            focusRule(rule?.id);
        } else if (error === 'invalid-flags') {
            regexFlagsError.value = message;
            const details = regexControls.value?.querySelector('details');
            if (details) details.open = true;
            regexControls.value
                ?.querySelector<HTMLInputElement>(
                    '[data-kanade-source-editor-regex-flags] input',
                )
                ?.focus();
        } else if (error !== 'cancelled') regexError.value = message;
    }
    async function regexPreview(force = true): Promise<void> {
        if (disposed) return;
        const activeRules = regexRules.value.filter(
            (rule) => rule.pattern || rule.replacement,
        );
        if (!activeRules.length) activeRules.push(regexRules.value[0]);
        const drafts = activeRules.map((rule) => ({
            pattern: rule.pattern,
            replacement: rule.replacement,
            flags: regexFlags.value,
        }));
        const signature = JSON.stringify(drafts);
        if (signature === lastSignature && regexPending.value) return;
        if (
            !force &&
            (signature === lastSignature ||
                !drafts.some((draft) => draft.pattern))
        )
            return;
        regexChanged();
        lastSignature = signature;
        const request = generation;
        regexPending.value = true;
        const result: RegexToolsPreviewResult = session
            ? await session.preview(drafts)
            : { ok: false as const, error: 'unavailable' as const };
        if (request !== generation || disposed) return;
        regexPending.value = false;
        if (result.ok) regexResult.value = result;
        else {
            lastSignature = '';
            showError(result.error, activeRules[result.ruleIndex ?? 0]);
        }
    }
    function regexApply(): void {
        if (disposed || regexPending.value || !regexResult.value) return;
        try {
            const result = session?.apply();
            if (!result || !result.ok) {
                regexResult.value = null;
                showError(result?.error ?? 'unavailable');
                return;
            }
            regexChanged();
            if (result.changed) regexCanUndo.value = true;
            regexNotice.value = msg(
                result.changed ? 'regex.applied' : 'regex.noChanges',
            );
        } catch {
            regexError.value = msg('regex.error.source-changed');
            regexResult.value = null;
        }
    }
    function regexUndo(): void {
        if (disposed || regexPending.value) return;
        try {
            if (!session?.undo()) {
                regexError.value = msg('regex.undoUnavailable');
                return;
            }
            regexChanged();
            regexCanUndo.value = false;
            regexNotice.value = msg('regex.undone');
        } catch {
            regexError.value = msg('regex.undoUnavailable');
        }
    }
    function disposeRegex(): void {
        disposed = true;
        clearTimeout(pasteTimer);
        clearTimeout(compositionTimer);
        regexChanged();
    }
    Vue.onUnmounted?.(disposeRegex);
    return {
        regexControls,
        regexRules,
        regexRemoveIcon: cdxIconTrash,
        regexFlags,
        regexPending,
        regexResult,
        regexError,
        regexFlagsError,
        regexCanUndo,
        regexNotice,
        regexChanged,
        regexAddRule() {
            const rule = newRule();
            regexRules.value.push(rule);
            regexChanged();
            queueMicrotask(() => {
                if (!disposed) focusRule(rule.id);
            });
        },
        regexRemoveRule(id) {
            if (regexRules.value.length === 1) return;
            const index = regexRules.value.findIndex((rule) => rule.id === id);
            if (index < 0) return;
            regexRules.value.splice(index, 1);
            regexChanged();
            queueMicrotask(() => {
                if (!disposed)
                    focusRule(
                        regexRules.value[
                            Math.min(index, regexRules.value.length - 1)
                        ]?.id,
                    );
            });
        },
        regexPreview,
        regexApply,
        regexUndo,
        disposeRegex,
        regexComplete(event) {
            if (composing || event?.isComposing || event?.keyCode === 229)
                return;
            event?.preventDefault();
            void regexPreview(false);
        },
        regexPaste() {
            clearTimeout(pasteTimer);
            pasteTimer = setTimeout(() => {
                void regexPreview(false);
            }, 0);
        },
        regexCompositionStart() {
            clearTimeout(compositionTimer);
            composing = true;
        },
        regexCompositionEnd() {
            compositionTimer = setTimeout(() => {
                composing = false;
            }, 0);
        },
    };
}
