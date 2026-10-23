/**
 * @file src/wpvg-assessor/types/globals.d.ts
 * Purpose: Build globals and template context for Article Assessor.
 *
 * Contents: Build-time component assets and Vue template declarations.
 */

import type * as Dialog from '../features/assessment/dialogs/assessment-dialog.ts';
import type * as Comparison from '../features/assessment/components/wikitext-comparison.ts';
import type * as Category from '../features/assessment/dialogs/category-dialog.ts';
import type * as Archive from '../features/archive/dialogs/archive-dialog.ts';

type RawTemplateContext = ReturnType<
    typeof Dialog.createAssessmentDialogBindings
>;
type TemplateContext = {
    [Key in keyof RawTemplateContext]: RawTemplateContext[Key] extends {
        value: infer Value;
    }
        ? Value
        : RawTemplateContext[Key];
};
type RawCategoryContext = ReturnType<
    typeof Category.createCategoryDialogBindings
>;
type CategoryTemplateContext = {
    [Key in keyof RawCategoryContext]: RawCategoryContext[Key] extends {
        value: infer Value;
    }
        ? Value
        : RawCategoryContext[Key];
};
type RawArchiveContext = ReturnType<typeof Archive.createArchiveDialogBindings>;
type ArchiveTemplateContext = {
    [Key in keyof RawArchiveContext]: RawArchiveContext[Key] extends {
        value: infer Value;
    }
        ? Value
        : RawArchiveContext[Key];
};

declare global {
    const __WPVG_ASSESSOR_ARCHIVE_DIALOG_TEMPLATE__: string;
    const __WPVG_ASSESSOR_ARCHIVE_DIALOG_STYLES__: string;
    const __WPVG_ASSESSOR_DIALOG_TEMPLATE__: string;
    const __WPVG_ASSESSOR_DIALOG_STYLES__: string;
    const __WPVG_ASSESSOR_LOADING_DIALOG_TEMPLATE__: string;
    const __WPVG_ASSESSOR_LOADING_DIALOG_STYLES__: string;
    const __WPVG_ASSESSOR_WIKITEXT_COMPARISON_TEMPLATE__: string;
    const __WPVG_ASSESSOR_WIKITEXT_COMPARISON_STYLES__: string;
    const __WPVG_ASSESSOR_CATEGORY_DIALOG_TEMPLATE__: string;
    const __WPVG_ASSESSOR_CATEGORY_DIALOG_STYLES__: string;
}

declare module '@vue/runtime-core' {
    interface GlobalComponents {
        WikitextComparison: new () => {
            $props: Comparison.WikitextComparisonProps;
        };
    }

    interface ComponentCustomProperties
        extends
            TemplateContext,
            CategoryTemplateContext,
            ArchiveTemplateContext,
            Comparison.WikitextComparisonProps {}
}

export {};
