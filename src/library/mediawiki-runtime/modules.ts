/**
 * @file src/library/mediawiki-runtime/modules.ts
 * Purpose: Reuse equal host-module loads without owning a tool or mounted UI.
 * Contents: Loader-scoped request identity, successful reuse, and failure retry.
 */

import type { HostModuleLoader, HostModuleRequire } from './contracts.ts';

const requests = new WeakMap<
    HostModuleLoader,
    Map<string, Promise<HostModuleRequire>>
>();

/** Callers retain page/session checks and decide whether a result can mount. */
export function loadHostModules(
    loader: HostModuleLoader,
    modules: readonly string[],
): Promise<HostModuleRequire> {
    let ownedRequests = requests.get(loader);
    if (!ownedRequests) {
        ownedRequests = new Map();
        requests.set(loader, ownedRequests);
    }
    const requested = [...new Set(modules)];
    const key = JSON.stringify(requested.toSorted());
    const existing = ownedRequests.get(key);
    if (existing) return existing;
    let result: PromiseLike<HostModuleRequire>;
    try {
        result = loader.using(requested);
    } catch (error) {
        result = Promise.reject(error);
    }
    const pending = Promise.resolve(result).catch((error: unknown) => {
        if (ownedRequests.get(key) === pending) ownedRequests.delete(key);
        throw error;
    });
    ownedRequests.set(key, pending);
    return pending;
}
