/**
 * @file tests/build/architecture.test.mjs
 * Purpose: Keep resolved tool ownership and layer boundaries enforceable.
 * Contents: Imports, reexports, dynamic imports, type contracts, and pure public APIs.
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { ESLint, Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { architectureRule } from '../../scripts/architecture-rule.mjs';

function lint(file, source) {
    return new Linter().verify(
        source,
        {
            files: ['**/*.ts'],
            languageOptions: { parser: tseslint.parser },
            plugins: {
                architecture: { rules: { boundaries: architectureRule } },
            },
            rules: { 'architecture/boundaries': 'error' },
        },
        { filename: path.resolve(file) },
    );
}

for (const tool of [
    'source-editor',
    'rev-copy',
    'vg-stub-creator',
    'wpvg-assessor',
]) {
    test(`${tool} features receive host operations and workflow contracts by injection`, () => {
        for (const statement of [
            "import { read } from '../../platform/browser/storage.ts';",
            "export { read } from '../../platform/browser/storage.ts';",
            "const load = () => import('../../platform/browser/storage.ts');",
            "import type { Storage } from '../../platform/browser/storage.ts';",
            "import { start } from '../../app/main.ts';",
            "import type { Startup } from '../../app/main.ts';",
        ]) {
            assert.equal(
                lint(`src/${tool}/features/example/controller.ts`, statement)
                    .length,
                1,
                statement,
            );
        }
        assert.deepEqual(
            lint(
                `src/${tool}/features/example/controller.ts`,
                "import type { Workflow } from '../../app/contracts/example.ts';",
            ),
            [],
        );
    });

    test(`${tool} domain and public exports remain pure`, () => {
        assert.equal(
            lint(
                `src/${tool}/domain/example.ts`,
                "import { messages } from '../i18n/index.ts';",
            ).length,
            1,
        );
        assert.equal(
            lint(`src/${tool}/index.ts`, "export * from './app/browser.ts';")
                .length,
            1,
        );
        assert.equal(
            lint(
                `src/${tool}/domain/example.ts`,
                "import { loadHostModules } from '../../library/mediawiki-runtime/modules.ts';",
            ).length,
            1,
        );
        assert.deepEqual(
            lint(
                `src/${tool}/domain/example.ts`,
                "import { normalize } from './validation.ts';",
            ),
            [],
        );
    });
}

test('cross-tool ownership includes types, exports, and normalized relative paths', () => {
    for (const statement of [
        "import type { Page } from '../../../rev-copy/domain/page-reference.ts';",
        "type Page = import('../../../rev-copy/domain/page-reference.ts').Page;",
        "export * from '../../../rev-copy/domain/page-reference.ts';",
        "const load = () => import('../../../rev-copy/domain/../domain/page-reference.ts');",
    ]) {
        assert.equal(
            lint('src/source-editor/features/example/controller.ts', statement)
                .length,
            1,
        );
    }
});

test('library capabilities never import tool implementations', () => {
    assert.equal(
        lint(
            'src/library/notifications/example.ts',
            "export * from '../../source-editor/domain/types.ts';",
        ).length,
        1,
    );
    assert.deepEqual(
        lint(
            'src/library/notifications/example.ts',
            "export * from './contracts.ts';",
        ),
        [],
    );
});

test('platform and workflows depend on consumer contracts instead of interface owners', () => {
    assert.equal(
        lint(
            'src/rev-copy/platform/mediawiki/example.ts',
            "import { draw } from '../../features/advanced-copy/dialog.ts';",
        ).length,
        1,
    );
    assert.equal(
        lint(
            'src/rev-copy/platform/mediawiki/example.ts',
            "import { start } from '../../app/main.ts';",
        ).length,
        1,
    );
    assert.deepEqual(
        lint(
            'src/rev-copy/platform/mediawiki/example.ts',
            "import type { Runtime } from '../../app/contracts/advanced-copy.ts';",
        ),
        [],
    );
    assert.equal(
        lint(
            'src/vg-stub-creator/app/workflows/example.ts',
            "import { save } from '../../platform/mediawiki/wiki-writes.ts';",
        ).length,
        1,
    );
});

