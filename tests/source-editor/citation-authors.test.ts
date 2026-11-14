/**
 * @file tests/source-editor/citation-authors.test.ts
 * Purpose: Protect conservative comma-order author conversion in explicit batch formatting.
 * Contents: Personal names, numbered slots, ambiguity guards, protected syntax, and opt-in behavior.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { convertCitationAuthorNames } from '../../src/source-editor/domain/citation-authors.ts';
import { formatArticleSource } from '../../src/source-editor/domain/formatting.ts';

test('splits explicit surname, given names including numbered author slots', () => {
    const source =
        '{{cite web|author=Smith, Jane|author2=O’Neil, J. P.|author12=García Márquez, Gabriel|title=Example}}';
    assert.equal(
        convertCitationAuthorNames(source),
        '{{cite web|last=Smith|first=Jane|last2=O’Neil|first2=J. P.|last12=García Márquez|first12=Gabriel|title=Example}}',
    );
    const converted = convertCitationAuthorNames(source);
    assert.equal(convertCitationAuthorNames(converted), converted);
});

test('natural-order, corporate, non-Latin, markup, suffixes, and incomplete names stay intact', () => {
    for (const author of [
        'Jane Smith',
        'Smith',
        'Smith,',
        ', Jane',
        'Smith, Jane, Jr.',
        'Example Company, Inc.',
        'Editorial, Team',
        '王, 小明',
        '[[Smith]], Jane',
        'Smith, {{lang|en|Jane}}',
        'Smith, Jane<!-- note -->',
        'Smith & Jones, Jane',
        'Smith, Jane; Doe',
    ]) {
        const source = `{{cite web|author=${author}|title=Example}}`;
        assert.equal(convertCitationAuthorNames(source), source, author);
    }
});

test('existing structured fields and duplicate author slots are preserved', () => {
    for (const other of [
        'first=Existing',
        'last=',
        'surname1=Existing',
        'given1=',
        'author-first=Existing',
        'author1-last=Existing',
        'author1=Another, Person',
    ]) {
        const source = `{{cite web|author=Smith, Jane|${other}|title=Example}}`;
        assert.equal(convertCitationAuthorNames(source), source, other);
    }
    const source =
        '{{cite web|author2=Smith, Jane|first2=Existing|author3=Doe, John}}';
    assert.equal(
        convertCitationAuthorNames(source),
        '{{cite web|author2=Smith, Jane|first2=Existing|last3=Doe|first3=John}}',
    );
});

test('literal examples, comments, reference attributes, and unrelated templates stay intact', () => {
    const citation = '{{cite web|author=Smith, Jane|title=Example}}';
    const examples = [
        `<!-- ${citation} -->`,
        `<nowiki>${citation}</nowiki>`,
        `<syntaxhighlight lang="wikitext">${citation}</syntaxhighlight>`,
        `<ref name="${citation}" />`,
        '{{example|author=Smith, Jane}}',
    ];
    const source = examples.join('\n');
    assert.equal(convertCitationAuthorNames(source), source);
});

test('batch formatting requires author conversion opt-in and keeps natural-order author fields', () => {
    const source =
        '<ref>{{cite web|author=Smith, Jane|title=Example}}</ref> <ref>{{cite web|author=Jane Smith|title=Other}}</ref><references />';
    const defaultResult = formatArticleSource(source, {
        references: { layout: 'inline' },
    });
    assert.match(defaultResult.text, /author = Smith, Jane/u);
    assert.doesNotMatch(defaultResult.text, /first = Jane/u);
    const options = {
        references: { layout: 'inline' as const, convertAuthorNames: true },
    };
    const result = formatArticleSource(source, options);
    assert.match(result.text, /last = Smith \| first = Jane/u);
    assert.match(result.text, /author = Jane Smith/u);
    assert.equal(formatArticleSource(result.text, options).text, result.text);
});
