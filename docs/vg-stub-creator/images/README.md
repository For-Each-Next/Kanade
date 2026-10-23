# Documentation screenshots

Last reviewed: 2026-10-21.

These screenshots show Article Creator running in Chromium on actual Chinese
Wikipedia pages. The capture loads the built userscript, Wikipedia's own
MediaWiki configuration, ResourceLoader, Vue, Codex, styles, and API responses.
It does not reconstruct the page or substitute simulated wiki services.

Run from the repository root after building:

```sh
npm run build
node scripts/vg-stub-creator/capture-live.mjs --desktop-only
```

Pass catalog names to refresh a subset, for example
`node scripts/vg-stub-creator/capture-live.mjs en zh-Hans --desktop-only`. The script uses the ordinary
browser network route and the configured macOS HTTPS proxy when available.
`KANADE_BROWSER_PROXY` selects an explicit browser proxy.
The maintained set contains exactly three images: the desktop Facts view in
English, Simplified Chinese, and Traditional Chinese. Add `--desktop-only` to
refresh that view while preserving its other language variants. Use
`--facts-only` to refresh all three Facts capture profiles (01–03), including the mobile
view, for offline review; that broader capture is not the maintained image set.
Choose only one subset flag. The capture waits up to
one minute each for the metadata status row to settle and for the review action
to become available, then records the actual state. An unfinished lookup retains
its pending state.

## Source and supplied input

The actual host is the source view of
[信賴鈴音 ～蕭邦之夢～ (Eternal Sonata), revision 94743103][source-revision],
by [Chinese Wikipedia contributors][source-history], under [CC BY-SA 4.0][cc-by-sa].
The URL selects `action=edit`, the `vector-2022` skin, and the requested interface
language. The script checks the real wiki identity and reads the source revision
ID, timestamp, and full source through the Action API. New captures verify that
the unchanged native textarea matches that exact revision, allowing only
MediaWiki's terminal newline, and record both source hashes and read-only state.
Retained captures keep their originally recorded verification metadata.
It dismisses Wikipedia's first-edit
welcome using its native **Start editing** action when present.

The form contains the user-supplied Toem 2 example in
`tests/vg-stub-creator/fixtures/toem-2.screenshot.json`. It is an illustrative
draft, separate from the host article, and has not been published or independently
verified as factual metadata.

| Input                               | Value                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Draft name                          | `摄影冒险2`                                                              |
| English name and source-page lookup | `Toem 2`                                                                 |
| Developer                           | `Something We Made`                                                      |
| Publisher                           | `=`, following the developer                                             |
| Platforms                           | Windows, macOS, Linux, Nintendo Switch, Nintendo Switch 2, PlayStation 5 |
| Release year                        | `2026年`                                                                 |
| Genre                               | `[[冒险游戏\|冒险]]`                                                     |
| Score and recommendation            | PC Metacritic `81`; OpenCritic `88%`                                     |
| Additional text                     | `游戏为《[[TOEM]]》（2021年）的续作。`                                   |
| Localized name                      | Official Simplified Chinese `摄影冒险2`, as supplied by the user         |
| Localized-name URL                  | [The supplied Steam URL][steam-source]                                   |

The capture enters these values through visible form controls. It uses the
catalog's default category, navigation-template, and stub choices, without
inventing verified relationships or forcing page-existence states. Related-page
checks and any metadata lookups access the actual services. Existing, missing,
pending, and failed states retain their actual meaning at capture time.

Partial runs keep every previous image and provenance entry until that image has
been captured successfully. A failed retry does not discard the maintained
language set or relabel a retained image with the latest build's checksum.

The **Names** view selects the supplied localized name for the draft page title,
main name, and conversion title. The redirect view adds the illustrative name
`Toem 2 (video game)` through **Add redirect**. That input is a demonstration
value, not a claimed official alternative title. Its status comes from the live
wiki check.

Before the final source review, the capture removes the optional Steam source URL
through its source row's **Remove** action. This last profile demonstrates generated article text
without waiting for external citation metadata; the prior views retain the
supplied URL. The capture chooses **Preview without moving** when the host article
and draft title differ.

The native edit preview can return a read-only page without `#wikiPreview`, for
example when Wikipedia blocks editing from the browser's network address. Article
Creator then requests the same preview text and the draft target title with the official
[Action API parse module][parse-api] in preview mode. It does not bypass editing
permissions. Missing or invalid API preview content remains an error. The
capture records the actual network outcomes in its ledger.

## Captured states

Desktop views use 1024 × 768 CSS pixels; mobile views use 390 × 844. All use device
pixel ratio 1. The desktop width preserves the collection's original comparison
profile; the mobile width shows the creator's complete name-use controls.

The maintained collection contains exactly three images of the Facts view, one
for each interface language. Filenames use continuous indices in language order
and canonical language tags. Capture profile 01 selects the desktop Facts view;
other captured states remain covered by offline browser tests.

| State                                                                   | English                   | Simplified Chinese             | Traditional Chinese            |
| ----------------------------------------------------------------------- | ------------------------- | ------------------------------ | ------------------------------ |
| Facts input with supplied metadata and actual category/template checks. | [01](screenshot01.en.png) | [02](screenshot02.zh-Hans.png) | [03](screenshot03.zh-Hant.png) |

[The capture ledger](live-captures.json) records the browser version, userscript
checksum, actual host configuration, source revision, language, dimensions,
network failures, image checksums, and image state. A capture is a read-only review: it never
clicks a wiki save or move action. A request guard aborts mutating API operations
and native save POSTs; native preview requests remain permitted. The script
asserts that no control attempted a live write.

The older deterministic browser screenshot scenario remains an offline UI test
fixture. Its optional PNGs go to Playwright's temporary test output instead of
this collection. Its simulated page responses are not the source of the
maintained documentation images.

## Retained licensed fixture

The repository retains the older
[BanG Dream! 少女樂團派對, revision 94028176][retained-revision] fixture by
[Chinese Wikipedia contributors][retained-history], under CC BY-SA 4.0. Its
unchanged source is `tests/vg-stub-creator/fixtures/bang-dream.wikitext`, with
provenance in `bang-dream.source.json`. Those files do not supply the current
screenshots; their attribution remains attached to the retained fixture.

[source-revision]: https://zh.wikipedia.org/w/index.php?title=%E4%BF%A1%E8%B3%B4%E9%88%B4%E9%9F%B3_%EF%BD%9E%E8%95%AD%E9%82%A6%E4%B9%8B%E5%A4%A2%EF%BD%9E&oldid=94743103
[source-history]: https://zh.wikipedia.org/w/index.php?title=%E4%BF%A1%E8%B3%B4%E9%88%B4%E9%9F%B3_%EF%BD%9E%E8%95%AD%E9%82%A6%E4%B9%8B%E5%A4%A2%EF%BD%9E&action=history
[cc-by-sa]: https://creativecommons.org/licenses/by-sa/4.0/
[steam-source]: https://store.steampowered.com/app/2900640/?l=schinese
[parse-api]: https://www.mediawiki.org/wiki/API:Parsing_wikitext
[retained-revision]: https://zh.wikipedia.org/w/index.php?title=BanG%20Dream!%20%E5%B0%91%E5%A5%B3%E6%A8%82%E5%9C%98%E6%B4%BE%E5%B0%8D&oldid=94028176
[retained-history]: https://zh.wikipedia.org/w/index.php?title=BanG%20Dream!%20%E5%B0%91%E5%A5%B3%E6%A8%82%E5%9C%98%E6%B4%BE%E5%B0%8D&action=history
