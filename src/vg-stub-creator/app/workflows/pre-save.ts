/**
 * @file src/vg-stub-creator/app/workflows/pre-save.ts
 * Purpose: Executes reviewed follow-up writes in their approved order.
 *
 * Table of contents:
 * 1. Imports
 * 2. PreSaveWritePorts
 * 3. runSelectedActions
 * 4. SelectedActionContext
 * 5. PreSaveExecutionOptions
 * 6. CategorySaveHandler
 * 7. runSelectedMove
 * 8. runSelectedActionPhase
 * 9. runSelectedActionRow
 * 10. isRedirectToFinalTitle
 * 11. completeSelectedAction
 * 12. failSelectedAction
 * 13. runSelectedAction
 * 14. runCategoryAction
 * 15. reportCategoryActionProgress
 */

import { planPreSaveExecution } from './pre-save-plan.ts';
import { assertUniqueSelectedActionIds } from '../../domain/pre-save-action-identity.ts';
import {
    normalizePageTitle as normalizeTitle,
    normalizePageTitleKey as normalizeTitleKey,
} from '../../domain/wiki-titles.ts';
import type { MediaWikiApiPort } from '../contracts/application.ts';
import type {
    PreSaveAction,
    PreSaveExecutionResult,
} from '../../domain/models.ts';

interface PreSaveWritePorts {
    addTalkPageBanner(api: MediaWikiApiPort, title: string): Promise<void>;
    connectWikidataSitelink(
        api: MediaWikiApiPort,
        id: string,
        title: string,
    ): Promise<void>;
    createRedirect(
        api: MediaWikiApiPort,
        from: string,
        to: string,
    ): Promise<void>;
    movePage(
        api: MediaWikiApiPort,
        from: string,
        to: string,
        options: { leaveRedirect: boolean },
    ): Promise<void>;
    savePageEdit(
        api: MediaWikiApiPort,
        action: Extract<PreSaveAction, { type: 'page-edit' }>,
    ): Promise<void>;
}

/**
 * Runs selected follow-up actions in order.
 *
 * @param actions - Action rows.
 * @param options - Execution options.
 * @param options.api - MediaWiki API client.
 * @param options.move - Optional page move settings.
 * @param options.move.enabled - Whether to move the page.
 * @param options.move.leaveRedirect - Whether to leave a
 * redirect.
 * @param options.move.to - Destination page title.
 * @param options.onMoveComplete - Successful move
 * callback.
 * @param options.onMoveStart - Move start callback.
 * @param options.onActionComplete - Action success
 * callback.
 * @param options.onActionFailed - Action failure callback.
 * @param options.onActionSkipped - Action skipped
 * callback.
 * @param options.onActionStart - Action start callback.
 * @param options.onBeforeWikidataActions - Pre-Wikidata
 * hook.
 * @param options.saveCategory - Generic category save
 * handler.
 * @param options.saveCompanyCategory - Company category
 * save
 * handler.
 * @param options.wikidataApi - Wikidata API client.
 * @param options.title - Saved article title.
 * @returns Completed action rows and final title.
 */
export async function runSelectedActions(
    actions: PreSaveAction[],
    options: PreSaveExecutionOptions,
): Promise<PreSaveExecutionResult> {
    assertUniqueSelectedActionIds(actions);
    const completed: PreSaveAction[] = [...(options.confirmedActions ?? [])];
    const failed: PreSaveAction[] = [];
    const originalTitle = normalizeTitle(options.title);
    const plan = planPreSaveExecution(actions, originalTitle, options.move);

    await runSelectedMove(
        originalTitle,
        plan.finalTitle,
        plan.shouldMove,
        options,
    );

    for (const phase of plan.phases) {
        await runSelectedActionPhase(phase, {
            completed,
            failed,
            finalTitle: plan.finalTitle,
            options,
        });
    }

    const result = {
        completed,
        failed,
        title: plan.finalTitle,
    };
    return result;
}

/**
 * Carries shared state while selected actions execute.
 */
interface SelectedActionContext {
    completed: PreSaveAction[];
    failed: PreSaveAction[];
    finalTitle: string;
    options: PreSaveExecutionOptions;
}

export interface PreSaveExecutionOptions {
    api: MediaWikiApiPort;
    categoryUnavailableMessage?: string;
    confirmedActions?: PreSaveAction[];
    title: string;
    wikidataApi?: MediaWikiApiPort;
    move?: { enabled?: boolean; to?: unknown; leaveRedirect?: boolean };
    onMoveStart?: (title: string) => void;
    onMoveComplete?: (title: string) => void;
    onMoveFailed?: (title: string, error: unknown) => void;
    onActionComplete?: (action: PreSaveAction) => void;
    onActionFailed?: (action: PreSaveAction, error?: unknown) => void;
    onActionSkipped?: (action: PreSaveAction) => void;
    onActionStart?: (action: PreSaveAction) => void;
    onBeforeWikidataActions?: (result: {
        completed: PreSaveAction[];
        failed: PreSaveAction[];
        title: string;
    }) => Promise<void> | void;
    onBundledActionProgress?: (
        action: PreSaveAction,
        status: 'complete' | 'failed' | 'running',
    ) => void;
    saveCategory?: CategorySaveHandler;
    saveCompanyCategory?: CategorySaveHandler;
    writes: PreSaveWritePorts;
}

type CategorySaveHandler = (
    category: string,
    text: string,
    englishName: string,
    options: { onProgress: (operation: string, status: string) => void },
) => Promise<void>;

/**
 * Runs the optional page move before follow-up actions.
 *
 * @param from - From value.
 * @param to - To value.
 * @param enabled - Enabled value.
 * @param options - Operation options.
 */
