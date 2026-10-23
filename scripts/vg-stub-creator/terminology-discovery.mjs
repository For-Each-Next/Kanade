/**
 * @file scripts/vg-stub-creator/terminology-discovery.mjs
 * Purpose: Discover additional terminology definitions from verified Wikipedia metadata.
 *
 * Table of contents:
 * 1. Constants and state
 * 2. titleKey
 * 3. recognitionNames
 * 4. isArticle
 * 5. getIdentity
 * 6. getLanguageLink
 * 7. getCategories
 * 8. hasTypedCategories
 * 9. isMetaArticle
 * 10. isExcludedPlatformArticle
 * 11. getCandidateArticles
 * 12. matchesPattern
 * 13. reserveExistingDefinitions
 * 14. discoverTerminologyDefinitions
 * 15. discoverGenreDefinitions
 */

const META_TITLES = {
    genres: new Set([
        '電子遊戲類型',
        '电子游戏类型',
        'video game genre',
        'video game genres',
    ]),
    companies: new Set([
        '電子遊戲公司',
        '电子游戏公司',
        '電子遊戲開發商',
        '电子游戏开发商',
        '電子遊戲開發公司',
        '电子游戏开发公司',
        '電子遊戲發行商',
        '电子游戏发行商',
        '電子遊戲發行公司',
        '电子游戏发行公司',
        'video game company',
        'video game companies',
        'video game developer',
        'video game development company',
        'video game publisher',
        'video game publishing company',
    ]),
    platforms: new Set([
        '電子遊戲機',
        '电子游戏机',
        '遊戲機',
        '游戏机',
        '遊戲主機',
        '游戏主机',
        '家用遊戲機',
        '家用游戏机',
        '掌上遊戲機',
        '掌上游戏机',
        '家用電腦',
        '家用电脑',
        '街機主板',
        '街机主板',
        'video game console',
        'game console',
        'home video game console',
        'handheld game console',
        'home computer',
        'microcomputer',
        'arcade system',
        'cloud gaming',
    ]),
};
const ENGLISH_CATEGORIES = {
    genres: /video game genres|video game terminology|gameplay|interactive fiction|games by genre/iu,
    companies:
        /video game (?:companies|developers|publishers|development companies|publishing companies)/iu,
    platforms:
        /video game (?:consoles|hardware|platforms|services|digital distribution)|gaming (?:consoles|hardware|platforms|computers)|(?:home|handheld) game consoles|home computers|microcomputers|arcade (?:systems|hardware)|cloud gaming|online gaming services/iu,
};
const CHINESE_CATEGORIES = {
    companies:
        /[電电]子[遊游][戲戏](?:公司|[開开][發发](?:商|公司)|[發发]行(?:商|公司))$|(?:手机|手機)[遊游][戲戏]公司$|(?:[網网]路|[網网][絡络])[遊游][戲戏][營营][運运]商$/u,
    platforms:
        /(?:[電电]子)?[遊游][戲戏](?:主[機机]|[機机]|平台|硬[體体]|服[務务])$|家用[電电][腦脑]$|街[機机](?:系[統统]|硬[體体]|主[機机]?板)$|(?:雲端|雲|云)[遊游][戲戏](?:服[務务]|平台)?$/u,
};
const PEOPLE_CATEGORIES =
    /(?:^|:)living people$|\b\d+ (?:births|deaths)$|video game (?:designers|programmers|artists|composers)|在世人物|年(?:出生|逝世)|[遊游][戲戏](?:設計師|设计师|程式設計師|程序员)/iu;
const TYPE_SUFFIXES = [
    /[類类][電电]子[遊游][戲戏]$/u,
    /[電电]子[遊游][戲戏]$/u,
    /[類类][遊游][戲戏]$/u,
    /[遊游][戲戏]$/u,
    /\s+video games?$/iu,
    /\s+games?$/iu,
];

function titleKey(value) {
    return value.replaceAll('_', ' ').trim().toLowerCase();
}

/** Include field shorthand without changing the stored canonical page titles. */
function recognitionNames(value, type) {
    if (typeof value !== 'string' || !value.trim()) return [];
    const name = value.replaceAll('_', ' ').trim();
    const names = [name];
    if (type !== 'genres') return names;
    for (const suffix of TYPE_SUFFIXES) {
        if (suffix.test(name)) {
            const short = name.replace(suffix, '').trim();
            if (short) names.push(short);
            break;
        }
    }
    return names;
}

