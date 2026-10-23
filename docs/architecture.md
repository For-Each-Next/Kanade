# Architecture

Last reviewed: 2026-10-21.

Kanade is one source project with four independently installable browser
tools. One root version, dependency tree, build, and verification pipeline produce
four readable/compact script pairs. Every script bundles the library capabilities
it needs and starts only its own tool.

## Tools and ownership

| Tool                                         | Registry ID and directory | Artifact basename | Supported task                                                                                                                                                                                 |
| -------------------------------------------- | ------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Source Editor](source-editor/README.md)     | `source-editor`           | `source_editor`   | Source editing, formatting, and reference management on eligible Wikimedia source editors; citation policy has explicit English/Chinese Wikipedia support and conservative defaults elsewhere. |
| [Revision Copy](rev-copy/README.md)          | `rev-copy`                | `rev_copy`        | Read-only page, displayed-revision, section, and attribution copying across supported Wikimedia sites.                                                                                         |
| [Article Creator](vg-stub-creator/README.md) | `vg-stub-creator`         | `vg_stub_creator` | Reviewed Chinese Wikipedia video-game article creation and follow-up operations, with an English Wikipedia launch route.                                                                       |
| [Article Assessor](wpvg-assessor/README.md)  | `wpvg-assessor`           | `wpvg_assessor`   | Chinese Wikipedia assessments, reviewed queues, category assessment, and new-page registration/archiving.                                                                                      |

The registry in `scripts/tools.mjs` owns entrypoints, hosts, artifact names, and
bundled notices. Each tool validates the current page before mounting. Interface
language is independent of wiki support and target content policy. All four tools
provide English, Simplified Chinese, Traditional Chinese, Japanese, and Russian
catalogs.

## Ownership

Use this directory template for each tool. Create optional directories only when
real modules need them; a tool-local `shared/` folder can retain a named pure
service but must not become a generic utility layer.

```text
src/<tool>/
  index.ts                 Intentional pure public API
  app/
    browser.ts             Browser entrypoint
    main.ts                Composition and startup ownership
    contracts/             Consumer ports and workflow types
    workflows/             Use cases, review, cancellation, recovery
  domain/                  Pure rules, models, validation, transformations
  platform/                MediaWiki, browser, network, storage adapters
  features/                UI state, rendering, input, disposal
  i18n/                    Catalogs and interface-language resolution
  config/                  Static policy and generated data
  types/                   Ambient host/build declarations
src/library/<capability>/  Shared capability with a named owner
```

Tests mirror tool and library ownership in `tests/<tool>/` and `tests/library/`.
Detailed guides live under `docs/<tool>/`. Dependencies, lockfile, versioning, Git,
scripts, and generated `dist/` remain at the root. There are no nested packages,
repositories, distributions, combined installation bundle, or separately
installed library runtime.

## Dependency direction

| Owner                 | Permitted dependencies                                        | Boundary                                                                         |
| --------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Domain                | Own pure rules/types and explicitly pure library capabilities | No DOM, storage, network, startup, or UI.                                        |
| Application workflows | Domain, consumer contracts, suitable library capabilities     | External operations are injected; workflows own review and acceptance decisions. |
| Platform              | Consumer contracts, pure rules, suitable library capabilities | Implements browser/host operations; no feature UI or startup imports.            |
| Features              | Domain, consumer contracts, i18n, injected workflows          | Owns UI lifecycle; no concrete platform adapters.                                |
| Composition           | Platform, workflows, features, library                        | Constructs services and owns startup; other layers do not import it.             |
| Shared library        | Own contracts and permitted shared capabilities               | Never imports a tool implementation.                                             |
| Public `index.ts`     | Intentional pure operations and types                         | No browser startup or host side effects.                                         |

Root ESLint rules enforce these directions across all four tools, forbid
cross-tool imports, and forbid library-to-tool imports. Contracts belong to the
consumer that defines the need. A notifier or editor interface must not require
consumers to import its concrete MediaWiki implementation. Pure public APIs are
intentional extension points: Source Editor exposes source/reference/citation
operations, Revision Copy exposes links and attribution, Creator exposes article
models and deterministic rendering/summary operations, and Assessor exposes
assessment, comparison, and registration rules. Internal exports remain subject
to unused-code checks.

## Runtime identity

