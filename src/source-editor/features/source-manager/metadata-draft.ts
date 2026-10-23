/**
 * @file src/source-editor/features/source-manager/metadata-draft.ts
 * Purpose: Applies resolved source metadata to editable citation drafts.
 *
 * Table of contents:
 * 1. Imports
 * 2. createArchiveSeed
 * 3. formatMetadataFailure
 * 4. createLookupFallbackDraft
 * 5. applyResolvedMetadata
 * 6. buildMetadataWarnings
 * 7. setSourceDraftValue
 */

import {
    createManualSourceDraft,
    parseSourceDraft,
    type ParsedSourceInput,
    type SourceDraft,
} from '../../domain/source-manager.ts';
import { msg } from '../../i18n/index.ts';
import type {
    ResolvedSourceMetadata,
    SourceArchiveMetadata,
} from '../../app/contracts/source-manager.ts';

/**
 * Creates an archive seed only when the entered source is archived.
 *
 * @param parsed - Parsed value.
 * @returns Archive seed when the entered source is archived.
 */
export function createArchiveSeed(
    parsed: ParsedSourceInput,
): SourceArchiveMetadata | null {
    return parsed.archiveUrl === ''
        ? null
        : {
              archiveDate: parsed.archiveDate,
              archiveUrl: parsed.archiveUrl,
          };
}

/**
 * Formats the fallback warning after metadata resolution fails.
 *
 * @param error - Error value to inspect.
 * @param formatError - Format error value.
 * @returns Fallback warning after metadata resolution fails.
 */
export function formatMetadataFailure(
    error: unknown,
    formatError: (error: unknown) => string,
): string {
    return [
        msg('lookup.metadataUnavailable', { error: formatError(error) }),
        msg('lookup.manualFallback'),
    ].join(' ');
}

/**
 * Builds an editable fallback after an unexpected lookup failure.
 *
 * @param parsed - Parsed value.
 * @returns Built editable fallback after an unexpected lookup failure.
 */
export function createLookupFallbackDraft(
    parsed: ParsedSourceInput,
): SourceDraft {
    if (parsed.originalUrl !== '') {
        return parseSourceDraft(`{{Cite web | url = ${parsed.originalUrl}}}`);
    }
    return createManualSourceDraft('cite web');
}

/**
 * Applies resolved URL and archive values to editable rows.
 *
 * @param draft - Source draft to process.
 * @param metadata - Citation metadata.
 * @param liveOriginal - Live original value.
 */
export function applyResolvedMetadata(
    draft: SourceDraft,
    metadata: ResolvedSourceMetadata,
    liveOriginal: boolean,
): void {
    if (metadata.originalUrl !== '') {
        setSourceDraftValue(draft, 'url', metadata.originalUrl);
    }
    setSourceDraftValue(draft, 'archive-url', metadata.archiveUrl);
    setSourceDraftValue(draft, 'archive-date', metadata.archiveDate);
    if (metadata.archiveUrl !== '' && liveOriginal) {
        setSourceDraftValue(draft, 'url-status', 'live');
    }
}

/**
 * Builds non-blocking service warnings for an editable draft.
 *
 * @param metadata - Citation metadata.
 * @returns Built non-blocking service warnings for an editable draft.
 */
export function buildMetadataWarnings(
    metadata: Pick<ResolvedSourceMetadata, 'archiveError' | 'metadataError'>,
): string[] {
    const warnings: string[] = [];
    if (metadata.metadataError !== '') {
        warnings.push(
            msg('lookup.metadataUnavailable', {
                error: metadata.metadataError,
            }),
        );
    }
    if (metadata.archiveError !== '') {
        warnings.push(
            msg('lookup.archiveUnavailable', {
                error: metadata.archiveError,
            }),
        );
    }
    return warnings;
}

/**
 * Assigns a draft parameter while retaining a seeded empty row.
 *
 * @param draft - Source draft to process.
 * @param name - Name to process.
 * @param value - Value to process.
 */
export function setSourceDraftValue(
    draft: SourceDraft,
    name: string,
    value: string,
): void {
    const row = draft.rows.find((candidate) => candidate.name === name);
    if (row != null) {
        row.value = value;
        return;
    }
    draft.rows.push({ alias: '', directive: '', main: false, name, value });
}
