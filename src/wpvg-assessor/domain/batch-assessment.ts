/**
 * @file src/wpvg-assessor/domain/batch-assessment.ts
 * Purpose: Detect meaningful reviewed talk-lead changes before batch submission.
 * Contents: Pure reviewed-entry comparison.
 */
import {
    getTalkPageTopSection,
    isEmptyImportanceOnlyChange,
} from './assessment.ts';

interface ReviewedTalkEntry {
    state: { page: { text: string } };
    review: { previewText: string };
}

export function hasBatchTalkChange(entry: ReviewedTalkEntry): boolean {
    const current = getTalkPageTopSection(entry.state.page.text);
    const proposed = entry.review.previewText;
    return (
        current !== proposed.trimEnd() &&
        !isEmptyImportanceOnlyChange(current, proposed)
    );
}
