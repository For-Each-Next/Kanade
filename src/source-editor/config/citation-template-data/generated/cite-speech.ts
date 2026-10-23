/**
 * @file src/source-editor/config/citation-template-data/generated/cite-speech.ts
 * Purpose: src / config / citation template data / generated / cite speech module.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Exports
 */

/**
 * Generated English-first Wikipedia TemplateData for cite speech.
 * Chinese Wikipedia supplies additional ordering and fallback metadata.
 *
 * Run npm run update:template-data to refresh it.
 */

import type { CitationTemplateData } from '../types.ts';

const templateData: CitationTemplateData = {
    aliases: {
        last: [],
        first: [],
        'author-link': [],
        event: [],
        location: [],
        date: [],
        'access-date': [],
    },
    dateParams: ['date', 'access-date'],
    paramOrder: [
        'last',
        'first',
        'author-link',
        'event',
        'location',
        'date',
        'access-date',
    ],
};

export default templateData;