async function runSelectedMove(
    from: string,
    to: string,
    enabled: boolean,
    options: PreSaveExecutionOptions,
): Promise<void> {
    if (!enabled) {
        return;
    }

    options.onMoveStart?.(to);
    try {
        await options.writes.movePage(options.api, from, to, {
            leaveRedirect: options.move?.leaveRedirect === true,
        });
        options.onMoveComplete?.(to);
    } catch (error) {
        options.onMoveFailed?.(to, error);
        throw error;
    }
}

/**
 * Runs one selected action phase.
 *
 * @param phase - Phase value.
 * @param context - Operation context.
 */
async function runSelectedActionPhase(
    phase: { type: string; actions: PreSaveAction[] },
    context: SelectedActionContext,
): Promise<void> {
    if (phase.type === 'wikidata') {
        await context.options.onBeforeWikidataActions?.({
            completed: context.completed,
            failed: context.failed,
            title: context.finalTitle,
        });
    }

    for (const action of phase.actions) {
        await runSelectedActionRow(action, context);
    }
}

/**
 * Runs one selected action row and records its result.
 *
 * @param action - Action value.
 * @param context - Operation context.
 */
async function runSelectedActionRow(
    action: PreSaveAction,
    context: SelectedActionContext,
): Promise<void> {
    if (isRedirectToFinalTitle(action, context.finalTitle)) {
        action.selected = false;
        context.options.onActionSkipped?.(action);
        return;
    }

    context.options.onActionStart?.(action);

    try {
        await runSelectedAction(action, {
            ...context.options,
            title: context.finalTitle,
        });
        completeSelectedAction(action, context);
    } catch (error) {
        failSelectedAction(action, error, context);
    }
}

/**
 * Checks whether a redirect points to its own final title.
 *
 * @param action - Action value.
 * @param finalTitle - Final title value.
 * @returns Whether a redirect points to its own final title.
 */
function isRedirectToFinalTitle(
    action: PreSaveAction,
    finalTitle: string,
): boolean {
    const result =
        action.type === 'redirect' &&
        normalizeTitleKey(action.redirectTitle) ===
            normalizeTitleKey(finalTitle);
    return result;
}

/**
 * Records a completed selected action.
 *
 * @param action - Action value.
 * @param context - Operation context.
 */
function completeSelectedAction(
    action: PreSaveAction,
    context: SelectedActionContext,
): void {
    action.selected = false;
    context.completed.push(action);
    context.options.onActionComplete?.(action);
}

/**
 * Records a failed selected action.
 *
 * @param action - Action value.
 * @param error - Caught error.
 * @param context - Operation context.
 */
function failSelectedAction(
    action: PreSaveAction,
    error: unknown,
    context: SelectedActionContext,
): void {
    action.selected = false;
    context.failed.push(action);
    context.options.onActionFailed?.(action, error);
}

/**
 * Runs one selected follow-up action.
 *
 * @param action - Action row.
 * @param options - Execution options.
 * @param options.api - MediaWiki API client.
 * @param options.wikidataApi - Wikidata API client.
 * @param options.title - Saved article title.
 * @returns Resolves after the action succeeds.
 */
async function runSelectedAction(
    action: PreSaveAction,
    options: PreSaveExecutionOptions,
): Promise<void> {
    if (action.type === 'interwiki') {
        await options.writes.connectWikidataSitelink(
            options.wikidataApi || options.api,
            action.wikidataId,
            options.title,
        );
        return;
    }

    if (action.type === 'redirect') {
        await options.writes.createRedirect(
            options.api,
            action.redirectTitle,
            options.title,
        );
        return;
    }

    if (action.type === 'talk-banner') {
        await options.writes.addTalkPageBanner(options.api, options.title);
        return;
    }

    if (action.type === 'category') {
        await runCategoryAction(action, options);
        return;
    }

    if (action.type === 'page-edit') {
        await options.writes.savePageEdit(options.api, action);
    }
}

/**
 * Runs a generic or company category action.
 *
 * @param action - Action value.
 * @param options - Operation options.
 */
async function runCategoryAction(
    action: Extract<PreSaveAction, { type: 'category' }>,
    options: PreSaveExecutionOptions,
): Promise<void> {
    let save = options.saveCompanyCategory;

    if (normalizeTitle(action.company) === '') {
        save = options.saveCategory;
    }

    if (save == null) {
        const message =
            options.categoryUnavailableMessage ||
            'Category save handler is unavailable.';
        throw new Error(message);
    }

    const saveArgument = {
        onProgress(operation: string, status: string) {
            reportCategoryActionProgress(action, operation, status, options);
        },
    };
    await save(
        action.category ?? '',
        action.text ?? '',
        action.englishName ?? '',
        saveArgument,
    );
}

/**
 * Reports progress for work bundled into a category action.
 *
 * @param action - Action value.
 * @param operation - Operation value.
 * @param status - Status value.
 * @param options - Operation options.
 */
function reportCategoryActionProgress(
    action: PreSaveAction,
    operation: string,
    status: string,
    options: PreSaveExecutionOptions,
): void {
    // The parent category owns creation plus every bundled write.
    // Its lifecycle is completed or failed by runSelectedActionRow.
    if (operation === 'create') {
        return;
    }

    const progressAction = {
        ...action,
        id: `${action.id}:${operation}`,
    };

    if (['complete', 'failed', 'running'].includes(status)) {
        options.onBundledActionProgress?.(
            progressAction,
            status as 'complete' | 'failed' | 'running',
        );
    }
}
