/**
 * @file src/library/wikitext/tags.ts
 * Purpose: Generic HTML-like and MediaWiki extension-tag queries.
 *
 * Contents: Tag scanning, attribute parsing, and source-markup ranges.
 */

import { findWikitextComments } from './comments.ts';
import type { SourceRange } from './source-ranges.ts';

export const DEFAULT_LITERAL_TAGS = [
    'nowiki',
    'pre',
    'source',
    'syntaxhighlight',
    'math',
    'code',
    'templatedata',
    'templatestyles',
    'graph',
    'timeline',
    'score',
    'mapframe',
] as const;

const DEFAULT_VOID_TAGS = [
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'track',
    'wbr',
] as const;

export interface WikitextTagOptions {
    literalTags?: readonly string[];
    tagNames?: readonly string[];
    voidTags?: readonly string[];
}

export interface WikitextTagAttributePair {
    name: string;
    value: string;
}

export interface WikitextTag {
    attributePairs: WikitextTagAttributePair[];
    attributes: Record<string, string>;
    closed: boolean;
    content: string;
    contentEnd: number;
    contentStart: number;
    end: number;
    innerText: string;
    name: string;
    protectedContent: boolean;
    raw: string;
    selfClosing: boolean;
    start: number;
}

interface TagToken {
    attributesSource: string;
    closing: boolean;
    end: number;
    name: string;
    selfClosing: boolean;
    start: number;
}

interface OpenTag extends TagToken {
    protectedContent: boolean;
}

interface TagRangeDetails {
    closed: boolean;
    contentEnd: number;
    end: number;
    protectedContent: boolean;
    selfClosing: boolean;
}

/**
 * Finds generic HTML-like and MediaWiki extension tags.
 *
 * @param source - Wikitext to scan.
 * @param options - Literal, selected, and void tag names.
 * @returns Tags in source order, with outer tags before nested tags.
 */
export function findWikitextTags(
    source: string,
    options: WikitextTagOptions = {},
): WikitextTag[] {
    const literalTags = normalizeTagSet(
        options.literalTags ?? DEFAULT_LITERAL_TAGS,
    );
    const requestedTags =
        options.tagNames == null ? null : normalizeTagSet(options.tagNames);
    const voidTags = normalizeTagSet(options.voidTags ?? DEFAULT_VOID_TAGS);
    const comments = findWikitextComments(source);
    const stack: OpenTag[] = [];
    const tags: WikitextTag[] = [];
    let commentIndex = 0;
    let index = 0;

    while (index < source.length) {
        while (comments[commentIndex]?.end <= index) {
            commentIndex += 1;
        }
        const comment = comments[commentIndex];
        if (comment != null && index >= comment.start) {
            index = comment.end;
            commentIndex += 1;
            continue;
        }
        if (source[index] !== '<') {
            index += 1;
            continue;
        }
        const token = readTagToken(source, index);
        if (token == null) {
            index += 1;
            continue;
        }
        index = token.end;
        if (token.closing) {
            closeStackTag(source, token, stack, tags, requestedTags);
            continue;
        }
        const protectedContent = literalTags.has(token.name);
        if (token.selfClosing || voidTags.has(token.name)) {
            addTag(
                tags,
                buildTag(source, token, {
                    closed: true,
                    contentEnd: token.end,
                    end: token.end,
                    protectedContent: false,
                    selfClosing: true,
                }),
                requestedTags,
            );
            continue;
        }
        if (protectedContent) {
            const closing = findClosingTagToken(source, token.end, token.name);
            const contentEnd = closing?.start ?? source.length;
            const end = closing?.end ?? source.length;
            addTag(
                tags,
                buildTag(source, token, {
                    closed: closing != null,
                    contentEnd,
                    end,
                    protectedContent: true,
                    selfClosing: false,
                }),
                requestedTags,
            );
            index = end;
            continue;
        }
        stack.push({ ...token, protectedContent });
    }
    for (const opening of stack) {
        addTag(
            tags,
            buildTag(source, opening, {
                closed: false,
                contentEnd: source.length,
                end: source.length,
                protectedContent: opening.protectedContent,
                selfClosing: false,
            }),
            requestedTags,
        );
    }
    return tags.toSorted(
        (left, right) => left.start - right.start || right.end - left.end,
    );
}

/** Returns opening and closing tag markup without including tag contents. */
export function getTagMarkupRanges(
    tags: readonly WikitextTag[],
): SourceRange[] {
    return tags.flatMap((tag) => {
        const ranges: SourceRange[] = [
            { end: tag.contentStart, start: tag.start },
        ];
        if (!tag.selfClosing && tag.contentEnd < tag.end) {
            ranges.push({ end: tag.end, start: tag.contentEnd });
        }
        return ranges;
    });
}

