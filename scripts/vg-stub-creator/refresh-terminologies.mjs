/**
 * @file scripts/vg-stub-creator/refresh-terminologies.mjs
 * Purpose: Refresh terminology facts from serial, resumable Wikipedia API reads.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. normalizeTitle
 * 4. stripNamespace
 * 5. apiTitleKey
 * 6. resolveQueryTitles
 * 7. mergeQueryResponses
 * 8. createWikipediaCollector
 * 9. collectTitles
 * 10. batchTitles
 * 11. resolveCategoryRedirects
 * 12. collectSubcategories
 * 13. collectCategoryMembers
 * 14. collectTaxonomyArticles
 * 15. isArticle
 * 16. getLanguageLink
 * 17. getArticleCandidates
 * 18. isRelevantEnglishArticle
 * 19. chooseArticle
 * 20. categoryStem
 * 21. findCategoryReplacements
 * 22. addVerifiedAliases
 * 23. serializeDefinition
 * 24. renderCatalog
 * 25. parseArguments
 * 26. main
 * 27. Initialization and execution
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { format, resolveConfig } from 'prettier';
import ts from 'typescript';
import {
    findNavigationTemplates,
    getNavigationCategoryRoots,
    getNavigationHead,
    findNavigationGame,
} from './terminology-navigation.mjs';
import { discoverTerminologyDefinitions } from './terminology-discovery.mjs';

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const TYPES = ['companies', 'platforms', 'genres', 'years'];
const ROOT_CATEGORIES = {
    companies: { en: 'Video games by company', zh: '各公司电子游戏' },
    platforms: { en: 'Video games by platform', zh: '各平台電子遊戲' },
    genres: { en: 'Video games by genre', zh: '各类型电子游戏' },
    years: { en: 'Video games by year', zh: '各年电子游戏' },
};
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
const QUERY_PROPERTIES = 'info|langlinks|pageprops|categories';
const ARTICLE_TAXONOMIES = {
    companies: {
        roots: [
            '電子遊戲開發公司',
            '電子遊戲發行商',
            '各地電子遊戲公司',
            '手机游戏公司',
            '網路遊戲營運商',
            '已結業電子遊戲公司',
        ],
        depth: 3,
        descendants:
            /(?:[電电]子[遊游][戲戏](?:公司|[開开][發发](?:公司|商)|[發发]行(?:商|公司))|(?:手机|手機)[遊游][戲戏]公司|[網网][路络絡][遊游][戲戏][營营][運运]商|日本成人[遊游][戲戏]公司)$/u,
    },
    platforms: {
        roots: [
            '電子遊戲機',
            '家用游戏机',
            '掌上遊戲機',
            '家用電腦',
            '街机主板',
            '卡普空街機主機板',
        ],
        depth: 3,
        descendants:
            /(?:[遊游][戲戏][機机]|家用[電电][腦脑]|街[機机](?:主板|主[機机]板))$/u,
    },
};

export function normalizeTitle(value) {
    return String(value).replaceAll('_', ' ').trim().toLowerCase();
}

function stripNamespace(value) {
    return String(value).replace(
        /^(?:Category|分类|分類|Template|模板):/iu,
        '',
    );
}

function apiTitleKey(value) {
    return String(value).replaceAll('_', ' ').trim();
}

/** Resolve only explicit API normalization, conversion, and redirect edges. */
export function resolveQueryTitles(titles, data, observedAt) {
    if (data?.error) throw new Error(`Wikipedia API error: ${data.error.code}`);
    const pages = data?.query?.pages;
    if (!Array.isArray(pages)) throw new Error('Missing Wikipedia query pages');
    for (const page of pages) {
        if (
            typeof page.title !== 'string' ||
            (page.missing !== undefined && page.missing !== true) ||
            (page.invalid !== undefined && page.invalid !== true) ||
            (!page.missing &&
                !page.invalid &&
                (!Number.isSafeInteger(page.pageid) ||
                    page.pageid <= 0 ||
                    !Number.isInteger(page.ns)))
        ) {
            throw new Error('Malformed Wikipedia page evidence');
        }
    }
    const edges = new Map();
    for (const kind of ['normalized', 'converted', 'redirects']) {
        for (const edge of data.query[kind] || []) {
            if (typeof edge.from !== 'string' || typeof edge.to !== 'string') {
                throw new Error('Malformed Wikipedia title transformation');
            }
            edges.set(apiTitleKey(edge.from), edge);
        }
    }
    const byTitle = new Map(
        pages.map((page) => [apiTitleKey(page.title), page]),
    );
    return new Map(
        titles.map((requested) => {
            let title = requested;
            let fragment = '';
            const seen = new Set();
            while (edges.has(apiTitleKey(title))) {
                const key = apiTitleKey(title);
                if (seen.has(key))
                    throw new Error(`Cyclic title redirect: ${requested}`);
                seen.add(key);
                const edge = edges.get(key);
                title = edge.to;
                fragment ||= edge.tofragment || '';
                if (apiTitleKey(title) === key) break;
            }
            const page = byTitle.get(apiTitleKey(title));
            if (!page)
                throw new Error(`Incomplete Wikipedia response: ${requested}`);
            return [
                normalizeTitle(requested),
                {
                    ...page,
                    requested,
                    observedAt,
                    fragment,
                    exists: page.missing !== true && page.invalid !== true,
                },
            ];
        }),
    );
}

/** Combine continued property responses without discarding earlier evidence. */
export function mergeQueryResponses(responses) {
    const pages = new Map();
    const merged = { query: { pages: [] } };
    for (const response of responses) {
        for (const kind of ['normalized', 'converted', 'redirects']) {
            merged.query[kind] ||= [];
            merged.query[kind].push(...(response.query?.[kind] || []));
        }
        for (const page of response.query?.pages || []) {
            const key = page.pageid ?? page.title;
            const previous = pages.get(key) || {};
            const combined = { ...previous, ...page };
            for (const property of [
                'langlinks',
                'categories',
                'redirects',
                'revisions',
                'templates',
            ]) {
                if (previous[property] || page[property]) {
                    combined[property] = [
                        ...new Map(
                            [
                                ...(previous[property] || []),
                                ...(page[property] || []),
                            ].map((value) => [JSON.stringify(value), value]),
                        ).values(),
                    ];
                }
            }
            pages.set(key, combined);
        }
    }
    merged.query.pages = [...pages.values()];
    return merged;
}

