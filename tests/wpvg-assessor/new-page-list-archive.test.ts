/**
 * @file tests/wpvg-assessor/new-page-list-archive.test.ts
 * Purpose: Verifies whole-month archival, exact source preservation, and recovery.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    mergeNewPageListArchive,
    prepareNewPageListArchive,
} from '../../src/wpvg-assessor/domain/new-page-list-archive.ts';

const OCTOBER = new Date('2026-10-04T18:00:00Z');
const ARCHIVE_PREFIX = 'WikiProject:电子游戏/新进条目/';

test('archives all of August and earlier while preserving the full recent source', () => {
    const lead = '{{Sidebar|custom=keep}}\nIntro with {{Vgc|Example}}.\n\n';
    const recent =
        [
            '== 2026年 ==',
            '* 10月3日 - {{vgc|Recent}}{{Dykico |custom=keep}}',
            '*:檔案：{{vgc|File:Recent.png}}',
            '* 9月1日 - {{vgc|September}}',
        ].join('\n') + '\n';
    const august =
        [
            '* 8月31日 - {{vgc|August end}}{{Dykico}}',
            '*:模板：{{vgc|Template:August}}',
            '* 8月1日 - 無新條目',
        ].join('\n') + '\n';
    const july = '* 7月12日 - {{vgc|July}}\n';
    const footer =
        '\n== 參見 ==\n{{Footer|custom=preserve}}\n[[Category:Keep| ]]\n';
    const plan = prepareNewPageListArchive(
        lead + recent + august + july + footer,
        OCTOBER,
    );

    assert.equal(plan.cutoff, '2026-08-31');
    assert.equal(plan.sourceText, lead + recent + footer);
    assert.equal(plan.recordCount, 3);
    assert.deepEqual(plan.groups, [
        {
            title: `${ARCHIVE_PREFIX}2026年存档`,
            year: 2026,
            months: [8, 7],
            recordCount: 3,
            text: '== 2026年 ==\n\n=== 8月 ===\n\n* 8月31日 - [[:August end]]{{Dykico}}\n*:模板：[[:Template:August]]\n* 8月1日 - 無新條目\n\n=== 7月 ===\n\n* 7月12日 - [[:July]]\n',
        },
    ]);
});

test('uses a whole-month UTC cutoff across year, leap, and timezone boundaries', () => {
    const cases = [
        ['2026-10-01T00:00:00Z', '2026-08-31'],
        ['2026-10-31T23:59:59Z', '2026-08-31'],
        ['2026-01-01T00:00:00Z', '2025-11-30'],
        ['2024-04-01T00:00:00Z', '2024-02-29'],
        ['2026-04-30T23:00:00Z', '2026-02-28'],
        ['2026-10-01T00:30:00+02:00', '2026-07-31'],
    ];
    for (const [now, expected] of cases) {
        const plan = prepareNewPageListArchive(
            'Preserved empty list\n',
            new Date(now),
        );
        assert.equal(plan.cutoff, expected, now);
        assert.equal(plan.sourceText, 'Preserved empty list\n');
        assert.deepEqual(plan.groups, []);
        assert.equal(plan.recordCount, 0);
    }
    assert.throws(
        () => prepareNewPageListArchive('', new Date('invalid')),
        /invalid/u,
    );
});

test('removes an emptied year heading without losing unrelated text or newer years', () => {
    const lead = 'Lead\n\n';
    const oldYear = '== 2025年 ==\n';
    const note = '<!-- Keep this year note. -->\n';
    const old = '* 12月31日 - {{vgc|Old year}}\n';
    const recent =
        '\n== 2026年 ==\n* 1月1日 - {{vgc|New year}}\n\n== Footer ==\nBody\n';
    const plan = prepareNewPageListArchive(
        lead + oldYear + note + old + recent,
        new Date('2026-02-01T00:00:00Z'),
    );

    assert.equal(plan.cutoff, '2025-12-31');
    assert.equal(plan.sourceText, lead + note + recent);
    assert.equal(plan.groups[0].title, `${ARCHIVE_PREFIX}2025年存档`);
    assert.equal(
        plan.groups[0].text,
        '== 2025年 ==\n\n=== 12月 ===\n\n* 12月31日 - [[:Old year]]\n',
    );
});

test('preserves CRLF, namespace subgroups, DYK calls, and colon links', () => {
    const recent = 'Lead\r\n==2026年==\r\n* 9月30日 - {{vgc|Keep}}\r\n';
    const old =
        [
            '* 8月31日 - {{ VGC | Main page }}{{Dykico | custom = keep }}',
            '*:草稿：{{Template:Vgc|Draft:Example}}',
            '*:分類：{{ t : vgc | :Category:Example }}',
            '*:模板：{{Vgc|1=Template:A=B}}',
            '*:檔案：{{vgc|File:Game cover.png}}',
            '*:雜頁：{{vgc|Wikipedia:Example}}',
        ].join('\r\n') + '\r\n';
    const footer = '\r\n{{Footer}}\r\n';
    const plan = prepareNewPageListArchive(recent + old + footer, OCTOBER);

    assert.equal(plan.sourceText, recent + footer);
    assert.equal(
        plan.groups[0].text,
        '== 2026年 ==\n\n=== 8月 ===\n\n' +
            [
                '* 8月31日 - [[:Main page]]{{Dykico | custom = keep }}',
                '*:草稿：[[:Draft:Example]]',
                '*:分類：[[:Category:Example]]',
                '*:模板：[[:Template:A=B]]',
                '*:檔案：[[:File:Game cover.png]]',
                '*:雜頁：[[:Wikipedia:Example]]',
            ].join('\r\n') +
            '\r\n',
    );
});

test('ignores structural examples in templates and opaque regions and preserves their content', () => {
    const lead =
        [
            '<!--',
            '== 1900年 ==',
            '* 1月1日 - {{Vgc|Comment example}}',
            '-->',
            '<nowiki>',
            '== 1901年 ==',
            '* 1月1日 - {{Vgc|Literal example}}',
            '</nowiki>',
            '{{Example|1=',
            '== 1902年 ==',
            '* 1月1日 - {{Vgc|Template example}}',
            '}}',
        ].join('\n') + '\n';
    const active =
        '* 8月1日 - {{vgc|Actual}}<!-- {{Vgc|Comment}} --><nowiki>{{Vgc|Literal}}</nowiki>{{Other|custom=Keep}}{{Dykico}}\n';
    const plan = prepareNewPageListArchive(
        lead + '== 2026年 ==\n' + active,
        OCTOBER,
    );

    assert.equal(plan.sourceText, lead);
    assert.equal(plan.recordCount, 1);
    assert.equal(
        plan.groups[0].text,
        '== 2026年 ==\n\n=== 8月 ===\n\n' +
            active.replace('{{vgc|Actual}}', '[[:Actual]]'),
    );
});

test('converts active nested Vgc calls while retaining their surrounding syntax', () => {
    const source =
        '== 2026年 ==\n* 8月1日 - {{Other|custom={{Vgc|Nested}}|keep=yes}}\n';
    const plan = prepareNewPageListArchive(source, OCTOBER);
    assert.equal(
        plan.groups[0].text,
        '== 2026年 ==\n\n=== 8月 ===\n\n* 8月1日 - {{Other|custom=[[:Nested]]|keep=yes}}\n',
    );
});

test('rejects unsupported Vgc arguments instead of corrupting archived links', () => {
    const invalid = [
        '{{Vgc}}',
        '{{Vgc|}}',
        '{{Vgc|Title|Display}}',
        '{{Vgc|2=Title}}',
        '{{Vgc|Title=Value}}',
        '{{Vgc|{{Nested}}}}',
        '{{Vgc|[[Title]]}}',
        '{{Vgc|Title<nowiki>|</nowiki>}}',
        '{{Vgc|#section}}',
    ];
    for (const call of invalid) {
        assert.throws(
            () =>
                prepareNewPageListArchive(
                    `== 2026年 ==\n* 8月1日 - ${call}\n`,
                    OCTOBER,
                ),
            /unsupported Vgc/u,
            call,
        );
    }
});

test('rejects malformed dates, detached groups, duplicate records, and unclosed constructs', () => {
    const invalid = [
        '== 2026年 ==\n* 2月29日 - {{vgc|Bad}}\n',
        '== 2026年 ==\n* 13月1日 - {{vgc|Bad}}\n',
        '== 2026年 ==\n* 8月0日 - {{vgc|Bad}}\n',
        '== 2026年 ==\n* 8月x日 - {{vgc|Bad}}\n',
        '* 8月1日 - {{vgc|Missing year}}\n',
        '== 2026年 ==\n*:模板：{{vgc|Detached}}\n',
        '== 2026年 ==\n* 8月1日 - {{vgc|A}}\n*:Malformed subgroup\n',
        '== 2026年 ==\n* 8月1日 - {{vgc|A}}\n* 8月1日 - {{vgc|B}}\n',
        '== 2026年 ==\n* 8月1日 - {{vgc|Unclosed}\n',
        '== 2026年 ==\n* 8月1日 - <!-- Unclosed\n',
        '== 2026年 ==\n* 8月1日 - <nowiki>Unclosed\n',
    ];
    for (const source of invalid) {
        assert.throws(
            () => prepareNewPageListArchive(source, OCTOBER),
            /new-page|dated/u,
            source,
        );
    }
});

test('accepts a leap day and groups descending months into one destination per year', () => {
    const source =
        '== 2024年 ==\n* 3月1日 - {{vgc|March}}\n* 2月29日 - {{vgc|Leap day}}\n== 2023年 ==\n* 12月31日 - 無新條目\n';
    const plan = prepareNewPageListArchive(
        source,
        new Date('2024-05-01T00:00:00Z'),
    );
    assert.equal(plan.sourceText, '');
    assert.deepEqual(
        plan.groups.map((group) => [
            group.year,
            group.months,
            group.recordCount,
        ]),
        [
            [2024, [3, 2], 2],
            [2023, [12], 1],
        ],
    );
});

test('merges missing archive records before the footer and skips exact partial recovery duplicates', () => {
    const group = prepareNewPageListArchive(
        '== 2026年 ==\n* 8月31日 - {{vgc|Earlier save}}\n* 8月1日 - {{vgc|Still pending}}\n',
        OCTOBER,
    ).groups[0];
    const lead = '{{Archive heading}}\n\n== 2026年 ==\n\n=== 8月 ===\n\n';
    const saved = '* 8月31日 - [[:Earlier save]]\n';
    const footer = '\n== Footer ==\n{{Keep}}\n[[Category:Archives]]\n';
    const existing = lead + saved + footer;
    const merged = mergeNewPageListArchive(existing, group);

    assert.equal(
        merged,
        lead + saved + '* 8月1日 - [[:Still pending]]\n' + footer,
    );
    assert.equal(mergeNewPageListArchive(merged, group), merged);
});

test('rejects an existing same-date record with different content or subgroup entries', () => {
    const group = prepareNewPageListArchive(
        '== 2026年 ==\n* 8月1日 - {{vgc|Source}}\n*:模板：{{vgc|Template:Source}}\n',
        OCTOBER,
    ).groups[0];
    const existing =
        '== 2026年 ==\n\n=== 8月 ===\n\n* 8月1日 - [[:Source]]\n*:模板：[[:Template:Other]]\n';
    assert.throws(
        () => mergeNewPageListArchive(existing, group),
        /different record for 2026-08-01/u,
    );
});

test('recovers archives with CRLF and records lacking a final line ending', () => {
    const group = prepareNewPageListArchive(
        '== 2026年 ==\r\n* 8月2日 - {{vgc|Saved}}\r\n* 8月1日 - {{vgc|Pending}}',
        OCTOBER,
    ).groups[0];
    const existing =
        'Header\r\n== 2026年 ==\r\n\r\n=== 8月 ===\r\n\r\n* 8月2日 - [[:Saved]]\r\n\r\n{{Footer}}\r\n';
    const merged = mergeNewPageListArchive(existing, group);
    assert.equal(
        merged,
        'Header\r\n== 2026年 ==\r\n\r\n=== 8月 ===\r\n\r\n* 8月2日 - [[:Saved]]\r\n* 8月1日 - [[:Pending]]\r\n\r\n{{Footer}}\r\n',
    );
    assert.equal(mergeNewPageListArchive(merged, group), merged);
    const empty = mergeNewPageListArchive('', group);
    assert.equal(empty, group.text);
    assert.equal(mergeNewPageListArchive(empty, group), empty);
});

test('inserts new month sections between existing months while preserving all old text', () => {
    const group = prepareNewPageListArchive(
        '== 2026年 ==\n* 9月30日 - {{vgc|September}}\n* 7月31日 - {{vgc|July}}\n',
        new Date('2026-11-01T00:00:00Z'),
    ).groups[0];
    const lead = '{{Archive header|keep=yes}}\n\n== 2026年 ==\n\n';
    const august =
        '=== 8月 ===\n\n* 8月31日 - [[Old August]]{{Dykico|keep=yes}}\n*:分類：{{c|Old category}}\n<!-- August note stays with August. -->\n\n';
    const june = '=== 6月 ===\n\n* 6月30日 - [[Old June]]\n\n';
    const footer = '== 參見 ==\n{{Footer|keep=yes}}\n[[Category:Archives| ]]\n';
    const merged = mergeNewPageListArchive(
        lead + august + june + footer,
        group,
    );
    assert.equal(
        merged,
        lead +
            '=== 9月 ===\n\n* 9月30日 - [[:September]]\n\n' +
            august +
            '=== 7月 ===\n\n* 7月31日 - [[:July]]\n\n' +
            june +
            footer,
    );
    assert.equal(mergeNewPageListArchive(merged, group), merged);
});

test('inserts missing days at descending positions within the existing month', () => {
    const group = prepareNewPageListArchive(
        '== 2026年 ==\n* 8月30日 - {{vgc|Thirty}}\n* 8月1日 - {{vgc|First}}\n* 8月31日 - {{vgc|Latest}}\n',
        OCTOBER,
    ).groups[0];
    const lead = '== 2026年 ==\n\n=== 8月 ===\n\n';
    const existing =
        lead +
        '* 8月29日 - [[Preserved older]]\n* 8月2日 - [[Preserved second]]\n\n=== 7月 ===\n\n* 7月31日 - [[Old July]]';
    const merged = mergeNewPageListArchive(existing, group);
    assert.equal(
        merged,
        lead +
            '* 8月31日 - [[:Latest]]\n* 8月30日 - [[:Thirty]]\n* 8月29日 - [[Preserved older]]\n* 8月2日 - [[Preserved second]]\n* 8月1日 - [[:First]]\n\n=== 7月 ===\n\n* 7月31日 - [[Old July]]',
    );
    assert.equal(mergeNewPageListArchive(merged, group), merged);
});

test('adding a lower month keeps the previous month notes before the new section and retains the footer', () => {
    const group = prepareNewPageListArchive(
        '== 2026年 ==\n* 7月31日 - {{vgc|July}}\n',
        OCTOBER,
    ).groups[0];
    const prefix =
        '== 2026年 ==\n\n=== 8月 ===\n\n* 8月31日 - [[August]]\n<!-- August note. -->\nAugust prose.\n\n';
    const footer = '== Footer ==\n{{Keep}}\n[[Category:Keep]]\n';
    const merged = mergeNewPageListArchive(prefix + footer, group);
    assert.equal(
        merged,
        prefix + '=== 7月 ===\n\n* 7月31日 - [[:July]]\n\n' + footer,
    );
    assert.equal(mergeNewPageListArchive(merged, group), merged);
});

test('historical duplicate dates in other months and old link formats remain byte exact', () => {
    const group = prepareNewPageListArchive(
        '== 2026年 ==\n* 9月30日 - {{vgc|September}}\n',
        new Date('2026-11-01T00:00:00Z'),
    ).groups[0];
    const header = '== 2026年 ==\n\n';
    const existingMonths =
        '=== 8月 ===\n\n* 8月31日 - [[August]]\n\n=== 2月 ===\n\n* 2月23日 - [[Historical A]]\n* 2月23日 - [[Historical B]]\n*:分類：{{c|Historic category}}\n\n=== 1月 ===\n\n* 1月1日 - [[Old first day]]';
    const merged = mergeNewPageListArchive(header + existingMonths, group);
    assert.equal(
        merged,
        header +
            '=== 9月 ===\n\n* 9月30日 - [[:September]]\n\n' +
            existingMonths,
    );
    assert.equal(mergeNewPageListArchive(merged, group), merged);
});

test('incoming dates check every historical duplicate and retain matching duplicates', () => {
    const group = prepareNewPageListArchive(
        '== 2026年 ==\n* 8月1日 - {{vgc|Saved}}\n',
        OCTOBER,
    ).groups[0];
    const prefix = '== 2026年 ==\n\n=== 8月 ===\n\n';
    const saved = '* 8月1日 - [[:Saved]]\n';
    const matching = prefix + saved + saved;
    assert.equal(mergeNewPageListArchive(matching, group), matching);
    assert.throws(
        () =>
            mergeNewPageListArchive(
                prefix + saved + '* 8月1日 - [[:Different]]\n',
                group,
            ),
        /different record for 2026-08-01/u,
    );
    assert.throws(
        () =>
            mergeNewPageListArchive(
                prefix + '* 8月1日 - [[:Different]]\n' + saved,
                group,
            ),
        /different record for 2026-08-01/u,
    );
});

test('rejects malformed annual year and month structure without rewriting it', () => {
    const group = prepareNewPageListArchive(
        '== 2026年 ==\n* 8月1日 - {{vgc|New}}\n',
        OCTOBER,
    ).groups[0];
    for (const existing of [
        '== 2025年 ==\n\n=== 8月 ===\n\n* 8月1日 - [[Other year]]\n',
        '== 2026年 ==\n== 2026年 ==\n',
        '== 2026年 ==\n=== 8月 ===\n=== 8月 ===\n',
        '== 2026年 ==\n=== 13月 ===\n',
        '== 2026年 ==\n=== 7月 ===\n* 8月1日 - [[Wrong month]]\n',
        '=== 8月 ===\n* 8月1日 - [[No annual heading]]\n',
        '== 2026年 ==\n* 8月1日 - [[No monthly heading]]\n',
    ]) {
        assert.throws(
            () => mergeNewPageListArchive(existing, group),
            /annual|month|year/u,
            existing,
        );
    }
});

test('removes emptied source month headings together with their year while preserving recent sections', () => {
    const lead = 'Intro\n';
    const recent = '== 2026年 ==\n=== 9月 ===\n* 9月30日 - {{vgc|Keep}}\n';
    const eligible =
        '=== 8月 ===\n* 8月31日 - {{vgc|Move}}\n== 2025年 ==\n=== 12月 ===\n* 12月31日 - {{vgc|Old year}}\n';
    const footer = '== Footer ==\n{{Keep}}\n';
    const plan = prepareNewPageListArchive(
        lead + recent + eligible + footer,
        OCTOBER,
    );
    assert.equal(plan.sourceText, lead + recent + footer);
    assert.deepEqual(
        plan.groups.map((group) => [group.year, group.months]),
        [
            [2026, [8]],
            [2025, [12]],
        ],
    );
});

test('new annual pages contain one year heading and descending month sections', () => {
    const group = prepareNewPageListArchive(
        '== 2026年 ==\n* 7月1日 - {{vgc|July}}\n* 8月31日 - {{vgc|August}}\n',
        OCTOBER,
    ).groups[0];
    assert.equal(
        mergeNewPageListArchive('', group),
        '== 2026年 ==\n\n=== 8月 ===\n\n* 8月31日 - [[:August]]\n\n=== 7月 ===\n\n* 7月1日 - [[:July]]\n',
    );
    assert.equal(mergeNewPageListArchive(group.text, group), group.text);
});

test('inserts into an empty archive before preserved footer categories', () => {
    const group = prepareNewPageListArchive(
        '== 2026年 ==\n* 8月1日 - {{vgc|New}}\n',
        OCTOBER,
    ).groups[0];
    assert.equal(
        mergeNewPageListArchive(
            '{{Archive heading}}\n\n[[Category:Archives]]\n',
            group,
        ),
        '{{Archive heading}}\n\n== 2026年 ==\n\n=== 8月 ===\n\n* 8月1日 - [[:New]]\n\n[[Category:Archives]]\n',
    );
});

test('rejects invalid annual titles, years, month lists, counts, and unreviewed prose', () => {
    const group = prepareNewPageListArchive(
        '== 2026年 ==\n* 8月1日 - {{vgc|New}}\n',
        OCTOBER,
    ).groups[0];
    assert.throws(
        () => mergeNewPageListArchive('Unchanged', { ...group, months: [7] }),
        /invalid records/u,
    );
    assert.throws(
        () =>
            mergeNewPageListArchive('Unchanged', {
                ...group,
                title: `${ARCHIVE_PREFIX}存档/2026年8月`,
            }),
        /invalid records/u,
    );
    assert.throws(
        () => mergeNewPageListArchive('Unchanged', { ...group, year: 2025 }),
        /invalid records/u,
    );
    assert.throws(
        () =>
            mergeNewPageListArchive('Unchanged', { ...group, recordCount: 2 }),
        /invalid records/u,
    );
    assert.throws(
        () =>
            mergeNewPageListArchive('Unchanged', {
                ...group,
                text: group.text + 'Unreviewed prose\n',
            }),
        /invalid records/u,
    );
});
