/**
 * @file tests/vg-stub-creator/new-page-list.test.ts
 * Purpose: Keeps Creator's registration syntax and guarded write behavior stable.
 * Contents: Date-separator compatibility through the registration adapter.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { registerNewPage } from '../../src/vg-stub-creator/platform/mediawiki/new-page-list.ts';

test('registration retains its literal-space date separator when sharing insertion rules', async () => {
    const text = [
        'Intro',
        '== 2026年 ==',
        '* 7月29日 -{{vgc|No space}}',
        '* 7月28日 - {{vgc|Earlier}}',
        '',
    ].join('\n');
    const writes: Array<Record<string, unknown>> = [];
    const api = {
        async get() {
            return {
                curtimestamp: '2026-07-29T12:00:00Z',
                query: {
                    pages: [
                        {
                            title: 'Wikipedia:遊戲專題/新條目',
                            revisions: [
                                {
                                    timestamp: '2026-07-29T11:00:00Z',
                                    slots: { main: { content: text } },
                                },
                            ],
                        },
                    ],
                },
            };
        },
        async postWithToken(
            token: string,
            parameters: Record<string, unknown>,
        ) {
            assert.equal(token, 'csrf');
            writes.push(parameters);
        },
    };

    await registerNewPage(api, 'New', [], new Date('2026-07-29T12:00:00Z'));
    assert.equal(writes.length, 1);
    assert.equal(
        writes[0].text,
        text.replace('* 7月28日', '* 7月29日 - {{vgc|New}}\n* 7月28日'),
    );
    assert.equal(writes[0].basetimestamp, '2026-07-29T11:00:00Z');
    assert.equal(writes[0].starttimestamp, '2026-07-29T12:00:00Z');
    assert.equal(writes[0].nocreate, true);
});
