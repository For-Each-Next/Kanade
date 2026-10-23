/**
 * @file src/rev-copy/domain/page-reference.ts
 * Purpose: Parse attribution inputs into validated Wikimedia page identities.
 *
 * Contents: Reference types, safe API endpoints, prefixes, and URL parsing.
 */

import {
    identifyWikiSite,
    normalizeWikiAlias,
    projectHosts,
    sharedHosts,
} from './wiki-site';
import type { WikiSite } from './wiki-site';

export interface ReferenceContext {
    site: WikiSite;
    pageTitle: string;
    revisionId: number;
}

export interface PageReference {
    site: WikiSite;
    pageTitle?: string;
    revisionId?: number;
    sectionId?: string;
}

export interface AttributionPage extends PageReference {
    pageTitle: string;
    timestamp?: string;
}

const languagePattern = /^(?:[a-z]{2,3}|simple)(?:-[a-z0-9]{2,12})*$/u;
const localAliases = new Set(['wp', 'wt', 'h']);

/** Reconstruct the endpoint; user URLs never become request destinations. */
export function getWikiApiUrl(site: WikiSite): string {
    const shared = sharedHosts.get(normalizeWikiAlias(site.interwiki));
    if (shared) return `https://${shared}/w/api.php`;
    const [project, language, extra] = site.interwiki.split(':');
    const host = projectHosts.get(project);
    if (!host || !languagePattern.test(language ?? '') || extra !== undefined) {
        throw new Error('Unsupported Wikimedia site.');
    }
    return `https://${language}.${host}.org/w/api.php`;
}

function revisionId(value: string): number {
    if (!/^[1-9]\d*$/u.test(value) || !Number.isSafeInteger(Number(value))) {
        throw new Error('Enter a positive numeric revision ID.');
    }
    return Number(value);
}

function decode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        throw new Error('The page link contains invalid percent encoding.');
    }
}

function titleReference(
    title: string,
    site: WikiSite,
    sectionId?: string,
    suppliedRevision?: number,
): PageReference {
    const pageTitle = title.replace(/_/gu, ' ').trim();
    if (/[\u0000-\u001f\u007f|\[\]{}<>]/u.test(pageTitle)) {
        throw new Error('Enter a valid page title.');
    }
    const permalink = /^Special:PermaLink\/(.*)$/iu.exec(pageTitle);
    const permanentRevision = permalink ? revisionId(permalink[1]) : undefined;
    if (
        permanentRevision !== undefined &&
        suppliedRevision !== undefined &&
        permanentRevision !== suppliedRevision
    ) {
        throw new Error('The page link contains conflicting revision IDs.');
    }
    return {
        site,
        ...(pageTitle && !permalink ? { pageTitle } : {}),
        ...(permanentRevision !== undefined || suppliedRevision !== undefined
            ? { revisionId: permanentRevision ?? suppliedRevision }
            : {}),
        ...(sectionId ? { sectionId } : {}),
    };
}

