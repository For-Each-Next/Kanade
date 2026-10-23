/**
 * @file tests/source-editor/source-validation.test.ts
 * Purpose: Tests site-aware CS1 draft validation.
 *
 * Table of contents:
 * 1. Imports
 * 2. getRowIndex
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    formatSourceDraftRows,
    parseSourceDraft,
    type SourceDraft,
} from '../../src/source-editor/domain/source-manager.ts';
import { getSourceDraftErrors } from '../../src/source-editor/domain/source-validation.ts';

function getRowIndex(draft: SourceDraft, name: string): number {
    const index = draft.rows.findIndex((row) => row.name === name);
    assert.notEqual(index, -1, `Missing ${name} row`);
    return index;
}

test('formats added rows into standard template order', () => {
    const draft = parseSourceDraft(
        '{{cite web|author=One|date=2026|url=https://example.test}}',
    );
    draft.rows.push({
        alias: '',
        directive: '',
        main: false,
        name: 'author2',
        value: 'Two',
    });
    draft.rows.push({
        alias: '',
        directive: '',
        main: false,
        name: 'quote',
        value: 'Quoted text',
    });
    draft.rows.push({
        alias: '',
        directive: '',
        main: false,
        name: 'format',
        value: 'PDF',
    });

    formatSourceDraftRows(draft);

    assert.ok(getRowIndex(draft, 'author') < getRowIndex(draft, 'author2'));
    assert.ok(getRowIndex(draft, 'author2') < getRowIndex(draft, 'date'));
    assert.ok(getRowIndex(draft, 'format') < getRowIndex(draft, 'quote'));
});

test('formats script-title immediately after title', () => {
    const draft = parseSourceDraft(
        '{{cite interview|type=Interview|title=Example|' +
            'script-title=ja:例}}',
    );

    formatSourceDraftRows(draft);

    const titleIndex = getRowIndex(draft, 'title');
    assert.equal(getRowIndex(draft, 'script-title'), titleIndex + 1);
});

test('sorts Cite interview rows by its own TemplateData', () => {
    const draft = parseSourceDraft(
        '{{cite interview|last1=Noguchi|first1=Shinji|' +
            'last2=Hatsushiba|first2=Hiroya|' +
            'script-title=en:Eternal Sonata Interview|' +
            'interviewer=Brudvig, Erik|work=IGN}}',
    );

    formatSourceDraftRows(draft);
    const populated = draft.rows
        .filter((row) => row.value !== '')
        .map((row) => row.name);

    assert.deepEqual(populated, [
        'last1',
        'first1',
        'last2',
        'first2',
        'interviewer',
        'script-title',
        'work',
    ]);
});

test('marks unsupported parameters and malformed dates', () => {
    const draft = parseSourceDraft(
        '{{cite web|title=Example|date=2026-13-40}}',
    );
    draft.rows.push({
        alias: '',
        directive: '',
        main: false,
        name: 'titel',
        value: 'Typo',
    });

    const errors = getSourceDraftErrors(draft, 'enwiki');

    assert.match(
        errors.get(getRowIndex(draft, 'titel'))?.name ?? '',
        /does not support the titel parameter/u,
    );
    assert.match(
        errors.get(getRowIndex(draft, 'date'))?.value ?? '',
        /correct date for date/u,
    );
});

test('uses only structural validation without template metadata', () => {
    const draft = parseSourceDraft(
        '{{cite comic|writer=Example|comic-only=value|' +
            'date=2026-13-40|archive-url=https://archive.test}}',
    );
    draft.rows.push({
        alias: '',
        directive: '',
        main: false,
        name: '',
        value: 'Missing name',
    });
    draft.rows.push({
        alias: 'Reference text',
        directive: '',
        main: false,
        name: 'artist',
        value: '',
    });

    const errors = getSourceDraftErrors(draft, 'enwiki');

    for (const name of ['writer', 'comic-only', 'date', 'archive-url']) {
        assert.equal(errors.get(getRowIndex(draft, name)), undefined);
    }
    assert.match(
        errors.get(draft.rows.length - 2)?.name ?? '',
        /parameter name/u,
    );
    assert.match(
        errors.get(draft.rows.length - 1)?.alias ?? '',
        /original text/u,
    );
});

test('rejects structural markup in generic draft parameter names', () => {
    const draft = parseSourceDraft('{{Cite comic|writer=Example}}');
    const unsafeNames = [
        'x|y',
        'x=y',
        'x}}tail',
        'line\nbreak',
        'x<!--comment-->y',
    ];
    for (const name of unsafeNames) {
        draft.rows.push({
            alias: '',
            directive: '',
            main: false,
            name,
            value: 'Unsafe',
        });
    }

    const errors = getSourceDraftErrors(draft, 'enwiki');

    for (const name of unsafeNames) {
        assert.match(
            errors.get(getRowIndex(draft, name))?.name ?? '',
            /without wikitext markup or line breaks/u,
        );
    }
    assert.equal(errors.get(getRowIndex(draft, 'writer')), undefined);
});

test('accepts CS1 parameters supported by another citation class', () => {
    const draft = parseSourceDraft('{{cite web|title=Example|pages=4–6}}');

    const errors = getSourceDraftErrors(draft, 'enwiki');

    assert.equal(errors.get(getRowIndex(draft, 'pages'))?.name, undefined);
});

test('marks a missing archive pair field', () => {
    const draft = parseSourceDraft(
        '{{cite web|title=Example|' +
            'archive-url=https://web.archive.org/example}}',
    );

    const errors = getSourceDraftErrors(draft, 'enwiki');

    assert.match(
        errors.get(getRowIndex(draft, 'archive-date'))?.value ?? '',
        /Add a date for the archive URL/u,
    );
});

test('accepts HTTP citation URLs without a local warning', () => {
    const draft = parseSourceDraft(
        '{{cite web|title=Example|url=http://example.test|' +
            'archive-url=http://web.archive.org/example|' +
            'archive-date=2026-07-26}}',
    );

    const errors = getSourceDraftErrors(draft, 'enwiki');

    assert.equal(errors.get(getRowIndex(draft, 'url'))?.value, undefined);
    assert.equal(
        errors.get(getRowIndex(draft, 'archive-url'))?.value,
        undefined,
    );
});

test('explains missing CS1 parameter dependencies', () => {
    const draft = parseSourceDraft(
        '{{cite journal|title=Example|access-date=2026-07-26|' +
            'doi-broken-date=2026-07-20|chapter-format=PDF}}',
    );
    draft.rows.push({
        alias: '',
        directive: '',
        main: false,
        name: 'chapter-url',
        value: '',
    });

    const errors = getSourceDraftErrors(draft, 'enwiki');

    assert.equal(
        errors.get(getRowIndex(draft, 'url'))?.value,
        '|access-date= requires |url=.',
    );
    assert.equal(
        errors.get(getRowIndex(draft, 'doi'))?.value,
        '|doi-broken-date= requires |doi=.',
    );
    assert.equal(
        errors.get(getRowIndex(draft, 'chapter-url'))?.value,
        '|chapter-format= requires |chapter-url=.',
    );
});

test('validates archive dates for every citation class', () => {
    const draft = parseSourceDraft(
        '{{cite book|title=Example|' +
            'archive-url=https://web.archive.org/example|' +
            'archive-date=2026-02-30}}',
    );

    const errors = getSourceDraftErrors(draft, 'enwiki');

    assert.match(
        errors.get(getRowIndex(draft, 'archive-date'))?.value ?? '',
        /correct date for archive-date/u,
    );
});

test('uses Chinese Wikipedia aliases and date syntax on zhwiki', () => {
    const draft = parseSourceDraft(
        '{{cite web|title_zh=示例|unified=yes|date=2026年7月26日}}',
    );

    const errors = getSourceDraftErrors(draft, 'zhwiki');

    assert.equal(errors.get(getRowIndex(draft, 'title_zh'))?.name, undefined);
    assert.equal(errors.get(getRowIndex(draft, 'unified'))?.name, undefined);
    assert.equal(errors.get(getRowIndex(draft, 'date'))?.value, undefined);
});

test('accepts numbered CS1 parameters beyond TemplateData slots', () => {
    const draft = parseSourceDraft(
        '{{cite web|title=Example|author25=Twenty-five}}',
    );

    const errors = getSourceDraftErrors(draft, 'enwiki');

    assert.equal(errors.get(getRowIndex(draft, 'author25'))?.name, undefined);
});

test('accepts no-date only in the general date parameter', () => {
    const draft = parseSourceDraft(
        '{{cite web|title=Example|date=n.d.|archive-date=n.d.}}',
    );

    const errors = getSourceDraftErrors(draft, 'enwiki');

    assert.equal(errors.get(getRowIndex(draft, 'date'))?.value, undefined);
    assert.match(
        errors.get(getRowIndex(draft, 'archive-date'))?.value ?? '',
        /correct date for archive-date/u,
    );
});
