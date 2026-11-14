/**
 * @file src/source-editor/platform/editor-backend.ts
 * Purpose: Share one source-editing contract between Source Editor's editor and references.
 * Contents: Validation and lookup of host-owned backing editors.
 */

import type { EditBoxBackend } from '../app/contracts/editor-backend.ts';

// Keep the neutral key so other wiki tools can use the active editor safely.
const BACKEND_KEY = Symbol.for('mediawiki-gadgets.edit-box-backend');

export function getEditBoxBackend(
    textarea: HTMLTextAreaElement | null,
): EditBoxBackend | null {
    if (textarea == null) return null;
    const target = textarea as unknown as Record<PropertyKey, unknown>;
    const backend = target[BACKEND_KEY];
    if (typeof backend !== 'object' || backend === null) return null;
    return [
        'focus',
        'read',
        'replaceSelection',
        'write',
        'writePreservingPosition',
    ].every(
        (operation) =>
            typeof (backend as Record<string, unknown>)[operation] ===
            'function',
    )
        ? (backend as EditBoxBackend)
        : null;
}
