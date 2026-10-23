/**
 * @file scripts/rev-copy/test-ui.mjs
 * Purpose: Verify the production bundle offline across source-backed skin fixtures.
 *
 * Table of contents:
 * 1. Imports, fixtures, and expected user output
 * 2. Reconstructed skin markup and styles
 * 3. Offline MediaWiki and clipboard adapters
 * 4. Browser checks across skins, languages, and distributions
 */

import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { buildCodexRuntime } from '../../tests/rev-copy/codex-runtime.mjs';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

async function captureReview(page, name) {
    const directory = process.env.REV_COPY_SCREENSHOT_DIR;
    if (!directory) return;
    await mkdir(directory, { recursive: true });
    await page.evaluate(async () => {
        await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        await Promise.allSettled(
            document
                .getAnimations()
                .filter(
                    (animation) =>
                        animation.effect?.getTiming().iterations !== Infinity,
                )
                .map((animation) => animation.finished),
        );
    });
    await page.screenshot({
        path: join(directory, `${name}.png`),
        animations: 'disabled',
    });
}
assert.equal(
    process.argv.length,
    2,
    'Offline regression checks accept no options; use capture-live.mjs for live screenshots.',
);
const [bundle, fixtureSource] = await Promise.all([
    readFile(join(root, 'dist/rev_copy.min.js'), 'utf8'),
    readFile(join(root, 'tests/rev-copy/fixtures/wiki-examples.json'), 'utf8'),
]);
const fixture = JSON.parse(fixtureSource);
const codexRuntime = await buildCodexRuntime();
const codexStyles = await readFile(
    fileURLToPath(import.meta.resolve('@wikimedia/codex/dist/codex.style.css')),
    'utf8',
);
const expectedLabels = {
    zh: '2026年9月5日 12:00:26',
    en: 'March 7, 2026 at 16:05:03',
    ja: '2025年10月6日 08:41:52',
    commons: 'February 21, 2019 at 13:44:28',
};
const presentation = {
    zh: {
        interfaceLanguage: 'zh-Hant',
        wordmark: '維基百科',
        tagline: '維基百科，自由的百科全書',
        content: '目錄',
        top: '序言',
        development: '研發',
        details: '技術資料',
        references: '參考文獻',
        tabs: ['條目', '討論', '閱讀', '編輯', '檢視歷史', '工具'],
        search: '搜尋維基百科',
        language: '8種語言',
        appearance: '外觀',
        text: '文字',
        width: '寬度',
        color: '顏色',
        caption: '陶瓷封裝版的 C1103',
    },
    en: {
        interfaceLanguage: 'en',
        wordmark: 'Wikipedia',
        tagline: 'From Wikipedia, the free encyclopedia',
        content: 'Contents',
        top: '(Top)',
        development: 'Development',
        details: 'Technical details',
        references: 'References',
        tabs: ['Article', 'Talk', 'Read', 'Edit', 'View history', 'Tools'],
        search: 'Search Wikipedia',
        language: '8 languages',
        appearance: 'Appearance',
        text: 'Text',
        width: 'Width',
        color: 'Color',
        caption: 'A ceramic C1103 variant',
    },
    ja: {
        interfaceLanguage: 'ja',
        wordmark: 'ウィキペディア',
        tagline: '出典: フリー百科事典『ウィキペディア（Wikipedia）』',
        content: '目次',
        top: 'ページ先頭',
        development: '開発',
        details: '技術詳細',
        references: '脚注・参考文献',
        tabs: ['ページ', 'ノート', '閲覧', '編集', '履歴を表示', 'ツール'],
        search: 'Wikipedia内を検索',
        language: '7 個の言語版',
        appearance: '表示',
        text: '文字',
        width: '幅',
        color: '色',
        caption: 'パッケージがセラミックに変更された C1103。',
    },
    commons: {
        interfaceLanguage: 'en',
        wordmark: 'Wikimedia Commons',
        tagline: 'From Wikimedia Commons, the free media repository',
        content: 'Contents',
        top: '(Top)',
        development: 'Subcategories',
        details: 'Media in category “Intel 1103”',
        references: 'Categories',
        tabs: [
            'Category',
            'Discussion',
            'Read',
            'Edit',
            'View history',
            'Tools',
        ],
        search: 'Search Wikimedia Commons',
        language: 'English',
        appearance: 'Appearance',
        text: 'Text',
        width: 'Width',
        color: 'Color',
        caption: 'Intel C1103.jpg',
    },
};

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/gu, (character) => {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[character];
    });
}

// Reconstruct skin structure and page context; Revision Copy markup and CSS come only from the bundle.
const hostStyles = `
    :root {
        --background-color-base: #fff;
        --background-color-neutral-subtle: #f8f9fa;
        --background-color-interactive: #eaecf0;
        --border-color-base: #a2a9b1;
        --color-base: #202122;
        --color-progressive: #36c;
        color-scheme: light;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--background-color-base); color: var(--color-base);
        font: 16px/1.6 Arial, sans-serif; }
    a { color: var(--color-progressive); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .vector-header-container { height: 96px; padding: 24px 44px; display: flex;
        align-items: center; gap: 28px; }
    .menu-icon { font-size: 24px; line-height: 1; }
    .wordmark { min-width: 218px; display: flex; align-items: center; gap: 12px; }
    .globe { width: 44px; height: 44px; display: grid; place-items: center;
        border: 1px solid #a2a9b1; border-radius: 50%; font: 31px Georgia, serif; color: #54595d; }
    .wordmark-name { font: 24px Georgia, serif; line-height: 1.1; }
    .wordmark-subtitle { font: 11px/1.8 Georgia, serif; color: #54595d; }
    .searchbox { border: 1px solid #a2a9b1; height: 34px; width: 430px; padding-left: 10px;
        display: flex; align-items: center; gap: 9px; font-size: 14px; color: #72777d; }
    .searchbox span { flex: 1; }
    .searchbox strong { border-left: 1px solid #a2a9b1; background: #f8f9fa;
        color: #202122; font-size: 13px; padding: 5px 12px; }
    .account-links { margin-left: auto; font-size: 13px; white-space: nowrap; display: flex; gap: 16px; }
    .mw-page-container-inner { max-width: 1392px; margin: 0 auto; padding: 30px 28px;
        display: grid; grid-template-columns: 170px minmax(0, 1fr) 150px; gap: 30px; }
    .sidebar { font-size: 14px; padding-top: 39px; }
    .sidebar-heading { border-bottom: 1px solid #c8ccd1; padding-bottom: 7px; font-weight: bold; }
    .sidebar ul { padding: 10px 0; margin: 0; list-style: none; }
    .sidebar li { margin: 10px 0; }
    .sidebar li a { display: block; line-height: 1.45; }
    .appearance .sidebar-heading small { font-weight: normal; margin-left: 8px; color: #54595d; }
    .appearance fieldset { border: 0; border-bottom: 1px solid #eaecf0; margin: 14px 0 0;
        padding: 0 0 15px; color: #54595d; font-size: 13px; }
    .appearance legend { padding: 0; margin-bottom: 10px; }
    .appearance label { display: block; margin: 5px 0; color: #202122; }
    .appearance input { vertical-align: -1px; accent-color: #36c; margin-right: 5px; }
    .mw-content-container { min-width: 0; }
    .vector-page-titlebar { display: flex; align-items: center; justify-content: space-between;
        border-bottom: 1px solid #a2a9b1; min-height: 52px; gap: 18px; }
    h1 { font: normal 29px/1.375 Georgia, 'Times New Roman', serif; margin: 0 0 8px; }
    .language-button { font-size: 14px; font-weight: bold; margin-bottom: 8px; }
    .vector-page-toolbar { display: flex; justify-content: space-between; font-size: 13px;
        border-bottom: 1px solid #c8ccd1; min-height: 45px; margin-bottom: 15px; }
    .toolbar-tabs { display: flex; gap: 20px; align-items: center; }
    .toolbar-tabs .selected { color: #202122; padding: 11px 0; border-bottom: 2px solid #202122; }
    #siteSub { font-size: 13px; margin-bottom: 2px; }
    #bodyContent { font-size: 16px; }
    #mw-content-text { margin-top: 18px; }
    .mw-parser-output p { margin: 0 0 18px; line-height: 1.7; }
    .infobox { float: right; width: 278px; margin: 0 0 24px 24px; padding: 7px;
        border: 1px solid #a2a9b1; background: #f8f9fa; font-size: 13px; text-align: center; }
    .infobox h2 { margin: 1px 0 6px; border: none; font: bold 17px Arial, sans-serif; }
    .infobox img { display: block; width: 100%; height: auto; }
    .infobox p { margin: 5px 0 7px; font-size: 12px; line-height: 1.4; }
    .infobox dl { display: grid; grid-template-columns: 98px 1fr; text-align: left;
        gap: 4px 6px; margin: 10px 3px 2px; }
    .infobox dt { font-weight: bold; }
    .infobox dd { margin: 0; }
    .mw-parser-output > h2 { border-bottom: 1px solid #a2a9b1; overflow: hidden;
        margin: 24px 0 12px; padding-bottom: 3px; font: normal 23px/1.4 Georgia, serif; }
    #mw-subcategories > h2, #mw-category-media > h2 { overflow: hidden; }
    .mw-heading { display: flex; align-items: baseline; border-bottom: 1px solid #a2a9b1;
        margin: 24px 0 12px; }
    .mw-heading h2 { overflow: visible; margin: 0; padding-bottom: 3px;
        font: normal 23px/1.4 Georgia, serif; }
    .mw-editsection { font: 12px Arial, sans-serif; margin-left: 12px; }
    .edit-link { font: 12px Arial, sans-serif; margin-left: 12px; }
    .technical-table { border-collapse: collapse; font-size: 14px; width: 100%; }
    .technical-table th, .technical-table td { border: 1px solid #a2a9b1; padding: 7px 10px; }
    .technical-table th { background: #eaecf0; text-align: left; }
    .asset-attribution { color: #72777d; font-size: 10px; margin-top: 7px; }
    .commons-info { border: 1px solid #a2a9b1; padding: 16px; display: flex; gap: 24px;
        align-items: center; margin-bottom: 22px; background: #f8f9fa; }
    .commons-info img { width: 210px; }
    .commons-info strong { display: block; font-size: 22px; margin-bottom: 5px; }
    .gallery { width: 270px; background: #f8f9fa; padding: 12px; border: 1px solid #c8ccd1;
        text-align: center; font-size: 13px; }
    .gallery img { width: 240px; }
    @media (prefers-color-scheme: dark) {
        :root { --background-color-base: #101418; --background-color-neutral-subtle: #202122;
            --background-color-interactive: #27292d; --border-color-base: #72777d;
            --color-base: #eaecf0; --color-progressive: #88a3e8; color-scheme: dark; }
        .infobox, .commons-info, .gallery { background: #202122; }
        #siteSub, .wordmark-subtitle, .appearance label, .toolbar-tabs .selected { color: #eaecf0; }
        .technical-table th { background: #27292d; }
    }
    @media (max-width: 900px) {
        .mw-page-container-inner { grid-template-columns: minmax(0, 1fr); padding: 18px 20px; }
        .sidebar, .account-links { display: none; }
        .vector-header-container { padding: 16px 20px; height: 78px; gap: 18px; }
        .wordmark { min-width: 0; }
        .searchbox { margin-left: auto; width: 200px; }
    }
    @media (max-width: 520px) {
        .vector-header-container { height: 68px; }
        .wordmark-name { font-size: 19px; }
        .wordmark-subtitle, .searchbox { display: none; }
        .globe { width: 32px; height: 32px; font-size: 23px; }
        .mw-page-container-inner { padding: 12px 16px; }
        .vector-page-titlebar { align-items: baseline; }
        h1 { font-size: 25px; }
        .language-button { font-size: 11px; }
        .toolbar-tabs { gap: 11px; }
        .vector-page-toolbar { font-size: 11px; }
        .infobox { float: none; width: 100%; margin: 0 0 20px; }
        .commons-info { display: block; }
        .commons-info img { width: 100%; }
    }
`;