| Surface                              | Contract                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------- |
| Project/package                      | Kanade / `kanade`                                                         |
| Startup                              | `Symbol.for('kanade.<tool>.startup')`                                     |
| Shared launcher                      | `Symbol.for('kanade.quick-access.v1')`                                    |
| Owned DOM/CSS/data names             | `kanade-<tool>-<purpose>`; shared `kanade-quick-access`                   |
| Source Editor pre-load configuration | `window.sourceEditorConfig`                                               |
| Newly named preference/cache stores  | `kanade:<tool>:<purpose>:v<schema>`, with wiki/account scope where needed |
| Browser capture proxy                | `KANADE_BROWSER_PROXY`                                                    |

Source Editor resolves configuration once at composition, validates each value,
and passes immutable options to consumers. Missing or invalid values use safe
defaults. Wiki identity and content policy are resolved separately from interface
locale. Retired globals, registry IDs, command aliases, and preference/cache
schemas are not compatibility entrypoints. Existing user-authored history,
drafts, queues, and write checkpoints retain their functional keys and validation
contracts. No retired browser records are automatically imported or deleted.

A startup guard prevents repeated loading of the current script from mounting a
second owner. It cannot control a previously loaded script with a different
guard. Disable the prior installation, preserve drafts, install the replacement,
and reload. The neutral textarea-local
`mediawiki-gadgets.edit-box-backend` symbol remains a host interoperability
contract; it identifies editor access rather than a product startup.

The project rename updates the root package, generated metadata, CI artifacts,
runtime symbols, owned DOM/CSS, and development-service identifiers together.
The four functional tool IDs and installation basenames stay stable. Newly named
preference and disposable-cache stores start with validated defaults; Creator
history, drafts, save checkpoints, and Assessor reviewed queues retain their
existing keys and recovery contracts. Historical screenshot ledgers retain
their observed identities and hashes. Updating an installation requires disabling
the prior script and reloading, as described above.

AI assistance covered this rename and its regression updates. The complete
verification pipeline checks metadata, identity boundaries, independent
installation, shared launchers, storage behavior, and generated distributions.

## Composition and shared capabilities

The root build owns compact asset preparation and final JavaScript minification.
It compresses known templates and CSS assets, including CSS imported as text by
shared capabilities. Compact executable code occupies one line; escaped runtime
newlines preserve source text, previews, and generated wikitext. This trades a
small amount of string-encoding overhead for single-line installation code.
An anonymous immediately invoked function contains the compact program and its
strict-mode directives. Appending another script therefore retains that script's
own strictness and does not expose bundled declarations as page globals.
Metadata and complete required notices retain their separate lines. AI assistance
covered this build change, static style extraction, and regression tests for
strict-mode isolation, string preservation, template whitespace, CSS selectors,
and `calc()` spacing;
the full verification pipeline checks the generated distributions and offline
browser behavior.

Composition reads host identity, creates adapters, resolves immutable policy and
configuration, and supplies narrow services to workflows and features. The host
provides MediaWiki ResourceLoader, Vue, and Wikimedia Codex. npm packages provide
types, development fixtures, and selected licensed build assets. Production
scripts do not bundle another framework runtime. Native controls serve Revision
Copy's inline row; larger dialogs use host Codex with its default appearance.

