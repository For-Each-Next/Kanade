/**
 * @file src/vg-stub-creator/features/creator/pre-save.ts
 * Purpose: Builds the pre-save review dialog UI.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. PreSaveAction
 * 4. PreSaveRow
 * 5. PreSaveGroup
 * 6. createPreSaveGroups
 * 7. addPreSaveActionGroups
 * 8. findPreSaveGroup
 * 9. createPreSaveActionRow
 * 10. createPreSaveNoteRows
 * 11. addArticleRegistrationGroup
 * 12. addCompanyRegistrationGroups
 * 13. getPreSaveGroup
 * 14. getPreSaveActionPageTitle
 * 15. getPreSaveActionDisplayLabel
 * 16. getPreSaveActionNotes
 * 17. movePreSaveWikidataRowsLast
 * 18. isPreSaveWikidataRow
 * 19. serializePreSaveProgressGroups
 * 20. getPreSaveRegistrationArticleTitle
 * 21. isCompanyCategoryPreSaveAction
 */

import { msg } from '../../i18n/index.ts';
import * as wikitext from '../../domain/wikitext/index.ts';
import { formatNamespaceTitle } from '../../../library/wiki-titles/wikipedia.ts';
const { trimValue } = wikitext;

interface PreSaveAction {
    category?: string;
    company?: string;
    displayLabel?: string;
    englishName?: string;
    id: string;
    label?: string;
    pageTitle?: string;
    redirectTitle?: string;
    selected?: boolean;
    type?: string;
    wikidataId?: string;
}

interface PreSaveRow {
    action?: PreSaveAction;
    key: string;
    label: string;
    type: string;
}

interface PreSaveGroup {
    key: string;
    rows: PreSaveRow[];
    title: string;
}

/**
 * Groups pre-save fixes by the page they will edit.
 *
 * @param actions - Prepared pre-save action rows.
 * @param form - Dialog form state.
 * @returns Page-grouped pre-save rows.
 */
export function createPreSaveGroups(
    actions: Array<any>,
    form: any,
): Array<any> {
    const groups: PreSaveGroup[] = [];
    const byTitle = new Map<string, PreSaveGroup>();
    const actionRows = Array.isArray(actions) ? actions : [];

    addPreSaveActionGroups(groups, byTitle, actionRows);
    addArticleRegistrationGroup(groups, byTitle, actionRows, form);
    addCompanyRegistrationGroups(groups, byTitle, actionRows, form);

    const result = groups
        .filter((group) => group.rows.length > 0)
        .map(movePreSaveWikidataRowsLast);
    return result;
}

/**
 * Adds selected action and bundled-action rows to page groups.
 *
 * @param groups - Groups value.
 * @param byTitle - By title value.
 * @param actionRows - Action rows value.
 */
function addPreSaveActionGroups(
    groups: PreSaveGroup[],
    byTitle: Map<string, PreSaveGroup>,
    actionRows: PreSaveAction[],
): void {
    for (const action of actionRows) {
        if (action?.selected === false) {
            continue;
        }

        const group = findPreSaveGroup(groups, byTitle, action);

        if (group == null) {
            continue;
        }

        const preSaveActionRowResult = createPreSaveActionRow(action);
        group.rows.push(preSaveActionRowResult);
        const preSaveNoteRowsResult = createPreSaveNoteRows(action);
        group.rows.push(...preSaveNoteRowsResult);
    }
}

/**
 * Finds or creates the page group for an action.
 *
 * @param groups - Groups value.
 * @param byTitle - By title value.
 * @param action - Action value.
 * @returns Or creates the page group for an action.
 */
function findPreSaveGroup(
    groups: PreSaveGroup[],
    byTitle: Map<string, PreSaveGroup>,
    action: PreSaveAction,
): PreSaveGroup | undefined {
    const title = getPreSaveActionPageTitle(action);

    return title === '' ? undefined : getPreSaveGroup(groups, byTitle, title);
}

