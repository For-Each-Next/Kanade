/**
 * @file src/source-editor/domain/reference-containers.ts
 * Purpose: Parsing and range operations for list-defined-reference containers.
 *
 * Table of contents:
 * 1. Imports
 * 2. ReferenceContainer
 * 3. createEmptyReferenceContainer
 * 4. findReferenceContainers
 * 5. captureContainerPrefixes
 * 6. getTrailingContainerText
 * 7. isTagInContainers
 * 8. getContainingGroup
 * 9. buildReflistContainer
 */

import {
    wikitext,
    type ParsedTemplateCall,
    type RefTag,
} from '../../library/wikitext/index.ts';

import {
    DEFAULT_TEMPLATE_NAME_CONTEXT,
    normalizeTemplateName,
    type TemplateNameContext,
} from './templates.ts';

/** One native references tag or Reflist template. */
export interface ReferenceContainer {
    contentEnd: number;
    contentStart: number;
    end: number;
    group: string;
    kind: 'references' | 'reflist';
    namedParams: Array<[string, string]>;
    prefixText: string;
    start: number;
}

/**
 * Creates a synthetic target for a missing reference group.
 *
 * @param group - Reference group.
 * @returns Created synthetic target for a missing reference group.
 */
export function createEmptyReferenceContainer(
    group: string,
): ReferenceContainer {
    return {
        contentEnd: 0,
        contentStart: 0,
        end: 0,
        group,
        kind: 'references',
        namedParams: [],
        prefixText: '',
        start: 0,
    };
}

/**
 * Finds native references tags and Reflist templates.
 *
 * @param text - Text to process.
 * @returns Native references tags and Reflist templates.
 */
export function findReferenceContainers(
    text: string,
    templateNameContext: TemplateNameContext = DEFAULT_TEMPLATE_NAME_CONTEXT,
): ReferenceContainer[] {
    const code = wikitext(text);
    const result: ReferenceContainer[] = [];
    for (const tag of code.tags.getAll('references')) {
        if (!tag.closed) {
            continue;
        }
        result.push({
            contentEnd: tag.contentEnd,
            contentStart: tag.contentStart,
            end: tag.end,
            group: tag.attributes.group || '',
            kind: 'references',
            namedParams: [],
            prefixText: '',
            start: tag.start,
        });
    }
    for (const template of code.templates.getAll()) {
        if (
            normalizeTemplateName(template.name, templateNameContext) !==
            'reflist'
        ) {
            continue;
        }
        result.push(buildReflistContainer(template));
    }
    return result.sort((left, right) => left.start - right.start);
}

/**
 * Captures text before each container's first active definition.
 *
 * @param containers - Containers value.
 * @param tags - Tags value.
 * @param source - Source text.
 */
export function captureContainerPrefixes(
    containers: ReferenceContainer[],
    tags: RefTag[],
    source: string,
): void {
    for (const container of containers) {
        const first = tags.find(function isFirstContainerTag(tag) {
            return (
                !tag.selfClosing &&
                tag.start >= container.contentStart &&
                tag.end <= container.contentEnd
            );
        });
        const end = first?.start ?? container.contentEnd;
        container.prefixText = source.slice(container.contentStart, end);
    }
}

/**
 * Captures material after a definition up to the next definition.
 *
 * @param tag - Parsed tag.
 * @param containers - Containers value.
 * @param fullTags - Full tags value.
 * @param source - Source text.
 * @returns Material after a definition up to the next definition.
 */
export function getTrailingContainerText(
    tag: RefTag,
    containers: ReferenceContainer[],
    fullTags: RefTag[],
    source: string,
): string {
    const container = containers.find(function containsTag(candidate) {
        return (
            tag.start >= candidate.contentStart &&
            tag.end <= candidate.contentEnd
        );
    });
    if (container == null) {
        return '';
    }
    const next = fullTags.find(function isNextContainerTag(candidate) {
        return (
            candidate.start > tag.start &&
            candidate.start < container.contentEnd
        );
    });
    return source.slice(tag.end, next?.start ?? container.contentEnd);
}

/**
 * Checks whether a ref tag is inside a list container.
 *
 * @param tag - Parsed tag.
 * @param containers - Containers value.
 * @returns Whether a ref tag is inside a list container.
 */
export function isTagInContainers(
    tag: RefTag,
    containers: ReferenceContainer[],
): boolean {
    return containers.some(
        (container) => tag.start >= container.start && tag.end <= container.end,
    );
}

/**
 * Gets the group inherited from a containing reference list.
 *
 * @param tag - Parsed tag.
 * @param containers - Containers value.
 * @returns Resulting text.
 */
export function getContainingGroup(
    tag: RefTag,
    containers: ReferenceContainer[],
): string {
    return (
        containers.find(
            (container) =>
                tag.start >= container.start && tag.end <= container.end,
        )?.group || ''
    );
}

/**
 * Builds a reference container from one Reflist template.
 *
 * @param call - Call value.
 * @returns Built reference container from one Reflist template.
 */
function buildReflistContainer(
    template: ParsedTemplateCall,
): ReferenceContainer {
    const namedArguments = template.params.filter(
        (argument) => !argument.positional,
    );
    const namedParams = namedArguments.map(
        (argument) =>
            [argument.name.toLowerCase(), argument.value.trim()] as [
                string,
                string,
            ],
    );
    const values = Object.fromEntries(namedParams);
    const listValue = values.list || values.refs || '';
    const listArgument = namedArguments.find((argument) =>
        /^(?:list|refs)$/iu.test(argument.name),
    );
    const relativeValueStart = listArgument?.rawValue.indexOf(listValue) ?? 0;
    const contentStart =
        listValue === ''
            ? template.start
            : (listArgument?.valueStart ?? template.start) +
              Math.max(relativeValueStart, 0);
    return {
        contentEnd: contentStart + listValue.length,
        contentStart,
        end: template.end,
        group: values.group || '',
        kind: 'reflist',
        namedParams,
        prefixText: '',
        start: template.start,
    };
}
