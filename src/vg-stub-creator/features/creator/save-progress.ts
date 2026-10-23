/**
 * @file src/vg-stub-creator/features/creator/save-progress.ts
 * Purpose: Persists and renders article-save progress across navigation.
 *
 * Table of contents:
 * 1. Imports
 * 2. MessageId
 * 3. createSaveProgress
 * 4. buildSaveProgressStep
 * 5. buildMoveProgressStep
 * 6. buildSelectedActionProgressSteps
 * 7. buildRegistrationProgressSteps
 * 8. getSaveProgressGroups
 * 9. isSaveProgressComplete
 * 10. getActionTargetPage
 * 11. buildActionProgressParts
 * 12. buildConnectionProgressParts
 * 13. buildRedirectProgressParts
 * 14. buildTalkBannerProgressParts
 * 15. buildCategoryProgressParts
 * 16. buildPageEditProgressParts
 * 17. buildProgressParts
 * 18. buildChecklistProgressSteps
 * 19. getChecklistProgressStepId
 * 20. buildBundledActionProgressSteps
 * 21. buildBundledTalkProgressStep
 * 22. buildBundledWikidataProgressSteps
 * 23. buildWikidataProgressLabel
 * 24. addStepToTargetGroup
 * 25. isWikidataTargetPage
 * 26. getStoredStepTargetPage
 * 27. normalizeActionText
 */

import { NEW_PAGE_LIST_TITLE } from '../../domain/config/wiki-pages.ts';
import { msg, msgParts } from '../../i18n/index.ts';
import { formatNamespaceTitle } from '../../../library/wiki-titles/wikipedia.ts';

type MessageId = Parameters<typeof msgParts>[0];

/**
 * Builds progress rows for an article save and its follow-up actions.
 *
 * @param title - Submitted article title.
 * @param actions - Pre-save action rows.
 * @param move - Optional move action.
 * @param registration - Optional new-page-list action.
 * @param progressGroups - Checked pre-save progress
 * groups.
 * @returns Save progress state.
 */
export function createSaveProgress(
    title: string,
    actions: Array<any> = [],
    move: any = {},
    registration: any = {},
    progressGroups: Array<any> = [],
): any {
    const steps = [buildSaveProgressStep(title)];

    if (move.enabled === true) {
        const moveProgressStepResult = buildMoveProgressStep(title, move);
        steps.push(moveProgressStepResult);
    }

    const checklistSteps = buildChecklistProgressSteps(progressGroups);

    if (checklistSteps.length > 0) {
        steps.push(...checklistSteps);
    } else {
        const selectedActionProgressStepsRes = buildSelectedActionProgressSteps(
            actions,
            title,
        );
        steps.push(...selectedActionProgressStepsRes);
        const registrationProgressStepsResul =
            buildRegistrationProgressSteps(registration);
        steps.push(...registrationProgressStepsResul);
    }

    const result = {
        error: '',
        open: true,
        steps,
        title,
    };
    return result;
}

/**
 * Builds the primary article-save progress step.
 *
 * @param title - Page title.
 * @returns The primary article-save progress step.
 */
function buildSaveProgressStep(title: string): any {
    const result = {
        id: 'save',
        label: msg('progress.savePage', { title }),
        parts: buildProgressParts('progress.savePage', {
            title: { code: title },
        }),
        status: 'pending',
        targetPage: title,
    };
    return result;
}

/**
 * Builds an optional article-move progress step.
 *
 * @param title - Page title.
 * @param move - Move value.
 * @returns An optional article-move progress step.
 */
function buildMoveProgressStep(title: string, move: any): any {
    const result = {
        id: 'move',
        label: msg('progress.movePage', { title: move.to }),
        parts: buildProgressParts('progress.movePage', {
            title: { code: move.to },
        }),
        status: 'pending',
        targetPage: title,
    };
    return result;
}

/**
 * Builds progress steps for selected follow-up actions.
 *
 * @param actions - Actions value.
 * @param title - Page title.
 * @returns Progress steps for selected follow-up actions.
 */
