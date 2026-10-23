/**
 * @file src/library/wikitext/query.ts
 * Purpose: Lazy, construct-focused wikitext queries and builders.
 *
 * Table of contents:
 * 1. Imports
 * 2. WikitextQueryOptions
 * 3. WikitextCollection
 * 4. WikitextNamedCollection
 * 5. WikitextTagAttributeFilter
 * 6. WikitextTemplateParameterFilter
 * 7. WikitextReferenceCollection
 * 8. ParsedWikitextTag
 * 9. ParsedWikitextTemplate
 * 10. ParsedWikitextSource
 * 11. NamedTagCollection
 * 12. NamedTemplateCollection
 * 13. WikitextTagCollection
 * 14. WikitextTemplateCollection
 * 15. WikitextTemplateStatic
 * 16. WikitextTagStatic
 * 17. WikitextQuery
 * 18. WikitextFactory
 * 19. queryWikitext
 * 20. createCollection
 * 21. createTemplateCollection
 * 22. hasTemplateParameters
 * 23. createTagCollection
 * 24. hasTagAttributes
 * 25. createReferenceCollection
 * 26. parseSource
 * 27. parseTemplateSource
 * 28. findCompleteTag
 * 29. offsetParsedTag
 * 30. getTables
 * 31. Constants and state
 * 32. Initialization and execution
 * 33. parseTagSource
 * 34. Exports
 */

import { findWikitextComments, type WikitextComment } from './comments.ts';
import { findWikilinkRanges, type WikilinkRange } from './links.ts';
import {
    findOpaqueRanges,
    type SourceRange,
    type WikitextOptions,
} from './opaque-ranges.ts';
import { findNamedRefTag, findRefTags, type RefTag } from './references.ts';
import {
    findWikitableRanges,
    parseWikitable,
    type ParsedWikitable,
} from './tables.ts';
import {
    findWikitextTags,
    parseTagAttributePairs,
    parseTagAttributes,
    type WikitextTag,
    type WikitextTagAttributePair,
    type WikitextTagOptions,
} from './tags.ts';
import {
    findTemplateParameterRanges,
    type TemplateParameterRange,
} from './template-parameters.ts';
import {
    buildTemplate,
    findTemplateCalls,
    findTopLevelEquals,
    normalizeTemplateName,
    parseTemplateCall,
    splitTopLevel,
    splitTopLevelRanges,
    type ParsedTemplateCall,
    type TemplateBuildOptions,
    type TemplateBuildParameters,
    type TopLevelRange,
} from './templates.ts';

export interface WikitextQueryOptions extends WikitextOptions {
    includeUnclosedLinks?: boolean;
    voidTags?: readonly string[];
}

export interface WikitextCollection<T> {
    getAll(): T[];
    getFirst(): T | undefined;
}

export interface WikitextNamedCollection<T, Filter = never> {
    getAll(name?: string, filter?: Filter): T[];
    getFirst(name?: string, filter?: Filter): T | undefined;
}

/** Exact attributes that every returned tag must contain. */
export type WikitextTagAttributeFilter = Readonly<Record<string, string>>;

/** Effective parameters that every returned template must contain. */
export type WikitextTemplateParameterFilter = Readonly<Record<string, string>>;

export interface WikitextReferenceCollection {
    getAll(name?: string, group?: string): RefTag[];
    getFirst(name?: string, group?: string): RefTag | undefined;
}

export interface ParsedWikitextTag extends WikitextTag {
    kind: 'tag';
}

export interface ParsedWikitextTemplate extends ParsedTemplateCall {
    kind: 'template';
    parameterPairs: ParsedTemplateCall['params'];
}

export type ParsedWikitextSource = ParsedWikitextTag | ParsedWikitextTemplate;

type NamedTagCollection = WikitextNamedCollection<
    WikitextTag,
    WikitextTagAttributeFilter
>;
type NamedTemplateCollection = WikitextNamedCollection<
    ParsedTemplateCall,
    WikitextTemplateParameterFilter
>;

export interface WikitextTagCollection extends NamedTagCollection {
    parser(start?: number): ParsedWikitextTag | undefined;
}

export interface WikitextTemplateCollection extends NamedTemplateCollection {
    parser(start?: number): ParsedWikitextTemplate;
}

export interface WikitextTemplateStatic {
    build(
        name: string,
        parameters?: TemplateBuildParameters,
        options?: TemplateBuildOptions,
    ): string;
    normalizeName(name: string): string;
    parse(raw: string, start?: number): ParsedTemplateCall;
    parser(raw: string, start?: number): ParsedWikitextTemplate;
}

