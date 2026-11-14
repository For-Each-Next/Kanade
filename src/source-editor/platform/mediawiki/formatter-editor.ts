/**
 * @file src/source-editor/platform/mediawiki/formatter-editor.ts
 * Purpose: Apply formatter edits through the active native textarea or MediaWiki CodeMirror.
 * Contents: Stable host identity, live source and selection, composition guards, and transactions.
 */

import {
    findCodeMirror,
    focusCodeMirror,
    readCodeMirror,
    registerCodeMirrorHooks,
} from '../../../library/mediawiki-edit-box/code-mirror.ts';
import type { CodeMirrorEditor } from '../../../library/mediawiki-edit-box/contracts.ts';
import { getEditBoxBackend } from '../editor-backend.ts';
import { dispatchNativeInput } from '../browser/events.ts';

const compositions = new WeakMap<HTMLTextAreaElement, { active: boolean }>();

const adapters = new WeakMap<
    HTMLTextAreaElement,
    {
        owner: CodeMirrorEditor | null;
        adapter: ReturnType<typeof createFormatterEditor>;
    }
>();

/** Observes existing host editors; never creates or enables CodeMirror. */
export function getFormatterEditor(textarea: HTMLTextAreaElement) {
    registerCodeMirrorHooks();
    if (!compositions.has(textarea)) {
        const state = { active: false };
        compositions.set(textarea, state);
        textarea.addEventListener('compositionstart', () => {
            state.active = true;
        });
        textarea.addEventListener('compositionend', () => {
            state.active = false;
        });
    }
    const owner = findCodeMirror(textarea);
    const existing = adapters.get(textarea);
    if (existing?.owner === owner) return existing.adapter;
    const adapter = createFormatterEditor(textarea, owner);
    adapters.set(textarea, { owner, adapter });
    return adapter;
}

function createFormatterEditor(
    textarea: HTMLTextAreaElement,
    owner: CodeMirrorEditor | null,
) {
    return {
        getVersion: () => owner?.view?.state,
        read: () => (owner ? readCodeMirror(owner) : textarea.value),
        getSelection: () => {
            const range = owner?.view?.state?.selection?.main;
            return range
                ? { start: range.from, end: range.to }
                : {
                      start: textarea.selectionStart,
                      end: textarea.selectionEnd,
                  };
        },
        isAttached: () =>
            textarea.isConnected &&
            findCodeMirror(textarea) === owner &&
            !getEditBoxBackend(textarea) &&
            !window.wikEd?.useWikEd &&
            (owner != null ||
                (!textarea.hidden &&
                    textarea.getAttribute('aria-hidden') !== 'true')),
        isComposing: () =>
            owner?.view?.composing === true ||
            compositions.get(textarea)?.active === true,
        replace(start: number, end: number, value: string): void {
            if (
                !this.isAttached() ||
                this.isComposing() ||
                textarea.readOnly ||
                textarea.disabled
            ) {
                throw new Error('The source editor changed or is unavailable.');
            }
            if (owner) {
                const view = owner.view;
                if (!view?.dispatch)
                    throw new Error(
                        'The active CodeMirror document is unavailable.',
                    );
                view.dispatch({
                    changes: { from: start, to: end, insert: value },
                    selection: { anchor: start, head: start + value.length },
                    scrollIntoView: true,
                });
                focusCodeMirror(owner);
            } else {
                textarea.setRangeText(value, start, end, 'select');
                dispatchNativeInput(textarea);
                textarea.focus({ preventScroll: true });
            }
        },
    };
}
