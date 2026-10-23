/**
 * @file src/rev-copy/domain/attribution-messages.ts
 * Purpose: Localize translation and copying attribution in the receiving wiki's language.
 * Contents: Catalog types, localized templates, locale selection, and project labels.
 */

export type AttributionMode = 'translate' | 'copy';

interface AttributionMessages {
    summary: string;
    sourceSummary: {
        text: string;
        partialText?: string;
        revision: string;
        partial?: string;
        modified?: string;
    };
    notice: string | Record<AttributionMode, string>;
    heading: Record<AttributionMode, string>;
    action: Record<AttributionMode, string>;
    partial: string;
    modified: string;
    wikipedia: string;
}

export const attributionCatalogs: Readonly<
    Record<string, AttributionMessages>
> = {
    en: {
        summary:
            'This page was {partial}{action} from {from} (revision {revision}){modified}',
        sourceSummary: {
            text: 'Content was cut from this page and pasted to {to}{targetrevision}{modified}',
            partialText:
                'Part of the content was cut from this page and pasted to {to}{targetrevision}{modified}',
            revision: ' (revision {revision})',
        },
        notice: {
            translate:
                'The version of {from} dated {revision} was {partial}translated for {wiki}{modified}.',
            copy: 'The version of {from} dated {revision} was {partial}copied to {wiki}{modified}.',
        },
        heading: {
            translate: 'Translation for {wiki}',
            copy: 'Copied to {wiki}',
        },
        action: { translate: 'translated', copy: 'copied' },
        partial: 'partially ',
        modified: ', with modifications',
        wikipedia: '{language} Wikipedia',
    },
    'zh-Hans': {
        summary: '{partial}{action}自{from}（{revision}版）{modified}',
        sourceSummary: {
            text: '{partial}剪切并粘贴至{to}{targetrevision}{modified}',
            revision: '（{revision}版）',
            partial: '部分内容',
        },
        notice: '页面{from}的{revision}版本{partial}{action}至{wiki}{modified}。',
        heading: { translate: '翻译至{wiki}', copy: '复制至{wiki}' },
        action: { translate: '翻译', copy: '复制' },
        partial: '部分',
        modified: '，并作修改',
        wikipedia: '{language}维基百科',
    },
    'zh-Hant': {
        summary: '{partial}{action}自{from}（{revision}版）{modified}',
        sourceSummary: {
            text: '{partial}剪下並貼上至{to}{targetrevision}{modified}',
            revision: '（{revision}版）',
            partial: '部分內容',
        },
        notice: '頁面{from}的{revision}版本{partial}{action}至{wiki}{modified}。',
        heading: { translate: '翻譯至{wiki}', copy: '複製至{wiki}' },
        action: { translate: '翻譯', copy: '複製' },
        partial: '部分',
        modified: '，並作修改',
        wikipedia: '{language}維基百科',
    },
    ja: {
        summary: '{from}の{revision}版を{partial}{action}{modified}',
        sourceSummary: {
            text: 'このページの内容を{partial}切り取り、{to}{targetrevision}へ貼り付け{modified}',
            revision: '（{revision}版）',
            modified: 'て改変',
        },
        notice: '{from}の{revision}版を{wiki}に{partial}{action}{modified}しました。',
        heading: { translate: '{wiki}への翻訳', copy: '{wiki}への転記' },
        action: { translate: '翻訳', copy: '転記' },
        partial: '一部',
        modified: 'し、改変',
        wikipedia: '{language}版ウィキペディア',
    },
    ru: {
        summary:
            'Эта страница {partial}{action} со страницы {from} (версия от {revision}){modified}',
        sourceSummary: {
            text: 'Содержимое этой страницы вырезано и вставлено на страницу {to}{targetrevision}{modified}',
            partialText:
                'Часть содержимого этой страницы вырезана и вставлена на страницу {to}{targetrevision}{modified}',
            revision: ' (версия от {revision})',
        },
        notice: 'Страница {from} в версии от {revision} {partial}{action} в {wiki}{modified}.',
        heading: {
            translate: 'Перевод в {wiki}',
            copy: 'Копирование в {wiki}',
        },
        action: { translate: 'переведена', copy: 'скопирована' },
        partial: 'частично ',
        modified: ' с изменениями',
        wikipedia: 'Википедия на языке «{language}»',
    },
    ko: {
        summary: '{from}의 {revision} 판을 {partial}{action}{modified}습니다',
        sourceSummary: {
            text: '이 문서의 내용을 잘라내어 {to}{targetrevision}에 붙여넣었{modified}습니다',
            partialText:
                '이 문서의 내용 중 일부를 잘라내어 {to}{targetrevision}에 붙여넣었{modified}습니다',
            revision: ' ({revision} 판)',
        },
        notice: '{from}의 {revision} 판을 {wiki}에 {partial}{action}{modified}습니다.',
        heading: { translate: '{wiki}로 번역', copy: '{wiki}로 복사' },
        action: { translate: '번역했', copy: '복사했' },
        partial: '부분적으로 ',
        modified: '고 수정했',
        wikipedia: '{language} 위키백과',
    },
    fr: {
        summary:
            'Cette page a été {partial}{action} à partir de {from} (version du {revision}){modified}',
        sourceSummary: {
            text: 'Le contenu de cette page a été coupé et collé dans {to}{targetrevision}{modified}',
            partialText:
                'Une partie du contenu de cette page a été coupée et collée dans {to}{targetrevision}{modified}',
            revision: ' (version du {revision})',
        },
        notice: {
            translate:
                'La page {from}, dans sa version du {revision}, a été {partial}traduite pour {wiki}{modified}.',
            copy: 'La page {from}, dans sa version du {revision}, a été {partial}copiée sur {wiki}{modified}.',
        },
        heading: {
            translate: 'Traduction pour {wiki}',
            copy: 'Copie sur {wiki}',
        },
        action: { translate: 'traduite', copy: 'copiée' },
        partial: 'partiellement ',
        modified: ', avec des modifications',
        wikipedia: 'Wikipédia en {language}',
    },
    de: {
        summary:
            'Diese Seite wurde {partial}aus {from} (Version vom {revision}) {action}{modified}',
        sourceSummary: {
            text: 'Der Inhalt dieser Seite wurde ausgeschnitten und in {to}{targetrevision} eingefügt{modified}',
            partialText:
                'Ein Teil des Inhalts dieser Seite wurde ausgeschnitten und in {to}{targetrevision} eingefügt{modified}',
            revision: ' (Version vom {revision})',
        },
        notice: {
            translate:
                'Die Seite {from} wurde in der Version vom {revision} {partial}übersetzt und in {wiki} übernommen{modified}.',
            copy: 'Die Seite {from} wurde in der Version vom {revision} {partial}in {wiki} kopiert{modified}.',
        },
        heading: {
            translate: 'Übersetzung für {wiki}',
            copy: 'Kopie in {wiki}',
        },
        action: { translate: 'übersetzt', copy: 'kopiert' },
        partial: 'teilweise ',
        modified: ' und dabei verändert',
        wikipedia: 'Wikipedia auf {language}',
    },
    es: {
        summary:
            'Esta página fue {partial}{action} a partir de {from} (revisión del {revision}){modified}',
        sourceSummary: {
            text: 'Se cortó el contenido de esta página y se pegó en {to}{targetrevision}{modified}',
            partialText:
                'Se cortó parte del contenido de esta página y se pegó en {to}{targetrevision}{modified}',
            revision: ' (revisión del {revision})',
        },
        notice: {
            translate:
                'La página {from}, en su revisión del {revision}, fue {partial}traducida para {wiki}{modified}.',
            copy: 'La página {from}, en su revisión del {revision}, fue {partial}copiada en {wiki}{modified}.',
        },
        heading: {
            translate: 'Traducción para {wiki}',
            copy: 'Copia en {wiki}',
        },
        action: { translate: 'traducida', copy: 'copiada' },
        partial: 'parcialmente ',
        modified: ', con modificaciones',
        wikipedia: 'Wikipedia en {language}',
    },
    pt: {
        summary:
            'Esta página foi {partial}{action} a partir de {from} (revisão de {revision}){modified}',
        sourceSummary: {
            text: 'O conteúdo desta página foi recortado e colado em {to}{targetrevision}{modified}',
            partialText:
                'Parte do conteúdo desta página foi recortada e colada em {to}{targetrevision}{modified}',
            revision: ' (revisão de {revision})',
        },
        notice: 'A página {from}, na revisão de {revision}, foi {partial}{action} para {wiki}{modified}.',
        heading: {
            translate: 'Tradução para {wiki}',
            copy: 'Cópia para {wiki}',
        },
        action: { translate: 'traduzida', copy: 'copiada' },
        partial: 'parcialmente ',
        modified: ', com modificações',
        wikipedia: 'Wikipédia em {language}',
    },
    it: {
        summary:
            'Questa pagina è stata {partial}{action} da {from} (versione del {revision}){modified}',
        sourceSummary: {
            text: 'Il contenuto di questa pagina è stato tagliato e incollato in {to}{targetrevision}{modified}',
            partialText:
                'Parte del contenuto di questa pagina è stata tagliata e incollata in {to}{targetrevision}{modified}',
            revision: ' (versione del {revision})',
        },
        notice: {
            translate:
                'La pagina {from}, nella versione del {revision}, è stata {partial}tradotta per {wiki}{modified}.',
            copy: 'La pagina {from}, nella versione del {revision}, è stata {partial}copiata su {wiki}{modified}.',
        },
        heading: {
            translate: 'Traduzione per {wiki}',
            copy: 'Copia su {wiki}',
        },
        action: { translate: 'tradotta', copy: 'copiata' },
        partial: 'parzialmente ',
        modified: ', con modifiche',
        wikipedia: 'Wikipedia in {language}',
    },
    ar: {
        summary:
            '{action} هذه الصفحة {partial}من {from} (نسخة {revision}){modified}',
        sourceSummary: {
            text: 'قُصّ محتوى هذه الصفحة ولُصق في {to}{targetrevision}{modified}',
            partialText:
                'قُصّ جزء من محتوى هذه الصفحة ولُصق في {to}{targetrevision}{modified}',
            revision: ' (نسخة {revision})',
        },
        notice: '{action} صفحة {from} بنسختها المؤرخة في {revision} {partial}إلى {wiki}{modified}.',
        heading: { translate: 'ترجمة إلى {wiki}', copy: 'نسخ إلى {wiki}' },
        action: { translate: 'تُرجمت', copy: 'نُسخت' },
        partial: 'جزئيًا ',
        modified: '، مع تعديلات',
        wikipedia: 'ويكيبيديا باللغة {language}',
    },
};

