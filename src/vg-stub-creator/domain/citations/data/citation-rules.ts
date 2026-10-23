/**
 * @file src/vg-stub-creator/domain/citations/data/citation-rules.ts
 * Purpose: Defines source-specific citation metadata normalization.
 * Contents: Host matching, parameter cleanup, and preserved source queries.
 */

export default [
    {
        fixes: [
            {
                action: 'replace',
                field: 'language',
                operand: {
                    pattern: '^(?!zh(?:-|$))([a-z]+)-.+$',
                    replacement: '$1',
                },
            },
        ],
    },
    {
        host: 'gameinformer.com',
        fixes: [
            {
                action: 'replace',
                field: 'title',
                operand: {
                    pattern: ' - Game Informer$',
                    replacement: '',
                },
            },
        ],
    },
    {
        host: 'www.gameinformer.com',
        fixes: [
            {
                action: 'replace',
                field: 'title',
                operand: {
                    pattern: ' - Game Informer$',
                    replacement: '',
                },
            },
        ],
    },
    {
        host: 'gnn.gamer.com.tw',
        fixes: [
            {
                action: 'omit',
                field: 'author',
                operand: '巴哈姆特',
            },
        ],
    },
    {
        host: 'opencritic.com',
        fixes: [
            {
                action: 'omit',
                field: 'date',
            },
        ],
    },
    {
        host: 'www.metacritic.com',
        fixes: [
            {
                action: 'set',
                field: 'website',
                operand: 'Metacritic',
            },
            {
                action: 'replace',
                field: 'title',
                operand: {
                    pattern: ' - Metacritic$',
                    replacement: '',
                },
            },
        ],
    },
    {
        host: 'store.steampowered.com',
        redirect: true,
        fixes: [
            {
                action: 'set',
                field: 'via',
                operand: 'Steam',
            },
            {
                action: 'omit',
                field: 'website',
            },
            {
                action: 'set-from-source-query',
                field: 'language',
                operand: {
                    key: 'l',
                    values: {
                        schinese: 'zh-Hans',
                        tchinese: 'zh-Hant',
                    },
                },
            },
            {
                action: 'preserve-source-query',
                field: 'url',
                operand: ['l'],
            },
        ],
    },
];
