/**
 * @file src/source-editor/features/source-manager/template-options.ts
 * Purpose: src / features / source manager / template options module.
 *
 * Table of contents:
 * 1. Imports
 * 2. CitationTemplateName
 * 3. CitationTemplateType
 * 4. CitationTemplateDefinition
 * 5. Constants and state
 * 6. Initialization and execution
 * 7. getSourceDraftTemplateOptions
 * 8. validateTemplateDefinitions
 * 9. isDefinitionGroupAlphabetical
 * 10. getTemplateTierRank
 */

/**
 * Orders citation-template selector options by importance and type.
 * Sorts each resulting group alphabetically.
 */

import {
    getCanonicalTemplateName,
    isMetadataFreeCitationTemplate,
    SUPPORTED_CITATION_TEMPLATES,
} from '../../domain/templates.ts';
import {
    cdxIconBook,
    cdxIconBrowser,
    cdxIconDie,
    cdxIconNewspaper,
    cdxIconNotice,
    cdxIconUserTalk,
    type Icon,
} from '@wikimedia/codex-icons';

type CitationTemplateName = (typeof SUPPORTED_CITATION_TEMPLATES)[number];
type CitationTemplateType = 'general' | 'special';
type CitationTemplateDefinition =
    | {
          icon: Icon;
          importance: 'important';
          name: CitationTemplateName;
          type: CitationTemplateType;
      }
    | {
          icon?: never;
          importance: 'normal';
          name: CitationTemplateName;
          type: CitationTemplateType;
      };

export const CITATION_TEMPLATE_DEFINITIONS = [
    {
        icon: cdxIconUserTalk,
        importance: 'important',
        name: 'Cite interview',
        type: 'special',
    },
    {
        icon: cdxIconNewspaper,
        importance: 'important',
        name: 'Cite news',
        type: 'special',
    },
    {
        icon: cdxIconNotice,
        importance: 'important',
        name: 'Cite press release',
        type: 'special',
    },
    {
        icon: cdxIconBook,
        importance: 'important',
        name: 'Cite book',
        type: 'general',
    },
    {
        icon: cdxIconNewspaper,
        importance: 'important',
        name: 'Cite magazine',
        type: 'general',
    },
    {
        icon: cdxIconDie,
        importance: 'important',
        name: 'Cite video game',
        type: 'general',
    },
    {
        icon: cdxIconBrowser,
        importance: 'important',
        name: 'Cite web',
        type: 'general',
    },
    { importance: 'normal', name: 'Cite arXiv', type: 'special' },
    { importance: 'normal', name: 'Cite AV media', type: 'special' },
    { importance: 'normal', name: 'Cite AV media notes', type: 'special' },
    { importance: 'normal', name: 'Cite bioRxiv', type: 'special' },
    { importance: 'normal', name: 'Cite CiteSeerX', type: 'special' },
    { importance: 'normal', name: 'Cite conference', type: 'special' },
    { importance: 'normal', name: 'Cite episode', type: 'special' },
    { importance: 'normal', name: 'Cite mailing list', type: 'special' },
    { importance: 'normal', name: 'Cite map', type: 'special' },
    { importance: 'normal', name: 'Cite medRxiv', type: 'special' },
    { importance: 'normal', name: 'Cite newsgroup', type: 'special' },
    { importance: 'normal', name: 'Cite podcast', type: 'special' },
    { importance: 'normal', name: 'Cite sign', type: 'special' },
    { importance: 'normal', name: 'Cite speech', type: 'special' },
    { importance: 'normal', name: 'Cite SSRN', type: 'special' },
    { importance: 'normal', name: 'Cite tech report', type: 'special' },
    { importance: 'normal', name: 'Cite thesis', type: 'special' },
    { importance: 'normal', name: 'Cite tweet', type: 'special' },
    { importance: 'normal', name: 'Citation', type: 'general' },
    { importance: 'normal', name: 'Cite document', type: 'general' },
    { importance: 'normal', name: 'Cite encyclopedia', type: 'general' },
    { importance: 'normal', name: 'Cite journal', type: 'general' },
    { importance: 'normal', name: 'Cite report', type: 'general' },
    { importance: 'normal', name: 'Cite serial', type: 'general' },
] as const satisfies readonly CitationTemplateDefinition[];

validateTemplateDefinitions(CITATION_TEMPLATE_DEFINITIONS);

export const CITATION_TEMPLATE_OPTIONS = CITATION_TEMPLATE_DEFINITIONS.map(
    function toTemplateOption(definition: CitationTemplateDefinition) {
        return {
            icon: definition.icon,
            label: definition.name,
            value: definition.name.toLowerCase(),
        };
    },
);

/**
 * Includes the current metadata-free type only while editing it.
 *
 * @param template - Template wikitext.
 * @returns Resulting values.
 */
export function getSourceDraftTemplateOptions(template: string | undefined) {
    const isStaticOption = CITATION_TEMPLATE_OPTIONS.some(
        (option) => option.value === template,
    );
    if (
        template == null ||
        isStaticOption ||
        !isMetadataFreeCitationTemplate(template)
    ) {
        return [...CITATION_TEMPLATE_OPTIONS];
    }
    const value = getCanonicalTemplateName(template);
    return [
        {
            label: value,
            value,
        },
        ...CITATION_TEMPLATE_OPTIONS,
    ];
}

/**
 * Guards the selector classification when the supported set changes.
 *
 * @param definitions - Definitions value.
 */
function validateTemplateDefinitions(
    definitions: readonly CitationTemplateDefinition[],
): void {
    const names = definitions.map((definition) => definition.name);
    const uniqueNames = new Set(names);
    const supportedNames = new Set<string>(SUPPORTED_CITATION_TEMPLATES);
    const hasEverySupportedName = SUPPORTED_CITATION_TEMPLATES.every((name) =>
        uniqueNames.has(name),
    );
    const tiersAreOrdered = definitions.every(
        function isTierOrdered(definition, index) {
            const previous = definitions[index - 1];
            return (
                previous == null ||
                getTemplateTierRank(previous) <= getTemplateTierRank(definition)
            );
        },
    );
    const groupsAreAlphabetical = definitions.every(
        isDefinitionGroupAlphabetical,
    );
    if (
        uniqueNames.size !== names.length ||
        uniqueNames.size !== supportedNames.size ||
        !hasEverySupportedName ||
        !tiersAreOrdered ||
        !groupsAreAlphabetical
    ) {
        throw new Error(
            'Citation template definitions must classify every supported ' +
                'template in tier and alphabetical order.',
        );
    }
}

/**
 * Checks one definition against the previous name in its
 * ordering group.
 *
 * @param definition - Definition value.
 * @param index - Source index.
 * @param definitions - Definitions value.
 * @returns Whether the condition is met.
 */
function isDefinitionGroupAlphabetical(
    definition: CitationTemplateDefinition,
    index: number,
    definitions: readonly CitationTemplateDefinition[],
): boolean {
    const previous = definitions[index - 1];
    return (
        previous == null ||
        getTemplateTierRank(previous) !== getTemplateTierRank(definition) ||
        previous.name.toLowerCase() <= definition.name.toLowerCase()
    );
}

/**
 * Returns the display rank for one importance and type combination.
 *
 * @param definition - Definition value.
 * @returns The display rank for one importance and type combination.
 */
function getTemplateTierRank(definition: CitationTemplateDefinition): number {
    if (definition.importance === 'important') {
        return definition.type === 'special' ? 0 : 1;
    }
    return definition.type === 'special' ? 2 : 3;
}
