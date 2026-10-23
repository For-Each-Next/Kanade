/**
 * @file tests/source-editor/script-title-policy.test.ts
 * Purpose: Verify content-language title policies across draft and article formatting.
 *
 * Contents: Eligibility, displayed examples, language boundaries, and source preservation.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getScriptTitleExampleLanguages,
    resolveScriptTitlePolicy,
    type ScriptTitleMode,
} from '../../src/source-editor/domain/script-title-policy.ts';
import {
    formatSourceDraftScriptTitle,
    formatSourceScriptTitles,
    parseSourceDraft,
    serializeSourceDraft,
} from '../../src/source-editor/domain/source-manager.ts';

const MODES: readonly ScriptTitleMode[] = [
    'non-latin',
    'all-foreign',
    'always',
];

for (const [contentLanguage, foreignLanguages] of [
    ['zh', ['en', 'ja', 'ru']],
    ['en', ['de', 'ja', 'ru']],
] as const) {
    test(`${contentLanguage} title modes agree with their displayed language examples`, () => {
        const policy = resolveScriptTitlePolicy(contentLanguage);
        const examples: Record<ScriptTitleMode, readonly string[]> = {
            'all-foreign': foreignLanguages,
            always: [contentLanguage, ...foreignLanguages],
            'non-latin': ['ja', 'ru'],
        };
        for (const mode of MODES) {
            const expected = examples[mode];
            assert.deepEqual(
                getScriptTitleExampleLanguages(contentLanguage, mode),
                expected,
            );
            for (const language of [contentLanguage, ...foreignLanguages]) {
                assert.equal(
                    policy.getLanguagePrefix(language, mode),
                    expected.includes(language) ? language : null,
                    `${mode}: ${language}`,
                );
            }
        }
    });

    for (const mode of MODES) {
        test(`${contentLanguage} ${mode} applies the same policy to a draft and an article`, () => {
            const languages = [contentLanguage, ...foreignLanguages];
            const eligible = getScriptTitleExampleLanguages(
                contentLanguage,
                mode,
            );
            const citations = languages.map(
                (language) =>
                    `{{cite web|title=Title ${language}|language=${language}}}`,
            );
            const article = citations
                .map((text) => `<ref>${text}</ref>`)
                .join('');
            const result = formatSourceScriptTitles(
                article,
                'examplewiki',
                mode,
                undefined,
                contentLanguage,
            );
            assert.equal(result.formatted, eligible.length);
            for (const [index, language] of languages.entries()) {
                const draft = parseSourceDraft(citations[index]);
                const shouldConvert = eligible.includes(language);
                assert.equal(
                    formatSourceDraftScriptTitle(
                        draft,
                        'examplewiki',
                        mode,
                        contentLanguage,
                    ),
                    shouldConvert,
                );
                const rendered = serializeSourceDraft(draft, 'inline');
                if (shouldConvert) {
                    const prefix = `script-title = ${language}:Title ${language}`;
                    assert.ok(rendered.includes(prefix));
                    assert.ok(result.text.includes(prefix));
                    assert.equal(
                        draft.rows.find((row) => row.name === 'title')?.value,
                        '',
                    );
                } else {
                    assert.ok(rendered.includes(`title = Title ${language}`));
                    assert.ok(result.text.includes(citations[index]));
                }
            }
            assert.deepEqual(
                formatSourceScriptTitles(
                    result.text,
                    'examplewiki',
                    mode,
                    undefined,
                    contentLanguage,
                ),
                { formatted: 0, text: result.text },
            );
        });
    }
}

test('target content language takes precedence over the wiki ID fallback', () => {
    for (const [wikiId, contentLanguage, localLanguage, foreignLanguage] of [
        ['enwiki', 'ZH-Hant', 'zh-Hans', 'en-US'],
        ['zhwiki', 'EN-gb', 'en-US', 'zh-Hant'],
    ] as const) {
        const local = parseSourceDraft(
            `{{cite web|title=Local title|language=${localLanguage}}}`,
        );
        const foreign = parseSourceDraft(
            `{{cite web|title=Foreign title|language=${foreignLanguage}}}`,
        );
        assert.equal(
            formatSourceDraftScriptTitle(
                local,
                wikiId,
                'all-foreign',
                contentLanguage,
            ),
            false,
        );
        assert.equal(
            formatSourceDraftScriptTitle(
                foreign,
                wikiId,
                'all-foreign',
                contentLanguage,
            ),
            true,
        );
        assert.match(
            serializeSourceDraft(foreign, 'inline'),
            new RegExp(
                `script-title = ${foreignLanguage.slice(0, 2)}:Foreign title`,
                'u',
            ),
        );
    }
});

test('verified wiki defaults remain available for callers without a content language', () => {
    for (const [wikiId, language] of [
        ['enwiki', 'en-US'],
        ['zhwiki', 'zh-Hant'],
    ] as const) {
        const draft = parseSourceDraft(
            `{{cite web|title=Local title|language=${language}}}`,
        );
        assert.equal(
            formatSourceDraftScriptTitle(draft, wikiId, 'all-foreign'),
            false,
        );
        assert.equal(
            formatSourceDraftScriptTitle(draft, wikiId, 'always'),
            true,
        );
    }
});

test('unknown target languages preserve titles until an unrestricted mode is chosen', () => {
    for (const contentLanguage of ['', 'English', 'en_US', 'en,zh']) {
        const policy = resolveScriptTitlePolicy(contentLanguage);
        assert.equal(policy.contentLanguage, '');
        for (const mode of ['all-foreign', 'non-latin'] as const) {
            assert.equal(policy.getLanguagePrefix('ja', mode), null);
            assert.deepEqual(
                getScriptTitleExampleLanguages(contentLanguage, mode),
                [],
            );
            const draft = parseSourceDraft(
                '{{cite web|title=記事|language=ja}}',
            );
            assert.equal(
                formatSourceDraftScriptTitle(
                    draft,
                    'enwiki',
                    mode,
                    contentLanguage,
                ),
                false,
            );
        }
        assert.equal(policy.getLanguagePrefix('ja-Jpan-JP', 'always'), 'ja');
    }
    const draft = parseSourceDraft('{{cite web|title=記事|language=ja}}');
    assert.equal(formatSourceDraftScriptTitle(draft, 'examplewiki'), false);
});

test('illustrations for other target languages contain eligible distinct language codes', () => {
    for (const contentLanguage of ['de', 'ja', 'ru', 'ar', 'zh-Hant']) {
        const policy = resolveScriptTitlePolicy(contentLanguage);
        for (const mode of MODES) {
            const examples = getScriptTitleExampleLanguages(
                contentLanguage,
                mode,
            );
            assert.equal(new Set(examples).size, examples.length);
            for (const language of examples) {
                assert.equal(
                    policy.getLanguagePrefix(language, mode),
                    language,
                );
            }
            if (mode === 'always') {
                assert.equal(examples[0], policy.contentLanguage);
            } else {
                assert.ok(!examples.includes(policy.contentLanguage));
            }
        }
    }
});

test('all modes preserve ambiguous citation languages and existing populated script titles', () => {
    for (const mode of MODES) {
        for (const language of [
            '',
            'ja,ru',
            'Japanese',
            'ja_JP',
            '{{lang|ja}}',
        ]) {
            const draft = parseSourceDraft(
                `{{cite web|title=Original|language=${language}}}`,
            );
            assert.equal(
                formatSourceDraftScriptTitle(draft, 'enwiki', mode),
                false,
                `${mode}: ${language}`,
            );
            assert.equal(
                draft.rows.find((row) => row.name === 'title')?.value,
                'Original',
            );
        }
        const draft = parseSourceDraft(
            '{{cite web|title=Translation|script-title=ja:記事|language=ja}}',
        );
        assert.equal(
            formatSourceDraftScriptTitle(draft, 'enwiki', mode),
            false,
        );
        assert.equal(
            draft.rows.find((row) => row.name === 'title')?.value,
            'Translation',
        );
        assert.equal(
            draft.rows.find((row) => row.name === 'script-title')?.value,
            'ja:記事',
        );
    }
});

test('always mode preserves protected source and title annotations', () => {
    const protectedText =
        '<nowiki>{{cite web|title=Example|language=en}}</nowiki>';
    const citation =
        '{{cite web|title=Example<!-- # Alternate -->|language=en}}';
    const result = formatSourceScriptTitles(
        `${protectedText}<ref>${citation}</ref>`,
        'enwiki',
        'always',
    );
    assert.equal(result.formatted, 1);
    assert.ok(result.text.startsWith(protectedText));
    assert.match(
        result.text,
        /script-title = en:Example <!-- # Alternate -->/u,
    );
});
