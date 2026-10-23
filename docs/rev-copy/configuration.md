# Usage and configuration

Last reviewed: 2026-10-21.

<!-- toc:start -->

## Contents

- [Quick start](#quick-start)
- [Options](#options)
- [Home wiki prefixes](#home-wiki-prefixes)
- [Pages and skins](#pages-and-skins)
- [Time and language](#time-and-language)
- [Section links](#section-links)
- [Advanced copy](#advanced-copy)
- [Troubleshooting](#troubleshooting)

<!-- toc:end -->

## Quick start

1. Install Revision Copy using one of the methods in the [tool guide](README.md#install-and-open).
2. Open a Wikimedia page, an old revision, or a comparison view.
3. Find the toolbar immediately above the page content and choose **Copy**.
4. Paste the resulting page and revision wikitext into your wiki editor. Choose
   **Tools** to prepare translation or copy-and-paste attribution.

The actions share one bracketed group, like Wikipedia's section-edit links:
`[ copy | tools ]`. **Copy** copies the page link and available revision link
together; when no revision is available, it copies only the page link. The links
appear as literal wikitext in a code font, while the actions use the normal skin
font. Successful copying shows a brief confirmation at the top right. Revision Copy
reads page information and copies text; it never submits wiki edits.

To copy one link manually, click its wikitext, or focus it and press Enter or
Space. This selects the entire page or revision wikitext for your browser's
native copy command, such as Ctrl+C or Command+C. Selecting the revision excludes
the surrounding parentheses.

With the default Chinese home wiki, **Copy** produces text such as:

```wikitext
[[:Intel 1103]] ([[:Special:PermaLink/123456|2026年1月2日 03:04:05]])
```

On English Wikipedia, the same format includes the foreign wiki prefix:

```wikitext
[[:w:en:Intel 1103]] ([[:w:en:Special:PermaLink/123456|January 2, 2026 at 03:04:05]])
```

These revision IDs are illustrative. Actual IDs and times come from the displayed
page. See [section links](#section-links) and [advanced copy](#advanced-copy) for
their controls and keyboard actions.

## Options

Set configuration before Revision Copy loads. For a personal wiki installation, put this
object before the gadget code in `common.js`. A userscript can read configuration
already present in the page context.

```js
window.revCopyConfig = {
  homeWiki: 'w:zh',
  displayWikitext: true,
};
```

| Option            | Default  | Meaning                                                                                                 |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `homeWiki`        | `'w:zh'` | Wiki where copied links will be pasted; links to that wiki omit the interwiki prefix.                   |
| `displayWikitext` | `true`   | Display literal wikitext in the row's code font; set `false` to show ordinary page and revision labels. |

Reload after changing configuration. By default, the full `[[:…]]` strings are
visible in an inline code font, including the revision expression's surrounding
parentheses. Copy action links keep the normal skin font.
Setting `displayWikitext: false` shows ordinary clickable
page and revision links. Copy actions always produce wikitext regardless of the
display preference.

## Home wiki prefixes

| Project           | Home wiki example      |
| ----------------- | ---------------------- |
| Wikipedia         | `w:zh`, `w:en`, `w:ja` |
| Wiktionary        | `wikt:en`              |
| Wikibooks         | `b:en`                 |
| Wikinews          | `n:en`                 |
| Wikiquote         | `q:en`                 |
| Wikisource        | `s:en`                 |
| Wikiversity       | `v:en`                 |
| Wikivoyage        | `voy:en`               |
| Wikimedia Commons | `c`                    |
| Meta-Wiki         | `m`                    |
| Wikispecies       | `species`              |
| Wikidata          | `d`                    |
| MediaWiki.org     | `mw`                   |

Use the project's actual language code. Trailing colons are optional in configuration.

With `homeWiki: 'w:zh'`, a Chinese Wikipedia page link is `[[:Intel 1103]]`; English
and Japanese Wikipedia links are `[[:w:en:Intel 1103]]` and
`[[:w:ja:インテル 1103]]`. A Commons category link is
`[[:c:Category:Intel 1103]]`. The permanent link uses the same foreign prefix:
`[[:c:Special:PermaLink/339992055|February 21, 2019 at 13:44:28]]`.
The Intel 1103 Wikidata item uses `[[:d:Q16997075]]`; its revision target also
starts with `d:`, for example
`[[:d:Special:PermaLink/2545543753|September 14, 2026 at 10:23:46]]`.

## Pages and skins

Revision Copy runs on supported Wikimedia hosts while viewing a page with a title.
All namespaces are supported, including category, file, user, talk, and Special
pages. Missing pages can also show the page link. Editing and history actions are
excluded.

A displayed revision ID enables the permanent link. Diff views with known compared
revision IDs use a comparison link, including `Special:Diff`. When neither link is
available, or a revision lookup fails, the row contains page wikitext and
`[ copy | tools ]`. Revision text is omitted, and **Copy** copies only the page link.
When a revision lookup is needed, the entire row appears together after it
finishes. The page-title and section controls become available at the same time.

On a diff view, the revision wikitext uses a comparison target such as
`[[:Special:Diff/94203875/94203973|2026年9月5日 12:00:26]]`. Foreign wiki comparisons
use the same site prefix as the page link, for example
`[[:w:en:Special:Diff/1327569959/1342192065|March 7, 2026 at 16:05:03]]`.

## Time and language

The displayed revision's timestamp comes from the source site's API, even when
viewing an old revision. Diff labels use the newer compared revision's timestamp.
Pending and successful date lookups for the same wiki and revision are reused
in this tab, with up to 200 entries held in memory. A reload clears this cache;
failed lookups are not cached.
Dates use the site's content language, UTC, and second resolution without a
timezone suffix. Interface labels support English, Simplified Chinese,
Traditional Chinese, Japanese, and Russian. They follow the user's interface language or
Chinese variant and fall back to English for unsupported interface languages.

## Section links

The page title and section headings have a `#` control hanging to the left without
moving or indenting the heading text. Hover over the heading or focus its `#`
control to reveal it. A click or Enter/Space copies the section link immediately.
The page-title control copies a lead-section link ending in `#top`, for example
`[[:w:en:Intel 1103#top]]`. Other headings use their actual section ID, for example
`[[:w:en:Intel 1103#Development]]`. The section ID comes from the rendered heading or a
stable generated-section container, as on Commons categories, rather than guessing
it from the heading text.

Hover or keep focus for about 600 ms, or press ArrowDown with `#` focused, to open the section's
copy popup. Its choices are **Copy link**, **Copy permalink**, **Copy both**, and
**Advanced copy**.
The first three copy the page-section link, the permanent or diff link with the
same section fragment, or both. A revision example is
`[[:w:en:Special:PermaLink/1342192065#Development|March 7, 2026 at 16:05:03]]`.
If there is no available revision link, the popup offers **Copy link** and
**Advanced copy**. Press Escape to close the popup.

Choose **Advanced copy** in the popup to open the attribution dialog with that
heading's section reference in **From**, such as `#Development` or `#top` for the
lead. This refers to the displayed page and revision. **To** starts with empty
prefix and page boxes: Translate mode shows `zh` as the prefix placeholder and
uses the current Chinese page or its Chinese language link; Copy & paste mode
uses the current wiki. Enter another destination as needed. **Partial** starts unchecked: select it only when
reusing part of the chosen page or section. Generated source links retain the
section. Reopening the same section preserves your edits;
using the main row's **Tools** action returns to the page-level defaults.

## Advanced copy

The main row's **Tools** action opens an attribution form. **Translate** offers a
destination edit summary or source talk-page notice. **Copy & paste** offers
three choices: destination edit summary (目標頁編輯摘要), cut-page edit summary
(剪下頁編輯摘要), and source talk-page notice (來源頁討論頁告知).
Select whether reuse is partial or modified, review the wikitext, then copy it.
The cut-page summary identifies where the content was pasted, including a
destination revision link when available. It never edits pages or posts notices.

Each **From** and **To** group has two boxes on one line: a wiki prefix and
a page name or URL, without inner labels, optional markers, or help buttons.
Both prefix boxes start empty. In **Translate** mode, **To** shows `zh` as its
placeholder; **From** shows the current wiki's prefix, except on Chinese
Wikipedia where it shows `en`. In **Copy & paste** mode, both placeholders use
the current wiki's prefix. A blank prefix uses its displayed placeholder wiki.
Switching modes updates the defaults without replacing your explicit edits.
These defaults follow the wiki, independently of interface language.
The page placeholders update to the resolved titles in their own languages;
they do not fill or replace your typed text. A missing language link leaves a
generic placeholder and requires an explicit page name. For example, a blank
prefix showing `en` resolves the English page title; entering `ja` or `ru`
resolves the corresponding Japanese or Russian title. This applies to both groups.

Enter `ja` or `w:ja` beside a Japanese page name, or `c`
beside a Commons title such as `Category:Birds`. Keep namespaces and `#section`
fragments in the page box. A language prefix with an empty page box finds the
linked page in that language. Selecting the current wiki with an empty page box
preserves the displayed page and revision. When both boxes are empty, the
placeholder wiki determines whether to use that page or a linked foreign page.
A complete Wikimedia URL in the page box supplies its own wiki and
revision, taking precedence over the prefix. Combined references such as
`ja:Page title` also work in the page box when the prefix is empty.

The readonly wikitext box is always visible. Opening the dialog starts a lookup;
pasting a reference or changing the mode, purpose, or checkboxes updates the
result automatically. Typing clears the old result and waits until you press
Enter or leave the edited field before looking up the new references. A progress
bar appears inside the wikitext box while a lookup is in progress.
**Copy wikitext** remains unavailable until a result is ready; copying always
requires your action. After a failed lookup, press Enter or leave the field to retry.

Fetched page and language-link data are reused within this browser tab, so changing
Partial, With modifications, mode, or purpose does not repeat successful lookups
for the same references. Section-fragment changes also reuse that page data.
A title's latest revision is the one first fetched in the tab; reload to refresh
it. Different titles or revision IDs trigger new lookups. The memory-only cache
holds up to 200 responses and discards failed lookups so retries can fetch again.

| Input                                                                                | Resolution                                                                                                                |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Empty                                                                                | The placeholder wiki's linked page, or the displayed revision when it matches the current wiki.                           |
| `ja:FIRE BIRD (Roseliaの曲)`                                                         | Latest revision of that Japanese Wikipedia page.                                                                          |
| `w:ja:FIRE BIRD (Roseliaの曲)`                                                       | Explicit Wikipedia project prefix.                                                                                        |
| `https://ja.wikipedia.org/w/index.php?title=FIRE_BIRD_(Roseliaの曲)&oldid=110930823` | That exact revision, with its actual API timestamp.                                                                       |
| A page or permanent-link URL with `#section`                                         | Keeps the decoded fragment on page and revision links.                                                                    |
| `ja` or `ja:`                                                                        | The other endpoint's Japanese language link; both endpoints being language-only uses the displayed page as the reference. |
| `:ja`                                                                                | The literal page named `ja` on the displayed wiki.                                                                        |
| A plain page title                                                                   | A title on the displayed wiki.                                                                                            |

An edit summary permits a not-yet-created destination title. Source attribution
always requires a real source revision; a talk notice also requires a real
destination revision. Missing pages, language links, unavailable revisions, and
API failures are reported without producing a fabricated result. Explicit page
names without revision IDs use the latest revision; select the current wiki and
leave its page field blank to retain the displayed old revision. A bare language code such as `ja` is shorthand for
`ja:`; add a leading colon to use that code as a local page title instead.

Destination summaries follow the destination wiki's language. Cut-page summaries
and source talk notices follow the source wiki's language, falling back to English
when needed. Chinese follows the
user's interface variant. Revision timestamps use the output language and UTC,
to the second, without a timezone suffix. Links include actual revision IDs and
are qualified relative to where the text will be pasted, independent of `homeWiki`.
Generated edit summaries omit the final sentence period in every output language.
Talk-page notices retain sentence punctuation and the signature.

For example, with illustrative revision metadata, a Traditional Chinese summary
can be:

```wikitext
翻譯自[[:w:ja:FIRE BIRD (Roseliaの曲)]]（[[:w:ja:Special:PermaLink/110930823|2026年9月7日 10:07:23]]版）
```

For the same example, with destination revision `88591765`, the Japanese source
talk-page notice is:

```wikitext
== 中国語版ウィキペディアへの翻訳 ==

[[:FIRE BIRD (Roseliaの曲)]]の[[:Special:PermaLink/110930823|2026年9月7日 10:07:23]]版を[[:w:zh:Special:PermaLink/88591765|中国語版ウィキペディア]]に翻訳しました。 --~~~~
```

Talk notices link directly to the destination revision with the wiki's name as
the label. English notices use version-first wording and include the article in
destination names, such as **the Chinese Wikipedia**. Spanish, German, and
Portuguese labels include their destination articles, and Russian labels use
the accusative case. Standalone project names retain their normal form.

Attribution text supports English, Simplified and Traditional Chinese, Japanese,
Russian, Korean, French, German, Spanish, Portuguese, Italian, and Arabic.

The attribution model follows Japanese Wikipedia's
[edit-summary guidance](https://ja.wikipedia.org/wiki/Wikipedia:常に要約欄に記入する)
and [translation guideline](https://ja.wikipedia.org/wiki/Wikipedia:翻訳のガイドライン):
identify the source page and revision, retain a source section when known, and
state partial reuse or modifications. The notice layout is also informed by the
[FIRE BIRD talk-page example](<https://ja.wikipedia.org/wiki/ノート:FIRE_BIRD_(Roseliaの曲)>).
The form handles one source/destination pair at a time; repeat for multiple sources.

## Troubleshooting

If the row is absent, confirm that the site is supported and the page is in view
mode. Reload after installation or configuration changes. A page-only row is
expected when there is no available revision link. After a network failure, reload
the page to try the revision lookup again. If copying fails, allow clipboard access for the site or select and copy
the displayed wikitext manually.

To remove Revision Copy, uninstall the userscript or remove its code from `common.js`,
then reload the page. A console installation lasts only for the current page visit.
