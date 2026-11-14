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

import type { FormatterSettings } from '../domain/formatter-settings.ts';
import type { ReferenceFormattingOptions } from '../domain/formatting.ts';

export interface EditorServices {
    readonly wikiPolicy: WikiPolicy;
    readonly contentLanguage?: string;
    logger: Logger;
    notify: ActionNotifier;

    openReferences?(settings?: FormatterSettings): Promise<void>;

    applyFormatterSettings?(settings: FormatterSettings): void;

    registerPanelOpener?(
        openPanel: (initialTab?: 'formatting' | 'references') => Promise<void>,
    ): void;

    loadCitationFormattingContext?(
        source: string,
    ): Promise<
        Pick<
            ReferenceFormattingOptions,
            'runtimeTemplateData' | 'templateNameContext'
        >
    >;

    isSectionEditing(): boolean;

    loadFormatterSettings(): FormatterSettings;

    resolveRedirects(
        source: string,
        options: { includeTemplates: boolean },
    ): Promise<string>;

    resetFormatterSettings(): void;

    saveFormatterSettings(settings: FormatterSettings): void;
}