export interface WikitextTagStatic {
    parse(raw: string, start?: number): ParsedWikitextTag | undefined;
    parseAttributePairs(source: string): WikitextTagAttributePair[];
    parseAttributes(source: string): Record<string, string>;
    parser(raw: string, start?: number): ParsedWikitextTag | undefined;
}

export interface WikitextQuery {
    comment: WikitextCollection<WikitextComment>;
    findTopLevelEquals(): number;
    link: WikitextCollection<WikilinkRange>;
    opaque: WikitextCollection<SourceRange>;
    parser(start?: number): ParsedWikitextSource | undefined;
    reference: WikitextReferenceCollection;
    references: WikitextReferenceCollection;
    source: string;
    split(separator: string): string[];
    splitRanges(separator: string): TopLevelRange[];
    table: WikitextCollection<ParsedWikitable>;
    tag: WikitextTagCollection;
    tags: WikitextTagCollection;
    template: WikitextTemplateCollection;
    templates: WikitextTemplateCollection;
    templateParameter: WikitextCollection<TemplateParameterRange>;
}

export interface WikitextFactory {
    (source: string, options?: WikitextQueryOptions): WikitextQuery;
    tag: WikitextTagStatic;
    tags: WikitextTagStatic;
    template: WikitextTemplateStatic;
    templates: WikitextTemplateStatic;
}

/**
 * Creates lazy construct queries over one source string.
 *
 * No document tree is created. Each method invokes one focused scanner.
 *
 * @param source - Wikitext source.
 * @param options - Literal and void tag overrides.
 * @returns Source-bound construct query functions.
 */
function queryWikitext(
    source: string,
    options: WikitextQueryOptions = {},
): WikitextQuery {
    const scanOptions: WikitextOptions = options.literalTags
        ? { literalTags: options.literalTags }
        : {};
    const references = createReferenceCollection(source, scanOptions);
    const tags = createTagCollection(source, options);
    const templates = createTemplateCollection(source, scanOptions);
    return Object.freeze({
        comment: createCollection(() => findWikitextComments(source)),
        findTopLevelEquals: () => findTopLevelEquals(source, scanOptions),
        link: createCollection(() =>
            findWikilinkRanges(source, {
                ...scanOptions,
                ...(options.includeUnclosedLinks
                    ? { includeUnclosed: true }
                    : {}),
            }),
        ),
        opaque: createCollection(() => findOpaqueRanges(source, scanOptions)),
        parser: (start = 0) => parseSource(source, tags, templates, start),
        reference: references,
        references,
        source,
        split: (separator: string) =>
            splitTopLevel(source, separator, scanOptions),
        splitRanges: (separator: string) =>
            splitTopLevelRanges(source, separator, scanOptions),
        table: createCollection(() => getTables(source, scanOptions)),
        tag: tags,
        tags,
        template: templates,
        templates,
        templateParameter: createCollection(() =>
            findTemplateParameterRanges(source, scanOptions),
        ),
    });
}

function createCollection<T>(getAll: () => T[]): WikitextCollection<T> {
    return Object.freeze({
        getAll,
        getFirst: () => getAll()[0],
    });
}

function createTemplateCollection(
    source: string,
    options: WikitextOptions,
): WikitextTemplateCollection {
    function getAll(
        name?: string,
        parameters: WikitextTemplateParameterFilter = {},
    ): ParsedTemplateCall[] {
        const templates = findTemplateCalls(source, options);
        const expected = name == null ? null : normalizeTemplateName(name);
        if (expected === '') {
            return [];
        }
        return templates.filter(
            (template) =>
                (expected == null ||
                    normalizeTemplateName(template.name) === expected) &&
                hasTemplateParameters(template, parameters),
        );
    }
    return Object.freeze({
        getAll,
        getFirst: (
            name?: string,
            parameters?: WikitextTemplateParameterFilter,
        ) => getAll(name, parameters)[0],
        parser: (start = 0) => parseTemplateSource(source, start),
    });
}

function hasTemplateParameters(
    template: ParsedTemplateCall,
    expected: WikitextTemplateParameterFilter,
): boolean {
    const parameters = new Map(
        template.params.map((parameter) => [parameter.name, parameter.value]),
    );
    return Object.entries(expected).every(
        ([name, value]) => parameters.get(name.trim()) === value,
    );
}

