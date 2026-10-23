/**
 * @file src/vg-stub-creator/features/creator/form/citation-editor.ts
 * Purpose: Owns citation editing state and actions for one creator dialog.
 *
 * Table of contents:
 * 1. Imports
 * 2. Dependencies
 * 3. createCitationEditor
 * 4. getCitationParamRows
 * 5. getCitationParamTableRows
 * 6. getCitationTabsKey
 * 7. getCitationTabName
 * 8. getCitationTabLabel
 * 9. getCitationSourceDomain
 */

import { trimValue } from '../../../domain/wikitext/index.ts';

import { getErrorMessage } from '../error-message.ts';
import type { CreatorDialogOptions } from './dialog-options.ts';
import {
    applyCitationPatches,
    cloneValue,
    createCitationParamRow,
    createCitationPrefetchQueue,
    createCitationRow,
    sortManagedCitationParams,
} from './form-model.ts';

interface Dependencies {
    Vue: any;
    form: any;
    options: Pick<
        CreatorDialogOptions,
        'onPrepareCitations' | 'citationPrefetchDelay' | 'onSourceUrlChange'
    >;
    sourceFetchState: any;
}
export function createCitationEditor(dependencies: Dependencies) {
    let disposed = false;
    let generation = 0;
    const activeCitationTab: any = dependencies.Vue.ref('');
    const citationState: any = dependencies.Vue.reactive({
        error: '',
        loading: false,
    });
    const queueCitationPrefetch = createCitationPrefetchQueue(
        dependencies.options,
    );

    /**
     * Finds a refreshed citation matching the requested source.
     *
     * @param rows - Row values.
     * @param citation - Citation value.
     * @returns A refreshed citation matching the requested source.
     */
    function findRefetchedCitation(rows: Array<any>, citation: any): any {
        const sourceUrl = trimValue(citation.sourceUrl);
        const findCallback = function callback(row: any) {
            return trimValue(row.sourceUrl) === sourceUrl;
        };
        const result = rows.map(createCitationRow).find(findCallback);
        return result;
    }

    /**
     * Replaces one citation with refreshed generated parameters.
     *
     * @param index - Zero-based item index.
     * @param refreshed - Refreshed value.
     */
    function replaceRefetchedCitation(index: number, refreshed: any): void {
        const cloneValueResult = {
            ...refreshed,
            modified: false,
            params: cloneValue(refreshed.generatedParams || []),
        };
        dependencies.form.citationRows.splice(index, 1, cloneValueResult);
    }

    /**
     * Refreshes editable citation rows from the current source URLs.
     *
     * @returns Resolves after citation rows are ready.
     */
    async function refreshCitationRows(): Promise<void> {
        if (disposed || dependencies.options.onPrepareCitations == null) {
            return;
        }

        const request = ++generation;
        const citations = dependencies.form.citationRows;
        const isCurrent = () =>
            !disposed &&
            request === generation &&
            dependencies.form.citationRows === citations;
        citationState.error = '';
        citationState.loading = true;
        dependencies.sourceFetchState.error = '';
        dependencies.sourceFetchState.loading = true;

        try {
            const rows = await dependencies.options.onPrepareCitations(
                dependencies.form,
            );
            if (!isCurrent()) return;
            const mappedValues = rows.map(createCitationRow);
            const patchedRows = applyCitationPatches(
                mappedValues,
                dependencies.form.historyPatches?.citations,
            );

            dependencies.form.citationRows.splice(
                0,
                dependencies.form.citationRows.length,
                ...patchedRows,
            );
            syncActiveCitationTab();
        } catch (error) {
            if (!isCurrent()) return;
            citationState.error = getErrorMessage(error);
            dependencies.sourceFetchState.error = citationState.error;
        } finally {
            if (isCurrent()) {
                citationState.loading = false;
                dependencies.sourceFetchState.loading = false;
            }
        }
    }

    /**
     * Keeps the active citation tab pointed at an available row.
     *
     * @returns Result when the function
     *   keeps the active citation tab pointed at an
     *   available row.
     */
    function syncActiveCitationTab(): void {
        const names = dependencies.form.citationRows.map(getCitationTabName);

        if (!names.includes(activeCitationTab.value)) {
            activeCitationTab.value = names[0] || '';
        }
    }

    /**
     * Finds the generated parameter that should restore one citation row.
     *
     * @param citation - Managed citation row.
     * @param paramIndex - Editable parameter index.
     * @returns Generated parameter row.
     */
    function findGeneratedCitationParam(
        citation: any,
        paramIndex: number,
    ): any | undefined {
        const param = citation.params[paramIndex];
        const name = trimValue(param?.name);
        const generatedParams: Array<{ name: string }> =
            citation.generatedParams || [];

        const result =
            generatedParams.find((generated) => generated.name === name) ||
            generatedParams[paramIndex];
        return result;
    }

    /**
     * Checks whether two citation parameter lists have the same values.
     *
     * @param first - First parameter list.
     * @param second - Second parameter list.
     * @returns Whether the parameter lists are equal.
     */
    function areCitationParamsEqual(
        first: Array<any> = [],
        second: Array<any> = [],
    ): boolean {
        return JSON.stringify(first) === JSON.stringify(second || []);
    }
    const methods = {
        /**
         * Updates one managed citation parameter value.
         *
         * @param citationIndex - Citation row index.
         * @param paramIndex - Parameter row index.
         * @param field - Parameter field key.
         * @param value - Raw input value.
         * @returns Result when the function
         *   updates one managed citation parameter value.
         */
        updateCitationParam(
            citationIndex: number,
            paramIndex: number,
            field: string,
            value: string,
        ): void {
            const citation = dependencies.form.citationRows[citationIndex];

            if (citation == null) {
                return;
            }

            if (citation.params[paramIndex] == null) {
                const citationParamRowResultA = createCitationParamRow();
                citation.params.push(citationParamRowResultA);
            }

            citation.params[paramIndex][field] = trimValue(value);
            citation.modified = true;
        },

        /**
         * Sorts one managed citation's parameters.
         *
         * @param citationIndex - Citation row index.
         * @returns Result when the function
         *   sorts one managed citation's parameters.
         */
        sortCitation(citationIndex: number): void {
            const citation = dependencies.form.citationRows[citationIndex];

            if (citation == null) {
                return;
            }

            citation.params = sortManagedCitationParams(
                citation.params,
                citation.template,
            );
        },

        /**
         * Appends a blank parameter row to one managed citation.
         *
         * @param citationIndex - Citation row index.
         * @returns Result when the function
         *   appends a blank parameter row to one managed
         *   citation.
         */
        addCitationParam(citationIndex: number): void {
            const citation = dependencies.form.citationRows[citationIndex];

            if (citation == null) {
                return;
            }

            const citationParamRowResult = createCitationParamRow();
            citation.params.push(citationParamRowResult);
            citation.modified = true;
        },

        /**
         * Removes blank editable parameters from one managed citation.
         *
         * @param citationIndex - Citation row index.
         * @returns Result when the function
         *   removes blank editable parameters from one
         *   managed citation.
         */
        cleanCitationParams(citationIndex: number): void {
            const citation = dependencies.form.citationRows[citationIndex];

            if (citation == null) {
                return;
            }

            const params: Array<{ value?: unknown }> = citation.params || [];
            const filterCallbackE = (param: { value?: unknown }) =>
                trimValue(param?.value) !== '';
            citation.params = params.filter(filterCallbackE);
            citation.modified = true;
        },

        /**
         * Removes one managed citation parameter row.
         *
         * @param citationIndex - Citation row index.
         * @param paramIndex - Parameter row index.
         * @returns Result when the function
         *   removes one managed citation parameter row.
         */
        removeCitationParam(citationIndex: number, paramIndex: number): void {
            const citation = dependencies.form.citationRows[citationIndex];

            if (citation == null) {
                return;
            }

            citation.params.splice(paramIndex, 1);
            citation.modified = true;
        },

        /**
         * Handles reset citation param.
         *
         * Resets one managed citation parameter row to its generated
         * value.
         *
         * @param citationIndex - Citation row index.
         * @param paramIndex - Parameter row index.
         * @returns *
         */
        resetCitationParam(citationIndex: number, paramIndex: number): void {
            const citation = dependencies.form.citationRows[citationIndex];

            if (citation == null || citation.params[paramIndex] == null) {
                return;
            }

            const generated = findGeneratedCitationParam(citation, paramIndex);

            if (generated == null) {
                citation.params.splice(paramIndex, 1);
            } else {
                citation.params[paramIndex] = cloneValue(generated);
            }

            citation.params = sortManagedCitationParams(
                citation.params,
                citation.template,
            );
            citation.modified = !areCitationParamsEqual(
                citation.params,
                citation.generatedParams,
            );
        },

        /**
         * Handles refetch citation.
         *
         * Re-fetches one managed citation and overwrites edited
         * parameters.
         *
         * @param citationIndex - Citation row index.
         * @returns Resolves after the citation is
         * refreshed.
         */
        async refetchCitation(citationIndex: number): Promise<void> {
            const citation = dependencies.form.citationRows[citationIndex];

            if (
                disposed ||
                citation == null ||
                dependencies.options.onPrepareCitations == null
            ) {
                return;
            }

            const request = ++generation;
            const sourceUrl = citation.sourceUrl;
            const isCurrent = () =>
                !disposed &&
                request === generation &&
                dependencies.form.citationRows[citationIndex] === citation &&
                citation.sourceUrl === sourceUrl;
            citationState.error = '';
            citationState.loading = true;

            try {
                const rows = await dependencies.options.onPrepareCitations(
                    dependencies.form,
                    {
                        refetchSourceUrls: [citation.sourceUrl],
                    },
                );
                if (!isCurrent()) return;
                const refreshed = findRefetchedCitation(rows, citation);

                if (refreshed != null) {
                    replaceRefetchedCitation(citationIndex, refreshed);
                    syncActiveCitationTab();
                }
            } catch (error) {
                if (!isCurrent()) return;
                citationState.error = getErrorMessage(error);
            } finally {
                if (!disposed && request === generation) {
                    citationState.loading = false;
                    dependencies.sourceFetchState.loading = false;
                }
            }
        },
    };
    function reset(): void {
        generation += 1;
        dependencies.sourceFetchState.loading = false;
        queueCitationPrefetch.cancel();
        activeCitationTab.value = '';
        citationState.error = '';
        citationState.loading = false;
    }
    return {
        methods,
        state: { activeCitationTab, citationState },
        queueCitationPrefetch,
        reset,
        dispose() {
            disposed = true;
            reset();
            queueCitationPrefetch.dispose();
        },
        refreshCitationRows,
    };
}

