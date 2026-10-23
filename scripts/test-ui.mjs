/**
 * @file scripts/test-ui.mjs
 * Purpose: Run browser regressions with temporary reports and no live wiki writes.
 * Contents: Browser-suite selection, temporary outputs, and cleanup.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNode } from './run-command.mjs';
import { tools } from './tools.mjs';

const output = await mkdtemp(join(tmpdir(), 'kanade-ui-'));
const args = process.argv.slice(2);
const target = tools.find((tool) => tool.id === args[0]);
if (target) args[0] = target.directory;
try {
    if (args[0] === 'rev-copy') {
        if (args.length > 1)
            throw new Error(
                'Revision Copy offline browser checks accept no filters.',
            );
        await runNode(['scripts/rev-copy/test-ui.mjs']);
    } else {
        await runNode(
            [
                fileURLToPath(import.meta.resolve('@playwright/test/cli')),
                'test',
                ...args,
                '--output',
                output,
                '--last-failed-file',
                join(output, 'last-run.json'),
            ],
            {
                env: {
                    ...process.env,
                    PLAYWRIGHT_HTML_OUTPUT_DIR: join(output, 'html'),
                    PLAYWRIGHT_HTML_OPEN: 'never',
                    PLAYWRIGHT_BLOB_OUTPUT_DIR: join(output, 'blob'),
                    PLAYWRIGHT_JSON_OUTPUT_FILE: join(output, 'results.json'),
                    PLAYWRIGHT_JUNIT_OUTPUT_FILE: join(output, 'results.xml'),
                },
            },
        );
        // Explicit Playwright filters apply only to the Playwright scenarios.
        if (args.length === 0) await runNode(['scripts/rev-copy/test-ui.mjs']);
    }
} catch (error) {
    console.error(error.message);
    process.exitCode ||= 1;
} finally {
    await rm(output, { recursive: true, force: true });
}
