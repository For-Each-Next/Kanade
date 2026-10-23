/**
 * @file tests/library/wikitext-source-ranges.test.ts
 * Purpose: Preserves source-interval and tag-markup operations shared by wikitext consumers.
 *
 * Contents: Immutable interval unions, offset-preserving edits, and scanner-derived markup.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    findLineContentEnd,
    getTagMarkupRanges,
    isValidSourceRange,
    maskSourceRanges,
    mergeSourceRanges,
    replaceSourceRanges,
    trimSourceRange,
    wikitext,
} from '../../src/library/wikitext/index.ts';

test('range trimming retains absolute offsets and collapses whitespace-only spans', () => {
    const source = 'prefix \t\u00a0value\n suffix';
    assert.deepEqual(trimSourceRange(source, 6, source.length - 6), {
        start: 9,
        end: 14,
    });
    assert.deepEqual(trimSourceRange(source, 6, 9), { start: 9, end: 9 });
    assert.deepEqual(trimSourceRange(source, 9, 9), { start: 9, end: 9 });
});

test('editable source intervals admit insertions but reject invalid boundaries', () => {
    for (const range of [
        { start: 0, end: 0 },
        { start: 0, end: 3 },
        { start: 3, end: 3 },
    ]) {
        assert.equal(isValidSourceRange('abc', range), true);
    }
    for (const range of [
        { start: -1, end: 0 },
        { start: 2, end: 1 },
        { start: 0, end: 4 },
        { start: 0.5, end: 1 },
        { start: 0, end: Number.NaN },
        { start: 0, end: Number.POSITIVE_INFINITY },
    ]) {
        assert.equal(isValidSourceRange('abc', range), false);
    }
});

test('line boundaries exclude LF and CRLF but retain literal isolated CR', () => {
    assert.equal(findLineContentEnd('abc\ndef', 0), 3);
    assert.equal(findLineContentEnd('abc\r\ndef', 1), 3);
    assert.equal(findLineContentEnd('abc\r\ndef', 5), 8);
    assert.equal(findLineContentEnd('abc\rdef', 0), 7);
    assert.equal(findLineContentEnd('', 0), 0);
});

test('source unions merge nested, overlapping, and touching ranges without mutation', () => {
    const ranges = [
        { end: 7, start: 5 },
        { end: 3, start: 1 },
        { end: 5, start: 3 },
        { end: 2, start: 1 },
        { end: 10, start: 10 },
    ];
    const before = structuredClone(ranges);
    const merged = mergeSourceRanges(ranges);

    assert.deepEqual(merged, [
        { end: 7, start: 1 },
        { end: 10, start: 10 },
    ]);
    merged[0].end = 20;
    assert.deepEqual(ranges, before);
    assert.deepEqual(mergeSourceRanges([]), []);
});

test('source masks preserve offsets including UTF-16 characters and newlines', () => {
    const source = 'A😀\nBCdef';
    const masked = maskSourceRanges(source, [
        { end: 5, start: 3 },
        { end: 4, start: 1 },
        { end: 2, start: 1 },
    ]);

    assert.equal(masked, 'A    Cdef');
    assert.equal(masked.length, source.length);
    assert.equal(maskSourceRanges(source, []), source);
});

test('source replacements retain original offsets with insertions, deletion, and growth', () => {
    const replacements = [
        { end: 4, start: 3, value: '' },
        { end: 0, start: 0, value: '!' },
        { end: 3, start: 1, value: 'long' },
        { end: 6, start: 6, value: '.' },
    ];
    const before = structuredClone(replacements);

    assert.equal(replaceSourceRanges('abcdef', replacements), '!alongef.');
    assert.deepEqual(replacements, before);
    assert.equal(replaceSourceRanges('abc', []), 'abc');
});

test('tag markup ranges include only actual opening and closing syntax', () => {
    const source =
        '<span title=">">a<br/>b</span><nowiki><i>literal</i></nowiki><!-- <b> --> <ref>open';
    const ranges = getTagMarkupRanges(wikitext(source).tag.getAll());

    assert.deepEqual(
        ranges
            .toSorted((left, right) => left.start - right.start)
            .map(({ end, start }) => source.slice(start, end)),
        [
            '<span title=">">',
            '<br/>',
            '</span>',
            '<nowiki>',
            '</nowiki>',
            '<ref>',
        ],
    );
    const masked = maskSourceRanges(source, ranges);
    assert.equal(masked.length, source.length);
    assert.ok(masked.includes('<i>literal</i>'));
    assert.ok(masked.includes('<!-- <b> -->'));
    assert.ok(masked.endsWith('open'));
});

test('tag markup projection retains the caller’s literal-tag policy', () => {
    const source = '<poem><b>text</b></poem>';
    const literal = wikitext(source, { literalTags: ['poem'] });

    assert.equal(getTagMarkupRanges(wikitext(source).tag.getAll()).length, 4);
    assert.deepEqual(
        getTagMarkupRanges(literal.tag.getAll()).map(({ end, start }) =>
            source.slice(start, end),
        ),
        ['<poem>', '</poem>'],
    );
});
