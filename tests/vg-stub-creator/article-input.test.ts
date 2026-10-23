/**
 * @file tests/vg-stub-creator/article-input.test.ts
 * Purpose: Verifies saved name conversion and canonical article input boundaries.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeArticleFormInput } from '../../src/vg-stub-creator/domain/article-input.ts';
import { createArticleData } from '../../src/vg-stub-creator/domain/processor.ts';
import { getEnteredSourceReferenceFields } from '../../src/vg-stub-creator/domain/source-fields.ts';
import { getNameRedirectTitles } from '../../src/vg-stub-creator/domain/name-roles.ts';
import { createArticleWorkflow } from '../../src/vg-stub-creator/app/workflows/article.ts';
import { getReferenceDefinition } from '../../src/vg-stub-creator/domain/wikitext/reference-data.ts';
import { createFormHistoryStore } from '../../src/vg-stub-creator/platform/browser/storage/form-history.ts';
import { createMemoryStorage } from './support/storage.ts';

test('saved name groups normalize without losing source references or reviewed rows', () => {
    const form = {
        officialNames: [
            {
                name: '官译',
                sourceUrl: 'https://example.test/official',
                nameId: 'saved',
                hans: true,
            },
        ],
        commonNames: [
            { name: '通称', sourceUrl: 'https://example.test/common' },
        ],
        sourceReferences: [
            {
                key: 'officialNames.0',
                name: 'official',
                sourceUrl: 'https://example.test/official',
            },
            {
                key: 'commonNames.0',
                name: 'common',
                sourceUrl: 'https://example.test/common',
            },
        ],
        nameRoleRows: [
            {
                sourceId: 'saved',
                role: 'redirect',
                enabled: false,
                value: '官译',
            },
        ],
        citationRows: [
            {
                sourceUrl: 'https://example.test/official',
                title: 'Reviewed title',
            },
        ],
        noteTaRows: [{ key: '1', value: 'zh-cn:审定名称;', modified: true }],
    };
    const snapshot = JSON.stringify(form);
    const normalized = normalizeArticleFormInput(form);
    assert.equal(Object.hasOwn(normalized, 'officialNames'), false);
    assert.deepEqual(
        normalized.sourceReferences.map((row) => row.key),
        ['localizedNames.0', 'localizedNames.1'],
    );
    assert.deepEqual(
        getEnteredSourceReferenceFields(form).map((row) => row.key),
        ['localizedNames.0', 'localizedNames.1'],
    );
    assert.deepEqual(getNameRedirectTitles(normalized), ['通称']);
    assert.equal(normalized.citationRows, form.citationRows);
    assert.equal(normalized.noteTaRows, form.noteTaRows);
    assert.equal(normalized.nameRoleRows, form.nameRoleRows);
    assert.equal(normalizeArticleFormInput(normalized), normalized);
    assert.equal(JSON.stringify(form), snapshot);
    assert.equal(
        createArticleData(form).records.names.values[0].normalizedText,
        '官译',
    );
});

test('mixed name formats retain extra alias evidence without changing displayed names or omissions', () => {
    const form = {
        localizedNames: [{ name: '中文名', nameId: 'current', official: true }],
        officialNames: [
            { name: '中文名' },
            {
                name: '旧译名',
                sourceUrl: 'https://example.test/old',
                note: 'saved evidence',
            },
        ],
        commonNames: [
            { name: 'Old Latin name', sourceUrl: 'https://example.test/latin' },
        ],
        nameRoleRows: [
            {
                sourceId: 'current',
                role: 'redirect',
                enabled: false,
                value: '中文名',
            },
        ],
    };
    const normalized = normalizeArticleFormInput(form);
    const data = createArticleData(form);
    assert.equal(normalized.localizedNames, form.localizedNames);
    assert.deepEqual(getNameRedirectTitles(normalized), ['旧译名']);
    assert.deepEqual(
        data.records.names.values.map((row) => row.normalizedText),
        ['中文名'],
    );
    assert.deepEqual(
        getEnteredSourceReferenceFields(normalized).map((row) => [
            row.key,
            row.sourceUrl,
        ]),
        [
            ['nameAliases.1', 'https://example.test/old'],
            ['nameAliases.2', 'https://example.test/latin'],
        ],
    );
    assert.equal(
        (data.form.nameAliases?.[1] as Record<string, unknown>).note,
        'saved evidence',
    );
});

test('article workflow normalizes names before source acquisition', async () => {
    const workflow = createArticleWorkflow(
        {
            buildCategoryRows: async () => [],
            buildFallbackCategoryRows: () => [],
            fetchSourceReferences: async (form) => {
                assert.equal(Object.hasOwn(form, 'officialNames'), false);
                assert.equal(form.localizedNames[0].name, '官译');
                return [];
            },
            resolveNavboxTitles: async () => [],
            resolveReviewedNavboxRows: async () => [],
        },
        { enterEnwikiTitle: '', noWikidataItem: '' },
    );
    const result = await workflow.buildStubFromForm(
        { officialNames: [{ name: '官译' }] },
        {},
    );
    assert.equal(
        result.articleData.records.names.values[0].normalizedText,
        '官译',
    );
});

test('temporary and named history retain legacy name evidence before filtering stored inputs', () => {
    for (const mixed of [false, true]) {
        const storage = createMemoryStorage();
        const history = createFormHistoryStore(() => storage, {
            temporaryDraft: 'Temporary draft',
            untitled: 'Untitled',
        });
        const form = {
            ...(mixed ? { localizedNames: [{ name: '当前名称' }] } : {}),
            officialNames: [
                {
                    name: '旧名称',
                    sourceUrl: 'https://example.test/old',
                    note: 'Retained evidence',
                },
            ],
        };
        const snapshot = JSON.stringify(form);
        history.saveFormDraft(form, 'Test page');
        history.saveFormHistory(form, 'Test page');
        for (const entry of [
            history.readFormDraftEntry(),
            history.readFormHistory()[0],
        ]) {
            const input = entry!.data.input;
            assert.equal(Object.hasOwn(input, 'officialNames'), false);
            assert.equal(
                input.localizedNames[0].name,
                mixed ? '当前名称' : '旧名称',
            );
            const row = mixed ? input.nameAliases[0] : input.localizedNames[0];
            assert.equal(row.note, 'Retained evidence');
            assert.equal(row.sourceUrl, 'https://example.test/old');
            assert.ok(getNameRedirectTitles(input).includes('旧名称'));
        }
        assert.equal(JSON.stringify(form), snapshot);
        assert.deepEqual(history.readFormDraftForPage('Test page'), form);
    }
});

test('ordered terminology lookup keeps aliases, regex state, first matches and unlinked entries', () => {
    const definitions = [
        { label: 'First', aliases: ['canonical', /Example/gu] },
        { label: 'Second', page: 'Linked page', aliases: ['canonical'] },
    ];
    assert.equal(
        getReferenceDefinition(definitions, '[[Target|CANONICAL]]'),
        definitions[0],
    );
    assert.equal(
        getReferenceDefinition(definitions, 'Example'),
        definitions[0],
    );
    assert.equal(
        getReferenceDefinition(definitions, 'Example'),
        definitions[0],
    );
    assert.equal(getReferenceDefinition(definitions, 'An Example'), undefined);
    assert.equal(
        getReferenceDefinition(definitions, 'linked page'),
        definitions[1],
    );
    assert.equal(getReferenceDefinition(definitions, 'First')?.page, undefined);
    assert.equal(getReferenceDefinition(definitions, ''), undefined);
});
