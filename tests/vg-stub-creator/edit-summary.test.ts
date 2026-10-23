/**
 * @file tests/vg-stub-creator/edit-summary.test.ts
 * Purpose: Keep generated edit-summary prose in English while preserving reviewed summaries and titles.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and fixtures
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEditSummary } from '../../src/vg-stub-creator/domain/edit-summary.ts';
import { buildPreSaveActions } from '../../src/vg-stub-creator/domain/pre-save-actions.ts';
import english from '../../src/vg-stub-creator/i18n/en.json' with { type: 'json' };
import japanese from '../../src/vg-stub-creator/i18n/ja.json' with { type: 'json' };
import russian from '../../src/vg-stub-creator/i18n/ru.json' with { type: 'json' };
import simplifiedChinese from '../../src/vg-stub-creator/i18n/zh-Hans.json' with { type: 'json' };
import traditionalChinese from '../../src/vg-stub-creator/i18n/zh-Hant.json' with { type: 'json' };
import {
    saveCategoryPage,
    saveCompanyCategory,
} from '../../src/vg-stub-creator/platform/mediawiki/category-pages.ts';
import { registerNewPage } from '../../src/vg-stub-creator/platform/mediawiki/new-page-list.ts';
import {
    addTalkPageBanner,
    connectWikidataSitelink,
    createRedirect,
    movePage,
    savePageEdit,
} from '../../src/vg-stub-creator/platform/mediawiki/wiki-writes.ts';
import { createTranslator } from '../../src/library/i18n/messages.ts';

const suffix = ' [[m:User:For_Each_..._Next/global.js/create_vg_stub.js|🎮]]';
const catalogs = {
    en: english,
    ja: japanese,
    ru: russian,
    'zh-Hans': simplifiedChinese,
    'zh-Hant': traditionalChinese,
};

function createApi() {
    const writes: Record<string, unknown>[] = [];
    return {
        writes,
        async get() {
            return {
                curtimestamp: '2026-10-07T12:00:00Z',
                query: {
                    pages: [
                        {
                            title: 'Reviewed page',
                            revisions: [
                                {
                                    timestamp: '2026-10-07T11:00:00Z',
                                    slots: { main: { content: '' } },
                                },
                            ],
                        },
                    ],
                },
            };
        },
        async postWithToken(_token: string, params: Record<string, unknown>) {
            writes.push(params);
            return {};
        },
    };
}

test('generated article and staged summaries stay English for every interface locale', () => {
    for (const locale of Object.keys(catalogs)) {
        const translator = createTranslator(catalogs, locale);
        const actions = buildPreSaveActions(
            {
                title: '星海',
                finalTitle: '星海 (遊戲)',
                form: {
                    categoryRows: [
                        {
                            pendingEdit: {
                                title: 'Category:星海',
                                text: 'Reviewed category',
                                create: true,
                            },
                        },
                    ],
                    stubTagRows: [
                        {
                            pendingEdit: {
                                title: 'Template:星海-stub',
                                text: 'Reviewed stub tag',
                                summary: '   ',
                            },
                        },
                    ],
                    redirectRows: [
                        {
                            title: '別名',
                            pendingEdit: {
                                title: '別名',
                                text: 'Reviewed source',
                                summary: '保留編輯者審核的摘要',
                            },
                        },
                    ],
                    navboxRows: [
                        {
                            pendingEdit: {
                                title: 'Template:星海系列',
                                text: 'Reviewed navbox',
                                create: true,
                            },
                        },
                    ],
                },
            },
            [],
            (id, values) => translator.text(id, values),
        );
        const pageEdits = actions.filter(
            (action) => action.type === 'page-edit',
        );
        assert.deepEqual(
            pageEdits.map((action) => action.summary),
            [
                'Create Category:星海',
                '保留編輯者審核的摘要',
                "create 'Template:星海系列', with link to '[[星海 (遊戲)]]'",
                'Update Template:星海-stub',
            ],
            locale,
        );
        assert.equal(
            pageEdits[0].displayLabel,
            translator.text('presave.createPage'),
        );
        assert.equal(
            buildEditSummary({ displayName: '星海', year: '2026' }),
            `create 2026 video game «星海»${suffix}`,
        );
    }
});

test('move, redirect, banner and Wikidata writes retain English summaries and original titles', async () => {
    const api = createApi();
    await movePage(api, '星海', '星海 (遊戲)', { leaveRedirect: false });
    await createRedirect(api, '別名', '星海 (遊戲)');
    await addTalkPageBanner(api, '星海 (遊戲)');
    await connectWikidataSitelink(api, 'Q123', '星海 (遊戲)');
    await savePageEdit(api, {
        title: '別名',
        text: 'Reviewed source',
        summary: '保留編輯者審核的摘要',
    });
    assert.deepEqual(
        api.writes.map((write) => write.reason ?? write.summary),
        [
            `Rename to [[星海 (遊戲)]]${suffix}`,
            `redirect "別名" to "[[星海 (遊戲)]]"${suffix}`,
            `tagging the {{[[Template:WikiProject Video games|WikiProject Video games]]}} banner${suffix}`,
            `see '[[w:zh:星海 (遊戲)]]'${suffix}`,
            `保留編輯者審核的摘要${suffix}`,
        ],
    );
});

test('company category and new-page registration writes generate English summaries', async () => {
    const api = createApi();
    await saveCategoryPage('星海遊戲', 'Reviewed source', '', api);
    await saveCompanyCategory(
        '星海遊戲',
        'Reviewed source',
        'Star Harbor games',
        {
            api,
            wikidataApi: api,
            fetchMetadata: async () => ({ pageExists: true, wikidataId: '' }),
        },
    );
    await registerNewPage(
        api,
        '星海',
        ['星海遊戲', '第二家公司遊戲'],
        new Date('2026-10-07T12:00:00Z'),
    );
    assert.deepEqual(
        api.writes.map((write) => write.summary),
        [
            `create 'Category:星海遊戲'${suffix}`,
            `see '[[:w:en:Category:Star Harbor games]]'${suffix}`,
            `connect [[Category:Star Harbor games]] and [[Category:星海遊戲]]${suffix}`,
            `tagging the {{[[Template:WikiProject Video games|WikiProject Video games]]}} banner${suffix}`,
            `register the new article "[[星海]]" as well as categories [[Category:星海遊戲]] and [[Category:第二家公司遊戲]]${suffix}`,
        ],
    );
});