| Shared capability                    | Reason and limits                                                                                                                                                                                                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/library/i18n/`                  | All four tools share locale resolution; Source Editor, Creator, and Assessor also share typed text and rich-part interpolation. Catalogs and Revision Copy's broader Chinese-variant acceptance remain with their tools.                                                                            |
| `src/library/wikitext/`              | Source-preserving scanning of templates, parameters, links, comments, tags, and references, plus range transformations. Tools retain their citation, highlighting, article, and banner policies.                                                                                                    |
| `src/library/wikitext-highlighting/` | Pure syntax segments and token colors shared by Source Editor and the bare textarea attachment. Existing token class names remain compatible; preview and missing-page behavior are not part of this capability.                                                                                    |
| `src/library/wikitext-textbox/`      | An opt-in syntax overlay for gadget textareas. The native textarea owns editing; no host discovery, network, preview, reference management, or toolbar is installed.                                                                                                                                |
| `src/library/wiki-titles/`           | Namespace catalogs and title operations. Canonical fallback and recorded English/Chinese Wikipedia aliases remain explicit policies rather than one universal normalization rule.                                                                                                                   |
| `src/library/data-validation/`       | Boundary object guards and record readers preserve each caller's array and missing-value contract; product schema validation stays at the owning adapter.                                                                                                                                           |
| `src/library/logging/`               | Structured logging with common level filtering, timing, bounded details, and sensitive-value redaction. Tool composition owns configuration and output.                                                                                                                                             |
| `src/library/citoid/`                | Source Editor and Creator share raw metadata transport and response validation. Their citation normalization, pending-request ownership, and caches stay local.                                                                                                                                     |
| `src/library/citation-metadata/`     | Source Editor and Creator share Zotero-to-CS1 template selection; their field normalization and serialization policies stay local.                                                                                                                                                                  |
| `src/library/mediawiki-edit-box/`    | Source Editor and Creator share backing-editor discovery and native input delivery. Source Editor retains selection-preserving adapters and its stricter ownership check.                                                                                                                           |
| `src/library/new-page-list/`         | Creator and Assessor share date ordering and section insertion; their accepted line syntax, archive parser, review, and write workflow remain distinct.                                                                                                                                             |
| `src/library/quick-access/`          | Source Editor contributes Format and Tools actions to one bottom-right launcher. The library owns registration, presentation, and stale-disposer protection; Source Editor owns the actions and their state. Revision Copy uses inline/section entries; Creator and Assessor use native page tools. |
| `src/library/notifications/`         | Source Editor, Creator, and Assessor share action-result notification policy while retaining local catalogs and tags. Revision Copy retains its Codex-toast and MediaWiki-fallback behavior.                                                                                                        |
| `src/library/mediawiki-runtime/`     | Matching ResourceLoader/Vue/Codex contracts share validated loading mechanics and equal pending module sets. Failed loads are retryable. Tool component lists, mount owners, acceptance decisions, and dialog state remain local.                                                                   |

A shared capability is justified by matching current consumers, not by two
operations using the same API. Creator's operation-plan recovery and Assessor's
locked queue remain different workflows. A shared helper cannot authorize a wiki
write or decide that a stale result is current.

The 2026-10-21 duplication audit used an AST inventory of function bodies across
all authored TypeScript files, including callbacks, tests, scripts, and root
configuration. Exact and structurally matching bodies were compared with their
callers before extraction. Shared extraction covers the scanner and range operations as well as
locale handling, title policy, metadata transport, editor access, logging, and
boundary record checks. Small tool-local duplicates reuse their existing domain
owner; similar-looking operations with different source-preservation or workflow
contracts remain separate. This avoids a generic utility framework or an extra
runtime dependency. Revision Copy's project definitions and timestamp validation
stay in its domain and platform owners because those contracts serve only that
tool.

AI assistance covered the audit, extraction, documentation, and regression tests.
Shared suites exercise parser boundaries, range offsets, namespace policies,
record contracts, logging privacy, and metadata failures. Tool suites retain
checks for source round-tripping, review/write ownership, stale responses, and
recovery. Automated checks and agent review do not establish independent human
review; manual release checks remain recorded in the maintenance guide.

### Syntax-only gadget textboxes

`src/library/wikitext-textbox/index.ts` exposes
`attachWikitextHighlighting(textarea)`. A gadget imports and bundles this module
with its own script; it does not install or start Source Editor. Attach it to an
already mounted native textarea, refresh after programmatic value assignments,
and destroy it when disposing the owning form or dialog:

```ts
// Relative import from src/<tool>/features/example.ts.
import { attachWikitextHighlighting } from '../../library/wikitext-textbox/index.ts';

