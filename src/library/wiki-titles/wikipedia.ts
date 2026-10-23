/**
 * @file src/library/wiki-titles/wikipedia.ts
 * Purpose: Share the verified English and Chinese Wikipedia namespace policy.
 *
 * Contents: Static siteinfo prefixes, immutable catalogs, and catalog-based title operations.
 */

import * as catalog from './catalog.ts';
import type { NamespaceCatalog, NamespacePrefixMap } from './catalog.ts';

export type { NamespaceCatalog } from './catalog.ts';
export {
    decodeNamespaceCatalog,
    normalizeNamespacePrefix,
    normalizeWikitextTitleKey,
} from './catalog.ts';

/** Current names, canonical names, and aliases recorded from Wikipedia siteinfo. */
export const WIKI_NAMESPACE_PREFIXES = {
    enwiki: {
        '-2': ['Media'],
        '-1': ['Special'],
        0: [''],
        1: ['Talk'],
        2: ['User'],
        3: ['User talk'],
        4: ['Wikipedia', 'Project', 'WP'],
        5: ['Wikipedia talk', 'Project talk', 'WT'],
        6: ['File', 'Image'],
        7: ['File talk', 'Image talk'],
        8: ['MediaWiki'],
        9: ['MediaWiki talk'],
        10: ['Template', 'TM'],
        11: ['Template talk'],
        12: ['Help'],
        13: ['Help talk'],
        14: ['Category'],
        15: ['Category talk'],
        100: ['Portal'],
        101: ['Portal talk'],
        118: ['Draft'],
        119: ['Draft talk'],
        126: ['MOS'],
        127: ['MOS talk'],
        710: ['TimedText'],
        711: ['TimedText talk'],
        828: ['Module'],
        829: ['Module talk'],
        1728: ['Event'],
        1729: ['Event talk'],
    },
    zhwiki: {
        '-2': [
            'Media',
            '媒体',
            '媒体文件',
            '媒体档案',
            '媒體',
            '媒體文件',
            '媒體檔案',
        ],
        '-1': ['Special', '特殊'],
        0: [''],
        1: ['Talk', '对话', '對話', '討論', '讨论'],
        2: ['User', 'U', '使用者', '用戶', '用户'],
        3: [
            'User talk',
            'UT',
            '使用者对话',
            '使用者對話',
            '使用者討論',
            '使用者讨论',
            '用戶對話',
            '用戶討論',
            '用户对话',
            '用户讨论',
        ],
        4: [
            'Wikipedia',
            'Project',
            'WP',
            '专案',
            '專案',
            '維基百科',
            '维基百科',
        ],
        5: [
            'Wikipedia talk',
            'Project talk',
            'WT',
            'Wikipedia对话',
            'Wikipedia對話',
            'Wikipedia討論',
            'Wikipedia讨论',
            '专案讨论',
            '專案討論',
            '維基百科對話',
            '維基百科討論',
            '维基百科对话',
            '维基百科讨论',
        ],
        6: [
            'File',
            'Image',
            '图像',
            '图片',
            '圖像',
            '圖片',
            '文件',
            '档案',
            '檔案',
        ],
        7: [
            'File talk',
            'Image talk',
            '图像对话',
            '图像讨论',
            '图片讨论',
            '圖像對話',
            '圖像討論',
            '圖片討論',
            '文件对话',
            '文件對話',
            '文件討論',
            '文件讨论',
            '档案对话',
            '档案讨论',
            '檔案對話',
            '檔案討論',
        ],
        8: ['MediaWiki'],
        9: ['MediaWiki talk', 'MediaWiki討論', 'MediaWiki讨论'],
        10: ['Template', 'T', '样板', '模板', '樣板'],
        11: [
            'Template talk',
            '样板对话',
            '样板讨论',
            '模板对话',
            '模板對話',
            '模板討論',
            '模板讨论',
            '樣板對話',
            '樣板討論',
        ],
        12: [
            'Help',
            'H',
            '使用說明',
            '使用说明',
            '帮助',
            '幫助',
            '說明',
            '说明',
        ],
        13: [
            'Help talk',
            '使用說明討論',
            '使用说明讨论',
            '帮助对话',
            '帮助讨论',
            '幫助對話',
            '幫助討論',
            '說明討論',
            '说明讨论',
        ],
        14: ['Category', 'CAT', '分类', '分類'],
        15: ['Category talk', '分类对话', '分类讨论', '分類對話', '分類討論'],
        100: ['Portal', 'P', '主題', '主题'],
        101: ['Portal talk', '主題對話', '主題討論', '主题对话', '主题讨论'],
        102: [
            'WikiProject',
            'PJ',
            'WPJ',
            '专题',
            '專題',
            '維基專題',
            '维基专题',
        ],
        103: [
            'WikiProject talk',
            'PJT',
            'WPJT',
            '专题对话',
            '专题讨论',
            '專題對話',
            '專題討論',
            '維基專題對話',
            '維基專題討論',
            '维基专题对话',
            '维基专题讨论',
        ],
        118: ['Draft', '草稿'],
        119: ['Draft talk', '草稿討論', '草稿讨论'],
        126: ['MOS'],
        127: ['MOS talk'],
        710: ['TimedText'],
        711: ['TimedText talk'],
        828: ['Module', '模块', '模塊', '模組', '模组'],
        829: [
            'Module talk',
            '模块对话',
            '模块讨论',
            '模塊對話',
            '模塊討論',
            '模組對話',
            '模組討論',
            '模组对话',
            '模组讨论',
        ],
        1728: ['Event'],
        1729: ['Event talk'],
        2600: ['Topic', '話題', '话题'],
    },
} as const satisfies Readonly<Record<string, NamespacePrefixMap>>;

