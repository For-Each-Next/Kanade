/**
 * @file tests/source-editor/domain-primitives.test.ts
 * Purpose: Tests shared citation-domain parsing and encoding primitives.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    isCalendarDayWithinUtcMonth,
    isGregorianCalendarDate,
} from '../../src/source-editor/domain/calendar-date.ts';
import {
    findCitationFormattingProtectedRanges,
    findCitationManagementProtectedRanges,
    findSourceDiscoveryProtectedRanges,
    findReferenceAttributeRanges,
    isInWikitextRanges,
    maskWikitextRanges,
} from '../../src/source-editor/domain/protected-wikitext.ts';
import {
    decodeReferenceAttribute,
    decodeReferenceDetailsAttribute,
    escapeQuotedAttribute,
    escapeReferenceDetails,
    formatReferenceGroupAttribute,
    formatReferenceDetailsAttribute,
    stripOptionalReferenceNameQuotes,
} from '../../src/source-editor/domain/ref-attributes.ts';

test('validates real Gregorian calendar days', () => {
    assert.equal(isGregorianCalendarDate(2024, 2, 29), true);
    assert.equal(isGregorianCalendarDate('2023', '02', '29'), false);
    assert.equal(isGregorianCalendarDate(2024, 13, 1), false);
    assert.equal(isGregorianCalendarDate(2024, 1, 0), false);
    assert.equal(isGregorianCalendarDate('0001', 1, 1), false);
    assert.equal(isCalendarDayWithinUtcMonth('0001', 1, 1), true);
});

test("keeps each citation workflow's protected-tag policy", () => {
    const text = [
        'before',
        '<!-- hidden -->',
        '<code>{{cite web|title=Code}}</code>',
        '<templatedata>{{cite web|title=Data}}</templatedata>',
        'after',
    ].join('');
    const codeOffset = text.indexOf('<code>');
    const templateDataOffset = text.indexOf('<templatedata>');
    const formatting = findCitationFormattingProtectedRanges(text);
    const management = findCitationManagementProtectedRanges(text);
    const discovery = findSourceDiscoveryProtectedRanges(text);

    assert.equal(isInWikitextRanges(codeOffset, formatting), true);
    assert.equal(isInWikitextRanges(codeOffset, management), false);
    assert.equal(isInWikitextRanges(templateDataOffset, formatting), false);
    assert.equal(isInWikitextRanges(templateDataOffset, discovery), true);

    const masked = maskWikitextRanges(text, discovery);
    assert.equal(masked.length, text.length);
    for (const [start, end] of discovery) {
        assert.equal(masked.slice(start, end), ' '.repeat(end - start));
    }
});

test('preserves historical reference-attribute entity policies', () => {
    assert.equal(
        decodeReferenceAttribute('A&amp;B&#38;C&#x26;D&quot;'),
        'A&B&C&D"',
    );
    assert.equal(
        decodeReferenceAttribute('A&#34;B&#x22;C&apos;D&lt;E&gt;&amp;quot;'),
        'A"B"C\'D<E>&quot;',
    );
    assert.equal(escapeQuotedAttribute('A&B"'), 'A&amp;B&quot;');
    assert.equal(
        formatReferenceGroupAttribute('note & "quote"'),
        ' group="note &amp; &quot;quote&quot;"',
    );
    assert.equal(stripOptionalReferenceNameQuotes(" 'Example' "), 'Example');
});

test('decodes details entities once and preserves quoted attribute wikitext', () => {
    assert.equal(
        decodeReferenceDetailsAttribute(
            '&amp;quot; &quot; &apos; &lt; &gt; &#34; &#x1f600;',
        ),
        '&quot; " \' < > " 😀',
    );
    assert.equal(
        decodeReferenceDetailsAttribute('&#0; &#xD800; &#x110000;'),
        '&#0; &#xD800; &#x110000;',
    );
    assert.equal(formatReferenceDetailsAttribute(undefined), '');
    assert.equal(formatReferenceDetailsAttribute(''), ' details=""');
    assert.equal(
        formatReferenceDetailsAttribute('{{lang|en|"quoted"}} &lt;p. 23&gt;'),
        ' details="{{lang|en|&quot;quoted&quot;}} &lt;p. 23&gt;"',
    );
    assert.equal(
        escapeReferenceDetails('A&B "<p. 23>"'),
        'A&amp;B &quot;&lt;p. 23&gt;&quot;',
    );
});

test('decodes HTML5 named entities once while preserving literal or unknown entity text', () => {
    assert.equal(decodeReferenceAttribute('&eacute;&NotEqualTilde;'), 'é≂̸');
    assert.equal(decodeReferenceAttribute('&amp;eacute;'), '&eacute;');
    assert.equal(
        decodeReferenceAttribute('&Quot;&notanentity;'),
        '&Quot;&notanentity;',
    );
});

test('protects templates in reference openings while leaving source bodies active', () => {
    const text =
        '<ref name="Book" details="{{r|Other}}">{{Cite book|title=Book}}</ref><ref name="Book" details="{{lang|en|p. 23}}" />';
    const ranges = findReferenceAttributeRanges(text);

    assert.equal(ranges.length, 2);
    assert.equal(isInWikitextRanges(text.indexOf('{{r|'), ranges), true);
    assert.equal(isInWikitextRanges(text.indexOf('{{lang|'), ranges), true);
    assert.equal(
        isInWikitextRanges(text.indexOf('{{Cite book|'), ranges),
        false,
    );
    assert.equal(maskWikitextRanges(text, ranges).length, text.length);
});
