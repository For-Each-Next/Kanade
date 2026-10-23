/**
 * @file tests/wpvg-assessor/archive-new-pages.test.ts
 * Purpose: Verify reviewed archiving, protected ordering, and recovery after partial saves.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. ArchiveHarness
 * 4. createHarness
 * 5. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createNewPageArchiveWorkflow } from '../../src/wpvg-assessor/app/archive-new-pages.ts';
import {
    ArchiveSaveError,
    type ArchivePageSnapshot,
    type ArchiveSavePhase,
    type NewPageArchivePorts,
} from '../../src/wpvg-assessor/app/archive-contracts.ts';
import type { NewPageListSnapshot } from '../../src/wpvg-assessor/domain/types.ts';

const SOURCE_TITLE = 'WikiProject:电子游戏/新进条目';
const ANNUAL_TITLE = `${SOURCE_TITLE}/2026年存档`;
const OLDER_ANNUAL_TITLE = `${SOURCE_TITLE}/2025年存档`;
const SOURCE_TEXT = [
    'Intro',
    '== 2026年 ==',
    '* 10月4日 - {{vgc|Keep}}',
    '* 8月4日 - {{vgc|August}}',
    '*:模板：{{vgc|Template:August}}',
    '* 7月31日 - {{vgc|July}}',
    'Footer',
    '',
].join('\n');
const api = {} as mw.Api;

interface ArchiveHarness {
    ports: NewPageArchivePorts;
    source: NewPageListSnapshot;
    pages: Map<string, ArchivePageSnapshot>;
    events: string[];
    writes: Array<{ title: string; text: string; summary: string }>;
    failure: { title: string; commit: boolean } | null;
    afterArchiveSave: ((title: string) => void) | null;
}

function createHarness(text = SOURCE_TEXT): ArchiveHarness {
    let revision = 1;
    const harness: ArchiveHarness = {
        ports: {} as NewPageArchivePorts,
        source: {
            text,
            revisionId: 1,
            basetimestamp: 'source-1',
            starttimestamp: 'query-1',
        },
        pages: new Map(),
        events: [],
        writes: [],
        failure: null,
        afterArchiveSave: null,
    };
    function destination(title: string): ArchivePageSnapshot {
        return (
            harness.pages.get(title) ?? {
                title,
                text: '',
                exists: false,
                revisionId: null,
                basetimestamp: null,
                starttimestamp: 'query-1',
            }
        );
    }
    function failure(title: string): void {
        if (harness.failure?.title === title) {
            throw new Error('The edit outcome was not confirmed.');
        }
    }
    harness.ports = {
        sourceTitle: SOURCE_TITLE,
        now: () => new Date('2026-10-04T23:00:00Z'),
        async fetchNewPageList() {
            harness.events.push(`read:${SOURCE_TITLE}`);
            return { ...harness.source };
        },
        async fetchPageText(_api, title) {
            harness.events.push(`read:${title}`);
            return { ...destination(title) };
        },
        async saveArchivePage(_api, snapshot, proposedText, summary) {
            harness.events.push(`write:${snapshot.title}`);
            harness.writes.push({
                title: snapshot.title,
                text: proposedText,
                summary,
            });
            assert.equal(snapshot.text, destination(snapshot.title).text);
            assert.equal(
                snapshot.basetimestamp,
                destination(snapshot.title).basetimestamp,
            );
            assert.equal(
                snapshot.revisionId,
                destination(snapshot.title).revisionId,
            );
            if (
                harness.failure?.title === snapshot.title &&
                !harness.failure.commit
            ) {
                failure(snapshot.title);
            }
            harness.pages.set(snapshot.title, {
                ...snapshot,
                text: proposedText,
                exists: true,
                basetimestamp: `archive-${++revision}`,
                revisionId: revision,
            });
            failure(snapshot.title);
            harness.afterArchiveSave?.(snapshot.title);
        },
        async savePreparedNewPageList(_api, snapshot, proposedText, summary) {
            harness.events.push(`write:${SOURCE_TITLE}`);
            harness.writes.push({
                title: SOURCE_TITLE,
                text: proposedText,
                summary,
            });
            if (snapshot.revisionId !== harness.source.revisionId) {
                throw Object.assign(
                    new Error('The reviewed source revision changed.'),
                    { code: 'editconflict' },
                );
            }
            assert.equal(snapshot.text, harness.source.text);
            assert.equal(snapshot.basetimestamp, harness.source.basetimestamp);
            if (
                harness.failure?.title === SOURCE_TITLE &&
                !harness.failure.commit
            ) {
                failure(SOURCE_TITLE);
            }
            harness.source = {
                ...snapshot,
                text: proposedText,
                basetimestamp: `source-${++revision}`,
                revisionId: revision,
            };
            failure(SOURCE_TITLE);
        },
    };
    return harness;
}

test('reviews multiple eligible months in one annual destination while preserving existing sections', async () => {
    const harness = createHarness();
    const existingJune = '=== 6月 ===\n* 6月3日 - {{vgc|Existing}}\n';
    const archiveLead = 'Archive intro\n== 2026年 ==\n';
    const archiveFooter = '\n== 參見 ==\nArchive footer\n';
    harness.pages.set(ANNUAL_TITLE, {
        title: ANNUAL_TITLE,
        text: archiveLead + existingJune + archiveFooter,
        exists: true,
        revisionId: 20,
        basetimestamp: 'archive-existing',
        starttimestamp: 'query-1',
    });
    const workflow = createNewPageArchiveWorkflow(harness.ports);
    const review = await workflow.open(api);

    assert.equal(review.cutoff, '2026-08-31');
    assert.equal(review.recordCount, 2);
    assert.equal(review.source.snapshot.text, SOURCE_TEXT);
    assert.match(review.source.proposedText, /10月4日/u);
    assert.doesNotMatch(review.source.proposedText, /8月4日|7月31日/u);
    assert.match(review.source.proposedText, /Intro[\s\S]*Footer/u);
    assert.equal(review.archives.length, 1);
    const annual = review.archives[0]!;
    assert.equal(annual.title, ANNUAL_TITLE);
    assert.deepEqual(annual.months, [8, 7]);
    assert.equal(annual.recordCount, 2);
    assert.match(
        annual.proposedText,
        /Archive intro[\s\S]*Existing[\s\S]*Archive footer/u,
    );
    assert.match(
        annual.proposedText,
        /=== 8月 ===[\s\S]*8月4日[\s\S]*Template:August[\s\S]*=== 7月 ===[\s\S]*7月31日[\s\S]*=== 6月 ===/u,
    );
    assert.ok(annual.proposedText.includes(existingJune));
    assert.ok(annual.proposedText.startsWith(archiveLead));
    assert.ok(annual.proposedText.endsWith(archiveFooter));
    assert.deepEqual(harness.events, [
        `read:${SOURCE_TITLE}`,
        `read:${ANNUAL_TITLE}`,
    ]);
    assert.equal(harness.writes.length, 0);
    assert.ok(Object.isFrozen(review));
    assert.ok(Object.isFrozen(review.source));
    assert.ok(Object.isFrozen(review.source.snapshot));
    assert.ok(Object.isFrozen(review.archives));
    for (const archive of review.archives) {
        assert.ok(Object.isFrozen(archive));
        assert.ok(Object.isFrozen(archive.snapshot));
    }
});

test('preflights every page and writes exact reviewed destinations before source', async () => {
    const harness = createHarness();
    const workflow = createNewPageArchiveWorkflow(harness.ports);
    const review = await workflow.open(api);
    harness.events.length = 0;
    const phases: ArchiveSavePhase[] = [];
    await workflow.save(api, review, 'Reviewed summary', (phase) =>
        phases.push(phase),
    );

    const firstWrite = harness.events.findIndex((event) =>
        event.startsWith('write:'),
    );
    assert.equal(firstWrite, 2);
    assert.deepEqual(
        harness.writes.map((write) => write.title),
        [...review.archives.map((archive) => archive.title), SOURCE_TITLE],
    );
    for (const archive of review.archives) {
        assert.equal(
            harness.pages.get(archive.title)?.text,
            archive.proposedText,
        );
    }
    assert.equal(harness.source.text, review.source.proposedText);
    assert.ok(
        harness.writes.every((write) => write.summary === 'Reviewed summary'),
    );
    assert.deepEqual(phases.at(-1), { kind: 'source', title: SOURCE_TITLE });
    await assert.rejects(
        workflow.save(api, review, 'Again', () => {}),
        {
            code: 'review-changed',
        },
    );
    assert.equal(harness.writes.length, 2);
});

test('refuses changed source text, timestamp, or revision before any writes', async () => {
    for (const change of ['text', 'timestamp', 'revision']) {
        const harness = createHarness();
        const workflow = createNewPageArchiveWorkflow(harness.ports);
        const review = await workflow.open(api);
        harness.source = {
            ...harness.source,
            ...(change === 'text'
                ? { text: `${SOURCE_TEXT}Concurrent` }
                : change === 'timestamp'
                  ? { basetimestamp: 'source-2' }
                  : { revisionId: 2 }),
        };
        await assert.rejects(
            workflow.save(api, review, 'Summary', () => {}),
            {
                code: 'review-changed',
                title: SOURCE_TITLE,
            },
        );
        assert.equal(harness.writes.length, 0);
    }
});

test('refuses an archive created after preview and reads all pages before failing', async () => {
    const harness = createHarness();
    const workflow = createNewPageArchiveWorkflow(harness.ports);
    const review = await workflow.open(api);
    harness.pages.set(ANNUAL_TITLE, {
        title: ANNUAL_TITLE,
        text: 'Concurrent archive',
        exists: true,
        revisionId: 20,
        basetimestamp: 'concurrent',
        starttimestamp: 'query-2',
    });
    harness.events.length = 0;
    await assert.rejects(
        workflow.save(api, review, 'Summary', () => {}),
        {
            code: 'review-changed',
            title: ANNUAL_TITLE,
        },
    );
    assert.equal(harness.events.length, 2);
    assert.equal(harness.writes.length, 0);
});

test('rejects fabricated reviews', async () => {
    const harness = createHarness();
    const workflow = createNewPageArchiveWorkflow(harness.ports);
    const review = await workflow.open(api);
    await assert.rejects(
        workflow.save(api, { ...review }, 'Summary', () => {}),
        {
            code: 'review-changed',
        },
    );
    assert.equal(harness.writes.length, 0);
});

test('stops after a failed annual destination and reload skips the confirmed earlier year', async () => {
    const original = `${SOURCE_TEXT}== 2025年 ==\n* 12月31日 - {{vgc|Prior year}}\n`;
    const harness = createHarness(original);
    const workflow = createNewPageArchiveWorkflow(harness.ports);
    const review = await workflow.open(api);
    const [first, second] = review.archives;
    assert.ok(first && second);
    assert.equal(first.title, ANNUAL_TITLE);
    assert.equal(second.title, OLDER_ANNUAL_TITLE);
    harness.failure = { title: second.title, commit: false };
    await assert.rejects(
        workflow.save(api, review, 'Summary', () => {}),
        (error) => {
            assert.ok(error instanceof ArchiveSaveError);
            assert.equal(error.title, second.title);
            assert.deepEqual(error.savedArchiveTitles, [first.title]);
            return true;
        },
    );
    assert.equal(harness.source.text, original);
    assert.deepEqual(
        harness.writes.map((write) => write.title),
        [first.title, second.title],
    );
    harness.failure = null;
    const recovered = await workflow.open(api);
    assert.equal(
        recovered.archives.find((archive) => archive.title === first.title)
            ?.proposedText,
        first.proposedText,
    );
    await workflow.save(api, recovered, 'Recovery', () => {});
    assert.deepEqual(
        harness.writes.slice(2).map((write) => write.title),
        [second.title, SOURCE_TITLE],
    );
    assert.equal(harness.source.text, review.source.proposedText);
});

test('reload handles an unconfirmed destination that actually saved without duplicating it', async () => {
    const harness = createHarness();
    const workflow = createNewPageArchiveWorkflow(harness.ports);
    const review = await workflow.open(api);
    const first = review.archives[0]!;
    harness.failure = { title: first.title, commit: true };
    await assert.rejects(
        workflow.save(api, review, 'Summary', () => {}),
        (error) => {
            assert.ok(error instanceof ArchiveSaveError);
            assert.deepEqual(error.savedArchiveTitles, []);
            return true;
        },
    );
    assert.equal(harness.source.text, SOURCE_TEXT);
    assert.equal(harness.writes.length, 1);
    harness.failure = null;
    const recovered = await workflow.open(api);
    const confirmed = recovered.archives.find(
        (archive) => archive.title === first.title,
    )!;
    assert.equal(confirmed.proposedText, confirmed.snapshot.text);
    await workflow.save(api, recovered, 'Recovery', () => {});
    assert.equal(
        harness.writes.filter((write) => write.title === first.title).length,
        1,
    );
});

test('source failure reports all confirmed archives and reload removes source without another append', async () => {
    const harness = createHarness();
    const workflow = createNewPageArchiveWorkflow(harness.ports);
    const review = await workflow.open(api);
    harness.failure = { title: SOURCE_TITLE, commit: false };
    await assert.rejects(
        workflow.save(api, review, 'Summary', () => {}),
        (error) => {
            assert.ok(error instanceof ArchiveSaveError);
            assert.deepEqual(
                error.savedArchiveTitles,
                review.archives.map((archive) => archive.title),
            );
            return true;
        },
    );
    assert.equal(harness.source.text, SOURCE_TEXT);
    harness.failure = null;
    const recovered = await workflow.open(api);
    await workflow.save(api, recovered, 'Recovery', () => {});
    assert.deepEqual(
        harness.writes.slice(2).map((write) => write.title),
        [SOURCE_TITLE],
    );
});

test('conflicting records in an existing archive prevent a save preview', async () => {
    const harness = createHarness();
    harness.pages.set(ANNUAL_TITLE, {
        title: ANNUAL_TITLE,
        text: '== 2026年 ==\n=== 8月 ===\n* 8月4日 - {{vgc|Different}}\n',
        exists: true,
        revisionId: 20,
        basetimestamp: 'archive-1',
        starttimestamp: 'query-1',
    });
    const workflow = createNewPageArchiveWorkflow(harness.ports);
    await assert.rejects(workflow.open(api), {
        code: 'archive-conflict',
        title: ANNUAL_TITLE,
    });
    assert.equal(harness.writes.length, 0);
});

test('an empty archive plan fetches no destinations and saves nothing', async () => {
    const harness = createHarness('== 2026年 ==\n* 10月4日 - {{vgc|Keep}}\n');
    const workflow = createNewPageArchiveWorkflow(harness.ports);
    const review = await workflow.open(api);
    assert.equal(review.recordCount, 0);
    assert.equal(review.archives.length, 0);
    await workflow.save(api, review, 'Summary', () => {});
    assert.equal(harness.writes.length, 0);
    assert.equal(harness.events.length, 1);
});

test('missing or invalid source revision IDs prevent preview creation', async () => {
    for (const revisionId of [undefined, 0, -1, 1.5, Number.NaN]) {
        const harness = createHarness();
        harness.source.revisionId = revisionId;
        const workflow = createNewPageArchiveWorkflow(harness.ports);
        await assert.rejects(workflow.open(api), {
            code: 'save-failed',
            title: SOURCE_TITLE,
        });
        assert.equal(harness.writes.length, 0);
        assert.equal(harness.events.length, 1);
    }
});

test('a destination revision change with identical text and timestamps fails preflight', async () => {
    const harness = createHarness();
    harness.pages.set(ANNUAL_TITLE, {
        title: ANNUAL_TITLE,
        text: 'Archive intro\n',
        exists: true,
        revisionId: 10,
        basetimestamp: 'same-time',
        starttimestamp: 'query-1',
    });
    const workflow = createNewPageArchiveWorkflow(harness.ports);
    const review = await workflow.open(api);
    harness.pages.set(ANNUAL_TITLE, {
        ...harness.pages.get(ANNUAL_TITLE)!,
        revisionId: 11,
    });
    await assert.rejects(
        workflow.save(api, review, 'Summary', () => {}),
        { code: 'review-changed', title: ANNUAL_TITLE },
    );
    assert.equal(harness.writes.length, 0);
});

test('an intervening source revision during destination writes keeps its content and reports saved archives', async () => {
    const harness = createHarness();
    const workflow = createNewPageArchiveWorkflow(harness.ports);
    const review = await workflow.open(api);
    const concurrentSource = `${SOURCE_TEXT}New registration from another tab\n`;
    harness.afterArchiveSave = () => {
        harness.source = {
            ...harness.source,
            revisionId: 99,
            text: concurrentSource,
        };
    };
    await assert.rejects(
        workflow.save(api, review, 'Summary', () => {}),
        (error) => {
            assert.ok(error instanceof ArchiveSaveError);
            assert.equal(error.title, SOURCE_TITLE);
            assert.deepEqual(
                error.savedArchiveTitles,
                review.archives.map((archive) => archive.title),
            );
            assert.equal(
                (error.cause as Error & { code?: string }).code,
                'editconflict',
            );
            return true;
        },
    );
    assert.equal(harness.source.text, concurrentSource);
});