function renderArticle(example, copy, headingMode) {
    const image = fixture.assets.intelC1103;
    const attribution = `<div class="asset-attribution">Photo: Thomas Nguyen · CC BY-SA 4.0</div>`;
    if (example.key === 'commons') {
        return `<div class="commons-info">
            <div><img src="${image.dataUrl}" alt="Intel C1103 DRAM chip">${attribution}</div>
            <div><strong>Intel 1103</strong><p>${escapeHtml(example.excerpt)}</p>
                <a href="#">Upload media</a><p>Instance of: product model<br>Manufacturer: Intel</p></div>
        </div>
        <div id="mw-subcategories"><h2>${copy.development}</h2><p>This category has only the following subcategory.</p>
        <p><a href="#">Intel 1103 second sources</a> (6 F)</p></div>
        <div id="mw-category-media"><h2>${copy.details}</h2><p>The following 4 files are in this category, out of 4 total.</p>
        <div class="gallery"><img src="${image.dataUrl}" alt="Intel C1103"><br>
            <a href="${image.descriptionUrl}">Intel C1103.jpg</a> · 6,000 × 4,000${attribution}</div></div>`;
    }
    const development = {
        zh: '1969年，霍尼韋爾工程師 William Regitz 等人設計了三晶體管的動態儲存單元，並尋找半導體公司投入生產。英特爾提出將512位元的儲存器擴大到1024位元。',
        en: 'In 1969 William Regitz and his colleagues at Honeywell developed a three-transistor dynamic memory cell. Intel responded with two similar 1024-bit chips, the 1102 and the 1103. Ultimately only the 1103 went into production.',
        ja: '1969年、ハネウェルのウィリアム・レジッツと彼の同僚は、3トランジスタのダイナミック・メモリ・セルを開発した。インテルは1024ビットのチップ、1102と1103を開発したが、最終的には1103のみが生産された。',
    };
    const heading = (id, label) =>
        headingMode === 'legacy'
            ? `<h2><span class="mw-headline" id="${id}">${label}</span><span class="mw-editsection"><a href="#">${copy.tabs[3]}</a></span></h2>`
            : headingMode === 'modern'
              ? `<div class="mw-heading mw-heading2"><h2 id="${id}">${label}</h2><span class="mw-editsection"><a href="#">${copy.tabs[3]}</a></span></div>`
              : `<h2 id="${id}">${label}<span class="mw-editsection"><a href="#">${copy.tabs[3]}</a></span></h2>`;
    return `<aside class="infobox"><h2>Intel 1103</h2>
        <img src="${image.dataUrl}" alt="Intel C1103 DRAM chip">
        <p>${copy.caption}</p><dl><dt>Media type</dt><dd><a href="#">DRAM</a></dd>
        <dt>Capacity</dt><dd>1 kilobit</dd><dt>Standard</dt><dd>18-pin DIP</dd>
        <dt>Manufacturer</dt><dd>Intel</dd><dt>Released</dt><dd>October 1970</dd></dl>${attribution}</aside>
        <p>${escapeHtml(example.excerpt)}</p>
        <p>${example.key === 'en' ? 'Introduced in October 1970, the 1103 was the first commercially available DRAM IC. Intel shipped the 250,000th 1103 RAM chip in June 1974.' : example.key === 'zh' ? '芯片於1970年10月面世，其體積小、價格低廉，改變了當時磁芯儲存器的市場。1974年6月，英特爾的1103芯片出貨達25萬顆。' : '1970年10月に発表された1103は、商業的に利用可能な最初のDRAM ICである。インテルは1974年6月に25万個目の1103 RAMを出荷した。'}</p>
        ${heading('Development', copy.development)}
        <p>${development[example.key]}</p>
        ${heading('Technical_details', copy.details)}
        <table class="technical-table"><tbody><tr><th>t<sub>RWC</sub></th><td>580 ns</td><td>Random read or write cycle time</td></tr>
        <tr><th>t<sub>PO</sub></th><td>300 ns</td><td>Access time</td></tr>
        <tr><th>t<sub>REF</sub></th><td>2 ms</td><td>Refresh rate</td></tr></tbody></table>`;
}

