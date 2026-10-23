/**
 * @file scripts/architecture-rule.mjs
 * Purpose: Enforce tool ownership and dependency direction for every source module.
 * Contents: Resolved import checks for tools, library capabilities, and source layers.
 */

import path from 'node:path';
import { tools } from './tools.mjs';

const owners = new Set(tools.map((tool) => tool.directory));
const pureLibraries = new Set([
    'notifications',
    'i18n',
    'logging',
    'wiki-titles',
    'wikitext',
    'data-validation',
    'new-page-list',
    'citation-metadata',
    'wikitext-highlighting',
]);
const pureLibraryContracts = new Set(['notifications/contracts.ts']);
const compositionModules = new Map([
    [
        'source-editor',
        new Set([
            'browser.ts',
            'main.ts',
            'editor-integration.ts',
            'reference-management.ts',
            'formatter.ts',
        ]),
    ],
    ['rev-copy', new Set(['browser.ts', 'main.ts'])],
    ['vg-stub-creator', new Set(['browser.ts', 'main.ts', 'interface.ts'])],
    ['wpvg-assessor', new Set(['browser.ts', 'main.ts', 'interface.ts'])],
]);
const libraryDependencies = new Map([
    ['i18n', new Set(['i18n'])],
    ['logging', new Set(['logging'])],
    ['wiki-titles', new Set(['wiki-titles', 'data-validation'])],
    ['data-validation', new Set(['data-validation'])],
    ['new-page-list', new Set(['new-page-list'])],
    ['citation-metadata', new Set(['citation-metadata'])],
    [
        'wikitext-highlighting',
        new Set(['wikitext-highlighting', 'wikitext', 'wiki-titles']),
    ],
    [
        'wikitext-textbox',
        new Set(['wikitext-textbox', 'wikitext-highlighting']),
    ],
    ['wikitext', new Set(['wikitext'])],
    ['mediawiki-edit-box', new Set(['mediawiki-edit-box'])],
    ['citoid', new Set(['citoid', 'data-validation'])],
    ['notifications', new Set(['notifications'])],
    ['mediawiki-runtime', new Set(['mediawiki-runtime'])],
    ['quick-access', new Set(['quick-access', 'mediawiki-runtime'])],
]);

function sourceLocation(filename) {
    const segments = filename.replaceAll('\\', '/').split('/');
    const index = segments.lastIndexOf('src');
    if (index < 0 || segments.length < index + 3) return null;
    return segments.slice(index + 1);
}

function isTypeOnly(node) {
    if (
        node.type === 'TSImportType' ||
        node.importKind === 'type' ||
        node.exportKind === 'type'
    )
        return true;
    if (
        node.type === 'ExportNamedDeclaration' &&
        node.specifiers.length > 0 &&
        node.specifiers.every((specifier) => specifier.exportKind === 'type')
    )
        return true;
    return (
        node.type === 'ImportDeclaration' &&
        node.specifiers.length > 0 &&
        node.specifiers.every((specifier) => specifier.importKind === 'type')
    );
}

export const architectureRule = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Enforce source ownership and dependency direction.',
        },
        schema: [],
        messages: { boundary: '{{reason}}' },
    },
    create(context) {
        const filename = context.physicalFilename ?? context.filename;
        const source = sourceLocation(filename);
        if (!source) return {};
        const [owner, layer] = source;
        function check(node, literal) {
            if (!literal || typeof literal.value !== 'string') return;
            const specifier = literal.value;
            const target = specifier.startsWith('.')
                ? sourceLocation(
                      path.resolve(path.dirname(filename), specifier),
                  )
                : null;
            const [targetOwner, targetLayer] = target ?? [];
            const targetIsComposition =
                targetLayer === 'app' &&
                compositionModules
                    .get(targetOwner)
                    ?.has(target.slice(2).join('/'));
            const targetIsPureContract =
                targetOwner === 'library' &&
                isTypeOnly(node) &&
                pureLibraryContracts.has(target.slice(1).join('/'));
            const targetIsPureLibrary =
                targetOwner === 'library' &&
                targetLayer !== 'notifications' &&
                pureLibraries.has(targetLayer);
            let reason;
            if (owner === 'library' && owners.has(targetOwner)) {
                reason =
                    'Shared library capabilities must never import a tool implementation.';
            } else if (
                owner === 'library' &&
                pureLibraries.has(layer) &&
                !target
            ) {
                reason =
                    'Pure shared capabilities do not load external runtimes.';
            } else if (
                owner === 'library' &&
                targetOwner === 'library' &&
                !libraryDependencies.get(layer)?.has(targetLayer)
            ) {
                reason =
                    'Shared capabilities declare their permitted library dependencies explicitly.';
            } else if (
                owners.has(owner) &&
                owners.has(targetOwner) &&
                targetOwner !== owner
            ) {
                reason =
                    'Tools depend on named library capabilities, never another tool implementation.';
            } else if (owners.has(owner)) {
                const pure =
                    layer === 'domain' ||
                    layer === 'shared' ||
                    layer === 'index.ts';
                if (pure) {
                    const forbidden = new Set([
                        'app',
                        'features',
                        'platform',
                        'i18n',
                    ]);
                    if (layer === 'shared') forbidden.add('domain');
                    if (
                        target &&
                        ((targetOwner === owner &&
                            forbidden.has(targetLayer)) ||
                            (targetOwner === 'library' &&
                                !targetIsPureContract &&
                                !targetIsPureLibrary))
                    ) {
                        reason =
                            'Pure rules and public APIs depend only on host-independent rules and contracts.';
                    } else if (!target && specifier !== 'entities') {
                        reason =
                            'Pure rules and public APIs do not load external runtimes.';
                    }
                } else if (layer === 'platform') {
                    if (
                        ['features', 'i18n'].includes(targetLayer) ||
                        (targetLayer === 'app' &&
                            (!isTypeOnly(node) || targetIsComposition))
                    ) {
                        reason =
                            'Platform adapters consume pure rules and application contracts as types.';
                    }
                } else if (layer === 'features') {
                    if (
                        targetLayer === 'platform' ||
                        (targetLayer === 'app' &&
                            (!isTypeOnly(node) || targetIsComposition))
                    ) {
                        reason =
                            'Features receive host adapters and application workflows through injected contracts.';
                    }
                } else if (
                    layer === 'app' &&
                    !compositionModules
                        .get(owner)
                        ?.has(source.slice(2).join('/'))
                ) {
                    if (
                        ['platform', 'features', 'i18n'].includes(
                            targetLayer,
                        ) ||
                        targetIsComposition ||
                        (targetOwner === 'library' &&
                            !isTypeOnly(node) &&
                            !targetIsPureLibrary)
                    ) {
                        reason =
                            'Application workflows and contracts receive external operations through injected consumer contracts.';
                    }
                }
            }
            if (reason)
                context.report({
                    node: literal,
                    messageId: 'boundary',
                    data: { reason },
                });
        }
        return {
            ImportDeclaration(node) {
                check(node, node.source);
            },
            ExportNamedDeclaration(node) {
                check(node, node.source);
            },
            ExportAllDeclaration(node) {
                check(node, node.source);
            },
            ImportExpression(node) {
                check(node, node.source);
            },
            TSImportType(node) {
                check(node, node.source);
            },
        };
    },
};
