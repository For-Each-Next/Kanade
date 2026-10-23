/**
 * @file tests/build/artifacts.test.mjs
 * Purpose: Verify shared distribution integrity and userscript startup without a wiki.
 *
 * Table of contents:
 * 1. Imports and artifact fixtures
 * 2. Metadata, licensing, and integrity checks
 * 3. Dependency boundary checks
 * 4. Page-realm startup and lifecycle checks
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContext, runInContext, runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import {
    createArtifacts,
    createLicenseNotice,
    createManifest,
    createUserscriptProgram,
    readToolLicense,
    validateArtifact,
} from '../../scripts/artifacts.mjs';
import {
    assertRuntimeDependencies,
    compactCssTextPlugin,
    prepareAsset,
    projectRoot,
} from '../../scripts/build.mjs';
import { artifactNames, tools } from '../../scripts/tools.mjs';

const version = '0.1.0';
const license = 'Fixture project license.\nThird-party notice preserved.';
const compactLicense = 'Third-party notice preserved.';
const expectedNoticeSections = {
    'source-editor': [
        'Codex icons',
        'HTML entity decoder',
        'Wikimedia data',
        'Source Editor citation template data',
        'MediaWiki site configuration',
        'MIT: Codex icon software',
        'BSD-2-Clause: entities',
    ],
    'rev-copy': [],
    'vg-stub-creator': [
        'Codex icons',
        'Wikimedia data',
        'MediaWiki site configuration',
        'Article Creator catalogs',
        'MIT: Codex icon software',
    ],
    'wpvg-assessor': ['Wikimedia data', 'MediaWiki site configuration'],
};
const outputs = await Promise.all(
    tools.map((tool) =>
        createArtifacts({
            tool,
            compact: 'window.fixtureStarted = true;',
            version,
            license,
            compactLicense,
        }),
    ),
);

test('every independent tool has one readable userscript and one compact script at the shared version', () => {
    assert.equal(tools.length, 4);
    assert.equal(artifactNames.length, 8);
    assert.equal(new Set(artifactNames).size, tools.length * 2);
    for (const [index, tool] of tools.entries()) {
        const artifacts = outputs[index];
        assert.deepEqual(
            [...artifacts.keys()],
            [`${tool.basename}.min.js`, `${tool.basename}.user.js`],
        );
        for (const [name, source] of artifacts) {
            assert.doesNotThrow(() =>
                validateArtifact(name, source, {
                    tool,
                    version,
                    license,
                    compactLicense,
                }),
            );
            assert.ok(
                source.includes(
                    createLicenseNotice(
                        name.endsWith('.min.js') ? compactLicense : license,
                    ),
                ),
            );
            assert.match(source, /@version 0\.1\.0/u);
        }
        assert.equal(
            artifacts
                .get(`${tool.basename}.user.js`)
                .includes('// @noframes\n'),
            tool.id === 'rev-copy',
        );
    }
});

test('compact executable code stays on one line while string and template contents survive', async () => {
    const tool = tools[0];
    const values = [
        'first\r\n  second\nlast',
        '<pre>first\n  second</pre> <span>two  words</span>',
        '.parent .child { content: "two  words"; }',
        '` ${literal} \\path\u2028separator\u2029end',
    ];
    const artifacts = await createArtifacts({
        tool,
        compact: `
            window.fixture = ${JSON.stringify(values)};
            window.interpolated = \`first\n\${window.name}\nlast\`;
            window.raw = String.raw\`first\nlast\`;
        `,
        version,
        license,
        compactLicense,
    });
    const source = artifacts.get(`${tool.basename}.min.js`);
    const program = source
        .split(`${createLicenseNotice(compactLicense)}\n`)[1]
        .split('\n// </nowiki>')[0];
    assert.doesNotMatch(program, /[\r\n\u2028\u2029]/u);
    const window = { name: '  name  ' };
    runInNewContext(source, { window });
    assert.deepEqual(Array.from(window.fixture), values);
    assert.equal(window.interpolated, 'first\n  name  \nlast');
    assert.equal(window.raw, 'first\nlast');
    assert.throws(
        () =>
            validateArtifact(
                `${tool.basename}.min.js`,
                source.replace('\n// </nowiki>', '\nvoid 0;\n// </nowiki>'),
                { tool, version, license, compactLicense },
            ),
        /one line of executable code/u,
    );
});

test('compact scripts retain strict mode inside their anonymous function without changing following code', async () => {
    for (const tool of tools) {
        const artifacts = await createArtifacts({
            tool,
            compact: `
                'use strict';
                (() => {
                    window.strictInside = (function () { return this; })() === undefined;
                    window.raw = String.raw\`first\nlast\`;
                    window.fixtureStarted = true;
                })();
            `,
            version,
            license,
            compactLicense,
        });
        const source = artifacts.get(`${tool.basename}.min.js`);
        const window = {};
        const context = createContext({ window });
        runInContext(
            `${source}\n
                window.sloppyAfter = (function () { return this; })() === globalThis;
                fixtureSloppyAssignment = true;
            `,
            context,
        );
        assert.equal(window.fixtureStarted, true, `${tool.id} starts.`);
        assert.equal(window.raw, 'first\nlast');
        assert.equal(window.strictInside, true, `${tool.id} remains strict.`);
        assert.equal(
            window.sloppyAfter,
            true,
            `${tool.id} scopes its directive.`,
        );
        assert.equal(context.fixtureSloppyAssignment, true);
        assert.deepEqual(Object.keys(context).sort(), [
            'fixtureSloppyAssignment',
            'window',
        ]);
    }
});

test('version metadata accepts complete SemVer and rejects malformed releases', async () => {
    const fixture = {
        tool: tools[0],
        compact: 'window.started = true;',
        license,
    };
    for (const version of [
        '0.1.0',
        '1.2.3-rc.1',
        '1.2.3+build.2',
        '1.2.3-rc.1+build.2',
    ]) {
        const artifacts = await createArtifacts({ ...fixture, version });
        assert.ok(
            artifacts
                .get('source_editor.user.js')
                .includes(`// @version      ${version}\n`),
        );
    }
    for (const version of [
        '01.2.3',
        '1.2.3-01',
        '1.2.3-',
        '1.2.3+x..y',
        '1.2.3\n',
    ]) {
        await assert.rejects(
            createArtifacts({ ...fixture, version }),
            /semantic version/u,
        );
    }
});

test('each distribution retains complete notices for its bundled material and excludes repository-only attribution', async () => {
    const sourceNotices = await readFile(
        join(projectRoot, 'THIRD-PARTY-NOTICES.md'),
        'utf8',
    );
    const headings = [...sourceNotices.matchAll(/^## ([^\r\n]+)$/gmu)];
    const sections = new Map(
        headings.map((heading, index) => [
            heading[1],
            sourceNotices
                .slice(heading.index, headings[index + 1]?.index)
                .trim(),
        ]),
    );
    for (const tool of tools) {
        assert.deepEqual(
            [...tool.noticeSections].sort(),
            [...expectedNoticeSections[tool.id]].sort(),
        );
        const [license, compactLicense] = await Promise.all([
            readToolLicense(tool, projectRoot),
            readToolLicense(tool, projectRoot, { compact: true }),
        ]);
        const artifacts = await createArtifacts({
            tool,
            compact: 'window.fixtureStarted = true;',
            version,
            license,
            compactLicense,
        });
        for (const text of [license, compactLicense, ...artifacts.values()]) {
            assert.doesNotMatch(text, /## Article fixtures and screenshots/u);
            assert.doesNotMatch(
                text,
                /## Host runtimes and development dependencies/u,
            );
        }
        for (const heading of tool.noticeSections) {
            const notice = sections.get(heading);
            assert.ok(notice, `Missing source notice: ${heading}`);
            assert.ok(license.includes(notice));
            assert.ok(compactLicense.includes(notice));
            for (const source of artifacts.values())
                assert.ok(
                    source.includes(
                        notice
                            .split('\n')
                            .map((line) => (line ? ` * ${line}` : ' *'))
                            .join('\n'),
                    ),
                    `${tool.id} preserves the complete ${heading} section.`,
                );
        }
        for (const heading of sections.keys()) {
            if (tool.noticeSections.includes(heading)) continue;
            assert.doesNotMatch(
                compactLicense,
                new RegExp(
                    `^## ${heading.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`,
                    'mu',
                ),
            );
        }
    }
});

test('notice selection excludes unrequested sections and fails when required attribution is missing', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'kanade-build-notices-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await writeFile(join(directory, 'LICENSE'), 'Fixture project license.');
    await writeFile(
        join(directory, 'THIRD-PARTY-NOTICES.md'),
        '# Fixture notices\n\nRepository introduction.\n\n## Bundled data\n\nComplete data attribution.\n\n## Article fixtures and screenshots\n\nRepository-only article credit.\n\n## Bundled software\n\nCopyright fixture contributors.\nAll software license terms.\n',
    );
    const tool = {
        ...tools[0],
        noticeSections: ['Bundled data', 'Bundled software'],
    };
    const selected =
        '# Bundled third-party notices\n\n## Bundled data\n\nComplete data attribution.\n\n## Bundled software\n\nCopyright fixture contributors.\nAll software license terms.';
    assert.equal(
        await readToolLicense(tool, directory, { compact: true }),
        selected,
    );
    assert.equal(
        await readToolLicense(tool, directory),
        `Fixture project license.\n\n${selected}`,
    );
    await assert.rejects(
        readToolLicense(
            { ...tool, noticeSections: ['Missing required notice'] },
            directory,
        ),
        /Missing required notice/u,
    );
});

test('compact scripts omit the full CC0 dedication and retain required third-party notices', async () => {
    for (const tool of tools) {
        const [license, compactLicense] = await Promise.all([
            readToolLicense(tool, projectRoot),
            readToolLicense(tool, projectRoot, { compact: true }),
        ]);
        assert.match(license, /CC0 1\.0 Universal/u);
        assert.doesNotMatch(compactLicense, /CC0 1\.0 Universal/u);
        const artifacts = await createArtifacts({
            tool,
            compact: 'window.fixtureStarted = true;',
            version,
            license,
            compactLicense,
        });
        const name = `${tool.basename}.min.js`;
        const source = artifacts.get(name);
        assert.doesNotMatch(source, /CC0 1\.0 Universal/u);
        assert.match(source, /@license CC0-1\.0/u);
        assert.match(
            artifacts.get(`${tool.basename}.user.js`),
            /CC0 1\.0 Universal/u,
        );
        if (
            tool.packages.includes('@wikimedia/codex-icons') ||
            tool.referenceIcons
        ) {
            assert.match(
                compactLicense,
                /@wikimedia\/codex-icons[\s\S]*2\.7\.0/u,
            );
            assert.match(
                compactLicense,
                /Wikimedia Foundation Design\s+System Team/u,
            );
            assert.match(compactLicense, /MIT License/u);
            assert.match(compactLicense, /CC BY 4\.0/u);
        }
        if (tool.packages.includes('entities')) {
            assert.match(compactLicense, /BSD-2-Clause/u);
            assert.match(compactLicense, /Felix Böhm/u);
        } else {
            assert.doesNotMatch(compactLicense, /BSD-2-Clause/u);
            assert.doesNotMatch(compactLicense, /Felix Böhm/u);
        }
        if (tool.noticeSections.length) {
            assert.throws(
                () =>
                    validateArtifact(
                        name,
                        source.replace(createLicenseNotice(compactLicense), ''),
                        { tool, version, license, compactLicense },
                    ),
                /complete license notices/u,
            );
        } else {
            assert.equal(compactLicense, '');
            assert.doesNotMatch(source, /\/\*!/u);
        }
        assert.throws(
            () =>
                validateArtifact(
                    name,
                    `${source}\n${createLicenseNotice(license)}`,
                    { tool, version, license, compactLicense },
                ),
            /full project license notice/u,
        );
    }
});

test("asset preparation preserves each tool's authored and compact template whitespace", async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'kanade-build-assets-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const filename = join(directory, 'dialog.vue');
    const template =
        "<div>\n    <span>{{ msg('first') }}</span> ·\n    <span>{{ msg('second') }}</span>\n</div>";
    await writeFile(filename, `<template>\n${template}\n</template>`);
    assert.equal(await prepareAsset(filename, false, tools[0]), template);
    const citations = { ...tools[0], compactReadableTemplates: true };
    assert.equal(
        await prepareAsset(filename, false, citations),
        "<div><span>{{ msg('first') }}</span>·<span>{{ msg('second') }}</span></div>",
    );
    assert.equal(
        await prepareAsset(filename, true, citations),
        await prepareAsset(filename, false, citations),
    );
    const drafts = tools.find(({ id }) => id === 'vg-stub-creator');
    assert.equal(
        await prepareAsset(filename, true, drafts),
        "<div><span>{{ msg('first') }}</span> · <span>{{ msg('second') }}</span></div>",
    );
    await writeFile(
        filename,
        '<template><div>\n  <pre>first\n  second</pre>\n  <textarea>first\n  second</textarea>\n</div></template>',
    );
    assert.equal(
        await prepareAsset(filename, true, tools[0]),
        '<div><pre>first\n  second</pre><textarea>first\n  second</textarea></div>',
    );
    await writeFile(
        filename,
        '<template><div /></template><script>throw new Error("unexpected script");</script>',
    );
    await assert.rejects(
        prepareAsset(filename, true, tools[0]),
        /one Vue template only/u,
    );
});

test('compact imported CSS removes formatting and preserves descendant selectors, text, and calc spacing', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'kanade-css-import-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const filename = join(directory, 'styles.css');
    const css = [
        '.parent .child {',
        '    content: "two  words";',
        '    width: calc(100% - 2px);',
        '}',
    ].join('\n');
    await writeFile(filename, css);
    for (const compact of [false, true]) {
        const { outputFiles } = await build({
            stdin: {
                contents:
                    'import css from "./styles.css"; window.fixtureStyles = css;',
                resolveDir: directory,
            },
            bundle: true,
            write: false,
            format: 'iife',
            loader: { '.css': 'text' },
            plugins: compact ? [compactCssTextPlugin()] : [],
        });
        const window = {};
        runInNewContext(outputFiles[0].text, { window });
        if (compact) {
            assert.doesNotMatch(window.fixtureStyles, /[\r\n]/u);
            assert.match(window.fixtureStyles, /\.parent \.child\{/u);
            assert.match(window.fixtureStyles, /content:"two {2}words"/u);
            assert.match(window.fixtureStyles, /calc\(100% - 2px\)/u);
            assert.ok(window.fixtureStyles.length < css.length);
        } else {
            assert.equal(window.fixtureStyles, css);
        }
    }
});

test('artifact validation rejects missing notices, wrong releases, metadata, and unresolved assets', () => {
    const tool = tools[0];
    const name = `${tool.basename}.user.js`;
    const source = outputs[0].get(name);
    for (const [broken, message] of [
        [
            source.replace(createLicenseNotice(license), ''),
            /complete license notices/u,
        ],
        [
            source.replace('// Release: 0.1.0', '// Release: 0.0.0'),
            /release version/u,
        ],
        [
            source.replace('// @version      0.1.0', '// @version      0.0.0'),
            /userscript version/u,
        ],
        [source.replace('// ==UserScript==\n', ''), /metadata header/u],
        [source.replace('// </nowiki>', ''), /nowiki guards/u],
        [
            `${source}\nconst styles = __UNRESOLVED_STYLES__;`,
            /unresolved build asset/u,
        ],
    ]) {
        assert.throws(
            () => validateArtifact(name, broken, { tool, version, license }),
            message,
        );
    }
    assert.throws(
        () => createLicenseNotice('unsafe */ code'),
        /embedded safely/u,
    );
});

