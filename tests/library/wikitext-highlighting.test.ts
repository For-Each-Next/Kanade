/**
 * @file tests/library/wikitext-highlighting.test.ts
 * Purpose: Tests shared wikitext syntax colors, offsets, and passive annotations.
 *
 * Contents: Syntax classification, reference palettes, localized rules, and lossless source output.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeNamespaceCatalog } from '../../src/library/wiki-titles/canonical.ts';
import {
    collectLinkHelperTitles,
    type HighlightSegment,
    highlightWikitext,
    type ImageOptionCatalog,
} from '../../src/library/wikitext-highlighting/highlighter.ts';
import type {
    MagicWordAliases,
    TemplateMagicWordCatalog,
} from '../../src/library/wikitext-highlighting/magic-words.ts';

test('the shared syntax engine runs without a browser and preserves source as inert text', () => {
    const source =
        '<ref name="a">{{cite web|title=[[Page|Label]]|url=https://example.test}}</ref>\n<!-- <script>not HTML</script> -->';
    const segments = highlightWikitext(source);

    assert.equal(typeof globalThis.window, 'undefined');
    assert.equal(segments.map((segment) => segment.text).join(''), source);
    assert.deepEqual(highlightWikitext(source), segments);
    assert.ok(segments.some((segment) => segment.classNames.length > 0));
});

const EXAMPLE_NAMESPACE_CATALOG = decodeNamespaceCatalog('examplewiki', {
    query: {
        namespacealiases: [{ alias: 'Image', id: 6 }],
        namespaces: {
            0: { id: 0, name: '' },
            2: { canonical: 'User', id: 2, name: 'Benutzer' },
            6: { canonical: 'File', id: 6, name: 'Datei' },
            10: { canonical: 'Template', id: 10, name: 'Vorlage' },
            14: { canonical: 'Category', id: 14, name: 'Kategorie' },
        },
    },
});

const EN_NAMESPACE_CATALOG = decodeNamespaceCatalog('enwiki', {
    query: {
        namespacealiases: [],
        namespaces: {
            0: { id: 0, name: '' },
            6: { canonical: 'File', id: 6, name: 'File' },
            10: { canonical: 'Template', id: 10, name: 'Template' },
            14: { canonical: 'Category', id: 14, name: 'Category' },
            828: { canonical: 'Module', id: 828, name: 'Module' },
        },
    },
});
const ZH_NAMESPACE_CATALOG = decodeNamespaceCatalog('zhwiki', {
    query: {
        namespacealiases: [
            { alias: '圖片', id: 6 },
            { alias: '分類', id: 14 },
        ],
        namespaces: {
            0: { id: 0, name: '' },
            6: { canonical: 'File', id: 6, name: '文件' },
            10: { canonical: 'Template', id: 10, name: '模板' },
            14: { canonical: 'Category', id: 14, name: '分类' },
            828: { canonical: 'Module', id: 828, name: 'Module' },
        },
    },
});

function aliases(
    caseInsensitive: readonly string[] = [],
    caseSensitive: readonly string[] = [],
): MagicWordAliases {
    return {
        caseInsensitive: new Set(
            caseInsensitive.map((value) => value.toLowerCase()),
        ),
        caseSensitive: new Set(caseSensitive),
    };
}

const EN_MAGIC_WORDS: TemplateMagicWordCatalog = {
    functions: aliases([
        'DEFAULTSORT:',
        'DEFAULTSORTKEY:',
        'DEFAULTCATEGORYSORT:',
        'DISPLAYTITLE:',
        'NUMBEROFPAGES:',
        'lc:',
        '#if:',
        '#invoke:',
    ]),
    invoke: aliases(['invoke:']),
    modifiers: {
        message: aliases(['msg:', 'msgnw:']),
        raw: aliases(['raw:']),
        substitution: aliases(['subst:', 'safesubst:']),
    },
    variables: aliases([
        'CURRENTYEAR',
        'PAGENAME',
        '#bcp47',
        '#dir',
        '#contentmodel',
        '#LANGUAGE',
        '#interwikilink',
        '#interlanguagelink',
        '#isbn',
    ]),
};
const ZH_MAGIC_WORDS: TemplateMagicWordCatalog = {
    functions: aliases([
        '默认排序:',
        '顯示標題：',
        '#调用：',
        '小写:',
        '格式化数字:',
        '页名:',
    ]),
    invoke: aliases(['调用：']),
    modifiers: {
        message: aliases(),
        raw: aliases(),
        substitution: aliases(),
    },
    variables: aliases(['今天', '本月', '#语言']),
};
const IMAGE_OPTIONS: ImageOptionCatalog = {
    literals: aliases(
        [],
        [
            'baseline',
            'border',
            'bottom',
            'center',
            'centre',
            'enframed',
            'frame',
            'framed',
            'frameless',
            'left',
            'loop',
            'middle',
            'muted',
            'none',
            'right',
            'sub',
            'sup',
            'super',
            'text-bottom',
            'text-top',
            'thumb',
            'thumbnail',
            'top',
            'upright',
            '缩略图',
            'Vorschau',
        ],
    ),
    named: aliases(
        [],
        [
            'alt',
            'class',
            'disablecontrols',
            'end',
            'lang',
            'link',
            'lossy',
            'page',
            'start',
            'thumb',
            'thumbnail',
            'thumbtime',
            'upright',
            '替代',
        ],
    ),
    spaced: aliases([], ['page', 'upright', '直立']),
    underscored: aliases([], ['page', '页码']),
};

function classesAt(
    source: string,
    segments: HighlightSegment[],
    needle: string,
    occurrence = 0,
): string[] {
    let offset = -1;
    for (let index = 0; index <= occurrence; index += 1) {
        offset = source.indexOf(needle, offset + 1);
    }
    return (
        segments.find(
            (segment) => segment.start <= offset && offset < segment.end,
        )?.classNames ?? []
    );
}

function segmentAt(
    source: string,
    segments: HighlightSegment[],
    needle: string,
): HighlightSegment | undefined {
    const offset = source.indexOf(needle);
    return segments.find(
        (segment) => segment.start <= offset && offset < segment.end,
    );
}

function assertHasClass(
    source: string,
    segments: HighlightSegment[],
    needle: string,
    className: string,
    occurrence = 0,
): void {
    assert.ok(
        classesAt(source, segments, needle, occurrence).includes(className),
    );
}

function assertLacksClass(
    source: string,
    segments: HighlightSegment[],
    needle: string,
    className: string,
    occurrence = 0,
): void {
    assert.ok(
        !classesAt(source, segments, needle, occurrence).includes(className),
    );
}

function assertEachHasClass(
    source: string,
    segments: HighlightSegment[],
    needles: readonly string[],
    className: string,
): void {
    for (const needle of needles) {
        assertHasClass(source, segments, needle, className);
    }
}

function assertEachLacksClass(
    source: string,
    segments: HighlightSegment[],
    needles: readonly string[],
    className: string,
): void {
    for (const needle of needles) {
        assertLacksClass(source, segments, needle, className);
    }
}

function assertRangeHasClass(
    source: string,
    segments: HighlightSegment[],
    needle: string,
    className: string,
): void {
    const start = source.indexOf(needle);
    assert.notEqual(start, -1);
    for (let offset = start; offset < start + needle.length; offset += 1) {
        const segment = segments.find(
            (candidate) => candidate.start <= offset && offset < candidate.end,
        );
        assert.ok(segment?.classNames.includes(className));
    }
}

function htmlContentClassesAt(
    source: string,
    segments: HighlightSegment[],
    needle: string,
): string[] {
    return classesAt(source, segments, needle)
        .filter((className) =>
            className.startsWith('kanade-source-editor-token--html-content-'),
        )
        .toSorted();
}

interface ReferenceContainerFixture {
    body: string;
    containerBody: string;
    source: string;
}

function createNestedCitationReference(name: string, label: string): string {
    const content =
        `${label} definition ` + `{{cite web|title={{lang|en|${label}}}}}`;
    return `<ref name="${name}">${content}</ref>`;
}

const REFERENCE_CONTAINER_FIXTURES: ReferenceContainerFixture[] = [
    {
        body: 'Native definition',
        containerBody: 'Native container',
        source: [
            '{{outer|',
            '<references>',
            'Native container {{container template|Native}}',
            createNestedCitationReference('native', 'Native'),
            '</references>',
            '}}',
        ].join('\n'),
    },
    {
        body: 'Refs definition',
        containerBody: 'Refs container',
        source: [
            '{{outer|',
            '{{Reflist|refs=',
            'Refs container {{container template|Refs}}',
            createNestedCitationReference('refs', 'Refs'),
            '}}',
            '}}',
        ].join('\n'),
    },
    {
        body: 'List definition',
        containerBody: 'List container',
        source: [
            '{{outer|',
            '{{Reflist|list=',
            'List container {{container template|List}}',
            createNestedCitationReference('list', 'List'),
            '}}',
            '}}',
        ].join('\n'),
    },
];

function assertReferenceContainerNesting(
    fixture: ReferenceContainerFixture,
    options: Parameters<typeof highlightWikitext>[1] = {},
): void {
    const segments = highlightWikitext(fixture.source, options);
    const expectedDepths = [
        [fixture.containerBody, 0],
        ['container template', 0],
        [fixture.body, 1],
        ['cite web', 1],
        ['lang', 2],
    ] as const;

    for (const [needle, depth] of expectedDepths) {
        assertHasClass(
            fixture.source,
            segments,
            needle,
            `kanade-source-editor-token--template-${depth}`,
        );
    }
    assertReferenceContainerBoundaries(fixture, segments);
}

function assertReferenceContainerBoundaries(
    fixture: ReferenceContainerFixture,
    segments: HighlightSegment[],
): void {
    assertLacksClass(
        fixture.source,
        segments,
        'container template',
        'kanade-source-editor-token--template-1',
    );
    assertLacksClass(
        fixture.source,
        segments,
        'cite web',
        'kanade-source-editor-token--template-2',
    );
    assertLacksClass(
        fixture.source,
        segments,
        fixture.body,
        'kanade-source-editor-token--reference',
    );
    assert.equal(
        segmentAt(fixture.source, segments, fixture.body)?.referenceSource,
        undefined,
    );
    assert.equal(
        segmentAt(fixture.source, segments, fixture.containerBody)?.href,
        undefined,
    );
}

test('reference and nested-template classes differ', () => {
    const source = [
        '<ref>{{cite web|url=https://example.test}}</ref>',
        '{{sfn|Weiss|2014}}',
        '{{efn|A note}}',
        '{{outer|{{inner|value}}}}',
    ].join('\n');
    const classes = highlightWikitext(source).flatMap(
        (segment) => segment.classNames,
    );

    assert.ok(classes.includes('kanade-source-editor-token--reference'));
    assert.ok(classes.includes('kanade-source-editor-token--footnote'));
    assert.ok(classes.includes('kanade-source-editor-token--template-1'));
});

test('nested references and footnotes share one small token', () => {
    const source = '<ref>Outer {{efn|Inner <ref>source</ref>}}</ref>';
    const segments = highlightWikitext(source);

    assertHasClass(
        source,
        segments,
        'Outer',
        'kanade-source-editor-token--reference',
    );
    assertHasClass(
        source,
        segments,
        'Inner',
        'kanade-source-editor-token--footnote',
    );
    assertHasClass(
        source,
        segments,
        'source',
        'kanade-source-editor-token--reference',
    );
    assertHasClass(
        source,
        segments,
        'source',
        'kanade-source-editor-token--footnote',
    );
});

test('alternating reference colors group a reused reference with its following helper', () => {
    const first = '<ref>...</ref>';
    const second = '<ref name="..." />{{sfn|a}}';
    const third = '<ref name="???">...</ref>';
    const source = first + second + third;
    const segments = highlightWikitext(source, {
        alternateReferenceColors: true,
    });

    assertRangeHasClass(
        source,
        segments,
        second,
        'kanade-source-editor-token--reference-blue',
    );
    assertEachHasClass(
        source,
        segments,
        [first, third],
        'kanade-source-editor-token--reference-pink',
    );
    assert.equal(segments.map((segment) => segment.text).join(''), source);
    assert.deepEqual(
        segments.map((segment) => ({
            ...segment,
            classNames: segment.classNames.filter(
                (name) =>
                    !/^kanade-source-editor-token--reference-(?:pink|blue)$/u.test(
                        name,
                    ),
            ),
        })),
        highlightWikitext(source),
    );
});

test('alternating reference colors are disabled unless explicitly enabled', () => {
    const source =
        '<ref>First</ref><ref name="reuse"/>{{sfn|a}}<ref>Third</ref>';
    const segments = highlightWikitext(source);

    assert.deepEqual(
        highlightWikitext(source, { alternateReferenceColors: false }),
        segments,
    );
    assert.ok(
        segments.every(
            (segment) =>
                !segment.classNames.some((name) =>
                    /^kanade-source-editor-token--reference-(?:pink|blue)$/u.test(
                        name,
                    ),
                ),
        ),
    );
});

test('adjacent reference tags and current-wiki citation templates alternate across whitespace', () => {
    const references = [
        '<ref>First</ref>',
        '{{Vorlage:R|second}}',
        '{{sfn|Third}}',
        '<ref name="fourth" />',
    ];
    const source = references.join(' \n');
    const segments = highlightWikitext(source, {
        alternateReferenceColors: true,
        namespaceSource: EXAMPLE_NAMESPACE_CATALOG,
    });

    references.forEach((reference, index) => {
        assertRangeHasClass(
            source,
            segments,
            reference,
            `kanade-source-editor-token--reference-${index % 2 === 1 ? 'blue' : 'pink'}`,
        );
    });
    assertLacksClass(
        source,
        segments,
        ' \n',
        'kanade-source-editor-token--reference-blue',
    );
});

test('reference runs alternate pink and blue starting with pink', () => {
    const fixtures = [
        {
            units: ['<ref/>', '<ref/>', '<ref/>'],
            palettes: ['pink', 'blue', 'pink'],
        },
        {
            units: ['{{r|First}}', '{{sfn|Second}}', '{{sfn|Third}}'],
            palettes: ['pink', 'blue', 'pink'],
        },
        {
            units: ['<ref>First</ref>', '<ref>Second {{efn|Nested}}</ref>'],
            palettes: ['pink', 'blue'],
        },
    ];
    for (const { units, palettes } of fixtures) {
        const source = units.join('');
        const segments = highlightWikitext(source, {
            alternateReferenceColors: true,
        });
        let start = 0;
        units.forEach((unit, index) => {
            const end = start + unit.length;
            const unitSegments = segments.filter(
                (segment) => segment.start >= start && segment.end <= end,
            );
            assert.ok(unitSegments.length > 0);
            for (const segment of unitSegments) {
                assert.deepEqual(
                    segment.classNames.filter((name) =>
                        /^kanade-source-editor-token--reference-(?:pink|blue)$/u.test(
                            name,
                        ),
                    ),
                    [
                        `kanade-source-editor-token--reference-${palettes[index]}`,
                    ],
                    source,
                );
            }
            start = end;
        });
        assert.equal(segments.map((segment) => segment.text).join(''), source);
    }
});

test('explanatory notes retain template shading and small text without joining reference color runs', () => {
    for (const name of [
        'efn',
        'Efn',
        'Vorlage:Efn',
        'efn-lr',
        'efn_la',
        'efn/sub',
        'NoteTag',
        'Vorlage:NoteTag',
    ]) {
        const note = `{{${name}|Note {{lang|en|Nested}}}}`;
        const source = `<ref>Before</ref>${note}<ref>After</ref>`;
        for (const alternateReferenceColors of [false, true]) {
            const segments = highlightWikitext(source, {
                alternateReferenceColors,
                namespaceSource: EXAMPLE_NAMESPACE_CATALOG,
            });

            assertRangeHasClass(
                source,
                segments,
                note,
                'kanade-source-editor-token--footnote',
            );
            assertRangeHasClass(
                source,
                segments,
                note,
                'kanade-source-editor-token--template-0',
            );
            assertHasClass(
                source,
                segments,
                'Nested',
                'kanade-source-editor-token--template-1',
            );
            for (const className of [
                'kanade-source-editor-token--reference',
                'kanade-source-editor-token--reference-pink',
                'kanade-source-editor-token--reference-blue',
            ]) {
                assert.ok(
                    segments
                        .filter(
                            (segment) =>
                                segment.start >= source.indexOf(note) &&
                                segment.end <=
                                    source.indexOf(note) + note.length,
                        )
                        .every(
                            (segment) =>
                                !segment.classNames.includes(className),
                        ),
                    name,
                );
            }
            if (alternateReferenceColors) {
                assertEachHasClass(
                    source,
                    segments,
                    ['Before', 'After'],
                    'kanade-source-editor-token--reference-pink',
                );
            }
            assert.equal(
                segments.map((segment) => segment.text).join(''),
                source,
            );
        }
    }
});

test('consecutive references inside an explanatory note alternate independently of surrounding citations', () => {
    const references = [
        '<ref>{{Cite web|title=琉加|url=https://example.test/fighter|language=zh-Hans}}</ref>',
        '<ref name=":2" details="{{URL|https://archive.test/2006|地球冒险3}}. 攻略人行道 :90-93" />',
        '<ref name="UCG" details="阿修罗. {{url|https://archive.test/UCG|Mother3 攻略透解}} :58-63" />',
        '<ref name=":1" details="张永. {{url|https://archive.test/pocketgamer|地球冒险3}}. 极上攻略 :58-63" />',
        '<ref name=":3" />',
        '<ref>{{Cite journal|author=张永|title=地球冒险3 接上期|page=78-83}}</ref>',
    ];
    const source =
        '<ref>Previous</ref><ref name="DREAM" details="{{URL|https://archive.test/interview|55億年後になくなる地球}}" />' +
        `{{NoteTag|部分游戏内容译名综合参考自以下来源：${references.join('')}}}<ref>After</ref>`;
    const segments = highlightWikitext(source, {
        alternateReferenceColors: true,
    });

    assertHasClass(
        source,
        segments,
        'name="DREAM"',
        'kanade-source-editor-token--reference-blue',
    );
    assertHasClass(
        source,
        segments,
        '部分游戏内容',
        'kanade-source-editor-token--template-0',
    );
    references.forEach((reference, index) => {
        const palette = index % 2 === 0 ? 'pink' : 'blue';
        assertRangeHasClass(
            source,
            segments,
            reference,
            `kanade-source-editor-token--reference-${palette}`,
        );
        const start = source.indexOf(reference);
        const referenceSegments = segments.filter(
            (segment) =>
                segment.start >= start &&
                segment.end <= start + reference.length,
        );
        for (const segment of referenceSegments) {
            assert.equal(segment.referenceSource, reference);
            assert.equal(segment.referenceStart, start);
            assert.ok(
                segment.classNames.includes(
                    'kanade-source-editor-token--footnote',
                ),
            );
            assert.ok(
                !segment.classNames.includes(
                    `kanade-source-editor-token--reference-${palette === 'pink' ? 'blue' : 'pink'}`,
                ),
            );
        }
    });
    assertHasClass(
        source,
        segments,
        'After',
        'kanade-source-editor-token--reference-pink',
    );
    assert.equal(segments.map((segment) => segment.text).join(''), source);
});

test('only the helper immediately after a self-closing tag joins its group', () => {
    const source =
        '<ref>First</ref><ref name="reuse"/>{{sfn|joined}}{{sfn|third}}<ref name="fourth" /> {{sfn|fifth}}';
    const segments = highlightWikitext(source, {
        alternateReferenceColors: true,
    });

    assertEachHasClass(
        source,
        segments,
        ['<ref name="reuse"/>', '{{sfn|joined}}', '<ref name="fourth" />'],
        'kanade-source-editor-token--reference-blue',
    );
    assertEachHasClass(
        source,
        segments,
        ['First', '{{sfn|third}}', '{{sfn|fifth}}'],
        'kanade-source-editor-token--reference-pink',
    );
});

test('reference color runs restart after article text, comments and literal tags', () => {
    const references = '<ref>First</ref><ref>Second</ref>';
    for (const separator of [
        ' article ',
        '<!-- <ref>Hidden</ref>{{sfn|hidden}} -->',
        '<nowiki><ref>Hidden</ref>{{sfn|hidden}}</nowiki>',
    ]) {
        const source =
            references + separator + '<ref>Third</ref><ref>Fourth</ref>';
        const segments = highlightWikitext(source, {
            alternateReferenceColors: true,
        });

        assertEachHasClass(
            source,
            segments,
            ['Second', 'Fourth'],
            'kanade-source-editor-token--reference-blue',
        );
        assertEachHasClass(
            source,
            segments,
            ['First', 'Third'],
            'kanade-source-editor-token--reference-pink',
        );
        assertLacksClass(
            source,
            segments,
            separator,
            'kanade-source-editor-token--reference-blue',
        );
        assertLacksClass(
            source,
            segments,
            separator,
            'kanade-source-editor-token--reference-pink',
        );
    }
});

test('nested references share the outer color while opaque content keeps its palette', () => {
    const source =
        '<ref>First</ref><ref>Second {{cite web|title={{sfn|nested}}}} {{efn|Note <ref>Inner</ref>}}<!-- comment --><nowiki>{{sfn|literal}}</nowiki></ref>{{sfn|Third}}';
    const segments = highlightWikitext(source, {
        alternateReferenceColors: true,
    });

    assertEachHasClass(
        source,
        segments,
        ['Second', 'cite web', 'sfn|nested', 'Note', 'Inner'],
        'kanade-source-editor-token--reference-blue',
    );
    assertEachLacksClass(
        source,
        segments,
        ['First', 'comment', 'sfn|literal', 'sfn|Third'],
        'kanade-source-editor-token--reference-blue',
    );
    assertHasClass(
        source,
        segments,
        'comment',
        'kanade-source-editor-token--comment',
    );
    assertHasClass(
        source,
        segments,
        'sfn|literal',
        'kanade-source-editor-token--nowiki',
    );
});

test('list-defined references do not participate in alternating inline reference colors', () => {
    const source =
        '<references><ref>Definition one</ref><ref>Definition two</ref></references>{{reflist|refs=<ref>Definition three</ref><ref>Definition four</ref>}}';
    const segments = highlightWikitext(source, {
        alternateReferenceColors: true,
    });

    assert.ok(
        segments.every(
            (segment) =>
                !segment.classNames.some((name) =>
                    /^kanade-source-editor-token--reference-(?:pink|blue)$/u.test(
                        name,
                    ),
                ),
        ),
    );
});

test('self-closing references do not color the following article text', () => {
    const source = [
        'Reuse.<ref name="nlife: profile" />',
        'Arch Linux body text remains outside the reference.',
        '<references>',
        '<ref name="nlife: profile">' + '{{Cite news|title=Profile}}</ref>',
        '</references>',
    ].join('\n');
    const segments = highlightWikitext(source);

    assert.ok(
        classesAt(source, segments, '<ref name="nlife: profile" />').includes(
            'kanade-source-editor-token--reference',
        ),
    );
    assert.doesNotMatch(
        classesAt(source, segments, 'Arch Linux body text').join(' '),
        /kanade-source-editor-token--reference/u,
    );
    assert.doesNotMatch(
        classesAt(source, segments, 'Cite news').join(' '),
        /kanade-source-editor-token--reference/u,
    );
});

test('reference attributes keep footnote prose positional', () => {
    const source =
        '{{efn|name=Terraria: Otherworld|' +
        '译名取自[[游民星空]]<ref name="旧城七喜, 2018" />、' +
        '[[触乐]]<ref name="陈祺, 2016" />、游戏大观' +
        '<ref name="游戏大观, 2020" />等，触乐' +
        '<ref name="刘翁婳, 2022" />和游戏茶馆' +
        '<ref name="崴脚君, 2023" />译作「泰拉瑞亚：异界」，' +
        '触乐又译作「泰拉瑞亚：异世界」<ref name="星咏, 2015" />。}}';
    const segments = highlightWikitext(source);

    assertHasClass(
        source,
        segments,
        'name',
        'kanade-source-editor-token--parameter',
    );
    assert.deepEqual(
        segments
            .filter((segment) =>
                segment.classNames.includes(
                    'kanade-source-editor-token--parameter',
                ),
            )
            .map((segment) => segment.text),
        ['name'],
    );
    assertHasClass(
        source,
        segments,
        '<ref name="旧城七喜, 2018" />',
        'kanade-source-editor-token--html-tag',
    );
    assertLacksClass(
        source,
        segments,
        '="旧城七喜, 2018"',
        'kanade-source-editor-token--template-delimiter',
    );
});

test('reference containers use relative template nesting', () => {
    for (const fixture of REFERENCE_CONTAINER_FIXTURES) {
        assertReferenceContainerNesting(fixture);
    }
});

test('current-wiki template prefixes preserve reference nesting', () => {
    const fixture = {
        ...REFERENCE_CONTAINER_FIXTURES[1],
        source: REFERENCE_CONTAINER_FIXTURES[1].source.replace(
            '{{Reflist',
            '{{Vorlage:Reflist',
        ),
    };

    assertReferenceContainerNesting(fixture, {
        namespaceSource: EXAMPLE_NAMESPACE_CATALOG,
    });
});

test('the innermost reference boundary controls template depth', () => {
    const source = [
        '{{sfn|<references>Clipped metadata</references>}}',
        '<references><ref><references>{{Inner reset}}' +
            '</references></ref></references>',
    ].join('\n');
    const segments = highlightWikitext(source);

    assertLacksClass(
        source,
        segments,
        'Clipped metadata',
        'kanade-source-editor-token--reference',
    );
    assert.equal(
        segmentAt(source, segments, 'Clipped metadata')?.href,
        undefined,
    );
    assert.equal(
        segmentAt(source, segments, 'Clipped metadata')?.referenceSource,
        undefined,
    );
    assertHasClass(
        source,
        segments,
        'Inner reset',
        'kanade-source-editor-token--template-0',
    );
    assertLacksClass(
        source,
        segments,
        'Inner reset',
        'kanade-source-editor-token--template-1',
    );
});

test('Arch Linux NoteTA rules use conversion token families', () => {
    const source = [
        '{{NoteTA',
        ' | 2 = zh-cn:乔纳森; zh-tw:強納生; zh-hk:莊拿芬',
        '}}',
    ].join('\n');
    const segments = highlightWikitext(source, { linkHelpers: true });

    assertHasClass(
        source,
        segments,
        'zh-cn:乔纳森',
        'kanade-source-editor-token--language-conversion',
    );
    assertHasClass(
        source,
        segments,
        'zh-cn',
        'kanade-source-editor-token--language-variant',
    );
});

test('NoteTA conversion keys retain complete declaration boundaries', () => {
    const source =
        '{{NoteTA-lite|1=11zh-tw:22; a=>region:xx; a{{=}}>zh-tw:33}}';
    const segments = highlightWikitext(source, { linkHelpers: true });
    const malformed = segmentAt(source, segments, '11zh-tw');

    assert.equal(malformed?.text, '11zh-tw');
    assert.ok(
        malformed?.classNames.includes(
            'kanade-source-editor-token--language-variant',
        ),
    );
    assertHasClass(
        source,
        segments,
        'region',
        'kanade-source-editor-token--language-variant',
    );
    assertHasClass(
        source,
        segments,
        'zh-tw',
        'kanade-source-editor-token--language-variant',
        1,
    );
    assertLacksClass(
        source,
        segments,
        'a=>',
        'kanade-source-editor-token--language-variant',
    );
});

test('NoteTA highlights one-way rules only in supported slots', () => {
    const source =
        '{{NoteTA|25=xxx=>zh-tw:xx|31=zh-cn:no|G=zh-hk:no' +
        '|d=zh-sg:no|T=zh-mo:yes|1=种|2=种;}}';
    const segments = highlightWikitext(source, { linkHelpers: true });

    for (const key of ['zh-tw', 'zh-mo']) {
        assertHasClass(
            source,
            segments,
            key,
            'kanade-source-editor-token--language-variant',
        );
    }
    for (const key of ['zh-cn', 'zh-hk', 'zh-sg', '种']) {
        assertLacksClass(
            source,
            segments,
            key,
            'kanade-source-editor-token--language-variant',
        );
    }
});

test('nested language conversion keeps the complete outer range', () => {
    const source = '-{zh-cn:outer -{zh-cn:inner;zh-tw:nested}-;zh-tw:outer}-';
    const segments = highlightWikitext(source, { linkHelpers: true });

    assertHasClass(
        source,
        segments,
        'zh-tw:outer',
        'kanade-source-editor-token--language-conversion',
    );
    assertHasClass(
        source,
        segments,
        'zh-tw',
        'kanade-source-editor-token--language-variant',
        1,
    );
});

test('conversion separators ignore values and tag attributes', () => {
    const source =
        '-{zh-cn:A=>B; zh-tw:<span title="a:b;=>c">x</span>; a=>region:xx}-';
    const segments = highlightWikitext(source, { linkHelpers: true });

    for (const key of ['zh-cn', 'zh-tw', 'region']) {
        assertHasClass(
            source,
            segments,
            key,
            'kanade-source-editor-token--language-variant',
        );
    }
    for (const value of ['B', 'a:b']) {
        assertLacksClass(
            source,
            segments,
            value,
            'kanade-source-editor-token--language-variant',
        );
    }
});

test('literal tag contents do not create conversion declarations', () => {
    const source =
        '{{NoteTA-lite|1=<nowiki>a;b:c; a=>region:xx</nowiki> plain}}';
    const segments = highlightWikitext(source, { linkHelpers: true });

    assertLacksClass(
        source,
        segments,
        'plain',
        'kanade-source-editor-token--language-conversion',
    );
    assertLacksClass(
        source,
        segments,
        'region',
        'kanade-source-editor-token--language-variant',
    );
});

test('comments before conversion keys preserve declarations', () => {
    const fixtures = [
        ['-{<!--c-->zh-cn:x}-', 'zh-cn'],
        ['-{zh-cn:x;<!--c-->zh-tw:y}-', 'zh-tw'],
        ['{{NoteTA|1=H|<!--c-->zh-tw:x}}', 'zh-tw'],
    ] as const;

    for (const [source, key] of fixtures) {
        assertHasClass(
            source,
            highlightWikitext(source, { linkHelpers: true }),
            key,
            'kanade-source-editor-token--language-variant',
        );
    }
});

test('literal pipes do not split wikilink labels', () => {
    const source = '[[Target|<nowiki>a|b</nowiki> visible]]';
    const segments = highlightWikitext(source);

    assertHasClass(
        source,
        segments,
        'visible',
        'kanade-source-editor-token--link-text',
    );
});

test('localized namespace aliases classify file and category links', () => {
    const source = '[[圖片:Example.svg]] [[分類:Examples]]';
    const segments = highlightWikitext(source, {
        namespaceSource: ZH_NAMESPACE_CATALOG,
    });

    assertHasClass(
        source,
        segments,
        '圖片:Example.svg',
        'kanade-source-editor-token--file-link',
    );
    assertHasClass(
        source,
        segments,
        '分類:Examples',
        'kanade-source-editor-token--category',
    );
});

test('Arch Linux infobox links and HTML keep original token families', () => {
    const source = [
        '{{Infobox OS',
        ' | logo = {{Dark mode switch',
        '  | [[File:Arch Linux logo.svg|250px|alt=Arch Linux标志]]',
        ' }}',
        '}}',
        '通过<code>PKGBUILD</code>脚本编译软件包。',
    ].join('\n');
    const segments = highlightWikitext(source, {
        databaseName: 'zhwiki',
        imageOptions: IMAGE_OPTIONS,
        linkHelpers: true,
    });

    assertHasClass(
        source,
        segments,
        'Dark mode switch',
        'kanade-source-editor-token--template-1',
    );
    assertHasClass(
        source,
        segments,
        'File:Arch Linux',
        'kanade-source-editor-token--file',
    );
    assertHasClass(
        source,
        segments,
        'File:Arch Linux',
        'kanade-source-editor-token--file-link',
    );
    assertHasClass(
        source,
        segments,
        'code',
        'kanade-source-editor-token--html-tag',
    );
    assertHasClass(
        source,
        segments,
        'PKGBUILD',
        'kanade-source-editor-token--html-content-0',
    );
});

test('file options in article examples use syntax-key highlighting', () => {
    const source = [
        '[[File:Emperor Jimmu.jpg|thumb|upright|left|[[神武天皇]]東征]]',
        '[[File:Emblem of the Government of Japan (yellow).svg|75px]]',
    ].join('\n');
    const segments = highlightWikitext(source, { imageOptions: IMAGE_OPTIONS });

    for (const option of ['thumb', 'upright', 'left', '75px']) {
        assertHasClass(
            source,
            segments,
            option,
            'kanade-source-editor-token--parameter',
        );
        assertHasClass(
            source,
            segments,
            option,
            'kanade-source-editor-token--file-link',
        );
    }
    assertLacksClass(
        source,
        segments,
        '東征',
        'kanade-source-editor-token--parameter',
    );
    assertHasClass(
        source,
        segments,
        '|thumb',
        'kanade-source-editor-token--wiki-markup',
    );
});

test('file options recognize MediaWiki format and alignment keywords', () => {
    const options = [
        'baseline',
        'border',
        'bottom',
        'center',
        'centre',
        'enframed',
        'frame',
        'framed',
        'frameless',
        'left',
        'loop',
        'middle',
        'muted',
        'none',
        'right',
        'sub',
        'sup',
        'super',
        'text-bottom',
        'text-top',
        'thumb',
        'thumbnail',
        'top',
        'upright',
    ];

    for (const option of options) {
        const source = `[[File:Example.svg|${option}]]`;
        assertHasClass(
            source,
            highlightWikitext(source, { imageOptions: IMAGE_OPTIONS }),
            option,
            'kanade-source-editor-token--parameter',
        );
    }
});

test('file options recognize documented pixel dimensions', () => {
    const dimensions = [
        '75px',
        '0075px',
        'x75px',
        '75x100px',
        '75 px',
        'x75 px',
        '75x100 px',
    ];

    for (const dimension of dimensions) {
        const source = `[[File:Example.svg|${dimension}]]`;
        assertHasClass(
            source,
            highlightWikitext(source),
            dimension,
            'kanade-source-editor-token--parameter',
        );
    }
});

test('file options distinguish named keys from their values', () => {
    const options = [
        ['alt', 'Accessible map'],
        ['class', 'skin-invert'],
        ['disablecontrols', 'fullscreen'],
        ['end', '1:30'],
        ['lang', 'ja'],
        ['link', 'Emperor Jimmu'],
        ['lossy', 'false'],
        ['page', '2'],
        ['start', '1:25'],
        ['thumb', 'Poster.jpg'],
        ['thumbnail', 'Poster.jpg'],
        ['thumbtime', '1:25'],
        ['upright', '1.2'],
    ] as const;

    for (const [key, value] of options) {
        const source = `[[File:Example.svg|${key}=${value}]]`;
        const segments = highlightWikitext(source, {
            imageOptions: IMAGE_OPTIONS,
        });
        assertHasClass(
            source,
            segments,
            key,
            'kanade-source-editor-token--parameter',
        );
        assertLacksClass(
            source,
            segments,
            value,
            'kanade-source-editor-token--parameter',
        );
        assertHasClass(
            source,
            segments,
            '=',
            'kanade-source-editor-token--template-delimiter',
        );
    }
});

test('file options recognize space-argument page and upright aliases', () => {
    for (const [key, value] of [
        ['page', '2'],
        ['upright', '1.2'],
    ] as const) {
        const source = `[[File:Example.svg|${key} ${value}]]`;
        const segments = highlightWikitext(source, {
            imageOptions: IMAGE_OPTIONS,
        });
        assertHasClass(
            source,
            segments,
            key,
            'kanade-source-editor-token--parameter',
        );
        assertLacksClass(
            source,
            segments,
            value,
            'kanade-source-editor-token--parameter',
        );
    }
});

test('file option captions and malformed keywords stay ordinary', () => {
    const options = [
        'Caption text',
        'LEFT',
        '0px',
        '75.5px',
        '75 px wide',
        'alt =Accessible map',
        'page  2',
        'noicon',
        'noplayer',
    ];

    for (const option of options) {
        const source = `[[File:Example.svg|${option}]]`;
        assertLacksClass(
            source,
            highlightWikitext(source, { imageOptions: IMAGE_OPTIONS }),
            option,
            'kanade-source-editor-token--parameter',
        );
    }
});

test('site image aliases style localized keys and respect case rules', () => {
    const source =
        '[[File:X.svg|缩略图|替代=说明|直立 1.2|页码_2|Vorschau|VORSCHAU]]';
    const segments = highlightWikitext(source, { imageOptions: IMAGE_OPTIONS });

    for (const key of ['缩略图', '替代', '直立', '页码', 'Vorschau']) {
        assertHasClass(
            source,
            segments,
            key,
            'kanade-source-editor-token--parameter',
        );
    }
    assertLacksClass(
        source,
        segments,
        '说明',
        'kanade-source-editor-token--parameter',
    );
    assertLacksClass(
        source,
        segments,
        '1.2',
        'kanade-source-editor-token--parameter',
    );
    assertLacksClass(
        source,
        segments,
        '2',
        'kanade-source-editor-token--parameter',
        1,
    );
    assertHasClass(
        source,
        segments,
        '_',
        'kanade-source-editor-token--template-delimiter',
    );
    assertLacksClass(
        source,
        segments,
        'VORSCHAU',
        'kanade-source-editor-token--parameter',
    );
});

test('file options without siteinfo use only numeric size syntax', () => {
    const source = '[[File:X.svg|thumb|alt=Description|75px]]';
    const segments = highlightWikitext(source);

    assertLacksClass(
        source,
        segments,
        'thumb',
        'kanade-source-editor-token--parameter',
    );
    assertLacksClass(
        source,
        segments,
        'alt',
        'kanade-source-editor-token--parameter',
    );
    assertHasClass(
        source,
        segments,
        '75px',
        'kanade-source-editor-token--parameter',
    );
});

test('file options ignore pipes and equals signs in tag attributes', () => {
    const source = '[[File:X.svg|<span title="a|right|alt=x">Caption</span>]]';
    const segments = highlightWikitext(source);

    for (const text of ['right', 'alt']) {
        assertLacksClass(
            source,
            segments,
            text,
            'kanade-source-editor-token--parameter',
        );
    }
});

test('HTML entities and literal dashes keep source text and distinct styling', () => {
    const source = 'A&nbsp;B &#124; C &#x7B; D – E — F - G &#xZZ;';
    const segments = highlightWikitext(source);

    assert.equal(segments.map((segment) => segment.text).join(''), source);
    for (const entity of ['&nbsp;', '&#124;', '&#x7B;']) {
        assertHasClass(
            source,
            segments,
            entity,
            'kanade-source-editor-token--entity',
        );
        assertHasClass(
            source,
            segments,
            entity,
            'kanade-source-editor-token--parser-function',
        );
    }
    assertHasClass(
        source,
        segments,
        '–',
        'kanade-source-editor-token--en-dash',
    );
    assertHasClass(
        source,
        segments,
        '—',
        'kanade-source-editor-token--em-dash',
    );
    assertLacksClass(
        source,
        segments,
        '-',
        'kanade-source-editor-token--en-dash',
    );
    assertLacksClass(
        source,
        segments,
        '-',
        'kanade-source-editor-token--em-dash',
    );
    assertLacksClass(
        source,
        segments,
        '&#xZZ;',
        'kanade-source-editor-token--entity',
    );
});

test('Highlighted special characters retain every source code point', () => {
    const markedCharacters = [
        ['\t', 'kanade-source-editor-token--tab'],
        ['\u2002', 'kanade-source-editor-token--en-space'],
        ['\u2003', 'kanade-source-editor-token--em-space'],
        ['\u2009', 'kanade-source-editor-token--thin-space'],
        ['\u3000', 'kanade-source-editor-token--ideographic-space'],
        ['\u00ad', 'kanade-source-editor-token--soft-hyphen'],
        ['\u2012', 'kanade-source-editor-token--figure-dash'],
        ['\u2013', 'kanade-source-editor-token--en-dash'],
        ['\u2014', 'kanade-source-editor-token--em-dash'],
        ['\u2015', 'kanade-source-editor-token--horizontal-bar'],
        ['\u2212', 'kanade-source-editor-token--minus-sign'],
    ] as const;
    const source =
        markedCharacters.map(([character]) => character).join('|') +
        '|-|\u00a0';
    const segments = highlightWikitext(source);

    assert.equal(segments.map((segment) => segment.text).join(''), source);
    for (const [character, className] of markedCharacters) {
        assertHasClass(source, segments, character, className);
        assert.equal(segmentAt(source, segments, character)?.text, character);
    }
    const ordinaryHyphen = segmentAt(source, segments, '-');
    const ordinaryNoBreakSpace = segmentAt(source, segments, '\u00a0');
    assert.ok(ordinaryHyphen);
    assert.ok(ordinaryNoBreakSpace);
    assert.ok(
        ordinaryHyphen.classNames.every(
            (className) =>
                !className.includes('dash') && !className.includes('hyphen'),
        ),
    );
    assert.deepEqual(ordinaryNoBreakSpace.classNames, []);
});

test('opaque regions hide entity styling but retain dash markers', () => {
    const source = '<!-- &nbsp; — \u2002 --><nowiki>&#124; – \u2015</nowiki>';
    const segments = highlightWikitext(source);

    assertLacksClass(
        source,
        segments,
        '&nbsp;',
        'kanade-source-editor-token--entity',
    );
    assertLacksClass(
        source,
        segments,
        '&#124;',
        'kanade-source-editor-token--entity',
    );
    assertHasClass(
        source,
        segments,
        '—',
        'kanade-source-editor-token--em-dash',
    );
    assertHasClass(
        source,
        segments,
        '–',
        'kanade-source-editor-token--en-dash',
    );
    assertHasClass(
        source,
        segments,
        '\u2002',
        'kanade-source-editor-token--en-space',
    );
    assertHasClass(
        source,
        segments,
        '\u2015',
        'kanade-source-editor-token--horizontal-bar',
    );
    assert.equal(segments.map((segment) => segment.text).join(''), source);
});

test('HTML attributes and CSS properties use syntax token families', () => {
    const source = '<span lang="ja" style="display: none">本文</span>';
    const segments = highlightWikitext(source);

    for (const attribute of ['lang', 'style']) {
        assertHasClass(
            source,
            segments,
            attribute,
            'kanade-source-editor-token--parameter',
        );
        assertHasClass(
            source,
            segments,
            attribute,
            'kanade-source-editor-token--html-tag',
        );
    }
    assertHasClass(
        source,
        segments,
        'display',
        'kanade-source-editor-token--language-variant',
    );
    assertHasClass(
        source,
        segments,
        'display',
        'kanade-source-editor-token--html-tag',
    );
    assertLacksClass(
        source,
        segments,
        'none',
        'kanade-source-editor-token--language-variant',
    );
    assertHasClass(
        source,
        segments,
        '本文',
        'kanade-source-editor-token--html-content-0',
    );
});

test('CSS property names are italicized in span and table markup', () => {
    const source = [
        '<span style="font-size: smaller; color: xxx;">111</span>',
        '{| style="display: none;"',
        '|- style="font-size: smaller;"',
        '! rowspan="2" style="font-size: smaller;" | cell text',
        '! rowspan="2" style="font-size: larger;" | cell text',
        '|}',
    ].join('\n');
    const segments = highlightWikitext(source);

    assertEachHasClass(
        source,
        segments,
        ['color', 'display'],
        'kanade-source-editor-token--language-variant',
    );
    for (let occurrence = 0; occurrence < 4; occurrence += 1) {
        assertHasClass(
            source,
            segments,
            'font-size',
            'kanade-source-editor-token--language-variant',
            occurrence,
        );
    }
    assertEachLacksClass(
        source,
        segments,
        ['smaller', 'xxx', 'none', 'larger'],
        'kanade-source-editor-token--language-variant',
    );
    assertHasClass(
        source,
        segments,
        'display',
        'kanade-source-editor-token--table',
    );
});

test('table CSS attributes ignore protected nested syntax', () => {
    const source = [
        '{| <!-- style="color:red" --> style="display:none;"',
        '|}',
        '{| {{foo| style="color:red"}} style="font-size:smaller;"',
        '|}',
        '{| [[Target|style="color:red"]] style="width:100%;"',
        '|}',
        '{| <span title=\'style="color:red"\' /> style="height:auto;"',
        '|}',
    ].join('\n');
    const segments = highlightWikitext(source);

    for (let occurrence = 0; occurrence < 4; occurrence += 1) {
        assertLacksClass(
            source,
            segments,
            'color',
            'kanade-source-editor-token--language-variant',
            occurrence,
        );
    }
    for (const property of ['display', 'font-size', 'width', 'height']) {
        assertHasClass(
            source,
            segments,
            property,
            'kanade-source-editor-token--language-variant',
        );
    }
});

const WIKITABLE_ATTRIBUTE_SOURCE = [
    '{| class="wikitable"',
    '|- data-row="primary"',
    '| data-sort-value="24319" | 24&nbsp;kB',
    '! scope="row" | Row heading',
    '| plain cell',
    '| data-first="one" | First || data-second="two" | Second',
    '! headers="sales" | First head !! abbr="qty" | Second head',
    '|+ class="caption" | Table caption',
    '|}',
].join('\n');
const WIKITABLE_ATTRIBUTES = [
    'class="wikitable"',
    'data-row="primary"',
    'data-sort-value="24319"',
    'scope="row"',
    'data-first="one"',
    'data-second="two"',
    'headers="sales"',
    'abbr="qty"',
    'class="caption"',
];

test('wikitable grey text is limited to parsed attributes', () => {
    const segments = highlightWikitext(WIKITABLE_ATTRIBUTE_SOURCE);

    assert.deepEqual(
        segments
            .filter((segment) =>
                segment.classNames.includes(
                    'kanade-source-editor-token--table',
                ),
            )
            .map((segment) => segment.text),
        WIKITABLE_ATTRIBUTES,
    );
});

test('header and caption CSS attributes retain syntax styling', () => {
    const source = [
        '{|',
        '! style="font-size: smaller;" | 12.3',
        '|+ class="111" style="xxx: yyy;" | title',
        '|}',
    ].join('\n');
    const segments = highlightWikitext(source);

    for (const attributes of [
        'style="font-size: smaller;"',
        'class="111" style="xxx: yyy;"',
    ]) {
        assertRangeHasClass(
            source,
            segments,
            attributes,
            'kanade-source-editor-token--table',
        );
    }
    assertEachHasClass(
        source,
        segments,
        ['font-size', 'xxx'],
        'kanade-source-editor-token--language-variant',
    );
    assertEachLacksClass(
        source,
        segments,
        ['12.3', 'title'],
        'kanade-source-editor-token--table',
    );
});

test('HTML tag bodies use progressively darker nesting backgrounds', () => {
    const source = [
        '<div>outer',
        '<span>middle<i>inner<b>deep<u>capped',
        '<em>still capped</em></u></b></i></span>',
        '</div>',
    ].join('');
    const segments = highlightWikitext(source);
    const expectedClasses = [
        ['outer', [0]],
        ['middle', [0, 1]],
        ['inner', [0, 1, 2]],
        ['deep', [0, 1, 2, 3]],
        ['capped', [0, 1, 2, 3, 4]],
        ['still capped', [0, 1, 2, 3, 4]],
    ] as const;

    for (const [needle, depths] of expectedClasses) {
        assert.deepEqual(
            htmlContentClassesAt(source, segments, needle),
            depths.map(
                (depth) => `kanade-source-editor-token--html-content-${depth}`,
            ),
        );
    }
    assertLacksClass(
        source,
        segments,
        'still capped',
        'kanade-source-editor-token--html-content-5',
    );
});

test('HTML body depth resets for siblings and ignores void tags', () => {
    const source = '<div lang="en">outer<br>tail</div><p>sibling</p><hr>';
    const segments = highlightWikitext(source);

    for (const text of ['outer', 'tail', 'sibling']) {
        assert.deepEqual(htmlContentClassesAt(source, segments, text), [
            'kanade-source-editor-token--html-content-0',
        ]);
    }
    assertHasClass(
        source,
        segments,
        'lang',
        'kanade-source-editor-token--parameter',
    );
    assertHasClass(
        source,
        segments,
        'br',
        'kanade-source-editor-token--html-tag',
    );
    assertHasClass(
        source,
        segments,
        'br',
        'kanade-source-editor-token--html-content-0',
    );
    assertHasClass(
        source,
        segments,
        'hr',
        'kanade-source-editor-token--html-tag',
    );
    assertLacksClass(
        source,
        segments,
        'hr',
        'kanade-source-editor-token--html-content-0',
    );
});

test('unfinished and protected tags do not shade through their bodies', () => {
    const source = [
        '<nowiki>literal</nowiki>',
        '<mapframe><span>map data</span></mapframe>',
        '<templatestyles><b>style data</b></templatestyles>',
        'lead<div>rest<span>nested</span>',
    ].join(' ');
    const segments = highlightWikitext(source);

    assert.deepEqual(htmlContentClassesAt(source, segments, 'literal'), []);
    assertHasClass(
        source,
        segments,
        'literal',
        'kanade-source-editor-token--nowiki',
    );
    for (const text of ['map data', 'style data']) {
        assert.deepEqual(htmlContentClassesAt(source, segments, text), []);
        assertHasClass(
            source,
            segments,
            text,
            'kanade-source-editor-token--pre',
        );
    }
    assert.deepEqual(htmlContentClassesAt(source, segments, 'rest'), []);
    assert.deepEqual(htmlContentClassesAt(source, segments, 'nested'), [
        'kanade-source-editor-token--html-content-0',
    ]);
});

test('HTML body backgrounds preserve nested wikilink metadata', () => {
    const source = '<div lang="en">.ddddddd.. [[Missing]]</div>';
    const segments = highlightWikitext(source);

    assertHasClass(
        source,
        segments,
        '.ddddddd..',
        'kanade-source-editor-token--html-content-0',
    );
    assert.equal(
        segmentAt(source, segments, 'Missing')?.missingTitle,
        'Missing',
    );
});

test('HTML syntax keys respect literal content and nested wikitext', () => {
    const source = [
        '<syntaxhighlight lang="ts" style="display:none">display:x' +
            '</syntaxhighlight>',
        '<span style="{{foo|x;display:none}};color:red">text</span>',
    ].join('\n');
    const segments = highlightWikitext(source);

    for (const attribute of ['lang', 'style']) {
        assertHasClass(
            source,
            segments,
            attribute,
            'kanade-source-editor-token--parameter',
        );
    }
    assertHasClass(
        source,
        segments,
        'display',
        'kanade-source-editor-token--language-variant',
    );
    assertLacksClass(
        source,
        segments,
        'display',
        'kanade-source-editor-token--language-variant',
        1,
    );
    assertLacksClass(
        source,
        segments,
        'display',
        'kanade-source-editor-token--language-variant',
        2,
    );
});

test('Chinese image templates use the original green family', () => {
    const source = '{{multiple image|image1=ArchWiki.svg}}';
    const segments = highlightWikitext(source, {
        databaseName: 'zhwiki',
    });

    assertHasClass(
        source,
        segments,
        'multiple image',
        'kanade-source-editor-token--image-template',
    );
});

test('current namespaces format template navigation titles', () => {
    const source = '{{Vorlage:Example}}';
    const segments = highlightWikitext(source, {
        namespaceSource: EXAMPLE_NAMESPACE_CATALOG,
    });

    assert.equal(
        segmentAt(source, segments, 'Vorlage:Example')?.href,
        '/wiki/Vorlage%3AExample',
    );
});

test('template navigation applies only to the template name', () => {
    const source = '{{ Cite web | title = Example }}';
    const href = '/wiki/Template%3ACite_web';
    const linkedSegments = highlightWikitext(source).filter(
        (segment) => segment.href === href,
    );

    assert.deepEqual(
        linkedSegments.map(({ end, start, text }) => ({ end, start, text })),
        [
            {
                end: source.indexOf('Cite web') + 'Cite web'.length,
                start: source.indexOf('Cite web'),
                text: 'Cite web',
            },
        ],
    );
    assert.equal(segmentAt(source, linkedSegments, 'title'), undefined);
    assert.equal(segmentAt(source, linkedSegments, 'Example'), undefined);
});

const TEMPLATE_LIKE_MAGIC_SOURCE = [
    '{{DEFAULTSORT:Trusty Bell Chopin No Yume}}',
    '{{DEFAULTSORTKEY:Alias key}}',
    '{{DEFAULTCATEGORYSORT:Category alias}}',
    '{{DISPLAYTITLE:Display value}}',
    '{{CURRENTYEAR}}',
    '{{NUMBEROFPAGES:R}}',
    '{{lc:LOWER ME}}',
    '{{#if:condition|yes|no}}',
].join('\n');

test('template-like magic words use parser-function syntax', () => {
    const segments = highlightWikitext(TEMPLATE_LIKE_MAGIC_SOURCE, {
        templateMagicWords: EN_MAGIC_WORDS,
    });
    const heads = [
        'DEFAULTSORT',
        'DEFAULTSORTKEY',
        'DEFAULTCATEGORYSORT',
        'DISPLAYTITLE',
        'CURRENTYEAR',
        'NUMBEROFPAGES',
        'lc',
        '#if',
    ];

    for (const head of heads) {
        assertHasClass(
            TEMPLATE_LIKE_MAGIC_SOURCE,
            segments,
            head,
            'kanade-source-editor-token--parser-function',
        );
        assertLacksClass(
            TEMPLATE_LIKE_MAGIC_SOURCE,
            segments,
            head,
            'kanade-source-editor-token--template-name',
        );
    }
    assert.ok(segments.every((segment) => segment.href == null));
    assertHasClass(
        TEMPLATE_LIKE_MAGIC_SOURCE,
        segments,
        ':Trusty Bell Chopin No Yume',
        'kanade-source-editor-token--parser-function',
    );
});

test('colonless hash magic variables do not navigate to templates', () => {
    const heads = [
        '#bcp47',
        '#dir',
        '#contentmodel',
        '#LANGUAGE',
        '#interwikilink',
        '#interlanguagelink',
        '#isbn',
    ];
    const source = heads.map((head) => `{{${head}}}`).join(' ');
    const segments = highlightWikitext(source, {
        templateMagicWords: EN_MAGIC_WORDS,
    });

    for (const head of heads) {
        assertHasClass(
            source,
            segments,
            head,
            'kanade-source-editor-token--parser-function',
        );
        assertLacksClass(
            source,
            segments,
            head,
            'kanade-source-editor-token--template-name',
        );
    }
    assert.ok(segments.every((segment) => segment.href == null));
});

test('magic-word arguments remain ordinary editable text', () => {
    const segments = highlightWikitext(TEMPLATE_LIKE_MAGIC_SOURCE, {
        templateMagicWords: EN_MAGIC_WORDS,
    });

    for (const argument of [
        'Trusty Bell Chopin No Yume',
        'Alias key',
        'Category alias',
        'Display value',
        'LOWER ME',
        'condition',
    ]) {
        assertLacksClass(
            TEMPLATE_LIKE_MAGIC_SOURCE,
            segments,
            argument,
            'kanade-source-editor-token--parser-function',
        );
        assertLacksClass(
            TEMPLATE_LIKE_MAGIC_SOURCE,
            segments,
            argument,
            'kanade-source-editor-token--template-name',
        );
    }
});

test('localized and full-width magic-word syntax is not a template', () => {
    const source = [
        '{{默认排序:Trusty Bell}}',
        '{{顯示標題：Display value}}',
        '{{#调用：范例|main}}',
    ].join('\n');
    const segments = highlightWikitext(source, {
        namespaceSource: ZH_NAMESPACE_CATALOG,
        templateMagicWords: ZH_MAGIC_WORDS,
    });
    const moduleHref = '/wiki/Module%3A%E8%8C%83%E4%BE%8B';

    for (const head of ['默认排序', '顯示標題', '#调用']) {
        assertHasClass(
            source,
            segments,
            head,
            'kanade-source-editor-token--parser-function',
        );
        assertLacksClass(
            source,
            segments,
            head,
            'kanade-source-editor-token--template-name',
        );
    }
    assertHasClass(
        source,
        segments,
        '：Display value',
        'kanade-source-editor-token--parser-function',
    );
    assert.equal(segmentAt(source, segments, '范例')?.href, moduleHref);
    assert.ok(
        segments
            .filter((segment) => segment.href != null)
            .every((segment) => segment.href === moduleHref),
    );
});

test('common zhwiki magic-word aliases do not become templates', () => {
    const heads = ['小写', '格式化数字', '页名', '今天', '本月', '#语言'];
    const source = [
        '{{小写:ABC}}',
        '{{格式化数字:1234}}',
        '{{页名:Foo}}',
        '{{今天}}',
        '{{本月}}',
        '{{#语言}}',
    ].join(' ');
    const segments = highlightWikitext(source, {
        namespaceSource: ZH_NAMESPACE_CATALOG,
        templateMagicWords: ZH_MAGIC_WORDS,
    });

    for (const head of heads) {
        assertHasClass(
            source,
            segments,
            head,
            'kanade-source-editor-token--parser-function',
        );
        assertLacksClass(
            source,
            segments,
            head,
            'kanade-source-editor-token--template-name',
        );
    }
    assert.ok(segments.every((segment) => segment.href == null));
});

test('magic-word collisions remain explicit template transclusions', () => {
    const fixtures = [
        ['{{CURRENTDAYNAME|x}}', '/wiki/Template%3ACURRENTDAYNAME'],
        ['{{Template:CURRENTYEAR}}', '/wiki/Template%3ACURRENTYEAR'],
        ['{{:CURRENTYEAR}}', '/wiki/CURRENTYEAR'],
        ['{{Example:Variant|x}}', '/wiki/Template%3AExample%3AVariant'],
        ['{{defaultsort:key}}', '/wiki/Template%3Adefaultsort%3Akey'],
    ] as const;

    for (const [source, href] of fixtures) {
        const segments = highlightWikitext(source);
        const linked = segments.filter((segment) => segment.href === href);

        assert.ok(
            linked.length > 0,
            `Missing template navigation for ${source}`,
        );
        assert.ok(
            linked.every((segment) =>
                segment.classNames.includes(
                    'kanade-source-editor-token--template-name',
                ),
            ),
        );
        assert.ok(
            linked.every(
                (segment) =>
                    !segment.classNames.includes(
                        'kanade-source-editor-token--parser-function',
                    ),
            ),
        );
    }
});

test('invoke navigation links only the static module target', () => {
    const source = '{{ safesubst: #InVoKe:Foo/bar | main | key=value }}';
    const href = '/wiki/Module%3AFoo/bar';
    const segments = highlightWikitext(source, {
        namespaceSource: EN_NAMESPACE_CATALOG,
        templateMagicWords: EN_MAGIC_WORDS,
    });
    const linked = segments.filter((segment) => segment.href === href);

    assert.deepEqual(
        linked.map(({ end, start, text }) => ({ end, start, text })),
        [
            {
                end: source.indexOf('Foo/bar') + 'Foo/bar'.length,
                start: source.indexOf('Foo/bar'),
                text: 'Foo/bar',
            },
        ],
    );
    assertHasClass(
        source,
        segments,
        'safesubst',
        'kanade-source-editor-token--parser-function',
    );
    assertHasClass(
        source,
        segments,
        '#InVoKe',
        'kanade-source-editor-token--parser-function',
    );
    assertHasClass(
        source,
        segments,
        'Foo/bar',
        'kanade-source-editor-token--module-name',
    );
    for (const text of ['safesubst', '#InVoKe', 'main', 'key', 'value']) {
        assert.notEqual(segmentAt(source, segments, text)?.href, href);
    }
});

test('invoke forces the entered operand into the module namespace', () => {
    const source = '{{#invoke:Module:Foo|main}}';
    const segments = highlightWikitext(source, {
        namespaceSource: EN_NAMESPACE_CATALOG,
        templateMagicWords: EN_MAGIC_WORDS,
    });

    assert.equal(
        segmentAt(source, segments, 'Module:Foo')?.href,
        '/wiki/Module%3AModule%3AFoo',
    );
});

test('message and raw prefixes retain MediaWiki classification order', () => {
    const source = [
        '{{msg:CURRENTYEAR}}',
        '{{raw:DEFAULTSORT:X}}',
        '{{msg:#invoke:Foo|main}}',
        '{{raw:msgnw:Example}}',
    ].join('\n');
    const segments = highlightWikitext(source, {
        namespaceSource: EN_NAMESPACE_CATALOG,
        templateMagicWords: EN_MAGIC_WORDS,
    });

    assert.equal(
        segmentAt(source, segments, 'CURRENTYEAR')?.href,
        '/wiki/Template%3ACURRENTYEAR',
    );
    assertHasClass(
        source,
        segments,
        'DEFAULTSORT',
        'kanade-source-editor-token--parser-function',
    );
    assert.equal(
        segmentAt(source, segments, 'Foo')?.href,
        '/wiki/Module%3AFoo',
    );
    assert.equal(
        segmentAt(source, segments, 'msgnw:Example')?.href,
        '/wiki/Template%3Amsgnw%3AExample',
    );
});

test('whitespace before a function colon remains template syntax', () => {
    const source = '{{DEFAULTSORT :x}} {{#invoke :Foo|main}}';
    const segments = highlightWikitext(source);

    for (const head of ['DEFAULTSORT', '#invoke']) {
        assertLacksClass(
            source,
            segments,
            head,
            'kanade-source-editor-token--parser-function',
        );
        assertHasClass(
            source,
            segments,
            head,
            'kanade-source-editor-token--template-name',
        );
    }
});

test('full-width colons do not activate ASCII-only modifiers', () => {
    const source = '{{subst：CURRENTYEAR}}';
    const segments = highlightWikitext(source);

    assertLacksClass(
        source,
        segments,
        'subst',
        'kanade-source-editor-token--parser-function',
    );
    assertHasClass(
        source,
        segments,
        'subst：CURRENTYEAR',
        'kanade-source-editor-token--template-name',
    );
});

test('invoke navigation ignores dynamic or unavailable module targets', () => {
    const dynamic = '{{#invoke:{{{module|Foo}}}|main}}';
    const unavailable = '{{#invoke:Foo|main}}';

    assert.ok(
        highlightWikitext(dynamic).every((segment) => segment.href == null),
    );
    assert.ok(
        highlightWikitext(unavailable, {
            namespaceSource: EXAMPLE_NAMESPACE_CATALOG,
        }).every((segment) => segment.href == null),
    );
});

test('outer magic-word styling stops before nested arguments', () => {
    const source = '{{DISPLAYTITLE:Foo {{PAGENAME}}}}';
    const segments = highlightWikitext(source, {
        templateMagicWords: EN_MAGIC_WORDS,
    });

    assertHasClass(
        source,
        segments,
        'DISPLAYTITLE',
        'kanade-source-editor-token--parser-function',
    );
    assertLacksClass(
        source,
        segments,
        'Foo',
        'kanade-source-editor-token--parser-function',
    );
    assertHasClass(
        source,
        segments,
        'PAGENAME',
        'kanade-source-editor-token--parser-function',
    );
    assert.ok(segments.every((segment) => segment.href == null));
});

test('template navigation respects explicit current-wiki namespaces', () => {
    const options = {
        namespaceSource: EXAMPLE_NAMESPACE_CATALOG,
    };

    assert.equal(
        segmentAt(
            '{{Example}}',
            highlightWikitext('{{Example}}', options),
            'Example',
        )?.href,
        '/wiki/Vorlage%3AExample',
    );
    assert.equal(
        segmentAt(
            '{{Benutzer:Example}}',
            highlightWikitext('{{Benutzer:Example}}', options),
            'Benutzer:Example',
        )?.href,
        '/wiki/Benutzer%3AExample',
    );
    assert.equal(
        segmentAt(
            '{{:Article}}',
            highlightWikitext('{{:Article}}', options),
            ':Article',
        )?.href,
        '/wiki/Article',
    );
});

test('Chinese interlanguage helpers expose local navigation', () => {
    const source = '{{link-ja|東京|Tokyo}}';
    const segments = highlightWikitext(source, {
        linkHelpers: true,
    });
    const segment = segments
        .filter((item) =>
            item.classNames.includes('kanade-source-editor-token--link-helper'),
        )
        .at(0);

    assert.equal(segment?.href, '/wiki/%E6%9D%B1%E4%BA%AC');
    assert.equal(segmentAt(source, segments, '東京')?.missingTitle, '東京');
    assert.equal(segmentAt(source, segments, 'Tokyo')?.missingTitle, undefined);
    assert.equal(
        segmentAt(source, segments, 'Tokyo')?.href,
        'https://ja.wikipedia.org/wiki/Tokyo',
    );
    assert.deepEqual(collectLinkHelperTitles(source), ['東京']);
});

test('only an ordinary wikilink target carries local page-preview metadata', () => {
    const source = '[[遊戲地圖#地形|大地图]] [[File:Map.svg|thumb]]';
    const segments = highlightWikitext(source);

    assert.deepEqual(segmentAt(source, segments, '遊戲地圖')?.pagePreview, {
        wiki: 'local',
        title: '遊戲地圖',
    });
    for (const text of ['[[', '|大地图', ']]', 'File:Map.svg']) {
        assert.equal(segmentAt(source, segments, text)?.pagePreview, undefined);
    }
});

test('link-en exposes a separate English title without changing local navigation', () => {
    const source = '{{link-en|遊戲地圖#地形|Game map#History|本地顯示}}';
    const segments = highlightWikitext(source, { linkHelpers: true });

    assert.deepEqual(segmentAt(source, segments, '遊戲地圖')?.pagePreview, {
        wiki: 'local',
        title: '遊戲地圖',
    });
    assert.equal(
        segmentAt(source, segments, '遊戲地圖')?.href,
        '/wiki/%E9%81%8A%E6%88%B2%E5%9C%B0%E5%9C%96%23%E5%9C%B0%E5%BD%A2',
    );
    assert.deepEqual(segmentAt(source, segments, 'Game map')?.pagePreview, {
        wiki: 'en',
        title: 'Game map',
    });
    assertHasClass(
        source,
        segments,
        'Game map',
        'kanade-source-editor-token--link-helper',
    );
    assert.equal(
        segmentAt(source, segments, 'Game map')?.href,
        'https://en.wikipedia.org/wiki/Game_map#History',
    );
    assert.equal(
        segmentAt(source, segments, '本地顯示')?.pagePreview,
        undefined,
    );
    assert.equal(
        segmentAt(source, segments, '本地顯示')?.href,
        '/wiki/%E9%81%8A%E6%88%B2%E5%9C%B0%E5%9C%96%23%E5%9C%B0%E5%BD%A2',
    );
    const japanese = '{{link-ja|東京|Tokyo#History}}';
    assert.deepEqual(
        segmentAt(
            japanese,
            highlightWikitext(japanese, { linkHelpers: true }),
            'Tokyo',
        )?.pagePreview,
        { wiki: 'ja', title: 'Tokyo' },
    );
});

test('Translink previews its foreign title while retaining local navigation', () => {
    const source = '{{Translink|ja|ポーキー・ミンチ#概要|波奇·明奇|顯示名稱}}';
    const segments = highlightWikitext(source, { linkHelpers: true });

    assert.equal(segmentAt(source, segments, 'ja')?.pagePreview, undefined);
    assert.deepEqual(
        segmentAt(source, segments, 'ポーキー・ミンチ')?.pagePreview,
        { wiki: 'ja', title: 'ポーキー・ミンチ' },
    );
    assertHasClass(
        source,
        segments,
        'ポーキー・ミンチ',
        'kanade-source-editor-token--foreign-title',
    );
    assert.equal(
        segmentAt(source, segments, 'ポーキー・ミンチ')?.href,
        'https://ja.wikipedia.org/wiki/' +
            '%E3%83%9D%E3%83%BC%E3%82%AD%E3%83%BC%E3%83%BB%E3%83%9F%E3%83%B3%E3%83%81' +
            '#%E6%A6%82%E8%A6%81',
    );
    assert.deepEqual(segmentAt(source, segments, '波奇·明奇')?.pagePreview, {
        wiki: 'local',
        title: '波奇·明奇',
    });
    assert.equal(
        segmentAt(source, segments, '波奇·明奇')?.href,
        '/wiki/%E6%B3%A2%E5%A5%87%C2%B7%E6%98%8E%E5%A5%87',
    );
    assert.equal(
        segmentAt(source, segments, '顯示名稱')?.pagePreview,
        undefined,
    );
    assert.equal(
        segmentAt(source, segments, '顯示名稱')?.href,
        '/wiki/%E6%B3%A2%E5%A5%87%C2%B7%E6%98%8E%E5%A5%87',
    );
    assert.deepEqual(collectLinkHelperTitles(source), ['波奇·明奇']);
});

test('Translink keeps its foreign preview title neutral on any wiki', () => {
    const source =
        '{{Translink|en|EarthBound fandom#Starmen.net|地球冒险粉丝社群|Starmen.net}}';
    const segments = highlightWikitext(source, { databaseName: 'examplewiki' });
    const foreign = segmentAt(source, segments, 'EarthBound fandom');

    assertHasClass(
        source,
        segments,
        'EarthBound fandom',
        'kanade-source-editor-token--foreign-title',
    );
    assert.ok(
        !foreign?.classNames.includes(
            'kanade-source-editor-token--link-helper',
        ),
    );
    assert.deepEqual(foreign?.pagePreview, {
        wiki: 'en',
        title: 'EarthBound fandom',
    });
    assert.equal(foreign?.missingTitle, undefined);
    assert.equal(
        foreign?.href,
        'https://en.wikipedia.org/wiki/EarthBound_fandom#Starmen.net',
    );
    assert.deepEqual(
        segmentAt(source, segments, '地球冒险粉丝社群')?.pagePreview,
        { wiki: 'local', title: '地球冒险粉丝社群' },
    );
    assertHasClass(
        source,
        segments,
        '地球冒险粉丝社群',
        'kanade-source-editor-token--link',
    );
});

test('Translink keeps a fragment-bearing foreign title neutral', () => {
    const source =
        '{{Translink|en|Timekeeping in games#Turn-based|游戏中的计时系统|回合制战斗}}';
    const segments = highlightWikitext(source, { databaseName: 'zhwiki' });
    const foreign = segmentAt(source, segments, 'Timekeeping in games');

    assertHasClass(
        source,
        segments,
        'Timekeeping in games',
        'kanade-source-editor-token--foreign-title',
    );
    assert.deepEqual(foreign?.pagePreview, {
        wiki: 'en',
        title: 'Timekeeping in games',
    });
    assert.equal(foreign?.missingTitle, undefined);
    assert.equal(
        foreign?.href,
        'https://en.wikipedia.org/wiki/Timekeeping_in_games#Turn-based',
    );
    assertHasClass(
        source,
        segments,
        '游戏中的计时系统',
        'kanade-source-editor-token--link',
    );
});

test('Translink family treats its sole title as local', () => {
    for (const [source, title, href] of [
        ['{{Translink|en|CPU}}', 'CPU', '/wiki/CPU'],
        ['{{Tsl|EN|Water#History}}', 'Water', '/wiki/Water%23History'],
    ]) {
        const segment = segmentAt(
            source,
            highlightWikitext(source, { linkHelpers: true }),
            title,
        );
        assert.deepEqual(segment?.pagePreview, { wiki: 'local', title });
        assert.equal(segment?.href, href);
        assert.equal(segment?.missingTitle, title);
        assert.deepEqual(collectLinkHelperTitles(source), [title]);
    }
});

test('Translink ignores malformed language codes for foreign previews', () => {
    const source = '{{Translink|ja.example|外文條目|本地條目}}';
    const segments = highlightWikitext(source, { linkHelpers: true });

    assert.equal(
        segmentAt(source, segments, '外文條目')?.pagePreview,
        undefined,
    );
    assert.equal(segmentAt(source, segments, '外文條目')?.href, undefined);
    assert.deepEqual(segmentAt(source, segments, '本地條目')?.pagePreview, {
        wiki: 'local',
        title: '本地條目',
    });
});

test('Tsl foreign navigation encodes titles and section fragments separately', () => {
    const source =
        '{{Tsl| EN |:Game series/日本?%#Early years/#2|本地條目|顯示}}';
    const segments = highlightWikitext(source);
    const foreign = segmentAt(source, segments, 'Game series');

    assert.equal(
        foreign?.href,
        'https://en.wikipedia.org/wiki/Game_series/%E6%97%A5%E6%9C%AC%3F%25#Early_years/%232',
    );
    assert.deepEqual(foreign?.pagePreview, {
        wiki: 'en',
        title: 'Game series/日本?%',
    });
    assert.equal(foreign?.missingTitle, undefined);
    assertHasClass(
        source,
        segments,
        'Game series',
        'kanade-source-editor-token--foreign-title',
    );
    assert.equal(
        segmentAt(source, segments, '本地條目')?.href,
        '/wiki/%E6%9C%AC%E5%9C%B0%E6%A2%9D%E7%9B%AE',
    );
    assert.equal(
        segmentAt(source, segments, '顯示')?.href,
        '/wiki/%E6%9C%AC%E5%9C%B0%E6%A2%9D%E7%9B%AE',
    );
});

test('foreign navigation requires a static title and a validated language code', () => {
    for (const title of [
        '{{Dynamic title}}',
        '{{{title|Fallback}}}',
        '[[Linked title]]',
        '<b>Marked title</b>',
        'Title<!--comment-->',
        'Title\ncontinuation',
        '#Section only',
    ]) {
        for (const source of [
            `{{Tsl|en|${title}|Local page}}`,
            `{{link-en|Local page|${title}}}`,
        ]) {
            const segments = highlightWikitext(source, { linkHelpers: true });
            assert.ok(
                segments.every(
                    (segment) =>
                        !segment.href?.startsWith('https://en.wikipedia.org/'),
                ),
                source,
            );
            assert.equal(
                segmentAt(source, segments, 'Local page')?.href,
                '/wiki/Local_page',
            );
        }
    }
    for (const language of [
        'en.example',
        'en/evil',
        '//evil',
        'en:443',
        '{{lang}}',
        '',
    ]) {
        const source = `{{Tsl|${language}|Foreign title|Local page}}`;
        const foreign = segmentAt(
            source,
            highlightWikitext(source),
            'Foreign title',
        );
        assert.equal(foreign?.href, undefined, language);
        assert.equal(foreign?.pagePreview, undefined, language);
    }
});

test('link-wd display text is not treated as a foreign language title', () => {
    const source = '{{link-wd|page=本地條目|2=顯示名稱}}';
    const segments = highlightWikitext(source, { linkHelpers: true });

    assert.deepEqual(segmentAt(source, segments, '本地條目')?.pagePreview, {
        wiki: 'local',
        title: '本地條目',
    });
    assert.equal(
        segmentAt(source, segments, '顯示名稱')?.pagePreview,
        undefined,
    );
});

test('comments are opaque to template highlighting', () => {
    const segments = highlightWikitext('<!-- {{cite web|url=x}} -->');

    assert.deepEqual(
        [...new Set(segments.flatMap((segment) => segment.classNames))],
        ['kanade-source-editor-token--comment'],
    );
});

test('comments inside references and notes keep their small-text context', () => {
    const source =
        '<ref name="IGN: 64DD">{{cite web ' +
        '|url=http://www.ign.com/articles/1997/06/03/four-games-to-launch-with-japanese-64dd ' +
        '|author=<!--Not stated--> |title=Four Games To Launch With Japanese 64DD ' +
        '|work=[[IGN]]}}</ref> ' +
        '{{efn|A note <!--Note comment--> with source}} ' +
        '<!--Article comment-->';
    const segments = highlightWikitext(source);

    for (const needle of ['Not stated', 'Note comment']) {
        assertHasClass(
            source,
            segments,
            needle,
            'kanade-source-editor-token--comment',
        );
        assertHasClass(
            source,
            segments,
            needle,
            'kanade-source-editor-token--small-reference-comment',
        );
        assertLacksClass(
            source,
            segments,
            needle,
            'kanade-source-editor-token--reference',
        );
        assertLacksClass(
            source,
            segments,
            needle,
            'kanade-source-editor-token--footnote',
        );
    }
    assertHasClass(
        source,
        segments,
        'Article comment',
        'kanade-source-editor-token--comment',
    );
    assertLacksClass(
        source,
        segments,
        'Article comment',
        'kanade-source-editor-token--small-reference-comment',
    );
    assert.equal(segments.map((segment) => segment.text).join(''), source);
});

test('template syntax and headings receive source tokens', () => {
    const source = '== Heading ==\n{{ Cite web | URL = https://example.test }}';
    const segments = highlightWikitext(source);
    const classesFor = (text: string) =>
        segments.find((segment) => segment.text === text)?.classNames ?? [];

    assertHasClass(
        source,
        segments,
        'Heading',
        'kanade-source-editor-token--heading-2',
    );
    assertHasClass(
        source,
        segments,
        'Heading',
        'kanade-source-editor-token--heading',
    );
    assert.ok(
        classesFor('Cite web').includes(
            'kanade-source-editor-token--template-name',
        ),
    );
    assert.ok(
        classesFor('URL').includes('kanade-source-editor-token--parameter'),
    );
});

test('inline definition-list separators receive list syntax styling', () => {
    const source = '; site : zh\n; [[Project:Site]] : linked';
    const segments = highlightWikitext(source);

    assertHasClass(source, segments, ';', 'kanade-source-editor-token--list');
    assertHasClass(source, segments, ':', 'kanade-source-editor-token--list');
    assertLacksClass(
        source,
        segments,
        'Project:',
        'kanade-source-editor-token--list',
    );
    assertHasClass(
        source,
        segments,
        ':',
        'kanade-source-editor-token--list',
        2,
    );
});

test('userbox metadata colons remain inline definition-list markers', () => {
    const source = [
        '; badge : js',
        '; level : 0',
        '; text : This user can not program in ' +
            "{{/|wd|Q2005|'''JavaScript'''}}.",
        "; tip : knowing of it's crucial importance for Wikipedia, " +
            "but I really can't understand it",
    ].join('\n');
    const segments = highlightWikitext(source);
    const separators = [...source.matchAll(/:/gu)];

    assert.equal(separators.length, 4);
    for (const [occurrence] of separators.entries()) {
        assertHasClass(
            source,
            segments,
            ':',
            'kanade-source-editor-token--list',
            occurrence,
        );
    }
});

test('list metadata remains visible inside multiline template data', () => {
    const source = [
        '{{/|contributions|category=review|data=',
        '; site : zh',
        '; title : Talk:超执刀2#For Each ... Next的意見',
        '; status : pr',
        "; note : possibly this wiki's first A-Class review",
        '}}',
    ].join('\n');
    const segments = highlightWikitext(source);

    for (const occurrence of [0, 1, 3, 4]) {
        assertHasClass(
            source,
            segments,
            ':',
            'kanade-source-editor-token--list',
            occurrence,
        );
    }
    assertLacksClass(
        source,
        segments,
        'Talk:',
        'kanade-source-editor-token--list',
    );
});

test('URL schemes do not become definition-list separators', () => {
    const source = '; https://example.test : website';
    const segments = highlightWikitext(source);

    assertLacksClass(
        source,
        segments,
        'https:',
        'kanade-source-editor-token--list',
    );
    assertHasClass(
        source,
        segments,
        ':',
        'kanade-source-editor-token--list',
        1,
    );
});

test('protocol-relative external links color their target and label', () => {
    const source =
        '[//dictionary.cambridge.org/us/dictionary/' +
        'english-chinese-traditional/ Cambridge English–Chinese]';
    const segments = highlightWikitext(source);
    const href =
        '//dictionary.cambridge.org/us/dictionary/' +
        'english-chinese-traditional/';

    assertHasClass(source, segments, href, 'kanade-source-editor-token--url');
    assertHasClass(
        source,
        segments,
        'Cambridge English–Chinese',
        'kanade-source-editor-token--url',
    );
    assert.equal(segmentAt(source, segments, href)?.href, href);
    assert.equal(
        segmentAt(source, segments, 'Cambridge English–Chinese')?.href,
        href,
    );
});

test('external-link colons do not split inline definitions', () => {
    const source = '; [//example.test:8080 label] : definition';
    const segments = highlightWikitext(source);

    assertLacksClass(
        source,
        segments,
        ':8080',
        'kanade-source-editor-token--list',
    );
    assertHasClass(
        source,
        segments,
        ':',
        'kanade-source-editor-token--list',
        1,
    );
});

test('heading underlines contain only trimmed level 2 and 3 text', () => {
    const source = '==   Level two   ==   \n===  Level three  ===　';
    const segments = highlightWikitext(source);
    const underlinedText = segments
        .filter((segment) =>
            segment.classNames.includes(
                'kanade-source-editor-token--heading-text',
            ),
        )
        .map((segment) => segment.text)
        .join('');

    assert.equal(underlinedText, 'Level twoLevel three');
    assertHasClass(
        source,
        segments,
        'Level two',
        'kanade-source-editor-token--heading-2',
    );
    assertHasClass(
        source,
        segments,
        'Level three',
        'kanade-source-editor-token--heading-3',
    );
    assertLacksClass(
        source,
        segments,
        '==   ',
        'kanade-source-editor-token--heading-text',
    );
    assertLacksClass(
        source,
        segments,
        '   ==   ',
        'kanade-source-editor-token--heading-text',
    );
});

test('apostrophe markup renders bold and italic text', () => {
    const source = "'''bold''' ''italic'' '''''both'''''";
    const segments = highlightWikitext(source);

    assertHasClass(
        source,
        segments,
        'bold',
        'kanade-source-editor-token--bold',
    );
    assertHasClass(
        source,
        segments,
        'italic',
        'kanade-source-editor-token--italic',
    );
    assertHasClass(
        source,
        segments,
        'both',
        'kanade-source-editor-token--bold',
    );
    assertHasClass(
        source,
        segments,
        'both',
        'kanade-source-editor-token--italic',
    );
    assertHasClass(
        source,
        segments,
        "'''",
        'kanade-source-editor-token--wiki-markup',
    );
});

test('opaque apostrophes do not leak emphasis into article text', () => {
    const source = "<!-- ''' -->plain'''\n<nowiki>''</nowiki>still''";
    const segments = highlightWikitext(source);

    assert.doesNotMatch(
        classesAt(source, segments, 'plain').join(' '),
        /kanade-source-editor-token--bold/u,
    );
    assert.doesNotMatch(
        classesAt(source, segments, 'still').join(' '),
        /kanade-source-editor-token--italic/u,
    );
});

test('unmatched emphasis does not pair across lines', () => {
    const source = "'''first\nsecond'''";
    const segments = highlightWikitext(source);

    assert.doesNotMatch(
        classesAt(source, segments, 'first').join(' '),
        /kanade-source-editor-token--bold/u,
    );
    assert.doesNotMatch(
        classesAt(source, segments, 'second').join(' '),
        /kanade-source-editor-token--bold/u,
    );
});

test('apostrophes in HTML attributes do not open article emphasis', () => {
    const source = "<span title=\"''\">plain''</span>";
    const segments = highlightWikitext(source);

    assert.doesNotMatch(
        classesAt(source, segments, 'plain').join(' '),
        /kanade-source-editor-token--italic/u,
    );
});

test('explanatory footnotes do not expose reference-preview metadata', () => {
    const footnotes = ['{{efn|1=A}}', '{{efn-ua|1=A}}'];
    for (const source of footnotes) {
        const segments = highlightWikitext(source);

        assert.ok(segments.every((segment) => segment.referenceSource == null));
    }
});

test('nested citations keep citation preview metadata', () => {
    const reference = '<Ref name="Gould, 2026" />';
    const namedReuse = '{{r|Hon, 2026}}';
    const shortFootnote = '{{sfn|Meghan G|2026}}';
    const source = `{{efn|1=See ${reference} ${namedReuse} ${shortFootnote}}}`;
    const segments = highlightWikitext(source);

    assertHasClass(
        source,
        segments,
        'See',
        'kanade-source-editor-token--footnote',
    );
    assert.equal(
        segmentAt(source, segments, 'See')?.referenceSource,
        undefined,
    );
    for (const citation of [reference, namedReuse, shortFootnote]) {
        assertHasClass(
            source,
            segments,
            citation,
            'kanade-source-editor-token--reference',
        );
        assert.equal(
            segmentAt(source, segments, citation)?.referenceSource,
            citation,
        );
    }
});

test('identical reference occurrences keep their own editable source offsets', () => {
    const citations = [
        '<ref>{{cite web|title=Same}}</ref>',
        '{{sfn|Same|2026}}',
    ];
    for (const citation of citations) {
        const source = `${citation} and ${citation}`;
        const segments = highlightWikitext(source);
        const starts = [0, citation.length + ' and '.length];
        for (const start of starts) {
            const segment = segments.find(
                (candidate) => candidate.start === start,
            );
            assert.equal(segment?.referenceSource, citation);
            assert.equal(segment?.referenceStart, start);
        }
    }
});

test('emphasis is limited to template values and wikilink labels', () => {
    const source = [
        "{{''template''|''name''=value|body=''shown''}}",
        "[[''target''|''label'']]",
    ].join(' ');
    const segments = highlightWikitext(source);

    assert.doesNotMatch(
        classesAt(source, segments, 'template').join(' '),
        /kanade-source-editor-token--italic/u,
    );
    assert.doesNotMatch(
        classesAt(source, segments, 'name').join(' '),
        /kanade-source-editor-token--italic/u,
    );
    assertHasClass(
        source,
        segments,
        'shown',
        'kanade-source-editor-token--italic',
    );
    assert.doesNotMatch(
        classesAt(source, segments, 'target').join(' '),
        /kanade-source-editor-token--italic/u,
    );
    assertHasClass(
        source,
        segments,
        'label',
        'kanade-source-editor-token--italic',
    );
});

test('block template parameters are not treated as table rows', () => {
    const source = [
        '{{Infobox',
        ' | name = value',
        '}}',
        '{|',
        '| cell',
        '|}',
    ].join('\n');
    const segments = highlightWikitext(source);
    const parameterClasses = classesAt(source, segments, 'name');

    assert.ok(
        parameterClasses.includes('kanade-source-editor-token--parameter'),
    );
    assert.ok(!parameterClasses.includes('kanade-source-editor-token--table'));
    assertLacksClass(
        source,
        segments,
        'cell',
        'kanade-source-editor-token--table',
    );
});

test('template parameters nested in tables remain parameter tokens', () => {
    const source = [
        '{|',
        '| {{Infobox',
        ' | style="color:red" | value',
        ' |+ class="caption" style="width:100%" | title',
        '}}',
        '|}',
    ].join('\n');
    const segments = highlightWikitext(source);
    const parameterClasses = classesAt(source, segments, 'style');

    assert.ok(
        parameterClasses.includes('kanade-source-editor-token--parameter'),
    );
    assert.ok(!parameterClasses.includes('kanade-source-editor-token--table'));
    assertLacksClass(
        source,
        segments,
        'class="caption"',
        'kanade-source-editor-token--table',
    );
    assertLacksClass(
        source,
        segments,
        'color',
        'kanade-source-editor-token--language-variant',
    );
    assertLacksClass(
        source,
        segments,
        'width',
        'kanade-source-editor-token--language-variant',
    );
});

test('missing-link metadata covers wikilink targets and aliases without syntax', () => {
    const source = '[[品田昭子]] [[Target|label]]';
    const segments = highlightWikitext(source);

    assert.equal(segmentAt(source, segments, '[[')?.missingTitle, undefined);
    assert.equal(
        segmentAt(source, segments, '品田昭子')?.missingTitle,
        '品田昭子',
    );
    assert.equal(segmentAt(source, segments, ']] ')?.missingTitle, undefined);
    assert.equal(segmentAt(source, segments, 'Target')?.missingTitle, 'Target');
    assert.equal(segmentAt(source, segments, '|')?.missingTitle, undefined);
    assert.equal(segmentAt(source, segments, 'label')?.missingTitle, 'Target');
});

test('missing-link metadata ignores fragments and leading colons', () => {
    const source = '[[:品田昭子#生平|人物]]';
    const segments = highlightWikitext(source);

    assert.equal(
        segmentAt(source, segments, '品田昭子#生平')?.missingTitle,
        '品田昭子',
    );
    assert.equal(segmentAt(source, segments, '人物')?.missingTitle, '品田昭子');
});

test('missing links exclude label markup and non-label options', () => {
    const source = [
        "[[Missing|'''label''']]",
        '[[File:Missing.svg|thumb|caption]]',
        '[[Category:Missing|sort]]',
    ].join(' ');
    const segments = highlightWikitext(source);

    assert.equal(segmentAt(source, segments, "'''")?.missingTitle, undefined);
    assert.equal(
        segmentAt(source, segments, 'Missing')?.missingTitle,
        'Missing',
    );
    assert.equal(segmentAt(source, segments, 'label')?.missingTitle, 'Missing');
    assert.equal(
        segmentAt(source, segments, 'File:Missing.svg')?.missingTitle,
        'File:Missing.svg',
    );
    assert.equal(segmentAt(source, segments, 'thumb')?.missingTitle, undefined);
    assert.equal(
        segmentAt(source, segments, 'Category:Missing')?.missingTitle,
        'Category:Missing',
    );
    assert.equal(segmentAt(source, segments, 'sort')?.missingTitle, undefined);
});

test('wikilink aliases retain bold link text and the target href for shared rendering', () => {
    const source = '[[Airi|艾莉]]';
    const segments = highlightWikitext(source);
    const alias = segmentAt(source, segments, '艾莉');

    assert.equal(alias?.missingTitle, 'Airi');
    assert.equal(alias?.href, '/wiki/Airi');
    assert.ok(alias?.classNames.includes('kanade-source-editor-token--link'));
    assert.ok(
        alias?.classNames.includes('kanade-source-editor-token--link-text'),
    );
    assert.equal(segments.map((segment) => segment.text).join(''), source);
});

test('large sparse sources retain highlighting past the former limit', () => {
    const source = `${'x'.repeat(300_001)}\n{{Tail template|key=value}}`;
    const segments = highlightWikitext(source);

    assert.ok(source.indexOf('Tail template') > 300_000);
    assertHasClass(
        source,
        segments,
        'Tail template',
        'kanade-source-editor-token--template-name',
    );
    assertHasClass(
        source,
        segments,
        'key',
        'kanade-source-editor-token--parameter',
    );
    assert.equal(segments.map((segment) => segment.text).join(''), source);
});
