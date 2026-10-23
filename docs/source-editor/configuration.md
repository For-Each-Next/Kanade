# Configuration

Last reviewed: 2026-10-17.

Open **Source Editor** from the page tools. The **Highlighting settings** tab
(**語法凸顯設定** in Traditional Chinese) controls
highlighting, text size, and optional lookups; **Formatting** combines article and
citation options. Enable **Format citations with the article** there to choose
inline/block layout, compact reference calls, definition spacing, and automatic
script-title handling. The **References** tab opens the integrated manager
through **Manage references**.
The primary action accepts settings for the current edit. Cancel, close, and
Escape discard unapplied drafts.

The Highlighting settings tab has four groups, in order: **Syntax highlighting**,
**Text and colors**, **Links**, and **Reference popups**. The first group selects
Source Editor for wikitext and CodeMirror for other content models. The remaining
groups control Source Editor's display and inspection features.

Turning off **Use Source Editor to highlight wikitext pages** removes its editor
frame and restores the native textarea. The three display groups are disabled,
including larger text, while retaining their preferences. Applying the option
again restores the enhanced editor with those preferences and the current source.

Under **Syntax highlighting**, **Use CodeMirror for other content models** is
off by default. Source Editor enhances only wikitext; when this setting is off, it
loads no enhanced editor for other models. Turn it on and use **Save settings**
in the footer to load [CodeMirror](https://www.mediawiki.org/wiki/Extension:CodeMirror)
on later edits of other content models. The panel is available on wikitext edit
pages.

**Save settings** is a normal secondary button in the footer. It stores the
current draft from all settings tabs in this browser's localStorage on the current wiki
for later sessions and leaves the panel open. Apply it separately to the current
edit. The **More** menu contains only **Clear cache** and **Reset settings**.
Citation formatting and editor preferences share this one record. Settings stay
on the current wiki origin in this browser; another wiki, browser profile, or
device has its own preferences. Source text and citation drafts are not saved as
configuration. Saved preferences use
`kanade:source-editor:formatter-settings:v1`, containing
`{ schemaVersion: 1, settings }`. Retired preference records and configuration
globals are not imported, read as fallbacks, or deleted automatically. The
replacement begins with validated defaults. A failed storage write keeps the draft open and leaves
session-only application available.
**More → Clear cache** immediately clears
link, summary, and whole-page reference results while preserving source and
preferences. It also invalidates pending results.

**More → Reset settings** deletes all saved Source Editor settings from this browser
and restores the dialog defaults. Save and Reset always cover all settings tabs. Reset
leaves the current editor and source unchanged until you apply the defaults.

Under **Links**, Ctrl-click navigation (Command-click on Mac) is on by default. Turn it off
to disable opening editor links with Ctrl-click or Command-click on Mac. Apply
the choice to the current edit; use **Save settings** to retain it for
later sessions. This option requires syntax highlighting.
In supported interlanguage templates such as `{{tsl}}`, `{{Translink}}`, and
`{{link-en}}`, clicking the foreign page title opens that language's Wikipedia;
the local title and display label still open the local page.

Under **Formatting options**, **Format HTML tags** is available on every wiki
and off by default. It normalizes tag spacing, quotes unquoted attribute values,
and tidies inline CSS in `style` attributes. Comments, literal extension contents,
and ambiguous or dynamic syntax remain protected. **Format language conversion
rules** is available only on zhwiki and covers inline `-{...}-` rules and
page-wide manual `NoteTA` rules.

Under **Text and colors**, **Alternate pink and blue for consecutive references**
is off by default. References start pink. Enable this setting to alternate pink
and blue backgrounds within consecutive groups. Text colors stay unchanged. For example,
`<ref>...</ref><ref name="a" />{{sfn|a}}<ref name="b">...</ref>` has three groups:
the middle `<ref name="a" />{{sfn|a}}` shares the blue background. A supported
reference template immediately following a self-closing `<ref />` belongs to
that group; subsequent and standalone reference templates also alternate.
Intervening prose starts a new sequence. `{{Efn}}`, `{{NoteTag}}`, and supported
variants use the normal template background for their nesting level and retain the optional
small reference text size. Embedded `<ref>` tags and supported reference
templates keep their own reference colors.
They do not count as reference color groups; consecutive references inside a note
alternate from pink independently of references before the note.

Reference hover previews show a subreference's `details` before its parent
bibliography. Those details remain visible when the parent definition is missing.
When whole-page reference loading is enabled during section editing, the preview
also looks for the parent in the full page source.
Subreference content displays its raw wikitext using the editor's syntax
highlighting rules. Templates remain source text and are not expanded.
Citation preview headings link to the citation template's documentation page.
Archive URLs are shortened when they embed the original URL, including when
only HTTP versus HTTPS differs; clicking still opens the full archive address.

## Runtime options

Set `window.sourceEditorConfig` before loading Source Editor. Startup validates
and freezes the resolved values once; changing this object afterward requires a
reload. Missing, malformed, negative, or unsupported values use the documented
defaults individually. Delays must be integers from 0 through 60,000 milliseconds.
The highlighting limit must be a nonnegative safe integer or `Infinity`.

```js
window.sourceEditorConfig = {
  highlightDelay: 100,
  maxLiveHighlightLength: 1_024_768,
  referenceTooltipDelay: 700,
  pagePreviewDelay: 700,
  logLevel: 'warn',
};
```

| Option                   | Default     | Meaning                                                                                                                |
| ------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `maxLiveHighlightLength` | `1_024_768` | Source-length ceiling for live highlighting. Longer text stays editable as plain text. `Infinity` removes the ceiling. |
| `highlightDelay`         | `100`       | Delay in milliseconds before refreshing highlighting after an edit.                                                    |
| `referenceTooltipDelay`  | `700`       | Settled pointer-hover delay in milliseconds before showing a reference preview.                                        |
| `pagePreviewDelay`       | `700`       | Settled pointer-hover delay in milliseconds before showing a page preview.                                             |
| `logLevel`               | `'warn'`    | `silent`, `error`, `warn`, `info`, or `debug`.                                                                         |

Page-summary loading starts after a short hover and results are cached for the
editing session. Missing-page checks and whole-page reference loading are
optional. Namespace metadata uses a 24-hour browser cache at
`kanade:source-editor:siteinfo:v1:<wiki>`. Citation TemplateData uses
`kanade:source-editor:template-data:v1`, with wiki identity in its validated
envelope. Refresh is requested after seven days; failed refresh can preserve
usable stale metadata. These disposable stores begin fresh under the new identity.
Failed optional
requests preserve editing and section-local reference analysis.

Redirect replacement runs only during an explicit formatting action. Language
conversion formatting is available only on zhwiki. Template alignment choices are
available on every wiki. See [control-panel behavior](control-panel.md) for the
full interaction contract.
