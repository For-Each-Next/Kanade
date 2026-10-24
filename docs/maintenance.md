# Maintenance and continuity

Last reviewed: 2026-10-17.

This guide records ownership, data lifetimes, dependencies, recovery, and work
still needed for Kanade's browser userscripts.

[Development](development.md) remains the authority for coding, verification,
Git, and releases. [Architecture](architecture.md) defines source ownership;
[documentation](documentation.md) and [UI guidelines](ui-guidelines.md) define
writing and interface policy. This inventory describes the inspected source,
not a security certification or a record of completed human review.

## Project and contacts

Kanade is in development at root version 0.1.1. The [project repository][repository]
hosts source and tagged release automation. A named maintainer and dedicated
project contacts are not yet documented.
The project owner must arrange
review and handoff until project contacts are established. No second maintainer,
substitute with release access, private vulnerability channel, or completed
access transfer is documented.

Keep a reproducible issue report with the proposed change: tool, installed
version, wiki, browser, interface language, steps, and expected result. Remove
private drafts, account details, and credentials. For sensitive incidents, arrange
a private channel with the project owner before sharing details. Coordinate
service-specific incidents through the provider's process. Record the affected
version, mitigation, and follow-up without publishing sensitive material.

| Tool             | Stable ID / artifact basename         | Status and purpose                                                                                                                                     | Documentation                                                                                                                           |
| ---------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Source Editor    | `source-editor` / `source_editor`     | Active development; source editing, formatting, and reference management. Publication stays with the host editor.                                      | [Guide](source-editor/README.md), [configuration](source-editor/configuration.md), [architecture](source-editor/architecture.md).       |
| Revision Copy    | `rev-copy` / `rev_copy`               | Active development; read-only page, revision, section, and attribution copying.                                                                        | [Guide](rev-copy/README.md), [configuration](rev-copy/configuration.md), [architecture](rev-copy/architecture.md).                      |
| Article Creator  | `vg-stub-creator` / `vg_stub_creator` | Active development; reviewed Chinese Wikipedia video-game article creation and selected follow-up writes.                                              | [Guide](vg-stub-creator/README.md), [configuration](vg-stub-creator/configuration.md), [architecture](vg-stub-creator/architecture.md). |
| Article Assessor | `wpvg-assessor` / `wpvg_assessor`     | Active development; Chinese Wikipedia assessments and new-page registration/archive writes. Choosing a class in category assessment saves immediately. | [Guide](wpvg-assessor/README.md), [review workflow](wpvg-assessor/review-workflow.md), [architecture](wpvg-assessor/architecture.md).   |

