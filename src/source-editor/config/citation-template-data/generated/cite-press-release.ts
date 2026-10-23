/**
 * @file src/source-editor/config/citation-template-data/generated/cite-press-release.ts
 * Purpose: src / config / citation template data / generated / cite press release module.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Exports
 */

/**
 * Generated English-first Wikipedia TemplateData for cite press release.
 * Chinese Wikipedia supplies additional ordering and fallback metadata.
 *
 * Run npm run update:template-data to refresh it.
 */

import type { CitationTemplateData } from '../types.ts';

const templateData: CitationTemplateData = {
    aliases: {
        title: [],
        date: [],
        publisher: [],
        location: [],
        url: [],
        quote: [],
        ref: [],
        language: [],
        via: [],
        last1: ['last'],
        first1: ['first'],
        last2: [],
        first2: [],
        last3: [],
        first3: [],
        'access-date': [],
        'url-status': [],
        'archive-url': [],
        'archive-date': [],
        'trans-title': [],
        'author-link1': ['author1-link', 'author-link'],
        'author-link2': ['author2-link'],
        'author-link3': ['author3-link'],
        page: [],
        pages: [],
        at: [],
        type: [],
        df: [],
        'trans-quote': [],
        id: [],
    },
    dateParams: ['date', 'archive-date'],
    paramOrder: [
        'title',
        'date',
        'publisher',
        'page',
        'pages',
        'location',
        'df',
        'url',
        'quote',
        'ref',
        'language',
        'via',
        'last1',
        'first1',
        'last2',
        'first2',
        'last3',
        'first3',
        'access-date',
        'url-status',
        'archive-url',
        'archive-date',
        'trans-title',
        'trans-quote',
        'author-link1',
        'author-link2',
        'author-link3',
        'at',
        'id',
        'type',
        'last',
        'first',
        'author',
        'author2',
        'author3',
        'author-link',
    ],
};

export default templateData;
