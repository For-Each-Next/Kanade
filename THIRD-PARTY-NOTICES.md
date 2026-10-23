# Third-party notices

All project-owned code and documentation in Kanade is dedicated under
[CC0-1.0](LICENSE). The following third-party material retains its own terms.
The project's dedication does not relicense fetched wiki content, icons, libraries,
or contributors' article text.

Generated installation scripts include only the sections declared for their
bundled material in `scripts/tools.mjs`. Documentation and test-fixture credits,
fetched-content terms, and development-dependency notices remain in this file.

## Codex icons

Source Editor and Article Creator include selected icon artwork and vector paths from
`@wikimedia/codex-icons` 2.7.0. The artwork is by the Wikimedia Foundation Design
System Team and contributors, from the [Codex icon collection](https://doc.wikimedia.org/codex/latest/icons/overview.html),
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Selected icon data
is bundled and minified; the artwork is otherwise unmodified. The package
software has the MIT license reproduced below.

## HTML entity decoder

Source Editor includes the HTML entity decoder and named entity table from
[`entities` 4.5.0](https://github.com/fb55/entities/tree/v4.5.0), by Felix Böhm
and contributors, under the BSD-2-Clause license reproduced below.

## Wikimedia data

Bundled Wikimedia data retain their applicable project status and terms. The
[Wikimedia Terms of Use](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)
describe reuse licenses and attribution. The software license does not change
the source data's terms.

## Source Editor citation template data

Citation TemplateData snapshots in `src/source-editor/config/citation-template-data/`
come from the [English Wikipedia TemplateData API](https://en.wikipedia.org/w/api.php?action=templatedata&format=json&titles=Template%3ACite_web)
and [Chinese Wikipedia TemplateData API](https://zh.wikipedia.org/w/api.php?action=templatedata&format=json&titles=Template%3ACite_web).
Generated modules identify their templates and source data. The
[TemplateData maintenance guide](docs/source-editor/cs1/maintenance.md)
describes the update workflow.

## MediaWiki site configuration

Namespace names and aliases in Source Editor, Article Creator, and Article Assessor reflect
MediaWiki site configuration.

## Article Creator catalogs

Article Creator's Cite web definitions reflect
[Template:Cite web](https://en.wikipedia.org/wiki/Template:Cite_web). Its company,
platform, genre, and year catalogs contain factual titles, aliases, category names,
and template names checked through English and Chinese Wikipedia APIs. Collection
and revision evidence is recorded in
[terminology sources](docs/vg-stub-creator/data/terminology-sources.json)
and the [maintenance guide](docs/vg-stub-creator/terminology-database.md).

## Fetched Wikimedia content

Cached source template markup, runtime metadata, citations, article excerpts,
previews, and Wikidata responses retain their respective source terms.

Fetched content retains its applicable Wikimedia project status and terms. The
[Wikimedia Terms of Use](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)
describe reuse licenses and attribution. The software license does not change
licensing of fetched content or an editor's submitted contributions.

## Article fixtures and screenshots

The Source Editor citation regression excerpt contains reference and heading excerpts
from [《地球冒险3》, revision 94690392](https://zh.wikipedia.org/w/index.php?title=%E5%9C%B0%E7%90%83%E5%86%92%E9%99%A93&oldid=94690392),
by [Chinese Wikipedia contributors](https://zh.wikipedia.org/w/index.php?title=%E5%9C%B0%E7%90%83%E5%86%92%E9%99%A93&action=history),
under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
It retains inline definitions, forward references, and template-valued `details`
attributes while omitting article prose and other sources for regression tests.

Source Editor's Chinese-interface editor screenshots use the unchanged article source of
[任天堂 (Nintendo), revision 94167581](https://zh.wikipedia.org/w/index.php?oldid=94167581),
by [Chinese Wikipedia contributors](https://zh.wikipedia.org/w/index.php?title=%E4%BB%BB%E5%A4%A9%E5%A0%82&action=history),
under CC BY-SA 4.0. Its article-link preview uses fetched Chinese Wikipedia
introductory text from
[任天堂Switch, revision 94119527](https://zh.wikipedia.org/w/index.php?title=%E4%BB%BB%E5%A4%A9%E5%A0%82Switch&oldid=94119527),
by [Chinese Wikipedia contributors](https://zh.wikipedia.org/w/index.php?title=%E4%BB%BB%E5%A4%A9%E5%A0%82Switch&action=history),
under CC BY-SA 4.0. The response also retains central description metadata
associated with [Wikidata item Q19610114](https://www.wikidata.org/wiki/Q19610114).
The
[Source Editor image inventory](docs/source-editor/images/README.md) records the separate preview
response, article revision, source metadata, and capture conditions.

Source Editor’s Chinese-interface reference-manager screenshots and Article Creator’s
live capture background use
[信賴鈴音 ～蕭邦之夢～ (Eternal Sonata), revision 94743103](https://zh.wikipedia.org/w/index.php?title=%E4%BF%A1%E8%B3%B4%E9%88%B4%E9%9F%B3_%EF%BD%9E%E8%95%AD%E9%82%A6%E4%B9%8B%E5%A4%A2%EF%BD%9E&oldid=94743103),
by [Chinese Wikipedia contributors](https://zh.wikipedia.org/w/index.php?title=%E4%BF%A1%E8%B3%B4%E9%88%B4%E9%9F%B3_%EF%BD%9E%E8%95%AD%E9%82%A6%E4%B9%8B%E5%A4%A2%EF%BD%9E&action=history),
under CC BY-SA 4.0. The unified [Source Editor image inventory](docs/source-editor/images/README.md)
records checksums, dimensions, live services, and provenance for source-editing
and reference-management views. The [Article Creator image inventory](docs/vg-stub-creator/images/README.md)
records its illustrative form input separately from the live Wikipedia background. Revision Copy's
[capture guide](docs/rev-copy/images/README.md) records its live article sources,
including English Wikipedia's Eternal Sonata (revision 1376010866), Nintendo on
English (1379167316) and Japanese (111307787) Wikipedia,
and English Wikipedia's Intel 1103 (1342192065) with attribution to the actual
Commons Category:Intel 1103 source (339992055).
The inventory links the contributors and individual file-page terms for visible
article imagery.

Source Editor's English screenshots use unchanged source from Nintendo on
English Wikipedia (revision 1379167316). Its English reference-manager views use
Eternal Sonata (1376010866). Nintendo Switch source views use English
(1378957550) and Chinese (94119527) Wikipedia.
Text is by each edition's contributors under CC BY-SA 4.0. The
[image inventory](docs/source-editor/images/README.md) links the source revisions and
contributor histories, including the actual article-link preview responses.
No article media files are displayed in these source-editing views.

Article Creator and Article Assessor retain source fixtures from
[BanG Dream! 少女樂團派對, revision 94028176](https://zh.wikipedia.org/w/index.php?title=BanG%20Dream!%20%E5%B0%91%E5%A5%B3%E6%A8%82%E5%9C%98%E6%B4%BE%E5%B0%8D&oldid=94028176),
by [Chinese Wikipedia contributors](https://zh.wikipedia.org/w/index.php?title=BanG%20Dream!%20%E5%B0%91%E5%A5%B3%E6%A8%82%E5%9C%98%E6%B4%BE%E5%B0%8D&action=history),
under CC BY-SA 4.0. Article Assessor also retains a user-supplied lead from
[Talk:BanG Dream! 少女樂團派對](https://zh.wikipedia.org/wiki/Talk:BanG_Dream!_少女樂團派對),
by the [talk-page contributors](https://zh.wikipedia.org/w/index.php?title=Talk:BanG_Dream!_少女樂團派對&action=history),
under CC BY-SA 4.0. Its adjacent fixture metadata records the supplied provenance
without claiming an exact revision. Historical screenshots show excerpts or
simplified renderings with simulated assessments and API responses. The archive
preview in those offline tests is synthetic. Current documentation images use
live Wikipedia browser captures, with exact source revisions and unsaved proposals
recorded in the [creator](docs/vg-stub-creator/images/README.md)
and [assessor](docs/wpvg-assessor/images/README.md) guides.

## Host runtimes and development dependencies

Production Vue and Codex components come from MediaWiki ResourceLoader. They
are not bundled as additional runtimes. Their packages and all build/test tools
retain the licenses distributed with the dependencies.

## MIT: Codex icon software

```text
MIT License

Copyright (c) 2011-2022 Wikimedia Design & OOUI team and other contributors.

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## BSD-2-Clause: entities

```text
Copyright (c) Felix Böhm
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