function isArticle(record) {
    return (
        record?.exists === true &&
        record.ns === 0 &&
        typeof record.title === 'string' &&
        Boolean(record.title.trim()) &&
        !record.fragment &&
        record.pageprops?.disambiguation === undefined
    );
}

function getIdentity(record) {
    const value = record?.pageprops?.wikibase_item;
    return typeof value === 'string' && /^Q[1-9]\d*$/u.test(value)
        ? value
        : undefined;
}

function getLanguageLink(record, language) {
    return Array.isArray(record?.langlinks)
        ? record.langlinks.find((link) => link?.lang === language)
        : undefined;
}

function getCategories(record) {
    return Array.isArray(record?.categories)
        ? record.categories.filter(
              (category) =>
                  typeof category?.title === 'string' &&
                  /^(?:Category|分類|分类):/iu.test(category.title) &&
                  (category.ns === undefined || category.ns === 14),
          )
        : [];
}

function hasTypedCategories(record, type, language) {
    const pattern =
        language === 'en' ? ENGLISH_CATEGORIES[type] : CHINESE_CATEGORIES[type];
    if (!pattern) return false;
    const categories = getCategories(record);
    if (
        type === 'companies' &&
        categories.some((category) => PEOPLE_CATEGORIES.test(category.title))
    )
        return false;
    return categories.some((category) => pattern.test(category.title));
}

function isMetaArticle(record, type) {
    return (
        META_TITLES[type].has(titleKey(record.title)) ||
        /^(?:lists? of)\s/iu.test(record.title) ||
        /(?:列表|名單|名单)$/u.test(record.title)
    );
}

/** Hardware membership also contains historical topics, games, and accessories. */
function isExcludedPlatformArticle(record, language, includeCategories = true) {
    if (
        /generation of (?:video )?game consoles$/iu.test(record.title) ||
        /series$/iu.test(record.title) ||
        /(?:禁令|政策|歷史|历史|爭議|争议|家族|家系|系列)$/u.test(
            record.title,
        ) ||
        /^第[一二三四五六七八九十百零〇\d]+世代(?:[電电]子)?[遊游][戲戏][機机]$/u.test(
            record.title,
        )
    )
        return true;
    if (!includeCategories) return false;
    const excluded =
        language === 'en'
            ? /^Category:(?:\d{4} video games$|arcade video games$|.*video games developed by\b|video game console (?:add-ons|peripherals|accessories)$|video game peripherals$)/iu
            : /^(?:Category|分類|分类):(?:\d{4}年(?:[電电]子)?[遊游][戲戏]$|街[機机][遊游][戲戏]$|(?:[電电]子)?[遊游][戲戏](?:[機机]|主[機机])?(?:配件|附件|[週周][邊边](?:設[備备])?)$)/u;
    return getCategories(record).some((category) =>
        excluded.test(category.title),
    );
}

/** Crosslinks need typed counterparts; Chinese-only terms need direct typed categories. */
function getCandidateArticles(type, chinese, englishArticles) {
    if (!isArticle(chinese) || isMetaArticle(chinese, type)) return undefined;
    if (type === 'platforms' && isExcludedPlatformArticle(chinese, 'zh', false))
        return undefined;
    const link = getLanguageLink(chinese, 'en');
    if (!link) {
        if (type === 'platforms' && isExcludedPlatformArticle(chinese, 'zh'))
            return undefined;
        return hasTypedCategories(chinese, type, 'zh')
            ? { chinese, english: undefined }
            : undefined;
    }
    if (typeof link.title !== 'string' || !link.title.trim()) return undefined;
    const english = englishArticles.get(titleKey(link.title));
    if (
        !isArticle(english) ||
        isMetaArticle(english, type) ||
        (type === 'platforms' && isExcludedPlatformArticle(english, 'en')) ||
        !hasTypedCategories(english, type, 'en')
    )
        return undefined;
    const chineseId = getIdentity(chinese);
    const englishId = getIdentity(english);
    if (chineseId && englishId && chineseId !== englishId) return undefined;
    return { chinese, english };
}

