/**
 * @file src/library/mediawiki-runtime/contracts.ts
 * Purpose: Shared minimum contracts for the host-owned Vue runtime.
 * Contents: Reactive references, owned applications, and module loading ports.
 */

export interface VueRef<T> {
    value: T;
}

export interface VueApp {
    component(name: string, component: unknown): void;
    mount(host: HTMLElement): void;
    unmount(): void;
}

export interface VueCore {
    createMwApp(component: unknown): VueApp;
    defineComponent(component: unknown): unknown;
    ref<T>(value: T): VueRef<T>;
}

export type HostModuleRequire = (name: string) => unknown;

export interface HostModuleLoader {
    using(modules: string[]): PromiseLike<HostModuleRequire>;
}