function buildSelectedActionProgressSteps(
    actions: Array<{ id: string; label: string; selected: boolean }>,
    title: string,
): Array<unknown> {
    const flatMapCallbackA = function callback(action: {
        id: unknown;
        label: unknown;
    }) {
        const step = {
            id: action.id,
            label: action.label,
            parts: buildActionProgressParts(action, title),
            status: 'pending',
            targetPage: getActionTargetPage(action, title),
        };

        return [step, ...buildBundledActionProgressSteps(action)];
    };
    const result = actions
        .filter((action) => action.selected)
        .flatMap(flatMapCallbackA);
    return result;
}

/**
 * Builds the optional new-page-list registration progress step.
 *
 * @param registration - Registration value.
 * @returns The optional new-page-list registration progress step.
 */
function buildRegistrationProgressSteps(registration: {
    enabled: boolean;
}): Array<unknown> {
    if (registration.enabled !== true) {
        return [];
    }

    const result = [
        {
            id: 'new-page-list',
            label: msg('progress.registerNewPage'),
            parts: [{ text: msg('progress.registerNewPage') }],
            status: 'pending',
            targetPage: NEW_PAGE_LIST_TITLE,
        },
    ];
    return result;
}

/**
 * Gets progress steps grouped by the wiki page they update.
 *
 * @param progress - Save progress state.
 * @returns Target-page progress groups.
 */
export function getSaveProgressGroups(progress: any): Array<any> {
    const reduceCallback = function addStep(groups: unknown[], step: unknown) {
        return addStepToTargetGroup(groups, step, progress);
    };
    const groups = (progress?.steps || []).reduce(reduceCallback, []);

    const filterCallback = function isLocal(group: { targetPage: string }) {
        return !isWikidataTargetPage(group.targetPage);
    };
    const filterCallbackA = function isWikidata(group: { targetPage: string }) {
        return isWikidataTargetPage(group.targetPage);
    };
    const result = [
        ...groups.filter(filterCallback),
        ...groups.filter(filterCallbackA),
    ];
    return result;
}

/**
 * Checks whether all progress steps have finished.
 *
 * @param progress - Save progress state.
 * @returns Whether every step has a terminal status.
 */
export function isSaveProgressComplete(progress: any): boolean {
    const everyCallback = function callback(step: { status: string }) {
        return ['complete', 'failed', 'skipped'].includes(step.status);
    };
    const result = (progress?.steps || []).every(everyCallback);
    return result;
}

/**
 * Finds the wiki page updated by a follow-up action.
 *
 * @param action - Selected follow-up action.
 * @param title - Submitted article title.
 * @returns Target page title.
 */
function getActionTargetPage(action: any, title: string): string {
    if (action.type === 'interwiki') {
        return action.wikidataId ? `Wikidata:${action.wikidataId}` : title;
    }

    if (action.type === 'redirect') {
        return action.pageTitle || action.redirectTitle || title;
    }

    if (action.type === 'talk-banner') {
        return formatNamespaceTitle(action.pageTitle || title, 'zhwiki', 1);
    }

    if (action.type === 'category') {
        return (
            action.pageTitle ||
            formatNamespaceTitle(String(action.category ?? ''), 'zhwiki', 14)
        );
    }

    if (action.type === 'page-edit') {
        return action.pageTitle || action.title || title;
    }

    return action.pageTitle || title;
}

/**
 * Builds semantic progress text for one follow-up action.
 *
 * @param action - Selected follow-up action.
 * @param title - Submitted article title.
 * @returns Text and code fragments.
 */
function buildActionProgressParts(
    action: any,
    title: string,
): Array<any> | undefined {
    if (action.type === 'interwiki') {
        return buildConnectionProgressParts(title, action.wikidataId);
    }

    if (action.type === 'redirect') {
        return buildRedirectProgressParts(action, title);
    }

    if (action.type === 'talk-banner') {
        return buildTalkBannerProgressParts(title);
    }

    if (action.type === 'category') {
        return buildCategoryProgressParts(action);
    }

    if (action.type === 'page-edit') {
        return buildPageEditProgressParts(action);
    }

    return undefined;
}

/**
 * Builds connection progress fragments.
 *
 * @param title - Page title.
 * @param wikidataId - Wikidata id value.
 * @returns Connection progress fragments.
 */
function buildConnectionProgressParts(
    title: string,
    wikidataId: unknown,
): Array<unknown> {
    const result = buildProgressParts('progress.connectTo', {
        target: { code: wikidataId },
        title: { code: title },
    });
    return result;
}

