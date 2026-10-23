/**
 * @file tests/source-editor/citation-metadata.test.ts
 * Purpose: Tests package-local mapping of raw Citoid metadata.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveWikiPolicy } from '../../src/source-editor/domain/wiki-policy.ts';

import * as citation from '../../src/source-editor/domain/citation-metadata.ts';

const bibliographicMetadata = {
    DOI: [null, '10.1000/example'],
    ISBN: '978-0-306-40615-7',
    ISSN: ['2049-3630'],
    bookTitle: 'Collected Work',
    creators: [
        {
            creatorType: 'author',
            firstName: 'Jane',
            lastName: 'Doe',
        },
    ],
    date: 'May 2024',
    edition: '2nd',
    extra: 'OCLC: 12345\nPMCID: PMC987\nPMID: 456',
    issue: '4',
    itemType: 'bookSection',
    pages: '10–20',
    place: 'Example City',
    publicationTitle: 'Example Library',
    publisher: 'Example Press',
    series: 'Example Series',
    title: 'One Chapter',
    volume: '3',
};

test('maps raw web metadata without consumer-specific cleanup', () => {
    const result = citation.buildCitationTemplate(
        {
            creators: [
                {
                    creatorType: 'author',
                    name: 'Raw Author',
                },
            ],
            itemType: 'webpage',
            language: 'en-US',
            publisher: 'Raw Publisher LLC',
            title: 'Example - Raw Site',
            url: 'https://rewritten.example.test/article',
            websiteTitle: 'Raw Review Site',
        },
        {
            now: new Date('2026-07-29T00:00:00Z'),
            url: 'https://entered.example.test/article?id=1',
        },
    );

    assert.match(result, /^\{\{Cite web\n/u);
    assert.match(result, /\| author = Raw Author/u);
    assert.match(result, /\| title = Example - Raw Site/u);
    assert.match(
        result,
        /\| url = https:\/\/entered\.example\.test\/article\?id=1/u,
    );
    assert.doesNotMatch(result, /rewritten\.example/u);
    assert.match(result, /\| website = Raw Review Site/u);
    assert.match(result, /\| publisher = Raw Publisher LLC/u);
    assert.match(result, /\| access-date = 2026-07-29/u);
    assert.match(result, /\| language = en-US/u);
});

test('maps bibliographic fields through complete local TemplateData', () => {
    const result = citation.buildCitationTemplate(bibliographicMetadata, {
        bibliographic: true,
        now: new Date('2026-07-29T00:00:00Z'),
        wikiPolicy: resolveWikiPolicy('zhwiki'),
    });

    assert.match(result, /^\{\{Cite book/u);
    assert.match(result, /\| author = Jane Doe/u);
    assert.match(result, /\| title = Collected Work/u);
    assert.match(result, /\| chapter = One Chapter/u);
    assert.match(result, /\| work = Example Library/u);
    assert.match(result, /\| date = 2024-05/u);
    assert.match(result, /\| publisher = Example Press/u);
    assert.match(result, /\| isbn = 978-0-306-40615-7/u);
    assert.match(result, /\| doi = 10\.1000\/example/u);
    assert.match(result, /\| oclc = 12345/u);
    assert.match(result, /\| pmc = 987/u);
    assert.match(result, /\| pmid = 456/u);
    assert.doesNotMatch(result, /access-date/u);
});

test('escapes remote pipe characters before serialization', () => {
    const result = citation.buildCitationTemplate(
        {
            itemType: 'webpage',
            publisher: 'Publisher|language=Injected',
            title: 'Title|url=https://attacker.example',
            url: 'https://metadata.example/article|part',
        },
        { now: new Date('2026-07-29T00:00:00Z') },
    );

    assert.match(result, /Title\{\{!\}\}url=https:\/\/attacker\.example/u);
    assert.match(result, /Publisher\{\{!\}\}language=Injected/u);
    assert.match(result, /https:\/\/metadata\.example\/article\{\{!\}\}part/u);
    assert.doesNotMatch(result, /^\s*\| language = Injected$/mu);
});

test('omits URL-only titles and maps periodicals to Cite news', () => {
    const result = citation.buildCitationTemplate(
        {
            itemType: 'magazineArticle',
            publicationTitle: 'Example Magazine',
            title: 'https://example.test/article',
            url: 'https://example.test/article',
        },
        {
            now: new Date('2026-07-29T00:00:00Z'),
            url: 'https://example.test/original',
        },
    );

    assert.match(result, /^\{\{Cite news/u);
    assert.match(result, /\| work = Example Magazine/u);
    assert.match(result, /\| url = https:\/\/example\.test\/original/u);
    assert.doesNotMatch(result, /\| title =/u);
});
