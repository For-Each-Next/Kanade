/**
 * @file tests/source-editor/cs1-validation.test.ts
 * Purpose: Tests mapping live enwiki and zhwiki CS1 output to draft fields.
 *
 * Table of contents:
 * 1. Imports
 * 2. getRowIndex
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    extractCs1FragmentIssues,
    extractCs1IssueMessages,
    getCs1DraftFingerprint,
    getIgnoredUnknownCs1ParameterName,
    isUnsupportedParameterCs1Category,
    parseCs1ValidationResult,
} from '../../src/source-editor/domain/cs1-validation.ts';
import {
    parseSourceDraft,
    type SourceDraft,
} from '../../src/source-editor/domain/source-manager.ts';

function getRowIndex(draft: SourceDraft, name: string): number {
    const index = draft.rows.findIndex((row) => row.name === name);
    assert.notEqual(index, -1, `Missing ${name} row`);
    return index;
}

test('recognizes only exact ignored unknown-parameter diagnostics', () => {
    assert.equal(
        getIgnoredUnknownCs1ParameterName(
            'Unknown parameter |journal-a= ignored',
        ),
        'journal-a',
    );
    assert.equal(
        getIgnoredUnknownCs1ParameterName('已忽略未知参数|journal-a='),
        'journal-a',
    );
    assert.equal(
        getIgnoredUnknownCs1ParameterName('已忽略未知參數|journal-a='),
        'journal-a',
    );
    for (const message of [
        'Invalid value for |journal-a=',
        'Unknown parameter |journal-a=',
        'Parameter |journal-a= ignored',
        'Unknown parameter |journal-a= ignored; see |journal=',
    ]) {
        assert.equal(getIgnoredUnknownCs1ParameterName(message), null);
    }
    assert.equal(
        isUnsupportedParameterCs1Category('CS1 errors: unsupported parameter'),
        true,
    );
    assert.equal(
        isUnsupportedParameterCs1Category('CS1 errors: invalid parameter'),
        false,
    );
});

test('maps enwiki name-list and ignored-parameter errors', () => {
    const draft = parseSourceDraft(
        '{{cite web|last=Hatsushiba|first=Hiroya|' +
            'vauthors=Hicks, Jon|book-title=Collected interviews}}',
    );
    const html = [
        '<span class="cs1-visible-error citation-comment">',
        'More than one of author-name-list parameters specified',
        '</span>',
        '<span class="cs1-visible-error citation-comment">',
        'Unknown parameter <code>&#124;book-title=</code> ignored',
        '</span>',
    ].join('');

    const result = parseCs1ValidationResult(draft, html);

    assert.match(
        result.cellErrors.get(getRowIndex(draft, 'last'))?.value ?? '',
        /author-name-list/u,
    );
    assert.match(
        result.cellErrors.get(getRowIndex(draft, 'vauthors'))?.value ?? '',
        /author-name-list/u,
    );
    assert.match(
        result.cellErrors.get(getRowIndex(draft, 'book-title'))?.name ?? '',
        /ignored/u,
    );
    assert.equal(result.issueCount, 2);
    assert.deepEqual(result.messages, []);
});

test('keeps CS1 issues active after reference-name-only edits', () => {
    const draft = parseSourceDraft(
        '{{cite web|title=Example|book-title=Ignored value}}',
    );
    const checked = getCs1DraftFingerprint(draft);
    const row = draft.rows[getRowIndex(draft, 'book-title')];

    row.alias = 'Reference name';
    row.directive = '!keep';
    assert.equal(getCs1DraftFingerprint(draft), checked);

    row.value = 'Corrected value';
    assert.notEqual(getCs1DraftFingerprint(draft), checked);
});

test('maps zhwiki citation-comment errors through local aliases', () => {
    const draft = parseSourceDraft(
        '{{cite web|title=示例|archive-url=https://archive.example|' +
            'vauthors=Hicks J|bad-param=value}}',
    );
    const html = [
        '<span style="font-size:100%" class="error citation-comment">' +
            '使用<code>&#124;archiveurl=</code>需要含有' +
            '<code>&#124;url=</code></span>',
        '<span class="error citation-comment">' +
            '已忽略未知参数<code>&#124;bad-param=</code></span>',
        '<span class="error citation-comment">温哥华格式错误</span>',
    ].join('');

    const result = parseCs1ValidationResult(draft, html, [
        '引文格式1维护：日期与年',
    ]);

    assert.match(
        result.cellErrors.get(getRowIndex(draft, 'archive-url'))?.value ?? '',
        /archiveurl/u,
    );
    assert.match(
        result.cellErrors.get(getRowIndex(draft, 'url'))?.value ?? '',
        /需要含有/u,
    );
    assert.match(
        result.cellErrors.get(getRowIndex(draft, 'bad-param'))?.name ?? '',
        /未知参数/u,
    );
    assert.match(
        result.cellErrors.get(getRowIndex(draft, 'vauthors'))?.value ?? '',
        /温哥华格式/u,
    );
    assert.deepEqual(result.messages, ['引文格式1维护：日期与年']);
    assert.equal(result.issueCount, 4);
});

test('extracts article-wide CS1 messages for the checker popup', () => {
    for (const whitespace of ['', ' ', '\n\t']) {
        const messages = extractCs1IssueMessages(
            '<span class="cs1-visible-error citation-comment">' +
                'Unknown parameter <code>&#124;bad=</code> ignored' +
                `<a href="/wiki/Help:CS1_errors">${whitespace}` +
                '(帮助)</a></span>',
            ['CS1 maint: date and year'],
        );

        assert.deepEqual(messages, [
            'Unknown parameter |bad= ignored',
            'CS1 maint: date and year',
        ]);
    }
});

test('classifies CS1 errors and green citation comments', () => {
    const html = [
        '<span class="citation-comment" style="color:#33aa33">',
        'Informational',
        '</span>',
        '<span class="error citation-comment">Error first</span>',
        '<span class="cs1-maint citation-comment">Maintenance</span>',
        '<span class="citation-comment error">Error last</span>',
    ].join('');

    assert.deepEqual(extractCs1FragmentIssues(html), [
        { message: 'Error first', severity: 'error' },
        { message: 'Error last', severity: 'error' },
        { message: 'Informational', severity: 'maintenance' },
        { message: 'Maintenance', severity: 'maintenance' },
    ]);
    assert.deepEqual(extractCs1IssueMessages(html), [
        'Error first',
        'Error last',
        'Maintenance',
    ]);
});

test('uses page categories to recognize hidden zhwiki maintenance', () => {
    const maintenance = '引文格式1维护：未识别语文类型';
    const html = [
        '<span class="citation-comment" ',
        'style="display:none; color:#33aa33">',
        ` ${maintenance} (<a href="/wiki/Category:${maintenance}">link</a>)`,
        '</span>',
        '<span class="citation-comment" style="color:#33aa33">',
        'Informational',
        '</span>',
    ].join('');

    assert.deepEqual(extractCs1FragmentIssues(html), [
        { message: maintenance, severity: 'maintenance' },
        { message: 'Informational', severity: 'maintenance' },
    ]);
    assert.deepEqual(extractCs1FragmentIssues(html, [maintenance]), [
        { message: maintenance, severity: 'maintenance' },
        { message: 'Informational', severity: 'maintenance' },
    ]);
    assert.deepEqual(extractCs1IssueMessages(html, [maintenance]), [
        maintenance,
    ]);
});