function createUserAgent(contact) {
    const message =
        'Set KANADE_TERMINOLOGY_CONTACT to an absolute HTTP(S) contact URL without credentials before uncached Wikipedia requests.';
    if (
        typeof contact !== 'string' ||
        !contact.trim() ||
        [...contact].some((character) => {
            const code = character.charCodeAt(0);
            return code < 32 || code === 127;
        })
    )
        throw new Error(message);
    let url;
    try {
        url = new URL(contact);
    } catch {
        throw new Error(message);
    }
    if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
    )
        throw new Error(message);
    const contactUrl = url.href.replaceAll('(', '%28').replaceAll(')', '%29');
    return `Kanade-TerminologyRefresh/1.0 (${contactUrl})`;
}

/** The caller awaits every request; there is never a concurrent API request. */
export function createWikipediaCollector(
    cacheDirectory,
    {
        contact = process.env.KANADE_TERMINOLOGY_CONTACT,
        fetchRequest = fetch,
    } = {},
) {
    let lastRequestAt = 0;
    let networkRequests = 0;
    let cacheHits = 0;
    const requestRecords = new Map();
    return {
        requestRecords,
        get statistics() {
            return { networkRequests, cacheHits };
        },
        async request(wiki, values) {
            const params = new URLSearchParams({
                action: 'query',
                format: 'json',
                formatversion: '2',
                maxlag: '5',
                ...values,
            });
            params.sort();
            const url = `https://${wiki}.wikipedia.org/w/api.php?${params}`;
            const cacheKey = createHash('sha256').update(url).digest('hex');
            const cacheFile = join(cacheDirectory, `${cacheKey}.json`);
            try {
                const cached = JSON.parse(await readFile(cacheFile, 'utf8'));
                if (
                    cached.url === url &&
                    cached.data?.query &&
                    !cached.data.error &&
                    Number.isSafeInteger(cached.observedAt) &&
                    cached.observedAt <= Date.now() &&
                    Date.now() - cached.observedAt < CACHE_MAX_AGE
                ) {
                    cacheHits += 1;
                    requestRecords.set(cacheKey, {
                        wiki,
                        url,
                        observedAt: cached.observedAt,
                        cached: true,
                    });
                    return cached;
                }
            } catch {
                /* A missing or invalid task cache is fetched again. */
            }
            const userAgent = createUserAgent(contact);
            for (let attempt = 0; attempt < 3; attempt += 1) {
                await delay(Math.max(0, 250 - (Date.now() - lastRequestAt)));
                lastRequestAt = Date.now();
                networkRequests += 1;
                const response = await fetchRequest(url, {
                    headers: {
                        'User-Agent': userAgent,
                        Accept: 'application/json',
                    },
                    signal: AbortSignal.timeout(30_000),
                });
                const data = response.ok ? await response.json() : null;
                if (
                    response.status === 429 ||
                    response.status === 503 ||
                    data?.error?.code === 'maxlag'
                ) {
                    if (attempt < 2) {
                        const seconds =
                            Number(response.headers.get('retry-after')) ||
                            5 * (attempt + 1);
                        if (seconds > 30)
                            throw new Error(
                                `Wikipedia requested Retry-After ${seconds}s; resume this cached collection later`,
                            );
                        await delay(Math.max(0, seconds * 1_000));
                        continue;
                    }
                }
                if (!response.ok || data?.error || !data?.query) {
                    throw new Error(
                        `Wikipedia ${wiki} request failed: ${response.status} ${JSON.stringify(data?.error || {})}`,
                    );
                }
                const observedAt = Date.now();
                const result = { url, observedAt, data };
                await writeFile(cacheFile, `${JSON.stringify(result)}\n`);
                requestRecords.set(cacheKey, {
                    wiki,
                    url,
                    observedAt,
                    cached: false,
                });
                return result;
            }
            throw new Error(`Wikipedia ${wiki} request retries exhausted`);
        },
    };
}

/** Fetch complete title metadata in batches of at most 50, with continuation. */
async function collectTitles(
    collector,
    wiki,
    titles,
    target = new Map(),
    extra = {},
) {
    const unique = [
        ...new Map(
            titles
                .filter(Boolean)
                .map((title) => [normalizeTitle(title), title]),
        ).values(),
    ].filter((title) => !target.has(normalizeTitle(title)));
    let checked = 0;
    for (const batch of batchTitles(unique)) {
        const responses = [];
        let continuation = {};
        let observedAt;
        do {
            const result = await collector.request(wiki, {
                titles: batch.join('|'),
                prop: QUERY_PROPERTIES,
                redirects: '1',
                converttitles: '1',
                lllang: wiki === 'zh' ? 'en' : 'zh',
                lllimit: 'max',
                cllimit: 'max',
                ...extra,
                ...continuation,
            });
            responses.push(result.data);
            observedAt ??= result.observedAt;
            continuation = result.data.continue;
        } while (continuation);
        const records = resolveQueryTitles(
            batch,
            mergeQueryResponses(responses),
            observedAt,
        );
        for (const [key, record] of records) target.set(key, record);
        checked += batch.length;
        if (unique.length > 50)
            console.log(`${wiki}: checked ${checked}/${unique.length} titles`);
    }
    if (wiki === 'zh' && !extra.variant && !extra.rdnamespace) {
        const missing = unique.filter(
            (title) => !target.get(normalizeTitle(title))?.exists,
        );
        for (const variant of ['zh-hans', 'zh-hant']) {
            const candidates = missing.filter(
                (title) => !target.get(normalizeTitle(title))?.exists,
            );
            const variants = await collectTitles(
                collector,
                wiki,
                candidates,
                new Map(),
                { ...extra, variant },
            );
            for (const [key, record] of variants)
                if (record.exists) target.set(key, record);
        }
    }
    return target;
}

