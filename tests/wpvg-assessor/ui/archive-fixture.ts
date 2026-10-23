/**
 * @file tests/wpvg-assessor/ui/archive-fixture.ts
 * Purpose: Synthetic whole-month records shared by offline archiver tests and images.
 *
 * Table of contents:
 * 1. Constants and state
 */

export const archiveSourceTitle = 'WikiProject:电子游戏/新进条目';
export const annualArchiveTitle = `${archiveSourceTitle}/2026年存档`;
export const olderAnnualArchiveTitle = `${archiveSourceTitle}/2025年存档`;
export const archiveAnnualText = [
    '{{Archive header|custom=keep}}',
    '',
    '== 2026年 ==',
    '=== 6月 ===',
    '* 6月30日 - [[:六月已存档游戏]]{{Dykico}}',
    '',
    '== 參見 ==',
    '[[WikiProject:电子游戏/新进条目]]',
    '',
].join('\n');
export const archiveListText = [
    '本页仅保留近两个月的记录，时间请使用UTC时间。',
    '',
    '== 2026年 ==',
    '* 10月3日 - {{Vgc|十月示例游戏}}',
    '* 9月1日 - {{vgc|九月示例游戏}}',
    '* 8月31日 - {{Vgc|八月示例游戏}}{{Dykico}}',
    '*: 分類：{{vgc|Category:示例游戏分类}}',
    '*: 檔案：{{vgc|File:Example game cover.png}}',
    '* 8月1日 - 無新條目',
    '* 7月31日 - {{Vgc|七月示例游戏}}',
    '',
    '== 參見 ==',
    '[[WikiProject:电子游戏]]',
    '',
].join('\n');

export const archiveCrossYearListText = archiveListText.replace(
    '== 參見 ==',
    '== 2025年 ==\n* 12月31日 - {{Vgc|往年示例游戏}}\n\n== 參見 ==',
);