function renderHost(
    example,
    skin = 'vector-2022',
    headingMode = 'modern',
    direction = 'ltr',
) {
    const copy = presentation[example.key];
    const titlebar = `<div class="vector-page-titlebar"><h1 id="firstHeading">${escapeHtml(example.page)}</h1>
        <a class="language-button" href="#">⚒ ${copy.language}⌄</a></div>`;
    const toolbar = `<nav class="vector-page-toolbar"><div class="toolbar-tabs">
        <span class="selected">${copy.tabs[0]}</span><a href="#">${copy.tabs[1]}</a></div>
        <div class="toolbar-tabs"><span class="selected">${copy.tabs[2]}</span>
        <a href="#">${copy.tabs[3]}</a><a href="#">${copy.tabs[4]}</a><span>${copy.tabs[5]}⌄</span></div></nav>`;
    const subtitle = `<div id="siteSub" class="noprint">${copy.tagline}</div><div id="contentSub"></div>`;
    const article = `<div id="mw-content-text" dir="${direction}"><div class="mw-parser-output">${renderArticle(example, copy, headingMode)}</div></div>`;
    let content;
    if (skin === 'minerva') {
        content = `<main id="content"><div class="pre-content heading-holder">${titlebar}${toolbar}${subtitle}</div>
            <div id="bodyContent" class="content">${article}</div></main>`;
    } else if (skin === 'monobook' || skin === 'vector') {
        content = `<main id="content">${titlebar}${toolbar}<div id="bodyContent">${subtitle}<div id="contentSub2"></div><div id="jump-to-nav"></div>${article}</div></main>`;
    } else if (skin === 'timeless') {
        content = `<div id="mw-content"><main id="content">${titlebar}<div id="bodyContentOuter"><div id="siteSub">${copy.tagline}</div><div id="mw-page-header-links">${toolbar}</div><div id="bodyContent"><div id="contentSub"></div>${article}</div></div></main></div>`;
    } else if (skin === 'modern') {
        content = `<div id="mw_header">${titlebar}</div><div id="mw_main"><div id="mw_contentwrapper">${toolbar}<main id="content"><div id="mw_contentholder" class="mw-body"><div class="mw-topboxes"><div id="siteSub">${copy.tagline}</div></div><div id="contentSub"></div><div id="contentSub2"></div><div id="jump-to-nav"></div>${article}</div></main></div></div>`;
    } else if (skin === 'cologneblue') {
        content = `<div id="content"><div id="topbar"><p id="sitetitle">Wikipedia</p></div><main id="article" class="mw-body">${titlebar}<p class="tagline">${copy.tagline}</p>${article}</main></div>`;
    } else {
        content = `<main id="content">${titlebar}${toolbar}<div id="bodyContent" class="vector-body">
            <div class="vector-body-before-content">${subtitle}</div>${article}</div></main>`;
    }
    return `<!doctype html><html lang="${example.language}"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(example.page)} — ${copy.wordmark}</title>
        <link rel="icon" href="data:,"><style>${hostStyles}</style></head><body class="skin-${skin}">
        <header class="vector-header-container"><span class="menu-icon">☰</span><div class="wordmark">
        <span class="globe">W</span><div><div class="wordmark-name">${copy.wordmark}</div>
        <div class="wordmark-subtitle">${example.key === 'commons' ? 'the free media repository' : copy.tagline.replace(/^From Wikipedia, /u, '')}</div></div></div>
        <div class="searchbox">⌕ <span>${copy.search}</span><strong>${example.key === 'ja' ? '検索' : example.key === 'zh' ? '搜尋' : 'Search'}</strong></div>
        <div class="account-links"><a href="#">${example.key === 'zh' ? '建立帳號' : example.key === 'ja' ? 'アカウント作成' : 'Create account'}</a>
        <a href="#">${example.key === 'zh' ? '登入' : example.key === 'ja' ? 'ログイン' : 'Log in'}</a> ···</div></header>
        <div class="mw-page-container"><div class="mw-page-container-inner"><aside class="sidebar">
        <div class="sidebar-heading">${copy.content}</div><ul><li><strong>${copy.top}</strong></li>
        <li><a href="#">1 ${copy.development}</a></li><li><a href="#">2 ${copy.details}</a></li>
        <li><a href="#">3 ${copy.references}</a></li></ul></aside><div class="mw-content-container">${content}</div>
        <aside class="sidebar appearance"><div class="sidebar-heading">${copy.appearance}<small>hide</small></div>
        <fieldset><legend>${copy.text}</legend><label><input type="radio">Small</label><label><input type="radio" checked>Standard</label><label><input type="radio">Large</label></fieldset>
        <fieldset><legend>${copy.width}</legend><label><input type="radio" checked>Standard</label><label><input type="radio">Wide</label></fieldset>
        <fieldset><legend>${copy.color}</legend><label><input type="radio">Automatic</label><label><input type="radio" checked>Light</label><label><input type="radio">Dark</label></fieldset>
        </aside></div></div></body></html>`;
}

async function openFixture(
    browser,
    example,
    {
        skin = 'vector-2022',
        script = bundle,
        gadgetConfig,
        headingMode = 'modern',
        direction = 'ltr',
        codex = false,
        preparePage,
        ...overrides
    } = {},
) {
    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        deviceScaleFactor: 1,
        locale: 'en-US',
        timezoneId: 'Asia/Shanghai',
        colorScheme: 'light',
    });
    if (codex) {
        await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
            origin: new URL(example.sourceUrl).origin,
        });
    }
    const page = await context.newPage();
    const unexpectedRequests = [];
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await context.route('**/*', (route) => {
        const request = route.request();
        if (
            request.isNavigationRequest() &&
            request.url() === example.sourceUrl
        ) {
            return route.fulfill({
                contentType: 'text/html; charset=utf-8',
                body: renderHost(example, skin, headingMode, direction),
            });
        }
        const url = new URL(request.url());
        const remote = fixture.examples.find(
            (item) => item.host === url.hostname,
        );
        if (codex && remote && url.pathname === '/w/api.php') {
            const query =
                url.searchParams.get('prop') === 'langlinks'
                    ? {
                          pages: [
                              {
                                  title: remote.page,
                                  langlinks: fixture.examples
                                      .filter(
                                          (item) =>
                                              item.language ===
                                              url.searchParams.get('lllang'),
                                      )
                                      .map((item) => ({
                                          lang: item.language,
                                          title: item.page,
                                      })),
                              },
                          ],
                      }
                    : {
                          ...remote.apiResponse.query,
                          general: { lang: remote.language },
                      };
            return route.fulfill({
                contentType: 'application/json',
                headers: { 'access-control-allow-origin': '*' },
                body: JSON.stringify({ query }),
            });
        }
        unexpectedRequests.push(request.url());
        return route.abort('blockedbyclient');
    });
    await page.goto(example.sourceUrl);
    await preparePage?.(page);
    if (codex) {
        await page.addScriptTag({ content: codexRuntime });
        await page.addStyleTag({ content: codexStyles });
    }
    await page.evaluate(
        ({
            example,
            languagePages,
            interfaceLanguage,
            skin,
            gadgetConfig,
            overrides,
        }) => {
            const hooks = new Map();
            const state = {
                clipboard: [],
                notifications: [],
                apiCalls: [],
                moduleCalls: [],
                hooks,
                headingPositions: Object.fromEntries(
                    [
                        ...document.querySelectorAll(
                            '#firstHeading, #mw-content-text h2, #mw-content-text h3',
                        ),
                    ].map((heading) => {
                        const walker = document.createTreeWalker(
                            heading,
                            NodeFilter.SHOW_TEXT,
                        );
                        let node;
                        while (
                            (node = walker.nextNode()) &&
                            !node.textContent.trim()
                        ) {
                            /* Skip whitespace. */
                        }
                        const key =
                            heading.id ||
                            heading.querySelector('.mw-headline[id]')?.id ||
                            heading.closest('[id]')?.id;
                        if (!node) return [key, null];
                        const range = document.createRange();
                        range.selectNodeContents(node);
                        const box = range.getBoundingClientRect();
                        return [key, { left: box.left, right: box.right }];
                    }),
                ),
            };
            window.revCopyTest = state;
            const nativeClipboard = navigator.clipboard;
            state.preparePaste = (text) => nativeClipboard.writeText(text);
            state.readNativeClipboard = () => nativeClipboard.readText();
            window.revCopyConfig = gadgetConfig;
            const config = {
                ...example.observedConfig,
                skin,
                wgRevisionId: example.revision,
                // Deliberately different: copying must refer to the viewed revision.
                wgCurRevisionId: example.revision + 1,
                wgContentLanguage: example.language,
                wgUserLanguage: interfaceLanguage,
                wgUserVariant: interfaceLanguage === 'zh-Hant' ? 'zh-hant' : '',
                wgServerName: example.host,
                wgServer: `https://${example.host}`,
                ...overrides,
            };
            window.RLQ = { push: (callback) => callback() };
            window.mw = {
                config: { get: (key) => config[key] },
                loader: {
                    using: async (names) => {
                        state.moduleCalls.push(names);
                        return (name) => window.revCopyTestModules?.[name];
                    },
                },
                util: {
                    getUrl: (title) =>
                        `https://${example.host}/wiki/${encodeURIComponent(title.replaceAll(' ', '_')).replaceAll('%3A', ':').replaceAll('%2F', '/')}`,
                },
                hook(name) {
                    if (!hooks.has(name)) hooks.set(name, new Set());
                    return {
                        add: (callback) => hooks.get(name).add(callback),
                        fire: (...args) =>
                            hooks
                                .get(name)
                                .forEach((callback) => callback(...args)),
                    };
                },
                notify: (message, options) =>
                    state.notifications.push({ message, options }),
                Api: class {
                    get(parameters) {
                        state.apiCalls.push(parameters);
                        if (parameters.prop === 'langlinks') {
                            return Promise.resolve({
                                query: {
                                    pages: [
                                        {
                                            title: example.page,
                                            langlinks: languagePages
                                                .filter(
                                                    (item) =>
                                                        item.language ===
                                                        parameters.lllang,
                                                )
                                                .map((item) => ({
                                                    lang: item.language,
                                                    title: item.page,
                                                })),
                                        },
                                    ],
                                },
                            });
                        }
                        if (parameters.meta === 'siteinfo') {
                            return Promise.resolve({
                                query: {
                                    ...example.apiResponse.query,
                                    general: { lang: example.language },
                                },
                            });
                        }
                        return Promise.resolve(example.apiResponse);
                    }
                },
            };
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: {
                    writeText: async (text) => state.clipboard.push(text),
                },
            });
        },
        {
            example,
            languagePages: fixture.examples.filter(
                (item) => item.key !== 'commons',
            ),
            interfaceLanguage: presentation[example.key].interfaceLanguage,
            skin,
            gadgetConfig,
            overrides,
        },
    );
    await page.addScriptTag({ content: script });
    const row = page.locator('#kanade-rev-copy-row');
    await expect(row).toBeVisible();
    await expect(
        row.locator(
            '.kanade-rev-copy-action[data-kanade-rev-copy-action="copy"]',
        ),
    ).toHaveAttribute('aria-disabled', 'false');
    await expect(row.locator('.kanade-rev-copy-revision')).toBeVisible();
    return { context, page, row, unexpectedRequests, errors };
}

