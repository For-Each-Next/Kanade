# Terminology database maintenance

Last reviewed: 2026-10-17.

<!-- toc:start -->

## Contents

- [Catalogs and evidence](#catalogs-and-evidence)
- [Refresh procedure](#refresh-procedure)
- [Matching rules](#matching-rules)
- [Discovery and associations](#discovery-and-associations)
- [Runtime review](#runtime-review)
- [Verification and attribution](#verification-and-attribution)

<!-- toc:end -->

## Catalogs and evidence

The bundled company, platform, genre, and year vocabularies live in
`src/vg-stub-creator/domain/terminologies/`. Each definition contains a canonical label and
aliases, an optional Chinese Wikipedia article link, and its relevant category,
navigation-template, and stub-template associations. Runtime recognition remains
deterministic and does not download a terminology database when opening a dialog.

The maintenance collector uses the
[Chinese Wikipedia Action API](https://zh.wikipedia.org/w/api.php) and
[English Wikipedia Action API](https://en.wikipedia.org/w/api.php). It checks
article titles, redirects, opposite-language links, category titles in namespace
14, and template titles in namespace 10. It records collection evidence and
decisions in `docs/vg-stub-creator/data/terminology-sources.json`, separate from the runtime bundle.
Each collection revalidates the existing curated definitions and searches for
missing companies, platforms, genres, years, and associations. The report records
visited discovery categories, article candidates, canonical page and Wikidata
identifiers, revisions, resolved template heads, and linked game identifiers; it
does not contain article or template prose.

## Refresh procedure

Use the pinned dependencies and the project's supported Node.js version. After
the shared installation, set `KANADE_TERMINOLOGY_CONTACT` to an absolute HTTP(S)
URL where Wikimedia can contact the collection operator, following its
[User-Agent policy][user-agent-policy]. Export it in your shell or pass it to the
Node.js process; the collector does not load `.env` files automatically. Replace
the example below with your actual public contact page, then run from the project
root to gather evidence:

```sh
export KANADE_TERMINOLOGY_CONTACT='https://example.org/project/contact'
node scripts/vg-stub-creator/refresh-terminologies.mjs
```

Apply a complete collection to the source catalogs with:

```sh
node scripts/vg-stub-creator/refresh-terminologies.mjs --apply
```

Use `--cache-dir <path>` to retain successful raw responses and resume a collection.
Use a fresh directory for a fresh observation. API requests are read-only, serial,
batched, and sent with an identifying User-Agent containing the supplied contact
URL and `maxlag=5`. The collector rejects a missing or invalid contact URL,
credentials in that URL, and control characters before any uncached network
request. Valid cached responses remain usable without contact configuration.
The contact is sent to Wikimedia in the request header; it is not stored in the
cache or evidence report. The collector
follows continuation instead of treating the first API page as complete. It
finishes collecting evidence before updating catalog definitions; a failed
collection must not turn an unavailable title into a confirmed missing page.
Successful raw payloads, including template markup used to inspect navigation
heads, stay in the configured collection cache outside the runtime catalog and
evidence report. Keep that cache outside the repository when collecting live data.

## Matching rules

Keep the canonical terminology first in `aliases`, followed by supported aliases.
Preserve curated labels, regular-expression matching, display order, and the
meaning of existing navigation and stub templates. Add canonical page names and
verified equivalent-language names conservatively, avoiding collisions with other
definitions and redirects to unrelated sections or disambiguation pages.

Interpret terminology within the video-game field that owns it. For example,
`RPG` means a role-playing video game in the genre field. A generic or
disambiguation page for a standalone shorthand does not invalidate a curated
alias; check its associated video-game article, category, and stub template.

Use an existing Chinese article or a verified Chinese language link from the
matching English article. Omit `page` when no Chinese article is confirmed, so an
unlinked term remains plain text. An English-only article or category does not
justify inventing a Chinese title.

Apply categories describing games, rather than categories describing their
developers, publishers, or hardware. For example, a company's incorporation
category does not categorize its games. Resolve actual category and template
redirects and keep associations tied to the term they describe. Existence of a
stub template confirms its title; its relevance still depends on the curated
genre or platform association.

Incoming article redirects are collected as review candidates. They are not
automatically added as identity aliases: a person, product, or former organization
may redirect to a company article without naming the same company. Canonical
article titles and verified equivalent-language identities remain subject to
duplicate and collision checks.

## Discovery and associations

Company article discovery starts from
[電子遊戲開發公司](https://zh.wikipedia.org/wiki/Category:電子遊戲開發公司),
[電子遊戲發行商](https://zh.wikipedia.org/wiki/Category:電子遊戲發行商),
[各地電子遊戲公司](https://zh.wikipedia.org/wiki/Category:各地電子遊戲公司),
[手机游戏公司](https://zh.wikipedia.org/wiki/Category:手机游戏公司),
[網路遊戲營運商](https://zh.wikipedia.org/wiki/Category:網路遊戲營運商), and
[已結業電子遊戲公司](https://zh.wikipedia.org/wiki/Category:已結業電子遊戲公司).
Only descendants that still name company roles or classes are followed. Branded
subtrees containing games, personnel, or other company subjects are pruned.

Platform article discovery starts from
[電子遊戲機](https://zh.wikipedia.org/wiki/Category:電子遊戲機),
[家用游戏机](https://zh.wikipedia.org/wiki/Category:家用游戏机),
[掌上遊戲機](https://zh.wikipedia.org/wiki/Category:掌上遊戲機),
[家用電腦](https://zh.wikipedia.org/wiki/Category:家用電腦),
[街机主板](https://zh.wikipedia.org/wiki/Category:街机主板), and
[卡普空街機主機板](https://zh.wikipedia.org/wiki/Category:卡普空街機主機板).
Only typed hardware-class descendants are followed; platform game, accessory,
personnel, and other unrelated branches do not expand the search.

Both article searches follow category continuation and record visited categories
and namespace-0 article candidates. Traversal stops at three descendant levels
from each root. A search exceeding 500 categories fails instead of silently
applying a truncated collection; refine its roots before collecting again.

A new company or platform definition requires an existing Chinese article with
verified identity. When an English language link is present, the counterpart must
be an existing article in the matching company or platform field, and paired
Wikidata identifiers must agree when both are supplied. A Chinese-only article
without an English link needs a strong matching company-role or hardware category
on that article. Generic class and list articles are excluded. Resolved canonical
pages, Wikidata identifiers, labels, string aliases, and existing regular
expressions prevent duplicate definitions, including renamed or merged entities.
Existing curated display order and matching remain authoritative.

Platform discovery excludes generation and family overviews, console-ban topics,
individual game articles, and peripherals. A verified English console identity
can resolve incidental Chinese game-category metadata; Chinese-only hardware
candidates require consistent typed category evidence.

The collector examines the direct game-category roots on both Wikipedias:

| Catalog   | Chinese Wikipedia root                                                  | English Wikipedia root                                                                    |
| --------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Companies | [各公司电子游戏](https://zh.wikipedia.org/wiki/Category:各公司电子游戏) | [Video games by company](https://en.wikipedia.org/wiki/Category:Video_games_by_company)   |
| Platforms | [各平台電子遊戲](https://zh.wikipedia.org/wiki/Category:各平台電子遊戲) | [Video games by platform](https://en.wikipedia.org/wiki/Category:Video_games_by_platform) |
| Genres    | [各类型电子游戏](https://zh.wikipedia.org/wiki/Category:各类型电子游戏) | [Video games by genre](https://en.wikipedia.org/wiki/Category:Video_games_by_genre)       |
| Years     | [各年电子游戏](https://zh.wikipedia.org/wiki/Category:各年电子游戏)     | [Video games by year](https://en.wikipedia.org/wiki/Category:Video_games_by_year)         |

Direct subcategories can add game associations only when their established title
stem exactly matches the existing terminology's canonical article or verified
names. Broad containers, lists, company locations, and hardware classifications
do not establish an association. Replacement of an unavailable configured
category also requires membership in the relevant game-category root; a plausible
title or an existing category alone is insufficient. Confirm category targets and
resolve category redirects before recording an association.

Direct article members of
[Category:電子遊戲類型](https://zh.wikipedia.org/wiki/Category:電子遊戲類型)
can supply new genre definitions. Each candidate requires an existing Chinese
article and a verified matching English video-game genre identity. Check the
canonical labels, string aliases, and existing regular expressions before adding
it, so a different language variant or full genre name does not duplicate a
curated shorthand. Existing curated display order and matching remain authoritative.

New platform and genre definitions receive the generic video-game stub template
only after its Chinese namespace-10 page is confirmed. More specific stub-template
associations remain curated.

Direct year-root subcategories matching an exact four-digit
`YYYY年电子游戏` title can supply missing year definitions. These use the
`YYYY年` label and numeric alias with the confirmed games category. These
discovered year definitions remain unlinked; category discovery does not invent
a year article.

Company navigation candidates come from
[Category:电子游戏公司导航模板](https://zh.wikipedia.org/wiki/Category:电子游戏公司导航模板).
An automatic association requires an existing namespace-10 template, actual
Navbox-family transclusion, and a template name matching an established company
name, optionally followed by a game suffix. Its explicit navigation head must
resolve to the company's canonical Chinese article. At least one linked existing
game must belong to that company's confirmed games category. A template's
existence, category membership, or company link alone does not establish that it
navigates games.

Hardware navigation templates are excluded from automatic game associations.
Even templates named for an exact platform can primarily navigate consoles,
peripherals, services, or game-list pages. Genre navigation templates and sidebars
likewise do not automatically apply to individual games. Preserve relevant curated
associations and review the proposed related pages before saving.

## Runtime review

Related-page checks remain live and subject to editor review. A transport failure,
MediaWiki error, or malformed response is an unavailable check, not proof that a
page is missing. Show the failure and preserve the last reviewed rows.

The browser category cache retains confirmed existing pages for up to 24 hours
and confirmed missing pages for up to one hour. Persisted evidence has a validated
version and observation time; unrelated saves do not renew old observations.
Legacy or malformed cache data is discarded without changing drafts or history.

Redirect refreshes retain editor checkbox selections and staged edits. Checks
match titles rather than response-array positions and discard results after
relevant input changes or disposal. Review and save confirmation remain required.

## Verification and attribution

Inspect source and evidence diffs after a refresh. Run `npm run verify`, then
regenerate affected images following [screenshots](images/README.md) and inspect every
image affected by the changed UI. Automated tests use offline fixtures and never
contact or modify Wikipedia. Publishing remains a separate maintainer action.

The catalogs and evidence report contain factual API metadata, not copied article
or template prose. Raw response caches may contain source template markup and
retain the source's terms.
Wikipedia contributors and Wikimedia project data retain their applicable terms
as described in [third-party notices](../../THIRD-PARTY-NOTICES.md). Collector code and
generated data remain separate for licensing purposes.

The request strategy follows MediaWiki's [API etiquette](https://www.mediawiki.org/wiki/API:Etiquette),
[category-members API](https://www.mediawiki.org/wiki/API:Categorymembers), and
[language-links API](https://www.mediawiki.org/wiki/API:Langlinks). Navigation
evidence also uses the [links API](https://www.mediawiki.org/wiki/API:Links),
[templates API](https://www.mediawiki.org/wiki/API:Templates), and
[revisions API](https://www.mediawiki.org/wiki/API:Revisions).

[user-agent-policy]: https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy/en
