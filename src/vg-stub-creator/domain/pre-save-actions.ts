/**
 * @file src/vg-stub-creator/domain/pre-save-actions.ts
 * Purpose: Builds reviewed follow-up actions and redirect candidates without host operations.
 *
 * Table of contents:
 * 1. Imports
 * 2. PageTitleMatch
 * 3. DynamicRecord
 * 4. PageEditCollection
 * 5. PreSaveMessageFormatter
 * 6. PreSaveMessageId
 * 7. buildPreSaveActions
 * 8. buildInitialPreSaveActions
 * 9. createTalkBannerAction
 * 10. buildPageEditActions
 * 11. isPreSaveCategoryRow
 * 12. isPreSavePageEditRow
 * 13. isPreSaveRowEnabled
 * 14. hasCompletePendingEdit
 * 15. createCategoryAction
 * 16. createPageEditAction
 * 17. getPageEditSummary
 * 18. buildRedirectRows
 * 19. buildRedirectRowsFromTitles
 * 20. normalizeRedirectReviewTitle
 * 21. buildRedirectTitles
 * 22. getPreSaveRedirectRows
 * 23. normalizePreSaveRedirectRow
 * 24. createRedirectAction
 * 25. createExistingTitleRows
 * 26. createExistingTitleRow
 * 27. findExistingTitleRow
 * 28. getRedirectTitleCheckTitles
 * 29. getExistenceStatus
 * 30. fallbackMessage
 */

import { buildNavboxEditSummary } from './edit-summary.ts';
import { formatNamespaceTitle } from '../../library/wiki-titles/wikipedia.ts';
import {
    normalizePageTitle as normalizeTitle,
    normalizePageTitleKey as normalizeTitleKey,
} from './wiki-titles.ts';
import { getNameRedirectTitles } from './name-roles.ts';

/** Checked page evidence retains the requested identity across title conversion. */
export interface PageTitleMatch {
    exists: boolean;
    requestedTitle: string;
    title: string;
}

type DynamicRecord = Record<string, any>;
interface PageEditCollection {
    articleTitle?: string;
    rows?: Array<{ pendingEdit: DynamicRecord }>;
}

export type PreSaveMessageFormatter = (
    id: PreSaveMessageId,
    values?: Record<string, string | number>,
) => string;

export type PreSaveMessageId =
    | 'presave.connectTo'
    | 'presave.createPage'
    | 'presave.editPage'
    | 'presave.tagBanner'
    | 'progress.addTalkBanner'
    | 'progress.connectTo'
    | 'progress.createCategory'
    | 'progress.createPage'
    | 'progress.editPage'
    | 'review.createCategoryPage';

/**
 * Builds the selectable pre-save action rows.
 *
 * @param selection - Current pre-save selection data.
 * @param selection.form - Submitted dialog form.
 * @param selection.title - Article title.
 * @param existingRedirectTitles - Titles that already redirect to the
 * article.
 * @returns Selectable action rows.
 */
export function buildPreSaveActions(
    selection: any,
    existingRedirectTitles: PageTitleMatch[] = [],
    formatMessage: PreSaveMessageFormatter = fallbackMessage,
): Array<any> {
    const form = selection.form || {};
    const title = normalizeTitle(selection.title);
    const finalTitle = normalizeTitle(selection.finalTitle) || title;
    const existingRows = createExistingTitleRows(existingRedirectTitles);
    const existingKeyValues = existingRows
        .filter((row) => row.exists)
        .map((row) => row.key);
    const existingKeys = new Set(existingKeyValues);
    const actions = buildInitialPreSaveActions(
        form,
        title,
        finalTitle,
        formatMessage,
    );

    for (const row of getPreSaveRedirectRows(form, title)) {
        const redirectActionResult = createRedirectAction(
            row,
            title,
            existingKeys,
        );
        actions.push(redirectActionResult);
    }

    for (const row of (form.categoryRows || []).filter(isPreSaveCategoryRow)) {
        const categoryActionResult = createCategoryAction(row, formatMessage);
        actions.push(categoryActionResult);
    }

    const pageEditActionsResult = buildPageEditActions(
        form,
        finalTitle,
        formatMessage,
    );
    actions.push(...pageEditActionsResult);

    return actions;
}

/**
 * Builds interwiki and talk-banner pre-save actions.
 *
 * @param form - Form values.
 * @param title - Page title.
 * @param finalTitle - Final title value.
 * @returns Interwiki and talk-banner pre-save actions.
 */
