# Configuration

Last reviewed: 2026-10-17.

Article Creator targets Chinese Wikipedia article creation, with an English
Wikipedia launch path. Runtime capabilities are composed in `src/vg-stub-creator/app/main.ts`;
the source modules below contain the wiki-specific rules and catalogs.

<!-- toc:start -->

## Contents

- [Supported pages and language](#supported-pages-and-language)
- [Article data and wiki rules](#article-data-and-wiki-rules)
- [Platform adapters](#platform-adapters)
- [Browser persistence](#browser-persistence)
- [Verification settings](#verification-settings)

<!-- toc:end -->

## Supported pages and language

The English Wikipedia launcher appears on existing main-namespace article
views. It opens a Chinese Wikipedia creation page with the source metadata.
Install the tool on both wikis to use that route.

The Chinese Wikipedia creator supports main-namespace and draft pages, plus
the signed-in editor's own user page and subpages. Use a missing-page view or
a source-edit page to launch the dialog. Existing checkpoints can resume their
confirmed-safe pending actions on the matching article view.

Interface language follows MediaWiki's `wgUserLanguage`. `zh`, `zh-cn`,
`zh-hans`, `zh-my`, and `zh-sg` use Simplified Chinese. `zh-hant`, `zh-hk`,
`zh-mo`, and `zh-tw` use Traditional Chinese. Japanese (`ja`) and Russian (`ru`)
include regional variants such as `ja-JP` and `ru-RU`. Other unsupported languages
fall back to English. Generated article-language text is separate from interface
language selection: the target article remains Chinese and generated edit
summaries remain English in every supported interface language.

## Article data and wiki rules

- `src/vg-stub-creator/domain/terminologies/companies.ts` defines company identities, aliases,
  links, and related categories.
- `src/vg-stub-creator/domain/terminologies/genres.ts` defines genres and related article tags.
- `src/vg-stub-creator/domain/terminologies/platforms.ts` defines platforms and related metadata.
- `src/vg-stub-creator/domain/terminologies/years.ts` defines release years and categories.
- `src/vg-stub-creator/domain/citations/data/` defines supported citation templates, parameter
  order, aliases, and source-specific cleanup.
- `src/vg-stub-creator/domain/wiki.ts` defines generated article-language text and structures.
- `src/vg-stub-creator/domain/config/wiki-pages.ts` defines target-wiki project page titles.
- `src/vg-stub-creator/domain/wiki-titles.ts` contains English and Chinese namespace names and
  aliases used when resolving or constructing titles.

Keep the canonical identity first in each terminology entry's `aliases`. Omit
`page` for an identity that should stay unlinked. Unknown citation templates
retain their original parameter order. Update focused fixtures when changing
normalization or generated article text.

## Platform adapters

`src/vg-stub-creator/platform/network/` acquires English Wikipedia and Wikidata metadata,
localized Steam names, Citoid data, and fallback source references. Keep remote
response validation and acquisition behavior in those adapters.

`src/vg-stub-creator/platform/mediawiki/` resolves titles, categories, and navigation templates,
renders previews, and performs reviewed wiki writes. MediaWiki's current user
session supplies authentication. API clients and their translated failures are
composed in `src/vg-stub-creator/app/main.ts`.

Production expects the host wiki to provide Vue and Codex through ResourceLoader,
along with MediaWiki API and utility modules. npm copies are used for local types
and offline tests.

## Browser persistence

Form history keeps up to 20 entries in local storage, alongside a temporary
draft. Use the History dialog to restore, import, export, or delete entries.
Storage is scoped to the current browser profile and wiki origin.

The existing functional history, temporary-draft, and recovery keys are retained;
see the [storage inventory](../maintenance.md#data-and-storage-inventory) for exact
names. Export History before replacing an installation or clearing site storage.
Disable the previous script, install the replacement, and reload. Replacing a
script does not make an uncertain write safe to repeat.

Tab-scoped session storage holds preview forms, moved-page edit text, pending
save checkpoints, progress, and review-link state. Keep the tab available when
recovering an interrupted save. An uncertain operation needs review of the
affected wiki page before retrying.

## Verification settings

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when browser tests should use a specific
installed Chromium executable. The default is Playwright's managed Chromium.
Test output is temporary and cleaned after the run. CI uses the tracked Node.js
baseline and installs its own Chromium.

Run `npm run verify` after changing data, platform behavior, dialogs, or build
configuration. Automated checks use local fixtures and mock external services;
they do not save edits to a live wiki.
