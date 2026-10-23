/**
 * @file tests/vg-stub-creator/public-api.test.ts
 * Purpose: Verifies side-effect-free public exports and title-move contracts.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import type { EditSummaryMetadata } from '../../src/vg-stub-creator/index.ts';

test('public operations import without MediaWiki or browser globals', async () => {
    assert.equal('mw' in globalThis, false);
    assert.equal('window' in globalThis, false);
    const api = await import('../../src/vg-stub-creator/index.ts');
    const metadata: EditSummaryMetadata = {
        displayName: '星海',
        year: '2024',
        proseSinographs: 125,
        enwikiTitle: 'Star Harbor (video game)',
        wikidataId: 'Q12345',
    };
    const summary = api.buildEditSummary(metadata);
    assert.match(summary, /2024 video game «星海»/u);
    assert.match(summary, /125 equivalent sinographs/u);
    assert.ok(
        summary.endsWith(
            ' [[m:User:For_Each_..._Next/global.js/create_vg_stub.js|🎮]]',
        ),
    );
    assert.equal(
        api.buildLinkText('星海', 'Star Harbor'),
        '[[星海|Star Harbor]]',
    );
    assert.equal(
        api.buildTemplateText('Infobox VG', [
            ['title', '星海'],
            ['english', 'Star Harbor'],
        ]),
        '{{Infobox VG|title=星海|english=Star Harbor}}',
    );
    assert.deepEqual(api.splitFieldValues('Nintendo; Example Studio'), [
        'Nintendo',
        'Example Studio',
    ]);
    assert.equal('mw' in globalThis, false);
    assert.equal('window' in globalThis, false);
});

test('the public moved-title operation retains its flat fragment contract', async () => {
    const { updateMovedTitleText } =
        await import('../../src/vg-stub-creator/index.ts');
    const current = {
        name: '旧名',
        leadNameText: "《'''旧名'''》",
        infoboxText: '{{Infobox VG\n| title = 旧名\n}}',
        defaultSortText: '{{DEFAULTSORT:Old}}',
    };
    const target = {
        name: '新名',
        leadNameText: "《'''新名'''》",
        infoboxText: '{{Infobox VG\n| title = 新名\n}}',
        defaultSortText: '{{DEFAULTSORT:New}}',
    };
    const text = `${current.infoboxText}\n${current.leadNameText}保留手写内容。\n${current.defaultSortText}`;
    assert.equal(
        updateMovedTitleText(text, current, target),
        `${target.infoboxText}\n${target.leadNameText}保留手写内容。\n${target.defaultSortText}`,
    );
    assert.equal(
        updateMovedTitleText(
            "《'''旧名'''》（手写说明）保留内容。",
            {
                ...current,
                name: '',
                form: { name: '旧名' },
                leadNameText: '原有片段已经改动',
            },
            target,
        ),
        "《'''新名'''》保留内容。",
    );
});
