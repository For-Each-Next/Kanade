/**
 * @file scripts/check.mjs
 * Purpose: Verify formatting, lint, types, and unused code through root commands.
 * Contents: Verification modes and isolated source, template, and test checks.
 */
import { fileURLToPath } from 'node:url';
import { tools } from './tools.mjs';
import { runNode } from './run-command.mjs';

const modes = process.argv.slice(2);
const supported = ['--types', '--lint', '--unused', '--format'];
if (modes.some((mode) => !supported.includes(mode))) {
    throw new Error(`Supported options: ${supported.join(', ')}`);
}
const enabled = (mode) => modes.length === 0 || modes.includes(mode);

try {
    if (enabled('--format'))
        await runNode([
            'node_modules/prettier/bin/prettier.cjs',
            '--check',
            '.',
            '!package-lock.json',
        ]);
    if (enabled('--lint')) {
        await runNode([
            'node_modules/eslint/bin/eslint.js',
            '.',
            '--max-warnings=0',
        ]);
        await runNode([
            'node_modules/stylelint/bin/stylelint.mjs',
            'src/**/*.css',
        ]);
    }
    if (enabled('--types')) {
        for (const tool of tools) {
            const compiler =
                tool.id === 'rev-copy'
                    ? import.meta.resolve('typescript/bin/tsc')
                    : import.meta.resolve('vue-tsc/bin/vue-tsc.js');
            await runNode([
                fileURLToPath(compiler),
                '--noEmit',
                '-p',
                `config/typescript/${tool.directory}.json`,
            ]);
            if (tool.id !== 'rev-copy') {
                await runNode([
                    'node_modules/typescript/bin/tsc',
                    '--noEmit',
                    '-p',
                    `config/typescript/${tool.directory}.tests.json`,
                ]);
            }
        }
        await runNode([
            'node_modules/typescript/bin/tsc',
            '--noEmit',
            '-p',
            'config/typescript/tooling.json',
        ]);
    }
    if (enabled('--unused'))
        await runNode([
            'node_modules/knip/bin/knip.js',
            '--config',
            'knip.config.mjs',
        ]);
} catch (error) {
    console.error(error.message);
    process.exitCode ||= 1;
}
