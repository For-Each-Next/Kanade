/**
 * @file src/source-editor/domain/r-template.ts
 * Purpose: Converts wiki-specific R calls to native reference markup.
 *
 * Table of contents:
 * 1. Imports
 * 2. IndexedAliases
 * 3. RParameterRule
 * 4. RTemplateConfig
 * 5. RTemplateReferenceKey
 * 6. NativeRTemplateReference
 * 7. Constants and state
 * 8. convertRTemplateCall
 * 9. canConvertRTemplateCall
 * 10. canCompactRpTemplateCall
 * 11. buildCompactRTemplateCall
 * 12. getRTemplateReferenceKeys
 * 13. getRTemplateConfig
 * 14. indexParameters
 * 15. indexCompactRpParameters
 * 16. indexNativeRpAnnotations
 * 17. buildCompactParameters
 * 18. appendCompactAnnotationParameters
 * 19. resolveZhwikiPageCompactName
 * 20. hasUnsafeCompactReferenceName
 * 21. hasTopLevelEquals
 * 22. buildReference
 * 23. getReferenceContent
 * 24. buildReferenceTag
 * 25. buildReuseTag
 * 26. buildDefinitionTag
 * 27. buildRpAnnotation
 * 28. getIndexedValue
 * 29. getIndexedNames
 * 30. hasOnlySupportedParameters
 * 31. hasUnambiguousParameters
 * 32. hasAtMostOneEnteredAlias
 * 33. getEnteredAliasValues
 * 34. hasContiguousReferenceNames
 * 35. hasCompleteReferenceSlots
 * 36. addIndexedNames
 * 37. getSafePositionalName
 * 38. getFirstDefined
 */

import {
    wikitext,
    type ParsedTemplateCall,
    type TemplateBuildParameter,
} from '../../library/wikitext/index.ts';

import {
    decodeReferenceAttribute,
    escapeReferenceDetails,
    formatReferenceGroupAttribute,
    stripOptionalReferenceNameQuotes,
} from './ref-attributes.ts';
import {
    normalizeTemplateName,
    type TemplateNameContext,
} from './templates.ts';

interface IndexedAliases {
    first: readonly string[];
    numbered: readonly string[];
}

interface RParameterRule {
    aliases: IndexedAliases;
    compactName: string;
    outputName?: string;
    resolveCompactName?: (value: string) => string;
    rpAliases: readonly string[];
}

interface RTemplateConfig {
    contentAliases?: IndexedAliases;
    groupAliases: readonly string[];
    nameAliases: IndexedAliases;
    rpRules: readonly RParameterRule[];
}

export type RTemplateReferenceKey = readonly [group: string, name: string];

/** One native reuse and its optional adjacent Rp annotation. */
export interface NativeRTemplateReference {
    annotation?: ParsedTemplateCall;
    name: string;
}

