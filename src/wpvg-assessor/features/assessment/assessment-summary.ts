/**
 * @file src/wpvg-assessor/features/assessment/assessment-summary.ts
 * Purpose: Builds English edit summaries independently of localized controls.
 *
 * Contents: Changed assessment labels and English edit-summary composition.
 */

import { english } from '../../i18n/index.ts';
import { createI18n } from '../../../library/i18n/messages.ts';
import { parseAssessment } from '../../domain/assessment.ts';
import projectConfig from '../../domain/project-config.ts';
import {
    NOT_VIDEO_GAME_IMPORTANCE,
    type Assessment,
    type AssessmentMaintenance,
    type SelectionMap,
} from '../../domain/types.ts';
import {
    IMPORTANCE_OPTIONS,
    KNOWN_CLASS_OPTIONS,
    MAINTENANCE_OPTIONS,
    OTHER_PROJECT_OPTIONS,
    TASK_FORCE_OPTIONS,
    type LabelledAssessmentOption,
    type LabelledAssessmentValue,
} from './assessment-options.ts';

const SUMMARY_LINK = ':m:User:For Each ... Next/global.js/vg page assessor.js';
const SUMMARY_TEXT = '🍄';
const SUMMARY_SOURCE_LINK = `[[${SUMMARY_LINK}|${SUMMARY_TEXT}]]`;
const msg = createI18n(english, {}).msg;

/**
 * Builds the default edit summary for the selected assessment.
 *
 * @param otherProjectOptions - Available secondary project labels.
 * @param originalSource - Source before the reviewed assessment changes.
 * @returns Built the default edit summary for the selected assessment.
 */
export function buildEditSummary(
    assessment: Assessment,
    otherProjectOptions?: ReadonlyArray<LabelledAssessmentOption>,
    originalSource?: string,
): string {
    const availableProjects = otherProjectOptions ?? OTHER_PROJECT_OPTIONS;
    const selectedProjects = getSelectedLabels(
        availableProjects,
        assessment.otherProjects,
        OTHER_PROJECT_OPTIONS,
    );
    const className = msg('summary.class', {
        className: getValueLabel(KNOWN_CLASS_OPTIONS, assessment.className),
    });
    if (assessment.importance === NOT_VIDEO_GAME_IMPORTANCE) {
        let summary = selectedProjects.length
            ? msg('summary.sharedAssessmentWithProjects', {
                  className,
                  projects: selectedProjects.join(', '),
              })
            : msg('summary.sharedAssessment', { className });
        const originalAssessment =
            originalSource == null
                ? null
                : parseAssessment(projectConfig, originalSource);
        if (
            originalAssessment != null &&
            originalAssessment.importance !== NOT_VIDEO_GAME_IMPORTANCE
        ) {
            summary += `; ${msg('summary.removeVideoGames')}`;
        }
        return appendSummarySourceLink(summary);
    }
    const banners = [buildVideoGamesSummary(assessment), ...selectedProjects];
    let summary;

    if (banners.length === 0) {
        summary = msg('summary.tagProjects');
    } else {
        summary = msg('summary.tagProjectsWithClass', {
            className,
            projects: banners.join(', '),
        });
    }

    return appendSummarySourceLink(summary);
}

/**
 * Builds the Video games summary fragment.
 *
 * @returns Built the Video games summary fragment.
 */
function buildVideoGamesSummary(assessment: Assessment): string {
    const details = buildVideoGamesSummaryDetails(assessment);

    if (details.length === 0) {
        return msg('summary.videoGames');
    }

    return msg('summary.videoGamesWithDetails', {
        details: details.join('; '),
    });
}

/**
 * Builds the selected Video games summary details.
 *
 * @returns Built the selected Video games summary details.
 */
function buildVideoGamesSummaryDetails(assessment: Assessment): Array<string> {
    const details: Array<string> = [];
    const taskForces = getSelectedLabels(
        TASK_FORCE_OPTIONS,
        assessment.taskForces,
    );
    const maintenance = getSelectedLabels(
        MAINTENANCE_OPTIONS,
        assessment.maintenance,
    );

    if (assessment.importance) {
        details.push(
            msg('summary.importance', {
                importance: getValueLabel(
                    IMPORTANCE_OPTIONS,
                    assessment.importance,
                ),
            }),
        );
    }

    if (taskForces.length > 0) {
        details.push(taskForces.join(', '));
    }

    if (maintenance.length > 0) {
        details.push(maintenance.join(', '));
    }

    return details;
}

/**
 * Gets the English summary label for a known assessment code.
 *
 * @param options - Localized value options.
 * @param value - Stored wikitext code.
 * @returns English label or the exact unknown source value.
 */
function getValueLabel<Value extends string>(
    options: ReadonlyArray<LabelledAssessmentValue<Value>>,
    value: Value,
): string {
    const option = options.find((option) => option.value === value);
    return option?.summaryLabel ?? option?.label ?? value;
}

/**
 * Gets selected item labels.
 *
 * @param selectedMap - Selected map value.
 * @param knownItems - Configured labels for explicitly supplied options.
 * @returns English labels, preserving unknown source project names.
 */
function getSelectedLabels(
    items: ReadonlyArray<LabelledAssessmentOption>,
    selectedMap: SelectionMap | AssessmentMaintenance,
    knownItems: ReadonlyArray<LabelledAssessmentOption> = items,
): Array<string> {
    return items
        .filter((item) => Reflect.get(selectedMap, item.id) === true)
        .map((item) => {
            const knownItem = knownItems.find(
                (option) => option.id === item.id,
            );
            return knownItem?.summaryLabel ?? item.summaryLabel ?? item.label;
        });
}

/**
 * Appends the source-code marker to an edit summary.
 *
 * @returns Resulting text.
 */
function appendSummarySourceLink(summary: string): string {
    const value = summary.trim();

    if (value.includes(SUMMARY_SOURCE_LINK)) {
        return value;
    }

    return `${value} ${SUMMARY_SOURCE_LINK}`.trim();
}
