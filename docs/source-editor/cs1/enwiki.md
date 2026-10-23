# English Wikipedia CS1 Maintenance

Use the shared [CS1 data maintenance guide][cs1-maintenance] for the automated TemplateData
refresh, comparison requests, Lua review, and diff checks. This file records
the English Wikipedia sources and interpretation rules.

Last live HTTPS review: 2026-07-26.

<!-- toc:start -->

## Contents

- [Authoritative sources](#authoritative-sources)
- [TemplateData destination](#templatedata-destination)
- [Whitelist and date semantics](#whitelist-and-date-semantics)

<!-- toc:end -->

## Authoritative sources

- [TemplateData API help][templatedata-api]
- [Supported templates][supported-templates]
- [CS1 implementation][cs1-module]
- [Parameter whitelist][cs1-whitelist]
- [Date rules][cs1-date-validation]

Use `CS1_LANGUAGE=en` with the shared download commands.

## TemplateData destination

English TemplateData supplies the primary parameter order, aliases, and date
metadata. The updater appends parameters found only in Chinese TemplateData
to that order. Run it from the shared guide; it writes the modules under
`src/source-editor/config/citation-template-data/generated/` and their index as one generated
set. Do not edit either by hand.

Review generated diffs especially carefully for title casing, deleted or moved
parameters, and alias changes.

## Whitelist and date semantics

Compare the downloaded Lua sources with `src/source-editor/domain/validation/enwiki.ts` and
`src/source-editor/domain/source-validation.ts`.

- `true` is supported, `false` is supported but deprecated, `tracked` is
  supported and tracked, and `nil` is unsupported.
- For numbered creator parameters, CS1 replaces every digit sequence with `#`
  before checking the numbered whitelist. The validator must not impose the
  finite slot count present in TemplateData.
- Preprint classes such as arXiv, bioRxiv, CiteSeerX, medRxiv, and SSRN use
  restricted parameter sets. CS1 remains authoritative for class-specific
  combinations.
- Several citation classes add unique parameters beyond the shared basic table.

The local date validator intentionally recognizes only clear, common CS1 forms
for immediate editor feedback. It permits `n.d.` and `nd` only for `date`. Live
template and module validation remains authoritative for complex ranges and
unusual date syntax.

[cs1-maintenance]: maintenance.md
[templatedata-api]: https://en.wikipedia.org/w/api.php?action=help&modules=templatedata
[supported-templates]: https://en.wikipedia.org/wiki/Template:Citation_Style_documentation/cs1
[cs1-module]: https://en.wikipedia.org/wiki/Module:Citation/CS1
[cs1-whitelist]: https://en.wikipedia.org/wiki/Module:Citation/CS1/Whitelist
[cs1-date-validation]: https://en.wikipedia.org/wiki/Module:Citation/CS1/Date_validation
