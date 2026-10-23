/**
 * @file src/rev-copy/platform/mediawiki/context.ts
 * Purpose: Read a supported view's identity and its site/interface languages.
 *
 * Contents: Eligible page views, displayed revisions, and interface/content languages.
 */

import { identifyWikiSite } from '../../domain/wiki-site';
import type { WikiSite } from '../../domain/wiki-site';

export interface PageContext {
    pageTitle: string;
    revisionId: number;
    site: WikiSite;
    interfaceLanguage: string;
    diffOldId?: number;
}

export function getPageContext(): PageContext | null {
    const diffNewId = Number(mw.config.get('wgDiffNewId'));
    const diffOldId = Number(mw.config.get('wgDiffOldId'));
    const isDiff =
        Number.isSafeInteger(diffNewId) &&
        diffNewId > 0 &&
        Number.isSafeInteger(diffOldId) &&
        diffOldId >= 0;
    const hasDiffParameter = new URLSearchParams(location.search).has('diff');
    const candidateRevision = isDiff
        ? diffNewId
        : Number(mw.config.get('wgRevisionId'));
    const revisionId =
        Number(mw.config.get('wgNamespaceNumber')) >= 0 &&
        Number.isSafeInteger(candidateRevision) &&
        candidateRevision > 0 &&
        (!hasDiffParameter || isDiff)
            ? candidateRevision
            : 0;
    const title = mw.config.get('wgPageName');
    if (
        mw.config.get('wgAction') !== 'view' ||
        typeof title !== 'string' ||
        !title
    ) {
        return null;
    }
    const language = String(mw.config.get('wgContentLanguage') || 'en');
    const hostname = String(mw.config.get('wgServerName') || location.hostname);
    const site = identifyWikiSite(hostname, language);
    if (!site) return null;
    return {
        pageTitle: title.replace(/_/gu, ' '),
        revisionId,
        site,
        interfaceLanguage: String(
            mw.config.get('wgUserVariant') ||
                mw.config.get('wgUserLanguage') ||
                language,
        ),
        ...(isDiff ? { diffOldId } : {}),
    };
}
