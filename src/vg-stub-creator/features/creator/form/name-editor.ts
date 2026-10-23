/**
 * @file src/vg-stub-creator/features/creator/form/name-editor.ts
 * Purpose: Owns name editing state and actions for one creator dialog.
 *
 * Table of contents:
 * 1. Imports
 * 2. NamePageState
 * 3. NameCard
 * 4. NameUsageChip
 * 5. Dependencies
 * 6. createNameEditor
 */

import {
    trimValue,
    splitFieldValues,
    hasFirstLevelFieldSeparator,
} from '../../../domain/wikitext/index.ts';

import type { NameRole, NameSource } from '../../../domain/name-roles.ts';
import {
    getNameNoteTaRuleDraft,
    getNameNoteTaVariants,
    getNameRedirectTitles,
    getNameRole,
    getNameSources,
    setNameNoteTaRule,
    setNameNoteTaVariant,
    setNameRole,
    syncNameRoles,
} from '../../../domain/name-roles.ts';
import { msg } from '../../../i18n/index.ts';
import { getErrorMessage } from '../error-message.ts';
import { STEAM_NAME_HELPER_ROW } from './constants.ts';
import type { CreatorDialogOptions } from './dialog-options.ts';
import {
    buildGoogleSiteSearchUrl,
    getBasePageTitle,
    normalizeEnwikiTitleValue,
} from './external-links.ts';
import {
    buildSteamNameChoiceRows,
    createNameRowFromValues,
    createRedirectRow,
    ensureNoteTaRows,
    ensureRedirectRows,
    ensureTrailingNameRow,
    ensureTrailingRedirectRow,
    getOriginalNameLanguage,
    hasAnyNameRowValue,
    isRedirectRowFixed,
    markCategoryRowsUnfixed,
    markSteamNameHelperRow,
    setRedirectRowTitle,
    syncGeneratedNameNoteTaRow,
} from './form-model.ts';
import {
    getNameConversionChips as getEmittedNameConversionChips,
    getNameConversionUsage,
} from './name-conversion-usage.ts';
import { getRelatedIdentity } from './related-items.ts';
interface NamePageState {
    title: string;
    matchedTitle?: string;
    exists: boolean | null;
    loading: boolean;
    matches?: Array<{ title: string; exists: boolean | null }>;
}
type NameCard = NameSource & { index: number };
interface NameUsageChip {
    key: string;
    label: string;
    modified: boolean;
    value: string;
    accessibleLabel: string;
}
interface Dependencies {
    Vue: any;
    form: any;
    options: Pick<
        CreatorDialogOptions,
        'onCheckPageTitle' | 'onSteamNamesFetch' | 'getPageUrl'
    >;
    updateFieldDependencies: (key: string) => void;
    componentMounted: boolean;
    currentTitle: any;
    sourceFetchState: any;
    runReviewRefresh: (refresh: () => Promise<void>) => Promise<void>;
    refreshRedirectRows: (refreshOptions?: {
        rebuild?: boolean;
        recheck?: boolean;
    }) => Promise<void>;
    activeTab: any;
    checkRedirectRows: (refreshOptions?: {
        recheck?: boolean;
    }) => Promise<void>;
    removeRedirectRow: (...args: any[]) => any;
}
export function createNameEditor(dependencies: Dependencies) {
    let disposed = false;
    let steamRequest = 0;
    const fetchedSteamNameRows: any = dependencies.Vue.ref([]);
    const steamUrl: any = dependencies.Vue.ref('');
    const expandedNameUseCards: Set<string> = dependencies.Vue.reactive(
        new Set<string>(),
    );
    let nameReviewRowKeys: WeakMap<object, string> = new WeakMap();
    let nameReviewRowSequence: number = 0;
    const namePageStates: Map<string, NamePageState> =
        dependencies.Vue.reactive(new Map());
    const namePageChecks: Map<
        string,
        { title: string; promise: Promise<void> }
    > = new Map();

    /**
     * Gets name lookup links from the English Wikipedia article title.
     *
     * @returns Search row definitions.
     */
    function getNameSearchRows(): Array<any> {
        const query = getBasePageTitle(
            normalizeEnwikiTitleValue(dependencies.form.enwikiTitle),
        );
        return query === ''
            ? []
            : [{ key: 'enwiki', query, links: buildNameSearchLinks(query) }];
    }

    /** Maps selected uses to the existing article output fields. */
    function getNameOutputKey(role: NameRole): string | null {
        if (role === 'displayTitle') return 'name';
        if (role === 'pageName' || role === 'sortKey') return role;
        return null;
    }

    /** Gives selected regional defaults independent ownership before they are combined. */
    function activateNameNoteTaVariants(sourceId: string): void {
        const role = getNameRole(dependencies.form, sourceId, 'noteTa');
        if (role.noteTaVariants != null || role.noteTaRule != null) return;
        const variants = getNameNoteTaVariants(dependencies.form, sourceId);
        setNameNoteTaVariant(
            dependencies.form,
            sourceId,
            'zh-cn',
            variants['zh-cn'].value,
        );
        setNameNoteTaVariant(
            dependencies.form,
            sourceId,
            'zh-tw',
            variants['zh-tw'].value,
        );
    }

    /** Moves retained article outputs into editable card settings when a form is loaded. */
    function adoptNameOutputRoles(): void {
        syncNameRoles(dependencies.form);
        const sources = getNameSources(dependencies.form);
        for (const role of [
            'pageName',
            'displayTitle',
            'sortKey',
        ] as NameRole[]) {
            const key = getNameOutputKey(role)!;
            const value = trimValue(dependencies.form[key]);
            if (value === '') continue;
            const selected = dependencies.form.nameRoleRows.find(
                (row: any) => row.role === role && row.enabled,
            );
            if (selected && trimValue(selected.value) === value) continue;
            const source =
                sources.find((item) => item.id === selected?.sourceId) ||
                sources.find(
                    (item) =>
                        getRelatedIdentity(item.name) ===
                        getRelatedIdentity(value),
                ) ||
                sources.find(
                    (item) =>
                        getRelatedIdentity(item.name) ===
                        getRelatedIdentity(getBasePageTitle(value)),
                ) ||
                sources.find((item) => trimValue(item.name) !== '') ||
                sources[0];
            if (source)
                setNameRole(dependencies.form, source.id, role, {
                    enabled: true,
                    value,
                    modified: true,
                });
        }
    }

    /** Keeps older or independent review drafts reachable from a current name frame. */
    function getNameSettingsFallbackOwner(): string {
        const sources = getNameSources(dependencies.form);
        const selected = dependencies.form.nameRoleRows?.find(
            (row: any) => row.role === 'pageName' && row.enabled,
        );
        return (
            sources.find((source) => source.id === selected?.sourceId)?.id ||
            sources.find((source) => trimValue(source.name) !== '')?.id ||
            sources[0]?.id ||
            ''
        );
    }

    /** Retains reviewed aliases and manual rules when their source card is removed. */
    function detachNameCardDrafts(sourceId: string): void {
        expandedNameUseCards.delete(sourceId);
        for (const row of [
            ...(dependencies.form.redirectRows || []),
            ...ensureNoteTaRows(dependencies.form),
        ]) {
            if (row.nameSourceId === sourceId) delete row.nameSourceId;
        }
    }

    /** Splits aliases using the same top-level separator rules as generated redirects. */
    function getNameRoleRedirectTitles(value: string): string[] {
        return (
            hasFirstLevelFieldSeparator(value)
                ? splitFieldValues(value)
                : [value]
        )
            .map((title: string) => trimValue(title).replace(/_/g, ' '))
            .filter((title: string) => title !== '');
    }

    /** Replaces only the selection in a compact title input with clipboard text. */
    function getPastedNameInput(event: ClipboardEvent): string | undefined {
        const text = event.clipboardData?.getData('text');
        const input = event.target as HTMLInputElement | null;
        if (text == null || input == null || typeof input.value !== 'string')
            return undefined;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        return input.value.slice(0, start) + text + input.value.slice(end);
    }

    /** Associates retained redirect rows without replacing their staged text or selection. */
    function getNameRedirectOwner(row: any): string {
        const sources = getNameSources(dependencies.form);
        if (sources.some((source) => source.id === row.nameSourceId))
            return row.nameSourceId;
        const identities = new Set(
            [row.title, row.generatedTitle]
                .map((title) => getRelatedIdentity(title))
                .filter(Boolean),
        );
        const source = sources.find((item) =>
            [
                item.name,
                ...getNameRoleRedirectTitles(
                    getNameRole(dependencies.form, item.id, 'redirect').value,
                ),
            ].some((title) => identities.has(getRelatedIdentity(title))),
        );
        return source?.id || getNameSettingsFallbackOwner();
    }

    /** Invalidates earlier evidence even when an edit later returns to the same text. */
    function invalidateNamePageEvidence(
        sourceId: string,
        role?: NameRole,
    ): void {
        for (const key of role
            ? [sourceId + ':' + role]
            : [sourceId + ':pageName', sourceId + ':redirect']) {
            namePageStates.delete(key);
            namePageChecks.delete(key);
        }
    }

    /** Synchronizes only explicitly selected outputs while preserving manual values. */
    function syncNameRoleOutputs(): void {
        syncNameRoles(dependencies.form);
        for (const row of dependencies.form.nameRoleRows || []) {
            const key = getNameOutputKey(row.role);
            if (!key || !row.enabled) continue;
            const value = trimValue(row.value);
            if (dependencies.form[key] !== value) {
                dependencies.form[key] = value;
                dependencies.updateFieldDependencies(key);
            }
        }
    }

    /** Gives a manually changed selected value independent ownership. */
    function releaseNameOutputRole(key: string): void {
        for (const row of dependencies.form.nameRoleRows || []) {
            if (
                row.enabled &&
                getNameOutputKey(row.role) === key &&
                trimValue(row.value) !== trimValue(dependencies.form[key])
            ) {
                row.enabled = false;
            }
        }
    }

    /** Freshly checks candidate page and redirect titles when the Names tab is entered. */
    async function refreshNamePageChecks(): Promise<void> {
        if (disposed) return;
        syncNameRoles(dependencies.form);
        await Promise.all(
            getNameSources(dependencies.form).flatMap((source) =>
                (['pageName', 'redirect'] as NameRole[]).map((role) =>
                    checkNamePage(source.id, role),
                ),
            ),
        );
    }

    /** Avoids replacing a confirmed status when an unchanged input loses focus. */
    function checkNamePageIfNeeded(
        sourceId: string,
        role: NameRole,
    ): Promise<void> {
        const title = trimValue(
            getNameRole(dependencies.form, sourceId, role).value,
        );
        const state = namePageStates.get(sourceId + ':' + role);
        return state?.title === title && !state.loading && state.exists != null
            ? Promise.resolve()
            : checkNamePage(sourceId, role);
    }

    /** Keeps every response tied to its source, use, title, form, and pending request. */
    function checkNamePage(
        sourceId: string,
        role: NameRole,
        fresh = false,
    ): Promise<void> {
        const title = trimValue(
            getNameRole(dependencies.form, sourceId, role).value,
        );
        const key = sourceId + ':' + role;
        if (
            disposed ||
            title === '' ||
            dependencies.options.onCheckPageTitle == null
        )
            return Promise.resolve();
        const current = namePageChecks.get(key);
        if (!fresh && current?.title === title) return current.promise;
        const originalForm = dependencies.form;
        const checks = namePageChecks;
        const states = namePageStates;
        const pending = { title, promise: Promise.resolve() };
        checks.set(key, pending);
        states.set(key, { title, exists: null, loading: true });
        const isCurrent = () =>
            !disposed &&
            dependencies.componentMounted &&
            dependencies.form === originalForm &&
            checks === namePageChecks &&
            checks.get(key) === pending &&
            getNameSources(dependencies.form).some(
                (source) => source.id === sourceId,
            ) &&
            trimValue(getNameRole(dependencies.form, sourceId, role).value) ===
                title;
        pending.promise = (async () => {
            try {
                const candidates =
                    role === 'redirect' && hasFirstLevelFieldSeparator(title)
                        ? splitFieldValues(title)
                        : [title];
                const results = await Promise.all(
                    candidates.map(async (candidate: string) => {
                        try {
                            const result =
                                await dependencies.options.onCheckPageTitle(
                                    candidate,
                                );
                            return {
                                title: trimValue(result?.title) || candidate,
                                exists:
                                    result?.exists === true
                                        ? true
                                        : result?.exists === false
                                          ? false
                                          : null,
                            };
                        } catch (_error) {
                            return { title: candidate, exists: null };
                        }
                    }),
                );
                if (!isCurrent()) return;
                const exists = results.some((result) => result.exists === true)
                    ? true
                    : results.every((result) => result.exists === false)
                      ? false
                      : null;
                states.set(key, {
                    title,
                    matchedTitle:
                        (
                            results.find((result) => result.exists === true) ||
                            results[0]
                        )?.title || title,
                    exists,
                    loading: false,
                    matches: results,
                });
            } catch (_error) {
                if (isCurrent())
                    states.set(key, { title, exists: null, loading: false });
            } finally {
                if (checks.get(key) === pending) checks.delete(key);
            }
        })();
        return pending.promise;
    }

    /**
     * Builds title lookup links for one search query.
     *
     * @param query - Search query title.
     * @returns Search link definitions.
     */
    function buildNameSearchLinks(query: string): Array<any> {
        const basePageTitleResult = `"${getBasePageTitle(query)}"`;
        const result = [
            {
                label: msg('names.cnDomain'),
                url: buildGoogleSiteSearchUrl(query, '*.cn'),
            },
            {
                label: msg('names.bahamut'),
                url: buildGoogleSiteSearchUrl(query, 'gnn.gamer.com.tw'),
            },
            {
                label: 'zhwp',
                url:
                    'https://cse.google.com.hk/cse?cx=25f8f2342cbfa4e46&q=' +
                    encodeURIComponent(basePageTitleResult),
            },
        ];
        return result;
    }

    /**
     * Handles sync page name fields.
     *
     * Ensures page-name fields have current values after form
     * replacement.
     *
     * @returns *
     */
    function syncPageNameFields(): void {
        if (trimValue(dependencies.form.pageName) === '') {
            dependencies.form.pageName = dependencies.currentTitle;
        }
    }

    /**
     * Fetches localized Steam names for the current helper URL.
     *
     * @returns Resolves after helper rows are updated.
     */
    async function fetchSteamNames(): Promise<void> {
        if (disposed || dependencies.options.onSteamNamesFetch == null) {
            return;
        }

        const request = ++steamRequest;
        const url = steamUrl.value;
        const isCurrent = () =>
            !disposed &&
            dependencies.componentMounted &&
            request === steamRequest &&
            url === steamUrl.value;
        dependencies.sourceFetchState.error = '';
        dependencies.sourceFetchState.loading = true;

        try {
            const originalNameLanguageResult = {
                includeJapanese:
                    getOriginalNameLanguage(dependencies.form) === 'ja',
            };
            const rows = await dependencies.options.onSteamNamesFetch(
                url,
                originalNameLanguageResult,
            );
            if (isCurrent()) fetchedSteamNameRows.value = rows;
        } catch (error) {
            if (isCurrent())
                dependencies.sourceFetchState.error = getErrorMessage(error);
        } finally {
            if (!disposed && request === steamRequest)
                dependencies.sourceFetchState.loading = false;
        }
    }

    /**
     * Removes rows previously inserted by the Steam helper.
     *
     * @returns Result when the function
     *   removes rows previously inserted by the steam
     *   helper.
     */
    function removeSteamAppliedNameRows(): void {
        const filterCallback = function callback(
            row: Record<PropertyKey, unknown>,
        ) {
            if (row[STEAM_NAME_HELPER_ROW] === true)
                detachNameCardDrafts(trimValue(row.nameId));
            return (
                row[STEAM_NAME_HELPER_ROW] !== true && hasAnyNameRowValue(row)
            );
        };
        dependencies.form.localizedNames =
            dependencies.form.localizedNames.filter(filterCallback);
    }
    const methods = {
        /**
         * Trims a localized name row value.
         *
         * @param key - Localized name group key.
         * @param index - Row index.
         * @param field - Row field key.
         * @returns Result when the function
         *   trims a localized name row value.
         */
        updateNameRow(key: string, index: number, field: string): void {
            dependencies.form[key][index][field] = trimValue(
                dependencies.form[key][index][field],
            );
            ensureTrailingNameRow(dependencies.form[key]);
            syncNameRoleOutputs();
            syncGeneratedNameNoteTaRow(dependencies.form);
            if (field === 'name') {
                void dependencies.runReviewRefresh(() =>
                    dependencies.refreshRedirectRows(),
                );
                if (dependencies.activeTab.value === 'titles')
                    void refreshNamePageChecks();
            }
        },

        /**
         * Updates a localized name row value from live input.
         *
         * @param key - Localized name group key.
         * @param index - Row index.
         * @param field - Row field key.
         * @param value - Raw input value.
         * @returns Result when the function
         *   updates a localized name row value from live
         *   input.
         */
        updateNameRowValue(
            key: string,
            index: number,
            field: string,
            value: string,
        ): void {
            if (
                field === 'name' &&
                dependencies.form[key][index][field] !== trimValue(value)
            )
                invalidateNamePageEvidence(
                    dependencies.form[key][index].nameId,
                );
            dependencies.form[key][index][field] = value;
            ensureTrailingNameRow(dependencies.form[key]);
            syncNameRoleOutputs();
            syncGeneratedNameNoteTaRow(dependencies.form);
        },

        /** Lists source cards without replacing the editor's original spelling. */
        getNameCards(): NameCard[] {
            return getNameSources(dependencies.form).map((source) => ({
                ...source,
                index: source.index ?? -1,
                name:
                    source.kind === 'localized'
                        ? dependencies.form.localizedNames[source.index!].name
                        : source.kind === 'original'
                          ? dependencies.form.originalName
                          : dependencies.form.englishName,
            }));
        },

        /** Summarizes selected uses without expanding or modifying the name draft. */
        getNameUsageChips(card: NameSource): NameUsageChip[] {
            const chips: NameUsageChip[] = [];
            const append = (
                key: string,
                labelKey: Parameters<typeof msg>[0],
                value: string,
                modified: boolean,
                variant?: string,
            ): void => {
                if (trimValue(value) === '') return;
                const label = msg(labelKey, { variant: variant ?? '' });
                chips.push({
                    key,
                    label,
                    modified,
                    value,
                    accessibleLabel: msg(
                        modified
                            ? 'names.customUsageValue'
                            : 'names.usageValue',
                        { role: label, value },
                    ),
                });
            };
            for (const role of [
                'pageName',
                'redirect',
                'noteTa',
                'sortKey',
                'displayTitle',
            ] as const) {
                const row = getNameRole(dependencies.form, card.id, role);
                if (role === 'redirect') {
                    const reviewed = methods.getNameCardRedirectRows(card);
                    const selected = reviewed.filter(
                        (candidate: any) => candidate.enabled,
                    );
                    const values = selected.map((candidate: any) =>
                        trimValue(candidate.title),
                    );
                    if (row.enabled) {
                        values.push(
                            ...getNameRoleRedirectTitles(row.value).filter(
                                (title) =>
                                    !reviewed.some((candidate: any) =>
                                        [
                                            candidate.title,
                                            candidate.generatedTitle,
                                        ]
                                            .map((value) =>
                                                getRelatedIdentity(value),
                                            )
                                            .includes(
                                                getRelatedIdentity(title),
                                            ),
                                    ),
                            ),
                        );
                    }
                    append(
                        role,
                        'names.usageRedirect',
                        [...new Set(values.filter(Boolean))].join('; '),
                        (row.enabled && row.modified) ||
                            selected.some(
                                (candidate: any) =>
                                    candidate.manualAdded ||
                                    candidate.modified ||
                                    (candidate.generatedTitle &&
                                        getRelatedIdentity(candidate.title) !==
                                            getRelatedIdentity(
                                                candidate.generatedTitle,
                                            )),
                            ),
                    );
                    continue;
                }
                if (!row.enabled) continue;
                if (role === 'noteTa') {
                    for (const usage of getNameConversionUsage(
                        dependencies.form,
                        card.id,
                    )) {
                        append(
                            `noteTa:${usage.variant}`,
                            usage.variant === 'zh-cn'
                                ? 'names.usageNoteTaCn'
                                : usage.variant === 'zh-tw'
                                  ? 'names.usageNoteTaTw'
                                  : 'names.usageNoteTaVariant',
                            usage.value,
                            usage.modified,
                            usage.variant,
                        );
                    }
                    continue;
                }
                append(
                    role,
                    (
                        {
                            pageName: 'names.usagePageName',
                            sortKey: 'names.usageSortKey',
                            displayTitle: 'names.usageDisplayTitle',
                        } as const
                    )[role],
                    row.value,
                    row.modified,
                );
            }
            return chips;
        },

        /** Projects the current combined conversion into compact regional title chips. */
        getNameConversionChips(): ReturnType<
            typeof getEmittedNameConversionChips
        > {
            return getEmittedNameConversionChips(dependencies.form);
        },

        /** Explains which existing singleton choice selecting this source would replace. */
        getNameRoleOtherUses(
            card: NameSource,
            role: NameRole,
        ): Array<{
            sourceId: string;
            value: string;
            label: string;
            hint: string;
        }> {
            if (
                role === 'redirect' ||
                role === 'noteTa' ||
                getNameRole(dependencies.form, card.id, role).enabled
            )
                return [];
            const roleLabel = msg(
                (
                    {
                        pageName: 'names.usagePageName',
                        sortKey: 'names.usageSortKey',
                        displayTitle: 'names.usageDisplayTitle',
                    } as const
                )[role],
            );
            return getNameSources(dependencies.form).flatMap((source) => {
                if (source.id === card.id) return [];
                const selected = getNameRole(
                    dependencies.form,
                    source.id,
                    role,
                );
                if (!selected.enabled) return [];
                const value = trimValue(selected.value);
                const sourceLabel =
                    source.kind === 'localized'
                        ? msg('names.nameNumber', {
                              number: (source.index ?? 0) + 1,
                          })
                        : msg(
                              source.kind === 'original'
                                  ? 'titles.originalTitle'
                                  : 'titles.englishTitle',
                          );
                return value === ''
                    ? []
                    : [
                          {
                              sourceId: source.id,
                              value,
                              label: msg('names.otherUse', {
                                  source: sourceLabel,
                                  role: roleLabel,
                                  value,
                              }),
                              hint: msg('names.otherUseHint', {
                                  source: sourceLabel,
                                  role: roleLabel,
                              }),
                          },
                      ];
            });
        },

        /** Reports whether this card's five name-use controls are expanded. */
        isNameUsesExpanded(card: NameSource): boolean {
            return expandedNameUseCards.has(card.id);
        },

        /** Opens the settings in their own name frame, including retained manual values. */
        toggleNameUses(card: NameSource): void {
            if (expandedNameUseCards.has(card.id))
                expandedNameUseCards.delete(card.id);
            else expandedNameUseCards.add(card.id);
        },

        /** Keeps each review input attached to its draft when another row is removed. */
        getNameReviewRowKey(row: object): string {
            let key = nameReviewRowKeys.get(row);
            if (key == null) {
                key = 'name-review-' + ++nameReviewRowSequence;
                nameReviewRowKeys.set(row, key);
            }
            return key;
        },

        /** Keeps the actual reviewed redirect rows inside their owning name frame. */
        getNameCardRedirectRows(card: NameSource): any[] {
            return (dependencies.form.redirectRows || []).filter(
                (row: any) =>
                    (trimValue(row.title) !== '' || row.nameSourceId) &&
                    getNameRedirectOwner(row) === card.id,
            );
        },

        /** Keeps the primary redirect suggestion in its compact role row. */
        getNameRoleRedirectReviewRow(card: NameSource): any | undefined {
            const title = getNameRoleRedirectTitles(
                getNameRole(dependencies.form, card.id, 'redirect').value,
            )[0];
            if (!title || !methods.isNameRoleRedirectVisible(card))
                return undefined;
            const identity = getRelatedIdentity(title);
            return (dependencies.form.redirectRows || []).find(
                (row: any) =>
                    row.manualAdded !== true &&
                    getRelatedIdentity(row.title) === identity,
            );
        },

        /** Shows independently editable aliases after the primary redirect. */
        getNameCardExtraRedirectRows(card: NameSource): any[] {
            const primary = methods.getNameRoleRedirectReviewRow(card);
            const represented = new Set(
                getNameRoleRedirectTitles(
                    getNameRole(dependencies.form, card.id, 'redirect').value,
                ).map((title) => getRelatedIdentity(title)),
            );
            return methods
                .getNameCardRedirectRows(card)
                .filter(
                    (row: any) =>
                        row !== primary &&
                        !(
                            row.manualAdded !== true &&
                            row.pendingEdit == null &&
                            trimValue(row.generatedTitle) !== '' &&
                            getRelatedIdentity(row.title) ===
                                getRelatedIdentity(row.generatedTitle) &&
                            represented.has(getRelatedIdentity(row.title))
                        ),
                );
        },

        /** Numbers each added alias in its visible reading order. */
        getNameCardRedirectLabel(card: NameSource, index: number): string {
            return msg('names.useAsRedirectNumber', {
                number:
                    index + (methods.isNameRoleRedirectVisible(card) ? 2 : 1),
            });
        },

        /** Retains a deliberate deletion independently from changing source defaults. */
        isNameRoleRedirectVisible(card: NameSource): boolean {
            const row = getNameRole(dependencies.form, card.id, 'redirect');
            return !(
                row.modified &&
                !row.enabled &&
                trimValue(row.value) === ''
            );
        },

        /** Removes this source's primary suggestion while retaining shared aliases. */
        removeNameRoleRedirect(card: NameSource): void {
            const row = methods.getNameRoleRedirectReviewRow(card);
            const represented = new Set(
                getNameRoleRedirectTitles(
                    getNameRole(dependencies.form, card.id, 'redirect').value,
                ).map((title) => getRelatedIdentity(title)),
            );
            for (const alias of methods.getNameCardExtraRedirectRows(card)) {
                alias.nameSourceId = card.id;
                alias.manualAdded = true;
            }
            setNameRole(dependencies.form, card.id, 'redirect', {
                enabled: false,
                modified: true,
                value: '',
            });
            invalidateNamePageEvidence(card.id, 'redirect');
            const contributed = new Set(
                getNameRedirectTitles(dependencies.form).map((title) =>
                    getRelatedIdentity(title),
                ),
            );
            for (const candidate of [
                ...(dependencies.form.redirectRows || []),
            ]) {
                const identity = getRelatedIdentity(candidate.title);
                const representedRow =
                    candidate === row ||
                    (candidate.manualAdded !== true &&
                        candidate.pendingEdit == null &&
                        represented.has(identity) &&
                        getRelatedIdentity(candidate.generatedTitle) ===
                            identity);
                if (representedRow && !contributed.has(identity)) {
                    const index =
                        dependencies.form.redirectRows.indexOf(candidate);
                    if (index >= 0) dependencies.removeRedirectRow(index);
                }
            }
        },

        /** Adds an editable alias to this name's reviewed redirect settings. */
        addNameCardRedirect(card: NameSource): void {
            const rows = ensureRedirectRows(dependencies.form);
            rows.push(
                createRedirectRow({
                    title: '',
                    manualAdded: true,
                    nameSourceId: card.id,
                }),
            );
            ensureTrailingRedirectRow(dependencies.form);
        },

        /** Preserves the review checkbox's authority over generated suggestions. */
        updateNameCardRedirectEnabled(row: any, enabled: boolean): void {
            row.enabled = enabled;
        },

        /** Keeps the primary role and its actual reviewed save selection aligned. */
        updateNamePrimaryRedirectEnabled(
            card: NameSource,
            enabled: boolean,
        ): void {
            const reviewed = methods.getNameRoleRedirectReviewRow(card);
            methods.updateNameRoleEnabled(card, 'redirect', enabled);
            if (reviewed != null) reviewed.enabled = enabled;
        },

        /** Checks one alias on commit without replacing its reviewed selection. */
        async commitNameCardRedirect(row: any, fresh = false): Promise<void> {
            if (!dependencies.form.redirectRows?.includes(row)) return;
            setRedirectRowTitle(row, trimValue(row.title));
            if (trimValue(row.title) === '') return;
            await dependencies.runReviewRefresh(() =>
                dependencies.checkRedirectRows({
                    recheck:
                        fresh ||
                        methods.getNameCardRedirectPageExistence(row) === null,
                }),
            );
        },

        /** Reports existence only when the current title has a successful check. */
        getNameCardRedirectPageExistence(row: any): boolean | null {
            if (
                !isRedirectRowFixed(row) ||
                /^(?:Unchecked|CheckFailed|Failed|Unknown|Error)(?::|$)/iu.test(
                    trimValue(row.status),
                )
            )
                return null;
            return row.exists === true;
        },

        /** Inserts clipboard text at the active selection and checks the resulting alias. */
        pasteNameCardRedirect(row: any, event: ClipboardEvent): void {
            const value = getPastedNameInput(event);
            if (value == null || !dependencies.form.redirectRows?.includes(row))
                return;
            event.preventDefault();
            setRedirectRowTitle(row, value);
            ensureTrailingRedirectRow(dependencies.form);
            void methods.commitNameCardRedirect(row, true);
        },

        /** Removes an alias from its contributing roles so refreshes do not restore it. */
        removeNameCardRedirect(row: any): void {
            const identity = getRelatedIdentity(row.title);
            const sourceId = getNameRedirectOwner(row);
            if (identity !== '' && row.manualAdded !== true) {
                const role = getNameRole(
                    dependencies.form,
                    sourceId,
                    'redirect',
                );
                const titles = getNameRoleRedirectTitles(role.value);
                const remaining = titles.filter(
                    (title) => getRelatedIdentity(title) !== identity,
                );
                if (remaining.length !== titles.length)
                    setNameRole(dependencies.form, sourceId, 'redirect', {
                        value: remaining.join('; '),
                        modified: true,
                        enabled: remaining.length > 0 && role.enabled,
                    });
                invalidateNamePageEvidence(sourceId, 'redirect');
                if (
                    getNameRedirectTitles(dependencies.form).some(
                        (title) => getRelatedIdentity(title) === identity,
                    )
                )
                    return;
            }
            const index = dependencies.form.redirectRows?.indexOf(row) ?? -1;
            if (index >= 0) dependencies.removeRedirectRow(index);
        },

        /** Updates the source input; use-specific overrides stay independent. */
        updateNameCardValue(
            card: NameCard,
            field: string,
            value: string,
        ): void {
            if (card.kind === 'localized') {
                methods.updateNameRowValue(
                    'localizedNames',
                    card.index,
                    field,
                    value,
                );
                return;
            }
            const key =
                card.kind === 'original' ? 'originalName' : 'englishName';
            if (field === 'name' && dependencies.form[key] !== value)
                invalidateNamePageEvidence(card.id);
            dependencies.form[field === 'name' ? key : key + 'SourceUrl'] =
                value;
            syncNameRoleOutputs();
            syncGeneratedNameNoteTaRow(dependencies.form);
        },

        /** Commits a source name before refreshing candidate titles. */
        commitNameCard(card: NameCard, field: string): void {
            if (card.kind === 'localized') {
                methods.updateNameRow('localizedNames', card.index, field);
                return;
            }
            const key =
                card.kind === 'original' ? 'originalName' : 'englishName';
            const fieldKey = field === 'name' ? key : key + 'SourceUrl';
            dependencies.form[fieldKey] = trimValue(
                dependencies.form[fieldKey],
            );
            syncNameRoleOutputs();
            syncGeneratedNameNoteTaRow(dependencies.form);
            if (field === 'name') {
                void dependencies.runReviewRefresh(() =>
                    dependencies.refreshRedirectRows(),
                );
                if (dependencies.activeTab.value === 'titles')
                    void refreshNamePageChecks();
            }
        },

        /** Reads a default or persisted use without changing the source name. */
        getNameRole(card: NameSource, role: NameRole): any {
            const row = getNameRole(dependencies.form, card.id, role);
            if (role === 'noteTa') {
                const draft = getNameNoteTaRuleDraft(
                    dependencies.form,
                    card.id,
                );
                return { ...row, ...draft };
            }
            return {
                ...row,
                value: row.modified ? row.value : '',
                defaultValue: row.value,
            };
        },

        /** Chooses one singleton output or stages a redirect/conversion rule. */
        updateNameRoleEnabled(
            card: NameSource,
            role: NameRole,
            enabled: boolean,
        ): void {
            const previous = getNameRole(dependencies.form, card.id, role);
            const row = setNameRole(dependencies.form, card.id, role, {
                enabled,
            });
            if (role === 'noteTa' && enabled && !row.modified)
                dependencies.form.noteTaNamesRemoved = false;
            if (role === 'noteTa') {
                // Retain the other region when a legacy combined choice is disabled.
                for (const source of getNameSources(
                    dependencies.form,
                ).reverse()) {
                    if (source.id === card.id || source.kind !== 'localized')
                        continue;
                    const other = getNameRole(
                        dependencies.form,
                        source.id,
                        'noteTa',
                    );
                    const variants = getNameNoteTaVariants(
                        dependencies.form,
                        source.id,
                    );
                    if (
                        other.enabled &&
                        !other.modified &&
                        (variants['zh-cn'].effectiveValue !== '' ||
                            variants['zh-tw'].effectiveValue !== '')
                    )
                        activateNameNoteTaVariants(source.id);
                }
                if (enabled) activateNameNoteTaVariants(card.id);
            }
            if (role === 'redirect') {
                const candidates = hasFirstLevelFieldSeparator(row.value)
                    ? splitFieldValues(row.value)
                    : [row.value];
                const contributed = new Set(
                    getNameRedirectTitles(dependencies.form).map((title) =>
                        getRelatedIdentity(title),
                    ),
                );
                for (const title of candidates) {
                    const identity = getRelatedIdentity(title);
                    const reviewed = dependencies.form.redirectRows?.find(
                        (candidate: any) =>
                            getRelatedIdentity(candidate.title) === identity,
                    );
                    if (
                        reviewed &&
                        reviewed.pendingEdit == null &&
                        (enabled || !contributed.has(identity))
                    )
                        reviewed.enabled = enabled;
                }
            }
            const key = getNameOutputKey(role);
            if (
                !enabled &&
                key &&
                trimValue(dependencies.form[key]) === trimValue(previous.value)
            ) {
                dependencies.form[key] = '';
                dependencies.updateFieldDependencies(key);
            }
            if (enabled && key) {
                dependencies.form[key] = row.value;
                dependencies.updateFieldDependencies(key);
            }
            syncGeneratedNameNoteTaRow(dependencies.form);
            markCategoryRowsUnfixed(dependencies.form.categoryRows);
            void dependencies.runReviewRefresh(() =>
                dependencies.refreshRedirectRows(),
            );
            if (role === 'pageName' || role === 'redirect')
                void checkNamePageIfNeeded(card.id, role);
        },

        /** Retains an editable draft even when that use is not selected. */
        updateNameRoleValue(
            card: NameSource,
            role: NameRole,
            value: string,
        ): void {
            if (role === 'noteTa') {
                setNameNoteTaRule(dependencies.form, card.id, value);
                syncGeneratedNameNoteTaRow(dependencies.form);
                return;
            }
            if (role === 'pageName' || role === 'redirect')
                invalidateNamePageEvidence(card.id, role);
            setNameRole(dependencies.form, card.id, role, {
                value,
                modified: trimValue(value) !== '',
            });
            syncNameRoles(dependencies.form);
        },

        /** Applies an edited use to its existing review path. */
        commitNameRole(card: NameSource, role: NameRole, fresh = false): void {
            const row = getNameRole(dependencies.form, card.id, role);
            if (role === 'noteTa') {
                setNameNoteTaRule(
                    dependencies.form,
                    card.id,
                    trimValue(
                        getNameNoteTaRuleDraft(dependencies.form, card.id)
                            .value,
                    ),
                );
            } else {
                setNameRole(dependencies.form, card.id, role, {
                    value: trimValue(row.value),
                    modified: row.modified,
                });
            }
            if (role === 'noteTa' && row.enabled && !row.modified)
                dependencies.form.noteTaNamesRemoved = false;
            syncNameRoleOutputs();
            syncGeneratedNameNoteTaRow(dependencies.form);
            markCategoryRowsUnfixed(dependencies.form.categoryRows);
            void dependencies.runReviewRefresh(() =>
                dependencies.refreshRedirectRows(),
            );
            if (role === 'pageName' || role === 'redirect')
                void (fresh
                    ? checkNamePage(card.id, role, true)
                    : checkNamePageIfNeeded(card.id, role));
        },

        /** Applies a paste before checking, preserving punctuation and selection replacement. */
        pasteNameRole(
            card: NameSource,
            role: NameRole,
            event: ClipboardEvent,
        ): void {
            const value = getPastedNameInput(event);
            if (value == null) return;
            event.preventDefault();
            methods.updateNameRoleValue(card, role, value);
            methods.commitNameRole(card, role, true);
        },

        /** Exposes tri-state title evidence only for the current draft. */
        getNameRolePageState(card: NameSource, role: NameRole): NamePageState {
            const title = trimValue(
                getNameRole(dependencies.form, card.id, role).value,
            );
            const state = namePageStates.get(card.id + ':' + role);
            return state?.title === title
                ? state
                : { title, exists: null, loading: false };
        },

        /** Links each checked alias separately when a redirect use contains several titles. */
        getNameRoleMatchPageUrl(match: { title: string }): string {
            return dependencies.options.getPageUrl?.(match.title) || '';
        },

        /**
         * Updates whether a localized name row is official.
         *
         * @param key - Localized name group key.
         * @param index - Row index.
         * @param value - Whether the row is official.
         * @returns Result when the function
         *   updates whether a localized name row is
         *   official.
         */
        updateNameOfficial(key: string, index: number, value: boolean): void {
            dependencies.form[key][index].official = Boolean(value);
            ensureTrailingNameRow(dependencies.form[key]);
            syncGeneratedNameNoteTaRow(dependencies.form);
            void dependencies.runReviewRefresh(() =>
                dependencies.refreshRedirectRows(),
            );
        },

        /**
         * Updates one localized name row region.
         *
         * @param key - Localized name group key.
         * @param index - Row index.
         * @param market - Region key.
         * @param value - Whether the region is selected.
         * @returns Result when the function
         *   updates one localized name row region.
         */
        updateNameMarket(
            key: string,
            index: number,
            market: string,
            value: boolean,
        ): void {
            const row = dependencies.form[key][index];

            if (row == null) {
                return;
            }

            row[market] = Boolean(value);
            ensureTrailingNameRow(dependencies.form[key]);
            syncGeneratedNameNoteTaRow(dependencies.form);
            void dependencies.runReviewRefresh(() =>
                dependencies.refreshRedirectRows(),
            );
        },

        /**
         * Removes one localized name row.
         *
         * @param key - Localized name group key.
         * @param index - Row index.
         * @returns Result when the function
         *   removes one localized name row.
         */
        removeNameRow(key: string, index: number): void {
            const sourceId = dependencies.form[key][index]?.nameId;
            invalidateNamePageEvidence(sourceId);
            detachNameCardDrafts(sourceId);
            dependencies.form[key].splice(index, 1);
            ensureTrailingNameRow(dependencies.form[key]);
            syncNameRoleOutputs();
            adoptNameOutputRoles();
            syncGeneratedNameNoteTaRow(dependencies.form);
            void dependencies.runReviewRefresh(() =>
                dependencies.refreshRedirectRows(),
            );
        },

        /**
         * Updates the Steam helper URL.
         *
         * @param value - Raw Steam URL.
         * @returns Result when the function
         *   updates the steam helper url.
         */
        updateSteamUrl(value: string): void {
            steamUrl.value = trimValue(value);
            fetchedSteamNameRows.value = [];
        },

        /**
         * Fetches Steam names and stores them as helper suggestions.
         *
         * @returns Resolves after rows are fetched.
         */
        async addSteamNames(): Promise<void> {
            await fetchSteamNames();
        },

        /**
         * Applies one Steam name helper suggestion choice.
         *
         * @param choice - Steam helper choice key.
         * @returns Result when the function
         *   applies one steam name helper suggestion
         *   choice.
         */
        applySteamNameChoice(choice: string): void {
            if (!choice) {
                return;
            }
            namePageStates.clear();
            namePageChecks.clear();

            removeSteamAppliedNameRows();
            const forEachCallback = function callback(row: any) {
                markSteamNameHelperRow(row);
                dependencies.form.localizedNames.push(row);
            };
            buildSteamNameChoiceRows(fetchedSteamNameRows.value, choice)
                .map(createNameRowFromValues)
                .forEach(forEachCallback);
            ensureTrailingNameRow(dependencies.form.localizedNames);
            syncNameRoleOutputs();
            syncGeneratedNameNoteTaRow(dependencies.form);
            void dependencies.runReviewRefresh(() =>
                dependencies.refreshRedirectRows(),
            );
            if (dependencies.activeTab.value === 'titles')
                void refreshNamePageChecks();
        },

        /**
         * Handles is steam name helper row.
         *
         * Checks whether a localized name row came from the Steam
         * helper.
         *
         * @param row - Localized name row.
         * @returns Whether the row was helper-generated.
         */
        isSteamNameHelperRow(row: any): boolean {
            return row?.[STEAM_NAME_HELPER_ROW] === true;
        },
    };
    function reset(): void {
        steamRequest += 1;
        dependencies.sourceFetchState.loading = false;
        namePageStates.clear();
        namePageChecks.clear();
        expandedNameUseCards.clear();
        nameReviewRowKeys = new WeakMap();
        nameReviewRowSequence = 0;
        fetchedSteamNameRows.value = [];
        steamUrl.value = '';
    }
    return {
        methods,
        state: { fetchedSteamNameRows, steamUrl },
        reset,
        dispose() {
            disposed = true;
            reset();
        },
        getNameSearchRows,
        adoptNameOutputRoles,
        releaseNameOutputRole,
        refreshNamePageChecks,
        syncPageNameFields,
        fetchSteamNames,
    };
}
