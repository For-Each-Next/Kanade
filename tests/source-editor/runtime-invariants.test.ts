/**
 * @file tests/source-editor/runtime-invariants.test.ts
 * Purpose: Preserve Source Editor's pure API, highlighting, and source history invariants.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 * 3. metadataAt
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import * as highlightPartition from '../../src/library/wikitext-highlighting/highlight-partition.ts';
import { highlightWikitext } from '../../src/library/wikitext-highlighting/highlighter.ts';
import { EditorHistory } from '../../src/source-editor/features/editor/history.ts';

test('Source Editor exposes editing and reference operations without browser startup', async () => {
    const api = await import('../../src/source-editor/index.ts');

    for (const operation of [
        'buildReferencePreview',
        'formatArticleSource',
        'formatWikitext',
        'highlightWikitext',
        'formatCitations',
        'manageCitations',
    ]) {
        assert.equal(
            typeof api[operation as keyof typeof api],
            'function',
            operation,
        );
    }
    assert.equal(typeof globalThis.window, 'undefined');
    assert.equal(api.highlightWikitext, highlightWikitext);
});

test('highlighting is a deterministic lossless source partition', () => {
    const source = [
        '== Heading ==',
        "Text [[Target#Part|'''label''']] and {{Example|name=value}}.",
        '<ref name="source">{{cite web|title=Source}}</ref>',
        '<!-- {{opaque}} -->',
    ].join('\n');
    const first = highlightWikitext(source);
    const second = highlightWikitext(source);

    assert.deepEqual(second, first);
    assert.equal(first.map((segment) => segment.text).join(''), source);
    assert.equal(first[0]?.start, 0);
    assert.equal(first.at(-1)?.end, source.length);
    for (const [index, segment] of first.entries()) {
        assert.equal(segment.text, source.slice(segment.start, segment.end));
        if (index > 0) {
            assert.equal(segment.start, first[index - 1]?.end);
        }
    }
});

test('highlight range unions discard non-visible intervals before merging', () => {
    assert.deepEqual(
        highlightPartition.mergeSourceRanges([
            { end: 5, start: 3 },
            { end: 3, start: 1 },
            { end: 9, start: 9 },
            { end: 12, start: 13 },
        ]),
        [{ end: 5, start: 1 }],
    );
});

test('metadata remains attached to its source offset', () => {
    const source = [
        '[[Target#Part|label]]',
        '{{Example|name=value}}',
        '<ref name="source">{{cite web|title=Source}}</ref>',
    ].join(' ');
    const segments = highlightWikitext(source);

    assert.equal(
        metadataAt(source, segments, 'Target#Part').href,
        '/wiki/Target%23Part',
    );
    assert.equal(
        metadataAt(source, segments, 'Target#Part').missingTitle,
        'Target',
    );
    assert.equal(
        metadataAt(source, segments, 'label').href,
        '/wiki/Target%23Part',
    );
    assert.equal(
        metadataAt(source, segments, 'Example').href,
        '/wiki/Template%3AExample',
    );
    assert.equal(metadataAt(source, segments, 'value').href, undefined);
    assert.equal(
        metadataAt(source, segments, 'cite web').referenceSource,
        '<ref name="source">{{cite web|title=Source}}</ref>',
    );
});

test('selection-only updates do not create an editor undo step', () => {
    const history = new EditorHistory({ end: 3, source: 'abc', start: 3 });

    history.record({ end: 1, source: 'abc', start: 1 });
    history.record({ end: 2, source: 'aXbc', start: 2 });

    assert.deepEqual(history.undo(), {
        end: 1,
        source: 'abc',
        start: 1,
    });
    assert.equal(history.undo(), null);
});

test('range partitioning gives opaque syntax exclusive precedence', () => {
    const segments = highlightPartition.partitionHighlightRanges('Target', [
        {
            className: 'kanade-source-editor-token--link',
            end: 6,
            href: '/wiki/Target',
            missingTitle: 'Target',
            priority: 20,
            start: 0,
        },
        {
            className: 'kanade-source-editor-token--comment',
            end: 6,
            priority: 100,
            start: 3,
        },
    ]);

    assert.deepEqual(segments, [
        {
            classNames: ['kanade-source-editor-token--link'],
            end: 3,
            entity: undefined,
            href: '/wiki/Target',
            missingTitle: 'Target',
            referenceSource: undefined,
            start: 0,
            text: 'Tar',
        },
        {
            classNames: ['kanade-source-editor-token--comment'],
            end: 6,
            entity: undefined,
            href: undefined,
            missingTitle: undefined,
            referenceSource: undefined,
            start: 3,
            text: 'get',
        },
    ]);
});

function metadataAt(
    source: string,
    segments: ReturnType<typeof highlightWikitext>,
    text: string,
): ReturnType<typeof highlightWikitext>[number] {
    const offset = source.indexOf(text);
    const segment = segments.find(
        (candidate) => candidate.start <= offset && offset < candidate.end,
    );

    assert.ok(segment, `No highlight segment covers ${text}`);
    return segment;
}
