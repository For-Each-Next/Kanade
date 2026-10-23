# Architecture

Last reviewed: 2026-10-21.

<!-- toc:start -->

## Contents

- [Scope](#scope)
- [Folder names and ownership](#folder-names-and-ownership)
- [Dependencies and startup](#dependencies-and-startup)
- [Article generation](#article-generation)
- [Review, writes, and recovery](#review-writes-and-recovery)
- [UI and build ownership](#ui-and-build-ownership)

<!-- toc:end -->

## Scope

Article Creator separates deterministic article rules from browser UI and live
wiki operations. Explicit TypeScript contracts let application workflows run
with fixture adapters in tests.

## Folder names and ownership

| Path                                            | Responsibility                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `src/vg-stub-creator/app/`                      | Startup, composition, and application use cases.                       |
| `src/vg-stub-creator/app/contracts/`            | Capabilities consumed by UI and workflows.                             |
| `src/vg-stub-creator/app/workflows/`            | Import, generation, reviewed saves, recovery.                          |
| `src/vg-stub-creator/domain/`                   | Pure article data and wikitext rules.                                  |
| `src/vg-stub-creator/platform/mediawiki/`       | API reads, writes, host editors, notifications.                        |
| `src/vg-stub-creator/platform/browser/`         | DOM integration and browser previews.                                  |
| `src/vg-stub-creator/platform/browser/storage/` | Drafts, history, caches, and checkpoints.                              |
| `src/vg-stub-creator/platform/network/`         | Cross-wiki metadata, Citoid, source acquisition.                       |
| `src/vg-stub-creator/features/creator/`         | Creator forms, dialog state, and presentation.                         |
| `src/vg-stub-creator/i18n/`                     | Product catalogs and language selection.                               |
| `src/vg-stub-creator/types/`                    | Host declarations and template context.                                |
| `tests/vg-stub-creator/`                        | Offline unit, service, and browser tests.                              |
| `scripts/`                                      | Shared build/check entrypoints and tool-specific browser/data helpers. |
| `dist/`                                         | Generated installation artifacts.                                      |

Use lowercase kebab-case names and name each module for the capability it owns.
Reserve `index.ts` for deliberate module boundaries. Keep related private
behavior with its owner rather than creating unrelated helper collections.

## Dependencies and startup

`src/vg-stub-creator/app/browser.ts` invokes `start` in `src/vg-stub-creator/app/main.ts`. The composition root
creates MediaWiki, browser, network, storage, logging, and notification adapters
and supplies them through `src/vg-stub-creator/app/contracts/application.ts`. The creator UI
presents the resulting state and invokes those supplied capabilities.

`app/interface.ts` composes the feature mount and application workflows. Feature
modules receive narrow contracts instead of importing concrete adapters. Startup
uses `Symbol.for('kanade.vg-stub-creator.startup')`; owned DOM names use
`kanade-vg-stub-creator-`. Notifications delegate to `src/library/notifications/`
with Creator's messages and tag. `src/library/mediawiki-runtime/` supplies common
Vue interfaces and retryable host-module loading; feature component lists and
dialog state remain local. The [shared dependency matrix](../architecture.md#dependency-direction)
defines the enforced import directions.

Catalog translation and locale fallback use `src/library/i18n/messages.ts`.
Creator retains its local catalogs and host language selection; generated edit
summaries remain English independently of the interface locale.

`src/library/mediawiki-edit-box/` owns the native textarea, CodeMirror, and
VisualEditor adapters shared with Source Editor. Creator's browser adapter
consumes their current-source read, write, selection, and focus operations;
it still accepts the neutral four-operation enhanced backend. Source Editor's
additional position-preserving writes stay with that tool. Shared tests cover
native events, selected text, backend replacement, and CodeMirror toggles and
destruction. This AI-assisted extraction changes no review or save workflow.

```text
app/main
├── platform implementations
├── app/workflows
│   ├── app/contracts
│   └── domain
└── features/creator
    ├── app/contracts (types)
    ├── domain
    └── i18n

domain ──> domain, shared
shared ──> shared
src/vg-stub-creator/index.ts (side-effect free)
```

Domain modules never depend on UI, platform implementations, startup, or host
globals. Platform adapters isolate live systems and may use application
contracts as types. Features receive external capabilities through ports.
Shared modules remain independent of application layers. `src/vg-stub-creator/index.ts` does
not start the browser tool.

The creator owner exposes its eligible launch action through native MediaWiki
page tools. The Chinese Wikipedia action opens the mounted form. The English
Wikipedia action remains a real link with its Chinese Wikipedia fallback
destination and uses the existing target-resolution callback. Its new-tab
behavior and explicit activation are retained. Creator does not register a
bottom-right quick-access action. Browser scenarios check the native links,
keyboard activation, and the absence of a Creator quick-access control.

## Article generation

Raw inputs become normalized `ArticleDataRecord` values in
`src/vg-stub-creator/domain/models.ts`. `article-module.ts` supplies record defaults,
`modules.ts` assigns field ownership, and `processor.ts` combines the registered
modules. `src/vg-stub-creator/app/workflows/article.ts` coordinates source acquisition,
normalized records, and final rendering.

`article-input.ts` converts older saved name groups at input boundaries before
source acquisition. The same idempotent conversion serves history restoration
and direct article processing, preserving row identities, citation source keys,
and alias evidence. Internal rules consume the canonical name shape.

Processed articles contain `form`, `records`, `prose`, `renderers`,
`sourceReferences`, and `sourceTags`. Review rows belong to the review record;
fallback category rendering uses a copy rather than changing reviewed input.
The composition root projects generated title fragments onto the public
title-move contract without duplicating them throughout processed data.

`src/vg-stub-creator/domain/terminologies/` owns canonical company, genre, platform, and year
identities. The canonical identity comes first in `aliases`. A terminology
entry without `page` remains unlinked.

`src/vg-stub-creator/domain/wikitext/index.ts` exposes article-specific capabilities through a
thin facade. `builders.ts` constructs output, `field-values.ts` parses form
values, and `reference-data.ts` looks up terminology metadata. Citations and
their normalization rules live in `src/vg-stub-creator/domain/citations/`. Article-language
text belongs in `src/vg-stub-creator/domain/wiki.ts`; interface text belongs in `src/vg-stub-creator/i18n/`.
The citation adapter shares pending requests and cached results by source.
Raw Citoid transport and structured logging use `src/library/citoid/` and
`src/library/logging/`; boundary record checks use `src/library/data-validation/`.
An explicit refetch supersedes earlier requests; superseded results cannot
overwrite the current cache or release another request's pending ownership.

Editable citations use the pure template scanner in `src/library/wikitext/`,
shared with Source Editor. Pipes and equals signs inside nested templates,
template parameters, links, comments, and literal or reference tags stay in
their original field. Unnamed values receive explicit numeric names in the
existing parameter-row editor so review and rebuilding retain them. Creator
continues to own citation defaults, parameter sorting, metadata cleanup, and
serialization. Shared scanner tests and citation-parser regressions cover the
extraction and syntax boundaries; AI assistance covered these changes.

Related-page classification and navbox-title extraction also use the shared
template scanner through one local complete-invocation adapter. Nested arguments
and literal-tag content retain their entered bytes; adjacent or unfinished calls
are not treated as one complete template. Creator keeps category-versus-template
intent and unparameterized stub routing. Related-entry regressions cover these
boundaries. Incremental metadata-field tokenization remains local because it
preserves unfinished wikilinks and the form's separator-precedence rules.

Namespace prefixes and title operations come from
`src/library/wiki-titles/wikipedia.ts`, shared with citation formatting and
Article Assessor. It retains the recorded English/Chinese Wikipedia siteinfo
aliases and uses a supplied catalog when available. Creator's reviewed-action
title normalization remains local because it deliberately uses case-insensitive
comparison keys. Shared namespace regressions and Creator's generation/write
tests cover this extraction; it adds no request, cache, or storage behavior.

New-page-list date lookup, descending insertion, blank tails, and year insertion
use `src/library/new-page-list/sections.ts`, shared with Article Assessor.
Creator keeps its literal-space date grammar, section boundaries, category
formatting, and guarded registration writes. Shared insertion tests and each
tool's registration regressions cover source retention and their distinct
separator rules. Summary links are built by the existing domain edit-summary
owner for both article and company-category writes.

## Review, writes, and recovery

The creator feature owns the form draft, citation edits, preview state, and
selected follow-up operations. The editor reviews generated text and the edit
summary before accepting a write plan.

Generated summary wording is always English, independently of the interface
locale, for article saves and every follow-up operation. Staged page edits without
a supplied summary use **Create** or **Update** with the exact page title.
Manually reviewed summaries retain their original wording. Offline tests cover
all supported interface locales and the summaries passed to write adapters.

`src/vg-stub-creator/domain/pre-save-actions.ts` builds deterministic reviewed actions.
`src/vg-stub-creator/app/workflows/pre-save-plan.ts` prepares the persisted operation plan,
`pre-save-write.ts` saves the reviewed article, and `pre-save.ts` coordinates
follow-up execution. `pre-save-checkpoint.ts` validates stored state before
resuming work. Platform adapters perform the actual reads, edits, moves,
related-page creation, and Wikidata updates.

`src/vg-stub-creator/platform/mediawiki/page-title-checks.ts` checks exact requested titles and
Chinese variants without following redirects. It is separate from the resolver
used for category and template targets. Controlled API queries use format
version 2 and main-slot revision content. Invalid or incomplete evidence cannot
confirm a page missing or authorize a write.

Before the article write, the workflow persists a versioned checkpoint. New
pages use `createonly`. For existing pages, the workflow reads the latest base
revision timestamp immediately before the write and uses `nocreate` with that
timestamp. These checks catch page-existence changes and concurrent edits
between the pre-save query and submitted write. Each follow-up write
records pending, running, and confirmed states. Recovery can resume work known
not to have started. Running or uncertain operations need manual review and
are never retried automatically.

Local form history and the temporary draft use browser local storage. Preview,
pending-save, and progress state use tab-scoped session storage. Storage
validation belongs to the adapter; save-plan invariants belong to the domain
and application workflows.

## UI and build ownership

Creator dialogs use colocated `.vue`, `.ts`, and `.css` files under
`src/vg-stub-creator/features/creator/dialogs/`. Vue SFC files contain templates only; their
TypeScript owner provides behavior and typed bindings. Use Codex default component appearance. Tool-owned CSS only arranges columns
and their responsive layout; see [shared UI guidelines](../ui-guidelines.md).

Metadata datasets use a Codex fieldset with three parts in reading order: the
automatic name-or-source input, an **Items** fieldset containing selection
checkboxes, editable wikitext names, and related-page labels, and a **Sources**
fieldset containing the source links. Items and Sources retain their legends
when empty, keeping the group structure visible before entry. Expanded name
**Uses** settings also use a fieldset, and sourced prose has separate Value and
Source URLs fields. The markup supplies the hierarchy through native Codex
legends and nested labels. Theme-aware borders enclose each dataset fieldset,
with its legend interrupting the top border and padding keeping controls inside
the boundary. The nested Items and Sources sections retain Codex's borderless
fieldset appearance and list their rows vertically, reducing repeated boxes
within each dataset. This explicit exception to the shared default makes related
groups visible without changing the inputs or label typography. The [Codex form guide][codex-forms]
defines the Field, fieldset, legend, and nested-label roles used here.

AI assistance covered the grouping and layout changes, removal of Creator's
quick-access registration, regression coverage, and the corresponding
documentation. Verification uses the full pipeline and the live
screenshot refresh procedure; manual keyboard and assistive-technology review
remain separate checks. Grouping preserves the
existing parsing, draft, request, review, and save owners and introduces no data
or lifecycle changes.

Name and article-text sources use a single-line URL input followed by borderless
vertical source rows. The feature's `form/source-url-editor.ts` owns entry drafts,
selection-aware multiline paste, Enter/blur completion, duplicate removal, and
focus after removal. It retains the existing newline-separated source strings
for history, temporary drafts, citation preparation, and generated articles.
Typing preserves current source text in that form shape while completion clears
the entry; composing Enter does not commit. Reset and disposal clear transient
entry state. HTTP(S) source rows have links; other retained text remains
non-navigable. Focused unit and browser coverage checks completion, draft
preservation, removal, restored sources, and the responsive lists. AI assistance
covered this source-input change and its verification.

The six Facts datasets stay in one column at every viewport width, with each
fieldset using the full form width. This keeps the input, editable items,
related-page labels, and source list together. Article text fields use two
columns on viewports at least 960 CSS pixels wide, with multiline prose spanning
both columns. Name and source fields also share a row at that width, within
their Codex fieldset. At narrower widths the same DOM order becomes a single column, so
labels, reference URLs, and related-page controls have room to wrap. Owned
wrappers arrange the columns without changing Codex field spacing or control
appearance. This presentation change retains the existing draft owners, request
identities, and explicit review and save actions; it adds no storage or service
operations. Offline browser coverage checks column placement, stacked reading
and keyboard order, long Russian labels, and reachable actions at 375 × 667,
683 × 768, and 1366 × 768. Maintained live images follow the existing capture
procedure. Manual assistive-technology review remains separate release evidence;
[maintenance](../maintenance.md#release-assessment) records verification and AI
assistance for the current cleanup.

Each creator dialog owns its mutable state. Its component composes separate
name, metadata/related-page, citation, and source-editor owners through typed
options and narrow callbacks. Owners reset their drafts, cancel timers, and
discard late reads when restored or disposed. Source editors also invalidate
pending CodeMirror loads when their dialog closes. The component retains
history, preview, move/save orchestration, and staged page editing; unmounting
removes only its own external controller and listeners.
Related-page source and preview requests belong to the open editor and request
identity. Closing, switching rows, resetting the draft, or disposing the component
discards late responses. Preview results also require unchanged source text.

Related-page parsers and identity matching live in `form/related-items.ts`;
metadata item helpers depend on them without a reverse dependency. Article
conversion output and displayed name-usage chips share the domain's official
name selector.

The UI follows the [Wikimedia Codex style guide][codex-style-guide]. Preserve clear field
labels, visible validation, accessible progress, neutral cancellation, and one
primary progressive action per action group. Responsive layouts keep reading
and keyboard order aligned with the displayed action order.

The build reads templates and styles, injects them into the browser entry, and
generates a readable userscript and a compact script for wiki installation.
Production loads Vue and Codex
through ResourceLoader. Browser tests supply a local Vue/Codex runtime and
mock every external operation.

The preview adapter first requests MediaWiki's native edit preview. On a
read-only source view, a successful HTTP response can omit `#wikiPreview`; that
case falls back to the official [Action API parse module][parse-api] with
`preview=true`, the same generated text, and the draft page title as its parser
context. This keeps template and Wikidata defaults associated with the intended
article instead of the source page used to open the tool. Native requests remain
bound to the host source title; native preview success and HTTP errors retain
their existing behavior. Both paths are read-only; the
adapter validates returned preview HTML and never changes the backing editor or
uses a write token. Failed parsing leaves the draft available for review.

Documentation screenshots use the actual host and APIs through
`scripts/vg-stub-creator/capture-live.mjs`, separately from offline regressions.
[The image inventory](images/README.md) records supplied input, native preview
limitations, and live capture provenance.

[codex-style-guide]: https://doc.wikimedia.org/codex/latest/style-guide/overview.html
[codex-forms]: https://doc.wikimedia.org/codex/latest/style-guide/constructing-forms.html#field-type-usage
[parse-api]: https://www.mediawiki.org/wiki/API:Parsing_wikitext