/** Bound both title count and encoded GET length for Chinese and long aliases. */
export function batchTitles(titles) {
    const batches = [];
    let batch = [];
    for (const title of titles) {
        const proposed = [...batch, title];
        const encodedLength = new URLSearchParams({
            titles: proposed.join('|'),
        }).toString().length;
        if (batch.length && (proposed.length > 50 || encodedLength > 6_000)) {
            batches.push(batch);
            batch = [];
        }
        batch.push(title);
    }
    if (batch.length) batches.push(batch);
    return batches;
}

/** Follow category soft redirects only after verifying their actual target page. */
export async function resolveCategoryRedirects(collector, wiki, categories) {
    const originals = new Map(categories);
    for (let depth = 0; depth < 10; depth += 1) {
        const pending = new Map();
        const needsContent = [];
        for (const [key, record] of categories) {
            if (!record.exists || record.softRedirectChecked) continue;
            const props = record.pageprops || {};
            let target =
                props.category_redirect_target ||
                props.categoryredirect ||
                props.category_redirect;
            const isSoft =
                target ||
                (record.templates || []).some((template) =>
                    /^Template:(?:Category ?redirect|Cat redirect|[分分類类]+重定向)$/iu.test(
                        template.title,
                    ),
                );
            if (!isSoft) {
                record.softRedirectChecked = true;
                continue;
            }
            if (target) pending.set(key, `Category:${stripNamespace(target)}`);
            else needsContent.push(record.title);
        }
        if (needsContent.length) {
            const content = await collectTitles(
                collector,
                wiki,
                needsContent,
                new Map(),
                {
                    prop: 'info|revisions',
                    rvprop: 'ids|content',
                    rvslots: 'main',
                },
            );
            for (const [key, record] of categories) {
                if (!needsContent.includes(record.title)) continue;
                const text =
                    content.get(normalizeTitle(record.title))?.revisions?.[0]
                        ?.slots?.main?.content || '';
                const match = text.match(
                    /\{\{\s*(?:Category ?redirect|Cat redirect|Catredirect|分类重定向|分類重定向)\s*\|\s*(?:1\s*=\s*)?([^{}|\n]+?)(?:\||\}\})/iu,
                );
                if (match && !match[1].includes('#'))
                    pending.set(
                        key,
                        `Category:${stripNamespace(match[1].trim())}`,
                    );
                else {
                    record.softRedirectUnresolved = true;
                    record.softRedirectChecked = true;
                }
            }
        }
        if (!pending.size) return;
        await collectTitles(
            collector,
            wiki,
            [...pending.values()],
            categories,
            {
                prop: `${QUERY_PROPERTIES}|templates`,
                tlnamespace: '10',
                tllimit: 'max',
            },
        );
        for (const [key, target] of pending) {
            const record = categories.get(key);
            const resolved = categories.get(normalizeTitle(target));
            if (
                !resolved?.exists ||
                resolved.ns !== 14 ||
                normalizeTitle(resolved.title) === normalizeTitle(record.title)
            ) {
                record.softRedirectUnresolved = true;
                record.softRedirectChecked = true;
            } else {
                categories.set(key, {
                    ...resolved,
                    requested: record.requested,
                    redirectedFrom: [
                        ...(record.redirectedFrom || []),
                        {
                            title: record.title,
                            pageId: record.pageid,
                            revisionId: record.lastrevid,
                        },
                    ],
                });
            }
        }
    }
    for (const [key, record] of categories) {
        if (!record.softRedirectChecked && originals.has(key))
            record.softRedirectUnresolved = true;
    }
}

async function collectSubcategories(collector, wiki, category) {
    return collectCategoryMembers(collector, wiki, category, '14', 'subcat');
}

async function collectCategoryMembers(
    collector,
    wiki,
    category,
    namespace,
    type,
) {
    const members = [];
    let continuation = {};
    do {
        const result = await collector.request(wiki, {
            list: 'categorymembers',
            cmtitle: `Category:${category}`,
            ...(type ? { cmtype: type } : {}),
            cmnamespace: namespace,
            cmlimit: '500',
            ...continuation,
        });
        if (!Array.isArray(result.data.query.categorymembers))
            throw new Error('Malformed category members');
        members.push(...result.data.query.categorymembers);
        continuation = result.data.continue;
    } while (continuation);
    return members.map((member) => member.title);
}

/** Traverse role/category classes, never branded game, people, or template trees. */
export async function collectTaxonomyArticles(collector, taxonomy) {
    const pending = taxonomy.roots.map((title) => ({ title, depth: 0 }));
    const visited = new Set();
    const articles = new Set();
    const categories = [];
    for (let index = 0; index < pending.length; index += 1) {
        const node = pending[index];
        const key = normalizeTitle(node.title);
        if (visited.has(key)) continue;
        if (visited.size >= 500)
            throw new Error(
                'Article taxonomy exceeds 500 categories; refine its roots before collecting',
            );
        visited.add(key);
        categories.push(`Category:${node.title}`);
        let continuation = {};
        do {
            const result = await collector.request('zh', {
                list: 'categorymembers',
                cmtitle: `Category:${node.title}`,
                cmnamespace: '0|14',
                cmlimit: '500',
                ...continuation,
            });
            const members = result.data.query?.categorymembers;
            if (
                !Array.isArray(members) ||
                members.some(
                    (member) =>
                        typeof member.title !== 'string' ||
                        ![0, 14].includes(member.ns),
                )
            )
                throw new Error('Malformed article taxonomy members');
            for (const member of members) {
                if (member.ns === 0) articles.add(member.title);
                else if (
                    node.depth < taxonomy.depth &&
                    taxonomy.descendants.test(stripNamespace(member.title))
                )
                    pending.push({
                        title: stripNamespace(member.title),
                        depth: node.depth + 1,
                    });
            }
            continuation = result.data.continue;
        } while (continuation);
    }
    return { roots: taxonomy.roots, categories, articles: [...articles] };
}