/**
 * Creates the primary row for a pre-save action.
 *
 * @param action - Action value.
 * @returns The primary row for a pre-save action.
 */
function createPreSaveActionRow(action: PreSaveAction): PreSaveRow {
    const result = {
        action,
        key: action.id,
        label: getPreSaveActionDisplayLabel(action),
        type: 'action',
    };
    return result;
}

/**
 * Creates bundled-note rows for a pre-save action.
 *
 * @param action - Action value.
 * @returns Bundled-note rows for a pre-save action.
 */
function createPreSaveNoteRows(action: PreSaveAction): PreSaveRow[] {
    const rows = getPreSaveActionNotes(action).map(function callback(note) {
        const result = {
            action,
            key: `${action.id}:${note.key}`,
            label: note.label,
            type: 'bundled-action',
        };
        return result;
    });

    return rows;
}

/**
 * Adds the submitted article's new-page-list registration row.
 *
 * @param groups - Groups value.
 * @param byTitle - By title value.
 * @param actions - Actions value.
 * @param form - Form values.
 */
function addArticleRegistrationGroup(
    groups: PreSaveGroup[],
    byTitle: Map<string, PreSaveGroup>,
    actions: PreSaveAction[],
    form: { registerNewPage: boolean },
): void {
    const title = getPreSaveRegistrationArticleTitle(actions);

    if (title === '' || !form.registerNewPage) {
        return;
    }

    const rows = getPreSaveGroup(groups, byTitle, title).rows;
    const label = msg('progress.registerNewPage');
    rows.push({
        key: 'register-new-page',
        label,
        type: 'registration',
    });
}

/**
 * Adds new-page-list rows for selected company-category actions.
 *
 * @param groups - Groups value.
 * @param byTitle - By title value.
 * @param actions - Actions value.
 * @param form - Form values.
 */
function addCompanyRegistrationGroups(
    groups: PreSaveGroup[],
    byTitle: Map<string, PreSaveGroup>,
    actions: PreSaveAction[],
    form: { registerNewPage: boolean },
): void {
    const companyActions = actions.filter(isCompanyCategoryPreSaveAction);

    for (const action of companyActions) {
        if (action?.selected === false || !form.registerNewPage) {
            continue;
        }

        const title = getPreSaveActionPageTitle(action);

        if (title === '') {
            continue;
        }

        const rows = getPreSaveGroup(groups, byTitle, title).rows;
        const label = msg('progress.registerNewPage');
        rows.push({
            key: `${action.id}:register-new-page`,
            label,
            type: 'registration',
        });
    }
}

/**
 * Gets or creates a pre-save page group.
 *
 * @param groups - Groups value.
 * @param byTitle - By title value.
 * @param title - Page title.
 * @returns Or creates a pre-save page group.
 */
function getPreSaveGroup(
    groups: PreSaveGroup[],
    byTitle: Map<string, PreSaveGroup>,
    title: string,
): PreSaveGroup {
    const normalizedTitle = trimValue(title);

    if (!byTitle.has(normalizedTitle)) {
        const group = {
            key: normalizedTitle,
            title: normalizedTitle,
            rows: [],
        };

        byTitle.set(normalizedTitle, group);
        groups.push(group);
    }

    return byTitle.get(normalizedTitle)!;
}

/**
 * Gets the display page title for a pre-save action.
 *
 * @param action - Pre-save action row.
 * @returns Page title.
 */
function getPreSaveActionPageTitle(action: any): string {
    const categoryTitle =
        action?.type === 'category'
            ? formatNamespaceTitle(String(action.category ?? ''), 'zhwiki', 14)
            : '';
    const result = trimValue(
        action?.pageTitle || action?.redirectTitle || categoryTitle,
    );
    return result;
}

/**
 * Gets the short display label for a pre-save action.
 *
 * @param action - Pre-save action row.
 * @returns Display label.
 */