const ENWIKI_R_CONFIG: RTemplateConfig = Object.freeze({
    contentAliases: {
        first: [
            'reference1',
            'references',
            'reference',
            'notes',
            'note',
            'content',
            'text',
            'refn1',
            'refn',
            'refs',
            'r1',
            'r',
        ],
        numbered: ['reference#', 'refn#', 'r#'],
    },
    groupAliases: ['group', 'grp', 'g'],
    nameAliases: {
        first: ['name1', 'name', 'n1', 'n', '1'],
        numbered: ['name#', 'n#', '#'],
    },
    rpRules: [
        {
            aliases: {
                first: ['page1', 'page', 'p1', '1p', 'p'],
                numbered: ['page#', 'p#', '#p'],
            },
            compactName: 'p',
            outputName: 'p',
            rpAliases: ['page', 'p'],
        },
        {
            aliases: {
                first: ['pages1', 'pages', 'pp1', '1pp', 'pp'],
                numbered: ['pages#', 'pp#', '#pp'],
            },
            compactName: 'pp',
            outputName: 'pp',
            rpAliases: ['pages', 'pp', '1'],
        },
        {
            aliases: {
                first: [
                    'location1',
                    'location',
                    'loc1',
                    '1loc',
                    'loc',
                    'at1',
                    'at',
                ],
                numbered: ['location#', 'loc#', '#loc', 'at#'],
            },
            compactName: 'at',
            outputName: 'at',
            rpAliases: ['location', 'loc', 'at'],
        },
        {
            aliases: {
                first: [
                    'quotation-page1',
                    'quotation-page',
                    'quote-page1',
                    'quote-page',
                    'qp1',
                    'qp',
                ],
                numbered: ['quotation-page#', 'quote-page#', 'qp#'],
            },
            compactName: 'qp',
            outputName: 'quote-page',
            rpAliases: ['quotation-page', 'quote-page', 'qp'],
        },
        {
            aliases: {
                first: [
                    'quotation-pages1',
                    'quotation-pages',
                    'quote-pages1',
                    'quote-pages',
                    'qpp1',
                    'qpp',
                ],
                numbered: ['quotation-pages#', 'quote-pages#', 'qpp#'],
            },
            compactName: 'qpp',
            outputName: 'quote-pages',
            rpAliases: ['quotation-pages', 'quote-pages', 'qpp'],
        },
        {
            aliases: {
                first: [
                    'quotation-location1',
                    'quotation-location',
                    'quote-location1',
                    'quote-location',
                    'quote-loc1',
                    'quote-loc',
                    'quote-at1',
                    'quote-at',
                ],
                numbered: [
                    'quotation-location#',
                    'quote-location#',
                    'quote-loc#',
                    'quote-at#',
                ],
            },
            compactName: 'quote-location',
            outputName: 'quote-location',
            rpAliases: [
                'quotation-location',
                'quote-location',
                'quote-loc',
                'quote-at',
            ],
        },
        {
            aliases: {
                first: [
                    'quotation1',
                    'quotation',
                    'quote1',
                    'quote',
                    'q1',
                    'q',
                ],
                numbered: ['quotation#', 'quote#', 'q#'],
            },
            compactName: 'q',
            outputName: 'quote',
            rpAliases: ['quotation', 'quote', 'q'],
        },
        {
            aliases: {
                first: [
                    'quotation-language1',
                    'quotation-language',
                    'quote-language1',
                    'quote-language',
                    'quotation-lang1',
                    'quotation-lang',
                    'quote-lang1',
                    'quote-lang',
                    'ql1',
                    'ql',
                    'language1',
                    'language',
                    'lang1',
                    'l1',
                    'l',
                ],
                numbered: [
                    'quotation-language#',
                    'quote-language#',
                    'quotation-lang#',
                    'quote-lang#',
                    'ql#',
                    'language#',
                    'lang#',
                    'l#',
                ],
            },
            compactName: 'language',
            outputName: 'language',
            rpAliases: [
                'quotation-language',
                'quote-language',
                'quotation-lang',
                'quote-lang',
                'ql',
                'language',
                'lang',
                'l',
            ],
        },
        {
            aliases: {
                first: [
                    'translation-quotation1',
                    'translation-quotation',
                    'trans-quotation1',
                    'trans-quotation',
                    'translation-quote1',
                    'translation-quote',
                    'trans-quote1',
                    'trans-quote',
                    'tq1',
                    'tq',
                    'translation1',
                    'translation',
                    'trans1',
                    'trans',
                    't1',
                    't',
                    'xlat1',
                    'xlat',
                ],
                numbered: [
                    'translation-quotation#',
                    'trans-quotation#',
                    'translation-quote#',
                    'trans-quote#',
                    'tq#',
                    'translation#',
                    'trans#',
                    't#',
                    'xlat#',
                ],
            },
            compactName: 'translation',
            outputName: 'translation',
            rpAliases: [
                'translation-quotation',
                'trans-quotation',
                'translation-quote',
                'trans-quote',
                'tq',
                'translation',
                'trans',
                't',
                'xlat',
            ],
        },
    ],
});

const ZHWIKI_R_CONFIG: RTemplateConfig = Object.freeze({
    groupAliases: ['group', 'grp', 'g'],
    nameAliases: {
        first: ['1'],
        numbered: ['#'],
    },
    rpRules: [
        {
            aliases: {
                first: [
                    'p',
                    'p1',
                    'page',
                    'page1',
                    'pp',
                    'pp1',
                    'pages',
                    'pages1',
                ],
                numbered: ['p#', 'page#', 'pp#', 'pages#'],
            },
            compactName: 'p',
            resolveCompactName: resolveZhwikiPageCompactName,
            rpAliases: ['1'],
        },
        {
            aliases: {
                first: ['q', 'q1', 'quote', 'quote1'],
                numbered: ['q#', 'quote#'],
            },
            compactName: 'q',
            outputName: 'quote',
            rpAliases: ['quotation', 'quote', 'q'],
        },
    ],
});

/**
 * Converts one R call without losing locator and quotation annotations.
 *
 * @param call - Parsed R template call.
 * @param context - Current-wiki template context.
 * @returns Equivalent native references and Rp annotations.
 */
