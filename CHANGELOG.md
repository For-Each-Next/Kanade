# Changelog

Notable changes to Kanade are recorded here. All four tools share one project
version and are built as independently installable scripts.

## 0.1.1 - 2026-10-24

### Fixed

- **Article Assessor:** generated new-page registration summaries now fit within
  255 UTF-8 bytes, including dates and the script marker. Longer summaries list
  article links first and count files, categories, templates, modules, drafts,
  and other pages. Articles that do not fit are counted without cutting links.
- Compact summaries recognize Chinese namespace aliases and consolidate defaults
  retained in older staged drafts. Custom reviewed summaries remain intact,
  including custom text that exceeds the automatic byte budget.

## 0.1.0 - 2026-10-23

Initial release of Kanade.

### Added

- **Source Editor:** wikitext highlighting, article and citation formatting,
  reference inspection and management, and regular-expression replacements with
  explicit preview, apply, and undo actions.
- **Revision Copy:** page, exact-revision, and section links, plus translation
  and copying attribution for edit summaries and talk pages.
- **Article Creator:** Chinese Wikipedia video-game article drafts, citation
  metadata, source previews, related-page operations, form history, and save
  recovery.
- **Article Assessor:** Chinese Wikipedia video-game assessments, staged review
  queues, one-click submission of current and staged assessments, category
  previews, and new-page registration and archiving.
- English, Simplified Chinese, Traditional Chinese, Japanese, and Russian
  interfaces for all four tools.
- A reusable syntax-highlighting attachment for native wikitext textareas,
  with explicit refresh and disposal methods.
- Shared wikitext parsing, syntax styles, title handling, locale resolution,
  citation metadata, logging, and editor integration capabilities.
- One root build and verification pipeline, four readable/compact script pairs,
  distribution checksums, licensing notices, and documented screenshot provenance.
