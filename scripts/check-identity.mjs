/**
 * @file scripts/check-identity.mjs
 * Purpose: Block retired owned identities in authored and generated project files.
 * Contents: Source-only mode, compact reviewed counts, and actionable diagnostics.
 */

import { fileURLToPath } from 'node:url';
import { auditIdentity } from './identity-audit.mjs';

const args = process.argv.slice(2);
if (args.some((argument) => argument !== '--source-only') || args.length > 1)
    throw new Error('Supported option: --source-only');

const result = await auditIdentity(
    fileURLToPath(new URL('../', import.meta.url)),
    {
        sourceOnly: args.includes('--source-only'),
    },
);
const counts = Object.entries(result.approved)
    .map(([id, count]) => `${id}=${count}`)
    .join(', ');
console.log(
    `Identity audit: ${result.files} files; approved ${counts || 'none'}.`,
);
for (const finding of result.findings) {
    console.error(
        `${finding.path}:${finding.line}:${finding.column}: retired identity ${JSON.stringify(finding.value)} in ${finding.kind}`,
    );
}
if (result.findings.length) {
    console.error(`Unexpected identity matches: ${result.findings.length}.`);
    process.exitCode = 1;
}
