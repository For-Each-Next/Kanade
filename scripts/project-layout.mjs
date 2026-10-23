/**
 * @file scripts/project-layout.mjs
 * Purpose: Enforce registered tool ownership and one root toolchain.
 * Contents: Allowed ownership trees, browser entrypoints, package boundaries, and image inventories.
 */

import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tools } from './tools.mjs';

const sourceLayers = new Set([
    'app',
    'domain',
    'platform',
    'features',
    'i18n',
    'shared',
    'config',
    'types',
]);
const testLayers = new Set([...sourceLayers, 'fixtures', 'support', 'ui']);
const documentationSections = {
    'source-editor': new Set(['cs1', 'images']),
    'rev-copy': new Set(['images']),
    'vg-stub-creator': new Set(['data', 'images']),
    'wpvg-assessor': new Set(['images']),
};

/** Checks registered ownership without loading dependencies or build artifacts. */
export function checkProjectLayout(root) {
    checkRootBoundaries(root, root);
    const directories = tools.map((tool) => tool.directory);
    for (const [owner, extra] of [
        ['src', ['library']],
        ['tests', ['library', 'build']],
        ['docs', []],
        ['scripts', []],
    ]) {
        const directory = join(root, owner);
        if (!existsSync(directory)) continue;
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            assert.ok(
                [...directories, ...extra].includes(entry.name),
                `Unregistered ${owner} owner: ${join(directory, entry.name)}`,
            );
        }
    }
    for (const tool of tools) {
        const source = join(root, 'src', tool.directory);
        assert.ok(
            existsSync(join(source, 'app', 'browser.ts')),
            `Missing registered browser entrypoint: ${tool.directory}/app/browser.ts`,
        );
        assert.ok(
            existsSync(join(source, 'index.ts')),
            `Missing pure public boundary: ${tool.directory}/index.ts`,
        );
        for (const entry of readdirSync(source, { withFileTypes: true })) {
            if (entry.isDirectory())
                assert.ok(
                    sourceLayers.has(entry.name),
                    `Source capabilities belong in the shared layer template: ${join(source, entry.name)}`,
                );
            else
                assert.ok(
                    entry.name === 'index.ts' || entry.name.startsWith('.'),
                    `Unexpected tool-root module: ${join(source, entry.name)}`,
                );
        }
        for (const [owner, allowed, description] of [
            ['tests', testLayers, 'test layer'],
            [
                'docs',
                documentationSections[tool.directory],
                'documentation section',
            ],
        ]) {
            const directory = join(root, owner, tool.directory);
            if (!existsSync(directory)) continue;
            for (const entry of readdirSync(directory, {
                withFileTypes: true,
            })) {
                if (entry.isDirectory())
                    assert.ok(
                        allowed.has(entry.name),
                        `Unregistered ${description}: ${join(directory, entry.name)}`,
                    );
            }
        }
    }
    const configuration = join(root, 'config', 'typescript');
    if (existsSync(configuration)) {
        const allowed = new Set([
            'tooling.json',
            ...directories.flatMap((name) => [
                `${name}.json`,
                `${name}.tests.json`,
            ]),
        ]);
        for (const entry of readdirSync(configuration))
            assert.ok(
                allowed.has(entry),
                `Unregistered type-check configuration: ${entry}`,
            );
    }
    const documentation = join(root, 'docs', 'source-editor');
    if (existsSync(documentation)) {
        const images = join(documentation, 'images');
        assert.ok(
            existsSync(join(images, 'README.md')),
            'Source Editor screenshots must have one inventory at docs/source-editor/images/README.md.',
        );
        checkSourceEditorImages(documentation, images);
    }
}

function checkRootBoundaries(directory, root) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const filename = join(directory, entry.name);
        if (
            directory === root &&
            ['node_modules', '.git', '.idea', 'dist'].includes(entry.name)
        )
            continue;
        assert.ok(
            !['.git', 'node_modules', 'dist'].includes(entry.name),
            `Unexpected nested ${entry.name}: ${filename}`,
        );
        if (entry.isDirectory()) checkRootBoundaries(filename, root);
        else if (directory !== root)
            assert.ok(
                !['package.json', 'package-lock.json'].includes(entry.name),
                `Unexpected nested manifest: ${filename}`,
            );
    }
}

function checkSourceEditorImages(directory, images) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const filename = join(directory, entry.name);
        assert.ok(
            entry.name !== 'images' || filename === images,
            `Source Editor screenshots belong to its single image collection: ${filename}`,
        );
        checkSourceEditorImages(filename, images);
    }
}