/** Unsupported output languages deliberately use the complete English catalog. */
export function getAttributionLocale(
    siteLanguage: string,
    interfaceLanguage: string,
): string {
    const language = siteLanguage.toLowerCase();
    if (/^zh(?:-|$)/u.test(language)) {
        const ui = interfaceLanguage.toLowerCase();
        const variant = /^zh(?:-|$)/u.test(ui) ? ui : language;
        return /^zh-(?:hant|tw|hk|mo)(?:-|$)/u.test(variant)
            ? 'zh-Hant'
            : 'zh-Hans';
    }
    const base = language.split('-')[0];
    return Object.hasOwn(attributionCatalogs, base) ? base : 'en';
}

const chineseLanguageNames: Readonly<
    Record<string, readonly [string, string]>
> = {
    en: ['英文', '英文'],
    zh: ['中文', '中文'],
    ja: ['日文', '日文'],
    ru: ['俄文', '俄文'],
    ko: ['韩文', '韓文'],
    fr: ['法文', '法文'],
    de: ['德文', '德文'],
    es: ['西班牙文', '西班牙文'],
    pt: ['葡萄牙文', '葡萄牙文'],
    it: ['意大利文', '義大利文'],
    ar: ['阿拉伯文', '阿拉伯文'],
};

const simpleEnglishNames: Readonly<Record<string, string>> = {
    en: 'Simple English',
    'zh-Hans': '简单英文',
    'zh-Hant': '簡單英文',
    ja: 'シンプル英語',
    ru: 'упрощённый английский',
    ko: '쉬운 영어',
    fr: 'anglais simple',
    de: 'einfachem Englisch',
    es: 'inglés sencillo',
    pt: 'inglês simples',
    it: 'inglese semplice',
    ar: 'الإنجليزية المبسطة',
};

