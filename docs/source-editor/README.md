# Source Editor

Last reviewed: 2026-11-14.

Source Editor combines reference management and wikitext formatting with the
active MediaWiki source editor. Accepted changes return to that editor for review
and publication.

## Features

- Native source editing with your MediaWiki CodeMirror preferences.
- Citation creation from a URL, identifier, pasted text, or manual details.
- Browsing, reusing, reviewing, and organizing article references.
- Shared formatting for editor text and citation workflows.
- English, Japanese, Russian, Simplified Chinese, and Traditional Chinese
  interface labels.

## Install and open

Install [source_editor.user.js][latest-userscript] in a userscript manager, or paste
[source_editor.min.js][latest-compact] into your wiki's
`Special:MyPage/common.js`. Choose one method and reload an **Edit source** page.
Open **Source Editor** in page tools. Its **References** tab provides **Manage references**.
The bottom-right **Format** button formats the selected text immediately,
or the whole section/page when no text is selected, using current settings.
The adjacent **References** button opens **Manage references** directly.
These buttons run horizontally
and wrap when the viewport is narrow.
See the [project installation guide](../../README.md#install-and-use) for the
shared build and installation methods.

Both download links follow the latest stable release. For a local build, use
the matching files in `dist/`.

For a temporary session, paste the complete [source_editor.min.js][latest-compact]
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

The panel has **Formatting** and **References** tabs. **Formatting** includes
**Format citations with the article**, with inline/block layout, reference
organization, and automatic script-title choices alongside article cleanup.
**Save settings** stores formatting preferences for this browser and wiki.
Applying formatting changes the editor source; publishing remains MediaWiki's
own action.

Enable or disable CodeMirror through MediaWiki's editing preferences or its
native **Syntax** toolbar control. Use CodeMirror's preferences for highlighting,
line numbers, folding, completion, reference highlighting, and editor appearance.
Use its search panel for find and replace. Available features depend on the wiki's
CodeMirror version and editor. Source Editor respects that native choice and
works with an active CodeMirror editor or the ordinary textarea.

Use **References → Manage references** to open the integrated reference manager.
In **Sources**, filter existing entries with **Source content**, or
choose **Generate source** to prepare a new citation. Leave the generation input
empty to enter source details manually. Accepted changes return to the same
backing editor and remain part of its source and undo history.

Review generated wikitext and warnings before publishing. Optional lookups need a
network connection; unavailable metadata does not replace your source with an
invented result.

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
[codemirror]: https://www.mediawiki.org/wiki/Help:Extension:CodeMirror
[visualeditor-source]: https://www.mediawiki.org/wiki/Help:VisualEditor/User_guide#Switching_between_the_visual_and_wikitext_editors
[latest-userscript]: https://github.com/For-Each-Next/Kanade/releases/latest/download/source_editor.user.js
[latest-compact]: https://github.com/For-Each-Next/Kanade/releases/latest/download/source_editor.min.js
