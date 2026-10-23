/**
 * @file tests/build/release-workflow.test.mjs
 * Purpose: Exercise release version gates and publication commands without a remote release.
 * Contents: Workflow extraction, version fixtures, annotated tags, and a local CLI substitute.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    chmod,
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { artifactNames } from '../../scripts/tools.mjs';

const workflow = await readFile(
    new URL('../../.github/workflows/release.yml', import.meta.url),
    'utf8',
);

function workflowCommand(name) {
    const start = workflow.indexOf(`      - name: ${name}\n`);
    assert.notEqual(start, -1, `Missing release workflow step: ${name}`);
    const nextStep = workflow.indexOf('\n      - ', start);
    const nextJob = workflow.indexOf('\n\n  publish:', start);
    const end = Math.min(
        ...[nextStep, nextJob, workflow.length].filter(
            (value) => value > start,
        ),
    );
    const lines = workflow.slice(start, end).split('\n');
    const run = lines.indexOf('        run: |');
    assert.notEqual(run, -1, `Missing shell command: ${name}`);
    return lines
        .slice(run + 1)
        .map((line) => line.replace(/^ {10}/u, ''))
        .join('\n');
}

const versionScript = workflowCommand('Validate the release version').match(
    /node --input-type=module <<'NODE'\n([\s\S]+?)\nNODE(?:\n|$)/u,
)?.[1];
assert.ok(
    versionScript,
    'The version gate must have an executable Node script.',
);

async function fixtureDirectory(t) {
    const directory = await mkdtemp(join(tmpdir(), 'kanade-release-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    return directory;
}

async function checkVersion(
    directory,
    {
        version,
        tag = `v${version}`,
        lockVersion = version,
        rootVersion = version,
    },
) {
    const output = join(directory, 'step-output');
    await Promise.all([
        writeFile(join(directory, 'package.json'), JSON.stringify({ version })),
        writeFile(
            join(directory, 'package-lock.json'),
            JSON.stringify({
                version: lockVersion,
                packages: { '': { version: rootVersion } },
            }),
        ),
        writeFile(output, ''),
    ]);
    const result = spawnSync(process.execPath, ['--input-type=module'], {
        cwd: directory,
        env: { ...process.env, RELEASE_TAG: tag, GITHUB_OUTPUT: output },
        input: versionScript,
        encoding: 'utf8',
    });
    return { ...result, output: await readFile(output, 'utf8') };
}

test('release tags match the root version and classify SemVer prereleases independently of build metadata', async (t) => {
    const directory = await fixtureDirectory(t);
    for (const [version, prerelease] of [
        ['0.1.0', false],
        ['1.2.3+build-with-hyphen.2', false],
        ['1.2.3-rc.1', true],
        ['1.2.3-rc.1+build.2', true],
    ]) {
        const result = await checkVersion(directory, { version });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.output, `prerelease=${prerelease}\n`);
    }
});

test('the release gate rejects malformed versions, mismatched tags, and either lockfile version mismatch', async (t) => {
    const directory = await fixtureDirectory(t);
    for (const version of [
        '01.2.3',
        '1.2',
        '1.2.3-01',
        '1.2.3-',
        '1.2.3+x..y',
        '1.2.3\n',
    ]) {
        const result = await checkVersion(directory, { version });
        assert.notEqual(
            result.status,
            0,
            `Accepted malformed version ${JSON.stringify(version)}`,
        );
        assert.equal(result.output, '');
    }
    for (const change of [
        { tag: 'v0.2.0' },
        { tag: '0.1.0' },
        { lockVersion: '0.0.0' },
        { rootVersion: '0.0.0' },
        { rootVersion: null },
    ]) {
        const result = await checkVersion(directory, {
            version: '0.1.0',
            ...change,
        });
        assert.notEqual(
            result.status,
            0,
            `Accepted inconsistent release ${JSON.stringify(change)}`,
        );
        assert.equal(result.output, '');
    }
});

function command(cwd, executable, args, env = {}) {
    return spawnSync(executable, args, {
        cwd,
        env: { ...process.env, ...env },
        encoding: 'utf8',
    });
}

function shell(cwd, script, env) {
    return command(
        cwd,
        'bash',
        ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', script],
        env,
    );
}

test('publication requires an annotated tag pointing to the triggering commit', async (t) => {
    const directory = await fixtureDirectory(t);
    for (const args of [
        ['init', '--quiet'],
        [
            '-c',
            'user.name=Release fixture',
            '-c',
            'user.email=release@example.test',
            'commit',
            '--quiet',
            '--allow-empty',
            '-m',
            'fixture',
        ],
        [
            '-c',
            'user.name=Release fixture',
            '-c',
            'user.email=release@example.test',
            'tag',
            '-a',
            'v0.1.0',
            '-m',
            'fixture',
        ],
        ['tag', 'v0.2.0'],
    ]) {
        const result = command(directory, 'git', args);
        assert.equal(result.status, 0, result.stderr);
    }
    const sha = command(directory, 'git', ['rev-parse', 'HEAD']).stdout.trim();
    const script = workflowCommand('Validate the annotated release checkpoint');
    const matching = shell(directory, script, {
        RELEASE_TAG: 'v0.1.0',
        GITHUB_SHA: sha,
    });
    assert.equal(matching.status, 0, matching.stderr);
    assert.notEqual(
        shell(directory, script, { RELEASE_TAG: 'v0.2.0', GITHUB_SHA: sha })
            .status,
        0,
    );
    assert.notEqual(
        shell(directory, script, {
            RELEASE_TAG: 'v0.1.0',
            GITHUB_SHA: '0'.repeat(40),
        }).status,
        0,
    );
});

test('the release CLI receives all eight independent scripts and metadata and preserves prerelease behavior', async (t) => {
    const directory = await fixtureDirectory(t);
    const files = [...artifactNames, 'LICENSE.txt', 'manifest.json'];
    await mkdir(join(directory, 'dist'));
    await Promise.all(
        files.map((name) =>
            writeFile(join(directory, 'dist', name), 'fixture'),
        ),
    );
    const executable = join(directory, 'gh');
    await writeFile(
        executable,
        "#!/usr/bin/env node\nrequire('node:fs').writeFileSync(process.env.CLI_ARGS, JSON.stringify(process.argv.slice(2)));\n",
    );
    await chmod(executable, 0o755);
    const output = join(directory, 'cli-args.json');
    for (const prerelease of ['false', 'true']) {
        const result = shell(
            directory,
            workflowCommand('Publish the project release'),
            {
                PATH: `${directory}:${process.env.PATH}`,
                CLI_ARGS: output,
                GH_TOKEN: 'offline-fixture',
                GH_REPO: 'fixture/kanade',
                RELEASE_TAG: 'v0.1.0',
                RELEASE_PRERELEASE: prerelease,
            },
        );
        assert.equal(result.status, 0, result.stderr);
        const args = JSON.parse(await readFile(output, 'utf8'));
        assert.deepEqual(args.slice(0, 3), ['release', 'create', 'v0.1.0']);
        assert.deepEqual(
            args.slice(3, 3 + files.length).sort(),
            files.map((name) => `dist/${name}`).sort(),
        );
        assert.ok(args.includes('--verify-tag'));
        assert.ok(args.includes('--generate-notes'));
        assert.equal(args.includes('--prerelease'), prerelease === 'true');
        assert.equal(args.includes('--latest=false'), prerelease === 'true');
    }
});