/** Clone patterns so discovery never changes a curated alias's lastIndex. */
function matchesPattern(pattern, name) {
    const match = new RegExp(pattern.source, pattern.flags).exec(name);
    return match?.index === 0 && match[0] === name;
}

/**
 * Reserve resolved identities as well as curated names so renamed or merged
 * articles cannot create a second definition for an existing company/platform.
 */
function reserveExistingDefinitions(
    type,
    existingDefinitions,
    chineseArticles,
    englishArticles,
) {
    const reserved = new Set();
    const identities = new Set();
    const patterns = [];
    const reserveArticle = (record) => {
        for (const name of recognitionNames(record.title, type))
            reserved.add(titleKey(name));
        const identity = getIdentity(record);
        if (identity) identities.add(identity);
    };
    for (const definition of existingDefinitions) {
        for (const alias of [
            definition.label,
            definition.page,
            ...definition.aliases,
        ]) {
            if (alias instanceof RegExp) patterns.push(alias);
            else {
                for (const name of recognitionNames(alias, type))
                    reserved.add(titleKey(name));
                if (typeof alias !== 'string' || !alias.trim()) continue;
                const chinese = chineseArticles.get(titleKey(alias));
                if (isArticle(chinese)) {
                    if (alias === definition.page) reserveArticle(chinese);
                    const pair = getCandidateArticles(
                        type,
                        chinese,
                        englishArticles,
                    );
                    if (pair) {
                        reserveArticle(pair.chinese);
                        if (pair.english) reserveArticle(pair.english);
                    }
                }
                const english = englishArticles.get(titleKey(alias));
                if (
                    !isArticle(english) ||
                    isMetaArticle(english, type) ||
                    !hasTypedCategories(english, type, 'en')
                )
                    continue;
                reserveArticle(english);
                const link = getLanguageLink(english, 'zh');
                const counterpart =
                    typeof link?.title === 'string' &&
                    chineseArticles.get(titleKey(link.title));
                if (!isArticle(counterpart)) continue;
                const englishId = getIdentity(english);
                const chineseId = getIdentity(counterpart);
                if (!englishId || !chineseId || englishId === chineseId)
                    reserveArticle(counterpart);
            }
        }
    }
    return { reserved, identities, patterns, reserveArticle };
}

/**
 * Append verified company, platform, or genre terms from caller-verified roots.
 * Existing definitions and records remain untouched. Categories and templates
 * require separate association evidence and are absent from discovered terms.
 */
export function discoverTerminologyDefinitions(
    type,
    candidates,
    existingDefinitions,
    chineseArticles,
    englishArticles,
) {
    if (!Object.hasOwn(ENGLISH_CATEGORIES, type))
        throw new Error(`Unsupported terminology discovery type: ${type}`);
    const { reserved, identities, patterns, reserveArticle } =
        reserveExistingDefinitions(
            type,
            existingDefinitions,
            chineseArticles,
            englishArticles,
        );
    const discovered = [];
    for (const candidate of candidates) {
        if (typeof candidate !== 'string') continue;
        const pair = getCandidateArticles(
            type,
            chineseArticles.get(titleKey(candidate)),
            englishArticles,
        );
        if (!pair) continue;
        const { chinese, english } = pair;
        const names = [
            ...recognitionNames(chinese.title, type),
            ...recognitionNames(english?.title, type),
        ];
        if (
            identities.has(getIdentity(chinese)) ||
            identities.has(getIdentity(english)) ||
            names.some(
                (name) =>
                    reserved.has(titleKey(name)) ||
                    patterns.some((pattern) => matchesPattern(pattern, name)),
            )
        )
            continue;
        reserveArticle(chinese);
        if (english) reserveArticle(english);
        const aliases = [chinese.title];
        if (english && titleKey(english.title) !== titleKey(chinese.title))
            aliases.push(english.title);
        discovered.push({
            aliases,
            label: chinese.title,
            page: chinese.title,
            categories: [],
        });
    }
    return discovered;
}

export function discoverGenreDefinitions(
    candidates,
    existingDefinitions,
    chineseArticles,
    englishArticles,
) {
    return discoverTerminologyDefinitions(
        'genres',
        candidates,
        existingDefinitions,
        chineseArticles,
        englishArticles,
    );
}
