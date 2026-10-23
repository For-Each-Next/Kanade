# Source Editor screenshot inventory

Last reviewed: 2026-10-21.

Source Editor has one image collection for source editing, formatting,
reference management, and text utilities. The maintained collection contains
exactly three images: capture profile 03 in English (`en`), Simplified Chinese (`zh-Hans`),
and Traditional Chinese (`zh-Hant`). The view shows shared article and citation
formatting preferences, captured from actual Wikipedia source pages using the
built tool, native MediaWiki runtime, and live API responses. Each interface
language uses its matching Wikipedia edition: `enwiki` or `zhwiki` for both
Chinese variants, following the shared
[capture policy][review-policy].
Article and citation text retain their actual source wording.

Additional interface states remain covered by offline browser tests. This
collection keeps one view per language to limit the maintained documentation
images while retaining language coverage.

## Image inventory

| View                                                | Viewport   | English                   | Simplified Chinese             | Traditional Chinese            |
| --------------------------------------------------- | ---------- | ------------------------- | ------------------------------ | ------------------------------ |
| Shared article and citation formatting preferences. | 1366 × 768 | [01](screenshot01.en.png) | [02](screenshot02.zh-Hans.png) | [03](screenshot03.zh-Hant.png) |

Files are numbered continuously by interface language. The view numbers in the
capture procedure and historical provenance below are capture profile IDs;
they do not identify maintained filenames.

All retained captures use device pixel ratio 1, the live Vector 2022 skin, native
MediaWiki-provided Vue and Codex, a light color scheme, and disabled animations
in Chromium. The capture script injects the built `dist/source_editor.min.js`
into each live page; it does not replace page configuration, article source,
ResourceLoader, or API responses. The native source form's read-only state is
retained. Opening and dismissing citation drafts submits no wiki changes.

## Historical capture provenance

The following sections record sources and behavior for earlier live capture
profiles whose image files are no longer in the maintained collection.

Views 01 and 02 frame only the native Source Editor surface within the
1366 × 768 browser viewport. This removes unrelated transcluded-template lists
from the overview while keeping the highlighted article source and actual hover
preview. The editor retains its host-provided dimensions, source, and styling.
The capture ledger records the exact `captureRegion` and pixel dimensions for
each language; these focused images are smaller than the full browser viewport.
The remaining views retain their complete browser framing.

## Capture procedure

After installing the root dependencies and Playwright Chromium, run from the
repository root:

```sh
npm run build
node scripts/source-editor/capture-live.mjs --views=03
```

The script opens pinned Wikimedia source views, verifies their full native
textarea content against the exact revision returned by the revisions API,
checks that the native wiki identity matches the selected interface language,
and then uses the tool's normal controls. It enables article-link previews with
**Highlighting settings → Apply settings** for the current editor session;
article formatting is not applied. It opens existing references for review and
dismisses the draft with its quiet **Cancel** action. Wiki write requests are
blocked, and every capture checks that the backing source still matches the
initial native textarea.

The text-utility capture loads the same pinned Nintendo source. On a read-only
native form it shows the initial two-pair form without entering values or
requesting a preview. On an editable native form it prepares a replacement
preview and records the actual output checksum, without applying it. The mobile capture shows
the horizontal shared **Format** and **Tools** controls with both dialogs closed.
It does not activate **Format**. Neither workflow
stores text, changes editor source, or submits a wiki edit.

The URLs request MediaWiki's classic source form with `veswitched=1`. On English
Wikipedia, the capture waits for native CodeMirror and uses its **Syntax
highlighting** toolbar toggle to expose the textarea before loading Source
Editor. If MediaWiki's first-edit welcome appears, it is dismissed through its
native **Start editing** action. The ledger records those native actions; neither
the textarea's read-only state nor its source is changed.

Chromium uses the system HTTPS proxy on macOS when enabled. A capture environment
can supply `KANADE_BROWSER_PROXY` explicitly. To inspect or replace a subset, use
the same live workflow:

```sh
node scripts/source-editor/capture-live.mjs --locales=en,zh-Hant --views=03
```

Run one Source Editor capture process at a time so partial runs preserve each
other's ledger updates.

[The capture ledger](live-captures.json) records each image's browser version,
URL, interface language, viewport, pixel ratio, bundle and image checksums,
native page configuration, exact revision and timestamp, source hashes,
loaded native assets, page errors, and live page-summary responses. Its write
list must remain empty. Partial runs retain prior entries with their own capture
time and bundle hash. The top-level bundle hash identifies the most recent run;
each image's entry identifies the build actually used for that image. Regenerate
the full set after a shared UI change; a locale-only label correction can replace
that language's captures while retaining the other entries' original hashes.

