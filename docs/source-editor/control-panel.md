# Source Editor control panel

Last reviewed: 2026-10-21.

Open an article in **Edit source** and choose **Source Editor** in page tools. Its
**Formatting**, **References**, **Highlighting settings**, and **Tools** tabs share one
source editor and settings draft. **References → Manage references** opens the
reference manager. Reference-inspection popups keep inline editing controls but
do not include a Manage reference button. All
accepted changes remain in the backing editor until you publish through
MediaWiki.

For one-click formatting, use **Format** at the bottom right. It applies the
current accepted or saved settings to selected text, or the whole section/page
when nothing is selected. Review the editor result and use normal editor undo if
needed. The adjacent **Tools** shortcut opens its panel tab. To change formatting
settings, open **Source Editor** in page tools. Formatting never publishes edits.

The panel uses the wiki's Vue and [Wikimedia Codex][codex] components. The
implementation uses the project's locked Codex version for local verification.
The following official guidance informed the interface.

| Area                  | Implementation                                                                                                                                                                                                        | Official guidance                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Information structure | Highlighting settings contains presentation and previews; Formatting combines cleanup, citations, redirects, and template layout; References opens the manager.                                                       | [Tabs](https://doc.wikimedia.org/codex/latest/components/demos/tabs.html)                                                                                                                 |
| Dialog actions        | One progressive primary action, a normal secondary Save settings button, a quiet neutral Cancel action, and a close button. The primary label identifies the formatting scope or applies settings without formatting. | [Dialog](https://doc.wikimedia.org/codex/latest/components/demos/dialog.html), [Using links and buttons](https://doc.wikimedia.org/codex/latest/style-guide/using-links-and-buttons.html) |
| Occasional actions    | A quiet More menu groups Clear cache and destructive Reset settings. Success uses native notifications; errors and progress remain in the footer.                                                                     | [MenuButton](https://doc.wikimedia.org/codex/latest/components/demos/menu-button.html)                                                                                                    |
| Forms                 | Native labels, descriptions, and semantic fieldsets. Structural columns use standard spacing and stack below 640px.                                                                                                   | [Constructing forms](https://doc.wikimedia.org/codex/latest/style-guide/constructing-forms.html)                                                                                          |
| Choices               | Checkboxes collect preferences for explicit submission. Conditional options retain their values when hidden. Alignment labels distinguish names from values, with a live example.                                     | [Checkbox](https://doc.wikimedia.org/codex/latest/components/demos/checkbox.html), [Constructing forms](https://doc.wikimedia.org/codex/latest/style-guide/constructing-forms.html)       |
| Visual hierarchy      | Standard Codex controls and semantic skin tokens; quiet supporting text; a single primary action. The template example uses a flat surface without elevation.                                                         | [Colors](https://doc.wikimedia.org/codex/latest/style-guide/colors.html), [Typography](https://doc.wikimedia.org/codex/latest/style-guide/typography.html)                                |
| Wording               | Short sentence-case labels, explicit units, descriptive actions, complete translated sentences, and error messages that explain how to continue.                                                                      | [Writing for copy](https://doc.wikimedia.org/codex/latest/style-guide/writing-for-copy.html), [Voice and tone](https://doc.wikimedia.org/codex/latest/style-guide/voice-and-tone.html)    |
| Accessibility         | Codex manages modal focus, tab keyboard navigation, control labels, and focus indicators. Errors and progress use accessible feedback components. Logical spacing supports RTL; example wikitext remains LTR.         | [Accessibility](https://doc.wikimedia.org/codex/latest/style-guide/accessibility.html), [Bidirectionality](https://doc.wikimedia.org/codex/latest/style-guide/bidirectionality.html)      |

<!-- toc:start -->

## Contents

- [Settings and source formatting](#settings-and-source-formatting)
- [Regex replacements](#regex-replacements)
- [Add a source](#add-a-source)
- [Browse and reuse](#browse-and-reuse)
- [Format and review references](#format-and-review-references)
- [Reference-manager interaction and layout](#reference-manager-interaction-and-layout)
- [Verification](#verification)

<!-- toc:end -->

## Settings and source formatting

![Formatting panel](images/screenshot01.en.png)
This retained image shows the integrated Source Editor panel.
See the unified [image inventory](images/README.md) for the other languages and
capture procedure, source attribution, and replacement policy.

- Changes remain drafts until the primary action succeeds. Cancel, close, and
  Escape discard unapplied drafts. Applying Highlighting settings never invokes
  the formatter. Explicit Save settings and Clear cache actions are immediate;
  dismissing the panel does not undo them.
- Accepted settings remain available when reopening the panel in the same edit
  session. Persistence is optional and saves all settings tabs in this browser's
  localStorage on the current wiki, including citation layout, reference-call
  syntax, definition spacing, and script-title mode. Reference tasks use these
  same accepted choices.
- The footer shows Save settings directly as a normal secondary button. Desktop
  actions on the right read Cancel, Save settings, then the primary action.
  Narrow layouts place the primary action, Save settings, More, and Cancel in
  that order; keyboard and visual order agree. More contains only Clear cache
  and Reset settings.
- Save settings stores the current draft without formatting, applying it
  to the editor, or closing the panel. A storage failure leaves the draft open
  and does not prevent applying it for the current edit. Formatting failures
  likewise preserve the draft for retry.
- Saving settings and clearing the cache show brief native MediaWiki success
  notifications, with a visually hidden announcement inside the modal for screen
  readers. The dialog stays open, with errors and progress shown in its footer.
- More → Reset settings removes the saved configuration and restores the whole
  dialog draft to defaults. Save and Reset always cover all settings tabs. Reset leaves
  the current editor unchanged until the defaults are applied. Its menu item
  uses Codex's destructive treatment; the close action is quiet and neutral.
- The source range and action are captured before asynchronous work. Busy
  controls cannot submit twice or dismiss the dialog during an operation.
- Network-backed features remain opt-in. Redirect lookup runs only on an
  explicit formatting action. Highlighting settings lookups run in the background after the
  settings are accepted.
- Highlighting settings has four groups: **Syntax highlighting**, **Text and
  colors**, **Links**, and **Reference popups**. The first group contains the
  Source Editor wikitext switch followed by the independent CodeMirror option for
  other content models. Text size and consecutive-reference colors share the
  second group. Link navigation, hover previews, and missing-page coloring appear
  in that order. Reference inspection, full-page source loading, editing, and
  lightweight editing appear in that order in the final group.
- Disabling Source Editor highlighting removes its editor frame and restores the
  native textarea. The three display groups, including larger text, are disabled
  while preserving their settings. Re-enabling highlighting restores the
  enhanced editor and those features using the current source. Older saved
  configurations keep highlighting enabled.
- Text and colors includes an opt-in alternating-colors setting. References start
  pink; consecutive groups alternate pink and blue backgrounds,
  preserving text colors. A run of three references appears pink, blue, then pink.
  A self-closing `<ref />` and its directly following reference template form one
  group. Standalone reference templates also alternate; prose resets the sequence.
  `{{Efn}}`, `{{NoteTag}}`, and supported variants use the normal template background
  for their nesting level while retaining the optional small reference text size.
  Embedded `<ref>` tags and supported reference templates retain their own
  reference colors. Notes do not count as reference
  color groups; consecutive references inside a note alternate from pink
  independently of references before the note.
- Reference tag inspection shows a subreference's `details` before its parent
  bibliography. Missing parent definitions do not hide those details; enabled
  whole-page reference loading can still resolve the parent from another section.
  Subreference content retains its raw wikitext with the editor's syntax
  highlighting, without template expansion.
- Article and reference previews point to the mouse position captured when the
  popup opens, including on wrapped links and references. Moving the mouse over
  the same source keeps the popup and arrow still. Popups flip above or below when
  needed, and their bodies and arrows stay inside the editor frame. Near an edge,
  the arrow points as close to the activation position as the frame allows.
- Displayed citation values and reference content use source syntax highlighting
  with the editor's palette instead of rendering the markup. Existing archive-URL
  abbreviation is retained. Link aliases are bold, and missing-link highlighting
  follows the editor setting.
- Ctrl-clicking a wiki link or external URL in the source display opens it in a
  new tab in both regular and lightweight modes.
- The tooltip's main heading is **Reference**, followed by a named reference's
  name in parentheses and styled as code. Unnamed references show only
  **Reference**. Localized text nodes surround the name, which is rendered as
  text inside a code element. **Sub-reference content**
  labels the local details when present. The citation template name then heads
  its parameter rows; content without a citation uses **Reference content**.
- In regular mode, reference tooltips place action icons after citation field
  values and edit icons after note content and subreference `details`. Browser tooltips
  name citation fields and distinguish editing reference content from editing
  subreference content. Paired person fields can be edited separately. The pencil
  opens citation parameter name and value inputs, with the value selected by
  default. Content editors use a textarea at least two lines high.
  Every edit and add form, in both regular and lightweight modes, has **Cancel**,
  **Reset**, and **Save** actions in that order. Regular forms use buttons.
  Save updates the source and supports Undo/Redo, while Cancel or Escape
  discards the draft.
  Save and Reset keep the inspection popup open and refresh its displayed
  content in both regular and lightweight modes.
  Citations that cannot be parsed into fields expose their raw text through
  **Edit reference content**. Inputs omit surrounding value whitespace;
  edits preserve the existing leading and trailing whitespace in the source.
  Action icons use the default text color and measure 0.85em, keeping them
  smaller than the tooltip text. Links retain the theme's link colors.
- **Enable editing while inspecting references** is enabled by default. Turning
  it off hides edit, add, and reset controls while keeping reference inspection
  available. It and **Read the full page source when editing a section** appear
  at the same level as **Reference tag inspection**. Both remain visible but
  disabled when inspection is off, retaining their values. Save settings
  persists them; Reset settings restores their defaults.
- **Use lightweight reference editing** is an optional child of the reference-editing setting,
  off by default. A plain-text **[✎]** control before **[+]** opens a citation parameter's
  name and value for editing together in their source display, with a shared
  background highlighting the whole edit group. Reference and subreference content
  also use the plain-text **[✎]** control. Lightweight edit controls use text characters,
  with no SVG or image. Double-clicking source text does not start editing.
  One set of plain **[×]**, **[↶]**, and **[✓]** controls follows the value for Cancel,
  Reset, and Save, followed by **[+]** for adding a blank field.
  Enter saves, Shift+Enter inserts a new line, and Escape cancels; this keyboard
  guidance appears in the panel's setting description. The preference remains
  visible and retains its value while disabled, becoming available when
  inspection and editing are both enabled. It is saved and reset with the other
  settings.
- The add control beside a citation parameter inserts a new field immediately
  after it, below it in multiline source. **Add a new field** sits alongside the
  citation template heading and inserts before the first existing parameter.
  Names must be valid and unused; duplicate fields and malformed wikitext values
  are rejected. Insertions follow the existing parameter layout. Saving a new
  field updates the source and supports Undo/Redo.
- Editing or adding citation fields automatically escapes bare pipes as `{{!}}`.
  Pipes inside nested templates, wikilinks, comments, and literal tags remain
  unchanged.
- Duplicate citation parameter names show a Codex alert icon in regular mode
  and the **⚠︎** character in lightweight mode, with a browser tooltip identifying
  the repeated name. Existing duplicate values remain visible and editable at
  their own source locations.
- Saved edits give only the changed parameter name or value a distinct
  background. Regular mode uses Codex's edit-undo icon in place of the edit icon.
  The Reset action has a browser tooltip showing the original value, which remains
  the baseline through repeated gadget edits. Reset restores that original
  value; for an already-added field, it removes the field. Both actions support
  Undo/Redo. Reset stays grey and unavailable when there is no saved change and
  the draft is unchanged; changing the draft name or value enables it.
  Unapplied drafts do not highlight fields.
- During section editing, edit and add controls for fields fetched from outside
  the current section are greyed out. Field names and values retain their normal
  appearance. The controls' browser tooltips explain why they are unavailable.
  A subreference's local `details` remain editable even when its parent reference
  comes from another section. Editing is also unavailable when a field cannot
  be located in the current source. The same
  restrictions apply to adding fields to a citation.
- Clear cache acts immediately on page summaries, missing-page results, and
  whole-page reference source. Pending responses from before the clear are
  ignored. It does not reset preferences or namespace metadata.
- Formatting options includes **Format HTML tags** on every wiki, off by default.
  It normalizes tag spacing, attribute quoting, and inline `style` CSS while
  protecting comments, literal contents, and ambiguous or dynamic syntax.
- **Format language conversion rules** covers inline `-{...}-` rules and
  page-wide manual `NoteTA` rules. It is available only on zhwiki; saved
  preferences cannot enable it on other wikis.
- Nested-template indentation has an explicit checkbox and a numeric spaces-per-level
  field, defaulting to 2 and accepting nonnegative whole numbers. Disabling
  indentation retains the width and first-level opt-out for later use.
- The Tracklists example contains two nested `tracklist` templates for Side A and
  Side B, each with Chinese and English track titles to demonstrate indentation.
  The longer `heading` and `comment` parameter names demonstrate alignment.
  Ratios are displayed as Latin:Chinese (3:5 and 1:2) and are available on every
  wiki, including enwiki. Existing stored formatter values retain their
  Chinese:Latin convention for compatibility.
- Examples and translated content render as text. Every source change still
  passes through the existing editor replacement path and native textarea.

## Regex replacements

Open **Tools** from the Source Editor panel, or choose **Tools**
in its bottom-right button group. This utility is available when the page has an
eligible native wikitext source editor. Enter a JavaScript regular expression
without surrounding slashes in **Find 1** and the replacement in **Replace 1**.
Two numbered pairs are shown initially. Use the next pair for another replacement,
or choose **Add replacement**. Pairs run in displayed order, so each one receives
the preceding pair's result. Unused empty pairs are skipped; an empty replacement
for a populated Find field removes matches. Removing a pair renumbers later pairs
and moves focus to the next Find field, or the previous one at the end.

**Options → Flags** sets the JavaScript flags for every pair. The default `g` flag
replaces all matches; removing it replaces the first match. Use `i` to ignore
case, `m` for line anchors, `s` to let the dot match newlines, and `u` or `v`
for Unicode handling when supported by the browser.

The replacement uses JavaScript string-substitution rules: `$$` inserts a dollar
sign, `$&` inserts the match, `$1`–`$99` insert capture groups, `$<name>` inserts a
named capture, and `` $` `` / `$'` insert the source before / after the match.
Replacement text remains text; it does not run JavaScript. Replace fields start
one line high and grow with their contents. Enter inserts a newline.

**Preview replacements** shows the complete resulting source and match count
without changing the editor. The match count totals every pair. Paste, blur, and single-line Enter also prepare a
preview after input completion; repeated completion events reuse the same result.
Typing clears an older preview and stops its pending worker. Review the output,
then choose **Apply replacements**. The panel stays open so **Undo replacement**
can restore the last accepted sequence as one edit. Source Editor's normal undo history
also receives accepted source changes. Publishing remains MediaWiki's explicit
save action.

When the panel opens with selected source, only that captured selection is
processed. Otherwise it processes the current page or section source. A changed
source, page, removed editor, or unavailable editing state blocks acceptance;
reopen Tools to work from the current source. Undo protects later unrelated
edits with the same source check. Closing discards the draft and preview while
leaving already applied source changes in the editor.

Each pair runs in its own Web Worker and is stopped after 1.5 seconds, so a
slow expression cannot block the page's main thread. Limits are 2,000,000 UTF-16
code units for input and each intermediate result, 10,000 per pattern, 100,000 per
replacement, and 10,000 matches across the sequence. A failed pair rejects the
whole preview without applying earlier results. Invalid patterns identify their
Find field; invalid flags open Options and focus Flags. A blocked or unavailable worker leaves the draft intact
with an error. Pattern, replacement, source, and previews stay in memory for the
dialog session; the utility makes no network requests and saves no settings.

## Add a source

The reference-manager images below show the current integrated Source Editor
on live Wikipedia source pages. Their normal and narrow desktop capture
conditions, source revisions, and attribution are recorded in the same
[image inventory](images/README.md).

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

Reference tooltip surfaces, text, controls, state highlights, and warnings use
the host wiki's Codex color tokens with Codex fallback colors. Wikitext syntax
highlighting within reference tooltips retains the editor's syntax palette.

The compact tooltip icons use the official `cdxIconEdit`, `cdxIconEditUndo`,
`cdxIconAdd`, `cdxIconAlert`, and `cdxIconUndo` paths from the pinned `@wikimedia/codex-icons`
package. The build validates and injects only their path data and direction
metadata. The browser creates SVG elements directly, without loading an icon
runtime. Both generated artifacts retain the icons' full MIT notice; see
[third-party notices](../../THIRD-PARTY-NOTICES.md).

Unit tests cover draft acceptance, dismissal, option preservation, asynchronous
snapshots, cache invalidation, and failure recovery. Offline browser tests mount
the actual Codex dialog and verify selected-range formatting, form submission,
focus restoration, keyboard tabs, menu actions, highlighting controls,
wiki-specific options, persistence, error presentation, RTL, and narrow layouts
in English, Simplified Chinese, Traditional Chinese, Japanese, and Russian.
Documentation images are captured separately from live Wikimedia pages; offline
test screenshots are written to test output and do not replace that collection.

[codex-style-guide]: https://doc.wikimedia.org/codex/latest/style-guide/overview.html
[codex-button-actions]: https://doc.wikimedia.org/codex/latest/style-guide/using-links-and-buttons.html#types-and-order-of-buttons
[codex-forms]: https://doc.wikimedia.org/codex/latest/style-guide/constructing-forms.html
[codex]: https://doc.wikimedia.org/codex/latest/