export function convertRTemplateCall(
    call: ParsedTemplateCall,
    context: TemplateNameContext,
): string {
    const config = getRTemplateConfig(context);
    if (
        config == null ||
        !hasOnlySupportedParameters(call, config) ||
        !hasUnambiguousParameters(call, config)
    ) {
        return call.raw;
    }
    const params = indexParameters(call);
    if (
        !hasContiguousReferenceNames(params, config) ||
        !hasCompleteReferenceSlots(params, config)
    ) {
        return call.raw;
    }
    const group = getFirstDefined(params, config.groupAliases) ?? '';
    const references: string[] = [];
    for (let index = 1; index <= 9; index += 1) {
        const name = getIndexedValue(params, config.nameAliases, index);
        const content = getReferenceContent(params, config, index);
        if (!name && (index !== 1 || !content)) {
            continue;
        }
        references.push(
            buildReference(params, config, index, name ?? '', group),
        );
    }
    return references.length === 0 ? call.raw : references.join('');
}

/** Checks whether one R call has a lossless native representation. */
export function canConvertRTemplateCall(
    call: ParsedTemplateCall,
    context: TemplateNameContext,
): boolean {
    const config = getRTemplateConfig(context);
    if (
        config == null ||
        !hasOnlySupportedParameters(call, config) ||
        !hasUnambiguousParameters(call, config)
    ) {
        return false;
    }
    const params = indexParameters(call);
    if (
        !hasContiguousReferenceNames(params, config) ||
        !hasCompleteReferenceSlots(params, config)
    ) {
        return false;
    }
    for (let index = 1; index <= 9; index += 1) {
        if (getIndexedValue(params, config.nameAliases, index)) {
            return true;
        }
        if (index === 1 && getReferenceContent(params, config, index)) {
            return true;
        }
    }
    return false;
}

/** Checks whether Rp can fold into the current wiki's R call. */
export function canCompactRpTemplateCall(
    call: ParsedTemplateCall,
    context: TemplateNameContext,
): boolean {
    const config = getRTemplateConfig(context);
    return (
        config != null &&
        normalizeTemplateName(call.name, context) === 'rp' &&
        indexCompactRpParameters(call, config) != null
    );
}

/**
 * Builds one R call from native reuses and adjacent Rp annotations.
 *
 * @param references - Native references in source order.
 * @param context - Current-wiki template context.
 * @returns Compact R markup, or undefined when conversion is unsafe.
 */
export function buildCompactRTemplateCall(
    references: readonly NativeRTemplateReference[],
    context: TemplateNameContext,
): string | undefined {
    if (references.length === 0 || references.length > 9) {
        return undefined;
    }
    if (references.some(hasUnsafeCompactReferenceName)) {
        return undefined;
    }
    const config = getRTemplateConfig(context);
    const annotations = indexNativeRpAnnotations(references, config, context);
    if (annotations == null) {
        return undefined;
    }
    const parameters = buildCompactParameters(references, annotations, config);
    return wikitext.template.build('r', parameters);
}

/** Returns reference names that an unconverted R call must retain. */
export function getRTemplateReferenceKeys(
    call: ParsedTemplateCall,
    context: TemplateNameContext,
): RTemplateReferenceKey[] {
    const config = getRTemplateConfig(context) ?? ENWIKI_R_CONFIG;
    const enteredGroups = getEnteredAliasValues(call, config.groupAliases);
    const groups = enteredGroups.length === 0 ? [''] : enteredGroups;
    const result: RTemplateReferenceKey[] = [];
    for (let index = 1; index <= 9; index += 1) {
        const aliases = getIndexedNames(config.nameAliases, index);
        const enteredNames = getEnteredAliasValues(call, aliases);
        for (const group of groups) {
            for (const enteredName of enteredNames) {
                const name = stripOptionalReferenceNameQuotes(enteredName);
                if (name !== '') {
                    result.push([group, name]);
                }
            }
        }
    }
    return result;
}

function getRTemplateConfig(
    context: TemplateNameContext,
): RTemplateConfig | undefined {
    const source = context.namespaceSource;
    const databaseName =
        typeof source === 'string' ? source : source?.databaseName;
    if (databaseName == null || databaseName === 'enwiki') {
        return ENWIKI_R_CONFIG;
    }
    return databaseName === 'zhwiki' ? ZHWIKI_R_CONFIG : undefined;
}

function indexParameters(call: ParsedTemplateCall): Map<string, string> {
    const params = new Map<string, string>();
    for (const param of call.params) {
        params.set(param.name, param.value);
    }
    return params;
}

