/**
 * @file src/vg-stub-creator/domain/modules.ts
 * Purpose: Article data-flow modules in visual output order.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. buildNameValues
 * 4. normalizeLanguagePrefix
 * 5. buildLocalizedNameValue
 * 6. getLocalizedNameRows
 * 7. normalizeLocalizedNameRows
 * 8. addCompanyRole
 * 9. buildScoreValues
 * 10. normalizeScorePlatform
 * 11. NoteTaRow
 * 12. normalizeNoteTaRows
 * 13. normalizeNavbox
 */

import {
    buildCompanyData,
    buildGenreMetadata,
    buildPlatformMetadata,
    buildSeriesMetadata,
    buildYearMetadata,
    normalizeYearFieldValue,
} from './data.ts';
import { defineArticleModule } from './article-module.ts';
import { buildNameSourceReferenceKey } from './wiki.ts';
import * as wikitext from './wikitext/index.ts';
const { formatPrefixedValue, parsePrefixedValue, trimValue } = wikitext;

/**
 * Flushes article titles and localized names into shared metadata.
 */

const NAME_SOURCE_PREFIXES = ['localizedNames.', 'nameAliases.'];

const defineArticleModuleArgumentI = {
    fields: [
        'name',
        'originalLanguage',
        'originalName',
        'englishName',
        'sortKey',
        'localizedNames',
    ],
    key: 'names',
    sourceFields: [
        {
            key: 'originalName',
            label: 'Original title source URLs',
            sourceKey: 'originalNameSourceUrl',
        },
        {
            key: 'englishName',
            label: 'English title source URLs',
            sourceKey: 'englishNameSourceUrl',
        },
    ],

    /**
     * Formats live title field values.
     *
     * @param key - Form field key.
     * @param value - Raw field value.
     * @returns Canonical field text.
     */
    formatField(key: string, value: any): string {
        if (key === 'originalName') {
            const result = formatPrefixedValue(value, {
                normalizePrefix: normalizeLanguagePrefix,
            });
            return result;
        }

        return trimValue(value);
    },

    /**
     * Normalizes title data for all output handlers.
     *
     * @param form - Current article form.
     * @param context - Shared module context.
     * @returns Normalized title form patch.
     */
    normalize(form: any, context: any): any {
        const original = parsePrefixedValue(
            form.originalName,
            form.originalLanguage || 'ja',
        );
        const localizedNames = getLocalizedNameRows(form);

        const result = {
            commonNames: localizedNames.filter((row) => !row.official),
            englishName: trimValue(form.englishName),
            localizedNames,
            name: trimValue(form.name) || trimValue(context.defaultName),
            officialNames: localizedNames.filter((row) => row.official),
            originalLanguage: original.prefix.toLocaleLowerCase() || 'ja',
            originalName: original.value,
            sortKey: trimValue(form.sortKey),
        };
        return result;
    },

    /**
     * Builds title metadata and generated title fragments.
     *
     * @param form - Fully normalized article form.
     * @param context - Shared module context.
     * @returns Names part payload.
     */
    flush(form: any, context: any): any {
        const citations = context.getCitations({
            keys: ['originalName', 'englishName'],
            prefixes: NAME_SOURCE_PREFIXES,
        });
        const metadata = {
            commonNames: form.commonNames,
            englishName: form.englishName,
            name: form.name,
            officialNames: form.officialNames,
            original: {
                language: form.originalLanguage,
                name: form.originalName,
            },
            sortKey: form.sortKey,
        };
        const values = buildNameValues(form);
        const wikitext = {
            englishName: form.englishName,
            name: form.name,
            originalName: form.originalName,
        };
        const output = {
            citations,
            metadata,
            values,
            wikitext,
        };

        return output;
    },
};
const namesModule = defineArticleModule(defineArticleModuleArgumentI);

/**
 * Defines the module-level build name values.
 *
 * @param form - Form values.
 * @returns Result when the function
 *   defines the module-level build name values.
 */
function buildNameValues(form: {
    name: string;
    originalLanguage: string;
    originalName: string;
    englishName: string;
    localizedNames: Array<{ name: string }>;
}) {
    const primaryValues = [
        {
            key: 'name',
            normalizedText: form.name,
            wikitext: form.name,
        },
        {
            key: 'originalName',
            metadata: {
                language: form.originalLanguage,
            },
            normalizedText: form.originalName,
            wikitext: form.originalName,
        },
        {
            key: 'englishName',
            normalizedText: form.englishName,
            wikitext: form.englishName,
        },
    ];
    const localizedValues = form.localizedNames.map(buildLocalizedNameValue);
    const values = [...primaryValues, ...localizedValues].filter(
        (value) => value.normalizedText !== '',
    );

    return values;
}

