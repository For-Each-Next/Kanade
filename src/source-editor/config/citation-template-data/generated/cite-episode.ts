/**
 * @file src/source-editor/config/citation-template-data/generated/cite-episode.ts
 * Purpose: src / config / citation template data / generated / cite episode module.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Exports
 */

/**
 * Generated English-first Wikipedia TemplateData for cite episode.
 * Chinese Wikipedia supplies additional ordering and fallback metadata.
 *
 * Run npm run update:template-data to refresh it.
 */

import type { CitationTemplateData } from '../types.ts';

const templateData: CitationTemplateData = {
    aliases: {
        title: [],
        'episode-link': [],
        url: ['URL'],
        'access-date': [],
        series: [],
        'series-link': [],
        last: [
            'last1',
            'author',
            'author1',
            'author1-last',
            'author-last',
            'surname1',
            'author-last1',
            'subject1',
            'surname',
            'author-last',
            'subject',
        ],
        first: [
            'given',
            'author-first',
            'first1',
            'given1',
            'author-first1',
            'author1-first',
        ],
        'author-link': [
            'subject-link',
            'author-link1',
            'author1-link',
            'subject-link1',
            'subject1-link',
        ],
        last2: ['author2'],
        first2: [],
        'author-link2': ['author2-link'],
        network: [],
        station: [],
        date: ['airdate'],
        season: [],
        'series-no': ['series-number'],
        number: [],
        minutes: [],
        time: [],
        transcript: [],
        'transcript-url': [],
        quote: [],
        'trans-quote': [],
        via: [],
        language: [],
        'archive-url': [],
        'url-status': [],
        'archive-date': [],
        year: [],
        'trans-title': [],
    },
    dateParams: ['archive-date'],
    paramOrder: [
        'title',
        'episode-link',
        'url',
        'series',
        'series-link',
        'last',
        'first',
        'author-link',
        'last2',
        'first2',
        'author-link2',
        'network',
        'station',
        'date',
        'year',
        'season',
        'series-no',
        'number',
        'minutes',
        'time',
        'transcript',
        'transcript-url',
        'quote',
        'trans-title',
        'trans-quote',
        'via',
        'language',
        'access-date',
        'url-status',
        'archive-url',
        'archive-date',
    ],
};

export default templateData;
