# Development guide

Last reviewed: 2026-10-21.

This is the authoritative development guide for Kanade.
[Documentation](documentation.md) defines shared and tool-specific writing rules.
All tools share one root package and lockfile and the version in `package.json`.
Git ownership stays at the root. Shared policy takes precedence over a
conflicting tool guide. Preserve product behavior, user-authored work, and
license requirements while applying these conventions.

Documentation, reproducible builds, review, accessibility, and maintenance are
part of delivery. The
[maintenance guide](maintenance.md) records ownership, external dependencies,
data handling, recovery, and remaining gaps. Use existing Wikimedia capabilities
before adding a new service or runtime, and describe the ongoing maintenance cost
of a new dependency in the affected architecture guide.

## Setup and commands

Use Node.js `^24.15.0 || >=26.0.0` and npm 11 or newer. Run every command below
from the repository root:

```sh
npm ci
npx playwright install chromium
```

| Command                      | Purpose                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm run check:dependencies` | Validate the root dependency tree and project structure.                                                  |
| `npm run check`              | Check formatting, lint, TypeScript, unused files and dependencies, and documentation links.               |
| `npm run check:unused`       | Check unused files, internal exports, and dependencies, unresolved imports, and duplicate exports.        |
| `npm run check:docs`         | Check local Markdown links, screenshot inventories, capture-ledger membership, dimensions, and integrity. |
| `npm run check:identity`     | Audit authored paths/content and rebuilt distributions against exact provenance/content exceptions.       |
| `npm test`                   | Run offline unit, DOM, and service tests.                                                                 |
| `npm run build`              | Build every tool into the root `dist`.                                                                    |
| `npm run check:dist`         | Validate the generated artifact set, metadata, and integrity.                                             |
| `npm run test:ui`            | Build and exercise tools in offline Playwright fixtures.                                                  |
| `npm run verify`             | Run the complete verification pipeline.                                                                   |

Use tool directory names for focused tests: `source-editor`, `rev-copy`,
`vg-stub-creator`, and `wpvg-assessor`. These are also the registry identifiers;
retired command aliases are not accepted. Builds generate the complete
distribution: four independently installable tool pairs. Source Editor uses
`source_editor` for its artifact basename.
For example:

```sh
npm run check
npm test -- source-editor
npm run build
```

Before a build, `npm run check:identity -- --source-only` audits authored paths
and content. The default identity check also requires and scans `dist/`.
`scripts/identity-policy.json` records each permitted exact fragment with its file
and factual reason. Keep exceptions narrow: real content, third-party attribution,
historical capture evidence, host interoperability, and current capability names
do not justify exempting a whole source or documentation tree. Verification runs
the authored audit before build and the complete audit against rebuilt artifacts.

Dependencies belong only in the root `package.json`. Update them from the root
with `npm install`, review `package-lock.json`, and commit both files together.
Do not create nested packages, lockfiles, `node_modules`, or Git repositories.
Vue and Codex packages provide development types and offline fixtures; production
loads MediaWiki's runtime modules.

[Dependabot](../.github/dependabot.yml) proposes weekly root npm and GitHub
Actions updates. Review release notes, licensing, API compatibility, and both
manifest and lockfile changes; run the complete verification pipeline before
accepting an update. Revisit external runtime and service dependencies at each
release and after an upstream change affects a workflow.

## Code and design

Read [architecture](architecture.md), [UI guidelines](ui-guidelines.md),
and the affected tool's guide before changing their areas. Use TypeScript,
ordinary functions, explicit interfaces, relative imports, and lowercase
kebab-case source names. Keep startup in `src/<tool>/app/`, deterministic rules
in `domain/`, host adapters in `platform/`, and interface behavior in `features/`.
Every tool follows the same [directory template](architecture.md#ownership)
under `src/<tool>/`; add `i18n/`, `shared/`, `config/`, and `types/` only when
needed. Source Editor's editor, formatting, and reference-management features share one
composition root, language runtime, source rules, and backing-editor contract.
Do not create separate editor/citation tool trees or independent launchers.

Enforce the [dependency matrix](architecture.md#dependency-direction) with root
ESLint rules. Features consume contracts and injected workflows; platform
adapters implement consumer contracts. Neither imports composition or the other
layer. Domain rules and public APIs remain pure. Resolve validated configuration,
wiki policy, adapters, and service lifetimes at composition.

Use the [runtime identity contract](architecture.md#runtime-identity) for startup,
owned DOM, configuration, and newly named storage. Retired configuration globals
and product aliases have no fallback. Do not import or delete retired browser
records automatically. Preserve existing user-authored history, drafts, reviewed
queues, and uncertain-write checkpoints unless an explicit replacement design
protects their recovery and export paths.

Put capabilities used by multiple tools in `src/library/<capability>/` and their
tests in `tests/library/`. Tools may import this library; they do not import
another tool's implementation. Keep library imports independent of tool startup
and workflows. The root build includes required library code in each standalone
script, preserving separate installation.

Keep intentional public APIs in `src/<tool>/index.ts`. Unused-export checks
include browser entrypoints and internal modules; only those public API files
are exempt from export-use checks.

`knip.config.mjs` derives browser/public entrypoints and injected Vue templates
from the tool registry. CLI roots come from package commands and the explicitly
maintained capture, fixture-refresh, and offline Revision Copy runners; imported
helpers are checked through their callers. Unregistered templates and unused
scripts remain candidates for the unused-file check.

Use Codex's default component appearance and documented attributes. Do not
override its text size, colors, borders, spacing, focus, or button visuals.
Additional Codex-interface CSS is only for column structure, its responsive
layout, and owned dialog width constraints that retain Codex's viewport and
mobile behavior; editor source highlighting is a separate surface. The shared
UI guide defines this boundary for every tool.

Follow [input-completion behavior](ui-guidelines.md#completing-an-input)
for queries and checks: paste after value update, single-line Enter, or blur;
preserve multiline newlines and IME composition, deduplicate completed values,
and keep source application and live wiki saves explicit.

Keep `src/<tool>/index.ts` free of browser startup side effects.

Put wiki-specific content rules behind explicit domain policy interfaces. Resolve
the policy from the target wiki/project identity at the platform boundary, not
from the interface language. Pass it to shared transformations and preserve input
when a site's rules are unknown. For example, citation date presentation may
differ between `enwiki` and `zhwiki` while the user's UI locale stays unchanged.
Preserve the date's precision rather than inventing a missing month or day.

Give a capability a named owner rather than accumulating generic utilities.
Pass external operations through narrow contracts so domain rules can run
offline. Validate API and storage data at the boundary, preserve editor text,
discard stale asynchronous results, and clean up only the tool's own mounts,
listeners, timers, and subscriptions. See the tool's architecture notes for
source-editing, attribution, review, and write-conflict invariants.

Use a short header in authored source/build modules with `@file`, purpose, and
contents. Keep it accurate when ownership changes; do not list every helper.
JSON, lockfiles, fixture wikitext, images, and verbatim licenses keep their native
formats. Generated snapshots document their source and update procedure in the
owning guide.

For a design change, explain the user problem, expected behavior, affected owner,
data and lifecycle implications, and verification in the nearest architecture
guide. Add a separate design note under `docs/` only when the decision has enough
scope to need one. Record chosen behavior and meaningful tradeoffs; remove
obsolete proposals once implemented.

## Writing and screenshots

Follow [documentation](documentation.md) for the root overview, each tool's
Markdown, first-mention official links, and screenshot provenance. It contains
the authoritative writing policy and reusable tool-guide structure.

After relevant UI changes, regenerate and inspect affected images following
the tool's capture guide and [shared screenshot policy](documentation.md#screenshots-and-attribution).
Use the [UI guidelines](ui-guidelines.md) for layout, state lifetime, input
completion, and request feedback when adding or revising interfaces.

## Verification and delivery

For a material change, ask another contributor to review behavior, ownership,
input validation, data handling, attribution, and the verification evidence.
When a second reviewer is unavailable, record the chosen behavior, tradeoffs,
checks, and remaining limitations in the commit or pull request. Automation and
AI assistance do not establish that human review has occurred.

Record substantial AI assistance in the commit, pull request, or owning guide,
including its scope and how the result was checked. Keep credentials, unpublished
drafts, and personal data out of prompts and public review logs. Choose recurring
development services with a documented replacement path, so another maintainer
can continue with ordinary repository tools.

Run focused checks while iterating and `npm run verify` for material changes.
Use meaningful regression tests for changed behavior. Offline tests must not
edit live Wikimedia pages. Browser scenarios use local host/runtime fixtures;
documentation capture may read live pages only where its guide says so.

Before releasing interface changes, check keyboard-only use, labels and feedback
with a screen reader, long translations, and the viewports in the
[UI guidelines](ui-guidelines.md). Record manual checks separately from automated
browser tests and leave unperformed checks visible in the maintenance assessment.
For API or storage changes, update the data inventory, validate untrusted values,
preserve CSRF-token and revision-conflict protections, and test failure recovery.

Generate distributions from source; never hand-edit them. Every tool emits exactly
one readable `<basename>.user.js` and one compact `<basename>.min.js` directly
under root `dist`, giving four pairs and eight scripts in total. Build each tool
from its own browser entrypoint and the shared metadata registry. Preserve each
tool's page-context checks and duplicate-startup guards. Scripts with bottom-right
actions include the shared quick-access registration code without starting another
tool. Creator and Assessor use native MediaWiki page tools.
There are no tool-local distribution
directories and no `.gadget.js` artifact. Shared license or integrity metadata may accompany the
scripts. Both forms retain the `@license CC0-1.0` SPDX identifier, applicable
userscript metadata, and the single project version. Readable `.user.js` files
include the complete CC0 dedication; compact `.min.js` files omit that legal
body. `dist/LICENSE.txt` also retains the complete dedication generated from the
root `LICENSE`. This applies to all four tools.
Compact scripts keep their executable JavaScript on one physical line, with
metadata, nowiki guards, and required notices on separate lines. Newlines in
runtime strings are escaped without changing their contents. All executable
code, including strict-mode directives, stays inside an anonymous immediately
invoked function so pasting a compact script cannot change surrounding code's
strict mode. The compact build
minifies registered Vue/HTML templates and both registered and imported CSS;
significant preformatted text and CSS whitespace remain intact. Keep static
styles in owned `.css` files so they pass through that build step.
Both forms preserve the required third-party notices for their bundled material
from the root `THIRD-PARTY-NOTICES.md`. Each distribution declares its bundled
notice sections in `scripts/tools.mjs`. Generation fails if a required section is missing. Documentation,
test-fixture, screenshot, fetched-content, and development-dependency notices
remain in the repository and are not copied into installation headers.

Record notable changes and verification in the owning architecture guide. Prepare
one release for the whole project: update the root package and lockfile version,
prepare release notes, build, inspect artifacts, and run
verification. The root [CI workflow](../.github/workflows/ci.yml) validates the
project and retains generated artifacts. The
[release workflow](../.github/workflows/release.yml) runs on pushed `v*` tags,
checks that the annotated tag matches the root package and lockfile version and
points to the triggering commit, and runs the complete verification pipeline
before publishing a GitHub release. It attaches
all eight generated scripts, `LICENSE.txt`, and `manifest.json`, with generated
release notes; prerelease versions produce GitHub prereleases. A local build
does not publish files or edit live wiki pages.

## Version control and releases

Use `trunk` as the default branch. The current root version is 0.1.0; local
cleanup does not publish a release. Preserve a recoverable source checkpoint
before broad changes. Once a remote and baseline are established, start each
task from current `trunk` on a branch such as
`feat/reference-search`, `fix/editor-selection`, `docs/install-guide`, or
`refactor/shared-formatting`. Keep intermediate task commits on that branch.

Complete the task, update its documentation and tests, and run the required
verification before merging. Squash the completed task into one final validated
commit on `trunk`; do not copy its intermediate commits onto `trunk`.
Use [Conventional Commits][conventional-commits] messages, for example `feat(source-editor): manage references`
or `fix(rev-copy): retain the displayed revision`. Choose `feat`, `fix`,
`docs`, `refactor`, `test`, `build`, `ci`, or `chore` according to the
change. An ordinary task does not automatically bump the version or publish a
release.

When a new version is requested, align the root package, lockfile, dated
release notes, and rebuilt artifact metadata, then verify them together.
Create the final release commit using the requested version, for example
`chore(release): 0.2.0`, and add an annotated `v0.2.0` tag to that exact
commit. The tag is the release checkpoint, not a tag on an earlier task commit.
Push a release tag only when publication is requested: pushing the matching tag
starts automatic verification and GitHub release publication. A local release
commit and tag do not publish anything. Carry out already-authorized release
steps without adding another approval round.

## Adding a tool

Add its source under `src/<tool>/`, tests under `tests/<tool>/`, and a user guide
under `docs/<tool>/README.md`. Register its browser entrypoint, stable artifact
basename, and supported userscript hosts in `scripts/tools.mjs`. Add helpers
under `scripts/<tool>/` only for behavior that the shared build and checks cannot
own. Reuse the root dependency installation and version, then update the root
README's tool table and verify the new tool plus the full project.

[conventional-commits]: https://www.conventionalcommits.org/en/v1.0.0/