test('the root manifest includes all tool scripts and detects byte-level modifications', () => {
    const artifacts = new Map(outputs.flatMap((output) => [...output]));
    artifacts.set('LICENSE.txt', license);
    const manifest = createManifest(artifacts, version);
    assert.equal(manifest.name, 'kanade');
    assert.equal(manifest.version, version);
    assert.equal(manifest.license, 'CC0-1.0');
    assert.equal(manifest.tools.length, tools.length);
    assert.equal('bundles' in manifest, false);
    assert.deepEqual(Object.keys(manifest.files), [
        ...artifactNames,
        'LICENSE.txt',
    ]);
    const name = artifactNames[0];
    artifacts.set(name, `${artifacts.get(name)}\n`);
    const modified = createManifest(artifacts, version);
    assert.notEqual(modified.files[name].sha256, manifest.files[name].sha256);
    assert.equal(modified.files[name].bytes, manifest.files[name].bytes + 1);
    artifacts.delete(artifactNames[1]);
    assert.throws(
        () => createManifest(artifacts, version),
        /Missing artifact/u,
    );
});

test('the shared build blocks host runtimes, including transitive copies inside allowed packages', () => {
    const citation = tools.find(({ id }) => id === 'source-editor');
    assert.doesNotThrow(() =>
        assertRuntimeDependencies(
            {
                'src/source-editor/domain/example.ts': {},
                'node_modules/entities/lib/decode.js': {},
                'node_modules/@wikimedia/codex-icons/dist/index.js': {},
            },
            citation,
        ),
    );
    for (const input of [
        'node_modules/vue/dist/vue.js',
        'node_modules/entities/node_modules/vue/dist/vue.js',
        'node_modules\\@wikimedia\\codex\\dist\\index.js',
    ]) {
        assert.throws(
            () => assertRuntimeDependencies({ [input]: {} }, citation),
            /must come from MediaWiki/u,
        );
    }
});