function indexCompactRpParameters(
    call: ParsedTemplateCall,
    config: RTemplateConfig,
): Map<RParameterRule, string> | undefined {
    const result = new Map<RParameterRule, string>();
    for (const param of call.params) {
        const rule = config.rpRules.find((candidate) =>
            candidate.rpAliases.includes(param.name),
        );
        if (rule == null || param.value === '' || result.has(rule)) {
            return undefined;
        }
        result.set(rule, param.value);
    }
    return result.size === 0 ? undefined : result;
}

function indexNativeRpAnnotations(
    references: readonly NativeRTemplateReference[],
    config: RTemplateConfig | undefined,
    context: TemplateNameContext,
): Array<Map<RParameterRule, string>> | undefined {
    const result: Array<Map<RParameterRule, string>> = [];
    for (const reference of references) {
        if (reference.annotation == null) {
            result.push(new Map());
            continue;
        }
        if (
            config == null ||
            normalizeTemplateName(reference.annotation.name, context) !== 'rp'
        ) {
            return undefined;
        }
        const params = indexCompactRpParameters(reference.annotation, config);
        if (params == null) {
            return undefined;
        }
        result.push(params);
    }
    return result;
}

function buildCompactParameters(
    references: readonly NativeRTemplateReference[],
    annotations: ReadonlyArray<ReadonlyMap<RParameterRule, string>>,
    config: RTemplateConfig | undefined,
): TemplateBuildParameter[] {
    const explicit = references.some((reference) =>
        hasTopLevelEquals(reference.name),
    );
    const parameters: TemplateBuildParameter[] = [];
    annotations.forEach(function appendReference(annotation, index) {
        const reference = references[index];
        if (reference == null) {
            return;
        }
        parameters.push({
            name: explicit ? String(index + 1) : undefined,
            value: reference.name,
        });
        appendCompactAnnotationParameters(
            parameters,
            annotation,
            config,
            index,
        );
    });
    return parameters;
}

function appendCompactAnnotationParameters(
    parameters: TemplateBuildParameter[],
    annotation: ReadonlyMap<RParameterRule, string>,
    config: RTemplateConfig | undefined,
    index: number,
): void {
    for (const rule of config?.rpRules ?? []) {
        const value = annotation.get(rule);
        if (value == null) {
            continue;
        }
        const compactName =
            rule.resolveCompactName?.(value) ?? rule.compactName;
        parameters.push({
            name: `${compactName}${index + 1}`,
            value,
        });
    }
}

function resolveZhwikiPageCompactName(value: string): string {
    return /[,，、–—-]/u.test(value) ? 'pp' : 'p';
}

function hasUnsafeCompactReferenceName(
    reference: NativeRTemplateReference,
): boolean {
    return (
        reference.name === '' ||
        wikitext(reference.name).split('|').length !== 1 ||
        reference.name.includes('{{') ||
        reference.name.includes('}}')
    );
}

function hasTopLevelEquals(value: string): boolean {
    return wikitext(value).findTopLevelEquals() >= 0;
}

function buildReference(
    params: ReadonlyMap<string, string>,
    config: RTemplateConfig,
    index: number,
    enteredName: string,
    group: string,
): string {
    const name = stripOptionalReferenceNameQuotes(enteredName);
    const content = getReferenceContent(params, config, index);
    const reference = buildReferenceTag(name, group, content);
    return `${reference}${buildRpAnnotation(params, config, index)}`;
}

function getReferenceContent(
    params: ReadonlyMap<string, string>,
    config: RTemplateConfig,
    index: number,
): string | undefined {
    return config.contentAliases == null
        ? undefined
        : getIndexedValue(params, config.contentAliases, index);
}

function buildReferenceTag(
    name: string,
    group: string,
    content: string | undefined,
): string {
    if (!content) {
        return buildReuseTag(name, group);
    }
    if (name === '') {
        const groupAttribute = formatReferenceGroupAttribute(group);
        return `<ref${groupAttribute}>${content}</ref>`;
    }
    return buildDefinitionTag(name, group, content);
}

function buildReuseTag(name: string, group: string): string {
    const groupAttribute = formatReferenceGroupAttribute(group);
    const escapedName = escapeReferenceDetails(decodeReferenceAttribute(name));
    return `<ref name="${escapedName}"${groupAttribute} />`;
}

function buildDefinitionTag(
    name: string,
    group: string,
    content: string,
): string {
    const groupAttribute = formatReferenceGroupAttribute(group);
    const escapedName = escapeReferenceDetails(decodeReferenceAttribute(name));
    const opening = `<ref name="${escapedName}"${groupAttribute}>`;
    return `${opening}${content}</ref>`;
}