export type NamespaceDatabaseName = keyof typeof WIKI_NAMESPACE_PREFIXES;
export type NamespaceSource = NamespaceDatabaseName | NamespaceCatalog;
const catalogs = {
    enwiki: catalog.createNamespaceCatalog(
        'enwiki',
        WIKI_NAMESPACE_PREFIXES.enwiki,
    ),
    zhwiki: catalog.createNamespaceCatalog(
        'zhwiki',
        WIKI_NAMESPACE_PREFIXES.zhwiki,
    ),
};
Object.freeze(WIKI_NAMESPACE_PREFIXES);

function resolveCatalog(source: NamespaceSource): NamespaceCatalog {
    return typeof source === 'string' ? catalogs[source] : source;
}

export function getNamespaceId(
    source: NamespaceSource,
    prefix: string,
): number | undefined {
    return catalog.getNamespaceId(resolveCatalog(source), prefix);
}

export function getNamespaceIds(
    source: NamespaceSource,
): Readonly<Record<string, number>> {
    return resolveCatalog(source).namespaceIds;
}

export function getNamespacePrefixes(
    source: NamespaceSource,
    namespaceId: number,
): readonly string[] {
    return catalog.getNamespacePrefixes(resolveCatalog(source), namespaceId);
}

export function getTitleNamespaceId(
    value: string,
    source: NamespaceSource,
): number {
    return catalog.getTitleNamespaceId(value, resolveCatalog(source));
}

export function hasNamespacePrefix(
    value: string,
    source: NamespaceSource,
    namespaceId: number,
): boolean {
    return catalog.hasNamespacePrefix(
        value,
        resolveCatalog(source),
        namespaceId,
    );
}

export function stripNamespacePrefix(
    value: string,
    source: NamespaceSource,
    namespaceId: number,
): string {
    return catalog.stripNamespacePrefix(
        value,
        resolveCatalog(source),
        namespaceId,
    );
}

export function formatNamespaceTitle(
    value: string,
    source: NamespaceSource,
    namespaceId: number,
): string {
    return catalog.formatNamespaceTitle(
        value,
        resolveCatalog(source),
        namespaceId,
    );
}