function pageFixture(tool = tools[0]) {
    const timers = new Map();
    const listeners = new Map();
    let nextTimer = 0;
    const window = {
        setTimeout(callback) {
            const id = ++nextTimer;
            timers.set(id, callback);
            return id;
        },
        clearTimeout(id) {
            timers.delete(id);
        },
        addEventListener(event, callback) {
            listeners.set(event, callback);
        },
        removeEventListener(event, callback) {
            if (listeners.get(event) === callback) listeners.delete(event);
        },
    };
    const page = createContext({ window });
    let removed = false;
    const document = {
        createElement() {
            return {
                textContent: '',
                remove() {
                    removed = true;
                },
            };
        },
        documentElement: {
            appendChild(script) {
                runInContext(script.textContent, page);
            },
        },
    };
    // The userscript sandbox intentionally has no window or MediaWiki runtime.
    runInNewContext(
        createUserscriptProgram(
            'window.starts = (window.starts ?? 0) + 1;',
            tool,
        ),
        { document },
    );
    return {
        window,
        timers,
        listeners,
        removed: () => removed,
        ready() {
            window.mw = {
                config: { get() {} },
                loader: { using() {} },
                hook() {},
            };
        },
        tick() {
            const [id, callback] = timers.entries().next().value;
            timers.delete(id);
            callback();
        },
    };
}