MediaWiki adds one terminal newline when presenting these revisions in the source
textarea. The script permits only that exact presentation difference and records
both the API revision-content hash and native textarea hash. It does not change
the textarea to make them match.

Review each retained image at its actual size for clipped text, readable
controls, and visible actions. The maintained image is a normal desktop view;
the shared [responsive review policy][review-policy] also covers 375 × 667 and
683 × 768 CSS pixels. Browser tests verify action geometry and keyboard
behavior at those sizes.

## Nintendo source and attribution

The Chinese variants of views 01–04, 10, and 11 load the full source of
[任天堂 (Nintendo), revision 94167581][nintendo-revision], saved on 2026-09-03 at
02:14:35 UTC. Text is credited to [Chinese Wikipedia contributors][nintendo-history]
under [CC BY-SA 4.0][article-license]. The source remains unchanged; the editor
scrolls to the relevant feature.

Citation inspection uses the MoneyZine citation titled
“トヨタの5倍超、従業員1人で10億稼ぐ高収益企業「任天堂の究極目標」” in the 概要 section,
next to an explanatory `{{NoteTag}}`. The article-link preview uses the source's
`[[任天堂Switch]]` link in the same section. Each live capture records its complete
verified source hash in the ledger.

`tests/source-editor/fixtures/nintendo.wikitext` and its adjacent
`nintendo.source.json` retain the same pinned full source for offline browser
tests. They are test inputs; live documentation captures read Wikipedia directly.

## Nintendo Switch preview source and attribution

The Chinese variants of view 02 request the actual [Chinese Wikipedia Page Content Service][switch-summary]
response through the editor's normal link-preview service. The ledger preserves
the returned response, capture time, and endpoint for each interface language.
The captured response identifies [任天堂Switch, revision 94119527][switch-revision],
page ID 5488058, with revision timestamp 2026-08-31 at 10:32:26 UTC. Its article
description and introduction are displayed without replacement or interface
translation. Article text is credited to [Chinese Wikipedia contributors][switch-history]
under [CC BY-SA 4.0][article-license]. The response separately identifies the
central description source and [Wikidata item Q19610114][switch-wikidata].

The offline test response remains in
`tests/source-editor/fixtures/nintendo-switch.summary.json`, with endpoint, contributor
history, license, revision, and retrieval metadata in
`tests/source-editor/fixtures/nintendo-switch.source.json`. That snapshot was retrieved
on 2026-10-08 at 12:43:45.244 UTC and its SHA-256 is
`1bc41cf25c0749537b478d35f7a3c06a7f91151922e563a5043582cd841b10f5`.
Live captures do not replay it. Thumbnail URLs may be returned by the service;
the preview does not download or display article images, audio, or video.

To intentionally refresh that offline response and its attribution metadata, run
`node scripts/source-editor/fetch-preview-source.mjs` from the repository root.
Review the changed revision, response, and provenance together before accepting
the fixture update. This read-only helper does not regenerate maintained live
screenshots.

## Eternal Sonata source and attribution

The Chinese variants of views 05–08 load the full source of
[信賴鈴音 ～蕭邦之夢～ (Eternal Sonata), revision 94743103][sonata-revision], saved on
2026-10-04 at 02:44:43 UTC, by [Chinese Wikipedia contributors][sonata-history]
under [CC BY-SA 4.0][article-license]. The exact API revision-content SHA-256 is
`49e623ff1ab18fd7df63fafe2d26dd03c2c09cc5805ef1e4d5907293ee449038`.
The full source is read from the native live form and verified at capture time;
the repository does not store another article-source copy.

The source manager reads the full article. Views 05 and 06 show its source list
at normal and narrow desktop widths. View 07 opens the existing `Cite interview`
source with Japanese title “ディレクションチームインタビュー” and reference name
“Noguchi & Hatsushiba, 2007, pp. 356-7”. Its neutral **Cancel** action uses quiet
weight, **Apply and keep editing** is secondary, and **Save citation** is primary.
The capture dismisses the draft without applying changes. View 08 shows citation
checks and the action that opens the shared formatting preferences; it does not
duplicate those preferences in the manager.

## English sources and attribution

These captures use English Wikipedia's unchanged article source. The reference
manager reads existing native citations rather than inserting example references.