async function verifyPage(browser, example, skin = 'vector-2022') {
    const { context, page, row, unexpectedRequests, errors } =
        await openFixture(browser, example, { skin });
    try {
        const expectedPage = `[[:${example.prefix}${example.page}]]`;
        const expectedPermalink = `[[:${example.prefix}Special:PermaLink/${example.revision}|${expectedLabels[example.key]}]]`;
        const expectedAll = `${expectedPage} (${expectedPermalink})`;
        await expect(row.locator('.kanade-rev-copy-page')).toHaveText(
            expectedPage,
        );
        assert.equal(
            await row
                .locator('.kanade-rev-copy-page')
                .evaluate((element) => element.tagName),
            'CODE',
        );
        await expect(row.locator('.kanade-rev-copy-permalink')).toHaveText(
            expectedPermalink,
        );
        assert.equal(
            await row
                .locator('.kanade-rev-copy-permalink')
                .evaluate((element) => element.tagName),
            'CODE',
        );
        const fonts = await row.evaluate((element) => ({
            wikitext: getComputedStyle(
                element.querySelector('.kanade-rev-copy-page'),
            ).fontFamily,
            action: getComputedStyle(
                element.querySelector('.kanade-rev-copy-action'),
            ).fontFamily,
        }));
        assert.match(fonts.wikitext, /monospace/iu);
        assert.notEqual(
            fonts.wikitext,
            fonts.action,
            'Copy actions must retain the normal interface font.',
        );
        assert.equal(
            await row
                .locator('.kanade-rev-copy-revision-wikitext')
                .evaluate((element) => getComputedStyle(element).fontFamily),
            fonts.wikitext,
            'The revision parentheses must use the same monospace font as the literal wikitext.',
        );
        await expect(row).not.toContainText('UTC');
        await verifyBoundary(row, skin);
        const apiCalls = await page.evaluate(() => window.revCopyTest.apiCalls);
        assert.deepEqual(apiCalls, [
            {
                action: 'query',
                prop: 'revisions',
                revids: example.revision,
                rvprop: 'ids|timestamp',
                formatversion: 2,
            },
        ]);
        for (const [selector, expected] of [
            ['.kanade-rev-copy-page', expectedPage],
            ['.kanade-rev-copy-permalink', expectedPermalink],
        ]) {
            await row.locator(selector).click();
            assert.equal(
                await page.evaluate(() => getSelection().toString()),
                expected,
            );
        }
        assert.deepEqual(
            await page.evaluate(() => window.revCopyTest.clipboard),
            [],
        );
        await row.locator('[data-kanade-rev-copy-action="copy"]').click();
        await expect
            .poll(() => page.evaluate(() => window.revCopyTest.clipboard))
            .toEqual([expectedAll]);
        assert.equal(
            (await page.evaluate(() => window.revCopyTest.notifications))
                .length,
            1,
        );

        // The production entry point must keep one row, one style, and one API lookup.
        await page.addScriptTag({ content: bundle });
        await page.evaluate(() => window.mw.hook('wikipage.content').fire());
        await expect(page.locator('#kanade-rev-copy-row')).toHaveCount(1);
        await expect(page.locator('#kanade-rev-copy-styles')).toHaveCount(1);
        assert.equal(
            await page.evaluate(() => window.revCopyTest.apiCalls.length),
            1,
        );

        await row.locator('.kanade-rev-copy-page').focus();
        await page.keyboard.press('Enter');
        assert.equal(
            await page.evaluate(() => getSelection().toString()),
            expectedPage,
        );
        await row.locator('.kanade-rev-copy-permalink').focus();
        await page.keyboard.press('Space');
        assert.equal(
            await page.evaluate(() => getSelection().toString()),
            expectedPermalink,
        );
        await row
            .locator(
                '.kanade-rev-copy-action[data-kanade-rev-copy-action="copy"]',
            )
            .focus();
        await page.keyboard.press('Enter');
        await row
            .locator(
                '.kanade-rev-copy-action[data-kanade-rev-copy-action="copy"]',
            )
            .focus();
        await page.keyboard.press('Space');
        await expect
            .poll(() => page.evaluate(() => window.revCopyTest.clipboard))
            .toEqual([expectedAll, expectedAll, expectedAll]);
        await page.evaluate(() => document.activeElement.blur());
        assert.deepEqual(
            unexpectedRequests,
            [],
            'Browser fixtures must not request external resources.',
        );
        assert.deepEqual(
            errors,
            [],
            'The production script must not cause uncaught browser errors.',
        );
        console.log(
            `UI passed: ${example.key}/${skin} plain wikitext, UTC seconds, copy actions, keyboard, singleton, and offline requests.`,
        );
    } finally {
        await context.close();
    }
}

async function verifyBoundary(row, skin) {
    const margins = await row.evaluate((element) => ({
        top: getComputedStyle(element).marginTop,
        bottom: getComputedStyle(element).marginBottom,
    }));
    assert.deepEqual(
        margins,
        { top: '0px', bottom: '0px' },
        'The row must have no vertical margin.',
    );
    if (skin === 'vector-2022') {
        assert.ok(
            await row.evaluate((element) =>
                element.parentElement.classList.contains(
                    'vector-body-before-content',
                ),
            ),
        );
    } else if (skin === 'minerva') {
        assert.ok(
            await row.evaluate((element) =>
                element.parentElement.classList.contains('pre-content'),
            ),
        );
    } else {
        assert.equal(
            await row.evaluate((element) => element.nextElementSibling.id),
            'mw-content-text',
        );
    }
}

const skins = [
    'vector-2022',
    'vector',
    'monobook',
    'timeless',
    'modern',
    'cologneblue',
    'minerva',
];

async function verifySkinAndViewport(browser) {
    const example = fixture.examples.find((item) => item.key === 'en');
    for (const skin of skins) {
        const { context, page, row, unexpectedRequests, errors } =
            await openFixture(browser, example, { skin });
        try {
            await verifyBoundary(row, skin);
            await page.setViewportSize({ width: 360, height: 780 });
            await expect(
                row.locator(
                    '.kanade-rev-copy-action[data-kanade-rev-copy-action="copy"]',
                ),
            ).toBeVisible();
            const layout = await row.evaluate((element) => ({
                rowRight: element.getBoundingClientRect().right,
                viewport: window.innerWidth,
                documentWidth: document.documentElement.scrollWidth,
                height: element.getBoundingClientRect().height,
            }));
            assert.ok(
                layout.rowRight <= layout.viewport,
                'The row must stay within a narrow viewport.',
            );
            assert.ok(
                layout.documentWidth <= layout.viewport,
                'The page must not overflow horizontally.',
            );
            assert.ok(
                layout.height > 30,
                'The row must wrap on narrow screens.',
            );
            for (const sectionId of ['top', 'Development']) {
                const trigger = page.locator(
                    `.kanade-rev-copy-section-trigger[href="#${sectionId}"]`,
                );
                await trigger.scrollIntoViewIfNeeded();
                const box = await trigger.boundingBox();
                assert.ok(
                    box.x >= 0 && box.x + box.width <= 360,
                    `${skin} ${sectionId} hanging # must remain within a narrow viewport.`,
                );
                await trigger.hover();
                assert.ok(
                    await trigger.evaluate((element) => {
                        const bounds = element.getBoundingClientRect();
                        const hit = document.elementFromPoint(
                            bounds.x + bounds.width / 2,
                            bounds.y + bounds.height / 2,
                        );
                        return hit === element || element.contains(hit);
                    }),
                    `${skin} ${sectionId} control must receive pointer input.`,
                );
            }
            await page.emulateMedia({ colorScheme: 'dark' });
            const buttonColors = await row
                .locator('.kanade-rev-copy-action')
                .first()
                .evaluate((button) => ({
                    foreground: getComputedStyle(button).color,
                    background: getComputedStyle(button).backgroundColor,
                }));
            assert.equal(buttonColors.foreground, 'rgb(136, 163, 232)');
            assert.equal(buttonColors.background, 'rgba(0, 0, 0, 0)');
            assert.deepEqual(unexpectedRequests, []);
            assert.deepEqual(errors, []);
            console.log(
                `UI passed: ${skin} content boundary, 360px wrapping, and inherited dark colors.`,
            );
        } finally {
            await context.close();
        }
    }
    const japanese = fixture.examples.find((item) => item.key === 'ja');
    const { context, row } = await openFixture(browser, japanese, {
        wgUserLanguage: 'en',
    });
    try {
        await expect(
            row.locator(
                '.kanade-rev-copy-action[data-kanade-rev-copy-action="copy"]',
            ),
        ).toHaveText('copy');
        await expect(row.locator('.kanade-rev-copy-permalink')).toHaveText(
            '[[:w:ja:Special:PermaLink/106733410|2025年10月6日 08:41:52]]',
        );
        console.log(
            'UI passed: English interface labels keep the Japanese site timestamp.',
        );
    } finally {
        await context.close();
    }
}

