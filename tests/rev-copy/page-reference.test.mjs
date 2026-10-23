/**
 * @file tests/rev-copy/page-reference.test.mjs
 * Purpose: Verify attribution inputs preserve page, revision, and section identity.
 *
 * Contents: Prefixes, Wikimedia URLs, displayed defaults, and invalid inputs.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers.mjs';

const { parsePageReference, getWikiApiUrl, combinePageReferenceInput } =
    await loadModule('src/rev-copy/domain/page-reference.ts');
const current = {
    pageTitle: 'FIRE BIRD',
    revisionId: 321,
    site: { interwiki: 'w:zh', language: 'zh' },
    interfaceLanguage: 'zh-hant',
};

test('separate wiki and page fields preserve local namespaces, fragments, and prefix-only lookups', () => {
    for (const [prefix, page, expected] of [
        ['', '', ''],
        ['', '#History', '#History'],
        ['', 'ja:Source', 'ja:Source'],
        [' ja: ', ' Talk:Source#History ', 'ja:Talk:Source#History'],
        ['w:en', 'ja', 'w:en:ja'],
        ['wikt:en', 'bird', 'wikt:en:bird'],
        ['c', 'Category:Birds', 'c:Category:Birds'],
        [
            'w:ja',
            'Special:PermaLink/123#History',
            'w:ja:Special:PermaLink/123#History',
        ],
        ['ja', '', 'ja:'],
    ]) {
        const combined = combinePageReferenceInput(prefix, page);
        assert.equal(combined, expected);
        assert.deepEqual(
            parsePageReference(combined, current),
            parsePageReference(expected, current),
        );
    }
    const url =
        'https://ja.wikipedia.org/w/index.php?title=Source&oldid=123#History';
    assert.equal(combinePageReferenceInput('w:en', url), url);
    for (const prefix of [
        'https://example.org',
        'constructor',
        'w:en:extra',
        'invalid prefix',
        'wp',
    ]) {
        assert.throws(
            () => combinePageReferenceInput(prefix, 'Source'),
            /site prefix/u,
        );
    }
});

test('empty fields preserve the displayed revision; explicit titles request latest', () => {
    assert.deepEqual(parsePageReference('  ', current), {
        site: current.site,
        pageTitle: current.pageTitle,
        revisionId: 321,
    });
    assert.deepEqual(parsePageReference('FIRE_BIRD', current), {
        site: current.site,
        pageTitle: 'FIRE BIRD',
    });
    assert.equal(
        parsePageReference('', { ...current, revisionId: 0 }).revisionId,
        undefined,
    );
});

test('blank prefix defaults retain combined references and language shortcuts', () => {
    for (const fallback of ['en', 'zh']) {
        for (const input of [
            'ja:Page',
            'wikt:en:word',
            'commons:File:Example.jpg',
            'ja',
            'ja#History',
            ':w:ja:Page',
        ]) {
            const combined = combinePageReferenceInput(
                '',
                input,
                current.site.interwiki,
                fallback,
            );
            assert.equal(combined, input);
            assert.deepEqual(
                parsePageReference(combined, current),
                parsePageReference(input, current),
            );
        }
        for (const input of [
            'Example page',
            'File:Example.jpg',
            'WP:Attribution',
            'WT:Attribution',
            'H:Contents',
            ':ja',
        ]) {
            assert.deepEqual(
                parsePageReference(
                    combinePageReferenceInput(
                        '  ',
                        input,
                        current.site.interwiki,
                        fallback,
                    ),
                    current,
                ),
                {
                    site: { interwiki: `w:${fallback}`, language: fallback },
                    pageTitle: input.replace(/^:/u, ''),
                },
            );
        }
    }
});

test('explicit separate prefixes control colon-containing titles despite fallback defaults', () => {
    for (const input of ['ja:Page', 'wikt:en:word', ':ja', 'ja']) {
        assert.deepEqual(
            parsePageReference(
                combinePageReferenceInput('en', input, 'w:zh', 'zh'),
                current,
            ),
            {
                site: { interwiki: 'w:en', language: 'en' },
                pageTitle: input.replace(/^:/u, ''),
            },
        );
    }
    assert.equal(combinePageReferenceInput('', '', 'w:zh', 'en'), 'en:');
    assert.equal(combinePageReferenceInput('', '', 'w:zh', 'zh'), '');
    assert.equal(
        combinePageReferenceInput('', '#History', 'w:zh', 'zh'),
        '#History',
    );
});

test('language and project prefixes preserve namespaces and language-only lookup', () => {
    assert.deepEqual(
        parsePageReference('ja:FIRE BIRD (Roseliaの曲)', current),
        {
            site: { interwiki: 'w:ja', language: 'ja' },
            pageTitle: 'FIRE BIRD (Roseliaの曲)',
        },
    );
    assert.deepEqual(
        parsePageReference(':w:ja:Talk:FIRE_BIRD#ライブ', current),
        {
            site: { interwiki: 'w:ja', language: 'ja' },
            pageTitle: 'Talk:FIRE BIRD',
            sectionId: 'ライブ',
        },
    );
    assert.deepEqual(parsePageReference('zh:', current), {
        site: { interwiki: 'w:zh', language: 'zh' },
    });
    assert.deepEqual(parsePageReference('wikt:en:bird', current), {
        site: { interwiki: 'wikt:en', language: 'en' },
        pageTitle: 'bird',
    });
    assert.deepEqual(parsePageReference('Category:Birds', current), {
        site: current.site,
        pageTitle: 'Category:Birds',
    });
    assert.equal(
        parsePageReference('commons:File:Bird.jpg', current).site.interwiki,
        'c',
    );
    assert.equal(
        parsePageReference('c:File:Bird.jpg', current).site.interwiki,
        'c',
    );
    assert.equal(
        parsePageReference('m:Help:Contents', current).site.interwiki,
        'm',
    );
    assert.equal(
        getWikiApiUrl({ interwiki: 'c', language: 'en' }),
        'https://commons.wikimedia.org/w/api.php',
    );
    assert.equal(
        getWikiApiUrl({ interwiki: 'm', language: 'en' }),
        'https://meta.wikimedia.org/w/api.php',
    );
    for (const title of ['WP:Attribution', 'WT:Attribution', 'H:Contents']) {
        assert.equal(parsePageReference(title, current).site.interwiki, 'w:zh');
    }
    for (const language of ['simple', 'be-tarask', 'zh-classical']) {
        assert.equal(
            parsePageReference(`${language}:Bird`, current).site.interwiki,
            `w:${language}`,
        );
    }
    assert.equal(
        parsePageReference('constructor:Bird', current).site.interwiki,
        'w:zh',
    );
});

test('explicit current-wiki defaults retain the displayed revision and section while other sites stay shorthand', () => {
    for (const language of ['zh', 'en', 'ja']) {
        const context = {
            ...current,
            site: { interwiki: `w:${language}`, language },
        };
        for (const prefix of [language, `w:${language}`]) {
            for (const section of ['', '#History']) {
                assert.deepEqual(
                    parsePageReference(
                        combinePageReferenceInput(
                            prefix,
                            section,
                            context.site.interwiki,
                        ),
                        context,
                    ),
                    parsePageReference(section, context),
                );
            }
        }
        assert.equal(
            parsePageReference(
                combinePageReferenceInput(
                    language,
                    'Other page',
                    context.site.interwiki,
                ),
                context,
            ).revisionId,
            undefined,
        );
    }
    assert.deepEqual(parsePageReference('en:', current), {
        site: { interwiki: 'w:en', language: 'en' },
    });
});

test('bare lowercase language codes are equivalent to language-only prefixes', () => {
    for (const language of ['ja', 'en', 'zh', 'ru', 'be-tarask', 'simple']) {
        assert.deepEqual(
            parsePageReference(language, current),
            parsePageReference(`${language}:`, current),
        );
    }
    assert.deepEqual(parsePageReference(' ja#History ', current), {
        site: { interwiki: 'w:ja', language: 'ja' },
        sectionId: 'History',
    });
});

test('leading colons escape bare shortcuts while ordinary title casing stays local', () => {
    assert.deepEqual(parsePageReference(':ja', current), {
        site: current.site,
        pageTitle: 'ja',
    });
    assert.deepEqual(parsePageReference(':ja#History', current), {
        site: current.site,
        pageTitle: 'ja',
        sectionId: 'History',
    });
    for (const title of [
        'Cat',
        'CPU',
        'JA',
        'Ja',
        'WP',
        'WT',
        'H',
        'wp',
        'wt',
        'h',
    ]) {
        assert.deepEqual(parsePageReference(title, current), {
            site: current.site,
            pageTitle: title,
        });
    }
    assert.deepEqual(
        parsePageReference('JA:', current),
        parsePageReference('ja:', current),
    );
});

test('local File and Commons Data namespaces are page titles, not URI schemes', () => {
    for (const title of ['File:Example.jpg', 'file:Example.jpg']) {
        assert.deepEqual(parsePageReference(title, current), {
            site: current.site,
            pageTitle: title,
        });
    }
    const commons = {
        ...current,
        site: { interwiki: 'commons', language: 'en' },
    };
    assert.deepEqual(parsePageReference('Data:Example.map', commons), {
        site: commons.site,
        pageTitle: 'Data:Example.map',
    });
    assert.equal(
        parsePageReference('commons:Data:Example.map', current).pageTitle,
        'Data:Example.map',
    );
});

test('fragment-only references preserve the current page and displayed revision', () => {
    assert.deepEqual(parsePageReference('#History', current), {
        site: current.site,
        pageTitle: current.pageTitle,
        revisionId: current.revisionId,
        sectionId: 'History',
    });
    assert.deepEqual(
        parsePageReference('#', current),
        parsePageReference('', current),
    );
    assert.equal(
        parsePageReference('#History', { ...current, revisionId: 0 })
            .revisionId,
        undefined,
    );
});

test('pasted historical links decode titles and fragments while retaining oldid', () => {
    assert.deepEqual(
        parsePageReference(
            'https://ja.wikipedia.org/w/index.php?title=FIRE_BIRD_(Roselia%E3%81%AE%E6%9B%B2)&oldid=110930823#%E3%83%A9%E3%82%A4%E3%83%96',
            current,
        ),
        {
            site: { interwiki: 'w:ja', language: 'ja' },
            pageTitle: 'FIRE BIRD (Roseliaの曲)',
            revisionId: 110930823,
            sectionId: 'ライブ',
        },
    );
    assert.deepEqual(
        parsePageReference(
            'https://ja.m.wikipedia.org/wiki/FIRE_BIRD#ライブ',
            current,
        ),
        {
            site: { interwiki: 'w:ja', language: 'ja' },
            pageTitle: 'FIRE BIRD',
            sectionId: 'ライブ',
        },
    );
    assert.equal(
        parsePageReference('//en.wikipedia.org/wiki/Bird', current).site
            .interwiki,
        'w:en',
    );
});

test('permanent links can identify a revision without a title', () => {
    for (const input of [
        'ja:Special:PermaLink/123#Song',
        'https://ja.wikipedia.org/wiki/Special:PermaLink/123#Song',
        'https://ja.wikipedia.org/w/index.php?oldid=123#Song',
    ]) {
        assert.deepEqual(parsePageReference(input, current), {
            site: { interwiki: 'w:ja', language: 'ja' },
            revisionId: 123,
            sectionId: 'Song',
        });
    }
});

test('invalid IDs, unsupported URL destinations, and ambiguous diff links fail', () => {
    for (const input of [
        'https://ja.wikipedia.org/w/index.php?title=Bird&oldid=0',
        'https://ja.wikipedia.org/w/index.php?title=Bird&oldid=1.5',
        'https://ja.wikipedia.org/w/index.php?title=Bird&oldid=9007199254740992',
        'https://ja.wikipedia.org/w/index.php?title=Bird&oldid=1&oldid=2',
        'https://ja.wikipedia.org/w/index.php?title=Bird&diff=123',
        'https://ja.wikipedia.org/wiki/Special:PermaLink/123?oldid=456',
        'https://evil.wikipedia.org.example.org/wiki/Bird',
        'https://ja.wikipedia.org:444/wiki/Bird',
        'https://person:password@ja.wikipedia.org/wiki/Bird',
        'https://ja.wikipedia.org/w/api.php?title=Bird',
        'https://ja.wikipedia.org/wiki/%ZZ',
        'https://ja.wikipedia.org/w/index.php',
        'javascript:alert(1)',
        'data:text/html,Bird',
        'data:;base64,QmlyZA==',
        'file:///etc/passwd',
        'file:/etc/passwd',
        'Bird|Another page',
        'File:Example.jpg|Other',
        'commons:Data:{{Example}}.map',
    ]) {
        assert.throws(
            () => parsePageReference(input, current),
            undefined,
            input,
        );
    }
    assert.equal(
        getWikiApiUrl({ interwiki: 'w:ja', language: 'ja' }),
        'https://ja.wikipedia.org/w/api.php',
    );
    assert.throws(() =>
        getWikiApiUrl({ interwiki: 'w:en.evil.test', language: 'en' }),
    );
});
