# Revision Copy interface behavior

Last reviewed: 2026-10-21.

Follow the shared [UI guidelines](../ui-guidelines.md) for all Codex controls.
Use their default appearance; additional dialog CSS only arranges columns and
responsive layout. The native inline row and section controls described here are
separate from Codex component styling.

<!-- toc:start -->

## Contents

- [Placement and layout](#placement-and-layout)
- [Interaction](#interaction)
- [Language and safety](#language-and-safety)
- [Section controls](#section-controls)
- [Visual checks](#visual-checks)

<!-- toc:end -->

## Placement and layout

Place the row at `.vector-body-before-content` on Vector and at the corresponding
pre-content boundary on other skins. Keep it outside the article's parsed content.
Set the row margin to zero, including its bottom margin. Preserve native heading, subtitle, indicator, and
article markup.

Wait for the revision date before inserting the complete row and heading controls.
If its lookup fails, insert the page-only row. Pages without an available revision
show that row immediately.

Display the page link and, when available, the revision link in parentheses, followed
by **Copy** and **Tools** in that order. If no permanent or comparison link is
available, display the page text and the same two actions.
Display literal
wikitext by default, including `[[:…]]` brackets and foreign-wiki prefixes, using
the exact generated strings copied by the clipboard actions, rendered as text inside
inline `<code>` elements with a monospace font. Keep the copy action links in the
normal skin font. The entire revision expression, including its surrounding
parentheses, uses the code font. With `displayWikitext: false`, show ordinary page and revision labels as
navigation links. On diff views, the revision text and copy action use
`Special:Diff/old/new` with the newer revision's timestamp.

Use scoped styles and restrained inline spacing so the row fits the skin. Allow wrapping
on narrow screens and long titles. Retain dark-mode readability and visible keyboard
focus. Hide the row when printing.

## Interaction

In ordinary-label mode, use actual anchors for page and revision navigation. Group
the row actions like Wikipedia's section-edit links: `[ copy | tools ]`.
Use one pair of brackets around the group and a subtle, nonclickable separator.
Each action's link text contains only its label. **Copy** copies the page and
available revision wikitext together; a page-only row copies the page wikitext.
These inline actions have no button border or background. The row has no Codex runtime dependency. Implement
action links with `href="#"`, `role="button"`, prevented navigation, native Enter
activation, Space-key handling, and descriptive visible labels. Preserve native
skin controls and keep these actions inline.

Literal page and revision wikitext are independently focusable. Clicking either,
or pressing Enter or Space while focused, selects its complete code text for
native Ctrl+C or Command+C. Revision selection excludes the surrounding
parentheses. Keep visible focus and an accessible selection label. In
ordinary-label mode, the page and revision anchors retain normal navigation.

Omit unavailable revision text, including after a failed revision lookup.
Show no unavailable/retry placeholder. Prevent duplicate
clipboard activations with `aria-disabled` while writing, and provide useful
feedback if clipboard writing fails. Announce copied text only after
the clipboard promise succeeds, using a top-right Codex success toast. Use
MediaWiki notifications if the host Codex toast runtime is unavailable.

**Tools** opens an actual Wikimedia Codex dialog using MediaWiki's supplied Vue
and Codex modules. Follow the [Codex components](https://doc.wikimedia.org/codex/latest/components/overview.html)
and [style guide](https://doc.wikimedia.org/codex/latest/style-guide/overview.html):
use a single-selection Translate/Copy & paste toggle group, labeled radio and checkbox
fields, stacked source/destination fieldsets, and an always-visible readonly output
textarea. Use
default Codex component appearance, visible focus, modal focus
containment and restoration, and a layout that fits narrow screens.

Generate on opening, after a paste updates the field value, and when a mode,
purpose, or checkbox changes. Typing clears stale output; defer its lookup until
Enter or the edited field loses focus. Show an indeterminate `CdxProgressBar`
inside the wikitext box's border, with an accessible loading label while fetching.
Keep **Copy wikitext** as the primary action and disable it while the output is
empty, a lookup is pending, or copying is in progress. Announce errors and retain
selectable text when clipboard writing fails. Enter or field blur can retry a
failed lookup without requiring an input change.

Each source/destination fieldset places a narrower wiki-prefix box and a
wider page-name box on the same line, including at mobile widths. Show only
the **From** or **To** group label, with no help button, optional marker, or
inner labels. Retain translated accessible names on both textboxes and keep
keyboard order prefix then page. Both prefix values start empty and show their
effective defaults as placeholders. The target placeholder is `zh` on every
wiki. The source placeholder is the current wiki, except on Chinese Wikipedia
where it is `en`; English Wikipedia therefore also starts with `en` to `zh`.
Section contexts keep the selected section on the current wiki as their source.
Use the resolved page titles as placeholders in their own languages. Clear stale
titles when input changes, use the displayed title for unresolved current-wiki
fields, and show a translated generic placeholder for other unresolved pages.
A blank prefix uses its placeholder wiki for both resolution and the page-title
placeholder; an empty `en` input on Chinese Wikipedia must not show the current
Chinese title. Apply this rule to both groups and every language or project prefix.

## Language and safety

Interface labels follow the user's interface language, with aligned `en`,
`zh-Hans`, `zh-Hant`, `ja`, and `ru` catalogs. Revision labels follow the site's content
language, use UTC second resolution, and omit timezone text.

Page titles, timestamps, API data, and translations are untrusted text. Insert them
through text nodes and attributes set by the DOM API, and escape structural wikitext
characters when generating clipboard content.

## Section controls

Hang a compact `#` action to the left of the page title and each eligible section
heading, outside the heading text's flow. Preserve the heading's original position
and indentation. Reveal it on heading hover or keyboard focus. Click and Enter/Space
copy the page-section link immediately. The page-title control uses `#top` for the
lead section; other headings use their actual rendered ID. Use the same wiki prefix
as the main row.

After approximately 600 ms of hovering or focus, show a popup with **Copy link**,
**Copy permalink**, **Copy both**, and **Advanced copy**, in that order. Use the
normal skin font and plain action labels without square brackets. Qualify the
first three choices with the section fragment. ArrowDown opens the popup from
the focused control; Escape closes it. Keep the popup keyboard accessible and
dismiss it safely when its owner is removed. When no revision link is available,
retain **Copy link** and **Advanced copy**.

The section's **Advanced copy** action opens the same Codex attribution dialog, seeded
with the section reference in **From**, an empty prefix showing `zh` and empty page box in **To**, and **Partial**
unchecked. Selecting a section identifies the source; Partial means reusing only
part of that source. Use `#top` from the page title, or `#` plus the section heading's actual
ID. Preserve edits when reopening the same section; reset the starting values when
changing to another section or back to the main row.
Preserve immediate copying from the heading's `#` action; advanced attribution is
accessed through the popup. Close the popup when opening the dialog and retain
the dialog's keyboard focus and restoration behavior.

## Visual checks

Inspect the current [documentation captures](images/README.md) on their recorded
Wikipedia and Commons pages in Vector 2022 after UI changes. Also check Vector legacy (2010), MonoBook,
Timeless, and Minerva through live skin checks; these checks do not need separate images.
Use these required viewport sizes for visual verification and documentation
captures, measured as width × height in CSS pixels:

| Viewport       | Size       |
| -------------- | ---------- |
| Mobile         | 375 × 667  |
| Narrow desktop | 683 × 768  |
| Normal desktop | 1366 × 768 |

Check the inline row, page-title and section popups, advanced dialog, and copy feedback at these
sizes, including wrapping and access to dialog actions. Verify alternative skin
insertion boundaries, long titles, keyboard focus, loading state, and failure
feedback with offline fixtures. See [screenshots](images/README.md) for capture
profiles and image provenance.
Whenever images are regenerated, update the [image inventory](images/README.md) with
the matching source pages, revision IDs, viewport sizes, and descriptions, and
refresh `docs/rev-copy/images/live-captures.json` provenance in the same change.
