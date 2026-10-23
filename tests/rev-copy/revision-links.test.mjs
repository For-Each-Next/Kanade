/**
 * @file tests/rev-copy/revision-links.test.mjs
 * Purpose: Verify wikitext targets and site-language UTC timestamp semantics.
 *
 * Table of contents:
 * 1. Imports and module loading
 * 2. Local and foreign wiki tests
 * 3. Site identity and validation tests
 * 4. Timestamp tests
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { loadModule } from './helpers.mjs';

const {
    buildRevisionLinks,
    buildPageLink,
    identifyWikiSite,
    normalizeHomeWiki,
    formatRevisionTimestamp,
} = await loadModule('src/rev-copy/index.ts');
const { examples } = JSON.parse(
    await readFile(
        new URL('./fixtures/wiki-examples.json', import.meta.url),
        'utf8',
    ),
);

test('Chinese home wiki links remain local and preserve the leading colon', () => {
    const links = buildRevisionLinks({
        pageTitle: 'Category:Intel_1103',
        revisionId: 123,
        timestamp: '2026-09-05T12:00:26Z',
        site: { interwiki: 'w:zh', language: 'zh' },
    });
    assert.equal(links.page, '[[:Category:Intel 1103]]');
    assert.equal(
        links.permalink,
        '[[:Special:PermaLink/123|2026年9月5日 12:00:26]]',
    );
    assert.equal(links.all, `${links.page} (${links.permalink})`);
});

for (const example of examples) {
    test(`pinned ${example.key} example qualifies both links for the same source wiki`, () => {
        const site = identifyWikiSite(example.host, example.language);
        const links = buildRevisionLinks({
            pageTitle: example.page,
            revisionId: example.revision,
            timestamp: example.timestamp,
            site,
        });
        assert.equal(links.page, `[[:${example.prefix}${example.page}]]`);
        assert.ok(
            links.permalink.startsWith(
                `[[:${example.prefix}Special:PermaLink/${example.revision}|`,
            ),
        );
        assert.ok(!links.all.includes('UTC'));
        assert.equal(links.all, `${links.page} (${links.permalink})`);
    });
}

test('home wiki override removes only the matching project and language prefix', () => {
    const english = { interwiki: 'w:en', language: 'en' };
    assert.equal(
        buildPageLink('Intel 1103', english, 'wikipedia:en'),
        '[[:Intel 1103]]',
    );
    assert.equal(
        buildPageLink(
            'Intel 1103',
            { interwiki: 'w:zh', language: 'zh' },
            'w:en',
        ),
        '[[:w:zh:Intel 1103]]',
    );
    assert.equal(normalizeHomeWiki(' Commons: '), 'c');
    assert.equal(normalizeHomeWiki('meta:'), 'm');
    assert.equal(normalizeHomeWiki('c'), 'c');
    assert.equal(normalizeHomeWiki('m'), 'm');
    assert.equal(
        buildPageLink('Test', { interwiki: 'c', language: 'en' }, 'commons'),
        '[[:Test]]',
    );
    assert.equal(
        buildPageLink('Test', { interwiki: 'meta', language: 'en' }),
        '[[:m:Test]]',
    );
    assert.throws(
        () => normalizeHomeWiki('https://zh.wikipedia.org'),
        /Unsupported home wiki/u,
    );
});

test('foreign comparison links preserve both IDs and the interwiki prefix', () => {
    const input = {
        pageTitle: 'Intel 1103',
        revisionId: 123,
        diffOldId: 88,
        timestamp: '2026-09-05T12:00:26Z',
        site: { interwiki: 'w:en', language: 'en' },
    };
    assert.equal(
        buildRevisionLinks(input).permalink,
        '[[:w:en:Special:Diff/88/123|September 5, 2026 at 12:00:26]]',
    );
    assert.equal(
        buildRevisionLinks({ ...input, diffOldId: 0 }).permalink,
        '[[:w:en:Special:Diff/123|September 5, 2026 at 12:00:26]]',
    );
    assert.throws(
        () => buildRevisionLinks({ ...input, diffOldId: -1 }),
        /old revision ID/u,
    );
});

test('section links keep the actual heading ID in page, revision, and comparison targets', () => {
    const input = {
        pageTitle: 'Intel 1103',
        revisionId: 123,
        sectionId: 'Technical_details',
        timestamp: '2026-09-05T12:00:26Z',
        site: { interwiki: 'w:en', language: 'en' },
    };
    const links = buildRevisionLinks(input);
    assert.equal(links.page, '[[:w:en:Intel 1103#Technical_details]]');
    assert.equal(
        links.permalink,
        '[[:w:en:Special:PermaLink/123#Technical_details|September 5, 2026 at 12:00:26]]',
    );
    assert.equal(
        buildRevisionLinks({ ...input, diffOldId: 88 }).permalink,
        '[[:w:en:Special:Diff/88/123#Technical_details|September 5, 2026 at 12:00:26]]',
    );
    assert.equal(
        buildPageLink(
            'Category:Intel 1103',
            { interwiki: 'commons', language: 'en' },
            'w:zh',
            'Media_in_category_"Intel_1103"',
        ),
        '[[:c:Category:Intel 1103#Media_in_category_"Intel_1103"]]',
    );
});

test('mobile and other Wikimedia projects identify correctly; unknown hosts are ignored', () => {
    assert.deepEqual(identifyWikiSite('ja.m.wikipedia.org', 'ja'), {
        interwiki: 'w:ja',
        language: 'ja',
    });
    assert.equal(
        identifyWikiSite('en.wiktionary.org', 'en').interwiki,
        'wikt:en',
    );
    assert.equal(
        identifyWikiSite('commons.m.wikimedia.org', 'en').interwiki,
        'c',
    );
    assert.equal(identifyWikiSite('www.wikidata.org', 'en').interwiki, 'd');
    assert.equal(identifyWikiSite('m.wikidata.org', 'en').interwiki, 'd');
    assert.equal(identifyWikiSite('m.mediawiki.org', 'en').interwiki, 'mw');
    assert.equal(identifyWikiSite('www.m.mediawiki.org', 'en').interwiki, 'mw');
    assert.equal(
        identifyWikiSite('evil.wikipedia.org.example.org', 'en'),
        null,
    );
    assert.equal(identifyWikiSite('www.wikipedia.org', 'en'), null);
    for (const host of ['constructor', 'en.constructor.org', '__proto__']) {
        assert.equal(identifyWikiSite(host, 'en'), null, host);
    }
});

test('wikitext metacharacters cannot create an extra target or markup', () => {
    assert.equal(
        buildPageLink('A&B|<x>[y]', { interwiki: 'commons', language: 'en' }),
        '[[:c:A&amp;B&#124;&lt;x&gt;&#91;y&#93;]]',
    );
    assert.throws(
        () =>
            buildRevisionLinks({
                pageTitle: 'A',
                revisionId: 0,
                timestamp: '2026-09-05T12:00:26Z',
                site: { interwiki: 'w:zh', language: 'zh' },
            }),
        /positive displayed revision/u,
    );
});

test('revision dates use site language, UTC and a 24-hour clock without a timezone suffix', () => {
    assert.equal(
        formatRevisionTimestamp('2025-10-06T08:41:52Z', 'ja'),
        '2025年10月6日 08:41:52',
    );
    assert.equal(
        formatRevisionTimestamp('2026-03-07T16:05:03Z', 'en'),
        'March 7, 2026 at 16:05:03',
    );
    assert.equal(
        formatRevisionTimestamp('2026-09-05T00:00:00Z', 'zh'),
        '2026年9月5日 00:00:00',
    );
    assert.equal(
        formatRevisionTimestamp('2026-09-05T23:59:00Z', 'ja'),
        '2026年9月5日 23:59:00',
    );
    assert.throws(
        () => formatRevisionTimestamp('bad-date', 'ja'),
        /Invalid revision timestamp/u,
    );
    assert.equal(
        formatRevisionTimestamp('2026-03-07T16:05:03Z', 'private_language'),
        'March 7, 2026 at 16:05:03',
    );
});
