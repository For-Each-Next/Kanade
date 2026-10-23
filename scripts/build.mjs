/**
 * @file scripts/build.mjs
 * Purpose: Build every tool through one asset pipeline into the root distribution.
 *
 * Table of contents:
 * 1. Imports and project root
 * 2. Asset preparation and icon extraction
 * 3. Runtime dependency boundary
 * 4. Tool bundling
 * 5. Project build and watch command
 */

import { watch } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from '@vue/compiler-sfc';
import {
    cdxIconAdd,
    cdxIconAlert,
    cdxIconEdit,
    cdxIconEditUndo,
    cdxIconUndo,
} from '@wikimedia/codex-icons';
import { build, transform } from 'esbuild';
import { minify as minifyHtml } from 'html-minifier-terser';
import { createReadableAssetLiteral } from './build-assets.ts';
import {
    createArtifacts,
    createManifest,
    outputOptions,
    readToolLicense,
} from './artifacts.mjs';
import { tools } from './tools.mjs';

export const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export async function prepareAsset(filename, compact, tool) {
    const source = await readFile(filename, 'utf8');
    if (filename.endsWith('.css')) {
        return compact
            ? (
                  await transform(source, { loader: 'css', minify: true })
              ).code.trim()
            : source.trim();
    }
    const { descriptor, errors } = parse(source, { filename });
    if (
        errors.length ||
        !descriptor.template ||
        descriptor.script ||
        descriptor.scriptSetup ||
        descriptor.styles.length ||
        descriptor.customBlocks.length
    ) {
        throw new Error(`${filename} must contain one Vue template only.`);
    }
    const template = descriptor.template.content.trim();
    return compact || tool.compactReadableTemplates
        ? minifyHtml(template, {
              caseSensitive: true,
              ...(tool.compactInlineWhitespace
                  ? {
                        collapseInlineTagWhitespace: true,
                        customAttrCollapse: /.*/u,
                    }
                  : {}),
              collapseWhitespace: true,
              keepClosingSlash: true,
          })
        : template;
}

/** Apply the same compact CSS preparation to styles imported as text. */
export function compactCssTextPlugin() {
    return {
        name: 'compact-css-text',
        setup(build) {
            build.onLoad({ filter: /\.css$/ }, async ({ path }) => ({
                contents: await prepareAsset(path, true),
                loader: 'text',
            }));
        },
    };
}

function extractIconPath(name, markup) {
    const match =
        typeof markup === 'string'
            ? markup.match(
                  /^<path d="([MmZzLlHhVvCcSsQqTtAa0-9eE.+,\s-]+)"\/>$/u,
              )
            : null;
    if (!match)
        throw new Error(
            `${name} must contain one SVG path with only path data.`,
        );
    return match[1];
}

function extractReferenceIcon(name, icon) {
    if (typeof icon === 'string') {
        return { path: extractIconPath(name, icon), flipInRtl: false };
    }
    if (!icon || typeof icon !== 'object') {
        throw new Error(`${name} has an unsupported icon representation.`);
    }
    const { ltr, rtl, shouldFlip = false, ...unsupported } = icon;
    if (
        typeof shouldFlip !== 'boolean' ||
        (rtl !== undefined && typeof rtl !== 'string') ||
        Object.keys(unsupported).length
    ) {
        throw new Error(`${name} has unsupported directional icon metadata.`);
    }
    return {
        path: extractIconPath(name, ltr),
        flipInRtl: shouldFlip,
        ...(rtl == null
            ? {}
            : { rtlPath: extractIconPath(`${name} RTL`, rtl) }),
    };
}

/** Production Vue/Codex remain host supplied; allow only explicitly licensed data. */
export function assertRuntimeDependencies(inputs, tool) {
    const unexpected = Object.keys(inputs).filter((input) => {
        const normalized = input.replaceAll('\\', '/');
        const packages = [
            ...normalized.matchAll(
                /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/gu,
            ),
        ];
        const packageName = packages.at(-1)?.[1];
        return (
            packageName !== undefined && !tool.packages.includes(packageName)
        );
    });
    if (unexpected.length) {
        throw new Error(
            `${tool.id}: Runtime dependencies must come from MediaWiki: ${unexpected.join(', ')}`,
        );
    }
}