test('userscripts enter the page realm and start once when MediaWiki appears', () => {
    const fixture = pageFixture();
    assert.equal(fixture.removed(), true);
    assert.equal(fixture.window.starts, undefined);
    assert.equal(fixture.timers.size, 1);
    fixture.ready();
    fixture.tick();
    assert.equal(fixture.window.starts, 1);
    assert.equal(fixture.timers.size, 0);
    assert.equal(fixture.listeners.size, 0);
});

test('userscript waiting stops on page navigation or after the bounded readiness window', () => {
    const navigated = pageFixture();
    navigated.listeners.get('pagehide')();
    assert.equal(navigated.timers.size, 0);
    assert.equal(navigated.listeners.size, 0);
    assert.equal(navigated.window.starts, undefined);
    const unavailable = pageFixture();
    for (let attempt = 1; attempt < 200; attempt += 1) unavailable.tick();
    assert.equal(unavailable.timers.size, 0);
    assert.equal(unavailable.listeners.size, 0);
    assert.equal(unavailable.window.starts, undefined);
});

test('Revision Copy preserves its own ResourceLoader queue startup', () => {
    const fixture = pageFixture(tools.find(({ id }) => id === 'rev-copy'));
    assert.equal(fixture.window.starts, 1);
    assert.equal(fixture.timers.size, 0);
});
