/**
 * @file tests/source-editor/source-identity.test.ts
 * Purpose: Citation source identity and stale-editor safety.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 * 3. assertReferenceCounts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { formatCitations } from '../../src/source-editor/index.ts';
import {
    listExistingSources,
    replaceExistingSource,
    StaleSourceError,
} from '../../src/source-editor/domain/source-manager.ts';

test('uses one container and distinct IDs for repeated section titles', () => {
    const source = [
        'Lead.<ref name="A">' +
            '{{cite web|last=Alpha|date=2020|title=A}}</ref>',
        '== Repeat ==',
        'First.<ref name="B">' +
            '{{cite web|last=Beta|date=2021|title=B}}</ref>',
        '== Repeat ==',
        'Second.<ref name="C">' +
            '{{cite web|last=Gamma|date=2022|title=C}}</ref>',
        '<references />',
        '<references />',
    ].join('\n');
    const result = formatCitations(source);

    assert.equal(result.text.match(/<references responsive>/gu)?.length, 1);
    assert.equal(result.text.match(/<references/gu)?.length, 1);
    assert.ok(result.text.indexOf('§ 0    Lead') >= 0);
    assert.ok(
        result.text.indexOf('§ 1    Repeat') <
            result.text.indexOf('§ 2    Repeat'),
    );
    for (const name of ['Alpha, 2020', 'Beta, 2021', 'Gamma, 2022']) {
        const definition = new RegExp(`<ref name="${name}">`, 'gu');
        assert.equal(result.text.match(definition)?.length, 1);
    }
    assertReferenceCounts(result);
});

function assertReferenceCounts(
    result: ReturnType<typeof formatCitations>,
): void {
    assert.deepEqual(
        {
            citationsFormatted: result.citationsFormatted,
            individualReferencesFound: result.individualReferencesFound,
            referenceCallsFound: result.referenceCallsFound,
            referenceTagsRenamed: result.referenceTagsRenamed,
            referencesMoved: result.referencesMoved,
        },
        {
            citationsFormatted: 3,
            individualReferencesFound: 3,
            referenceCallsFound: 3,
            referenceTagsRenamed: 3,
            referencesMoved: 3,
        },
    );
}

test('source list, edit, and reparse preserve usage identity', () => {
    const source = [
        'Lead.<ref name="A" />',
        '== Repeat ==',
        'First.<ref name="A" />',
        '== Repeat ==',
        'Second.<ref name="A" />',
        '<references><ref name="A">' +
            '{{cite web|title=Old|url=https://example.test}}</ref>' +
            '</references>',
    ].join('\n');
    const [listed] = listExistingSources(source);
    const title = listed?.draft.rows.find((row) => row.name === 'title');

    assert.ok(listed);
    assert.ok(title);
    assert.deepEqual(listed.sectionIds, ['0', '1', '2']);
    assert.equal(listed.usageCount, 3);
    title.value = 'New';

    const edited = replaceExistingSource(
        source,
        listed,
        listed.draft,
        'inline',
    );
    const [reparsed] = listExistingSources(edited);

    assert.ok(reparsed);
    assert.equal(reparsed.id, listed.id);
    assert.equal(reparsed.title, 'New');
    assert.equal(reparsed.usageCount, 3);
    assert.deepEqual(reparsed.sectionIds, ['0', '1', '2']);
    assert.throws(
        () => replaceExistingSource(`prefix${source}`, listed, listed.draft),
        StaleSourceError,
    );
});
