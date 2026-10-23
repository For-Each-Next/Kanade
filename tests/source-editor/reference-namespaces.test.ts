/**
 * @file tests/source-editor/reference-namespaces.test.ts
 * Purpose: Tests current-wiki Template namespaces.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { decodeNamespaceCatalog } from '../../src/library/wiki-titles/wikipedia.ts';
import { citationTemplateData } from '../../src/source-editor/config/citation-template-data/index.ts';
import {
    findUsedCitationTemplates,
    formatCitationWikitext,
} from '../../src/source-editor/domain/citation-formatter.ts';
import { findNameOverrideFields } from '../../src/source-editor/domain/manager.ts';
import {
    listExistingSources,
    parseSourceDraft,
} from '../../src/source-editor/domain/source-manager.ts';
import {
    createTemplateNameContext,
    isCitationTemplate,
    normalizeTemplateName,
} from '../../src/source-editor/domain/templates.ts';
import * as namespaceInfra from '../../src/source-editor/platform/mediawiki/template-namespaces.ts';

const GERMAN_SITEINFO = {
    query: {
        namespacealiases: [{ alias: 'Schablone', id: 10 }],
        namespaces: {
            0: { id: 0, name: '' },
            2: { canonical: 'User', id: 2, name: 'Benutzer' },
            10: { canonical: 'Template', id: 10, name: 'Vorlage' },
        },
    },
};

const germanTemplateNames = createTemplateNameContext(
    decodeNamespaceCatalog('dewiki', GERMAN_SITEINFO),
);
const englishTemplateNames = createTemplateNameContext('enwiki');
const chineseTemplateNames = createTemplateNameContext('zhwiki');

test('English and Chinese Wikipedias use static catalogs', async () => {
    for (const databaseName of ['enwiki', 'zhwiki']) {
        let requests = 0;
        const resolver =
            namespaceInfra.createTemplateNameContextResolver(databaseName);
        const context = await resolver.load({
            async get() {
                requests += 1;
                return {};
            },
        });

        assert.equal(requests, 0);
        assert.equal(context.namespaceSource, databaseName);
        assert.equal(resolver.current(), context);
    }
});

test('other wikis load and memoize Template namespace siteinfo', async () => {
    let request: Record<string, unknown> | undefined;
    let requests = 0;
    const resolver = namespaceInfra.createTemplateNameContextResolver('dewiki');
    const api = {
        async get(parameters: Record<string, unknown>) {
            request = parameters;
            requests += 1;
            return GERMAN_SITEINFO;
        },
    };

    const first = resolver.load(api);
    const second = resolver.load(api);
    assert.equal(first, second);
    const context = await first;

    assert.deepEqual(request, {
        action: 'query',
        formatversion: 2,
        meta: 'siteinfo',
        siprop: 'namespaces|namespacealiases',
    });
    assert.equal(requests, 1);
    assert.equal(
        normalizeTemplateName('Vorlage:Cite web', context),
        'cite web',
    );
    assert.equal(
        normalizeTemplateName('Schablone:Cite web', context),
        'cite web',
    );
    assert.equal(await resolver.load(api), context);
    assert.equal(requests, 1);
});

test('siteinfo failures retain a retryable fallback', async () => {
    let requests = 0;
    const resolver =
        namespaceInfra.createTemplateNameContextResolver('brokenwiki');
    const api = {
        async get() {
            requests += 1;
            throw new Error('offline');
        },
    };

    const first = await resolver.load(api);
    const second = await resolver.load(api);

    assert.equal(requests, 2);
    assert.equal(first.namespaceSource, null);
    assert.equal(second, first);
    assert.equal(isCitationTemplate('Template:Cite web', second), true);
    assert.equal(isCitationTemplate('模板:Cite web', second), false);
    assert.equal(isCitationTemplate('TM:Cite web', second), false);
});

test('static namespace aliases stay scoped to their wiki', () => {
    assert.equal(isCitationTemplate('TM:Cite web', englishTemplateNames), true);
    assert.equal(isCitationTemplate('T:Cite web', englishTemplateNames), false);
    assert.equal(
        isCitationTemplate('模板:Cite web', englishTemplateNames),
        false,
    );
    assert.equal(isCitationTemplate('T:Cite web', chineseTemplateNames), true);
    assert.equal(
        isCitationTemplate('模板:Cite web', chineseTemplateNames),
        true,
    );
    assert.equal(
        isCitationTemplate('TM:Cite web', chineseTemplateNames),
        false,
    );
});

test('localized Template aliases flow through citation operations', () => {
    const source = [
        'Text.<ref>{{Vorlage:Cite web|author=早坂|title=Example|',
        'url=https://example.test}}</ref>',
        '<references />',
    ].join('\n');

    assert.deepEqual(findUsedCitationTemplates(source, germanTemplateNames), [
        'cite web',
    ]);
    assert.equal(
        parseSourceDraft(
            '{{Schablone:Cite web|title=Example}}',
            germanTemplateNames,
        ).template,
        'cite web',
    );
    assert.equal(
        listExistingSources(source, germanTemplateNames)[0]?.status,
        'standard',
    );
    assert.equal(
        findNameOverrideFields(source, germanTemplateNames)[0]?.displayValue,
        '早坂',
    );

    const formatted = formatCitationWikitext(
        source,
        citationTemplateData,
        'inline',
        'Lead',
        germanTemplateNames,
    );
    assert.match(formatted.text, /\{\{Cite web \|/u);
    assert.equal(formatted.citationsFormatted, 1);
});

test('localized bibliography citations support short footnotes', () => {
    const source = [
        'Text {{sfn|Ma|2025}}.',
        '* {{Vorlage:Cite book|last=Ma|year=2025|title=Example}}',
    ].join('\n');
    const sources = listExistingSources(source, germanTemplateNames);

    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.referenceKind, 'short-footnote');
    assert.equal(sources[0]?.draft.template, 'cite book');
});

test('localized Reflist containers stay scoped during formatting', () => {
    const source = [
        '{{Vorlage:Reflist|refs=',
        '<ref name="example">{{Vorlage:Cite web|title=Example|',
        'url=https://example.test}}</ref>',
        '}}',
    ].join('\n');

    const result = formatCitationWikitext(
        source,
        citationTemplateData,
        'inline',
        'Lead',
        germanTemplateNames,
    );

    assert.doesNotMatch(result.text, /Vorlage:Reflist/iu);
    assert.equal(result.text.match(/<references\b/gu)?.length, 1);
    assert.equal(result.text.match(/<\/references>/gu)?.length, 1);
    assert.equal(result.citationsFormatted, 1);
});

test('non-Template namespace prefixes remain rejected', () => {
    const source = '<ref>{{Benutzer:Cite web|author=早坂|title=Example}}</ref>';

    assert.equal(
        isCitationTemplate('Benutzer:Cite web', germanTemplateNames),
        false,
    );
    assert.deepEqual(
        findUsedCitationTemplates(source, germanTemplateNames),
        [],
    );
    assert.equal(
        listExistingSources(source, germanTemplateNames)[0]?.status,
        'non-standard',
    );
    assert.deepEqual(findNameOverrideFields(source, germanTemplateNames), []);
});
