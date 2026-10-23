/**
 * @file tests/source-editor/citation.test.ts
 * Purpose: Tests canonical citation formatting and semantic names.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveWikiPolicy } from '../../src/source-editor/domain/wiki-policy.ts';

import {
    formatCitationTemplate,
    getAuthorParamOrder,
    getCitationIdentity,
    normalizeEnglishDate,
} from '../../src/source-editor/domain/citation.ts';
import { citationTemplateData as generatedTemplateData } from '../../src/source-editor/config/citation-template-data/index.ts';
import {
    createTemplateNameContext,
    getCanonicalTemplateName,
    isCitationTemplate,
    isEditableCitationTemplate,
    isMetadataFreeCitationTemplate,
    normalizeTemplateName,
} from '../../src/source-editor/domain/templates.ts';
import type { CitationTemplateData } from '../../src/source-editor/domain/types.ts';

const metadata: CitationTemplateData = {
    aliases: {
        'access-date': ['accessdate'],
        first: ['first1'],
        first2: [],
        last: ['last1', 'author', 'author1'],
        last2: ['author2'],
        last100: [],
        title: [],
        url: ['URL'],
        'url-status': [],
    },
    paramOrder: [
        'last',
        'first',
        'last2',
        'first2',
        'last100',
        'date',
        'title',
        'url',
        'access-date',
        'url-status',
    ],
};
const englishTemplateNames = createTemplateNameContext('enwiki');
const chineseTemplateNames = createTemplateNameContext('zhwiki');

test('citation and draft ordering share numbered author-field ranks', () => {
    assert.deepEqual(
        [
            'last',
            'first1',
            'author-link',
            'last2',
            'first2',
            'author-link2',
            'last100',
        ].map(getAuthorParamOrder),
        [0, 1, 2, 3, 4, 5, 297],
    );
    for (const name of ['author', 'editor', 'Last', 'last-two', 'title']) {
        assert.equal(getAuthorParamOrder(name), null);
    }
});

const testNormalizeEnglishDates = () => {
    const month = normalizeEnglishDate('June 2005');
    const monthFirst = normalizeEnglishDate('June 7, 2005');
    const dayFirst = normalizeEnglishDate('7 June 2005');
    const uglyIso = normalizeEnglishDate('2026-1-13');
    const invalid = normalizeEnglishDate('February 29, 2005');
    const year = normalizeEnglishDate('2005');
    const unrecognized = normalizeEnglishDate('夏 2005');

    assert.equal(month, '2005-06');
    assert.equal(monthFirst, '2005-06-07');
    assert.equal(dayFirst, '2005-06-07');
    assert.equal(uglyIso, '2026-01-13');
    assert.equal(invalid, 'February 29, 2005');
    assert.equal(year, '2005');
    assert.equal(unrecognized, '夏 2005');
};
test(
    'normalizes English dates at year, month, and day precision',
    testNormalizeEnglishDates,
);

const testCanonicalParameterFormatting = () => {
    const result = formatCitationTemplate(
        '{{Cite web|URL=https://example.test|title=Example|author1=Ma|accessdate=June 2005}}',
        metadata,
        'block',
        undefined,
        resolveWikiPolicy('zhwiki'),
    );

    const expected = [
        '{{Cite web',
        '  | author = Ma',
        '  | title = Example',
        '  | url = https://example.test',
        '  | access-date = 2005-06',
        '}}',
    ].join('\n');
    assert.equal(result.text, expected);
};
test(
    'canonicalizes aliases and applies TemplateData order',
    testCanonicalParameterFormatting,
);

const testInlineCitationLayout = () => {
    const result = formatCitationTemplate(
        '{{Cite web|URL=https://example.test|title=Example|author1=Ma|accessdate=June 2005}}',
        metadata,
        'inline',
        undefined,
        resolveWikiPolicy('zhwiki'),
    );

    const expected =
        '{{Cite web | author = Ma | title = Example | ' +
        'url = https://example.test | access-date = 2005-06 }}';
    assert.equal(result.text, expected);
};
test('formats canonical citation parameters inline', testInlineCitationLayout);

test('uses one closing space in inline citations and stays idempotent', () => {
    const cases = [
        ['{{cite web|language=Japanese}}', '{{Cite web | language = ja }}'],
        ['{{cite web|language=Japanese   }}', '{{Cite web | language = ja }}'],
        [
            '{{cite web|title={{lang|ja|標題}}}}',
            '{{Cite web | title = {{lang|ja|標題}} }}',
        ],
        ['{{cite web|title=}}', '{{Cite web }}'],
    ];
    for (const [raw, expected] of cases) {
        const first = formatCitationTemplate(
            raw,
            generatedTemplateData['cite web'],
            'inline',
        );
        assert.equal(first.text, expected);
        assert.match(first.text, /\S \}\}$/u);
        assert.equal(
            formatCitationTemplate(
                first.text,
                generatedTemplateData['cite web'],
                'inline',
            ).text,
            first.text,
        );
    }
});

test('normalizes English language names while formatting citations', () => {
    const single = formatCitationTemplate(
        '{{cite magazine|title=Review|language=Japanese}}',
        generatedTemplateData['cite magazine'],
        'inline',
    );
    const multiple = formatCitationTemplate(
        '{{cite magazine|title=Review|language=English,japanese}}',
        generatedTemplateData['cite magazine'],
        'inline',
    );

    assert.equal(
        single.text,
        '{{Cite magazine | title = Review | language = ja }}',
    );
    assert.equal(
        multiple.text,
        '{{Cite magazine | title = Review | language = en, ja }}',
    );
});

test('suffixes repeated parameters beside the first value', () => {
    const entered =
        '{{cite journal|journal=J1|issue=48|journal=J2|title=T|' +
        'journal=J3|doi=D}}';
    const first = formatCitationTemplate(
        entered,
        generatedTemplateData['cite journal'],
        'inline',
    );

    assert.equal(
        first.text,
        '{{Cite journal | title = T | journal = J1 | journal-a = J2 | ' +
            'journal-b = J3 | issue = 48 | doi = D }}',
    );
    assert.deepEqual(
        first.parameterCollisions.map((collision) => ({
            canonical: collision.canonicalParameter,
            renamed: collision.renamedParameter,
        })),
        [
            { canonical: 'journal', renamed: 'journal-a' },
            { canonical: 'journal', renamed: 'journal-b' },
        ],
    );
    const second = formatCitationTemplate(
        first.text,
        generatedTemplateData['cite journal'],
        'inline',
    );
    assert.equal(second.text, first.text);
});

test('does not let blank creator aliases displace a populated author', () => {
    const first = formatCitationTemplate(
        '{{cite web|last1= |first1=|author=糸井重里|date=2000-08-22|title=座談会}}',
        generatedTemplateData['cite web'],
        'inline',
    );

    assert.match(first.text, /\| author = 糸井重里/u);
    assert.doesNotMatch(first.text, /author1-a|last1|first1/u);
    assert.deepEqual(first.parameterCollisions, []);
    assert.equal(getCitationIdentity(first.citation).author, '糸井重里');
    assert.equal(
        formatCitationTemplate(
            first.text,
            generatedTemplateData['cite web'],
            'inline',
        ).text,
        first.text,
    );
});

test('does not count empty repeated fields as populated collisions', () => {
    const first = formatCitationTemplate(
        '{{cite web|title= |title=First|title=|title=Repeat}}',
        generatedTemplateData['cite web'],
        'inline',
    );

    assert.equal(
        first.text,
        '{{Cite web | title = First | title-a = Repeat }}',
    );
    assert.equal(first.parameterCollisions.length, 1);
    assert.equal(first.parameterCollisions[0].renamedParameter, 'title-a');
    assert.equal(
        formatCitationTemplate(
            first.text,
            generatedTemplateData['cite web'],
            'inline',
        ).text,
        first.text,
    );
});

test('keeps a repeated creator field invalid and stable', () => {
    const first = formatCitationTemplate(
        '{{cite journal|last=First|last=Repeat|title=T}}',
        generatedTemplateData['cite journal'],
        'inline',
    );

    assert.match(first.text, /\| author = First \| author-a = Repeat/u);
    assert.equal(first.parameterCollisions[0]?.renamedParameter, 'author-a');
    const second = formatCitationTemplate(
        first.text,
        generatedTemplateData['cite journal'],
        'inline',
    );
    assert.equal(second.text, first.text);
});

test('does not turn repeated numbered creators into later slots', () => {
    const numbered = formatCitationTemplate(
        '{{cite journal|last2=First|last2=Repeat|title=T}}',
        generatedTemplateData['cite journal'],
        'inline',
    );
    assert.match(numbered.text, /\| author2 = First \| author2-a = Repeat/u);
    assert.doesNotMatch(numbered.text, /\| author22\s*=/u);
    assert.equal(
        formatCitationTemplate(
            numbered.text,
            generatedTemplateData['cite journal'],
            'inline',
        ).text,
        numbered.text,
    );
});

test('does not turn a repeated creator link into a later slot', () => {
    const link = formatCitationTemplate(
        '{{cite journal|editor-link=First|editor-link=Repeat|title=T}}',
        generatedTemplateData['cite journal'],
        'inline',
    );
    assert.match(
        link.text,
        /\| editor-link = First \| editor-link-a = Repeat/u,
    );
    assert.doesNotMatch(link.text, /\| editor-link2\s*=/u);
    assert.equal(
        formatCitationTemplate(
            link.text,
            generatedTemplateData['cite journal'],
            'inline',
        ).text,
        link.text,
    );
});

test('stabilizes repeat markers after creator output aliases', () => {
    const speech = formatCitationTemplate(
        '{{cite speech|last=First|last=Repeat|event=Talk}}',
        generatedTemplateData['cite speech'],
        'inline',
    );
    assert.match(speech.text, /\| author = First \| author-a = Repeat/u);
    assert.equal(
        formatCitationTemplate(
            speech.text,
            generatedTemplateData['cite speech'],
            'inline',
        ).text,
        speech.text,
    );
});

test('suffixes creator groups that share a final output name', () => {
    const first = formatCitationTemplate(
        '{{cite arxiv|author=A|last=B|last=C|title=T}}',
        generatedTemplateData['cite arxiv'],
        'inline',
    );

    assert.equal(
        first.text,
        '{{Cite arxiv | author = A | author-a = B | author-b = C | ' +
            'title = T }}',
    );
    assert.deepEqual(
        first.parameterCollisions.map((collision) => ({
            first: collision.firstParameter,
            renamed: collision.renamedParameter,
            second: collision.secondParameter,
        })),
        [
            { first: 'author', renamed: 'author-a', second: 'last' },
            { first: 'author', renamed: 'author-b', second: 'last' },
        ],
    );
    assert.equal(
        formatCitationTemplate(
            first.text,
            generatedTemplateData['cite arxiv'],
            'inline',
        ).text,
        first.text,
    );
});

test('keeps canonical aliases connected when both names are listed', () => {
    const first = formatCitationTemplate(
        '{{Citation|editor-last2=A|editor2-last=B|title=T}}',
        generatedTemplateData.citation,
        'inline',
    );

    assert.match(first.text, /\| editor-last2 = A \| editor-last2-a = B/u);
    assert.equal(first.parameterCollisions.length, 1);
    assert.equal(first.parameterCollisions[0]?.firstParameter, 'editor-last2');
    assert.equal(first.parameterCollisions[0]?.secondParameter, 'editor2-last');
    assert.equal(
        formatCitationTemplate(
            first.text,
            generatedTemplateData.citation,
            'inline',
        ).text,
        first.text,
    );
});

const testCanonicalTemplateCasing = () => {
    const canonicalNames = [
        'Citation',
        'Cite arXiv',
        'Cite AV media',
        'Cite AV media notes',
        'Cite bioRxiv',
        'Cite CiteSeerX',
        'Cite medRxiv',
        'Cite SSRN',
        'Cite tweet',
        'Cite web',
    ] as const;

    for (const canonical of canonicalNames) {
        const entered = canonical[0].toLocaleLowerCase() + canonical.slice(1);
        const metadataKey = normalizeTemplateName(canonical);
        const result = formatCitationTemplate(
            `{{${entered}|title=Example}}`,
            generatedTemplateData[metadataKey],
        );
        const pattern = new RegExp(`^\\{\\{${canonical}\\n`, 'u');
        assert.match(result.text, pattern);
    }
};
test('uses canonical citation template casing', testCanonicalTemplateCasing);

test('keeps print fallback order with canonical display casing', () => {
    const result = formatCitationTemplate(
        '{{cite book|website=W|chapter=C|publisher=P|url=U|title=T}}',
        { aliases: {}, paramOrder: [] },
        'inline',
    );

    assert.equal(
        result.text,
        '{{Cite book | url = U | title = T | publisher = P | ' +
            'chapter = C | website = W }}',
    );
});

test('distinguishes metadata-free editable citation templates', () => {
    assert.equal(getCanonicalTemplateName('cite comic'), 'Cite comic');
    assert.equal(isEditableCitationTemplate('Template:Cite_comic'), true);
    assert.equal(isEditableCitationTemplate('TM:Cite_comic'), false);
    assert.equal(
        isEditableCitationTemplate('TM:Cite_comic', englishTemplateNames),
        true,
    );
    assert.equal(
        isEditableCitationTemplate('T:Cite_comic', chineseTemplateNames),
        true,
    );
    assert.equal(
        isEditableCitationTemplate('模板:Cite_comic', chineseTemplateNames),
        true,
    );
    assert.equal(isMetadataFreeCitationTemplate('Cite comic'), true);
    assert.equal(isCitationTemplate('Cite comic'), false);
    assert.equal(getCanonicalTemplateName('cite Fan_Guide'), 'Cite Fan Guide');
    assert.equal(isEditableCitationTemplate('Cite fan guide'), true);
    assert.equal(isMetadataFreeCitationTemplate('Cite fan guide'), true);
    assert.equal(isCitationTemplate('Cite Web'), false);
    assert.equal(isMetadataFreeCitationTemplate('Cite Web'), true);
    assert.equal(getCanonicalTemplateName('Cite Web'), 'Cite Web');
    assert.equal(isEditableCitationTemplate('Citeline'), false);
});

const testDisplayedTimeFormatting = () => {
    const single = formatCitationTemplate(
        '{{Cite AV media|last=Ma|time=1:15:41|title=Video}}',
        generatedTemplateData['cite av media'],
    );
    assert.match(single.text, /\| time = 1ʰ15′41″/u);
    const singleIdentity = getCitationIdentity(single.citation);
    assert.equal(singleIdentity.locator, 'at time 1:15:41');

    const range = formatCitationTemplate(
        '{{Cite AV media|last=Ma|time=0:00–5:00|title=Video}}',
        generatedTemplateData['cite av media'],
    );
    assert.match(range.text, /\| time = 0′00″–5′00″/u);
    const rangeIdentity = getCitationIdentity(range.citation);
    assert.equal(rangeIdentity.locator, 'at time 0:00–5:00');
};
test(
    'formats displayed times while keeping colon locators',
    testDisplayedTimeFormatting,
);

const testNumberedAuthorLabels = () => {
    const unstructured = formatCitationTemplate(
        '{{cite web|author1=Ma|author2=Li|title=Example}}',
        metadata,
    );
    assert.match(unstructured.text, /\| author1 = Ma/u);
    assert.match(unstructured.text, /\| author2 = Li/u);

    const structured = formatCitationTemplate(
        '{{cite web|last1=Ma|first1=Anne|last2=Li|first2=Bo|title=Example}}',
        metadata,
    );
    assert.match(structured.text, /\| last1 = Ma/u);
    assert.match(structured.text, /\| first1 = Anne/u);
    assert.match(structured.text, /\| last2 = Li/u);
    assert.match(structured.text, /\| first2 = Bo/u);
};
test(
    'uses numbered author labels only when multiple authors are present',
    testNumberedAuthorLabels,
);

const testHighNumberedAuthorAliases = () => {
    const result = formatCitationTemplate(
        '{{cite web|author100=Ma|title=Example}}',
        metadata,
    );

    const author = result.citation.params.find((param) => param.value === 'Ma');
    assert.deepEqual(author, { name: 'last100', value: 'Ma' });
};
test(
    'canonicalizes high numbered author aliases without a fixed cap',
    testHighNumberedAuthorAliases,
);

const testRemovedDeadUrlParameters = () => {
    const live = formatCitationTemplate(
        '{{cite web|title=Example|url=https://example.test|archive-url=https://archive.test|dead-url=no}}',
        metadata,
    );
    assert.match(live.text, /\| url-status = live/u);
    assert.doesNotMatch(live.text, /dead-url/u);

    const dead = formatCitationTemplate(
        '{{cite web|title=Example|url=https://example.test|archive-url=https://archive.test|deadurl=yes}}',
        metadata,
    );
    assert.match(dead.text, /\| url-status = dead/u);
};
test(
    'replaces removed dead-url parameters and converts boolean values',
    testRemovedDeadUrlParameters,
);

const testTemplateDefinedParameterOrder = () => {
    const result = formatCitationTemplate(
        '{{cite journal|title=Example|name-list-style=amp|archive-format=PDF}}',
        generatedTemplateData['cite journal'],
    );
    const archiveIndex = result.text.indexOf('| archive-format =');
    const styleIndex = result.text.indexOf('| name-list-style =');
    assert.ok(styleIndex < archiveIndex);
};
test(
    'keeps template-defined order ahead of print fallback fields',
    testTemplateDefinedParameterOrder,
);

test('keeps Cite interview TemplateData order with extra fields', () => {
    const result = formatCitationTemplate(
        [
            '{{Cite interview',
            '|last1=Noguchi|first1=Shinji',
            '|last2=Hatsushiba|first2=Hiroya',
            '|date=2006-12-20',
            '|script-title=en:Eternal Sonata Interview',
            '|url=http://xbox360.ign.com/articles/751/751888p1.html',
            '|interviewer=Brudvig, Erik|work=[[IGN]]}}',
        ].join(''),
        generatedTemplateData['cite interview'],
        'inline',
    );
    const names = result.citation.params.map((param) => param.name);

    assert.deepEqual(names, [
        'last',
        'first',
        'last2',
        'first2',
        'interviewer',
        'script-title',
        'url',
        'work',
        'date',
    ]);
});

const testReferenceNameIdentityFallbacks = () => {
    const commented = formatCitationTemplate(
        '{{cite web|author=山田花子<!-- # Yoisaki -->|publisher=セガ|title=X}}',
        metadata,
    );
    const commentedIdentity = getCitationIdentity(commented.citation);
    assert.equal(commentedIdentity.baseName, 'Yoisaki, n.d.');
    assert.match(commented.text, /author = 山田花子 <!-- # Yoisaki -->/u);

    const familyNames = formatCitationTemplate(
        '{{cite web|author1=堀井雄二<!-- # Horii, Yūji -->|author2=早坂将昭<!-- # Hayasaka, Masaaki -->|date=2025|title=X}}',
        metadata,
    );
    const familyIdentity = getCitationIdentity(familyNames.citation);
    assert.equal(familyIdentity.baseName, 'Horii & Hayasaka, 2025');

    const multiple = formatCitationTemplate(
        '{{cite web|last=Ma|last2=Smith|last3=Jones|date=2006|title=X}}',
        metadata,
    );
    const multipleIdentity = getCitationIdentity(multiple.citation);
    assert.equal(multipleIdentity.baseName, 'Ma et al., 2006');
};
test(
    'uses hashtag comments, multiple authors, and n.d. in names',
    testReferenceNameIdentityFallbacks,
);

const testPublisherIdentityFallback = () => {
    const publisher = formatCitationTemplate(
        '{{cite web|publisher=セガ<!--#Sega-->|date=2020|title=X}}',
        metadata,
    );
    const publisherIdentity = getCitationIdentity(publisher.citation);
    assert.equal(publisherIdentity.baseName, 'Sega, 2020');
    assert.match(publisher.text, /publisher = セガ <!-- # Sega -->/u);

    const title = formatCitationTemplate(
        '{{cite web|date=2020|title=Example work}}',
        metadata,
    );
    const titleIdentity = getCitationIdentity(title.citation);
    assert.equal(titleIdentity.baseName, '“Example work”, 2020');
};
test(
    'uses publisher after credited authors and organizations',
    testPublisherIdentityFallback,
);

test('normalizes reference-name comment separators in both layouts', () => {
    const raw =
        '{{cite web|author=山田花子<!-- # Yamada, Hanako -->|' +
        'publisher=セガ   <!--# Sega -->|title=X}}';
    for (const layout of ['inline', 'block'] as const) {
        const result = formatCitationTemplate(raw, metadata, layout);
        assert.match(
            result.text,
            /author = 山田花子 <!-- # Yamada, Hanako -->/u,
        );
        assert.match(result.text, /publisher = セガ <!-- # Sega -->/u);
        assert.equal(
            formatCitationTemplate(result.text, metadata, layout).text,
            result.text,
        );
    }
});

const testPublisherBeforeContainingWork = () => {
    const work = formatCitationTemplate(
        '{{cite web|website=Example Site|publisher=Publisher|title=Page}}',
        metadata,
    );
    const identity = getCitationIdentity(work.citation);
    assert.equal(identity.baseName, 'Publisher, n.d.');
};
test(
    'uses publishers before containing works',
    testPublisherBeforeContainingWork,
);

const testReferenceNameAuthorFamilyPriority = () => {
    const authorParams = [
        'author-last',
        'author-last3',
        'author3-last',
        'author-surname',
        'author-surname3',
        'author3-surname',
        'last',
        'last3',
        'surname',
        'surname3',
        'author',
        'author3',
        'author100',
        'subject',
        'subject3',
        'host',
        'host3',
    ];
    for (const parameter of authorParams) {
        const result = formatCitationTemplate(
            `{{cite web|${parameter}=Credited|publisher=Publisher|` +
                'website=Periodical|title=Page}}',
            generatedTemplateData['cite web'],
        );
        const identity = getCitationIdentity(result.citation);
        assert.equal(identity.baseName, 'Credited, n.d.', parameter);
    }
};
test(
    'uses every author-family spelling before publisher and periodical fields',
    testReferenceNameAuthorFamilyPriority,
);

const testPublisherAndPeriodicalFamilyPriority = () => {
    const periodicalParams = [
        'periodical',
        'journal',
        'newspaper',
        'magazine',
        'work',
        'website',
        'encyclopedia',
        'encyclopaedia',
        'dictionary',
    ];
    for (const periodical of periodicalParams) {
        for (const publisher of ['publisher', 'institution']) {
            const result = formatCitationTemplate(
                `{{cite web|${publisher}=Publisher|${periodical}=Periodical|` +
                    'title=Page}}',
                generatedTemplateData['cite web'],
            );
            const identity = getCitationIdentity(result.citation);
            assert.equal(
                identity.baseName,
                'Publisher, n.d.',
                `${publisher} over ${periodical}`,
            );
        }
        const result = formatCitationTemplate(
            `{{cite web|${periodical}=Periodical|title=Page}}`,
            generatedTemplateData['cite web'],
        );
        assert.equal(
            getCitationIdentity(result.citation).baseName,
            'Periodical, n.d.',
            periodical,
        );
    }
};
test(
    'falls back from publishers to every periodical-family field',
    testPublisherAndPeriodicalFamilyPriority,
);

const testExcludedPublisherFallsBackToPeriodical = () => {
    const result = formatCitationTemplate(
        '{{cite web|publisher=Publisher<!-- !no-author -->|' +
            'website=Periodical|title=Page}}',
        generatedTemplateData['cite web'],
    );
    assert.equal(
        getCitationIdentity(result.citation).baseName,
        'Periodical, n.d.',
    );
};
test(
    'falls back to a periodical when the publisher is excluded',
    testExcludedPublisherFallsBackToPeriodical,
);

const testPublisherBeforeDepartmentOrMagazine = () => {
    const result = formatCitationTemplate(
        '{{Cite magazine|title=星之海|department=黄金眼 ' +
            '<!-- # Huangjin Yan -->|magazine=游戏机实用技术|' +
            'publisher=UCG Media|publication-date=2023-10}}',
        generatedTemplateData['cite magazine'],
    );
    const identity = getCitationIdentity(result.citation);
    assert.equal(identity.baseName, 'UCG Media, 2023');
};
test(
    'uses publisher instead of department or magazine',
    testPublisherBeforeDepartmentOrMagazine,
);

const testEditorExcludedFromIdentity = () => {
    const result = formatCitationTemplate(
        '{{Cite web|editor=Editor|publisher=Publisher<!-- !no-author -->|title=Example}}',
        metadata,
    );
    const identity = getCitationIdentity(result.citation);
    assert.equal(identity.baseName, '“Example”, n.d.');
};
test(
    'does not use editors as the citation author fallback',
    testEditorExcludedFromIdentity,
);

const testNoAuthorFallbackDirectives = () => {
    const result = formatCitationTemplate(
        '{{Cite web|website=网站<!-- !no-author # Website -->|' +
            'work=Work<!-- !no-author -->|publisher=Publisher|title=Example}}',
        metadata,
    );
    const identity = getCitationIdentity(result.citation);
    assert.equal(identity.baseName, 'Publisher, n.d.');
    assert.match(result.text, /website = 网站 <!-- !no-author # Website -->/u);

    const explicitAuthor = formatCitationTemplate(
        '{{Cite web|author=Byline<!-- !no-author # Renamed -->|' +
            'organization=Organization|title=Example}}',
        metadata,
    );
    const explicitIdentity = getCitationIdentity(explicitAuthor.citation);
    assert.equal(explicitIdentity.baseName, 'Organization, n.d.');

    const title = formatCitationTemplate(
        '{{Cite web|title=Example<!-- !no-author -->}}',
        metadata,
    );
    const titleIdentity = getCitationIdentity(title.citation);
    assert.equal(titleIdentity.baseName, 'Untitled source, n.d.');
};
test('skips fallback fields marked no-author', testNoAuthorFallbackDirectives);

const testDateAndLocatorExclusionDirectives = () => {
    const result = formatCitationTemplate(
        '{{Cite web|author=Author|date=2025<!-- !no-date -->|year=2024|' +
            'page=8<!-- !no-part -->|time=1:15:41|title=Example}}',
        metadata,
    );
    const identity = getCitationIdentity(result.citation);
    assert.equal(identity.baseName, 'Author, 2024');
    assert.equal(identity.locator, 'at time 1:15:41');

    const excluded = formatCitationTemplate(
        '{{Cite web|author=Author|date=2025<!-- !no-date -->|' +
            'page=8<!-- !no-part -->|title=Example}}',
        metadata,
    );
    const excludedIdentity = getCitationIdentity(excluded.citation);
    assert.equal(excludedIdentity.baseName, 'Author, n.d.');
    assert.equal(excludedIdentity.locator, '');
};
test(
    'skips date and locator fields with exclusion directives',
    testDateAndLocatorExclusionDirectives,
);

const testCreditedOrganizationIdentity = () => {
    const result = formatCitationTemplate(
        '{{Cite web|organization=National Geographic Society|' +
            'publisher=Publisher|title=Example}}',
        metadata,
    );
    const identity = getCitationIdentity(result.citation);
    assert.equal(identity.baseName, 'National Geographic Society, n.d.');
};
test(
    'uses a credited organization before the title',
    testCreditedOrganizationIdentity,
);

const testTerminalTitleFallback = () => {
    const result = formatCitationTemplate(
        '{{Cite web|title=Using citations in research papers}}',
        metadata,
    );
    const identity = getCitationIdentity(result.citation);
    assert.equal(identity.baseName, '“Using citations”, n.d.');
};
test(
    'shortens and quotes the terminal title fallback',
    testTerminalTitleFallback,
);
