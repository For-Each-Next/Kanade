/**
 * @file tests/vg-stub-creator/name-conversion-usage.test.ts
 * Purpose: Verifies conversion summaries match emitted regional winners and retained reviewed values.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    setNameNoteTaRule,
    setNameNoteTaVariant,
    setNameRole,
} from '../../src/vg-stub-creator/domain/name-roles.ts';
import {
    getNameConversionChips,
    getNameConversionUsage,
} from '../../src/vg-stub-creator/features/creator/form/name-conversion-usage.ts';
import { syncGeneratedNameNoteTaRow } from '../../src/vg-stub-creator/features/creator/form/form-model.ts';

test('only the first emitted official name for each region has a conversion summary', () => {
    const form = {
        localizedNames: [
            { nameId: 'cn-first', name: '简体一', official: true, hans: true },
            { nameId: 'cn-second', name: '简体二', official: true, hans: true },
            { nameId: 'tw', name: '繁體', official: true, tw: true },
        ],
    };
    const snapshot = JSON.stringify(form);
    assert.deepEqual(getNameConversionUsage(form, 'cn-first'), [
        { variant: 'zh-cn', value: 'zh-cn:简体一;', modified: false },
    ]);
    assert.deepEqual(getNameConversionUsage(form, 'cn-second'), []);
    assert.deepEqual(getNameConversionUsage(form, 'tw'), [
        { variant: 'zh-tw', value: 'zh-tw:繁體;', modified: false },
    ]);
    assert.equal(JSON.stringify(form), snapshot);
});

test('regional chronology gives each chip to its actual winning source', () => {
    const form: Record<string, any> = {
        originalName: 'en:Original',
        englishName: 'English',
        localizedNames: [],
    };
    for (const sourceId of ['original', 'english']) {
        setNameRole(form, sourceId, 'noteTa', { enabled: true });
        setNameNoteTaVariant(form, sourceId, 'zh-cn', '同名');
    }
    setNameNoteTaVariant(form, 'original', 'zh-tw', '原名繁體');
    syncGeneratedNameNoteTaRow(form);
    const snapshot = JSON.stringify(form);
    assert.deepEqual(getNameConversionUsage(form, 'english'), [
        { variant: 'zh-cn', value: 'zh-cn:同名;', modified: true },
    ]);
    assert.deepEqual(getNameConversionUsage(form, 'original'), [
        { variant: 'zh-tw', value: 'zh-tw:原名繁體;', modified: true },
    ]);
    assert.equal(JSON.stringify(form), snapshot);
    setNameNoteTaVariant(form, 'original', 'zh-cn', '新简体');
    syncGeneratedNameNoteTaRow(form);
    assert.deepEqual(getNameConversionUsage(form, 'english'), []);
    assert.equal(
        getNameConversionUsage(form, 'original')[0].value,
        'zh-cn:新简体;',
    );
});

test('a structured enabled name uses its regional property default before rows are generated', () => {
    const form: Record<string, any> = {
        localizedNames: [{ nameId: 'cn', name: '简体默认', hans: true }],
    };
    setNameRole(form, 'cn', 'noteTa', { enabled: true });
    setNameNoteTaVariant(form, 'cn', 'zh-cn', '');
    const snapshot = JSON.stringify(form);
    assert.deepEqual(getNameConversionUsage(form, 'cn'), [
        { variant: 'zh-cn', value: 'zh-cn:简体默认;', modified: false },
    ]);
    assert.equal(JSON.stringify(form), snapshot);
});

test('retained reviewed combined rows supply the actual tooltip text', () => {
    const form: Record<string, any> = {
        englishName: 'English',
        localizedNames: [],
    };
    setNameRole(form, 'english', 'noteTa', { enabled: true });
    setNameNoteTaVariant(form, 'english', 'zh-cn', '简体');
    setNameNoteTaVariant(form, 'english', 'zh-tw', '繁體');
    syncGeneratedNameNoteTaRow(form);
    const combined = form.noteTaRows.find((row: any) => row.source === 'names');
    combined.value = 'zh-cn:审定; zh-tw:審定; zh-sg:保留新加坡;';
    combined.modified = true;
    const snapshot = JSON.stringify(form);
    assert.deepEqual(getNameConversionUsage(form, 'english'), [
        { variant: 'zh-cn', value: 'zh-cn:审定;', modified: true },
        { variant: 'zh-tw', value: 'zh-tw:審定;', modified: true },
    ]);
    assert.equal(JSON.stringify(form), snapshot);
});

test('reviewed changes mark only changed inherited regional values as manual', () => {
    const form: Record<string, any> = {
        localizedNames: [
            { nameId: 'cn', name: '简体', official: true, hans: true },
            { nameId: 'tw', name: '繁體', official: true, tw: true },
        ],
    };
    syncGeneratedNameNoteTaRow(form);
    const combined = form.noteTaRows.find((row: any) => row.source === 'names');
    combined.value = 'zh-cn:审定简体; zh-tw:繁體;';
    combined.modified = true;
    assert.deepEqual(getNameConversionUsage(form, 'cn'), [
        { variant: 'zh-cn', value: 'zh-cn:审定简体;', modified: true },
    ]);
    assert.deepEqual(getNameConversionUsage(form, 'tw'), [
        { variant: 'zh-tw', value: 'zh-tw:繁體;', modified: false },
    ]);
});

test('per-source reviewed rules retain their own regional aliases and unrelated clauses', () => {
    const form: Record<string, any> = {
        originalName: 'ja:原題',
        localizedNames: [],
    };
    setNameRole(form, 'original', 'noteTa', {
        enabled: true,
        value: 'zh-cn:简体; zh-tw:繁體;',
        modified: true,
    });
    syncGeneratedNameNoteTaRow(form);
    const individual = form.noteTaRows.find(
        (row: any) => row.source === 'name-role:original',
    );
    individual.value =
        'zh-hans:[[简体;名称]]; zh-hant:審定繁體; zh-hk:香港名稱;';
    individual.modified = true;
    const snapshot = JSON.stringify(form);
    assert.deepEqual(getNameConversionUsage(form, 'original'), [
        { variant: 'zh-cn', value: 'zh-cn:[[简体;名称]];', modified: true },
        { variant: 'zh-tw', value: 'zh-tw:審定繁體;', modified: true },
        { variant: 'zh-hk', value: 'zh-hk:香港名稱;', modified: true },
    ]);
    assert.equal(JSON.stringify(form), snapshot);
    setNameRole(form, 'original', 'noteTa', { enabled: false });
    assert.deepEqual(getNameConversionUsage(form, 'original'), []);
});

test('disabled, empty, and malformed drafts produce no invented conversion usage', () => {
    assert.deepEqual(getNameConversionUsage({}, 'missing'), []);
    assert.deepEqual(
        getNameConversionUsage(
            { englishName: 'English', noteTaRows: [null, 'invalid'] },
            'english',
        ),
        [],
    );
    const form: Record<string, any> = {
        englishName: 'English',
        localizedNames: [],
    };
    setNameRole(form, 'english', 'noteTa', { enabled: true });
    setNameNoteTaVariant(form, 'english', 'zh-cn', '简体');
    form.noteTaRows = [{ source: 'names', value: '' }];
    assert.deepEqual(getNameConversionUsage(form, 'english'), []);
});

test("free-form regional summaries match each source's contribution to one combined rule", () => {
    const form: Record<string, any> = {
        originalName: 'ja:原題',
        englishName: 'English',
        localizedNames: [],
    };
    setNameNoteTaRule(form, 'original', 'zh-cn:简体; zh-hk:香港;');
    setNameRole(form, 'original', 'noteTa', { enabled: true });
    setNameNoteTaRule(form, 'english', 'zh-tw:繁體;');
    setNameRole(form, 'english', 'noteTa', { enabled: true });
    syncGeneratedNameNoteTaRow(form);
    const snapshot = JSON.stringify(form);
    assert.deepEqual(getNameConversionUsage(form, 'original'), [
        { variant: 'zh-cn', value: 'zh-cn:简体;', modified: true },
        { variant: 'zh-hk', value: 'zh-hk:香港;', modified: true },
    ]);
    assert.deepEqual(getNameConversionUsage(form, 'english'), [
        { variant: 'zh-tw', value: 'zh-tw:繁體;', modified: true },
    ]);
    assert.equal(JSON.stringify(form), snapshot);

    setNameNoteTaRule(form, 'english', 'zh-tw:繁體; zh-hk:新香港;');
    syncGeneratedNameNoteTaRow(form);
    assert.deepEqual(getNameConversionUsage(form, 'original'), [
        { variant: 'zh-cn', value: 'zh-cn:简体;', modified: true },
    ]);
    assert.deepEqual(getNameConversionUsage(form, 'english'), [
        { variant: 'zh-tw', value: 'zh-tw:繁體;', modified: true },
        { variant: 'zh-hk', value: 'zh-hk:新香港;', modified: true },
    ]);

    setNameNoteTaRule(form, 'english', 'zh-tw:繁體;');
    syncGeneratedNameNoteTaRow(form);
    assert.deepEqual(getNameConversionUsage(form, 'original'), [
        { variant: 'zh-cn', value: 'zh-cn:简体;', modified: true },
        { variant: 'zh-hk', value: 'zh-hk:香港;', modified: true },
    ]);
});

test('explicit single-region rules omit inherited regions from their usage chips', () => {
    const form: Record<string, any> = {
        localizedNames: [
            {
                nameId: 'both',
                name: '默认名稱',
                official: true,
                hans: true,
                tw: true,
            },
        ],
    };
    setNameNoteTaRule(form, 'both', 'zh-hk:香港名稱');
    setNameRole(form, 'both', 'noteTa', { enabled: true });
    syncGeneratedNameNoteTaRow(form);
    assert.deepEqual(getNameConversionUsage(form, 'both'), [
        { variant: 'zh-hk', value: 'zh-hk:香港名稱;', modified: true },
    ]);
    setNameNoteTaRule(form, 'both', '');
    syncGeneratedNameNoteTaRow(form);
    assert.deepEqual(getNameConversionUsage(form, 'both'), [
        { variant: 'zh-cn', value: 'zh-cn:默认名稱;', modified: false },
        { variant: 'zh-tw', value: 'zh-tw:默认名稱;', modified: false },
    ]);
});

test('compact conversion chips show merged regions and retained manual clauses as text', () => {
    const form: Record<string, any> = {
        originalName: 'ja:原題',
        englishName: 'English',
        localizedNames: [],
        noteTaRows: [{ key: 'G1', value: 'Games' }],
    };
    setNameNoteTaRule(form, 'original', 'zh-cn:简体; zh-hk:[[香港;名稱]]');
    setNameRole(form, 'original', 'noteTa', { enabled: true });
    setNameNoteTaRule(form, 'english', 'zh-tw:<img src=x onerror=alert(1)>');
    setNameRole(form, 'english', 'noteTa', { enabled: true });
    syncGeneratedNameNoteTaRow(form);
    form.noteTaRows.push({ key: '2', value: '保留手動規則' });
    const before = JSON.stringify(form);
    assert.deepEqual(
        getNameConversionChips(form).map((chip) => chip.label),
        [
            '[cn] 简体',
            '[tw] <img src=x onerror=alert(1)>',
            '[hk] [[香港;名稱]]',
            '保留手動規則',
        ],
    );
    assert.equal(JSON.stringify(form), before);
    setNameRole(form, 'original', 'noteTa', { enabled: false });
    syncGeneratedNameNoteTaRow(form);
    assert.deepEqual(
        getNameConversionChips(form).map((chip) => chip.label),
        ['[tw] <img src=x onerror=alert(1)>', '保留手動規則'],
    );
});
