/**
 * @file src/source-editor/config/citation-template-data/generated/cite-thesis.ts
 * Purpose: src / config / citation template data / generated / cite thesis module.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Exports
 */

/**
 * Generated English-first Wikipedia TemplateData for cite thesis.
 * Chinese Wikipedia supplies additional ordering and fallback metadata.
 *
 * Run npm run update:template-data to refresh it.
 */

import type { CitationTemplateData } from '../types.ts';

const templateData: CitationTemplateData = {
    aliases: {
        last: ['last1', 'surname', 'surname1', 'author', 'author1'],
        first: ['first1', 'given', 'given1'],
        title: [],
        date: [],
        'access-date': ['accessdate'],
        degree: ['type'],
        publisher: [],
        url: [],
        'url-access': [],
        place: [],
        isbn: [],
        doi: [],
        'doi-broken-date': [],
        'doi-access': [],
        language: [],
        format: [],
        oclc: [],
        page: [],
        pages: [],
        at: [],
        'no-pp': [],
        chapter: ['contribution', 'entry', 'article', 'section'],
        'archive-url': ['archiveurl'],
        'archive-date': ['archivedate'],
        'trans-title': [],
        quote: [],
        'trans-quote': [],
        'script-title': [],
        'author-link': [],
    },
    dateParams: ['date', 'access-date', 'doi-broken-date', 'archive-date'],
    paramOrder: [
        'last',
        'first',
        'author-link',
        'title',
        'date',
        'access-date',
        'degree',
        'publisher',
        'url',
        'url-access',
        'place',
        'isbn',
        'doi',
        'doi-broken-date',
        'doi-access',
        'language',
        'format',
        'oclc',
        'page',
        'pages',
        'at',
        'no-pp',
        'chapter',
        'archive-url',
        'archive-date',
        'trans-title',
        'quote',
        'trans-quote',
        'script-title',
        'author',
        'location',
        'year',
        'url-status',
        'id',
        'ref',
    ],
};

export default templateData;
