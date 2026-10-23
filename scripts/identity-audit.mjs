/**
 * @file scripts/identity-audit.mjs
 * Purpose: Detect retired owned identities while preserving exact factual evidence.
 * Contents: Authored-file discovery, reviewed fragment matching, and audit findings.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import policy from './identity-policy.json' with { type: 'json' };

const ignoredDirectories = new Set([
    '.git',
    '.idea',
    'node_modules',
    '.cache',
    'coverage',
    'playwright-report',
    'test-results',
]);
const policyPath = 'scripts/identity-policy.json';
const binaryExtensions = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.ico',
    '.pdf',
    '.woff',
    '.woff2',
    '.ttf',
    '.zip',
    '.gz',
    '.mp3',
    '.mp4',
]);

function escapePattern(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function identityPattern() {
    return new RegExp(
        policy.identities
            .map((parts) => parts.map(escapePattern).join('[\\s_-]*'))
            .join('|'),
        'giu',
    );
}

function fragmentRanges(text, fragment) {
    const ranges = [];
    let index = 0;
    while ((index = text.indexOf(fragment, index)) !== -1) {
        ranges.push({ start: index, end: index + fragment.length });
        index += fragment.length;
    }
    return ranges;
}

function approvedRanges(path, text) {
    const rules = policy.exceptions.filter((rule) => rule.paths.includes(path));
    const ranges = rules.flatMap((rule) =>
        fragmentRanges(text, rule.fragment).map((range) => ({
            ...range,
            id: rule.id,
        })),
    );
    if (path === policyPath) {
        ranges.push(...policyDefinitionRanges(text));
    }
    return ranges;
}

/** Only actual policy definition fields may contain their declared identities. */
function policyDefinitionRanges(text) {
    try {
        JSON.parse(text);
    } catch {
        return [];
    }
    const tokens = [
        ...text.matchAll(
            /"(?:\\[\s\S]|[^"\\])*"|[{}[\],:]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/gu,
        ),
    ];
    const ranges = [];
    let index = 0;
    function read(path) {
        const token = tokens[index++];
        if (token[0] === '{') {
            while (tokens[index][0] !== '}') {
                const key = JSON.parse(tokens[index++][0]);
                index++;
                read([...path, key]);
                if (tokens[index][0] === ',') index++;
            }
            index++;
        } else if (token[0] === '[') {
            let item = 0;
            while (tokens[index][0] !== ']') {
                read([...path, item++]);
                if (tokens[index][0] === ',') index++;
            }
            index++;
        } else if (token[0].startsWith('"')) {
            const definition =
                (path[0] === 'identities' &&
                    path.length === 3 &&
                    typeof path[1] === 'number' &&
                    typeof path[2] === 'number') ||
                (path[0] === 'exceptions' &&
                    typeof path[1] === 'number' &&
                    ((path[2] === 'fragment' && path.length === 3) ||
                        (path[2] === 'paths' &&
                            path.length === 4 &&
                            typeof path[3] === 'number')));
            if (definition)
                ranges.push({
                    start: token.index,
                    end: token.index + token[0].length,
                    id: 'audit-policy-definitions',
                });
        }
    }
    read([]);
    return ranges;
}

/** Scans authored paths/content and, after a build, generated distribution files. */
export async function auditIdentity(root, { sourceOnly = false } = {}) {
    if (!sourceOnly) {
        const distribution = await stat(join(root, 'dist')).catch(() => null);
        if (!distribution?.isDirectory())
            throw new Error(
                'Build the distribution before its identity audit.',
            );
    }
    const findings = [];
    const approved = new Map();
    let files = 0;

    function inspect(path, text, kind) {
        const ranges = approvedRanges(path, text);
        for (const match of text.matchAll(identityPattern())) {
            const exception = ranges.find(
                (range) =>
                    match.index >= range.start &&
                    match.index + match[0].length <= range.end,
            );
            if (exception) {
                approved.set(
                    exception.id,
                    (approved.get(exception.id) ?? 0) + 1,
                );
                continue;
            }
            const preceding = text.slice(0, match.index);
            const line = kind === 'path' ? 1 : preceding.split('\n').length;
            const column =
                kind === 'path'
                    ? match.index + 1
                    : match.index - preceding.lastIndexOf('\n');
            findings.push({ path, kind, line, column, value: match[0] });
        }
    }

    async function visit(directory, prefix = '') {
        const entries = await readdir(directory, { withFileTypes: true });
        entries.sort((left, right) => left.name.localeCompare(right.name));
        for (const entry of entries) {
            if (entry.isDirectory() && ignoredDirectories.has(entry.name))
                continue;
            if (!prefix && sourceOnly && entry.name === 'dist') continue;
            const path = prefix ? `${prefix}/${entry.name}` : entry.name;
            inspect(path, path, 'path');
            if (entry.isDirectory())
                await visit(join(directory, entry.name), path);
            else if (entry.isFile()) {
                const data = await readFile(join(directory, entry.name));
                files++;
                // Binary assets keep their bytes and attribution; their paths
                // still participate in the identity audit above.
                if (
                    !binaryExtensions.has(extname(path).toLowerCase()) &&
                    entry.name !== '.DS_Store'
                )
                    inspect(path, data.toString('utf8'), 'content');
            }
        }
    }
    await visit(root);
    return {
        files,
        findings,
        approved: Object.fromEntries(
            [...approved].sort(([left], [right]) => left.localeCompare(right)),
        ),
    };
}
