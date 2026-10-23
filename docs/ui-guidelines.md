# Toolset UI guidelines

Last reviewed: 2026-10-17.

This guide governs every Kanade interface. Tool guides describe product
behavior; this file defines the common presentation and interaction contract
for new and revised interfaces. Storage and input-completion policies guide future
changes; each tool guide records its implemented behavior.
Use the default [Codex][codex] appearance and form patterns specified below.

## Default components and layout

Use MediaWiki's Vue and Codex modules. Keep Codex components' native text sizes,
colors, borders, spacing, focus treatment, and [button][codex-button] visuals. Choose documented
component attributes for action, weight, status, and disabled state. Do not
restyle `.cdx-*` internals, resize labels, recolor buttons, or turn fields into
custom bordered cards.

Creator uses an explicit exception for fieldsets: a theme-aware border and
interior padding distinguish each related dataset, with its native legend
interrupting the top border. The nested Items and Sources sections stay
borderless and list their rows vertically. Input, label, and button appearance
remains native.

Additional form CSS is limited to structural column layout, its responsive
collapse, and width constraints on an owned dialog root. Preserve Codex's native
viewport constraint and mobile layout when giving desktop fields more room.
Put grid or flex rules on an owned wrapper around fields, and preserve
DOM reading order when columns stack. Let each component lay out its own label,
description, control, and message. Do not use label typography to manufacture
hierarchy that belongs in nested [Field][codex-field] markup.

Source Editor's syntax-highlighted source, article previews, source diffs, and Revision Copy's
native inline row are distinct surfaces with their own rendering needs. Their
styles must not spill into Codex controls. Preserve host portlet links, headings,
and navigation, and scope lifecycle cleanup to the tool's own elements.

## Titles and explanatory text

Project convention: a [dialog][codex-dialog] title names the task or object, for example
**Manage references**, **Review article**, or **Archive new-page records**.
Use sentence case, omit punctuation at the end, and avoid repeating the title
inside the first field. Section headings identify meaningful stages or datasets;
do not add headings solely to make text larger.

Use the native Dialog title and close control. Prefer its `title`,
`primary-action`, and `default-action` attributes over a custom header or footer.
An exceptional footer with additional actions still uses Codex controls and
structural layout only; it does not recreate button appearance.

Put a concise explanation near the affected field when the user needs it to act.
Name the target page in a write review. A label says what the value means; a
placeholder shows an example. Technical module names and build details belong
in development documentation.

## Fields and related values

For inputs that jointly describe one value or dataset, use an outer `CdxField`
with `:is-fieldset="true"` and a nested `CdxField` for each input. Each child owns
its label, description, validation status, and messages. Disable the outer group
when the whole dataset is unavailable. Keep Codex's built-in nested label
appearance. Independent inputs arranged in columns use a layout wrapper, not a
fieldset. Follow the [nested field pattern][codex-nested-fields].

This project example groups one localized name with its supporting source:

```vue
<cdx-field :is-fieldset="true" :disabled="saving">
  <template #label>Localized name</template>
  <div class="tool-name-columns">
    <cdx-field :status="nameStatus" :messages="nameMessages">
      <template #label>Name</template>
      <cdx-text-input v-model="name" />
    </cdx-field>
    <cdx-field>
      <template #label>Source URL</template>
      <template #description>Source supporting this name</template>
      <cdx-text-input v-model="sourceUrl" />
    </cdx-field>
  </div>
</cdx-field>
```

Use the same pattern for an actual related dataset, not as a universal container
for tabs or lookup tools. A collection of search links does not become a fieldset
because it appears next to a text input.

## Footer and validation

Page forms place their action group at the reading start of the form, with the
primary action last in that group. Dialog actions follow the fields in the native
`CdxDialog` footer; retain its component layout instead of applying a universal
page-footer alignment rule. Form footers align to inline-start: left in LTR and
right in RTL. Dialog footer actions align to inline-end: right in LTR and left
in RTL. Do not put form actions among individual field rows.
Keep footer actions reachable while reading long content. See
[form construction guidance][codex-forms].

Provide field validation when users submit or finish a value, with an actionable
message and preserved input. Do not disable a multi-field form's submit action
merely to hide validation errors. Move focus to the first invalid field after a
failed submission. Use Field status and message attributes for this feedback.

Project exception: pending operations, unavailable generated output, unresolved
write targets, or stale reviewed revisions can block an action. Explain that
state beside the relevant control. Preserve the creator and assessor's explicit
review and conflict checks; ordinary form validation must not bypass them.

## Links, buttons, and repeated items

Navigation uses real links. Operations use buttons with descriptive names.
Choose one primary progressive action per group; cancellation and reversible
secondary actions stay neutral. Horizontal groups place the primary action at the
reading end, and stacked groups place it first. Match keyboard order to visual
order. Separate ordinary actions by the standard 12px spacing; let ButtonGroup
manage its own children. Destructive styling is for an operation that cannot be
undone. See [action-ordering guidance][codex-action-order].