function createTagCollection(
    source: string,
    options: WikitextQueryOptions,
): WikitextTagCollection {
    function getAll(
        name?: string,
        attributes: WikitextTagAttributeFilter = {},
    ): WikitextTag[] {
        const tagOptions: WikitextTagOptions = {
            ...(options.literalTags == null
                ? {}
                : { literalTags: options.literalTags }),
            ...(options.voidTags == null ? {} : { voidTags: options.voidTags }),
            ...(name == null ? {} : { tagNames: [name] }),
        };
        return findWikitextTags(source, tagOptions).filter((tag) =>
            hasTagAttributes(tag, attributes),
        );
    }
    return Object.freeze({
        getAll,
        getFirst: (name?: string, attributes?: WikitextTagAttributeFilter) =>
            getAll(name, attributes)[0],
        parser(start = 0) {
            const parsed = findCompleteTag(source, getAll());
            return parsed == null ? undefined : offsetParsedTag(parsed, start);
        },
    });
}

function hasTagAttributes(
    tag: WikitextTag,
    expected: WikitextTagAttributeFilter,
): boolean {
    return Object.entries(expected).every(
        ([name, value]) =>
            tag.attributes[name.trim().toLocaleLowerCase()] === value,
    );
}

function createReferenceCollection(
    source: string,
    options: WikitextOptions,
): WikitextReferenceCollection {
    function getAll(name?: string, group?: string): RefTag[] {
        const tags = findRefTags(source, options);
        if (name == null && group == null) {
            return tags;
        }
        const expectedGroup = group ?? '';
        return tags.filter(
            (tag) =>
                (name == null || tag.attributes.name === name) &&
                (tag.attributes.group ?? '') === expectedGroup,
        );
    }
    return Object.freeze({
        getAll,
        getFirst(name?: string, group?: string) {
            return name == null
                ? getAll(undefined, group)[0]
                : findNamedRefTag(source, name, group, options);
        },
    });
}

function parseSource(
    source: string,
    tags: WikitextTagCollection,
    templates: WikitextTemplateCollection,
    start: number,
): ParsedWikitextSource | undefined {
    const trimmed = source.trim();
    if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) {
        return templates.parser(start);
    }
    if (trimmed.startsWith('<')) {
        return tags.parser(start);
    }
    return undefined;
}

function parseTemplateSource(
    source: string,
    start: number = 0,
): ParsedWikitextTemplate {
    const leadingLength = source.length - source.trimStart().length;
    const raw = source.trim();
    const parsed = parseTemplateCall(raw, start + leadingLength);
    return {
        ...parsed,
        kind: 'template',
        parameterPairs: parsed.params,
    };
}

function findCompleteTag(
    source: string,
    tags: WikitextTag[],
): WikitextTag | undefined {
    const start = source.length - source.trimStart().length;
    const end = source.trimEnd().length;
    return tags.find((tag) => tag.start === start && tag.end === end);
}

function offsetParsedTag(tag: WikitextTag, offset: number): ParsedWikitextTag {
    return {
        ...tag,
        contentEnd: tag.contentEnd + offset,
        contentStart: tag.contentStart + offset,
        end: tag.end + offset,
        kind: 'tag',
        start: tag.start + offset,
    };
}

function getTables(
    source: string,
    options: WikitextOptions,
): ParsedWikitable[] {
    return findWikitableRanges(source, options).map((range) =>
        parseWikitable(
            source.slice(range.start, range.end),
            range.start,
            options,
        ),
    );
}

const staticTemplate = Object.freeze({
    build: buildTemplate,
    normalizeName: normalizeTemplateName,
    parse: parseTemplateCall,
    parser: parseTemplateSource,
});
const staticTag = Object.freeze({
    parse: parseTagSource,
    parseAttributePairs: parseTagAttributePairs,
    parseAttributes: parseTagAttributes,
    parser: parseTagSource,
});

export const wikitext: WikitextFactory = Object.assign(queryWikitext, {
    tag: staticTag,
    tags: staticTag,
    template: staticTemplate,
    templates: staticTemplate,
});
Object.freeze(wikitext);

function parseTagSource(
    raw: string,
    start: number = 0,
): ParsedWikitextTag | undefined {
    return createTagCollection(raw, {}).parser(start);
}

export type { WikitextComment } from './comments.ts';
export type { WikilinkRange } from './links.ts';
export type { SourceRange, WikitextOptions } from './opaque-ranges.ts';
export type { RefTag } from './references.ts';
export type {
    ParsedWikitable,
    ParsedWikitableCaption,
    ParsedWikitableCell,
    ParsedWikitableRow,
} from './tables.ts';
export type { WikitextTag, WikitextTagAttributePair } from './tags.ts';
export type { TemplateParameterRange } from './template-parameters.ts';
export type {
    ParsedTemplateCall,
    ParsedTemplateParameter,
    TemplateBuildOptions,
    TemplateBuildParameter,
    TemplateBuildParameters,
    TemplateStyle,
    TopLevelRange,
} from './templates.ts';
