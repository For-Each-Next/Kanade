/**
 * @file tests/source-editor/sub-references.test.ts
 * Purpose: Native Cite details and repeated-footnote regressions, fully offline.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { citationTemplateData } from '../../src/source-editor/config/citation-template-data/index.ts';
import { formatCitationWikitext } from '../../src/source-editor/domain/citation-formatter.ts';
import { expandCompactReferenceCalls } from '../../src/source-editor/domain/manager.ts';
import { wikitext } from '../../src/library/wikitext/index.ts';
import { findRefTags } from '../../src/library/wikitext/references.ts';
import { convertRTemplateCall } from '../../src/source-editor/domain/r-template.ts';
import {
    buildExistingSourceReference,
    buildExistingSourceSubReference,
    filterExistingSources,
    listExistingSources,
    listExistingSourceSections,
    replaceExistingSourceSubReference,
    replaceExistingSourceSubReferences,
    StaleSourceError,
} from '../../src/source-editor/domain/source-manager.ts';
import { decodeReferenceDetailsAttribute } from '../../src/source-editor/domain/ref-attributes.ts';
import { createTemplateNameContext } from '../../src/source-editor/domain/templates.ts';

const chineseTemplateNames = createTemplateNameContext('zhwiki');
const mother3 = `== 游戏玩法 ==

<ref name="UCG" details="阿修罗. {{url|https://archive.org/details/UCG-2006/%E6%B8%B8%E6%88%8F%E6%9C%BA%E5%AE%9E%E7%94%A8%E6%8A%80%E6%9C%AF%20152%202006.6A/page/n59/mode/2up|Mother3 攻略透解 奇妙、有趣，还有发自内心的伤感……}} :58-63" />

<ref name="UCG" details="阿修罗. {{url|https://archive.org/details/UCG-2006/%E6%B8%B8%E6%88%8F%E6%9C%BA%E5%AE%9E%E7%94%A8%E6%8A%80%E6%9C%AF%20152%202006.6A/page/n59/mode/2up|Mother3 攻略透解 奇妙、有趣，还有发自内心的伤感……}} :58-63">[[游戏机实用技术]]. 2006, '''6A''' (152). CN 62-1137/TN. ISSN 1008-0600</ref>

== 故事情节 ==

<ref name="DREAM" details="{{URL|https://web.archive.org/web/20150403065006/http://www.nindori.com/interview/m3/m3int_08.html|55億年後になくなる地球}}. 完結編 :2（{{URL|http://www.nindori.com/interview/m3/m3int_08.html|原始内容}}存档于2015-04-03）" />

== 开发 ==

<ref name="Hobonichi2006" details="{{URL|https://www.1101.com/mother_project/entry/archives/MOTHER3/kimochi/01.html|第1回 『MOTHER3』の再開。}}. 2006-04-18" />

=== 设计 ===

<ref name="Hobonichi2006" details="{{URL|https://www.1101.com/mother_project/entry/archives/MOTHER3/kimochi/04.html|第4回 最初の『MOTHER3』の話。}}. 2006-04-21">{{Cite web |script-title=ja:『MOTHER3』の気持ち。 |url=https://www.1101.com/mother_project/entry/archives/MOTHER3/kimochi/ |website=ほぼ日 |date=2006 |language=ja |author=永田泰大 |access-date=2026-09-18 |archive-url=https://web.archive.org/web/20260918120048/https://www.1101.com/mother_project/entry/archives/MOTHER3/kimochi/ |archive-date=2026-09-18 |url-status=live}}</ref>

<ref name="DREAM" details="{{URL|https://web.archive.org/web/20150226100724/http://www.nindori.com/interview/m3/index.html|ホットケーキを焼くのとはワケが違う}}. 前編 :1（{{URL|http://www.nindori.com/interview/m3/index.html|原始内容}}存档于2015-02-26）">{{cite web |script-title=ja:糸井重里さん『MOTHER3』を大いに語る |url=http://www.nindori.com/interview/m3/index.html |work=[[任天堂Dream|Nintendo DREAM]] |date=2006-07 / 2006-08 |language=ja |url-status=dead |archive-url=https://web.archive.org/web/20150226100724/http://www.nindori.com/interview/m3/index.html |archive-date=2015-02-26 |access-date=2026-09-18 |page= |at=}}</ref>

== 反响 ==

<ref name="UCG" details="猫太; 邪魔天使; 阿修罗. Ace飞行员 , 编. {{url|https://archive.org/details/UCG-2006/%E6%B8%B8%E6%88%8F%E6%9C%BA%E5%AE%9E%E7%94%A8%E6%8A%80%E6%9C%AF%20152%202006.6A/page/n25/mode/2up|黄金眼 最近发售游戏的多视角评价}} :25" />

== 参考资料 ==

{{reflist|30em}}
`;

test('discovers shared main sources and forward details uses from the Mother3 excerpt', () => {
    const tags = findRefTags(mother3);
    const sources = listExistingSources(mother3, chineseTemplateNames);

    assert.equal(tags.length, 7);
    assert.equal(tags.filter((tag) => !tag.selfClosing).length, 3);
    assert.equal(new Set(tags.map((tag) => tag.attributes.details)).size, 6);
    assert.ok(tags.every((tag) => /\{\{url\|/iu.test(tag.attributes.details)));
    assert.equal(sources.length, 3);
    assert.deepEqual(
        sources.map((source) => ({
            name: source.referenceName,
            group: source.group,
            status: source.status,
            uses: source.usageCount,
            sections: source.sectionIds,
        })),
        [
            {
                name: 'UCG',
                group: '',
                status: 'non-standard',
                uses: 3,
                sections: ['1', '4'],
            },
            {
                name: 'Hobonichi2006',
                group: '',
                status: 'standard',
                uses: 2,
                sections: ['3', '3.1'],
            },
            {
                name: 'DREAM',
                group: '',
                status: 'standard',
                uses: 2,
                sections: ['2', '3.1'],
            },
        ],
    );
    for (const source of sources) {
        const definingTag = findRefTags(source.rawReference)[0];
        assert.equal(source.referenceDetails, definingTag.attributes.details);
        assert.equal(source.subReferences?.length, source.usageCount);
    }
    assert.equal(
        new Set(
            sources.flatMap(
                (source) => source.subReferences?.map((use) => use.id) ?? [],
            ),
        ).size,
        7,
    );
    assert.deepEqual(
        listExistingSourceSections(mother3, sources).map(
            (section) => section.title,
        ),
        ['游戏玩法', '故事情节', '开发', '设计', '反响'],
    );
});

test('groups every native details occurrence by name and group without merging identical text', () => {
    const text = [
        'Forward.<ref name="Book" details="same page" />',
        'Again.<ref name="Book" details="same page" />',
        '<nowiki><ref name="Book" details="hidden" /></nowiki>',
        '<!-- <ref name="Book" details="comment" /> -->',
        '== Chapter ==',
        '<ref name="Book" details="chapter <!-- keep --> needle">{{cite book|title=Default}}</ref>',
        '<ref name="Book" group="note" details="note page" />',
        '<ref details="anonymous">Anonymous source.</ref>',
        '<references group="note"><ref name="Book" details="definition only">{{cite book|title=Note}}</ref></references>',
    ].join('\n');
    const sources = listExistingSources(text);
    const main = sources.find((source) => source.title === 'Default');
    const note = sources.find((source) => source.title === 'Note');
    assert.ok(main);
    assert.ok(note);
    assert.deepEqual(
        main.subReferences?.map((use) => [use.details, use.sectionIds]),
        [
            ['same page', ['0']],
            ['same page', ['0']],
            ['chapter <!-- keep --> needle', ['1']],
        ],
    );
    assert.deepEqual(
        note.subReferences?.map((use) => use.details),
        ['note page'],
    );
    assert.deepEqual(
        filterExistingSources(sources, 'needle').map((source) => source.id),
        [main.id],
    );
    assert.deepEqual(
        sources.find((source) => source.referenceName === '')?.subReferences,
        [],
    );
    for (const use of main.subReferences ?? []) {
        assert.equal(
            text.slice(use.referenceStart, use.referenceEnd),
            use.rawReference,
        );
        assert.equal(
            decodeReferenceDetailsAttribute(
                findRefTags(
                    buildExistingSourceReference(main, true, use.details),
                )[0].attributes.details,
            ),
            use.details,
        );
    }
});

test('edits only the chosen details occurrence and preserves its full source and unrelated attributes', () => {
    const body = '{{cite book|title=Original|year=2020}}';
    const opening =
        '<ref dir="rtl" name="Book" group="note" details=\'p. 23, "quote"\' data-extra="keep">';
    const repeated =
        '<ref name="Book" group="note" details="p. 23, &quot;quote&quot;" />';
    const text = opening + body + '</ref>\n' + repeated;
    const [source] = listExistingSources(text);
    const [use] = source.subReferences ?? [];
    assert.ok(use);
    assert.equal(
        buildExistingSourceSubReference(use, use.details),
        use.rawReference,
    );
    assert.equal(
        replaceExistingSourceSubReference(text, source, use, use.details),
        text,
    );
    const details =
        'p. 42 <ref name="attack" /> & {{URL|https://example.test/?a=1&b=2}}';
    const preview = buildExistingSourceSubReference(use, details);
    const [tag] = findRefTags(preview);
    assert.equal(tag.content, body);
    assert.equal(tag.attributes.dir, 'rtl');
    assert.equal(tag.attributes['data-extra'], 'keep');
    assert.equal(
        decodeReferenceDetailsAttribute(tag.attributes.details),
        details,
    );
    assert.equal(findRefTags(preview).length, 1);
    const edited = replaceExistingSourceSubReference(
        text,
        source,
        use,
        details,
    );
    assert.equal(edited, preview + '\n' + repeated);
    assert.deepEqual(
        listExistingSources(edited)[0].subReferences?.map(
            (item) => item.details,
        ),
        [details, 'p. 23, "quote"'],
    );
});

test('keeps self-closing syntax for unquoted details and clears all duplicate details attributes', () => {
    const text = [
        '<ref name=Book details=p23/>',
        '<ref name="Book" details="ignored" DETAILS=\'p23\' data-extra="keep" />',
        '<references><ref name="Book">Plain bibliography.</ref></references>',
    ].join('\n');
    const [source] = listExistingSources(text);
    const [unquoted, duplicated] = source.subReferences ?? [];
    assert.ok(unquoted);
    assert.ok(duplicated);
    assert.equal(
        buildExistingSourceSubReference(unquoted, unquoted.details),
        unquoted.rawReference,
    );
    assert.equal(
        buildExistingSourceSubReference(duplicated, duplicated.details),
        duplicated.rawReference,
    );
    assert.equal(
        buildExistingSourceSubReference(unquoted, 'p42'),
        '<ref name=Book details="p42"/>',
    );
    const cleared = buildExistingSourceSubReference(duplicated, '');
    assert.equal(cleared, '<ref name="Book" data-extra="keep" />');
    assert.ok(findRefTags(cleared)[0].selfClosing);
    const replacement = buildExistingSourceSubReference(duplicated, 'p42');
    assert.equal(
        findRefTags(replacement)[0].attributePairs.filter(
            (attribute) => attribute.name === 'details',
        ).length,
        1,
    );
    const edited = replaceExistingSourceSubReference(
        text,
        source,
        duplicated,
        '',
    );
    assert.equal(listExistingSources(edited)[0].subReferences?.length, 1);
});

test('rejects stale details and missing source identities while allowing unrelated main-source edits', () => {
    const text =
        '<ref name="Book" details="p23" />\n<references><ref name="Book">Original bibliography.</ref></references>';
    const [source] = listExistingSources(text);
    const [use] = source.subReferences ?? [];
    assert.ok(use);
    assert.throws(
        () =>
            replaceExistingSourceSubReference(
                text.replace('p23', 'p42'),
                source,
                use,
                'p80',
            ),
        StaleSourceError,
    );
    assert.throws(
        () =>
            replaceExistingSourceSubReference(
                use.rawReference,
                source,
                use,
                'p80',
            ),
        StaleSourceError,
    );
    assert.throws(
        () =>
            replaceExistingSourceSubReference(
                text.replace('name="Book">', 'name="Else">'),
                source,
                use,
                'p80',
            ),
        StaleSourceError,
    );
    const changed = text.replace(
        'Original bibliography.',
        'Updated bibliography.',
    );
    assert.equal(
        replaceExistingSourceSubReference(changed, source, use, 'p80'),
        changed.replace('details="p23"', 'details="p80"'),
    );
});

test('updates matching details uses together while preserving bodies, attributes, and other groups', () => {
    const body = '{{cite book|title=Original|year=2020}}';
    const text = [
        `<ref dir="rtl" name="Book" details='p. 23 & "quote"' data-extra="definition">${body}</ref>`,
        '<ref name=Book details="p. 23 &amp; &quot;quote&quot;" data-extra="reuse"/>',
        '<ref name="Book" details="p. 99" />',
        '<ref name="Book" group="note" details="p. 23 &amp; &quot;quote&quot;">Notes bibliography.</ref>',
        '<ref name="Other" details="p. 23 &amp; &quot;quote&quot;">Other bibliography.</ref>',
    ].join('\n');
    const source = listExistingSources(text).find(
        (item) => item.referenceName === 'Book' && item.group === '',
    );
    assert.ok(source);
    const occurrences = (source.subReferences ?? []).filter(
        (use) => use.details === 'p. 23 & "quote"',
    );
    assert.equal(occurrences.length, 2);
    const details = 'p. 42 & <ref name="attack" />';
    const edited = replaceExistingSourceSubReferences(
        text,
        source,
        occurrences,
        details,
    );
    const tags = findRefTags(edited);
    assert.equal(tags.length, 5);
    assert.equal(tags[0].content, body);
    assert.equal(tags[0].attributes.dir, 'rtl');
    assert.equal(tags[0].attributes['data-extra'], 'definition');
    assert.equal(tags[1].attributes['data-extra'], 'reuse');
    assert.ok(tags[1].selfClosing);
    assert.deepEqual(
        tags.map((tag) =>
            decodeReferenceDetailsAttribute(tag.attributes.details),
        ),
        [details, details, 'p. 99', 'p. 23 & "quote"', 'p. 23 & "quote"'],
    );
    assert.equal(
        edited.slice(tags[2].start),
        text.slice(findRefTags(text)[2].start),
    );
});

test('rejects the whole details update when any selected use or its parent is stale', () => {
    const text = [
        '<ref name="Book" details="p23" />',
        '<ref name="Book" details="p23" />',
        '<references><ref name="Book">Original bibliography.</ref></references>',
    ].join('\n');
    const [source] = listExistingSources(text);
    const occurrences = source.subReferences ?? [];
    assert.equal(occurrences.length, 2);
    const changedSecond =
        text.slice(0, occurrences[1].referenceStart) +
        text.slice(occurrences[1].referenceStart).replace('p23', 'p42');
    assert.throws(
        () =>
            replaceExistingSourceSubReferences(
                changedSecond,
                source,
                occurrences,
                'p80',
            ),
        StaleSourceError,
    );
    assert.throws(
        () =>
            replaceExistingSourceSubReferences(
                occurrences[0].rawReference +
                    '\n' +
                    occurrences[1].rawReference,
                source,
                occurrences,
                'p80',
            ),
        StaleSourceError,
    );
    assert.throws(
        () =>
            replaceExistingSourceSubReferences(
                text.replace('name="Book">', 'name="Else">'),
                source,
                occurrences,
                'p80',
            ),
        StaleSourceError,
    );
    const changedBibliography = text.replace(
        'Original bibliography.',
        'Updated bibliography.',
    );
    assert.equal(
        replaceExistingSourceSubReferences(
            changedBibliography,
            source,
            occurrences,
            'p80',
        ),
        changedBibliography.replaceAll('details="p23"', 'details="p80"'),
    );
});

for (const [opening, closing] of [
    ['<!--', '-->'],
    ['<nowiki>', '</nowiki>'],
    ['<references>', '</references>'],
]) {
    test(`rejects a grouped use moved into ${opening} without changing its recorded bytes`, () => {
        const repeated = '<ref name="Book" details="p23" />';
        const padded =
            ' '.repeat(opening.length) + repeated + ' '.repeat(closing.length);
        const text = [
            repeated,
            padded,
            '<references><ref name="Book">Bibliography.</ref></references>',
        ].join('\n');
        const [source] = listExistingSources(text);
        const occurrences = source.subReferences ?? [];
        assert.equal(occurrences.length, 2);
        const changed = text.replace(padded, opening + repeated + closing);
        assert.equal(
            changed.slice(
                occurrences[1].referenceStart,
                occurrences[1].referenceEnd,
            ),
            occurrences[1].rawReference,
        );
        assert.throws(
            () =>
                replaceExistingSourceSubReferences(
                    changed,
                    source,
                    occurrences,
                    'p80',
                ),
            StaleSourceError,
        );
    });
}

test('leaves grouped no-op bytes intact and clears details on every selected use', () => {
    const text = [
        '<ref name=Book details="p. 23 &amp; &quot;quote&quot;"/>',
        '<ref name="Book" details="ignored" DETAILS=\'p. 23 & "quote"\' data-extra="keep" />',
        '<ref name="Book" details="p. 99" />',
        '<references><ref name="Book">Bibliography.</ref></references>',
    ].join('\n');
    const [source] = listExistingSources(text);
    const occurrences = (source.subReferences ?? []).filter(
        (use) => use.details === 'p. 23 & "quote"',
    );
    assert.equal(occurrences.length, 2);
    assert.equal(
        replaceExistingSourceSubReferences(
            text,
            source,
            occurrences,
            'p. 23 & "quote"',
        ),
        text,
    );
    const cleared = replaceExistingSourceSubReferences(
        text,
        source,
        occurrences,
        '',
    );
    assert.equal(
        cleared,
        [
            '<ref name=Book/>',
            '<ref name="Book" data-extra="keep" />',
            '<ref name="Book" details="p. 99" />',
            '<references><ref name="Book">Bibliography.</ref></references>',
        ].join('\n'),
    );
    assert.deepEqual(
        listExistingSources(cleared)[0].subReferences?.map(
            (use) => use.details,
        ),
        ['p. 99'],
    );
});

for (const layout of ['inline', 'block'] as const) {
    test(`formats Mother3 main citations in ${layout} layout without losing individual details`, () => {
        const original = findRefTags(mother3);
        const result = formatCitationWikitext(
            mother3,
            citationTemplateData,
            layout,
            '序言',
            chineseTemplateNames,
        );
        const formatted = findRefTags(result.text);
        const uses = formatted.filter((tag) => tag.selfClosing);
        const definitions = formatted.filter((tag) => !tag.selfClosing);

        assert.equal(result.individualReferencesFound, 3);
        assert.equal(result.referenceCallsFound, 7);
        assert.equal(result.citationsFormatted, 2);
        assert.equal(result.referencesNotFormatted, 1);
        assert.equal(uses.length, original.length);
        assert.equal(definitions.length, 3);
        assert.deepEqual(
            uses.map((tag) => tag.attributes.details).toSorted(),
            original.map((tag) => tag.attributes.details).toSorted(),
        );
        assert.ok(definitions.every((tag) => tag.attributes.details == null));
        const plainOriginal = original.find(
            (tag) => !tag.selfClosing && tag.attributes.name === 'UCG',
        );
        const plainFormatted = definitions.find(
            (tag) => tag.attributes.name === 'UCG',
        );
        assert.equal(plainFormatted?.content, plainOriginal?.content);

        const sources = listExistingSources(result.text, chineseTemplateNames);
        assert.equal(sources.length, 3);
        assert.deepEqual(
            sources.map((source) => source.usageCount).toSorted(),
            [2, 2, 3],
        );
        assert.ok(sources.every((source) => source.referenceDetails === ''));
        for (const use of uses) {
            assert.equal(
                definitions.filter(
                    (definition) =>
                        definition.attributes.name === use.attributes.name,
                ).length,
                1,
            );
        }
        assert.equal(
            formatCitationWikitext(
                result.text,
                citationTemplateData,
                layout,
                '序言',
                chineseTemplateNames,
            ).text,
            result.text,
        );
    });
}

test('multiple uses and repeated identical full definitions share one main per group', () => {
    const source = [
        'Forward.<ref name="shared" />',
        'Full.<ref name="shared">Default bibliography.</ref>',
        'Empty group.<ref name="shared" group="" />',
        'Same full.<ref name="shared" group="">Default bibliography.</ref>',
        'Notes forward.<ref name="shared" group="note" />',
        'Notes full.<ref name="shared" group="note">Notes bibliography.</ref>',
        '<references group="" />',
        '<references group="note" />',
    ].join('\n');

    for (const text of [
        source,
        formatCitationWikitext(source, citationTemplateData).text,
    ]) {
        const sources = listExistingSources(text);
        assert.equal(sources.length, 2);
        assert.deepEqual(
            sources.map((item) => ({
                group: item.group,
                uses: item.usageCount,
                title: item.title,
            })),
            [
                { group: '', uses: 4, title: 'Default bibliography.' },
                { group: 'note', uses: 2, title: 'Notes bibliography.' },
            ],
        );
        assert.ok(sources.every((item) => item.referenceDetails === ''));
    }
});

test('explicit empty groups use the default in prose and the enclosing group inside a list', () => {
    const source = [
        'Default forward.<ref name="shared" group="" details="p. 1" />',
        'Notes forward.<ref name="shared" group="note" details="p. 2" />',
        '<references group="">',
        '<ref name="shared">{{Cite web|title=Default|author=Default|date=2020}}</ref>',
        '</references>',
        '<references group="note">',
        '<ref name="shared" group="">{{Cite web|title=Notes|author=Notes|date=2020}}</ref>',
        '</references>',
    ].join('\n');

    const result = formatCitationWikitext(source, citationTemplateData);
    for (const text of [source, result.text]) {
        assert.deepEqual(
            listExistingSources(text).map((item) => ({
                group: item.group,
                uses: item.usageCount,
                title: item.title,
            })),
            [
                { group: '', uses: 1, title: 'Default' },
                { group: 'note', uses: 1, title: 'Notes' },
            ],
        );
    }
    assert.deepEqual(
        findRefTags(result.text)
            .filter((tag) => tag.selfClosing)
            .map((tag) => tag.attributes.details),
        ['p. 1', 'p. 2'],
    );
    assert.equal(
        formatCitationWikitext(result.text, citationTemplateData).text,
        result.text,
    );
});

for (const wiki of ['enwiki', 'zhwiki'] as const) {
    test(`keeps R reuse connected to literal entity and Unicode names on ${wiki}`, () => {
        const context = createTemplateNameContext(wiki);
        const source = [
            'Lead{{r|&amp;eacute;|&eacute;}}.',
            '<references>',
            '<ref name="&amp;eacute;">Literal entity bibliography.</ref>',
            '<ref name="é">Unicode bibliography.</ref>',
            '</references>',
        ].join('\n');

        const result = formatCitationWikitext(
            source,
            citationTemplateData,
            'inline',
            'Lead',
            context,
        );

        assert.deepEqual(
            listExistingSources(result.text, context).map((item) => ({
                name: item.referenceName,
                uses: item.usageCount,
            })),
            [
                { name: '&eacute;', uses: 1 },
                { name: 'é', uses: 1 },
            ],
        );
        assert.ok(result.text.includes('<ref name="&amp;eacute;" />'));
        assert.ok(result.text.includes('<ref name="é" />'));
        assert.equal(
            formatCitationWikitext(
                result.text,
                citationTemplateData,
                'inline',
                'Lead',
                context,
            ).text,
            result.text,
        );
    });
}

test('preserves a nested entity name when converting an enwiki R definition and its reuse', () => {
    const context = createTemplateNameContext('enwiki');
    const source = [
        'Lead{{r|&amp;eacute;}}.',
        '<references>{{r|name=&amp;eacute;|r=Plain bibliography.}}</references>',
    ].join('\n');

    const result = formatCitationWikitext(
        source,
        citationTemplateData,
        'inline',
        'Lead',
        context,
    );
    const sources = listExistingSources(result.text, context);

    assert.equal(sources.length, 1);
    assert.equal(sources[0].referenceName, '&eacute;');
    assert.equal(sources[0].usageCount, 1);
    assert.ok(
        result.text.includes(
            '<ref name="&amp;eacute;">Plain bibliography.</ref>',
        ),
    );
    assert.equal(
        formatCitationWikitext(
            result.text,
            citationTemplateData,
            'inline',
            'Lead',
            context,
        ).text,
        result.text,
    );
});

test('enwiki R conversion escapes decoded name delimiters once without creating markup', () => {
    const source = '{{r|name=A&quot;B&lt;C&gt;&amp;D|r=Plain bibliography.}}';
    const [call] = wikitext(source).template.getAll();

    const result = convertRTemplateCall(
        call,
        createTemplateNameContext('enwiki'),
    );

    assert.equal(
        result,
        '<ref name="A&quot;B&lt;C&gt;&amp;D">Plain bibliography.</ref>',
    );
    assert.equal(
        findRefTags(result)[0].attributes.name,
        'A&quot;B&lt;C&gt;&amp;D',
    );
    assert.equal(listExistingSources(result)[0].referenceName, 'A"B<C>&D');
});

test('manager R expansion preserves literal entity and Unicode reference identity', () => {
    const source = [
        'Lead{{r|&amp;eacute;|&eacute;|A&quot;B&lt;C&gt;&amp;D}}.',
        '<references>',
        '<ref name="&amp;eacute;">Literal entity bibliography.</ref>',
        '<ref name="é">Unicode bibliography.</ref>',
        '<ref name="A&quot;B&lt;C&gt;&amp;D">Quoted bibliography.</ref>',
        '</references>',
    ].join('\n');

    const result = expandCompactReferenceCalls(source, chineseTemplateNames);

    assert.deepEqual(
        listExistingSources(result, chineseTemplateNames).map((item) => ({
            name: item.referenceName,
            uses: item.usageCount,
        })),
        [
            { name: '&eacute;', uses: 1 },
            { name: 'é', uses: 1 },
            { name: 'A"B<C>&D', uses: 1 },
        ],
    );
    assert.ok(result.includes('<ref name="&amp;eacute;" />'));
    assert.ok(result.includes('<ref name="A&quot;B&lt;C&gt;&amp;D" />'));
    assert.equal(
        expandCompactReferenceCalls(result, chineseTemplateNames),
        result,
    );
});
