/**
 * @file src/source-editor/app/contracts/cs1-review.ts
 * Purpose: Defines the UI-facing contract for live CS1 review workflows.
 *
 * Table of contents:
 * 1. Imports
 * 2. Cs1ReviewContext
 * 3. Cs1CheckedSource
 * 4. Cs1ArticleReview
 * 5. Cs1ExistingSourceReview
 * 6. Cs1ReviewWorkflow
 */

import type { WikiPolicy } from '../../domain/wiki-policy.ts';
import type {
    Cs1IssueSeverity,
    Cs1ValidationResult,
} from '../../domain/cs1-validation.ts';
import type {
    ExistingSource,
    SourceDraft,
} from '../../domain/source-manager.ts';

export interface Cs1ReviewContext {
    wikiPolicy?: WikiPolicy;
    pageTitle: string;
}

export interface Cs1CheckedSource {
    html: string;
    messages: string[];
    severity: Cs1IssueSeverity;
    source: ExistingSource;
}

export interface Cs1ArticleReview {
    messages: string[];
    sources: Cs1CheckedSource[];
}

export interface Cs1ExistingSourceReview {
    checkedSource: Cs1CheckedSource | undefined;
    validation: Cs1ValidationResult;
}

export interface Cs1ReviewWorkflow {
    checkArticleSources: (
        sources: ExistingSource[],
        context: Cs1ReviewContext,
    ) => Promise<Cs1ArticleReview>;
    checkExistingSourceDraft: (
        draft: SourceDraft,
        source: ExistingSource,
        context: Cs1ReviewContext,
    ) => Promise<Cs1ExistingSourceReview>;
    checkNewSourceDraft: (
        draft: SourceDraft,
        context: Cs1ReviewContext,
    ) => Promise<Cs1ValidationResult>;
    restoreCheckedSource: (
        source: ExistingSource,
        html: string,
        categories?: readonly string[],
    ) => Cs1CheckedSource | null;
}
