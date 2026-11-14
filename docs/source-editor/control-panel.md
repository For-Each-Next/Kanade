# Source Editor control panel

Last reviewed: 2026-11-14.

Open an article in **Edit source** and choose **Source Editor** in page tools.
The **Formatting** and **References** tabs share the active source editor.
**References → Manage references** opens the reference manager. Accepted changes
remain in the backing editor until you publish through MediaWiki.

Use **Format** at the bottom right to apply current accepted or saved settings to
selected text, or the whole section/page when nothing is selected. Review the
result and use the host editor's undo if needed. The adjacent **References**
shortcut opens the manager with the same source, selection, and accepted
settings. Formatting never publishes edits.

The panel uses the wiki's Vue and [Wikimedia Codex][codex] components with native
appearance, labels, modal focus, and tab navigation. Structural columns stack on
narrow screens without changing reading or keyboard order.

## Settings and source formatting

Changes remain drafts until the explicit formatting action succeeds. Cancel,
close, and Escape discard unapplied drafts. **Save settings** stores the current
formatting draft without formatting source or closing the panel. A storage
failure preserves the draft for retry and session-only use. **Reset settings**
removes saved formatting preferences and restores defaults without changing
source. These operations leave MediaWiki's native editor preferences alone.

The source range and action are captured before asynchronous work. Busy controls
cannot submit twice. Changed source, selection, page identity, editor ownership,
or composition invalidates pending formatting. Redirect lookup runs only during
an explicit formatting action. Examples and translated content render as text.

**Format HTML tags** is available on every wiki and off by default. It normalizes
tag spacing, attribute quoting, and inline `style` CSS while protecting comments,
literal contents, and ambiguous or dynamic syntax. **Format language conversion
rules** covers inline `-{...}-` rules and page-wide manual `NoteTA` rules only on
zhwiki; saved preferences cannot enable it elsewhere.

Nested-template indentation has an explicit checkbox and a numeric spaces-per-level
field, defaulting to 2 and accepting nonnegative whole numbers. Disabling
indentation retains the width and first-level opt-out for later use. The
Tracklists example demonstrates nested templates, indentation, and parameter
alignment. Ratios are displayed as Latin:Chinese (3:5 and 1:2); stored formatter
values retain their Chinese:Latin convention for compatibility.

## Native source editing

[MediaWiki CodeMirror][codemirror] supplies highlighting, editor preferences,
search and replace, folding, completion, and other native source features.
Enable or disable it in MediaWiki's editing preferences or through its native
**Syntax** toolbar control. Source Editor respects the active editor and does
not load, toggle, or configure CodeMirror. The formatter and manager also work
with the native textarea when CodeMirror is disabled or unavailable.

## Add a source

Current live formatting images, source revisions, and attribution are recorded
in the [image inventory](images/README.md).

Enter a URL, identifier, or citation text and choose the lookup action. Check
the returned details in the draft before inserting them. The **Sources** tab
combines source creation and the existing source list. Its **Source content**
field filters that list immediately while you type or paste; choose
**Generate source** or press **Enter** to create a draft from the entered content.
With an empty field, **Generate source** opens a blank draft for manual details.
Choose a citation template in the draft for print or offline material.
Existing named URL sources can be reused instead of creating duplicates.

Choose **Save citation** when the new draft is ready. The citation is inserted
at the article cursor or selected range retained when opening the panel, and
the reference manager closes. Validation errors keep the draft open for corrections.
Cancelling a draft returns to the source list and preserves the entered
source content. Existing-source edits save their changes and return to the list.

The draft editor preserves populated custom fields when changing template
types. Formatting is an explicit action: opening an existing source does not
silently rewrite its parameter spelling or values. Review the wikitext preview
before inserting or updating the source.

## Browse and reuse

Use **Source content** to search existing sources and the section selector to
filter by article section. Clear the content field to show the full list.
Source entries
show their author and year, title, and uses; the reference name is available
in the metadata tooltip. Choose the use action to insert a reference at the
cursor, or edit to open the source details.
Bibliography citations used by `{{sfn}}` retain their short-footnote behavior.
The tabs stay visible while the list scrolls. Use and edit actions appear as
icon buttons with tooltips, leaving more room for source titles.

Repeated uses of a named footnote share one source entry within their reference
group. Native sub-references with identical details share one row beneath their
source title. The row header shows the number of uses, such as **4×**.
**Reuse sub-reference** inserts a fresh call with the same details;
**Edit sub-reference** updates every matching use represented by that row.
Saving refreshes the list, and session undo can restore the change.

Solid dividers separate sources, and dotted dividers separate their
sub-reference details. The line beneath author/year shows the total uses and
how many are sub-references, such as **7× (with 3 sub-refs)**. While scrolling
through a source's sub-references, its main row stays visible beneath the tabs
until the next source replaces it.

The main **Use source** action inserts its main reference. Hold **Ctrl** or
**Command** while clicking it to open **Use with details** and add a page,
timestamp, quotation, or other detail in a separate dialog. The details field
accepts wikitext, including templates such as
`{{URL|https://example.test/page|Page title}}`. Check the generated wikitext
preview before inserting the sub-reference at the cursor; its `details`
attribute shares the main reference name. Clearing the details when editing
a sub-reference row turns its matching uses into ordinary main-reference uses.

## Format and review references