/**
 * Parses quoted, unquoted, or boolean HTML-like tag attributes.
 *
 * @param value - Raw attribute source after the tag name.
 * @returns Attributes keyed by lowercase name.
 */
export function parseTagAttributes(value: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (const pair of parseTagAttributePairs(value)) {
        Object.defineProperty(attributes, pair.name, {
            configurable: true,
            enumerable: true,
            value: pair.value,
            writable: true,
        });
    }
    return attributes;
}

/**
 * Parses tag attributes as entered name/value pairs in source order.
 *
 * Unlike the record view, this list retains duplicate attributes.
 *
 * @param value - Raw attribute source after the tag name.
 * @returns Ordered lowercase names and undecoded values.
 */
export function parseTagAttributePairs(
    value: string,
): WikitextTagAttributePair[] {
    const pairs: WikitextTagAttributePair[] = [];
    const pattern =
        /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu;
    for (const match of value.matchAll(pattern)) {
        const name = match[1].toLocaleLowerCase();
        const attributeValue = match[2] ?? match[3] ?? match[4] ?? '';
        pairs.push({ name, value: attributeValue });
    }
    return pairs;
}

function readTagToken(source: string, start: number): TagToken | null {
    let index = start + 1;
    const closing = source[index] === '/';
    index += closing ? 1 : 0;
    while (/\s/u.test(source[index] ?? '')) {
        index += 1;
    }
    const nameStart = index;
    while (/[\p{L}\p{N}:-]/u.test(source[index] ?? '')) {
        index += 1;
    }
    if (index === nameStart) {
        return null;
    }
    const name = source.slice(nameStart, index).toLocaleLowerCase();
    const end = findTagTokenEnd(source, index);
    if (end < 0) {
        return null;
    }
    const tail = source.slice(index, end - 1);
    const selfClosing = !closing && /\/\s*$/u.test(tail);
    const attributesSource = closing ? '' : tail.replace(/\/\s*$/u, '').trim();
    return { attributesSource, closing, end, name, selfClosing, start };
}

function findTagTokenEnd(source: string, start: number): number {
    let quote = '';
    for (let index = start; index < source.length; index += 1) {
        const character = source[index];
        if (quote !== '') {
            quote = character === quote ? '' : quote;
            continue;
        }
        if (character === '"' || character === "'") {
            quote = character;
        } else if (character === '>') {
            return index + 1;
        }
    }
    return -1;
}

function findClosingTagToken(
    source: string,
    start: number,
    name: string,
): TagToken | null {
    let index = source.indexOf('</', start);
    while (index >= 0) {
        const token = readTagToken(source, index);
        if (token?.closing === true && token.name === name) {
            return token;
        }
        index = source.indexOf('</', index + 2);
    }
    return null;
}

function closeStackTag(
    source: string,
    closing: TagToken,
    stack: OpenTag[],
    tags: WikitextTag[],
    requestedTags: ReadonlySet<string> | null,
): void {
    const openingIndex = stack.findLastIndex(
        (opening) => opening.name === closing.name,
    );
    if (openingIndex < 0) {
        return;
    }
    const abandoned = stack.splice(openingIndex);
    const opening = abandoned.shift();
    if (opening == null) {
        return;
    }
    for (const nested of abandoned) {
        addTag(
            tags,
            buildTag(source, nested, {
                closed: false,
                contentEnd: closing.start,
                end: closing.start,
                protectedContent: nested.protectedContent,
                selfClosing: false,
            }),
            requestedTags,
        );
    }
    addTag(
        tags,
        buildTag(source, opening, {
            closed: true,
            contentEnd: closing.start,
            end: closing.end,
            protectedContent: opening.protectedContent,
            selfClosing: false,
        }),
        requestedTags,
    );
}

function buildTag(
    source: string,
    opening: TagToken,
    details: TagRangeDetails,
): WikitextTag {
    const { closed, contentEnd, end, protectedContent, selfClosing } = details;
    const content = source.slice(opening.end, contentEnd);
    return {
        attributePairs: parseTagAttributePairs(opening.attributesSource),
        attributes: parseTagAttributes(opening.attributesSource),
        closed,
        content,
        contentEnd,
        contentStart: opening.end,
        end,
        innerText: content,
        name: opening.name,
        protectedContent,
        raw: source.slice(opening.start, end),
        selfClosing,
        start: opening.start,
    };
}

function addTag(
    tags: WikitextTag[],
    tag: WikitextTag,
    requestedTags: ReadonlySet<string> | null,
): void {
    if (requestedTags == null || requestedTags.has(tag.name)) {
        tags.push(tag);
    }
}

function normalizeTagSet(tags: readonly string[]): Set<string> {
    return new Set(tags.map((tag) => tag.toLocaleLowerCase()));
}
