/**
 * @file scripts/source-editor/fetch-preview-source.mjs
 * Purpose: Record real Wikipedia article text for documentation link previews.
 * Contents: Read-only summary download and attributed capture snapshots.
 */

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const origin = 'https://zh.wikipedia.org';
const title = '任天堂Switch';
const endpoint = `${origin}/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
const fixtures = new URL(
    '../../tests/source-editor/fixtures/',
    import.meta.url,
);
const execFileAsync = promisify(execFile);
const { stdout } = await execFileAsync(
    'curl',
    [
        '--fail',
        '--location',
        '--connect-timeout',
        '15',
        '--max-time',
        '60',
        '--silent',
        '--show-error',
        '--user-agent',
        'SourceEditorDocumentation/0.1.0 (read-only article preview capture)',
        endpoint,
    ],
    { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 },
);
const summary = JSON.parse(stdout);
assert.equal(typeof summary.title, 'string');
assert.equal(typeof summary.extract, 'string');
assert.ok(summary.title.trim() && summary.extract.trim());
assert.ok(Number.isSafeInteger(summary.pageid) && summary.pageid > 0);
assert.match(String(summary.revision), /^\d+$/u);
assert.ok(Number.isFinite(Date.parse(summary.timestamp)));

const snapshot = `${JSON.stringify(summary, null, 4)}\n`;
const sourceUrl = new URL('/w/index.php', origin);
sourceUrl.searchParams.set('title', summary.title);
sourceUrl.searchParams.set('oldid', String(summary.revision));
const historyUrl = new URL('/w/index.php', origin);
historyUrl.searchParams.set('title', summary.title);
historyUrl.searchParams.set('action', 'history');
const provenance = {
    title: summary.title,
    pageid: summary.pageid,
    revid: Number(summary.revision),
    timestamp: summary.timestamp,
    fetchedAt: new Date().toISOString(),
    endpoint,
    sourceUrl: sourceUrl.href,
    historyUrl: historyUrl.href,
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    descriptionSource: summary.description_source,
    wikibaseItem: summary.wikibase_item,
    summaryFile: 'nintendo-switch.summary.json',
    summarySha256: createHash('sha256').update(snapshot).digest('hex'),
    description:
        'Unchanged Wikipedia Page Content Service response. Documentation captures serve this recorded article text in every interface locale. No article media are downloaded.',
};
await writeFile(new URL('nintendo-switch.summary.json', fixtures), snapshot);
await writeFile(
    new URL('nintendo-switch.source.json', fixtures),
    `${JSON.stringify(provenance, null, 4)}\n`,
);
console.log(
    `Recorded ${summary.title} revision ${summary.revision} in ${fileURLToPath(fixtures)}.`,
);
