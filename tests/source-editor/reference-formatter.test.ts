/**
 * @file tests/source-editor/reference-formatter.test.ts
 * Purpose: Tests article-level list-defined-reference conversion.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 * 4. assertReferenceMarker
 * 5. buildPaginatedInterviewSource
 * 6. testLinkedShortCitation
 * 7. testColonLinkedShortCitation
 * 8. testCustomLinkedCitation
 * 9. testProtectedLinkedCitationSources
 * 10. testPlainReferenceNames
 * 11. testDragonQuestPatterns
 * 12. buildDragonQuestSource
 * 13. assertDragonQuestResult
 * 14. testSeaOfStarsPatterns
 * 15. buildSeaOfStarsSource
 * 16. buildVideoCall
 * 17. buildPlatformCall
 * 18. buildVideoDefinition
 * 19. buildPlatformDefinition
 * 20. assertSeaOfStarsResult
 * 21. alphabeticTestSuffix
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveWikiPolicy } from '../../src/source-editor/domain/wiki-policy.ts';

import { citationTemplateData as generatedTemplateData } from '../../src/source-editor/config/citation-template-data/index.ts';
import { formatCitationWikitext } from '../../src/source-editor/domain/citation-formatter.ts';
import { createTemplateNameContext } from '../../src/source-editor/domain/templates.ts';
import type { CitationTemplateDataMap } from '../../src/source-editor/domain/types.ts';

const templateData: CitationTemplateDataMap = {
    'cite book': generatedTemplateData['cite book'],
    'cite web': generatedTemplateData['cite web'],
};
const englishTemplateNames = createTemplateNameContext('enwiki');
const chineseTemplateNames = createTemplateNameContext('zhwiki');
const leadReferenceMarker = /<references responsive>\n\n<!-- -+ § 0 {4}Lead/u;

test('renames reference links when an HTML5 named entity aliases a Unicode name', () => {
    const source = [
        '<ref name="é" />',
        '<ref name="&eacute;" details="p. 23">{{cite book|author=Ma|year=2020|title=Book}}</ref>',
        '<ref name="Good">{{cite web|title=Other}}</ref>',
        '{{r|Good}}',
        '<references />',
    ].join('\n');

    for (const layout of ['inline', 'block'] as const) {
        const result = formatCitationWikitext(source, templateData, layout);
        assert.match(result.text, /<ref name="Ma, 2020" \/>/u);
        assert.match(result.text, /<ref name="Ma, 2020" details="p. 23" \/>/u);
        assert.match(result.text, /<ref name="Ma, 2020">/u);
        assert.doesNotMatch(result.text, /name="(?:é|&eacute;)"/u);
        assert.equal(result.citationsFormatted, 2);
        assert.equal(
            formatCitationWikitext(result.text, templateData, layout).text,
            result.text,
        );
    }
});

test('matches HTML5 named entities in reference-list groups', () => {
    for (const list of [
        '<references group="&eacute;"><ref name="Book">{{cite book|author=Ma|year=2020|title=Book}}</ref></references>',
        '{{Reflist|group=&eacute;|refs=<ref name="Book">{{cite book|author=Ma|year=2020|title=Book}}</ref>}}',
    ]) {
        const source = '<ref name="Book" group="é" details="p. 23" />\n' + list;
        const result = formatCitationWikitext(source, templateData);
        assert.match(
            result.text,
            /<ref name="Ma, 2020" group="é" details="p. 23" \/>/u,
        );
        assert.match(result.text, /<ref name="Ma, 2020">/u);
        assert.equal(result.citationsFormatted, 1);
        assert.equal(
            formatCitationWikitext(result.text, templateData).text,
            result.text,
        );
    }
});

test('consolidates equivalent encoded groups without appending an empty duplicate list', () => {
    const source = [
        '<ref name="Book" group="é" details="p. 23">{{cite book|author=Ma|year=2020|title=Book}}</ref>',
        '<ref name="Book" group="&eacute;">{{cite book|author=Ma|year=2020|title=Book}}</ref>',
        '<references group="&eacute;" />',
        '<references group="é" />',
    ].join('\n');

    for (const layout of ['inline', 'block'] as const) {
        const result = formatCitationWikitext(source, templateData, layout);
        assert.equal(result.individualReferencesFound, 1);
        assert.equal(result.text.match(/<references\b/gu)?.length, 1);
        assert.match(result.text, /<references group="é" responsive>/u);
        assert.equal(result.text.match(/<ref name="Ma, 2020">/gu)?.length, 1);
        assert.equal(
            formatCitationWikitext(result.text, templateData, layout).text,
            result.text,
        );
    }
});

test('keeps literal named entity groups distinct through repeated formatting', () => {
    const source = [
        '<ref name="Book" group="&amp;eacute;" details="p. 23" />',
        '<ref name="Book" group="&amp;eacute;">{{cite book|author=Ma|year=2020|title=Literal}}</ref>',
        '<ref name="Book" group="&eacute;" details="p. 42" />',
        '<ref name="Book" group="é">{{cite book|author=Ma|year=2020|title=Character}}</ref>',
    ].join('\n');

    for (const layout of ['inline', 'block'] as const) {
        const result = formatCitationWikitext(source, templateData, layout);
        assert.equal(result.individualReferencesFound, 2);
        assert.equal(result.text.match(/<references\b/gu)?.length, 2);
        assert.match(
            result.text,
            /<ref name="Ma, 2020" group="&amp;eacute;" details="p. 23" \/>/u,
        );
        assert.match(
            result.text,
            /<ref name="Ma, 2020" group="é" details="p. 42" \/>/u,
        );
        assert.equal(
            formatCitationWikitext(result.text, templateData, layout).text,
            result.text,
        );
    }
});

test('reserves existing encoded anonymous-style names before numbering new notes', () => {
    const source =
        '<ref>Anonymous note.</ref><ref name=":1" /><ref name="&#58;1">Existing note.</ref><references />';
    const result = formatCitationWikitext(source, templateData);

    assert.match(result.text, /<ref name=":2">Anonymous note\.<\/ref>/u);
    assert.match(result.text, /<ref name=":1">Existing note\.<\/ref>/u);
    assert.equal(result.text.match(/<ref name=":1" \/>/gu)?.length, 2);
    assert.equal(
        formatCitationWikitext(result.text, templateData).text,
        result.text,
    );
});

function assertReferenceMarker(text: string, label: string): void {
    const lines = text.split('\n');
    const findIndexCallback = (line: string) => line.includes(` ${label} `);
    const index = lines.findIndex(findIndexCallback);
    assert.ok(index >= 1);
    assert.equal(lines[index - 1], '');
    const markerPattern = new RegExp(`^<!-- -+ ${label} -+ -->$`, 'u');
    assert.match(lines[index], markerPattern);
    assert.equal(lines[index + 1], '');
    assert.equal(lines[index].length, 79);
}

const testMovesCitationsToExistingReferences = () => {
    const source =
        'Text.<ref>{{cite web|url=https://example.test|title=Example|last=Ma|date=June 1, 2006}}</ref>\n\n<references />';
    const result = formatCitationWikitext(
        source,
        templateData,
        'block',
        'Lead',
        undefined,
        false,
        resolveWikiPolicy('enwiki'),
    );

    assert.match(result.text, /<ref name="Ma, 2006" \/>/u);
    assert.match(
        result.text,
        /<references responsive>\n\n<!-- -+ § 0 {4}Lead -+ -->\n\n<ref name="Ma, 2006">\{\{Cite web/u,
    );
    assertReferenceMarker(result.text, '§ 0    Lead');
    assert.match(result.text, /\| date = 2006-06-01/u);
    assert.equal(result.citationsFormatted, 1);
    assert.equal(result.referenceTagsRenamed, 1);
    assert.equal(result.referencesMoved, 1);
};
test(
    'moves and formats citations into an existing references tag',
    testMovesCitationsToExistingReferences,
);

test('preserves a same-line HTML comment immediately after a ref', () => {
    const comment = '<!-- Secret note: preserve this exactly. -->';
    const source =
        'Text.<ref>{{cite web|last=Ma|date=2025|title=Example}}</ref>' +
        `${comment}\n<references />`;
    const result = formatCitationWikitext(source, templateData);

    assert.match(
        result.text,
        new RegExp(`<ref name="Ma, 2025" \\/>${comment}`, 'u'),
    );
    assert.equal(result.text.match(/Secret note/gu)?.length, 1);
});

test('localizes the generated lead marker', () => {
    const source =
        '正文。<ref>{{cite web|title=示例|url=https://example.test}}</ref>' +
        '\n\n<references />';
    const result = formatCitationWikitext(
        source,
        templateData,
        'block',
        '序言',
    );

    assertReferenceMarker(result.text, '§ 0    序言');
    assert.doesNotMatch(result.text, /§ 0 {4}Lead/u);
});

const testInlineCitationLayout = () => {
    const source =
        'Text.<ref>{{cite web|url=https://example.test|title=Example|last=Ma|date=June 1, 2006}}</ref>\n\n<references />';
    const result = formatCitationWikitext(source, templateData, 'inline');

    assert.match(
        result.text,
        /<ref name="Ma, 2006">\{\{Cite web \| author = Ma [^\n]+\}\}<\/ref>/u,
    );
    assert.doesNotMatch(result.text, /\{\{Cite web\n/u);
};
test(
    'formats list-defined citation templates inline',
    testInlineCitationLayout,
);

test('reports repeated parameters without blocking article formatting', () => {
    const source =
        'Text.<ref>{{cite journal|journal=J1|issue=48|journal=J2|' +
        'title=T|journal=J3}}</ref>';
    const first = formatCitationWikitext(
        source,
        generatedTemplateData,
        'inline',
    );

    assert.equal(first.parameterCollisions, 2);
    assert.match(
        first.text,
        /\| journal = J1 \| journal-a = J2 \| journal-b = J3 \| issue = 48/u,
    );
    const second = formatCitationWikitext(
        first.text,
        generatedTemplateData,
        'inline',
    );
    assert.equal(second.text, first.text);
    assert.equal(second.parameterCollisions, 2);
});

const testResponsiveEmptyReferences = () => {
    const result = formatCitationWikitext('<references />', templateData);
    assert.equal(result.text, '<references responsive />');
};
test(
    'adds responsive to an empty native references list',
    testResponsiveEmptyReferences,
);

const testGeneralCitationTemplate = () => {
    const source = [
        'Text.<ref>{{Citation|last=Ma|first=Anne|date=2020|title=Book|publisher=Publisher}}</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, generatedTemplateData);

    assert.match(result.text, /<ref name="Ma, 2020" \/>/u);
    assert.match(
        result.text,
        /\{\{Citation\n  \| last = Ma\n  \| first = Anne/u,
    );
    assert.equal(result.citationsFormatted, 1);
    assert.equal(result.referencesNotFormatted, 0);
};
test('formats the general Citation template', testGeneralCitationTemplate);

const testReflistColumnWidthRemoval = () => {
    const source =
        'Text.<ref>{{cite web|title=Example|publisher=Site}}</ref>\n{{reflist|20em}}';
    const result = formatCitationWikitext(source, templateData);

    assert.match(
        result.text,
        /<references responsive>\n\n<!-- -+ § 0 {4}Lead -+ -->\n\n<ref name="Site, n\.d\.">/u,
    );
    assert.doesNotMatch(result.text, /\{\{reflist/iu);
    assert.doesNotMatch(result.text, /20em/u);
};
test(
    'replaces reflist and ignores positional column widths',
    testReflistColumnWidthRemoval,
);

const testGroupedReflistReplacement = () => {
    const source = [
        'Text.<ref group="note">{{cite web|author=Site|date=2020|title=Example}}</ref>',
        '{{Reflist|group=note|30em|colwidth=20em}}',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(
        result.text,
        /<references group="note" responsive>\n\n<!-- -+ § 0 {4}Lead -+ -->/u,
    );
    assert.doesNotMatch(result.text, /\{\{reflist|30em|colwidth/iu);
};
test(
    'replaces grouped parameterized reflists with references tags',
    testGroupedReflistReplacement,
);

const testReferenceGroupPairing = () => {
    const source = [
        'Text.<ref group=note>{{cite web|title=X|publisher=Site|date=2020}}</ref>',
        '<references group="note" />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(result.text, /<ref name="Site, 2020" group="note" \/>/u);
    assert.match(result.text, /<references group="note" responsive>/u);
    assert.doesNotMatch(
        result.text,
        /<references group="note" responsive>\n<ref[^>]+group=/u,
    );
};
test(
    'keeps reference groups paired with their list',
    testReferenceGroupPairing,
);

const testDefinitionSectionGrouping = () => {
    const source = [
        'Lead.<ref>{{cite web|author=Lead|date=2020|title=Lead source}}</ref>',
        '== Gameplay ==',
        'Text.<ref name="used" />',
        '== References ==',
        '<references>',
        '<ref name="used">{{cite web|author=Used|date=2021|title=Used source}}</ref>',
        '<ref name="unused">{{cite web|author=Unused|date=2022|title=Unused source}}</ref>',
        '</references>',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    const lead = result.text.indexOf('§ 0    Lead');
    const gameplay = result.text.indexOf('§ 1    Gameplay');
    const unused = result.text.indexOf('§ A Unused references');
    assert.ok(lead < gameplay);
    assert.ok(gameplay < unused);
    assert.match(
        result.text,
        /§ 1 {4}Gameplay -+ -->\n\n<ref name="Used, 2021">/u,
    );
    assert.match(
        result.text,
        /§ A Unused references -+ -->\n\n<ref name="Unused, 2022">/u,
    );
    assertReferenceMarker(result.text, '§ 1    Gameplay');
};
test(
    'groups definitions by lead, article section, and unused status',
    testDefinitionSectionGrouping,
);

const testLeadSectionCommentWithoutReference = () => {
    const source = [
        'Lead without a reference.',
        '== 內容 ==',
        'Text.<ref name="content" />',
        '== 製作 ==',
        'Text.<ref name="production" />',
        '== 評測 ==',
        'Text.<ref name="reviews" />',
        '== 參考文獻 ==',
        '<references>',
        '<ref name="content">{{cite web|author=Content|date=2020|title=Content source}}</ref>',
        '<ref name="production">{{cite web|author=Production|date=2021|title=Production source}}</ref>',
        '<ref name="reviews">{{cite web|author=Reviews|date=2022|title=Reviews source}}</ref>',
        '</references>',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(
        result.text,
        /<references responsive>\n\n<!-- -+ § 1 {4}內容 -+ -->\n\n<ref name="Content, 2020">/u,
    );
    assert.match(
        result.text,
        /§ 2 {4}製作 -+ -->\n\n<ref name="Production, 2021">/u,
    );
    assert.match(
        result.text,
        /§ 3 {4}評測 -+ -->\n\n<ref name="Reviews, 2022">/u,
    );
    assertReferenceMarker(result.text, '§ 1    內容');
    assertReferenceMarker(result.text, '§ 2    製作');
    assertReferenceMarker(result.text, '§ 3    評測');
    assert.doesNotMatch(result.text, /§ 0 {4}Lead/u);
};
test(
    'emits section comments when the lead has no reference',
    testLeadSectionCommentWithoutReference,
);

const testHierarchicalSectionMarkers = () => {
    const source = [
        '== Part ==',
        '=== Chapter 1 ===',
        '=== Chapter 2 ===',
        '=== Chapter 3 ===',
        '=== Chapter 4 ===',
        '==== Date 1 ====',
        '==== Date 2 ====',
        '==== Date 3 ====',
        '==== Date 4 ====',
        '==== 10月25日 ====',
        'Text.<ref>{{cite web|author=Ma|date=2020|title=Combat}}</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);
    assertReferenceMarker(result.text, '§ 1.4.5    10月25日');
};
test('uses hierarchical section markers', testHierarchicalSectionMarkers);

const testAdjacentDefinitions = () => {
    const source = [
        'A.<ref>{{cite web|author=First|date=2020|title=First}}</ref>',
        'B.<ref>{{cite web|author=Second|date=2021|title=Second}}</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(result.text, /<\/ref>\n<ref name="Second, 2021">/u);
};
test(
    'places adjacent definitions on consecutive lines',
    testAdjacentDefinitions,
);

test('optionally separates three full definitions with exactly one blank line in either layout', () => {
    const source = [
        'A.<ref>{{cite web|author=First|date=2020|title=First}}</ref>',
        'B.<ref>{{cite web|author=Second|date=2021|title=Second}}</ref>',
        'C.<ref>{{cite web|author=Third|date=2022|title=Third}}</ref>',
        '<references />',
    ].join('\n');
    for (const layout of ['inline', 'block'] as const) {
        const defaultResult = formatCitationWikitext(
            source,
            templateData,
            layout,
        );
        const disabledResult = formatCitationWikitext(
            source,
            templateData,
            layout,
            'Lead',
            englishTemplateNames,
            false,
        );
        const enabledResult = formatCitationWikitext(
            source,
            templateData,
            layout,
            'Lead',
            englishTemplateNames,
            true,
        );
        assert.equal(disabledResult.text, defaultResult.text);
        assert.deepEqual(
            [...defaultResult.text.matchAll(/<\/ref>(\n+)<ref name=/gu)].map(
                (match) => match[1],
            ),
            ['\n', '\n'],
        );
        assert.deepEqual(
            [...enabledResult.text.matchAll(/<\/ref>(\n+)<ref name=/gu)].map(
                (match) => match[1],
            ),
            ['\n\n', '\n\n'],
        );
        assert.equal(enabledResult.citationsFormatted, 3);
        assert.equal(
            formatCitationWikitext(
                enabledResult.text,
                templateData,
                layout,
                'Lead',
                englishTemplateNames,
                true,
            ).text,
            enabledResult.text,
        );
        assert.equal(
            formatCitationWikitext(
                enabledResult.text,
                templateData,
                layout,
                'Lead',
                englishTemplateNames,
                false,
            ).text,
            defaultResult.text,
        );
    }
});

test('separates definitions in existing and appended group containers', () => {
    const source = [
        'A.<ref>{{cite web|author=First|date=2020|title=First}}</ref>',
        'B.<ref>{{cite web|author=Second|date=2021|title=Second}}</ref>',
        'Note A.<ref group="note">{{cite web|author=Note First|date=2022|title=Note first}}</ref>',
        'Note B.<ref group="note">{{cite web|author=Note Second|date=2023|title=Note second}}</ref>',
        '<references />',
    ].join('\n');
    for (const layout of ['inline', 'block'] as const) {
        const result = formatCitationWikitext(
            source,
            templateData,
            layout,
            'Lead',
            englishTemplateNames,
            true,
        );
        assert.equal(result.text.match(/<references\b/gu)?.length, 2);
        assert.match(result.text, /<references group="note" responsive>/u);
        assert.match(result.text, /<\/ref>\n\n<ref name="Second, 2021">/u);
        assert.match(result.text, /<\/ref>\n\n<ref name="Note Second, 2023">/u);
        assert.match(
            result.text,
            /Note A\.<ref name="Note First, 2022" group="note" \/>/u,
        );
        assert.equal(
            formatCitationWikitext(
                result.text,
                templateData,
                layout,
                'Lead',
                englishTemplateNames,
                true,
            ).text,
            result.text,
        );
    }
});

test('definition spacing preserves section banners, comments, protected text, and reference calls', () => {
    const protectedText = [
        '<nowiki><ref name="Protected first">First</ref>',
        '<ref name="Protected second">Second</ref></nowiki>',
        '<!-- <ref name="Hidden first">First</ref>',
        '<ref name="Hidden second">Second</ref> -->',
    ].join('\n');
    const comment = '<!-- Keep this general reference comment. -->';
    const source = [
        protectedText,
        'A.<ref name="First" /> B.<ref name="Second" /> C.<ref name="Third" />',
        '== Later ==',
        'D.<ref name="Fourth" />',
        '<references>',
        comment,
        '<ref name="First">{{cite web|author=First|date=2020|title=First}}</ref>',
        '<ref name="Second">{{cite web|author=Second|date=2021|title=Second}}</ref>',
        '<ref name="Third">{{cite web|author=Third|date=2022|title=Third}}</ref>',
        '<ref name="Fourth">{{cite web|author=Fourth|date=2023|title=Fourth}}</ref>',
        '</references>',
    ].join('\n');
    for (const layout of ['inline', 'block'] as const) {
        const disabled = formatCitationWikitext(source, templateData, layout);
        const enabled = formatCitationWikitext(
            source,
            templateData,
            layout,
            'Lead',
            englishTemplateNames,
            true,
        );
        const expected = disabled.text
            .replace(
                '</ref>\n<ref name="Second, 2021">',
                '</ref>\n\n<ref name="Second, 2021">',
            )
            .replace(
                '</ref>\n<ref name="Third, 2022">',
                '</ref>\n\n<ref name="Third, 2022">',
            );
        assert.equal(enabled.text, expected);
        assert.ok(enabled.text.includes(protectedText));
        assert.ok(enabled.text.includes(`</references>\n${comment}`));
        assertReferenceMarker(enabled.text, '§ 0    Lead');
        assertReferenceMarker(enabled.text, '§ 1    Later');
        assert.equal(
            formatCitationWikitext(
                enabled.text,
                templateData,
                layout,
                'Lead',
                englishTemplateNames,
                true,
            ).text,
            enabled.text,
        );
    }
});

const testMultipleWholeReferenceCitations = () => {
    const source = [
        'Text.<ref>',
        '{{cite web|last=Taylor|first=John Michael|last2=Neimeyer|date=2015|title=First}}',
        '{{cite book|last=Taylor|first=Tom|date=2014|title=Second|page=4}}',
        '</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(
        result.text,
        /name="J\. M\. Taylor &amp; Neimeyer, 2015; T\. Taylor, 2014, p\. 4"/u,
    );
    assert.match(
        result.text,
        /\{\{Unbulleted list citebundle\n  \| 1 = \{\{Cite web\n/u,
    );
    assert.match(result.text, /\n  \| 2 = \{\{Cite book\n/u);
    assert.match(result.text, /\n      \| last = Taylor/u);

    const inline = formatCitationWikitext(source, templateData, 'inline').text;
    assert.match(
        inline,
        /\{\{Unbulleted list citebundle\n  \| 1 = \{\{Cite web \|/u,
    );
    assert.match(inline, /\n  \| 2 = \{\{Cite book \|/u);
    assert.doesNotMatch(inline, /\{\{Cite (?:web|book)\n/u);
};
test(
    'bundles multiple whole-ref citations with multiline inner templates',
    testMultipleWholeReferenceCitations,
);

const testRInvocationConversion = () => {
    const openTemplate = '{' + '{';
    const source = [
        'Text ',
        openTemplate,
        'r|old}}.\n<references>',
        openTemplate,
        'r|name=old|r=',
        openTemplate,
        'cite web|last=Ma|date=2006|title=X}}}}</references>',
    ].join('');
    const result = formatCitationWikitext(source, templateData);

    assert.match(result.text, /Text <ref name="Ma, 2006" \/>\./u);
    assert.doesNotMatch(result.text, /\{\{r\|/u);
    assert.equal(result.individualReferencesFound, 1);
    assert.equal(result.referenceCallsFound, 1);
    assert.equal(result.referenceTagsRenamed, 2);
    assert.equal(result.rTemplatesFound, 1);
};
test('converts r invocations and definitions', testRInvocationConversion);

test('keeps the Arch Linux indexed zhwiki page on its reference', () => {
    const source = [
        'Arch began{{r|distrowatch_20030803|Dieguez_Castro_2016|p2=235}}.',
        '<references>',
        '<ref name="distrowatch_20030803">{{cite web|last=Vinet|' +
            'date=2003|title=Interview}}</ref>',
        '<ref name="Dieguez_Castro_2016">{{cite book|' +
            'last=Dieguez Castro|date=2016|title=Introducing Linux}}</ref>',
        '</references>',
    ].join('\n');
    const result = formatCitationWikitext(
        source,
        templateData,
        'inline',
        'Lead',
        chineseTemplateNames,
    );

    assert.match(
        result.text,
        /Arch began<ref name="Vinet, 2003" \/><ref name="Dieguez Castro, 2016" \/>\{\{rp\|235\}\}\./u,
    );
    assert.equal(result.rTemplatesFound, 1);
    const repeated = formatCitationWikitext(
        result.text,
        templateData,
        'inline',
        'Lead',
        chineseTemplateNames,
    );
    assert.equal(repeated.text, result.text);
});

test('uses zhwiki locator and quote aliases for each bundled reference', () => {
    const source = [
        'Text{{r|one|p=24|two|page2=12|quote2=Line {{lang|de|A=B}}|' +
            'three|pp3=21–22}}.',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(
        source,
        {},
        'inline',
        'Lead',
        chineseTemplateNames,
    );

    assert.match(
        result.text,
        /<ref name="one" \/>\{\{rp\|24\}\}<ref name="two" \/>\{\{rp\|12\|quote=Line \{\{lang\|de\|A=B\}\}\}\}<ref name="three" \/>\{\{rp\|21–22\}\}/u,
    );
});

test('preserves a zhwiki R call with a reference gap', () => {
    const source = 'Text{{r|one||three|p3=30}}.\n<references />';
    const result = formatCitationWikitext(
        source,
        {},
        'inline',
        'Lead',
        chineseTemplateNames,
    );

    assert.ok(result.text.includes('{{r|one||three|p3=30}}'));
    assert.equal(result.rTemplatesFound, 0);
});

test('keeps enwiki singular and plural R locators distinct', () => {
    const source = [
        'Text{{r|n1=one|n2=two|page1=100|pages2=10–14|' +
            'q1=Palabras|language1=Spanish|translation1=Words}}.',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(
        source,
        {},
        'inline',
        'Lead',
        englishTemplateNames,
    );

    assert.match(
        result.text,
        /<ref name="one" \/>\{\{rp\|p=100\|quote=Palabras\|language=Spanish\|translation=Words\}\}<ref name="two" \/>\{\{rp\|pp=10–14\}\}/u,
    );
});

test('preserves an enwiki R call with a reference gap', () => {
    const source = 'Text{{r|n1=one|n3=three|page3=30}}.\n<references />';
    const result = formatCitationWikitext(
        source,
        {},
        'inline',
        'Lead',
        englishTemplateNames,
    );

    assert.ok(result.text.includes('{{r|n1=one|n3=three|page3=30}}'));
    assert.equal(result.rTemplatesFound, 0);
});

test('keeps unsupported enwiki R anchor parameters intact', () => {
    const source = [
        'Text{{r|name=A&B|ref=CITEREFSmith|p=5}}.',
        '<references><ref name="A&amp;B">' +
            '{{cite web|last=Ma|date=2006|title=X}}</ref></references>',
    ].join('\n');
    const result = formatCitationWikitext(
        source,
        templateData,
        'inline',
        'Lead',
        englishTemplateNames,
    );

    assert.ok(result.text.includes('{{r|name=A&B|ref=CITEREFSmith|p=5}}'));
    assert.match(result.text, /<ref name="A&amp;B">\{\{Cite web /u);
    assert.equal(result.rTemplatesFound, 0);
});

test('converts an unnamed enwiki R definition with its annotations', () => {
    const source = [
        'Text{{r|r={{cite web|last=Ma|date=2006|title=X}}|' +
            'p=44|quote=Quoted text}}.',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(
        source,
        templateData,
        'inline',
        'Lead',
        englishTemplateNames,
    );

    assert.match(
        result.text,
        /Text<ref name="Ma, 2006" \/>\{\{rp\|p=44\|quote=Quoted text\}\}\./u,
    );
});

test('uses an explicit zhwiki Rp position for equals-sign locators', () => {
    const source = [
        'Text{{r|one|p=https://example.test/?part=2}}.',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(
        source,
        {},
        'inline',
        'Lead',
        chineseTemplateNames,
    );

    assert.match(
        result.text,
        /<ref name="one" \/>\{\{rp\|1=https:\/\/example\.test\/\?part=2\}\}/u,
    );
});

test('converts and renames an R call nested in Efn', () => {
    const source = [
        'Text{{efn|Nested{{r|old|p=5}}.}}.',
        '<references><ref name="old">' +
            '{{cite web|last=Ma|date=2006|title=X}}</ref></references>',
    ].join('\n');
    const result = formatCitationWikitext(
        source,
        templateData,
        'inline',
        'Lead',
        chineseTemplateNames,
    );

    assert.ok(
        result.text.includes('{{efn|Nested<ref name="Ma, 2006" />{{rp|5}}.}}'),
    );
    assert.equal(result.rTemplatesFound, 1);
});

test('keeps R calls on unconfigured wikis intact', () => {
    const otherWikiTemplateNames = createTemplateNameContext({
        databaseName: 'examplewiki',
        namespaceIds: { template: 10 },
        namespacePrefixes: { 10: ['Template'] },
    });
    const source = 'Text{{r|one|p=5}}.\n<references />';
    const result = formatCitationWikitext(
        source,
        {},
        'inline',
        'Lead',
        otherWikiTemplateNames,
    );

    assert.ok(result.text.includes('{{r|one|p=5}}'));
    assert.equal(result.rTemplatesFound, 0);
});

test('keeps enwiki R definition page and quote annotations', () => {
    const source = [
        'Text{{r|name=old|r={{cite web|last=Ma|date=2006|title=X}}|' +
            'p=44|quote=Quoted text}}.',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(
        source,
        templateData,
        'inline',
        'Lead',
        englishTemplateNames,
    );

    assert.match(
        result.text,
        /Text<ref name="Ma, 2006" \/>\{\{rp\|p=44\|quote=Quoted text\}\}\./u,
    );
    assert.match(
        result.text,
        /<ref name="Ma, 2006">\{\{Cite web \| author = Ma \| date = 2006 \| title = X \}\}<\/ref>/u,
    );
});

const testRepeatedReferenceCounts = () => {
    const source = [
        'A.<ref name="source">{{cite web|author=Ma|date=2020|title=X}}</ref>',
        'B.<ref name="source" />',
        'C.{{r|source}}',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.equal(result.individualReferencesFound, 1);
    assert.equal(result.referenceCallsFound, 3);
    assert.equal(result.referenceTagsRenamed, 3);
    assert.equal(result.rTemplatesFound, 1);
    assert.equal(
        formatCitationWikitext(result.text, templateData).referenceTagsRenamed,
        0,
    );
};
test(
    'counts individual references separately from repeated call tags',
    testRepeatedReferenceCounts,
);

test('does not count already-correct ref names as renamed', () => {
    const source = [
        'A.<ref name="Ma, 2020">{{cite web|author=Ma|date=2020|title=X}}</ref>',
        'B.<ref name="Ma, 2020" />',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.equal(result.referenceTagsRenamed, 0);
});

const testIncompleteAuthorAliases = () => {
    const source = [
        'Text.<ref>{{cite interview|author1=Horii &amp; Hayasaka|author2=Editor|date=2025|title=Interview}}</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, generatedTemplateData);

    assert.match(result.text, /\| author1 = Horii &amp; Hayasaka/u);
    assert.match(result.text, /\| author2 = Editor/u);
    assert.match(
        result.text,
        /<ref name="Horii &amp; Hayasaka &amp; Editor, 2025"/u,
    );
    assert.doesNotMatch(result.text, /name="[^"]*&amp;amp;/u);
};
test(
    'normalizes incomplete author aliases and keeps ref ampersands literal',
    testIncompleteAuthorAliases,
);

const testInterviewSubjectOrdering = () => {
    const source = [
        'Text.<ref>{{cite interview',
        '|author1=堀井雄二<!-- # Horii, Yūji -->',
        '|interviewer=大出綾太<!-- # Ōde, Ryōta -->',
        '|title=ドラゴンクエストI&II 公式ガイドブック【HD-2D版】',
        '|author2=早坂将昭<!-- # Hayasaka, Masaaki -->',
        '|publisher=スクウェア・エニックス',
        '|date=2025-11-27',
        '|pages=488—492',
        '|language=ja',
        '|isbn=978-4-301-00084-6',
        '|chapter=堀井雄二×早坂將昭 スペシャル対談}}</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, generatedTemplateData);

    const author1 = result.text.indexOf('| author1 =');
    const interviewer = result.text.indexOf('| interviewer =');
    const title = result.text.indexOf('| title =');
    const author2 = result.text.indexOf('| author2 =');
    assert.ok(author1 < author2);
    assert.ok(author2 < interviewer);
    assert.ok(interviewer < title);
    const authorMatches = result.text.match(/\| author\d =/gu);
    const firstAuthors = authorMatches?.slice(0, 2);
    assert.deepEqual(firstAuthors, ['| author1 =', '| author2 =']);
    assert.match(result.text, /<ref name="Horii &amp; Hayasaka, 2025"/u);
};
test(
    'keeps Cite interview subjects together before its other fields',
    testInterviewSubjectOrdering,
);

const testInterviewEditorFallbackOrdering = () => {
    const source = [
        'Text.<ref>{{cite interview',
        '|last=Hayasaka|first=Masaaki',
        '|title="A happy accident" — Dragon Quest I & II HD-2D Remake',
        '|url=https://example.test/interview',
        '|access-date=2026-04-07',
        '|work=RPG Site',
        '|date=2025-11-06',
        '|language=en',
        '|editor-last=Madnani|editor-first=Mikhail}}</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, generatedTemplateData);

    const editorLast = result.text.indexOf('| editor-last =');
    const editorFirst = result.text.indexOf('| editor-first =');
    const title = result.text.indexOf('| title =');
    assert.ok(editorLast < editorFirst);
    assert.ok(title < editorLast);
    assert.match(result.text, /<ref name="Hayasaka, 2025"/u);
};
test(
    'places Cite interview fallback editors after defined fields',
    testInterviewEditorFallbackOrdering,
);

const testYearSuffixAssignment = () => {
    const source = [
        'A<ref>{{cite web|last=Ma|date=2006|title=First|page=1}}</ref>',
        'B<ref>{{cite web|last=Ma|date=2006|title=Second|page=2}}</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(result.text, /name="Ma, 2006a"/u);
    assert.match(result.text, /name="Ma, 2006b"/u);
    assert.doesNotMatch(result.text, /name="Ma, 2006[ab], p\./u);
};
test(
    'adds year suffixes for distinct works in source order',
    testYearSuffixAssignment,
);

const testNoDateSuffixHyphenation = () => {
    const source = [
        'A<ref>{{cite web|last=Ma|title=First}}</ref>',
        'B<ref>{{cite web|last=Ma|title=Second}}</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(result.text, /name="Ma, n\.d\.-a"/u);
    assert.match(result.text, /name="Ma, n\.d\.-b"/u);
};
test(
    'hyphenates no-date suffixes for distinct works',
    testNoDateSuffixHyphenation,
);

const testSameSourceLocatorUsage = () => {
    const source = [
        'A<ref>{{cite book|last=Ma|date=2006|title=Book|page=59}}</ref>',
        'B<ref>{{cite book|last=Ma|date=2006|title=Book|page=60}}</ref>',
        'C<ref>{{cite web|last=Li|date=2020|title=Video|time=12:30}}</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(result.text, /name="Ma, 2006, p\. 59"/u);
    assert.match(result.text, /name="Ma, 2006, p\. 60"/u);
    assert.match(result.text, /name="Li, 2020"/u);
    assert.doesNotMatch(result.text, /name="Li, 2020, at time/u);
    assert.doesNotMatch(result.text, /2006a/u);
};
test(
    'uses locators only for multiple parts of the same source',
    testSameSourceLocatorUsage,
);

const testSourceIdentityAcrossParts = () => {
    const source = [
        'A<ref>{{cite web|last=Ma|date=2006|title=Book|url=https://example.test/book#one|pages=1-2}}</ref>',
        'B<ref>{{cite web|last=Ma|date=2006|title=Book|url=https://example.test/book#two|chapter=Second}}</ref>',
        'C<ref>{{cite web|last=Li|date=2020|title=Video|url=https://www.youtube.com/watch?v=abc&t=1m|time=1:00}}</ref>',
        'D<ref>{{cite web|last=Li|date=2020|title=Video|url=https://www.youtube.com/watch?start=120&v=abc|time=2:00}}</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(result.text, /name="Ma, 2006, pp\. 1-2"/u);
    assert.match(result.text, /name="Ma, 2006, chapter Second"/u);
    assert.match(result.text, /name="Li, 2020, at time 1:00"/u);
    assert.match(result.text, /name="Li, 2020, at time 2:00"/u);
    assert.doesNotMatch(result.text, /Ma, 2006[ab]/u);
    assert.doesNotMatch(result.text, /Li, 2020[ab]/u);
};
test(
    'matches source identity across parts and position URLs',
    testSourceIdentityAcrossParts,
);

const testManualSourceIdentity = () => {
    const source = buildPaginatedInterviewSource();
    const result = formatCitationWikitext(source, generatedTemplateData);
    const rerun = formatCitationWikitext(result.text, generatedTemplateData);

    assert.match(result.text, /name="Shinji &amp; Hiroya, 2006, p\. 1"/u);
    assert.match(result.text, /name="Shinji &amp; Hiroya, 2006, p\. 2"/u);
    assert.doesNotMatch(result.text, /Shinji & Hiroya, 2006[ab]/u);
    assert.match(result.text, /751888p1\.html/u);
    assert.match(result.text, /751888p2\.html/u);
    assert.equal(
        result.text.split('https://xbox360.ign.com/articles/751/751888.html')
            .length - 1,
        2,
    );
    assert.equal(rerun.text, result.text);
};
test(
    'groups manually keyed page URLs as parts of one source',
    testManualSourceIdentity,
);

test('uses an unmarked base URL for keyed continuation pages', () => {
    const base =
        'https://nlab.itmedia.co.jp/games/articles/0706/18/news007.html';
    const continuation =
        'https://nlab.itmedia.co.jp/games/articles/0706/18/news007_2.html';
    const source = [
        'A<ref>{{cite web|author=nlab|date=2007|title=Feature|' +
            `url=${base}|at=Part 1}}</ref>`,
        'B<ref>{{cite web|author=nlab|date=2007|title=Feature continued|' +
            `url=${continuation}<!-- # ${base} -->|at=Part 2}}</ref>`,
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, generatedTemplateData);

    assert.match(result.text, /name="nlab, 2007, Part 1"/u);
    assert.match(result.text, /name="nlab, 2007, Part 2"/u);
    assert.doesNotMatch(result.text, /nlab, 2007[ab]/u);
    assert.match(result.text, /news007\.html/u);
    assert.match(result.text, /news007_2\.html/u);
});

function buildPaginatedInterviewSource(): string {
    const key = 'https://xbox360.ign.com/articles/751/751888.html';
    const first = [
        '{{cite interview|last1=Shinji|first1=Noguchi',
        '|author2=Hiroya|fisrt2=Hatsushiba',
        '|title=Eternal Sonata Interview',
        '|url=https://xbox360.ign.com/articles/751/751888p1.html',
        `<!-- # ${key} -->|work=[[IGN]]|date=2006-12-20|page=1}}`,
    ].join('');
    const second = [
        '{{cite interview|last1=Shinji|first1=Noguchi',
        '|last2=Hiroya|first2=Hatsushiba',
        '|title=Eternal Sonata Interview',
        '|url=http://xbox360.ign.com/articles/751/751888p2.html',
        `<!-- # ${key} -->|work=IGN|date=2006-12-20|page=2}}`,
    ].join('');
    return [
        `A<ref>${first}</ref>`,
        `B<ref>${second}</ref>`,
        '<references />',
    ].join('\n');
}

const testSimilarTitleSourceSeparation = () => {
    const source = [
        'A<ref>{{cite web|last=Ma|date=2006|title=Report|url=https://one.test/report}}</ref>',
        'B<ref>{{cite web|last=Ma|date=2006|title=Report|url=https://two.test/report}}</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(result.text, /name="Ma, 2006a"/u);
    assert.match(result.text, /name="Ma, 2006b"/u);
};
test(
    'keeps different sources with similar titles separate',
    testSimilarTitleSourceSeparation,
);

const testTweetFormatting = () => {
    const source = [
        'Text.<ref>{{cite tweet|user=Pigsonthewing|number=564068436633214977|author=Andy Mabbett|date=February 7, 2015|title=Example tweet}}</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(
        source,
        generatedTemplateData,
        'block',
        'Lead',
        undefined,
        false,
        resolveWikiPolicy('enwiki'),
    );

    assert.match(result.text, /<ref name="Andy Mabbett, 2015" \/>/u);
    const number = result.text.indexOf('| number =');
    const user = result.text.indexOf('| user =');
    const title = result.text.indexOf('| title =');
    const author = result.text.indexOf('| author =');
    assert.ok(number < user);
    assert.ok(user < title);
    assert.ok(title < author);
    assert.match(result.text, /\| date = 2015-02-07/u);
    assert.match(result.text, /<\/ref>\n\n<\/references>/u);
};
test(
    'formats cite tweet and leaves a blank line before references closes',
    testTweetFormatting,
);

const testNumericPlainReferenceFallbacks = () => {
    const source = [
        'A<ref>Plain note</ref>',
        'B<ref>See {{cite web|title=Nested}}</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(result.text, /A<ref name=":1" \/>/u);
    assert.match(result.text, /B<ref name=":2" \/>/u);
    assert.match(result.text, /<ref name=":1">Plain note<\/ref>/u);
    assert.match(result.text, /<ref name=":2">See \{\{Cite web/u);
    assert.equal(result.referencesNotFormatted, 1);
    assert.equal(result.citationsFormatted, 1);
};
test(
    'formats mixed citation notes and numbers identity-free references',
    testNumericPlainReferenceFallbacks,
);

test('formats a citation before trailing prose in a named reference', () => {
    const source = [
        'Review.<ref name=GProPS>{{cite magazine' +
            '|author=Scary Larry' +
            '|title=PlayStation ProReview: PaRappa the Rappa' +
            '|date=November 1997' +
            '|magazine=[[GamePro]]' +
            '|issue=110' +
            '|page=148}} Full review appears only in printed version.</ref>',
        "Plain.<ref>''Computer and Video Games'' issue 193, page 17, " +
            'EMAP Images, December 1997</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, generatedTemplateData);

    assert.equal(result.citationsFormatted, 1);
    assert.equal(result.referencesNotFormatted, 1);
    assert.match(result.text, /<ref name="GProPS">\{\{Cite magazine/u);
    assert.match(
        result.text,
        /\}\} Full review appears only in printed version\.<\/ref>/u,
    );
});

test('formats every whole Cite-prefixed template without CS1 assumptions', () => {
    const source = [
        'Guide.<ref>{{cite Fan Guide|Writer=First|issue=|Writer=Second}}</ref>',
        'Mixed.<ref>See {{cite fan guide|title=Nested}}</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.equal(result.citationsFormatted, 2);
    assert.equal(result.referencesNotFormatted, 0);
    assert.ok(
        result.text.includes(
            [
                '{{Cite Fan Guide',
                '  | Writer = First',
                '  | issue = ',
                '  | Writer = Second',
                '}}',
            ].join('\n'),
        ),
    );
    assert.match(result.text, /See \{\{Cite fan guide/u);
});

test('normalizes language names in metadata-free Cite templates', () => {
    const source =
        '<ref>{{cite comic|title=Issue|' + 'language=English,japanese}}</ref>';
    const result = formatCitationWikitext(source, templateData);

    assert.equal(result.citationsFormatted, 1);
    assert.equal(result.referencesNotFormatted, 0);
    assert.match(result.text, /\| language = en, ja/u);
});

test('uses live generic TemplateData without dropping citation rows', () => {
    const source =
        '<ref>{{Cite Fan Guide|issue=|Writer=First|name=Story|' +
        'custom=Value|date=January 2, 2025}}</ref>';
    const runtimeData: CitationTemplateDataMap = {
        ...templateData,
        'Cite Fan Guide': {
            aliases: {
                issue: [],
                title: ['name'],
                writer: ['Writer'],
            },
            canonicalName: 'Cite Fan Guide',
            paramOrder: ['title', 'writer', 'issue'],
        },
    };
    const result = formatCitationWikitext(source, runtimeData);

    assert.equal(result.citationsFormatted, 1);
    assert.equal(result.referencesNotFormatted, 0);
    assert.ok(
        result.text.includes(
            [
                '{{Cite Fan Guide',
                '  | title = Story',
                '  | writer = First',
                '  | issue = ',
                '  | custom = Value',
                '  | date = January 2, 2025',
                '}}',
            ].join('\n'),
        ),
    );
});

test('canonicalizes generic aliases only when exact and collision-free', () => {
    const source =
        '<ref>{{Cite Fan Guide|name=Alias|title=Canonical|' +
        'TITLE=Upper|Writer=First|writer=Second}}</ref>';
    const runtimeData: CitationTemplateDataMap = {
        'Cite Fan Guide': {
            aliases: {
                title: ['name'],
                writer: ['Writer'],
            },
            canonicalName: 'Cite Fan Guide',
            paramOrder: ['title', 'writer'],
        },
    };
    const result = formatCitationWikitext(source, runtimeData, 'inline');

    assert.ok(
        result.text.includes(
            '{{Cite Fan Guide | name = Alias | title = Canonical | ' +
                'Writer = First | writer = Second | TITLE = Upper }}',
        ),
    );
});

test('ignores structurally unsafe generic metadata', () => {
    const source = '<ref>{{Cite Fan Guide|name=Story}}</ref>';
    const runtimeData: CitationTemplateDataMap = {
        'Cite Fan Guide': {
            aliases: { 'title|injected': ['name'] },
            canonicalName: 'Cite Fan Guide}}Injected',
            paramOrder: ['title|injected'],
        },
    };
    const result = formatCitationWikitext(source, runtimeData, 'inline');

    assert.ok(result.text.includes('{{Cite Fan Guide | name = Story }}'));
    assert.doesNotMatch(result.text, /Injected/u);
});

test('handles prototype-like generic parameter names', () => {
    const source = '<ref>{{Cite Fan Guide|constructor=Value}}</ref>';
    const runtimeData: CitationTemplateDataMap = {
        'Cite Fan Guide': {
            aliases: {},
            canonicalName: 'Cite Fan Guide',
            paramOrder: ['constructor'],
        },
    };
    const result = formatCitationWikitext(source, runtimeData, 'inline');

    assert.ok(
        result.text.includes('{{Cite Fan Guide | constructor = Value }}'),
    );
});

test('preserves literal-tag pipes in generic citation values', () => {
    const source = '<ref>{{Cite foo|title=<nowiki>A|B</nowiki>|x=y}}</ref>';
    const result = formatCitationWikitext(source, templateData, 'inline');

    assert.ok(
        result.text.includes(
            '{{Cite foo | title = <nowiki>A|B</nowiki> | x = y }}',
        ),
    );
    assert.doesNotMatch(result.text, /1 = B/u);
});

test('preserves significant generic positional whitespace', () => {
    const source = '<ref>{{Cite foo|  padded  |x=y}}</ref>';
    const result = formatCitationWikitext(source, templateData, 'inline');

    assert.ok(result.text.includes('{{Cite foo|  padded  | x = y }}'));
    assert.doesNotMatch(result.text, /1 = padded/u);
});

test('keeps multiple generic citations out of CS1 cite bundles', () => {
    const source =
        '<ref>{{Cite Fan Guide|title=First}}' +
        '{{Cite Comic Extra|issue=Second}}</ref>';
    const result = formatCitationWikitext(source, templateData, 'inline');

    assert.equal(result.citationsFormatted, 1);
    assert.equal(result.referencesNotFormatted, 0);
    assert.ok(
        result.text.includes(
            '{{Cite Fan Guide | title = First }}' +
                '{{Cite Comic Extra | issue = Second }}',
        ),
    );
    assert.doesNotMatch(result.text, /citebundle/iu);
});

test('renames forward paired and self-closing uses as one named footnote', () => {
    const source = [
        '== First ==',
        '<ref name="Book"></ref><ref name="Book" details="p. 23" />',
        '== Second ==',
        '<ref name="Book">{{cite book|author=Ma|date=2020|title=Book}}</ref>',
        '<ref name="Book">{{cite book|author=Ma|date=2020|title=Book}}</ref>',
        '<references />',
    ].join('\n');
    const first = formatCitationWikitext(source, templateData, 'inline');

    assert.equal(first.individualReferencesFound, 1);
    assert.equal(first.referenceCallsFound, 4);
    assert.match(first.text, /<ref name="Ma, 2020" details="p\. 23" \/>/u);
    assert.equal(first.text.match(/<ref name="Ma, 2020">/gu)?.length, 1);
    assertReferenceMarker(first.text, '§ 1    First');
    assert.equal(
        formatCitationWikitext(first.text, templateData, 'inline').text,
        first.text,
    );
});

test('preserves conflicting full definitions under their original footnote name', () => {
    const firstDefinition =
        '<ref name="Book">{{cite book|author=First|title=First}}</ref>';
    const conflicting =
        '<ref name="Book">{{cite book|author=Second|title=Second}}</ref>';
    const source =
        '<ref name="Book" />' +
        firstDefinition +
        conflicting +
        '<references />';
    const result = formatCitationWikitext(source, templateData, 'inline');

    assert.ok(result.text.includes(firstDefinition));
    assert.ok(result.text.includes(conflicting));
    assert.ok(result.text.startsWith('<ref name="Book" />'));
    assert.equal(result.individualReferencesFound, 1);
    assert.equal(result.citationsFormatted, 0);
    assert.equal(result.referencesMoved, 0);
    assert.equal(
        formatCitationWikitext(result.text, templateData, 'inline').text,
        result.text,
    );
});

test('matches equivalent escaped footnote names and emits safe quoted uses', () => {
    const source =
        '<ref name="A&amp;B&quot;C" />' +
        "<ref name='A&B\"C'>Plain source.</ref><references />";
    const result = formatCitationWikitext(source, templateData, 'inline');

    assert.equal(result.individualReferencesFound, 1);
    assert.equal(result.referenceTagsRenamed, 0);
    assert.equal(
        result.text.match(/<ref name="A&amp;B&quot;C" \/>/gu)?.length,
        2,
    );
    assert.ok(
        result.text.includes('<ref name="A&amp;B&quot;C">Plain source.</ref>'),
    );
    assert.equal(
        formatCitationWikitext(result.text, templateData, 'inline').text,
        result.text,
    );
});

test('renames forward uses with equivalent numeric or named reference entities', () => {
    const cases = [
        ['A"B', 'A&#34;B'],
        ['A"B', 'A&#x22;B'],
        ["A'B", 'A&apos;B'],
        ['A<B>', 'A&lt;B&gt;'],
    ];
    for (const [literalName, encodedName] of cases) {
        const source =
            `<ref name="${literalName.replaceAll('"', '&quot;')}" />` +
            `<ref name="${encodedName}">{{cite book|author=Ma|date=2020|title=Book}}</ref><references />`;
        const result = formatCitationWikitext(source, templateData, 'inline');

        assert.equal(result.individualReferencesFound, 1);
        assert.equal(
            result.text.match(/<ref name="Ma, 2020" \/>/gu)?.length,
            2,
        );
        assert.equal(
            formatCitationWikitext(result.text, templateData, 'inline').text,
            result.text,
        );
    }
});

test('keeps literal entity names distinct from the characters they spell', () => {
    const source =
        '<ref name="A&amp;quot;B" /><ref name="A&amp;quot;B">Literal entity source.</ref>' +
        '<ref name="A&quot;B" /><ref name=\'A"B\'>Quoted source.</ref><references />';
    const result = formatCitationWikitext(source, templateData, 'inline');

    assert.equal(result.individualReferencesFound, 2);
    assert.equal(
        result.text.match(/<ref name="A&amp;quot;B" \/>/gu)?.length,
        2,
    );
    assert.ok(
        result.text.includes(
            '<ref name="A&amp;quot;B">Literal entity source.</ref>',
        ),
    );
    assert.ok(
        result.text.includes('<ref name="A&quot;B">Quoted source.</ref>'),
    );
    assert.equal(
        formatCitationWikitext(result.text, templateData, 'inline').text,
        result.text,
    );
});

test('keeps R templates and entities inside sub-reference details untouched', () => {
    const source =
        '<ref name="Book" details=\'{{r|Other}} &quot;quote&quot; &lt;page&gt; "literal"\' />' +
        '<ref name="Book">{{cite book|title=Book}}</ref><references />';
    const result = formatCitationWikitext(
        source,
        templateData,
        'inline',
        'Lead',
        englishTemplateNames,
    );

    assert.equal(result.rTemplatesFound, 0);
    assert.match(
        result.text,
        /details="\{\{r\|Other\}\} &quot;quote&quot; &lt;page&gt; &quot;literal&quot;"/u,
    );
    assert.equal(
        formatCitationWikitext(
            result.text,
            templateData,
            'inline',
            'Lead',
            englishTemplateNames,
        ).text,
        result.text,
    );
});

test('retains unsupported list details and reference attributes for Cite diagnostics', () => {
    const cases = [
        '<references><ref name="Book">body</ref><ref name="Book" details="p. 23" /></references>',
        '<references><ref name="Book" details="p. 23" /></references>',
        '<references><ref name="Book" details="p. 23">body</ref></references>',
        '<references><ref name="Book" dir="rtl">body</ref></references>',
        '<ref name="Book" /><references><ref name="Book">body</ref></references><references><ref name="Book" details="p. 23" /></references>',
        '<ref name="Book" /><references><ref name="Book">body</ref></references><references><ref name="Book" broken="attribute">body</ref></references>',
    ];
    for (const source of cases) {
        const result = formatCitationWikitext(source, templateData, 'inline');
        const attributeTag = source.match(
            /<ref[^>]*(?:details|dir|broken)=[^>]*>(?:body<\/ref>)?/u,
        )?.[0];
        assert.ok(attributeTag);
        assert.ok(result.text.includes(attributeTag));
        assert.equal(
            formatCitationWikitext(result.text, templateData, 'inline').text,
            result.text,
        );
    }
});

test('keeps directional definitions and follow references native', () => {
    const definition = '<ref name="Book" dir="rtl">Main source.</ref>';
    const follow = '<ref follow="Book">Additional text.</ref>';
    const source =
        definition + '<ref name="Book" />' + follow + '<references />';
    const result = formatCitationWikitext(source, templateData, 'inline');

    assert.ok(result.text.includes(definition));
    assert.ok(result.text.includes(follow));
    assert.equal(result.referencesMoved, 0);
});

test(
    'names CITEREF-linked short citations from their source identity',
    testLinkedShortCitation,
);

function testLinkedShortCitation(): void {
    const source = [
        'Short.<ref>[[#CITEREF_Ma_2006|Ma 2006]], p. 42</ref>',
        '{{cite web|last=Ma|date=2006|title=Book|ref=CITEREF Ma 2006}}',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(result.text, /<ref name="Ma, 2006, p\. 42" \/>/u);
    assert.match(
        result.text,
        /<ref name="Ma, 2006, p\. 42">\[\[#CITEREF_Ma_2006\|Ma 2006\]\], p\. 42<\/ref>/u,
    );
    assert.equal(result.citationsFormatted, 1);
    assert.equal(result.referencesNotFormatted, 0);
}

test(
    'cleans punctuation from CITEREF-linked citation locators',
    testColonLinkedShortCitation,
);

function testColonLinkedShortCitation(): void {
    const source = [
        'Short.<ref>[[#CITEREF_Ma_2006|Ma 2006]]: p. 42</ref>',
        '{{cite web|last=Ma|date=2006|title=Book|ref=CITEREF Ma 2006}}',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(result.text, /<ref name="Ma, 2006, p\. 42" \/>/u);
    assert.doesNotMatch(result.text, /name="Ma, 2006, :/u);
}

test(
    'names plain linked references from custom citation ref values',
    testCustomLinkedCitation,
);

function testCustomLinkedCitation(): void {
    const source = [
        'Short.<ref>[[#custom_ref|source]]: pp. 10–12</ref>',
        '{{cite web|last=Li|date=2020|title=Article|ref=Custom ref}}',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(result.text, /<ref name="Li, 2020, pp\. 10–12" \/>/u);
    assert.equal(result.citationsFormatted, 0);
    assert.equal(result.referencesNotFormatted, 1);
}

test(
    'ignores linked-citation sources in protected wikitext',
    testProtectedLinkedCitationSources,
);

function testProtectedLinkedCitationSources(): void {
    const source = [
        '<nowiki>{{cite web|last=Wrong|date=1999|title=Wrong|ref=Custom ref}}</nowiki>',
        '{{cite web|last=Li|date=2020|title=Article|ref=Custom ref}}',
        '{{cite web|last=Ma|date=2006|title=Book|ref=CITEREF Ma 2006}}',
        '<nowiki>{{cite web|last=Wrong|date=1999|title=Wrong|ref=CITEREF Ma 2006}}</nowiki>',
        'Custom.<ref>[[#custom_ref|source]], p. 10</ref>',
        'Short.<ref>[[#CITEREF_Ma_2006|Ma 2006]], p. 42</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(result.text, /<ref name="Li, 2020, p\. 10" \/>/u);
    assert.match(result.text, /<ref name="Ma, 2006, p\. 42" \/>/u);
    assert.doesNotMatch(result.text, /<ref name="Wrong, 1999/u);
}

test(
    'preserves existing names while numbering anonymous plain references',
    testPlainReferenceNames,
);

function testPlainReferenceNames(): void {
    const source = [
        'Named.<ref name=":1">Plain note</ref>',
        'Anonymous.<ref>Another note</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(result.text, /Named\.<ref name=":1" \/>/u);
    assert.match(result.text, /Anonymous\.<ref name=":2" \/>/u);
    assert.match(result.text, /<ref name=":1">Plain note<\/ref>/u);
    assert.match(result.text, /<ref name=":2">Another note<\/ref>/u);
}

const testCitationMaintenanceTemplates = () => {
    const source = [
        'A<ref>{{cite web|last=Haywald|first=Justin|date=October 30, 2016|title=Example}}{{cbignore}}</ref>',
        'B<ref>{{cite web|last=Reynolds|date=2024|title=Example}} {{Dead link|date=July 2026}}</ref>',
        '<references />',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(result.text, /<ref name="Haywald, 2016" \/>/u);
    assert.match(result.text, /<ref name="Reynolds, 2024" \/>/u);
    assert.match(result.text, /\}\}\{\{cbignore\}\}<\/ref>/u);
    assert.match(result.text, /\}\} \{\{Dead link\|date=July 2026\}\}<\/ref>/u);
    assert.equal(result.citationsFormatted, 2);
    assert.equal(result.referencesNotFormatted, 0);
};
test(
    'preserves citation maintenance templates with APA names',
    testCitationMaintenanceTemplates,
);

const testStablePlainNamesAndYearSuffixes = () => {
    const source = [
        '<ref name=":3" />',
        '<ref name="Ma, 2020b" />',
        '<ref name=":1" />',
        '<ref name="Ma, 2020a" />',
        '<ref name=":2" />',
        '<references>',
        '<ref name=":3">Third plain note</ref>',
        '<ref name="Ma, 2020b">{{cite web|last=Ma|date=2020|title=Second}}</ref>',
        '<ref name=":1">First plain note</ref>',
        '<ref name="Ma, 2020a">{{cite web|last=Ma|date=2020|title=First}}</ref>',
        '<ref name=":2">Second plain note</ref>',
        '</references>',
    ].join('\n');
    const first = formatCitationWikitext(source, templateData).text;
    const second = formatCitationWikitext(first, templateData).text;

    for (const text of [first, second]) {
        const matches = text.matchAll(/<ref name="([^"]+)">/gu);
        const names = Array.from(matches, (match) => match[1]);
        assert.deepEqual(names, [':3', 'Ma, 2020a', ':1', 'Ma, 2020b', ':2']);
    }
};
test(
    'preserves plain names and assigns year suffixes by first use on every run',
    testStablePlainNamesAndYearSuffixes,
);

const testStandaloneListCommentMovement = () => {
    const source = [
        'Text.<ref name="used" />',
        '{{Reflist|25em|refs=',
        '<ref name="used">{{cite web|author=Used|date=2020|title=Source}}</ref>',
        '<!--<ref name="disabled">{{cite web|title=Disabled}}</ref> -->',
        '}}',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);

    assert.match(
        result.text,
        /<\/references>\n<!--<ref name="disabled">\{\{cite web\|title=Disabled\}\}<\/ref> -->/u,
    );
    assert.doesNotMatch(
        result.text,
        /<!--<ref name="disabled">[\s\S]*?<\/references>/u,
    );
};
test(
    'moves standalone list comments after references',
    testStandaloneListCommentMovement,
);

const testProtectedReferenceParsing = () => {
    const source = [
        '<!-- <ref>{{cite web|title=Comment}}</ref> -->',
        '<nowiki><ref>{{cite web|title=Code}}</ref></nowiki>',
    ].join('\n');
    const result = formatCitationWikitext(source, templateData);
    assert.equal(result.text, source);
};
test(
    'does not parse refs in comments or nowiki blocks',
    testProtectedReferenceParsing,
);

test('parses ref content past protected closing-tag text', () => {
    const source = [
        'Text.<ref>{{cite web|last=Ma|date=2020' +
            '|title=Before <nowiki></ref></nowiki> After}}</ref>',
        '<references />',
    ].join('\n');

    const result = formatCitationWikitext(source, templateData);

    assert.equal(result.citationsFormatted, 1);
    assert.match(result.text, /<nowiki><\/ref><\/nowiki> After/u);
});

const testEarthBoundReferencePatterns = () => {
    const source = [
        'Lead.<ref>{{Cite web |title=Releases Section ' +
            '|url=https://www.nintendo.co.jp/n08/before/n2005_b01.html ' +
            '|access-date=2023-07-04 |website=www.nintendo.co.jp ' +
            '|archive-date=April 7, 2023}}</ref>',
        'Gameplay.<ref name="MotherEncyclopedia">' +
            '{{cite book |title=Mother Encyclopedia|date=1989 ' +
            '|publisher=[[Shogakukan]] |isbn=4-09-104114-0}}</ref>',
        'Plot.{{efn|Character note.<ref>{{cite video game' +
            '|title=[[Super Smash Bros. Brawl]]' +
            '|developer=[[Sora Ltd.]], [[Game Arts]]' +
            '|publisher=[[Nintendo]]|date=January 31, 2008' +
            '|platform=[[Wii]]}}</ref>}}',
        'Reuse.<ref name="nlife: profile"/>',
        '{{Reflist|25em|refs=',
        '<ref name="nlife: profile">{{cite news' +
            '|url=https://www.nintendolife.com/games/nes/mother' +
            '|title=Mother News|work=[[Nintendo Life]]' +
            '|date=December 21, 2009|last1=Life|first1=Nintendo}}</ref>',
        '<ref name="mixed">{{cite web|last=Itoi|date=2000' +
            '|title=Cancellation}}</ref> [https://example.test Translation]',
        '<!--<ref name="commented">{{cite web|title=Old}}</ref>-->',
        '}}',
    ].join('\n');
    const result = formatCitationWikitext(
        source,
        generatedTemplateData,
        'block',
        'Lead',
        undefined,
        false,
        resolveWikiPolicy('enwiki'),
    );

    assert.match(result.text, /name="www\.nintendo\.co\.jp, n\.d\."/u);
    assert.match(result.text, /\| archive-date = 2023-04-07/u);
    assert.match(result.text, /name="Shogakukan, 1989"/u);
    assert.match(result.text, /name="Sora Ltd\., Game Arts, 2008"/u);
    assert.match(result.text, /name="Life, 2009"/u);
    assert.match(result.text, /name="Itoi, 2000"/u);
    assert.match(result.text, /\[https:\/\/example\.test Translation\]/u);
    assert.match(result.text, leadReferenceMarker);
    assert.doesNotMatch(result.text, /\{\{reflist/iu);
    assert.doesNotMatch(result.text, /25em/u);
    assert.match(result.text, /<!--<ref name="commented">/u);
};
test(
    'formats EarthBound Beginnings article reference patterns',
    testEarthBoundReferencePatterns,
);

test(
    'formats Dragon Quest I and II draft citation patterns',
    testDragonQuestPatterns,
);

function testDragonQuestPatterns(): void {
    const source = buildDragonQuestSource();
    const result = formatCitationWikitext(source, generatedTemplateData);
    assertDragonQuestResult(result.text);
}

function buildDragonQuestSource(): string {
    const parts = [
        'Text.<ref name="Horii & Hayasaka, 2025a" />',
        'Text.<ref name="Horii & Hayasaka, 2025b" />',
        'Text.<ref name="Horii & Hayasaka, 2025c" />',
        'Text.<ref name="Khan, 2025" />',
        '<references>',
        '<ref name="Horii & Hayasaka, 2025a">{{Cite interview',
        '|title=発売記念特集 ドラゴンクエストI&II',
        '|author2=早坂将昭<!-- # Hayasaka, Masaaki -->',
        '|work=週刊ファミ通|date=2025-10-30|pages=16—21',
        '|author1=堀井雄二<!-- # Horii, Yūji -->}}</ref>',
        '<ref name="Horii & Hayasaka, 2025b">{{Cite interview',
        '|title=『ドラクエ1＆2』堀井雄二氏×早坂P対談をお届け。',
        '|author2=早坂将昭<!-- # Hayasaka, Masaaki -->',
        '|url=https://www.famitsu.com/article/202511/56367',
        '|work=ファミ通.com|date=2025-11-01',
        '|author1=堀井雄二<!-- # Horii, Yūji -->}}</ref>',
        '<ref name="Horii & Hayasaka, 2025c">{{Cite interview',
        '|title=ドラゴンクエストI&II 公式ガイドブック【HD-2D版】',
        '|author2=早坂将昭<!-- # Hayasaka, Masaaki -->',
        '|publisher=スクウェア・エニックス|date=2025-11-27',
        '|pages=488—492|author1=堀井雄二<!-- # Horii, Yūji -->',
        '|isbn=978-4-301-00084-6|chapter=スペシャル対談}}</ref>',
        '<ref name="Khan, 2025">{{Cite web|last=Khan|first=Zubi',
        '|date=2025-10-29|title=Dragon Quest review',
        '|url=https://example.test/review|dead-url=no}}</ref>',
        '</references>',
    ];
    return parts.join('\n');
}

function assertDragonQuestResult(text: string): void {
    assert.match(text, /<ref name="Horii &amp; Hayasaka, 2025a" \/>/u);
    assert.match(text, /<ref name="Horii &amp; Hayasaka, 2025b" \/>/u);
    assert.match(text, /<ref name="Horii &amp; Hayasaka, 2025c" \/>/u);
    assert.match(text, /\| url-status = live/u);
    assert.doesNotMatch(text, /\| dead-url =/u);
    assert.match(text, /<\/ref>\n\n<\/references>/u);
}

const VIDEO_TIMES = [
    '0:00–5:00',
    '5:00–10:00',
    '10:00–15:00',
    '15:00–20:00',
    '20:00–25:00',
];
const PLATFORMS = ['pc', 'nintendo-switch', 'playstation-5', 'xbox-series-x'];

test(
    'formats Sea of Stars timestamp, platform, and tweet citations',
    testSeaOfStarsPatterns,
);

function testSeaOfStarsPatterns(): void {
    const source = buildSeaOfStarsSource();
    const result = formatCitationWikitext(source, generatedTemplateData);
    assertSeaOfStarsResult(result.text);
}

function buildSeaOfStarsSource(): string {
    const parts = [
        ...VIDEO_TIMES.map(buildVideoCall),
        ...PLATFORMS.map(buildPlatformCall),
        '<ref name="Sea of Stars, 2023" />',
        '<references>',
        ...[0, 5, 10, 15, 20].map(buildVideoDefinition),
        ...PLATFORMS.map(buildPlatformDefinition),
        '<ref name="Sea of Stars, 2023">{{Cite tweet',
        '|author=Sea of Stars|user=seaofstarsgame',
        '|number=1699175546930766092|date=2023-09-05',
        '|title=Thank you}}</ref>',
        '</references>',
    ];
    return parts.join('\n');
}

function buildVideoCall(time: string): string {
    return `<ref name="Boulanger, n.d., ${time}" />`;
}

function buildPlatformCall(_platform: string, index: number): string {
    const suffix = alphabeticTestSuffix(index);
    return `<ref name="Metacritic, n.d.-${suffix}" />`;
}

function buildVideoDefinition(minute: number): string {
    const start = `${minute}:00`;
    const end = `${minute + 5}:00`;
    const position = minute === 0 ? '' : `&t=0h${minute}m00s`;
    return [
        `<ref name="Boulanger, n.d., ${start}–${end}">{{Cite AV media`,
        `|url=https://www.youtube.com/watch?v=NvsDBAcKFDw${position}`,
        '|title=The Making of Sea of Stars &verbar; Escapist Documentary',
        '|last=Boulanger|first=Thierry|publisher=[[The Escapist]]',
        `|time=${start}–${end}|via=YouTube}}</ref>`,
    ].join('\n');
}

function buildPlatformDefinition(platform: string, index: number): string {
    const suffix = alphabeticTestSuffix(index);
    return [
        `<ref name="Metacritic, n.d.-${suffix}">{{Cite web`,
        `|title=Sea of Stars for ${platform} Reviews`,
        '|url=https://www.metacritic.com/game/sea-of-stars/' +
            `critic-reviews/?platform=${platform}`,
        '|website=[[Metacritic]]}}</ref>',
    ].join('\n');
}

function assertSeaOfStarsResult(text: string): void {
    for (const time of VIDEO_TIMES) {
        const timePattern = new RegExp(
            `name="Boulanger, n\\.d\\., at time ${time}"`,
            'u',
        );
        assert.match(text, timePattern);
    }
    assert.doesNotMatch(text, /Boulanger, n\.d\.-[a-e]/u);
    assert.match(text, /\| time = 0′00″–5′00″/u);
    for (const suffix of ['a', 'b', 'c', 'd']) {
        const suffixPattern = new RegExp(
            `name="Metacritic, n\\.d\\.-${suffix}"`,
            'u',
        );
        assert.match(text, suffixPattern);
    }
    assert.match(text, /\{\{Cite tweet\n/u);
    assert.match(text, /name="Sea of Stars, 2023"/u);
    assert.match(text, /<\/ref>\n\n<\/references>/u);
}

function alphabeticTestSuffix(index: number): string {
    const firstCode = 'a'.charCodeAt(0);
    return String.fromCharCode(firstCode + index);
}
