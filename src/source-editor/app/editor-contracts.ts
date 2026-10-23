/**
 * @file src/source-editor/app/editor-contracts.ts
 * Purpose: Contracts between the Source Editor composition root and editor UI.
 *
 * Table of contents:
 * 1. Imports
 * 2. EditorServices
 */

import type { WikiPolicy } from '../domain/wiki-policy.ts';
import type { ActionNotifier } from '../../library/notifications/contracts.ts';
import type { Logger } from '../../library/logging/logger.ts';

import type { HighlightOptions } from '../../library/wikitext-highlighting/highlighter.ts';
import type { PagePreviewTarget } from '../../library/wikitext-highlighting/highlight-partition.ts';
import type { FormatterSettings } from '../domain/formatter-settings.ts';
import type { ReferenceFormattingOptions } from '../domain/formatting.ts';
import type { PageSummaryResult } from '../domain/page-summary.ts';
import type {
    RegexReplacementDraft,
    RegexReplacementTask,
} from '../domain/regex-replacement.ts';

import type { SourceEditorOptions } from '../domain/runtime-options.ts';

import type { EditorHost } from './contracts/editor-backend.ts';

export interface EditorServices {
    readonly editorHost?: EditorHost;
    readonly runtimeOptions?: SourceEditorOptions;
    startRegexReplacement?(
        request: RegexReplacementDraft & { source: string },
    ): RegexReplacementTask;
    readonly wikiPolicy: WikiPolicy;
    readonly contentLanguage?: string;
    logger: Logger;
    notify: ActionNotifier;

    openReferences?(settings?: FormatterSettings): Promise<void>;

    applyFormatterSettings?(settings: FormatterSettings): void;

    registerPanelOpener?(
        openPanel: (
            initialTab?: 'formatting' | 'references' | 'editor' | 'tools',
        ) => Promise<void>,
    ): void;

    loadCitationFormattingContext?(
        source: string,
    ): Promise<
        Pick<
            ReferenceFormattingOptions,
            'runtimeTemplateData' | 'templateNameContext'
        >
    >;

    findMissingLinks(source: string): Promise<{
        checkedTitles: Set<string>;
        linkClasses: string[];
        missingTitles: Set<string>;
    }>;

    getHighlightOptions(): HighlightOptions;

    isSectionEditing(): boolean;

    loadFormatterSettings(): FormatterSettings;

    loadNamespaces(): Promise<void>;

    loadPageSource(): Promise<string>;

    loadPageSummary(target: PagePreviewTarget): Promise<PageSummaryResult>;

    resolveRedirects(
        source: string,
        options: { includeTemplates: boolean },
    ): Promise<string>;

    resetFormatterSettings(): void;

    saveFormatterSettings(settings: FormatterSettings): void;
}
