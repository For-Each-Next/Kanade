# Architecture

Last reviewed: 2026-11-09.

<!-- toc:start -->

## Contents

- [Scope](#scope)
- [Folder names and ownership](#folder-names-and-ownership)
- [Dependencies and startup](#dependencies-and-startup)
- [Assessment form presentation](#assessment-form-presentation)
- [Build and verification](#build-and-verification)

<!-- toc:end -->

## Scope

Article Assessor separates application workflows, pure rules, host integration,
and interface components. It uses ordinary functions, explicit TypeScript
interfaces, and relative imports. It builds and verifies through the shared Kanade root commands.

## Folder names and ownership

| Path                                     | Responsibility                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/wpvg-assessor/app/`                 | Startup, application workflows, and their consumer contracts.                            |
| `src/wpvg-assessor/domain/`              | Pure assessment, registration, title, and comparison rules.                              |
| `src/wpvg-assessor/platform/mediawiki/`  | ResourceLoader, page context, API adapters, and native notifications.                    |
| `src/wpvg-assessor/platform/browser/`    | Storage, locking, caching, and article-preview styles.                                   |
| `src/wpvg-assessor/features/assessment/` | Dialog lifecycle, controls, review, and presentation.                                    |
| `src/wpvg-assessor/features/archive/`    | New-page-list archive review, progress, and dialog lifecycle.                            |
| `src/wpvg-assessor/i18n/`                | Aligned English, Chinese variant, Japanese, and Russian catalogs.                        |
| `src/wpvg-assessor/types/`               | Ambient host and build declarations.                                                     |
| `tests/wpvg-assessor/`                   | Offline unit/service tests; browser fixtures and scenarios in `tests/wpvg-assessor/ui/`. |
| `scripts/`                               | Shared build/check entrypoints and tool-specific browser helpers.                        |
| `docs/wpvg-assessor/`                    | Technical and workflow reference; numbered images in `docs/wpvg-assessor/images/`.       |
| `dist/`                                  | Generated installation artifacts, excluded from Git.                                     |

Use lowercase kebab-case for folders and TypeScript, CSS, and template files.
Name modules for their capability, reserve `index.ts` for a deliberate public
boundary, use `*.test.ts` for unit/service tests and `*.spec.ts` for browser
scenarios. Keep each template-only Vue component beside its same-named
TypeScript behavior and scoped CSS. Add modules when a capability needs an
owner; keep domain rules out of generic utility folders. Installation artifact
names retain their existing underscores for compatibility.

## Dependencies and startup

`src/wpvg-assessor/app/browser.ts` starts `src/wpvg-assessor/app/main.ts`. The composition root creates
MediaWiki adapters, a scoped logger, a notification port, and dialog
workflows, then supplies them to the assessment and archive features.

`app/interface.ts` owns application/interface composition, while feature modules
own presentation and consume contracts. Startup uses
`Symbol.for('kanade.wpvg-assessor.startup')`; owned DOM names use
`kanade-wpvg-assessor-`. Component registration belongs to
`features/assessment/codex.ts`. Shared loading/Vue contracts come from
`src/library/mediawiki-runtime/`, and action notifications delegate to
`src/library/notifications/` with local messages and tags. The
[shared dependency matrix](../architecture.md#dependency-direction) applies to all
Assessor modules.

- `app/` coordinates loading, preparation, and reviewed saves. Its contracts
  own consumer requirements; workflows receive callbacks for external work.
  Background drafts and cached dialog loads use an injected session store.
  Category assessment coordinates a moving preload window of the current
  article and the next three articles. Its assessment-only loader reads the
  talk-page lead without registration-list or creation-time requests, and
  saves use the ordinary reviewed talk-save workflow.
  Queue mutations and submissions acquire an injected exclusive lock shared
  across tabs; the reviewed queue is rechecked after that lock is acquired.
  Batch preparation refreshes the registration list and composes one proposed
  list edit; submission retains unfinished drafts after partial failures.
  `domain/new-page-summary.ts` composes one English registration summary from
  pages actually added, keeping UTC creation dates on listed links and one script
  marker. Full summaries are retained through 255 UTF-8 bytes, including the
  marker and any custom text. Longer summaries prioritize article links in
  their original order, followed by counts of files, categories, templates,
  modules, drafts, and other pages. Counts reserve their space before article
  links are selected; omitted articles become a remaining-article count.
  Namespace classification uses the shared Chinese Wikipedia title policy,
  including localized aliases and article titles containing ordinary colons.
  An oversized single-page default also becomes a count. Stored full English
  and Chinese defaults and new compact defaults consolidate from their original
  page entries, preserving accurate counts across staged drafts.
  Distinct custom summaries remain intact, even when they leave insufficient
  space for the minimal generated counts within the budget. This deterministic
  formatting changes no source entries, stored drafts, or write preconditions;
  the prepared batch retains the exact summary passed to the save adapter.
  `archive-new-pages.ts` prepares immutable source and annual-destination reviews
  through the typed operations in `archive-contracts.ts`. Saving checks all page
  snapshots including revision IDs, writes archives in sequence, and removes source records only after
  every archive write is confirmed. Failures retain confirmed archive titles and
  require a fresh review; reloading avoids duplicate dated blocks.
- `domain/` owns assessment parsing, banner transformations, registration
  ordering, namespace rules, and text comparison. It has no runtime browser
  dependencies. `project-config.ts` holds the Chinese Wikipedia banner rules.
  `new-page-list-archive.ts` computes the cutoff for whole UTC calendar months,
  retaining the current and previous month in the list. It preserves daily records
  and namespace groups, converts safe Vgc calls into
  ordinary colon links, and merges dated blocks into annual archives under
  `== YYYY年 ==` and `=== M月 ===` sections, with months and days in descending order.
- `platform/mediawiki/` validates API responses, reads page context and
  language, and performs explicit revision- and timestamp-protected writes.
  Requests and decoders use formatversion 2 page arrays and main-slot content;
  obsolete keyed pages and star-key content are rejected before preparing edits.
  Category reads follow API continuation and resolve subject and talk titles
  for article and talk-page members. Article preview reads supply parsed HTML
  to a sandboxed frame in the batch interface.
  `archive-page-api.ts` validates readable source, revision IDs, and timestamps for
  archive reviews. Whole-list registration and existing archive writes require
  `baserevid` without `basetimestamp`, catching conflicts from the same account;
  missing archives use create-only writes.
- `platform/browser/` owns creation-time caching and the assessment session
  store. The latter serializes reviewed drafts, dates, and creation-time maps
  in `localStorage` per wiki/account, sharing the queue across tabs. Read
  snapshots stay in a separate per-tab session storage cache. Only the shared
  queue supplies staged drafts. Cache writes do not republish unchanged drafts.
  Legacy cached registration snapshots can omit their revision ID, while live
  whole-list writes validate a real reviewed ID before attempting an edit.
  Storage events notify mounted dialogs of queue changes;
  Web Locks serialize staging, unstaging, and submission across tabs.
  Disposable cache failures allow normal fetching; failed draft writes remain
  visible so the dialog can retain the user's work.
  The article-preview stylesheet adapter serializes the host's loaded inline
  CSS and same-origin HTTP(S) stylesheet links in their existing cascade
  order, retaining media attributes and excluding executable markup.
- `features/assessment/` presents controls and previews and owns mounted
  dialog lifecycle. Each dialog and comparison component keeps its markup,
  behavior, and styles in adjacent `.vue`, `.ts`, and `.css` files.
  One mount owner handles loading, assessment, category, and archive dialog
  setup and disposal, releasing its Vue app, host, and session even when setup
  or mounting fails.
  The category interface places the sandboxed article preview above Codex
  action-button groups and expandable proposed-source and summary details.
  The frame permits same-origin stylesheets and inline CSS while blocking
  scripts. MediaWiki content wrappers let host article styles and embedded
  TemplateStyles apply inside the frame.
  Each class action updates only the class, generates and captures the exact
  selected-class lead and summary, starts saving them with registration
  disabled, and immediately advances. The workflow owns background saves
  and failed-article returns independently of the mounted interface.
  Failed reviews stay in memory for reopening in the same tab until reload;
  they are presented after the category pages for explicit retry. Closing
  ignores late UI loads and releases the interface while saves finish.
- `features/archive/` presents the retained list and complete annual archive sources
  as read-only previews, with localized cutoff, progress, and recovery messages.
  On the exact new-page-list page, startup selects this dialog and its localized
  Archive tool portlet entry. Closing releases its mount and ignores stale loads.
  Pending archive writes keep the dialog open, including against Escape and the
  header close control, so progress and partial-save recovery remain visible.
- `src/library/logging/` owns host-independent structured logging. Catalog translation and
  locale fallback use `src/library/i18n/messages.ts`; notification contracts also
  belong to the shared library. `i18n/` supplies localized interface catalogs.
  Generated assessment, registration, and archive summaries use English
  independently of the interface locale. Assessment controls retain localized
  labels alongside English summary labels; source titles and unknown values
  keep their original wording.

Imports point toward pure rules and contracts. Domain and shared code do not
import startup, UI, or platform code. Platform code does not import product
UI or catalogs. Features receive workflows through injected contracts.

Page-tool entries use `mw.util.addPortletLink` and retain the skin-owned anchors and
markup, including keyboard activation and focus restoration. Codex applies to gadget
dialogs and forms. See [UI guidelines](../ui-guidelines.md) for the interface contract.

Namespace aliases and title operations use
`src/library/wiki-titles/wikipedia.ts`. The shared owner retains the recorded
English/Chinese Wikipedia siteinfo names, aliases, and immutable lookup maps;
assessment, archive title matching, and reviewed write decisions stay local.
Shared namespace regressions and Assessor's API/archive tests cover the
extraction without changing stored drafts, page targets, or write preconditions.

New-page-list date lookup, descending insertion, blank tails, and year insertion
use `src/library/new-page-list/sections.ts`, shared with Creator. Assessor keeps
its flexible date separator, subgroup and creation-time rules, review workflow,
and guarded writes. Archive parsing remains separate because it validates whole
records and preserves source offsets and physical line endings. Shared insertion
and tool registration tests retain these distinct parser policies.

Assessment banner syntax uses `src/library/wikitext/` for balanced templates,
parameters, separators, comments, and literal tags. Assessor keeps its five
literal-tag names (`nowiki`, `pre`, `source`, `syntaxhighlight`, and `math`)
and excludes wikilink contents from banner discovery. It requests unfinished
link ranges through `includeUnclosedLinks`; ordinary shared link queries still
return only balanced links. Banner selection, uninterrupted lead discovery,
and lossless shell rewriting remain local. Regression tests cover those policies,
complete reference-tag values, and idempotent updates; an old/new differential
check covered 88 source variants. AI assistance covered this consolidation.

Native page tools provide the assessment, category, and archive entrypoints.
The `wpvg-assessor=1` URL query opens the same page-specific interface after
host modules load and the normal wiki and namespace checks pass. It does not
submit an edit. The browser adapter consumes one unambiguous marker per page
owner and removes it with `history.replaceState`, retaining other query encodings,
the fragment, and host history state. Restricted history still permits the requested
launch. Reloading the cleaned URL does not reopen the interface. The existing dialog lifecycle and
focus fallback apply to this entrypoint. AI assistance covered this entrypoint
and its regression coverage.

`app/source-links-browser.ts` runs independently before MediaWiki readiness.
On the two supported PetScan hosts, it installs source-link decoration and ends
startup without loading MediaWiki, Vue, Codex, assessment workflows, or storage.
On Chinese Wikipedia it decorates the video-game new-page list and continues
ordinary host startup. `domain/source-links.ts` recognizes the supported list
routes and article or article-talk destinations using the shared Chinese Wikipedia
namespace policy. It excludes revisions, edits, missing pages, unsupported hosts,
and other namespaces while preserving unrelated query encodings and fragments.

`platform/browser/source-links.ts` owns one decoration lifecycle per document.
It updates links within result content, skips host navigation and forms on the
wiki list, and retains native click, target, and modified-click behavior. The
owner observes dynamic results and root replacement, catches activation before
an observer callback, suspends for the browser page cache, and releases its
listeners and observer when the page is discarded or leaves the supported route.
These launchers add no network requests, persistent storage, or wiki writes.
AI assistance covered this extraction from the supplied scripts and the offline
URL, dynamic-DOM, lifecycle, and launch-consumption regressions. Existing dialog
screenshots remain applicable because this integration changes navigation only.

Removing the duplicate bottom-right actions keeps page navigation in the host's
tools menu and removes Assessor's quick-access registration from startup.
Closing restores focus to the invoking portlet anchor. Dialog requests, category
sessions, reviews, writes, and storage retain their existing owners.
Verification for this change covers all three page-tool labels and opening
routes, keyboard activation and focus restoration, and the absence of Assessor
bottom-right actions, without submitting edits. AI assistance covered the
launcher removal and its documentation and browser regression updates.

`src/wpvg-assessor/index.ts` deliberately exposes deterministic assessment, registration,
and comparison operations without triggering browser startup.

## Assessment form presentation

The assessment form uses full-width sections so a long talk-page comparison does not squeeze class and project choices
into a narrow sidebar. Native [Codex Radio][codex-radio] controls make common
class and importance values visible without opening menus. Each group has its
own Field legend. Native inline radios and checkboxes sit in owned wrapping flex
containers, keeping neighboring options close without stretching them into
equal-width columns or changing component appearance.

The assessment dialog owns the selected preset and the retained custom-class
input separately. The final class row places the **Custom** radio and an always
visible short textbox side by side. Choosing **Custom** enables the textbox;
switching to a preset disables it without erasing its value. The textbox retains
its translated accessible name. Known aliases and localized labels still canonicalize
through the existing assessment rules, while typing keeps the unfinished draft
until blur. Recognizable manual source edits resynchronize the controls. Unknown
importance values retain a radio choice while they remain in the source.

The Stage switch is explicit for newly opened pages and restores enabled for an
existing staged draft. While enabled, the dialog coalesces edits into exact
reviewed snapshots and flushes them before close or batch preparation. A failed
flush preserves the form. Unstaging waits for an active synchronization before
removing the draft, so a late synchronization cannot recreate it.

**Submit (+N)** prepares a separate batch confirmation with page selection,
change comparisons, exact summaries, and combined selected registration. Queue
editing reuses the assessment form with a draft-only Apply action. Removing or
editing a row validates the original queue fingerprint and page identity under
the same exclusive lock, then invalidates registration for fresh preparation.
Selection has its own request generation; stale selections and queue responses
cannot replace newer reviews. Back preserves current form source and summaries.
Unchecked drafts retain their registration choice and position in the shared queue.

The staging workflow owns exact selected saves and recovery. It preserves other
queued pages, skips unchanged talk leads, and removes only confirmed selected
pages. A narrow API proxy paces actual edit requests, including conflict retries,
without delaying reads. It waits at least six seconds after the preceding request
finishes and publishes completed/total progress and wait status. The
progress block stays at the visible start of the native dialog scrollport while
the review backdrop covers the full content. Offline held-save tests check that
the bar, completed count, and current page remain visible after scrolling the
review at all three shared viewport sizes. The existing
wiki/account Web Lock spans submission; the new disposable
`kanade:wpvg-assessor:next-edit:v1:<encoded wiki/account identity>` timestamp carries
pacing between tabs. Invalid or implausibly distant timestamps use zero. Existing
reviewed queue and per-tab cache schemas remain intact. Timing-cache failures retain an in-memory timestamp and keep the exclusive lock
through the remaining interval before releasing it. They cannot turn an already
confirmed edit into a failed or uncertain save. Reviewed-queue storage failures
still stop before further wiki edits.

Collapse retains the same mounted owner and draft in a compact Codex Message
panel. Its fields, toggles, icons, select controls, and progress bars use default
Codex appearance. An owned grid inside the Message's content holds the title,
scrollable fields, and footer separately, so the focused Expand action and the
other footer controls stay visible while the form scrolls. The native Message
icon, padding, and component wrappers keep their default layout. Expand and the page-tool launcher restore the active view and
focus. The dialog remains mounted while collapsed, preserving draft and pending
batch progress; disposal releases synchronization timers, queue subscriptions,
media-query listeners, and the restore handler. Saving prevents dismissal and
editing. Row removal uses a neutral quiet icon for explicit draft removal. It discards
that queued source and summary without undo; removing the current page retains
its open form.

Generated assessment summaries describe changes in English: class and importance
use old→new values, and project, task-force, and maintenance selections use add or
remove wording. Existing unknown labels and the source-attribution marker are
preserved. New assessments retain the ordinary banner summary. Project banners
are placed after leading notices and history, while unrelated lead text and
subsequent discussion remain untouched.

AI assistance covered adaptation of the supplied scripts into typed owners,
queue confirmation/editing, compact presentation, request pacing, and regression
updates. Offline checks exercise exact drafts, selected registration, retained
unchecked work, identity/fingerprint validation, partial failures, cross-tab locks,
Vue state capture, stale preparation, close flushing, and the six-second request
interval. Browser checks cover keyboard actions and the three shared viewport
sizes. Manual screen-reader and supported-host contrast review remain release
checks under the shared UI policy.

## Build and verification

AI assistance covered the registration-summary byte limit, article priority,
namespace counts, and documentation. Focused regressions cover the 254/255/256
UTF-8-byte boundaries, CJK and supplementary characters, namespace aliases,
omitted articles, legacy defaults, and custom text. The staged workflow test
checks that only newly added pages are counted, all registered source entries
remain present, and the prepared summary reaches the save unchanged. The full
verification pipeline also exercises offline browser workflows and rebuilt
distributions; independent human review remains a release check.

The shared Node.js build compiles ES2024 browser JavaScript with esbuild,
injects validated template-only Vue markup and scoped CSS, and creates compact and readable outputs. A separate readable userscript includes a Chinese
Wikipedia match rule and waits for MediaWiki before starting.

Vue and Codex npm packages supply local types and offline browser fixtures.
The build rejects runtime dependencies from `node_modules`, preventing a
second Vue or Codex runtime from appearing in production artifacts.

Formatting and lint checks enforce the project's source conventions.
TypeScript and Vue templates are checked without emitting source. Unit and
service tests use Node's test runner. Playwright tests run the actual built
browser gadget
against a local mocked MediaWiki host.

Documentation images run the built gadget on actual Chinese Wikipedia pages,
using the site's MediaWiki, Vue, Codex, article content, and API responses.
They perform no wiki saves. The [capture inventory](images/README.md) owns the
commands, recorded viewport sizes, source revisions, attribution, and capture
ledger. Offline browser fixtures remain separate automated tests. See the shared
[UI guidelines](../ui-guidelines.md) and [documentation guide](../documentation.md)
for interface and screenshot review requirements.

[codex-radio]: https://doc.wikimedia.org/codex/latest/components/demos/radio.html