/**
 * Normalizes a compact language prefix.
 *
 * @param prefix - Entered language prefix.
 * @returns Lowercase language prefix.
 */
function normalizeLanguagePrefix(prefix: string): string {
    return prefix.toLocaleLowerCase();
}

/**
 * Builds a normalized localized-name value.
 *
 * @param row - Row values.
 * @returns A normalized localized-name value.
 */
function buildLocalizedNameValue(row: {
    name: string;
}): Record<string, unknown> {
    const result = {
        key: 'localizedName',
        metadata: row,
        normalizedText: row.name,
        wikitext: row.name,
    };
    return result;
}

/**
 * Gets merged localized name rows with stable source keys.
 *
 * @param form - Dialog form values.
 * @returns Localized name rows.
 */
function getLocalizedNameRows(form: any): Array<any> {
    return normalizeLocalizedNameRows(
        Array.isArray(form.localizedNames) ? form.localizedNames : [],
    );
}

/**
 * Normalizes localized-name rows with stable source keys.
 *
 * @param rows - Row values.
 * @param key - Lookup key.
 * @param official - Official value.
 * @returns Localized-name rows with stable source keys.
 */
function normalizeLocalizedNameRows(
    rows: Array<
        Record<string, unknown> & { name: unknown; sourceUrl: unknown }
    >,
): Array<Record<string, unknown>> {
    const mapCallbackA = function callback(
        row: Record<string, unknown> & { name: unknown; sourceUrl: unknown },
        index: number,
    ) {
        const normalized: Record<string, unknown> = {
            ...row,
            name: trimValue(row.name),
            sourceKey: buildNameSourceReferenceKey('localizedNames', index),
            sourceUrl: trimValue(row.sourceUrl),
        };

        return normalized;
    };
    const result = rows.map(mapCallbackA);
    return result;
}

/**
 * Flushes release-year values into shared article metadata.
 */

const defineArticleModuleArgumentH = {
    fields: ['year'],
    key: 'year',
    sourceFields: [
        {
            key: 'year',
            label: 'Year source URLs',
            sourceKey: 'yearSourceUrl',
        },
    ],

    /**
     * Formats the live release-year field.
     *
     * @param _key - Form field key.
     * @param value - Raw year value.
     * @returns Canonical year value.
     */
    formatField(_key: string, value: any): string {
        return normalizeYearFieldValue(value);
    },

    /**
     * Normalizes release-year form data.
     *
     * @param form - Current article form.
     * @returns Normalized year patch.
     */
    normalize(form: any): any {
        const result = {
            year: normalizeYearFieldValue(form.year),
        };
        return result;
    },

    /**
     * Builds release-year metadata.
     *
     * @param form - Fully normalized article form.
     * @param context - Shared module context.
     * @returns Year part payload.
     */
    flush(form: any, context: any): any {
        const metadata = buildYearMetadata(form.year);
        const citations = context.getCitations({
            keys: ['year'],
        });
        const values =
            metadata.value === ''
                ? []
                : [
                      {
                          normalizedText: metadata.value,
                          wikitext: metadata.value,
                      },
                  ];
        const output = {
            assumedCategories: metadata.categories,
            citations,
            metadata,
            navboxes: metadata.navboxes,
            values,
            wikitext: {
                phrase: metadata.phrase,
            },
        };

        return output;
    },
};
const yearModule = defineArticleModule(defineArticleModuleArgumentH);

/**
 * Flushes genre values into shared article metadata.
 */

const defineArticleModuleArgumentG = {
    fields: ['genres'],
    key: 'genre',
    listFields: ['genres'],
    sourceFields: [
        {
            key: 'genres',
            label: 'Genre source URLs',
            sourceKey: 'genresSourceUrl',
        },
    ],

    /**
     * Builds genre metadata.
     *
     * @param form - Fully normalized article form.
     * @param context - Shared module context.
     * @returns Genre part payload.
     */
    flush(form: any, context: any): any {
        const metadata = buildGenreMetadata(form.genres);
        const citations = context.getCitations({
            keys: ['genres'],
        });
        const output = {
            assumedCategories: metadata.categories,
            assumedStubTags: metadata.stubTags,
            citations,
            metadata,
            navboxes: metadata.navboxes,
            values: metadata.items,
            wikitext: {
                list: metadata.text,
            },
        };

        return output;
    },
};
const genreModule = defineArticleModule(defineArticleModuleArgumentG);

