/**
 * @file tests/source-editor/domain/formatting.test.ts
 * Purpose: Verify coordinated article/reference formatting and explicit transformation choices.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
    formatArticleSource,
    resolveWikiPolicy,
} from '../../../src/source-editor/index.ts';
import { createDefaultFormatterSettings } from '../../../src/source-editor/domain/formatter-settings.ts';

const citation =
    '<ref name="source">{{cite web|title=Source|author=Example|date=January 2, 2025}}</ref>';

test('Source Editor performs no formatting until the corresponding operation is requested', () => {
    const source = `==Heading==\nText ${citation}\n<references />`;
    assert.deepEqual(formatArticleSource(source, {}), { text: source });
    const articleOnly = formatArticleSource(source, {
        wikitext: createDefaultFormatterSettings().formatter,
    });
    assert.match(articleOnly.text, /^== Heading ==/u);
    assert.ok(articleOnly.text.includes(citation));
    assert.equal(articleOnly.references, undefined);
});

test('one Source Editor operation applies article layout and citation layout while preserving literal examples', () => {
    const examples = [
        '<!-- {{cite web|title=Untouched|date=January 2, 2025}} -->',
        '<nowiki><ref>{{cite web|title=Untouched|date=January 2, 2025}}</ref></nowiki>',
        '<syntaxhighlight lang="wikitext">{{cite web|title=Untouched|date=January 2, 2025}}</syntaxhighlight>',
    ];
    const source = `==Heading==\nText ${citation}\n${examples.join('\n')}\n<references />`;
    const options = {
        wikitext: createDefaultFormatterSettings().formatter,
        references: {
            layout: 'block' as const,
            wikiPolicy: resolveWikiPolicy('enwiki'),
        },
    };
    const result = formatArticleSource(source, options);
    assert.match(result.text, /^== Heading ==/u);
    assert.match(result.text, /\{\{Cite web\n/u);
    assert.match(result.text, /date\s*=\s*2025-01-02/u);
    assert.equal(result.references?.citationsFormatted, 1);
    for (const example of examples) assert.ok(result.text.includes(example));
    assert.doesNotMatch(result.text, /\{\{r\|/u);
    assert.equal(formatArticleSource(result.text, options).text, result.text);
});

test('compact reference calls require an explicit shared formatting option', () => {
    const source = `Text ${citation} Again <ref name="source" />\n<references />`;
    const ordinary = formatArticleSource(source, {
        references: { layout: 'inline' },
    });
    assert.match(ordinary.text, /<ref name="Example, 2025" \/>/u);
    assert.doesNotMatch(ordinary.text, /\{\{r\|/u);
    const compact = formatArticleSource(source, {
        references: { layout: 'inline', compactReferences: true },
    });
    assert.match(compact.text, /\{\{r\|Example, 2025\}\}/u);
    assert.match(compact.text, /<ref name="Example, 2025">/u);
});