function buildInitialPreSaveActions(
    form: { wikidataId: unknown },
    title: string,
    finalTitle: string,
    formatMessage: PreSaveMessageFormatter,
): Array<unknown> {
    const actions = [createTalkBannerAction(finalTitle, formatMessage)];
    const wikidataId = normalizeTitle(form.wikidataId);

    if (wikidataId !== '') {
        const message = {
            displayLabel: formatMessage('presave.connectTo', {
                target: `d:${wikidataId}`,
            }),
            id: 'interwiki',
            label: formatMessage('progress.connectTo', {
                target: wikidataId,
                title,
            }),
            pageTitle: title,
            selected: true,
            type: 'interwiki',
            wikidataId,
        };
        actions.unshift(message);
    }

    return actions;
}

/**
 * Creates the article talk-banner action.
 *
 * @param title - Page title.
 * @returns The article talk-banner action.
 */
function createTalkBannerAction(
    title: unknown,
    formatMessage: PreSaveMessageFormatter,
): unknown {
    const talkTitle = formatNamespaceTitle(String(title ?? ''), 'zhwiki', 1);

    const result = {
        displayLabel: formatMessage('presave.tagBanner', { title: talkTitle }),
        id: 'talk-banner',
        label: formatMessage('progress.addTalkBanner', { title: talkTitle }),
        pageTitle: title,
        selected: true,
        type: 'talk-banner',
    };
    return result;
}

/**
 * Builds staged page-edit actions from review-row collections.
 *
 * @param form - Form values.
 * @param finalTitle - Final linked article title.
 * @param formatMessage - Pre-save message formatter.
 * @returns Staged page-edit actions from review-row collections.
 */
function buildPageEditActions(
    form: {
        categoryRows: Array<{ pendingEdit: DynamicRecord }>;
        redirectRows: Array<{ pendingEdit: DynamicRecord }>;
        navboxRows: Array<{ pendingEdit: DynamicRecord }>;
        stubTagRows: Array<{ pendingEdit: DynamicRecord }>;
    },
    finalTitle: string,
    formatMessage: PreSaveMessageFormatter,
): Array<unknown> {
    const collections: PageEditCollection[] = [
        { rows: form.categoryRows },
        { rows: form.redirectRows },
        { articleTitle: finalTitle, rows: form.navboxRows },
        { rows: form.stubTagRows },
    ];

    const flatMapCallback = function callback(collection: PageEditCollection) {
        const mapCallback = function callback(row: {
            pendingEdit: DynamicRecord;
        }) {
            return createPageEditAction(
                row.pendingEdit,
                formatMessage,
                collection.articleTitle,
            );
        };
        return (collection.rows || [])
            .filter(isPreSavePageEditRow)
            .map(mapCallback);
    };
    const result = collections.flatMap(flatMapCallback);
    return result;
}

/**
 * Checks whether a category row should become a pre-save action.
 *
 * @param row - Category review row.
 * @returns Whether the category should be staged.
 */
function isPreSaveCategoryRow(row: any): boolean {
    const result =
        row.enabled !== false &&
        row.pendingCreation != null &&
        normalizeTitle(row.category) !== '';
    return result;
}

/**
 * Checks whether a row has a staged page edit.
 *
 * @param row - Review row.
 * @returns Whether the row should become a page edit action.
 */
function isPreSavePageEditRow(row: any): boolean {
    return isPreSaveRowEnabled(row) && hasCompletePendingEdit(row.pendingEdit);
}

/**
 * Checks whether a pre-save row is enabled.
 *
 * @param row - Row values.
 * @returns Whether a pre-save row is enabled.
 */
function isPreSaveRowEnabled(row: any): boolean {
    return row.enabled === undefined || row.enabled === true;
}

/**
 * Checks whether a staged page edit has a title and text.
 *
 * @param edit - Edit value.
 * @returns Whether a staged page edit has a title and text.
 */
function hasCompletePendingEdit(edit: any): boolean {
    const result =
        Boolean(edit) &&
        normalizeTitle(edit.title).length > 0 &&
        String(edit.text || '').trim().length > 0;
    return result;
}

/**
 * Creates a category pre-save action.
 *
 * @param row - Category review row.
 * @returns Category pre-save action.
 */
function createCategoryAction(
    row: any,
    formatMessage: PreSaveMessageFormatter,
): any {
    const category = normalizeTitle(row.category);

    const result = {
        category,
        company: normalizeTitle(row.company),
        displayLabel: formatMessage('review.createCategoryPage'),
        englishName: normalizeTitle(row.pendingCreation.englishName),
        id: `category:${category}`,
        label: formatMessage('progress.createCategory', { title: category }),
        pageTitle: formatNamespaceTitle(category, 'zhwiki', 14),
        selected: true,
        text: String(row.pendingCreation.text || ''),
        type: 'category',
        wikidataId: normalizeTitle(row.pendingCreation.wikidataId),
    };
    return result;
}

