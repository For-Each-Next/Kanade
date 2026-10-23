# Screenshots

Last reviewed: 2026-10-21.

The maintained images are browser captures of the live Chinese Wikipedia
interface with Article Assessor loaded from its built script. English, Simplified
Chinese, and Traditional Chinese interface languages are captured. Article and
talk-page text remain in their source language.

## Capture

Run from the project root after building:

```sh
npm run build
node scripts/wpvg-assessor/capture-live.mjs --titles=Category:未评级电子游戏条目
```

The script uses Chromium, actual Wikipedia pages, native MediaWiki, Vue and
Codex, and live read-only API responses. It does not reconstruct the host or
substitute API results. The initial viewport is 1366 × 768 CSS pixels at DPR 1;
its height expands to expose the dialog's controls and review panels. Capture
times, exact dimensions, category page revisions, and the injected script and
image hashes are recorded in [live-captures.json](live-captures.json).
The native article preview loads before its screenshot. No assessment class is
chosen in the category workflow, and no Submit or Archive action is activated.
The capture asserts that no wiki write request occurs.

The maintained collection contains exactly three images of the category review
view, one for each interface language. Each shows the live article preview and
class actions; the capture does not submit an assessment. Additional assessment
and archive states remain covered by offline browser tests.

On macOS, Chromium uses the enabled system HTTPS proxy. Set
`KANADE_BROWSER_PROXY` to choose another route. TLS verification remains enabled.
Normal offline verification does not replace these images.

For a selective live retry, choose the interface languages and page groups:

```sh
node scripts/wpvg-assessor/capture-live.mjs --locales=zh-Hans --titles=Category:未评级电子游戏条目
```

Other captured pages retain their original timestamps and build hashes. The
ledger's top-level bundle hash identifies the latest run; each page and image
entry records its actual capture build. A successful retry removes only that
page and language's failure entry.

## Image inventory

Filenames use continuous indices in language order and canonical language tags.
The naming cleanup preserves the original images and capture provenance.

| State                                                                        | English                   | Simplified Chinese             | Traditional Chinese            |
| ---------------------------------------------------------------------------- | ------------------------- | ------------------------------ | ------------------------------ |
| First unassessed-category article with its actual preview and class actions. | [01](screenshot01.en.png) | [02](screenshot02.zh-Hans.png) | [03](screenshot03.zh-Hant.png) |

Inspect the three retained images at their actual size for labels, visible
article content, reachable actions, clipping, and completed loading states.

## Live sources and attribution

The retained category view uses
[Category:未评级电子游戏条目](https://zh.wikipedia.org/wiki/Category:未评级电子游戏条目)
and its actual first member at capture time. Historical assessment captures used
[BanG Dream! 少女樂團派對](https://zh.wikipedia.org/wiki/BanG_Dream!_少女樂團派對),
article revision **94028176**, and its current [talk page](https://zh.wikipedia.org/wiki/Talk:BanG_Dream!_少女樂團派對).
The archive capture used
[WikiProject:电子游戏/新进条目](https://zh.wikipedia.org/wiki/WikiProject:电子游戏/新进条目)
and shows the actual empty archive preview, with no complete months or proposed
annual destinations at capture time. The ledger identifies
the captured source revisions; category membership and archive proposals can
change on later runs.

Text belongs to [Chinese Wikipedia contributors](https://zh.wikipedia.org/wiki/Special:Contributions)
under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Each page's
history provides contributor attribution. Article images retain the terms on
their linked file pages; the project's CC0 dedication covers its own interface.
See [third-party notices](../../../THIRD-PARTY-NOTICES.md).

## Offline test ownership

The separate `tests/wpvg-assessor/ui/screenshots.spec.ts` scenarios and
`tests/wpvg-assessor/fixtures/` retain their pinned article, supplied talk-page
lead, and synthetic archive examples for offline regressions. They are not the
source of the maintained live documentation collection. Their fixture metadata
and attribution remain unchanged. Opt-in offline screenshots use
`testInfo.outputPath` in temporary test output, so they cannot overwrite this
live collection or its ledger.
