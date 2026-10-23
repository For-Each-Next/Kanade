/**
 * @file src/source-editor/config/citation-template-data/generated/cite-citeseerx.ts
 * Purpose: src / config / citation template data / generated / cite citeseerx module.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Exports
 */

/**
 * Generated English-first Wikipedia TemplateData for cite citeseerx.
 * Chinese Wikipedia supplies additional ordering and fallback metadata.
 *
 * Run npm run update:template-data to refresh it.
 */

import type { CitationTemplateData } from '../types.ts';

const templateData: CitationTemplateData = {
    aliases: {
        citeseerx: [],
        title: [],
        first: ['first1', 'given', 'given1'],
        last: ['last1', 'surname', 'surname1'],
        author: ['author1'],
        'author-link': ['author-link1', 'author1-link'],
        first2: ['given2'],
        last2: ['surname2'],
        author2: [],
        'author-link2': ['authorlink2', 'author2-link', 'author2link'],
        collaboration: [],
        date: [],
        df: [],
        'trans-title': [],
        language: [],
    },
    dateParams: [],
    paramOrder: [
        'citeseerx',
        'author',
        'first',
        'last',
        'first2',
        'last2',
        'author2',
        'author-link',
        'author-link2',
        'title',
        'collaboration',
        'date',
        'df',
        'trans-title',
        'language',
    ],
};

export default templateData;
