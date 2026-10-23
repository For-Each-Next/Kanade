/**
 * @file scripts/artifacts.mjs
 * Purpose: Compose and validate the suite's installable scripts and integrity manifest.
 *
 * Table of contents:
 * 1. Imports and output options
 * 2. License notices and documentation
 * 3. Page-runtime bootstrap
 * 4. Artifact generation and validation
 * 5. Integrity manifest
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { transform } from 'esbuild';
import { artifactNames, tools } from './tools.mjs';

export const projectLicense = 'CC0-1.0';
export const outputOptions = {
    charset: 'utf8',
    target: ['es2024'],
    format: 'iife',
};

/** Select notices for bundled material while retaining repository-only attribution at the root. */
export async function readToolLicense(tool, root, { compact = false } = {}) {
    const notices = compact
        ? []
        : [(await readFile(join(root, 'LICENSE'), 'utf8')).trim()];
    if (!Array.isArray(tool.noticeSections))
        throw new Error(
            `${tool.id}: Bundled notice sections must be declared.`,
        );
    if (tool.noticeSections.length) {
        const source = await readFile(
            join(root, 'THIRD-PARTY-NOTICES.md'),
            'utf8',
        );
        const sections = new Map();
        for (const section of source.split(/(?=^## )/mu)) {
            const heading = section.match(/^## ([^\r\n]+)\r?\n/u)?.[1];
            if (!heading) continue;
            if (sections.has(heading))
                throw new Error(`Duplicate third-party notice: ${heading}`);
            sections.set(heading, section.trim());
        }
        for (const heading of tool.noticeSections) {
            if (!sections.has(heading))
                throw new Error(
                    `${tool.id}: Missing third-party notice: ${heading}`,
                );
        }
        notices.push(
            [
                '# Bundled third-party notices',
                ...[...sections]
                    .filter(([heading]) =>
                        tool.noticeSections.includes(heading),
                    )
                    .map(([, section]) => section),
            ].join('\n\n'),
        );
    }
    return notices.join('\n\n');
}

export function createLicenseNotice(license) {
    if (
        typeof license !== 'string' ||
        !license.trim() ||
        license.includes('*/')
    ) {
        throw new Error('The license notice cannot be embedded safely.');
    }
    return [
        '/*!',
        ...license
            .trim()
            .split(/\r?\n/u)
            .map((line) => (line ? ` * ${line}` : ' *')),
        ' */',
    ].join('\n');
}

function assertVersion(version) {
    const match =
        typeof version === 'string' &&
        /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.exec(
            version,
        );
    if (!match || match[1]?.split('.').some((part) => /^0\d+$/u.test(part))) {
        throw new Error('Version must be a single semantic version.');
    }
}

function createDocumentationHeader(tool, version, license) {
    assertVersion(version);
    return [
        '// <nowiki>',
        '/**',
        ` * ${tool.name} — Kanade`,
        ' *',
        ` * Purpose: ${tool.description}`,
        ' *',
        ` * @name ${tool.id}`,
        ` * @version ${version}`,
        ` * @license ${tool.license}`,
        ' *',
        ' * Table of contents:',
        ' * 1. Metadata and license notices',
        ' * 2. MediaWiki bootstrap and browser program',
        ...(tool.attribution ?? []).map((line) => ` * ${line}`),
        ' */',
        `// Release: ${version}`,
        ...(license ? [createLicenseNotice(license)] : []),
    ].join('\n');
}

/** Wait in the page realm, releasing bounded timers and navigation listeners. */
function createPageProgram(application, tool) {
    return tool.resourceLoaderBootstrap
        ? application
        : `
let readinessTimer;
let attempts = 0;
function stopWaiting() {
    if (readinessTimer !== undefined) {
        window.clearTimeout(readinessTimer);
        readinessTimer = undefined;
    }
    window.removeEventListener('pagehide', stopWaiting);
}
function startWhenReady() {
    readinessTimer = undefined;
    const mw = window.mw;
    if (typeof mw?.config?.get === 'function' &&
        typeof mw?.loader?.using === 'function' &&
        typeof mw?.hook === 'function') {
        stopWaiting();
${application}
        return;
    }
    attempts += 1;
    if (attempts >= 200) {
        stopWaiting();
        return;
    }
    readinessTimer = window.setTimeout(startWhenReady, 50);
}
window.addEventListener('pagehide', stopWaiting, { once: true });
startWhenReady();
`;
}

export function createUserscriptProgram(application, tool) {
    const program = createPageProgram(application, tool);
    // Match Revision Copy's page-global behavior across userscript isolation modes.
    return `
function kanadeApplication() {
${program}
}
const script = document.createElement('script');
script.textContent = '(' + kanadeApplication.toString() + ')();';
document.documentElement.appendChild(script);
script.remove();
`;
}

export async function createArtifacts({
    tool,
    compact,
    readable = compact,
    version,
    license,
    compactLicense = '',
}) {
    const header = createDocumentationHeader(tool, version, license);
    const compactHeader = createDocumentationHeader(
        tool,
        version,
        compactLicense,
    );
    const metadata = [
        '// ==UserScript==',
        `// @name         ${tool.name}`,
        `// @namespace    ${tool.id}`,
        `// @version      ${version}`,
        `// @description  ${tool.description}`,
        `// @license      ${tool.license}`,
        ...tool.matches.map((match) => `// @match        ${match}`),
        '// @run-at       document-end',
        '// @grant        none',
        ...(tool.noFrames ? ['// @noframes'] : []),
        '// ==/UserScript==',
    ].join('\n');
    const sources = await Promise.all([
        transform(compact, {
            ...outputOptions,
            // The final wrapper also contains helpers introduced during lowering.
            format: undefined,
            minify: true,
            // Escape string newlines instead of emitting multiline template literals.
            supported: { 'template-literal': false },
            legalComments: 'none',
        }),
        transform(createUserscriptProgram(readable, tool), {
            ...outputOptions,
            minify: false,
            legalComments: 'none',
            banner: `${metadata}\n${header}`,
            footer: '// </nowiki>',
        }),
    ]);
    const artifacts = new Map([
        [
            `${tool.basename}.min.js`,
            `${compactHeader}\n(()=>{${sources[0].code.trim()}})();\n// </nowiki>\n`,
        ],
        [`${tool.basename}.user.js`, sources[1].code],
    ]);
    for (const [name, source] of artifacts) {
        validateArtifact(name, source, {
            tool,
            version,
            license,
            compactLicense,
        });
    }
    return artifacts;
}

export function validateArtifact(
    name,
    source,
    { tool, version, license, compactLicense = '' },
) {
    new Script(source, { filename: name });
    const compact = name.endsWith('.min.js');
    const notices = compact ? compactLicense : license;
    if (notices && !source.includes(createLicenseNotice(notices))) {
        throw new Error(`${name} is missing its complete license notices.`);
    }
    if (
        compact &&
        compactLicense !== license &&
        source.includes(createLicenseNotice(license))
    ) {
        throw new Error(`${name} includes the full project license notice.`);
    }
    if (!source.includes(` * @license ${tool.license}\n`)) {
        throw new Error(`${name} has incorrect license metadata.`);
    }
    if (
        (source.match(/^\/\/ <nowiki>$/gmu) ?? []).length !== 1 ||
        (source.match(/^\/\/ <\/nowiki>$/gmu) ?? []).length !== 1
    ) {
        throw new Error(`${name} must contain one pair of nowiki guards.`);
    }
    if (!source.includes(`// Release: ${version}\n`)) {
        throw new Error(`${name} has an incorrect release version.`);
    }
    if (compact) {
        const header = createDocumentationHeader(tool, version, compactLicense);
        const program = source
            .slice(header.length)
            .replace(/\n\/\/ <\/nowiki>\n?$/u, '')
            .trim();
        if (!program || /[\r\n\u2028\u2029]/u.test(program)) {
            throw new Error(
                `${name} must contain one line of executable code.`,
            );
        }
    }
    if (
        /__\w+(?:_STYLES|_TEMPLATE|_ICONS|_READABLE_ASSET_\d+)__/u.test(source)
    ) {
        throw new Error(`${name} contains an unresolved build asset.`);
    }
    if (name.endsWith('.user.js')) {
        if (!source.startsWith('// ==UserScript==\n')) {
            throw new Error(
                `${name} is missing its userscript metadata header.`,
            );
        }
        for (const [field, value] of [
            ['version', version],
            ['license', tool.license],
        ]) {
            if (
                !new RegExp(
                    `^// @${field} +${value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`,
                    'mu',
                ).test(source)
            ) {
                throw new Error(
                    `${name} has incorrect userscript ${field} metadata.`,
                );
            }
        }
        for (const match of tool.matches) {
            if (!source.includes(`// @match        ${match}\n`)) {
                throw new Error(
                    `${name} is missing a supported site: ${match}`,
                );
            }
        }
    }
}

export function createManifest(artifacts, version) {
    assertVersion(version);
    return {
        name: 'kanade',
        version,
        license: projectLicense,
        tools: tools.map(({ id, name, basename, license }) => ({
            id,
            name,
            basename,
            license,
        })),
        files: Object.fromEntries(
            [...artifactNames, 'LICENSE.txt'].map((name) => {
                const source = artifacts.get(name);
                if (typeof source !== 'string')
                    throw new Error(`Missing artifact: ${name}`);
                return [
                    name,
                    {
                        bytes: Buffer.byteLength(source),
                        sha256: createHash('sha256')
                            .update(source)
                            .digest('hex'),
                    },
                ];
            }),
        ),
    };
}
