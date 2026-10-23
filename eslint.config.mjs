/**
 * @file eslint.config.mjs
 * Purpose: Enforce shared source conventions and application layer boundaries.
 * Contents: Host restrictions, layer imports, and scoped lint rules.
 */

import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { architectureRule } from './scripts/architecture-rule.mjs';

const hostGlobals = [
    'window',
    'document',
    'mw',
    'fetch',
    'localStorage',
    'sessionStorage',
    'navigator',
    'HTMLElement',
    'Element',
    'Node',
    'DOMParser',
    'location',
    'XMLHttpRequest',
    'WebSocket',
    'Worker',
    'MutationObserver',
    'indexedDB',
    'globalThis',
];
export default defineConfig(
    globalIgnores([
        'node_modules/**',
        'dist/**',
        'coverage/**',
        'test-results/**',
        'playwright-report/**',
        '.idea/**',
    ]),
    {
        files: ['**/*.{ts,js,mjs}'],
        extends: [js.configs.recommended, tseslint.configs.recommended],
        languageOptions: {
            globals: { ...globals.browser, ...globals.node, mw: 'readonly' },
        },
        rules: {
            '@typescript-eslint/consistent-type-imports': [
                'error',
                { disallowTypeAnnotations: false },
            ],
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-empty-object-type': [
                'error',
                { allowInterfaces: 'with-single-extends' },
            ],
        },
    },
    {
        files: ['src/**/*.ts'],
        rules: {
            'no-var': 'error',
            'prefer-const': 'error',
            'object-shorthand': 'error',
        },
    },
    {
        files: ['src/**/*.ts'],
        plugins: { architecture: { rules: { boundaries: architectureRule } } },
        rules: { 'architecture/boundaries': 'error' },
    },
    {
        files: [
            'src/**/domain/**/*.ts',
            'src/**/shared/**/*.ts',
            'src/*/index.ts',
            'src/library/notifications/**/*.ts',
            'src/library/i18n/**/*.ts',
            'src/library/logging/**/*.ts',
            'src/library/wiki-titles/**/*.ts',
            'src/library/wikitext/**/*.ts',
            'src/library/data-validation/**/*.ts',
            'src/library/new-page-list/**/*.ts',
            'src/library/citation-metadata/**/*.ts',
            'src/library/wikitext-highlighting/**/*.ts',
        ],
        rules: {
            'no-restricted-globals': [
                'error',
                { globals: hostGlobals, checkGlobalObject: true },
            ],
        },
    },
    {
        files: [
            'tests/**/*.{ts,js,mjs}',
            'src/vg-stub-creator/**/*.ts',
            'src/source-editor/types/codex-components.d.ts',
        ],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-empty-function': 'off',
        },
    },
    {
        files: ['tests/source-editor/**/*.ts'],
        rules: { 'no-regex-spaces': 'off' },
    },
    {
        files: [
            'src/source-editor/config/citation-template-data/generated/**/*.ts',
        ],
        rules: { 'object-shorthand': 'off' },
    },
    {
        files: [
            'src/rev-copy/domain/{attribution,page-reference,revision-links}.ts',
        ],
        // Bracket parsing remains explicit; page references deliberately reject controls.
        rules: { 'no-useless-escape': 'off', 'no-control-regex': 'off' },
    },
    {
        files: ['tests/wpvg-assessor/ui/mediawiki.js'],
        languageOptions: { globals: { Vue: 'readonly', codex: 'readonly' } },
    },
);