const highlighting = attachWikitextHighlighting(textarea);
textarea.value = source;
highlighting.refresh();
// When the owning interface closes:
highlighting.destroy();
```

The attachment renders only escaped text and syntax spans in an aria-hidden
overlay. Typing, selection, native undo, composition, form submission, disabled,
and read-only behavior remain with the original textarea. It copies text metrics
and synchronizes scrolling and resizing; syntax emphasis never changes character
metrics. No link metadata becomes a clickable element or triggers a lookup.
Repeated attachment returns the existing handle, and disposal removes only owned
styles, listeners, observers, and wrapper. The caller owns dialog lifecycle and
layout; this is not an automatic page-wide editor replacement.

This minimal component inserts a block `.kanade-wikitext-textbox` wrapper. Give
that wrapper any flex/grid placement rules and size the textarea directly;
selectors such as `form > textarea` no longer match while attached. It does not
preserve arbitrary inline or parent-dependent host layouts. Base colors are
captured on attachment; later disabled/read-only changes retain syntax colors
while preserving native editing restrictions. These limits keep the component
small instead of adding a general host-layout or theme adapter.

The pure highlighter and token palette were extracted from Source Editor, whose
existing enhanced editor still owns its history, previews, and optional link
checks. Its established token class names are retained to keep styling compatible.
AI assistance covered this extraction and the minimal attachment. Offline browser
tests cover native editing, focus/selection, composition, scrolling, form behavior,
disposal, and the absence of network requests or extra editor controls.
The 2026-10-21 `npm run verify` run passed all 1,802 unit/DOM/service tests,
294 Playwright scenarios (13 skipped), and Revision Copy's seven-skin offline checks, along
with formatting, lint, types, boundaries, unused-code checks, and all eight
rebuilt distribution scripts. The syntax-only textbox has 11 focused browser
cases; its offline visual comparison was inspected for line spacing, wrapping,
and placeholder visibility. Manual screen-reader and human release review remain
separate requirements.

### Shared launcher

The launcher uses a page-level symbol so independently bundled copies share one
surface. Its bottom-right actions run horizontally in their established action order and wrap
at the viewport edge, keeping native button appearance and matching visual and
keyboard order. The layout changes no stored state or action lifecycles. Existing
offline browser checks cover independent installations, viewport bounds, keyboard
activation, and focus restoration. Registration tokens protect replacements from
stale disposal. Tool
entrypoints remain available after launcher host-module failures. Navigation
releases owned resources; back-forward-cache preservation follows the page
lifecycle. Library code never starts a tool.

## State lifetime and asynchronous ownership

| Lifetime                   | Owner and examples                                                    | Release or recovery                                                                                           |
| -------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Dialog session             | UI draft, selection, previews, request generation, unapplied settings | Close/dispose invalidates reads, timers, listeners, and mounts; restore focus to the opener.                  |
| Current page/tab memory    | Deduplicated lookups, current editor/backend, read snapshots          | Bound caches; recheck page/source identity; reload ends memory.                                               |
| Tab session storage        | Creator preview/save checkpoints and Assessor read cache              | Validate schema, targets, reviewed revisions, and statuses before recovery; never replay uncertain writes.    |
| Persistent browser storage | Saved preferences, Creator history/draft, Assessor reviewed queue     | Validate at the adapter, apply account/wiki scope when required, and support documented reset/export/removal. |

Each asynchronous operation captures its input and owning session plus the
relevant page, source, selection, or revision identity. Input changes invalidate
older output immediately. Acceptance rechecks those identities after every
await; disposal prevents late UI updates. Pending and validated successful reads
may be deduplicated, but failed reads remain retryable. A workflow still decides
whether cached evidence is sufficient for its operation. Source Editor retains
source, selection, IME composition, undo, and scroll through optional failures.

Browser storage belongs to an origin/profile; session storage also belongs to a
tab. Storage denial must preserve the open draft. Account-scoped queue keys
separate identities without encrypting data. Cross-wiki synchronization is not
implemented. [Maintenance](maintenance.md#data-and-storage-inventory) owns exact
keys, retention, transmitted data, and deletion instructions.

## Write boundaries

Source Editor changes backing source only after explicit acceptance; MediaWiki
publishes it. Revision Copy reads and copies through explicit clipboard actions.
Creator reviews the article and exact operation plan before live writes, records
confirmed progress, and requires manual review of uncertain outcomes. Assessor
reviews staged queues under cross-tab locks and uses revision-protected writes;
category assessment deliberately saves on class choice. Archive removal follows
confirmed destination writes. These product decisions stay with their workflows.

Validate API responses and stored records at their adapters. Render user and
remote text safely. Failed reads must not become missing-page evidence, invented
metadata, or permission to write. Preserve CSRF, page-existence, revision-conflict,
partial-failure, and recovery protections through refactoring.

## Tool-specific design

- [Source Editor](source-editor/architecture.md): one scanner/formatter, backing
  editor, reference manager, immutable options, and source-preserving lifecycle.
- [Revision Copy](rev-copy/architecture.md): displayed revision identity,
  attribution generation, clipboard completion, and content remount ownership.
- [Article Creator](vg-stub-creator/architecture.md): article modeling,
  terminology evidence, reviewed operation plans, and checkpoint recovery.
- [Article Assessor](wpvg-assessor/architecture.md): assessment drafts,
  account/wiki queues, locks, protected writes, and archive reviews.

[Development](development.md) owns coding and verification.
[UI guidelines](ui-guidelines.md) own interaction and accessibility policy.
Project-owned material is CC0-1.0; [third-party notices](../THIRD-PARTY-NOTICES.md)
retain applicable terms for reused code, data, and captured content.
