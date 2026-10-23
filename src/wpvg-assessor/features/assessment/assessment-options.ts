/**
 * @file src/wpvg-assessor/features/assessment/assessment-options.ts
 * Purpose: Supplies localized controls and English assessment-summary labels.
 *
 * Contents: Localized choices, English summary labels, and custom-value retention.
 */

import projectConfig from '../../domain/project-config.ts';
import {
    CLASS_VALUES,
    IMPORTANCE_VALUES,
    type KnownAssessmentClass,
    type KnownAssessmentImportance,
} from '../../domain/types.ts';
import { english, msg, type MessageId } from '../../i18n/index.ts';
import { createI18n } from '../../../library/i18n/messages.ts';

export interface LabelledAssessmentOption {
    readonly id: string;
    readonly label: string;
    readonly summaryLabel?: string;
}

export interface LabelledAssessmentValue<Value extends string> {
    readonly label: string;
    readonly summaryLabel?: string;
    readonly value: Value;
}

type OtherProjectId = (typeof projectConfig.otherProjects)[number]['id'];
type TaskForceId = (typeof projectConfig.videoGames.taskForces)[number]['id'];

const summaryMsg = createI18n(english, {}).msg;

const CLASS_MESSAGE_IDS = {
    Unassessed: 'assessmentClass.unassessed',
    Substub: 'assessmentClass.substub',
    Stub: 'assessmentClass.stub',
    Start: 'assessmentClass.start',
    D: 'assessmentClass.d',
    C: 'assessmentClass.c',
    B: 'assessmentClass.b',
    'B+': 'assessmentClass.bPlus',
    GA: 'assessmentClass.ga',
    A: 'assessmentClass.a',
    FA: 'assessmentClass.fa',
    SL: 'assessmentClass.sl',
    List: 'assessmentClass.list',
    CL: 'assessmentClass.cl',
    BL: 'assessmentClass.bl',
    AL: 'assessmentClass.al',
    FL: 'assessmentClass.fl',
} as const satisfies Record<KnownAssessmentClass, MessageId>;

const HIDDEN_CLASS_VALUES = new Set<KnownAssessmentClass>([
    'Substub',
    'D',
    'B+',
    'GA',
    'A',
    'AL',
    'FA',
    'FL',
]);

const IMPORTANCE_MESSAGE_IDS = {
    '': 'common.empty',
    NotVG: 'assessmentImportance.notVideoGame',
    Low: 'assessmentImportance.low',
    Mid: 'assessmentImportance.mid',
    High: 'assessmentImportance.high',
    Top: 'assessmentImportance.top',
} as const satisfies Record<KnownAssessmentImportance, MessageId>;

const OTHER_PROJECT_MESSAGE_IDS = {
    fictionalCharacters: 'project.fictionalCharacters',
    acg: 'project.acg',
    biography: 'project.biography',
    company: 'project.company',
    films: 'project.films',
    music: 'project.music',
} as const satisfies Record<OtherProjectId, MessageId>;

const TASK_FORCE_MESSAGE_IDS = {
    pokemon: 'taskForce.pokemon',
    minecraft: 'taskForce.minecraft',
    se: 'taskForce.se',
    sega: 'taskForce.sega',
    nintendo: 'taskForce.nintendo',
    mihoyo: 'taskForce.mihoyo',
} as const satisfies Record<TaskForceId, MessageId>;

export const OTHER_PROJECT_OPTIONS = localizeOptions(
    projectConfig.otherProjects,
    OTHER_PROJECT_MESSAGE_IDS,
);

export const KNOWN_CLASS_OPTIONS = localizeValues(
    CLASS_VALUES,
    CLASS_MESSAGE_IDS,
);

export const CLASS_OPTIONS = KNOWN_CLASS_OPTIONS.filter(
    function isVisibleClass(option) {
        return !HIDDEN_CLASS_VALUES.has(option.value);
    },
);

export const IMPORTANCE_OPTIONS = localizeValues(
    IMPORTANCE_VALUES,
    IMPORTANCE_MESSAGE_IDS,
);

export const TASK_FORCE_OPTIONS = localizeOptions(
    projectConfig.videoGames.taskForces,
    TASK_FORCE_MESSAGE_IDS,
);

export const MAINTENANCE_OPTIONS = [
    {
        id: 'reassess',
        label: msg('maintenance.reassess'),
        summaryLabel: summaryMsg('maintenance.reassess'),
    },
    {
        id: 'needsInfobox',
        label: msg('maintenance.needsInfobox'),
        summaryLabel: summaryMsg('maintenance.needsInfobox'),
    },
    {
        id: 'cover',
        label: msg('maintenance.needsImage'),
        summaryLabel: summaryMsg('maintenance.needsImage'),
    },
    {
        id: 'screenshot',
        label: msg('maintenance.needsScreenshot'),
        summaryLabel: summaryMsg('maintenance.needsScreenshot'),
    },
] as const;

/**
 * Adds an exact source value when it is outside the configured choices.
 *
 * @param options - Configured localized options.
 * @param knownOptions - Labels for values outside the choices.
 * @returns Options containing the current value.
 */
export function includeAssessmentValue(
    options: ReadonlyArray<LabelledAssessmentValue<string>>,
    value: string,
    knownOptions: ReadonlyArray<LabelledAssessmentValue<string>> = options,
): Array<LabelledAssessmentValue<string>> {
    if (options.some((option) => option.value === value)) {
        return [...options];
    }
    const knownOption = knownOptions.find((option) => option.value === value);
    return [...options, { label: knownOption?.label ?? value, value }];
}

function localizeOptions<Id extends string>(
    items: ReadonlyArray<{ readonly id: Id }>,
    messageIds: Readonly<Record<Id, MessageId>>,
): Array<LabelledAssessmentOption> {
    return items.map(function localizeOption(item) {
        return {
            id: item.id,
            label: msg(messageIds[item.id]),
            summaryLabel: summaryMsg(messageIds[item.id]),
        };
    });
}

function localizeValues<Value extends string>(
    values: readonly Value[],
    messageIds: Readonly<Record<Value, MessageId>>,
): Array<LabelledAssessmentValue<Value>> {
    return values.map(function localizeValue(value) {
        return {
            label: msg(messageIds[value]),
            summaryLabel: summaryMsg(messageIds[value]),
            value,
        };
    });
}
