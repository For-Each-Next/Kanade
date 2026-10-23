/**
 * @file src/vg-stub-creator/app/workflows/pre-save-plan.ts
 * Purpose: Builds the immutable execution plan for reviewed follow-up actions.
 *
 * Table of contents:
 * 1. Imports
 * 2. PlannedAction
 * 3. PreSaveActionPhase
 * 4. PreSaveExecutionPlan
 * 5. planPreSaveExecution
 */

import {
    normalizePageTitle as normalizeTitle,
    normalizePageTitleKey as normalizeTitleKey,
} from '../../domain/wiki-titles.ts';

interface PlannedAction {
    selected?: boolean;
    type: string;
}

interface PreSaveActionPhase<T extends PlannedAction> {
    actions: T[];
    type: 'local' | 'wikidata';
}

export interface PreSaveExecutionPlan<T extends PlannedAction> {
    finalTitle: string;
    phases: Array<PreSaveActionPhase<T>>;
    shouldMove: boolean;
}

/**
 * Plans the move and ordered local/Wikidata action phases.
 *
 * @param actions - Reviewed follow-up actions.
 * @param originalTitle - Current article title.
 * @param move - Optional title-move selection.
 * @returns Pure execution plan.
 */
export function planPreSaveExecution<T extends PlannedAction>(
    actions: T[],
    originalTitle: string,
    move?: { enabled?: boolean; to?: unknown },
): PreSaveExecutionPlan<T> {
    const normalizedOriginalTitle = normalizeTitle(originalTitle);
    const moveTitle = normalizeTitle(move?.to);
    const shouldMove =
        move?.enabled === true &&
        moveTitle !== '' &&
        normalizeTitleKey(moveTitle) !==
            normalizeTitleKey(normalizedOriginalTitle);
    const finalTitle = shouldMove ? moveTitle : normalizedOriginalTitle;
    const selected = actions.filter((action) => action.selected);
    const localActions = selected.filter(
        (action) => action.type !== 'interwiki',
    );
    const wikidataActions = selected.filter(
        (action) => action.type === 'interwiki',
    );

    return {
        finalTitle,
        phases: [
            { actions: localActions, type: 'local' },
            { actions: wikidataActions, type: 'wikidata' },
        ],
        shouldMove,
    };
}