| Interface | Views        | Source revision                                  | Contributors                                          |
| --------- | ------------ | ------------------------------------------------ | ----------------------------------------------------- |
| English   | 01–04, 10–11 | [Nintendo, 1379167316][en-nintendo-revision]     | [English Wikipedia contributors][en-nintendo-history] |
| English   | 05–08        | [Eternal Sonata, 1376010866][en-sonata-revision] | [English Wikipedia contributors][en-sonata-history]   |

English citation inspection opens “President Tatsumi Kimishima on the Future of
Nintendo”; the manager opens “Trusty Bell Launch Party”. View 02 previews
the native `[[Nintendo Switch]]` link on English Wikipedia.
The actual page-summary responses, their source revisions, and introductory
text remain recorded per image in the ledger; no response is translated or replayed.
All article text is licensed under [CC BY-SA 4.0][article-license].

## Nintendo Switch source and attribution

View 09 opens highlighting preferences over the full native Nintendo Switch
source on the matching Wikipedia edition. This replaces the earlier Commons
background while retaining the view index and filenames.

| Interface             | Source revision                                   | Contributors                                        |
| --------------------- | ------------------------------------------------- | --------------------------------------------------- |
| English               | [Nintendo Switch, 1378957550][en-switch-revision] | [English Wikipedia contributors][en-switch-history] |
| Both Chinese variants | [任天堂Switch, 94119527][switch-revision]         | [Chinese Wikipedia contributors][switch-history]    |

The source remains unchanged and is licensed under [CC BY-SA 4.0][article-license].
The ledger records the verified revision content, native textarea hashes,
read-only state, wiki identity, and native assets. The source editor does not
display article media.

## Replacing captures

After relevant UI changes, rebuild, regenerate every affected complete language
set with the live script, and inspect it. Update this inventory, tool guide links,
capture ledger, fixture metadata where applicable, and source attribution together.
The opt-in offline browser screenshot tests are development fixtures and do not
establish live Wikimedia capture provenance.

The project's CC0 dedication applies to its interface and authored material.
Captured Wikimedia text retains the attribution and CC BY-SA terms above and in
[third-party notices](../../../THIRD-PARTY-NOTICES.md).

[review-policy]: ../../documentation.md#screenshots-and-attribution
[nintendo-revision]: https://zh.wikipedia.org/w/index.php?title=%E4%BB%BB%E5%A4%A9%E5%A0%82&oldid=94167581
[nintendo-history]: https://zh.wikipedia.org/w/index.php?title=%E4%BB%BB%E5%A4%A9%E5%A0%82&action=history
[switch-summary]: https://zh.wikipedia.org/api/rest_v1/page/summary/%E4%BB%BB%E5%A4%A9%E5%A0%82Switch
[switch-revision]: https://zh.wikipedia.org/w/index.php?title=%E4%BB%BB%E5%A4%A9%E5%A0%82Switch&oldid=94119527
[switch-history]: https://zh.wikipedia.org/w/index.php?title=%E4%BB%BB%E5%A4%A9%E5%A0%82Switch&action=history
[switch-wikidata]: https://www.wikidata.org/wiki/Q19610114
[sonata-revision]: https://zh.wikipedia.org/w/index.php?title=%E4%BF%A1%E8%B3%B4%E9%88%B4%E9%9F%B3_%EF%BD%9E%E8%95%AD%E9%82%A6%E4%B9%8B%E5%A4%A2%EF%BD%9E&oldid=94743103
[sonata-history]: https://zh.wikipedia.org/w/index.php?title=%E4%BF%A1%E8%B3%B4%E9%88%B4%E9%9F%B3_%EF%BD%9E%E8%95%AD%E9%82%A6%E4%B9%8B%E5%A4%A2%EF%BD%9E&action=history
[en-nintendo-revision]: https://en.wikipedia.org/w/index.php?title=Nintendo&oldid=1379167316
[en-nintendo-history]: https://en.wikipedia.org/w/index.php?title=Nintendo&action=history
[en-sonata-revision]: https://en.wikipedia.org/w/index.php?title=Eternal_Sonata&oldid=1376010866
[en-sonata-history]: https://en.wikipedia.org/w/index.php?title=Eternal_Sonata&action=history
[en-switch-revision]: https://en.wikipedia.org/w/index.php?title=Nintendo_Switch&oldid=1378957550
[en-switch-history]: https://en.wikipedia.org/w/index.php?title=Nintendo_Switch&action=history
[article-license]: https://creativecommons.org/licenses/by-sa/4.0/
