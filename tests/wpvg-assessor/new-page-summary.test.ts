/**
 * @file tests/wpvg-assessor/new-page-summary.test.ts
 * Purpose: Covers consolidated English registration summaries and retained custom text.
 * Contents: UTC dates, batch punctuation, legacy drafts, and manual summaries.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildNewPageListBatchSummary,
    buildNewPageListSummary,
} from '../../src/wpvg-assessor/domain/new-page-summary.ts';

const source = '[[:m:User:For Each ... Next/global.js/vg page assessor.js|🍄]]';
const first = {
    title: 'File:戰場雙馬尾.JPG',
    creationDate: new Date('2026-09-06T00:30:00Z'),
};
const second = {
    title: 'File:戰雙帕彌什.JPG',
    creationDate: new Date('2026-09-06T23:30:00Z'),
};
const third = {
    title: 'File:星布谷地 0.webp',
    creationDate: new Date('2026-09-07T00:30:00Z'),
};

test('uses an English month and the UTC creation day for a single page', () => {
    assert.equal(
        buildNewPageListSummary(first.title, first.creationDate),
        `Register [[File:戰場雙馬尾.JPG]] (Sept 6) ${source}`,
    );
    assert.equal(
        buildNewPageListBatchSummary([first]),
        buildNewPageListSummary(first.title, first.creationDate),
    );
    assert.equal(buildNewPageListBatchSummary([]), '');
});

test('joins two pages with and and three pages with one registration verb and source', () => {
    assert.equal(
        buildNewPageListBatchSummary([first, second]),
        `Register [[File:戰場雙馬尾.JPG]] (Sept 6) and [[File:戰雙帕彌什.JPG]] (Sept 6) ${source}`,
    );
    assert.equal(
        buildNewPageListBatchSummary([first, second, third]),
        `Register [[File:戰場雙馬尾.JPG]] (Sept 6), [[File:戰雙帕彌什.JPG]] (Sept 6) and [[File:星布谷地 0.webp]] (Sept 7) ${source}`,
    );
});

test('consolidates stored English and Chinese defaults from previous versions', () => {
    assert.equal(
        buildNewPageListBatchSummary([
            { ...first, summary: `登记[[${first.title}]]（9月6日）${source}` },
            {
                ...second,
                summary: `登記[[${second.title}]]（9月6日）${source}`,
            },
            {
                ...third,
                summary: `Register [[${third.title}]] (September 7) ${source}`,
            },
        ]),
        buildNewPageListBatchSummary([first, second, third]),
    );
});

test('retains custom reviewed summaries and consolidates the remaining defaults', () => {
    assert.equal(
        buildNewPageListBatchSummary([
            first,
            { ...second, summary: 'My reviewed registration note' },
            third,
        ]),
        `${buildNewPageListBatchSummary([first, third])}; My reviewed registration note`,
    );
    assert.equal(
        buildNewPageListBatchSummary([
            { ...first, summary: 'Keep this custom note' },
            { ...second, summary: 'Keep this custom note' },
        ]),
        'Keep this custom note',
    );
});
