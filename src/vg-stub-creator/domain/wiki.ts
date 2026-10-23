/**
 * @file src/vg-stub-creator/domain/wiki.ts
 * Purpose: Reviewed article prose, infoboxes, titles, categories, and reference sections.
 * Contents: Deterministic metadata rendering and shared local normalization.
 */

import type {
    AggregateScoreRecord,
    ProcessedArticleData,
    SourceTags,
} from './models.ts';
import { get as getTerminology } from './terminologies/index.ts';
import { buildReferencesSection } from './reference-wikitext.ts';
import * as wikitext from './wikitext/index.ts';
import {
    formatNamespaceTitle,
    stripNamespacePrefix,
} from '../../library/wiki-titles/wikipedia.ts';

const { buildTemplateCall, buildTemplateText, trimValue, uniqueValues } =
    wikitext;

/**
 * Builds a source reference key for one localized name row.
 *
 * @param key - Localized name group key.
 * @param index - Row index.
 * @returns Source reference key.
 */
export function buildNameSourceReferenceKey(
    key: string,
    index: number,
): string {
    return `${key}.${index}`;
}

const textTemplates = {
    // Punctuation shared by prose and normalized field display.
    shared: {
        conjunction: '和',
        enumerationSeparator: '、',
        portal: '电子游戏',
    },

    // Reusable title, year, and series formatting patterns.
    patterns: {
        // Generic page and category title candidates.
        titleGame: '{title}游戏',
        titleSeries: '{title}系列',
        titleSeriesVideoGames: '{title}系列电子游戏',
        titleVideoGames: '{title}电子游戏',

        // Release-year phrases and category.
        yearFuture: '未来电子游戏',
        yearPlanned: '预定于{year}推出的',
        yearReleased: '{year}',
        yearUnreleased: '尚未推出的',

        // Series display text used in prose.
        derivativeWorkDisplayTitle: '《{title}》衍生作品',
        seriesDisplayTitle: '《{title}》系列',
    },

    // Text shown in the generated article's main prose paragraph.
    prose: {
        // Complete paragraph from four sentence outputs.
        text: '{sentence1}{sentence2}{sentence3}{sentence4}',

        // Sentence 1 joins sentence 1a and optional sentence 1b.
        sentence1: '{text}。',
        sentence1Separator: '，',

        // Sentence 1a: titles, release year, and genre.
        sentence1a: '{titles}是{yearGenre}',
        countedSentence1a: '是{yearGenre}',
        titles: "《'''{name}'''》{foreignTitle}",
        foreignTitle: '（{title}{sourceTag}）',
        yearGenre: '{prefix}[[电子游戏]]{sourceTag}',
        fallbackYearGenrePrefix: '一款',
        genreClass: '{genreText}类',

        // Sentence 1b: developer and publisher attribution.
        sentence1b: '由{roleText}{sourceTag}',
        developed: '{developers}开发',
        developedAndPublished: '{developers}开发及发行',
        developedThenPublished: '{developers}开发、{publishers}发行',
        published: '{publishers}发行',

        // Sentence 2: supported platforms and game series.
        sentence2:
            '作品对应{platformText}平台{platformSourceTag}{seriesClause}。',
        seriesClause: '，属于{seriesText}{seriesSourceTag}',
        seriesOnly: '作品属于{seriesText}{seriesSourceTag}。',
        seriesTitle: '「{value}」',

        // Sentence 3: aggregate review scores.
        sentence3: '游戏的{clauses}。',
        scoreSeparator: '，',
        metacritic: '[[Metacritic]]汇总得分为{score}/100',
        metacriticPlatformEdition: '（{label}版）',
        openCritic: '[[OpenCritic]]评测推荐率为{score}%',

        // Sentence 4: user-entered appended prose.
        sentence4: '{text}{sourceTag}',
        sentence4WithPeriod: '{text}{sourceTag}。',
    },

    // Heading shown above generated citation definitions.
    referencesHeading: '参考文献',

    // Text shown on generated company-category helper pages.
    handlers: {
        // Company category page title and prose.
        allCompaniesCategory: '各公司电子游戏',
        companyCategoryDescription:
            '本分類收錄由[[{company}]]開發、發行的電子遊戲作品。',
    },
};

/**
 * Formats generated text from the injected JSONC template catalog.
 */

const TEXT_TEMPLATES = textTemplates;

/**
 * Gets one template value by dotted key.
 *
 * @param key - Dotted template key.
 * @returns Template string.
 */
export function getTextTemplate(key: string): string {
    const splitResult = key.split('.');
    const value = resolveTemplateValue(TEXT_TEMPLATES, splitResult);

    if (typeof value !== 'string') {
        throw new Error(`Missing text template: ${key}`);
    }

    return value;
}

/**
 * Resolves nested paths while allowing literal dots in property names.
 *
 * @param data - Current template object.
 * @param parts - Remaining dotted-key parts.
 * @returns Resolved value.
 */
function resolveTemplateValue(data: any, parts: Array<string>): any {
    if (data == null || parts.length === 0) {
        return data;
    }

    for (let length = parts.length; length > 0; length -= 1) {
        const property = parts.slice(0, length).join('.');

        if (Object.hasOwn(data, property)) {
            const slicedValueA = parts.slice(length);
            return resolveTemplateValue(data[property], slicedValueA);
        }
    }

    return undefined;
}

/**
 * Substitutes named placeholders in one text template.
 *
 * @param key - Dotted template key.
 * @param values - Placeholder values.
 * @returns Formatted text.
 */
export function formatText(key: string, values: any = {}): string {
    const template = getTextTemplate(key);
    const replaceCallbackA = function callback(
        placeholder: string,
        name: string,
    ) {
        if (!Object.hasOwn(values, name)) {
            return placeholder;
        }

        return String(values[name] ?? '');
    };
    const result = template.replace(
        /\{([A-Za-z][A-Za-z0-9]*)\}/gu,
        replaceCallbackA,
    );

    return result;
}

/**
 * Composes complete prose sentences from optional clauses.
 */

/**
 * Joins sentence 1a and optional sentence 1b.
 *
 * @param sentence1a - Title, year, and genre clause.
 * @param sentence1b - Company attribution clause.
 * @returns Complete first sentence.
 */
export function buildSentence1Text(
    sentence1a: string,
    sentence1b: string = '',
): string {
    const separator = getTextTemplate('prose.sentence1Separator');
    const text = [sentence1a, sentence1b].filter(Boolean).join(separator);
    const values = {
        text,
    };
    const sentence = formatText('prose.sentence1', values);

    return sentence;
}

interface AggregateScoresParams {
    metacriticPlatform?: string;
    metacriticScore?: string;
    metacriticSourceTag?: string;
    openCriticRecommend?: string;
    openCriticSourceTag?: string;
}

interface NormalizedMetacriticScore {
    platform: string;
    score: string;
}

/**
 * Builds aggregate review score sentence text.
 *
 * @param params - Aggregate score parameters.
 * @param params.metacriticPlatform - Metacritic platform.
 * @param params.metacriticScore - Metacritic score.
 * @param params.metacriticSourceTag - Metacritic source tag.
 * @param params.openCriticRecommend - OpenCritic
 * recommendation
 * rate.
 * @param params.openCriticSourceTag - OpenCritic source tag.
 * @returns Aggregate score sentence, or an empty string.
 */
