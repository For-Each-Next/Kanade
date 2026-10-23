# Architecture

Last reviewed: 2026-10-21.

<!-- toc:start -->

## Contents

- [Source ownership](#source-ownership)
- [Page and revision identity](#page-and-revision-identity)
- [DOM and lifecycle](#dom-and-lifecycle)
- [Build and tests](#build-and-tests)

<!-- toc:end -->

## Source ownership

| Directory                              | Responsibility                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/rev-copy/app/`                    | MediaWiki-ready composition, startup, consumer contracts, and orchestration.            |
| `src/rev-copy/domain/`                 | Site identity, home-wiki prefixes, timestamp formatting, and wikitext generation.       |
| `src/rev-copy/platform/mediawiki/`     | Reading the displayed-page context and requesting revision metadata.                    |
| `src/rev-copy/platform/browser/`       | Clipboard writing and skin-specific insertion boundaries.                               |
| `src/rev-copy/features/revision-row/`  | Scoped inline-row DOM, copy actions, and styles.                                        |
| `src/rev-copy/features/section-links/` | Heading controls, delayed section copy popup, keyboard behavior, and cleanup.           |
| `src/rev-copy/features/advanced-copy/` | Lazy Codex dialog, attribution form state, generation and copy feedback.                |
| `src/rev-copy/i18n/`                   | Aligned English, Chinese variant, Japanese, and Russian catalogs plus locale selection. |
| `src/rev-copy/types/`                  | Host and asset declarations.                                                            |
| `src/rev-copy/index.ts`                | Pure public exports for consumers and tests.                                            |

The browser bundle includes only project source. MediaWiki supplies runtime modules;
development dependencies are declared in `package.json` and pinned in `package-lock.json`.

Advanced copy parses page references in `src/rev-copy/domain/page-reference.ts`, resolves
revision metadata and language links in `src/rev-copy/platform/mediawiki/attribution.ts`,
and formats deterministic output in `src/rev-copy/domain/attribution.ts` with independent
generator catalogs in `src/rev-copy/domain/attribution-messages.ts`. Source and destination identity
remain separate from the configured home wiki: generated links are relative to the
wiki receiving the summary or notice. `src/rev-copy/index.ts` exports pure rules only.

`domain/wiki-site.ts` owns the project host and alias definitions used by both
site identification and page-reference parsing. `platform/mediawiki/response.ts`
owns exact UTC timestamp validation; object guards come from
`src/library/data-validation/`. The revision and
attribution adapters retain their distinct query, cache, and acceptance rules.
Interface locale selection uses `src/library/i18n/` with Revision Copy's existing
Chinese-variant handling. These extractions add no storage or dependencies.

Source and destination each use a Codex fieldset with adjacent wiki-prefix and
local-page inputs. Only the group label is visible; each textbox retains a
translated accessible name without help buttons or optional markers. The
prefix inputs start empty, with the effective wiki shown as a placeholder.
In Translate mode, the destination placeholder is `zh`. The source placeholder is the current wiki,
except that Chinese Wikipedia uses `en`, so English and Chinese Wikipedia
both open with English-to-Chinese attribution. Section contexts use the current
wiki's prefix placeholder and exact fragment as their source. In Copy & paste
mode, both prefix placeholders use the current wiki. Switching modes updates
these defaults and resolved titles without replacing explicit prefix or page
edits. Defaults follow wiki identity, independently of interface language.

The feature retains all four draft values in the dialog
session and combines each pair through the pure reference boundary before
resolution. Prefixes accept supported Wikimedia project/language identities;
namespaces and fragments stay in the page value. Full Wikimedia URLs retain
their own site and revision. An empty page or fragment-only value with the
current wiki's effective prefix preserves the displayed revision. A blank prefix
uses its placeholder wiki; a blank page then resolves that wiki's linked title.
Prefix-only language-link lookup and combined page references remain available.
Both inputs share completion, IME, stale-result, and retry behavior. Opening
another section resets both pairs; reopening the same context retains them.
Resolved source and destination titles return with the generated wikitext and
become the page placeholders. They use the selected page's own language without
changing draft values or making another request. Input changes clear outdated
placeholders immediately; unresolved foreign pages show a translated generic
placeholder, while the current wiki can show the displayed page title. In
particular, a blank source prefix showing `en` on Chinese Wikipedia resolves an
English title and never substitutes the current Chinese title. Explicit codes
such as `ja` and `ru` follow the same paired-input rule. The
change adds no storage or network service.

All twelve attribution catalogs omit final periods from destination and cut-page
edit summaries, including partial and modified variants. Talk notices keep
sentence punctuation and signatures. English notices identify the dated version
first and use **the** before a Wikipedia edition; Spanish uses **la**, German
**die**, and Portuguese **a**, while Russian retains destination-case forms.
Articles apply to contextual Wikipedia labels, leaving standalone names and
other Wikimedia project brands intact.

AI assistance covered these input and wording changes, localized labels,
documentation, and regression updates, including the simplified inputs,
Chinese-target placeholders, shared code extraction, and resolved-title placeholders.
The dialog keeps each endpoint's prefix, page, and resolved title together; the
inline row exposes only completed revision links and its two required actions,
removing unused loading/error states on the detached element. Offline unit and browser
checks cover paired-input composition, defaults on English and Chinese wikis,
revision and namespace preservation, blank prefix fallbacks, stale results and placeholders,
keyboard order, all five interface languages at the three supported widths,
and punctuation across the twelve output languages. `npm run verify` passed on
2026-10-21 after the input simplification and default changes. All five affected
live dialog screenshots were regenerated and inspected with their source
revisions and capture provenance retained. Independent human and screen-reader
review remain release checks under the shared UI policy.

Composition injects attribution resolution, clipboard writes, host-runtime loading,
and success feedback into the feature. Its `CodexRuntime` consumer interface lives
in `app/contracts/advanced-copy.ts`. The concrete
ResourceLoader/Vue/Codex adapter is `platform/mediawiki/codex.ts`; the feature owns
form state and component behavior. Shared host loading mechanics and Vue contracts
come from `src/library/mediawiki-runtime/`. Revision Copy retains its local Codex
toast with MediaWiki fallback. The [shared dependency matrix](../architecture.md#dependency-direction)
applies without a Revision Copy exemption.

## Page and revision identity

The displayed revision is authoritative. When a revision ID is available, read
`wgRevisionId`, not the latest revision ID, and request its timestamp from the local
wiki's [Action API][revision-api] using `revids` and `rvprop=ids|timestamp`.
Retain the complete page title including namespace. Category,
file, user, discussion, Special, and missing pages can show a page link.

The revision adapter shares pending requests and validated timestamps within the
current tab. Its memory-only cache retains up to 200 entries, keyed by wiki host,
API script path, and exact revision ID. Repeated content mounts and comparisons
against the same newer revision reuse that date; different revision IDs or wikis
stay separate. Invalid responses and failures are removed so a later lookup can
retry. This avoids repeated requests without changing the first lookup's network
latency. No localized date text is parsed and no timestamp is inferred from page
rendering or cache times.

Diff views use the older and newer revision IDs from MediaWiki's comparison context.
Their revision target is `Special:Diff/old/new`, and its label is the newer revision's
timestamp. Preserve this comparison rather than substituting a single-version
permanent link.

When there is no available permanent or comparison link, render the page
wikitext with the `[ copy | tools ]` action group. A revision API failure returns
to this page-only state. Omit unavailable revision text instead of creating
placeholder labels or a retry control. The Copy action then copies only the page link.

Identify supported Wikimedia hosts and qualify the wikitext target relative to
`window.revCopyConfig.homeWiki`, which defaults to `w:zh`. Mobile host variants
resolve to the same wiki identity. Home-wiki links have no interwiki prefix;
foreign page and revision links share the same prefix.

Revision labels use the site's content language and UTC second resolution. Interface
catalog selection follows the user's language or Chinese variant. These decisions
are independent, so a Japanese site's time remains Japanese even with an English
interface.

## DOM and lifecycle

Wait for MediaWiki and required ResourceLoader modules before reading host globals.
Keep the startup owner at `Symbol.for('kanade.rev-copy.startup')` so repeated
console, wiki, and userscript loading cannot create duplicate rows. Remount through the content hook when needed and
discard outdated revision requests.

Build the row off the document while its revision timestamp is pending, then
insert the complete page text, revision text, and actions together. A failed lookup
inserts the page-only row; a page without a revision needs no lookup. Mount the
section controls with the row so copying and feedback share the same live owner.
Repeated hooks for the same page and content container retain the pending request.
Before mounting, recheck the page identity, content container, and request
generation; a replaced page cannot receive an obsolete row, even before its content
hook runs. Offline browser tests cover deferred insertion, fallback, duplicate
hooks, content replacement, and clipboard completion.

The preferred insertion target is `.vector-body-before-content`. Other skins use
their equivalent boundary immediately above parsed page content. Mount a distinct
row with zero margin, preserving native headings, skin links, and indicators. The visible
page and revision text defaults to the complete generated wikitext inside inline
`<code>` elements with a monospace font, including its brackets and interwiki
prefixes. Their contents remain text nodes. The surrounding revision parentheses
share the same monospace styling. Copy action links keep the normal skin
font. Clicking a page or revision code element, or pressing Enter or Space while
it is focused, selects its full text for the browser's native copy command.
Revision selection excludes the surrounding parentheses.
`displayWikitext: false`
substitutes ordinary navigation links pointing to the source page and revision.
Titles and translations become text nodes. Row actions share one bracketed group,
`[ copy | tools ]`, with a subtle, nonclickable separator like Wikipedia's
section-edit links. Copy writes the page and available revision wikitext together;
Tools opens the attribution dialog. Each action uses plain label text,
`role="button"`, and keyboard activation, while navigation anchors point to their
source page or revision.

Clipboard writing happens from a user action. The local notification adapter
shows a top-right Codex toast after the write resolves, lazily loading the host
Vue/Codex modules if necessary. The toast uses a scoped mount, retains keyboard
focus, and falls back to a MediaWiki notification when Codex is unavailable.
Clipboard failures retain useful error feedback.

Advanced copy opens from the inline Tools action or a section's copy popup;
Revision Copy no longer registers a floating bottom-right shortcut. Both entries
use the page owner's existing dialog and stale-context checks. The native row
remains available if the host's Vue or Codex modules cannot load, and loading
Revision Copy alone does not request those modules until an action needs them.
Offline lifecycle and browser scenarios cover remounts, duplicate starts, dialog
activation, keyboard focus, and absence of the floating shortcut.

The Tools action also loads MediaWiki's Vue and `@wikimedia/codex` modules on
demand. The native inline row can render without those modules. The modal uses
Codex controls and scoped layout styles, with an always-visible readonly output
field. Opening the dialog, completing a paste, or changing a mode, purpose, or
checkbox starts generation. Typed input clears old output and waits for Enter
or blur of the changed field. Paste handling waits for the new field value before
starting its lookup.

The dialog reuses a pending or successful lookup for the same inputs and choices.
Enter or field blur retries a failed lookup. Input changes, closing, and disposal
invalidate pending results and feedback; remounting disposes the old dialog.
An accessible, indeterminate Codex progress bar appears inside the wikitext box's
border during lookup, and the explicit Copy action remains disabled until output
is available. Remote lookups use only supported Wikimedia API hosts and omit
credentials. Lookup errors never produce invented revision attribution.

The resolver keeps up to 200 validated API responses in memory for the current
browser tab and shares identical requests while they are pending. Keys include
the wiki API endpoint and query identity, including revision IDs and language-link
source revisions. Formatting choices and section fragments reuse the fetched data.
Latest-by-title lookups remain snapshots until the tab reloads or the entry is
evicted; a new displayed revision has a distinct key. Failed requests and responses
that fail validation are discarded so the same input can be retried. Nothing is
written to persistent browser storage.

The page-title and section controls hang outside the left edge of the heading
text without changing its original position or indentation. The page title uses
`#top` for the lead section; section headings use their rendered ID. The `#`
action copies the page-section link immediately; a roughly 600 ms dwell or
ArrowDown opens a popup with **Copy link**, **Copy permalink**, **Copy both**, and
**Advanced copy**. The popup
uses plain action labels in the skin font without square brackets. Its final action
opens the existing attribution dialog with a fragment-only source reference,
using `#top` for the lead or the actual section ID for another heading. It preserves
the displayed revision and leaves Partial unchecked. The Partial option describes
reusing part of the selected source, independently of whether it is a page or section.
Track the dialog's page or section context so reopening the same context preserves
edits, while changing context resets the starting references and options.
Omit unavailable revision
choices while retaining the page link and advanced action.
Keep popup timers, heading listeners, and mounts scoped to the current content
lifecycle so replaced content cannot retain stale controls or links.

## Build and tests

The shared root `scripts/build.mjs` bundles `src/rev-copy/app/browser.ts` with
esbuild and imports CSS as text. `scripts/artifacts.mjs` generates the compact
`dist/rev_copy.min.js` and readable `dist/rev_copy.user.js` using the project
version and `@license CC0-1.0` metadata. The readable script includes the complete
CC0 dedication; the compact script omits that legal body. Root `dist/` retains
the complete dedication in `LICENSE.txt` alongside the integrity manifest,
following the shared [distribution policy](../development.md#verification-and-delivery).
The userscript adapter crosses into the page
context to access MediaWiki and optional page configuration.

Node tests cover deterministic formatting and DOM behavior offline.
`scripts/rev-copy/test-ui.mjs` checks rendered placement and copying with pinned
wiki metadata in local fixtures. Documentation screenshots come from actual
live pages with the built script injected into the browser. Neither process
submits wiki edits. See [screenshots](images/README.md) for visual provenance and
[development.md](../development.md) for shared commands and delivery rules.

[revision-api]: https://www.mediawiki.org/wiki/API:Revisions
