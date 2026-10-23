/**
 * @file src/vg-stub-creator/platform/browser/storage/form-history.ts
 * Purpose: Stores and restores vg-stub-creator form history.
 *
 * Table of contents:
 * 1. Imports
 * 2. FormHistoryMessages
 * 3. FormHistoryContext
 * 4. Constants and state
 * 5. createFormHistoryStore
 * 6. readFormDraft
 * 7. readFormDraftForPage
 * 8. readFormDraftEntry
 * 9. saveFormDraft
 * 10. readFormHistory
 * 11. saveFormHistory
 * 12. deleteFormHistoryEntry
 * 13. clearFormHistory
 * 14. createFormHistoryEntry
 * 15. isFormHistoryEntry
 * 16. createHistoryEntryId
 * 17. createHistoryData
 * 18. createInputData
 * 19. createPatchData
 * 20. getCitationPatches
 * 21. getCitationParamPatches
 * 22. getCategoryPatches
 * 23. createCategoryPatch
 * 24. createManualCategoryPatch
 * 25. createCategoryPatchSource
 * 26. getNavboxPatches
 * 27. createChangedValuePatch
 * 28. createPresentValuePatch
 * 29. isSameJsonValue
 * 30. getPatchedNoteTaRows
 * 31. isManualCategoryRow
 * 32. isModifiedCategoryRow
 * 33. writeFormHistory
 * 34. writeStorageItem
 * 35. readFormDraftSavedAt
 * 36. readFormDraftPage
 * 37. removeStorageItem
 * 38. cloneValue
 * 39. normalizePage
 */

import type { FormHistoryAdapterPorts } from '../../../app/contracts/application.ts';
import { normalizeArticleFormInput } from '../../../domain/article-input.ts';

export interface FormHistoryMessages {
    temporaryDraft: string;
    untitled: string;
}

interface FormHistoryContext {
    getStorage: () => Storage | undefined;
    messages: FormHistoryMessages;
}

const HISTORY_LIMIT = 20;
const HISTORY_STORAGE_KEY = 'vg-stub-creator-form-history';
const DRAFT_STORAGE_KEY = 'vg-stub-creator-form-draft';
const DRAFT_PAGE_STORAGE_KEY = 'vg-stub-creator-form-draft-page';
const DRAFT_SAVED_AT_STORAGE_KEY = 'vg-stub-creator-form-draft-saved-at';
const HISTORY_DATA_VERSION = 1;
const FNV_OFFSET_BASIS = 2_166_136_261;
const FNV_PRIME = 16_777_619;
const INPUT_FORM_KEYS = new Set([
    'additionalProse',
    'additionalProseSourceUrl',
    'developers',
    'developersSourceUrl',
    'englishName',
    'englishNameSourceUrl',
    'enwikiTitle',
    'genres',
    'genresSourceUrl',
    'localizedNames',
    'nameAliases',
    'metacriticScore',
    'metacriticScoreSourceUrl',
    'name',
    'nameRoleRows',
    'openCriticRecommend',
    'openCriticRecommendSourceUrl',
    'originalName',
    'originalNameSourceUrl',
    'pageName',
    'platforms',
    'platformsSourceUrl',
    'publishers',
    'publishersSourceUrl',
    'redirectRows',
    'registerNewPage',
    'series',
    'seriesSourceUrl',
    'sortKey',
    'stubTagRows',
    'year',
    'yearSourceUrl',
]);

/** Creates form-history operations bound to browser storage. */
export function createFormHistoryStore(
    getStorage: () => Storage | undefined,
    messages: FormHistoryMessages,
): FormHistoryAdapterPorts {
    const context = { getStorage, messages };
    return {
        clearFormHistory: clearFormHistory.bind(null, context),
        deleteFormHistoryEntry: deleteFormHistoryEntry.bind(null, context),
        readFormDraftEntry: readFormDraftEntry.bind(null, context),
        readFormDraftForPage: readFormDraftForPage.bind(null, context),
        readFormHistory: readFormHistory.bind(null, context),
        saveFormDraft: saveFormDraft.bind(null, context),
        saveFormHistory: saveFormHistory.bind(null, context),
    };
}

/**
 * Reads the current form draft.
 *
 * @returns Stored draft form values.
 */