function buildAggScoresText(params: AggregateScoresParams): string {
    const clauses = [
        buildMetacriticClause(params),
        buildOpenCriticClause(params),
    ].filter(Boolean);

    if (clauses.length === 0) {
        return '';
    }

    const textResultC = getTextTemplate('prose.scoreSeparator');
    const joinedText = {
        clauses: clauses.join(textResultC),
    };
    const result = formatText('prose.sentence3', joinedText);
    return result;
}

/**
 * Builds Metacritic score text.
 *
 * @param params - Aggregate score parameters.
 * @param params.metacriticPlatform - Metacritic platform.
 * @param params.metacriticScore - Metacritic score.
 * @param params.metacriticSourceTag - Metacritic source tag.
 * @returns Metacritic clause, or an empty string.
 */
function buildMetacriticClause(params: AggregateScoresParams): string {
    const { platform, score } = normalizeMetacriticScoreParams(params);

    if (!hasDigit(score)) {
        return '';
    }

    const result =
        formatText('prose.metacritic', { score }) +
        buildPlatformEditionText(platform) +
        (params.metacriticSourceTag || '');
    return result;
}

/**
 * Builds OpenCritic score text.
 *
 * @param params - Aggregate score parameters.
 * @param params.openCriticRecommend - OpenCritic
 * recommendation
 * rate.
 * @param params.openCriticSourceTag - OpenCritic source tag.
 * @returns OpenCritic clause, or an empty string.
 */
function buildOpenCriticClause(params: AggregateScoresParams): string {
    const score = trimValue(params.openCriticRecommend || '');

    if (!hasDigit(score)) {
        return '';
    }

    const result =
        formatText('prose.openCritic', { score }) +
        (params.openCriticSourceTag || '');
    return result;
}

/**
 * Normalizes Metacritic score inputs.
 *
 * @param params - Aggregate score parameters.
 * @param params.metacriticPlatform - Metacritic platform.
 * @param params.metacriticScore - Metacritic score.
 * @returns Normalized platform and score values.
 */
function normalizeMetacriticScoreParams(
    params: AggregateScoresParams,
): NormalizedMetacriticScore {
    const platform = trimValue(params.metacriticPlatform || '');
    const score = trimValue(params.metacriticScore || '');

    if (!hasDigit(score) && hasDigit(platform)) {
        const result = {
            platform: score,
            score: platform,
        };
        return result;
    }

    const result = {
        platform,
        score,
    };
    return result;
}

/**
 * Builds platform edition text for Metacritic.
 *
 * @param platform - Platform value.
 * @returns Platform edition text, or an empty string.
 */
function buildPlatformEditionText(platform: string): string {
    const label = getPlatformLabel(platform);

    if (label === '') {
        return '';
    }

    const result = formatText('prose.metacriticPlatformEdition', {
        label,
    });
    return result;
}

/**
 * Gets an unlinked platform label.
 *
 * @param platform - Platform value.
 * @returns Unlinked platform label.
 */
function getPlatformLabel(platform: string): string {
    const value = trimValue(platform || '');

    if (value === '') {
        return '';
    }

    return getTerminology('platform', value, 'label') || value;
}

/**
 * Checks whether a value contains at least one digit.
 *
 * @param value - Value to inspect.
 * @returns Whether the value contains a digit.
 */
function hasDigit(value: string): boolean {
    return /\d/u.test(value);
}

/**
 * Builds DEFAULTSORT wikitext for video game stubs.
 */

/**
 * Builds a DEFAULTSORT magic word.
 *
 * @param params - Default sort parameters.
 * @param params.title - Article title.
 * @param params.original - Original title.
 * @param params.english - English title.
 * @param params.sortKey - User-entered sort key.
 * @returns DEFAULTSORT wikitext.
 */
export function buildDefaultSortText(params: any): string {
    return `{{DEFAULTSORT:${buildDefaultSortKey(params)}}}`;
}

/**
 * Builds a default sort key.
 *
 * @param params - Default sort parameters.
 * @param params.title - Article title.
 * @param params.original - Original title.
 * @param params.english - English title.
 * @param params.sortKey - User-entered sort key.
 * @returns Sort key.
 */
export function buildDefaultSortKey(params: any): string {
    const sortKey = normalizeOptionalText(params.sortKey);

    if (sortKey != null) {
        return sortKey;
    }

    const original = normalizeOptionalText(params.original);

    if (original != null && !hasNonLatinLetter(original)) {
        return normalizeSortKey(original);
    }

    return normalizeSortKey(params.english || params.title);
}

/**
 * Normalizes one sort key.
 *
 * @param value - Raw sort key.
 * @returns Normalized sort key.
 */
function normalizeSortKey(value: string): string {
    const defaultSortValueResult = normalizeOptionalText(value) || '';
    const sortPunctuationResult = normalizeSortPunctuation(
        defaultSortValueResult,
    );
    const result = toTitleUpperCase(sortPunctuationResult);
    return result;
}

/**
 * Normalizes easy punctuation and symbol cases for sort keys.
 *
 * @param value - Raw sort key.
 * @returns Sort key with mechanical punctuation cleanup.
 */