/**
 * Creates a generic staged page edit action.
 *
 * @param edit - Staged page edit.
 * @param formatMessage - Pre-save message formatter.
 * @param articleTitle - Final linked article title for navbox edits.
 * @returns Page edit pre-save action.
 */
function createPageEditAction(
    edit: any,
    formatMessage: PreSaveMessageFormatter,
    articleTitle?: string,
): any {
    const title = normalizeTitle(edit.title);
    const create = edit.create === true;
    const englishName = normalizeTitle(edit.englishName);
    let displayLabel = formatMessage('presave.editPage');
    if (create) {
        displayLabel = formatMessage('presave.createPage');
    }

    const result = {
        create,
        displayLabel,
        ...(englishName === '' ? {} : { englishName }),
        id: `page-edit:${title}`,
        label: formatMessage(
            create ? 'progress.createPage' : 'progress.editPage',
            {
                title,
            },
        ),
        pageTitle: title,
        selected: true,
        summary:
            articleTitle == null
                ? getPageEditSummary(edit, title, create)
                : buildNavboxEditSummary(edit, articleTitle),
        text: String(edit.text || ''),
        title,
        type: 'page-edit',
    };
    return result;
}

/**
 * Gets the staged page edit summary.
 *
 * @param edit - Edit value.
 * @param title - Page title.
 * @param create - Create value.
 * @returns The staged page edit summary.
 */
function getPageEditSummary(edit: any, title: string, create: boolean): string {
    const result =
        normalizeTitle(edit.summary) ||
        `${create ? 'Create' : 'Update'} ${title}`;
    return result;
}

/**
 * Builds generated redirect review rows.
 *
 * @param form - Submitted dialog form.
 * @param articleTitle - Saved article title.
 * @param existingRedirectTitles - Existing page titles.
 * @returns Redirect review rows.
 */
export function buildRedirectRows(
    form: any,
    articleTitle: string,
    existingRedirectTitles: PageTitleMatch[] = [],
): Array<any> {
    const redirectTitlesResult = buildRedirectTitles(form, articleTitle);
    const result = buildRedirectRowsFromTitles(
        redirectTitlesResult,
        articleTitle,
        existingRedirectTitles,
    );
    return result;
}

/**
 * Builds redirect review rows from entered title values.
 *
 * @param titles - Redirect candidate titles.
 * @param articleTitle - Saved article title.
 * @param existingRedirectTitles - Existing page titles.
 * @returns Redirect review rows.
 */
export function buildRedirectRowsFromTitles(
    titles: Array<string>,
    articleTitle: string,
    existingRedirectTitles: PageTitleMatch[] = [],
): Array<any> {
    const existingRows = createExistingTitleRows(existingRedirectTitles);
    const targetKey = normalizeTitleKey(articleTitle);
    const seen = new Set<string>();

    const context = { existingRows, seen, targetKey };
    const flatMapCallbackB = function callback(title: string) {
        return normalizeRedirectReviewTitle(title, context);
    };
    const rows = titles.map(normalizeTitle).flatMap(flatMapCallbackB);

    return rows;
}

/**
 * Normalizes one redirect candidate into a unique review row.
 *
 * @param title - Page title.
 * @param context - Operation context.
 * @returns One redirect candidate into a unique review row.
 */
function normalizeRedirectReviewTitle(
    title: string,
    context: {
        existingRows: DynamicRecord[];
        seen: Set<string>;
        targetKey: string;
    },
): Array<unknown> {
    const resolvedTitle = normalizeTitle(title);
    const resolvedKey = normalizeTitleKey(resolvedTitle);

    if (
        resolvedKey === '' ||
        resolvedKey === context.targetKey ||
        context.seen.has(resolvedKey)
    ) {
        return [];
    }

    const existing = findExistingTitleRow(resolvedTitle, context.existingRows);
    const exists = existing?.exists === true;

    context.seen.add(resolvedKey);

    const result = [
        {
            enabled: !exists,
            exists,
            status: getExistenceStatus(exists),
            title: resolvedTitle,
        },
    ];
    return result;
}

/**
 * Gets unique localized aliases suitable for redirect pages.
 *
 * @param form - Submitted dialog form.
 * @param articleTitle - Saved article title.
 * @returns Redirect page titles.
 */
