/**
 * @file tests/vg-stub-creator/terminology-discovery.test.mjs
 * Purpose: Verify append-only terminology discovery using offline Wikipedia metadata.
 *
 * Table of contents:
 * 1. Imports
 * 2. article
 * 3. typedArticle
 * 4. records
 * 5. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    discoverGenreDefinitions,
    discoverTerminologyDefinitions,
} from '../../scripts/vg-stub-creator/terminology-discovery.mjs';

function article(title, id, counterpart, language = 'en') {
    return {
        title,
        ns: 0,
        exists: true,
        pageprops: { wikibase_item: id },
        langlinks: counterpart ? [{ lang: language, title: counterpart }] : [],
        categories: [{ title: 'Category:Video game genres' }],
    };
}

function typedArticle(title, id, counterpart, category, language = 'en') {
    return {
        ...article(title, id, counterpart, language),
        categories: [{ title: `Category:${category}`, ns: 14 }],
    };
}

function records(...articles) {
    return new Map(
        articles.map((record) => [
            record.title.replaceAll('_', ' ').trim().toLowerCase(),
            record,
        ]),
    );
}

test('new extraction and cozy genres preserve root discovery order without guessed associations', () => {
    const chinese = records(
        article('撤離射擊遊戲', 'Q100', 'Extraction shooter'),
        article('舒適遊戲', 'Q200', 'Cozy game'),
    );
    const english = records(
        article('Extraction shooter', 'Q100', '撤離射擊遊戲', 'zh'),
        article('Cozy game', 'Q200', '舒適遊戲', 'zh'),
    );
    assert.deepEqual(
        discoverGenreDefinitions(
            ['舒適遊戲', '撤離射擊遊戲'],
            [],
            chinese,
            english,
        ),
        [
            {
                aliases: ['舒適遊戲', 'Cozy game'],
                label: '舒適遊戲',
                page: '舒適遊戲',
                categories: [],
            },
            {
                aliases: ['撤離射擊遊戲', 'Extraction shooter'],
                label: '撤離射擊遊戲',
                page: '撤離射擊遊戲',
                categories: [],
            },
        ],
    );
});

test('existing labels, pages, aliases and full-match patterns block duplicate genres unchanged', () => {
    const pattern = /舒適/gu;
    pattern.lastIndex = 2;
    const existing = [
        {
            label: '撤離射擊',
            page: '撤離射擊遊戲',
            aliases: ['撤離射擊', 'extraction shooter'],
        },
        { label: '休閒', aliases: ['休閒', pattern] },
    ];
    const before = existing.map((definition) => ({
        ...definition,
        aliases: [...definition.aliases],
    }));
    const chinese = records(
        article('撤離射擊遊戲', 'Q100', 'Extraction shooter'),
        article('舒適遊戲', 'Q200', 'Cozy game'),
    );
    const english = records(
        article('Extraction shooter', 'Q100', undefined),
        article('Cozy game', 'Q200', undefined),
    );
    assert.deepEqual(
        discoverGenreDefinitions(
            [...chinese.keys()],
            existing,
            chinese,
            english,
        ),
        [],
    );
    assert.deepEqual(existing, before);
    assert.equal(existing[1].aliases[1], pattern);
    assert.equal(pattern.lastIndex, 2);
});

test('English field shorthand prevents duplicate game and video-game suffix variants', () => {
    const existing = [{ label: '舒適', aliases: ['舒適', 'cozy'] }];
    const chinese = records(article('舒適遊戲', 'Q200', 'Cozy video game'));
    const english = records(article('Cozy video game', 'Q200', undefined));
    assert.deepEqual(
        discoverGenreDefinitions(['舒適遊戲'], existing, chinese, english),
        [],
    );
});

test('redirected Chinese variants and shared canonical English pages are added once', () => {
    const chinese = records(
        article('舒適遊戲', 'Q200', 'Cozy game'),
        article('休閒治癒遊戲', 'Q200', 'Cozy game'),
    );
    chinese.set('舒适游戏', chinese.get('舒適遊戲'));
    const english = records(article('Cozy game', 'Q200', undefined));
    const definitions = discoverGenreDefinitions(
        ['舒适游戏', '舒適遊戲', '休閒治癒遊戲'],
        [],
        chinese,
        english,
    );
    assert.equal(definitions.length, 1);
    assert.equal(definitions[0].page, '舒適遊戲');
});

test('generic trope pages and non-video-game categories cannot become genres', () => {
    const chinese = records(
        article('反英雄', 'Q300', 'Antihero'),
        article('舒適遊戲', 'Q200', 'Cozy game'),
    );
    const english = records(
        {
            ...article('Antihero', 'Q300', undefined),
            categories: [{ title: 'Category:Character tropes' }],
        },
        {
            ...article('Cozy game', 'Q200', undefined),
            categories: [{ title: 'Category:Board games' }],
        },
    );
    assert.deepEqual(
        discoverGenreDefinitions([...chinese.keys()], [], chinese, english),
        [],
    );
});

test('missing, disambiguation, fragment and mismatched crosswiki identities are rejected', () => {
    const cases = [
        { chinese: { exists: false } },
        { chinese: { ns: 14 } },
        { chinese: { fragment: 'Video games' } },
        {
            chinese: {
                pageprops: { disambiguation: '', wikibase_item: 'Q200' },
            },
        },
        { chinese: { langlinks: [] } },
        { english: { exists: false } },
        { english: { ns: 10 } },
        { english: { fragment: 'History' } },
        {
            english: {
                pageprops: { disambiguation: '', wikibase_item: 'Q200' },
            },
        },
        { english: { pageprops: { wikibase_item: 'Q999' } } },
        { omitEnglish: true },
    ];
    for (const scenario of cases) {
        const chinese = records({
            ...article('舒適遊戲', 'Q200', 'Cozy game'),
            ...scenario.chinese,
        });
        const english = scenario.omitEnglish
            ? new Map()
            : records({
                  ...article('Cozy game', 'Q200', undefined),
                  ...scenario.english,
              });
        assert.deepEqual(
            discoverGenreDefinitions(['舒適遊戲'], [], chinese, english),
            [],
            JSON.stringify(scenario),
        );
    }
});

test('meta genre overview pages and both Chinese writing variants are excluded', () => {
    const chinese = records(
        article('電子遊戲類型', 'Q400', 'Video game genre'),
        article('电子游戏类型', 'Q400', 'Video game genre'),
        article('遊戲分類', 'Q400', 'Video game genre'),
    );
    const english = records(article('Video game genre', 'Q400', undefined));
    assert.deepEqual(
        discoverGenreDefinitions([...chinese.keys()], [], chinese, english),
        [],
    );
});

test('a verified language link suffices when one project lacks a Wikidata identifier', () => {
    const chinese = records(article('舒適遊戲', undefined, 'Cozy game'));
    const english = records(article('Cozy game', 'Q200', undefined));
    assert.equal(
        discoverGenreDefinitions(['舒適遊戲'], [], chinese, english).length,
        1,
    );
});

test('Free Lives, Dotemu and DeNA require confirmed video-game company counterparts', () => {
    const chinese = records(
        article('自由生命', 'Q501', 'Free Lives'),
        article('Dotemu', 'Q502', 'Dotemu'),
        article('DeNA', 'Q503', 'DeNA'),
    );
    const english = records(
        typedArticle(
            'Free Lives',
            'Q501',
            '自由生命',
            'Video game companies of South Africa',
            'zh',
        ),
        typedArticle(
            'Dotemu',
            'Q502',
            'Dotemu',
            'Video game publishing companies',
            'zh',
        ),
        typedArticle(
            'DeNA',
            'Q503',
            'DeNA',
            'Video game development companies',
            'zh',
        ),
    );
    const definitions = discoverTerminologyDefinitions(
        'companies',
        ['自由生命', 'Dotemu', 'DeNA'],
        [],
        chinese,
        english,
    );
    assert.deepEqual(definitions, [
        {
            aliases: ['自由生命', 'Free Lives'],
            label: '自由生命',
            page: '自由生命',
            categories: [],
        },
        {
            aliases: ['Dotemu'],
            label: 'Dotemu',
            page: 'Dotemu',
            categories: [],
        },
        { aliases: ['DeNA'], label: 'DeNA', page: 'DeNA', categories: [] },
    ]);
});

test('Evercade, Steam Deck and classic home computers need specific platform categories', () => {
    const chinese = records(
        article('Evercade', 'Q601', 'Evercade'),
        article('Steam Deck', 'Q602', 'Steam Deck'),
        article('康懋達64', 'Q603', 'Commodore 64'),
    );
    const english = records(
        typedArticle('Evercade', 'Q601', undefined, 'Handheld game consoles'),
        typedArticle(
            'Steam Deck',
            'Q602',
            undefined,
            'Handheld gaming computers',
        ),
        typedArticle('Commodore 64', 'Q603', undefined, 'Home computers'),
    );
    const definitions = discoverTerminologyDefinitions(
        'platforms',
        [...chinese.keys()],
        [],
        chinese,
        english,
    );
    assert.deepEqual(
        definitions.map((definition) => definition.page),
        ['Evercade', 'Steam Deck', '康懋達64'],
    );
    assert.ok(
        definitions.every(
            (definition) =>
                definition.categories.length === 0 &&
                !definition.stubTags &&
                !definition.navboxes,
        ),
    );
});

test('resolved configured articles and typed English aliases prevent merged-name QID duplicates', () => {
    const existing = [
        {
            label: '舊公司',
            page: '舊公司',
            aliases: ['舊公司', 'Legacy company'],
        },
        { label: 'Old publisher', aliases: ['Old publisher'] },
    ];
    const chinese = records(
        article('合併公司', 'Q700', 'Merged company'),
        article('新發行商', 'Q701', 'Renamed publisher'),
    );
    chinese.set('舊公司', { ...chinese.get('合併公司'), requested: '舊公司' });
    const english = records(
        typedArticle(
            'Merged company',
            'Q700',
            undefined,
            'Video game companies',
        ),
        typedArticle(
            'Renamed publisher',
            'Q701',
            undefined,
            'Video game publishers',
        ),
    );
    english.set('old publisher', english.get('renamed publisher'));
    const original = structuredClone(existing);
    assert.deepEqual(
        discoverTerminologyDefinitions(
            'companies',
            ['合併公司', '新發行商'],
            existing,
            chinese,
            english,
        ),
        [],
    );
    assert.deepEqual(existing, original);
});

test('people, game titles and generic corporate-only categories cannot become companies', () => {
    const chinese = records(
        article('王明', 'Q801', 'Wang Ming'),
        article('一款遊戲', 'Q802', 'A game'),
        article('通用軟件公司', 'Q803', 'Generic software company'),
    );
    const english = records(
        {
            ...typedArticle(
                'Wang Ming',
                'Q801',
                undefined,
                'Video game developers',
            ),
            categories: [
                { title: 'Category:Video game developers', ns: 14 },
                { title: 'Category:Living people', ns: 14 },
            ],
        },
        typedArticle(
            'A game',
            'Q802',
            undefined,
            'Video games developed by Dotemu',
        ),
        typedArticle(
            'Generic software company',
            'Q803',
            undefined,
            'Software companies',
        ),
    );
    assert.deepEqual(
        discoverTerminologyDefinitions(
            'companies',
            [...chinese.keys()],
            [],
            chinese,
            english,
        ),
        [],
    );
});

test('generic computers, operating systems and software services are insufficient platform evidence', () => {
    const chinese = records(
        article('一臺電腦', 'Q901', 'A computer'),
        article('一種作業系統', 'Q902', 'An operating system'),
        article('一種軟件服務', 'Q903', 'A software service'),
    );
    const english = records(
        typedArticle('A computer', 'Q901', undefined, 'Computers'),
        typedArticle(
            'An operating system',
            'Q902',
            undefined,
            'Operating systems',
        ),
        typedArticle(
            'A software service',
            'Q903',
            undefined,
            'Software services',
        ),
    );
    assert.deepEqual(
        discoverTerminologyDefinitions(
            'platforms',
            [...chinese.keys()],
            [],
            chinese,
            english,
        ),
        [],
    );
});

test('Chinese-only companies require explicit company categories and preserve one Chinese alias', () => {
    const chinese = records(
        typedArticle(
            '甲開發工作室',
            'Q1001',
            undefined,
            '中國大陸電子遊戲開發公司',
        ),
        typedArticle('乙發行公司', 'Q1002', undefined, '電子遊戲發行商'),
        typedArticle('丙手機公司', 'Q1003', undefined, '手机游戏公司'),
        typedArticle('丁網絡公司', 'Q1004', undefined, '網路遊戲營運商'),
        typedArticle('普通公司', 'Q1005', undefined, '軟件公司'),
        typedArticle('电子游戏开发公司', 'Q1006', undefined, '電子遊戲公司'),
        typedArticle('中國遊戲公司列表', 'Q1007', undefined, '電子遊戲公司'),
        typedArticle('遊戲作品', 'Q1008', undefined, '电子游戏公司的游戏'),
        {
            ...typedArticle('王明', 'Q1009', undefined, '电子游戏开发商'),
            categories: [
                { title: 'Category:电子游戏开发商', ns: 14 },
                { title: 'Category:在世人物', ns: 14 },
            ],
        },
    );
    const definitions = discoverTerminologyDefinitions(
        'companies',
        [...chinese.keys()],
        [],
        chinese,
        new Map(),
    );
    assert.deepEqual(
        definitions.map((definition) => definition.label),
        ['甲開發工作室', '乙發行公司', '丙手機公司', '丁網絡公司'],
    );
    assert.ok(
        definitions.every(
            (definition) =>
                definition.aliases.length === 1 &&
                definition.aliases[0] === definition.label,
        ),
    );
});

test('Chinese-only consoles, home computers and arcade boards need namespace-14 typed evidence', () => {
    const chinese = records(
        typedArticle('甲掌機', 'Q1101', undefined, '掌上遊戲機'),
        typedArticle('乙主機', 'Q1102', undefined, '第九世代家用游戏机'),
        typedArticle('丙電腦', 'Q1103', undefined, '家用電腦'),
        typedArticle('丁主板', 'Q1104', undefined, '街机主板'),
        typedArticle('普通電腦', 'Q1105', undefined, '電腦'),
        typedArticle('一款遊戲', 'Q1106', undefined, '遊戲機遊戲'),
        {
            ...typedArticle('错误命名空间', 'Q1107', undefined, '电子游戏机'),
            categories: [{ title: 'Category:电子游戏机', ns: 0 }],
        },
        typedArticle('家用游戏机', 'Q1108', undefined, '電子遊戲機'),
    );
    const definitions = discoverTerminologyDefinitions(
        'platforms',
        [...chinese.keys()],
        [],
        chinese,
        new Map(),
    );
    assert.deepEqual(
        definitions.map((definition) => definition.label),
        ['甲掌機', '乙主機', '丙電腦', '丁主板'],
    );
});

test('a present but unknown or mismatched English crosslink cannot fall back to Chinese-only discovery', () => {
    const chinese = records(
        typedArticle('未知公司', 'Q1201', 'Unknown company', '电子游戏公司'),
        typedArticle('錯誤公司', 'Q1202', 'Wrong company', '电子游戏公司'),
        typedArticle('空链接公司', 'Q1203', undefined, '电子游戏公司'),
    );
    chinese.get('空链接公司').langlinks = [{ lang: 'en', title: '' }];
    const english = records(
        typedArticle(
            'Wrong company',
            'Q9999',
            undefined,
            'Video game companies',
        ),
    );
    assert.deepEqual(
        discoverTerminologyDefinitions(
            'companies',
            [...chinese.keys()],
            [],
            chinese,
            english,
        ),
        [],
    );
});

test('Chinese-only merged identities are deduplicated while unknown types stay explicit', () => {
    const chinese = records(
        typedArticle('甲公司', 'Q1301', undefined, '电子游戏公司'),
        typedArticle('甲公司新名稱', 'Q1301', undefined, '电子游戏公司'),
    );
    const definitions = discoverTerminologyDefinitions(
        'companies',
        [...chinese.keys()],
        [],
        chinese,
        new Map(),
    );
    assert.equal(definitions.length, 1);
    assert.equal(definitions[0].page, '甲公司');
    assert.throws(
        () =>
            discoverTerminologyDefinitions(
                'unknown',
                [],
                [],
                new Map(),
                new Map(),
            ),
        /Unsupported terminology discovery type/u,
    );
});

test('all nine generation overviews and console bans are excluded from platform discovery', () => {
    const names = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const ordinals = [
        'First',
        'Second',
        'Third',
        'Fourth',
        'Fifth',
        'Sixth',
        'Seventh',
        'Eighth',
        'Ninth',
    ];
    const chinese = records(
        ...names.map((name, index) =>
            typedArticle(
                `第${name}世代遊戲機`,
                `Q${1401 + index}`,
                `${ordinals[index]} generation of video game consoles`,
                `第${name}世代遊戲機`,
            ),
        ),
        typedArticle('电子游戏机禁令', 'Q1410', undefined, '电子游戏机'),
        typedArticle(
            '主機年代概述',
            'Q1401',
            'First generation of video game consoles',
            '电子游戏机',
        ),
    );
    const english = records(
        ...names.map((_, index) =>
            typedArticle(
                `${ordinals[index]} generation of video game consoles`,
                `Q${1401 + index}`,
                undefined,
                'Home video game consoles',
            ),
        ),
    );
    assert.deepEqual(
        discoverTerminologyDefinitions(
            'platforms',
            [...chinese.keys()],
            [],
            chinese,
            english,
        ),
        [],
    );
});

test('Pong and game articles cannot become platforms through incidental hardware categories', () => {
    const chinese = records(
        {
            ...typedArticle('乓', 'Q1501', 'Pong', '第一世代遊戲機'),
            categories: [
                { title: 'Category:第一世代遊戲機', ns: 14 },
                { title: 'Category:街機遊戲', ns: 14 },
            ],
        },
        typedArticle('一款電子遊戲', 'Q1502', 'A video game', '家用游戏机'),
        {
            ...typedArticle('年份游戏', 'Q1503', undefined, '家用游戏机'),
            categories: [
                { title: 'Category:家用游戏机', ns: 14 },
                { title: 'Category:1980年电子游戏', ns: 14 },
            ],
        },
    );
    const english = records(
        {
            ...typedArticle(
                'Pong',
                'Q1501',
                undefined,
                'Home video game consoles',
            ),
            categories: [
                { title: 'Category:Home video game consoles', ns: 14 },
                { title: 'Category:1972 video games', ns: 14 },
            ],
        },
        {
            ...typedArticle(
                'A video game',
                'Q1502',
                undefined,
                'Home video game consoles',
            ),
            categories: [
                { title: 'Category:Home video game consoles', ns: 14 },
                {
                    title: 'Category:Video games developed by Atari, Inc.',
                    ns: 14,
                },
            ],
        },
    );
    assert.deepEqual(
        discoverTerminologyDefinitions(
            'platforms',
            [...chinese.keys()],
            [],
            chinese,
            english,
        ),
        [],
    );
});

test('console families and peripheral prototypes are excluded while execution-platform prototypes remain eligible', () => {
    const chinese = records(
        typedArticle('任天堂DS家族', 'Q1601', undefined, '任天堂遊戲機'),
        typedArticle(
            '美格福斯奧德賽系列',
            'Q1602',
            'Odyssey series',
            '第一世代遊戲機',
        ),
        typedArticle(
            '超级任天堂CD-ROM转接器',
            'Q1603',
            'Super NES CD-ROM',
            '第四世代遊戲機',
        ),
        {
            ...typedArticle('主機外設', 'Q1604', undefined, '家用游戏机'),
            categories: [
                { title: 'Category:家用游戏机', ns: 14 },
                { title: 'Category:遊戲機配件', ns: 14 },
            ],
        },
        typedArticle(
            '開發用主機',
            'Q1605',
            'Development console',
            '家用游戏机',
        ),
    );
    const english = records(
        typedArticle(
            'Odyssey series',
            'Q1602',
            undefined,
            'Home video game consoles',
        ),
        {
            ...typedArticle(
                'Super NES CD-ROM',
                'Q1603',
                undefined,
                'Home video game consoles',
            ),
            categories: [
                { title: 'Category:Home video game consoles', ns: 14 },
                { title: 'Category:Video game console add-ons', ns: 14 },
            ],
        },
        {
            ...typedArticle(
                'Development console',
                'Q1605',
                undefined,
                'Home video game consoles',
            ),
            categories: [
                { title: 'Category:Home video game consoles', ns: 14 },
                { title: 'Category:Vaporware video game consoles', ns: 14 },
            ],
        },
    );
    const definitions = discoverTerminologyDefinitions(
        'platforms',
        [...chinese.keys()],
        [],
        chinese,
        english,
    );
    assert.deepEqual(
        definitions.map((definition) => definition.label),
        ['開發用主機'],
    );
});

test('a strongly verified BSS 01 console counterpart outweighs incidental Chinese year-game membership', () => {
    const chinese = records({
        ...typedArticle('屏幕游戏01', 'Q164156', 'BSS 01', '第一世代遊戲機'),
        categories: [
            { title: 'Category:第一世代遊戲機', ns: 14 },
            { title: 'Category:1980年电子游戏', ns: 14 },
        ],
    });
    const english = records(
        typedArticle(
            'BSS 01',
            'Q164156',
            undefined,
            'Home video game consoles',
        ),
    );
    assert.deepEqual(
        discoverTerminologyDefinitions(
            'platforms',
            ['屏幕游戏01'],
            [],
            chinese,
            english,
        ),
        [
            {
                aliases: ['屏幕游戏01', 'BSS 01'],
                label: '屏幕游戏01',
                page: '屏幕游戏01',
                categories: [],
            },
        ],
    );
});
