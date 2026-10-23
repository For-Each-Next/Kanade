/**
 * @file tests/source-editor/source-manager.test.ts
 * Purpose: Tests source-manager parsing, matching, editing, and serialization.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 * 3. getRow
 * 4. Constants and state
 * 5. buildSectionFilterText
 * 6. assertMetadataFreeDraftControls
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveWikiPolicy } from '../../src/source-editor/domain/wiki-policy.ts';

import {
    buildExistingSourceReference,
    canJoinAuthorDraftRow,
    canSplitAuthorDraftRow,
    canonicalizeSourceDraft,
    changeSourceDraftTemplate,
    createManualSourceDraft,
    ensureNextAuthorDraftRows,
    filterExistingSources,
    findCreatorAliasSuggestions,
    formatSourceDraftRows,
    formatSourceDraftScriptTitle,
    formatSourceScriptTitles,
    getSourceDraftCitationNameCells,
    getSourceDraftCitationNameParts,
    getSourceDraftParameterAliasInfo,
    hasSourceDraftCitationIdentity,
    findExistingSources,
    joinAuthorDraftRow,
    listExistingSourceSections,
    listExistingSources,
    listSourceDraftParameterCollisions,
    listSourceDraftParameterNames,
    normalizeSourceUrl,
    parseSourceDraft,
    parseSourceInput,
    parseSourceUrl,
    replaceExistingSource,
    serializeSourceDraft,
    serializeSourceDraftForEdit,
    splitAuthorDraftRow,
    type SourceDraft,
} from '../../src/source-editor/domain/source-manager.ts';
import { citationTemplateData as templateData } from '../../src/source-editor/config/citation-template-data/index.ts';
import {
    createTemplateNameContext,
    normalizeTemplateName,
    SUPPORTED_CITATION_TEMPLATES,
} from '../../src/source-editor/domain/templates.ts';
import { formatSourceUsageTitle } from '../../src/source-editor/features/source-manager/list-presentation.ts';
import { buildSourceSectionSelectors } from '../../src/source-editor/features/source-manager/controller.ts';
import { buildCs1CheckWikitext } from '../../src/source-editor/platform/mediawiki/cs1-check.ts';
import { decodeReferenceDetailsAttribute } from '../../src/source-editor/domain/ref-attributes.ts';
import { wikitext } from '../../src/library/wikitext/index.ts';

test('keeps template-valued subreference details outside editable source bodies', () => {
    const details =
        '{{cite web|title=Attribute<!-- keep -->|language=ja}} > {{r|Other}}';
    const text = [
        `<ref name="Book" details='${details}'>{{cite book|title=Actual|year=2020}}</ref>`,
        '<ref name="Book" details="p. 42" />',
    ].join('\n');
    const sources = listExistingSources(text);

    assert.equal(sources.length, 1);
    assert.equal(sources[0].title, 'Actual');
    assert.equal(sources[0].referenceDetails, details);
    assert.equal(sources[0].usageCount, 2);
    assert.deepEqual(formatSourceScriptTitles(text, 'enwiki'), {
        formatted: 0,
        text,
    });
    getRow(sources[0].draft, 'title').value = 'Updated';
    const edited = replaceExistingSource(
        text,
        sources[0],
        sources[0].draft,
        'inline',
    );
    assert.ok(edited.includes(`details='${details}'`));
    assert.ok(edited.endsWith('<ref name="Book" details="p. 42" />'));
    assert.match(edited, /title = Updated/u);
});

test('builds safely quoted grouped subreferences even in compact reference style', () => {
    const [source] = listExistingSources(
        '<ref name="Book" group="note">{{cite book|title=Example}}</ref>',
    );
    const details = 'p. 23, "a < b & c" {{URL|https://example.test/?x=1&y=2}}';
    const reuse = buildExistingSourceReference(source, true, details);
    const [tag] = wikitext(reuse).reference.getAll();

    assert.ok(tag.selfClosing);
    assert.equal(tag.attributes.name, 'Book');
    assert.equal(tag.attributes.group, 'note');
    assert.equal(
        decodeReferenceDetailsAttribute(tag.attributes.details),
        details,
    );
    assert.match(reuse, /&quot;a &lt; b &amp; c&quot;/u);
    assert.equal(
        buildExistingSourceReference(source, true, ''),
        '<ref name="Book" group="note" />',
    );
    assert.throws(() =>
        buildExistingSourceReference(
            { ...source, referenceName: '' },
            false,
            'p. 23',
        ),
    );
});

test('matches numeric entity names and preserves literal entities in reuse attributes', () => {
    const text = [
        "<ref name='A\"B' />",
        '<ref name="A&#34;B">{{cite book|title=Quoted}}</ref>',
        '<ref name="Literal&amp;quot;" group="note&amp;quot;">{{cite book|title=Literal}}</ref>',
        '<ref name="Literal&amp;quot;" group="note&amp;quot;" details="p. 23" />',
    ].join('\n');
    const sources = listExistingSources(text);

    assert.deepEqual(
        sources.map((source) => source.usageCount),
        [2, 2],
    );
    assert.equal(
        buildExistingSourceReference(sources[0]),
        '<ref name="A&quot;B" />',
    );
    assert.equal(
        buildExistingSourceReference(sources[1], true),
        '<ref name="Literal&amp;quot;" group="note&amp;quot;" />',
    );
    assert.equal(
        listExistingSources(
            text + buildExistingSourceReference(sources[1], true, 'p. 42'),
        )[1].usageCount,
        3,
    );
    assert.equal(
        buildExistingSourceReference({ ...sources[1], group: '' }, true),
        '<ref name="Literal&amp;quot;" />',
    );
});

test('matches HTML5 named entities and keeps nested literal identities distinct', () => {
    const text = [
        '<ref name="é" group="é" />',
        '<ref name="&eacute;" group="&eacute;" details="&eacute;">{{cite book|title=Character}}</ref>',
        '<ref name="&amp;eacute;" group="&amp;eacute;" details="&amp;eacute;">{{cite book|title=Literal}}</ref>',
        '<ref name="&amp;eacute;" group="&amp;eacute;" />',
    ].join('\n');
    const sources = listExistingSources(text);

    assert.deepEqual(
        sources.map((source) => source.usageCount),
        [2, 2],
    );
    assert.deepEqual(
        sources.map((source) => source.referenceName),
        ['é', '&eacute;'],
    );
    assert.deepEqual(
        sources.map((source) => source.group),
        ['é', '&eacute;'],
    );
    assert.deepEqual(
        sources.map((source) => source.referenceDetails),
        ['é', '&eacute;'],
    );
    assert.equal(
        buildExistingSourceReference(
            sources[0],
            true,
            sources[0].referenceDetails,
        ),
        '<ref name="é" group="é" details="é" />',
    );
    assert.equal(
        buildExistingSourceReference(
            sources[1],
            true,
            sources[1].referenceDetails,
        ),
        '<ref name="&amp;eacute;" group="&amp;eacute;" details="&amp;eacute;" />',
    );
    const edited =
        text +
        sources
            .map((source) => buildExistingSourceReference(source))
            .join('\n');
    assert.deepEqual(
        listExistingSources(edited).map((source) => source.usageCount),
        [3, 3],
    );
});

test('converts plain sources without discarding native ref attributes or details', () => {
    const opening =
        '<ref dir="rtl" name="Book" group="" details=\'p. &gt; 23, "quote" {{URL|https://example.test}}\'>';
    const text = opening + 'Original bibliography.</ref>';
    const [source] = listExistingSources(text);
    const draft = parseSourceDraft('{{cite book|title=Updated|year=2020}}');
    const edited = replaceExistingSource(text, source, draft, 'inline');

    assert.ok(edited.startsWith(opening));
    assert.ok(edited.endsWith('</ref>'));
    assert.match(edited, /title = Updated/u);
});

test('uses the reference-list group for explicit empty and conflicting child groups', () => {
    const text = [
        '<ref name="Book" group="" />',
        '<ref name="Book" group="note" details="p. 23" />',
        '<references group=""><ref name="Book">{{cite book|title=Default}}</ref></references>',
        '<references group="note"><ref name="Book" group="">{{cite book|title=Note}}</ref></references>',
        '<references group="other"><ref name="Book" group="wrong">{{cite book|title=Other}}</ref></references>',
    ].join('\n');
    const sources = listExistingSources(text);

    assert.deepEqual(
        sources.map((source) => [
            source.title,
            source.group,
            source.usageCount,
        ]),
        [
            ['Default', '', 1],
            ['Note', 'note', 1],
            ['Other', 'other', 0],
        ],
    );
    assert.equal(
        buildExistingSourceReference(sources[0]),
        '<ref name="Book" />',
    );
    assert.equal(
        buildExistingSourceReference(sources[1]),
        '<ref name="Book" group="note" />',
    );
});

test('resolves forward and paired-empty reuses to one main source per group', () => {
    const text = [
        '<ref name="Book"></ref>',
        '<ref name="Book" details="p. 23" />',
        '<ref name="Book">{{cite book|title=Main|year=2020}}</ref>',
        '<ref name="Book" details="p. 42">{{cite book|title=Main|year=2020}}</ref>',
        '<ref name="Book" group="note">{{cite book|title=Different group}}</ref>',
    ].join('\n');
    const sources = listExistingSources(text);

    assert.deepEqual(
        sources.map((source) => [
            source.title,
            source.group,
            source.usageCount,
        ]),
        [
            ['Main', '', 4],
            ['Different group', 'note', 1],
        ],
    );
    getRow(sources[0].draft, 'title').value = 'Updated';
    const edited = replaceExistingSource(
        text,
        sources[0],
        sources[0].draft,
        'inline',
    );
    assert.equal([...edited.matchAll(/title = Updated/gu)].length, 2);
    assert.ok(edited.includes('<ref name="Book" details="p. 42">'));
    assert.ok(edited.includes('<ref name="Book" details="p. 23" />'));
    assert.ok(
        edited.endsWith(
            '<ref name="Book" group="note">{{cite book|title=Different group}}</ref>',
        ),
    );
});

test('retains the first main definition and conflicting duplicate content', () => {
    const text =
        '<ref name="Book">{{cite book|title=First}}</ref>\n<ref name="Book">{{cite book|title=Conflicting}}</ref>';
    const sources = listExistingSources(text);

    assert.equal(sources.length, 1);
    assert.equal(sources[0].title, 'First');
    assert.equal(sources[0].usageCount, 2);
    getRow(sources[0].draft, 'title').value = 'Updated';
    const edited = replaceExistingSource(
        text,
        sources[0],
        sources[0].draft,
        'inline',
    );
    assert.ok(
        edited.endsWith(
            '<ref name="Book">{{cite book|title=Conflicting}}</ref>',
        ),
    );
});

test('does not count short-footnote templates in subreference attributes as prose uses', () => {
    const text = [
        '<ref name="Book" details="{{sfn|Smith|2020}}">Plain source.</ref>',
        '* {{cite book|last=Smith|year=2020|title=Uncited bibliography}}',
    ].join('\n');
    assert.equal(listExistingSources(text).length, 1);
});

function getRow(draft: SourceDraft, name: string) {
    const row = draft.rows.find((candidate) => candidate.name === name);
    assert.ok(row, `Missing ${name} row`);
    return row;
}

const englishTemplateNames = createTemplateNameContext('enwiki');
const chineseTemplateNames = createTemplateNameContext('zhwiki');

const testSourceUrlParsing = () => {
    const normal = parseSourceUrl(' https://example.test/a?x=1&amp;y=2 ');
    assert.deepEqual(normal, {
        archiveDate: '',
        archiveUrl: '',
        originalUrl: 'https://example.test/a?x=1&y=2',
    });

    const archive = parseSourceUrl(
        'https://web.archive.org/web/20240203040506id_/https://example.test/a?x=1',
    );
    assert.deepEqual(archive, {
        archiveDate: '2024-02-03',
        archiveUrl:
            'https://web.archive.org/web/20240203040506id_/https://example.test/a?x=1',
        originalUrl: 'https://example.test/a?x=1',
    });
    assert.equal(
        parseSourceUrl(
            'https://web.archive.org/web/20249999/https://example.test',
        )?.archiveDate,
        '',
    );
    assert.equal(
        parseSourceUrl('https://web.archive.org/web/2024/https://example.test')
            ?.archiveDate,
        '',
    );
    assert.equal(parseSourceUrl('ftp://example.test/file'), null);
    assert.equal(parseSourceUrl('not a url'), null);
};
test('parses normal and Wayback source URLs', testSourceUrlParsing);

test('accepts identifiers and citation text as source input', () => {
    assert.deepEqual(parseSourceInput(' 978-0-306-40615-7 '), {
        archiveDate: '',
        archiveUrl: '',
        originalUrl: '',
        search: '978-0-306-40615-7',
    });
    assert.deepEqual(parseSourceInput('https://example.test/article'), {
        archiveDate: '',
        archiveUrl: '',
        originalUrl: 'https://example.test/article',
        search: 'https://example.test/article',
    });
    assert.deepEqual(parseSourceInput('ISSN 2049-3630'), {
        archiveDate: '',
        archiveUrl: '',
        originalUrl: '',
        search: 'ISSN 2049-3630',
    });
    assert.equal(parseSourceInput('   '), null);
});

const testEncodedWaybackUrl = () => {
    const entered =
        'https://web.archive.org/web/20200102im_/' +
        'https%3A%2F%2Fexample.test%2Fimage%3Fa%3D1';
    const archive = parseSourceUrl(entered);
    assert.deepEqual(archive, {
        archiveDate: '2020-01-02',
        archiveUrl: entered,
        originalUrl: 'https://example.test/image?a=1',
    });
};
test('decodes an encoded Wayback target', testEncodedWaybackUrl);

test('makes pasted URL delimiters safe for wikitext', () => {
    assert.deepEqual(parseSourceUrl('https://example.test/a?x=one|two'), {
        archiveDate: '',
        archiveUrl: '',
        originalUrl: 'https://example.test/a?x=one%7Ctwo',
    });

    const entered =
        'https://web.archive.org/web/20240203040506/' +
        'https://example.test/a?x=one|two';
    assert.deepEqual(parseSourceUrl(entered), {
        archiveDate: '2024-02-03',
        archiveUrl:
            'https://web.archive.org/web/20240203040506/' +
            'https://example.test/a?x=one%7Ctwo',
        originalUrl: 'https://example.test/a?x=one%7Ctwo',
    });
});

test('preserves a hash-routed Wayback target', () => {
    const entered =
        'https://web.archive.org/web/20240203040506/' +
        'https://example.test/#/article';
    assert.deepEqual(parseSourceUrl(entered), {
        archiveDate: '2024-02-03',
        archiveUrl: entered,
        originalUrl: 'https://example.test/#/article',
    });
});

const testUrlNormalization = () => {
    const left = normalizeSourceUrl(
        'HTTPS://Example.Test:443/a?z=2&amp;a=1#section',
    );
    const right = normalizeSourceUrl('https://example.test/a?a=1&z=2');
    assert.notEqual(left, right);

    const repeatedLeft = normalizeSourceUrl(
        'https://example.test/a?tag=z&tag=a',
    );
    const repeatedRight = normalizeSourceUrl(
        'https://example.test/a?tag=a&tag=z',
    );
    assert.notEqual(repeatedLeft, repeatedRight);
    assert.notEqual(
        normalizeSourceUrl('https://example.test/a?id=1'),
        normalizeSourceUrl('https://example.test/a?id=2'),
    );
    assert.notEqual(
        normalizeSourceUrl('https://example.test/a?page=one'),
        normalizeSourceUrl('https://example.test/a?page=two'),
    );
};
test(
    'normalizes URL syntax but preserves meaningful queries',
    testUrlNormalization,
);

const testDraftParsing = () => {
    const draft = parseSourceDraft(
        '{{cite web|URL=https://example.test|title=Example|' +
            'author=作者<!-- !no-author # Sakusha -->|' +
            'publisher=会社<!-- !no-author -->|format=PDF|quote=}}',
    );
    const mainNames = draft.rows
        .filter((row) => row.main)
        .map((row) => row.name);
    assert.deepEqual(mainNames, [
        'URL',
        'title',
        'author',
        'publisher',
        'website',
        'date',
        'access-date',
        'archive-url',
        'archive-date',
        'url-status',
        'language',
    ]);
    assert.equal(getRow(draft, 'website').value, '');
    assert.equal(getRow(draft, 'author').value, '作者');
    assert.equal(getRow(draft, 'author').alias, 'Sakusha');
    assert.equal(getRow(draft, 'author').directive, '!no-author');
    assert.equal(getRow(draft, 'publisher').value, '会社');
    assert.equal(getRow(draft, 'publisher').directive, '!no-author');
    assert.equal(getRow(draft, 'format').value, 'PDF');
    assert.equal(getRow(draft, 'format').main, false);
    assert.equal(getRow(draft, 'quote').value, '');
    assert.equal(getRow(draft, 'quote').main, false);

    const sentinel = parseSourceDraft(
        '{{cite web|title=__CF_SOURCE_MANAGER_EMPTY_0__}}',
    );
    assert.equal(
        getRow(sentinel, 'title').value,
        '__CF_SOURCE_MANAGER_EMPTY_0__',
    );
};
test('seeds editable main fields and separates aliases', testDraftParsing);

test('preserves entered values until item-level sorting is requested', () => {
    const raw =
        '{{Cite web | language = japanese | URL = https://example.test }}';
    const draft = parseSourceDraft(raw);

    assert.match(
        serializeSourceDraftForEdit(draft, 'inline'),
        /language = japanese/u,
    );
    assert.match(serializeSourceDraftForEdit(draft, 'inline'), /URL =/u);

    const changed = changeSourceDraftTemplate(draft, 'cite book');
    assert.match(
        serializeSourceDraftForEdit(changed, 'inline'),
        /language = japanese/u,
    );
    assert.match(serializeSourceDraftForEdit(changed, 'inline'), /URL =/u);

    canonicalizeSourceDraft(draft);

    assert.match(
        serializeSourceDraftForEdit(draft, 'inline'),
        /language = ja/u,
    );
    assert.match(serializeSourceDraftForEdit(draft, 'inline'), /url =/u);
});

test('splits a comma-delimited author into last and first fields', () => {
    const draft = parseSourceDraft(
        '{{cite web|author=Shinji, Noguchi|title=Example}}',
    );
    const author = getRow(draft, 'author');
    author.alias = 'Noguchi';
    author.directive = '!no-author';
    ensureNextAuthorDraftRows(draft);
    const index = draft.rows.indexOf(author);

    assert.equal(canSplitAuthorDraftRow(draft, index), true);
    assert.equal(splitAuthorDraftRow(draft, index), true);
    assert.equal(getRow(draft, 'last').value, 'Shinji');
    assert.equal(getRow(draft, 'last').alias, 'Noguchi');
    assert.equal(getRow(draft, 'last').directive, '!no-author');
    assert.equal(getRow(draft, 'first').value, 'Noguchi');
    assert.equal(getRow(draft, 'first').alias, '');
    assert.equal(getRow(draft, 'author2').value, '');
    assert.match(
        serializeSourceDraft(draft, 'inline'),
        /last = Shinji <!-- !no-author # Noguchi --> \| first = Noguchi/u,
    );
    const lastIndex = draft.rows.indexOf(getRow(draft, 'last'));
    assert.equal(canJoinAuthorDraftRow(draft, lastIndex), true);
    assert.equal(joinAuthorDraftRow(draft, lastIndex), true);
    assert.equal(getRow(draft, 'author').value, 'Shinji, Noguchi');
    assert.equal(getRow(draft, 'author').alias, 'Noguchi');
    assert.equal(getRow(draft, 'author').directive, '!no-author');
    assert.equal(
        draft.rows.some((row) => row.name === 'first'),
        false,
    );
});

test('splits an English display name at its final word', () => {
    const draft = parseSourceDraft(
        '{{cite web|author=Tom G. Goodman|title=Example}}',
    );
    const index = draft.rows.indexOf(getRow(draft, 'author'));

    assert.equal(splitAuthorDraftRow(draft, index), true);
    assert.equal(getRow(draft, 'last').value, 'Goodman');
    assert.equal(getRow(draft, 'first').value, 'Tom G.');
});

test('adds numbered author slots without duplicating them', () => {
    const draft = parseSourceDraft(
        '{{cite web|author1=Shinji, Noguchi|' +
            'author2=Tom G. Goodman|title=Example}}',
    );
    ensureNextAuthorDraftRows(draft);
    ensureNextAuthorDraftRows(draft);

    assert.equal(draft.rows.filter((row) => row.name === 'author3').length, 1);
    assert.equal(
        splitAuthorDraftRow(
            draft,
            draft.rows.indexOf(getRow(draft, 'author1')),
        ),
        true,
    );
    assert.equal(
        splitAuthorDraftRow(
            draft,
            draft.rows.indexOf(getRow(draft, 'author2')),
        ),
        true,
    );
    assert.equal(getRow(draft, 'last1').value, 'Shinji');
    assert.equal(getRow(draft, 'first1').value, 'Noguchi');
    assert.equal(getRow(draft, 'last2').value, 'Goodman');
    assert.equal(getRow(draft, 'first2').value, 'Tom G.');
    assert.equal(
        joinAuthorDraftRow(draft, draft.rows.indexOf(getRow(draft, 'last1'))),
        true,
    );
    assert.equal(getRow(draft, 'author1').value, 'Shinji, Noguchi');
});

test('adds author slots without reordering rows during editing', () => {
    const draft = parseSourceDraft(
        '{{cite web|author=Author|title=Example|url=https://example.test}}',
    );
    const author = getRow(draft, 'author');
    const title = getRow(draft, 'title');
    const url = getRow(draft, 'url');
    draft.rows = [url, author, title];

    ensureNextAuthorDraftRows(draft);

    assert.deepEqual(
        draft.rows.map((row) => row.name),
        ['url', 'author', 'author2', 'title'],
    );
});

test('retains structured author fields across template changes', () => {
    const draft = parseSourceDraft(
        '{{cite web|author=Tom G. Goodman|title=Example}}',
    );
    splitAuthorDraftRow(draft, draft.rows.indexOf(getRow(draft, 'author')));

    const changed = changeSourceDraftTemplate(draft, 'cite book');

    assert.equal(getRow(changed, 'last').main, true);
    assert.equal(getRow(changed, 'first').main, true);
    assert.equal(
        changed.rows.some((row) => row.name === 'author'),
        false,
    );
});

test('structures blank and single names without overwriting existing rows', () => {
    const blank = createManualSourceDraft();
    const blankIndex = blank.rows.indexOf(getRow(blank, 'author'));
    assert.equal(canSplitAuthorDraftRow(blank, blankIndex), true);
    assert.equal(splitAuthorDraftRow(blank, blankIndex), true);
    assert.equal(getRow(blank, 'last').value, '');
    assert.equal(getRow(blank, 'first').value, '');
    const blankLastIndex = blank.rows.indexOf(getRow(blank, 'last'));
    assert.equal(joinAuthorDraftRow(blank, blankLastIndex), true);
    assert.equal(getRow(blank, 'author').value, '');

    const single = parseSourceDraft(
        '{{cite web|author=Mononymous|title=Example}}',
    );
    const singleIndex = single.rows.indexOf(getRow(single, 'author'));
    assert.equal(canSplitAuthorDraftRow(single, singleIndex), true);
    assert.equal(splitAuthorDraftRow(single, singleIndex), true);
    assert.equal(getRow(single, 'last').value, 'Mononymous');
    assert.equal(getRow(single, 'first').value, '');

    const collision = parseSourceDraft(
        '{{cite web|author=Tom Goodman|title=Example}}',
    );
    collision.rows.push({
        alias: '',
        directive: '',
        main: false,
        name: 'last',
        value: '',
    });
    assert.equal(canSplitAuthorDraftRow(collision, 0), false);
});

test('creates an offline magazine draft without requiring a URL', () => {
    const draft = createManualSourceDraft();
    const mainNames = draft.rows
        .filter((row) => row.main)
        .map((row) => row.name);

    assert.equal(draft.template, 'cite magazine');
    assert.deepEqual(mainNames, [
        'author',
        'date',
        'title',
        'url',
        'url-status',
        'archive-url',
        'archive-date',
        'access-date',
        'magazine',
        'publisher',
        'location',
        'page',
        'pages',
        'language',
        'volume',
        'issue',
        'issn',
    ]);
    assert.ok(draft.rows.every((row) => row.value === ''));

    getRow(draft, 'title').value = 'Offline feature';
    getRow(draft, 'magazine').value = 'Example Monthly';
    getRow(draft, 'date').value = 'July 2026';
    getRow(draft, 'pages').value = '12–17';
    const citation = serializeSourceDraft(draft, 'inline');

    assert.match(citation, /^\{\{Cite magazine \|/u);
    assert.match(citation, /\| magazine = Example Monthly/u);
    assert.match(citation, /\| pages = 12–17/u);
    assert.doesNotMatch(citation, /\| url =/u);
});

test('seeds only common parameters supported by cite tweet', () => {
    const draft = createManualSourceDraft('Cite tweet');
    const mainNames = draft.rows
        .filter((row) => row.main)
        .map((row) => row.name);

    assert.deepEqual(mainNames, [
        'number',
        'user',
        'title',
        'author',
        'date',
        'access-date',
        'language',
        'link',
    ]);
    assert.doesNotMatch(mainNames.join(' '), /\b(?:url|website|publisher)\b/u);
});

test('seeds only parameters supported by each selected template', () => {
    for (const displayName of SUPPORTED_CITATION_TEMPLATES) {
        const name = normalizeTemplateName(displayName);
        const metadata = templateData[name];
        const supported = new Set([
            ...metadata.paramOrder,
            ...Object.keys(metadata.aliases),
            ...Object.values(metadata.aliases).flat(),
        ]);
        const draft = createManualSourceDraft(displayName);
        for (const row of draft.rows.filter((candidate) => candidate.main)) {
            assert.ok(supported.has(row.name), `${displayName}: ${row.name}`);
        }
    }
});

test('changes manual citation types without losing entered fields', () => {
    const draft = createManualSourceDraft();
    getRow(draft, 'author').value = '作者';
    getRow(draft, 'author').alias = 'Sakusha';
    getRow(draft, 'title').value = 'Collected work';
    getRow(draft, 'magazine').value = 'Example Monthly';
    draft.rows.push({
        alias: '',
        directive: '',
        main: false,
        name: 'quote',
        value: 'Preserved note',
    });

    const changed = changeSourceDraftTemplate(draft, 'Cite book');

    assert.equal(changed.template, 'cite book');
    assert.equal(getRow(changed, 'author').value, '作者');
    assert.equal(getRow(changed, 'author').alias, 'Sakusha');
    assert.equal(getRow(changed, 'title').value, 'Collected work');
    assert.equal(getRow(changed, 'work').value, 'Example Monthly');
    assert.equal(getRow(changed, 'quote').value, 'Preserved note');
    assert.equal(
        changed.rows.some((row) => row.name === 'magazine'),
        false,
    );
    assert.ok(getRow(changed, 'isbn').main);
});

test('preserves populated unsupported fields as extras on type changes', () => {
    const draft = createManualSourceDraft('Cite web');
    getRow(draft, 'title').value = 'Example tweet';
    getRow(draft, 'url').value = 'https://example.test/tweet';

    const changed = changeSourceDraftTemplate(draft, 'Cite tweet');

    assert.equal(getRow(changed, 'url').value, 'https://example.test/tweet');
    assert.equal(getRow(changed, 'url').main, false);
    assert.equal(
        changed.rows.some((row) => row.name === 'website'),
        false,
    );
    assert.equal(
        changed.rows.some((row) => row.name === 'publisher'),
        false,
    );
});

test('maps a periodical field when changing manual citation types', () => {
    const draft = createManualSourceDraft();
    getRow(draft, 'title').value = 'Print feature';
    getRow(draft, 'magazine').value = 'Example Monthly';

    const changed = changeSourceDraftTemplate(draft, 'Cite web');

    assert.equal(getRow(changed, 'website').value, 'Example Monthly');
    assert.equal(
        changed.rows.some((row) => row.name === 'magazine'),
        false,
    );
    assert.match(
        serializeSourceDraft(changed, 'inline'),
        /\| website = Example Monthly/u,
    );
});

test('suffixes colliding populated aliases without dropping one', () => {
    const draft = createManualSourceDraft();
    getRow(draft, 'magazine').value = 'Magazine A';
    draft.rows.push({
        alias: '',
        directive: '',
        main: false,
        name: 'work',
        value: 'Work B',
    });

    const changed = changeSourceDraftTemplate(draft, 'Cite book');

    assert.deepEqual(
        changed.rows.filter((row) => row.value !== '').map((row) => row.name),
        ['magazine', 'work'],
    );
    assert.equal(getRow(changed, 'magazine').value, 'Magazine A');
    assert.equal(getRow(changed, 'work').value, 'Work B');
    assert.deepEqual(listSourceDraftParameterCollisions(changed), [
        {
            canonicalParameter: 'work',
            firstParameter: 'magazine',
            renamedParameter: 'work-a',
            secondParameter: 'work',
        },
    ]);
    assert.equal(
        serializeSourceDraft(changed, 'inline'),
        '{{Cite book | work = Magazine A | work-a = Work B }}',
    );
});

test('keeps repeated draft parameters adjacent and stable', () => {
    const entered =
        '{{cite journal|journal=J1|issue=48|journal=J2|title=T|' +
        'journal=J3|doi=D}}';
    const draft = parseSourceDraft(entered);

    assert.deepEqual(
        listSourceDraftParameterCollisions(draft).map(
            (collision) => collision.renamedParameter,
        ),
        ['journal-a', 'journal-b'],
    );
    assert.equal(
        serializeSourceDraftForEdit(draft, 'inline'),
        '{{Cite journal | journal = J1 | journal-a = J2 | ' +
            'journal-b = J3 | issue = 48 | title = T | doi = D }}',
    );

    canonicalizeSourceDraft(draft);
    assert.deepEqual(
        draft.rows.filter((row) => row.value !== '').map((row) => row.name),
        ['title', 'journal', 'journal-a', 'journal-b', 'issue', 'doi'],
    );
    const first = serializeSourceDraft(draft, 'inline');
    const roundTrip = parseSourceDraft(first);
    canonicalizeSourceDraft(roundTrip);
    assert.equal(serializeSourceDraft(roundTrip, 'inline'), first);
});

test('reuses existing alphabetic repeat markers', () => {
    const draft = parseSourceDraft(
        '{{cite journal|journal=A|journal-a=B|journal=C|title=T}}',
    );

    assert.equal(
        serializeSourceDraft(draft, 'inline'),
        '{{Cite journal | title = T | journal = A | journal-a = B | ' +
            'journal-b = C }}',
    );
});

const testDraftSerialization = () => {
    const draft = parseSourceDraft('{{cite web|title=Example}}');
    getRow(draft, 'author').value = '作者';
    getRow(draft, 'author').alias = 'Sakusha';
    getRow(draft, 'author').directive = '!no-author';
    getRow(draft, 'url').value = 'https://example.test';
    getRow(draft, 'access-date').value = 'June 7, 2025';

    const inline = serializeSourceDraft(
        draft,
        'inline',
        resolveWikiPolicy('zhwiki'),
    );
    assert.equal(
        inline,
        '{{Cite web | author = 作者 <!-- !no-author # Sakusha --> | ' +
            'title = Example | url = https://example.test | ' +
            'access-date = 2025-06-07 }}',
    );
    const block = serializeSourceDraft(
        draft,
        'block',
        resolveWikiPolicy('zhwiki'),
    );
    assert.match(block, /^\{\{Cite web\n  \| author =/u);
    assert.doesNotMatch(block, /\| website =/u);

    getRow(draft, 'website').alias = 'Ignored without a value';
    assert.doesNotMatch(serializeSourceDraft(draft, 'inline'), /website/u);
};
test(
    'serializes populated source fields in both layouts',
    testDraftSerialization,
);

test('identifies fields actively forming a generated reference name', () => {
    const draft = parseSourceDraft(
        '{{cite web|author=Noguchi, Shinji|date=2007-06-18|' +
            'page=2|title=Long interview|website=Example}}',
    );
    const indexes = new Set(getSourceDraftCitationNameCells(draft).keys());
    const names = draft.rows
        .filter((_row, index) => indexes.has(index))
        .map((row) => row.name);

    assert.deepEqual(names, ['author', 'date', 'page']);
});

test('lists canonical parameter names for combobox hints', () => {
    const draft = createManualSourceDraft('cite web');
    const names = listSourceDraftParameterNames(draft);

    assert.ok(names.includes('title'));
    assert.ok(names.includes('url-status'));
    assert.equal(new Set(names).size, names.length);
});

test('describes canonical and alternative parameter names', () => {
    const draft = createManualSourceDraft('cite web');

    assert.deepEqual(getSourceDraftParameterAliasInfo(draft, 'accessdate'), {
        aliases: ['accessdate'],
        canonical: 'access-date',
        isAlias: true,
    });
    assert.deepEqual(getSourceDraftParameterAliasInfo(draft, 'URL'), {
        aliases: ['URL'],
        canonical: 'url',
        isAlias: true,
    });
    assert.equal(getSourceDraftParameterAliasInfo(draft, 'custom'), null);
});

test('highlights eligible fallback name fields after directives', () => {
    const draft = parseSourceDraft(
        '{{cite web|author=Author<!-- !no-author -->|' +
            'website=Example Site|publisher=Publisher|' +
            'date=2025<!-- !no-date -->|year=2007|' +
            'page=1<!-- !no-part -->|pages=2–3|title=Example}}',
    );
    const indexes = new Set(getSourceDraftCitationNameCells(draft).keys());
    const names = draft.rows
        .filter((_row, index) => indexes.has(index))
        .map((row) => row.name);

    assert.deepEqual(names, ['publisher', 'year', 'pages']);

    getRow(draft, 'publisher').directive = '!no-author';
    const fallbackIndexes = new Set(
        getSourceDraftCitationNameCells(draft).keys(),
    );
    const fallbackNames = draft.rows
        .filter((_row, index) => fallbackIndexes.has(index))
        .map((row) => row.name);

    assert.deepEqual(fallbackNames, ['website', 'year', 'pages']);
});

test('identifies only the exact value or alias cells visible in a name', () => {
    const draft = parseSourceDraft(
        '{{cite web|author1=One<!-- # Uno -->|author2=Two|' +
            'author3=Three|author4=Four|date=2025|title=Example}}',
    );
    ensureNextAuthorDraftRows(draft);
    const cells = [...getSourceDraftCitationNameCells(draft)].map(
        ([index, cell]) => [draft.rows[index].name, cell],
    );

    assert.deepEqual(
        draft.rows.slice(0, 6).map((row) => row.name),
        ['author1', 'author2', 'author3', 'author4', 'author5', 'date'],
    );
    assert.deepEqual(cells, [
        ['author1', 'alias'],
        ['date', 'value'],
    ]);
});

test('builds author, year, and part reference-name components', () => {
    const draft = parseSourceDraft(
        '{{cite web|author=作者<!-- # Shizi -->|date=2025-07-27|' +
            'page=4|title=Example}}',
    );

    assert.deepEqual(getSourceDraftCitationNameParts(draft), {
        author: 'Shizi',
        part: 'p. 4',
        year: '2025',
    });
});

test('suggests creator aliases previously used in other source roles', () => {
    const sources = listExistingSources(
        '<ref name="Noguchi, 2007">{{Cite interview|' +
            'interviewer=野口伸二<!-- # Noguchi, Shinji -->|' +
            'date=2007|title=Interview}}</ref>',
    );
    const suggestions = findCreatorAliasSuggestions(sources, {
        alias: '',
        directive: '',
        main: false,
        name: 'author2',
        value: '野口伸二',
    });

    assert.deepEqual(suggestions, [{ alias: 'Noguchi, Shinji', count: 1 }]);
});

test('keeps conflicting creator alias suggestions explicit', () => {
    const sources = listExistingSources(
        [
            '<ref name="A">{{Cite web|author=',
            '[[野口伸二]]<!-- # Noguchi, Shinji -->|title=A}}</ref>',
            '<ref name="B">{{Cite web|author=',
            '野口伸二<!-- # Shinji Noguchi -->|title=B}}</ref>',
        ].join(''),
    );
    const suggestions = findCreatorAliasSuggestions(sources, {
        alias: '',
        directive: '',
        main: false,
        name: 'translator-last',
        value: ' 野口伸二 ',
    });

    assert.deepEqual(suggestions, [
        { alias: 'Noguchi, Shinji', count: 1 },
        { alias: 'Shinji Noguchi', count: 1 },
    ]);
});

const testExistingSourceListing = () => {
    const text = [
        'Lead.',
        '<references group="note"><ref name="A &amp; B" group="note">',
        '{{cite web|title=Example|url=https://example.test/a}}',
        '</ref></references>',
    ].join('');
    const [source] = listExistingSources(text);

    assert.equal(source.referenceName, 'A & B');
    assert.equal(source.group, 'note');
    assert.equal(source.title, 'Example');
    assert.equal(source.url, 'https://example.test/a');
    assert.equal(
        source.rawTemplate,
        text.slice(source.templateStart, source.templateEnd),
    );
    assert.equal(
        source.rawReference,
        text.slice(source.referenceStart, source.referenceEnd),
    );
    assert.equal(source.reuseText, '<ref name="A &amp; B" group="note" />');
    assert.equal(buildExistingSourceReference(source), source.reuseText);
    assert.equal(
        buildExistingSourceReference(source, true),
        '<ref name="A &amp; B" group="note" />',
    );
    assert.equal(
        buildExistingSourceReference(
            { group: '', rawReference: '', referenceName: 'Plain' },
            true,
        ),
        '{{r|Plain}}',
    );
};
test(
    'lists source definitions with exact ranges and reuse tags',
    testExistingSourceListing,
);

test('filters existing sources by all entered keywords', () => {
    const sources = listExistingSources(
        [
            '<ref name="Alpha">',
            '{{cite web|author=Jane Doe|title=First report|' +
                'url=https://example.test/alpha|publisher=Example Press}}',
            '</ref>',
            '<ref name="Beta" group="note">',
            '{{cite book|author=John Roe|title=Second report|' +
                'url=https://books.test/beta|publisher=Other House}}',
            '</ref>',
        ].join(''),
    );

    assert.deepEqual(
        filterExistingSources(sources, 'JANE press').map(
            (source) => source.referenceName,
        ),
        ['Alpha'],
    );
    assert.deepEqual(
        filterExistingSources(sources, 'cite book NOTE').map(
            (source) => source.referenceName,
        ),
        ['Beta'],
    );
    assert.deepEqual(
        filterExistingSources(sources, 'books second').map(
            (source) => source.referenceName,
        ),
        ['Beta'],
    );
    assert.deepEqual(filterExistingSources(sources, 'report'), sources);
    assert.deepEqual(filterExistingSources(sources, 'missing'), []);
    assert.equal(filterExistingSources(sources, '   '), sources);
});

test('filters equivalent fragment and Wayback URLs while preserving keyword searches', () => {
    const sources = listExistingSources(
        [
            '<ref name="First">{{cite web|title=First report|url=https://example.test/article}}</ref>',
            '<ref name="Second" group="note">{{cite web|title=Second report|url=https://example.test/article}}</ref>',
            '<ref name="Other">{{cite web|title=Other report|url=https://other.test/report}}</ref>',
        ].join('\n'),
    );
    for (const query of [
        'https://example.test/article#section',
        'https://web.archive.org/web/20200102030405/https://example.test/article',
    ]) {
        assert.deepEqual(
            filterExistingSources(sources, query).map(
                (source) => source.referenceName,
            ),
            ['First', 'Second'],
        );
    }
    assert.deepEqual(
        filterExistingSources(sources, 'example.test/art').map(
            (source) => source.referenceName,
        ),
        ['First', 'Second'],
    );
    assert.deepEqual(
        filterExistingSources(sources, 'second report').map(
            (source) => source.referenceName,
        ),
        ['Second'],
    );
});

test('finds a creator by an exact or slightly misspelled alias key', () => {
    const [source] = listExistingSources(
        '<ref>{{cite magazine|' +
            'author1=初芝弘也<!-- # Hatsushiba, Horiya -->|' +
            'title=Interview}}</ref>',
    );

    assert.deepEqual(filterExistingSources([source], 'Hatsushiba'), [source]);
    assert.deepEqual(filterExistingSources([source], 'Hiroya'), [source]);
    assert.deepEqual(filterExistingSources([source], 'unrelated'), []);
});

function buildSectionFilterText(): string {
    return [
        'Lead.<ref name="Alpha" />',
        '== First ==',
        'First.<ref name="Beta" />',
        '=== Child ===',
        'Child.<ref name="Alpha" /><ref name="Child" />',
        '== Second ==',
        'Second.<ref name="Second" />',
        '<references>',
        '<ref name="Alpha">{{cite web|title=Alpha}}</ref>',
        '<ref name="Beta">{{cite web|title=Beta}}</ref>',
        '<ref name="Child">{{cite web|title=Child}}</ref>',
        '<ref name="Second">{{cite web|title=Second}}</ref>',
        '<ref name="Unused">{{cite web|title=Unused}}</ref>',
        '</references>',
    ].join('\n');
}

test('counts source uses and filters through section hierarchies', () => {
    const text = buildSectionFilterText();
    const sources = listExistingSources(text);
    const byName = Object.fromEntries(
        sources.map((source) => [source.referenceName, source]),
    );

    assert.equal(byName.Alpha.usageCount, 2);
    assert.equal(byName.Unused.usageCount, 0);
    assert.deepEqual(
        listExistingSourceSections(text, sources).map(({ id, title }) => ({
            id,
            title,
        })),
        [
            { id: '0', title: '' },
            { id: '1', title: 'First' },
            { id: '1.1', title: 'Child' },
            { id: '2', title: 'Second' },
            { id: 'unused', title: '' },
        ],
    );
    assert.deepEqual(
        filterExistingSources(sources, '', '1').map(
            (source) => source.referenceName,
        ),
        ['Alpha', 'Beta', 'Child'],
    );
    assert.deepEqual(
        filterExistingSources(sources, '', '1.1').map(
            (source) => source.referenceName,
        ),
        ['Alpha', 'Child'],
    );
});

test('formats source usage titles with exact article sections', () => {
    const text = [
        'Lead.<ref name="Everywhere" />',
        '== First ==',
        'First.<ref name="Everywhere" /><ref name="First only" />',
        '=== Child ===',
        'Child.<ref name="Everywhere" />',
        '== Second ==',
        '=== Child A ===',
        'No source use.',
        '=== Child B ===',
        'Child B.<ref name="Everywhere" />',
        '<references>',
        '<ref name="Everywhere">{{cite web|title=Everywhere}}</ref>',
        '<ref name="First only">{{cite web|title=First only}}</ref>',
        '<ref name="Unused">{{cite web|title=Unused}}</ref>',
        '</references>',
    ].join('\n');
    const sources = listExistingSources(text);
    const sections = listExistingSourceSections(text, sources);
    const byName = Object.fromEntries(
        sources.map((source) => [source.referenceName, source]),
    );

    assert.equal(
        formatSourceUsageTitle(byName.Everywhere, sections),
        'Used in §0 Lead; §1 First; §1.1 Child; §2.2 Child B',
    );
    assert.equal(
        formatSourceUsageTitle(byName['First only'], sections),
        'Used in §1 First',
    );
    assert.equal(
        formatSourceUsageTitle(byName.Unused, sections),
        'Not used in the article.',
    );
});

test('filters section and subsection leads with trailing zeroes', () => {
    const sources = listExistingSources(buildSectionFilterText());

    assert.deepEqual(
        filterExistingSources(sources, '', '1.0').map(
            (source) => source.referenceName,
        ),
        ['Beta'],
    );
    assert.deepEqual(
        filterExistingSources(sources, '', '1.1.0').map(
            (source) => source.referenceName,
        ),
        ['Alpha', 'Child'],
    );
});

test('only offers section lead filters that contain source uses', () => {
    const populatedText = buildSectionFilterText();
    const populatedSources = listExistingSources(populatedText);
    const populatedSections = listExistingSourceSections(
        populatedText,
        populatedSources,
    );
    const populatedLead = buildSourceSectionSelectors(
        populatedSections,
        ['1'],
        populatedSources,
    )[1];

    assert.ok(
        populatedLead.menuItems.some((option) => option.sectionId === '1.0'),
    );

    const emptyLeadText = [
        '== First ==',
        '=== Child ===',
        'Child.<ref name="Child" />',
        '<references>',
        '<ref name="Child">{{cite web|title=Child}}</ref>',
        '</references>',
    ].join('\n');
    const emptyLeadSources = listExistingSources(emptyLeadText);
    const emptyLeadSections = listExistingSourceSections(
        emptyLeadText,
        emptyLeadSources,
    );
    const emptyLead = buildSourceSectionSelectors(
        emptyLeadSections,
        ['1'],
        emptyLeadSources,
    )[1];

    assert.deepEqual(
        emptyLead.menuItems.map((option) => option.sectionId),
        ['', '1.1'],
    );
});

test('does not offer an otherwise empty subsection lead level', () => {
    const text = buildSectionFilterText();
    const sources = listExistingSources(text);
    const sections = listExistingSourceSections(text, sources);
    const selectors = buildSourceSectionSelectors(
        sections,
        ['1', '1.1'],
        sources,
    );

    assert.equal(selectors.length, 2);
});

test('classifies citation templates and non-standard references', () => {
    const sources = listExistingSources(
        [
            '<ref name="Good">{{cite web|title=Good}}</ref>',
            '<ref name="Error">{{cite web|title=Bad|date=2026-02-30}}</ref>',
            '<ref name="Mixed">{{cite magazine|title=Print review}} ' +
                'Full review appears only in printed version.</ref>',
            '<ref name="Comic">{{cite comic|title=Comic}}</ref>',
            '<ref name="Guide">{{Cite Fan Guide|title=Guide}}</ref>',
            '<ref name="Plain">A plain source note.</ref>',
        ].join('\n'),
    );

    assert.deepEqual(
        sources.map((source) => source.status),
        [
            'standard',
            'standard',
            'standard',
            'metadata-free',
            'metadata-free',
            'non-standard',
        ],
    );
});

test('edits Cite comic without TemplateData hints or field rewrites', () => {
    const text = [
        '<ref name="Comic">Before ',
        '{{cite comic|Writer=First|issue=|writer=Second|custom=Value}}',
        ' after</ref>',
    ].join('');
    const [source] = listExistingSources(text);

    assert.equal(source?.status, 'metadata-free');
    assert.equal(source?.draft.template, 'Cite comic');
    assert.deepEqual(
        source?.draft.rows.map((row) => [row.name, row.value]),
        [
            ['Writer', 'First'],
            ['issue', ''],
            ['writer', 'Second'],
            ['custom', 'Value'],
        ],
    );
    assertMetadataFreeDraftControls(source.draft);

    formatSourceDraftRows(source.draft);
    getRow(source.draft, 'custom').value = 'Updated';
    const updated = replaceExistingSource(text, source, source.draft, 'inline');

    assert.equal(
        updated,
        '<ref name="Comic">Before {{Cite comic | Writer = First | ' +
            'issue =  | writer = Second | custom = Updated }} after</ref>',
    );
});

function assertMetadataFreeDraftControls(draft: SourceDraft): void {
    assert.deepEqual(listSourceDraftParameterNames(draft), []);
    assert.equal(getSourceDraftParameterAliasInfo(draft, 'Writer'), null);
    assert.equal(hasSourceDraftCitationIdentity(draft), false);
    assert.deepEqual(getSourceDraftCitationNameCells(draft), new Map());
    assert.deepEqual(getSourceDraftCitationNameParts(draft), {
        author: '',
        part: '',
        year: '',
    });
    const genericAuthor = parseSourceDraft('{{Cite comic|author=First Last}}');
    assert.equal(canSplitAuthorDraftRow(genericAuthor, 0), false);
    assert.equal(splitAuthorDraftRow(genericAuthor, 0), false);
}

test('round trips significant positional values in generic drafts', () => {
    const draft = parseSourceDraft(
        '{{Cite fan guide|  padded  |title=Example}}',
    );

    assert.equal(draft.rows[0]?.name, '1');
    assert.equal(draft.rows[0]?.value, '  padded  ');
    assert.equal(draft.rows[0]?.positionalIndex, 1);
    assert.equal(
        serializeSourceDraft(draft, 'inline'),
        '{{Cite fan guide|  padded  | title = Example }}',
    );
});

test('spaces generic inline draft endings without changing positional values', () => {
    const draft = parseSourceDraft(
        '{{Cite fan guide|  padded  |title=Example|custom=}}',
    );
    const inline = serializeSourceDraftForEdit(draft, 'inline');

    assert.equal(
        inline,
        '{{Cite fan guide|  padded  | title = Example | custom = }}',
    );
    assert.equal(
        serializeSourceDraftForEdit(parseSourceDraft(inline), 'inline'),
        inline,
    );
    assert.match(serializeSourceDraftForEdit(draft, 'block'), /\n\}\}$/u);

    const positionalLast = parseSourceDraft(
        '{{Cite fan guide|title=Example|  padded  }}',
    );
    assert.equal(
        serializeSourceDraftForEdit(positionalLast, 'inline'),
        '{{Cite fan guide | title = Example|  padded  }}',
    );
    assert.equal(positionalLast.rows.at(-1)?.value, '  padded  ');
});

test('does not renumber later positional values after a draft edit', () => {
    const draft = parseSourceDraft('{{Cite fan guide|first|second}}');
    draft.rows[0]!.name = '';

    assert.equal(
        serializeSourceDraft(draft, 'inline'),
        '{{Cite fan guide | 2 = second }}',
    );
});

test('keeps an edited top-level equals in its positional field', () => {
    const draft = parseSourceDraft('{{Cite fan guide|old}}');
    draft.rows[0]!.value = 'x=y';

    assert.equal(
        serializeSourceDraft(draft, 'inline'),
        '{{Cite fan guide | 1 = x=y }}',
    );

    draft.rows[0]!.value = '{{lang|en|x=y}}';
    assert.equal(
        serializeSourceDraft(draft, 'inline'),
        '{{Cite fan guide|{{lang|en|x=y}}}}',
    );
});

test('batches every standard source into one CS1 check payload', () => {
    const sources = listExistingSources(
        [
            '<ref name="A">{{cite web|title=First|url=https://a.test}}</ref>',
            '<ref name="B">{{cite book|title=Second|date=2025}}</ref>',
        ].join(''),
    );

    const payload = buildCs1CheckWikitext(sources);

    assert.match(payload, /id="kanade-source-editor-cs1-check-0"/u);
    assert.match(payload, /id="kanade-source-editor-cs1-check-1"/u);
    assert.match(payload, /\{\{cite web\|title=First/u);
    assert.match(payload, /\{\{cite book\|title=Second/u);
});

test('formats single foreign-language titles as script-title', () => {
    const draft = parseSourceDraft(
        '{{cite web|title=記事<!-- # Kiji -->|language=ja}}',
    );

    assert.equal(formatSourceDraftScriptTitle(draft, 'enwiki'), true);
    assert.match(
        serializeSourceDraft(draft, 'inline'),
        /script-title = ja:記事 <!-- # Kiji -->/u,
    );

    const multiple = parseSourceDraft(
        '{{cite web|title=Статья|language=ru,uk}}',
    );
    assert.equal(formatSourceDraftScriptTitle(multiple, 'enwiki'), false);

    const chinese = parseSourceDraft(
        '{{cite web|title=中文標題|language=zh-Hant}}',
    );
    assert.equal(formatSourceDraftScriptTitle(chinese, 'zhwiki'), false);

    const english = parseSourceDraft(
        '{{cite web|title=English title|language=en}}',
    );
    assert.equal(formatSourceDraftScriptTitle(english, 'enwiki'), false);
});

test('formats eligible article titles before citation formatting', () => {
    const result = formatSourceScriptTitles(
        'Text<ref>{{cite web|title=記事|language=ja}}</ref>',
        'enwiki',
    );

    assert.equal(result.formatted, 1);
    assert.match(result.text, /script-title = ja:記事/u);
    assert.doesNotMatch(result.text, /\| title = 記事/u);

    const protectedText =
        '<nowiki>{{cite web|title=記事|language=ja}}</nowiki>';
    assert.deepEqual(formatSourceScriptTitles(protectedText, 'enwiki'), {
        formatted: 0,
        text: protectedText,
    });
});

test('uses primary codes and honors script-title language modes', () => {
    const japanese = parseSourceDraft(
        '{{cite web|title=記事|language=ja-Jpan-JP}}',
    );
    assert.equal(
        formatSourceDraftScriptTitle(japanese, 'enwiki', 'non-latin'),
        true,
    );
    assert.match(serializeSourceDraft(japanese, 'inline'), /ja:記事/u);

    const french = parseSourceDraft(
        '{{cite web|title=Article|language=fr-CA}}',
    );
    assert.equal(
        formatSourceDraftScriptTitle(french, 'enwiki', 'non-latin'),
        false,
    );
    assert.equal(
        formatSourceDraftScriptTitle(french, 'enwiki', 'all-foreign'),
        true,
    );
    assert.match(serializeSourceDraft(french, 'inline'), /fr:Article/u);
});

test('normalizes existing script-title prefixes to primary lowercase codes', () => {
    const english = parseSourceDraft(
        '{{cite web|script-title=en-us:TGS 2008|language=en-US}}',
    );
    const chinese = parseSourceDraft(
        '{{cite web|script-title=ZH-XX:中文標題|language=zh-XX}}',
    );

    assert.equal(formatSourceDraftScriptTitle(english, 'enwiki'), true);
    assert.equal(formatSourceDraftScriptTitle(chinese, 'enwiki'), true);
    assert.match(
        serializeSourceDraft(english, 'inline'),
        /script-title = en:TGS 2008/u,
    );
    assert.match(serializeSourceDraft(english, 'inline'), /language = en-US/u);
    assert.match(
        serializeSourceDraft(chinese, 'inline'),
        /script-title = zh:中文標題/u,
    );
});

test('preserves malformed and unprefixed script-title values', () => {
    for (const value of ['en_US:TGS 2008', 'english:TGS 2008', 'TGS 2008']) {
        const draft = parseSourceDraft(
            `{{cite web|script-title=${value}|language=en-US}}`,
        );

        assert.equal(formatSourceDraftScriptTitle(draft, 'enwiki'), false);
        assert.equal(getRow(draft, 'script-title').value, value);
    }
});

test('lists and reuses bibliography citations referenced by sfn', () => {
    const text = [
        'Text.{{sfn|Weiss|2014|p=77}}',
        '==Sources==',
        '* {{cite book|last=Weiss|year=2014|title=Console games}}',
    ].join('\n');
    const sources = listExistingSources(text);

    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.referenceKind, 'short-footnote');
    assert.equal(sources[0]?.reuseText, '{{sfn|Weiss|2014}}');
    assert.equal(sources[0]?.usageCount, 1);
    assert.equal(
        buildExistingSourceReference(sources[0]!),
        '{{sfn|Weiss|2014}}',
    );
});

test('short footnotes accept supported template namespace aliases', () => {
    const text = [
        'Text.{{T:sfn|Weiss|2014}}',
        '==Sources==',
        '* {{樣板:cite book|last=Weiss|year=2014|title=Console games}}',
    ].join('\n');
    const sources = listExistingSources(text, chineseTemplateNames);

    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.referenceKind, 'short-footnote');
    assert.equal(sources[0]?.reuseText, '{{sfn|Weiss|2014}}');
});

test('short-footnote parameter names are not namespace titles', () => {
    const citation =
        '* {{cite book|last=Right|year=2000|ref=forced|title=Book}}';
    const aliasedParameter = listExistingSources(
        `{{sfn|Wrong|1999|TM:ref=forced}}\n${citation}`,
        englishTemplateNames,
    );
    const refParameter = listExistingSources(
        `{{sfn|Wrong|1999|ref=forced}}\n${citation}`,
        englishTemplateNames,
    );

    assert.deepEqual(aliasedParameter, []);
    assert.equal(refParameter.length, 1);
});

test('uses a language-prefixed script title as the list title', () => {
    const [source] = listExistingSources(
        '<ref name="Japanese">{{cite web|' +
            'script-title=ja:マイクロソフト、完成記念パーティーを開催|' +
            'url=https://example.test}}</ref>',
    );

    assert.equal(source.title, 'マイクロソフト、完成記念パーティーを開催');
    assert.equal(source.titleLanguage, 'ja');
    assert.deepEqual(filterExistingSources([source], '完成記念'), [source]);
});

test('inherits groups from references containers', () => {
    const text = [
        '<references group="note">',
        '<ref name="Grouped">',
        '{{cite web|title=Grouped|url=https://grouped.test}}',
        '</ref></references>',
    ].join('');
    const [source] = listExistingSources(text);

    assert.equal(source.group, 'note');
    assert.equal(
        buildExistingSourceReference(source),
        '<ref name="Grouped" group="note" />',
    );
});

test('parses quoted references attributes through shared tag queries', () => {
    const text = [
        '<references group="note>archive">',
        '<ref name="Grouped">',
        '{{cite web|title=Grouped|url=https://grouped.test}}',
        '</ref></references>',
    ].join('');
    const [source] = listExistingSources(text);

    assert.equal(source.group, 'note>archive');
    assert.equal(source.referenceName, 'Grouped');
});

test('inherits groups from Reflist refs parameters', () => {
    const text = [
        '{{Reflist|group=note|refs=',
        '<ref name="Grouped">',
        '{{cite web|title=Grouped|url=https://grouped.test}}',
        '</ref>}}',
    ].join('');
    const [source] = listExistingSources(text);

    assert.equal(source.group, 'note');
    assert.equal(
        buildExistingSourceReference(source),
        '<ref name="Grouped" group="note" />',
    );
});

test('lists compact R definitions for native reuse', () => {
    const open = '{' + '{';
    const text = [
        'Lead.',
        '<references>',
        open,
        "r|name='Compact'|ref=",
        open,
        'cite web|title=Compact|url=https://compact.test}}}}',
        '</references>',
    ].join('');
    const [source] = listExistingSources(text);

    assert.equal(source.referenceName, 'Compact');
    assert.equal(source.url, 'https://compact.test');
    assert.equal(source.reuseText, '<ref name="Compact" />');
});

const testUnnamedSourceReuse = () => {
    const text =
        'Text<ref>{{cite web|title=Example|url=https://example.test}}</ref>';
    const [source] = listExistingSources(text);
    assert.equal(source.referenceName, '');
    assert.equal(source.reuseText, source.rawReference);
};
test(
    'duplicates a full unnamed ref when it cannot be reused',
    testUnnamedSourceReuse,
);

const testProtectedSources = () => {
    const protectedTags = [
        '<!-- %s -->',
        '<nowiki>%s</nowiki>',
        '<pre>%s</pre>',
        '<source>%s</source>',
        '<syntaxhighlight>%s</syntaxhighlight>',
        '<math>%s</math>',
    ];
    const ref = '<ref>{{cite web|url=https://hidden.test|title=Hidden}}</ref>';
    const hidden = protectedTags.map((wrapper) => wrapper.replace('%s', ref));
    const visible =
        '<ref>{{cite web|url=https://visible.test|title=Visible}}</ref>';
    const sources = listExistingSources([...hidden, visible].join('\n'));
    assert.equal(sources.length, 1);
    assert.equal(sources[0].title, 'Visible');

    const brokenExamples = [
        `<!-- <ref> -->${visible}`,
        `<nowiki><ref></nowiki>${visible}`,
    ];
    for (const source of brokenExamples) {
        assert.equal(listExistingSources(source)[0]?.title, 'Visible');
    }
};
test('ignores sources in protected wikitext', testProtectedSources);

test('ignores citation examples in templatedata', () => {
    const example =
        '<ref name="Example">' +
        '{{cite web|url=https://example.test|title=Example}}' +
        '</ref>';
    const visible =
        '<ref name="Visible">' +
        '{{cite web|url=https://visible.test|title=Visible}}' +
        '</ref>';
    const sources = listExistingSources(
        `<templatedata>${example}</templatedata>${visible}`,
    );

    assert.equal(sources.length, 1);
    assert.equal(sources[0].referenceName, 'Visible');
});

const testExistingSourceMatching = () => {
    const archive =
        'https://web.archive.org/web/20240203040506/' +
        'https://example.test/story?edition=one';
    const text =
        '<ref name="Story">{{cite web|title=Story|' +
        'url=https://example.test/story?edition=one&b=2&a=1|' +
        `archive-url=${archive}}}</ref>`;
    const [original] = findExistingSources(
        text,
        'https://example.test/story?edition=one&b=2&a=1#part',
    );
    const [archived] = findExistingSources(text, archive);
    const reordered = findExistingSources(
        text,
        'https://example.test/story?b=2&a=1&edition=one',
    );
    const different = findExistingSources(
        text,
        'https://example.test/story?edition=two&b=2&a=1',
    );
    const differentPage = findExistingSources(
        text,
        'https://example.test/story?edition=one&b=2&a=1&page=7',
    );
    assert.equal(original?.referenceName, 'Story');
    assert.equal(archived?.referenceName, 'Story');
    assert.deepEqual(reordered, []);
    assert.deepEqual(different, []);
    assert.deepEqual(differentPage, []);
};
test(
    'matches original and Wayback URLs without false query matches',
    testExistingSourceMatching,
);

test('returns every original-URL match in source order', () => {
    const url = 'https://example.test/reused';
    const text = [
        `<ref>{{cite web|title=Anonymous|url=${url}}}</ref>`,
        '<ref name="Reusable">',
        `{{cite web|title=Reusable|url=${url}}}`,
        '</ref>',
    ].join('');

    const sources = findExistingSources(text, url);
    assert.deepEqual(
        sources.map((source) => source.referenceName),
        ['', 'Reusable'],
    );
    assert.equal(sources[1]?.reuseText, '<ref name="Reusable" />');
});

const testExistingSourceReplacement = () => {
    const text =
        '<ref name="Old">Before {{cite web|title=Old|' +
        'url=https://example.test}} after</ref>';
    const [source] = listExistingSources(text);
    getRow(source.draft, 'title').value = 'New';
    getRow(source.draft, 'publisher').value = 'Publisher';
    const updated = replaceExistingSource(text, source, source.draft, 'inline');
    assert.equal(
        updated,
        '<ref name="Old">Before {{Cite web | title = New | ' +
            'url = https://example.test | publisher = Publisher }} after</ref>',
    );
    assert.throws(
        () => replaceExistingSource(`x${text}`, source, source.draft),
        /changed/u,
    );
};
test(
    'replaces only the selected citation template',
    testExistingSourceReplacement,
);

test('converts non-standard reference content into a citation template', () => {
    const text = '<ref name="Plain" group="note">Original plain source.</ref>';
    const [source] = listExistingSources(text);
    const draft = createManualSourceDraft('cite web');
    getRow(draft, 'title').value = 'Replacement';
    getRow(draft, 'url').value = 'https://example.test/replacement';

    assert.equal(source.status, 'non-standard');
    assert.equal(source.rawTemplate, text);
    assert.equal(
        replaceExistingSource(text, source, draft, 'inline'),
        '<ref name="Plain" group="note">{{Cite web | ' +
            'title = Replacement | ' +
            'url = https://example.test/replacement }}</ref>',
    );
});
