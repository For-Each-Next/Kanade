/**
 * @file src/source-editor/app/workflows/cs1-review.ts
 * Purpose: Orchestrates live CS1 checks for source-review workflows.
 *
 * Table of contents:
 * 1. Imports
 * 2. Cs1CheckResult
 * 3. Cs1ReviewDependencies
 * 4. Exports
 * 5. createCs1ReviewWorkflow
 * 6. checkArticleSources
 * 7. checkNewSourceDraft
 * 8. checkExistingSourceDraft
 * 9. restoreCheckedSource
 * 10. mapCs1CheckedSources
 */

import {
    extractCs1FragmentIssues,
    extractCs1IssueMessages,
    orderCs1ItemsBySeverity,
    parseCs1ValidationResult,
    type Cs1ValidationResult,
} from '../../domain/cs1-validation.ts';
import {
    serializeSourceDraft,
    type ExistingSource,
    type SourceDraft,
} from '../../domain/source-manager.ts';
import type {
    Cs1ArticleReview,
    Cs1CheckedSource,
    Cs1ExistingSourceReview,
    Cs1ReviewContext,
    Cs1ReviewWorkflow,
} from '../contracts/cs1-review.ts';

interface Cs1CheckResult {
    categories: string[];
    html: string;
}

export interface Cs1ReviewDependencies {
    buildCheckWikitext: (sources: readonly { rawTemplate: string }[]) => string;
    requestCheck: (
        text: string,
        context: Cs1ReviewContext,
    ) => Promise<Cs1CheckResult>;
    splitCheckHtml: (html: string, sourceCount: number) => string[];
}

export type {
    Cs1ArticleReview,
    Cs1CheckedSource,
    Cs1ExistingSourceReview,
    Cs1ReviewContext,
    Cs1ReviewWorkflow,
} from '../contracts/cs1-review.ts';

/**
 * Creates a CS1 review workflow from browser adapter contracts.
 *
 * @param dependencies - Dependencies value.
 * @returns Created CS1 review workflow from browser adapter contracts.
 */
export function createCs1ReviewWorkflow(
    dependencies: Cs1ReviewDependencies,
): Cs1ReviewWorkflow {
    return {
        checkArticleSources(sources, context) {
            return checkArticleSources(dependencies, sources, context);
        },
        checkExistingSourceDraft(draft, source, context) {
            return checkExistingSourceDraft(
                dependencies,
                draft,
                source,
                context,
            );
        },
        checkNewSourceDraft(draft, context) {
            return checkNewSourceDraft(dependencies, draft, context);
        },
        restoreCheckedSource,
    };
}

/**
 * Checks all supported article sources in one parse request.
 *
 * @param dependencies - Dependencies value.
 * @param sources - Sources value.
 * @param context - Context value.
 * @returns Operation result.
 */
async function checkArticleSources(
    dependencies: Cs1ReviewDependencies,
    sources: ExistingSource[],
    context: Cs1ReviewContext,
): Promise<Cs1ArticleReview> {
    const text = dependencies.buildCheckWikitext(sources);
    const response = await dependencies.requestCheck(text, context);
    const checkedSources = mapCs1CheckedSources(
        dependencies,
        response.html,
        response.categories,
        sources,
    );
    const sourceMessages = new Set(
        checkedSources.flatMap((checked) => checked.messages),
    );
    return {
        messages: extractCs1IssueMessages('', response.categories).filter(
            (message) => !sourceMessages.has(message),
        ),
        sources: checkedSources,
    };
}

/**
 * Checks one unsaved draft without wrapping it in an article batch.
 *
 * @param dependencies - Dependencies value.
 * @param draft - Source draft to process.
 * @param context - Context value.
 * @returns Operation result.
 */
async function checkNewSourceDraft(
    dependencies: Cs1ReviewDependencies,
    draft: SourceDraft,
    context: Cs1ReviewContext,
): Promise<Cs1ValidationResult> {
    const text = serializeSourceDraft(draft, 'inline', context.wikiPolicy);
    const response = await dependencies.requestCheck(text, context);
    return parseCs1ValidationResult(draft, response.html, response.categories);
}

/**
 * Rechecks an applied source and retains its batch fragment.
 *
 * @param dependencies - Dependencies value.
 * @param draft - Source draft to process.
 * @param source - Source text.
 * @param context - Context value.
 * @returns Operation result.
 */
async function checkExistingSourceDraft(
    dependencies: Cs1ReviewDependencies,
    draft: SourceDraft,
    source: ExistingSource,
    context: Cs1ReviewContext,
): Promise<Cs1ExistingSourceReview> {
    const response = await dependencies.requestCheck(
        dependencies.buildCheckWikitext([source]),
        context,
    );
    const [checkedSource] = mapCs1CheckedSources(
        dependencies,
        response.html,
        response.categories,
        [source],
    );
    return {
        checkedSource,
        validation: parseCs1ValidationResult(
            draft,
            checkedSource?.html ?? '',
            response.categories,
        ),
    };
}

/**
 * Restores a checked source from isolated HTML.
 *
 * @param source - Source text.
 * @param html - Html value.
 * @param categories - Categories value.
 * @returns Operation result.
 */
function restoreCheckedSource(
    source: ExistingSource,
    html: string,
    categories: readonly string[] = [],
): Cs1CheckedSource | null {
    const issues = extractCs1FragmentIssues(html, categories);
    if (issues.length === 0) {
        return null;
    }
    return {
        html,
        messages: issues.map((issue) => issue.message),
        severity: issues.some((issue) => issue.severity === 'error')
            ? 'error'
            : 'maintenance',
        source,
    };
}

/**
 * Maps isolated batch fragments back to their source records.
 *
 * @param dependencies - Dependencies value.
 * @param html - Html value.
 * @param categories - Categories value.
 * @param sources - Sources value.
 * @returns Batch fragments mapped to their source records.
 */
function mapCs1CheckedSources(
    dependencies: Cs1ReviewDependencies,
    html: string,
    categories: readonly string[],
    sources: ExistingSource[],
): Cs1CheckedSource[] {
    const fragments = dependencies.splitCheckHtml(html, sources.length);
    const checked = sources.flatMap(function getCheckedSource(source, index) {
        const checked = restoreCheckedSource(
            source,
            fragments[index] ?? '',
            categories,
        );
        return checked == null ? [] : [checked];
    });
    return orderCs1ItemsBySeverity(checked);
}