function isArticle(record) {
    return (
        record?.exists === true &&
        record.ns === 0 &&
        !record.fragment &&
        record.pageprops?.disambiguation === undefined
    );
}

function getLanguageLink(record, language) {
    return record?.langlinks?.find((link) => link.lang === language)?.title;
}

function getArticleCandidates(definition, type) {
    const names = [
        definition.page,
        definition.label,
        ...definition.aliases.filter((alias) => typeof alias === 'string'),
    ].filter(Boolean);
    if (type === 'genres') {
        for (const alias of [...names]) {
            if (
                /^[\p{ASCII}]+$/u.test(alias) &&
                !/\b(?:games?|gaming)\b/iu.test(alias)
            ) {
                names.push(`${alias} game`, `${alias} video game`);
            }
        }
    }
    return [...new Set(names)];
}

/** Contextual shorthand alone is insufficient to relink a missing article. */
function isRelevantEnglishArticle(record, type) {
    const categories = (record.categories || [])
        .map((category) => category.title)
        .join('\n');
    const patterns = {
        companies:
            /video game (?:companies|developers|publishers)|software companies|(?:Nintendo|Ubisoft) divisions/iu,
        platforms:
            /(?:video game|gaming) (?:consoles|hardware|platforms)|home computers|computers|computer platforms|operating systems|smartphones|tablet computers|arcade (?:systems|hardware)/iu,
        genres: /video game genres|video game terminology|gameplay|interactive fiction|(?:video|computer) games|games by genre/iu,
        years: /video gaming by year/iu,
    };
    return patterns[type].test(categories);
}

/** Prefer the configured Chinese article; repair misses only through verified links. */
export function chooseArticle(definition, type, chinese, english) {
    if (!definition.page)
        return { article: undefined, reason: 'intentionally-unlinked' };
    const configured = chinese.get(normalizeTitle(definition.page));
    if (isArticle(configured))
        return { article: configured, reason: 'configured-article' };
    const candidates = new Map();
    for (const title of getArticleCandidates(definition, type)) {
        const counterpart = english.get(normalizeTitle(title));
        if (
            !isArticle(counterpart) ||
            !isRelevantEnglishArticle(counterpart, type)
        )
            continue;
        const link = getLanguageLink(counterpart, 'zh');
        const article = link && chinese.get(normalizeTitle(link));
        if (!isArticle(article)) continue;
        const englishId = counterpart.pageprops?.wikibase_item;
        const chineseId = article.pageprops?.wikibase_item;
        if (englishId && chineseId && englishId !== chineseId) continue;
        candidates.set(normalizeTitle(article.title), article);
    }
    return candidates.size === 1
        ? {
              article: [...candidates.values()][0],
              reason: 'verified-english-langlink',
          }
        : {
              article: undefined,
              reason:
                  candidates.size > 1
                      ? 'ambiguous-counterparts'
                      : 'missing-chinese-article',
          };
}

/** Compare whole established stems, never arbitrary substring similarities. */
function categoryStem(value) {
    return normalizeTitle(stripNamespace(value))
        .replace(/\s*\([^()]+\)\s*$/u, '')
        .replace(/(?:[電电]子)?[遊游][戲戏]$/u, '')
        .replace(/\s+(?:video\s+)?games?$/u, '')
        .replace(/s$/u, '')
        .replace(/\s+/gu, ' ')
        .trim();
}

/** Replacement categories require an exact stem and an explicit Chinese link. */
export function findCategoryReplacements(
    definition,
    englishArticle,
    englishCategories,
    chineseCategories,
    allowedCategories,
) {
    const names = [
        definition.label,
        definition.page,
        englishArticle?.title,
        ...(definition.categories || []),
        ...definition.aliases.filter((alias) => typeof alias === 'string'),
    ].filter(Boolean);
    const stems = new Set(names.map(categoryStem).filter(Boolean));
    const candidates = new Map();
    for (const category of englishCategories.values()) {
        if (
            !category.exists ||
            category.softRedirectUnresolved ||
            category.ns !== 14 ||
            !allowedCategories?.has(normalizeTitle(category.title)) ||
            !stems.has(categoryStem(category.title))
        )
            continue;
        const link = getLanguageLink(category, 'zh');
        const chinese = link && chineseCategories.get(normalizeTitle(link));
        if (
            chinese?.exists !== true ||
            chinese.softRedirectUnresolved ||
            chinese.ns !== 14
        )
            continue;
        const enId = category.pageprops?.wikibase_item;
        const zhId = chinese.pageprops?.wikibase_item;
        if (enId && zhId && enId !== zhId) continue;
        candidates.set(normalizeTitle(chinese.title), chinese);
    }
    return [...candidates.values()];
}

/** Preserve contextual aliases, but reject newly fetched aliases that collide. */
export function addVerifiedAliases(definitions, proposals) {
    const ownership = new Map();
    const reserve = (alias, index) => {
        const key = normalizeTitle(alias);
        if (!ownership.has(key)) ownership.set(key, new Set());
        ownership.get(key).add(index);
    };
    definitions.forEach((definition, index) => {
        for (const alias of [
            definition.label,
            definition.page,
            ...definition.aliases,
        ]) {
            if (typeof alias === 'string') reserve(alias, index);
        }
    });
    proposals.forEach((aliases, index) =>
        aliases.forEach((alias) => reserve(alias, index)),
    );
    return definitions.map((definition, index) => {
        const aliases = [...definition.aliases];
        const keys = new Set(
            aliases
                .filter((alias) => typeof alias === 'string')
                .map(normalizeTitle),
        );
        for (const alias of proposals[index]) {
            if (
                !alias ||
                alias.includes('#') ||
                /(?:disambiguation|消歧[義义])/iu.test(alias)
            )
                continue;
            const key = normalizeTitle(alias);
            if (keys.has(key) || ownership.get(key)?.size !== 1) continue;
            const patternCollision = definitions.some(
                (other, otherIndex) =>
                    otherIndex !== index &&
                    other.aliases.some((pattern) => {
                        if (!(pattern instanceof RegExp)) return false;
                        pattern.lastIndex = 0;
                        const match = pattern.exec(alias);
                        return match?.[0] === alias;
                    }),
            );
            if (patternCollision) continue;
            aliases.push(alias);
            keys.add(key);
        }
        const canonical = definition.label;
        const withoutCanonical = aliases.filter(
            (alias) =>
                typeof alias !== 'string' ||
                normalizeTitle(alias) !== normalizeTitle(canonical),
        );
        return { ...definition, aliases: [canonical, ...withoutCanonical] };
    });
}

