# Reference Names

Last reviewed: 2026-10-17.

Source Editor generates stable reference names from citation authors,
dates, source identities, and part locators. Structured HTML comments can
override one component or exclude a field without changing displayed citation
text.

<!-- toc:start -->

## Contents

- [Named footnote reuse](#named-footnote-reuse)
- [Name aliases](#name-aliases)
- [Source identities](#source-identities)
- [Exclusion directives](#exclusion-directives)

<!-- toc:end -->

## Named footnote reuse

An existing footnote is matched by its name and reference group together.
Forward calls such as `<ref name="Book" />` can appear before their full
definition. Formatting updates the definition and its reuses together, including
native sub-references with different `details` values. Empty `group=""` in prose
belongs to the default group; list-defined references use their enclosing list's
group.

Names and groups are compared after one HTML entity decoding pass, so `é` and
`&eacute;` identify the same value. An escaped literal such as `&amp;eacute;`
remains distinct through formatting and source reuse.

Repeated identical full definitions share one source entry. Editing that source
updates identical copies together. Conflicting full definitions are kept in
place during formatting so Cite can continue reporting the conflict. See
[Help:Cite on multiple uses of a footnote](https://www.mediawiki.org/wiki/Help:Cite#Multiple_uses_of_the_same_footnote)
and [sub-referencing](https://meta.wikimedia.org/wiki/WMDE_Technical_Wishes/Sub-referencing).

## Name aliases

For a non-Latin author or organization name, an HTML comment beginning with `#`
supplies its reference-name form without changing the citation display:

```wikitext
| author = 山田花子 <!-- # Yamada, Hanako -->
| publisher = セガ <!-- # Sega -->
```

Formatting puts one space between the value and its reference-name comment,
and normalizes the comment to `<!-- # Alias -->`. Both `<!-- # Alias -->` and
`<!--# Alias -->` are accepted as input.

When a new source repeats a creator name with an alias used elsewhere in the
article, the source manager shows that alias as a suggestion. **Use** copies it
into the alias field; **Dismiss** hides it for the current draft. Ignoring the
suggestion also leaves the citation unchanged.

## Source identities

On a `url` field, the same comment supplies an explicit source-identity key.
The actual URL is the fallback key, so only continuation pages need to point
back to an unmarked base page:

```wikitext
| url = https://example.test/interview
| page = 1
```

```wikitext
| url = https://example.test/interview/2 <!-- # /interview -->
| page = 2
```

The real links remain unchanged. Matching source keys suppress same-year letter
suffixes and allow page values to distinguish reference names.

## Exclusion directives

Add `!no-author` to a field's comment to exclude that field from the
author-fallback chain. It can share a comment with a reference-name override:

```wikitext
| website = 游民星空 <!-- !no-author # Youmin Xingkong -->
```

The corresponding `!no-date` and `!no-part` directives exclude a field from the
reference name's date or part locator:

```wikitext
| publication-date = 2025-05-20 <!-- !no-date -->
| time = 1:15:41 <!-- !no-part -->
```
