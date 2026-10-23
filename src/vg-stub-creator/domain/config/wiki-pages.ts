/**
 * @file src/vg-stub-creator/domain/config/wiki-pages.ts
 * Purpose: Defines stable project page titles for article workflows.
 * Contents: Chinese Wikipedia project page identifiers.
 */

import { formatNamespaceTitle } from '../../../library/wiki-titles/wikipedia.ts';

/** Stable wiki page titles shared by workflows and adapters. */
export const NEW_PAGE_LIST_TITLE = formatNamespaceTitle(
    '电子游戏/新进条目',
    'zhwiki',
    102,
);
