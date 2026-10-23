/**
 * @file src/wpvg-assessor/app/archive-new-pages.ts
 * Purpose: Prepare immutable archive reviews and save destinations before source removal.
 *
 * Contents: Review preparation, snapshot validation, and ordered archive writes.
 */

import {
    mergeNewPageListArchive,
    prepareNewPageListArchive,
} from '../domain/new-page-list-archive.ts';
import type { NewPageListSnapshot } from '../domain/types.ts';
import {
    ArchiveSaveError,
    type ArchivePageSnapshot,
    type ArchiveReview,
    type NewPageArchivePorts,
    type NewPageArchiveWorkflow,
} from './archive-contracts.ts';

/** Each save uses the exact frozen review issued by this workflow. */
export function createNewPageArchiveWorkflow(
    ports: NewPageArchivePorts,
): NewPageArchiveWorkflow {
    const reviews = new WeakSet<ArchiveReview>();
    const attempted = new WeakSet<ArchiveReview>();

    async function open(api: mw.Api): Promise<ArchiveReview> {
        const snapshot = await ports.fetchNewPageList(api);
        if (!isValidRevisionId(snapshot.revisionId)) {
            throw new ArchiveSaveError(
                'save-failed',
                ports.sourceTitle,
                [],
                new Error('The new-page list omitted its revision ID.'),
            );
        }
        const plan = prepareNewPageListArchive(snapshot.text, ports.now());
        const archives = await Promise.all(
            plan.groups.map(async (group) => {
                const destination = await ports.fetchPageText(api, group.title);
                if (
                    destination.title !== group.title ||
                    (destination.exists &&
                        !isValidRevisionId(destination.revisionId))
                ) {
                    throw new ArchiveSaveError(
                        'review-changed',
                        group.title,
                        [],
                    );
                }
                let proposedText: string;
                try {
                    proposedText = mergeNewPageListArchive(
                        destination.text,
                        group,
                    );
                } catch (cause) {
                    throw new ArchiveSaveError(
                        'archive-conflict',
                        group.title,
                        [],
                        cause,
                    );
                }
                return Object.freeze({
                    title: group.title,
                    year: group.year,
                    months: Object.freeze([...group.months]),
                    recordCount: group.recordCount,
                    snapshot: Object.freeze({ ...destination }),
                    proposedText,
                });
            }),
        );
        const review: ArchiveReview = Object.freeze({
            cutoff: plan.cutoff,
            recordCount: plan.recordCount,
            source: Object.freeze({
                title: ports.sourceTitle,
                snapshot: Object.freeze({ ...snapshot }),
                proposedText: plan.sourceText,
            }),
            archives: Object.freeze(archives),
        });
        reviews.add(review);
        return review;
    }

    async function save(
        api: mw.Api,
        review: ArchiveReview,
        summary: string,
        reportPhase: Parameters<NewPageArchiveWorkflow['save']>[3],
    ): Promise<void> {
        if (!reviews.has(review) || attempted.has(review)) {
            throw new ArchiveSaveError('review-changed', ports.sourceTitle, []);
        }
        attempted.add(review);
        if (review.recordCount === 0) {
            return;
        }
        await verifyReviewedPages(ports, api, review);
        const savedArchiveTitles: string[] = [];
        for (const archive of review.archives) {
            if (archive.proposedText === archive.snapshot.text) {
                continue;
            }
            reportPhase({ kind: 'archive', title: archive.title });
            try {
                await ports.saveArchivePage(
                    api,
                    archive.snapshot,
                    archive.proposedText,
                    summary,
                );
            } catch (cause) {
                throw new ArchiveSaveError(
                    'save-failed',
                    archive.title,
                    savedArchiveTitles,
                    cause,
                );
            }
            savedArchiveTitles.push(archive.title);
        }
        reportPhase({ kind: 'source', title: review.source.title });
        try {
            await ports.savePreparedNewPageList(
                api,
                review.source.snapshot,
                review.source.proposedText,
                summary,
            );
        } catch (cause) {
            throw new ArchiveSaveError(
                'save-failed',
                review.source.title,
                savedArchiveTitles,
                cause,
            );
        }
    }

    return Object.freeze({ open, save });
}

/** Read every page before the first edit, including unchanged destinations. */
async function verifyReviewedPages(
    ports: NewPageArchivePorts,
    api: mw.Api,
    review: ArchiveReview,
): Promise<void> {
    const reads = await Promise.allSettled([
        ports.fetchNewPageList(api),
        ...review.archives.map((archive) =>
            ports.fetchPageText(api, archive.title),
        ),
    ]);
    for (const [index, result] of reads.entries()) {
        const title =
            index === 0
                ? review.source.title
                : review.archives[index - 1]!.title;
        if (result.status === 'rejected') {
            throw new ArchiveSaveError('save-failed', title, [], result.reason);
        }
        const unchanged =
            index === 0
                ? sameSourceSnapshot(
                      review.source.snapshot,
                      result.value as NewPageListSnapshot,
                  )
                : sameArchiveSnapshot(
                      review.archives[index - 1]!.snapshot,
                      result.value as ArchivePageSnapshot,
                  );
        if (!unchanged) {
            throw new ArchiveSaveError('review-changed', title, []);
        }
    }
}

function sameSourceSnapshot(
    expected: Readonly<NewPageListSnapshot>,
    actual: NewPageListSnapshot,
): boolean {
    return (
        expected.text === actual.text &&
        expected.basetimestamp === actual.basetimestamp &&
        expected.revisionId === actual.revisionId
    );
}

function sameArchiveSnapshot(
    expected: ArchivePageSnapshot,
    actual: ArchivePageSnapshot,
): boolean {
    return (
        expected.title === actual.title &&
        expected.exists === actual.exists &&
        expected.text === actual.text &&
        expected.basetimestamp === actual.basetimestamp &&
        expected.revisionId === actual.revisionId
    );
}

/** A real revision ID is required to catch edits from the same account. */
function isValidRevisionId(value: unknown): value is number {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    );
}