function readFormDraft(context: FormHistoryContext): any | undefined {
    try {
        const storage = context.getStorage();
        if (storage == null) {
            return undefined;
        }

        const storedDraft = storage.getItem(DRAFT_STORAGE_KEY);

        if (storedDraft == null) {
            return undefined;
        }

        const draft: unknown = JSON.parse(storedDraft);

        return draft == null || typeof draft !== 'object' ? undefined : draft;
    } catch (_error) {
        return undefined;
    }
}

/**
 * Reads the current form draft when it belongs to the given page.
 *
 * @param page - Current page title.
 * @returns Stored draft form values.
 */
function readFormDraftForPage(
    context: FormHistoryContext,
    page: string,
): any | undefined {
    const draft = readFormDraft(context);

    if (draft == null) {
        return undefined;
    }

    const draftPage = readFormDraftPage(context);
    if (normalizePage(draftPage) !== normalizePage(page)) {
        return undefined;
    }

    return draft;
}

/**
 * Reads the current form draft as a history-style entry.
 *
 * @returns Draft history entry.
 */
function readFormDraftEntry(context: FormHistoryContext): any | undefined {
    const form = readFormDraft(context);
    const readFormDraftPageResult = readFormDraftPage(context);
    const page = normalizePage(readFormDraftPageResult);

    if (form == null) {
        return undefined;
    }

    const result = {
        data: createHistoryData(form),
        id: 0,
        metadata: {
            page,
            savedAt: readFormDraftSavedAt(context),
            temporary: true,
        },
    };
    return result;
}

/**
 * Saves the current form draft.
 *
 * @param form - Dialog form values.
 * @param page - Page title associated with the draft.
 * @returns Result when the function
 *   saves the current form draft.
 */
function saveFormDraft(
    context: FormHistoryContext,
    form: any,
    page: string = '',
): void {
    const cloneValueResultA = cloneValue(form);
    writeStorageItem(context, DRAFT_STORAGE_KEY, cloneValueResultA);
    const pageResultA = normalizePage(page);
    writeStorageItem(context, DRAFT_PAGE_STORAGE_KEY, pageResultA);
    const toLocaleStringResult = new Date().toLocaleString();
    writeStorageItem(context, DRAFT_SAVED_AT_STORAGE_KEY, toLocaleStringResult);
}

/**
 * Reads stored form history.
 *
 * @returns Stored history entries.
 */
function readFormHistory(context: FormHistoryContext): Array<any> {
    try {
        const storage = context.getStorage();
        if (storage == null) {
            return [];
        }

        const storedHistory = storage.getItem(HISTORY_STORAGE_KEY);

        if (storedHistory == null) {
            return [];
        }

        const entries: unknown = JSON.parse(storedHistory);
        return Array.isArray(entries) ? entries.filter(isFormHistoryEntry) : [];
    } catch (_error) {
        return [];
    }
}

/**
 * Saves one form snapshot to history.
 *
 * @param form - Dialog form values.
 * @param page - Page title associated with the snapshot.
 * @param citations - Citation cache keyed by source URL.
 * @returns Result when the function
 *   saves one form snapshot to history.
 */
function saveFormHistory(
    context: FormHistoryContext,
    form: any,
    page: string,
    citations: any = {},
): void {
    const entry = createFormHistoryEntry(context, form, page, citations);
    const entries = [
        entry,
        ...readFormHistory(context).filter((item) => item.id !== entry.id),
    ].slice(0, HISTORY_LIMIT);

    writeFormHistory(context, entries);
}

/**
 * Deletes one form history entry.
 *
 * @param id - History entry ID.
 * @returns Result when the function
 *   deletes one form history entry.
 */
function deleteFormHistoryEntry(context: FormHistoryContext, id: string): void {
    const filteredValuesC = readFormHistory(context).filter(
        (entry) => entry.id !== id,
    );
    writeFormHistory(context, filteredValuesC);
}

/**
 * Clears all form history entries.
 *
 * @returns Result when the function
 *   clears all form history entries.
 */
function clearFormHistory(context: FormHistoryContext): void {
    removeStorageItem(context, HISTORY_STORAGE_KEY);
}

/**
 * Creates one form history entry.
 *
 * @param form - Dialog form values.
 * @param page - Page title associated with the snapshot.
 * @param citations - Citation cache keyed by source URL.
 * @returns History entry.
 */
