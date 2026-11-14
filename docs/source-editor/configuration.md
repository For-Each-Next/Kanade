# Configuration

Last reviewed: 2026-11-14.

Open **Source Editor** from the page tools. Its **Formatting** tab combines
article and citation options. Enable **Format citations with the article** to
choose inline/block layout, compact reference calls, definition spacing, and
automatic script-title handling. The **References** tab opens the integrated
manager through **Manage references**. Formatting changes source only after an
explicit action; publishing remains the host editor's own action.

## Native editor preferences

[MediaWiki CodeMirror][codemirror] owns syntax highlighting, search and replace,
folding, completion, line numbering, reference highlighting, and editor
appearance. Enable or disable it through MediaWiki's editing preferences or the
native **Syntax** toolbar control. Open its preferences from the native toolbar
or the keyboard shortcut documented by MediaWiki. Available features depend on
the wiki's CodeMirror version and editor.

Source Editor respects the native choice. It neither loads another editor nor
changes CodeMirror settings. Its formatter and reference manager work with the
active CodeMirror editor or the native textarea. The former Highlighting
settings tab, custom editor display options, preview popups, and Tools replacer
have been removed; use CodeMirror's native editor features instead.

## Formatting preferences

**Save settings** stores the current formatting draft in this browser's
localStorage on the current wiki and leaves the panel open. Apply formatting
separately to change source. Cancel, close, and Escape discard unapplied drafts.
**Reset settings** deletes the saved formatting settings and restores the dialog
defaults; it does not format source.

Settings stay on the current wiki origin in this browser; another wiki, browser
profile, or device has its own preferences. Source text and citation drafts are
not saved as configuration. Saved preferences use
`kanade:source-editor:formatter-settings:v1`, containing
`{ schemaVersion: 1, settings }`. Existing records retain valid formatting and
citation choices while obsolete editor fields are ignored. A failed storage
write preserves the open draft and session-only application remains available.

Under **Formatting options**, **Format HTML tags** is available on every wiki
and off by default. It normalizes tag spacing, quotes unquoted attribute values,
and tidies inline CSS in `style` attributes. Comments, literal extension contents,
and ambiguous or dynamic syntax remain protected. **Format language conversion
rules** is available only on zhwiki and covers inline `-{...}-` rules and
page-wide manual `NoteTA` rules. Template alignment choices are available on every
wiki. Redirect replacement runs only during explicit formatting.

**Split comma-separated author names** is an opt-in citation-formatting choice,
off by default. It converts `author=Smith, Jane` into `last=Smith | first=Jane`
and supports numbered author fields. Natural-order names such as `Jane Smith`
remain unchanged. Existing split author fields are never overwritten; unsupported
or ambiguous names retain their source spelling. Enable **Format citations with
the article** and explicitly format source to apply the choice.

## Runtime options and metadata

Set `window.sourceEditorConfig` before loading Source Editor. Startup validates
and freezes the resolved values once; changing this object afterward requires a
reload. The remaining option is the log level:

```js
window.sourceEditorConfig = { logLevel: 'warn' };
```

`logLevel` accepts `silent`, `error`, `warn`, `info`, or `debug`. Missing or invalid
values use `warn`. Former custom highlighting and hover delay options are ignored.

Namespace metadata uses a 24-hour browser cache at
`kanade:source-editor:siteinfo:v1:<wiki>`. Citation TemplateData uses
`kanade:source-editor:template-data:v1`, with wiki identity in its validated
envelope. Refresh is requested after seven days; failed refresh can preserve
usable stale metadata. Metadata failure preserves source and leaves unsafe
rewrites unavailable. See [control-panel behavior](control-panel.md) for the
interaction contract.

[codemirror]: https://www.mediawiki.org/wiki/Help:Extension:CodeMirror
