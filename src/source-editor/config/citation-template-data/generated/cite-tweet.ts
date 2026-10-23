/**
 * @file src/source-editor/config/citation-template-data/generated/cite-tweet.ts
 * Purpose: src / config / citation template data / generated / cite tweet module.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Exports
 */

/**
 * Generated English-first Wikipedia TemplateData for cite tweet.
 * Chinese Wikipedia supplies additional ordering and fallback metadata.
 *
 * Run npm run update:template-data to refresh it.
 */

import type { CitationTemplateData } from '../types.ts';

const templateData: CitationTemplateData = {
    aliases: {
        number: [],
        user: [],
        title: [],
        author: [],
        'author-link': ['authorlink'],
        retweet: [],
        date: [],
        'access-date': ['accessdate'],
        language: [],
        location: [],
        'archive-url': ['archiveurl'],
        'archive-date': ['archivedate'],
        'url-status': [],
        'script-title': [],
        'trans-title': [],
        link: [],
        df: [],
        ref: [],
        quote: [],
        first: ['first1'],
        last: [],
    },
    dateParams: ['date', 'access-date', 'archive-date'],
    paramOrder: [
        'number',
        'user',
        'title',
        'first',
        'last',
        'author',
        'author-link',
        'retweet',
        'date',
        'access-date',
        'language',
        'location',
        'archive-url',
        'archive-date',
        'url-status',
        'script-title',
        'trans-title',
        'link',
        'df',
        'quote',
        'ref',
        'archiveurl',
        'archivedate',
    ],
};

export default templateData;