/**
 * Flushes developer and publisher values into shared metadata.
 */

const defineArticleModuleArgumentF = {
    fields: ['developers', 'publishers'],
    key: 'companies',
    listFields: ['developers', 'publishers'],
    sourceFields: [
        {
            key: 'developers',
            label: 'Dev source URLs',
            sourceKey: 'developersSourceUrl',
        },
        {
            key: 'publishers',
            label: 'Pub source URLs',
            sourceKey: 'publishersSourceUrl',
        },
    ],

    /**
     * Builds company attribution and category metadata.
     *
     * @param form - Fully normalized article form.
     * @param context - Shared module context.
     * @returns Companies part payload.
     */
    flush(form: any, context: any): any {
        const companyValues = {
            developers: form.developers,
            publishers: form.publishers,
        };
        const metadata = buildCompanyData(companyValues);
        const citations = context.getCitations({
            keys: ['developers', 'publishers'],
        });
        const values = [
            ...addCompanyRole(metadata.developers.items, 'developer'),
            ...addCompanyRole(metadata.publishers.items, 'publisher'),
        ];
        const output = {
            assumedCategories: metadata.categories,
            assumedStubTags: metadata.stubTags,
            categoryItems: metadata.categoryItems,
            citations,
            metadata,
            navboxes: metadata.navboxes,
            values,
            wikitext: {
                developers: metadata.developers.text,
                publishers: metadata.publishers.text,
            },
        };

        return output;
    },
};
const companiesModule = defineArticleModule(defineArticleModuleArgumentF);

/**
 * Adds a company role to normalized company values.
 *
 * @param items - Items value.
 * @param role - Role value.
 * @returns Result when the function
 *   adds a company role to normalized company values.
 */
function addCompanyRole(items: Array<any>, role: string): Array<any> {
    const values = items.map(function callback(item) {
        return { ...item, role };
    });

    return values;
}

/**
 * Flushes platform values into shared article metadata.
 */

const defineArticleModuleArgumentE = {
    fields: ['platforms'],
    key: 'platform',
    listFields: ['platforms'],
    sourceFields: [
        {
            key: 'platforms',
            label: 'Plat source URLs',
            sourceKey: 'platformsSourceUrl',
        },
    ],

    /**
     * Builds platform link and category metadata.
     *
     * @param form - Fully normalized article form.
     * @param context - Shared module context.
     * @returns Platform part payload.
     */
    flush(form: any, context: any): any {
        const metadata = buildPlatformMetadata(form.platforms);
        const citations = context.getCitations({
            keys: ['platforms'],
        });
        const output = {
            assumedCategories: metadata.categories,
            assumedStubTags: metadata.stubTags,
            citations,
            metadata,
            navboxes: metadata.navboxes,
            values: metadata.items,
            wikitext: {
                list: metadata.text,
            },
        };

        return output;
    },
};
const platformModule = defineArticleModule(defineArticleModuleArgumentE);

/**
 * Flushes series values into shared article metadata.
 */

const defineArticleModuleArgumentD = {
    fields: ['series'],
    key: 'series',
    listFields: ['series'],
    sourceFields: [
        {
            key: 'series',
            label: 'Series source URLs',
            sourceKey: 'seriesSourceUrl',
        },
    ],

    /**
     * Builds series link and category-plan metadata.
     *
     * @param form - Fully normalized article form.
     * @param context - Shared module context.
     * @returns Series part payload.
     */
    flush(form: any, context: any): any {
        const metadata = buildSeriesMetadata(form.series);
        const citations = context.getCitations({
            keys: ['series'],
        });
        const output = {
            categoryPlans: metadata.categoryPlans,
            citations,
            metadata,
            values: metadata.items,
            wikitext: {
                list: metadata.text,
            },
        };

        return output;
    },
};
const seriesModule = defineArticleModule(defineArticleModuleArgumentD);

/**
 * Flushes aggregate review scores into shared article metadata.
 */

