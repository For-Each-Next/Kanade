# Screenshot sources and reproduction

Last reviewed: 2026-10-21.

<!-- toc:start -->

## Contents

- [Capture profiles](#capture-profiles)
- [Source pages](#source-pages)
- [Reproduction](#reproduction)
- [Offline tests](#offline-tests)
- [Article and image attribution](#article-and-image-attribution)

<!-- toc:end -->

## Capture profiles

The maintained collection contains exactly three live Wikimedia screenshots,
one per interface language. The English and Simplified Chinese images show the
page and exact-revision controls; the available Traditional Chinese image shows
the desktop attribution dialog. This is not a translated set of one view because
the capture collection has no Traditional Chinese overview image. All use Vector
2022 at device scale factor 1. The [tool guide](../README.md) shows the same
selection.

| Image                                                | Viewport   | Demonstrated behavior                                                                   |
| ---------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| [screenshot01.en.png](screenshot01.en.png)           | 1366 × 768 | English Wikipedia page and exact-revision wikitext with English copy controls.          |
| [screenshot02.zh-Hans.png](screenshot02.zh-Hans.png) | 1366 × 768 | Simplified Chinese toolbar and the 游戏操作 (Gameplay) section popup with four actions. |
| [screenshot03.zh-Hant.png](screenshot03.zh-Hant.png) | 1366 × 768 | Traditional Chinese translation edit summary in the desktop Codex dialog.               |

The overview uses `/zh-cn/` with `uselang=zh-cn`. Its heading displays 游戏操作,
while the rendered section ID and copied fragment remain `遊戲操作`.
The Traditional Chinese dialog uses `/zh-tw/` with `uselang=zh-tw`, source `ja`,
and an empty destination prefix and page box with the `zh` prefix placeholder.
Real language-link and revision lookups resolve the Japanese source. These
captures follow the
[shared wiki and interface-language policy](../../documentation.md#screenshots-and-attribution).
The retained images show completed results. Loading, clipboard feedback,
copy-mode variants, responsive dialogs, and additional skins remain covered by
offline and live checks. No wiki write was attempted during capture.

## Source pages

The capture browser injects the built gadget into the actual site. Article HTML,
styling, text, images, and API responses come from Wikimedia, without reconstructed
page markup or intercepted revision responses.

| Use                               | Source revision                                                                                                                                                      | UTC revision timestamp |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| English project overview          | [Eternal Sonata, 1376010866](https://en.wikipedia.org/w/index.php?title=Eternal_Sonata&oldid=1376010866&useskin=vector-2022&uselang=en)                              | 2026-09-21 13:15:07    |
| Overview                          | [简体中文 信赖铃音 ～肖邦之梦～, 95081087, 游戏操作](https://zh.wikipedia.org/zh-cn/信賴鈴音_～蕭邦之夢～?oldid=95081087&useskin=vector-2022&uselang=zh-cn#遊戲操作) | 2026-10-16 06:05:28    |
| Dialog background and destination | [臺灣正體 信賴鈴音 ～蕭邦之夢～, 95081087](https://zh.wikipedia.org/zh-tw/信賴鈴音_～蕭邦之夢～?oldid=95081087&useskin=vector-2022&uselang=zh-tw)                    | 2026-10-16 06:05:28    |

These are actual project pages, not translated reconstructions. Their timestamps
and final URLs are also recorded in the capture ledger.

[live-captures.json](live-captures.json) records actual capture times, final
URLs, displayed revision IDs, API timestamps, selected skins, generated previews,
notice preparation, and the injected bundle's SHA-256. The home wiki is Chinese
Wikipedia (`w:zh`). The Traditional Chinese dialog uses Japanese source links
with the `w:ja:` prefix in its summary. Revision labels include seconds and omit
a timezone suffix. Each retained page record identifies the build used for its
image.

## Reproduction

With dependencies installed, run from the project root:

```sh
npm run build
node scripts/rev-copy/capture-live.mjs --only=english,zh-hans,advanced --skip-skins
```

The commands rebuild the tools and run the live capture helper. Network access
and Playwright Chromium are required. Captures use the sizes above with disabled
animations and write the three maintained PNGs to `docs/rev-copy/images/`.

Before capturing the Chinese page, dismiss its top community notice and
language-variant prompt using the site's native controls. If a top notice has no
close control, hide only that notice locally for the capture and record the
preparation in the capture ledger. Do not replace article content or skin markup.

The script uses the configured system HTTPS proxy on macOS when enabled;
`KANADE_BROWSER_PROXY` specifies an explicit browser proxy. TLS verification
remains enabled. The `--only` option selects these three maintained profiles.
`--skip-skins` skips additional live skin checks.

Inspect the finished images at their actual size. Confirm that the row has no
extra margin, `[ copy | tools ]` uses the skin font, the section's `#` control does
not move the heading, all four Gameplay section popup actions are visible, and
dialog fields and footer actions remain usable at every size. Capture only modifies the current
browser session and never submits wiki edits. The browser blocks wiki write
requests and asserts that no write was attempted; it does not substitute read
responses or host content.

## Offline tests

The separate [wiki-examples.json](../../../tests/rev-copy/fixtures/wiki-examples.json) fixture
retains Intel 1103 examples and pinned metadata retrieved on 7 October 2026.
It stores normalized revision responses, page configuration, selected skin-boundary
excerpts, and short article-text excerpts for reproducible tests. Reconstructed
offline pages remain separate from documentation screenshots.

The browser suite covers insertion boundaries in Vector 2022, Vector legacy,
MonoBook, Timeless, Modern, Cologne Blue, and Minerva, along with responsive
layouts, keyboard controls, copying, attribution states, and failure feedback.
Modern and Cologne Blue use offline fixtures; live validation uses the five skins
listed above. Automated tests do not edit Wikimedia pages or overwrite the
documentation captures.

## Article and image attribution

Article and category text is attributed to the respective Chinese, Japanese,
and English Wikipedia and Wikimedia Commons contributors through the
source revisions above and their linked page histories.
Wikipedia article text is available under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

The Chinese article's [PS3 cover](https://zh.wikipedia.org/wiki/File:Eternal_Sonata.jpg)
and [gameplay screenshot](https://zh.wikipedia.org/wiki/File:Eternal-sonata-screenshot.jpg)
are local files identified as fair-use images on their file pages. Any such imagery
visible in the screenshots retains its own terms; Revision Copy's CC0 license does not
apply to it. Follow those file pages for the recorded sources and usage notices.
The English overview displays the Xbox 360 cover from
[File:Eternal Sonata.jpg](https://en.wikipedia.org/wiki/File:Eternal_Sonata.jpg).
It retains the authorship and non-free use terms on that file page; the article's
CC BY-SA license and the interface's CC0 dedication do not relicense the cover.
The file page credits Namco Bandai Games, © 2007.

Earlier capture profiles also showed the following Wikimedia images; these
attributions are retained as historical provenance even though those image
files are no longer part of the maintained gallery.

The English Intel 1103 view shows
[Intel C1103](https://commons.wikimedia.org/wiki/File:Intel_C1103.jpg)
by Thomas Nguyen (Pttn / Stelo.xyz), under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
Wikimedia resizes the image within the captured browser view.

The English Nintendo view shows
[Headquarters of Nintendo Co., Ltd](https://commons.wikimedia.org/wiki/File:Headquarters_of_Nintendo_Co.,_Ltd.jpg)
by Tokumeigakarinoaoshima, under CC BY-SA 4.0. The
[Nintendo logo](https://commons.wikimedia.org/wiki/File:Nintendo.svg) and
[Japanese flag](https://commons.wikimedia.org/wiki/File:Flag_of_Japan.svg) retain
the public-domain and other notices on their file pages.

The separate offline fixture embeds a resized Wikimedia-generated thumbnail of
[Intel C1103](https://commons.wikimedia.org/wiki/File:Intel_C1103.jpg) by Thomas
Nguyen (Pttn / Stelo.xyz), available under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Its source, author,
license, and adaptation metadata remain recorded under `assets.intelC1103` in the
fixture JSON.

Project-owned source and generated scripts use the [CC0-1.0 license](../../../LICENSE).
