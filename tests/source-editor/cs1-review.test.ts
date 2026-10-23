/**
 * @file tests/source-editor/cs1-review.test.ts
 * Purpose: Tests article-level attribution in the live CS1 review workflow.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 * 3. testHiddenMaintenanceAttribution
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { listExistingSources } from '../../src/source-editor/domain/source-manager.ts';
import { createCs1ReviewWorkflow } from '../../src/source-editor/app/workflows/cs1-review.ts';

test(
    'attributes hidden zhwiki maintenance to its citation',
    testHiddenMaintenanceAttribution,
);
async function testHiddenMaintenanceAttribution(): Promise<void> {
    const maintenance = '引文格式1维护：未识别语文类型';
    const sources = listExistingSources(
        [
            '<ref name="famitsu">{{cite magazine|' +
                'title=New Game Cross Review|language=Japanese}}</ref>',
            '<ref>{{cite web|title=Other|language=ja}}</ref>',
            '<ref>{{cite web|title=Bad|unknown=value}}</ref>',
        ].join(''),
    );
    const hiddenMaintenance = [
        '<span class="citation-comment" ',
        'style="display:none; color:#33aa33">',
        ` ${maintenance} (<a href="/wiki/Category:${maintenance}">link</a>)`,
        '</span>',
    ].join('');
    const informational =
        '<span class="citation-comment" style="color:#33aa33">' +
        'Informational</span>';
    const error =
        '<span class="error citation-comment">' +
        '已忽略未知参数<code>&#124;unknown=</code></span>';
    const workflow = createCs1ReviewWorkflow({
        buildCheckWikitext() {
            return 'batch';
        },
        async requestCheck() {
            return {
                categories: [maintenance],
                html: 'batch response',
            };
        },
        splitCheckHtml(_html, sourceCount) {
            assert.equal(sourceCount, 3);
            return [hiddenMaintenance, informational, error];
        },
    });

    const review = await workflow.checkArticleSources(sources, {
        pageTitle: '動感小子',
    });

    assert.deepEqual(review.messages, []);
    assert.deepEqual(
        review.sources.map((checked) => checked.source.title),
        ['Bad', 'New Game Cross Review', 'Other'],
    );
    assert.deepEqual(
        review.sources.map((checked) => checked.severity),
        ['error', 'maintenance', 'maintenance'],
    );
    assert.deepEqual(review.sources[1]?.messages, [maintenance]);
    assert.equal(review.sources[1]?.source.referenceName, 'famitsu');
    assert.deepEqual(
        workflow.restoreCheckedSource(
            review.sources[1]!.source,
            hiddenMaintenance,
            review.sources[1]!.messages,
        ),
        {
            html: hiddenMaintenance,
            messages: [maintenance],
            severity: 'maintenance',
            source: review.sources[1]!.source,
        },
    );
}
