/**
 * @file scripts/documentation-images.mjs
 * Purpose: Keep maintained screenshots aligned with their inventories and live provenance.
 * Contents: Capture filenames, collection discovery, ledger membership, dimensions, and integrity.
 */

import { createHash } from 'node:crypto';
import { existsSync, globSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

const screenshotName = /^screenshot\d{2}\.(?:en|zh-Hans|zh-Hant)\.png$/u;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const screenshotLocales = ['en', 'zh-Hans', 'zh-Hant'];

/** Numbers the maintained language set first, followed by optional capture views. */
export function documentationScreenshotFilename(locale, viewIndex = 0) {
    const languageIndex = screenshotLocales.indexOf(locale);
    if (languageIndex < 0 || !Number.isInteger(viewIndex) || viewIndex < 0)
        throw new Error('Unknown screenshot language or capture view.');
    const index = viewIndex * screenshotLocales.length + languageIndex + 1;
    return `screenshot${String(index).padStart(2, '0')}.${locale}.png`;
}

/** Validates retained captures as well as new ones without contacting Wikipedia. */
export function validateScreenshotCollections(root) {
    const failures = [];
    let imageCount = 0;
    const directories = new Set([
        ...globSync('docs/*/images/*.png', { cwd: root }).map(dirname),
        ...globSync('docs/*/images/README.md', { cwd: root }).map(dirname),
    ]);

    for (const directory of directories) {
        const images = [...globSync(`${directory}/*.png`, { cwd: root })];
        imageCount += images.length;
        const inventoryPath = join(root, directory, 'README.md');
        const ledgerPath = join(root, directory, 'live-captures.json');
        if (!existsSync(inventoryPath) || !existsSync(ledgerPath)) {
            failures.push(
                `${directory}: missing image inventory or capture ledger`,
            );
            continue;
        }
        const inventory = readFileSync(inventoryPath, 'utf8');
        let ledger;
        try {
            ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
        } catch {
            failures.push(`${directory}: invalid capture ledger JSON`);
            continue;
        }
        if (
            !ledger ||
            typeof ledger !== 'object' ||
            !(ledger.captures ?? ledger.pages) ||
            typeof (ledger.captures ?? ledger.pages) !== 'object'
        ) {
            failures.push(`${directory}: invalid capture ledger records`);
            continue;
        }
        const entries = ledger.captures
            ? Object.values(ledger.captures)
            : Object.values(ledger.pages ?? {}).flatMap((page) =>
                  page?.captures ? Object.values(page.captures) : [page],
              );
        const captured = new Set();
        for (const entry of entries) {
            const name = entry?.image;
            if (typeof name !== 'string' || !screenshotName.test(name)) {
                failures.push(`${directory}: invalid capture image name`);
                continue;
            }
            const label = `${directory}/${name}`;
            if (captured.has(name))
                failures.push(`${label}: duplicate capture entry`);
            captured.add(name);
            if (
                !existsSync(join(root, label)) ||
                !statSync(join(root, label)).isFile()
            ) {
                failures.push(`${label}: capture image is missing`);
                continue;
            }
            const image = readFileSync(join(root, label));
            if (
                image.length < 24 ||
                !image.subarray(0, 8).equals(pngSignature) ||
                image.toString('ascii', 12, 16) !== 'IHDR'
            ) {
                failures.push(`${label}: invalid PNG header`);
                continue;
            }
            const viewport =
                entry.captureRegion ?? entry.viewport ?? ledger.viewport;
            const scale =
                entry.deviceScaleFactor ??
                ledger.viewport?.deviceScaleFactor ??
                1;
            if (
                !viewport ||
                !Number.isFinite(viewport.width) ||
                viewport.width <= 0 ||
                !Number.isFinite(viewport.height) ||
                viewport.height <= 0 ||
                !Number.isFinite(scale) ||
                scale <= 0 ||
                image.readUInt32BE(16) !== viewport.width * scale ||
                image.readUInt32BE(20) !== viewport.height * scale
            ) {
                failures.push(
                    `${label}: PNG dimensions differ from capture viewport`,
                );
            }
            const hash = createHash('sha256').update(image).digest('hex');
            if (entry.imageSha256 !== hash) {
                failures.push(
                    `${label}: PNG checksum differs from capture ledger`,
                );
            }
        }
        for (const image of images) {
            const name = basename(image);
            const label = relative(root, join(root, image));
            if (!screenshotName.test(name)) {
                failures.push(
                    `${label}: use screenshotNN.<language>.png naming`,
                );
            }
            if (!inventory.includes(`](${name})`)) {
                failures.push(`${label}: missing from image inventory`);
            }
            if (!captured.has(name)) {
                failures.push(`${label}: missing from capture ledger`);
            }
        }
    }
    return { imageCount, failures };
}