function parseUrl(input: string): PageReference {
    let url: URL;
    try {
        url = new URL(input.startsWith('//') ? `https:${input}` : input);
    } catch {
        throw new Error('Enter a valid Wikimedia page URL.');
    }
    const hostLanguage = url.hostname.replace(/\.m\./u, '.').split('.')[0];
    const site = identifyWikiSite(url.hostname, hostLanguage);
    if (
        !site ||
        !['https:', 'http:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.port
    ) {
        throw new Error('Use a page URL from a supported Wikimedia wiki.');
    }
    getWikiApiUrl(site);
    if (
        url.searchParams.has('diff') ||
        url.searchParams.getAll('oldid').length > 1 ||
        url.searchParams.getAll('title').length > 1
    ) {
        throw new Error(
            'Use a page or permanent revision URL, not a diff URL.',
        );
    }
    const oldid = url.searchParams.get('oldid');
    const suppliedRevision = oldid === null ? undefined : revisionId(oldid);
    let title: string;
    if (url.pathname.startsWith('/wiki/')) {
        title = decode(url.pathname.slice('/wiki/'.length));
    } else if (url.pathname === '/w/index.php') {
        title = url.searchParams.get('title') ?? '';
    } else {
        throw new Error('Use a Wikimedia article or permanent revision URL.');
    }
    const result = titleReference(
        title,
        site,
        decode(url.hash.slice(1)),
        suppliedRevision,
    );
    if (!result.pageTitle && !result.revisionId) {
        throw new Error('The page URL has no title or revision ID.');
    }
    return result;
}

function parsePrefixedTitle(
    title: string,
): { site: WikiSite; title: string } | undefined {
    const explicitTitle = title.startsWith(':');
    title = title.replace(/^:/u, '');
    const segments = title.split(':');
    const prefix = segments[0].toLowerCase();
    // Bare lowercase codes are shortcuts; a leading colon keeps literal titles.
    if (
        !explicitTitle &&
        languagePattern.test(title) &&
        !localAliases.has(title)
    ) {
        return {
            site: { interwiki: `w:${title}`, language: title },
            title: '',
        };
    }
    if (sharedHosts.has(normalizeWikiAlias(prefix)) && segments.length > 1) {
        return {
            site: { interwiki: normalizeWikiAlias(prefix), language: 'en' },
            title: segments.slice(1).join(':'),
        };
    }
    if (
        projectHosts.has(prefix) &&
        segments.length > 2 &&
        languagePattern.test(segments[1].toLowerCase())
    ) {
        const language = segments[1].toLowerCase();
        return {
            site: { interwiki: `${prefix}:${language}`, language },
            title: segments.slice(2).join(':'),
        };
    }
    if (
        segments.length > 1 &&
        languagePattern.test(prefix) &&
        !localAliases.has(prefix)
    ) {
        return {
            site: { interwiki: `w:${prefix}`, language: prefix },
            title: segments.slice(1).join(':'),
        };
    }
    return undefined;
}

/** Combines the dialog's separate site and page fields for the existing resolver. */
export function combinePageReferenceInput(
    prefix: string,
    page: string,
    currentSitePrefix?: string,
    fallbackPrefix = '',
): string {
    const value = page.trim();
    // A pasted URL already identifies its wiki and exact revision.
    if (/^(?:https?:\/\/|\/\/)/iu.test(value)) return value;
    const enteredPrefix = prefix.trim();
    if (!enteredPrefix && parsePrefixedTitle(value.split('#', 1)[0])) {
        return value;
    }
    const site = (enteredPrefix || fallbackPrefix)
        .trim()
        .replace(/^:|:$/gu, '')
        .toLowerCase();
    if (!site) return value;
    const [project, language, extra] = site.split(':');
    const valid =
        sharedHosts.has(normalizeWikiAlias(site)) ||
        (languagePattern.test(site) && !localAliases.has(site)) ||
        (projectHosts.has(project) &&
            languagePattern.test(language ?? '') &&
            extra === undefined);
    if (!valid) throw new Error('Enter a supported Wikimedia site prefix.');
    // Selecting the host wiki without a title keeps its displayed revision.
    if (
        currentSitePrefix &&
        site.replace(/^w:/u, '') === currentSitePrefix.replace(/^w:/u, '') &&
        (!value || value.startsWith('#'))
    ) {
        return value;
    }
    return `${site}:${value.replace(/^:/u, '')}`;
}

export function parsePageReference(
    input: string,
    current: ReferenceContext,
): PageReference {
    const value = input.trim();
    if (!value || value.startsWith('#')) {
        return {
            site: current.site,
            pageTitle: current.pageTitle,
            ...(Number.isSafeInteger(current.revisionId) &&
            current.revisionId > 0
                ? { revisionId: current.revisionId }
                : {}),
            ...(value.slice(1) ? { sectionId: value.slice(1) } : {}),
        };
    }
    if (/^(?:[a-z][a-z0-9+.-]*:\/\/|\/\/)/iu.test(value)) {
        return parseUrl(value);
    }
    if (
        /^(?:https?|javascript):/iu.test(value) ||
        /^file:\//iu.test(value) ||
        /^data:(?:[^,]*\/[^,]*|;[^,]*)?,/iu.test(value)
    ) {
        throw new Error('Enter a valid Wikimedia page URL or page title.');
    }
    const hash = value.indexOf('#');
    const title = hash === -1 ? value : value.slice(0, hash);
    const sectionId = hash === -1 ? undefined : value.slice(hash + 1);
    const prefixed = parsePrefixedTitle(title);
    const site = prefixed?.site ?? current.site;
    getWikiApiUrl(site);
    return titleReference(
        prefixed?.title ?? title.replace(/^:/u, ''),
        site,
        sectionId,
    );
}