const defineArticleModuleArgumentC = {
    fields: ['metacriticPlatform', 'metacriticScore', 'openCriticRecommend'],
    key: 'scores',
    sourceFields: [
        {
            key: 'metacriticScore',
            label: 'MC score source URLs',
            sourceKey: 'metacriticScoreSourceUrl',
        },
        {
            key: 'openCriticRecommend',
            label: 'OC score source URLs',
            sourceKey: 'openCriticRecommendSourceUrl',
        },
    ],

    /**
     * Formats live score field values.
     *
     * @param key - Form field key.
     * @param value - Raw score field value.
     * @returns Canonical score text.
     */
    formatField(key: string, value: any): string {
        if (key !== 'metacriticScore') {
            return trimValue(value);
        }

        const enteredScore = trimValue(value);
        const score = enteredScore.includes(':')
            ? enteredScore
            : enteredScore.replace(/^(.+?)\s+(\d{1,3})$/u, '$1:$2');

        const result = formatPrefixedValue(score, {
            normalizePrefix: normalizeScorePlatform,
        });
        return result;
    },

    /**
     * Normalizes aggregate score form data.
     *
     * @param form - Current article form.
     * @returns Normalized score patch.
     */
    normalize(form: any): any {
        const metacritic = parsePrefixedValue(
            form.metacriticScore,
            form.metacriticPlatform || '',
        );

        const result = {
            metacriticPlatform: normalizeScorePlatform(metacritic.prefix),
            metacriticScore: metacritic.value,
            openCriticRecommend: trimValue(form.openCriticRecommend),
        };
        return result;
    },

    /**
     * Builds aggregate score metadata and prose.
     *
     * @param form - Fully normalized article form.
     * @param context - Shared module context.
     * @returns Scores part payload.
     */
    flush(form: any, context: any): any {
        const citations = context.getCitations({
            keys: ['metacriticScore', 'openCriticRecommend'],
        });
        const metadata = {
            metacritic: {
                platform: form.metacriticPlatform,
                score: form.metacriticScore,
            },
            openCritic: {
                recommend: form.openCriticRecommend,
            },
        };
        const values = buildScoreValues(form, metadata);
        const output = {
            citations,
            metadata,
            values,
            wikitext: {
                metacriticScore: form.metacriticScore,
                openCriticRecommend: form.openCriticRecommend,
            },
        };

        return output;
    },
};
const scoresModule = defineArticleModule(defineArticleModuleArgumentC);

/**
 * Builds normalized aggregate-score values.
 *
 * @param form - Form values.
 * @param metadata - Article metadata.
 * @returns Normalized aggregate-score values.
 */
function buildScoreValues(
    form: {
        metacriticPlatform: unknown;
        metacriticScore: unknown;
        openCriticRecommend: unknown;
    },
    metadata: { metacritic: unknown; openCritic: unknown },
): Array<unknown> {
    const metacriticText = [form.metacriticPlatform, form.metacriticScore]
        .filter(Boolean)
        .join(':');
    const values = [
        {
            key: 'metacritic',
            metadata: metadata.metacritic,
            normalizedText: metacriticText,
        },
        {
            key: 'openCritic',
            metadata: metadata.openCritic,
            normalizedText: form.openCriticRecommend,
        },
    ].filter((value) => value.normalizedText !== '');

    return values;
}

/**
 * Normalizes compact review-platform codes while preserving full names.
 *
 * @param value - Raw platform prefix.
 * @returns Canonical score platform.
 */
function normalizeScorePlatform(value: any): string {
    const platform = trimValue(value);

    if (/^[a-z0-9_-]{1,8}$/iu.test(platform)) {
        return platform.toLocaleUpperCase();
    }

    return platform;
}

/**
 * Flushes manually editable NoteTA-lite template rows.
 */

const defineArticleModuleArgumentB = {
    fields: ['noteTaRows', 'noteTaNamesRemoved'],
    key: 'noteTa',

    normalize(form: { noteTaNamesRemoved: boolean; noteTaRows: NoteTaRow[] }) {
        const result = {
            noteTaNamesRemoved: form.noteTaNamesRemoved === true,
            noteTaRows: normalizeNoteTaRows(form.noteTaRows),
        };
        return result;
    },

    flush(form: { noteTaNamesRemoved: boolean; noteTaRows: NoteTaRow[] }) {
        const result = {
            metadata: {
                namesRemoved: form.noteTaNamesRemoved,
                rows: form.noteTaRows,
            },
            values: form.noteTaRows
                .filter((row) => row.value !== '')
                .map(function callback(row: NoteTaRow) {
                    const result = {
                        key: 'noteTaRow',
                        metadata: {
                            key: row.key,
                            modified: row.modified,
                            source: row.source,
                        },
                        normalizedText: row.value,
                        wikitext: row.value,
                    };
                    return result;
                }),
        };
        return result;
    },
};
const noteTaModule = defineArticleModule(defineArticleModuleArgumentB);