export function buildRedirectTitles(
    form: any,
    articleTitle: string,
): Array<string> {
    const targetKey = normalizeTitleKey(articleTitle);
    const names = getNameRedirectTitles(form);
    const seen = new Set<string>();

    const filterCallback = function callback(title: string) {
        const key = normalizeTitleKey(title);

        if (key === '' || key === targetKey || seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    };
    const result = names.map(normalizeTitle).filter(filterCallback);
    return result;
}

/**
 * Gets rows to convert into pre-save redirect actions.
 *
 * @param form - Submitted dialog form.
 * @param articleTitle - Saved article title.
 * @returns Redirect rows.
 */
function getPreSaveRedirectRows(form: any, articleTitle: string): Array<any> {
    let rows = form.redirectRows;

    if (!Array.isArray(rows)) {
        rows = buildRedirectRows(form, articleTitle);
    }
    const targetKey = normalizeTitleKey(articleTitle);
    const seen = new Set<string>();

    const context = { seen, targetKey };
    const flatMapCallbackA = function callback(row: {
        title: string;
        pendingEdit: DynamicRecord | null;
        enabled: boolean;
        exists: boolean;
    }) {
        return normalizePreSaveRedirectRow(row, context);
    };
    const normalized = rows.flatMap(flatMapCallbackA);

    return normalized;
}

/**
 * Normalizes one row into a unique pre-save redirect row.
 *
 * @param row - Row values.
 * @param context - Operation context.
 * @returns One row into a unique pre-save redirect row.
 */
function normalizePreSaveRedirectRow(
    row: {
        title: string;
        pendingEdit: DynamicRecord | null;
        enabled: boolean;
        exists: boolean;
    },
    context: { seen: Set<string>; targetKey: string },
): Array<unknown> {
    const title = normalizeTitle(row.title);
    const key = normalizeTitleKey(title);

    if (row.pendingEdit != null || key === '' || key === context.targetKey) {
        return [];
    }

    if (context.seen.has(key)) {
        return [];
    }

    context.seen.add(key);

    const result = [
        {
            enabled: row.enabled !== false,
            exists: row.exists === true,
            title,
        },
    ];
    return result;
}

/**
 * Creates a redirect pre-save action.
 *
 * @param row - Redirect review row.
 * @param title - Saved article title.
 * @param existingKeys - Existing redirect title keys.
 * @returns Redirect pre-save action.
 */
function createRedirectAction(
    row: any,
    title: string,
    existingKeys: Set<string>,
): any {
    const redirectTitle = normalizeTitle(row.title);
    let exists = row.exists === true;

    if (!exists) {
        const redirectKey = normalizeTitleKey(redirectTitle);
        exists = existingKeys.has(redirectKey);
    }

    let displayLabel = `Redirect to [[${title}]]`;
    let label = `Redirect name: ${redirectTitle} to ${title}`;

    if (exists) {
        displayLabel = 'Redirect page already exists';
        label = `Redirect: ${redirectTitle} (page exists)`;
    }

    const result = {
        displayLabel,
        id: `redirect:${redirectTitle}`,
        exists,
        label,
        pageTitle: redirectTitle,
        redirectTitle,
        selected: row.enabled !== false && !exists,
        targetTitle: title,
        type: 'redirect',
    };
    return result;
}

/**
 * Normalizes existing title matches into keyed rows.
 *
 * @param values - Existing title matches.
 * @returns Existing title rows.
 */
function createExistingTitleRows(values: PageTitleMatch[]): Array<any> {
    return values.map(createExistingTitleRow);
}

/**
 * Normalizes one existing title match.
 *
 * @param value - Existing title match.
 * @returns Existing title row.
 */
function createExistingTitleRow(value: PageTitleMatch) {
    const requestedTitle = normalizeTitle(value.requestedTitle);
    const title = normalizeTitle(value.title);
    return {
        exists: value.exists,
        key: normalizeTitleKey(requestedTitle),
        requestedTitle,
        title,
    };
}

/**
 * Finds an existing title match for the requested row.
 *
 * @param title - Requested title.
 * @param rows - Existing title rows.
 * @returns Existing title row.
 */
function findExistingTitleRow(
    title: string,
    rows: Array<any>,
): any | undefined {
    const findCallback = (item: any) => item.key === normalizeTitleKey(title);
    return rows.find(findCallback);
}

/**
 * Builds unique normalized titles for MediaWiki conversion and lookup.
 *
 * @param titles - Requested titles.
 * @returns Titles to query.
 */
export function getRedirectTitleCheckTitles(
    titles: Array<string>,
): Array<string> {
    const seen = new Set();
    const values = [];

    for (const value of titles.map(normalizeTitle)) {
        const key = normalizeTitleKey(value);

        if (key === '' || seen.has(key)) {
            continue;
        }

        seen.add(key);
        values.push(value);
    }

    return values;
}

/**
 * Gets the compact existence status.
 *
 * @param exists - Whether the page exists.
 * @returns Status text.
 */
function getExistenceStatus(exists: boolean): string {
    return exists ? 'Exists' : 'Missing';
}

function fallbackMessage(
    id: PreSaveMessageId,
    values: Record<string, string | number> = {},
): string {
    return Object.entries(values).reduce<string>(
        (text, [key, value]) => text.replace(`{${key}}`, String(value)),
        String(id),
    );
}