function buildRpAnnotation(
    params: ReadonlyMap<string, string>,
    config: RTemplateConfig,
    index: number,
): string {
    const output = config.rpRules.flatMap(function buildParameter(rule) {
        const value = getIndexedValue(params, rule.aliases, index);
        if (!value) {
            return [];
        }
        const name = rule.outputName ?? getSafePositionalName(value);
        return [{ name, value }];
    });
    return output.length === 0 ? '' : wikitext.template.build('rp', output);
}

function getIndexedValue(
    params: ReadonlyMap<string, string>,
    aliases: IndexedAliases,
    index: number,
): string | undefined {
    const names = getIndexedNames(aliases, index);
    return getFirstDefined(params, names);
}

function getIndexedNames(
    aliases: IndexedAliases,
    index: number,
): readonly string[] {
    return index === 1
        ? aliases.first
        : aliases.numbered.map((alias) => alias.replaceAll('#', String(index)));
}

function hasOnlySupportedParameters(
    call: ParsedTemplateCall,
    config: RTemplateConfig,
): boolean {
    const supported = new Set(config.groupAliases);
    for (let index = 1; index <= 9; index += 1) {
        addIndexedNames(supported, config.nameAliases, index);
        if (config.contentAliases != null) {
            addIndexedNames(supported, config.contentAliases, index);
        }
        for (const rule of config.rpRules) {
            addIndexedNames(supported, rule.aliases, index);
        }
    }
    return call.params.every((param) => supported.has(param.name));
}

function hasUnambiguousParameters(
    call: ParsedTemplateCall,
    config: RTemplateConfig,
): boolean {
    if (!hasAtMostOneEnteredAlias(call, config.groupAliases)) {
        return false;
    }
    for (let index = 1; index <= 9; index += 1) {
        if (
            !hasAtMostOneEnteredAlias(
                call,
                getIndexedNames(config.nameAliases, index),
            )
        ) {
            return false;
        }
        if (
            config.contentAliases != null &&
            !hasAtMostOneEnteredAlias(
                call,
                getIndexedNames(config.contentAliases, index),
            )
        ) {
            return false;
        }
        for (const rule of config.rpRules) {
            if (
                !hasAtMostOneEnteredAlias(
                    call,
                    getIndexedNames(rule.aliases, index),
                )
            ) {
                return false;
            }
        }
    }
    return true;
}

function hasAtMostOneEnteredAlias(
    call: ParsedTemplateCall,
    aliases: readonly string[],
): boolean {
    return getEnteredAliasValues(call, aliases).length <= 1;
}

function getEnteredAliasValues(
    call: ParsedTemplateCall,
    aliases: readonly string[],
): string[] {
    const names = new Set(aliases);
    return call.params
        .filter((param) => names.has(param.name))
        .map((param) => param.value);
}

function hasContiguousReferenceNames(
    params: ReadonlyMap<string, string>,
    config: RTemplateConfig,
): boolean {
    const firstName = getIndexedValue(params, config.nameAliases, 1);
    const firstContent = getReferenceContent(params, config, 1);
    let foundGap = !firstName && !firstContent;
    for (let index = 2; index <= 9; index += 1) {
        const name = getIndexedValue(params, config.nameAliases, index);
        if (!name) {
            foundGap = true;
        } else if (foundGap) {
            return false;
        }
    }
    return true;
}

function hasCompleteReferenceSlots(
    params: ReadonlyMap<string, string>,
    config: RTemplateConfig,
): boolean {
    for (let index = 2; index <= 9; index += 1) {
        const name = getIndexedValue(params, config.nameAliases, index);
        if (name) {
            continue;
        }
        const content = getReferenceContent(params, config, index);
        const hasAnnotation = config.rpRules.some(
            (rule) =>
                getIndexedValue(params, rule.aliases, index) !== undefined,
        );
        if (content !== undefined || hasAnnotation) {
            return false;
        }
    }
    return true;
}

function addIndexedNames(
    target: Set<string>,
    aliases: IndexedAliases,
    index: number,
): void {
    for (const name of getIndexedNames(aliases, index)) {
        target.add(name);
    }
}

function getSafePositionalName(value: string): string | undefined {
    return wikitext(value).findTopLevelEquals() >= 0 ? '1' : undefined;
}

function getFirstDefined(
    params: ReadonlyMap<string, string>,
    aliases: readonly string[],
): string | undefined {
    for (const alias of aliases) {
        if (params.has(alias)) {
            return params.get(alias);
        }
    }
    return undefined;
}
