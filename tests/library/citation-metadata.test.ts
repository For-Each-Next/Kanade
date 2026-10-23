/**
 * @file tests/library/citation-metadata.test.ts
 * Purpose: Keep both metadata consumers on the same CS1 template selection.
 * Contents: Supported Zotero item types and the web-template fallback.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { getCitationTemplateName } from '../../src/library/citation-metadata/templates.ts';

test('maps supported Zotero types and retains the web fallback', () => {
    for (const [itemType, template] of [
        ['journalArticle', 'cite journal'],
        ['book', 'cite book'],
        ['bookSection', 'cite book'],
        ['newspaperArticle', 'cite news'],
        ['magazineArticle', 'cite news'],
        ['webpage', 'cite web'],
        ['unknown', 'cite web'],
        ['', 'cite web'],
    ]) {
        assert.equal(getCitationTemplateName(itemType), template);
    }
});
