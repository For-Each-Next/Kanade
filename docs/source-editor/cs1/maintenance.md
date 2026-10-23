# CS1 Data Maintenance

This guide defines the workflow shared by Source Editor's English and
Chinese Wikipedia metadata and validation refreshes. Read it together with the
site-specific guide:

- [English Wikipedia CS1 maintenance][enwiki-cs1] describes the primary English
  TemplateData metadata and enwiki rules.
- [Chinese Wikipedia CS1 maintenance][zhwiki-cs1] describes the zhwiki comparison
  snapshot, additional parameter ordering, and local rules.

<!-- toc:start -->

## Contents

- [Authority and safety](#authority-and-safety)
- [Refresh citation TemplateData](#refresh-citation-templatedata)
- [Compare site TemplateData](#compare-site-templatedata)
- [Review the Lua rules](#review-the-lua-rules)
- [Finish and verify](#finish-and-verify)

<!-- toc:end -->

## Authority and safety

Use HTTPS for every request. Keep ad hoc downloads outside the package and
never redirect them over committed files. Do not scrape rendered template pages
for parameter metadata. The TemplateData API resolves redirects and returns
canonical titles, parameter order, aliases, and types as structured data.

The committed validators provide conservative, immediate editor feedback. Each
wiki's live CS1 Lua modules remain authoritative for complex date ranges,
deprecated combinations, class-specific restrictions, and parameter
interactions.

## Refresh citation TemplateData

Run the authored-data updater from the project root:

```shell
node scripts/source-editor/update-citation-template-data.ts
```

The updater reads the supported set from `src/source-editor/domain/templates.ts` and requests
the corresponding templates from English and Chinese Wikipedia in bounded
batches. For each template, its cached `paramOrder` uses English TemplateData
first, followed by English canonical parameters omitted from that order, then
unique entries from the complete Chinese order. Chinese entries never move an
English parameter ahead of its English position.

English aliases and date types remain the metadata source when English
TemplateData is usable. If it is absent or unusable, the updater uses Chinese
ordering, aliases, and date types. Missing Chinese templates are allowed;
templates unusable on both sites stop the refresh before any generated file is
written. API or download failures also stop the refresh.

The updater then rewrites the modules and index under
`src/source-editor/config/citation-template-data/generated/`. Do not hand-edit those snapshots
or duplicate the supported-title list in documentation. Generic Cite templates
outside the supported set continue to use the current wiki's runtime
TemplateData cache.

Review the complete generated diff for:

- missing, obsolete, or unexpectedly renamed template modules;
- canonical-title and English-first parameter-order changes;
- appended Chinese-only parameter names;
- removed or moved parameters;
- alias additions, removals, and ordering changes; and
- changes to parameters typed as dates.

Large removals usually indicate an incomplete or unexpected API response.

## Compare site TemplateData

Use a manual TemplateData request only to compare sites or troubleshoot the
updater. Set the language and titles according to the site-specific guide. This
abbreviated request shows every required API option:

```sh
CS1_LANGUAGE=zh
CS1_TITLES='Template:Citation|Template:Cite web|Template:Cite book'

curl --fail --location --silent --show-error \
  --get "https://${CS1_LANGUAGE}.wikipedia.org/w/api.php" \
  --data-urlencode 'action=templatedata' \
  --data-urlencode 'format=json' \
  --data-urlencode 'formatversion=2' \
  --data-urlencode 'redirects=1' \
  --data-urlencode 'includeMissingTitles=1' \
  --data-urlencode "titles=${CS1_TITLES}"
```

Verify that the response includes every requested page, resolves each expected
canonical title, and reports no missing title. Compare `paramOrder`, all
canonical parameters and aliases, and parameters whose TemplateData type is
`date`.

Never copy a manual response over generated citation data. Rerun the updater to
refresh English and Chinese TemplateData together. Apply intentional site-rule
differences only at the destination defined by the relevant site guide.

## Review the Lua rules

With `CS1_LANGUAGE` still set for the target wiki, download the whitelist and
date-validation sources separately:

```sh
curl --fail --location --silent --show-error \
  --get "https://${CS1_LANGUAGE}.wikipedia.org/w/index.php" \
  --data-urlencode 'title=Module:Citation/CS1/Whitelist' \
  --data-urlencode 'action=raw'

curl --fail --location --silent --show-error \
  --get "https://${CS1_LANGUAGE}.wikipedia.org/w/index.php" \
  --data-urlencode 'title=Module:Citation/CS1/Date_validation' \
  --data-urlencode 'action=raw'
```

Compare them with the target file under `src/source-editor/domain/validation/` and with
`src/source-editor/domain/source-validation.ts`. Apply the whitelist and date semantics in the
site-specific guide.

## Finish and verify

After updating authored data or rules:

1. Add focused tests under `tests/source-editor/`.
2. Inspect the complete data and site-rule diffs, especially unexpected
   removals, canonical titles, parameter order, aliases, and date fields.
3. Follow the project [verification and release instructions][development], including
   artifact-header inspection when a build is required.

[enwiki-cs1]: enwiki.md
[zhwiki-cs1]: zhwiki.md
[development]: ../../development.md
