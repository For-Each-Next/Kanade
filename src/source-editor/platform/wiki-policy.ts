/**
 * @file src/source-editor/platform/wiki-policy.ts
 * Purpose: Resolve article rules from the current MediaWiki project's identity.
 *
 * Contents: Current-wiki policy adapter.
 */

import { resolveWikiPolicy, type WikiPolicy } from '../domain/wiki-policy.ts';

export function getCurrentWikiId(): string {
    const wikiId = mw.config.get('wgWikiID');
    const database = mw.config.get('wgDBname');
    return typeof wikiId === 'string' && wikiId !== ''
        ? wikiId
        : typeof database === 'string'
          ? database
          : '';
}

export function getCurrentWikiPolicy(): WikiPolicy {
    return resolveWikiPolicy(getCurrentWikiId());
}

/** Read content language independently of the user's interface locale. */
export function getCurrentContentLanguage(): string | undefined {
    const language = mw.config.get('wgContentLanguage');
    if (typeof language === 'string' && language.trim()) return language;
    const wikiId = getCurrentWikiId();
    return wikiId === 'enwiki' ? 'en' : wikiId === 'zhwiki' ? 'zh' : undefined;
}