The main **Formatting** tab groups article cleanup, citation formatting,
redirects, and template layout. Enable **Format citations with the article** to
apply citation choices with the same explicit **Format page**, **Format section**,
or **Format selection** action. Native fieldsets group the choices; structural
columns give related controls room and stack on narrow screens. The
**References** tab opens browsing, creation, reuse, and review in the shared
manager. Its **Tools → Open Source Editor formatting settings** action returns to the
main panel. Naming and reference-organization operations keep unsupported syntax
intact. See [reference names](reference-names.md) for the rules.

The main panel is up to 64rem wide on desktop, with Codex's native viewport
constraint. Related fields use two columns where there is room and stack on
mobile. This extra width changes the panel layout while retaining native
component text sizes, padding, colors, and focus styles.

Under **Formatting → Citation formatting**, select **Separate reference definitions with
a blank line**, then apply formatting to separate full reference
definitions inside formatted `<references>` lists with one blank line. This
option is off by default and applies to both inline and block citation layouts.
Repeated formatting retains one blank line between definitions.

**Split comma-separated author names** is off by default. When enabled with
citation formatting, `author=Smith, Jane` becomes `last=Smith | first=Jane`.
Numbered authors use the corresponding numbered fields. Natural-order names
such as `Jane Smith` remain unchanged, and existing `last` or `first` fields are
never overwritten. Review the explicit formatter result before publishing.

**Automatic script-title handling** groups its switch and language policy in one
native fieldset. **Use script-title only for languages written in non-Latin scripts**
handles foreign languages written in non-Latin scripts. **Use script-title for
every foreign language** also includes foreign Latin-script languages. **Use
script-title for every language, including this wiki’s language** includes the
target wiki's own language. Examples follow the
target's content language, independently of the translated interface:

| Target content language | Foreign-language examples | Every-language examples |
| ----------------------- | ------------------------- | ----------------------- |
| Chinese (`zh`)          | `en`, `ja`, `ru`          | `zh`, `en`, `ja`, `ru`  |
| English (`en`)          | `de`, `ja`, `ru`          | `en`, `de`, `ja`, `ru`  |

These are illustrative language codes. The mode applies to every supported
language, and unverified target languages preserve titles when a foreign-language
decision would be needed.

Returning from the manager to formatting preserves its consistency-review close
prompt. When consistency changes have been applied, choose whether to keep or
undo them before the shared panel opens, or continue editing in the manager.

Formatting preserves each native sub-reference's `details` attribute while
organizing its shared main definition. References with the same name remain
separate across groups. An explicit `group=""` in article prose uses the default
group; definitions inside `<references group="note">` use that list's group,
including definitions with an empty group attribute.

Local checks provide immediate citation feedback. On English and Chinese
Wikipedia, saving a new citation also runs live CS1 validation; errors or an
unavailable checker keep the draft open. Existing-source edits normally use
local checks. The CS1 review tool performs an explicit article check and
rechecks changes made within that review. Other wikis use local validation.
Review individual findings, apply the fixes you want, and inspect the editor
before publishing. Session recovery can restore formatter changes while
protecting later unrelated edits.

## Reference-manager interaction and layout

The panel uses Codex fields with accessible labels and visible validation.
The source-content field groups its native label with an input and generation
action. A separate section-filter fieldset gives each level selector its own
label. Input and action stay beside each other at desktop widths; selectors use
wrapping structural columns. Mobile screens stack the controls within the dialog.
The manager and citation editor use up to 64rem on desktop while keeping Codex's
viewport bounds. Citation rows align their parameter name, value, and icon actions
when there is room; they stack in reading order when their editor is narrow.
Long values grow within the field, and row actions wrap within their column.
Each button group has at most one primary progressive action; secondary actions use neutral
buttons, and less frequent actions use quiet buttons. Individual source and
parameter actions use compact icon buttons with translated tooltips and
accessible labels. List controls and dialog footers use text buttons, with cancellation
using a quiet neutral button in the citation draft,
before the primary action at the reading end of horizontal groups in both left-to-right and right-to-left interfaces. On narrow screens, footer
buttons stack with the primary action first. The reference-name preview shows
its populated components together, without separate labels or empty placeholders.
Source details and wikitext previews wrap or scroll within the dialog rather than
expanding the page.

These choices follow the Wikimedia [style guide][codex-style-guide], [button guidance][codex-button-actions],
and [form guidance][codex-forms]. Keyboard and screen-reader interaction comes from
the Codex components and semantic buttons and labels.

## Verification

Unit and service tests cover draft acceptance, dismissal, option preservation,
asynchronous source snapshots, backing-editor selection, and failure recovery.
Offline browser tests exercise the actual Codex dialogs and native source
adapters. Historical documentation screenshots and provenance remain separate
from automated browser fixtures. Manual keyboard, screen-reader, and live-host
acceptance remain release checks recorded in the [maintenance assessment](../maintenance.md#release-assessment).

[codex-style-guide]: https://doc.wikimedia.org/codex/latest/style-guide/overview.html
[codex-button-actions]: https://doc.wikimedia.org/codex/latest/style-guide/using-links-and-buttons.html#types-and-order-of-buttons
[codex-forms]: https://doc.wikimedia.org/codex/latest/style-guide/constructing-forms.html
[codex]: https://doc.wikimedia.org/codex/latest/
[codemirror]: https://www.mediawiki.org/wiki/Help:Extension:CodeMirror
