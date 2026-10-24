/**
 * @file tests/wpvg-assessor/new-page-summary.test.ts
 * Purpose: Covers consolidated English registration summaries and retained custom text.
 * Contents: UTC dates, UTF-8 limits, namespace counts, legacy drafts, and manual summaries.
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

test('keeps full summaries through 255 UTF-8 bytes, including the script marker', () => {
    const overhead = Buffer.byteLength(`Register [[]] (Sept 6) ${source}`);
    for (const character of ['A', '遊', '𠀀', '🍄']) {
        for (const bytes of [254, 255, 256]) {
            const available = bytes - overhead;
            const width = Buffer.byteLength(character);
            const title =
                character.repeat(Math.floor(available / width)) +
                'A'.repeat(available % width);
            const full = `Register [[${title}]] (Sept 6) ${source}`;
            assert.equal(Buffer.byteLength(full), bytes);
            const expected =
                bytes <= 255 ? full : `Register 1 article ${source}`;
            assert.equal(
                buildNewPageListSummary(title, first.creationDate),
                expected,
            );
            assert.equal(
                buildNewPageListBatchSummary([{ ...first, title }]),
                expected,
            );
        }
    }
});

test('puts articles first and counts non-article types when a mixed batch is too long', () => {
    const entries = [
        `File:${'Long screenshot name '.repeat(8)}.png`,
        'Category:Games',
        'First game',
        'Image:Second screenshot.png',
        'Template:Game series',
        'Second game',
        'Module:Game data',
        '分類:電子遊戲',
        '草稿:Third game',
        'WikiProject:Games',
    ].map((title) => ({ ...first, title }));
    const summary = buildNewPageListBatchSummary(entries);
    assert.equal(
        summary,
        `Register [[First game]] (Sept 6), [[Second game]] (Sept 6), 2 files, 2 categories, 1 template, 1 module, 1 draft and 1 other page ${source}`,
    );
    assert.ok(Buffer.byteLength(summary) <= 255);
});

test('uses namespace aliases without mistaking a colon in an article title for a namespace', () => {
    const titles = [
        'file:One.png',
        'Image:Two.png',
        '文件:三.png',
        '檔案:四.png',
        '分類:一',
        '分类:二',
        'CAT:Three',
        '模板:一',
        'T:Two',
        '模組:一',
        '模块:二',
        '草稿:一',
        'Draft:Two',
        'User:One',
        'Portal:Two',
        'Game: The sequel',
    ];
    const summary = buildNewPageListBatchSummary(
        titles.map((title) => ({ ...first, title })),
    );
    assert.equal(
        summary,
        `Register [[Game: The sequel]] (Sept 6), 4 files, 3 categories, 2 templates, 2 modules, 2 drafts and 2 other pages ${source}`,
    );
    assert.ok(Buffer.byteLength(summary) <= 255);
});

test('keeps the first article links that fit and counts every remaining article', () => {
    const entries = Array.from({ length: 20 }, (_, index) => ({
        ...first,
        title: `電子遊戲${index + 1}`,
    }));
    const summary = buildNewPageListBatchSummary(entries);
    assert.equal(
        summary,
        `Register [[電子遊戲1]] (Sept 6), [[電子遊戲2]] (Sept 6), [[電子遊戲3]] (Sept 6), [[電子遊戲4]] (Sept 6), [[電子遊戲5]] (Sept 6) and 15 more articles ${source}`,
    );
    assert.ok(Buffer.byteLength(summary) <= 255);
    assert.ok(
        Buffer.byteLength(
            summary.replace(
                ' and 15 more articles',
                ', [[電子遊戲6]] (Sept 6) and 14 more articles',
            ),
        ) > 255,
    );
});

test('counts files without article links and handles a single oversized file title', () => {
    assert.equal(
        buildNewPageListBatchSummary(
            Array.from({ length: 20 }, (_, index) => ({
                ...first,
                title: `File:Game screenshot ${index + 1}.png`,
            })),
        ),
        `Register 20 files ${source}`,
    );
    assert.equal(
        buildNewPageListSummary(
            `檔案:${'遊戲'.repeat(40)}.png`,
            first.creationDate,
        ),
        `Register 1 file ${source}`,
    );
});

test('recognizes old long defaults and newly compacted defaults in stored drafts', () => {
    const title = `File:${'Long screenshot name '.repeat(15)}.png`;
    const defaults = [
        `Register [[${title}]] (Sept 6) ${source}`,
        `Register [[${title}]] (September 6) ${source}`,
        `登记[[${title}]]（9月6日）${source}`,
        `登記[[${title}]]（9月6日）${source}`,
        buildNewPageListSummary(title, first.creationDate),
    ];
    for (const summary of defaults) {
        assert.equal(
            buildNewPageListBatchSummary([
                { ...first, title, summary },
                second,
            ]),
            `Register 2 files ${source}`,
        );
    }
});

test('reserves space for custom text and preserves it even when it exceeds the budget', () => {
    const article = { ...first, title: 'First game' };
    const custom = 'Reviewed note. '.repeat(8).trim();
    const summary = buildNewPageListBatchSummary([
        first,
        article,
        { ...second, summary: custom },
    ]);
    assert.equal(
        summary,
        `Register [[First game]] (Sept 6) and 1 file ${source}; ${custom}`,
    );
    assert.ok(Buffer.byteLength(summary) <= 255);

    const oversized = 'Custom reviewed text. '.repeat(20).trim();
    assert.equal(
        buildNewPageListBatchSummary([
            article,
            first,
            { ...second, summary: oversized },
        ]),
        `Register 1 article and 1 file ${source}; ${oversized}`,
    );
    assert.equal(
        buildNewPageListBatchSummary([{ ...second, summary: oversized }]),
        oversized,
    );
});