/**
 * Gets visible parameter rows, including one trailing blank row.
 *
 * @param citation - Managed citation row.
 * @returns Visible parameter rows.
 */
export function getCitationParamRows(citation: any): Array<any> {
    return [...(citation.params || []), createCitationParamRow()];
}

/**
 * Gets visible citation parameter rows for Codex Table.
 *
 * @param citation - Managed citation row.
 * @returns Visible parameter table rows.
 */
export function getCitationParamTableRows(citation: any): Array<any> {
    const result = getCitationParamRows(citation).map(
        function callback(param, index) {
            const result = {
                index,
                param,
            };
            return result;
        },
    );
    return result;
}

/**
 * Builds a key for remounting dynamic citation tabs.
 *
 * @param rows - Managed citation rows.
 * @returns Citation tabs key.
 */
export function getCitationTabsKey(rows: Array<any>): string {
    const mapCallback = (citation: any) => trimValue(citation.sourceUrl);
    const result = rows.map(mapCallback).join('\n');
    return result;
}

/**
 * Builds the stable tab name for a managed citation row.
 *
 * @param citation - Managed citation row.
 * @param index - Citation row index.
 * @returns Citation tab name.
 */
export function getCitationTabName(citation: any, index: number): string {
    return `citation-${citation.index || index + 1}`;
}

/**
 * Builds a compact citation tab label.
 *
 * @param citation - Managed citation row.
 * @returns Citation tab label.
 */
export function getCitationTabLabel(citation: any): string {
    const result = [
        '',
        citation.index,
        ': ',
        getCitationSourceDomain(citation.sourceUrl),
        '',
    ].join('');
    return result;
}

/**
 * Gets a source URL domain for compact display.
 *
 * @param sourceUrl - Source URL.
 * @returns Hostname or source URL fallback.
 */
function getCitationSourceDomain(sourceUrl: string): string {
    try {
        return new URL(sourceUrl).hostname.replace(/^www\./u, '');
    } catch (_error) {
        return trimValue(sourceUrl) || 'source';
    }
}
