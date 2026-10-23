/**
 * @file scripts/vg-stub-creator/terminology-navigation.mjs
 * Purpose: Match navigation templates to terminology using explicit API evidence.
 *
 * Table of contents:
 * 1. Constants and state
 * 2. normalizeNavigationTitle
 * 3. isCanonicalPage
 * 4. isNavigationTemplate
 * 5. getEstablishedTemplateNames
 * 6. getNavigationCategoryRoots
 * 7. findNavigationTemplates
 * 8. getNavigationHead
 * 9. findNavigationGame
 */

const NAVIGATION_IMPLEMENTATIONS = new Set([
    'navbox',
    'navbox with columns',
    'navbox with collapsible groups',
    'navbox subgroup',
    '導航模板',
    '导航模板',
    '導航模板/子群組',
    '导航模板/子群组',
]);
const GENERAL_NAVIGATION_NAMES = new Set([
    '电子游戏',
    '電子遊戲',
    '电子游戏公司',
    '電子遊戲公司',
    '电子游戏硬件',
    '電子遊戲硬件',
    '电子游戏机',
    '電子遊戲機',
    'video games',
    'video game companies',
    'video game hardware',
    'video game consoles',
]);

function normalizeNavigationTitle(value) {
    if (typeof value !== 'string') return '';
    return value
        .replaceAll('_', ' ')
        .trim()
        .replace(/\s+/gu, ' ')
        .replace(/^(?:template|模板|样板|樣板)\s*:\s*/iu, 'Template:')
        .replace(/^(?:category|分类|分類)\s*:\s*/iu, 'Category:')
        .toLowerCase();
}

/** Missing, unresolved, fragmented, and ambiguous pages cannot prove an association. */
function isCanonicalPage(record, namespace) {
    if (
        !record ||
        typeof record !== 'object' ||
        Array.isArray(record) ||
        record.exists !== true ||
        record.ns !== namespace ||
        typeof record.title !== 'string' ||
        !record.title.trim() ||
        record.title.includes('#') ||
        record.fragment ||
        record.tofragment ||
        record.redirect === true ||
        (Object.hasOwn(record, 'missing') && record.missing !== false) ||
        (Object.hasOwn(record, 'invalid') && record.invalid !== false) ||
        (record.pageid !== undefined &&
            (!Number.isSafeInteger(record.pageid) || record.pageid <= 0))
    )
        return false;
    const props = record.pageprops;
    return (
        props === undefined ||
        (props !== null &&
            typeof props === 'object' &&
            !Array.isArray(props) &&
            !Object.hasOwn(props, 'disambiguation'))
    );
}

function isNavigationTemplate(record) {
    const title = normalizeNavigationTitle(record.title);
    return (
        title.startsWith('template:') &&
        !/\/(?:doc|sandbox|testcases|沙盒|测试|測試|说明|說明)(?:\/|$)/u.test(
            title,
        ) &&
        Array.isArray(record.templates) &&
        record.templates.some((template) => {
            if (
                template?.ns !== 10 ||
                typeof template.title !== 'string' ||
                template.title.includes('#') ||
                template.fragment
            )
                return false;
            const implementation = normalizeNavigationTitle(template.title);
            return (
                implementation.startsWith('template:') &&
                NAVIGATION_IMPLEMENTATIONS.has(implementation.slice(9))
            );
        })
    );
}

/** Patterns never establish identity; game-list suffixes stay tied to exact names. */
function getEstablishedTemplateNames(definition, article) {
    const aliases = Array.isArray(definition?.aliases)
        ? definition.aliases
        : [];
    const names = new Set();
    for (const value of [
        definition?.label,
        definition?.page,
        ...aliases,
        article.title,
    ]) {
        if (typeof value !== 'string' || value.includes('#')) continue;
        const name = normalizeNavigationTitle(value);
        if (!name || GENERAL_NAVIGATION_NAMES.has(name)) continue;
        names.add(name);
        for (const suffix of ['遊戲', '游戏', '電子遊戲', '电子游戏'])
            names.add(`${name}${suffix}`);
        for (const suffix of ['games', 'video games'])
            names.add(`${name} ${suffix}`);
    }
    return names;
}

export function getNavigationCategoryRoots() {
    return {
        companies: ['电子游戏公司导航模板'],
        platforms: ['电子游戏硬件导航模板'],
    };
}