async function verifyDistributionStartup(browser) {
    const example = fixture.examples.find((item) => item.key === 'en');
    const expected = `[[:w:en:Intel 1103]] ([[:w:en:Special:PermaLink/1342192065|${expectedLabels.en}]])`;
    for (const name of ['rev_copy.user.js']) {
        const script = await readFile(join(root, 'dist', name), 'utf8');
        const { context, page, row, unexpectedRequests, errors } =
            await openFixture(browser, example, { script });
        try {
            await row
                .locator(
                    '.kanade-rev-copy-action[data-kanade-rev-copy-action="copy"]',
                )
                .click();
            await expect
                .poll(() => page.evaluate(() => window.revCopyTest.clipboard))
                .toEqual([expected]);
            assert.deepEqual(unexpectedRequests, []);
            assert.deepEqual(errors, []);
            console.log(
                `UI passed: ${name} starts and copies through page-context injection.`,
            );
        } finally {
            await context.close();
        }
    }
}

async function verifyAlternativeViews(browser) {
    const example = fixture.examples.find((item) => item.key === 'en');
    const normal = await openFixture(browser, example, {
        gadgetConfig: { displayWikitext: false },
    });
    try {
        await expect(normal.row.locator('.kanade-rev-copy-page')).toHaveText(
            'Intel 1103',
        );
        await expect(
            normal.row.locator('.kanade-rev-copy-page'),
        ).toHaveAttribute('href', example.sourceUrl);
        await expect(
            normal.row.locator('.kanade-rev-copy-permalink'),
        ).toHaveText(expectedLabels.en);
        await expect(
            normal.row.locator('.kanade-rev-copy-permalink'),
        ).toHaveAttribute('href', /Special:PermaLink\/1342192065$/u);
    } finally {
        await normal.context.close();
    }

    const diff = await openFixture(browser, example, {
        wgRevisionId: 0,
        wgDiffOldId: example.parent,
        wgDiffNewId: example.revision,
    });
    try {
        const permalink = `[[:w:en:Special:Diff/${example.parent}/${example.revision}|${expectedLabels.en}]]`;
        await expect(diff.row.locator('.kanade-rev-copy-permalink')).toHaveText(
            permalink,
        );
        await diff.row.locator('[data-kanade-rev-copy-action="copy"]').click();
        await expect
            .poll(() => diff.page.evaluate(() => window.revCopyTest.clipboard))
            .toEqual([`[[:w:en:Intel 1103]] (${permalink})`]);
    } finally {
        await diff.context.close();
    }

    for (const skin of skins) {
        const { context, page } = await openFixture(browser, example, { skin });
        try {
            const copied = [];
            for (const sectionId of ['top', 'Development']) {
                const trigger = page.locator(
                    `.kanade-rev-copy-section-trigger[href="#${sectionId}"]`,
                );
                await expect(trigger).toBeVisible();
                const geometry = await trigger.evaluate(
                    (element, sectionId) => {
                        const heading = element.closest('h1, h2');
                        const walker = document.createTreeWalker(
                            heading,
                            NodeFilter.SHOW_TEXT,
                            {
                                acceptNode: (node) =>
                                    node.textContent.trim() &&
                                    !node.parentElement.closest(
                                        '.kanade-rev-copy-section-control, .mw-editsection',
                                    )
                                        ? NodeFilter.FILTER_ACCEPT
                                        : NodeFilter.FILTER_REJECT,
                            },
                        );
                        const range = document.createRange();
                        range.selectNodeContents(walker.nextNode());
                        return {
                            original:
                                window.revCopyTest.headingPositions[
                                    sectionId === 'top'
                                        ? 'firstHeading'
                                        : sectionId
                                ].left,
                            current: range.getBoundingClientRect().x,
                            triggerRight: element.getBoundingClientRect().right,
                        };
                    },
                    sectionId,
                );
                assert.ok(
                    Math.abs(geometry.current - geometry.original) <= 0.5,
                    `${skin} must preserve the original heading text position.`,
                );
                assert.ok(
                    geometry.triggerRight < geometry.current,
                    `${skin} section # must hang left of the original heading.`,
                );
                await trigger.click();
                copied.push(`[[:w:en:Intel 1103#${sectionId}]]`);
                await expect
                    .poll(() =>
                        page.evaluate(() => window.revCopyTest.clipboard),
                    )
                    .toEqual(copied);
                await page.mouse.move(0, 0);
                await trigger.hover();
                const popup = page.locator('.kanade-rev-copy-section-popup');
                await expect(popup).toBeVisible();
                await expect(
                    popup.locator('.kanade-rev-copy-section-action'),
                ).toHaveText([
                    'Copy link',
                    'Copy permalink',
                    'Copy both',
                    'Advanced copy',
                ]);
                await popup
                    .locator('.kanade-rev-copy-section-action')
                    .nth(2)
                    .click();
                copied.push(
                    `[[:w:en:Intel 1103#${sectionId}]] ([[:w:en:Special:PermaLink/1342192065#${sectionId}|${expectedLabels.en}]])`,
                );
                await expect
                    .poll(() =>
                        page.evaluate(() => window.revCopyTest.clipboard),
                    )
                    .toEqual(copied);
                console.log(
                    `UI passed: ${skin} ${sectionId} direct copy and delayed popup copy-both.`,
                );
            }
        } finally {
            await context.close();
        }
    }
    console.log(
        'UI passed: ordinary navigation option and comparison links use the intended targets.',
    );
}

async function verifyHeadingGeometry(browser) {
    const english = fixture.examples.find((item) => item.key === 'en');
    const commons = fixture.examples.find((item) => item.key === 'commons');
    for (const variant of [
        {
            name: 'modern wrapper',
            example: english,
            headingMode: 'modern',
            sectionId: 'Development',
            direction: 'ltr',
        },
        {
            name: 'legacy mw-headline',
            example: english,
            headingMode: 'legacy',
            sectionId: 'Development',
            direction: 'ltr',
        },
        {
            name: 'generated Commons',
            example: commons,
            headingMode: 'plain',
            sectionId: 'mw-subcategories',
            direction: 'ltr',
        },
        {
            name: 'RTL modern wrapper',
            example: english,
            headingMode: 'modern',
            sectionId: 'Development',
            direction: 'rtl',
        },
    ]) {
        const { context, page } = await openFixture(browser, variant.example, {
            headingMode: variant.headingMode,
            direction: variant.direction,
        });
        try {
            const trigger = page.locator(
                `.kanade-rev-copy-section-trigger[href="#${variant.sectionId}"]`,
            );
            await expect(trigger).toBeVisible();
            const geometry = await trigger.evaluate((element, sectionId) => {
                const heading = element.closest('h2, h3');
                const walker = document.createTreeWalker(
                    heading,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode: (node) =>
                            node.textContent.trim() &&
                            !node.parentElement.closest(
                                '.kanade-rev-copy-section-control, .mw-editsection',
                            )
                                ? NodeFilter.FILTER_ACCEPT
                                : NodeFilter.FILTER_REJECT,
                    },
                );
                const range = document.createRange();
                range.selectNodeContents(walker.nextNode());
                const text = range.getBoundingClientRect();
                const control = element.getBoundingClientRect();
                return {
                    original: window.revCopyTest.headingPositions[sectionId],
                    left: text.left,
                    right: text.right,
                    triggerLeft: control.left,
                    triggerRight: control.right,
                    controlWidth:
                        element.parentElement.getBoundingClientRect().width,
                    headingOverflow: getComputedStyle(heading).overflow,
                    headingClasses: heading.className,
                    parentOverflow: getComputedStyle(heading.parentElement)
                        .overflow,
                };
            }, variant.sectionId);
            assert.ok(
                Math.abs(geometry.left - geometry.original.left) <= 0.5 &&
                    Math.abs(geometry.right - geometry.original.right) <= 0.5,
                `${variant.name} must preserve the original text range.`,
            );
            assert.equal(
                geometry.controlWidth,
                0,
                `${variant.name} control must reserve no heading width.`,
            );
            assert.equal(
                geometry.headingOverflow,
                'visible',
                `${variant.name} heading must not clip the #; classes=${geometry.headingClasses}, parentOverflow=${geometry.parentOverflow}.`,
            );
            assert.ok(
                variant.direction === 'rtl'
                    ? geometry.triggerLeft > geometry.right
                    : geometry.triggerRight < geometry.left,
                `${variant.name} # must hang before the original heading text.`,
            );
            await trigger.click();
            await expect
                .poll(() =>
                    page.evaluate(() => window.revCopyTest.clipboard.length),
                )
                .toBe(1);
            await trigger.focus();
            await page.keyboard.press('ArrowDown');
            await expect(
                page.locator('.kanade-rev-copy-section-popup'),
            ).toBeVisible();
            console.log(
                `UI passed: ${variant.name} heading position, zero-width prefix, and keyboard popup.`,
            );
        } finally {
            await context.close();
        }
    }
}