One root package, lockfile, version, Git ownership, and distribution serve all four
tools. Each tool has an independently installable readable/compact script pair;
the build produces eight scripts. Preserve the current functional registry IDs,
artifact basenames, and documented recovery contracts when transferring
maintenance. Runtime identity follows [architecture](architecture.md#runtime-identity).
Wiki administrators own any site-gadget installation; an editor
owns their userscript or personal wiki-script installation.

## Data and storage inventory

The scripts run in the wiki's browser context. Browser storage is scoped to the
wiki origin and browser profile; session storage also belongs to its tab.
Different wiki or mobile origins do not share records. Same-origin scripts and
people with access to that browser profile can access these records. Account
names in keys separate assessment queues logically; they do not encrypt data
or provide an access-control boundary. Uninstalling a script does not clear its
persistent data.

| Owner and data                                     | Storage and identity                                                                                                                                                                                                                                                   | Retention and deletion                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source Editor preferences                          | Local storage: `kanade:source-editor:formatter-settings:v1`; validated schema 1 envelope. No article source or reference draft is included.                                                                                                                            | No automatic expiry. **More → Reset settings** deletes saved preferences. See [configuration](source-editor/configuration.md).                                                                                                                                                                           |
| Source Editor site metadata                        | Local storage: `kanade:source-editor:siteinfo:v1:<wiki>` for namespaces/site configuration.                                                                                                                                                                            | Valid for 24 hours; invalid or expired records are removed when read. Remove the specific record in browser site storage to clear it immediately.                                                                                                                                                        |
| Source Editor citation TemplateData                | Local storage: `kanade:source-editor:template-data:v1`, with wiki identity in the envelope; up to 64 metadata entries.                                                                                                                                                 | Refresh is requested after seven days. A failed refresh can retain stale metadata, so seven days is not a deletion deadline. Remove this record in browser site storage to delete it.                                                                                                                    |
| Source Editor working source and lookup results    | Host editor and page memory: source, selection, reference drafts, summaries, link checks, and whole-page references.                                                                                                                                                   | Tool memory ends on reload/navigation. **More → Clear cache** clears the documented lookup results and invalidates pending results while preserving source and preferences. Save or copy unsaved source before leaving; host draft recovery is outside this tool's guarantee.                            |
| Revision Copy lookups and generated text           | Page/tab memory; revision and attribution caches each hold up to 200 validated responses. The clipboard receives text only through a copy action.                                                                                                                      | Reload ends the caches; failures are discarded. A latest-by-title lookup remains a snapshot until eviction or reload. The browser/operating system controls clipboard retention. No persistent Revision Copy browser store is implemented.                                                               |
| Article Creator form history and temporary draft   | Local storage: `vg-stub-creator-form-history`, `vg-stub-creator-form-draft`, `vg-stub-creator-form-draft-page`, and `vg-stub-creator-form-draft-saved-at`. Includes names, prose, source URLs, citation edits, target titles, and save times.                          | History keeps at most 20 entries; no time-based expiry. **History** supports restoring, exporting, importing, and deleting saved entries. The temporary draft is separate from history; remove its three records in browser site storage to delete it. These keys are origin scoped, not account scoped. |
| Article Creator category evidence                  | Local storage: `vg-stub-creator-category-cache:<page>`. Contains title-resolution evidence and observation times.                                                                                                                                                      | Existing-category evidence is valid for 24 hours; missing-category evidence for one hour. Expiry is checked during use and persistence, not by background deletion. Remove the corresponding record to clear it.                                                                                         |
| Article Creator recovery                           | Session storage: `vg-stub-creator-preview-form`, `vg-stub-creator-move-text`, `vg-stub-creator-pending-save`, `vg-stub-creator-save-progress`, and `vg-stub-creator-review-links-opened`. Includes generated source, reviewed operation targets, statuses, and errors. | Explicit lifecycle cleanup removes consumed preview/move state and completed save checkpoints/progress. Remaining records last for the tab session; browser session restoration can preserve them. Retain the tab while recovering an interrupted save.                                                  |
| Article Assessor staged reviews                    | Local storage: `wpvg-assessor.assessment-queue.v1:<encoded wiki/account identity>`. Includes proposed talk source, assessment choices, summaries, registration data, titles, and dates.                                                                                | No automatic expiry. **Unstage** removes a draft; confirmed saves remove completed drafts and failures retain unfinished work. Remove the specific queue record only after copying work that should be retained.                                                                                         |
| Article Assessor read snapshots and creation dates | Session storage: `wpvg-assessor.assessment-cache.v1:<encoded wiki/account identity>`; local storage: `kanade:wpvg-assessor:creation-datetimes:v1`.                                                                                                                     | Read snapshots last for the tab session. The persistent creation-date cache has no automatic expiry; remove its record to reset it. Failed category reviews are held only in tab memory and are lost on reload.                                                                                          |

Newly named Source Editor preference/metadata stores and the Assessor creation-date
cache start with validated defaults. Retired records are not imported or deleted
automatically. Creator history, temporary drafts, and recovery records retain their
functional keys; Assessor queue and read-cache keys also remain stable. Disable the
previous script before installing a replacement and reload: a changed startup
symbol cannot prevent an already loaded previous script from starting independently.
Export Creator History and copy Assessor reviewed source/summaries before replacing
or clearing records. Never resume uncertain writes automatically.

For complete removal, stop pending writes, copy or export work to keep, disable
the installation, and remove the listed records in the browser's site-storage
inspector on each origin where it was used. Close other tabs first so they cannot
rewrite a shared queue or draft. Clearing all site data also affects unrelated
wiki preferences and sessions. Exported files are user-controlled copies and
need their own deletion and backup decisions. Clearing browser data does not
undo wiki edits or remove published revision history.

## Services and transmitted data

| Service                                                    | Use and data sent                                                                                                                                                                                                                                                     | Access and retention boundary                                                                                                                                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [MediaWiki Action API][action-api] and wiki REST summaries | Page titles, revision IDs, template/site metadata, category queries, and article summaries. Source Editor's CS1 checks and Article Creator's previews send supplied wikitext to the host parser without publishing it.                                                | Local API operations use the host session. Revision Copy's remote attribution fetches omit credentials. Wikimedia controls server logs and retention; the script cannot erase those records.                           |
| Chinese Wikipedia and Wikidata write APIs                  | Article Creator sends reviewed article/related-page text, moves, redirects, summaries, registration, and selected Wikidata sitelinks. Article Assessor sends assessments, registration, and archives.                                                                 | MediaWiki supplies account authentication and CSRF tokens. Saves use the user's wiki rights and produce public changes/history under the site's rules. There is no project-side deletion API for those revisions.      |
| [Citoid][citoid]                                           | Source Editor and Article Creator submit entered source URLs or bibliographic lookup input to the host's `/api/rest_v1/data/citation/zotero/` endpoint. Creator's localized Steam-name lookup passes language-specific source URLs through the same citation service. | The service receives the lookup. Kanade does not specify or control its retention; use public source material and avoid private or credential-bearing URLs. Manual citation entry remains available.                   |
| [Internet Archive Wayback availability][wayback]           | Source Editor sends a sanitized source URL to `https://archive.org/wayback/available` to find an existing snapshot.                                                                                                                                                   | This is a snapshot lookup, not an archive-submission operation. Internet Archive controls service logs and retention. The draft remains available when lookup fails.                                                   |
| English Wikipedia and Wikidata metadata                    | Article Creator queries English page properties and Wikidata claims for game identifiers; its English launcher transfers the source title in a Chinese Wikipedia URL query.                                                                                           | Titles/identifiers are visible to the destination services and can appear in browser history. Source acquisition can fail without inventing missing-page evidence.                                                     |
| Entered source websites                                    | After a Citoid 404, Article Creator may request a non-Steam source URL directly to extract its HTML title.                                                                                                                                                            | The destination receives the request; browser CORS and network rules can block it. Kanade controls neither the destination's logs nor retention. Failed fallback title acquisition leaves a minimal editable citation. |

This is a technical inventory, not a determination of legal basis or compliance.
Reassess privacy before adding telemetry, synchronization, new services, or new
stored fields. The maintainer cannot access another user's browser-local drafts
through the repository. Users control local deletion; Wikimedia and other
providers control their own records and applicable request channels.

## Dependencies, risks, and contingencies

The repository owner coordinates dependency review. Review this inventory at
each release, after relevant upstream or storage changes, and at least every six
months. Record a concrete incompatibility and its resolution in the affected
architecture guide and changelog. The current repository does not maintain a
complete historical incident register.
Root [Dependabot configuration](../.github/dependabot.yml) proposes dependency
updates; maintainers still review compatibility and verification evidence.

| Dependency or risk                                                             | Effect if unavailable or changed                                                                                                                                                     | Maintenance and contingency                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MediaWiki, ResourceLoader, host Vue/Codex, editor adapters, and wiki templates | Critical for startup, dialogs, correct parsing, and protected writes. Host changes can break integration despite passing offline fixtures.                                           | Follow [MediaWiki technical announcements][tech-news] and upstream release notes; check the supported host/editor after relevant changes. Preserve source and use the host editor if the tool fails. Disable affected writes until targets and responses can be validated. |
| Citoid, Wayback, source publishers, English Wikipedia, and Wikidata metadata   | Lookup failures hinder generation and previews; unavailable evidence must not authorize a write.                                                                                     | Keep manual input and existing drafts available; retry a read or verify the source manually. Do not turn a failed request into a confirmed missing page or fabricated citation.                                                                                            |
| Browser storage, clipboard, and Web Locks                                      | Storage denial or quota limits can prevent recovery/staging; clipboard denial prevents copying. Web Locks are required for shared assessment queue mutations/submission in browsers. | Copy/export drafts before clearing storage. Use native copy where available. Use a supported browser for queued assessments; do not bypass the cross-tab lock. Session restore is not a reliable backup.                                                                   |
| Root npm toolchain and bundled assets                                          | Build/check failures block a validated release; bundled icons/entity data retain their own license obligations.                                                                      | Keep `package-lock.json` with the source, use the documented Node/npm versions and `npm ci`, review updates and [third-party notices](../THIRD-PARTY-NOTICES.md), then run the complete pipeline. Production reuses host framework modules.                                |
| GitHub repository, Actions, and release access                                 | Repository/CI outages delay collaboration and publication; existing browser installations can keep operating.                                                                        | Keep an independent source clone and local verification capability. Preserve release commits/tags and notices; rebuild artifacts from source. Only push a release tag when publication is authorized.                                                                      |
| Project contact and continuity                                                 | Loss of availability can delay maintenance, release access, and incident response.                                                                                                   | Recruit and document a substitute, test onboarding, and transfer repository access deliberately. No second maintainer or completed access transfer is currently recorded.                                                                                                  |

## Maintenance, handoff, and recovery

For each material change, identify the user problem and affected owner; prefer
existing host capabilities and shared project services. Update the relevant
architecture/workflow and this inventory when data or external operations change.
Follow the [verification and release procedure](development.md#verification-and-delivery),
including `npm run verify`; offline tests must not edit live wiki pages. Seek
another person's review where available. If none is available, record the
decisions and validation performed instead of claiming independent review.

A handoff includes the root source and lockfile, tool guides, generated-data
update procedures, screenshot provenance, third-party notices, known defects,
the latest verified commit/tag, installation destinations, and repository/CI
permissions. A new maintainer should reproduce a build and offline verification
from a fresh checkout and read each tool's write/recovery contract. Transfer
repository privileges through GitHub; review and revoke obsolete access.
Wikimedia authentication stays with each editor's account. Do not transfer
personal passwords, session cookies, CSRF tokens, or private drafts in the repo.

Keep an independent copy of versioned source and tags. Generated `dist` files
can be rebuilt; retain a release's scripts, license, and integrity manifest when
distributing a checkpoint. Article Creator's History export provides a portable
draft backup. There is no equivalent built-in export for the Article Assessor
queue; copy reviewed source/summaries to a controlled local file when needed.
Keep backups containing unsaved source private. No scheduled backup service or
completed restore drill is documented.

After an interrupted creator save, keep the tab open and inspect the recorded
checkpoint and current wiki pages. Resume only operations known not to have
started; running or uncertain operations need a fresh manual review. Assessment
failures retain unfinished queued drafts; category failures require retry in the
same tab before reload. Archive failures require **Reload preview** and a new
review of current source and destination pages. Follow the [creator workflow](vg-stub-creator/workflow.md)
and [assessor workflow](wpvg-assessor/review-workflow.md). Restoring browser state
or reinstalling an older script must never automatically replay uncertain writes.

## Discontinuation

When maintenance ends, update the root overview and tool status with a date,
reason, known limitations, and any supported replacement. Tell users how to
disable userscripts or remove personal wiki code; ask the responsible wiki
administrator to retire site-gadget installations. Keep the final source,
release checkpoint, documentation, and attribution available for reuse where
possible. Stop release automation only after the final distribution decision.

Give users time to export or copy drafts, then follow the storage removal
procedure above. Published wiki content remains governed by the wiki's history
and deletion processes. Document unresolved incidents and recovery limits in
the final handoff. Closing this repository cannot uninstall users' copies or
erase external providers' records.

## Cleanup decisions and retained contracts

The 2026-10-17 cleanup uses functional tool IDs and the runtime names in
[architecture](architecture.md#runtime-identity). The artifact basenames and root
version remain stable. These decisions distinguish retired integration identity
from source syntax and saved user work that still need support.

| Owner or candidate                                              | Decision and evidence                                                                                                                                                                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source Editor configuration aliases and raw preference fallback | Retired integration entrypoints. Only the validated pre-load configuration and versioned preference envelope are read. The new preference key begins with defaults; no automatic legacy record import or deletion occurs.                         |
| Source Editor backend interface                                 | Consumer contract moved to `app/contracts/editor-backend.ts`; textarea-local symbol registration remains a platform concern. Both editor and reference-management consumers retain accepted-source, selection, composition, and undo protections. |
| Creator/Assessor feature composition wrappers                   | Composition belongs in `app/interface.ts`. Feature modules consume contracts rather than selecting concrete platform adapters. Dialog mounts retain their existing lifecycle owners.                                                              |
| Duplicated action notification and matching host loading        | Consolidated into named library capabilities with shared tests. Tool messages, component choices, mount state, and write policy remain local. Revision Copy's different toast/fallback behavior remains local.                                    |
| Creator saved name-shape conversion                             | Retained at the validated input boundary. History restoration, imported drafts, and direct article processing can contain the older shape; canonicalization preserves row/citation identities and evidence.                                       |
| Assessor recognition of stored generated summaries              | Retained for existing reviewed drafts and queues. Known generated wording can be consolidated while custom reviewed summaries remain verbatim.                                                                                                    |
| Supported citation parameter aliases and opaque source          | Retained content behavior. Existing wiki syntax and unknown/opaque source are not dead code merely because their spelling is older.                                                                                                               |
| Pure public exports                                             | Retained intentional APIs for deterministic source, links, attribution, article, and assessment operations; documented in each architecture guide. Internal exports remain covered by unused-code checks.                                         |
| Captured article/game content and third-party credit            | Retained exact factual provenance, real game titles/URLs, Cacycle's wikEd credit, licenses, source revisions, image bytes, and capture-ledger evidence. Owned identity is not a reason to rename content or erase authorship.                     |

No feature receives a second startup, backing editor, draft store, or write owner.
Independent scripts bundle shared capabilities without combining their workflows.
Creator operation plans/checkpoints and Assessor queue locks/protected writes
remain separate because their review and recovery semantics differ.

## Release assessment

Assessment date: 2026-10-17. **Present** means an inspected implementation or
documented procedure exists; **Partial** means evidence covers only part of the
criterion; **Pending** identifies work without recorded completion. These
statuses do not assert public publication, a successful remote CI run, security
compliance, or WCAG conformance.

Repository and version metadata were updated on 2026-10-24; other criteria
retain their recorded assessment until separately reviewed.

| Release criterion                          | Status  | Evidence or remaining work                                                                                                                                                                              |
| ------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository and free license                | Present | Root [LICENSE](../LICENSE), [third-party notices](../THIRD-PARTY-NOTICES.md), and the configured [project repository][repository].                                                                      |
| Purpose, installation, and execution       | Present | Root [README](../README.md), four tool guides, and shared [development](development.md).                                                                                                                |
| Configuration and production documentation | Present | Tool configuration/workflow guides, runtime-host requirements, and release procedure.                                                                                                                   |
| Critical-function automated tests          | Present | `tests/source-editor/`, `tests/rev-copy/`, `tests/vg-stub-creator/`, and `tests/wpvg-assessor/`; root verification includes offline browser scenarios. A test suite is not evidence of every live host. |
| Continuous integration                     | Partial | [CI workflow](../.github/workflows/ci.yml) is configured for pushes and pull requests. A successful hosted baseline run is not recorded here.                                                           |
| Reproducible deployment                    | Present | Root lockfile, scripted builds, artifact checks, and annotated-tag [release workflow](../.github/workflows/release.yml). Publication still requires pushing an authorized tag.                          |
| Secrets and access management              | Partial | Browser writes use host authentication; release publication uses the workflow's `GITHUB_TOKEN`. Repository permissions, account recovery, and access review still need a maintainer handoff record.     |
| Identified maintainer/contact              | Partial | A named Kanade maintainer and dedicated project contact are not documented; review currently requires the project owner.                                                                                |
| More than one person able to maintain      | Pending | No additional maintainer or completed newcomer onboarding is documented.                                                                                                                                |
| Security review                            | Partial | Boundary validation, CSRF-token writes, stale-result protection, and protected-write regression tests exist. Dedicated human security review is not recorded.                                           |
| Basic accessibility verified               | Partial | Shared UI policy, keyboard behavior, translated accessible labels, and browser scenarios exist. Manual screen-reader review and a complete contrast/accessibility assessment are pending.               |
| Translatable interface text                | Present | All four tools have English, Simplified/Traditional Chinese, Japanese, and Russian catalogs.                                                                                                            |
| Substantial AI assistance recorded         | Present | This maintenance guide was prepared with OpenAI Codex assistance. The note below defines contribution transparency.                                                                                     |
| Data and privacy inventory                 | Partial | Storage, transmitted data, retention limits, and provider boundaries are documented above. This is not a legal assessment or completed privacy impact report.                                           |
| Backup and recovery                        | Partial | Source rebuild, creator history export, and write recovery are documented. Independent backup scheduling and a completed restoration exercise are pending.                                              |
| Declared lifecycle status                  | Present | Project and four tool statuses are listed above; discontinuation steps are documented.                                                                                                                  |

The 2026-10-17 identity and architecture cleanup was prepared with substantial
OpenAI Codex assistance. It adopts functional runtime names, a single validated
Source Editor configuration, fresh preference/cache stores, shared notification
and host-runtime capabilities, and enforced dependency directions. It preserves
four independent installations, backing-editor ownership, reviewed writes,
Creator recovery, Assessor locks/queues, and third-party provenance. Automated
agent review is separate from human review.

A recoverable source checkpoint was kept outside the repository before broad
edits. The baseline `npm run verify` passed dependency, formatting, lint,
TypeScript, unused-code, documentation, build, distribution, and all 1,661
unit/service checks. Offline browser checks reproduced six historical
Playwright failures and the separate Revision Copy loading assertion. The Tools
dialog now focuses its selected tab after initial layout; four-tab keyboard
expectations and shared-launcher module counts now match current behavior.
The corrected baseline passed 274 browser scenarios and Revision Copy's separate
runner, with 13 existing opt-in capture cases skipped.

Final `npm run verify` passed on 2026-10-17: all 1,710 unit/service tests, all
276 Playwright scenarios, and Revision Copy's separate seven-skin browser runner.
The same 13 opt-in documentation-capture cases remain skipped; no new skips or
suppression exemptions were added. Formatting, lint, full TypeScript checks,
the registry-based unused-code check, dependency/layout checks, and artifact
validation passed. Documentation validation covered 36 Markdown files and
117 screenshot records. The identity audit passed for 820 authored files and
830 files including distributions, with only exact reviewed evidence exceptions.
The temporary checklist and its audit exemption were removed. Repeated builds
produced identical manifests and hashes for exactly eight scripts plus
`LICENSE.txt` and `manifest.json`; the root version remains 0.1.0.

Integration also exposed a source-selection race: a scheduled metadata redraw
could restore a collapsed native range before a fresh Select All event arrived.
The new deterministic browser regressions failed before the fix in both
highlighting and plain-source modes. Scheduled redraws now capture the live
focused range only when DOM and native source still agree; explicit native,
tool, and history replacements retain their own range. The new regressions and
existing multiline cases passed 20 repeated checks, including replacement,
undo, redo, and focus, before the final full run. Current notification-tag and
versioned-preference fixtures were updated without weakening their behavior
assertions. Automated independent review checked configuration, storage
preservation, dependency enforcement, audit exceptions, and editor ownership.

Existing maintained screenshots and their capture ledgers are historical evidence
from the recorded builds. The identity cleanup preserves image bytes, article
revisions, source terms, dimensions, and checksums. No live documentation recapture
or wiki write is claimed. Source Editor views 10 and most language variants of
view 11 remain unavailable, as its image inventory records. Automated browser
fixtures remain separate from the live screenshot collection.

The subsequent 2026-10-17 launcher update places quick-access actions horizontally
with viewport wrapping and replaces Source Editor's panel shortcut with an explicit
one-click Format action. Page tools retain the settings panel. Accepted settings,
captured selections, source ownership, undo, IME composition, and asynchronous
stale-result checks remain protected. The final `npm run verify` passed all
1,726 unit/service tests, 279 Playwright scenarios, and Revision Copy's separate
seven-skin runner; the same 13 opt-in documentation cases remain skipped.
Automated independent review checked the direct action and its lifecycle.
English mobile view 11 was recaptured from native English Wikipedia with the
horizontal Format and Tools controls, unchanged source, and no wiki writes or
page errors. Its image and ledger were inspected together. The selected capture
succeeded; the capture command still reported the six unchanged historical failure
records in its ledger. The other historical captures and unavailable language
variants retain their recorded provenance.

The subsequent privacy cleanup, prepared with Codex assistance, removed local
filesystem and execution details, optional personal userscript metadata, and
collector contact metadata from the shared terminology report. Its collection
dates and source observations remain unchanged. Collector contact is supplied
through local configuration, and local environment files are excluded from Git.
Public attribution, screenshots, source revisions, and saved-work contracts
remain intact.

Human review, manual keyboard/screen-reader acceptance, supported-host contrast
review, live-host acceptance, and hosted CI/publication remain unperformed unless
separate evidence is recorded. No browser/assistive-technology combination is
claimed for an unperformed manual check. Offline automation can verify focus,
labels, keyboard interactions, and geometry but does not certify accessibility
conformance.

Substantial AI assistance should be identified in the contribution's commit,
description, or documentation. AI-produced work follows the same verification
and review process as other contributions; checks do not replace the
maintainer's judgment. Review generated code for data handling, source
preservation, write boundaries, and license provenance. Do not submit secrets
or private identifying material to an AI service. Automated agents working on
this project are not a second human reviewer, and human acceptance is not
claimed by this document. The documented build and maintenance workflows do not
require an AI provider.

[action-api]: https://www.mediawiki.org/wiki/API:Main_page
[citoid]: https://www.mediawiki.org/wiki/Citoid
[wayback]: https://archive.org/help/wayback_api.php
[tech-news]: https://meta.wikimedia.org/wiki/Tech/News
[repository]: https://github.com/For-Each-Next/Kanade
