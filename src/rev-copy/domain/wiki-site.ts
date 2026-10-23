/**
 * @file src/rev-copy/domain/wiki-site.ts
 * Purpose: Identify Wikimedia sites and qualify links relative to a home wiki.
 *
 * Contents: Shared project definitions, site identities, aliases, and relative link prefixes.
 */

export interface WikiSite {
    /** A destination such as w:en or c, without a trailing colon. */
    interwiki: string;
    language: string;
}

export const projectHosts: ReadonlyMap<string, string> = new Map([
    ['w', 'wikipedia'],
    ['wikt', 'wiktionary'],
    ['b', 'wikibooks'],
    ['n', 'wikinews'],
    ['q', 'wikiquote'],
    ['s', 'wikisource'],
    ['v', 'wikiversity'],
    ['voy', 'wikivoyage'],
]);
export const sharedHosts: ReadonlyMap<string, string> = new Map([
    ['c', 'commons.wikimedia.org'],
    ['m', 'meta.wikimedia.org'],
    ['species', 'species.wikimedia.org'],
    ['d', 'www.wikidata.org'],
    ['mw', 'www.mediawiki.org'],
]);
const projects = new Map(
    Array.from(projectHosts, ([prefix, host]) => [host, prefix]),
);
const multilingualSites = new Map(
    Array.from(sharedHosts).flatMap(([prefix, host]) => [
        [host, prefix],
        [host.replace(/^www\./u, ''), prefix],
    ]),
);
const interwikiAliases = new Map([
    ['commons', 'c'],
    ['meta', 'm'],
]);

export function normalizeWikiAlias(interwiki: string): string {
    return interwikiAliases.get(interwiki) ?? interwiki;
}

export function identifyWikiSite(
    hostname: string,
    language: string,
): WikiSite | null {
    const host = hostname
        .toLowerCase()
        .replace(/\.m\./u, '.')
        .replace(/^m\./u, '');
    const shared = multilingualSites.get(host);
    if (shared) return { interwiki: shared, language };
    const match = /^([a-z][a-z0-9-]*)\.(\w+)\.org$/u.exec(host);
    if (!match || match[1] === 'www') return null;
    const project = projects.get(match[2]);
    return project ? { interwiki: `${project}:${match[1]}`, language } : null;
}

export function normalizeHomeWiki(homeWiki = 'w:zh'): string {
    const entered = homeWiki.trim().toLowerCase().replace(/:$/u, '');
    const normalized = normalizeWikiAlias(entered);
    const languageProject = /^([a-z]+):([a-z][a-z0-9-]*)$/u.exec(normalized);
    if (languageProject) {
        const project = projects.get(languageProject[1]) ?? languageProject[1];
        if (projectHosts.has(project)) {
            return `${project}:${languageProject[2]}`;
        }
    }
    if (sharedHosts.has(normalized)) return normalized;
    throw new Error(`Unsupported home wiki: ${homeWiki}`);
}

export function getInterwikiPrefix(site: WikiSite, homeWiki = 'w:zh'): string {
    const interwiki = normalizeWikiAlias(site.interwiki);
    return interwiki === normalizeHomeWiki(homeWiki) ? '' : `${interwiki}:`;
}
