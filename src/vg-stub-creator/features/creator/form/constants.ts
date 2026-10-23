/**
 * @file src/vg-stub-creator/features/creator/form/constants.ts
 * Purpose: Defines vg-stub-creator dialog form metadata and reusable constants.
 *
 * Contents: Typed article fields, tabs, and reusable control configuration.
 */

import { getArticleSourceFields } from '../../../domain/processor.ts';
import { msg } from '../../../i18n/index.ts';
import { cdxIconLinkExternal } from '@wikimedia/codex-icons';

type SourceReferenceField = ReturnType<typeof getArticleSourceFields>[number];

interface ArticleParameterFieldOptions {
    heading?: string;
    multiline?: boolean;
    placeholder?: string;
    previewKey?: string;
    readonly?: boolean;
}

interface ArticleParameterField extends ArticleParameterFieldOptions {
    key: string;
    label: string;
    multiline: boolean;
    readonly: boolean;
    sourceField: SourceReferenceField | null | undefined;
}

interface ArticleParameterGroupOptions {
    citationReview?: boolean;
    fullTextReview?: boolean;
    previewKey?: string;
}

interface ArticleParameterGroup {
    citationReview: boolean;
    fields: ArticleParameterField[];
    fullTextReview: boolean;
    key: string;
    label: string;
    nameGroupKey: string | null;
    previewKey: string;
}

/** Defines the inputs and previews used by one article field. */
function createArticleParameterField(
    key: string,
    label: string,
    sourceField: SourceReferenceField | null | undefined,
    options: ArticleParameterFieldOptions = {},
): ArticleParameterField {
    return {
        ...options,
        key,
        label,
        multiline: Boolean(options.multiline),
        readonly: Boolean(options.readonly),
        sourceField,
    };
}

/** Defines one tab's fields and review surface. */
function createArticleParameterGroup(
    key: string,
    label: string,
    fields: ArticleParameterField[],
    nameGroupKey: string | null,
    options: ArticleParameterGroupOptions = {},
): ArticleParameterGroup {
    return {
        citationReview: Boolean(options.citationReview),
        fields,
        fullTextReview: Boolean(options.fullTextReview),
        key,
        label,
        nameGroupKey,
        previewKey: options.previewKey || '',
    };
}

export const SOURCE_REFERENCE_FIELDS = getArticleSourceFields();

/**
 * Gets a registered source URL field by article field key.
 *
 * @param key - Article field key.
 * @returns Matching source field definition.
 */
function getSourceReferenceField(
    key: string,
): SourceReferenceField | undefined {
    return SOURCE_REFERENCE_FIELDS.find((field) => field.key === key);
}

export const NAME_MARKETS = [
    {
        key: 'ww',
        label: 'WW',
    },
    {
        key: 'hans',
        label: 'Hans',
    },
    {
        key: 'hant',
        label: 'Hant',
    },
    {
        key: 'cn',
        label: 'CN',
    },
    {
        key: 'tw',
        label: 'TW',
    },
    {
        key: 'hk',
        label: 'HK',
    },
];
const STEAM_NAME_CHOICES = [
    {
        key: 'neither',
        label: msg('names.neither'),
    },
    {
        key: 'simp',
        label: msg('names.simplified'),
    },
    {
        key: 'trad',
        label: msg('names.traditional'),
    },
    {
        key: 'diff',
        label: msg('names.diff'),
    },
    {
        key: 'same',
        label: msg('names.same'),
    },
];
export const STEAM_NAME_BUTTONS = STEAM_NAME_CHOICES.map(
    function callback(choice) {
        const result = {
            label: choice.label,
            value: choice.key,
        };
        return result;
    },
);
export const STEAM_NAME_HELPER_ROW = Symbol(
    'kanade-vg-stub-creator-steam-name-helper',
);
export const NOTE_TA_NAMES_SOURCE = 'names';
export const CODEMIRROR_MODULES = [
    'ext.CodeMirror',
    'ext.CodeMirror.mode.mediawiki',
];
const ARTICLE_TITLE_PLACEHOLDER = msg('text.articleTitlePlaceholder');
export const HISTORY_EXPORT_ERROR = msg('form.historyImportHelp');
export const CITATION_TABLE_COLUMNS = [
    { id: 'name', label: msg('references.parameter') },
    { id: 'value', label: msg('common.value') },
    { id: 'actions', label: msg('common.actions') },
];
export const MAIN_ACTION_MENU_ITEMS = [
    { label: msg('form.history'), value: 'history' },
    { label: msg('form.reload'), value: 'reload' },
    {
        action: 'destructive' as const,
        label: msg('form.clear'),
        value: 'clear',
    },
];
const REFRESH_ICON = {
    path: [
        'M10 3a7 7 0 0 1 6.2 3.8L18 5v5h-5l',
        '1.8-1.8A5 5 0 1 0 15 12h2a7 7 0 1 ',
        '1-7-9z',
    ].join(''),
};

