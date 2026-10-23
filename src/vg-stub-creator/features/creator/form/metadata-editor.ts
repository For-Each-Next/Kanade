/**
 * @file src/vg-stub-creator/features/creator/form/metadata-editor.ts
 * Purpose: Owns metadata editing state and actions for one creator dialog.
 *
 * Table of contents:
 * 1. Imports
 * 2. Dependencies
 * 3. createMetadataEditor
 */

import { trimValue, splitFieldValues } from '../../../domain/wikitext/index.ts';

import { isArticleListField } from '../../../domain/processor.ts';
import {
    formatNamespaceTitle,
    stripNamespacePrefix,
} from '../../../../library/wiki-titles/wikipedia.ts';
import { msg } from '../../../i18n/index.ts';
import { getErrorMessage } from '../error-message.ts';
import type { CreatorDialogOptions } from './dialog-options.ts';
import {
    cloneValue,
    createNavboxRow,
    createStubTagRow,
    ensureNavboxRows,
    ensureStubTagRows,
    isBlankCategoryRow,
    isBlankNavboxRow,
    isBlankStubTagRow,
    normalizeListFieldValue,
    syncCategoryRowFixedState,
} from './form-model.ts';
import type { MetadataItemRow } from './metadata-items.ts';
import {
    createMetadataItemRow,
    getMetadataFieldRows,
    getMetadataItemDetails,
    getRelatedItemOwner,
    serializeMetadataItemRows,
    syncMetadataItemRows,
} from './metadata-items.ts';
import { parseRelatedEntry } from './related-entry.ts';
import type { RelatedItemKind } from './related-items.ts';
import {
    buildRelatedFieldMetadata,
    getNavboxTitle,
    getRelatedIdentity,
    getRelatedItemField,
    RELATED_FIELDS,
    trimStubTagValue,
} from './related-items.ts';

