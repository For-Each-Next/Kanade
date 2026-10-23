/**
 * @file src/source-editor/app/contracts/editor-backend.ts
 * Purpose: Consumer requirements for source editing and host registration.
 * Contents: Backing-editor operations and injected host synchronization.
 */

import type { EditBoxBackend as HostEditBoxBackend } from '../../../library/mediawiki-edit-box/contracts.ts';

export interface EditBoxBackend extends HostEditBoxBackend {
    writePreservingPosition(text: string): void;
}

export interface EditorHost {
    dispatchNativeInput(textarea: HTMLTextAreaElement): void;
    registerBackend(
        textarea: HTMLTextAreaElement,
        backend: EditBoxBackend,
    ): () => void;
}
