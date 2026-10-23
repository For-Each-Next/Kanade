/**
 * @file tests/vg-stub-creator/citation-parser.test.ts
 * Purpose: Preserve citation fields while parsing nested and protected wikitext.
 * Contents: Balanced syntax, duplicate rows, positional values, and editor defaults.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildCiteTemplateFromParts,
    parseCiteTemplate,
} from '../../src/vg-stub-creator/domain/citations/citation.ts';

test('citation parsing keeps nested constructs and protected delimiters within their field', () => {
    for (const title of [
        '[[Bird|Bird display]]',
        '{{lang|ja|鳥}}',
        '{{{title|{{lang|ja|鳥}}}}}',
        '<nowiki>A|B=C</nowiki>',
        'A<!-- |x=y -->B',
        '<ref name="a|b">A|B=C</ref>',
    ]) {
        const parsed = parseCiteTemplate(
            `{{cite web|title=${title}|url=https://example.test?a=b&c=d}}`,
        );
        assert.deepEqual(
            parsed.params,
            [
                { name: 'title', value: title },
                { name: 'url', value: 'https://example.test?a=b&c=d' },
            ],
            title,
        );
    }
});

test('citation parsing recognizes equals only outside nested parameter-name syntax', () => {
    assert.deepEqual(
        parseCiteTemplate('{{Example|{{name|x=y}}=value|other=tail}}'),
        {
            template: 'Example',
            params: [
                { name: '{{name|x=y}}', value: 'value' },
                { name: 'other', value: 'tail' },
            ],
        },
    );
});

test('unnamed values receive explicit numeric names for citation review and rebuilding', () => {
    const parsed = parseCiteTemplate('{{Example|first|second}}');
    assert.deepEqual(parsed.params, [
        { name: '1', value: 'first' },
        { name: '2', value: 'second' },
    ]);
    assert.equal(
        buildCiteTemplateFromParts(parsed),
        '{{Example|1=first|2=second}}',
    );
    assert.deepEqual(
        parseCiteTemplate('{{Example|[[Bird|Display]]|1=override}}').params,
        [
            { name: '1', value: '[[Bird|Display]]' },
            { name: '1', value: 'override' },
        ],
    );
});

test('citation parser retains defaults, duplicate rows, and empty named values', () => {
    assert.deepEqual(parseCiteTemplate('  '), {
        template: 'cite web',
        params: [],
    });
    assert.deepEqual(
        parseCiteTemplate(
            ' {{ |unknown=|title=First|title=Second|unknown=last}} ',
        ),
        {
            template: 'cite web',
            params: [
                { name: 'title', value: 'First' },
                { name: 'title', value: 'Second' },
                { name: 'unknown', value: '' },
                { name: 'unknown', value: 'last' },
            ],
        },
    );
});