function serializeDefinition(definition) {
    const lines = ['    {'];
    for (const [key, value] of Object.entries(definition)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
            const items = value.map((item) =>
                item instanceof RegExp ? item.toString() : JSON.stringify(item),
            );
            if (
                key === 'aliases' &&
                (items.length > 3 ||
                    value.some((item) => item instanceof RegExp))
            ) {
                lines.push(
                    `        ${key}: [`,
                    ...items.map((item) => `            ${item},`),
                    '        ],',
                );
            } else lines.push(`        ${key}: [${items.join(', ')}],`);
        } else lines.push(`        ${key}: ${JSON.stringify(value)},`);
    }
    lines.push('    },');
    return lines.join('\n');
}

export function renderCatalog(source, definitions) {
    const parsed = ts.createSourceFile(
        'catalog.ts',
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    );
    const assignment = parsed.statements.find(ts.isExportAssignment);
    const expression =
        assignment && ts.isSatisfiesExpression(assignment.expression)
            ? assignment.expression.expression
            : assignment?.expression;
    if (!expression || !ts.isArrayLiteralExpression(expression))
        throw new Error('Expected a terminology array export');
    const array = `[\n${definitions.map(serializeDefinition).join('\n')}\n]`;
    return `${source.slice(0, expression.getStart(parsed))}${array}${source.slice(expression.end)}`;
}

