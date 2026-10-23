/**
 * @file src/wpvg-assessor/app/archive-contracts.ts
 * Purpose: Reviewed new-page archiving contracts and partial-save recovery errors.
 *
 * Contents: Archive snapshots, reviewed writes, workflow ports, and recovery errors.
 */

import type { NewPageListSnapshot } from '../domain/types.ts';

export interface ArchivePageSnapshot {
    readonly title: string;
    readonly text: string;
    readonly exists: boolean;
    readonly revisionId: number | null;
    readonly basetimestamp: string | null;
    readonly starttimestamp: string;
}

interface ArchiveSourceReview {
    readonly title: string;
    readonly snapshot: Readonly<NewPageListSnapshot>;
    readonly proposedText: string;
}

interface ArchiveDestinationReview {
    readonly title: string;
    readonly year: number;
    readonly months: ReadonlyArray<number>;
    readonly recordCount: number;
    readonly snapshot: ArchivePageSnapshot;
    readonly proposedText: string;
}

export interface ArchiveReview {
    readonly cutoff: string;
    readonly recordCount: number;
    readonly source: ArchiveSourceReview;
    readonly archives: ReadonlyArray<ArchiveDestinationReview>;
}

export interface ArchiveSavePhase {
    readonly kind: 'archive' | 'source';
    readonly title: string;
}

export interface NewPageArchiveWorkflow {
    open(api: mw.Api): Promise<ArchiveReview>;
    save(
        api: mw.Api,
        review: ArchiveReview,
        summary: string,
        reportPhase: (phase: ArchiveSavePhase) => void,
    ): Promise<void>;
}

export interface NewPageArchivePorts {
    readonly sourceTitle: string;
    fetchNewPageList(api: mw.Api): Promise<NewPageListSnapshot>;
    fetchPageText(api: mw.Api, title: string): Promise<ArchivePageSnapshot>;
    savePreparedNewPageList(
        api: mw.Api,
        snapshot: NewPageListSnapshot,
        proposedText: string,
        summary: string,
    ): Promise<void>;
    saveArchivePage(
        api: mw.Api,
        snapshot: ArchivePageSnapshot,
        proposedText: string,
        summary: string,
    ): Promise<void>;
    now(): Date;
}

export type ArchiveSaveErrorCode =
    'review-changed' | 'archive-conflict' | 'save-failed';

/** Contains confirmed destinations so a fresh preview can recover safely. */
export class ArchiveSaveError extends Error {
    readonly code: ArchiveSaveErrorCode;
    readonly title: string;
    readonly savedArchiveTitles: ReadonlyArray<string>;

    constructor(
        code: ArchiveSaveErrorCode,
        title: string,
        savedArchiveTitles: ReadonlyArray<string>,
        cause?: unknown,
    ) {
        const detail =
            cause instanceof Error ? cause.message : String(cause ?? '');
        const description =
            code === 'review-changed'
                ? 'The reviewed page changed. Reload the archive preview before saving.'
                : code === 'archive-conflict'
                  ? 'The archive contains conflicting records. Resolve the conflict and reload the preview.'
                  : 'The archive operation stopped. Reload the preview to check the saved pages before continuing.';
        super(`${title}: ${description}${detail ? ` ${detail}` : ''}`, {
            cause,
        });
        this.name = 'ArchiveSaveError';
        this.code = code;
        this.title = title;
        this.savedArchiveTitles = Object.freeze([...savedArchiveTitles]);
    }
}