/**
 * Describes one editable NoteTA row.
 */
interface NoteTaRow {
    key: string;
    modified: boolean;
    source: string;
    value: string;
}

/**
 * Normalizes editable NoteTA rows.
 *
 * @param rows - NoteTA rows from the form.
 * @returns Normalized NoteTA rows.
 */
function normalizeNoteTaRows(rows: NoteTaRow[]): NoteTaRow[] {
    if (!Array.isArray(rows)) {
        return [];
    }

    const mapCallback = function callback(row: NoteTaRow) {
        const result = {
            key: trimValue(row?.key),
            modified: row?.modified === true,
            source: trimValue(row?.source),
            value: trimValue(row?.value),
        };
        return result;
    };
    const result = rows.map(mapCallback);
    return result;
}

/**
 * Describes the additional-prose module.
 *
 * Flushes user-entered additional prose without composing article
 * sentences.
 */

const defineArticleModuleArgumentA = {
    fields: ['additionalProse'],
    key: 'additionalProse',
    sourceFields: [
        {
            key: 'additionalProse',
            label: 'Additional prose source URLs',
            sourceKey: 'additionalProseSourceUrl',
        },
    ],

    formatField(_key: unknown, value: unknown) {
        return trimValue(value);
    },

    normalize(form: { additionalProse: unknown }) {
        const normalized = {
            additionalProse: trimValue(form.additionalProse),
        };

        return normalized;
    },

    flush(
        form: { additionalProse: string },
        context: { getCitations: (arg0: { keys: string[] }) => unknown },
    ) {
        const citations = context.getCitations({
            keys: ['additionalProse'],
        });
        const values =
            form.additionalProse === ''
                ? []
                : [
                      {
                          normalizedText: form.additionalProse,
                          wikitext: form.additionalProse,
                      },
                  ];
        const output = {
            citations,
            values,
            wikitext: {
                text: form.additionalProse,
            },
        };

        return output;
    },
};
const additionalProseModule = defineArticleModule(defineArticleModuleArgumentA);

/**
 * Flushes reviewed category and navbox selections.
 */

const defineArticleModuleArgument = {
    fields: ['categoryRows', 'stubTagRows', 'navboxRows', 'navboxText'],
    key: 'review',

    /**
     * Normalizes reviewed output values.
     *
     * @param form - Current article form.
     * @returns Normalized review patch.
     */
    normalize(form: any): any {
        const result = {
            categoryRows: Array.isArray(form.categoryRows)
                ? form.categoryRows
                : [],
            stubTagRows: Array.isArray(form.stubTagRows)
                ? form.stubTagRows
                : null,
            navboxRows: Array.isArray(form.navboxRows) ? form.navboxRows : [],
            navboxText: trimValue(form.navboxText),
        };
        return result;
    },

    /**
     * Builds reviewed output metadata.
     *
     * @param form - Fully normalized article form.
     * @returns Review part payload.
     */
    flush(form: any): any {
        const navboxes = form.navboxRows.map(normalizeNavbox);
        const metadata = {
            categoryRows: form.categoryRows,
            stubTagRows: form.stubTagRows,
            navboxText: form.navboxText,
        };
        const output = {
            metadata,
            navboxes,
            wikitext: {
                navbox: form.navboxText,
            },
        };

        return output;
    },
};
const reviewModule = defineArticleModule(defineArticleModuleArgument);

/**
 * Defines the module-level normalize navbox.
 *
 * @param row - Row values.
 * @returns Result when the function
 *   defines the module-level normalize navbox.
 */
function normalizeNavbox(row: {
    enabled: boolean;
    status: unknown;
    text: unknown;
    title: unknown;
}) {
    const navbox = {
        enabled: row.enabled !== false,
        status: row.status || '',
        text: trimValue(row.text),
        title: trimValue(row.title),
    };

    return navbox;
}

/**
 * Registers all article data-flow modules in deterministic order.
 */

export const ARTICLE_MODULES = Object.freeze([
    namesModule,
    yearModule,
    genreModule,
    companiesModule,
    platformModule,
    seriesModule,
    scoresModule,
    noteTaModule,
    additionalProseModule,
    reviewModule,
]);
