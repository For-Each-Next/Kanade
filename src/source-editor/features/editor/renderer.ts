/**
 * @file src/source-editor/features/editor/renderer.ts
 * Purpose: Renders highlighted source using text nodes exclusively.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. renderSegments
 * 4. createHighlightedFragment
 * 5. appendHighlightedSegments
 * 6. getEntityTitle
 * 7. decodeCharacterReference
 * 8. markLinkCheck
 */

import {
    type HighlightOptions,
    highlightWikitext,
} from '../../../library/wikitext-highlighting/highlighter.ts';
import { classifyLinkCheck, type LinkCheckState } from './feature-settings.ts';

import { DEFAULT_SOURCE_EDITOR_OPTIONS } from '../../domain/runtime-options.ts';

export function renderSegments(
    editor: HTMLElement,
    source: string,
    linkCheckState: LinkCheckState,
    options: HighlightOptions,
    enabled: boolean,
    limit = DEFAULT_SOURCE_EDITOR_OPTIONS.maxLiveHighlightLength,
): void {
    const target = editor.ownerDocument;
    const fragment =
        !enabled || source.length > limit
            ? target.createDocumentFragment()
            : createHighlightedFragment(
                  target,
                  source,
                  linkCheckState,
                  options,
              );
    if (!enabled || source.length > limit) {
        fragment.append(target.createTextNode(source));
    }
    // Keep a trailing empty line available to the browser's native caret.
    if (source.endsWith('\n')) fragment.append(target.createElement('br'));
    editor.replaceChildren(fragment);
}

/** Shared source rendering for the editor and reference field values. */
export function createHighlightedFragment(
    target: Document,
    source: string,
    linkCheckState: LinkCheckState,
    options: HighlightOptions,
): DocumentFragment {
    const fragment = target.createDocumentFragment();
    appendHighlightedSegments(
        target,
        fragment,
        highlightWikitext(source, options),
        linkCheckState,
    );
    return fragment;
}

function appendHighlightedSegments(
    target: Document,
    fragment: DocumentFragment,
    segments: ReturnType<typeof highlightWikitext>,
    linkCheckState: LinkCheckState,
): void {
    for (const segment of segments) {
        if (segment.classNames.length === 0) {
            fragment.append(target.createTextNode(segment.text));
            continue;
        }
        const span = target.createElement('span');
        span.className = segment.classNames.join(' ');
        span.textContent = segment.text;
        if (segment.entity != null) {
            const title = getEntityTitle(segment.entity);
            if (title != null) {
                span.title = title;
            }
        } else {
            const title = segment.classNames
                .map((className) => SPECIAL_CHARACTER_TITLES[className])
                .find((value) => value != null);
            if (title != null) {
                span.title = title;
            }
        }
        if (segment.href != null) {
            span.dataset.kanadeSourceEditorHref = segment.href;
        }
        if (segment.pagePreview != null) {
            span.dataset.kanadeSourceEditorPagePreviewTitle =
                segment.pagePreview.title;
            span.dataset.kanadeSourceEditorPagePreviewWiki =
                segment.pagePreview.wiki;
        }
        if (segment.missingTitle != null) {
            markLinkCheck(span, segment.missingTitle, linkCheckState);
        }
        if (segment.referenceSource != null) {
            span.dataset.kanadeSourceEditorReference = segment.referenceSource;
            if (segment.referenceStart != null) {
                span.dataset.kanadeSourceEditorReferenceStart = String(
                    segment.referenceStart,
                );
            }
        }
        fragment.append(span);
    }
}

const SPECIAL_CHARACTER_TITLES: Readonly<Record<string, string>> = {
    'kanade-source-editor-token--tab': 'U+0009 (tab)',
    'kanade-source-editor-token--en-space': 'U+2002 (en space)',
    'kanade-source-editor-token--em-space': 'U+2003 (em space)',
    'kanade-source-editor-token--thin-space': 'U+2009 (thin space)',
    'kanade-source-editor-token--ideographic-space':
        'U+3000 (ideographic space)',
    'kanade-source-editor-token--soft-hyphen': 'U+00AD (soft hyphen)',
    'kanade-source-editor-token--figure-dash': 'U+2012 ‒ (figure dash)',
    'kanade-source-editor-token--en-dash': 'U+2013 – (en dash)',
    'kanade-source-editor-token--em-dash': 'U+2014 — (em dash)',
    'kanade-source-editor-token--horizontal-bar': 'U+2015 ― (horizontal bar)',
    'kanade-source-editor-token--minus-sign': 'U+2212 − (minus sign)',
};

function getEntityTitle(reference: string): string | null {
    const rendered = decodeCharacterReference(reference);
    if (rendered == null) {
        return null;
    }
    const codePoints = Array.from(
        rendered,
        (character) =>
            `U+${character.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`,
    );
    return `${codePoints.join(' ')} ${rendered}`;
}

const COMMON_CHARACTER_REFERENCES: Readonly<Record<string, string>> = {
    amp: '&',
    apos: "'",
    bull: '•',
    copy: '©',
    deg: '°',
    divide: '÷',
    emsp: '\u2003',
    ensp: '\u2002',
    euro: '€',
    gt: '>',
    hellip: '…',
    laquo: '«',
    ldquo: '“',
    lsquo: '‘',
    lt: '<',
    mdash: '—',
    middot: '·',
    nbsp: '\u00A0',
    ndash: '–',
    para: '¶',
    plusmn: '±',
    quot: '"',
    raquo: '»',
    rdquo: '”',
    reg: '®',
    rsquo: '’',
    sect: '§',
    shy: '\u00AD',
    thinsp: '\u2009',
    times: '×',
    trade: '™',
};

function decodeCharacterReference(reference: string): string | null {
    const decimal = /^&#([0-9]+);$/u.exec(reference);
    const hexadecimal = /^&#[xX]([0-9A-Fa-f]+);$/u.exec(reference);
    if (decimal != null || hexadecimal != null) {
        const codePoint = Number.parseInt(
            (decimal ?? hexadecimal)?.[1] ?? '',
            decimal == null ? 16 : 10,
        );
        return codePoint > 0 &&
            codePoint <= 0x10ffff &&
            (codePoint < 0xd800 || codePoint > 0xdfff)
            ? String.fromCodePoint(codePoint)
            : null;
    }
    const named = /^&([A-Za-z][A-Za-z0-9]*);$/u.exec(reference);
    return named != null && Object.hasOwn(COMMON_CHARACTER_REFERENCES, named[1])
        ? COMMON_CHARACTER_REFERENCES[named[1]]
        : null;
}

function markLinkCheck(
    span: HTMLElement,
    title: string,
    state: LinkCheckState,
): void {
    const status = classifyLinkCheck(title, state);
    if (status === 'missing') {
        span.classList.add('kanade-source-editor-token--missing');
    } else if (status === 'unchecked') {
        span.classList.add('kanade-source-editor-token--unchecked');
    }
}
