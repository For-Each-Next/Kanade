/**
 * @file src/source-editor/features/source-manager/analysis-session.ts
 * Purpose: Session-scoped undo snapshots for citation-consistency writes.
 *
 * Table of contents:
 * 1. AnalysisUndoSnapshot
 * 2. appendAnalysisUndo
 * 3. getAnalysisUndoText
 */

export interface AnalysisUndoSnapshot {
    afterText: string;
    beforeText: string;
}

/**
 * Extends one uninterrupted chain of analysis-only editor writes.
 *
 * @param current - Existing session snapshot, when available.
 * @param beforeText - Article text immediately before the write.
 * @param afterText - Article text immediately after the write.
 * @returns Snapshot that restores the start of the current write chain.
 */
export function appendAnalysisUndo(
    current: AnalysisUndoSnapshot | null,
    beforeText: string,
    afterText: string,
): AnalysisUndoSnapshot {
    return {
        afterText,
        beforeText:
            current?.afterText === beforeText ? current.beforeText : beforeText,
    };
}

/**
 * Resolves the restorable article text without overwriting later edits.
 *
 * @param snapshot - Session snapshot to restore.
 * @param currentText - Current article text.
 * @returns Original article text, or `null` after an intervening edit.
 */
export function getAnalysisUndoText(
    snapshot: AnalysisUndoSnapshot,
    currentText: string,
): string | null {
    return snapshot.afterText === currentText ? snapshot.beforeText : null;
}
