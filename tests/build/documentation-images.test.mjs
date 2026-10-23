/**
 * @file tests/build/documentation-images.test.mjs
 * Purpose: Reject orphaned, renamed, or tampered screenshots without live service access.
 * Contents: Ledger formats, inventory coverage, and capture integrity regressions.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateScreenshotCollections } from '../../scripts/documentation-images.mjs';

const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
);
const name = 'screenshot01.en.png';

async function fixture(context, wrap = (entry) => ({ captures: [entry] })) {
    const root = await mkdtemp(join(tmpdir(), 'kanade-doc-images-'));
    context.after(() => rm(root, { recursive: true, force: true }));
    const directory = join(root, 'docs', 'example', 'images');
    await mkdir(directory, { recursive: true });
    const entry = {
        image: name,
        imageSha256: createHash('sha256').update(image).digest('hex'),
        viewport: { width: 1, height: 1 },
        deviceScaleFactor: 1,
    };
    const ledger = wrap(entry);
    const saveLedger = () =>
        writeFile(
            join(directory, 'live-captures.json'),
            JSON.stringify(ledger),
        );
    await writeFile(join(directory, name), image);
    await writeFile(join(directory, 'README.md'), `[English](${name})\n`);
    await saveLedger();
    return { root, directory, entry, ledger, saveLedger };
}

const formats = {
    'Source Editor': (entry) => ({ captures: { [entry.image]: entry } }),
    'Article Creator': (entry) => ({ captures: [entry] }),
    'Article Assessor': (entry) => ({ pages: [{ captures: [entry] }] }),
    'Revision Copy': (entry) => ({
        viewport: entry.viewport,
        pages: { english: { ...entry, viewport: undefined } },
    }),
};
for (const [format, wrap] of Object.entries(formats)) {
    test(`validates the ${format} ledger format`, async (context) => {
        const { root } = await fixture(context, wrap);
        assert.deepEqual(validateScreenshotCollections(root), {
            imageCount: 1,
            failures: [],
        });
    });
}

test('rejects screenshots missing from the inventory and ledger', async (context) => {
    const { root, directory } = await fixture(context);
    await writeFile(join(directory, 'screenshot02.zh-Hans.png'), image);
    const { failures } = validateScreenshotCollections(root);
    assert.equal(failures.length, 2);
    assert.match(failures[0], /missing from image inventory/u);
    assert.match(failures[1], /missing from capture ledger/u);
});

test('rejects a stale checksum after an image changes', async (context) => {
    const { root, directory } = await fixture(context);
    await writeFile(
        join(directory, name),
        Buffer.concat([image, Buffer.from('changed')]),
    );
    assert.match(
        validateScreenshotCollections(root).failures.join('\n'),
        /PNG checksum/u,
    );
});

test('checks actual PNG dimensions against viewport and pixel ratio', async (context) => {
    const { root, entry, saveLedger } = await fixture(context);
    entry.deviceScaleFactor = 2;
    await saveLedger();
    assert.match(
        validateScreenshotCollections(root).failures.join('\n'),
        /PNG dimensions/u,
    );
});

test('rejects coerced or nonpositive capture dimensions and pixel ratios', async (context) => {
    const { root, entry, saveLedger } = await fixture(context);
    for (const [width, height, scale] of [
        ['1', '1', '1'],
        [-1, -1, -1],
        [0, 0, 1],
        [1, 1, 0],
    ]) {
        entry.viewport = { width, height };
        entry.deviceScaleFactor = scale;
        await saveLedger();
        assert.match(
            validateScreenshotCollections(root).failures.join('\n'),
            /PNG dimensions/u,
        );
    }
});

test('rejects missing and duplicated captured images', async (context) => {
    const { root, ledger, directory, entry, saveLedger } =
        await fixture(context);
    ledger.captures.push(entry);
    await saveLedger();
    assert.match(
        validateScreenshotCollections(root).failures.join('\n'),
        /duplicate capture/u,
    );
    await rm(join(directory, name));
    assert.match(
        validateScreenshotCollections(root).failures.join('\n'),
        /capture image is missing/u,
    );
});

test('rejects malformed ledgers and incomplete collections', async (context) => {
    const { root, directory } = await fixture(context);
    await writeFile(join(directory, 'live-captures.json'), '{');
    assert.match(
        validateScreenshotCollections(root).failures.join('\n'),
        /invalid capture ledger JSON/u,
    );
    await rm(join(directory, 'README.md'));
    assert.match(
        validateScreenshotCollections(root).failures.join('\n'),
        /missing image inventory/u,
    );
});

test('rejects traversal names and invalid PNG headers', async (context) => {
    const { root, directory, entry, saveLedger } = await fixture(context);
    entry.image = '../screenshot01.en.png';
    await saveLedger();
    assert.match(
        validateScreenshotCollections(root).failures.join('\n'),
        /invalid capture image name/u,
    );
    entry.image = name;
    await saveLedger();
    await writeFile(join(directory, name), 'not a PNG');
    assert.match(
        validateScreenshotCollections(root).failures.join('\n'),
        /invalid PNG header/u,
    );
});

test('reports invalid ledger records without crashing the documentation check', async (context) => {
    const { root, directory } = await fixture(context);
    for (const ledger of [
        null,
        {},
        { captures: 'invalid' },
        { captures: [null] },
        { pages: [null] },
        { captures: [{ image: '.' }] },
    ]) {
        await writeFile(
            join(directory, 'live-captures.json'),
            JSON.stringify(ledger),
        );
        const { failures } = validateScreenshotCollections(root);
        assert.ok(failures.length > 0);
        assert.match(failures.join('\n'), /invalid capture/u);
    }
});

test('rejects a directory with a screenshot filename', async (context) => {
    const { root, directory } = await fixture(context);
    await rm(join(directory, name));
    await mkdir(join(directory, name));
    assert.match(
        validateScreenshotCollections(root).failures.join('\n'),
        /capture image is missing/u,
    );
});

test('validates a framed screenshot while retaining the browser viewport', async (context) => {
    const { root, entry, saveLedger } = await fixture(context);
    entry.captureRegion = { x: 10, y: 20, width: 1, height: 1 };
    entry.viewport = { width: 1366, height: 768 };
    await saveLedger();
    assert.deepEqual(validateScreenshotCollections(root).failures, []);
});
