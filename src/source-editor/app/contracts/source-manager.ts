/**
 * @file src/source-editor/app/contracts/source-manager.ts
 * Purpose: Public configuration and injected ports for the source-manager UI.
 *
 * Table of contents:
 * 1. Imports
 * 2. ReferenceStyle
 * 3. SourceManagerOptions
 * 4. SourceArchiveMetadata
 * 5. ResolvedSourceMetadata
 * 6. SourceManagerDependencies
 * 7. OpenSourceManagerDialog
 */

import type { Cs1ReviewWorkflow } from './cs1-review.ts';
import type {
    CitationLayout,
    CitationTemplateDataMap,
} from '../../domain/types.ts';
import type { TemplateNameContext } from '../../domain/templates.ts';
import type { EditBox } from './editor.ts';
import type { Logger } from '../../../library/logging/logger.ts';
import type { ScriptTitleMode } from '../../domain/script-title-policy.ts';
import type { ActionNotifier } from '../../../library/notifications/contracts.ts';

export type ReferenceStyle = 'r' | 'ref';

export interface SourceManagerOptions {
    citationLayout?: CitationLayout;
    referenceStyle?: ReferenceStyle;
    separateReferenceDefinitions?: boolean;
    formatScriptTitles?: boolean;
    scriptTitleMode?: ScriptTitleMode;
}

export interface SourceArchiveMetadata {
    archiveDate: string;
    archiveUrl: string;
}

export interface ResolvedSourceMetadata extends SourceArchiveMetadata {
    archiveError: string;
    citeTemplate: string;
    metadataError: string;
    originalUrl: string;
}

export interface SourceManagerWikiContext {
    readonly wikiId: string;
    readonly wikiPolicy: import('../../domain/wiki-policy.ts').WikiPolicy;
    readonly contentLanguage?: string;
    readonly pageTitle: string;
}

export interface SourceManagerDependencies {
    readonly wiki: SourceManagerWikiContext;
    loadModules(
        modules: readonly string[],
    ): Promise<
        import('../../../library/mediawiki-runtime/contracts.ts').HostModuleRequire
    >;
    openFormattingSettings?(): Promise<void>;
    writePreservingPosition(editor: EditBox, text: string): void;
    cs1Review: Cs1ReviewWorkflow;
    fetchAvailableArchive: (
        originalUrl: string,
    ) => Promise<SourceArchiveMetadata | null>;
    resolveSourceMetadata: (
        sourceInput: string,
        archiveSeed: SourceArchiveMetadata | null,
    ) => Promise<ResolvedSourceMetadata>;
    loadCitationTemplateData: (
        names: string[],
    ) => Promise<CitationTemplateDataMap>;
    loadTemplateNameContext: () => Promise<TemplateNameContext>;
    logger: Logger;
    notifyAction: ActionNotifier;
    resolveWikiLink: (value: string) => Promise<string>;
}

export type OpenSourceManagerDialog = (
    editor: EditBox,
    options?: SourceManagerOptions,
) => Promise<void>;