/** Feminine nominative and accusative forms cannot be derived from language names. */
const russianWikipediaAdjectives: Readonly<
    Record<string, readonly [string, string]>
> = {
    en: ['английская', 'английскую'],
    zh: ['китайская', 'китайскую'],
    ja: ['японская', 'японскую'],
    ru: ['русская', 'русскую'],
    ko: ['корейская', 'корейскую'],
    fr: ['французская', 'французскую'],
    de: ['немецкая', 'немецкую'],
    es: ['испанская', 'испанскую'],
    pt: ['португальская', 'португальскую'],
    it: ['итальянская', 'итальянскую'],
    ar: ['арабская', 'арабскую'],
};

function getLanguageName(
    language: string,
    locale: string,
    interwiki?: string,
): string {
    let name = language;
    const chineseName =
        chineseLanguageNames[language.toLowerCase().split('-')[0]];
    // Simple English shares content language "en" with English Wikipedia.
    if (interwiki === 'w:simple' || language === 'simple') {
        name = simpleEnglishNames[locale] ?? simpleEnglishNames.en;
    } else if (locale.startsWith('zh-') && chineseName) {
        name = chineseName[locale === 'zh-Hant' ? 1 : 0];
    } else {
        try {
            name =
                new Intl.DisplayNames([locale], { type: 'language' }).of(
                    language,
                ) ?? language;
        } catch {
            // Invalid/private MediaWiki language codes remain readable as codes.
        }
    }
    return name;
}

