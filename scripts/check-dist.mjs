/**
 * @file scripts/check-dist.mjs
 * Purpose: Verify every generated tool's syntax, licenses, version, and SHA-256 digest.
 *
 * Table of contents:
 * 1. Imports
 * 2. Distribution checks
 * 3. Command-line entry point
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    createManifest,
    projectLicense,
    readToolLicense,
    validateArtifact,
} from './artifacts.mjs';
import { projectRoot } from './build.mjs';
import { artifactNames, tools } from './tools.mjs';

async function checkDistribution({
    root = projectRoot,
    outputDirectory = join(root, 'dist'),
} = {}) {
    const { version, license } = JSON.parse(
        await readFile(join(root, 'package.json'), 'utf8'),
    );
    if (license !== projectLicense)
        throw new Error('The root project license must be CC0-1.0.');
    const files = await readdir(outputDirectory);
    const names = [...artifactNames, 'LICENSE.txt'];
    const unexpected = files.filter(
        (name) =>
            ![...names, 'manifest.json', 'release-notes.md'].includes(name),
    );
    if (unexpected.length)
        throw new Error(
            `Unexpected distribution files: ${unexpected.join(', ')}`,
        );
    const artifacts = new Map(
        await Promise.all(
            names.map(async (name) => [
                name,
                await readFile(join(outputDirectory, name), 'utf8'),
            ]),
        ),
    );
    for (const tool of tools) {
        const [license, compactLicense] = await Promise.all([
            readToolLicense(tool, root),
            readToolLicense(tool, root, { compact: true }),
        ]);
        for (const extension of ['min.js', 'user.js']) {
            const name = `${tool.basename}.${extension}`;
            validateArtifact(name, artifacts.get(name), {
                tool,
                version,
                license,
                compactLicense,
            });
        }
        if (
            Buffer.byteLength(artifacts.get(`${tool.basename}.min.js`)) >=
            Buffer.byteLength(artifacts.get(`${tool.basename}.user.js`))
        ) {
            throw new Error(
                `${tool.id}: Compact output must be smaller than the readable userscript.`,
            );
        }
    }
    const actual = JSON.parse(
        await readFile(join(outputDirectory, 'manifest.json'), 'utf8'),
    );
    const expected = createManifest(artifacts, version);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
            'Distribution manifest does not match the generated files.',
        );
    }
    if (
        (await readFile(join(root, 'LICENSE'), 'utf8')) !==
        artifacts.get('LICENSE.txt')
    ) {
        throw new Error(
            'Distribution license differs from the root project license.',
        );
    }
    return expected;
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    try {
        const { version } = await checkDistribution();
        console.log(
            `Verified kanade ${version}: all ${artifactNames.length} scripts, notices, and SHA-256 checksums.`,
        );
    } catch (error) {
        console.error('[kanade distribution] Verification failed:', error);
        process.exitCode = 1;
    }
}