Use normal weight for secondary actions and quiet weight for tertiary actions.
A stacked group's sequence stays the same in LTR and RTL; change the DOM order
with the layout so Tab follows that sequence. Separate destructive actions from
progressive actions and retain a neutral way to leave. In a multistep flow, place
neutral normal **Back** beside primary progressive **Next**, with optional
**Skip** as a quiet action.

In component attributes, neutral means `action="default"`; use `weight="normal"`
for secondary actions and `weight="quiet"` for tertiary actions. Save or Apply
normally uses `action="progressive"` with `weight="primary"`. Codex supplies the
theme's progressive blue, neutral, and destructive red treatment. Do not set
custom colors. Suitable installed icons include `cdxIconAdd`, `cdxIconTrash`,
and `cdxIconUndo`; choose by meaning and retain an accessible action name.

Use [Codex icons][codex-icon] for compact row actions. These are the project's
repeated-item conventions:

| Operation                        | Presentation                                                                                                 | Result and focus                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Add a name, source, or parameter | Neutral secondary **Add …** button after the collection; a quiet add icon is suitable within a repeated row. | Insert a blank draft item and focus its first input.                    |
| Remove an unsaved row            | Quiet neutral remove icon, with an accessible name identifying the item.                                     | Remove that draft row; focus the next row, previous row, or Add action. |
| Reset a draft value              | Quiet neutral **Reset** action or reset icon with a clear label.                                             | Restore the documented default and retain focus in that item.           |
| Save or apply reviewed work      | One primary progressive action in its action group.                                                          | Preserve the user's context and announce completion.                    |
| Irreversible deletion            | Destructive action with explicit object and consequences.                                                    | Confirm when needed; retain recovery information after failure.         |

Icon-only controls need translated accessible labels. Avoid destructive red for
removing an unsaved draft row or resetting a reversible preference. An icon's
purpose must not depend on color. Keep row actions associated with their own item
when a list wraps or is reordered.

## Loading and request feedback

Use a [ProgressBar][codex-progress-bar] for an operation affecting a whole view
or region. Use its indeterminate state when progress cannot be measured; a
numeric value requires a real completed/total count. Give the bar an accessible
name, or hide only a decorative duplicate whose containing status is already
announced. Keep its native size and appearance.

Use a [ProgressIndicator][codex-progress-indicator] for a local asynchronous
operation such as loading one newly added reference or checking one title. Its
default-slot label names the work, such as **Checking page title**, without an
ellipsis. Use `show-label` when that label should also be visible. When a loading
placeholder must preserve the surrounding layout, use the native inline
ProgressBar. Do not show artificial percentages for an unknown-duration request.

Project convention: place progress beside the affected output or item and mark
that region busy. Preserve the user's typed value and existing reviewed results;
mark older results stale where necessary. A pending row can show **Loading…** in
its status area, but its actual title, citation, or source value stays empty until
verified. Never use invented values as loading placeholders or mark a failed
lookup as a confirmed missing page.

On success, replace progress with the validated result and announce useful
completion once. On failure, retain the item or draft, describe what failed, and
offer an explicit retry where supported. Ignore results for removed items or
superseded input. Keep focus stable during background work, and avoid repeating
live announcements on every animation frame. A write operation retains its
review/conflict rules even when progress is visible.

## State lifetime and saved configuration

Choose a lifetime deliberately for each state owner; the table defines defaults
for new work. Existing tool-specific recovery and persistence contracts remain
recorded in their configuration and architecture guides.

| Lifetime                     | Default use                                                                                 | Saving and disposal                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dialog session, in memory    | Unapplied form values, current selection, pending request identity, and transient feedback. | Initialize on open; apply explicitly; release listeners and invalidate requests on disposal. Keep recovery drafts only through a documented owner. |
| Current page, in memory      | Deduplicated lookups and disposable caches shared by that page's interfaces.                | Bound caches and invalidate stale identities; navigation or reload ends this state.                                                                |
| Browser tab, session storage | Explicitly recoverable operations that should survive a reload in the same tab.             | Version and validate stored data; clear confirmed or discarded work. Closing the tab ends the session.                                             |
| Browser persistent storage   | Saved preferences and deliberately persistent drafts or queues.                             | Save preferences through **Save settings**, version the schema, and provide documented reset/removal behavior.                                     |

Both browser storage APIs are scoped to the current origin. `localStorage`
persists beyond a tab session; `sessionStorage` also belongs to its tab. A
preference saved on one wiki origin does not automatically appear on another
wiki, mobile hostname, browser profile, or device. Include tool and schema
identity in keys; include wiki/account identity for account-dependent drafts and
queues. Newly named stores use `kanade:<tool>:<purpose>:v<schema>` and start
with validated defaults. Preserve functional keys for user-authored history,
drafts, queues, and recovery unless an explicit replacement protects that work.
Retired preference/cache records are neither imported nor deleted automatically.
When an active schema changes, validate and migrate data only through its
documented boundary; use a schema version, not the release version
such as 0.1.0, in storage identity. Do not share an assessment draft between accounts merely because they
use the same browser. Handle unavailable storage without losing the open draft.

