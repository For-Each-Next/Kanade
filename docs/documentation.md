# Documentation guide

Last reviewed: 2026-10-21.

This is the shared writing authority for Kanade. It covers the project
overview, shared design guidance, each tool's Markdown, screenshots, and
provenance. [Development](development.md) owns coding, dependencies, checks, Git,
and releases. Apply these shared conventions directly while preserving verified
product behavior and attribution.

## Ownership and readers

| Document                | Purpose                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| Root `README.md`        | Explain the complete project, its tools, installation, overall schema, and contributor entrypoints. |
| `docs/development.md`   | Shared setup, coding, verification, Git, and release workflow.                                      |
| `docs/documentation.md` | Shared writing rules and each tool's documentation structure.                                       |
| `docs/architecture.md`  | Overall design and source ownership, with links to deeper tool internals.                           |
| `docs/ui-guidelines.md` | Common interface, state, and interaction policy.                                                    |
| `docs/maintenance.md`   | Project status, contact, dependencies, data handling, recovery, handoff, and release assessment.    |
| `docs/<tool>/README.md` | User entrypoint for one current tool.                                                               |
| `docs/<tool>/`          | Detailed configuration, workflow, architecture, data maintenance, screenshots, and provenance.      |

Keep documentation in English, with one overall root README and one user-facing
`README.md` in each tool's documentation directory. Tool guides link shared setup and policies instead of
copying them. Use a separate detailed guide only when it adds useful information.
Source Editor keeps source editing, formatting, and reference management in one
`docs/source-editor/` collection, with one architecture guide, one control-panel guide,
and one `images/README.md` inventory. Focused configuration and reference-name
topics remain beside them; CS1 maintenance and site guides belong in
`docs/source-editor/cs1/`.

When creating or substantively reviewing a guide, put `Last reviewed: YYYY-MM-DD.`
near its start. Update that date after checking its commands, links, and claimed
behavior; a formatting pass alone is not a review. Historical capture dates and
source revisions remain separate. Documents without a review date remain in the
maintenance backlog until their contents are checked.

Keep project status and contact visible from the root overview. The maintenance
guide owns the inventory and handoff information; tool entrypoints link to it.
Newcomers should be able to reach installation, configuration, architecture,
contribution tasks, and recovery guidance from the root README. Use the existing
annotated workflows and screenshots as practical examples alongside reference
documentation.

## Tool-guide template

Write `docs/<tool>/README.md` with this structure:

```markdown
# Tool display name

A short explanation of the user's task and what the tool changes.

## Features

The capabilities users need to recognize the tool.

## Install and open

Link ../../dist/<basename>.user.js and ../../dist/<basename>.min.js.
Link the root installation guide for build and installation methods.
State supported wikis, how to open the tool, and how to remove it.

## Use

Explain visible actions, review steps, and whether an action saves wiki edits.

## Reference

Link detailed guides, screenshots and their provenance,
docs/development.md, and docs/documentation.md.
```

Describe visible behavior before implementation. Use exact current labels and
artifact names. Explain saving, recovery, and limitations where they affect a
user's decision. Historical screenshots can retain old names when their capture
guide clearly identifies them; current installation instructions use current
names. Mark illustrative revision IDs as examples unless they identify a
recorded fixture or capture.

Link local distribution files until an actual published project release exists. Do not use
former per-tool repositories as installation sources. Keep technical details in
the architecture or maintenance guide that owns them.

The root overview lists the four independently installable tool pairs. Tool guides
describe their current tool and link the shared build and installation methods.
Use the stable artifact basenames: `source_editor`, `rev_copy`, `vg_stub_creator`,
and `wpvg_assessor`. Source Editor uses the `source-editor` registry identifier
and the pre-load `window.sourceEditorConfig` object.

## Headings, links, and examples

Use one descriptive level-one heading and logical subordinate headings. Keep
headings plain, without links. Add a contents list only when a long guide needs
one. Use readable code fences and tables; screenshots need meaningful alternative
text.

Link official documentation at the first body-text mention of a component or
concept. Use Markdown reference-style links with descriptive labels and place
their definitions at the end. Later mentions normally remain unlinked. Example:

```markdown
Use [buttons][codex-buttons] for actions.

[codex-buttons]: https://doc.wikimedia.org/codex/latest/components/demos/button.html
```