function createFormHistoryEntry(
    context: FormHistoryContext,
    form: any,
    page: string,
    citations: any,
): any {
    const snapshot = cloneValue(form);
    let historyPage = normalizePage(page);

    if (!historyPage) {
        historyPage = normalizePage(snapshot.pageName);
    }

    if (!historyPage) {
        historyPage = normalizePage(snapshot.name);
    }

    if (!historyPage) {
        historyPage = context.messages.untitled;
    }

    const result = {
        data: createHistoryData(snapshot, citations),
        id: createHistoryEntryId(snapshot, page),
        metadata: {
            page: historyPage,
            savedAt: new Date().toLocaleString(),
        },
    };
    return result;
}

/**
 * Handles is form history entry.
 *
 * Checks whether a stored value matches the current history entry
 * shape.
 *
 * @param entry - Stored history value.
 * @returns Whether the entry can be used as form history.
 */
function isFormHistoryEntry(entry: any): boolean {
    if (
        entry == null ||
        typeof entry !== 'object' ||
        !Number.isInteger(entry.id)
    ) {
        return false;
    }

    if (entry.data == null || typeof entry.data !== 'object') {
        return false;
    }

    return entry.metadata != null && typeof entry.metadata === 'object';
}

/**
 * Creates a stable history entry ID.
 *
 * @param form - Stored form values.
 * @param page - Page title associated with the snapshot.
 * @returns History entry ID.
 */
function createHistoryEntryId(form: any, page: string): number {
    const pageResult = [normalizePage(page), form];
    const text = JSON.stringify(pageResult);
    let hash = FNV_OFFSET_BASIS;

    for (const character of text) {
        const charCodeAtResult = hash ^ character.charCodeAt(0);
        hash = Math.imul(charCodeAtResult, FNV_PRIME);
    }

    return hash >>> 0 || 1;
}

/**
 * Creates a structured history payload grouped by data provenance.
 *
 * @param form - Dialog form values.
 * @param _citations - Reserved citation data.
 * @returns Provenance-aware history data.
 */
function createHistoryData(form: any, _citations = {}): any {
    const result = {
        input: createInputData(form),
        patches: createPatchData(form),
        version: HISTORY_DATA_VERSION,
    };
    return result;
}

/**
 * Gets user-entered values from a form snapshot.
 *
 * @param form - Dialog form values.
 * @returns User-entered input data.
 */
function createInputData(form: any): any {
    const cloneValueResult = normalizeArticleFormInput(cloneValue(form));
    if (Array.isArray(cloneValueResult.redirectRows)) {
        cloneValueResult.redirectRows = cloneValueResult.redirectRows.map(
            (row: any) => ({
                ...row,
                fixed: false,
                fixedTitle: '',
                exists: false,
                status:
                    row.pendingEdit != null
                        ? row.pendingEdit.create
                            ? 'Pending creation'
                            : 'Pending edit'
                        : 'Unchecked',
            }),
        );
    }
    const filterCallbackC = function callback([key]: [string, unknown]) {
        return INPUT_FORM_KEYS.has(key);
    };
    const filteredValuesB =
        Object.entries(cloneValueResult).filter(filterCallbackC);
    const result = Object.fromEntries(filteredValuesB);
    return result;
}

/**
 * Gets user-edited patches derived from generated values.
 *
 * @param form - Dialog form values.
 * @returns Patch data.
 */
function createPatchData(form: any): any {
    const result = {
        categories: getCategoryPatches(form),
        citations: getCitationPatches(form),
        navboxes: getNavboxPatches(form),
        noteTa: getPatchedNoteTaRows(form),
    };
    return result;
}

/**
 * Gets citation patches keyed by source URL.
 *
 * @param form - Dialog form values.
 * @returns Citation patches.
 */
function getCitationPatches(form: any): Array<any> {
    const citationRows: Array<{
        modified: boolean;
        sourceUrl: string;
        template: string;
    }> = form.citationRows || [];
    const mapCallbackC = function callback(row: {
        sourceUrl: unknown;
        template: unknown;
    }) {
        const result = {
            sourceUrl: row.sourceUrl,
            params: getCitationParamPatches(row),
            ...createChangedValuePatch(
                {
                    template: row.template,
                },
                {
                    template: 'cite web',
                },
            ),
        };
        return result;
    };
    const result = citationRows
        .filter((row) => row.modified === true)
        .map(mapCallbackC);
    return result;
}

/**
 * Gets citation parameter patches keyed by parameter name.
 *
 * @param row - Citation row.
 * @returns Citation parameter patches.
 */
