/**
 * @file src/wpvg-assessor/features/assessment/dialog-mount.ts
 * Purpose: Own one assessor dialog's Vue application, host, and teardown.
 * Contents: Mount contracts and failure-safe, idempotent lifecycle.
 */

import {
    registerPageAssessorComponents,
    type ResourceLoaderRequire,
    type VueApp,
    type VueModule,
} from './codex.ts';

interface DialogMountOptions {
    require: ResourceLoaderRequire;
    createComponent(Vue: VueModule, close: () => void): unknown;
    onClose(): void;
    onDispose(): void;
}

/** Mounts only an owned host and releases it even when setup fails. */
export function mountAssessorDialog(options: DialogMountOptions): () => void {
    const host = document.createElement('div');
    host.id = 'kanade-wpvg-assessor-dialog-host';
    document.documentElement.append(host);
    let application: VueApp | undefined;
    let disposed = false;

    function dispose(): void {
        if (disposed) return;
        disposed = true;
        try {
            application?.unmount();
        } finally {
            try {
                options.onDispose();
            } finally {
                host.remove();
            }
        }
    }

    try {
        const Vue = options.require('vue');
        const component = options.createComponent(Vue, () => {
            if (disposed) return;
            dispose();
            options.onClose();
        });
        if (disposed) return dispose;
        application = Vue.createMwApp(component);
        if (disposed) {
            application.unmount();
            return dispose;
        }
        registerPageAssessorComponents(
            application,
            options.require('@wikimedia/codex'),
        );
        if (!disposed) application.mount(host);
    } catch (error) {
        try {
            dispose();
        } catch {
            // Preserve the setup failure after releasing the host and session.
        }
        throw error;
    }
    return dispose;
}
