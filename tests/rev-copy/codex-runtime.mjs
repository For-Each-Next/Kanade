/**
 * @file tests/rev-copy/codex-runtime.mjs
 * Purpose: Bundle the real Vue and Codex components for offline browser fixtures only.
 *
 * Contents: buildCodexRuntime.
 */

import { build } from 'esbuild';

export async function buildCodexRuntime() {
    const { outputFiles } = await build({
        stdin: {
            contents: `import * as vue from 'vue';
                import * as codex from '@wikimedia/codex';
                window.revCopyTestModules = { vue, '@wikimedia/codex': codex };`,
            resolveDir: process.cwd(),
        },
        bundle: true,
        format: 'iife',
        write: false,
        define: {
            'process.env.NODE_ENV': '"production"',
            __VUE_OPTIONS_API__: 'true',
            __VUE_PROD_DEVTOOLS__: 'false',
            __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
        },
    });
    return outputFiles[0].text;
}