function getCitationParamPatches(row: any): Array<any> {
    const currentParams: Array<{ name: string; value: string }> =
        row.params || [];
    const originalParams: Array<{ name: string; value: string }> =
        row.generatedParams || [];
    const currentEntries: Array<[string, string]> = currentParams.map(
        (param) => [param.name, param.value],
    );
    const params = new Map(currentEntries);
    const originalEntries: Array<[string, string]> = originalParams.map(
        (param) => [param.name, param.value],
    );
    const generatedParams = new Map(originalEntries);
    const currentNames = params.keys();
    const generatedNames = generatedParams.keys();
    const names = new Set([...currentNames, ...generatedNames]);

    const filterCallbackB = function callback(name: string) {
        const configValue = params.get(name);
        const configValueA = generatedParams.get(name);
        const result = !isSameJsonValue(configValue, configValueA);
        return result;
    };
    const mapCallbackB = function callback(name: string) {
        const result = {
            name,
            value: params.has(name) ? params.get(name) : null,
        };
        return result;
    };
    const result = Array.from(names).filter(filterCallbackB).map(mapCallbackB);
    return result;
}

/**
 * Gets category patches keyed by their minimum source.
 *
 * @param form - Dialog form values.
 * @returns Category patches.
 */
function getCategoryPatches(form: any): Array<any> {
    const filterCallbackA = function callback(row: {
        enabled: boolean;
        stubTagEnabled: unknown;
        originalStubTagEnabled: unknown;
    }) {
        if (isManualCategoryRow(row) || isModifiedCategoryRow(row)) {
            return true;
        }

        return (
            row.enabled === false ||
            row.stubTagEnabled !== row.originalStubTagEnabled
        );
    };
    const mapCallbackA = function callback(row: unknown) {
        if (isManualCategoryRow(row)) {
            return createManualCategoryPatch(row);
        }

        return createCategoryPatch(row);
    };
    const result = (form.categoryRows || [])
        .filter(filterCallbackA)
        .map(mapCallbackA);
    return result;
}

/**
 * Creates a minimal category patch row.
 *
 * @param row - Category row.
 * @returns Minimal category patch.
 */
function createCategoryPatch(row: any): any {
    const result = {
        source: createCategoryPatchSource(row),
        ...createChangedValuePatch(
            {
                category: row.category,
                company: row.company || '',
                enabled: row.enabled !== false,
                status: row.status || '',
                stubTag: row.stubTag || '',
                stubTagEnabled: row.stubTagEnabled === true,
            },
            {
                category: row.originalCategory || row.category,
                company: row.company || '',
                enabled: true,
                status: row.status || '',
                stubTag: row.stubTag || '',
                stubTagEnabled: row.originalStubTagEnabled === true,
            },
        ),
    };
    return result;
}

/**
 * Creates a manually added category patch row.
 *
 * @param row - Category row.
 * @returns Manual category patch.
 */
function createManualCategoryPatch(row: any): any {
    const result = {
        source: {
            manual: true,
        },
        ...createPresentValuePatch({
            category: row.category,
            company: row.company || '',
            enabled: row.enabled !== false,
            status: row.status || '',
            stubTag: row.stubTag || '',
            stubTagEnabled: row.stubTagEnabled === true,
        }),
    };
    return result;
}

/**
 * Creates a category patch source.
 *
 * @param row - Category row.
 * @returns Category patch source.
 */
function createCategoryPatchSource(row: any): any {
    if (row.company) {
        const result = {
            company: row.company,
        };
        return result;
    }

    const result = {
        category: row.originalCategory || row.category,
    };
    return result;
}

/**
 * Gets navbox patches keyed by generated title.
 *
 * @param form - Dialog form values.
 * @returns Navbox patches.
 */
function getNavboxPatches(form: any): Array<any> {
    const mapCallback = function callback(row: {
        title: unknown;
        text: unknown;
        enabled: boolean;
    }) {
        const result = {
            source: {
                title: row.title || row.text,
            },
            ...createChangedValuePatch(
                {
                    enabled: row.enabled !== false,
                    text: row.text,
                },
                {
                    enabled: true,
                    text: row.title || row.text,
                },
            ),
        };
        return result;
    };
    const result = (form.navboxRows || [])
        .filter(function isChanged(row: {
            enabled: boolean;
            text: string;
            title: string;
        }) {
            return row.enabled === false || row.text !== row.title;
        })
        .map(mapCallback);
    return result;
}

