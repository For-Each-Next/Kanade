/**
 * @file tests/source-editor/manager.test.ts
 * Purpose: Tests citation-management transformations.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    applyNameOverrides,
    compactReferenceCalls,
    detectCitationLayout,
    expandCompactReferenceCalls,
    findNameOverrideFields,
} from '../../src/source-editor/domain/manager.ts';
import {
    manageCitations,
    manageCitationsWithResult,
} from '../../src/source-editor/domain/api.ts';

const chineseTemplateNames = { namespaceSource: 'zhwiki' } as const;

const testNonLatinNameOverrides = () => {
    const source = [
        '{{Cite web',
        '  | author = 早坂将昭',
        '  | title = {{lang|ja|インタビュー}}',
        '  | publisher = スクウェア・エニックス<!-- # Square Enix -->',
        '  | website = [[未来出版社|Future]]',
        '}}',
    ].join('\n');
    const fields = findNameOverrideFields(source);
    const enteredOverrides = fields.map((field) => [
        field.displayValue,
        field.override,
    ]);

    assert.deepEqual(enteredOverrides, [
        ['早坂将昭', ''],
        ['スクウェア・エニックス', 'Square Enix'],
    ]);
    const result = applyNameOverrides(source, [
        { ids: fields[0].ids, override: 'Hayasaka, Masaaki' },
        { ids: fields[1].ids, override: '' },
    ]);
    assert.match(result, /\| author = 早坂将昭 <!-- # Hayasaka, Masaaki -->/u);
    assert.match(result, /\| publisher = スクウェア・エニックス\n/u);
    assert.match(result, /\| title = \{\{lang\|ja\|インタビュー\}\}/u);
};
test(
    'finds and applies non-Latin reference-name overrides',
    testNonLatinNameOverrides,
);

test('keeps citation-like templates in sub-reference details out of name edits', () => {
    const hiddenCitation =
        '{{Cite web|author=隐藏作者|title=Details template}}';
    const source =
        `<ref name="Book" details="${hiddenCitation}">` +
        '{{Cite web|author=可见作者|title=Main source}}</ref>' +
        `<ref name="Book" details="${hiddenCitation}" />`;
    const fields = findNameOverrideFields(source);

    assert.deepEqual(
        fields.map((field) => field.displayValue),
        ['可见作者'],
    );
    const result = applyNameOverrides(source, [
        { ids: [`${source.indexOf(hiddenCitation)}:0`], override: 'Hidden' },
        { ids: fields[0].ids, override: 'Visible' },
    ]);
    assert.equal(result.split(hiddenCitation).length - 1, 2);
    assert.match(result, /author=可见作者 <!-- # Visible -->/u);
    assert.doesNotMatch(result, /# Hidden/u);
});

test('leaves detail templates native during R expansion and layout detection', () => {
    const source =
        '<ref name="Book" details="{{r|Other}}">' +
        '{{Cite web|title=Main}}</ref><ref name="Book" details="{{r|Other}}" />';
    assert.equal(expandCompactReferenceCalls(source), source);
    assert.equal(compactReferenceCalls(source), source);
    const blockDetail =
        '<ref name="Book" details="{{Cite book\n|title=Hidden}}">{{Cite web|title=Main}}</ref>';
    assert.equal(detectCitationLayout(blockDetail), 'inline');
    assert.equal(
        expandCompactReferenceCalls('{{r|A"B}}'),
        '<ref name="A&quot;B" />',
    );
});

test('keeps entity-bearing native reference names out of compact R calls', () => {
    const source =
        '<ref name="A&amp;quot;B" /><ref name="A&quot;B" />' +
        '<ref name="A&amp;B" />';
    assert.equal(compactReferenceCalls(source), source);
    assert.equal(expandCompactReferenceCalls(source), source);
});

const testNoAuthorOverrideEdits = () => {
    const source = [
        '{{Cite web|website=游民星空',
        '<!-- !no-author # Youmin Xingkong -->|title=X}}',
    ].join('');
    const [field] = findNameOverrideFields(source);
    assert.equal(field.override, 'Youmin Xingkong');

    const updated = applyNameOverrides(source, [
        { ids: field.ids, override: 'Gamersky' },
    ]);
    assert.match(updated, /website=游民星空<!-- !no-author # Gamersky -->/u);

    const removed = applyNameOverrides(source, [
        { ids: field.ids, override: '' },
    ]);
    assert.match(removed, /website=游民星空<!-- !no-author -->/u);
};
test(
    'edits overrides sharing a no-author directive',
    testNoAuthorOverrideEdits,
);

const testNativeReuseRoundTrip = () => {
    const source = [
        'Text.<ref name="First, 2020" /><ref name="Second, 2021" />',
        'More.<ref name="First, 2020" />',
        '<references responsive>',
        '<ref name="First, 2020">First</ref>',
        '<ref name="Second, 2021">Second</ref>',
        '</references>',
    ].join('\n');
    const compact = compactReferenceCalls(source);

    assert.match(compact, /Text\.\{\{r\|First, 2020\|Second, 2021\}\}/u);
    assert.match(compact, /More\.\{\{r\|First, 2020\}\}/u);
    const expanded = expandCompactReferenceCalls(compact);
    assert.equal(expanded, source);
};
test(
    'round trips native reuse tags through temporary R calls',
    testNativeReuseRoundTrip,
);

test('leaves template-opening reference names native', () => {
    const source = '<ref name="a{{" />';

    assert.equal(compactReferenceCalls(source), source);
});

test('folds wiki-specific Rp annotations into indexed R parameters', () => {
    const chineseFirst = [
        '<ref name="Cameron, 2011" />{{rp|2}}',
        '<ref name="崴脚君, 2023" />',
    ].join('');
    assert.equal(
        compactReferenceCalls(chineseFirst, chineseTemplateNames),
        '{{r|Cameron, 2011|p1=2|崴脚君, 2023}}',
    );

    const chinese = [
        '<ref name="one" />',
        '<ref name="two" />{{rp|235|quote=Quoted text}}',
    ].join('');
    assert.equal(
        compactReferenceCalls(chinese, chineseTemplateNames),
        '{{r|one|two|p2=235|q2=Quoted text}}',
    );

    const english = [
        '<ref name="one" />',
        '{{rp|p=100|quote=Palabras|language=Spanish|translation=Words}}',
        '<ref name="two" />',
        '<ref name="three" />{{rp|pp=10–14}}',
    ].join('');
    assert.equal(
        compactReferenceCalls(english),
        '{{r|one|p1=100|q1=Palabras|language1=Spanish|' +
            'translation1=Words|two|three|pp3=10–14}}',
    );
});

test('uses plural zhwiki R locators for page lists and ranges', () => {
    const singular = '<ref name="晶合实验室Oracle, 2011" />{{rp|111}}';
    assert.equal(
        compactReferenceCalls(singular, chineseTemplateNames),
        '{{r|晶合实验室Oracle, 2011|p1=111}}',
    );

    for (const locator of ['111,113', '111-113', '111–113', '111—113']) {
        const source =
            '<ref name="晶合实验室Oracle, 2011" />' + `{{rp|${locator}}}`;

        assert.equal(
            compactReferenceCalls(source, chineseTemplateNames),
            `{{r|晶合实验室Oracle, 2011|pp1=${locator}}}`,
        );
    }
});

const testAttributedReusePreservation = () => {
    const source = [
        '<ref name="note" group="note" />',
        '<ref name="plain" dir="ltr" />',
    ].join('\n');
    const compact = compactReferenceCalls(source);
    assert.equal(compact, source);
};
test(
    'leaves grouped and attributed reuse tags native',
    testAttributedReusePreservation,
);

const testProtectedManagementExamples = () => {
    const source = [
        '<!-- <ref name="comment" /> {{Cite web|author=作者}} -->',
        '<nowiki><ref name="code" /> {{r|old}} ' +
            '{{Cite web|author=作者}}</nowiki>',
    ].join('\n');
    const fields = findNameOverrideFields(source);
    const compact = compactReferenceCalls(source);
    const expanded = expandCompactReferenceCalls(source);
    assert.deepEqual(fields, []);
    assert.equal(compact, source);
    assert.equal(expanded, source);
};
test(
    'leaves management examples in protected wikitext unchanged',
    testProtectedManagementExamples,
);

const testReferenceNameRegeneration = () => {
    const source = [
        'Text.<ref name="早坂将昭, 2025" />',
        '<references responsive>',
        '<ref name="早坂将昭, 2025">{{Cite web',
        '|author=早坂将昭|date=2025|title=Interview}}</ref>',
        '</references>',
    ].join('\n');
    const field = findNameOverrideFields(source)[0];
    const result = manageCitations(
        source,
        [{ ids: field.ids, override: 'Hayasaka' }],
        false,
    );
    assert.match(result, /<ref name="Hayasaka, 2025" \/>/u);
    assert.match(result, /author = 早坂将昭 <!-- # Hayasaka -->/u);
};
test(
    'regenerates reference names after override edits',
    testReferenceNameRegeneration,
);

const testCitationManagementStyles = () => {
    const source = [
        'Text.<ref>{{cite web|author=Ma|date=2020|title=Example}}</ref>',
        '<references />',
    ].join('\n');

    const compactInline = manageCitations(source, [], true, 'inline');
    assert.match(compactInline, /Text\.\{\{r\|Ma, 2020\}\}/u);
    const inlineDefinition =
        '<ref name="Ma, 2020">{{Cite web | author = Ma | ' +
        'date = 2020 | title = Example }}</ref>';
    assert.ok(compactInline.includes(inlineDefinition));

    const nativeInline = manageCitations(source, [], false, 'inline');
    assert.match(nativeInline, /Text\.<ref name="Ma, 2020" \/>/u);
    assert.doesNotMatch(nativeInline, /\{\{r\|/u);
    assert.doesNotMatch(nativeInline, /\{\{Cite web\n/u);
};
test(
    'applies reference-call and citation-layout styles independently',
    testCitationManagementStyles,
);

test('round trips the Terraria zhwiki locator and quotation', () => {
    const quote = [
        '但本作对于家用机的操作优化还是不太到位，道具界面的使用和',
        '项目调换比较繁琐，用摇杆代替鼠标移动光标时也不太便利，',
        '有待改进。',
    ].join('');
    const rCall = `{{r|ign_20130404|UCG_20130501|p2=17|q2=${quote}}}`;
    const source = [`Text${rCall}.`, '<references />'].join('\n');
    const context = { templateNameContext: chineseTemplateNames };

    const native = manageCitationsWithResult(
        source,
        [],
        false,
        'inline',
        context,
    ).text;
    const nativeReuse =
        '<ref name="ign_20130404" /><ref name="UCG_20130501" />' +
        `{{rp|17|quote=${quote}}}`;
    assert.ok(native.includes(nativeReuse));
    assert.ok(
        compactReferenceCalls(native, chineseTemplateNames).includes(rCall),
    );

    const compact = manageCitationsWithResult(
        source,
        [],
        true,
        'inline',
        context,
    ).text;
    assert.ok(compact.includes(rCall));
    assert.doesNotMatch(compact, /\{\{rp\|/u);
});

test('retains formatting counts while applying manager styles', () => {
    const source = ['Text.<ref>Plain note</ref>', '<references />'].join('\n');
    const result = manageCitationsWithResult(source, [], true, 'inline');

    assert.equal(result.referencesNotFormatted, 1);
    assert.match(result.text, /<ref name=":1">Plain note<\/ref>/u);
});

const testDetectCitationLayout = () => {
    const blockCitation = ['{{Cite web', '  | title = Block', '}}'].join('\n');
    const block = `<ref>${blockCitation}</ref>`;
    const inlineCitation = '{{Cite web | title = Inline}}';
    const inline = `<ref>${inlineCitation}</ref>`;
    const alternateBlock = [
        '<ref>{{Cite web | title = Block',
        ' | url = https://example.test',
        '}}</ref>',
    ].join('\n');
    const templateOpen = '{'.repeat(2);
    const nestedInline = [
        `<ref>${templateOpen}Cite web | title = ${templateOpen}lang`,
        '| en',
        '| Inline}}}}</ref>',
    ].join('\n');

    assert.equal(detectCitationLayout(block), 'block');
    assert.equal(detectCitationLayout(alternateBlock), 'block');
    assert.equal(detectCitationLayout(inline), 'inline');
    assert.equal(detectCitationLayout(nestedInline), 'inline');
    assert.equal(detectCitationLayout(`${inline}\n${block}`), 'block');
    assert.equal(detectCitationLayout('Plain text'), 'block');
    assert.equal(
        detectCitationLayout(`<!-- ${block} -->\n${inline}`),
        'inline',
    );
    assert.equal(detectCitationLayout(`${blockCitation}\n${inline}`), 'inline');
};
test(
    'detects the current citation layout for manager defaults',
    testDetectCitationLayout,
);

const testGroupedOverrideEditing = () => {
    const source = [
        '{{Cite web|author=早坂将昭|title=First}}',
        '{{Cite interview|author=早坂将昭|title=Second}}',
    ].join('\n');
    const fields = findNameOverrideFields(source);
    assert.equal(fields.length, 1);
    assert.equal(fields[0].ids.length, 2);

    const result = applyNameOverrides(source, [
        { ids: fields[0].ids, override: 'Hayasaka' },
    ]);
    const matches = result.match(/<!-- # Hayasaka -->/gu);
    assert.equal(matches?.length, 2);
};
test(
    'groups repeated names for bulk override editing',
    testGroupedOverrideEditing,
);

const testGroupedNameUsageSummary = () => {
    const source = [
        '{{Cite web|author1=游民星空|title=First}}',
        '{{Cite web|author2=游民星空|title=Second}}',
        '{{Cite book|author3=游民星空|title=Third}}',
        '{{Cite web|publisher=游民星空|title=Fourth}}',
    ].join('\n');
    const [field] = findNameOverrideFields(source);

    assert.equal(
        field.usage,
        'Used 4 times across |author#= (3) and |publisher= (1).',
    );
    assert.equal(field.occurrences.length, 4);
    assert.deepEqual(field.usageItems, [
        { count: 3, label: 'author#' },
        { count: 1, label: 'publisher' },
    ]);
};
test(
    'summarizes grouped name usage by parameter and template',
    testGroupedNameUsageSummary,
);

const testSingleNameUsageDescription = () => {
    const [field] = findNameOverrideFields(
        '{{Cite web|website=游民星空|title=Example}}',
    );
    assert.equal(field.usage, 'Used once as |website= in a web citation.');
};
test('describes a single name usage naturally', testSingleNameUsageDescription);
