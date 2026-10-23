# Contributor instructions

Treat this repository as one project. Read [development.md](docs/development.md), the shared
[architecture](docs/architecture.md) and [UI guidelines](docs/ui-guidelines.md),
and the affected tool's guide before changing their areas. `docs/development.md` is the
authoritative coding and verification policy. Follow
[documentation](docs/documentation.md) for shared and tool-specific writing rules.
Use the shared guides as the authority when tool-specific instructions conflict.

Keep dependencies, versioning, Git, and distribution at the root. Source belongs
in `src/<tool>/`, tests in `tests/<tool>/`, and detailed documentation in
`docs/<tool>/`. Code used by multiple tools belongs in the shared `src/library/`
folder, with shared regression tests in `tests/library/`. Each tool bundles the
library code it uses into its standalone script. Source Editor uses `source-editor`
for its directories and registry identifier. It owns the editor and reference
manager through one startup and shared formatting/reference services. Preserve
the four functional tool identifiers and artifact basenames documented in
`docs/architecture.md`. Build the four tools as independent installation scripts.
Do not introduce nested package manifests, lockfiles, Git repositories, or
distribution directories.

Owned runtime names follow `kanade.<tool>.startup`,
`kanade.quick-access.v1`, and `kanade-<tool>-<purpose>` for DOM identity. Source
Editor accepts only the pre-load `window.sourceEditorConfig` object. Newly named
preferences and disposable caches start with validated defaults under
`kanade:<tool>:<purpose>:v<schema>`; preserve user-authored history, drafts,
queues, and recovery records through their documented functional contracts.

Preserve working source-editing behavior, explicit review/save actions, stale
result protection, host ownership, and third-party attribution. Generated files
come from their sources. Run the checks appropriate to the change and the complete
verification pipeline for material changes as documented in `docs/development.md`.
