/**
 * @file src/wpvg-assessor/features/assessment/components/wikitext-comparison.ts
 * Purpose: MediaWiki-styled rendering for structured wikitext comparisons.
 *
 * Contents: Comparison component, source rows, and scoped build assets.
 */

import type { VueModule } from '../codex.ts';
import type { WikitextComparison } from '../../../domain/wikitext-comparison.ts';

export interface WikitextComparisonProps {
    afterLabel: string;
    beforeLabel: string;
    comparison: WikitextComparison;
    label: string;
    noChangesLabel: string;
}

const WIKITEXT_COMPARISON_TEMPLATE =
    typeof __WPVG_ASSESSOR_WIKITEXT_COMPARISON_TEMPLATE__ === 'undefined'
        ? ''
        : __WPVG_ASSESSOR_WIKITEXT_COMPARISON_TEMPLATE__;

export const WIKITEXT_COMPARISON_STYLES =
    typeof __WPVG_ASSESSOR_WIKITEXT_COMPARISON_STYLES__ === 'undefined'
        ? ''
        : __WPVG_ASSESSOR_WIKITEXT_COMPARISON_STYLES__;

/**
 * Creates a reusable MediaWiki-style comparison component.
 *
 * @returns MediaWiki-style wikitext comparison component.
 */
export function createWikitextComparisonComponent(Vue: VueModule): unknown {
    return Vue.defineComponent({
        name: 'WpvgAssessorWikitextComparison',
        props: {
            afterLabel: { required: true, type: String },
            beforeLabel: { required: true, type: String },
            comparison: { required: true, type: Object },
            label: { required: true, type: String },
            noChangesLabel: { required: true, type: String },
        },
        template: WIKITEXT_COMPARISON_TEMPLATE,
    });
}
