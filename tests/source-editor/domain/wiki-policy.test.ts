/**
 * @file tests/source-editor/domain/wiki-policy.test.ts
 * Purpose: Keep citation date precision and per-wiki rules consistent across Source Editor workflows.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
    formatArticleSource,
    resolveWikiPolicy,
} from '../../../src/source-editor/index.ts';
import {
    canonicalizeSourceDraft,
    parseSourceDraft,
    serializeSourceDraft,
} from '../../../src/source-editor/domain/source-manager.ts';
import { getSourceDraftErrors } from '../../../src/source-editor/domain/source-validation.ts';
import { getCurrentWikiPolicy } from '../../../src/source-editor/platform/wiki-policy.ts';
import { buildCitationTemplate } from '../../../src/source-editor/domain/citation-metadata.ts';

test('English and Chinese wiki policies retain month precision in their accepted citation syntax', () => {
    const english = resolveWikiPolicy('enwiki').citationDates;
    const chinese = resolveWikiPolicy('zhwiki').citationDates;
    assert.equal(english.normalize('2026-07'), 'July 2026');
    assert.equal(english.normalize('July 2026'), 'July 2026');
    assert.equal(chinese.normalize('2026-07'), '2026-07');
    assert.equal(chinese.normalize('July 2026'), '2026-07');
    for (const policy of [english, chinese]) {
        assert.equal(policy.normalize('2026'), '2026');
        assert.equal(policy.normalize('July 26, 2026'), '2026-07-26');
        assert.equal(policy.normalize('2024-02-29'), '2024-02-29');
    }
});

test('wiki date policies preserve invalid, ambiguous and nonliteral values without inventing a day', () => {
    for (const wikiId of ['enwiki', 'zhwiki']) {
        const policy = resolveWikiPolicy(wikiId).citationDates;
        for (const value of [
            '2026-13',
            '2026-02-29',
            'February 29, 2026',
            '03/04/2026',
            '{{date|2026|7}}',
            'Summer 2026',
            '2026-Q3',
            '2025–2026',
            'July–August 2026',
        ]) {
            assert.equal(policy.normalize(value), value, `${wikiId}: ${value}`);
        }
    }
    assert.equal(
        resolveWikiPolicy('enwiki').citationDates.normalize(
            '2026-07 <!-- preserve provenance -->',
        ),
        'July 2026 <!-- preserve provenance -->',
    );
    assert.equal(
        resolveWikiPolicy('zhwiki').citationDates.normalize(
            'July 2026 <!-- preserve provenance -->',
        ),
        '2026-07 <!-- preserve provenance -->',
    );
});

test('historical numeric dates remain unchanged without guessing a calendar convention', () => {
    for (const wikiId of ['enwiki', 'zhwiki']) {
        const policy = resolveWikiPolicy(wikiId).citationDates;
        for (const value of ['1582-07', '1582-07-26']) {
            assert.equal(policy.normalize(value), value);
        }
    }
});

test('the current project selects policy by wiki ID then database name, independently of language', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'mw');
    try {
        for (const [config, expected] of [
            [
                {
                    wgWikiID: 'enwiki',
                    wgDBname: 'zhwiki',
                    wgUserLanguage: 'zh-Hans',
                },
                'enwiki',
            ],
            [
                { wgWikiID: '', wgDBname: 'zhwiki', wgUserLanguage: 'en' },
                'zhwiki',
            ],
            [
                {
                    wgWikiID: 'enwikisource',
                    wgDBname: 'enwiki',
                    wgUserLanguage: 'en',
                },
                'generic',
            ],
            [{ wgUserLanguage: 'zh' }, 'generic'],
        ] as const) {
            Object.defineProperty(globalThis, 'mw', {
                configurable: true,
                value: {
                    config: {
                        get: (key: string) =>
                            (config as Record<string, unknown>)[key],
                    },
                },
            });
            assert.equal(getCurrentWikiPolicy().id, expected);
        }
    } finally {
        if (original == null) Reflect.deleteProperty(globalThis, 'mw');
        else Object.defineProperty(globalThis, 'mw', original);
    }
});

test('unconfigured projects preserve dates instead of inheriting another wiki language policy', () => {
    for (const wikiId of ['examplewiki', 'enwikisource', 'zhwiktionary', '']) {
        for (const value of ['July 2026', '2026-07', 'July 26, 2026']) {
            assert.equal(
                resolveWikiPolicy(wikiId).citationDates.normalize(value),
                value,
            );
        }
    }
});

for (const [wikiId, expected] of [
    ['enwiki', 'July 2026'],
    ['zhwiki', '2026-07'],
    ['examplewiki', 'July 2026'],
] as const) {
    test(`${wikiId} applies the same date policy in the article formatter and citation editor`, () => {
        const wikiPolicy = resolveWikiPolicy(wikiId);
        const citation =
            '{{cite web|title=Example|url=https://example.test|date=July 2026}}';
        const article = `Lead <ref>${citation}</ref>\n<references />`;
        assert.equal(formatArticleSource(article, {}).text, article);
        const formatted = formatArticleSource(article, {
            references: { layout: 'inline', wikiPolicy },
        });
        const draft = parseSourceDraft(citation);
        const direct = serializeSourceDraft(draft, 'inline', wikiPolicy);
        canonicalizeSourceDraft(draft, wikiPolicy);
        const normalized = serializeSourceDraft(draft, 'inline', wikiPolicy);
        const generated = buildCitationTemplate(
            { itemType: 'book', title: 'Example', date: 'July 2026' },
            { bibliographic: true, wikiPolicy },
        );
        assert.equal(
            draft.rows.find((row) => row.name === 'date')?.value,
            expected,
        );
        assert.ok(formatted.text.includes(`date = ${expected}`));
        assert.ok(direct.includes(`date = ${expected}`));
        assert.ok(generated.includes(`date = ${expected}`));
        assert.equal(normalized, direct);
        assert.equal(
            formatArticleSource(formatted.text, {
                references: { layout: 'inline', wikiPolicy },
            }).text,
            formatted.text,
        );
    });
}

test('date validation follows each wiki and requires complete access and archive dates', () => {
    const errorsFor = (wikiId: string, name: string, value: string) => {
        const draft = parseSourceDraft(
            `{{cite web|title=Example|url=https://example.test|archive-url=https://archive.test|${name}=${value}}}`,
        );
        const row = draft.rows.findIndex((item) => item.name === name);
        assert.notEqual(row, -1);
        return getSourceDraftErrors(draft, wikiId).get(row)?.value;
    };
    assert.match(errorsFor('enwiki', 'date', '2026-07') ?? '', /correct date/u);
    assert.equal(errorsFor('enwiki', 'date', 'July 2026'), undefined);
    assert.equal(errorsFor('zhwiki', 'date', '2026-07'), undefined);
    for (const wikiId of ['enwiki', 'zhwiki']) {
        for (const name of ['access-date', 'archive-date']) {
            for (const value of ['2026', 'July 2026', '2026-07']) {
                assert.match(
                    errorsFor(wikiId, name, value) ?? '',
                    /correct date/u,
                    `${wikiId}: ${name}=${value}`,
                );
            }
            assert.equal(errorsFor(wikiId, name, '2026-07-26'), undefined);
        }
    }
});