function getPreSaveActionDisplayLabel(action: any): string {
    return trimValue(action?.displayLabel) || trimValue(action?.label);
}

/**
 * Gets non-selectable notes for bundled work inside a pre-save action.
 *
 * @param action - Pre-save action row.
 * @returns Display notes.
 */
function getPreSaveActionNotes(action: any): Array<any> {
    if (action?.type !== 'category' || trimValue(action.company) === '') {
        return [];
    }

    const category = trimValue(action.category);
    const notes = [
        {
            key: 'talk-banner',
            label: msg('presave.tagBanner', {
                title: formatNamespaceTitle(category, 'zhwiki', 15),
            }),
        },
    ];

    const wikidataId = trimValue(action.wikidataId);

    if (wikidataId !== '') {
        const messageG = {
            key: 'wikidata',
            label: msg('presave.connectTo', { target: `d:${wikidataId}` }),
        };
        notes.push(messageG);
    } else if (trimValue(action.englishName) !== '') {
        const messageF = {
            key: 'wikidata',
            label: msg('progress.connectCategory'),
        };
        notes.push(messageF);
    }

    return notes;
}

/**
 * Moves Wikidata rows to the end of one pre-save group.
 *
 * @param group - Pre-save group.
 * @returns Group with reordered rows.
 */
function movePreSaveWikidataRowsLast(group: any): any {
    let rows: Array<Record<string, unknown>> = [];

    if (Array.isArray(group?.rows)) {
        rows = group.rows;
    }
    const wikidataRows = rows.filter(isPreSaveWikidataRow);
    const filterCallback = (row: Record<string, unknown>) =>
        !isPreSaveWikidataRow(row);
    const otherRows = rows.filter(filterCallback);

    const result = {
        ...group,
        rows: [...otherRows, ...wikidataRows],
    };
    return result;
}

/**
 * Checks whether a pre-save row updates Wikidata.
 *
 * @param row - Pre-save row.
 * @returns Whether the row is a Wikidata row.
 */
function isPreSaveWikidataRow(row: any): boolean {
    const key = trimValue(row?.key);

    return key === 'interwiki' || key.endsWith(':wikidata');
}

/**
 * Serializes pre-save groups for progress display.
 *
 * @param groups - Pre-save checkbox groups.
 * @returns Serializable progress groups.
 */
export function serializePreSaveProgressGroups(groups: Array<any>): Array<any> {
    const mapCallback = function callback(group: any) {
        const mapCallbackA = function callback(row: {
            key: unknown;
            label: unknown;
            type: unknown;
        }) {
            const result = {
                key: trimValue(row?.key),
                label: trimValue(row?.label),
                type: trimValue(row?.type),
            };
            return result;
        };
        const result = {
            key: trimValue(group?.key),
            rows: (Array.isArray(group?.rows) ? group.rows : []).map(
                mapCallbackA,
            ),
            title: trimValue(group?.title),
        };
        return result;
    };
    const result = (Array.isArray(groups) ? groups : []).map(mapCallback);
    return result;
}

/**
 * Gets the article page that will be added to the new-page list.
 *
 * @param actions - Prepared pre-save action rows.
 * @returns Article title.
 */
function getPreSaveRegistrationArticleTitle(actions: Array<any>): string {
    const selectedActions = actions.filter(
        (action) => action?.selected !== false,
    );
    const action =
        selectedActions.find((item) => item.type === 'talk-banner') ||
        selectedActions.find((item) => item.type === 'interwiki') ||
        selectedActions.find((item) => item.type !== 'redirect');

    return getPreSaveActionPageTitle(action);
}

/**
 * Checks whether an action creates a company category.
 *
 * @param action - Pre-save action row.
 * @returns Whether the action creates a company category.
 */
function isCompanyCategoryPreSaveAction(action: any): boolean {
    return action?.type === 'category' && trimValue(action.company) !== '';
}