function parseArguments() {
    const options = {
        apply: false,
        cacheDirectory: join(tmpdir(), 'kanade-vg-stub-creator-terminologies'),
    };
    for (let index = 2; index < process.argv.length; index += 1) {
        const argument = process.argv[index];
        if (argument === '--apply') options.apply = true;
        else if (argument === '--cache-dir' && process.argv[index + 1])
            options.cacheDirectory = resolve(process.argv[++index]);
        else throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
    return options;
}

async function main() {
    const options = parseArguments();
    await mkdir(options.cacheDirectory, { recursive: true });
    const collector = createWikipediaCollector(options.cacheDirectory);
    const definitions = {};
    const sources = {};
    const original = {};
    for (const type of TYPES) {
        const path = join(
            ROOT,
            `src/vg-stub-creator/domain/terminologies/${type}.ts`,
        );
        sources[type] = await readFile(path, 'utf8');
        definitions[type] = (await import(pathToFileURL(path).href)).default;
        original[type] = definitions[type];
    }
    const genreCandidates = await collectCategoryMembers(
        collector,
        'zh',
        '電子遊戲類型',
        '0',
        'page',
    );
    const articleDiscovery = {};
    for (const type of ['companies', 'platforms']) {
        articleDiscovery[type] = await collectTaxonomyArticles(
            collector,
            ARTICLE_TAXONOMIES[type],
        );
        console.log(
            `${type}: discovered ${articleDiscovery[type].articles.length} article candidates in ${articleDiscovery[type].categories.length} categories`,
        );
    }
    const articleNames = TYPES.flatMap((type) =>
        definitions[type].flatMap((definition) =>
            getArticleCandidates(definition, type),
        ),
    );
    console.log(
        `Checking ${TYPES.reduce((sum, type) => sum + definitions[type].length, 0)} terminology entries; cache: ${options.cacheDirectory}`,
    );
    const zhArticles = await collectTitles(collector, 'zh', [
        ...articleNames,
        ...genreCandidates,
        ...Object.values(articleDiscovery).flatMap(
            (discovery) => discovery.articles,
        ),
    ]);
    const enArticles = await collectTitles(collector, 'en', [
        ...articleNames,
        ...[...zhArticles.values()].map((record) =>
            getLanguageLink(record, 'en'),
        ),
    ]);
    await collectTitles(
        collector,
        'zh',
        [...enArticles.values()].map((record) => getLanguageLink(record, 'zh')),
        zhArticles,
    );
    await collectTitles(
        collector,
        'en',
        [...zhArticles.values()].map((record) => getLanguageLink(record, 'en')),
        enArticles,
    );
    const addedDefinitions = {};
    for (const type of ['companies', 'platforms', 'genres']) {
        addedDefinitions[type] = discoverTerminologyDefinitions(
            type,
            type === 'genres'
                ? genreCandidates
                : articleDiscovery[type].articles,
            definitions[type],
            zhArticles,
            enArticles,
        );
        definitions[type] = [...definitions[type], ...addedDefinitions[type]];
    }
    console.log(
        'Article and alias probes complete; collecting category roots.',
    );

    const discovered = { zh: {}, en: {} };
    for (const wiki of ['zh', 'en']) {
        for (const type of TYPES)
            discovered[wiki][type] = await collectSubcategories(
                collector,
                wiki,
                ROOT_CATEGORIES[type][wiki],
            );
    }
    const yearKeys = new Set(
        definitions.years
            .flatMap((definition) => definition.aliases)
            .filter((alias) => typeof alias === 'string'),
    );
    addedDefinitions.years = [];
    for (const title of discovered.zh.years) {
        const match = stripNamespace(title).match(
            /^(\d{4})年[電电]子[遊游][戲戏]$/u,
        );
        if (!match || yearKeys.has(match[1]) || yearKeys.has(`${match[1]}年`))
            continue;
        const definition = {
            aliases: [`${match[1]}年`, match[1]],
            label: `${match[1]}年`,
            categories: [stripNamespace(title)],
        };
        addedDefinitions.years.push(definition);
        yearKeys.add(match[1]);
    }
    definitions.years = [...definitions.years, ...addedDefinitions.years];
    const configuredCategories = TYPES.flatMap((type) =>
        definitions[type].flatMap((definition) =>
            (definition.categories || []).map((title) => `Category:${title}`),
        ),
    );
    const categoryProperties = {
        prop: `${QUERY_PROPERTIES}|templates`,
        tlnamespace: '10',
        tllimit: 'max',
    };
    const zhCategories = await collectTitles(
        collector,
        'zh',
        [...configuredCategories, ...Object.values(discovered.zh).flat()],
        new Map(),
        categoryProperties,
    );
    const englishCategoryCandidates = Object.fromEntries(
        TYPES.map((type) => [
            type,
            definitions[type].flatMap((definition) => {
                const selected = chooseArticle(
                    definition,
                    type,
                    zhArticles,
                    enArticles,
                ).article;
                const title = getLanguageLink(selected, 'en');
                const names = [
                    title,
                    ...definition.aliases.filter(
                        (alias) =>
                            typeof alias === 'string' &&
                            /^[\p{ASCII}]+$/u.test(alias),
                    ),
                ].filter(Boolean);
                if (type === 'years')
                    return names.map(
                        (name) =>
                            `Category:${name.replace(/年$/u, '')} video games`,
                    );
                return names.flatMap((name) => [
                    `Category:${name} games`,
                    `Category:${name.replace(/\s+(?:video\s+)?game$/iu, '')} games`,
                ]);
            }),
        ]),
    );
    const enCategories = await collectTitles(
        collector,
        'en',
        [
            ...Object.values(discovered.en).flat(),
            ...Object.values(englishCategoryCandidates).flat(),
            ...[...zhCategories.values()].map((record) =>
                getLanguageLink(record, 'en'),
            ),
        ],
        new Map(),
        categoryProperties,
    );
    await collectTitles(
        collector,
        'zh',
        [...enCategories.values()].map((record) =>
            getLanguageLink(record, 'zh'),
        ),
        zhCategories,
        categoryProperties,
    );
    await collectTitles(
        collector,
        'en',
        [...zhCategories.values()].map((record) =>
            getLanguageLink(record, 'en'),
        ),
        enCategories,
        categoryProperties,
    );
    await resolveCategoryRedirects(collector, 'zh', zhCategories);
    await resolveCategoryRedirects(collector, 'en', enCategories);
    console.log(
        'Category collection complete; checking stub tags, navigation templates, and article redirects.',
    );

    const templates = TYPES.flatMap((type) =>
        definitions[type].flatMap((definition) =>
            [
                ...(definition.stubTags || []),
                ...(definition.navboxes || []),
            ].map((title) => `Template:${title}`),
        ),
    );
    const zhTemplates = await collectTitles(collector, 'zh', templates);
    const enTemplates = await collectTitles(collector, 'en', [
        ...templates,
        ...[...zhTemplates.values()].map((record) =>
            getLanguageLink(record, 'en'),
        ),
    ]);
    const selected = {};
    for (const type of TYPES)
        selected[type] = definitions[type].map((definition) =>
            chooseArticle(definition, type, zhArticles, enArticles),
        );
    const navigationCandidates = [];
    for (const category of getNavigationCategoryRoots().companies)
        navigationCandidates.push(
            ...(await collectCategoryMembers(
                collector,
                'zh',
                category,
                '10',
                'page',
            )),
        );
    const navigationTemplates = await collectTitles(
        collector,
        'zh',
        navigationCandidates,
        new Map(),
        {
            prop: `${QUERY_PROPERTIES}|templates|links|revisions`,
            tlnamespace: '10',
            tllimit: 'max',
            plnamespace: '0',
            pllimit: 'max',
            rvprop: 'ids|content',
            rvslots: 'main',
        },
    );
    const allowedNavigationTemplates = new Set(
        navigationCandidates.flatMap((title) => [
            normalizeTitle(title),
            normalizeTitle(
                navigationTemplates.get(normalizeTitle(title))?.title || title,
            ),
        ]),
    );
    const canonicalZhArticles = TYPES.flatMap((type) =>
        selected[type].map((selection) => selection.article?.title),
    ).filter(Boolean);
    const canonicalEnArticles = TYPES.flatMap((type) =>
        selected[type].map((selection) =>
            getLanguageLink(selection.article, 'en'),
        ),
    ).filter(Boolean);
    const zhRedirects = await collectTitles(
        collector,
        'zh',
        canonicalZhArticles,
        new Map(),
        {
            prop: `${QUERY_PROPERTIES}|redirects`,
            rdnamespace: '0',
            rdprop: 'pageid|title|fragment',
            rdlimit: 'max',
        },
    );
    const enRedirects = await collectTitles(
        collector,
        'en',
        canonicalEnArticles,
        new Map(),
        {
            prop: `${QUERY_PROPERTIES}|redirects`,
            rdnamespace: '0',
            rdprop: 'pageid|title|fragment',
            rdlimit: 'max',
        },
    );
    const navigationHeads = await collectTitles(
        collector,
        'zh',
        [...navigationTemplates.values()].map(getNavigationHead),
    );
    const companyNavigation = definitions.companies.map((definition, index) => {
        const article = selected.companies[index].article;
        return findNavigationTemplates(
            {
                ...definition,
                aliases: [
                    ...definition.aliases,
                    article?.title,
                    getLanguageLink(article, 'en'),
                ].filter(Boolean),
            },
            article,
            navigationTemplates,
            allowedNavigationTemplates,
        ).filter((template) => {
            const head = navigationHeads.get(
                normalizeTitle(getNavigationHead(template) || ''),
            );
            return isArticle(head) && head.pageid === article.pageid;
        });
    });
    const navigationGames = await collectTitles(
        collector,
        'zh',
        companyNavigation.flatMap((templates) =>
            templates.flatMap((template) =>
                (template.links || [])
                    .filter((link) => link.ns === 0)
                    .map((link) => link.title),
            ),
        ),
    );
    console.log(
        'All Wikipedia collection completed successfully; preparing catalog updates.',
    );

    const evidence = new Map();
    const reference = (wiki, record) => {
        if (!record) return null;
        const key = `${wiki}:${record.title}`;
        if (!evidence.has(key))
            evidence.set(key, {
                wiki,
                title: record.title,
                namespace: record.ns ?? null,
                exists: record.exists,
                pageId: record.pageid ?? null,
                revisionId: record.lastrevid ?? null,
                wikidataId: record.pageprops?.wikibase_item ?? null,
                disambiguation: record.pageprops?.disambiguation !== undefined,
                observedAt: new Date(record.observedAt).toISOString(),
                languageLinks: record.langlinks || [],
                categories: (record.categories || []).map(
                    (category) => category.title,
                ),
                templates: (record.templates || []).map(
                    (template) => template.title,
                ),
                links: (record.links || [])
                    .filter((link) => link.ns === 0)
                    .map((link) => link.title),
                redirectCandidates: (record.redirects || []).map(
                    (redirect) => ({
                        title: redirect.title,
                        fragment: redirect.fragment || '',
                    }),
                ),
                url: `https://${wiki}.wikipedia.org/wiki/${encodeURIComponent(record.title.replaceAll(' ', '_'))}`,
            });
        const saved = evidence.get(key);
        if (record.redirects?.length)
            saved.redirectCandidates = record.redirects.map((redirect) => ({
                title: redirect.title,
                fragment: redirect.fragment || '',
            }));
        return key;
    };
    const terms = [];
    const counts = {
        terms: 0,
        articleLinksChanged: 0,
        articleLinksRemoved: 0,
        categoriesChanged: 0,
        missingCategoriesRemoved: 0,
        unresolvedCategoryRedirects: 0,
        templateRedirects: 0,
        missingTemplatesRemoved: 0,
        aliasesAdded: 0,
        termsAdded: Object.values(addedDefinitions).reduce(
            (sum, definitions) => sum + definitions.length,
            0,
        ),
        termsAddedByType: Object.fromEntries(
            TYPES.map((type) => [type, addedDefinitions[type].length]),
        ),
        categoriesAdded: 0,
        navigationTemplatesAdded: 0,
        stubTemplatesAdded: 0,
    };
    for (const type of TYPES) {
        const proposals = [];
        const updated = definitions[type].map((definition, index) => {
            counts.terms += 1;
            const result = { ...definition, aliases: [...definition.aliases] };
            const selection = selected[type][index];
            const article = selection.article;
            const englishTitle = getLanguageLink(article, 'en');
            const englishArticle =
                englishTitle && enArticles.get(normalizeTitle(englishTitle));
            const aliasProposals = [];
            if (article) {
                result.page = article.title;
                aliasProposals.push(article.title);
                if (isArticle(englishArticle))
                    aliasProposals.push(englishArticle.title);
                if (result.page !== definition.page)
                    counts.articleLinksChanged += 1;
            } else if (definition.page) {
                delete result.page;
                counts.articleLinksRemoved += 1;
            }
            proposals.push(aliasProposals);

            const categoryScope = new Set(
                discovered.en[type]
                    .flatMap((title) => [
                        title,
                        enCategories.get(normalizeTitle(title))?.title,
                    ])
                    .filter(Boolean)
                    .map(normalizeTitle),
            );
            const scopedEnglishCategories = new Map(
                [...enCategories].filter(
                    ([key, record]) =>
                        categoryScope.has(key) ||
                        categoryScope.has(normalizeTitle(record.title)),
                ),
            );
            const replacements = findCategoryReplacements(
                definition,
                englishArticle,
                scopedEnglishCategories,
                zhCategories,
                categoryScope,
            );
            const categoryChecks = [];
            result.categories = (definition.categories || []).flatMap(
                (title) => {
                    const record = zhCategories.get(
                        normalizeTitle(`Category:${title}`),
                    );
                    const replacement =
                        record?.exists &&
                        !record.softRedirectUnresolved &&
                        record.ns === 14
                            ? record
                            : replacements.length === 1
                              ? replacements[0]
                              : undefined;
                    categoryChecks.push({
                        requested: title,
                        evidence: reference('zh', record),
                        replacement: replacement
                            ? reference('zh', replacement)
                            : null,
                    });
                    if (!replacement) {
                        if (record?.softRedirectUnresolved)
                            counts.unresolvedCategoryRedirects += 1;
                        else counts.missingCategoriesRemoved += 1;
                        return [];
                    }
                    const canonical = stripNamespace(replacement.title);
                    if (canonical !== title) counts.categoriesChanged += 1;
                    return [canonical];
                },
            );
            result.categories = [...new Set(result.categories)];
            const stems = new Set(
                [
                    definition.label,
                    article?.title,
                    englishTitle,
                    ...definition.aliases.filter(
                        (alias) => typeof alias === 'string',
                    ),
                ]
                    .filter(Boolean)
                    .map(categoryStem),
            );
            for (const title of discovered.zh[type]) {
                const category = zhCategories.get(normalizeTitle(title));
                if (
                    !category?.exists ||
                    category.ns !== 14 ||
                    category.softRedirectUnresolved ||
                    !stems.has(categoryStem(category.title))
                )
                    continue;
                const canonical = stripNamespace(category.title);
                if (!result.categories.includes(canonical)) {
                    result.categories.push(canonical);
                    counts.categoriesAdded += 1;
                    categoryChecks.push({
                        requested: null,
                        evidence: reference('zh', category),
                        replacement: reference('zh', category),
                    });
                }
            }
            if (!definition.categories && !result.categories.length)
                delete result.categories;
            const templateChecks = [];
            for (const field of ['stubTags', 'navboxes']) {
                if (!definition[field]) continue;
                result[field] = definition[field].flatMap((title) => {
                    const record = zhTemplates.get(
                        normalizeTitle(`Template:${title}`),
                    );
                    templateChecks.push({
                        field,
                        requested: title,
                        chinese: reference('zh', record),
                        english: reference(
                            'en',
                            enTemplates.get(
                                normalizeTitle(`Template:${title}`),
                            ),
                        ),
                    });
                    if (!record?.exists || record.ns !== 10) {
                        counts.missingTemplatesRemoved += 1;
                        return [];
                    }
                    const canonical = stripNamespace(record.title);
                    if (normalizeTitle(canonical) === normalizeTitle(title))
                        return [title];
                    counts.templateRedirects += 1;
                    return [canonical];
                });
                result[field] = [...new Set(result[field])];
            }
            if (
                index >= original[type].length &&
                ['platforms', 'genres'].includes(type)
            ) {
                const genericStub = zhTemplates.get(
                    normalizeTitle('Template:Videogame-stub'),
                );
                if (
                    genericStub?.exists &&
                    genericStub.ns === 10 &&
                    !genericStub.fragment
                ) {
                    result.stubTags = [stripNamespace(genericStub.title)];
                    templateChecks.push({
                        field: 'stubTags',
                        requested: null,
                        chinese: reference('zh', genericStub),
                        english: null,
                    });
                    counts.stubTemplatesAdded += 1;
                }
            }
            const navigationChecks = [];
            if (type === 'companies') {
                const gameCategories = new Set(
                    (result.categories || []).map((title) =>
                        normalizeTitle(`Category:${title}`),
                    ),
                );
                for (const template of companyNavigation[index]) {
                    const game = findNavigationGame(
                        template,
                        navigationGames,
                        gameCategories,
                    );
                    const head = navigationHeads.get(
                        normalizeTitle(getNavigationHead(template)),
                    );
                    navigationChecks.push({
                        template: reference('zh', template),
                        head: reference('zh', head),
                        game: reference('zh', game),
                        accepted: Boolean(game),
                    });
                    const canonical = stripNamespace(template.title);
                    if (game && !(result.navboxes || []).includes(canonical)) {
                        result.navboxes = [
                            ...(result.navboxes || []),
                            canonical,
                        ];
                        counts.navigationTemplatesAdded += 1;
                    }
                }
            }
            terms.push({
                type,
                label: definition.label,
                articleReason: selection.reason,
                configuredArticle: reference(
                    'zh',
                    definition.page &&
                        zhArticles.get(normalizeTitle(definition.page)),
                ),
                chineseArticle: reference('zh', article),
                englishArticle: reference('en', englishArticle),
                chineseRedirects: reference(
                    'zh',
                    article && zhRedirects.get(normalizeTitle(article.title)),
                ),
                englishRedirects: reference(
                    'en',
                    englishTitle &&
                        enRedirects.get(normalizeTitle(englishTitle)),
                ),
                navigation: navigationChecks,
                aliases: definition.aliases.map((alias) =>
                    alias instanceof RegExp
                        ? {
                              pattern: alias.source,
                              flags: alias.flags,
                              preserved: true,
                          }
                        : {
                              alias,
                              chinese: reference(
                                  'zh',
                                  zhArticles.get(normalizeTitle(alias)),
                              ),
                              english: reference(
                                  'en',
                                  enArticles.get(normalizeTitle(alias)),
                              ),
                              preserved: true,
                          },
                ),
                categories: categoryChecks,
                templates: templateChecks,
            });
            return result;
        });
        definitions[type] = addVerifiedAliases(updated, proposals);
        definitions[type].forEach((definition, index) => {
            counts.aliasesAdded +=
                definition.aliases.length -
                (original[type][index]?.aliases.length || 0);
            terms.find(
                (term) => term.type === type && term.label === definition.label,
            ).addedAliases = definition.aliases.filter(
                (alias) =>
                    typeof alias === 'string' &&
                    !(original[type][index]?.aliases || []).some(
                        (old) =>
                            typeof old === 'string' &&
                            normalizeTitle(old) === normalizeTitle(alias),
                    ),
            );
        });
    }
    const outputs = [];
    for (const type of TYPES) {
        const path = join(
            ROOT,
            `src/vg-stub-creator/domain/terminologies/${type}.ts`,
        );
        const content = await format(
            renderCatalog(
                sources[type],
                type === 'years'
                    ? [...definitions[type]].sort(
                          (first, second) =>
                              Number.parseInt(first.label, 10) -
                              Number.parseInt(second.label, 10),
                      )
                    : definitions[type],
            ),
            { ...(await resolveConfig(path)), filepath: path },
        );
        outputs.push({ path, content });
    }
    const report = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        applied: options.apply,
        scope: 'Existing terminology recognition, Chinese article links, categories and stub tags; missing companies/platforms from bounded Chinese article taxonomy traversal, genres from the Chinese genre category, and unlinked years from game-category roots; company navigation templates verified by their head and linked game categories; direct game-category root discovery on Chinese and English Wikipedia. Incoming redirects are recorded for review rather than automatically equated with terminology identities.',
        rights: 'Factual wiki identifiers, page titles, redirects, category membership and language links retain their applicable Wikimedia project status and terms. No article or template prose is bundled. Raw API responses remain in the external task cache. See THIRD-PARTY-NOTICES.md and https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use.',
        counts,
        requestStatistics: collector.statistics,
        discovery: discovered,
        genreCandidates,
        articleDiscovery,
        navigationCandidates,
        requests: [...collector.requestRecords.values()],
        evidence: Object.fromEntries(evidence),
        terms,
    };
    if (options.apply) {
        for (const type of TYPES) {
            const path = join(
                ROOT,
                `src/vg-stub-creator/domain/terminologies/${type}.ts`,
            );
            if ((await readFile(path, 'utf8')) !== sources[type])
                throw new Error(
                    `Catalog changed during collection; refusing to overwrite ${path}`,
                );
        }
        for (const output of outputs)
            await writeFile(output.path, output.content);
    }
    const reportPath = join(
        ROOT,
        'docs/vg-stub-creator/data/terminology-sources.json',
    );
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(
        reportPath,
        await format(JSON.stringify(report), { parser: 'json', tabWidth: 4 }),
    );
    console.log(
        JSON.stringify(
            {
                applied: options.apply,
                ...counts,
                ...collector.statistics,
                report: reportPath,
            },
            null,
            2,
        ),
    );
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
    await main();