function normalizeSortPunctuation(value: string): string {
    const result = value
        .normalize('NFKC')
        .replace(/\.{3,}/gu, ' ')
        .replace(/(\d)[,.](?=\d)/gu, '$1')
        .replace(/[‐‑‒–—―−]/gu, '-')
        .replace(/&/gu, ' and ')
        .replace(/×/gu, ' x ')
        .replace(/\bO'(?=\p{Letter})/gu, 'O')
        .replace(/[^\p{Letter}\p{Mark}\p{Number}\s.'-]+/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
    return result;
}

/**
 * Converts a value to title-style uppercase.
 *
 * @param value - Raw value.
 * @returns Title-style value.
 */
function toTitleUpperCase(value: string): string {
    const result = value
        .replace(/\s+/gu, ' ')
        .replace(/\p{Letter}[\p{Letter}\p{Mark}'’-]*/gu, titleUpperWord);
    return result;
}

/**
 * Converts one word to title-style uppercase.
 *
 * @param word - Word to convert.
 * @returns Title-style word.
 */
function titleUpperWord(word: string): string {
    const replaceCallback = function callback(character: string) {
        return character.toLocaleUpperCase();
    };
    const result = word
        .toLocaleLowerCase()
        .replace(/(^|-)\p{Letter}/gu, replaceCallback);
    return result;
}

/**
 * Checks whether a value contains a non-Latin letter.
 *
 * @param value - Value to inspect.
 * @returns Whether the value contains a non-Latin letter.
 */
function hasNonLatinLetter(value: string): boolean {
    return Array.from(value).some(isNonLatinLetter);
}

/**
 * Checks whether one character is a non-Latin letter.
 *
 * @param character - Character to inspect.
 * @returns Whether the character is a non-Latin letter.
 */
function isNonLatinLetter(character: string): boolean {
    return (
        /\p{Letter}/u.test(character) && !/\p{Script=Latin}/u.test(character)
    );
}

/**
 * Builds category wikitext links from review rows.
 *
 * @param rows - Category review rows.
 * @returns Category link wikitext.
 */
function buildCategoryLinks(rows: Array<any>): Array<string> {
    return rows.filter(isRenderableCategoryRow).map(buildCategoryLink);
}

/**
 * Builds category wikitext from accepted article metadata.
 *
 * @param params - Normalized article parameters.
 * @returns Category wikitext.
 */
function buildCategoryText(params: ProcessedArticleData): string {
    const categoryText = getCategoryLinks(params).join('\n');

    if (categoryText === '') {
        return '';
    }

    const result = `${params.renderers.defaultSort}\n${categoryText}`;

    return result;
}

/**
 * Gets category links from reviewed rows.
 *
 * @param params - Normalized article parameters.
 * @returns Category links.
 */
function getCategoryLinks(params: ProcessedArticleData): Array<string> {
    const rows = sortCategoryRowsByProse(
        params.records.review.metadata.categoryRows,
        params.prose?.text || '',
    );
    const result = buildCategoryLinks(rows);

    return result;
}

/**
 * Builds stub tag wikitext from accepted article metadata.
 *
 * @param params - Normalized article parameters.
 * @returns Stub tag wikitext.
 */
function buildStubTagText(params: ProcessedArticleData): string {
    const stubTags = getStubTagRows(params)
        .filter((row) => row.enabled)
        .map((row) => row.stubTag);
    const result = uniqueValues(stubTags).map(buildTemplateCall).join('\n');

    return result;
}

/**
 * Gets unique stub-tag review rows in related prose order.
 *
 * @param params - Normalized article parameters.
 * @returns Stub-tag review rows.
 */
function getStubTagRows(params: ProcessedArticleData): Array<any> {
    if (Array.isArray(params.records.review.metadata.stubTagRows)) {
        return getReviewedStubTagRows(
            params.records.review.metadata.stubTagRows,
        );
    }

    const rows = sortCategoryRowsByProse(
        params.records.review.metadata.categoryRows,
        params.prose?.text || '',
    ).filter(hasStubTag);
    const mapCallbackJ = (row: any) => normalizeStubTag(row.stubTag);
    const mappedValuesC = rows.map(mapCallbackJ);
    const stubTags = uniqueValues(mappedValuesC);

    const mapCallbackI = function callback(stubTag: string) {
        const someCallbackC = function callback(row: any) {
            const result =
                normalizeStubTag(row.stubTag) === stubTag &&
                row.stubTagEnabled === true;
            return result;
        };
        const result = {
            enabled: rows.some(someCallbackC),
            stubTag,
        };
        return result;
    };
    const result = stubTags.map(mapCallbackI);
    return result;
}

/**
 * Defines the module-level get reviewed stub tag rows.
 *
 * @param rows - Row values.
 * @returns Result when the function
 *   defines the module-level get reviewed stub tag
 *   rows.
 */
function getReviewedStubTagRows(
    rows: Array<{ enabled: boolean; stubTag: string }>,
) {
    const mapCallbackH = (row: { enabled: boolean; stubTag: string }) =>
        normalizeStubTag(row.stubTag);
    const mappedValuesB = rows.map(mapCallbackH);
    const stubTags = uniqueValues(mappedValuesB);

    const mapCallbackG = function callback(stubTag: string) {
        const someCallbackB = function callback(row: {
            stubTag: unknown;
            enabled: boolean;
        }) {
            const result =
                normalizeStubTag(row.stubTag) === stubTag &&
                row.enabled !== false;
            return result;
        };
        const result = {
            enabled: rows.some(someCallbackB),
            stubTag,
        };
        return result;
    };
    const result = stubTags.filter(Boolean).map(mapCallbackG);
    return result;
}

/**
 * Defines the module-level is renderable category row.
 *
 * @param row - Row values.
 * @returns Result when the function
 *   defines the module-level is renderable category
 *   row.
 */
function isRenderableCategoryRow(row: { enabled: boolean; category: unknown }) {
    return row.enabled !== false && normalizeCategoryTitle(row.category) !== '';
}

/**
 * Defines the module-level has stub tag.
 *
 * @param row - Row values.
 * @returns Result when the function
 *   defines the module-level has stub tag.
 */
function hasStubTag(row: { category: unknown; stubTag: unknown }) {
    const result =
        normalizeCategoryTitle(row.category) !== '' &&
        normalizeStubTag(row.stubTag) !== '';
    return result;
}

/**
 * Sorts category rows by the first related mention in generated prose.
 *
 * @param rows - Category review rows.
 * @param prose - Generated article prose.
 * @returns Prose-ordered category rows.
 */
export function sortCategoryRowsByProse(
    rows: Array<any>,
    prose: string,
): Array<any> {
    const stripLeadTitleTextResult = stripLeadTitleText(prose);
    const normalizedProse = normalizeRelatedText(stripLeadTitleTextResult);

    if (normalizedProse === '') {
        return rows;
    }

    const mapCallbackF = function callback(row: any, index: number) {
        const result = {
            index,
            position: getCategoryProsePosition(row, normalizedProse),
            row,
        };
        return result;
    };
    const result = rows
        .map(mapCallbackF)
        .sort(function callback(left, right) {
            if (left.position === right.position) {
                return left.index - right.index;
            }

            return left.position - right.position;
        })
        .map((item) => item.row);
    return result;
}

/**
 * Defines the module-level get category prose position.
 *
 * @param row - Row values.
 * @param prose - Prose value.
 * @returns Result when the function
 *   defines the module-level get category prose
 *   position.
 */
function getCategoryProsePosition(
    row: { category: unknown; originalCategory: unknown },
    prose: string | string[],
) {
    const categoryTitleResult = [
        normalizeCategoryTitle(row.category),
        normalizeCategoryTitle(row.originalCategory),
    ];
    const titles = uniqueValues(categoryTitleResult);
    const mapCallbackE = (term: string) => prose.indexOf(term);
    const positions = titles
        .flatMap(getCategorySearchTerms)
        .map(mapCallbackE)
        .filter((position) => position >= 0);

    return positions.length === 0
        ? Number.POSITIVE_INFINITY
        : Math.min(...positions);
}

/**
 * Defines the module-level get category search terms.
 *
 * @param category - Category value.
 * @returns Result when the function
 *   defines the module-level get category search
 *   terms.
 */
function getCategorySearchTerms(category: string) {
    const normalized = normalizeRelatedText(category);
    const gameSuffixSource = ['(?:电子游戏|電子遊戲', '|游戏|遊戲)$'].join('');
    const gameSuffix = new RegExp(gameSuffixSource, 'u');
    const stem = normalized.replace(gameSuffix, '');

    return uniqueValues([normalized, stem]).filter(Boolean);
}

/**
 * Defines the module-level strip lead title text.
 *
 * @param prose - Prose value.
 * @returns Result when the function
 *   defines the module-level strip lead title text.
 */
function stripLeadTitleText(prose: string) {
    const result = trimCategoryValue(prose)
        .replace(/^《[^》]+》(?:（[^）]+）)?/u, '')
        .replace(/^''[^']+''(?:（[^）]+）)?/u, '');
    return result;
}

/**
 * Defines the module-level normalize related text.
 *
 * @param value - Input value.
 * @returns Result when the function
 *   defines the module-level normalize related text.
 */
function normalizeRelatedText(value: string) {
    const toLocaleLowerCaseResult = trimCategoryValue(value)
        .replace(/\[\[([^|\]]+\|)?([^\]]+)\]\]/gu, '$2')
        .replace(/[\s\u200e\u200f]/gu, '')
        .toLocaleLowerCase();
    const result = foldChineseVariants(toLocaleLowerCaseResult);
    return result;
}

/**
 * Defines the module-level fold chinese variants.
 *
 * @param value - Input value.
 * @returns Result when the function
 *   defines the module-level fold chinese variants.
 */
function foldChineseVariants(value: string) {
    const result = value
        .replace(/電/gu, '电')
        .replace(/體/gu, '体')
        .replace(/遊/gu, '游')
        .replace(/戲/gu, '戏')
        .replace(/鬥/gu, '斗');
    return result;
}

/**
 * Defines the module-level build category link.
 *
 * @param row - Row values.
 * @returns Result when the function
 *   defines the module-level build category link.
 */
function buildCategoryLink(row: { category: unknown }) {
    const title = formatNamespaceTitle(
        normalizeCategoryTitle(row.category),
        'zhwiki',
        14,
    );
    return `[[${title}]]`;
}

/**
 * Defines the module-level normalize category title.
 *
 * @param value - Input value.
 * @returns Result when the function
 *   defines the module-level normalize category title.
 */
function normalizeCategoryTitle(value: unknown) {
    const result = stripNamespacePrefix(trimCategoryValue(value), 'zhwiki', 14);
    return result;
}

/**
 * Defines the module-level normalize stub tag.
 *
 * @param value - Input value.
 * @returns Result when the function
 *   defines the module-level normalize stub tag.
 */
function normalizeStubTag(value: unknown) {
    const result = trimCategoryValue(value)
        .replace(/^\{\{/u, '')
        .replace(/\}\}$/u, '')
        .trim();
    return result;
}

/**
 * Defines the module-level trim value.
 *
 * @param value - Input value.
 * @returns Result when the function
 *   defines the module-level trim value.
 */
function trimCategoryValue(value: unknown): string {
    return value == null ? '' : String(value).trim();
}

/**
 * Builds footer maintenance templates for video game stubs.
 */

/**
 * Builds the video game portal bar and authority control templates.
 *
 * @returns Footer template wikitext.
 */
function buildFooterTemplateText(): string {
    const portal = getTextTemplate('shared.portal');
    const text = [`{{Portal bar|${portal}}}`, '{{Authority control}}'].join(
        '\n',
    );

    return text;
}

const NAME_MARKETS = ['ww', 'hans', 'hant', 'cn', 'tw', 'hk'];

/**
 * Builds an Infobox VG template.
 *
 * @param params - Infobox parameters.
 * @param params.name - Article title.
 * @param params.englishName - English title.
 * @param params.japaneseName - Japanese title.
 * @param params.originalLanguage - Original title language
 * code.
 * @param params.originalName - Original title.
 * @param params.officialNames - Official name rows.
 * @param params.commonNames - Common name rows.
 * @returns Infobox template wikitext.
 */
function buildInfoboxText(params: any): string {
    const infoboxParams: Parameters<typeof buildTemplateText>[1] = [
        ['onlysourced', 'no'],
        ['title', normalizeOptionalText(params.name)],
        ['original', buildOriginalNameText(params)],
        ['japanese', buildJapaneseNameText(params)],
        ['english', buildEnglishNameText(params)],
        ['official', buildVgnText(params.officialNames)],
        ['common', buildVgnText(params.commonNames)],
    ];
    const result = buildTemplateText('Infobox VG', infoboxParams, 'block');
    return result;
}

/**
 * Builds the original title parameter for non-Japanese original names.
 *
 * @param params - Infobox parameters.
 * @param params.originalLanguage - Original title language
 * code.
 * @param params.originalName - Original title.
 * @returns Original title parameter.
 */
function buildOriginalNameText(params: any): string | undefined {
    const language = normalizeOptionalText(params.originalLanguage);
    const name = normalizeOptionalText(params.originalName);

    if (name == null || language == null || language === 'ja') {
        return undefined;
    }

    if (isSameInfoboxBaseTitle(name, params.name)) {
        return undefined;
    }

    return `${language}:${name}`;
}

/**
 * Builds the Japanese title parameter.
 *
 * @param params - Infobox parameters.
 * @param params.japaneseName - Japanese title.
 * @param params.originalLanguage - Original title language
 * code.
 * @param params.originalName - Original title.
 * @returns Japanese title parameter.
 */
function buildJapaneseNameText(params: any): string | undefined {
    const japaneseName = normalizeOptionalText(params.japaneseName);

    if (japaneseName != null) {
        if (isSameInfoboxBaseTitle(japaneseName, params.name)) {
            return undefined;
        }

        return japaneseName;
    }

    if (normalizeOptionalText(params.originalLanguage) !== 'ja') {
        return undefined;
    }

    const originalName = normalizeOptionalText(params.originalName);

    if (originalName == null) {
        return undefined;
    }

    return isSameInfoboxBaseTitle(originalName, params.name)
        ? undefined
        : originalName;
}

/**
 * Builds the English title parameter.
 *
 * @param params - Infobox parameters.
 * @param params.englishName - English title.
 * @param params.name - Article title.
 * @returns English title parameter.
 */
function buildEnglishNameText(params: any): string | undefined {
    const englishName = normalizeOptionalText(params.englishName);

    if (englishName == null) {
        return undefined;
    }

    if (isSameInfoboxBaseTitle(englishName, params.name)) {
        return undefined;
    }

    return englishName;
}

/**
 * Builds a vgn template from localized name rows.
 *
 * @param rows - Localized name rows.
 * @returns vgn template wikitext.
 */
function buildVgnText(rows: Array<any>): string | undefined {
    const entries = (rows || []).flatMap(buildVgnEntries);

    if (entries.length === 0) {
        return undefined;
    }

    const entryParams: Parameters<typeof buildTemplateText>[1] = entries.map(
        (entry) => [1, entry],
    );
    const result = buildTemplateText('vgn', entryParams);
    return result;
}

/**
 * Builds vgn entries for one localized name row.
 *
 * @param row - Localized name row.
 * @param row.name - Localized name.
 * @param row.markets - Selected market codes.
 * @param row.ref - Reference tag appended to each name.
 * @returns vgn entries.
 */
function buildVgnEntries(row: any): Array<string> {
    const name = normalizeOptionalText(row.name);

    if (name == null) {
        return [];
    }

    const ref = normalizeOptionalText(row.ref) || '';
    const markets = getSelectedMarkets(row);

    if (markets.length === 0) {
        return [`${name}${ref}`];
    }

    return markets.map((market) => `${market}:${name}${ref}`);
}

/**
 * Gets selected market codes for one localized name row.
 *
 * @param row - Localized name row.
 * @param row.markets - Selected market codes.
 * @returns Selected market codes.
 */
function getSelectedMarkets(row: any): Array<string> {
    if (Array.isArray(row.markets)) {
        const filterCallback = (market: string) => row.markets.includes(market);
        return NAME_MARKETS.filter(filterCallback);
    }

    return NAME_MARKETS.filter((market) => row[market] === true);
}

/**
 * Normalizes a user-entered string.
 *
 * @param value - Raw value.
 * @returns Trimmed value, or undefined when empty.
 */
function normalizeOptionalText(value: string): string | undefined {
    if (value == null) {
        return undefined;
    }

    const trimmedValue = String(value).trim();

    return trimmedValue === '' ? undefined : trimmedValue;
}

/**
 * Checks whether a title value duplicates the article's base title.
 *
 * @param value - Title value.
 * @param articleTitle - Article title.
 * @returns Whether the titles are equivalent.
 */
function isSameInfoboxBaseTitle(value: string, articleTitle: string): boolean {
    if (value == null) {
        return false;
    }

    const result =
        normalizeTitleForComparison(value) ===
        normalizeTitleForComparison(articleTitle);
    return result;
}

const ITALIC_LANGUAGE_CODES = new Set(['en', 'fr']);

/**
 * Builds the lead article name text.
 *
 * @param params - Lead name parameters.
 * @param params.englishName - English game title.
 * @param params.name - Article title.
 * @param params.originalLanguage - Original title language
 * code.
 * @param params.originalName - Original game title.
 * @param params.sourceTags - Source reference tags keyed by
 * field.
 * @returns Lead name wikitext.
 */
function buildLeadNameText(params: any): string {
    const values = {
        foreignTitle: buildVariantNameText(params),
        name: params.name,
    };
    const text = formatText('prose.titles', values);

    return text;
}

/**
 * Builds parenthesized original or English title text.
 *
 * @param params - Lead name parameters.
 * @param params.englishName - English game title.
 * @param params.originalLanguage - Original title language
 * code.
 * @param params.originalName - Original game title.
 * @param params.sourceTags - Source reference tags keyed by
 * field.
 * @returns Parenthesized title text, or an empty string.
 */
function buildVariantNameText(params: any): string {
    if (params.originalName !== '') {
        if (isSameBaseTitle(params.originalName, params.name)) {
            return '';
        }

        const result = buildVariantNameVariantText({
            code: params.originalLanguage,
            name: params.originalName,
            ref: params.sourceTags.originalName || '',
        });
        return result;
    }

    if (params.englishName !== '') {
        if (isSameBaseTitle(params.englishName, params.name)) {
            return '';
        }

        const result = buildVariantNameVariantText({
            code: 'en',
            name: params.englishName,
            ref: params.sourceTags.englishName || '',
        });
        return result;
    }

    return '';
}

/**
 * Builds parenthesized variant title text.
 *
 * @param variant - Variant title parameters.
 * @param variant.code - Language code.
 * @param variant.name - Variant title.
 * @param variant.ref - Source reference tag.
 * @returns Parenthesized variant title text.
 */
function buildVariantNameVariantText(variant: any): string {
    const values = {
        sourceTag: variant.ref,
        title: buildLangxTemplate(variant.code, variant.name),
    };
    const text = formatText('prose.foreignTitle', values);

    return text;
}

/**
 * Builds a langx template call.
 *
 * @param language - Language code.
 * @param text - Localized title text.
 * @returns Langx template wikitext.
 */
function buildLangxTemplate(language: string, text: string): string {
    const langxParams: Parameters<typeof buildTemplateText>[1] = [
        [1, language],
        [2, text],
        ['italic', buildLangxItalicParam(language)],
        ['label', 'none'],
    ];
    const result = buildTemplateText('langx', langxParams);
    return result;
}

/**
 * Builds the langx italic parameter for selected languages.
 *
 * @param language - Language code.
 * @returns Langx italic parameter, or an empty string.
 */
function buildLangxItalicParam(language: string): string | undefined {
    return ITALIC_LANGUAGE_CODES.has(language) ? 'yes' : undefined;
}

/**
 * Checks whether a variant name duplicates the article's base title.
 *
 * @param variantName - Original or English title.
 * @param articleTitle - Article title.
 * @returns Whether the names are equivalent.
 */
function isSameBaseTitle(variantName: string, articleTitle: string): boolean {
    const result =
        normalizeTitleForComparison(variantName) ===
        normalizeTitleForComparison(articleTitle);
    return result;
}

/**
 * Normalizes a title for duplicate-name comparisons.
 *
 * @param title - Title text.
 * @returns Normalized title.
 */
function normalizeTitleForComparison(title: string): string {
    const result = String(title || '')
        .trim()
        .replace(/ \(.+?\)$/u, '');
    return result;
}

/**
 * Builds generated navbox wikitext for resolved template titles.
 *
 * @param titles - Resolved template titles.
 * @returns Navbox wikitext.
 */
export function buildNavboxText(titles: Array<string>): string {
    const result = titles.map(buildTemplateCall).join('\n');

    return result;
}

/**
 * Builds navbox wikitext from selected review rows.
 *
 * @param rows - Reviewed navbox rows.
 * @returns Selected navbox wikitext.
 */
export function buildReviewedNavboxText(rows: Array<any | string>): string {
    const mapCallbackC = (row: any) => trimValue(row?.text ?? row);
    const formatNavbox = function formatNavbox(text: string) {
        return text.startsWith('{{') ? text : buildTemplateCall(text);
    };
    const result = rows
        .filter((row) => row?.enabled !== false)
        .map(mapCallbackC)
        .filter((text) => text !== '')
        .map(formatNavbox)
        .join('\n');

    return result;
}

type TemplateParam = wikitext.TemplateParam;

const SIMPLIFIED_MARKETS = ['hans', 'cn'];
const HONG_KONG_MARKETS = ['hk'];
const TAIWAN_MARKETS = ['hant', 'tw'];

/**
 * Builds a NoteTA-lite template.
 *
 * @param params - NoteTA parameters.
 * @param params.entries - User-editable NoteTA rows.
 * @param params.namesRemoved - Whether generated name
 * conversion
 * was removed.
 * @param params.officialNames - Official name rows.
 * @returns NoteTA-lite template wikitext.
 */
function buildNoteTaText(params: any = {}): string {
    const manualEntries = normalizeNoteTaEntries(params.entries);
    const entries = getNoteTaEntries(manualEntries);
    const conversionText = getNoteTaConversionText(entries, params);

    const mappedValues = sortNoteTaEntries([
        ...entries,
        {
            key: '1',
            value: conversionText,
        },
    ]).map(formatNoteTaTemplateParam);
    const text = buildTemplateText('NoteTA-lite', mappedValues, 'block');

    return text;
}

/**
 * Retains reviewed NoteTA rows and supplies the default Games group.
 *
 * @param manualEntries - Manual entries value.
 * @returns Reviewed NoteTA rows with a non-empty first group.
 */
function getNoteTaEntries(manualEntries: Array<any>): Array<any> {
    if (
        manualEntries.some((entry) => entry.key === 'G1' && entry.value !== '')
    ) {
        return manualEntries;
    }

    return [
        { key: 'G1', value: 'Games' },
        ...manualEntries.filter((entry) => entry.key !== 'G1'),
    ];
}

/**
 * Gets generated official-name conversion text when needed.
 *
 * @param entries - Entries value.
 * @param params - Params value.
 * @returns Generated official-name conversion text when needed.
 */
function getNoteTaConversionText(
    entries: unknown[],
    params: { namesRemoved: boolean; officialNames: unknown[] },
): string | undefined {
    const suppressed =
        hasEditableNameConversionEntry(entries) || params.namesRemoved === true;
    let text: string | undefined;

    if (!suppressed) {
        text = buildOfficialNameConversionText(params.officialNames);
    }

    return text;
}

/**
 * Handles has editable name conversion entry.
 *
 * Checks whether editable rows already include the generated name
 * conversion.
 *
 * @param entries - Normalized NoteTA rows.
 * @returns Whether name conversion has an editable row.
 */
function hasEditableNameConversionEntry(entries: Array<any>): boolean {
    const someCallbackA = function callback(entry: any) {
        return entry.source === 'names' || trimNoteTaText(entry.key) === '1';
    };
    const result = entries.some(someCallbackA);
    return result;
}

/**
 * Formats one NoteTA row as a template parameter tuple.
 *
 * @param entry - NoteTA row.
 * @returns Template parameter tuple.
 */
function formatNoteTaTemplateParam(entry: any): TemplateParam {
    const key = getTemplateParamKey(entry.key);
    const value =
        key == null ? escapeAnonymousParamValue(entry.value) : entry.value;

    return [key, value];
}

/**
 * Escapes equals signs in anonymous template parameters.
 *
 * @param value - Anonymous parameter value.
 * @returns Escaped parameter value.
 */
function escapeAnonymousParamValue(
    value: string | undefined,
): string | undefined {
    return value == null ? undefined : value.replace(/=/gu, '{{=}}');
}

/**
 * Normalizes user-editable NoteTA rows.
 *
 * @param entries - User-entered NoteTA rows.
 * @returns Normalized non-empty rows.
 */
function normalizeNoteTaEntries(entries: Array<any>): Array<any> {
    if (!Array.isArray(entries)) {
        return [];
    }

    const mapCallbackB = function callback(entry: any) {
        const result = {
            key: trimNoteTaText(entry?.key),
            modified: entry?.modified === true,
            source: trimNoteTaText(entry?.source),
            value: trimNoteTaText(entry?.value),
        };
        return result;
    };
    const result = entries
        .map(mapCallbackB)
        .filter((entry) => entry.key !== '' || entry.value !== '');
    return result;
}

/**
 * Sorts named conversion groups before anonymous conversion rows.
 *
 * @param entries - NoteTA row objects.
 * @returns Sorted NoteTA row objects.
 */
function sortNoteTaEntries(entries: Array<any>): Array<any> {
    const result = entries
        .map(function callback(entry, index) {
            const result = {
                ...entry,
                index,
            };
            return result;
        })
        .sort(compareNoteTaEntries)
        .map(({ index: _index, ...entry }) => entry);
    return result;
}

/**
 * Compares NoteTA rows by template source order.
 *
 * @param a - First NoteTA row.
 * @param b - Second NoteTA row.
 * @returns Sort order.
 */
function compareNoteTaEntries(a: any, b: any): number {
    const rankA = getNoteTaEntryRank(a);
    const rankB = getNoteTaEntryRank(b);

    const result =
        rankA.group - rankB.group ||
        rankA.number - rankB.number ||
        a.index - b.index;
    return result;
}

/**
 * Gets a sortable rank for one NoteTA row.
 *
 * @param entry - NoteTA row.
 * @returns Sort rank.
 */
function getNoteTaEntryRank(entry: any): any {
    const key = trimNoteTaText(entry.key);
    const groupMatch = key.match(/^G([1-9]\d*)$/u);
    const numberMatch = key.match(/^[1-9]\d*$/u);

    if (key === 'T') {
        return createNoteTaRank(0, 0);
    }

    if (groupMatch != null) {
        const numberResultA = Number(groupMatch[1]);
        return createNoteTaRank(1, numberResultA);
    }

    if (numberMatch != null) {
        const numberResult = Number(key);
        return createNoteTaRank(2, numberResult);
    }

    if (key === '') {
        return createNoteTaRank(3, entry.index);
    }

    return createNoteTaRank(4, entry.index);
}

/**
 * Creates a sortable NoteTA row rank.
 *
 * @param group - Group value.
 * @param number - Number value.
 * @returns A sortable NoteTA row rank.
 */
function createNoteTaRank(group: number, number: number): any {
    return { group, number };
}

/**
 * Converts a row key to the template parameter key.
 *
 * @param key - User-entered row key.
 * @returns Template parameter key.
 */
function getTemplateParamKey(key: string | null): string | null {
    const text = trimNoteTaText(key);

    return text === '' ? null : text;
}

/**
 * Trims NoteTA row text.
 *
 * @param value - Raw row text.
 * @returns Trimmed text.
 */
function trimNoteTaText(value: any): string {
    return String(value || '').trim();
}

/**
 * Builds a Simplified/Traditional conversion rule from official names.
 *
 * @param rows - Official name rows.
 * @returns Conversion rule, if both variants exist.
 */
export function buildOfficialNameConversionText(
    rows: Array<any>,
): string | undefined {
    const simplifiedName = findOfficialName(rows, SIMPLIFIED_MARKETS);
    const hongKongName = findOfficialName(rows, HONG_KONG_MARKETS);
    const taiwanName = findOfficialName(rows, TAIWAN_MARKETS);

    if (
        simplifiedName == null ||
        (hongKongName == null && taiwanName == null)
    ) {
        return undefined;
    }

    const result = [
        buildConversionEntry('cn', simplifiedName),
        buildConversionEntry('hk', hongKongName),
        buildConversionEntry('tw', taiwanName),
    ]
        .filter(Boolean)
        .join(' ');
    return result;
}

/**
 * Builds one NoteTA conversion entry.
 *
 * @param region - Chinese variant region code.
 * @param value - Localized official name.
 * @returns Conversion entry.
 */
function buildConversionEntry(
    region: string,
    value: string | undefined,
): string | undefined {
    return value == null ? undefined : `zh-${region}:${value};`;
}

/**
 * Finds the first official name selected for any market in a group.
 *
 * @param rows - Official name rows.
 * @param markets - Market keys to match.
 * @returns Official name.
 */
function findOfficialName(
    rows: Array<any> = [],
    markets: Array<string>,
): string | undefined {
    const findCallback = (row: any) => hasAnyMarket(row, markets);
    const result = rows.find(findCallback)?.name?.trim() || undefined;
    return result;
}

/**
 * Checks whether a localized name row targets any market in a group.
 *
 * @param row - Official name row.
 * @param row.markets - Selected market codes.
 * @param markets - Market keys to match.
 * @returns Whether any requested market is selected.
 */
function hasAnyMarket(row: any, markets: Array<string>): boolean {
    if (Array.isArray(row.markets)) {
        const someCallback = (market: string) => row.markets.includes(market);
        return markets.some(someCallback);
    }

    return markets.some((market) => row[market] === true);
}

/**
 * Builds references-section wikitext for video game stubs.
 */

/**
 * Builds the references section for generated citations.
 *
 * @param references - Named source references.
 * @returns References section, or an empty string.
 */
function buildReferencesText(references: Array<any>): string {
    if (references.length === 0) {
        return '';
    }

    const textResultB = {
        heading: getTextTemplate('referencesHeading'),
    };
    const result = buildReferencesSection(references, textResultB);
    return result;
}

/**
 * Counts prose text in Hanzi-equivalent sinographs.
 *
 * @param text - Prose text.
 * @returns Hanzi-equivalent sinograph count.
 */
function countProseSinographs(text: string): number {
    const plainText = stripWikitext(text);
    const latinPhrasePatternResultA = getLatinPhrasePattern();
    const withoutLatin = plainText.replace(latinPhrasePatternResultA, '');
    const numberPatternResultA = getNumberPattern();
    const withoutNumbers = withoutLatin.replace(numberPatternResultA, '');

    const latinPhrasePatternResult = getLatinPhrasePattern();
    const numberPatternResult = getNumberPattern();
    const result =
        countHanCharacters(withoutNumbers) +
        countMatches(plainText, latinPhrasePatternResult) * 2 +
        countMatches(withoutLatin, numberPatternResult) * 2;
    return result;
}

/**
 * Removes simple wikitext markup while preserving displayed prose.
 *
 * @param text - Wikitext prose.
 * @returns Plain prose.
 */
function stripWikitext(text: string): string {
    const result = String(text || '')
        .replace(/<ref\b[^>]*\/>/giu, '')
        .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/giu, '')
        .replace(/\[\[[^\]|]*\|([^\]]+)\]\]/gu, '$1')
        .replace(/\[\[([^\]]+)\]\]/gu, '$1')
        .replace(/\{\{[^{}]*\}\}/gu, '');
    return result;
}

/**
 * Counts Han script characters.
 *
 * @param text - Text to scan.
 * @returns Han character count.
 */
function countHanCharacters(text: string): number {
    return countMatches(text, /\p{Script=Han}/gu);
}

/**
 * Counts regular expression matches.
 *
 * @param text - Text to scan.
 * @param pattern - Global regular expression.
 * @returns Match count.
 */
function countMatches(text: string, pattern: RegExp): number {
    const matches = String(text || '').matchAll(pattern);
    return Array.from(matches).length;
}

/**
 * Gets the Latin proper-noun phrase matcher.
 *
 * @returns Latin phrase matcher.
 */
function getLatinPhrasePattern(): RegExp {
    const source = [
        '\\b[A-Za-z][A-Za-z0-9]*',
        '(?:[ \\t./&',
        "'’:-]+[A-Za-z0-9]+)*\\b",
    ].join('');
    const result = new RegExp(source, 'gu');
    return result;
}

/**
 * Gets the numeric token matcher.
 *
 * @returns Number matcher.
 */
function getNumberPattern(): RegExp {
    return /\b\d+(?:[./:-]\d+)*%?\b/gu;
}

/**
 * Composes article prose from independent article-part outputs.
 */

/**
 * Builds every prose fragment that combines independent data records.
 *
 * @param records - Article records keyed by module.
 * @param sourceTags - Source reference tags keyed by field.
 * @returns Composed article prose fragments.
 */
export function buildArticleProse(records: any, sourceTags: any): any {
    const sentence1 = buildOpeningProse(records, sourceTags);
    const sentence2 = buildPlatformsAndSeriesProse(
        records.platform,
        records.series,
        sourceTags,
    );
    const sentence3 = buildScoresProse(records.scores, sourceTags);
    const sentence4 = buildAppendProse(
        records.additionalProse,
        sourceTags.additionalProse,
    );
    const fragments = { sentence1, sentence2, sentence3, sentence4 };
    const proseValues = {
        sentence1: sentence1.text,
        sentence2,
        sentence3,
        sentence4,
    };
    const countedText = buildCountedProseText(sentence1, proseValues);
    const prose = {
        fragments,
        sinographs: countProseSinographs(countedText),
        text: formatText('prose.text', proseValues),
    };

    return prose;
}

interface OpeningProseRecords {
    companies: {
        metadata: { sameCompanies: boolean };
        wikitext: { developers: string; publishers: string };
    };
    genre: Parameters<typeof buildYearGenreProse>[1];
    names: { metadata: NameMetadata };
    year: Parameters<typeof buildYearGenreProse>[0];
}

interface OpeningProseSentence {
    s1a: { text: string; titles: string; yearGenre: string };
    s1b: string;
    text: string;
}

/**
 * Builds the opening title, year, genre, and company sentence.
 *
 * @param records - Normalized article records.
 * @param sourceTags - Source tags keyed by article field.
 * @returns Opening sentence fragments and rendered text.
 */
function buildOpeningProse(
    records: OpeningProseRecords,
    sourceTags: Record<string, string>,
): OpeningProseSentence {
    const names = records.names.metadata;
    const leadValues = buildLeadValues(names, sourceTags);
    const titles = buildLeadNameText(leadValues);
    const joinSourceTagsResultA = joinSourceTags(sourceTags, [
        'year',
        'genres',
    ]);
    const yearGenre = buildYearGenreProse(
        records.year,
        records.genre,
        joinSourceTagsResultA,
    );
    const sentence1aText = formatText('prose.sentence1a', {
        titles,
        yearGenre,
    });
    const joinSourceTagsResult = {
        sourceTag: joinSourceTags(sourceTags, ['developers', 'publishers']),
    };
    const sentence1b = buildCompanyProse(
        records.companies,
        joinSourceTagsResult,
    );
    const sentence1a = {
        text: sentence1aText,
        titles,
        yearGenre,
    };
    const sentence = {
        s1a: sentence1a,
        s1b: sentence1b,
        text: buildSentence1Text(sentence1a.text, sentence1b),
    };

    return sentence;
}

/**
 * Describes normalized primary article names.
 */
interface NameMetadata {
    englishName: string;
    name: string;
    original: { language: string; name: string };
}

/**
 * Builds lead-name input values from normalized name metadata.
 *
 * @param names - Normalized primary names.
 * @param sourceTags - Source tags keyed by name field.
 * @returns Lead-name input values.
 */
function buildLeadValues(
    names: NameMetadata,
    sourceTags: Record<string, string>,
): Record<string, unknown> {
    const result = {
        englishName: names.englishName,
        name: names.name,
        originalLanguage: names.original.language,
        originalName: names.original.name,
        sourceTags,
    };
    return result;
}

/**
 * Builds prose text with titles excluded from the length count.
 *
 * @param sentence1 - Sentence1 value.
 * @param proseValues - Prose values value.
 * @returns Prose text with titles excluded from the length count.
 */
function buildCountedProseText(
    sentence1: { s1a: { yearGenre: string }; s1b: string },
    proseValues: {
        sentence1: string;
        sentence2: string;
        sentence3: string;
        sentence4: string;
    },
): string {
    const countedSentence1a = formatText('prose.countedSentence1a', {
        yearGenre: sentence1.s1a.yearGenre,
    });
    const countedSentence1 = buildSentence1Text(
        countedSentence1a,
        sentence1.s1b,
    );
    const countedText = formatText('prose.text', {
        ...proseValues,
        sentence1: countedSentence1,
    });

    return countedText;
}

/**
 * Builds the year, genre, and video-game noun phrase.
 *
 * @param year - Release-year field output.
 * @param genre - Genre field output.
 * @param sourceTag - Combined year and genre source tags.
 * @returns Video-game noun phrase.
 */
function buildYearGenreProse(
    year: any,
    genre: any,
    sourceTag: string = '',
): string {
    const yearText = year.metadata.phrase || '';
    const genreText =
        genre.wikitext.list === ''
            ? ''
            : formatText('prose.genreClass', {
                  genreText: genre.wikitext.list,
              });
    const prefix =
        `${yearText}${genreText}` ||
        getTextTemplate('prose.fallbackYearGenrePrefix');
    const values = {
        prefix,
        sourceTag,
    };
    const prose = formatText('prose.yearGenre', values);

    return prose;
}

/**
 * Builds developer and publisher attribution prose.
 *
 * @param companies - Company article data.
 * @param options - Attribution options.
 * @param options.sourceTag - Combined company source tags.
 * @returns Company attribution clause.
 */
function buildCompanyProse(
    companies: {
        wikitext: { developers: string; publishers: string };
        metadata: { sameCompanies: boolean };
    },
    options: { sourceTag?: string } = {},
): string {
    const developerText = companies.wikitext.developers || '';
    const publisherText = companies.wikitext.publishers || '';
    const roleText = buildCompanyRoleText(
        developerText,
        publisherText,
        companies.metadata.sameCompanies,
    );

    if (roleText === '') {
        return '';
    }

    const values = {
        roleText,
        sourceTag: options.sourceTag || '',
    };
    const prose = formatText('prose.sentence1b', values);

    return prose;
}

/**
 * Builds the platform and series sentence.
 *
 * @param platforms - Platform field output.
 * @param series - Series field output.
 * @param sourceTags - Source tags keyed by field.
 * @returns Platform/series sentence.
 */
function buildPlatformsAndSeriesProse(
    platforms: any,
    series: any,
    sourceTags: any = {},
): string {
    const platformText = platforms.wikitext.list;
    const seriesText = buildSeriesListText(series.values);

    if (platformText === '' && seriesText === '') {
        return '';
    }

    if (platformText === '') {
        const values = {
            seriesSourceTag: sourceTags.series || '',
            seriesText,
        };
        const prose = formatText('prose.seriesOnly', values);

        return prose;
    }

    const seriesClause = buildSeriesClause(seriesText, sourceTags);
    const values = {
        platformSourceTag: sourceTags.platforms || '',
        platformText,
        seriesClause,
    };
    const prose = formatText('prose.sentence2', values);

    return prose;
}

/**
 * Builds the optional series clause following platform prose.
 *
 * @param seriesText - Series text value.
 * @param sourceTags - Source tags value.
 * @returns The optional series clause following platform prose.
 */
function buildSeriesClause(seriesText: string, sourceTags: any): string {
    if (seriesText === '') {
        return '';
    }

    const clause = formatText('prose.seriesClause', {
        seriesSourceTag: sourceTags.series || '',
        seriesText,
    });

    return clause;
}

/**
 * Builds aggregate review score prose from score metadata.
 *
 * @param scores - Review-score part output.
 * @param sourceTags - Source tags keyed by field.
 * @returns Aggregate score sentence.
 */
function buildScoresProse(
    scores: AggregateScoreRecord,
    sourceTags: SourceTags = {},
): string {
    const values = {
        metacriticPlatform: scores.metadata.metacritic.platform,
        metacriticScore: scores.metadata.metacritic.score,
        metacriticSourceTag: sourceTags.metacriticScore,
        openCriticRecommend: scores.metadata.openCritic.recommend,
        openCriticSourceTag: sourceTags.openCriticRecommend,
    };
    const prose = buildAggScoresText(values);

    return prose;
}

/**
 * Adds a source tag to user-entered additional prose.
 *
 * @param additionalProse - Additional-prose part output.
 * @param sourceTag - Additional-prose source tag.
 * @returns Sourced prose text.
 */
function buildAppendProse(
    additionalProse: any,
    sourceTag: string = '',
): string {
    const text = additionalProse.wikitext.text || '';

    if (text === '') {
        return '';
    }

    const hasPeriod = text.endsWith('。');
    const templateKey = hasPeriod
        ? 'prose.sentence4WithPeriod'
        : 'prose.sentence4';
    const slicedValue = {
        sourceTag,
        text: hasPeriod ? text.slice(0, -1) : text,
    };
    const prose = formatText(templateKey, slicedValue);

    return prose;
}

/**
 * Defines the module-level build company role text.
 *
 * @param developers - Developers value.
 * @param publishers - Publishers value.
 * @param sameCompanies - Same companies value.
 * @returns Result when the function
 *   defines the module-level build company role text.
 */
function buildCompanyRoleText(
    developers: string,
    publishers: string,
    sameCompanies: unknown,
) {
    if (developers === '' && publishers === '') {
        return '';
    }

    if (developers !== '' && sameCompanies) {
        const result = formatText('prose.developedAndPublished', {
            developers,
        });
        return result;
    }

    if (developers === '') {
        const result = formatText('prose.published', {
            publishers,
        });
        return result;
    }

    if (publishers === '') {
        const result = formatText('prose.developed', {
            developers,
        });
        return result;
    }

    const result = formatText('prose.developedThenPublished', {
        developers,
        publishers,
    });
    return result;
}

/**
 * Defines the module-level build series list text.
 *
 * @param values - Input values.
 * @returns Result when the function
 *   defines the module-level build series list text.
 */
function buildSeriesListText(values: Array<{ wikitext: unknown }>) {
    const formatSeriesTitle = function formatSeriesTitle(value: {
        wikitext: unknown;
    }) {
        const result = formatText('prose.seriesTitle', {
            value: value.wikitext,
        });
        return result;
    };
    const names = values.map(formatSeriesTitle);

    if (names.length === 2) {
        const textResultA = getTextTemplate('shared.conjunction');
        return names.join(textResultA);
    }

    const textResult = getTextTemplate('shared.enumerationSeparator');
    return names.join(textResult);
}

/**
 * Defines the module-level join source tags.
 *
 * @param sourceTags - Source tags keyed by article field.
 * @param keys - Keys value.
 * @returns Result when the function
 *   defines the module-level join source tags.
 */
function joinSourceTags(
    sourceTags: Record<string, string>,
    keys: string[],
): string {
    const tags = keys.map((key) => sourceTags[key] || '').join('');

    return tags;
}

/**
 * Builds non-prose article outputs from normalized article-part data.
 */

/**
 * Builds infobox, conversion, sorting, and reviewed navbox outputs.
 *
 * @param records - Article records keyed by module.
 * @param sourceTags - Source reference tags keyed by field.
 * @returns Rendered article outputs.
 */
export function buildArticleRenderers(records: any, sourceTags: any): any {
    const names = records.names.metadata;
    const commonNames = addNameReferenceTags(
        names.commonNames,
        sourceTags,
        'commonNames',
    );
    const officialNames = addNameReferenceTags(
        names.officialNames,
        sourceTags,
        'officialNames',
    );
    const defaultSort = buildNameDefaultSort(names);
    const infobox = buildNameInfobox(names, commonNames, officialNames);
    const noteTa = buildNoteTaText({
        entries: records.noteTa.metadata.rows,
        namesRemoved: records.noteTa.metadata.namesRemoved,
        officialNames: names.officialNames,
    });

    const result = {
        defaultSort,
        infobox,
        navboxes: records.review.wikitext.navbox,
        noteTa,
    };
    return result;
}

/**
 * Builds default-sort text from normalized names.
 *
 * @param names - Names value.
 * @returns Default-sort text from normalized names.
 */
function buildNameDefaultSort(names: any): string {
    const result = buildDefaultSortText({
        english: names.englishName,
        original: names.original.name,
        sortKey: names.sortKey,
        title: names.name,
    });
    return result;
}

/**
 * Builds infobox text from normalized names.
 *
 * @param names - Names value.
 * @param commonNames - Common names value.
 * @param officialNames - Official names value.
 * @returns Infobox text from normalized names.
 */
function buildNameInfobox(
    names: any,
    commonNames: any,
    officialNames: any,
): string {
    const result = buildInfoboxText({
        commonNames,
        englishName: names.englishName,
        name: names.name,
        officialNames,
        originalLanguage: names.original.language,
        originalName: names.original.name,
    });
    return result;
}

/**
 * Defines the module-level add name reference tags.
 *
 * @param rows - Row values.
 * @param sourceTags - Source tags keyed by localized-name field.
 * @param key - Lookup key.
 * @returns Result when the function
 *   defines the module-level add name reference tags.
 */
function addNameReferenceTags(
    rows: Array<{ sourceKey: string }>,
    sourceTags: Record<string, string>,
    key: string,
) {
    const mapCallback = function callback(
        row: { sourceKey: string },
        index: number,
    ) {
        const sourceKey =
            row.sourceKey || buildNameSourceReferenceKey(key, index);
        const value = {
            ...row,
            ref: sourceTags[sourceKey] || '',
        };

        return value;
    };
    const values = (rows || []).map(mapCallback);

    return values;
}

/**
 * Assembles generated article wikitext from prepared article metadata.
 */

/**
 * Builds the Chinese Wikipedia video game stub article text.
 *
 * @param params - Normalized article parameters.
 * @returns Generated Chinese wikitext.
 */
export function buildArticleWikitext(params: ProcessedArticleData): string {
    const intro = params.prose.text;

    const result = [
        params.renderers.noteTa,
        params.renderers.infobox,
        intro,
        buildReferencesText(params.sourceReferences),
        params.renderers.navboxes,
        buildFooterTemplateText(),
        buildCategoryText(params),
        buildStubTagText(params),
    ]
        .filter(Boolean)
        .join('\n\n');
    return result;
}
