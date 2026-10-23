/**
 * @file tests/source-editor/source-analysis.test.ts
 * Purpose: Tests citation summaries, inconsistencies, and batch replacement.
 *
 * Table of contents:
 * 1. Imports
 * 2. buildAnalysisText
 * 3. assertAnalysisFindings
 * 4. Test scenarios
 * 5. findLinkedOccurrences
 * 6. applyLinkedReplacements
 * 7. buildAliasText
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    analyzeCitationSources,
    applySourceAnalysisReplacements,
    type CitationSourceAnalysis,
    type SourceAnalysisOccurrence,
} from '../../src/source-editor/domain/source-analysis.ts';
import {
    listExistingSources,
    type ExistingSource,
} from '../../src/source-editor/domain/source-manager.ts';

function buildAnalysisText(): string {
    return [
        '<ref name="A">{{cite web|author=Jane Doe|title=A|',
        'url=https://www.game.watch.impress.co.jp/docs/a|',
        'website=GAME WATCH<!-- # Game Watch -->|publisher=Impress}}</ref>',
        '<ref name="B">{{cite web',
        '|author=[[Jane Doe]]',
        '|title=B',
        '|url=http://game.watch.impress.co.jp/docs/b',
        '|website=[[GAME WATCH]]',
        '|publisher=[[Impress]]',
        '}}</ref>',
        '<ref name="C">{{cite interview|author=Other|title=C|',
        'url=https://game.watch.impress.co.jp/docs/c|',
        'work=GAME Watch|publisher=Impress}}</ref>',
        '<ref name="D">{{cite web|author=Jane Doe|title=D|',
        'url=https://different.test/d|website=Different}}</ref>',
    ].join('\n');
}

function assertAnalysisFindings(analysis: CitationSourceAnalysis): void {
    const publication = analysis.findings.find(
        (finding) =>
            finding.category === 'publication' &&
            finding.domain === 'game.watch.impress.co.jp',
    );
    assert.ok(publication);
    assert.equal(publication.suggestedValue, 'GAME WATCH');
    assert.deepEqual(publication.options, [
        { count: 1, value: 'GAME WATCH' },
        { count: 1, value: '[[GAME WATCH]]' },
        { count: 1, value: 'GAME Watch' },
    ]);
    assert.equal(publication.occurrences[2].parameter, 'work');
    assert.match(publication.reason, /wikitext style differs/u);

    const publisher = analysis.findings.find(
        (finding) => finding.category === 'publisher',
    );
    assert.ok(publisher);
    assert.deepEqual(publisher.options, [
        { count: 2, value: 'Impress' },
        { count: 1, value: '[[Impress]]' },
    ]);

    const author = analysis.findings.find(
        (finding) => finding.category === 'author',
    );
    assert.ok(author);
    assert.equal(author.occurrences.length, 3);
    assert.deepEqual(author.options, [
        { count: 2, value: 'Jane Doe' },
        { count: 1, value: '[[Jane Doe]]' },
    ]);
}

test('flags same-host citation variants', () => {
    const sources = listExistingSources(buildAnalysisText());
    const analysis = analyzeCitationSources(sources);
    assertAnalysisFindings(analysis);
});

function findLinkedOccurrences(
    sources: ExistingSource[],
): [SourceAnalysisOccurrence, SourceAnalysisOccurrence] {
    const analysis = analyzeCitationSources(sources);
    const publication = analysis.findings.find(
        (finding) => finding.category === 'publication',
    );
    const publisher = analysis.findings.find(
        (finding) => finding.category === 'publisher',
    );
    assert.ok(publication);
    assert.ok(publisher);
    const linkedWebsite = publication.occurrences.find(
        (occurrence) => occurrence.value === '[[GAME WATCH]]',
    );
    const linkedPublisher = publisher.occurrences.find(
        (occurrence) => occurrence.value === '[[Impress]]',
    );
    assert.ok(linkedWebsite);
    assert.ok(linkedPublisher);
    return [linkedWebsite, linkedPublisher];
}

function applyLinkedReplacements(
    text: string,
    sources: ExistingSource[],
    linkedWebsite: SourceAnalysisOccurrence,
    linkedPublisher: SourceAnalysisOccurrence,
): string {
    return applySourceAnalysisReplacements(text, sources, [
        {
            cell: linkedWebsite.cell,
            oldValue: linkedWebsite.value,
            parameter: linkedWebsite.parameter,
            replacement: 'GAME WATCH',
            rowIndex: linkedWebsite.rowIndex,
            sourceId: linkedWebsite.sourceId,
        },
        {
            cell: linkedPublisher.cell,
            oldValue: linkedPublisher.value,
            parameter: linkedPublisher.parameter,
            replacement: 'Impress',
            rowIndex: linkedPublisher.rowIndex,
            sourceId: linkedPublisher.sourceId,
        },
    ]);
}

test('applies only selected occurrences and retains comments', () => {
    const text = buildAnalysisText();
    const sources = listExistingSources(text);
    const [linkedWebsite, linkedPublisher] = findLinkedOccurrences(sources);
    const replaced = applyLinkedReplacements(
        text,
        sources,
        linkedWebsite,
        linkedPublisher,
    );

    assert.doesNotMatch(replaced, /\[\[GAME WATCH\]\]/u);
    assert.doesNotMatch(replaced, /\[\[Impress\]\]/u);
    assert.match(replaced, /website = GAME WATCH/u);
    assert.match(replaced, /publisher = Impress/u);
    assert.match(replaced, /website=GAME WATCH<!-- # Game Watch -->/u);
    assert.match(replaced, /work=GAME Watch/u);
    assert.match(replaced, /author = \[\[Jane Doe\]\]/u);
});

test('rejects stale selected analysis fields', () => {
    const text = buildAnalysisText();
    const sources = listExistingSources(text);
    const analysis = analyzeCitationSources(sources);
    const occurrence = analysis.findings[0]?.occurrences[0];
    assert.ok(occurrence);

    assert.throws(
        () =>
            applySourceAnalysisReplacements(text, sources, [
                {
                    cell: occurrence.cell,
                    oldValue: 'Changed after opening',
                    parameter: occurrence.parameter,
                    replacement: 'Replacement',
                    rowIndex: occurrence.rowIndex,
                    sourceId: occurrence.sourceId,
                },
            ]),
        /changed after the check opened/u,
    );
});

function buildAliasText(): string {
    return [
        '<ref name="Alias A">{{cite web|author=野口伸二',
        '<!-- # Noguchi, Shinji -->|title=A|',
        'url=https://example.test/interview<!-- # base-source -->}}</ref>',
        '<ref name="Alias B">{{cite web|author=[[野口伸二]]',
        '<!-- # Shinji Noguchi -->|title=B|',
        'url=https://example.test/interview#part}}</ref>',
        '<ref name="Alias C">{{cite web|author=野口伸二|title=C|',
        'url=https://different.test/c}}</ref>',
    ].join('\n');
}

test('flags differing and missing hashtag aliases and source keys', () => {
    const analysis = analyzeCitationSources(
        listExistingSources(buildAliasText()),
    );
    const aliases = analysis.findings.filter(
        (finding) => finding.category === 'alias',
    );
    const author = aliases.find((finding) => finding.label.includes('野口'));
    const sourceKey = aliases.find((finding) =>
        finding.label.startsWith('Source key'),
    );

    assert.ok(author);
    assert.deepEqual(author.options, [
        { count: 1, value: 'Noguchi, Shinji' },
        { count: 1, value: 'Shinji Noguchi' },
        { count: 1, value: '' },
    ]);
    assert.equal(author.suggestedValue, 'Noguchi, Shinji');
    assert.ok(sourceKey);
    assert.deepEqual(sourceKey.options, [
        { count: 1, value: 'base-source' },
        { count: 1, value: '' },
    ]);
});

test('fills a selected missing hashtag alias', () => {
    const text = buildAliasText();
    const sources = listExistingSources(text);
    const analysis = analyzeCitationSources(sources);
    const finding = analysis.findings.find(
        (candidate) =>
            candidate.category === 'alias' && candidate.label.includes('野口'),
    );
    const missing = finding?.occurrences.find(
        (occurrence) => occurrence.value === '',
    );
    assert.ok(missing);

    const updated = applySourceAnalysisReplacements(text, sources, [
        {
            cell: 'alias',
            oldValue: '',
            parameter: missing.parameter,
            replacement: 'Noguchi, Shinji',
            rowIndex: missing.rowIndex,
            sourceId: missing.sourceId,
        },
    ]);
    assert.match(updated, /author = 野口伸二 <!-- # Noguchi, Shinji -->/u);
    assert.match(updated, /<!-- # Shinji Noguchi -->/u);
});

test('batch changes values while preserving parameter names', () => {
    const text = [
        '<ref name="I1">{{cite interview|title=One|',
        'url=https://xbox360.ign.com/one|work=IGN}}</ref>',
        '<ref name="I2">{{cite web|title=Two|',
        'url=https://xbox360.ign.com/two|website=[[IGN]]}}</ref>',
    ].join('\n');
    const sources = listExistingSources(text);
    const finding = analyzeCitationSources(sources).findings.find(
        (candidate) => candidate.category === 'publication',
    );
    assert.ok(finding);
    const replacements = finding.occurrences.map((occurrence) => ({
        cell: occurrence.cell,
        oldValue: occurrence.value,
        parameter: occurrence.parameter,
        replacement: '[[IGN|IGN.com]]',
        rowIndex: occurrence.rowIndex,
        sourceId: occurrence.sourceId,
    }));
    const updated = applySourceAnalysisReplacements(
        text,
        sources,
        replacements,
    );

    assert.match(updated, /\| work = \[\[IGN\|IGN\.com\]\]/u);
    assert.match(updated, /\| website = \[\[IGN\|IGN\.com\]\]/u);
});

test('ignores parameter-name differences when values are equal', () => {
    const text = [
        '<ref name="Work">{{cite interview|title=One|',
        'url=https://itmedia.test/one|work=ITMedia}}</ref>',
        '<ref name="Website">{{cite web|title=Two|',
        'url=https://itmedia.test/two|website=ITMedia}}</ref>',
    ].join('\n');
    const findings = analyzeCitationSources(
        listExistingSources(text),
    ).findings.filter((candidate) => candidate.category === 'publication');

    assert.deepEqual(findings, []);
});
