/**
 * @file scripts/test.mjs
 * Purpose: Discover all offline unit and workflow tests from the repository root.
 * Contents: Tool selection, test discovery, and Node test execution.
 */
import { globSync } from 'node:fs';
import { runNode } from './run-command.mjs';
import { tools } from './tools.mjs';

const args = process.argv.slice(2);
const target = tools.find(
    (tool) => tool.directory === args[0] || tool.id === args[0],
);
if (target) args.shift();
const files = [
    ...globSync(
        `tests/${target ? `${target.directory}/` : ''}**/*.test.{ts,mjs}`,
    ),
].sort();
if (files.length === 0) throw new Error('No unit tests were found.');
try {
    await runNode(['--test', ...args, ...files]);
} catch (error) {
    console.error(error.message);
    process.exitCode ||= 1;
}