export function getWikipediaLabel(
    language: string,
    locale: string,
    interwiki?: string,
    purpose: 'name' | 'destination' = 'name',
): string {
    const name = getLanguageName(language, locale, interwiki);
    if (locale === 'ru') {
        const destination = purpose === 'destination';
        const project = destination ? 'Википедию' : 'Википедия';
        if (interwiki === 'w:simple' || language === 'simple') {
            return `${project} на упрощённом английском языке`;
        }
        const adjective =
            russianWikipediaAdjectives[language.toLowerCase().split('-')[0]];
        return adjective
            ? `${adjective[destination ? 1 : 0]} ${project}`
            : `${project} на языке «${name}»`;
    }
    const label = attributionCatalogs[locale].wikipedia.replace(
        '{language}',
        name,
    );
    const destinationArticles: Readonly<Record<string, string>> = {
        en: 'the',
        de: 'die',
        es: 'la',
        pt: 'a',
    };
    const article = destinationArticles[locale];
    if (purpose === 'destination' && article) return `${article} ${label}`;
    return label;
}

const wikimediaProjectNames: Readonly<Record<string, string>> = {
    c: 'Wikimedia Commons',
    commons: 'Wikimedia Commons',
    d: 'Wikidata',
    m: 'Meta-Wiki',
    meta: 'Meta-Wiki',
    species: 'Wikispecies',
    mw: 'MediaWiki',
    wikt: 'Wiktionary',
    b: 'Wikibooks',
    n: 'Wikinews',
    q: 'Wikiquote',
    s: 'Wikisource',
    v: 'Wikiversity',
    voy: 'Wikivoyage',
};

const languageProjectLabels: Readonly<Record<string, string>> = {
    en: '{project} in {language}',
    'zh-Hans': '{project}（{language}）',
    'zh-Hant': '{project}（{language}）',
    ja: '{language}版{project}',
    ru: '{project} на языке «{language}»',
    ko: '{language} {project}',
    fr: '{project} en {language}',
    de: '{project} auf {language}',
    es: '{project} en {language}',
    pt: '{project} em {language}',
    it: '{project} in {language}',
    ar: '{project} باللغة {language}',
};

/** Other projects retain their brand rather than exposing an interwiki alias. */
export function getWikimediaProjectLabel(
    interwiki: string,
    locale: string,
): string {
    const [projectCode, language] = interwiki.split(':');
    const project = wikimediaProjectNames[projectCode] ?? projectCode;
    if (!language) return project;
    const template = languageProjectLabels[locale] ?? languageProjectLabels.en;
    const values: Readonly<Record<string, string>> = {
        project,
        language: getLanguageName(language, locale),
    };
    return template.replace(
        /\{(project|language)\}/gu,
        (_match, key: string) => values[key],
    );
}
