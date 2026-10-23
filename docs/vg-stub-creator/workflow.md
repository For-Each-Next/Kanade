# Creating and reviewing an article

Last reviewed: 2026-10-17.

Build the draft, review the article, then confirm and save. The interface follows
the host wiki's language; the labels below use the English catalog.

<!-- toc:start -->

## Contents

- [Build the draft](#build-the-draft)
- [Review the article](#review-the-article)
- [Confirm and save](#confirm-and-save)
- [Recover interrupted work](#recover-interrupted-work)

<!-- toc:end -->

## Build the draft

On an English Wikipedia article, choose **Create Chinese Wikipedia stub** from
the page tools to begin on Chinese Wikipedia. On a supported Chinese Wikipedia
new-page or source-edit page, choose **Create video game stub**.

The creator has four tabs:

- **Facts**: enter or import the English Wikipedia page, developers, publishers,
  series, platforms, release year, and genres. Review the Wikidata match. Each
  metadata field shows its item count and three parts: a shared input for names
  or source URLs, **Items** with editable rows and related-page choices, and
  **Sources** with the source links. The Items and Sources groups remain visible
  when empty and list their rows vertically without inner borders.
- **Names**: keep localized, original, and English names with their sources,
  choose how each name is used, research names with Google or Steam, check page
  and redirect candidates, and maintain language-conversion entries.
- **Article text**: add prose, review scores, and their source URLs, then check
  the generated article text.
- **Sources**: inspect acquired citation templates and edit their parameters.

In **Names** and **Article text**, each source field has one input followed by a
plain vertical list of links. Paste one or more URLs on separate lines, or type a
URL and press Enter or leave the input. Completion adds each URL once and clears
the input for the next source. Each source has its own **Remove** action. Typed
source text remains in the temporary draft before completion.

In **Names**, each source card has separate rows for its name, source, and
property checkboxes. **Properties** follows Source and uses Codex's default
fieldset legend; Name and Source retain its nested field labels. Active uses
appear as compact chips in the **Uses** row below **Properties**,
even while the settings are collapsed. A `*` marks a manually entered override;
hover over the chip to inspect the effective value, or focus the row to access
its effective values with a screen reader. Click anywhere on the row, or focus it
and press Enter or Space, to show or hide the settings directly below it. Its hint
changes between **Click to expand** and **Click to collapse** with the current state.
Its checkboxes let you use that name as the
page title, redirect, conversion title, sort key, or main name, in that order.
An optional override changes just that use; leave it blank to follow the
suggested value. For example, a page title can include a disambiguation suffix
while the source name stays unchanged. Separate multiple redirect override
values with semicolons or line breaks; a comma remains part of one title.
Japanese original names leave the default sort key empty, so enter a romaji
override when needed. The conversion-title use has one optional regional-rule
input, for example `zh-cn:摄影冒险2; zh-tw:攝影冒險2;`. Updating a region preserves
the others, and the most recently edited value for each region contributes to
one combined rule across selected names. Additional conversion rules and redirect source-review controls
remain within their owning name card.
Page title, main name, and sort key each use one selected source. Review
the uses and their custom values in the source card before continuing to the
article and save-action dialogs.

There is no separate overall NoteTA section. The generated article begins with
`{{NoteTA-lite}}` and `G1 = Games`; selected regional title conversions and
additional rules are included in that template. Review the complete template
in the article source before continuing.

The Steam name helper can fetch suggested localized names for a Steam page; choose which
suggestions to add, then review their official status, regions, and sources.
The Google searches beneath it use the English Wikipedia title entered in Facts
as one shared search term, with trailing disambiguation removed: for example,
`Toem 2 (video game)` becomes `Toem 2`. These links are hidden when the English
Wikipedia title is blank. There is no separate search-name input or accompanying
inline Google and Steam search links.

Page-name and redirect candidates are checked independently of their selection.
An existing result links to the actual matching page. Before an exact title can
be confirmed missing, its Simplified and Traditional Chinese conversions must
also return valid missing results. A confirmed missing candidate shows a
highlighted **Use as page title** or **Add redirect** action to select it for
later review. Retry a failed lookup by pasting, pressing Enter in its single-line
input, or leaving that input. Failed, invalid, or incomplete responses stay
unconfirmed, and changing a candidate invalidates
earlier evidence. Selection does not write to Wikipedia; review the exact titles
in the article and save-action dialogs.

For each metadata field, paste content to add it immediately, or type one or
more names and press Enter or leave the input to add separate rows. Enter a URL
in the same input to add it to that field's sources. Each item has a checkbox and
an editable wikitext name. Linked names retain their markup, such as
`[[任天堂]]`. Uncheck an item to leave it out of the generated article while
keeping it in the draft for later use. Clear its name and leave the textbox or
press Enter to remove it.

Related categories, navigation templates, and stub tags appear as compact chips
alongside the metadata item that suggested them. Categories show their plain names;
templates show `{{Name}}`. Click a chip label to toggle its inclusion in the article or save
plan. Excluded labels are grey and crossed out. Double-click a label to edit its
name, and clear the name to remove the choice. Ctrl-click or Command-click keeps
the normal link behavior and opens the wiki page. Links in the main dialog
show an underline only while hovered with Ctrl or Command held. With keyboard focus on a
label, Space toggles selection, Enter opens the editor, and Escape cancels an edit.

The tool checks related pages through Wikipedia APIs. Included labels are blue
for pages confirmed to exist, red for pages confirmed missing, and black when a
check is unavailable. The small inline button immediately after the name edit
textbox opens source review and lets you stage changes to the related page.
Each item has one plus button for
adding a related choice: a plain name adds a category, while `{{Name}}` adds a
template. Templates without parameters whose names end in `-stub` become stub
tags; other template calls retain their parameters and become navigation
templates. Rows wrap on narrow screens, and redirects stay
with the title and name inputs.

Metadata sources appear as links in the **Sources** group, after all item
rows in **Items**, with an individual
remove button for each URL. Inline error messages identify lookup failures or
conflicts that need attention. Review acquired values against their sources
before continuing.

The form saves a temporary draft in this browser. **Draft options** provides
history and draft-management actions. The History dialog can restore stored
entries, import or export form data, and delete entries.

## Review the article

Choose **Review article** to open the article review. The dialog shows editable
wikitext and a rendered preview. After changing the text, choose **Update
preview** to check its rendered result. Review the edit summary as well.

Choose **Back to draft** to revise the original fields. Choose **Choose save
actions** when the article is ready to prepare the final operation list.

## Confirm and save

The **Confirm save actions** dialog lists the article and proposed follow-up
operations. Check the exact page titles and select the operations you intend
to perform. Depending on the draft, these can include page moves, redirects,
talk-page banners, category or navigation-template edits, project-list
registration, and a Wikidata sitelink.

**Save article and selected actions** performs the reviewed save. Progress
messages report the current operation. If an operation fails or its result
cannot be confirmed, the report names the action requiring attention.

## Recover interrupted work

The tool checkpoints the article and follow-up plan in the current tab. It can
resume pending work known not to have started. A running or uncertain operation
requires manual review of the affected page before retrying; the tool does not
automatically repeat it.

Keep the tab available while recovering an interrupted save. Local form history
can recover draft fields independently of a save checkpoint. Both kinds of
storage belong to the browser profile and wiki origin, so export a history
entry when you need a transferable copy of the form.
