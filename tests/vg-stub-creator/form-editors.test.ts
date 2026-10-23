/**
 * @file tests/vg-stub-creator/form-editors.test.ts
 * Purpose: Keep extracted citation and name owners isolated from superseded async results.
 *
 * Table of contents:
 * 1. Imports
 * 2. deferred
 * 3. citation
 * 4. citationFixture
 * 5. nameFixture
 * 6. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { computed, reactive, ref } from 'vue';
import { createCitationEditor } from '../../src/vg-stub-creator/features/creator/form/citation-editor.ts';
import { createNameEditor } from '../../src/vg-stub-creator/features/creator/form/name-editor.ts';
import {
    createCitationRow,
    createFormValues,
} from '../../src/vg-stub-creator/features/creator/form/form-model.ts';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function citation(title: string) {
    return createCitationRow({
        sourceUrl: 'https://example.test/review',
        generatedParams: [{ name: 'title', value: title }],
    });
}

function citationFixture(
    prepare: () => Promise<Array<Record<string, unknown>>>,
) {
    const form = reactive({ citationRows: [citation('Reviewed title')] });
    const sourceFetchState = reactive({ error: '', loading: false });
    const owner = createCitationEditor({
        Vue: { computed, reactive, ref },
        form,
        sourceFetchState,
        options: {
            onPrepareCitations: prepare,
            onSourceUrlChange() {},
        },
    } as Parameters<typeof createCitationEditor>[0]);
    return { form, sourceFetchState, owner };
}

function nameFixture(
    fetchNames: () => Promise<Array<Record<string, unknown>>>,
) {
    const form = reactive(createFormValues());
    const sourceFetchState = reactive({ error: '', loading: false });
    const owner = createNameEditor({
        Vue: { computed, reactive, ref },
        form,
        options: { onSteamNamesFetch: fetchNames },
        sourceFetchState,
        componentMounted: true,
        currentTitle: 'Star Harbor',
        activeTab: ref('titles'),
        updateFieldDependencies() {},
        runReviewRefresh: async (refresh: () => Promise<void>) => refresh(),
        refreshRedirectRows: async () => {},
        checkRedirectRows: async () => {},
        removeRedirectRow() {},
    } as unknown as Parameters<typeof createNameEditor>[0]);
    owner.methods.updateSteamUrl('https://store.steampowered.com/app/1/');
    return { owner, sourceFetchState };
}

test('successful citation refetch replaces the row and clears both owned loading flags', async () => {
    const fixture = citationFixture(async () => [citation('Refetched title')]);
    const original = fixture.form.citationRows[0];
    await fixture.owner.methods.refetchCitation(0);
    assert.notEqual(fixture.form.citationRows[0], original);
    assert.equal(
        fixture.form.citationRows[0].params[0].value,
        'Refetched title',
    );
    assert.equal(fixture.owner.state.citationState.loading, false);
    assert.equal(fixture.sourceFetchState.loading, false);
    fixture.owner.dispose();
});

test('citation results arriving after reset or disposal cannot replace restored rows or report errors', async (context) => {
    for (const operation of ['refresh', 'refetch'] as const) {
        for (const lifecycle of ['reset', 'dispose'] as const) {
            await context.test(`${operation} ${lifecycle}`, async () => {
                const response = deferred<Array<Record<string, unknown>>>();
                const fixture = citationFixture(() => response.promise);
                const pending =
                    operation === 'refresh'
                        ? fixture.owner.refreshCitationRows()
                        : fixture.owner.methods.refetchCitation(0);
                fixture.owner[lifecycle]();
                fixture.form.citationRows = [citation('Restored draft')];
                response.resolve([citation('Late remote title')]);
                await pending;
                assert.equal(
                    fixture.form.citationRows[0].params[0].value,
                    'Restored draft',
                );
                assert.equal(fixture.owner.state.citationState.loading, false);
                assert.equal(fixture.owner.state.citationState.error, '');
                fixture.owner.dispose();
            });
        }
    }
    const response = deferred<Array<Record<string, unknown>>>();
    const fixture = citationFixture(() => response.promise);
    const pending = fixture.owner.refreshCitationRows();
    fixture.owner.dispose();
    response.reject(new Error('Late network failure'));
    await pending;
    assert.equal(fixture.owner.state.citationState.error, '');
    assert.equal(fixture.sourceFetchState.error, '');
});

test('a targeted citation refetch supersedes a pending full refresh without leaving loading active', async () => {
    const responses = [
        deferred<Array<Record<string, unknown>>>(),
        deferred<Array<Record<string, unknown>>>(),
    ];
    let calls = 0;
    const fixture = citationFixture(() => responses[calls++].promise);
    const refresh = fixture.owner.refreshCitationRows();
    const refetch = fixture.owner.methods.refetchCitation(0);
    responses[1].resolve([citation('Newest citation')]);
    await refetch;
    responses[0].resolve([citation('Obsolete full refresh')]);
    await refresh;
    assert.equal(
        fixture.form.citationRows[0].params[0].value,
        'Newest citation',
    );
    assert.equal(fixture.owner.state.citationState.loading, false);
    assert.equal(fixture.sourceFetchState.loading, false);
    fixture.owner.dispose();
});

test('Steam results arriving after owner reset or disposal cannot repopulate the helper', async (context) => {
    for (const lifecycle of ['reset', 'dispose'] as const) {
        await context.test(lifecycle, async () => {
            const response = deferred<Array<Record<string, unknown>>>();
            const fixture = nameFixture(() => response.promise);
            const pending = fixture.owner.fetchSteamNames();
            fixture.owner[lifecycle]();
            response.resolve([{ name: 'Late name', markets: ['hans'] }]);
            await pending;
            assert.deepEqual(
                fixture.owner.state.fetchedSteamNameRows.value,
                [],
            );
            assert.equal(fixture.owner.state.steamUrl.value, '');
            assert.equal(fixture.sourceFetchState.error, '');
            fixture.owner.dispose();
        });
    }
});

test("changing a Steam URL rejects old suggestions and clears the completed request's loading state", async () => {
    const response = deferred<Array<Record<string, unknown>>>();
    const fixture = nameFixture(() => response.promise);
    const pending = fixture.owner.fetchSteamNames();
    fixture.owner.methods.updateSteamUrl(
        'https://store.steampowered.com/app/2/',
    );
    response.resolve([{ name: "Wrong game's name", markets: ['hans'] }]);
    await pending;
    assert.deepEqual(fixture.owner.state.fetchedSteamNameRows.value, []);
    assert.equal(
        fixture.owner.state.steamUrl.value,
        'https://store.steampowered.com/app/2/',
    );
    assert.equal(fixture.sourceFetchState.loading, false);
    fixture.owner.dispose();
});

test('a newer Steam request retains ownership while an older response finishes', async () => {
    const responses = [
        deferred<Array<Record<string, unknown>>>(),
        deferred<Array<Record<string, unknown>>>(),
    ];
    let calls = 0;
    const fixture = nameFixture(() => responses[calls++].promise);
    const older = fixture.owner.fetchSteamNames();
    fixture.owner.methods.updateSteamUrl(
        'https://store.steampowered.com/app/2/',
    );
    const newer = fixture.owner.fetchSteamNames();
    responses[0].resolve([{ name: 'Old name' }]);
    await older;
    assert.equal(fixture.sourceFetchState.loading, true);
    assert.deepEqual(fixture.owner.state.fetchedSteamNameRows.value, []);
    responses[1].resolve([{ name: 'New name' }]);
    await newer;
    assert.equal(fixture.sourceFetchState.loading, false);
    assert.equal(
        fixture.owner.state.fetchedSteamNameRows.value[0].name,
        'New name',
    );
    fixture.owner.dispose();
});