export const TABLE_ACTION_ICONS = {
    externalLink: cdxIconLinkExternal,
    add: { path: 'M9 3h2v6h6v2h-6v6H9v-6H3V9h6z' },
    cdxIconArticleAdd: {
        path: [
            'M3 3h8l4 4v2h-2V8h-3V5H5v12h5v2H3z',
            'm12 8h2v3h3v2h-3v3h-2v-3h-3v-2h3z',
        ].join(''),
    },
    regenerate: REFRESH_ICON,
    clean: {
        path: 'M5 3h10v2H5zm2 4h6l1 10H6zm2 2v6h1V9zm2 0v6h1V9z',
    },
    remove: {
        path: [
            'M6 7h2v9H6zm6 0h2v9h-2zM5 4h10l-1-',
            '2H6zm-2 1h14v2H3zm2 3h10l-1 10H6z',
        ].join(''),
    },
};
export const PRE_SAVE_STATUS_ICONS = {
    complete: {
        path: 'M8.8 13.6 4.6 9.4 3.2 10.8 8.8 16.4 18 7.2 16.6 5.8z',
    },
    failed: {
        path: [
            'm5.4 4 4.6 4.6L14.6 4 16 5.4 11.4 ',
            '10l4.6 4.6-1.4 1.4-4.6-4.6L5.4 16 ',
            '4 14.6 8.6 10 4 5.4z',
        ].join(''),
    },
    pending: {
        path: [
            'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-1',
            '4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-',
            '10z',
        ].join(''),
    },
    running: {
        path: 'M10 3a7 7 0 1 0 7 7h-2a5 5 0 1 1-5-5z',
    },
    skipped: {
        path: 'M4 5v10l7-5zm8 0h2v10h-2z',
    },
};
const metadataGroupLabel = msg('metadata.tab');
const enwikiTitleLabel = msg('metadata.enwikiPage');
const enwikiTitlePlaceholder = msg('metadata.enwikiPagePlaceholder');
const enwikiTitleField = createArticleParameterField(
    'enwikiTitle',
    enwikiTitleLabel,
    null,
    { placeholder: enwikiTitlePlaceholder },
);
const developersLabel = msg('metadata.developers');
const developersSourceField = getSourceReferenceField('developers');
const developersPlaceholder = msg('metadata.namesPlaceholder');
const developersField = createArticleParameterField(
    'developers',
    developersLabel,
    developersSourceField,
    { placeholder: developersPlaceholder },
);
const publishersLabel = msg('metadata.publishers');
const publishersSourceField = getSourceReferenceField('publishers');
const publishersPlaceholder = msg('metadata.namesPlaceholder');
const publishersField = createArticleParameterField(
    'publishers',
    publishersLabel,
    publishersSourceField,
    { placeholder: publishersPlaceholder },
);
const seriesLabel = msg('metadata.series');
const seriesSourceField = getSourceReferenceField('series');
const seriesPlaceholder = msg('metadata.titlePlaceholder');
const seriesField = createArticleParameterField(
    'series',
    seriesLabel,
    seriesSourceField,
    { placeholder: seriesPlaceholder },
);
const platformsLabel = msg('metadata.platforms');
const platformsSourceField = getSourceReferenceField('platforms');
const platformsPlaceholder = msg('metadata.namesPlaceholder');
const platformsField = createArticleParameterField(
    'platforms',
    platformsLabel,
    platformsSourceField,
    { placeholder: platformsPlaceholder },
);
const yearLabel = msg('metadata.releaseYear');
const yearSourceField = getSourceReferenceField('year');
const yearPlaceholder = msg('metadata.yearPlaceholder');
const yearField = createArticleParameterField(
    'year',
    yearLabel,
    yearSourceField,
    { placeholder: yearPlaceholder },
);
const genresLabel = msg('metadata.genres');
const genresSourceField = getSourceReferenceField('genres');
const genresPlaceholder = msg('metadata.namesPlaceholder');
const genresField = createArticleParameterField(
    'genres',
    genresLabel,
    genresSourceField,
    {
        placeholder: genresPlaceholder,
        previewKey: 'attribution',
    },
);
const metadataFields = [
    enwikiTitleField,
    developersField,
    publishersField,
    seriesField,
    platformsField,
    yearField,
    genresField,
];
const metadataGroup = createArticleParameterGroup(
    'metadata',
    metadataGroupLabel,
    metadataFields,
    null,
    {
        previewKey: 'attribution',
    },
);