for (const module of [
    'category-assessment',
    'archive-new-pages',
    'save-dialog',
    'staged-assessments',
    'assessment-state',
    'dialog-state',
]) {
    test(`flat Assessor workflow ${module} receives host operations by injection`, () => {
        assert.equal(
            lint(
                `src/wpvg-assessor/app/${module}.ts`,
                "import { save } from '../platform/mediawiki/page-api.ts';",
            ).length,
            1,
        );
    });
}

test('pure notifications cannot acquire UI library or external-runtime dependencies', () => {
    assert.equal(
        lint(
            'src/library/notifications/example.ts',
            "import { register } from '../quick-access/registry.ts';",
        ).length,
        1,
    );
    assert.equal(
        lint(
            'src/library/notifications/example.ts',
            "import { createApp } from 'vue';",
        ).length,
        1,
    );
});

test('public APIs, every domain, and pure library capabilities reject host globals', async () => {
    const eslint = new ESLint();
    for (const file of [
        'src/source-editor/index.ts',
        'src/rev-copy/index.ts',
        'src/rev-copy/domain/example.ts',
        'src/library/notifications/example.ts',
        'src/library/wikitext/example.ts',
        'src/library/wikitext-highlighting/example.ts',
        'src/library/wiki-titles/example.ts',
        'src/library/citation-metadata/example.ts',
        'src/library/i18n/example.ts',
        'src/library/logging/example.ts',
        'src/library/data-validation/example.ts',
        'src/library/new-page-list/example.ts',
    ]) {
        const [result] = await eslint.lintText(
            'globalThis.document.createElement("div");',
            { filePath: file },
        );
        assert.ok(
            result.messages.some(
                (message) => message.ruleId === 'no-restricted-globals',
            ),
            file,
        );
    }
});

test('pure shared rules are available to tool domains without permitting host libraries', () => {
    for (const capability of [
        'wikitext',
        'wikitext-highlighting',
        'wiki-titles',
        'citation-metadata',
        'i18n',
        'logging',
        'data-validation',
        'new-page-list',
    ]) {
        assert.deepEqual(
            lint(
                'src/source-editor/domain/example.ts',
                `import { rule } from '../../library/${capability}/example.ts';`,
            ),
            [],
        );
        assert.equal(
            lint(
                `src/library/${capability}/example.ts`,
                "import { fetchCitationMetadata } from '../citoid/client.ts';",
            ).length,
            1,
        );
    }
    for (const capability of [
        'citoid',
        'mediawiki-edit-box',
        'wikitext-textbox',
    ]) {
        assert.equal(
            lint(
                'src/source-editor/domain/example.ts',
                `import { host } from '../../library/${capability}/example.ts';`,
            ).length,
            1,
        );
    }
});

test('textbox highlighting depends only on syntax, not editor contributions', () => {
    assert.deepEqual(
        lint(
            'src/library/wikitext-textbox/index.ts',
            "import { highlightWikitext } from '../wikitext-highlighting/highlighter.ts';",
        ),
        [],
    );
    for (const statement of [
        "import { loadHostModules } from '../mediawiki-runtime/modules.ts';",
        "import { preview } from '../../source-editor/features/editor/reference-tooltip.ts';",
    ]) {
        assert.equal(
            lint('src/library/wikitext-textbox/index.ts', statement).length,
            1,
        );
    }
});

test('pure rules import notification contracts only as types', () => {
    assert.equal(
        lint(
            'src/source-editor/domain/example.ts',
            "import { createActionNotifier } from '../../library/notifications/action-notifier.ts';",
        ).length,
        1,
    );
    assert.deepEqual(
        lint(
            'src/source-editor/domain/example.ts',
            "import type { ActionNotifier } from '../../library/notifications/contracts.ts';",
        ),
        [],
    );
    assert.equal(
        lint(
            'src/rev-copy/platform/mediawiki/example.ts',
            "import type { Startup } from '../../app/main.ts';",
        ).length,
        1,
    );
    assert.equal(
        lint(
            'src/wpvg-assessor/app/category-assessment.ts',
            "import type { Startup } from './main.ts';",
        ).length,
        1,
    );
});
