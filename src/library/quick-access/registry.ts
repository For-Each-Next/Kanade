/**
 * @file src/library/quick-access/registry.ts
 * Purpose: Share native Codex quick-access controls across existing tool owners.
 * Contents: Page registry, lazy host rendering, action ownership, and disposal.
 */

import styles from './styles.css';

export interface QuickAccessAction {
    id: string;
    label: string;
    title?: string;
    href?: string;
    target?: '_blank';
    activate?(event: MouseEvent): void | Promise<void>;
}

interface Renderer {
    h(
        type: unknown,
        props: Record<string, unknown>,
        children: unknown,
    ): unknown;
    render(node: unknown, target: Element): void;
    button: unknown;
}

interface Registration {
    action: QuickAccessAction;
    token: object;
}

interface QuickAccessRegistry {
    actions: Map<string, Registration>;
    mount?: HTMLElement;
    style?: HTMLStyleElement;
    renderer?: Renderer;
    loading?: Promise<void>;
    ready?: () => void;
    onPageHide: (event: PageTransitionEvent) => void;
    disposed: boolean;
}

const REGISTRY_KEY = Symbol.for('kanade.quick-access.v1');
const ACTION_ORDER = ['source-editor', 'source-editor-tools'];
/** Registers one current owner's action; an older disposer cannot remove its replacement. */
export function registerQuickAccessAction(
    action: QuickAccessAction,
): () => void {
    const page = window as unknown as Record<PropertyKey, unknown>;
    let registry = page[REGISTRY_KEY] as QuickAccessRegistry | undefined;
    if (registry == null || registry.disposed) {
        registry = {
            actions: new Map(),
            disposed: false,
            onPageHide: () => {},
        };
        const current = registry;
        registry.onPageHide = (event) => {
            if (!event.persisted) dispose(current);
        };
        window.addEventListener('pagehide', registry.onPageHide);
        page[REGISTRY_KEY] = registry;
    }
    const current = registry;
    const token = {};
    current.actions.set(action.id, { action, token });
    refresh(current);
    return () => {
        if (current.actions.get(action.id)?.token !== token) return;
        current.actions.delete(action.id);
        if (current.actions.size === 0) dispose(current);
        else refresh(current);
    };
}

function refresh(registry: QuickAccessRegistry): void {
    if (registry.disposed) return;
    if (!document.body) {
        if (!registry.ready) {
            registry.ready = () => {
                registry.ready = undefined;
                refresh(registry);
            };
            document.addEventListener('DOMContentLoaded', registry.ready, {
                once: true,
            });
        }
        return;
    }
    if (registry.renderer) {
        draw(registry);
        return;
    }
    if (registry.loading) return;
    registry.loading = (async () => {
        try {
            const require = await mw.loader.using(['vue', '@wikimedia/codex']);
            if (registry.disposed) return;
            if (typeof require !== 'function')
                throw new Error('Host renderer unavailable');
            const vue = require('vue') as unknown as Omit<Renderer, 'button'>;
            const codex = require('@wikimedia/codex') as {
                CdxButton?: unknown;
            };
            if (!vue.h || !vue.render || !codex.CdxButton)
                throw new Error('Host controls unavailable');
            registry.renderer = {
                h: vue.h,
                render: vue.render,
                button: codex.CdxButton,
            };
            draw(registry);
        } catch (error) {
            if (!registry.disposed)
                console.error(
                    '[Kanade] Quick-access controls unavailable',
                    error,
                );
        } finally {
            registry.loading = undefined;
        }
    })();
}

function draw(registry: QuickAccessRegistry): void {
    const renderer = registry.renderer;
    if (registry.disposed || !renderer || !document.body) return;
    if (!registry.mount?.isConnected) {
        if (registry.mount) renderer.render(null, registry.mount);
        const mount = document.createElement('div');
        mount.id = 'kanade-quick-access';
        mount.className = 'kanade-quick-access';
        mount.setAttribute('role', 'group');
        mount.setAttribute('aria-label', 'Kanade');
        document.body.append(mount);
        registry.mount = mount;
    }
    if (!registry.style?.isConnected) {
        const style = document.createElement('style');
        style.textContent = styles;
        document.head.append(style);
        registry.style = style;
    }
    const actions = [...registry.actions.values()].sort(
        (left, right) =>
            rank(left.action.id) - rank(right.action.id) ||
            left.action.id.localeCompare(right.action.id),
    );
    renderer.render(
        renderer.h(
            'div',
            { class: 'kanade-quick-access__actions' },
            actions.map(({ action, token }) => {
                const attributes: Record<string, unknown> = {
                    key: action.id,
                    'data-kanade-quick-access-action': action.id,
                    title: action.title ?? action.label,
                    onClick(event: MouseEvent) {
                        if (registry.actions.get(action.id)?.token !== token)
                            return;
                        try {
                            void Promise.resolve(
                                action.activate?.(event),
                            ).catch((error: unknown) => {
                                console.error(
                                    '[Kanade] Quick-access action failed',
                                    error,
                                );
                            });
                        } catch (error) {
                            console.error(
                                '[Kanade] Quick-access action failed',
                                error,
                            );
                        }
                    },
                };
                if (action.href) {
                    return renderer.h(
                        'a',
                        {
                            ...attributes,
                            class: 'cdx-button cdx-button--fake-button cdx-button--fake-button--enabled',
                            href: action.href,
                            target: action.target,
                            rel:
                                action.target === '_blank'
                                    ? 'noopener noreferrer'
                                    : undefined,
                        },
                        action.label,
                    );
                }
                return renderer.h(
                    renderer.button,
                    { ...attributes, type: 'button' },
                    { default: () => action.label },
                );
            }),
        ),
        registry.mount,
    );
}

function rank(id: string): number {
    const position = ACTION_ORDER.indexOf(id);
    return position === -1 ? ACTION_ORDER.length : position;
}

function dispose(registry: QuickAccessRegistry): void {
    if (registry.disposed) return;
    registry.disposed = true;
    registry.actions.clear();
    window.removeEventListener('pagehide', registry.onPageHide);
    if (registry.ready)
        document.removeEventListener('DOMContentLoaded', registry.ready);
    if (registry.renderer && registry.mount)
        registry.renderer.render(null, registry.mount);
    registry.mount?.remove();
    registry.style?.remove();
    const page = window as unknown as Record<PropertyKey, unknown>;
    if (page[REGISTRY_KEY] === registry) delete page[REGISTRY_KEY];
}
