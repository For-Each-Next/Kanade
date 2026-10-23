/**
 * @file scripts/tools.mjs
 * Purpose: Define tool metadata, asset ownership, and distribution boundaries.
 *
 * Contents: Stable tool IDs, source directories, and artifact names.
 */

export const tools = [
    {
        id: 'source-editor',
        directory: 'source-editor',
        name: 'Source Editor',
        basename: 'source_editor',
        description:
            'Edit and format wikitext, manage references, and review citations in one source workspace.',
        license: 'CC0-1.0 AND MIT AND CC-BY-4.0 AND BSD-2-Clause',
        matches: [
            'https://*.wikipedia.org/*',
            'https://*.wiktionary.org/*',
            'https://*.wikibooks.org/*',
            'https://*.wikiquote.org/*',
            'https://*.wikinews.org/*',
            'https://*.wikisource.org/*',
            'https://*.wikiversity.org/*',
            'https://*.wikivoyage.org/*',
            'https://*.wikimedia.org/*',
            'https://*.wikidata.org/*',
            'https://*.wikifunctions.org/*',
            'https://*.mediawiki.org/*',
        ],
        packages: ['@wikimedia/codex-icons', 'entities'],
        noticeSections: [
            'Codex icons',
            'HTML entity decoder',
            'Wikimedia data',
            'Source Editor citation template data',
            'MediaWiki site configuration',
            'MIT: Codex icon software',
            'BSD-2-Clause: entities',
        ],
        attribution: [
            "Based on Cacycle's wikEd: https://en.wikipedia.org/wiki/User:Cacycle/wikEd",
            'Special thanks: Remember the dot.',
        ],
        referenceIcons: true,
        compactInlineWhitespace: true,
        assets: {
            __SOURCE_EDITOR_EDITOR_STYLES__: 'features/editor/styles.css',
            __SOURCE_EDITOR_PANEL_DIALOG_STYLES__:
                'features/formatter/dialog.css',
            __SOURCE_EDITOR_PANEL_DIALOG_TEMPLATE__:
                'features/formatter/dialog.vue',
            __SOURCE_EDITOR_SOURCE_MANAGER_STYLES__:
                'features/source-manager/styles.css',
            __SOURCE_EDITOR_REFERENCE_MAIN_DIALOG_TEMPLATE__:
                'features/source-manager/dialogs/main-dialog.vue',
            __SOURCE_EDITOR_REFERENCE_MAIN_DIALOG_STYLES__:
                'features/source-manager/dialogs/main-dialog.css',
            __SOURCE_EDITOR_REFERENCE_DRAFT_DIALOG_TEMPLATE__:
                'features/source-manager/dialogs/draft-dialog.vue',
            __SOURCE_EDITOR_REFERENCE_DRAFT_DIALOG_STYLES__:
                'features/source-manager/dialogs/draft-dialog.css',
            __SOURCE_EDITOR_REFERENCE_PARAMETER_ALIAS_DIALOG_TEMPLATE__:
                'features/source-manager/dialogs/parameter-alias-dialog.vue',
            __SOURCE_EDITOR_REFERENCE_PARAMETER_ALIAS_DIALOG_STYLES__:
                'features/source-manager/dialogs/parameter-alias-dialog.css',
            __SOURCE_EDITOR_REFERENCE_TOOL_DIALOG_TEMPLATE__:
                'features/source-manager/dialogs/tool-dialog.vue',
            __SOURCE_EDITOR_REFERENCE_TOOL_DIALOG_STYLES__:
                'features/source-manager/dialogs/tool-dialog.css',
            __SOURCE_EDITOR_REFERENCE_CLOSE_DIALOG_TEMPLATE__:
                'features/source-manager/dialogs/close-confirmation-dialog.vue',
            __SOURCE_EDITOR_REFERENCE_CLOSE_DIALOG_STYLES__:
                'features/source-manager/dialogs/close-confirmation-dialog.css',
        },
        compactReadableTemplates: false,
        compactReadableTemplatePrefixes: ['features/source-manager/'],
    },
    {
        id: 'rev-copy',
        directory: 'rev-copy',
        name: 'Revision Copy',
        basename: 'rev_copy',
        description:
            'Copy page and permanent revision links as wikitext on Wikimedia sites.',
        license: 'CC0-1.0',
        matches: [
            'https://*.wikipedia.org/*',
            'https://*.wiktionary.org/*',
            'https://*.wikibooks.org/*',
            'https://*.wikiquote.org/*',
            'https://*.wikinews.org/*',
            'https://*.wikisource.org/*',
            'https://*.wikiversity.org/*',
            'https://*.wikivoyage.org/*',
            'https://commons.wikimedia.org/*',
            'https://commons.m.wikimedia.org/*',
            'https://meta.wikimedia.org/*',
            'https://meta.m.wikimedia.org/*',
            'https://species.wikimedia.org/*',
            'https://species.m.wikimedia.org/*',
            'https://wikidata.org/*',
            'https://www.wikidata.org/*',
            'https://m.wikidata.org/*',
            'https://mediawiki.org/*',
            'https://www.mediawiki.org/*',
            'https://m.mediawiki.org/*',
        ],
        packages: [],
        noticeSections: [],
        resourceLoaderBootstrap: true,
        noFrames: true,
        assets: {},
    },
    {
        id: 'vg-stub-creator',
        directory: 'vg-stub-creator',
        name: 'Article Creator',
        basename: 'vg_stub_creator',
        description:
            'Create and review Chinese Wikipedia video game article drafts, with an English Wikipedia launcher.',
        license: 'CC0-1.0 AND MIT AND CC-BY-4.0',
        matches: ['https://en.wikipedia.org/*', 'https://zh.wikipedia.org/*'],
        packages: ['@wikimedia/codex-icons'],
        noticeSections: [
            'Codex icons',
            'Wikimedia data',
            'MediaWiki site configuration',
            'Article Creator catalogs',
            'MIT: Codex icon software',
        ],
        assets: {
            __VG_STUB_CREATOR_SHARED_DIALOG_STYLES__:
                'features/creator/dialogs/shared.css',
            __VG_STUB_CREATOR_MAIN_DIALOG_TEMPLATE__:
                'features/creator/dialogs/main-dialog.vue',
            __VG_STUB_CREATOR_MAIN_DIALOG_STYLES__:
                'features/creator/dialogs/main-dialog.css',
            __VG_STUB_CREATOR_PREVIEW_DIALOG_TEMPLATE__:
                'features/creator/dialogs/preview-dialog.vue',
            __VG_STUB_CREATOR_PREVIEW_DIALOG_STYLES__:
                'features/creator/dialogs/preview-dialog.css',
            __VG_STUB_CREATOR_PRE_SAVE_DIALOG_TEMPLATE__:
                'features/creator/dialogs/pre-save-dialog.vue',
            __VG_STUB_CREATOR_PRE_SAVE_DIALOG_STYLES__:
                'features/creator/dialogs/pre-save-dialog.css',
            __VG_STUB_CREATOR_MOVE_DIALOG_TEMPLATE__:
                'features/creator/dialogs/move-dialog.vue',
            __VG_STUB_CREATOR_MOVE_DIALOG_STYLES__:
                'features/creator/dialogs/move-dialog.css',
            __VG_STUB_CREATOR_HISTORY_JSON_DIALOG_TEMPLATE__:
                'features/creator/dialogs/history-json-dialog.vue',
            __VG_STUB_CREATOR_HISTORY_JSON_DIALOG_STYLES__:
                'features/creator/dialogs/history-json-dialog.css',
            __VG_STUB_CREATOR_HISTORY_DIALOG_TEMPLATE__:
                'features/creator/dialogs/history-dialog.vue',
            __VG_STUB_CREATOR_HISTORY_DIALOG_STYLES__:
                'features/creator/dialogs/history-dialog.css',
            __VG_STUB_CREATOR_PAGE_EDIT_DIALOG_TEMPLATE__:
                'features/creator/dialogs/page-edit-dialog.vue',
            __VG_STUB_CREATOR_PAGE_EDIT_DIALOG_STYLES__:
                'features/creator/dialogs/page-edit-dialog.css',
            __VG_STUB_CREATOR_CATEGORY_VIEW_DIALOG_TEMPLATE__:
                'features/creator/dialogs/category-view-dialog.vue',
            __VG_STUB_CREATOR_CATEGORY_VIEW_DIALOG_STYLES__:
                'features/creator/dialogs/category-view-dialog.css',
        },
    },
    {
        id: 'wpvg-assessor',
        directory: 'wpvg-assessor',
        name: 'Article Assessor',
        basename: 'wpvg_assessor',
        description:
            'Review and save WikiProject Video games assessments on Chinese Wikipedia.',
        license: 'CC0-1.0',
        matches: ['https://zh.wikipedia.org/*'],
        packages: [],
        noticeSections: ['Wikimedia data', 'MediaWiki site configuration'],
        compactInlineWhitespace: true,
        assets: {
            __WPVG_ASSESSOR_ARCHIVE_DIALOG_TEMPLATE__:
                'features/archive/dialogs/archive-dialog.vue',
            __WPVG_ASSESSOR_ARCHIVE_DIALOG_STYLES__:
                'features/archive/dialogs/archive-dialog.css',
            __WPVG_ASSESSOR_DIALOG_TEMPLATE__:
                'features/assessment/dialogs/assessment-dialog.vue',
            __WPVG_ASSESSOR_DIALOG_STYLES__:
                'features/assessment/dialogs/assessment-dialog.css',
            __WPVG_ASSESSOR_LOADING_DIALOG_TEMPLATE__:
                'features/assessment/dialogs/loading-dialog.vue',
            __WPVG_ASSESSOR_LOADING_DIALOG_STYLES__:
                'features/assessment/dialogs/loading-dialog.css',
            __WPVG_ASSESSOR_WIKITEXT_COMPARISON_TEMPLATE__:
                'features/assessment/components/wikitext-comparison.vue',
            __WPVG_ASSESSOR_WIKITEXT_COMPARISON_STYLES__:
                'features/assessment/components/wikitext-comparison.css',
            __WPVG_ASSESSOR_CATEGORY_DIALOG_TEMPLATE__:
                'features/assessment/dialogs/category-dialog.vue',
            __WPVG_ASSESSOR_CATEGORY_DIALOG_STYLES__:
                'features/assessment/dialogs/category-dialog.css',
        },
    },
];

export const artifactNames = tools.flatMap(({ basename }) => [
    `${basename}.min.js`,
    `${basename}.user.js`,
]);
