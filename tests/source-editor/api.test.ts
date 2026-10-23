/**
 * @file tests/source-editor/api.test.ts
 * Purpose: Tests the side-effect-free Source Editor entry point.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    findNameOverrideFields,
    findUsedCitationTemplates,
    findUsedMetadataFreeCitationTemplates,
    formatCitations,
    formatCitationWikitext,
    manageCitations,
    manageCitationsWithResult,
    normalizeEnglishDate,
    resolveWikiPolicy,
} from '../../src/source-editor/index.ts';

test('exports every supported operation without a browser', () => {
    const functions = [
        findNameOverrideFields,
        findUsedCitationTemplates,
        findUsedMetadataFreeCitationTemplates,
        formatCitations,
        formatCitationWikitext,
        manageCitations,
        manageCitationsWithResult,
        normalizeEnglishDate,
    ];

    assert.ok(functions.every((value) => typeof value === 'function'));
});

test('formats text through the package entry point', () => {
    const source =
        '<ref name="Example">{{cite web|title=Example|' +
        'date=January 2, 2025}}</ref>';
    const result = formatCitations(
        source,
        'inline',
        'Lead',
        {},
        undefined,
        false,
        resolveWikiPolicy('enwiki'),
    );

    assert.match(result.text, /date = 2025-01-02/u);
    assert.deepEqual(findUsedCitationTemplates(source), ['cite web']);
    assert.deepEqual(
        findUsedMetadataFreeCitationTemplates(
            `${source}<!-- {{cite hidden}} --><ref>{{Cite fan guide}}</ref>`,
        ),
        ['Cite fan guide'],
    );
    assert.equal(normalizeEnglishDate('January 2, 2025'), '2025-01-02');
});

test('forwards the reference-definition spacing option through formatting and manager operations', () => {
    const source = [
        'A.<ref>{{cite web|author=First|date=2020|title=First}}</ref>',
        'B.<ref>{{cite web|author=Second|date=2021|title=Second}}</ref>',
        'C.<ref>{{cite web|author=Third|date=2022|title=Third}}</ref>',
    ].join('\n');
    for (const layout of ['inline', 'block'] as const) {
        const defaultResult = formatCitations(source, layout);
        const enabled = formatCitations(
            source,
            layout,
            'Lead',
            {},
            undefined,
            true,
        );
        const managed = manageCitationsWithResult(source, [], false, layout, {
            separateReferenceDefinitions: true,
        });
        assert.equal(managed.text, enabled.text);
        assert.match(managed.text, /<\/ref>\n\n<ref name="Second, 2021">/u);
        assert.match(defaultResult.text, /<\/ref>\n<ref name="Second, 2021">/u);
        assert.equal(
            manageCitationsWithResult(source, [], false, layout, {
                separateReferenceDefinitions: false,
            }).text,
            defaultResult.text,
        );
        assert.equal(
            manageCitationsWithResult(enabled.text, [], false, layout, {
                separateReferenceDefinitions: true,
            }).text,
            enabled.text,
        );
    }
});