Same-origin navigation and reload preserve session storage. A newly opened or
duplicated tab can begin with a copied snapshot, but subsequent changes are not
synchronized; recovery owners must still validate stored targets and revisions.

Source Editor's pre-load `window.sourceEditorConfig` supplies runtime defaults,
validated once and frozen at startup. Retired configuration globals have no
fallback. A configuration object is not itself a save operation. Preference
adapters persist only their
documented settings. Article Assessor's intentionally persistent reviewed queue is
separate from disposable per-tab API snapshots.

Cross-site settings need an explicit design and user opt-in. Userscript-manager
storage such as `GM.setValue` can support that design only with the required
metadata grants and a defined account/wiki scope; it is not interchangeable with
page `localStorage`. Do not silently make draft wikitext, account state, or site
configuration portable. Document export/import, reset, schema migration, and
which values are shared before adding synchronization. Current userscripts use `@grant none`; cross-wiki
synchronization is not implemented.

## State, language, and review

### Completing an input

For API lookups, preview preparation, and validation, treat these as completion
events: a paste after the browser has updated the input value, Enter in a
single-line input, or the field losing focus. In a multiline textarea, Enter
inserts a newline; paste and blur can complete the input. Preserve IME
composition: composition keystrokes and composition-ending Enter do not submit.

Typing updates the draft and invalidates stale output or pending results, without
starting costly queries on every keystroke. Normalize the completed value and
reuse an identical pending or successful request, so paste followed by blur or
Enter followed by blur does not duplicate work. A deliberate completion event
may retry a failed request with the same input. Accept a result only if its input,
page, source, and owning session still match the current state.

Completion events prepare or check output. They never automatically publish wiki
edits or silently apply source formatting. Keep those changes behind the tool's
explicit apply or review/save action. Revision Copy's input-completion behavior is the
baseline for this project pattern.

### Feedback and lifecycle

Project convention: preserve drafts, source selection, and undo history through
optional lookup failures. Discard stale responses when inputs, source, page, or
owner changes. Show success only after the operation completes. An accessible
progress indicator describes pending work, and retry uses the latest reviewed
state. Closing a dialog restores focus to the control that opened it.

Render user and API text safely. Distinguish saving preferences, applying an
editor change, copying output, and submitting live wiki edits in visible labels.

### Interface language

Interface labels follow the user's supported language or Chinese variant.
Every tool provides English (`en`), Simplified Chinese (`zh-Hans`), Traditional
Chinese (`zh-Hant`), Japanese (`ja`), and Russian (`ru`) catalogs. Regional
Japanese and Russian tags use their base catalog; unsupported languages use
English. Keep message keys and interpolation placeholders aligned across all
catalogs.
Authored `zh-Hant` interface text uses Taiwan vocabulary, including **設定**,
**清單**, **字元**, **原始碼**, and **語法凸顯**. Translate wording as well as
characters; converting a Simplified Chinese label to Traditional Chinese does
not by itself produce the intended terminology. Preserve established wiki
domain terms such as **模板** and **參考資料**.

This convention applies to the tool's own labels, messages, accessible names,
and instructions. Fetched article text, citation details, editor source, and
source titles retain their original wording. Content language and revision
timestamps follow their documented source rules independently of the interface
locale. Historical screenshots retain their recorded text until regenerated.

Review new layouts at 375 × 667, 683 × 768, and 1366 × 768 CSS pixels. Check long
translations, keyboard order, default component appearance, visible labels,
progress, errors, and reachable actions. Existing historical screenshots retain
their recorded dimensions and provenance until regenerated. Follow
[documentation](documentation.md#screenshots-and-attribution) and the tool's
capture guide when replacing images.

For new or revised interfaces, include a manual keyboard and screen-reader check:
reach and activate every action without a pointer, verify accessible names and
validation/progress announcements, check focus after opening and closing dialogs,
and inspect contrast in the supported host appearance. Record the browser,
assistive technology, locale, and checked workflow with the release evidence.
Automated browser tests support this review; they do not certify WCAG conformance.
The [maintenance assessment](maintenance.md#release-assessment) records checks
that still need manual review.

[codex]: https://doc.wikimedia.org/codex/latest/
[codex-forms]: https://doc.wikimedia.org/codex/latest/style-guide/constructing-forms.html
[codex-action-order]: https://doc.wikimedia.org/codex/latest/style-guide/using-links-and-buttons.html#types-and-order-of-buttons
[codex-field]: https://doc.wikimedia.org/codex/latest/components/demos/field.html
[codex-nested-fields]: https://doc.wikimedia.org/codex/latest/components/demos/field.html#fieldset-with-nested-fields
[codex-dialog]: https://doc.wikimedia.org/codex/latest/components/demos/dialog.html
[codex-button]: https://doc.wikimedia.org/codex/latest/components/demos/button.html
[codex-icon]: https://doc.wikimedia.org/codex/latest/components/demos/icon.html
[codex-progress-bar]: https://doc.wikimedia.org/codex/latest/components/demos/progress-bar.html
[codex-progress-indicator]: https://doc.wikimedia.org/codex/latest/components/demos/progress-indicator.html
