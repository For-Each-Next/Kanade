/**
 * @file scripts/check-docs.mjs
 * Purpose: Reject broken local Markdown links and inconsistent screenshot provenance.
 * Contents: Link destinations, generated artifact paths, and screenshot integrity.
 */

import { existsSync, globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifactNames } from './tools.mjs';
import { validateScreenshotCollections } from './documentation-images.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const generated = new Set(
    [...artifactNames, 'LICENSE.txt', 'manifest.json'].map((name) =>
        resolve(root, 'dist', name),
    ),
);
const documents = [...globSync(['*.md', 'docs/**/*.md'], { cwd: root })].sort();
const failures = [];

for (const name of documents) {
    const filename = resolve(root, name);
    // Examples are instructions rather than links in the rendered document.
    const source = readFileSync(filename, 'utf8').replace(
        /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm,
        '',
    );
    const links = [
        ...source.matchAll(/\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g),
        ...source.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gm),
        ...source.matchAll(/(?:src|href)="([^"]+)"/g),
    ];
    for (const match of links) {
        const href = match[1].replace(/^<|>$/g, '');
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) continue;
        const pathname = decodeURIComponent(href.split(/[?#]/u)[0]);
        if (!pathname) continue;
        const target = resolve(dirname(filename), pathname);
        if (!existsSync(target) && !generated.has(target))
            failures.push(`${name}: ${href}`);
    }
}

const screenshots = validateScreenshotCollections(root);
failures.push(...screenshots.failures);
if (failures.length) {
    console.error(`Documentation checks failed:\n${failures.join('\n')}`);
    process.exitCode = 1;
} else {
    console.log(
        `Validated local links in ${documents.length} Markdown files and ${screenshots.imageCount} screenshot records.`,
    );
}
