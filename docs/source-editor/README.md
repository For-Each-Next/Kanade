# Source Editor

Last reviewed: 2026-10-21.

Source Editor combines source editing, reference management, and wikitext formatting
in one tool. Accepted changes return to the same editor for review and publication.

## Features

- Live source highlighting with link and reference previews.
- Reference inspection and editing from the editor, with access to the full manager.
- Citation creation from a URL, identifier, pasted text, or manual details.
- Browsing, reusing, reviewing, and organizing article references.
- Shared formatting for editor text and citation workflows.
- A Tools tab with regular-expression replacement previews, explicit acceptance,
  and guarded undo for the current source or selection.
- English, Japanese, Russian, Simplified Chinese, and Traditional Chinese
  interface labels.

## Install and open

Install [source_editor.user.js](../../dist/source_editor.user.js) in a userscript manager, or paste
[source_editor.min.js](../../dist/source_editor.min.js) into your wiki's
`Special:MyPage/common.js`. Choose one method and reload an **Edit source** page.
Open **Source Editor** in page tools. Its **References** tab provides **Manage references**.
The bottom-right **Format** button formats the selected text immediately,
or the whole section/page when no text is selected, using current settings.
The adjacent **Tools** button opens regex tools. These buttons run horizontally
and wrap when the viewport is narrow.
See the [project installation guide](../../README.md#install-and-use) for the
shared build and installation methods.

For a temporary session, paste the complete [source_editor.min.js](../../dist/source_editor.min.js)
file into the browser console ([F12][developer-tools], then **Console**) and press
Enter. The tool remains loaded until the page is reloaded.

The userscript matches supported Wikimedia sites. The reference manager's
metadata and validation rules have specific English and Chinese Wikipedia
support; other sites use their available host metadata where supported.
Remove Source Editor by disabling its userscript or deleting its `common.js` code.
Before replacing an earlier installation, copy unsaved source, disable the previous
script, install the replacement, and reload. Repeated loading of the current
script is guarded; a previously loaded script can have a separate startup owner.

For an account-wide Wikimedia installation, paste the compact script into
[Meta-Wiki global.js][global-script] instead of a single wiki's `common.js`.
To deploy as a site gadget, an administrator can upload the compact build to
`MediaWiki:Gadget-source-editor.js` and register it in
`MediaWiki:Gadgets-definition`:

```text
* source-editor[ResourceLoader]|source-editor.js
```

The tool loads the wiki's [Vue][vue] and [Wikimedia Codex][codex] modules for its dialogs.
The reference adapter supports backing textareas, [CodeMirror][codemirror], and
[VisualEditor source mode][visualeditor-source].
For another MediaWiki site's userscript installation, add its URL pattern to the
script's `@match` entries and check its host-module compatibility. See
[userscript metadata][userscript-metadata] for matching and execution settings.

## Use

The panel has **Formatting**, **References**, **Highlighting settings**, and
**Tools** tabs. Open **Highlighting settings**
to adjust highlighting or **Formatting** to transform source. **References**
opens reference management. **Formatting** includes **Format citations with the
article**, with inline/block layout, reference organization, and automatic
script-title choices alongside article cleanup.
The Traditional Chinese highlighting tab is **語法凸顯設定**.
**Save settings**
stores preferences for this browser and wiki. Applying formatting changes the
editor source; publishing remains MediaWiki's own action.

**Tools** presents numbered **Find 1 / Replace 1**, **Find 2 / Replace 2** pairs
for regular-expression replacements in the current source or captured selection.
Add pairs as needed; they run in order. **Options** contains the shared flags.
Review the combined result, choose **Apply replacements**, and use
**Undo replacement** only while that result still matches the current source.
Changing source invalidates a prepared result; closing the dialog ends the draft.

Use **References → Manage references** to open the integrated reference manager.
Reference popup previews provide inline inspection and editing without a separate
manager button. In **Sources**, filter existing entries with **Source content**, or
choose **Generate source** to prepare a new citation. Leave the generation input
empty to enter source details manually. Accepted changes return to the same
backing editor and remain part of its source and undo history.

Review generated wikitext and warnings before publishing. Optional lookups need a
network connection; unavailable metadata does not replace your source with an
invented result. Long source remains editable as plain text when the configured
highlighting limit is reached.

With article-link previews enabled, hover over a wiki link to read the linked
article's description and introductory text. Source Editor fetches that content from
the target wiki; article text follows its source language independently of the
interface language. Preview results are cached for the editing session.

## Reference

- [Project maintenance](../maintenance.md) for status, contact, dependencies,
  browser data, recovery, and handoff.
- [Configuration](configuration.md) and the shared
  [control-panel workflows](control-panel.md) for editing, formatting, and references.
- [Reference naming](reference-names.md).
- [Source Editor architecture](architecture.md), including shared scanning,
  formatting, editor access, and lifecycle ownership.
- [Citation metadata maintenance](cs1/maintenance.md).
- One [screenshot inventory](images/README.md) with three live Wikipedia images
  of shared formatting preferences, one in English and one in each Chinese
  variant, on their matching Wikipedia editions. The
  inventory records actual source revisions, the native browser capture workflow,
  live preview responses, and article attribution.
- [Development](../development.md), [documentation](../documentation.md), [CC0-1.0 license](../../LICENSE),
  and [third-party notices](../../THIRD-PARTY-NOTICES.md).

Source Editor builds on [Cacycle's wikEd](https://en.wikipedia.org/wiki/User:Cacycle/wikEd).

[developer-tools]: https://en.wikipedia.org/wiki/Web_development_tools
[global-script]: https://meta.wikimedia.org/wiki/Special:MyPage/global.js
[userscript-metadata]: https://www.tampermonkey.net/documentation.php
[vue]: https://vuejs.org/guide/introduction.html
[codex]: https://doc.wikimedia.org/codex/latest/
[codemirror]: https://www.mediawiki.org/wiki/Extension:CodeMirror
[visualeditor-source]: https://www.mediawiki.org/wiki/Help:VisualEditor/User_guide#Switching_between_the_visual_and_wikitext_editors
