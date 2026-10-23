/**
 * @file src/rev-copy/app/main.ts
 * Purpose: Coordinate page/section links, attribution, revision lookup, and clipboard feedback.
 *
 * Contents: Page identity, content remounts, revision lookup, and copy workflow composition.
 */

import { generateAttribution } from '../domain/attribution';
import { buildPageLink, buildRevisionLinks } from '../domain/revision-links';
import type { RevisionLinks } from '../domain/revision-links';
import { normalizeHomeWiki } from '../domain/wiki-site';
import { createAdvancedCopy } from '../features/advanced-copy/dialog';
import { createRevisionRow } from '../features/revision-row/row';
import type { RevisionRow } from '../features/revision-row/row';
import css from '../features/revision-row/row.css';
import { createSectionLinks } from '../features/section-links/controller';
import sectionCss from '../features/section-links/styles.css';
import { getMessages } from '../i18n';
import { copyText } from '../platform/browser/clipboard';
import { mountBeforeContent } from '../platform/browser/content-boundary';
import { getPageContext } from '../platform/mediawiki/context';
import type { PageContext } from '../platform/mediawiki/context';
import { resolveAttributionPages } from '../platform/mediawiki/attribution';
import { notifyCopySuccess } from '../platform/mediawiki/notification';
import { loadCodex } from '../platform/mediawiki/codex.ts';
import { getRevisionTimestamp } from '../platform/mediawiki/revision';

function pageIdentity(page: PageContext | null): string {
    return page
        ? `${page.site.interwiki}/${page.pageTitle}/${page.revisionId}/${page.diffOldId ?? ''}/${page.site.language}/${page.interfaceLanguage}`
        : '';
}

export function init(): void {
    const homeWiki = normalizeHomeWiki(window.revCopyConfig?.homeWiki);
    let generation = 0;
    let row: RevisionRow | undefined;
    let revisionPending = false;
    let sections: ReturnType<typeof createSectionLinks> | undefined;
    let advanced: ReturnType<typeof createAdvancedCopy> | undefined;
    let sectionContainer: HTMLElement | null = null;
    let identity = '';
    const refresh = (): void => {
        const page = getPageContext();
        const nextIdentity = pageIdentity(page);
        // Content hooks also fire for previews and popups; retain pending work and live rows.
        const content = document.getElementById('mw-content-text');
        if (
            (row?.element.isConnected || revisionPending) &&
            nextIdentity === identity &&
            content === sectionContainer
        ) {
            sections?.refresh();
            return;
        }
        generation++;
        advanced?.dispose();
        advanced = undefined;
        sections?.dispose();
        sections = undefined;
        sectionContainer = null;
        row?.element.remove();
        row = undefined;
        revisionPending = false;
        identity = nextIdentity;
        if (!page) return;
        const messages = getMessages(page.interfaceLanguage);
        const currentGeneration = generation;
        const pageLink = buildPageLink(page.pageTitle, page.site, homeWiki);
        let links: RevisionLinks | undefined;
        const copy = async (text: string): Promise<void> => {
            try {
                await copyText(text);
                if (
                    generation === currentGeneration &&
                    currentRow.element.isConnected
                ) {
                    void notifyCopySuccess(messages.copied);
                }
            } catch (error) {
                if (
                    generation === currentGeneration &&
                    currentRow.element.isConnected
                ) {
                    mw.notify(messages.copyFailed, {
                        type: 'error',
                        tag: 'rev-copy',
                    });
                }
                console.error('[Revision Copy] Clipboard failed', error);
            }
        };
        const load = async (): Promise<void> => {
            let timestamp: string | undefined;
            try {
                timestamp = await getRevisionTimestamp(page.revisionId);
                if (generation !== currentGeneration || row !== currentRow)
                    return;
                links = buildRevisionLinks({ ...page, timestamp, homeWiki });
                currentRow.setLinks(links);
            } catch (error) {
                if (generation !== currentGeneration || row !== currentRow)
                    return;
                timestamp = undefined;
                console.error('[Revision Copy] Revision lookup failed', error);
            }
            mount(timestamp);
        };
        const currentAdvanced = createAdvancedCopy({
            loadRuntime: loadCodex,
            notifyCopySuccess,
            messages,
            currentPageTitle: page.pageTitle,
            currentSitePrefix: page.site.interwiki,
            async generate(fromInput, toInput, options) {
                const { from, to } = await resolveAttributionPages(
                    fromInput,
                    toInput,
                    page,
                    options.notice,
                );
                return {
                    wikitext: generateAttribution(from, to, {
                        ...options,
                        interfaceLanguage: page.interfaceLanguage,
                    }),
                    fromTitle: from.pageTitle,
                    toTitle: to.pageTitle,
                };
            },
            copy: copyText,
        });
        const currentRow = createRevisionRow({
            title: page.pageTitle,
            pageLink,
            pageUrl: mw.util.getUrl(page.pageTitle),
            permalinkUrl: mw.util.getUrl(
                page.diffOldId === undefined
                    ? `Special:PermaLink/${page.revisionId}`
                    : page.diffOldId > 0
                      ? `Special:Diff/${page.diffOldId}/${page.revisionId}`
                      : `Special:Diff/${page.revisionId}`,
            ),
            messages,
            displayWikitext: window.revCopyConfig?.displayWikitext !== false,
            advanced: () => currentAdvanced.open(),
            copy: () => copy(links?.all ?? pageLink),
        });
        const mount = (timestamp?: string): void => {
            if (generation !== currentGeneration || row !== currentRow) return;
            revisionPending = false;
            if (
                content !== document.getElementById('mw-content-text') ||
                nextIdentity !== pageIdentity(getPageContext()) ||
                !mountBeforeContent(currentRow.element)
            ) {
                currentAdvanced.dispose();
                advanced = undefined;
                row = undefined;
                sectionContainer = null;
                return;
            }
            if (content) {
                sections = createSectionLinks({
                    container: content,
                    includePageHeading: true,
                    pageTitle: page.pageTitle,
                    site: page.site,
                    homeWiki,
                    messages,
                    copy,
                    advanced: (sectionId) => currentAdvanced.open(sectionId),
                });
                if (timestamp)
                    sections.setRevision({
                        revisionId: page.revisionId,
                        timestamp,
                        ...(page.diffOldId !== undefined
                            ? { diffOldId: page.diffOldId }
                            : {}),
                    });
            }
        };
        row = currentRow;
        revisionPending = page.revisionId > 0;
        advanced = currentAdvanced;
        sectionContainer = content;
        if (!document.getElementById('kanade-rev-copy-styles')) {
            const style = document.createElement('style');
            style.id = 'kanade-rev-copy-styles';
            style.textContent = `${css}\n${sectionCss}`;
            document.head.append(style);
        }
        if (revisionPending) void load();
        else mount();
    };
    mw.hook('wikipage.content').add(refresh);
    refresh();
}
