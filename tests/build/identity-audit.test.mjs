/**
 * @file tests/build/identity-audit.test.mjs
 * Purpose: Keep retired identities out of authored files and generated distributions.
 * Contents: Source/docs/build/path findings, exact provenance exceptions, and cache boundaries.
 */

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { auditIdentity } from '../../scripts/identity-audit.mjs';
import policy from '../../scripts/identity-policy.json' with { type: 'json' };

const retiredBrand = policy.identities[0].join('');
const externalAttribution = policy.exceptions.find(
    (rule) =>
        rule.id === 'external-attribution' && rule.paths.includes('README.md'),
);

async function project(context, files = {}) {
    const root = await mkdtemp(join(tmpdir(), 'kanade-identity-'));
    context.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(join(root, 'dist'));
    for (const [path, text] of Object.entries(files)) {
        await mkdir(dirname(join(root, path)), { recursive: true });
        await writeFile(join(root, path), text);
    }
    return root;
}

for (const path of [
    'src/source-editor/app/main.ts',
    'docs/source-editor/README.md',
    'dist/source_editor.user.js',
    'dist/source_editor.min.js',
]) {
    test(`blocks retired identity in ${path}`, async (context) => {
        const root = await project(context, {
            [path]: `Current project\n${retiredBrand}\n`,
        });
        const result = await auditIdentity(root);
        assert.deepEqual(result.findings, [
            {
                path,
                kind: 'content',
                line: 2,
                column: 1,
                value: retiredBrand,
            },
        ]);
    });
}

test('blocks retired identity in filenames and empty directory names', async (context) => {
    const filename = `src/source-editor/${retiredBrand}.ts`;
    const directory = `docs/${retiredBrand}-notes`;
    const root = await project(context, { [filename]: '' });
    await mkdir(join(root, directory), { recursive: true });
    const result = await auditIdentity(root);
    assert.deepEqual(
        result.findings.map(({ path, kind }) => ({ path, kind })),
        [
            { path: directory, kind: 'path' },
            { path: filename, kind: 'path' },
        ],
    );
});

test('recognizes casing, adjacent words, spaces, underscores, and hyphens', async (context) => {
    const variants = policy.identities.flatMap((parts) => [
        parts.join('').toUpperCase(),
        parts.join(' '),
        parts.join('_'),
        parts.join('-'),
    ]);
    const root = await project(context, { 'README.md': variants.join('\n') });
    const result = await auditIdentity(root);
    assert.deepEqual(
        result.findings.map(({ value }) => value),
        variants,
    );
});

test('retains exact credited evidence without exempting unrelated text in the same file', async (context) => {
    const root = await project(context, {
        'README.md': `${externalAttribution.fragment}\n${retiredBrand}\n`,
    });
    const result = await auditIdentity(root);
    assert.equal(result.approved['external-attribution'], 2);
    assert.deepEqual(
        result.findings.map(({ value }) => value),
        [retiredBrand],
    );
});

test('evidence exception applies only to its reviewed paths', async (context) => {
    const root = await project(context, {
        'docs/unreviewed.md': externalAttribution.fragment,
    });
    const result = await auditIdentity(root);
    assert.equal(result.findings.length, 2);
    assert.deepEqual(result.approved, {});
});

test('recognizes current functional module paths without permitting a new owned alias', async (context) => {
    const rule = policy.exceptions.find(
        (entry) => entry.id === 'citation-capability-path',
    );
    const path = rule.paths.find((name) => name.startsWith('src/'));
    const root = await project(context, {
        [path]: `${rule.fragment}\n${retiredBrand}`,
    });
    const result = await auditIdentity(root);
    assert.equal(result.approved[rule.id], 1);
    assert.deepEqual(
        result.findings.map(({ value }) => value),
        [retiredBrand],
    );
});

