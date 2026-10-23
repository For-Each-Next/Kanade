/**
 * @file tests/rev-copy/attribution.test.mjs
 * Purpose: Verify localized, revision-specific attribution without network access.
 * Contents: Direction, locale, option combinations, fragment safety, and validation.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers.mjs';

const { generateAttribution } = await loadModule(
    'src/rev-copy/domain/attribution.ts',
);
const { getAttributionLocale, getWikipediaLabel, getWikimediaProjectLabel } =
    await loadModule('src/rev-copy/domain/attribution-messages.ts');
const source = {
    pageTitle: 'FIRE BIRD (Roseliaの曲)',
    site: { interwiki: 'w:ja', language: 'ja' },
    revisionId: 110930823,
    timestamp: '2026-09-07T10:07:23Z',
};
const destination = {
    pageTitle: 'FIRE BIRD (Roselia歌曲)',
    site: { interwiki: 'w:zh', language: 'zh' },
    revisionId: 88591765,
    timestamp: '2026-09-08T11:18:32Z',
};
const defaults = {
    mode: 'translate',
    notice: false,
    partial: false,
    modified: false,
    interfaceLanguage: 'zh-Hant',
};

test('destination summary matches the requested Traditional Chinese format', () => {
    assert.equal(
        generateAttribution(source, destination, defaults),
        '翻譯自[[:w:ja:FIRE BIRD (Roseliaの曲)]]（[[:w:ja:Special:PermaLink/110930823|2026年9月7日 10:07:23]]版）',
    );
    assert.equal(
        generateAttribution(source, destination, {
            ...defaults,
            interfaceLanguage: 'zh-CN',
            partial: true,
            modified: true,
        }),
        '部分翻译自[[:w:ja:FIRE BIRD (Roseliaの曲)]]（[[:w:ja:Special:PermaLink/110930823|2026年9月7日 10:07:23]]版），并作修改',
    );
});

test('source talk notice is Japanese with the target only as its wiki-labeled permalink', () => {
    assert.equal(
        generateAttribution(source, destination, { ...defaults, notice: true }),
        '== 中国語版ウィキペディアへの翻訳 ==\n\n[[:FIRE BIRD (Roseliaの曲)]]の[[:Special:PermaLink/110930823|2026年9月7日 10:07:23]]版を[[:w:zh:Special:PermaLink/88591765|中国語版ウィキペディア]]に翻訳しました。 --~~~~',
    );
});

test('same-wiki copying uses a local destination permalink without an extra title link', () => {
    const target = {
        ...destination,
        pageTitle: 'New article',
        site: source.site,
    };
    const summary = generateAttribution(source, target, {
        ...defaults,
        mode: 'copy',
        partial: true,
        modified: true,
    });
    assert.equal(
        summary,
        '[[:FIRE BIRD (Roseliaの曲)]]の[[:Special:PermaLink/110930823|2026年9月7日 10:07:23]]版を一部転記し、改変',
    );
    const notice = generateAttribution(source, target, {
        ...defaults,
        mode: 'copy',
        notice: true,
    });
    assert.ok(!notice.includes('New article'));
    assert.ok(
        notice.includes(
            '[[:Special:PermaLink/88591765|日本語版ウィキペディア]]',
        ),
    );
    assert.ok(!notice.includes('w:ja:'));
    assert.ok(notice.endsWith('に転記しました。 --~~~~'));
});

test('notice fragments survive in source links and the destination permalink', () => {
    const from = { ...source, sectionId: 'ライブ・パフォーマンス' };
    const to = { ...destination, sectionId: '現場演出' };
    const text = generateAttribution(from, to, {
        ...defaults,
        notice: true,
        partial: true,
    });
    assert.ok(
        text.includes('[[:FIRE BIRD (Roseliaの曲)#ライブ・パフォーマンス]]'),
    );
    assert.ok(
        text.includes('[[:Special:PermaLink/110930823#ライブ・パフォーマンス|'),
    );
    assert.ok(!text.includes('FIRE BIRD (Roselia歌曲)'));
    assert.ok(text.includes('[[:w:zh:Special:PermaLink/88591765#現場演出|'));
    assert.ok(text.endsWith('に一部翻訳しました。 --~~~~'));
});

test('wikitext metacharacters cannot add templates, links, signatures, or markup', () => {
    const unsafe = "A_&{{T}}|[[B]]<tag>'~~\nheading";
    const from = { ...source, pageTitle: unsafe, sectionId: unsafe };
    const to = { ...destination, pageTitle: unsafe, sectionId: unsafe };
    const text = generateAttribution(from, to, { ...defaults, notice: true });
    assert.ok(
        text.includes(
            'A &amp;&#123;&#123;T&#125;&#125;&#124;&#91;&#91;B&#93;&#93;&lt;tag&gt;&#39;&#126;&#126; heading',
        ),
    );
    assert.ok(
        text.includes(
            '#A_&amp;&#123;&#123;T&#125;&#125;&#124;&#91;&#91;B&#93;&#93;&lt;tag&gt;&#39;&#126;&#126; heading',
        ),
    );
    assert.equal((text.match(/\n/gu) ?? []).length, 2);
    assert.equal((text.match(/~~~~/gu) ?? []).length, 1);
    assert.ok(!text.includes('{{T}}'));
    assert.ok(!text.includes('<tag>'));
});

test('summaries can attribute to a new destination without inventing its revision', () => {
    const to = {
        pageTitle: 'New article',
        site: { interwiki: 'w:en', language: 'en' },
    };
    assert.equal(
        generateAttribution(source, to, defaults),
        'This page was translated from [[:w:ja:FIRE BIRD (Roseliaの曲)]] (revision [[:w:ja:Special:PermaLink/110930823|September 7, 2026 at 10:07:23]])',
    );
    assert.throws(
        () => generateAttribution(source, to, { ...defaults, notice: true }),
        /destination revision ID/u,
    );
});

test('missing, invalid, and unavailable revision metadata is rejected', () => {
    for (const revisionId of [
        undefined,
        0,
        -1,
        1.5,
        Number.MAX_SAFE_INTEGER + 1,
    ]) {
        assert.throws(
            () =>
                generateAttribution(
                    { ...source, revisionId },
                    destination,
                    defaults,
                ),
            /source revision ID/u,
        );
        assert.throws(
            () =>
                generateAttribution(
                    source,
                    { ...destination, revisionId },
                    { ...defaults, notice: true },
                ),
            /destination revision ID/u,
        );
    }
    for (const timestamp of [undefined, '', 'not a timestamp']) {
        assert.throws(
            () =>
                generateAttribution(
                    { ...source, timestamp },
                    destination,
                    defaults,
                ),
            /source revision timestamp/u,
        );
        assert.throws(
            () =>
                generateAttribution(
                    source,
                    { ...destination, timestamp },
                    { ...defaults, notice: true },
                ),
            /destination revision timestamp/u,
        );
    }
    assert.throws(
        () =>
            generateAttribution(
                { ...source, pageTitle: '' },
                destination,
                defaults,
            ),
        /page titles/u,
    );
    assert.throws(
        () =>
            generateAttribution(
                source,
                { ...destination, pageTitle: ' ' },
                defaults,
            ),
        /page titles/u,
    );
});

const locales = {
    en: ['translated', 'copied', 'partially', 'with modifications'],
    'zh-Hans': ['翻译', '复制', '部分', '并作修改'],
    'zh-Hant': ['翻譯', '複製', '部分', '並作修改'],
    ja: ['翻訳', '転記', '一部', 'し、改変'],
    ru: ['переведена', 'скопирована', 'частично', 'с изменениями'],
    ko: ['번역했', '복사했', '부분적으로', '고 수정했'],
    fr: ['traduite', 'copiée', 'partiellement', 'avec des modifications'],
    de: ['übersetzt', 'kopiert', 'teilweise', 'und dabei verändert'],
    es: ['traducida', 'copiada', 'parcialmente', 'con modificaciones'],
    pt: ['traduzida', 'copiada', 'parcialmente', 'com modificações'],
    it: ['tradotta', 'copiata', 'parzialmente', 'con modifiche'],
    ar: ['تُرجمت', 'نُسخت', 'جزئيًا', 'مع تعديلات'],
};

for (const [locale, phrases] of Object.entries(locales)) {
    test(`${locale} localizes both modes, both directions, and all checkbox combinations`, () => {
        const site = {
            interwiki: `w:${locale.split('-')[0]}`,
            language: locale,
        };
        for (const notice of [false, true]) {
            const from = { ...source, ...(notice ? { site } : {}) };
            const to = { ...destination, ...(!notice ? { site } : {}) };
            for (const mode of ['translate', 'copy']) {
                for (const partial of [false, true]) {
                    for (const modified of [false, true]) {
                        const text = generateAttribution(from, to, {
                            ...defaults,
                            interfaceLanguage: locale,
                            notice,
                            mode,
                            partial,
                            modified,
                        });
                        assert.ok(
                            text.includes(
                                phrases[mode === 'translate' ? 0 : 1],
                            ),
                        );
                        assert.equal(text.includes(phrases[2]), partial);
                        assert.equal(text.includes(phrases[3]), modified);
                        assert.ok(text.includes('Special:PermaLink/110930823'));
                        assert.equal(
                            text.includes('Special:PermaLink/88591765'),
                            notice,
                        );
                        if (notice) {
                            assert.ok(!text.includes(destination.pageTitle));
                            assert.equal(
                                (text.match(/\[\[:/gu) ?? []).length,
                                3,
                            );
                        }
                        assert.equal(text.endsWith(' --~~~~'), notice);
                        if (!notice) assert.doesNotMatch(text, /[.。]$/u);
                        assert.ok(!text.includes('undefined'));
                        assert.ok(!text.includes('{partial}'));
                        assert.ok(!text.includes('UTC'));
                    }
                }
            }
        }
    });
}

test('Chinese UI chooses script only for Chinese output and site variant is the fallback', () => {
    assert.equal(getAttributionLocale('zh', 'zh-TW'), 'zh-Hant');
    assert.equal(getAttributionLocale('zh-Hant', 'zh-CN'), 'zh-Hans');
    assert.equal(getAttributionLocale('zh-HK', 'en'), 'zh-Hant');
    assert.equal(getAttributionLocale('ja', 'zh-Hant'), 'ja');
    assert.equal(getAttributionLocale('fr-CA', 'ja'), 'fr');
    assert.equal(getAttributionLocale('pt-BR', 'ja'), 'pt');
    assert.equal(getWikipediaLabel('ja', 'zh-Hant'), '日文維基百科');
    assert.equal(getWikipediaLabel('ko', 'zh-Hans'), '韩文维基百科');
    assert.equal(getWikipediaLabel('zh', 'ja'), '中国語版ウィキペディア');
});

test('Simple English identity remains distinct when siteinfo reports English', () => {
    const english = {
        ...source,
        site: { interwiki: 'w:en', language: 'en' },
    };
    const simple = {
        ...destination,
        site: { interwiki: 'w:simple', language: 'en' },
    };
    const text = generateAttribution(english, simple, {
        ...defaults,
        notice: true,
        mode: 'copy',
    });
    assert.ok(text.startsWith('== Copied to the Simple English Wikipedia =='));
    assert.ok(
        text.includes(
            '[[:w:simple:Special:PermaLink/88591765|the Simple English Wikipedia]]',
        ),
    );
    assert.ok(text.includes('was copied to'));
    const reverse = generateAttribution(simple, english, {
        ...defaults,
        notice: true,
    });
    assert.ok(
        reverse.startsWith('== Translation for the English Wikipedia =='),
    );
    assert.ok(
        reverse.includes(
            '[[:w:en:Special:PermaLink/110930823|the English Wikipedia]]',
        ),
    );
    assert.ok(
        generateAttribution(english, simple, defaults).startsWith(
            'This page was translated',
        ),
    );

    for (const locale of Object.keys(locales)) {
        const simpleLabel = getWikipediaLabel('en', locale, 'w:simple');
        assert.notEqual(simpleLabel, getWikipediaLabel('en', locale, 'w:en'));
        assert.equal(simpleLabel, getWikipediaLabel('simple', locale));
        assert.ok(!simpleLabel.includes('undefined'));
    }
    assert.equal(
        getWikipediaLabel('en', 'zh-Hant', 'w:simple'),
        '簡單英文維基百科',
    );
    assert.equal(
        getWikipediaLabel('en', 'ja', 'w:simple'),
        'シンプル英語版ウィキペディア',
    );
});

test('unsupported generator languages fall back to English and private language labels remain safe', () => {
    assert.equal(getAttributionLocale('nl', 'ja'), 'en');
    assert.equal(getAttributionLocale('private_language', 'ja'), 'en');
    const from = { ...source, site: { interwiki: 'w:nl', language: 'nl' } };
    const to = {
        ...destination,
        site: { interwiki: 'w:zh', language: 'bad_{{language}}\n==' },
    };
    const text = generateAttribution(from, to, { ...defaults, notice: true });
    assert.ok(
        text.startsWith(
            '== Translation for the bad_&#123;&#123;language&#125;&#125; == Wikipedia ==\n\n',
        ),
    );
    assert.ok(
        text.includes(
            'The version of [[:FIRE BIRD (Roseliaの曲)]] dated [[:Special:PermaLink/110930823|September 7, 2026 at 10:07:23]] was translated',
        ),
    );
    assert.ok(!text.includes('{{'));
    assert.equal((text.match(/\n/gu) ?? []).length, 2);
});

test('other Wikimedia projects retain project identity without a false Wikipedia label', () => {
    const to = {
        ...destination,
        site: { interwiki: 'commons', language: 'en' },
        pageTitle: 'Category:Birds',
    };
    const text = generateAttribution(source, to, {
        ...defaults,
        notice: true,
        mode: 'copy',
    });
    assert.ok(text.startsWith('== Wikimedia Commonsへの転記 =='));
    assert.ok(!text.includes('Category:Birds'));
    assert.ok(
        text.includes('[[:c:Special:PermaLink/88591765|Wikimedia Commons]]'),
    );
});

test('Russian Nintendo notice uses a grammatical destination in one sentence', () => {
    const from = {
        pageTitle: 'Nintendo',
        site: { interwiki: 'w:ru', language: 'ru' },
        revisionId: 155476605,
        timestamp: '2026-10-07T12:28:14Z',
    };
    const to = {
        pageTitle: '任天堂',
        site: { interwiki: 'w:zh', language: 'zh' },
        revisionId: 94167581,
        timestamp: '2026-10-07T12:28:14Z',
    };
    assert.equal(
        generateAttribution(from, to, { ...defaults, notice: true }),
        '== Перевод в китайскую Википедию ==\n\nСтраница [[:Nintendo]] в версии от [[:Special:PermaLink/155476605|7 октября 2026 г. в 12:28:14]] переведена в [[:w:zh:Special:PermaLink/94167581|китайскую Википедию]]. --~~~~',
    );
});

const noticeWording = {
    en: [
        'the Chinese Wikipedia',
        'Translation for the Chinese Wikipedia',
        'The version of SOURCE dated REVISION was translated for WIKI.',
        'Copied to the Chinese Wikipedia',
        'The version of SOURCE dated REVISION was copied to WIKI.',
    ],
    'zh-Hans': [
        '中文维基百科',
        '翻译至中文维基百科',
        '页面SOURCE的REVISION版本翻译至WIKI。',
        '复制至中文维基百科',
        '页面SOURCE的REVISION版本复制至WIKI。',
    ],
    'zh-Hant': [
        '中文維基百科',
        '翻譯至中文維基百科',
        '頁面SOURCE的REVISION版本翻譯至WIKI。',
        '複製至中文維基百科',
        '頁面SOURCE的REVISION版本複製至WIKI。',
    ],
    ja: [
        '中国語版ウィキペディア',
        '中国語版ウィキペディアへの翻訳',
        'SOURCEのREVISION版をWIKIに翻訳しました。',
        '中国語版ウィキペディアへの転記',
        'SOURCEのREVISION版をWIKIに転記しました。',
    ],
    ru: [
        'китайскую Википедию',
        'Перевод в китайскую Википедию',
        'Страница SOURCE в версии от REVISION переведена в WIKI.',
        'Копирование в китайскую Википедию',
        'Страница SOURCE в версии от REVISION скопирована в WIKI.',
    ],
    ko: [
        '중국어 위키백과',
        '중국어 위키백과로 번역',
        'SOURCE의 REVISION 판을 WIKI에 번역했습니다.',
        '중국어 위키백과로 복사',
        'SOURCE의 REVISION 판을 WIKI에 복사했습니다.',
    ],
    fr: [
        'Wikipédia en chinois',
        'Traduction pour Wikipédia en chinois',
        'La page SOURCE, dans sa version du REVISION, a été traduite pour WIKI.',
        'Copie sur Wikipédia en chinois',
        'La page SOURCE, dans sa version du REVISION, a été copiée sur WIKI.',
    ],
    de: [
        'die Wikipedia auf Chinesisch',
        'Übersetzung für die Wikipedia auf Chinesisch',
        'Die Seite SOURCE wurde in der Version vom REVISION übersetzt und in WIKI übernommen.',
        'Kopie in die Wikipedia auf Chinesisch',
        'Die Seite SOURCE wurde in der Version vom REVISION in WIKI kopiert.',
    ],
    es: [
        'la Wikipedia en chino',
        'Traducción para la Wikipedia en chino',
        'La página SOURCE, en su revisión del REVISION, fue traducida para WIKI.',
        'Copia en la Wikipedia en chino',
        'La página SOURCE, en su revisión del REVISION, fue copiada en WIKI.',
    ],
    pt: [
        'a Wikipédia em chinês',
        'Tradução para a Wikipédia em chinês',
        'A página SOURCE, na revisão de REVISION, foi traduzida para WIKI.',
        'Cópia para a Wikipédia em chinês',
        'A página SOURCE, na revisão de REVISION, foi copiada para WIKI.',
    ],
    it: [
        'Wikipedia in cinese',
        'Traduzione per Wikipedia in cinese',
        'La pagina SOURCE, nella versione del REVISION, è stata tradotta per WIKI.',
        'Copia su Wikipedia in cinese',
        'La pagina SOURCE, nella versione del REVISION, è stata copiata su WIKI.',
    ],
    ar: [
        'ويكيبيديا باللغة الصينية',
        'ترجمة إلى ويكيبيديا باللغة الصينية',
        'تُرجمت صفحة SOURCE بنسختها المؤرخة في REVISION إلى WIKI.',
        'نسخ إلى ويكيبيديا باللغة الصينية',
        'نُسخت صفحة SOURCE بنسختها المؤرخة في REVISION إلى WIKI.',
    ],
};

test('all catalogs use reviewed translation and copy notice sentences and project labels', () => {
    for (const [
        locale,
        [wiki, translatedHeading, translatedBody, copiedHeading, copiedBody],
    ] of Object.entries(noticeWording)) {
        const from = {
            ...source,
            pageTitle: 'Source',
            site: { interwiki: `w:${locale.split('-')[0]}`, language: locale },
        };
        assert.equal(
            getWikipediaLabel('zh', locale, 'w:zh', 'destination'),
            wiki,
        );
        for (const mode of ['translate', 'copy']) {
            const text = generateAttribution(from, destination, {
                ...defaults,
                notice: true,
                mode,
                interfaceLanguage: locale,
            });
            assert.ok(text.includes(`|${wiki}]]`));
            const words = text.replace(
                /\[\[:([^|\]]+)(?:\|[^\]]+)?\]\]/gu,
                (_link, target) => {
                    if (target.includes('Special:PermaLink/110930823'))
                        return 'REVISION';
                    if (target.includes('Special:PermaLink/88591765'))
                        return 'WIKI';
                    assert.equal(target, 'Source');
                    return 'SOURCE';
                },
            );
            const [heading, body] =
                mode === 'translate'
                    ? [translatedHeading, translatedBody]
                    : [copiedHeading, copiedBody];
            assert.equal(
                words,
                `== ${heading} ==\n\n${body} --~~~~`,
                `${locale} ${mode}`,
            );
        }
    }
});

test('Russian destination case and German Simple English stay grammatical', () => {
    assert.equal(getWikipediaLabel('zh', 'ru'), 'китайская Википедия');
    assert.equal(
        getWikipediaLabel('zh-Hant', 'ru', 'w:zh', 'destination'),
        'китайскую Википедию',
    );
    assert.equal(
        getWikipediaLabel('pl', 'ru', 'w:pl', 'destination'),
        'Википедию на языке «польский»',
    );
    assert.equal(
        getWikipediaLabel('en', 'ru', 'w:simple', 'destination'),
        'Википедию на упрощённом английском языке',
    );
    assert.equal(
        getWikipediaLabel('en', 'de', 'w:simple'),
        'Wikipedia auf einfachem Englisch',
    );
    assert.equal(
        getWikipediaLabel('en', 'de', 'w:simple', 'destination'),
        'die Wikipedia auf einfachem Englisch',
    );
    for (const language of [
        'en',
        'zh',
        'ja',
        'ru',
        'ko',
        'fr',
        'de',
        'es',
        'pt',
        'it',
        'ar',
    ]) {
        assert.match(
            getWikipediaLabel(language, 'ru', `w:${language}`, 'destination'),
            /ую Википедию$/u,
        );
    }
});

test('project labels use readable brands and retain language-edition identity', () => {
    for (const [interwiki, brand] of Object.entries({
        commons: 'Wikimedia Commons',
        d: 'Wikidata',
        meta: 'Meta-Wiki',
        species: 'Wikispecies',
        mw: 'MediaWiki',
    })) {
        for (const locale of Object.keys(locales)) {
            assert.equal(getWikimediaProjectLabel(interwiki, locale), brand);
        }
    }
    assert.equal(
        getWikimediaProjectLabel('wikt:fr', 'en'),
        'Wiktionary in French',
    );
    assert.equal(
        getWikimediaProjectLabel('b:en', 'fr'),
        'Wikibooks en anglais',
    );
    assert.equal(
        getWikimediaProjectLabel('voy:ja', 'de'),
        'Wikivoyage auf Japanisch',
    );
    const german = { ...source, site: { interwiki: 'w:de', language: 'de' } };
    const commons = {
        ...destination,
        site: { interwiki: 'commons', language: 'en' },
    };
    const text = generateAttribution(german, commons, {
        ...defaults,
        notice: true,
        mode: 'copy',
    });
    assert.ok(text.startsWith('== Kopie in Wikimedia Commons =='));
    assert.ok(
        text.includes(
            'in [[:c:Special:PermaLink/88591765|Wikimedia Commons]] kopiert.',
        ),
    );
});

test('Korean partial reuse and modifications apply to distinct actions', () => {
    const korean = { interwiki: 'w:ko', language: 'ko' };
    for (const [mode, verb] of [
        ['translate', '번역'],
        ['copy', '복사'],
    ]) {
        const text = generateAttribution(
            source,
            { ...destination, site: korean },
            {
                ...defaults,
                mode,
                partial: true,
                modified: true,
            },
        );
        assert.ok(text.endsWith(`판을 부분적으로 ${verb}했고 수정했습니다`));
        assert.ok(!text.includes('부분적으로 수정'));
    }
    const cut = generateAttribution({ ...source, site: korean }, destination, {
        ...defaults,
        mode: 'copy',
        sourceSummary: true,
        partial: true,
        modified: true,
    });
    assert.ok(cut.startsWith('이 문서의 내용 중 일부를 잘라내어'));
    assert.ok(cut.endsWith('붙여넣었고 수정했습니다'));
});

test('cut summaries use the source language and identify the destination revision', () => {
    const from = { ...destination, sectionId: '來源段落' };
    const to = { ...source, sectionId: 'ライブ・パフォーマンス' };
    const options = { ...defaults, mode: 'copy', sourceSummary: true };
    assert.equal(
        generateAttribution(from, to, options),
        '剪下並貼上至[[:w:ja:FIRE BIRD (Roseliaの曲)#ライブ・パフォーマンス]]（[[:w:ja:Special:PermaLink/110930823#ライブ・パフォーマンス|2026年9月7日 10:07:23]]版）',
    );
    assert.equal(
        generateAttribution(from, to, {
            ...options,
            partial: true,
            modified: true,
        }),
        '部分內容剪下並貼上至[[:w:ja:FIRE BIRD (Roseliaの曲)#ライブ・パフォーマンス]]（[[:w:ja:Special:PermaLink/110930823#ライブ・パフォーマンス|2026年9月7日 10:07:23]]版），並作修改',
    );
    assert.equal(
        generateAttribution(from, to, {
            ...options,
            interfaceLanguage: 'zh-Hans',
        }),
        '剪切并粘贴至[[:w:ja:FIRE BIRD (Roseliaの曲)#ライブ・パフォーマンス]]（[[:w:ja:Special:PermaLink/110930823#ライブ・パフォーマンス|2026年9月7日 10:07:23]]版）',
    );
    const english = { ...source, site: { interwiki: 'w:en', language: 'en' } };
    assert.equal(
        generateAttribution(english, destination, options),
        'Content was cut from this page and pasted to [[:w:zh:FIRE BIRD (Roselia歌曲)]] (revision [[:w:zh:Special:PermaLink/88591765|September 8, 2026 at 11:18:32]])',
    );
});

test('cut summaries link same-wiki destinations locally and allow new pages without revision text', () => {
    const to = {
        pageTitle: 'New article',
        site: source.site,
        sectionId: 'New section',
    };
    const options = {
        ...defaults,
        mode: 'copy',
        sourceSummary: true,
        partial: true,
        modified: true,
    };
    assert.equal(
        generateAttribution(source, to, options),
        'このページの内容を一部切り取り、[[:New article#New section]]へ貼り付けて改変',
    );
    const withRevision = generateAttribution(
        source,
        {
            ...to,
            revisionId: 9876,
            timestamp: destination.timestamp,
        },
        options,
    );
    assert.ok(
        withRevision.includes(
            '[[:Special:PermaLink/9876#New section|2026年9月8日 11:18:32]]',
        ),
    );
    assert.ok(!withRevision.includes('110930823'));
    assert.ok(!withRevision.includes('w:ja:'));
    assert.ok(!withRevision.includes('~~~~'));
    assert.ok(!withRevision.includes('\n'));
});

test('cut summaries reject translation/conflicting purposes and validate any supplied target revision', () => {
    const options = { ...defaults, mode: 'copy', sourceSummary: true };
    assert.throws(
        () =>
            generateAttribution(source, destination, {
                ...options,
                mode: 'translate',
            }),
        /only for copying/u,
    );
    assert.throws(
        () =>
            generateAttribution(source, destination, {
                ...options,
                notice: true,
            }),
        /either a source edit summary or a talk notice/u,
    );
    for (const revisionId of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
        assert.throws(
            () =>
                generateAttribution(
                    source,
                    { ...destination, revisionId },
                    options,
                ),
            /destination revision ID/u,
        );
    }
    for (const timestamp of [undefined, '', 'bad timestamp']) {
        assert.throws(
            () =>
                generateAttribution(
                    source,
                    { ...destination, timestamp },
                    options,
                ),
            /destination revision timestamp/u,
        );
    }
    assert.throws(
        () =>
            generateAttribution(
                { ...source, revisionId: undefined },
                destination,
                options,
            ),
        /source revision ID/u,
    );
    assert.equal(
        generateAttribution(source, destination, {
            ...defaults,
            sourceSummary: false,
        }),
        generateAttribution(source, destination, defaults),
    );
});

test('cut summaries escape destination titles and fragments and use the English fallback', () => {
    const from = { ...source, site: { interwiki: 'w:nl', language: 'nl' } };
    const to = {
        ...destination,
        pageTitle: 'Target_{{template}}|[[other]]',
        sectionId: 'Part\n{{template}}|~',
    };
    const result = generateAttribution(from, to, {
        ...defaults,
        mode: 'copy',
        sourceSummary: true,
    });
    assert.ok(
        result.startsWith('Content was cut from this page and pasted to'),
    );
    assert.ok(
        result.includes(
            '[[:w:zh:Target &#123;&#123;template&#125;&#125;&#124;&#91;&#91;other&#93;&#93;#Part &#123;&#123;template&#125;&#125;&#124;&#126;]]',
        ),
    );
    assert.ok(!result.includes('{{'));
    assert.ok(!result.includes('\n'));
    assert.ok(!result.includes('~~~~'));
});

const cutPhrases = {
    en: [
        'Content was cut from this page and pasted to',
        'Part of the content was cut from this page and pasted to',
    ],
    'zh-Hans': ['剪切并粘贴至', '部分内容剪切并粘贴至'],
    'zh-Hant': ['剪下並貼上至', '部分內容剪下並貼上至'],
    ja: ['このページの内容を切り取り、', 'このページの内容を一部切り取り、'],
    ru: [
        'Содержимое этой страницы вырезано и вставлено',
        'Часть содержимого этой страницы вырезана и вставлена',
    ],
    ko: ['이 문서의 내용을 잘라내어', '이 문서의 내용 중 일부를 잘라내어'],
    fr: [
        'Le contenu de cette page a été coupé et collé',
        'Une partie du contenu de cette page a été coupée et collée',
    ],
    de: [
        'Der Inhalt dieser Seite wurde ausgeschnitten',
        'Ein Teil des Inhalts dieser Seite wurde ausgeschnitten',
    ],
    es: [
        'Se cortó el contenido de esta página y se pegó',
        'Se cortó parte del contenido de esta página y se pegó',
    ],
    pt: [
        'O conteúdo desta página foi recortado e colado',
        'Parte do conteúdo desta página foi recortada e colada',
    ],
    it: [
        'Il contenuto di questa pagina è stato tagliato e incollato',
        'Parte del contenuto di questa pagina è stata tagliata e incollata',
    ],
    ar: ['قُصّ محتوى هذه الصفحة', 'قُصّ جزء من محتوى هذه الصفحة'],
};

for (const [locale, cutPhrase] of Object.entries(cutPhrases)) {
    test(`${locale} cut summaries honor both flags with existing and new targets`, () => {
        const from = {
            ...source,
            site: { interwiki: `w:${locale.split('-')[0]}`, language: locale },
        };
        for (const hasRevision of [false, true]) {
            const to = hasRevision
                ? destination
                : { pageTitle: destination.pageTitle, site: destination.site };
            for (const partial of [false, true]) {
                for (const modified of [false, true]) {
                    const text = generateAttribution(from, to, {
                        ...defaults,
                        mode: 'copy',
                        sourceSummary: true,
                        interfaceLanguage: locale,
                        partial,
                        modified,
                    });
                    assert.ok(text.startsWith(cutPhrase[partial ? 1 : 0]));
                    assert.equal(
                        text.includes(
                            locale === 'ja' ? 'て改変' : locales[locale][3],
                        ),
                        modified,
                    );
                    assert.ok(text.includes('FIRE BIRD (Roselia歌曲)'));
                    assert.equal(
                        text.includes('Special:PermaLink/88591765'),
                        hasRevision,
                    );
                    assert.ok(!text.includes('Special:PermaLink/110930823'));
                    assert.ok(!text.includes('~~~~'));
                    assert.ok(!text.includes('\n'));
                    assert.ok(!text.includes('undefined'));
                    assert.ok(!text.includes('{targetrevision}'));
                    assert.doesNotMatch(text, /[.。]$/u);
                }
            }
        }
    });
}
