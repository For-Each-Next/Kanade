/**
 * @file src/source-editor/platform/mediawiki/editor-context.ts
 * Purpose: Reads editor state exposed by the current MediaWiki page.
 *
 * Table of contents:
 * 1. getDatabaseName
 * 2. isSectionEditing
 */

import { getCurrentWikiId } from '../wiki-policy.ts';

export function getDatabaseName(): string {
    return getCurrentWikiId();
}

export function isSectionEditing(): boolean {
    if (mw.config.get('wgEditMessage') === 'editingsection') {
        return true;
    }
    const section = document.querySelector<HTMLInputElement>(
        'input[name="wpSection"]',
    );
    return section != null && section.value !== '';
}