interface Dependencies {
    Vue: any;
    form: any;
    options: Pick<
        CreatorDialogOptions,
        | 'onCheckPageTitle'
        | 'onCategoryRowsRefresh'
        | 'onPrepareReview'
        | 'onUpdateCategoryRowCategory'
        | 'onCreateCategoryRow'
    >;
    componentMounted: boolean;
    focusDialogControl: (controlRef: { value: any }) => void;
    runReviewRefresh: (refresh: () => Promise<void>) => Promise<void>;
    refreshCategoryRows: (refreshOptions?: any) => Promise<void>;
    refreshNavboxRows: (
        force: boolean,
        rebuild?: boolean,
        refreshOptions?: Record<string, unknown>,
    ) => Promise<void>;
    reviewState: any;
    categoryState: any;
    updateFieldDependencies: (key: string) => void;
    linkNavigationModifier: any;
    getCategoryPageUrl: (...args: any[]) => any;
    getNavboxPageUrl: (...args: any[]) => any;
    getStubTagPageUrl: (...args: any[]) => any;
    getReviewPageActionAriaLabel: (...args: any[]) => any;
    updateNavboxRow: (...args: any[]) => any;
    updateStubTagRow: (...args: any[]) => any;
    openCategoryEdit: (...args: any[]) => any;
    openNavboxEdit: (...args: any[]) => any;
    openStubTagEdit: (...args: any[]) => any;
}
export function createMetadataEditor(dependencies: Dependencies) {
    let disposed = false;
    let lifecycle = 0;
    const relatedFieldMetadata: any = dependencies.Vue.computed(() =>
        buildRelatedFieldMetadata(dependencies.form),
    );
    const metadataItems: any = dependencies.Vue.computed(() =>
        Object.fromEntries(
            RELATED_FIELDS.map((field) => [
                field,
                getMetadataFieldRows(dependencies.form, field).map((row) => ({
                    ...row,
                    ...getMetadataItemDetails(dependencies.form, field, row),
                })),
            ]),
        ),
    );
    const metadataEntryValues: Record<string, string> =
        dependencies.Vue.reactive(
            Object.fromEntries(RELATED_FIELDS.map((field) => [field, ''])),
        );
    const metadataItemDrafts: Record<string, string> =
        dependencies.Vue.reactive({});
    const relatedItemsEditing: Set<any> = dependencies.Vue.reactive(new Set());
    const relatedItemInputs: Map<any, any> = dependencies.Vue.reactive(
        new Map(),
    );
    const relatedItemEditSnapshots: Map<any, any> = new Map();
    const relatedEntryValues: Record<string, string> =
        dependencies.Vue.reactive({});
    const relatedEntriesEditing: Set<string> = dependencies.Vue.reactive(
        new Set(),
    );
    const relatedEntryInputs: Map<string, any> = new Map();
    const relatedPageStates: Map<
        any,
        { title: string; exists: boolean | null }
    > = dependencies.Vue.reactive(new Map());
    const relatedPageChecks: Map<
        any,
        { title: string; request: number; promise: Promise<void> }
    > = new Map();
    let relatedPageCheckRequest: number = 0;
    const relatedClickTimers: Map<
        any,
        {
            timer?: ReturnType<typeof setTimeout>;
            initialEnabled: boolean;
            applied: boolean;
        }
    > = new Map();
    let relatedItemsQueryKey: string = '';

    /** Gets the mutable collection shared by inline choices and final review. */
    function getRelatedRows(kind: RelatedItemKind): any[] {
        if (kind === 'category') {
            return dependencies.form.categoryRows;
        }

        return kind === 'navbox'
            ? dependencies.form.navboxRows || []
            : dependencies.form.stubTagRows || [];
    }

    /** Checks whether a related row is an unused trailing input. */
    function isBlankRelatedItem(row: any, kind: RelatedItemKind): boolean {
        return kind === 'category'
            ? isBlankCategoryRow(row)
            : kind === 'navbox'
              ? isBlankNavboxRow(row)
              : isBlankStubTagRow(row);
    }

    /** Focuses a newly rendered inline name input within its owned dialog. */
    function focusRelatedItemInput(row: any, kind: RelatedItemKind): void {
        const currentLifecycle = lifecycle;
        const focus = () => {
            if (
                disposed ||
                !dependencies.componentMounted ||
                lifecycle !== currentLifecycle ||
                row.relatedRemoved === true ||
                !getRelatedRows(kind).includes(row)
            ) {
                return;
            }

            const control = relatedItemInputs.get(row);

            if (control != null) {
                dependencies.focusDialogControl({ value: control });
            }
        };

        if (typeof dependencies.Vue.nextTick === 'function') {
            void dependencies.Vue.nextTick(focus);
            return;
        }

        focus();
    }

    /** Clears owned input controls, read results, and pending single-click timers. */
    function clearRelatedInteractionState(): void {
        for (const click of relatedClickTimers.values()) {
            if (click.timer) clearTimeout(click.timer);
        }
        relatedClickTimers.clear();
        relatedItemEditSnapshots.clear();
        relatedEntriesEditing.clear();
        relatedEntryInputs.clear();
        for (const key of Object.keys(relatedEntryValues))
            delete relatedEntryValues[key];
        relatedPageStates.clear();
        relatedPageChecks.clear();
    }

    /** Resolves the exact current category or template title for live existence checks. */
    function getRelatedPageTitle(row: any, kind: RelatedItemKind): string {
        return formatNamespaceTitle(
            methods.getRelatedItemLabel(row, kind),
            'zhwiki',
            kind === 'category' ? 14 : 10,
        );
    }

    /** Checks every presented title through the API, including bundled known suggestions. */
    async function checkRelatedPageRows(): Promise<void> {
        await Promise.all(
            (['category', 'navbox', 'stubTag'] as RelatedItemKind[]).flatMap(
                (kind) =>
                    getRelatedRows(kind)
                        .filter(
                            (row) =>
                                row.relatedRemoved !== true &&
                                !isBlankRelatedItem(row, kind),
                        )
                        .map((row) => checkRelatedPageRow(row, kind)),
            ),
        );
    }

    /** Deduplicates only pending reads and rejects stale results without altering reviewed choices. */
    function checkRelatedPageRow(
        row: any,
        kind: RelatedItemKind,
    ): Promise<void> {
        if (
            disposed ||
            dependencies.options.onCheckPageTitle == null ||
            row.relatedRemoved === true ||
            isBlankRelatedItem(row, kind)
        )
            return Promise.resolve();
        const title = getRelatedPageTitle(row, kind);
        const current = relatedPageChecks.get(row);
        if (current?.title === title) return current.promise;
        const originalForm = dependencies.form;
        const checks = relatedPageChecks;
        const states = relatedPageStates;
        const request = ++relatedPageCheckRequest;
        const pending = { title, request, promise: Promise.resolve() };
        checks.set(row, pending);
        states.set(row, { title, exists: null });
        const isCurrent = () =>
            !disposed &&
            dependencies.componentMounted &&
            dependencies.form === originalForm &&
            checks === relatedPageChecks &&
            states === relatedPageStates &&
            checks.get(row) === pending &&
            row.relatedRemoved !== true &&
            getRelatedRows(kind).includes(row) &&
            getRelatedPageTitle(row, kind) === title;
        pending.promise = (async () => {
            try {
                const result =
                    await dependencies.options.onCheckPageTitle(title);
                if (!isCurrent()) return;
                const exists =
                    result?.exists === true
                        ? true
                        : result?.exists === false
                          ? false
                          : null;
                states.set(row, { title, exists });
                if (kind === 'stubTag' && exists != null) {
                    row.checkedStubTag = row.stubTag;
                    if (
                        row.pendingEdit == null &&
                        row.pendingCreation == null &&
                        !/^Pending/iu.test(String(row.status))
                    )
                        row.status = exists ? 'OK' : 'Not exists';
                }
            } catch (error) {
                if (isCurrent()) {
                    states.set(row, { title, exists: null });
                    throw error;
                }
            } finally {
                if (checks.get(row) === pending) checks.delete(row);
            }
        })();
        return pending.promise;
    }

    /** Refreshes suggestions once for each completed metadata change. */
    async function refreshRelatedItems(force = false): Promise<void> {
        if (disposed) return;
        const currentLifecycle = lifecycle;
        syncMetadataItemRows(dependencies.form);
        const queryKey = JSON.stringify(
            RELATED_FIELDS.map((field) => dependencies.form[field]),
        );

        if (!force && queryKey === relatedItemsQueryKey) {
            return;
        }

        relatedItemsQueryKey = queryKey;

        await dependencies.runReviewRefresh(async () => {
            await Promise.all([
                dependencies.options.onCategoryRowsRefresh == null
                    ? Promise.resolve()
                    : dependencies.refreshCategoryRows({ recheck: true }),
                dependencies.options.onPrepareReview == null
                    ? Promise.resolve()
                    : dependencies.refreshNavboxRows(true, true, {
                          preserveManual: true,
                      }),
            ]);
            if (disposed || lifecycle !== currentLifecycle) return;
            retireUnassociatedStubSuggestions();
            await checkRelatedPageRows();
        });

        if (disposed || lifecycle !== currentLifecycle) return;
        if (
            dependencies.reviewState.error ||
            dependencies.categoryState.error
        ) {
            relatedItemsQueryKey = '';
        }
    }

    /** Retires obsolete automatic tags while retaining edited, staged, and shared choices. */
    function retireUnassociatedStubSuggestions(): void {
        const items = RELATED_FIELDS.flatMap(
            (field) => metadataItems.value[field] || [],
        );
        const categories = getRelatedRows('category').filter(
            (row) => row.relatedRemoved !== true,
        );
        const rows = getRelatedRows('stubTag');
        for (let index = rows.length - 1; index >= 0; index -= 1) {
            const row = rows[index];
            if (
                row.relatedGenerated !== true ||
                row.relatedItemId ||
                row.relatedModified === true ||
                row.relatedRemoved === true ||
                row.relatedDisabledByItem != null ||
                row.pendingEdit != null ||
                row.pendingCreation != null ||
                getRelatedIdentity(row.stubTag, 'stubTag') !==
                    getRelatedIdentity(row.originalStubTag, 'stubTag') ||
                getRelatedItemOwner(row, 'stubTag', items, categories) ||
                categories.some(
                    (category) =>
                        getRelatedIdentity(category.stubTag, 'stubTag') ===
                        getRelatedIdentity(row.stubTag, 'stubTag'),
                )
            ) {
                continue;
            }
            rows.splice(index, 1);
            relatedItemsEditing.delete(row);
            relatedItemInputs.delete(row);
            relatedItemEditSnapshots.delete(row);
            relatedPageStates.delete(row);
            relatedPageChecks.delete(row);
            const click = relatedClickTimers.get(row);
            if (click?.timer) clearTimeout(click.timer);
            relatedClickTimers.delete(row);
        }
    }

    /** Checks generated and manual stub templates after their category suggestions settle. */
    async function checkStubTagRows(_force = false): Promise<void> {
        const rows = getRelatedRows('stubTag').filter(
            (row) => row.relatedRemoved !== true && !isBlankStubTagRow(row),
        );
        await Promise.all(rows.map((row) => checkStubTagRow(row)));
    }

    /** Resolves one stub template with deduplication and current-row identity guards. */
    function checkStubTagRow(row: any): Promise<void> {
        return checkRelatedPageRow(row, 'stubTag');
    }
    const methods = {
        /** Checks whether an article field owns inline related-page choices. */
        hasRelatedItems(field: any): boolean {
            return RELATED_FIELDS.some((key) => key === field?.key);
        },

        /** Gets retained metadata rows, including unchecked items. */
        getMetadataItems(field: any): any[] {
            return metadataItems.value[field.key] || [];
        },

        /** Keeps incomplete typing in the entry box until it is committed. */
        updateMetadataEntry(field: any, value: string): void {
            metadataEntryValues[field.key] = value;
        },

        /** Parses pasted text immediately, using the textbox selection as the insertion point. */
        pasteMetadataEntry(field: any, event: ClipboardEvent): void {
            const pasted = event.clipboardData?.getData('text/plain');
            if (!pasted) {
                return;
            }
            event.preventDefault();
            const input = event.target as HTMLInputElement;
            const current = metadataEntryValues[field.key] || '';
            const start = input.selectionStart ?? current.length;
            const end = input.selectionEnd ?? start;
            metadataEntryValues[field.key] =
                current.slice(0, start) + pasted + current.slice(end);
            void methods.commitMetadataEntry(field);
        },

        /** Adds entered names as rows, or attaches entered URLs as references. */
        async commitMetadataEntry(field: any): Promise<void> {
            const value = trimValue(metadataEntryValues[field.key]);
            if (!value) {
                return;
            }
            if (field.key === 'publishers' && value === '=') {
                dependencies.form.publishers = '=';
                syncMetadataItemRows(dependencies.form, 'publishers');
                metadataEntryValues[field.key] = '';
                dependencies.updateFieldDependencies(field.key);
                await refreshRelatedItems();
                return;
            }
            const entries = /^https?:\/\/\S+$/iu.test(value)
                ? value
                : normalizeListFieldValue(value);
            const rows = getMetadataFieldRows(dependencies.form, field.key);
            for (const entry of /^https?:\/\/\S+$/iu.test(value)
                ? [value]
                : splitFieldValues(entries)) {
                if (/^https?:\/\/\S+$/iu.test(entry) && field.sourceField) {
                    const sources = methods.getMetadataSources(field);
                    if (!sources.includes(entry)) {
                        dependencies.form[field.sourceField.sourceKey] = [
                            ...sources,
                            entry,
                        ].join('\n');
                    }
                    continue;
                }
                const added = createMetadataItemRow(
                    field.key,
                    entry,
                    dependencies.form.developers,
                );
                if (field.key === 'year' && rows.length > 0) {
                    rows[0].value = added.value;
                    rows[0].enabled = true;
                    rows.splice(1);
                    continue;
                }
                const existing = rows.find(
                    (row: MetadataItemRow) =>
                        getRelatedIdentity(row.value) ===
                        getRelatedIdentity(added.value),
                );
                if (existing) {
                    methods.setMetadataItemEnabled(field, existing, true);
                } else {
                    rows.push(added);
                }
            }
            metadataEntryValues[field.key] = '';
            serializeMetadataItemRows(dependencies.form, field.key);
            dependencies.updateFieldDependencies(field.key);
            await refreshRelatedItems();
        },

        /** Gets the normalized display text without creating links for unlinked terms. */
        getMetadataItemLabel(item: any): string {
            return item.displayText || item.value;
        },

        /** Shows the item name while keeping unfinished edits and explicit link syntax intact. */
        getMetadataItemInputValue(item: any): string {
            return metadataItemDrafts[item.id] ?? item.value;
        },

        /** Edits a retained item without dropping its checkbox or associated choices. */
        updateMetadataItem(field: any, item: any, value: string): void {
            const row = getMetadataFieldRows(dependencies.form, field.key).find(
                (candidate) => candidate.id === item.id,
            );
            if (!row) {
                return;
            }
            metadataItemDrafts[row.id] = value;
        },

        /** Normalizes one committed name and refreshes its related suggestions. */
        async finishMetadataItemEdit(field: any, item: any): Promise<void> {
            const row = getMetadataFieldRows(dependencies.form, field.key).find(
                (candidate) => candidate.id === item.id,
            );
            if (!row) {
                return;
            }
            const entered = metadataItemDrafts[row.id];
            if (entered != null && trimValue(entered) === '') {
                methods.removeMetadataItem(field, item);
                return;
            }
            if (entered != null && entered !== row.value) {
                row.value = createMetadataItemRow(
                    field.key,
                    entered,
                    dependencies.form.developers,
                ).value;
            }
            delete metadataItemDrafts[row.id];
            serializeMetadataItemRows(dependencies.form, field.key);
            dependencies.updateFieldDependencies(field.key);
            await refreshRelatedItems();
        },

        /** Includes or excludes an item while retaining its name and reviewed choices. */
        setMetadataItemEnabled(field: any, item: any, enabled: boolean): void {
            const row = getMetadataFieldRows(dependencies.form, field.key).find(
                (candidate) => candidate.id === item.id,
            );
            if (!row) {
                return;
            }
            const itemDetails = methods
                .getMetadataItems(field)
                .find((candidate) => candidate.id === row.id);
            for (const kind of [
                'category',
                'navbox',
                'stubTag',
            ] as RelatedItemKind[]) {
                const owned = getRelatedRows(kind).filter(
                    (related) =>
                        getRelatedItemOwner(
                            related,
                            kind,
                            [itemDetails],
                            dependencies.form.categoryRows,
                        ) === item.id,
                );
                for (const related of owned) {
                    const others = methods
                        .getMetadataItems(field)
                        .filter(
                            (candidate) =>
                                candidate.id !== item.id && candidate.enabled,
                        );
                    if (
                        !enabled &&
                        getRelatedItemOwner(
                            related,
                            kind,
                            others,
                            dependencies.form.categoryRows,
                        )
                    ) {
                        continue;
                    }
                    if (!enabled && related.relatedDisabledByItem == null) {
                        related.relatedDisabledByItem =
                            related.enabled !== false;
                        related.enabled = false;
                    } else if (
                        enabled &&
                        related.relatedDisabledByItem != null
                    ) {
                        related.enabled =
                            related.relatedDisabledByItem === true;
                        delete related.relatedDisabledByItem;
                    }
                }
            }
            row.enabled = enabled;
            serializeMetadataItemRows(dependencies.form, field.key);
            dependencies.updateFieldDependencies(field.key);
            void refreshRelatedItems();
        },

        /** Removes a metadata row and its selected related output. */
        removeMetadataItem(field: any, item: any): void {
            const rows = getMetadataFieldRows(dependencies.form, field.key);
            const index = rows.findIndex((row) => row.id === item.id);
            if (index < 0) {
                return;
            }
            for (const section of methods.getRelatedItems(field, item)) {
                for (const related of section.rows) {
                    const others = methods
                        .getMetadataItems(field)
                        .filter((candidate) => candidate.id !== item.id);
                    if (
                        getRelatedItemOwner(
                            related,
                            section.kind,
                            others,
                            dependencies.form.categoryRows,
                        )
                    ) {
                        continue;
                    }
                    methods.removeRelatedItem(related, section.kind);
                }
            }
            rows.splice(index, 1);
            delete metadataItemDrafts[item.id];
            serializeMetadataItemRows(dependencies.form, field.key);
            dependencies.updateFieldDependencies(field.key);
            void refreshRelatedItems();
        },

        /** Gets field references independently of the item selection. */
        getMetadataSources(field: any): string[] {
            return field.sourceField
                ? String(dependencies.form[field.sourceField.sourceKey] || '')
                      .split(/\r?\n/u)
                      .map((url) => url.trim())
                      .filter((url) => /^https?:\/\/\S+$/iu.test(url))
                : [];
        },

        /** Removes one field reference while keeping the item list intact. */
        removeMetadataSource(field: any, url: string): void {
            if (field.sourceField) {
                dependencies.form[field.sourceField.sourceKey] = methods
                    .getMetadataSources(field)
                    .filter((value) => value !== url)
                    .join('\n');
            }
        },

        /** Gets the same reactive rows used by rendering and final save review. */
        getRelatedItems(
            field: any,
            item?: any,
        ): Array<{
            kind: RelatedItemKind;
            label: string;
            rows: any[];
        }> {
            if (!methods.hasRelatedItems(field)) {
                return [];
            }

            const kinds: RelatedItemKind[] = ['category', 'navbox', 'stubTag'];
            const labels = {
                category: msg('form.relatedCategories'),
                navbox: msg('form.relatedNavboxes'),
                stubTag: msg('form.relatedStubTags'),
            };

            return kinds.map((kind) => ({
                kind,
                label: labels[kind],
                rows: getRelatedRows(kind).filter(
                    (row) =>
                        row.relatedRemoved !== true &&
                        (!isBlankRelatedItem(row, kind) ||
                            relatedItemsEditing.has(row)) &&
                        getRelatedItemField(
                            row,
                            kind,
                            relatedFieldMetadata.value,
                            dependencies.form.categoryRows,
                        ) === field.key &&
                        getRelatedItemOwner(
                            row,
                            kind,
                            methods.getMetadataItems(field),
                            dependencies.form.categoryRows,
                        ) === (item?.id || ''),
                ),
            }));
        },

        /** Keys one generic category-or-template add input beside its owner. */
        getRelatedEntryKey(field: any, item?: any): string {
            return item?.id || field.key;
        },

        isRelatedEntryEditing(field: any, item?: any): boolean {
            return relatedEntriesEditing.has(
                methods.getRelatedEntryKey(field, item),
            );
        },

        setRelatedEntryInput(field: any, item: any, control: any): void {
            const key = methods.getRelatedEntryKey(field, item);
            if (control == null) relatedEntryInputs.delete(key);
            else relatedEntryInputs.set(key, control);
        },

        openRelatedEntry(field: any, item?: any): void {
            const key = methods.getRelatedEntryKey(field, item);
            relatedEntryValues[key] = '';
            relatedEntriesEditing.add(key);
            void dependencies.Vue.nextTick(() =>
                dependencies.focusDialogControl({
                    value: relatedEntryInputs.get(key),
                }),
            );
        },

        updateRelatedEntry(field: any, value: string, item?: any): void {
            relatedEntryValues[methods.getRelatedEntryKey(field, item)] = value;
        },

        pasteRelatedEntry(field: any, event: ClipboardEvent, item?: any): void {
            const pasted = event.clipboardData?.getData('text/plain');
            if (!pasted) return;
            event.preventDefault();
            const key = methods.getRelatedEntryKey(field, item);
            const current = relatedEntryValues[key] || '';
            const input = event.target as HTMLInputElement;
            const start = input.selectionStart ?? current.length;
            const end = input.selectionEnd ?? start;
            relatedEntryValues[key] =
                current.slice(0, start) + pasted + current.slice(end);
            void methods.commitRelatedEntry(field, item);
        },

        /** Plain names add categories; template calls retain their template kind and parameters. */
        async commitRelatedEntry(field: any, item?: any): Promise<void> {
            const key = methods.getRelatedEntryKey(field, item);
            const parsed = parseRelatedEntry(relatedEntryValues[key]);
            relatedEntryValues[key] = '';
            relatedEntriesEditing.delete(key);
            if (!parsed) return;
            const row =
                parsed.kind === 'category'
                    ? dependencies.options.onUpdateCategoryRowCategory(
                          dependencies.options.onCreateCategoryRow(),
                          parsed.value,
                      )
                    : parsed.kind === 'navbox'
                      ? createNavboxRow(parsed.value)
                      : createStubTagRow(parsed.value);
            row.relatedField = field.key;
            if (item) {
                row.relatedItemId = item.id;
                if (!item.enabled) {
                    row.relatedDisabledByItem = row.enabled !== false;
                    row.enabled = false;
                }
            }
            if (parsed.kind === 'navbox') ensureNavboxRows(dependencies.form);
            else if (parsed.kind === 'stubTag')
                ensureStubTagRows(dependencies.form);
            getRelatedRows(parsed.kind).push(row);
            const added = getRelatedRows(parsed.kind).at(-1);
            await methods.checkRelatedItem(added, parsed.kind);
        },

        /** Gets an editable category title or template call. */
        getRelatedItemValue(row: any, kind: RelatedItemKind): string {
            if (kind === 'category') {
                return trimValue(row.category);
            }

            return kind === 'navbox'
                ? trimValue(row.text)
                : trimStubTagValue(row.stubTag);
        },

        /** Gets a plain page name without namespace prefixes or template notation. */
        getRelatedItemLabel(row: any, kind: RelatedItemKind): string {
            const value = methods.getRelatedItemValue(row, kind);

            return kind === 'category'
                ? stripNamespacePrefix(
                      value.replace(/^:\s*/u, ''),
                      'zhwiki',
                      14,
                  )
                : kind === 'navbox'
                  ? getNavboxTitle(row.text || row.title)
                  : stripNamespacePrefix(trimStubTagValue(value), 'zhwiki', 10);
        },

        /** Distinguishes categories from templates without namespace labels or icons. */
        getRelatedItemDisplayLabel(row: any, kind: RelatedItemKind): string {
            const label = methods.getRelatedItemLabel(row, kind);
            return kind === 'category' ? label : `{{${label}}}`;
        },

        /** Uses only this dialog's confirmed API response for the current title. */
        getRelatedItemPageExistence(
            row: any,
            kind: RelatedItemKind,
        ): 'exists' | 'missing' | 'unchecked' {
            const state = relatedPageStates.get(row);
            if (
                !state ||
                state.title !== getRelatedPageTitle(row, kind) ||
                state.exists == null
            )
                return 'unchecked';
            return state.exists ? 'exists' : 'missing';
        },

        /** Gets a localized description of the current page existence. */
        getRelatedItemStatusLabel(row: any, kind: RelatedItemKind): string {
            const existence = methods.getRelatedItemPageExistence(row, kind);
            const labels = {
                exists: 'form.relatedStatus.exists',
                missing: 'form.relatedStatus.missing',
                unchecked: 'form.relatedStatus.unchecked',
            } as const;
            return msg(labels[existence]);
        },

        /** Gets the wiki destination for a reviewed related page. */
        getRelatedItemUrl(row: any, kind: RelatedItemKind): string {
            return kind === 'category'
                ? dependencies.getCategoryPageUrl(row)
                : kind === 'navbox'
                  ? dependencies.getNavboxPageUrl(row)
                  : dependencies.getStubTagPageUrl(row);
        },

        /** Gets the existing staged page action's accessible label. */
        getRelatedItemActionLabel(row: any, kind: RelatedItemKind): string {
            return dependencies.getReviewPageActionAriaLabel(
                row,
                methods.getRelatedItemPageExistence(row, kind) !== 'missing',
            );
        },

        /** Checks whether one row's name editor is expanded. */
        isRelatedItemEditing(row: any): boolean {
            return relatedItemsEditing.has(row);
        },

        /** Tracks only currently mounted inline inputs for keyboard focus. */
        setRelatedItemInput(row: any, control: any): void {
            if (control == null) {
                relatedItemInputs.delete(row);
                return;
            }

            relatedItemInputs.set(row, control);
        },

        /** Opens a row's inline name editor without replacing its review state. */
        editRelatedItemValue(
            row: any,
            field: any,
            kind: RelatedItemKind,
        ): void {
            if (!relatedItemsEditing.has(row))
                relatedItemEditSnapshots.set(row, cloneValue(row));
            row.relatedField = field.key;
            const owner = getRelatedItemOwner(
                row,
                kind,
                methods.getMetadataItems(field),
                dependencies.form.categoryRows,
            );
            if (owner) {
                row.relatedItemId = owner;
            }
            relatedItemsEditing.add(row);
            focusRelatedItemInput(row, kind);
        },

        /** Restores held modifier state when the pointer enters or moves over a field link. */
        updateLinkNavigationModifier(event: PointerEvent): void {
            dependencies.linkNavigationModifier.value =
                event.ctrlKey || event.metaKey;
        },

        /** Clears the hover cue when the pointer leaves a field link. */
        resetLinkNavigationModifier(): void {
            dependencies.linkNavigationModifier.value = false;
        },

        /** Reserves modified clicks for navigation and separates toggles from double-click editing. */
        activateRelatedItem(
            event: MouseEvent,
            row: any,
            _field: any,
            kind: RelatedItemKind,
        ): void {
            if (
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey ||
                event.button !== 0
            )
                return;
            event.preventDefault();
            if (event.detail > 1) return;
            const previous = relatedClickTimers.get(row);
            if (previous?.timer) clearTimeout(previous.timer);
            const toggle = {
                initialEnabled: row.enabled !== false,
                applied: false,
                timer: undefined as ReturnType<typeof setTimeout> | undefined,
            };
            relatedClickTimers.set(row, toggle);
            toggle.timer = setTimeout(() => {
                if (
                    !dependencies.componentMounted ||
                    row.relatedRemoved === true ||
                    !getRelatedRows(kind).includes(row) ||
                    relatedClickTimers.get(row) !== toggle
                )
                    return;
                methods.toggleRelatedItem(row);
                toggle.applied = true;
                toggle.timer = undefined;
            }, 300);
        },

        toggleRelatedItem(row: any): void {
            row.enabled = row.enabled === false;
        },

        editRelatedItemOnDoubleClick(
            event: MouseEvent,
            row: any,
            field: any,
            kind: RelatedItemKind,
        ): void {
            if (
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey
            )
                return;
            event.preventDefault();
            const toggle = relatedClickTimers.get(row);
            if (toggle?.timer) clearTimeout(toggle.timer);
            if (toggle?.applied) row.enabled = toggle.initialEnabled;
            relatedClickTimers.delete(row);
            methods.editRelatedItemValue(row, field, kind);
        },

        activateRelatedItemKeyboard(
            event: KeyboardEvent,
            row: any,
            field: any,
            kind: RelatedItemKind,
        ): void {
            if (
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey
            )
                return;
            event.preventDefault();
            methods.editRelatedItemValue(row, field, kind);
        },

        cancelRelatedItemEdit(row: any, kind: RelatedItemKind): void {
            const snapshot = relatedItemEditSnapshots.get(row);
            if (snapshot) {
                Object.keys(row).forEach((key) => delete row[key]);
                Object.assign(row, snapshot);
            }
            relatedItemEditSnapshots.delete(row);
            relatedItemsEditing.delete(row);
            void checkRelatedPageRow(row, kind).catch((error) => {
                dependencies.reviewState.error = getErrorMessage(error);
            });
        },

        /** Updates an existing related row through its established edit rules. */
        updateRelatedItem(
            row: any,
            kind: RelatedItemKind,
            value: string,
        ): void {
            const rows = getRelatedRows(kind);
            const index = rows.indexOf(row);

            if (index < 0) {
                return;
            }

            const originalIdentity = getRelatedIdentity(
                methods.getRelatedItemValue(row, kind),
                kind,
            );

            if (kind === 'category') {
                const current = { ...row };
                const updated =
                    dependencies.options.onUpdateCategoryRowCategory(
                        row,
                        trimValue(value),
                    );
                Object.assign(row, updated);
                syncCategoryRowFixedState(row, current);
            } else if (kind === 'navbox') {
                row.relatedModified = true;
                const text = trimValue(value);
                dependencies.updateNavboxRow(
                    index,
                    text === '' || text.startsWith('{{') ? text : `{{${text}}}`,
                );
            } else {
                dependencies.updateStubTagRow(index, value);
            }

            if (
                originalIdentity !==
                getRelatedIdentity(methods.getRelatedItemValue(row, kind), kind)
            ) {
                relatedPageStates.delete(row);
                relatedPageChecks.delete(row);
                row.relatedModified = true;
                delete row.pendingEdit;
                delete row.pendingCreation;
                row.status = '';
            }
        },

        /** Checks a committed related title using the guarded review refreshes. */
        async checkRelatedItem(
            row: any,
            kind: RelatedItemKind,
            event?: Event,
        ): Promise<void> {
            const value = (event?.target as HTMLInputElement | undefined)
                ?.value;

            if (
                value != null &&
                methods.getRelatedItemValue(row, kind) !== value
            ) {
                methods.updateRelatedItem(row, kind, value);
            }

            if (isBlankRelatedItem(row, kind)) {
                return;
            }

            if (kind === 'category') {
                await dependencies.refreshCategoryRows({ bypassCache: true });
            } else if (kind === 'navbox') {
                await dependencies.runReviewRefresh(() =>
                    dependencies.refreshNavboxRows(true, false),
                );
            }
            await dependencies.runReviewRefresh(() =>
                checkRelatedPageRow(row, kind),
            );
        },

        /** Commits an inline name edit while preserving access to its page action. */
        async finishRelatedItemEdit(
            row: any,
            kind: RelatedItemKind,
            event?: FocusEvent,
        ): Promise<void> {
            const rowElement =
                (event?.target as Element | undefined)?.closest?.(
                    '[data-kanade-vg-stub-creator-related-row]',
                ) ||
                relatedItemInputs
                    .get(row)
                    ?.$el?.closest?.(
                        '[data-kanade-vg-stub-creator-related-row]',
                    );
            const retainsFocus =
                typeof Node !== 'undefined' &&
                event?.relatedTarget instanceof Node &&
                rowElement?.contains(event.relatedTarget);
            if (!relatedItemsEditing.has(row) || row.relatedRemoved === true)
                return;
            if (isBlankRelatedItem(row, kind)) {
                methods.removeRelatedItem(row, kind);
                return;
            }
            await methods.checkRelatedItem(row, kind, event);

            if (!retainsFocus && !isBlankRelatedItem(row, kind)) {
                relatedItemsEditing.delete(row);
                relatedItemEditSnapshots.delete(row);
                if (
                    event == null &&
                    typeof dependencies.Vue.nextTick === 'function'
                ) {
                    void dependencies.Vue.nextTick(() =>
                        rowElement
                            ?.querySelector?.(
                                '.kanade-vg-stub-creator-related-link',
                            )
                            ?.focus(),
                    );
                }
            }
        },

        /** Removes one manual or suggested related row from the reviewed output. */
        removeRelatedItem(row: any, kind: RelatedItemKind): void {
            const rows = getRelatedRows(kind);
            const index = rows.indexOf(row);

            if (index >= 0) {
                row.relatedRemoved = true;
                row.enabled = false;
            }

            relatedItemsEditing.delete(row);
            relatedItemEditSnapshots.delete(row);
            relatedPageStates.delete(row);
            relatedPageChecks.delete(row);
            const toggle = relatedClickTimers.get(row);
            if (toggle?.timer) clearTimeout(toggle.timer);
            relatedClickTimers.delete(row);
        },

        /** Opens the existing source editor and stages edits for final confirmation. */
        async openRelatedItemEdit(
            row: any,
            kind: RelatedItemKind,
        ): Promise<void> {
            if (isBlankRelatedItem(row, kind)) {
                return;
            }

            if (kind === 'category') {
                await dependencies.openCategoryEdit(row);
            } else if (kind === 'navbox') {
                await dependencies.openNavboxEdit(row);
            } else {
                await dependencies.openStubTagEdit(row);
            }
        },

        /** Refreshes suggestions after a completed metadata input change. */
        async refreshRelatedItems(refresh?: boolean | Event): Promise<void> {
            await refreshRelatedItems(
                refresh === true || refresh instanceof Event,
            );
        },

        /**
         * Handles get metadata field label.
         *
         * Gets the metadata table field label, including list item
         * counts.
         *
         * @param field - Article parameter field.
         * @param field.key - Form field key.
         * @param field.label - Field display label.
         * @returns Field label for metadata table display.
         */
        getMetadataFieldLabel(field: any): string {
            const label = field?.label || '';

            if (methods.hasRelatedItems(field)) {
                return `${label} (${methods.getMetadataItems(field).length})`;
            }

            if (!isArticleListField(field?.key)) {
                return label;
            }

            const count = splitFieldValues(dependencies.form[field.key]).length;

            return `${label} (${count})`;
        },
    };
    function reset(): void {
        lifecycle += 1;
        relatedItemsQueryKey = '';
        relatedItemsEditing.clear();
        relatedItemInputs.clear();
        clearRelatedInteractionState();
        for (const field of RELATED_FIELDS) metadataEntryValues[field] = '';
        for (const key of Object.keys(metadataItemDrafts))
            delete metadataItemDrafts[key];
    }
    return {
        methods,
        state: { metadataEntryValues, relatedEntryValues },
        reset,
        dispose() {
            disposed = true;
            reset();
        },
        checkRelatedPageRows,
        refreshRelatedItems,
        checkStubTagRows,
        checkStubTagRow,
    };
}
