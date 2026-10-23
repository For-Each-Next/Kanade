/**
 * @file tests/vg-stub-creator/pre-save.test.ts
 * Purpose: Preserve reviewed action scope and ordered writes through workflow extraction.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPreSaveActions } from '../../src/vg-stub-creator/domain/pre-save-actions.ts';
import { runSelectedActions } from '../../src/vg-stub-creator/app/workflows/pre-save.ts';
import {
    createFormValues,
    replaceFormValues,
} from '../../src/vg-stub-creator/features/creator/form/form-model.ts';

const api = {
    get: async () => ({}),
    post: async () => ({}),
    postWithToken: async () => ({}),
};

test('restored legacy redirect choices reach canonical action builders without losing staged source', () => {
    const form = createFormValues();
    replaceFormValues(form, {
        redirectRows: [
            { redirectTitle: 'Excluded legacy alias', selected: false },
            { redirectTitle: 'Included legacy alias', selected: true },
            {
                redirectTitle: 'Edited alias',
                selected: true,
                pendingEdit: {
                    title: 'Edited alias',
                    text: 'Reviewed source',
                    summary: 'Reviewed summary',
                    create: false,
                },
            },
        ],
    });
    const actions = buildPreSaveActions({ form, title: 'Star Harbor' });
    assert.equal(form.redirectRows[0].title, 'Excluded legacy alias');
    assert.equal(form.redirectRows[0].enabled, false);
    assert.ok(!Object.hasOwn(form.redirectRows[0], 'redirectTitle'));
    assert.ok(!Object.hasOwn(form.redirectRows[0], 'selected'));
    assert.equal(
        actions.find((action) => action.id === 'redirect:Excluded legacy alias')
            ?.selected,
        false,
    );
    assert.equal(
        actions.find((action) => action.id === 'redirect:Included legacy alias')
            ?.selected,
        true,
    );
    const edit = actions.find(
        (action) => action.id === 'page-edit:Edited alias',
    );
    assert.equal(edit?.text, 'Reviewed source');
    assert.equal(edit?.summary, 'Reviewed summary');
    assert.ok(!actions.some((action) => action.id === 'redirect:Edited alias'));
});

test('converted title evidence blocks only its exact reviewed candidate', () => {
    const actions = buildPreSaveActions(
        {
            title: 'Article',
            form: {
                redirectRows: [
                    { title: '摄影冒险', enabled: true },
                    { title: 'Independent alias', enabled: false },
                ],
            },
        },
        [{ requestedTitle: '摄影冒险', title: '攝影冒險', exists: true }],
    );
    assert.equal(
        actions.find((action) => action.id === 'redirect:摄影冒险')?.selected,
        false,
    );
    assert.equal(
        actions.find((action) => action.id === 'redirect:Independent alias')
            ?.selected,
        false,
    );
    assert.ok(!actions.some((action) => action.id === 'redirect:攝影冒險'));
});

test('reviewed execution preserves move, local writes, failure reporting and final Wikidata ordering', async () => {
    const actions = buildPreSaveActions({
        title: 'Original',
        finalTitle: 'Final',
        form: {
            wikidataId: 'Q123',
            redirectRows: [
                { title: 'Alias', enabled: true },
                { title: 'Excluded', enabled: false },
            ],
            navboxRows: [
                {
                    enabled: true,
                    pendingEdit: {
                        title: 'Template:Series',
                        text: 'Reviewed series',
                        summary: 'Reviewed edit',
                        create: false,
                    },
                },
            ],
        },
    });
    const calls: string[] = [];
    const failed: string[] = [];
    const result = await runSelectedActions(actions, {
        api,
        title: 'Original',
        move: { enabled: true, to: 'Final', leaveRedirect: false },
        writes: {
            async movePage(_api, from, to, options) {
                calls.push(`move:${from}:${to}:${options.leaveRedirect}`);
            },
            async addTalkPageBanner(_api, title) {
                calls.push(`talk:${title}`);
            },
            async createRedirect(_api, from, to) {
                calls.push(`redirect:${from}:${to}`);
                throw new Error('Write response lost');
            },
            async savePageEdit(_api, action) {
                calls.push(`edit:${action.title}:${action.text}`);
            },
            async connectWikidataSitelink(_api, id, title) {
                calls.push(`wikidata:${id}:${title}`);
            },
        },
        onActionFailed(action) {
            failed.push(action.id);
        },
        onBeforeWikidataActions() {
            calls.push('before-wikidata');
        },
    });
    assert.deepEqual(calls, [
        'move:Original:Final:false',
        'talk:Final',
        'redirect:Alias:Final',
        'edit:Template:Series:Reviewed series',
        'before-wikidata',
        'wikidata:Q123:Final',
    ]);
    assert.equal(result.title, 'Final');
    assert.deepEqual(failed, ['redirect:Alias']);
    assert.deepEqual(
        result.failed.map((action) => action.id),
        failed,
    );
    assert.equal(result.completed.length, 3);
    assert.ok(actions.every((action) => action.selected === false));
});
