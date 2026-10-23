/**
 * @file src/vg-stub-creator/features/creator/navigation.ts
 * Purpose: Selects article submission targets and post-save backlink pages.
 * Contents: Submission-title selection and WhatLinksHere titles.
 */

import { formatNamespaceTitle } from '../../../library/wiki-titles/wikipedia.ts';

/**
 * Builds the special-page title for backlinks to an article.
 *
 * @param title - Completed article title.
 * @returns WhatLinksHere special-page title.
 */
export function buildWhatLinksHerePageTitle(title: string): string {
    return formatNamespaceTitle(`WhatLinksHere/${title.trim()}`, 'zhwiki', -1);
}

/**
 * Selects the page that receives submitted article text.
 *
 * @param values - Submission title values.
 * @param values.currentPageExists - Whether the browser page exists.
 * @param values.currentTitle - Browser page title.
 * @param values.enteredTitle - Title entered in the dialog.
 * @param values.shouldMove - Whether the current page will be moved.
 * @returns Article submission title.
 */
export function selectArticleSubmissionTitle(values: {
    currentPageExists: boolean;
    currentTitle: string;
    enteredTitle: string;
    shouldMove: boolean;
}): string {
    if (values.currentPageExists || values.shouldMove) {
        return values.currentTitle.trim();
    }

    return values.enteredTitle.trim() || values.currentTitle.trim();
}