test('generated artifacts retain only their exact reviewed evidence', async (context) => {
    const rule = policy.exceptions.find(
        (entry) =>
            entry.id === 'external-attribution' &&
            entry.paths.includes('dist/source_editor.user.js'),
    );
    const root = await project(context, {
        'dist/source_editor.user.js': `${rule.fragment}\n${retiredBrand}`,
    });
    const result = await auditIdentity(root);
    assert.equal(result.approved[rule.id], 2);
    assert.deepEqual(
        result.findings.map(({ value }) => value),
        [retiredBrand],
    );
});

test('audit definitions do not exempt a known string in an unrelated policy field', async (context) => {
    const root = await project(context, {
        'scripts/identity-policy.json': JSON.stringify(
            { ...policy, unrelated: retiredBrand },
            null,
            4,
        ),
    });
    const result = await auditIdentity(root);
    assert.ok(result.approved['audit-policy-definitions'] > 0);
    assert.deepEqual(
        result.findings.map(({ value }) => value),
        [retiredBrand],
    );
});

test('malformed policy text receives no definition exemption', async (context) => {
    const root = await project(context, {
        'scripts/identity-policy.json': `{broken ${retiredBrand}`,
    });
    assert.equal((await auditIdentity(root)).findings.length, 1);
});

test('embedded NUL cannot hide retired identity in authored text or built scripts', async (context) => {
    for (const path of [
        'README.md',
        'src/source-editor/app/main.ts',
        'dist/source_editor.min.js',
    ]) {
        const root = await project(context, {
            [path]: `current\0${retiredBrand}`,
        });
        assert.equal((await auditIdentity(root)).findings.length, 1, path);
    }
});

test('the reviewed seed inventory cannot silently lose a retired identity', () => {
    assert.deepEqual(policy.identities, [
        ['azu' + 'sa'],
        ['wp', 'gadgets'],
        ['wpg' + '-'],
        ['wp' + 'gSourceEditor'],
        ['wp' + 'gRevCopy'],
        ['wp' + 'gQuickAccess'],
        ['__wp' + 'g_'],
        ['wik', 'ed', 'lite'],
        ['wik', 'ed'],
        ['citation', 'formatter'],
        ['vg', 'page', 'assessor'],
        ['mediawiki', 'gadgets'],
    ]);
});

test('the current project identity is allowed in package, runtime, and DOM names', async (context) => {
    const root = await project(context, {
        'README.md': 'Kanade',
        'package.json': JSON.stringify({ name: 'kanade' }),
        'src/rev-copy/app/browser.ts': "Symbol.for('kanade.rev-copy.startup')",
        'src/rev-copy/features/revision-row/row.css': '.kanade-rev-copy-row {}',
    });
    assert.deepEqual((await auditIdentity(root)).findings, []);
});

test('source-only audit ignores stale generated output until it is rebuilt', async (context) => {
    const root = await project(context, {
        'dist/source_editor.user.js': retiredBrand,
        'README.md': 'Kanade',
    });
    assert.deepEqual(
        (await auditIdentity(root, { sourceOnly: true })).findings,
        [],
    );
    assert.equal((await auditIdentity(root)).findings.length, 1);
});

test('full audit requires a built distribution', async (context) => {
    const root = await project(context);
    await rm(join(root, 'dist'), { recursive: true });
    await assert.rejects(() => auditIdentity(root), /Build the distribution/u);
    assert.deepEqual(
        (await auditIdentity(root, { sourceOnly: true })).findings,
        [],
    );
});

test('ignores dependency and IDE caches while scanning root configuration', async (context) => {
    const root = await project(context, {
        'node_modules/dependency/index.js': retiredBrand,
        '.idea/workspace.xml': retiredBrand,
        '.github/workflows/test.yml': retiredBrand,
        'config/runtime.json': retiredBrand,
    });
    assert.deepEqual(
        (await auditIdentity(root)).findings.map(({ path }) => path),
        ['.github/workflows/test.yml', 'config/runtime.json'],
    );
});

test('retains binary assets while inspecting their filenames', async (context) => {
    const root = await project(context, {
        'docs/image.png': Buffer.from([0, ...Buffer.from(retiredBrand)]),
        [`docs/${retiredBrand}.png`]: Buffer.from([0]),
    });
    const result = await auditIdentity(root);
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].kind, 'path');
});
