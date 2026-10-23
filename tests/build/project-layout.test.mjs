/**
 * @file tests/build/project-layout.test.mjs
 * Purpose: Enforce registered ownership, entrypoints, and the root package boundary.
 * Contents: Allowed tools/layers, rejected unknown owners, required entrypoints, and screenshot ownership.
 */

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { checkProjectLayout } from '../../scripts/project-layout.mjs';
import { tools } from '../../scripts/tools.mjs';

async function createProject(context) {
    const root = await mkdtemp(join(tmpdir(), 'kanade-layout-'));
    context.after(() => rm(root, { recursive: true, force: true }));
    const filenames = [
        ...tools.flatMap(({ directory }) => [
            `src/${directory}/app/browser.ts`,
            `src/${directory}/index.ts`,
            `tests/${directory}/example.test.ts`,
            `docs/${directory}/README.md`,
            `config/typescript/${directory}.json`,
        ]),
        'src/source-editor/features/editor/controller.ts',
        'src/source-editor/features/source-manager/controller.ts',
        'docs/source-editor/images/README.md',
        'scripts/source-editor/capture-live.mjs',
    ];
    for (const name of filenames) {
        const filename = join(root, name);
        await mkdir(dirname(filename), { recursive: true });
        await writeFile(filename, '');
    }
    return root;
}

test('registered tools share root tooling and keep named capabilities in layers', async (context) => {
    const root = await createProject(context);
    for (const name of ['node_modules', '.git', '.idea', 'dist'])
        await mkdir(join(root, name));
    for (const name of ['src/library', 'tests/library', 'tests/build'])
        await mkdir(join(root, name), { recursive: true });
    assert.doesNotThrow(() => checkProjectLayout(root));
});

for (const owner of ['src', 'tests', 'docs', 'scripts']) {
    test(`rejects unregistered ${owner} ownership`, async (context) => {
        const root = await createProject(context);
        await mkdir(join(root, owner, 'unregistered-tool'), {
            recursive: true,
        });
        assert.throws(() => checkProjectLayout(root), /Unregistered .* owner/u);
    });
}

for (const layer of ['editor', 'citations', 'unowned']) {
    test(`rejects capability ${layer} outside the shared source template`, async (context) => {
        const root = await createProject(context);
        await mkdir(join(root, 'src/source-editor', layer));
        assert.throws(() => checkProjectLayout(root), /shared layer template/u);
    });
}

for (const entrypoint of ['app/browser.ts', 'index.ts']) {
    test(`requires the registered ${entrypoint} boundary for each tool`, async (context) => {
        const root = await createProject(context);
        await rm(join(root, 'src/rev-copy', entrypoint));
        assert.throws(
            () => checkProjectLayout(root),
            /Missing .* boundary|Missing .* entrypoint/u,
        );
    });
}

test('rejects unowned modules at a tool root', async (context) => {
    const root = await createProject(context);
    await writeFile(join(root, 'src/source-editor/start.ts'), '');
    assert.throws(
        () => checkProjectLayout(root),
        /Unexpected tool-root module/u,
    );
});

test('type-check configurations belong to registered tools', async (context) => {
    const root = await createProject(context);
    await writeFile(join(root, 'config/typescript/unregistered.json'), '{}');
    assert.throws(
        () => checkProjectLayout(root),
        /Unregistered type-check configuration/u,
    );
});

test('requires the maintained screenshot inventory', async (context) => {
    const root = await createProject(context);
    await rm(join(root, 'docs/source-editor/images/README.md'));
    assert.throws(
        () => checkProjectLayout(root),
        /screenshots must have one inventory/u,
    );
});

test('rejects an additional capability screenshot collection', async (context) => {
    const root = await createProject(context);
    await mkdir(join(root, 'docs/source-editor/cs1/images'), {
        recursive: true,
    });
    assert.throws(() => checkProjectLayout(root), /single image collection/u);
});

for (const owner of ['tests', 'docs']) {
    for (const capability of ['editor', 'citations']) {
        test(`rejects a separate ${owner} capability tree: ${capability}`, async (context) => {
            const root = await createProject(context);
            await mkdir(join(root, owner, 'source-editor', capability));
            assert.throws(
                () => checkProjectLayout(root),
                /Unregistered (?:test layer|documentation section)/u,
            );
        });
    }
}

for (const nested of [
    'package.json',
    'package-lock.json',
    '.git',
    'node_modules',
    'dist',
]) {
    test(`retains the root-only ${nested} boundary`, async (context) => {
        const root = await createProject(context);
        const filename = join(root, 'src/source-editor', nested);
        if (nested.endsWith('.json')) await writeFile(filename, '{}');
        else await mkdir(filename);
        assert.throws(() => checkProjectLayout(root), /Unexpected nested/u);
    });
}
