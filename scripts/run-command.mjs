/**
 * @file scripts/run-command.mjs
 * Purpose: Run root verification commands while forwarding exit status and signals.
 * Contents: Root working directory and child-process lifecycle.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export async function runNode(args, options = {}) {
    const child = spawn(process.execPath, args, {
        cwd: projectRoot,
        stdio: 'inherit',
        ...options,
    });
    const interrupt = () => child.kill('SIGINT');
    const terminate = () => child.kill('SIGTERM');
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', terminate);
    try {
        const code = await new Promise((resolve, reject) => {
            child.once('error', reject);
            child.once('close', (status) => resolve(status ?? 1));
        });
        if (code !== 0) {
            process.exitCode = code;
            throw new Error(`Command failed (${code}): node ${args.join(' ')}`);
        }
    } finally {
        process.off('SIGINT', interrupt);
        process.off('SIGTERM', terminate);
    }
}
