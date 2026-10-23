/**
 * @file tests/library/new-page-list.test.ts
 * Purpose: Tests shared new-page-list insertion without changing caller syntax rules.
 * Contents: Date lookup, descending insertion, whitespace tails, and source retention.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    findDateInsertIndex,
    findMatchingDateLine,
    findTrailingBlankLines,
    insertYearSection,
} from '../../src/library/new-page-list/sections.ts';

const STRICT_DATE = /^\* (\d{1,2})月(\d{1,2})日 - (.*)$/u;
const FLEXIBLE_DATE = /^\* (\d{1,2})月(\d{1,2})日 -\s*(.*)$/u;

test('date matching retains the caller separator grammar and first match', () => {
    const lines = [
        '*:分類：{{vgc|Category:Keep}}',
        '* 7月29日 -{{vgc|No space}}',
        '* 7月29日 - {{vgc|Space}}',
        '* 7月29日 - {{vgc|Repeated}}',
    ];
    const date = { month: 7, day: 29 };
    assert.equal(findMatchingDateLine(lines, STRICT_DATE, date), 2);
    assert.equal(findMatchingDateLine(lines, FLEXIBLE_DATE, date), 1);
    assert.equal(
        findMatchingDateLine(lines, FLEXIBLE_DATE, { month: 7, day: 28 }),
        -1,
    );
});

test('date insertion compares month then day and skips unrelated lines', () => {
    const lines = [
        '* 8月1日 - {{vgc|Later month}}',
        '* 7月29日 - {{vgc|Same date}}',
        '*:分類：{{vgc|Category:Keep}}',
        '* 7月28日 -{{vgc|No space}}',
        '* 6月30日 - {{vgc|Earlier month}}',
    ];
    const date = { month: 7, day: 29 };
    assert.equal(findDateInsertIndex(lines, STRICT_DATE, date), 4);
    assert.equal(findDateInsertIndex(lines, FLEXIBLE_DATE, date), 3);
    assert.equal(
        findDateInsertIndex(lines, FLEXIBLE_DATE, { month: 6, day: 1 }),
        -1,
    );
});

test('blank-tail insertion preserves a section first line and internal blanks', () => {
    const cases: Array<[Array<string>, number]> = [
        [[], 0],
        [[''], 1],
        [['', '', ' \r'], 1],
        [['', 'entry', '', '\t'], 2],
        [['entry', '', 'tail'], 3],
    ];
    for (const [lines, expected] of cases) {
        const original = [...lines];
        assert.equal(findTrailingBlankLines(lines), expected);
        assert.deepEqual(lines, original);
    }
});

test('year insertion preserves existing source and its line endings', () => {
    const preamble = 'Intro\r\n\r\n';
    const existing = '== 2025年 ==\r\n* 12月31日 - {{vgc|Keep}}\r\n';
    const block = '* 1月1日 - {{vgc|New}}';
    assert.equal(
        insertYearSection(preamble + existing, 2026, block),
        `${preamble}== 2026年 ==\n${block}\n\n${existing}`,
    );
    assert.equal(
        insertYearSection('Intro\r\n \t', 2026, block),
        `Intro\n\n== 2026年 ==\n${block}\n\n`,
    );
    assert.equal(
        insertYearSection('', 2026, block),
        `\n\n== 2026年 ==\n${block}\n\n`,
    );
});
