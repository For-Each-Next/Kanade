/**
 * @file tests/source-editor/template-options.test.ts
 * Purpose: Tests citation-template selector tiers and important-template icons.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 * 3. assertDefinitionGroupsAreAlphabetical
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import * as templates from '../../src/source-editor/domain/templates.ts';
import {
    CITATION_TEMPLATE_DEFINITIONS,
    CITATION_TEMPLATE_OPTIONS,
    getSourceDraftTemplateOptions,
} from '../../src/source-editor/features/source-manager/template-options.ts';
import { cdxIconDie, cdxIconNewspaper } from '@wikimedia/codex-icons';

test('orders citation templates by group and alphabetically', () => {
    const expectedNames = CITATION_TEMPLATE_DEFINITIONS.map(
        (definition) => definition.name,
    );

    assert.deepEqual(
        CITATION_TEMPLATE_OPTIONS.map((option) => option.label),
        expectedNames,
    );
    assert.deepEqual(
        new Set(expectedNames),
        new Set(templates.SUPPORTED_CITATION_TEMPLATES),
    );
    assert.deepEqual(expectedNames.slice(0, 7), [
        'Cite interview',
        'Cite news',
        'Cite press release',
        'Cite book',
        'Cite magazine',
        'Cite video game',
        'Cite web',
    ]);
    assertDefinitionGroupsAreAlphabetical();
});

test('classifies video game as an important general medium', () => {
    const videoGame = CITATION_TEMPLATE_DEFINITIONS.find(
        (definition) => definition.name === 'Cite video game',
    );
    const interview = CITATION_TEMPLATE_DEFINITIONS.find(
        (definition) => definition.name === 'Cite interview',
    );
    const videoGameOption = CITATION_TEMPLATE_OPTIONS.find(
        (option) => option.label === 'Cite video game',
    );

    assert.equal(videoGame?.importance, 'important');
    assert.equal(videoGame?.type, 'general');
    assert.deepEqual(videoGameOption?.icon, cdxIconDie);
    assert.equal(interview?.type, 'special');
});

test('classifies tweet and AV media templates as normal special', () => {
    const normalTemplateNames = [
        'Cite tweet',
        'Cite AV media',
        'Cite AV media notes',
    ];

    for (const name of normalTemplateNames) {
        const definition = CITATION_TEMPLATE_DEFINITIONS.find(
            (candidate) => candidate.name === name,
        );
        const option = CITATION_TEMPLATE_OPTIONS.find(
            (candidate) => candidate.label === name,
        );

        assert.equal(definition?.importance, 'normal');
        assert.equal(definition?.type, 'special');
        assert.equal(option?.icon, undefined);
    }
});

test('shows icons only for important templates', () => {
    for (const definition of CITATION_TEMPLATE_DEFINITIONS) {
        const option = CITATION_TEMPLATE_OPTIONS.find(
            (candidate) => candidate.label === definition.name,
        );
        assert.equal(
            option?.icon != null,
            definition.importance === 'important',
        );
    }
});

test('uses a newspaper icon for Cite news', () => {
    const citeNews = CITATION_TEMPLATE_OPTIONS.find(
        (option) => option.label === 'Cite news',
    );

    assert.deepEqual(citeNews?.icon, cdxIconNewspaper);
});

test('offers an unknown Cite type only while editing that template', () => {
    const creationNames = CITATION_TEMPLATE_OPTIONS.map(
        (option) => option.value,
    );
    const genericDraftNames = getSourceDraftTemplateOptions(
        'cite Fan Guide',
    ).map((option) => option.value);
    const webDraftNames = getSourceDraftTemplateOptions('cite web').map(
        (option) => option.value,
    );

    assert.equal(creationNames.includes('Cite Fan Guide'), false);
    assert.equal(webDraftNames.includes('Cite Fan Guide'), false);
    assert.equal(genericDraftNames[0], 'Cite Fan Guide');
});

function assertDefinitionGroupsAreAlphabetical(): void {
    const groups = new Map<string, string[]>();
    for (const definition of CITATION_TEMPLATE_DEFINITIONS) {
        const key = `${definition.importance}:${definition.type}`;
        const names = groups.get(key) ?? [];
        names.push(definition.name);
        groups.set(key, names);
    }
    for (const names of groups.values()) {
        assert.deepEqual(
            names,
            names.toSorted((first, second) =>
                first.localeCompare(second, 'en-US'),
            ),
        );
    }
}