/** Return canonical template records only when every association check agrees. */
export function findNavigationTemplates(
    definition,
    article,
    templates,
    allowedTemplates,
) {
    if (
        !isCanonicalPage(article, 0) ||
        !(templates instanceof Map) ||
        !(allowedTemplates instanceof Set)
    )
        return [];
    const allowed = new Set(
        [...allowedTemplates].map(normalizeNavigationTitle).filter(Boolean),
    );
    const names = getEstablishedTemplateNames(definition, article);
    const articleTitle = normalizeNavigationTitle(article.title);
    const matches = new Map();
    for (const record of templates.values()) {
        if (!isCanonicalPage(record, 10) || !isNavigationTemplate(record))
            continue;
        const title = normalizeNavigationTitle(record.title);
        const name = title.slice(9);
        if (
            !allowed.has(title) ||
            GENERAL_NAVIGATION_NAMES.has(name) ||
            !names.has(name) ||
            !Array.isArray(record.links) ||
            !record.links.some(
                (link) =>
                    link?.ns === 0 &&
                    typeof link.title === 'string' &&
                    !link.title.includes('#') &&
                    !link.fragment &&
                    !link.tofragment &&
                    normalizeNavigationTitle(link.title) === articleTitle,
            )
        )
            continue;
        matches.set(title, record);
    }
    return [...matches.values()];
}

/** Extract only an explicit, unambiguous, single-line navigation heading link. */
export function getNavigationHead(templateRecord) {
    if (
        !isCanonicalPage(templateRecord, 10) ||
        !isNavigationTemplate(templateRecord)
    )
        return undefined;
    const content = templateRecord.revisions?.[0]?.slots?.main?.content;
    if (typeof content !== 'string') return undefined;
    const markup = content.replace(/<!--[\s\S]*?-->/gu, (comment) =>
        comment.replace(/[^\r\n]/gu, ' '),
    );
    if (markup.includes('<!--') || markup.includes('-->')) return undefined;
    const parameters = [...markup.matchAll(/\|[ \t]*title[ \t]*=/giu)];
    if (parameters.length !== 1) return undefined;
    const parameter = parameters[0];
    const line = markup
        .slice(parameter.index + parameter[0].length)
        .split(/\r?\n/u)[0];
    let inLink = false;
    let end = line.length;
    for (let index = 0; index < line.length; index += 1) {
        const pair = line.slice(index, index + 2);
        if (pair === '[[') {
            if (inLink) return undefined;
            inLink = true;
            index += 1;
        } else if (pair === ']]') {
            if (!inLink) return undefined;
            inLink = false;
            index += 1;
        } else if (!inLink && (line[index] === '|' || pair === '}}')) {
            end = index;
            break;
        }
    }
    if (inLink) return undefined;
    const heading = line.slice(0, end);
    const links = [...heading.matchAll(/\[\[([^[\]\r\n]+)\]\]/gu)];
    if (
        !links.length ||
        /[[\]{}<>]/u.test(heading.replace(/\[\[[^[\]\r\n]+\]\]/gu, ''))
    )
        return undefined;
    const targets = new Map();
    for (const link of links) {
        const target = link[1].split('|')[0].trim().replace(/^:\s*/u, '');
        const normalized = normalizeNavigationTitle(target);
        if (!normalized || /[#{}<>]/u.test(target)) return undefined;
        targets.set(normalized, target);
    }
    return targets.size === 1 ? [...targets.values()][0] : undefined;
}

/** A verified game-category member supplies evidence beyond a corporate board. */
export function findNavigationGame(
    templateRecord,
    articleRecords,
    allowedCategories,
) {
    if (
        !(articleRecords instanceof Map) ||
        !(allowedCategories instanceof Set) ||
        !Array.isArray(templateRecord?.links)
    )
        return undefined;
    const head = getNavigationHead(templateRecord);
    if (!head) return undefined;
    const headTitle = normalizeNavigationTitle(head);
    const company = articleRecords.get(headTitle);
    if (!isCanonicalPage(company, 0)) return undefined;
    const canonicalHead = normalizeNavigationTitle(company.title);
    const categories = new Set(
        [...allowedCategories]
            .map(normalizeNavigationTitle)
            .filter(
                (title) =>
                    title.startsWith('category:') && !title.includes('#'),
            ),
    );
    for (const link of templateRecord.links) {
        if (
            link?.ns !== 0 ||
            typeof link.title !== 'string' ||
            link.title.includes('#') ||
            link.fragment ||
            link.tofragment
        )
            continue;
        const requested = normalizeNavigationTitle(link.title);
        const candidate = articleRecords.get(requested);
        if (
            requested === headTitle ||
            !isCanonicalPage(candidate, 0) ||
            normalizeNavigationTitle(candidate.title) === canonicalHead ||
            !Array.isArray(candidate.categories)
        )
            continue;
        if (
            candidate.categories.some(
                (category) =>
                    category?.ns === 14 &&
                    typeof category.title === 'string' &&
                    !category.title.includes('#') &&
                    !category.fragment &&
                    !category.tofragment &&
                    categories.has(normalizeNavigationTitle(category.title)),
            )
        )
            return candidate;
    }
    return undefined;
}
