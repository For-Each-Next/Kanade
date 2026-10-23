/**
 * @file src/rev-copy/platform/mediawiki/notification.ts
 * Purpose: Show completed-copy feedback with a scoped Codex toast and host fallback.
 *
 * Contents: Lazy host runtime, top-right placement, and notification lifecycle.
 */

import { loadHostModules } from '../../../library/mediawiki-runtime/modules.ts';
import styles from './notification.css';

interface ToastRuntime {
    h(
        component: unknown,
        props: Record<string, unknown>,
        slots: unknown,
    ): unknown;
    render(node: unknown, container: Element): void;
    nextTick(): Promise<void>;
    toast: unknown;
}

let loading: Promise<ToastRuntime> | undefined;
let generation = 0;
let dismiss: (() => void) | undefined;

function loadToast(): Promise<ToastRuntime> {
    loading ??= (async () => {
        const require = await loadHostModules(mw.loader, [
            'vue',
            '@wikimedia/codex',
        ]);
        const vue = require('vue') as Omit<ToastRuntime, 'toast'>;
        const { CdxToast } = require('@wikimedia/codex') as {
            CdxToast?: unknown;
        };
        if (!vue.h || !vue.render || !vue.nextTick || !CdxToast) {
            throw new Error('The Codex toast runtime is unavailable.');
        }
        return { ...vue, toast: CdxToast };
    })().catch((error: unknown) => {
        loading = undefined;
        throw error;
    });
    return loading;
}

function ensureStyles(): void {
    if (document.getElementById('kanade-rev-copy-notification-styles')) return;
    const style = document.createElement('style');
    style.id = 'kanade-rev-copy-notification-styles';
    style.textContent = styles;
    document.head.append(style);
}

/** Call after the clipboard promise succeeds; feedback failures never reject it. */
export async function notifyCopySuccess(message: string): Promise<void> {
    const ticket = ++generation;
    try {
        const runtime = await loadToast();
        if (ticket !== generation) return;
        dismiss?.();
        ensureStyles();
        const mount = document.createElement('div');
        mount.id = 'kanade-rev-copy-copy-notification';
        document.body.append(mount);
        const opener = document.activeElement;
        const cleanup = (): void => {
            runtime.render(null, mount);
            mount.remove();
            if (dismiss === cleanup) dismiss = undefined;
        };
        dismiss = cleanup;
        // Standalone mode isolates this gadget from other apps' global toast queue.
        runtime.render(
            runtime.h(
                runtime.toast,
                {
                    type: 'success',
                    standalone: true,
                    renderInPlace: true,
                    autoDismiss: 4000,
                    onUserDismissed: cleanup,
                    onAutoDismissed: cleanup,
                },
                { default: () => message },
            ),
            mount,
        );
        await runtime.nextTick();
        // Codex focuses new toasts; a copy confirmation should retain editing focus.
        if (
            opener instanceof HTMLElement &&
            opener.isConnected &&
            mount.contains(document.activeElement)
        ) {
            opener.focus({ preventScroll: true });
        }
    } catch {
        if (ticket !== generation) return;
        dismiss?.();
        try {
            ensureStyles();
            await mw.notify(message, {
                tag: 'rev-copy',
                type: 'success',
                classes: 'kanade-rev-copy-notification-fallback',
                autoHide: true,
            });
        } catch {
            // Notification delivery cannot turn a successful clipboard write into a failure.
        }
    }
}
