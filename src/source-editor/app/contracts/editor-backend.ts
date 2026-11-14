/**
 * @file src/source-editor/app/contracts/editor-backend.ts
 * Purpose: Consumer requirements for interoperable host-editor access.
 * Contents: Backing-editor operations and position-preserving writes.
 */

import type { EditBoxBackend as HostEditBoxBackend } from '../../../library/mediawiki-edit-box/contracts.ts';

export interface EditBoxBackend extends HostEditBoxBackend {
    writePreservingPosition(text: string): void;
}