Local Markdown links are relative to the document containing them. Commands and
code-path examples start at the repository root: use `package.json`, `src/`,
`tests/`, `scripts/`, and `dist/`. Moving a guide does not add `../` to those code
examples. Avoid machine-specific checkout paths or instructions to enter an old
tool repository. Keep quoted interface labels and source content in their original
language. Follow the shared
[interface-language policy](ui-guidelines.md#interface-language) for authored
translations and quoted current labels.

## Design notes and maintenance

Explain the user problem, final behavior, affected ownership, lifecycle, and
verification in the nearest architecture guide. Add a separate design note only
when the decision needs one. State chosen behavior and meaningful tradeoffs;
remove obsolete proposals after implementation.

When guides conflict, follow the shared authority for that topic and retain
verified tool-specific details. Remove replaced
READMEs, duplicated policies, stale commands, dead installation links, and old
release instructions in the same change. Keep one authority for each topic.
Record notable user-facing changes and verification in the owning architecture
guide.

## Screenshots and attribution

Keep an `images/README.md` beside each maintained image collection. It is the
inventory and capture authority: record each image's purpose and visible state,
viewport and pixel ratio, interface language, capture procedure, and source
provenance. Use one collection and inventory per tool, including Source Editor's source-editing
and reference-management captures. Historical capture groups retain their own
provenance sections within that inventory. Link it from the tool README instead
of duplicating a separate screenshot guide.

Maintain exactly three documentation screenshot files per tool: one English
(`en`), one Simplified Chinese (`zh-Hans`), and one Traditional Chinese
(`zh-Hant`). Use continuous file indices in that language order:
`screenshot01.en.png`, `screenshot02.zh-Hans.png`, and
`screenshot03.zh-Hant.png`. When one view exists in all three languages, retain
that translated set. If the captures do not include one view in all
three languages, retain one representative image per language and document the
differing views in the inventory. Use canonical BCP 47 language-tag casing.
Offline browser-test screenshots are separate and do not count toward this limit.
File indices identify the maintained image's place in the collection; capture
profile IDs continue to identify the view and viewport. Keep existing filenames until
an intentional rename updates capture scripts, inventories, links, and the
complete language set together.

Preserve screenshot images, fixture metadata, and third-party notices when
reorganizing files. A path change is not a new capture. Each capture guide records
the image inventory, source URLs and revision IDs, language, dimensions,
simulated services, and applicable licenses. Distinguish live pages from offline
reconstructions and historical captures from current interfaces.

Maintained documentation screenshots use live Wikimedia pages, native host
modules, and actual read-only service responses. Retained offline fixtures and
browser-test snapshots remain test material with separate provenance; they do
not replace the maintained live collection. Capture scripts must prevent wiki
writes and retain the source text used by the live page.

For new or regenerated screenshots of tools usable across wikis, such as Source
Editor and Revision Copy, use the Wikipedia edition matching the interface
language: English on English Wikipedia (`enwiki`) and both Chinese variants on
Chinese Wikipedia (`zhwiki`). Capture Chinese-Wikipedia-only workflows,
including Article Creator's creation interface and Article Assessor, on Chinese
Wikipedia regardless of interface language. Existing images retain their
recorded sources and provenance until regenerated under this policy.

After relevant UI changes, regenerate and inspect affected images at their
actual size. For new responsive work, check mobile 375 × 667, narrow desktop
683 × 768, and normal desktop 1366 × 768 CSS pixels. Existing inventories retain
their recorded dimensions until regenerated. Record why any specialized capture
needs another size. Revision Copy's live captures and ledger retain their documented
profiles.

Update images and matching provenance together. Do not overwrite source
attribution with the project's CC0 dedication. Compact galleries link to
full-size images and the capture guide. Keep fixture and article licensing in
[third-party notices](../THIRD-PARTY-NOTICES.md) and the relevant source metadata.
When a tool README displays Wikipedia article text or imagery, add visible credit
next to the gallery: article title and source revision, contributor/history link,
article license, and the image inventory. Distinguish the project's CC0 interface
from captured article and media terms. For an offline reconstruction, identify
simulated results and modifications; a UI screenshot does not relicense them.

Before finishing a documentation change, check local links, command examples,
current labels, root-relative code paths, and Markdown formatting. When a new
rule describes future changes, label it as policy rather than claiming every
historical interface already implements it.

Run `npm run check:docs` after changing a gallery or capture collection. It
checks local Markdown links and verifies canonical image filenames, inventory
links, capture-ledger membership, recorded dimensions, and image hashes. Keep
each ledger's integrity metadata aligned with the actual image files; a rename
preserves capture provenance and hashes.