async function verifyMonobookTitleMargin(browser) {
    const example = fixture.examples.find((item) => item.key === 'en');
    const { context, page, unexpectedRequests, errors } = await openFixture(
        browser,
        example,
        {
            skin: 'monobook',
            async preparePage(page) {
                // Actual MonoBook desktop metrics: the logo ends at the content
                // boundary, leaving only the 12.7px padding beside the title.
                await page.addStyleTag({
                    content: `
                        body { font: 10px sans-serif; }
                        .vector-header-container, .sidebar { display: none; }
                        .mw-page-container-inner { display: block; padding: 0;
                            margin: 0; max-width: none; }
                        #content { position: relative; z-index: 2;
                            margin: 35.546875px 0 0 154.9375px;
                            border: 1px solid #a2a9b1; padding: 12.7px;
                            font: 12.7px/19.05px sans-serif; }
                        .vector-page-titlebar { display: block; min-height: 0; border: 0; }
                        #firstHeading { margin: 0; padding: 0 0 4.05892px;
                            font: 23.876px/19.05px sans-serif; }
                        #column-one { position: absolute; top: 0; left: 0;
                            z-index: 3; width: 154.9375px; }
                        #column-one .mw-wiki-logo { display: block;
                            width: 154.9375px; height: 155px; }
                    `,
                });
                await page.evaluate(() => {
                    const sidebar = document.createElement('div');
                    sidebar.id = 'column-one';
                    const logo = document.createElement('a');
                    logo.className = 'mw-wiki-logo';
                    logo.href = '#main-page';
                    logo.setAttribute('aria-label', 'Main page');
                    sidebar.append(logo);
                    document.body.append(sidebar);
                });
            },
        },
    );
    try {
        const trigger = page.locator(
            '#firstHeading .kanade-rev-copy-section-trigger[href="#top"]',
        );
        const geometry = await trigger.evaluate((element) => {
            const box = element.getBoundingClientRect();
            const heading = document.getElementById('firstHeading');
            const walker = document.createTreeWalker(
                heading,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) =>
                        node.textContent.trim() &&
                        !node.parentElement.closest(
                            '.kanade-rev-copy-section-control',
                        )
                            ? NodeFilter.FILTER_ACCEPT
                            : NodeFilter.FILTER_REJECT,
                },
            );
            const range = document.createRange();
            range.selectNodeContents(walker.nextNode());
            return {
                titleLeft: range.getBoundingClientRect().left,
                originalTitleLeft:
                    window.revCopyTest.headingPositions.firstHeading.left,
                logoRight: document
                    .querySelector('#column-one .mw-wiki-logo')
                    .getBoundingClientRect().right,
                left: box.left,
                right: box.right,
                hits: [box.left + 1, box.x + box.width / 2, box.right - 1].map(
                    (x) => {
                        const hit = document.elementFromPoint(
                            x,
                            box.y + box.height / 2,
                        );
                        return hit === element || element.contains(hit);
                    },
                ),
            };
        });
        assert.ok(
            Math.abs(geometry.titleLeft - geometry.originalTitleLeft) <= 0.5,
        );
        assert.ok(
            geometry.left >= geometry.logoRight &&
                geometry.right < geometry.titleLeft,
            'MonoBook title # must fit entirely between the logo and unchanged title text.',
        );
        assert.ok(
            geometry.hits.every(Boolean),
            'The MonoBook logo must not intercept any part of the title control.',
        );
        await trigger.hover();
        const popup = page.locator('.kanade-rev-copy-section-popup');
        await expect(popup).toBeVisible();
        await popup
            .getByRole('button', { name: 'Copy link', exact: true })
            .click();
        await expect
            .poll(() => page.evaluate(() => window.revCopyTest.clipboard))
            .toEqual(['[[:w:en:Intel 1103#top]]']);
        assert.deepEqual(unexpectedRequests, []);
        assert.deepEqual(errors, []);
        console.log(
            'UI passed: actual MonoBook title metrics avoid logo interception without moving text.',
        );
    } finally {
        await context.close();
    }
}

async function verifyReferenceInputs(browser) {
    for (const example of fixture.examples.filter((item) =>
        ['en', 'zh'].includes(item.key),
    )) {
        for (const language of ['en', 'zh-Hans', 'zh-Hant', 'ja', 'ru']) {
            const { context, page, row, unexpectedRequests, errors } =
                await openFixture(browser, example, {
                    codex: true,
                    wgUserLanguage: language,
                    wgUserVariant: language,
                });
            try {
                await row
                    .locator('[data-kanade-rev-copy-action="advanced"]')
                    .click();
                const dialog = page.locator('.kanade-rev-copy-advanced-dialog');
                await expect(dialog.locator('textarea')).not.toHaveValue('');
                await expect(
                    dialog.locator('input[name$="-from-prefix"]'),
                ).toHaveValue('');
                await expect(
                    dialog.locator('input[name$="-from-prefix"]'),
                ).toHaveAttribute('placeholder', 'en');
                await expect(
                    dialog.locator('input[name$="-to-prefix"]'),
                ).toHaveValue('');
                await expect(
                    dialog.locator('input[name$="-to-prefix"]'),
                ).toHaveAttribute('placeholder', 'zh');
                for (const group of await dialog
                    .locator('.kanade-rev-copy-advanced-page-field')
                    .all()) {
                    await expect(group.locator('input')).toHaveCount(2);
                    await expect(
                        group.locator(
                            'label, button, [role="tooltip"], .cdx-label__optional-flag',
                        ),
                    ).toHaveCount(0);
                }
                for (const viewport of [
                    { width: 1366, height: 768 },
                    { width: 683, height: 768 },
                    { width: 375, height: 667 },
                ]) {
                    await page.setViewportSize(viewport);
                    const pairs = await dialog
                        .locator('.kanade-rev-copy-advanced-page-inputs')
                        .evaluateAll((rows) =>
                            rows.map((row) => {
                                const [prefix, page] = [
                                    ...row.querySelectorAll('input'),
                                ].map((input) => input.getBoundingClientRect());
                                return {
                                    sameLine:
                                        Math.abs(prefix.top - page.top) <= 1,
                                    ordered: page.left >= prefix.right,
                                    withinRow:
                                        row.scrollWidth <= row.clientWidth + 1,
                                    usablePrefix: prefix.width >= 60,
                                };
                            }),
                        );
                    assert.deepEqual(
                        pairs,
                        Array.from({ length: 2 }, () => ({
                            sameLine: true,
                            ordered: true,
                            withinRow: true,
                            usablePrefix: true,
                        })),
                        `${language} at ${viewport.width}px`,
                    );
                    await expect(
                        dialog.locator('.cdx-dialog__footer__primary-action'),
                    ).toBeInViewport();
                }
                const prefix = dialog.locator('input[name$="-from-prefix"]');
                const pageName = dialog.locator('input[name$="-from"]');
                await prefix.focus();
                await page.keyboard.press('Tab');
                await expect(pageName).toBeFocused();
                await prefix.fill('ja');
                await prefix.press('Enter');
                await expect(pageName).toHaveAttribute(
                    'placeholder',
                    'インテル 1103',
                );
                await expect(pageName).toHaveValue('');
                assert.deepEqual(unexpectedRequests, []);
                assert.deepEqual(errors, []);
            } finally {
                await context.close();
            }
        }
    }
    console.log(
        'UI passed: paired wiki/page inputs in all five interface languages at desktop, narrow, and mobile widths.',
    );
}