/**
 * Builds redirect progress fragments.
 *
 * @param action - Action value.
 * @param title - Page title.
 * @returns Redirect progress fragments.
 */
function buildRedirectProgressParts(
    action: { redirectTitle: unknown },
    title: string,
): Array<unknown> {
    const result = buildProgressParts('progress.redirectTo', {
        redirect: { code: action.redirectTitle },
        title: { code: title },
    });
    return result;
}

/**
 * Builds talk-banner progress fragments.
 *
 * @param title - Page title.
 * @returns Talk-banner progress fragments.
 */
function buildTalkBannerProgressParts(title: string): Array<unknown> {
    const result = buildProgressParts('progress.addTalkBanner', {
        title: { code: formatNamespaceTitle(title, 'zhwiki', 1) },
    });
    return result;
}

/**
 * Builds category progress fragments.
 *
 * @param action - Action value.
 * @returns Category progress fragments.
 */
function buildCategoryProgressParts(action: {
    category: unknown;
}): Array<unknown> {
    const result = buildProgressParts('progress.createCategory', {
        title: {
            code: formatNamespaceTitle(
                String(action.category ?? ''),
                'zhwiki',
                14,
            ),
        },
    });
    return result;
}

/**
 * Builds page-edit progress fragments.
 *
 * @param action - Action value.
 * @returns Page-edit progress fragments.
 */
function buildPageEditProgressParts(action: {
    create: unknown;
    title: unknown;
}): Array<unknown> {
    const id = action.create ? 'progress.createPage' : 'progress.editPage';
    const result = buildProgressParts(id, {
        title: { code: action.title },
    });
    return result;
}

/**
 * Converts translated message parts to progress display fragments.
 *
 * @param id - Id value.
 * @param values - Input values.
 * @returns Translated message parts to progress display fragments.
 */
function buildProgressParts(
    id: MessageId,
    values: Record<string, any>,
): Array<any> {
    const result = msgParts<unknown>(id, values).map(function callback(part) {
        return typeof part === 'string' ? { text: part } : part;
    });
    return result;
}

/**
 * Builds progress rows from checked pre-save groups.
 *
 * @param groups - Checked pre-save groups.
 * @returns Progress rows.
 */
function buildChecklistProgressSteps(groups: Array<any>): Array<any> {
    if (!Array.isArray(groups)) {
        return [];
    }

    const flatMapCallback = function callback(group: any) {
        const targetPage = normalizeActionText(group?.title);

        if (targetPage === '' || !Array.isArray(group?.rows)) {
            return [];
        }

        const flatMapCallbackB = function callback(row: { label: unknown }) {
            const id = getChecklistProgressStepId(row);
            const label = normalizeActionText(row?.label);

            if (id === '' || label === '') {
                return [];
            }

            const result = [
                {
                    id,
                    label,
                    parts: [{ text: label }],
                    status: 'pending',
                    targetPage,
                },
            ];
            return result;
        };
        const result = group.rows.flatMap(flatMapCallbackB);
        return result;
    };
    const result = groups.flatMap(flatMapCallback);
    return result;
}

/**
 * Gets the progress ID for one checked pre-save row.
 *
 * @param row - Checked pre-save row.
 * @returns Progress step ID.
 */
function getChecklistProgressStepId(row: any): string {
    if (row?.type === 'registration') {
        return 'new-page-list';
    }

    return normalizeActionText(row?.key || row?.id);
}

/**
 * Builds progress rows for work bundled inside one selected action.
 *
 * @param action - Selected follow-up action.
 * @returns Bundled progress rows.
 */
function buildBundledActionProgressSteps(action: any): Array<any> {
    if (
        action.type !== 'category' ||
        normalizeActionText(action.company) === ''
    ) {
        return [];
    }

    const categoryTitle =
        action.pageTitle ||
        formatNamespaceTitle(
            normalizeActionText(action.category),
            'zhwiki',
            14,
        );
    const steps = [buildBundledTalkProgressStep(action, categoryTitle)];
    const wikidataId = normalizeActionText(action.wikidataId);
    const englishName = normalizeActionText(action.englishName);

    const bundledWikidataProgressStepsRe = buildBundledWikidataProgressSteps({
        action,
        categoryTitle,
        englishName,
        wikidataId,
    });
    steps.push(...bundledWikidataProgressStepsRe);

    return steps;
}

