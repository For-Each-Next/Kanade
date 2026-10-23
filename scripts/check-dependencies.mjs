/**
 * @file scripts/check-dependencies.mjs
 * Purpose: Enforce one dependency manifest, lockfile, and root Git repository.
 * Contents: Root package checks and repository layout validation.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkProjectLayout } from './project-layout.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
assert.equal(manifest.license, 'CC0-1.0');
assert.equal(lock.name, manifest.name);
assert.equal(lock.packages[''].name, manifest.name);
assert.equal(lock.version, manifest.version);
assert.equal(lock.packages[''].version, manifest.version);
assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies);
assert.equal(
    manifest.workspaces,
    undefined,
    'This is one package, not a workspace.',
);
for (const [name, entry] of Object.entries(lock.packages)) {
    assert.ok(!entry.link, `Unexpected workspace link in lockfile: ${name}`);
}

checkProjectLayout(root);
for (const name of Object.keys(manifest.devDependencies)) {
    assert.ok(
        existsSync(join(root, 'node_modules', name)),
        `Missing root dependency: ${name}; run npm ci.`,
    );
}
console.log(
    `Validated one root dependency tree for ${manifest.name} ${manifest.version}.`,
);