async function verifyAdvancedCopy(browser) {
    const example = fixture.examples.find((item) => item.key === 'en');
    const { context, page, row, unexpectedRequests, errors } =
        await openFixture(browser, example, { codex: true });
    let remoteGate;
    let releaseRemote = () => {};
    const holdRemote = () => {
        remoteGate = new Promise((resolve) => {
            releaseRemote = () => {
                remoteGate = undefined;
                resolve();
            };
        });
    };
    try {
        await expect(row.locator('.kanade-rev-copy-action')).toHaveText([
            'copy',
            'tools',
        ]);
        await expect(row.locator('.kanade-rev-copy-actions')).toHaveText(
            '[ copy | tools ]',
            { useInnerText: true },
        );
        await expect(
            page.locator('[data-kanade-quick-access-action="rev-copy"]'),
        ).toHaveCount(0);
        await expect(page.locator('#kanade-quick-access')).toHaveCount(0);
        await expect(page.getByRole('dialog')).toHaveCount(0);
        assert.deepEqual(
            await page.evaluate(() =>
                window.revCopyTest.moduleCalls.filter((names) =>
                    names.includes('@wikimedia/codex'),
                ),
            ),
            [],
            'Codex remains unloaded until the attribution dialog or copy feedback is requested.',
        );
        for (const selector of [
            '.kanade-rev-copy-page',
            '.kanade-rev-copy-permalink',
        ]) {
            const code = row.locator(selector);
            await code.click();
            await page.keyboard.press('ControlOrMeta+C');
            assert.equal(
                await page.evaluate(() =>
                    window.revCopyTest.readNativeClipboard(),
                ),
                await code.textContent(),
                'Native copy must contain exactly the selected code, excluding revision parentheses.',
            );
        }
        assert.deepEqual(
            await page.evaluate(() => window.revCopyTest.clipboard),
            [],
        );
        const remoteRequests = [];
        const remoteRevisions = new Map([
            [110930823, '2026-09-07T10:07:23Z'],
            [110930824, '2026-09-07T10:08:23Z'],
            [110930825, '2026-09-07T10:09:23Z'],
            [110930826, '2026-09-07T10:10:23Z'],
        ]);
        let failNextRemote = false;
        await page.route(
            'https://ja.wikipedia.org/w/api.php?**',
            async (route) => {
                const url = new URL(route.request().url());
                remoteRequests.push(Object.fromEntries(url.searchParams));
                assert.equal(route.request().method(), 'GET');
                const revision = Number(url.searchParams.get('revids'));
                assert.ok(remoteRevisions.has(revision));
                if (remoteGate) await remoteGate;
                if (failNextRemote) {
                    failNextRemote = false;
                    await route.fulfill({
                        status: 503,
                        headers: { 'access-control-allow-origin': '*' },
                        body: 'Temporary offline fixture failure',
                    });
                    return;
                }
                await route.fulfill({
                    contentType: 'application/json',
                    headers: { 'access-control-allow-origin': '*' },
                    body: JSON.stringify({
                        query: {
                            general: { lang: 'ja' },
                            pages: [
                                {
                                    title: 'FIRE BIRD (Roseliaの曲)',
                                    revisions: [
                                        {
                                            revid: revision,
                                            timestamp:
                                                remoteRevisions.get(revision),
                                        },
                                    ],
                                },
                            ],
                        },
                    }),
                });
            },
        );
        await row.locator('[data-kanade-rev-copy-action="copy"]').click();
        const toast = page.locator(
            '#kanade-rev-copy-copy-notification .cdx-toast',
        );
        await expect(toast).toBeVisible();
        await expect(toast).toContainText('Copied wikitext.');
        const toastBox = await toast.boundingBox();
        assert.ok(toastBox.y >= 0 && toastBox.y < 40);
        assert.ok(toastBox.x + toastBox.width > page.viewportSize().width - 40);
        const sectionTrigger = page.locator(
            '.kanade-rev-copy-section-trigger[href="#Development"]',
        );
        await sectionTrigger.click();
        await expect(toast).toHaveCount(1);
        const earlierCopies = await page.evaluate(
            () => window.revCopyTest.clipboard,
        );
        assert.equal(earlierCopies.length, 2);
        assert.ok(earlierCopies[1].includes('#Development'));
        const action = row.locator('[data-kanade-rev-copy-action="advanced"]');
        const dialog = page.locator('.kanade-rev-copy-advanced-dialog');
        const source = dialog.locator('input[name$="-from"]');
        const destination = dialog.locator('input[name$="-to"]');
        const output = dialog.locator('textarea');
        const primary = dialog.locator('.cdx-dialog__footer__primary-action');
        const progress = dialog.getByRole('progressbar', {
            name: 'Generating…',
        });
        await sectionTrigger.focus();
        await page.keyboard.press('ArrowDown');
        const sectionPopup = page.locator('.kanade-rev-copy-section-popup');
        await expect(sectionPopup).toBeVisible();
        await expect(
            sectionPopup.locator('.kanade-rev-copy-section-action'),
        ).toHaveText([
            'Copy link',
            'Copy permalink',
            'Copy both',
            'Advanced copy',
        ]);
        for (let index = 0; index < 3; index++)
            await page.keyboard.press('Tab');
        await expect(
            sectionPopup.getByRole('button', {
                name: 'Advanced copy',
                exact: true,
            }),
        ).toBeFocused();
        await page.keyboard.press('Space');
        await expect(dialog).toBeVisible();
        await expect(sectionPopup).toHaveCount(0);
        await expect(source).toHaveValue('#Development');
        await expect(destination).toHaveValue('');
        await expect(
            dialog.locator('input[type="checkbox"]').first(),
        ).not.toBeChecked();
        await expect(output).toHaveValue(
            new RegExp(
                `Special:PermaLink/${example.revision}#Development`,
                'u',
            ),
        );
        await expect(dialog.locator('input[name$="-to-prefix"]')).toHaveValue(
            '',
        );
        await expect(
            dialog.locator('input[name$="-to-prefix"]'),
        ).toHaveAttribute('placeholder', 'zh');
        await dialog.locator('input[name$="-to-prefix"]').fill('en');
        await dialog.locator('input[name$="-to-prefix"]').press('Enter');
        await expect(output).toHaveValue(/This page was translated from/u);
        await expect(output).not.toHaveValue(/partially translated/u);
        await dialog.locator('input[type="checkbox"]').first().check();
        await expect(output).toHaveValue(/partially translated/u);
        await expect(output).toHaveValue(/#Development/u);
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(sectionTrigger).toBeFocused();

        const leadTrigger = page.locator(
            '#firstHeading .kanade-rev-copy-section-trigger[href="#top"]',
        );
        await leadTrigger.focus();
        await page.keyboard.press('ArrowDown');
        await sectionPopup
            .getByRole('button', {
                name: 'Advanced copy',
                exact: true,
            })
            .click();
        await expect(dialog).toBeVisible();
        await expect(source).toHaveValue('#top');
        await expect(destination).toHaveValue('');
        await expect(
            dialog.locator('input[type="checkbox"]').first(),
        ).not.toBeChecked();
        await expect(output).toHaveValue(
            new RegExp(`Special:PermaLink/${example.revision}#top`, 'u'),
        );
        await expect(output).not.toHaveValue(/#Development/u);
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(leadTrigger).toBeFocused();

        await action.focus();
        await page.keyboard.press('Space');
        await expect(dialog).toBeVisible();
        await expect(source).toHaveValue('');
        await expect(destination).toHaveValue('');
        await expect(
            dialog.locator('input[type="checkbox"]').first(),
        ).not.toBeChecked();
        await expect(source).toHaveAttribute('placeholder', example.page);
        await expect(destination).toHaveAttribute('placeholder', example.page);
        await expect(output).toBeVisible();
        await expect(output).not.toHaveValue('');
        await expect(output).not.toHaveValue(/#(?:Development|top)/u);
        await expect(primary).toHaveText('Copy wikitext');
        await expect(primary).toBeEnabled();
        await expect(dialog.locator('input[name$="-from-prefix"]')).toHaveValue(
            '',
        );
        await expect(
            dialog.locator('input[name$="-from-prefix"]'),
        ).toHaveAttribute('placeholder', 'en');
        await expect(dialog.locator('input[name$="-to-prefix"]')).toHaveValue(
            '',
        );
        await expect(
            dialog.locator('input[name$="-to-prefix"]'),
        ).toHaveAttribute('placeholder', 'zh');
        await captureReview(page, 'advanced-desktop');
        await dialog.locator('input[name$="-to-prefix"]').fill('en');
        await dialog.locator('input[name$="-to-prefix"]').press('Enter');
        await expect(output).toHaveValue(/This page was translated from/u);
        const sourceUrl =
            'https://ja.wikipedia.org/w/index.php?title=FIRE_BIRD_(Roseliaの曲)&oldid=110930823#ライブ・パフォーマンス';
        holdRemote();
        await page.evaluate(
            (text) => window.revCopyTest.preparePaste(text),
            sourceUrl,
        );
        await source.focus();
        await source.press('ControlOrMeta+V');
        await expect(source).toHaveValue(sourceUrl);
        await expect.poll(() => remoteRequests.length).toBe(1);
        await expect(progress).toBeVisible();
        await expect(output).toHaveValue('');
        await expect(primary).toBeDisabled();
        await expect(source).toBeFocused();
        await source.press('Enter');
        assert.equal(
            remoteRequests.length,
            1,
            'Enter must reuse the pending pasted lookup.',
        );
        releaseRemote();
        await expect(output).toHaveValue(
            /w:ja:Special:PermaLink\/110930823#ライブ・パフォーマンス/u,
        );
        await expect(progress).toHaveCount(0);
        await expect(source).toBeFocused();
        assert.equal(remoteRequests.length, 1);
        await dialog.locator('input[name$="-from-prefix"]').fill('w:ja');
        await source.fill('Special:PermaLink/110930823#ライブ・パフォーマンス');
        await source.press('Enter');
        await expect(output).toHaveValue(
            /w:ja:Special:PermaLink\/110930823#ライブ・パフォーマンス/u,
        );
        assert.equal(
            remoteRequests.length,
            1,
            'Split prefix and page fields reuse the exact revision lookup.',
        );
        const requestsAfterPaste = remoteRequests.length;
        await destination.focus();
        await source.focus();
        assert.equal(
            remoteRequests.length,
            requestsAfterPaste,
            'Blur must reuse a completed lookup.',
        );
        const checkboxes = dialog.locator('input[type="checkbox"]');
        const localRequestsAfterPaste = await page.evaluate(
            () => window.revCopyTest.apiCalls.length,
        );
        const assertCachedPages = async (change) => {
            assert.equal(
                remoteRequests.length,
                requestsAfterPaste,
                `${change} must reuse loaded remote page data.`,
            );
            assert.equal(
                await page.evaluate(() => window.revCopyTest.apiCalls.length),
                localRequestsAfterPaste,
                `${change} must reuse loaded local page data.`,
            );
        };
        await checkboxes.nth(0).check();
        await expect(output).toHaveValue(/partially translated/u);
        await assertCachedPages('Partial');
        await checkboxes.nth(1).check();
        await expect(output).toHaveValue(/with modifications/u);
        await assertCachedPages('Modified');
        const summary = await output.inputValue();
        assert.match(summary, /partially translated/u);
        assert.match(summary, /with modifications/u);
        assert.doesNotMatch(summary, /[.。]$/u);
        assert.match(
            summary,
            /w:ja:Special:PermaLink\/110930823#ライブ・パフォーマンス/u,
        );
        await primary.click();
        await expect
            .poll(() => page.evaluate(() => window.revCopyTest.clipboard))
            .toEqual([...earlierCopies, summary]);
        await expect(dialog).toContainText('Copied wikitext.');

        await dialog.locator('.cdx-toggle-button').nth(1).click();
        await expect(output).toHaveValue(/partially copied/u);
        await assertCachedPages('Copy & paste mode');
        await expect(dialog.locator('input[type="radio"]')).toHaveCount(3);
        await dialog.locator('input[type="radio"]').nth(1).check();
        await expect(output).toHaveValue(
            new RegExp(`w:en:Special:PermaLink/${example.revision}`, 'u'),
        );
        const sourceSummary = await output.inputValue();
        assert.doesNotMatch(sourceSummary, /[.。]$/u);
        assert.ok(!sourceSummary.startsWith('=='));
        assert.ok(!sourceSummary.includes('~~~~'));
        assert.ok(
            sourceSummary.includes(
                `w:en:Special:PermaLink/${example.revision}`,
            ),
        );
        await assertCachedPages('Source edit summary purpose');
        await dialog.locator('input[type="radio"]').nth(2).check();
        await expect(output).toHaveValue(
            /^== 英語版ウィキペディアへの転記 ==/u,
        );
        const notice = await output.inputValue();
        assert.match(notice, /^== 英語版ウィキペディアへの転記 ==/u);
        assert.ok(
            notice.includes(
                `版を[[:w:en:Special:PermaLink/${example.revision}|英語版ウィキペディア]]に`,
            ),
        );
        assert.ok(notice.endsWith(' --~~~~'));
        await assertCachedPages('Source talk notice purpose');
        for (const viewport of [
            { width: 683, height: 768 },
            { width: 375, height: 667 },
        ]) {
            await page.setViewportSize(viewport);
            const geometry = await dialog.boundingBox();
            assert.ok(
                geometry.x >= 0 &&
                    geometry.x + geometry.width <= viewport.width &&
                    geometry.y >= 0 &&
                    geometry.y + geometry.height <= viewport.height,
            );
            await expect(primary).toBeInViewport();
            await captureReview(page, `advanced-${viewport.width}`);
        }
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(action).toBeFocused();
        await action.click();
        await expect(dialog).toBeVisible();
        await expect(output).not.toHaveValue('');
        await assertCachedPages('Reopening the same context');
        const changedRevisionUrl = sourceUrl.replace('110930823', '110930824');
        await source.fill(changedRevisionUrl);
        await source.press('Enter');
        await expect(output).toHaveValue(
            /Special:PermaLink\/110930824#ライブ・パフォーマンス/u,
        );
        assert.equal(
            remoteRequests.length,
            requestsAfterPaste + 1,
            'A different source revision must load its own metadata.',
        );
        await source.fill(sourceUrl);
        await source.press('Enter');
        await expect(output).toHaveValue(
            /Special:PermaLink\/110930823#ライブ・パフォーマンス/u,
        );
        assert.equal(
            remoteRequests.length,
            requestsAfterPaste + 1,
            'Returning to a previously loaded revision must reuse its cached metadata.',
        );
        const fragmentUrl = sourceUrl.replace(
            '#ライブ・パフォーマンス',
            '#History',
        );
        await source.fill(fragmentUrl);
        await source.press('Enter');
        await expect(output).toHaveValue(
            /Special:PermaLink\/110930823#History/u,
        );
        assert.equal(
            remoteRequests.length,
            requestsAfterPaste + 1,
            'Changing only a fragment must reuse the same revision metadata.',
        );
        const retryUrl = fragmentUrl.replace('110930823', '110930825');
        await source.fill(retryUrl);
        await expect(output).toHaveValue('');
        await expect(primary).toBeDisabled();
        failNextRemote = true;
        await source.press('Enter');
        await expect(dialog).toContainText('Could not resolve');
        await expect(output).toHaveValue('');
        await expect(primary).toBeDisabled();
        await expect(source).toBeFocused();
        const requestsAfterFailure = remoteRequests.length;
        await destination.focus();
        await expect(output).toHaveValue(
            /Special:PermaLink\/110930825#History/u,
        );
        assert.equal(
            remoteRequests.length,
            requestsAfterFailure + 1,
            'Blur must retry a failed lookup for the same input.',
        );
        await expect(dialog).not.toContainText('Could not resolve');
        holdRemote();
        await source.fill(sourceUrl.replace('110930823', '110930826'));
        await source.press('Enter');
        await expect(progress).toBeVisible();
        await page.evaluate(() => {
            const content = document.getElementById('mw-content-text');
            content.replaceWith(content.cloneNode(true));
            window.mw.hook('wikipage.content').fire();
        });
        await expect(dialog).toHaveCount(0);
        const lateResponse = page.waitForResponse(
            'https://ja.wikipedia.org/w/api.php?**',
        );
        releaseRemote();
        await lateResponse;
        await expect(dialog).toHaveCount(0);
        assert.deepEqual(
            remoteRequests.map((request) => request.revids),
            ['110930823', '110930824', '110930825', '110930825', '110930826'],
            'Each successful revision loads once; failures retry and stale results stay hidden.',
        );
        assert.deepEqual(unexpectedRequests, []);
        assert.deepEqual(errors, []);
        console.log(
            'UI passed: real Codex section Advanced, automatic attribution, native paste, progress, per-tab page caching, copy, focus, narrow viewport, uncached revision retry, and disposal.',
        );
    } finally {
        releaseRemote();
        await context.close();
    }
}

const browser = await chromium.launch({ headless: true });
try {
    for (const example of fixture.examples) await verifyPage(browser, example);
    const english = fixture.examples.find((item) => item.key === 'en');
    for (const skin of skins.slice(1)) await verifyPage(browser, english, skin);
    await verifySkinAndViewport(browser);
    await verifyDistributionStartup(browser);
    await verifyAlternativeViews(browser);
    await verifyHeadingGeometry(browser);
    await verifyMonobookTitleMargin(browser);
    await verifyReferenceInputs(browser);
    await verifyAdvancedCopy(browser);
    console.log(
        'Offline production browser checks passed for all seven standard skin fixtures.',
    );
} finally {
    await browser.close();
}