/**
 * Builds a bundled category talk-banner progress step.
 *
 * @param action - Action value.
 * @param categoryTitle - Category title value.
 * @returns A bundled category talk-banner progress step.
 */
function buildBundledTalkProgressStep(
    action: { category: unknown; id: unknown },
    categoryTitle: unknown,
): unknown {
    const title = formatNamespaceTitle(
        normalizeActionText(action.category),
        'zhwiki',
        15,
    );
    const result = {
        id: `${action.id}:talk-banner`,
        label: msg('progress.addTalkBanner', { title }),
        parts: buildProgressParts('progress.addTalkBanner', {
            title: { code: title },
        }),
        status: 'pending',
        targetPage: categoryTitle,
    };
    return result;
}

/**
 * Builds bundled category Wikidata progress steps.
 *
 * @param options - Operation options.
 * @returns Bundled category Wikidata progress steps.
 */
function buildBundledWikidataProgressSteps(options: {
    action: { id: string };
    categoryTitle: string;
    englishName: string;
    wikidataId: string;
}): Array<unknown> {
    if (options.wikidataId !== '') {
        const result = [
            {
                id: `${options.action.id}:wikidata`,
                label: buildWikidataProgressLabel(options),
                parts: buildProgressParts('progress.connectTo', {
                    target: { code: options.wikidataId },
                    title: { code: options.categoryTitle },
                }),
                status: 'pending',
                targetPage: options.categoryTitle,
            },
        ];
        return result;
    }
    if (options.englishName !== '') {
        const result = [
            {
                id: `${options.action.id}:wikidata`,
                label: msg('progress.connectCategory'),
                parts: [{ text: msg('progress.connectCategory') }],
                status: 'pending',
                targetPage: options.categoryTitle,
            },
        ];
        return result;
    }

    return [];
}

/**
 * Builds the category Wikidata action label.
 *
 * @param options - Operation options.
 * @returns The category Wikidata action label.
 */
function buildWikidataProgressLabel(options: {
    wikidataId: string;
    categoryTitle: string;
}): string {
    const result = msg('progress.connectTo', {
        target: options.wikidataId,
        title: options.categoryTitle,
    });
    return result;
}

/**
 * Adds a progress step to its target-page group.
 *
 * @param groups - Existing target-page groups.
 * @param step - Progress step.
 * @param progress - Save progress state.
 * @returns Updated target-page groups.
 */
function addStepToTargetGroup(
    groups: Array<any>,
    step: any,
    progress: any,
): Array<any> {
    const targetPage =
        step.targetPage || getStoredStepTargetPage(step, progress);
    const group = groups.find((item) => item.targetPage === targetPage);

    if (group == null) {
        groups.push({
            steps: [step],
            targetPage,
        });
    } else {
        group.steps.push(step);
    }

    return groups;
}

/**
 * Checks whether a progress group targets Wikidata.
 *
 * @param targetPage - Progress group target page.
 * @returns Whether the group targets Wikidata.
 */
function isWikidataTargetPage(targetPage: string): boolean {
    return normalizeActionText(targetPage).startsWith('Wikidata:');
}

/**
 * Handles get stored step target page.
 *
 * Infers target pages for progress stored before target pages were
 * persisted.
 *
 * @param step - Stored progress step.
 * @param progress - Save progress state.
 * @returns Target page title.
 */
function getStoredStepTargetPage(step: any, progress: any): string {
    if (step.id === 'new-page-list') {
        return NEW_PAGE_LIST_TITLE;
    }

    if (step.id === 'talk-banner') {
        return formatNamespaceTitle(progress.title, 'zhwiki', 1);
    }

    if (step.id?.startsWith('category:')) {
        return formatNamespaceTitle(
            step.id.slice('category:'.length),
            'zhwiki',
            14,
        );
    }

    if (step.id?.startsWith('redirect:')) {
        return step.id.slice('redirect:'.length);
    }

    if (step.id?.startsWith('page-edit:')) {
        return step.id.slice('page-edit:'.length);
    }

    return progress.title;
}

/**
 * Normalizes action text values.
 *
 * @param value - Raw action field.
 * @returns Trimmed text.
 */
function normalizeActionText(value: unknown): string {
    return String(value || '').trim();
}