async function bundleTool(tool, { root, version, compact }) {
    const assets = await Promise.all(
        Object.entries(tool.assets).map(async ([constant, path], index) => ({
            constant,
            source: await prepareAsset(
                join(root, 'src', tool.directory, path),
                compact,
                {
                    ...tool,
                    compactReadableTemplates:
                        tool.compactReadableTemplates ||
                        tool.compactReadableTemplatePrefixes?.some((prefix) =>
                            path.startsWith(prefix),
                        ),
                },
            ),
            token: `__KANADE_READABLE_ASSET_${index}__`,
            compactMarkup:
                path.endsWith('.vue') &&
                (tool.compactReadableTemplates ||
                    tool.compactReadableTemplatePrefixes?.some((prefix) =>
                        path.startsWith(prefix),
                    )),
        })),
    );
    const define = Object.fromEntries(
        assets.map((asset) => [
            asset.constant,
            JSON.stringify(compact ? asset.source : asset.token),
        ]),
    );
    define.__GADGET_VERSION__ = JSON.stringify(version);
    if (tool.referenceIcons) {
        define.__SOURCE_EDITOR_REFERENCE_ICONS__ = JSON.stringify(
            Object.fromEntries(
                Object.entries({
                    cdxIconEdit,
                    cdxIconEditUndo,
                    cdxIconAdd,
                    cdxIconAlert,
                    cdxIconUndo,
                }).map(([name, icon]) => [
                    name,
                    extractReferenceIcon(name, icon),
                ]),
            ),
        );
    }
    const result = await build({
        absWorkingDir: root,
        entryPoints: [`src/${tool.directory}/app/browser.ts`],
        bundle: true,
        preserveSymlinks: true,
        write: false,
        ...outputOptions,
        loader: { '.css': 'text' },
        plugins: compact ? [compactCssTextPlugin()] : [],
        define,
        minify: false,
        sourcemap: false,
        legalComments: 'none',
        metafile: true,
        logLevel: 'silent',
    });
    assertRuntimeDependencies(result.metafile.inputs, tool);
    let code = result.outputFiles?.[0]?.text;
    if (!code)
        throw new Error(`esbuild returned no browser bundle for ${tool.id}.`);
    if (!compact) {
        for (const asset of assets) {
            const token = JSON.stringify(asset.token);
            if (!code.includes(token)) {
                throw new Error(
                    `${tool.id}: esbuild did not retain ${asset.constant}.`,
                );
            }
            code = code.replaceAll(token, () =>
                createReadableAssetLiteral(asset.source, {
                    compactMarkup: asset.compactMarkup,
                }),
            );
        }
    }
    return code;
}

/** Validate all outputs before replacing a previously successful distribution. */
async function buildProject({
    root = projectRoot,
    outputDirectory = join(root, 'dist'),
} = {}) {
    const { version } = JSON.parse(
        await readFile(join(root, 'package.json'), 'utf8'),
    );
    const built = await Promise.all(
        tools.map(async (tool) => {
            const [compact, readable, license, compactLicense] =
                await Promise.all([
                    bundleTool(tool, { root, version, compact: true }),
                    bundleTool(tool, { root, version, compact: false }),
                    readToolLicense(tool, root),
                    readToolLicense(tool, root, { compact: true }),
                ]);
            const artifacts = await createArtifacts({
                tool,
                compact,
                readable,
                version,
                license,
                compactLicense,
            });
            return artifacts;
        }),
    );
    const artifacts = new Map(built.flatMap((artifacts) => [...artifacts]));
    artifacts.set('LICENSE.txt', await readFile(join(root, 'LICENSE'), 'utf8'));
    artifacts.set(
        'manifest.json',
        `${JSON.stringify(createManifest(artifacts, version), null, 4)}\n`,
    );
    await rm(outputDirectory, { recursive: true, force: true });
    await mkdir(outputDirectory, { recursive: true });
    await Promise.all(
        [...artifacts].map(([name, source]) =>
            writeFile(join(outputDirectory, name), source),
        ),
    );
    for (const [name, source] of artifacts) {
        console.log(`Built dist/${name} (${Buffer.byteLength(source)} bytes)`);
    }
    return artifacts;
}

async function runBuild(args = process.argv.slice(2)) {
    if (args.some((arg) => arg !== '--watch')) {
        throw new Error(`Unknown build option: ${args.join(', ')}`);
    }
    await buildProject();
    if (!args.includes('--watch')) return;
    let timer;
    let queue = Promise.resolve();
    const rebuild = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            queue = queue
                .then(() => buildProject())
                .catch((error) => console.error('[kanade build]', error));
        }, 100);
    };
    const watchers = [
        'src',
        'package.json',
        'LICENSE',
        'THIRD-PARTY-NOTICES.md',
    ].map((path) =>
        watch(join(projectRoot, path), { recursive: true }, rebuild),
    );
    const close = () => {
        clearTimeout(timer);
        for (const watcher of watchers) watcher.close();
    };
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
    console.log('[kanade build] Watching sources and assets for changes...');
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    try {
        await runBuild();
    } catch (error) {
        console.error('[kanade build] Build failed:', error);
        process.exitCode = 1;
    }
}