/**
 * Creates a patch containing only changed values.
 *
 * @param values - Current values.
 * @param baseValues - Generated values.
 * @returns Changed values.
 */
function createChangedValuePatch(values: any, baseValues: any): any {
    const filterCallback = function hasChangedValue([key, value]: [
        string,
        unknown,
    ]) {
        return !isSameJsonValue(value, baseValues[key]);
    };
    const filteredValuesA = Object.entries(values).filter(filterCallback);
    const result = Object.fromEntries(filteredValuesA);
    return result;
}

/**
 * Creates a patch containing only values that carry information.
 *
 * @param values - Current values.
 * @returns Present values.
 */
function createPresentValuePatch(values: any): any {
    const filteredValues = Object.entries(values).filter(function callback([
        _key,
        value,
    ]) {
        if (value === '' || value === false) {
            return false;
        }

        return value != null;
    });
    const result = Object.fromEntries(filteredValues);
    return result;
}

/**
 * Compares JSON-safe values.
 *
 * @param left - First value.
 * @param right - Second value.
 * @returns Whether the values are equal.
 */
function isSameJsonValue(left: any, right: any): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Gets user-edited NoteTA rows.
 *
 * @param form - Dialog form values.
 * @returns Patched NoteTA rows.
 */
function getPatchedNoteTaRows(form: any): Array<any> {
    const noteTaRows: Array<{ modified: boolean }> = form.noteTaRows || [];
    const result = noteTaRows.filter((row) => row.modified === true);
    return result;
}

/**
 * Checks whether a category row was manually added.
 *
 * @param row - Category row.
 * @returns Whether the row is manual.
 */
function isManualCategoryRow(row: any): boolean {
    return /manual/u.test(row.source || '');
}

/**
 * Checks whether a generated category row was changed.
 *
 * @param row - Category row.
 * @returns Whether the row is modified.
 */
function isModifiedCategoryRow(row: any): boolean {
    return /†$/u.test(row.source || '');
}

/**
 * Writes form history entries to storage.
 *
 * @param entries - History entries.
 * @returns Result when the function
 *   writes form history entries to storage.
 */
function writeFormHistory(
    context: FormHistoryContext,
    entries: Array<any>,
): void {
    writeStorageItem(context, HISTORY_STORAGE_KEY, entries);
}

/**
 * Writes a value to local storage.
 *
 * @param key - Storage key.
 * @param value - Stored value.
 * @returns Result when the function
 *   writes a value to local storage.
 */
function writeStorageItem(
    context: FormHistoryContext,
    key: string,
    value: any,
): void {
    try {
        const stringifyResultA = JSON.stringify(value);
        context.getStorage()?.setItem(key, stringifyResultA);
    } catch (_error) {
        // Ignore storage quota and privacy-mode failures.
    }
}

/**
 * Reads the draft save timestamp.
 *
 * @returns Draft save timestamp.
 */
function readFormDraftSavedAt(context: FormHistoryContext): string {
    try {
        const storedTimestamp = context
            .getStorage()
            ?.getItem(DRAFT_SAVED_AT_STORAGE_KEY);
        return storedTimestamp == null
            ? context.messages.temporaryDraft
            : JSON.parse(storedTimestamp);
    } catch (_error) {
        return context.messages.temporaryDraft;
    }
}

/**
 * Reads the page title associated with the current draft.
 *
 * @returns Draft page title.
 */
function readFormDraftPage(context: FormHistoryContext): string {
    try {
        const storedPage = context
            .getStorage()
            ?.getItem(DRAFT_PAGE_STORAGE_KEY);
        return storedPage == null ? '' : JSON.parse(storedPage);
    } catch (_error) {
        return '';
    }
}

/**
 * Removes a value from local storage.
 *
 * @param key - Storage key.
 * @returns Result when the function
 *   removes a value from local storage.
 */
function removeStorageItem(context: FormHistoryContext, key: string): void {
    try {
        context.getStorage()?.removeItem(key);
    } catch (_error) {
        // Ignore storage quota and privacy-mode failures.
    }
}

/**
 * Creates a plain cloned value.
 *
 * @param value - Source value.
 * @returns Cloned value.
 */
function cloneValue(value: any): any {
    const stringifyResult = JSON.stringify(value);
    return JSON.parse(stringifyResult);
}

/**
 * Normalizes a page title for display and identity.
 *
 * @param page - Page title.
 * @returns Normalized page title.
 */
function normalizePage(page: string): string {
    return String(page || '').trim();
}
