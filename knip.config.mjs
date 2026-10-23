/**
 * @file knip.config.mjs
 * Purpose: Check reachability from registered tools and maintained root commands.
 * Contents: Build-injected templates, public/browser roots, and development entrypoints.
 */

import { readFileSync } from 'node:fs';
import { tools } from './scripts/tools.mjs';

const packageInfo = JSON.parse(
    readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);
const packageCommands = Object.values(packageInfo.scripts).flatMap((command) =>
    Array.from(
        command.matchAll(/\bnode\s+(scripts\/[^\s]+\.(?:mjs|ts))\b/g),
        (match) => match[1],
    ),
);

export default {
    entry: [
        'src/library/types/**/*.d.ts!',
        ...tools.flatMap(({ directory, assets }) => [
            `src/${directory}/index.ts!`,
            `src/${directory}/app/browser.ts!`,
            `src/${directory}/types/**/*.d.ts!`,
            ...Object.values(assets)
                .filter((filename) => filename.endsWith('.vue'))
                .map((filename) => `src/${directory}/${filename}!`),
        ]),
        ...new Set(packageCommands),
        ...tools.map(
            ({ directory }) => `scripts/${directory}/capture-live.mjs`,
        ),
        // These commands own dynamic runner and attributed fixture maintenance.
        'scripts/rev-copy/test-ui.mjs',
        'scripts/source-editor/fetch-preview-source.mjs',
        'tests/**/*.test.{ts,mjs}',
        'tests/**/*.spec.ts',
        'tests/wpvg-assessor/ui/server.mjs',
    ],
    project: [
        'src/**/*.{ts,vue}!',
        'tests/**/*.{ts,mjs}',
        'scripts/**/*.{ts,mjs}',
    ],
    include: [
        'files',
        'exports',
        'dependencies',
        'devDependencies',
        'optionalPeerDependencies',
        'unlisted',
        'binaries',
        'unresolved',
        'duplicates',
    ],
    includeEntryExports: true,
    ignoreIssues: Object.fromEntries(
        tools.map(({ directory }) => [
            `src/${directory}/index.ts`,
            ['exports'],
        ]),
    ),
    ignoreDependencies: [
        'ext.CodeMirror',
        'ext.CodeMirror.modes',
        'ext.CodeMirror.mode.mediawiki',
    ],
    ignoreBinaries: ['scutil'],
};
