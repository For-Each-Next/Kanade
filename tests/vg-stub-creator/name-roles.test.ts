/**
 * @file tests/vg-stub-creator/name-roles.test.ts
 * Purpose: Verifies separate name roles, stable restoration, redirect choices, and reviewed NoteTA rules.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getNameNoteTaVariants,
    getNameNoteTaRuleDraft,
    getNameRedirectTitles,
    getNameRole,
    getNameSources,
    setNameRole,
    setNameNoteTaVariant,
    setNameNoteTaRule,
    syncNameRoles,
} from '../../src/vg-stub-creator/domain/name-roles.ts';
import {
    createFormValues,
    createNoteTaRow,
    createRedirectRow,
    getHistoryEntryForm,
    replaceFormValues,
    syncGeneratedNameNoteTaRow,
} from '../../src/vg-stub-creator/features/creator/form/form-model.ts';
import { createFormHistoryStore } from '../../src/vg-stub-creator/platform/browser/storage/form-history.ts';
import { createMemoryStorage } from './support/storage.ts';

test('source reads strip language prefixes and remain safe for rendering', () => {
    const form = {
        originalName: 'ja: ポケットモンスター',
        originalNameSourceUrl: 'https://example.test/original',
        englishName: 'Pokémon',
        localizedNames: [
            { name: '宝可梦', sourceUrl: 'https://example.test/name' },
            { name: '' },
        ],
    };
    const before = JSON.stringify(form);
    const sources = getNameSources(form);
    assert.equal(sources.length, 4);
    assert.deepEqual(sources.at(-2), {
        id: 'original',
        kind: 'original',
        name: 'ポケットモンスター',
        sourceUrl: 'https://example.test/original',
    });
    assert.equal(
        getNameRole(form, 'original', 'pageName').value,
        'ポケットモンスター',
    );
    assert.equal(getNameRole(form, 'original', 'sortKey').value, '');
    assert.equal(JSON.stringify(form), before);
    assert.deepEqual(getNameSources(form), sources);
    assert.equal(
        getNameSources({ originalName: 'Chronicles: New World' }).at(-2)?.name,
        'Chronicles: New World',
    );
});

test('implicit redirects retain Chinese localized-name eligibility and Japanese sorting stays an editor choice', () => {
    const form = {
        originalName: 'ja: 原題',
        englishName: 'English title',
        localizedNames: [
            { name: '中文名' },
            { name: 'Chinese-market Latin title', hans: true },
            { name: 'Other Latin title' },
            { name: '' },
        ],
    };
    assert.deepEqual(getNameRedirectTitles(form), [
        '原題',
        'English title',
        '中文名',
        'Chinese-market Latin title',
    ]);
    syncNameRoles(form);
    const source = getNameSources(form).find(
        (row) => row.name === 'Other Latin title',
    );
    assert.ok(source);
    assert.equal(getNameRole(form, source.id, 'redirect').enabled, false);
    setNameRole(form, source.id, 'redirect', { enabled: true });
    assert.equal(getNameRedirectTitles(form).at(-1), 'Other Latin title');
    assert.equal(getNameRole(form, 'original', 'sortKey').enabled, false);
    assert.equal(
        getNameRole(
            { originalName: 'de: Deutscher Titel' },
            'original',
            'sortKey',
        ).value,
        'Deutscher Titel',
    );
    setNameRole(form, 'original', 'sortKey', {
        enabled: true,
        value: 'Gendai',
    });
    assert.equal(getNameRole(form, 'original', 'sortKey').value, 'Gendai');
    assert.equal(form.originalName, 'ja: 原題');
});

test('page, display and sort roles retain independent values and singleton selections', () => {
    const form = {
        originalName: 'ja: 原題',
        englishName: 'Original Title',
        localizedNames: [{ name: '名称' }],
    };
    syncNameRoles(form);
    const sourceId = getNameSources(form)[0].id;
    setNameRole(form, sourceId, 'pageName', {
        enabled: true,
        value: '名称（游戏）',
    });
    setNameRole(form, sourceId, 'displayTitle', { enabled: true });
    setNameRole(form, 'original', 'sortKey', {
        enabled: true,
        value: 'Gendai',
    });
    assert.equal(form.localizedNames[0].name, '名称');
    assert.equal(getNameRole(form, sourceId, 'displayTitle').value, '名称');
    setNameRole(form, 'english', 'pageName', {
        enabled: true,
        value: 'Original Title (video game)',
    });
    assert.equal(getNameRole(form, sourceId, 'pageName').enabled, false);
    assert.equal(getNameRole(form, sourceId, 'pageName').value, '名称（游戏）');
    assert.equal(getNameRole(form, sourceId, 'displayTitle').enabled, true);
    assert.equal(getNameRole(form, 'english', 'pageName').enabled, true);
});

test('stable localized IDs avoid orphan roles and follow names through reordering and deletion', () => {
    const form: Record<string, any> = {
        localizedNames: [
            { name: '名称甲', nameId: 'saved-name' },
            { name: '名称乙', nameId: 'saved-name' },
            { name: '' },
        ],
        nameRoleRows: [
            {
                sourceId: 'localized:1',
                role: 'redirect',
                value: 'Deleted name',
                enabled: true,
                modified: true,
            },
        ],
    };
    syncNameRoles(form);
    const ids = getNameSources(form)
        .filter((source) => source.kind === 'localized')
        .map((source) => source.id);
    assert.equal(ids[0], 'saved-name');
    assert.equal(new Set(ids).size, 3);
    assert.ok(!ids.includes('localized:1'));
    assert.deepEqual(form.nameRoleRows, []);
    setNameRole(form, ids[1], 'redirect', {
        value: '名称乙（游戏）',
        enabled: true,
    });
    form.localizedNames.unshift(form.localizedNames.pop());
    syncNameRoles(form);
    assert.equal(getNameRole(form, ids[1], 'redirect').value, '名称乙（游戏）');
    form.localizedNames = form.localizedNames.filter(
        (row: any) => row.nameId !== ids[1],
    );
    syncNameRoles(form);
    assert.deepEqual(form.nameRoleRows, []);
});

test('default draft changes follow source names and explicit overrides and disabled choices survive', () => {
    const form: Record<string, any> = {
        originalName: 'ja: 原題',
        localizedNames: [{ name: '名称' }],
    };
    syncNameRoles(form);
    const sourceId = form.localizedNames[0].nameId;
    setNameRole(form, sourceId, 'pageName', { enabled: true });
    setNameRole(form, sourceId, 'redirect', { enabled: false });
    setNameRole(form, 'original', 'pageName', {
        value: '原題（ゲーム）',
        enabled: false,
    });
    form.localizedNames[0].name = '新名称';
    form.originalName = 'ja: 新原題';
    syncNameRoles(form);
    assert.equal(getNameRole(form, sourceId, 'pageName').value, '新名称');
    assert.equal(getNameRole(form, sourceId, 'redirect').value, '新名称');
    assert.equal(getNameRole(form, sourceId, 'redirect').enabled, false);
    assert.equal(
        getNameRole(form, 'original', 'pageName').value,
        '原題（ゲーム）',
    );
    setNameRole(form, 'original', 'pageName', { value: '', modified: false });
    syncNameRoles(form);
    assert.equal(getNameRole(form, 'original', 'pageName').value, '新原題');
    const rows = form.nameRoleRows;
    const rowObjects = [...rows];
    const snapshot = JSON.stringify(form);
    for (let index = 0; index < 3; index += 1) {
        syncNameRoles(form);
        getNameSources(form);
        getNameRole(form, 'original', 'pageName');
    }
    assert.equal(form.nameRoleRows, rows);
    rowObjects.forEach((row, index) => assert.equal(rows[index], row));
    assert.equal(JSON.stringify(form), snapshot);
});

test('redirect projections preserve explicit omissions, suffix lists and legacy aliases', () => {
    const form: Record<string, any> = {
        originalName: 'ja: 原題',
        englishName: 'Something, Inc.',
        localizedNames: [{ name: '中文名', nameId: 'localized:1' }],
        officialNames: [
            { name: '中文名' },
            { name: '旧译名' },
            { name: 'Old Latin name' },
        ],
        commonNames: [{ name: '旧译名' }, { name: 'Alias in China', cn: true }],
    };
    setNameRole(form, 'localized:1', 'redirect', { enabled: false });
    setNameRole(form, 'original', 'redirect', {
        enabled: true,
        value: '原題（ゲーム）; Another_Title\nANOTHER TITLE',
    });
    assert.deepEqual(getNameRedirectTitles(form), [
        '原題（ゲーム）',
        'Another Title',
        'Something, Inc.',
        '旧译名',
        'Alias in China',
    ]);
    assert.equal(form.originalName, 'ja: 原題');
    assert.equal(form.localizedNames[0].name, '中文名');
});

test('form restoration keeps role drafts and IDs and migrates older localized-name groups', () => {
    const original: Record<string, any> = {
        originalName: 'ja: 原題',
        localizedNames: [{ name: '名称', nameId: 'restored-source' }],
    };
    const role = setNameRole(original, 'restored-source', 'pageName', {
        enabled: true,
        value: '名称（游戏）',
    });
    const restored = createFormValues();
    replaceFormValues(restored, JSON.parse(JSON.stringify(original)));
    assert.equal(restored.localizedNames[0].nameId, 'restored-source');
    assert.equal(
        getNameRole(restored, 'restored-source', 'pageName').id,
        role.id,
    );
    assert.equal(
        getNameRole(restored, 'restored-source', 'pageName').value,
        '名称（游戏）',
    );
    assert.equal(restored.localizedNames.at(-1).name, '');
    assert.ok(restored.localizedNames.at(-1).nameId);
    replaceFormValues(restored, {
        officialNames: [{ name: '官译', hans: true }],
        commonNames: [{ name: '通称' }],
    });
    assert.deepEqual(
        restored.localizedNames.map((row: any) => [row.name, row.official]),
        [
            ['官译', true],
            ['通称', false],
            ['', false],
        ],
    );
    assert.equal(Object.hasOwn(restored, 'officialNames'), false);
    assert.deepEqual(getNameRedirectTitles(restored), ['官译', '通称']);
});

test('explicit NoteTA choices replace only their legacy contribution and preserve reviewed rules', () => {
    const form: Record<string, any> = {
        localizedNames: [
            { name: '简体名称', official: true, hans: true },
            { name: '繁體名稱', official: true, tw: true },
        ],
        noteTaRows: [{ key: 'G1', value: 'Games' }],
    };
    syncGeneratedNameNoteTaRow(form);
    const legacy = form.noteTaRows.find((row: any) => row.source === 'names');
    assert.equal(legacy?.value, 'zh-cn:简体名称; zh-tw:繁體名稱;');
    const sourceId = form.localizedNames[0].nameId;
    setNameRole(form, sourceId, 'noteTa', {
        enabled: true,
        value: 'zh-cn:简体名称; zh-tw:名稱;',
    });
    syncGeneratedNameNoteTaRow(form);
    assert.equal(
        form.noteTaRows.some((row: any) => row.source === 'names'),
        false,
    );
    const reviewed = form.noteTaRows.find(
        (row: any) => row.source === `name-role:${sourceId}`,
    );
    assert.ok(reviewed);
    reviewed.value = 'zh-cn:编辑简体; zh-tw:編輯繁體;';
    reviewed.modified = true;
    syncGeneratedNameNoteTaRow(form);
    assert.equal(reviewed.value, 'zh-cn:编辑简体; zh-tw:編輯繁體;');
    form.localizedNames[0].name = '新名称';
    syncGeneratedNameNoteTaRow(form);
    assert.equal(reviewed.value, 'zh-cn:编辑简体; zh-tw:編輯繁體;');
    setNameRole(form, sourceId, 'noteTa', {
        value: 'zh-cn:新规则; zh-tw:新規則;',
        modified: true,
    });
    syncGeneratedNameNoteTaRow(form);
    assert.equal(reviewed.value, 'zh-cn:新规则; zh-tw:新規則;');
    assert.equal(reviewed.modified, undefined);
    setNameRole(form, sourceId, 'noteTa', { enabled: false });
    syncGeneratedNameNoteTaRow(form);
    assert.equal(
        form.noteTaRows.some((row: any) =>
            row.source?.startsWith('name-role:'),
        ),
        false,
    );
    assert.equal(
        form.noteTaRows.some((row: any) => row.source === 'names'),
        false,
    );
});

test('explicit NoteTA rules keep reviewed values through source changes and regeneration is idempotent', () => {
    const form: Record<string, any> = {
        localizedNames: [
            { name: '名称', official: true, hans: true, hant: true },
        ],
        noteTaRows: [
            { key: 'G1', value: 'Games' },
            { key: '3', value: 'Manual rule' },
        ],
    };
    syncNameRoles(form);
    const sourceId = form.localizedNames[0].nameId;
    assert.equal(getNameRole(form, sourceId, 'noteTa').enabled, true);
    assert.equal(
        getNameRole(form, sourceId, 'noteTa').value,
        'zh-cn:名称; zh-tw:名称;',
    );
    setNameRole(form, sourceId, 'noteTa', {
        enabled: true,
        value: 'zh-cn:名称; zh-tw:名称;',
        modified: true,
    });
    syncGeneratedNameNoteTaRow(form);
    const reviewed = form.noteTaRows.find(
        (row: any) => row.source === `name-role:${sourceId}`,
    );
    reviewed.modified = true;
    reviewed.value = 'Reviewed conversion';
    form.localizedNames[0].name = '新名称';
    syncGeneratedNameNoteTaRow(form);
    assert.equal(reviewed.value, 'Reviewed conversion');
    assert.equal(reviewed.generatedValue, 'zh-cn:名称; zh-tw:名称;');
    syncGeneratedNameNoteTaRow(form);
    assert.equal(
        form.noteTaRows.find((row: any) => row.source === reviewed.source)
            .value,
        'Reviewed conversion',
    );
    assert.ok(form.noteTaRows.some((row: any) => row.value === 'Manual rule'));
    const rowArray = form.noteTaRows;
    const snapshot = JSON.stringify(form);
    syncGeneratedNameNoteTaRow(form);
    syncGeneratedNameNoteTaRow(form);
    assert.equal(form.noteTaRows, rowArray);
    assert.equal(JSON.stringify(form), snapshot);
    form.localizedNames = [];
    syncGeneratedNameNoteTaRow(form);
    assert.deepEqual(form.nameRoleRows, []);
    assert.equal(
        form.noteTaRows.some((row: any) =>
            row.source?.startsWith('name-role:'),
        ),
        false,
    );
});

test('blank enabled NoteTA choices keep the combined official conversion and explicit deselection removes their contribution', () => {
    const form: Record<string, any> = {
        localizedNames: [
            { name: '简体名称', official: true, hans: true },
            { name: '繁體名稱', official: true, tw: true },
        ],
        noteTaRows: [],
    };
    syncGeneratedNameNoteTaRow(form);
    const sourceId = form.localizedNames[0].nameId;
    const draft = getNameRole(form, sourceId, 'noteTa');
    assert.equal(draft.enabled, true);
    assert.equal(draft.value, '');
    setNameRole(form, sourceId, 'noteTa', { enabled: true });
    syncGeneratedNameNoteTaRow(form);
    assert.equal(
        form.noteTaRows.find((row: any) => row.source === 'names')?.value,
        'zh-cn:简体名称; zh-tw:繁體名稱;',
    );
    assert.equal(
        form.noteTaRows.some((row: any) =>
            row.source?.startsWith('name-role:'),
        ),
        false,
    );
    setNameRole(form, sourceId, 'noteTa', { enabled: false });
    syncGeneratedNameNoteTaRow(form);
    assert.equal(
        form.noteTaRows.some((row: any) => row.source === 'names'),
        false,
    );
});

test('NoteTA defaults reflect a removed combined rule while explicit manual rules remain selected', () => {
    const form: Record<string, any> = {
        localizedNames: [
            { name: '简体名称', official: true, hans: true },
            { name: '繁體名稱', official: true, tw: true },
        ],
        noteTaRows: [],
    };
    syncGeneratedNameNoteTaRow(form);
    const sourceId = form.localizedNames[0].nameId;
    assert.equal(getNameRole(form, sourceId, 'noteTa').enabled, true);
    form.noteTaNamesRemoved = true;
    syncGeneratedNameNoteTaRow(form);
    assert.equal(getNameRole(form, sourceId, 'noteTa').enabled, false);
    assert.equal(
        form.noteTaRows.some((row: any) => row.source === 'names'),
        false,
    );
    setNameRole(form, sourceId, 'noteTa', {
        enabled: true,
        value: 'zh-cn:手动名称; zh-tw:手動名稱;',
        modified: true,
    });
    syncGeneratedNameNoteTaRow(form);
    assert.equal(getNameRole(form, sourceId, 'noteTa').enabled, true);
    assert.equal(
        form.noteTaRows.find(
            (row: any) => row.source === `name-role:${sourceId}`,
        )?.value,
        'zh-cn:手动名称; zh-tw:手動名稱;',
    );
});

test('history and temporary drafts persist role IDs, disabled choices and overrides', () => {
    const storage = createMemoryStorage();
    const history = createFormHistoryStore(() => storage, {
        temporaryDraft: 'Temporary draft',
        untitled: 'Untitled',
    });
    const form = createFormValues();
    form.localizedNames[0].name = '名称';
    const sourceId = form.localizedNames[0].nameId;
    setNameRole(form, sourceId, 'redirect', {
        enabled: false,
        value: '名称（游戏）',
    });
    setNameRole(form, 'original', 'sortKey', {
        enabled: true,
        value: 'Gendai',
    });
    history.saveFormDraft(form, '名称');
    history.saveFormHistory(form, '名称');
    const saved = history.readFormHistory()[0];
    assert.deepEqual(saved.data.input.nameRoleRows, form.nameRoleRows);
    const restored = createFormValues();
    replaceFormValues(restored, getHistoryEntryForm(saved));
    assert.equal(restored.localizedNames[0].nameId, sourceId);
    assert.equal(getNameRole(restored, sourceId, 'redirect').enabled, false);
    assert.equal(
        getNameRole(restored, sourceId, 'redirect').value,
        '名称（游戏）',
    );
    form.nameRoleRows[0].value = 'Changed after saving';
    assert.equal(
        history.readFormDraftForPage('名称')?.nameRoleRows[0].value,
        '名称（游戏）',
    );
});

test('regional NoteTA edits merge into one rule and latest changes replace only their own variant', () => {
    const form: Record<string, any> = {
        originalName: 'ja: 原題',
        englishName: 'English Title',
        localizedNames: [],
        noteTaRows: [
            { key: 'G1', value: 'Games' },
            { key: '3', value: 'Manual conversion', nameSourceId: 'english' },
        ],
    };
    setNameRole(form, 'original', 'noteTa', { enabled: true });
    setNameNoteTaVariant(form, 'original', 'zh-cn', '名称甲');
    setNameNoteTaVariant(form, 'original', 'zh-tw', '名稱甲');
    setNameRole(form, 'english', 'noteTa', { enabled: true });
    setNameNoteTaVariant(form, 'english', 'zh-tw', '名稱乙');
    syncGeneratedNameNoteTaRow(form);
    const combined = form.noteTaRows.find((row: any) => row.source === 'names');
    assert.equal(combined.value, 'zh-cn:名称甲; zh-tw:名稱乙;');
    assert.equal(
        form.noteTaRows.filter((row: any) => row.source === 'names').length,
        1,
    );
    assert.equal(
        form.noteTaRows.some((row: any) =>
            row.source?.startsWith('name-role:'),
        ),
        false,
    );
    assert.equal(
        getNameNoteTaVariants(form, 'original')['zh-cn'].value,
        '名称甲',
    );
    assert.equal(
        getNameNoteTaVariants(form, 'original')['zh-tw'].value,
        '名稱甲',
    );
    setNameNoteTaVariant(form, 'original', 'zh-tw', '名稱甲新');
    syncGeneratedNameNoteTaRow(form);
    assert.equal(combined.value, 'zh-cn:名称甲; zh-tw:名稱甲新;');
    assert.ok(form.noteTaRows.some((row: any) => row.value === 'Games'));
    assert.ok(
        form.noteTaRows.some((row: any) => row.value === 'Manual conversion'),
    );
    assert.equal(form.originalName, 'ja: 原題');
    assert.equal(form.englishName, 'English Title');
});

test('regional defaults and cleared overrides stay independent from the other region', () => {
    const form: Record<string, any> = {
        localizedNames: [
            {
                name: '名称',
                nameId: 'both',
                hans: true,
                hant: true,
                official: true,
            },
            { name: '香港名', nameId: 'hong-kong', hk: true },
        ],
        noteTaRows: [],
    };
    const defaults = getNameNoteTaVariants(form, 'both');
    assert.deepEqual(defaults, {
        'zh-cn': { value: '', defaultValue: '名称', effectiveValue: '名称' },
        'zh-tw': { value: '', defaultValue: '名称', effectiveValue: '名称' },
    });
    assert.equal(
        getNameNoteTaVariants(form, 'hong-kong')['zh-tw'].defaultValue,
        '香港名',
    );
    setNameNoteTaVariant(form, 'both', 'zh-cn', '简体覆盖');
    setNameNoteTaVariant(form, 'both', 'zh-tw', '繁體覆寫');
    syncGeneratedNameNoteTaRow(form);
    setNameNoteTaVariant(form, 'both', 'zh-tw', '');
    syncGeneratedNameNoteTaRow(form);
    const variants = getNameNoteTaVariants(form, 'both');
    assert.equal(variants['zh-cn'].value, '简体覆盖');
    assert.equal(variants['zh-tw'].value, '');
    assert.equal(variants['zh-tw'].effectiveValue, '名称');
    assert.equal(form.noteTaRows[0].value, 'zh-cn:简体覆盖; zh-tw:名称;');
    form.localizedNames[0].name = '新名称';
    syncGeneratedNameNoteTaRow(form);
    assert.equal(form.noteTaRows[0].value, 'zh-cn:简体覆盖; zh-tw:新名称;');
    assert.equal(form.localizedNames[0].name, '新名称');
});

test('first activation records both inherited regional fields and a newer Traditional default replaces only TW', () => {
    const form: Record<string, any> = {
        originalName: 'ja: 原題',
        localizedNames: [
            {
                name: '共同名称',
                nameId: 'both',
                hans: true,
                hant: true,
                official: true,
            },
            { name: '新繁體', nameId: 'traditional', tw: true },
        ],
        noteTaRows: [],
    };
    setNameRole(form, 'both', 'noteTa', { enabled: true });
    setNameNoteTaVariant(form, 'both', 'zh-cn', '');
    setNameNoteTaVariant(form, 'both', 'zh-tw', '');
    const inherited = getNameRole(form, 'both', 'noteTa').noteTaVariants;
    assert.ok(inherited?.['zh-cn']);
    assert.ok(inherited?.['zh-tw']);
    assert.ok(inherited['zh-tw'].order > inherited['zh-cn'].order);
    setNameRole(form, 'original', 'noteTa', { enabled: true });
    setNameNoteTaVariant(form, 'original', 'zh-cn', '已有简体');
    setNameNoteTaVariant(form, 'original', 'zh-tw', '已有繁體');
    setNameRole(form, 'traditional', 'noteTa', { enabled: true });
    setNameNoteTaVariant(form, 'traditional', 'zh-cn', '');
    setNameNoteTaVariant(form, 'traditional', 'zh-tw', '');
    syncGeneratedNameNoteTaRow(form);
    assert.equal(
        form.noteTaRows.find((row: any) => row.source === 'names').value,
        'zh-cn:已有简体; zh-tw:新繁體;',
    );
    const unchanged = getNameRole(form, 'traditional', 'noteTa').noteTaVariants;
    setNameNoteTaVariant(form, 'traditional', 'zh-tw', '');
    assert.equal(
        getNameRole(form, 'traditional', 'noteTa').noteTaVariants,
        unchanged,
    );
});

test('regional edit order and map identities survive restoration, reordering and repeated synchronization', () => {
    const form: Record<string, any> = {
        originalName: 'ja: 原題',
        englishName: 'English Title',
        localizedNames: [],
        noteTaRows: [],
    };
    setNameRole(form, 'original', 'noteTa', { enabled: true });
    setNameNoteTaVariant(form, 'original', 'zh-cn', '简体');
    setNameNoteTaVariant(form, 'original', 'zh-tw', '最初繁體');
    setNameRole(form, 'english', 'noteTa', { enabled: true });
    setNameNoteTaVariant(form, 'english', 'zh-tw', '較新繁體');
    syncGeneratedNameNoteTaRow(form);
    const restored = createFormValues();
    replaceFormValues(restored, JSON.parse(JSON.stringify(form)));
    restored.nameRoleRows.reverse();
    syncGeneratedNameNoteTaRow(restored);
    assert.equal(
        restored.noteTaRows.find((row: any) => row.source === 'names').value,
        'zh-cn:简体; zh-tw:較新繁體;',
    );
    setNameNoteTaVariant(restored, 'original', 'zh-tw', '最新繁體');
    syncGeneratedNameNoteTaRow(restored);
    assert.equal(
        restored.noteTaRows.find((row: any) => row.source === 'names').value,
        'zh-cn:简体; zh-tw:最新繁體;',
    );
    const maps = restored.nameRoleRows.map((row: any) => row.noteTaVariants);
    const snapshot = JSON.stringify(restored);
    for (let index = 0; index < 3; index += 1) {
        syncNameRoles(restored);
        syncGeneratedNameNoteTaRow(restored);
        getNameNoteTaVariants(restored, 'original');
    }
    assert.equal(JSON.stringify(restored), snapshot);
    restored.nameRoleRows.forEach((row: any, index: number) => {
        assert.equal(row.noteTaVariants, maps[index]);
    });
});

test('legacy regional maps use stable row order until a field is edited and malformed maps preserve full rules', () => {
    const form: Record<string, any> = {
        originalName: 'ja: 原題',
        englishName: 'English Title',
        localizedNames: [],
        noteTaRows: [],
        nameRoleRows: [
            {
                sourceId: 'original',
                role: 'noteTa',
                enabled: true,
                modified: true,
                value: 'zh-cn:简体; zh-tw:較早繁體;',
                noteTaVariants: {
                    'zh-cn': { value: '简体' },
                    'zh-tw': { value: '較早繁體' },
                },
            },
            {
                sourceId: 'english',
                role: 'noteTa',
                enabled: true,
                modified: true,
                value: 'zh-tw:較晚繁體;',
                noteTaVariants: { 'zh-tw': { value: '較晚繁體', order: NaN } },
            },
        ],
    };
    syncGeneratedNameNoteTaRow(form);
    assert.equal(form.noteTaRows[0].value, 'zh-cn:简体; zh-tw:較晚繁體;');
    setNameNoteTaVariant(form, 'original', 'zh-tw', '最新繁體');
    syncGeneratedNameNoteTaRow(form);
    assert.equal(form.noteTaRows[0].value, 'zh-cn:简体; zh-tw:最新繁體;');
    form.nameRoleRows[0].noteTaVariants = 'Malformed saved state';
    syncNameRoles(form);
    assert.equal(form.nameRoleRows[0].noteTaVariants, undefined);
    assert.equal(
        getNameNoteTaVariants(form, 'original')['zh-cn'].value,
        '简体',
    );
    assert.equal(
        getNameNoteTaVariants(form, 'original')['zh-tw'].value,
        '最新繁體',
    );
});

test('temporary draft and history restoration retain regional chronology for subsequent edits', () => {
    const storage = createMemoryStorage();
    const history = createFormHistoryStore(() => storage, {
        temporaryDraft: 'Temporary draft',
        untitled: 'Untitled',
    });
    const form = createFormValues();
    form.originalName = 'ja: 原題';
    form.englishName = 'English Title';
    setNameRole(form, 'original', 'noteTa', { enabled: true });
    setNameNoteTaVariant(form, 'original', 'zh-cn', '简体');
    setNameNoteTaVariant(form, 'original', 'zh-tw', '較早繁體');
    setNameRole(form, 'english', 'noteTa', { enabled: true });
    setNameNoteTaVariant(form, 'english', 'zh-tw', '較晚繁體');
    syncGeneratedNameNoteTaRow(form);
    history.saveFormDraft(form, '名称');
    history.saveFormHistory(form, '名称');
    const restored = createFormValues();
    replaceFormValues(
        restored,
        getHistoryEntryForm(history.readFormHistory()[0]),
    );
    assert.deepEqual(
        history.readFormDraftForPage('名称')?.nameRoleRows,
        form.nameRoleRows,
    );
    setNameNoteTaVariant(restored, 'original', 'zh-tw', '最新繁體');
    syncGeneratedNameNoteTaRow(restored);
    assert.equal(
        restored.noteTaRows.find((row: any) => row.source === 'names').value,
        'zh-cn:简体; zh-tw:最新繁體;',
    );
});

test('structured editing imports regional aliases and keeps unknown clauses from reviewed full rules', () => {
    const form: Record<string, any> = {
        originalName: 'ja: 原題',
        localizedNames: [],
        noteTaRows: [{ key: 'G1', value: 'Games' }],
    };
    setNameRole(form, 'original', 'noteTa', {
        enabled: true,
        value: 'zh-hans:简体; zh-hant:繁體; zh-hk:香港; zh-sg:新加坡;',
    });
    syncGeneratedNameNoteTaRow(form);
    assert.equal(
        getNameNoteTaVariants(form, 'original')['zh-cn'].value,
        '简体',
    );
    assert.equal(
        getNameNoteTaVariants(form, 'original')['zh-tw'].value,
        '繁體',
    );
    setNameNoteTaVariant(form, 'original', 'zh-tw', '修改繁體');
    syncGeneratedNameNoteTaRow(form);
    const combined = form.noteTaRows.find((row: any) => row.source === 'names');
    assert.equal(
        combined.value,
        'zh-cn:简体; zh-tw:修改繁體; zh-hk:香港; zh-sg:新加坡;',
    );
    assert.equal(
        form.noteTaRows.some((row: any) => row.source === 'name-role:original'),
        false,
    );
    const role = getNameRole(form, 'original', 'noteTa');
    const map = role.noteTaVariants;
    setNameRole(form, 'original', 'noteTa', {
        value: role.value,
        modified: true,
    });
    syncNameRoles(form);
    assert.equal(getNameRole(form, 'original', 'noteTa').noteTaVariants, map);
});

test('regional editing preserves unrelated clauses and the unchanged region from reviewed legacy rules', () => {
    const form: Record<string, any> = {
        originalName: 'ja: 原題',
        localizedNames: [],
        noteTaRows: [],
    };
    setNameRole(form, 'original', 'noteTa', {
        enabled: true,
        value: 'zh-cn:默认简体; zh-tw:預設繁體;',
    });
    syncGeneratedNameNoteTaRow(form);
    const reviewed = form.noteTaRows.find(
        (row: any) => row.source === 'name-role:original',
    );
    reviewed.modified = true;
    reviewed.value = 'zh-cn:已审核简体; zh-tw:已審核繁體; zh-sg:保留新加坡;';
    assert.equal(
        getNameNoteTaVariants(form, 'original')['zh-cn'].value,
        '已审核简体',
    );
    setNameNoteTaVariant(form, 'original', 'zh-tw', '新繁體');
    syncGeneratedNameNoteTaRow(form);
    assert.equal(
        form.noteTaRows.find((row: any) => row.source === 'names').value,
        'zh-cn:已审核简体; zh-tw:新繁體; zh-sg:保留新加坡;',
    );
});

test('combined regional rules preserve unchanged reviewed edits and refresh only when a managed field changes', () => {
    const form: Record<string, any> = {
        englishName: 'English Title',
        localizedNames: [],
        noteTaRows: [
            { key: 'G1', value: 'Custom group', nameSourceId: 'english' },
            { key: 'G2', value: 'Other group' },
            { key: '3', value: 'Manual conversion', nameSourceId: 'english' },
        ],
    };
    setNameRole(form, 'english', 'noteTa', { enabled: true });
    setNameNoteTaVariant(form, 'english', 'zh-cn', '简体');
    setNameNoteTaVariant(form, 'english', 'zh-tw', '繁體');
    syncGeneratedNameNoteTaRow(form);
    const combined = form.noteTaRows.find((row: any) => row.source === 'names');
    combined.modified = true;
    combined.value = 'zh-cn:已审核; zh-tw:已審核;';
    form.englishName = 'Updated original spelling';
    syncGeneratedNameNoteTaRow(form);
    assert.equal(combined.value, 'zh-cn:已审核; zh-tw:已審核;');
    syncGeneratedNameNoteTaRow(form);
    assert.equal(
        form.noteTaRows.find((row: any) => row.source === 'names').value,
        'zh-cn:已审核; zh-tw:已審核;',
    );
    assert.ok(
        form.noteTaRows.some(
            (row: any) => row.key === 'G1' && row.value === 'Custom group',
        ),
    );
    assert.ok(
        form.noteTaRows.some(
            (row: any) => row.key === 'G2' && row.value === 'Other group',
        ),
    );
    assert.ok(
        form.noteTaRows.some((row: any) => row.value === 'Manual conversion'),
    );
    assert.equal(
        form.noteTaRows.filter((row: any) => row.key === 'G1').length,
        1,
    );
});

test('review row factories preserve card ownership without changing their reviewed content', () => {
    const redirect = createRedirectRow({
        title: 'Manual alias',
        nameSourceId: 'english',
        enabled: false,
        manualAdded: true,
        pendingEdit: { text: '#REDIRECT [[名称]]', summary: 'Reviewed' },
    });
    assert.equal(redirect.nameSourceId, 'english');
    assert.equal(redirect.enabled, false);
    assert.equal(redirect.pendingEdit.text, '#REDIRECT [[名称]]');
    const noteTa = createNoteTaRow({
        key: 'G1',
        value: 'Custom group',
        nameSourceId: 'english',
        modified: true,
    });
    assert.deepEqual(noteTa, {
        key: 'G1',
        value: 'Custom group',
        nameSourceId: 'english',
        modified: true,
    });
});

test('free-form rules from separate names merge into one rule and retain raw drafts', () => {
    const form: Record<string, any> = {
        originalName: 'ja: 原題',
        englishName: 'English title',
        localizedNames: [],
        noteTaRows: [],
    };
    setNameRole(form, 'original', 'noteTa', { enabled: true });
    setNameRole(form, 'english', 'noteTa', { enabled: true });
    setNameNoteTaRule(form, 'original', 'zh-cn:名称, 第三章:新旅程');
    setNameNoteTaRule(
        form,
        'english',
        'zh-tw:繁體; zh-hk:香港; zh-sg:新加坡; zh-mo:澳門; zh-my:馬來西亞; zh:通用',
    );
    syncGeneratedNameNoteTaRow(form);
    const rows = form.noteTaRows.filter((row: any) => row.source === 'names');
    assert.equal(rows.length, 1);
    assert.equal(
        rows[0].value,
        'zh-cn:名称, 第三章:新旅程; zh-tw:繁體; zh-hk:香港; zh-sg:新加坡; zh-mo:澳門; zh-my:馬來西亞; zh:通用;',
    );
    assert.equal(
        form.noteTaRows.some((row: any) =>
            row.source?.startsWith('name-role:'),
        ),
        false,
    );
    assert.equal(
        getNameNoteTaRuleDraft(form, 'original').value,
        'zh-cn:名称, 第三章:新旅程',
    );
    const snapshot = JSON.stringify(form);
    syncGeneratedNameNoteTaRow(form);
    assert.equal(JSON.stringify(form), snapshot);
});

test('free-form edits keep chronology per region and remove deleted generated clauses', () => {
    const form: Record<string, any> = {
        originalName: 'ja: 原題',
        englishName: 'English',
        localizedNames: [],
        noteTaRows: [],
    };
    for (const source of ['original', 'english'])
        setNameRole(form, source, 'noteTa', { enabled: true });
    setNameNoteTaRule(form, 'original', 'zh-cn:简体一; zh-hk:香港一');
    setNameNoteTaRule(form, 'english', 'zh-cn:简体二; zh-tw:繁體');
    const originalOrder = getNameRole(form, 'original', 'noteTa')
        .noteTaVariants?.['zh-cn']?.order;
    setNameNoteTaRule(form, 'original', 'zh-cn:简体一; zh-hk:香港二');
    syncGeneratedNameNoteTaRow(form);
    assert.equal(
        form.noteTaRows[0].value,
        'zh-cn:简体二; zh-tw:繁體; zh-hk:香港二;',
    );
    assert.equal(
        getNameRole(form, 'original', 'noteTa').noteTaVariants?.['zh-cn']
            ?.order,
        originalOrder,
    );
    const combined = form.noteTaRows[0];
    combined.modified = true;
    combined.value = 'zh-cn:审定; zh-tw:審定; zh-hk:香港审定;';
    setNameNoteTaRule(form, 'original', 'zh-cn:简体三');
    syncGeneratedNameNoteTaRow(form);
    assert.equal(combined.value, 'zh-cn:简体三; zh-tw:繁體;');
    assert.equal(
        getNameRole(form, 'original', 'noteTa').noteTaVariants?.['zh-hk'],
        undefined,
    );
});

test('nonempty rules omit inherited regions and clearing the field restores source defaults', () => {
    const form: Record<string, any> = {
        localizedNames: [
            {
                nameId: 'both',
                name: '名稱',
                hans: true,
                tw: true,
                official: true,
            },
        ],
        noteTaRows: [],
    };
    setNameRole(form, 'both', 'noteTa', { enabled: true });
    setNameNoteTaRule(form, 'both', 'zh-cn:仅简体');
    syncGeneratedNameNoteTaRow(form);
    assert.equal(form.noteTaRows[0].value, 'zh-cn:仅简体;');
    setNameNoteTaRule(form, 'both', '');
    syncGeneratedNameNoteTaRow(form);
    assert.deepEqual(getNameNoteTaRuleDraft(form, 'both'), {
        value: '',
        defaultValue: 'zh-cn:名稱; zh-tw:名稱;',
        effectiveValue: 'zh-cn:名稱; zh-tw:名稱;',
    });
    assert.equal(form.noteTaRows[0].value, 'zh-cn:名稱; zh-tw:名稱;');
    form.localizedNames[0].name = '新名稱';
    syncGeneratedNameNoteTaRow(form);
    assert.equal(form.noteTaRows[0].value, 'zh-cn:新名稱; zh-tw:新名稱;');
    const single: Record<string, any> = {
        localizedNames: [{ nameId: 'cn', name: '简体默认', hans: true }],
        noteTaRows: [],
    };
    setNameRole(single, 'cn', 'noteTa', { enabled: true });
    setNameNoteTaRule(single, 'cn', '');
    syncGeneratedNameNoteTaRow(single);
    assert.equal(single.noteTaRows[0].value, 'zh-cn:简体默认;');
});

test('free-form drafts preserve aliases, wikilink punctuation, extra clauses and stored chronology', () => {
    const storage = createMemoryStorage();
    const history = createFormHistoryStore(() => storage, {
        temporaryDraft: 'Temporary',
        untitled: 'Untitled',
    });
    const form = createFormValues();
    form.originalName = 'ja: 原題';
    setNameRole(form, 'original', 'noteTa', { enabled: true });
    const raw = 'zh-hans:[[简体;名稱]]; zh-hant:繁體; custom:保留,內容';
    setNameNoteTaRule(form, 'original', raw);
    syncGeneratedNameNoteTaRow(form);
    assert.equal(
        form.noteTaRows.find((row: any) => row.source === 'names').value,
        'zh-cn:[[简体;名稱]]; zh-tw:繁體; custom:保留,內容;',
    );
    history.saveFormDraft(form, '名称');
    history.saveFormHistory(form, '名称');
    const restored = createFormValues();
    replaceFormValues(
        restored,
        getHistoryEntryForm(history.readFormHistory()[0]),
    );
    assert.equal(getNameNoteTaRuleDraft(restored, 'original').value, raw);
    assert.deepEqual(
        history.readFormDraftForPage('名称')?.nameRoleRows,
        form.nameRoleRows,
    );
    assert.deepEqual(restored.nameRoleRows, form.nameRoleRows);
    const order = getNameRole(restored, 'original', 'noteTa').noteTaVariants?.[
        'zh-cn'
    ]?.order;
    setNameNoteTaRule(restored, 'original', `${raw}; zh-hk:香港`);
    assert.equal(
        getNameRole(restored, 'original', 'noteTa').noteTaVariants?.['zh-cn']
            ?.order,
        order,
    );
    setNameNoteTaRule(restored, 'original', 'custom:單獨規則');
    syncGeneratedNameNoteTaRow(restored);
    assert.equal(
        restored.noteTaRows.find((row: any) => row.source === 'names').value,
        'custom:單獨規則;',
    );
    assert.deepEqual(
        getNameRole(restored, 'original', 'noteTa').noteTaVariants,
        {},
    );
});
