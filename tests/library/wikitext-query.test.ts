/**
 * @file tests/library/wikitext-query.test.ts
 * Purpose: Tests lazy construct-focused shared wikitext operations.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { wikitext } from '../../src/library/wikitext/index.ts';

test('template queries find nested calls outside opaque ranges', () => {
    const source = [
        '<!-- {{ignored|comment=yes}} -->',
        '<nowiki>{{hidden|literal=yes}}</nowiki>',
        '{{outer|value={{inner|url=https://example.test?a=b}}}}',
    ].join('\n');
    const templates = wikitext(source).template.getAll();

    assert.deepEqual(
        templates.map((template) => template.name),
        ['outer', 'inner'],
    );
    assert.equal(templates[1].params[0].value, 'https://example.test?a=b');
    assert.equal(templates[1].depth, 1);

    const variable = '{{outer|{{{value|{{fallback}}}}}|tail}}';
    assert.deepEqual(
        wikitext(variable)
            .template.getAll()
            .map((template) => template.raw),
        [variable],
    );
});

test('template getFirst filters normalized entered names', () => {
    const source = [
        '{{Other}}',
        '{{ Template : Cite__web |title=First}}',
        '{{cite web|title=Second}}',
    ].join('');
    const templates = wikitext(source).template;

    assert.equal(templates.getAll(' CITE web ').length, 2);
    assert.equal(
        templates.getFirst('Template:Cite_web')?.params[0].value,
        'First',
    );
    assert.equal(templates.getFirst('missing'), undefined);
    assert.deepEqual(templates.getAll('   '), []);
    assert.deepEqual(
        wikitext(source)
            .templates.getAll('cite web')
            .map((template) => template.raw),
        templates.getAll('cite web').map((template) => template.raw),
    );
});

test('template queries do not mix wiki-specific namespace aliases', () => {
    const source = [
        '{{TM:Cite_web|title=English alias}}',
        '{{T:Cite web|title=Chinese shortcut}}',
        '{{樣板:Cite web|title=Chinese name}}',
        '{{Template:Cite web|title=Canonical name}}',
        '{{User:Cite web|title=Other namespace}}',
    ].join('');
    const templates = wikitext(source).template;

    assert.deepEqual(
        templates
            .getAll('Template:Cite web')
            .map((template) => template.params[0]?.value),
        ['Canonical name'],
    );
    assert.equal(wikitext.template.normalizeName('TM:Cite web'), 'tm:cite web');
    assert.equal(wikitext.template.normalizeName('T:Cite web'), 't:cite web');
    assert.equal(
        wikitext.template.normalizeName('樣板:Cite web'),
        '樣板:cite web',
    );
    assert.equal(
        wikitext.template.normalizeName('User:Cite web'),
        'user:cite web',
    );
});

test('template queries filter by effective parameter values', () => {
    const source = [
        '{{Cite web|lead|title= First |lang=en|empty=}}',
        '{{cite web|title=Old|title=Second|lang=en}}',
        '{{Other|title=First}}',
        '{{T|positional|1=explicit}}',
    ].join('');
    const templates = wikitext(source).template;

    assert.deepEqual(
        templates
            .getAll('cite web', { lang: 'en', title: 'First' })
            .map((template) => template.raw),
        ['{{Cite web|lead|title= First |lang=en|empty=}}'],
    );
    assert.equal(
        templates.getFirst('cite web', { title: 'Second' })?.raw,
        '{{cite web|title=Old|title=Second|lang=en}}',
    );
    assert.equal(templates.getAll(undefined, { title: 'First' }).length, 2);
    assert.equal(
        templates.getFirst('cite web', { '1': 'lead' })?.name,
        'Cite web',
    );
    assert.equal(templates.getAll('cite web', { Title: 'First' }).length, 0);
    assert.equal(templates.getAll('cite web', { empty: '' }).length, 1);
    assert.equal(templates.getAll('cite web', { missing: '' }).length, 0);
    assert.equal(templates.getAll('T', { '1': 'explicit' }).length, 1);
    assert.deepEqual(
        wikitext(source).templates.getAll('cite web', { title: 'First' }),
        templates.getAll('cite web', { title: 'First' }),
    );
    assert.deepEqual(templates.getAll('cite web', { title: 'Missing' }), []);
});

test('source-bound parsers preserve ordered tag and template pairs', () => {
    const tagSource =
        '  <ref NAME="first" name=second group=notes>Text {{x}}</ref>  ';
    const parsedTag = wikitext(tagSource).parser();

    assert.equal(parsedTag?.kind, 'tag');
    if (parsedTag?.kind !== 'tag') {
        assert.fail('Expected a parsed tag.');
    }
    assert.equal(parsedTag.name, 'ref');
    assert.deepEqual(parsedTag.attributePairs, [
        { name: 'name', value: 'first' },
        { name: 'name', value: 'second' },
        { name: 'group', value: 'notes' },
    ]);
    assert.equal(parsedTag.attributes.name, 'second');
    assert.equal(parsedTag.innerText, 'Text {{x}}');

    const templateSource =
        '{{Cite web|lead|title=First|title={{lang|en|Second}}}}';
    const parsedTemplate = wikitext(templateSource).parser();

    assert.equal(parsedTemplate?.kind, 'template');
    if (parsedTemplate?.kind !== 'template') {
        assert.fail('Expected a parsed template.');
    }
    assert.equal(parsedTemplate.name, 'Cite web');
    assert.deepEqual(
        parsedTemplate.parameterPairs.map(({ name, value }) => ({
            name,
            value,
        })),
        [
            { name: '1', value: 'lead' },
            { name: 'title', value: 'First' },
            { name: 'title', value: '{{lang|en|Second}}' },
        ],
    );
});

test('template parsing keeps raw values and absolute offsets', () => {
    const raw = '{{cite web|Page [[A|B]]|title={{lang|en|A=B}}|empty=}}';
    const parsed = wikitext.template.parse(raw, 12);
    const [positional, title, empty] = parsed.params;

    assert.equal(parsed.start, 12);
    assert.equal(parsed.end, 12 + raw.length);
    assert.equal(positional.name, '1');
    assert.equal(positional.positional, true);
    assert.equal(positional.rawValue, 'Page [[A|B]]');
    assert.equal(title.name, 'title');
    assert.equal(title.value, '{{lang|en|A=B}}');
    assert.equal(
        raw.slice(title.valueStart - 12, title.valueEnd - 12),
        title.rawValue,
    );
    assert.equal(empty.value, '');
});

test('template parsing protects complete reference extension tags', () => {
    const source =
        '{{efn|name=Terraria: Otherworld|' +
        '译名取自[[游民星空]]<ref name="旧城七喜, 2018" />、' +
        '[[触乐]]<ref name="陈祺, 2016" />、游戏大观' +
        '<ref name="游戏大观, 2020" />等，触乐' +
        '<ref name="刘翁婳, 2022" />和游戏茶馆' +
        '<ref name="崴脚君, 2023" />译作「泰拉瑞亚：异界」，' +
        '触乐又译作「泰拉瑞亚：异世界」<ref name="星咏, 2015" />。}}';
    const [name, note] = wikitext.template.parse(source).params;

    assert.equal(name.name, 'name');
    assert.equal(name.value, 'Terraria: Otherworld');
    assert.equal(note.name, '1');
    assert.equal(note.positional, true);
    assert.match(
        note.value,
        /^\u8bd1\u540d\u53d6\u81ea\[\[\u6e38\u6c11\u661f\u7a7a\]\]<ref name=/u,
    );
    assert.match(note.value, /<ref name="\u661f\u548f, 2015" \/>\u3002$/u);
});

test('only complete reference tags protect template separators', () => {
    assert.deepEqual(
        wikitext('<ref name="source">a|b=c</ref>|tail').split('|'),
        ['<ref name="source">a|b=c</ref>', 'tail'],
    );
    assert.deepEqual(
        wikitext('<span title="source">a|b</span>|tail').split('|'),
        ['<span title="source">a', 'b</span>', 'tail'],
    );
    assert.deepEqual(wikitext('<ref name="source">a|b').split('|'), [
        '<ref name="source">a',
        'b',
    ]);
    assert.equal(
        wikitext('<references group="notes" />').findTopLevelEquals(),
        -1,
    );
    const malformed = '< ref name="source" />';
    assert.equal(
        wikitext(malformed).findTopLevelEquals(),
        malformed.indexOf('='),
    );
});

test('reference protection preserves surrounding template structure', () => {
    const uppercase = wikitext.template.parse('{{T|lead<REF NAME="source" />}}')
        .params[0];
    const laterEquals = wikitext.template.parse(
        '{{T|lead<ref name="source" />=value}}',
    ).params[0];
    const nestedSource = '{{outer|<ref>{{inner|key=value}}</ref>}}';
    const [outer, inner] = wikitext(nestedSource).template.getAll();

    assert.equal(uppercase.name, '1');
    assert.equal(uppercase.positional, true);
    assert.equal(laterEquals.name, 'lead<ref name="source" />');
    assert.equal(laterEquals.value, 'value');
    assert.equal(outer.params[0].positional, true);
    assert.equal(inner.name, 'inner');
    assert.equal(inner.params[0].name, 'key');
});

test('template build supports inline and two block styles', () => {
    const parameters = [
        { value: 'Lead' },
        { name: 'title', value: 'Example' },
        { name: 'url', value: 'https://example.test' },
    ];

    assert.equal(
        wikitext.template.build(' cite web ', parameters),
        '{{cite web|Lead|title=Example|url=https://example.test}}',
    );
    assert.equal(
        wikitext.template.build(
            'cite web',
            { title: 'Example' },
            {
                style: 'block',
            },
        ),
        '{{cite web\n| title = Example\n}}',
    );
    assert.equal(
        wikitext.template.build(
            'cite web',
            { title: 'Example' },
            {
                style: 'block-indent',
            },
        ),
        '{{cite web\n  | title = Example\n}}',
    );
});

test('reference queries preserve exact content and groups', () => {
    const source = [
        '<!-- <ref name=fake>Ignored</ref> -->',
        "<ref name='source' group=notes>",
        '{{cite web|title=<nowiki></ref></nowiki>Page}}',
        '</ref>',
        '<ref name=source group=notes/>',
    ].join('\n');
    const references = wikitext(source).reference;
    const tags = references.getAll();

    assert.equal(tags.length, 2);
    assert.equal(tags[0].attributes.name, 'source');
    assert.equal(tags[0].attributes.group, 'notes');
    assert.match(tags[0].content, /<nowiki><\/ref><\/nowiki>Page/u);
    assert.equal(tags[1].selfClosing, true);
    assert.deepEqual(references.getFirst('source', 'notes'), tags[0]);
    assert.equal(references.getFirst('source'), undefined);
    assert.deepEqual(references.getAll(undefined, 'notes'), tags);
    assert.deepEqual(wikitext(source).references.getAll(), tags);

    const reuseFirst = [
        '<ref name=source group=notes />',
        '<ref name=source group=notes>{{cite web|title=Full}}</ref>',
    ].join('');
    assert.match(
        wikitext(reuseFirst).references.getFirst('source', 'notes')?.content ??
            '',
        /title=Full/u,
    );
});

test('opaque, tag, and comment queries remain independent', () => {
    const source = [
        '<syntaxhighlight lang="ts" data-label="a>b">',
        '<ref name="fake">{{hidden}}</ref>',
        '</syntaxhighlight>',
        '<!-- <b>ignored</b> -->',
        '<ref name="real">Text {{visible}}</ref>',
        '<br>',
    ].join('');
    const code = wikitext(source);
    const tags = code.tag.getAll();

    assert.deepEqual(
        tags.map((tag) => tag.name),
        ['syntaxhighlight', 'ref', 'br'],
    );
    assert.equal(tags[0].attributes['data-label'], 'a>b');
    assert.equal(code.tag.getFirst('REF')?.attributes.name, 'real');
    assert.deepEqual(code.tags.getAll('ref'), code.tag.getAll('ref'));
    assert.equal(code.comment.getFirst()?.content, ' <b>ignored</b> ');
    assert.equal(code.opaque.getAll().length, 2);
});

test('tag queries filter by case-insensitive attribute names', () => {
    const source = [
        '<ref name="first" group="notes">One</ref>',
        '<REF NAME="second" group="notes">Two</REF>',
        '<ref name="second" group="other">Three</ref>',
        '<ref name="old" name="effective" disabled>Four</ref>',
    ].join('');
    const tags = wikitext(source).tag;

    assert.deepEqual(
        tags
            .getAll('ref', { group: 'notes', name: 'second' })
            .map((tag) => tag.content),
        ['Two'],
    );
    assert.equal(tags.getFirst('REF', { NAME: 'first' })?.content, 'One');
    assert.equal(tags.getAll(undefined, { name: 'second' }).length, 2);
    assert.equal(tags.getAll('ref', { name: 'Second' }).length, 0);
    assert.equal(tags.getAll('ref', { disabled: '' }).length, 1);
    assert.equal(tags.getAll('ref', { missing: '' }).length, 0);
    assert.equal(tags.getAll('ref', { name: 'old' }).length, 0);
    assert.equal(tags.getAll('ref', { name: 'effective' }).length, 1);
    assert.deepEqual(
        wikitext(source).tags.getAll('ref', { group: 'notes' }),
        tags.getAll('ref', { group: 'notes' }),
    );
    assert.deepEqual(tags.getAll('ref', { name: 'missing' }), []);
});

test('unclosed constructs stay opaque through input end', () => {
    assert.deepEqual(wikitext('Before <!-- open').opaque.getAll(), [
        { end: 16, start: 7 },
    ]);
    assert.deepEqual(wikitext('<nowiki>open').opaque.getAll(), [
        { end: 12, start: 0 },
    ]);
    assert.deepEqual(wikitext('<nowiki />{{visible}}').opaque.getAll(), [
        { end: 10, start: 0 },
    ]);
});

test('unfinished link ranges are opt-in and keep nested and protected syntax boundaries', () => {
    const source = '[[Open|[[Closed]] <nowiki>]]</nowiki><!-- ]] --> {{T}}';
    assert.deepEqual(wikitext(source).link.getAll(), [
        { depth: 1, end: 17, start: 7 },
    ]);
    assert.deepEqual(
        wikitext(source, { includeUnclosedLinks: true }).link.getAll(),
        [
            { depth: 0, end: source.length, start: 0 },
            { depth: 1, end: 17, start: 7 },
        ],
    );
});

test('braces inside link labels do not change surrounding template nesting', () => {
    const nested = '{{inner|label=[[Example|}} {{Format|a=b}}]]|tail=yes}}';
    assert.deepEqual(wikitext(`${nested}|next=value`).split('|'), [
        nested,
        'next=value',
    ]);
    assert.equal(
        wikitext(`${nested}=value`).findTopLevelEquals(),
        nested.length,
    );
    assert.equal(
        wikitext('[[Example|{{Format|a=b}}]]').template.getFirst()?.raw,
        '{{Format|a=b}}',
    );
});

test('table queries parse only table-local structure', () => {
    const source = [
        '{| class="wikitable"',
        '|+ Caption {{lang|en|Example}}',
        '|+ class="111" style="xxx: yyy;" | title',
        '|-',
        '! Game !! Year',
        '|-',
        '| style="font-weight:bold" | {{cite web|title=A}} || 2024',
        '|}',
    ].join('\n');
    const table = wikitext(source).table.getFirst();

    assert.equal(table?.attributes.class, 'wikitable');
    assert.equal(table?.captions.length, 2);
    assert.deepEqual(table?.captions[0]?.attributes, {});
    assert.equal(table?.captions[0]?.content, ' Caption {{lang|en|Example}}');
    assert.deepEqual(table?.captions[1]?.attributes, {
        class: '111',
        style: 'xxx: yyy;',
    });
    assert.equal(table?.captions[1]?.content, ' title');
    assert.equal(table?.rows.length, 2);
    assert.deepEqual(
        table?.rows.map((row) => row.cells.map((cell) => cell.header)),
        [
            [true, true],
            [false, false],
        ],
    );
    assert.equal(table?.rows[1].cells[0]?.attributes.style, 'font-weight:bold');
});