const titlesGroupLabel = msg('titles.tab');
const originalNameLabel = msg('titles.originalTitle');
const originalNameSourceField = getSourceReferenceField('originalName');
const originalNamePlaceholder = msg('titles.originalTitlePlaceholder');
const originalNameField = createArticleParameterField(
    'originalName',
    originalNameLabel,
    originalNameSourceField,
    { placeholder: originalNamePlaceholder },
);
const englishNameLabel = msg('titles.englishTitle');
const englishNameSourceField = getSourceReferenceField('englishName');
const englishNamePlaceholder = msg('titles.localizedTitlePlaceholder');
const englishNameField = createArticleParameterField(
    'englishName',
    englishNameLabel,
    englishNameSourceField,
    {
        placeholder: englishNamePlaceholder,
        previewKey: 'names',
    },
);
const sortKeyLabel = msg('titles.defaultSortKey');
const sortKeyPlaceholder = msg('titles.defaultSortPlaceholder');
const sortKeyField = createArticleParameterField(
    'sortKey',
    sortKeyLabel,
    null,
    { placeholder: sortKeyPlaceholder },
);
const textGroupLabel = msg('text.tab');
const pageNameLabel = msg('text.pageName');
const pageNamePlaceholder = msg('text.pageNamePlaceholder');
const pageNameField = createArticleParameterField(
    'pageName',
    pageNameLabel,
    null,
    { placeholder: pageNamePlaceholder },
);
const articleNameLabel = msg('text.articleDisplayTitle');
const articleNameField = createArticleParameterField(
    'name',
    articleNameLabel,
    null,
    { placeholder: ARTICLE_TITLE_PLACEHOLDER },
);
const titleFields = [
    pageNameField,
    articleNameField,
    originalNameField,
    englishNameField,
    sortKeyField,
];
const titlesGroup = createArticleParameterGroup(
    'titles',
    titlesGroupLabel,
    titleFields,
    'localizedNames',
);
const metacriticScoreLabel = msg('text.metacriticScore');
const metacriticScoreSourceField = getSourceReferenceField('metacriticScore');
const metacriticScoreHeading = msg('text.metacriticScore');
const metacriticScoreField = createArticleParameterField(
    'metacriticScore',
    metacriticScoreLabel,
    metacriticScoreSourceField,
    {
        heading: metacriticScoreHeading,
        placeholder: 'ps4:95 or 95',
    },
);
const openCriticLabel = msg('text.openCritic');
const openCriticSourceField = getSourceReferenceField('openCriticRecommend');
const openCriticHeading = msg('text.openCritic');
const openCriticPlaceholder = msg('text.openCriticPlaceholder');
const openCriticField = createArticleParameterField(
    'openCriticRecommend',
    openCriticLabel,
    openCriticSourceField,
    {
        heading: openCriticHeading,
        placeholder: openCriticPlaceholder,
        previewKey: 'score',
    },
);
const additionalProseLabel = msg('text.additionalProse');
const additionalProseSourceField = getSourceReferenceField('additionalProse');
const additionalProsePlaceholder = msg('text.additionalProsePlaceholder');
const additionalProseField = createArticleParameterField(
    'additionalProse',
    additionalProseLabel,
    additionalProseSourceField,
    {
        multiline: true,
        placeholder: additionalProsePlaceholder,
    },
);
const textFields = [
    metacriticScoreField,
    openCriticField,
    additionalProseField,
];
const textGroup = createArticleParameterGroup(
    'text',
    textGroupLabel,
    textFields,
    null,
    {
        fullTextReview: true,
    },
);

const referencesGroupLabel = msg('references.tab');
const referencesGroup = createArticleParameterGroup(
    'references',
    referencesGroupLabel,
    [],
    null,
    {
        citationReview: true,
    },
);
export const ARTICLE_PARAMETER_GROUPS = [
    metadataGroup,
    titlesGroup,
    textGroup,
    referencesGroup,
];
