/**
 * @file src/wpvg-assessor/platform/browser/source-links.ts
 * Purpose: Add assessment launches to supported result links and consume them once.
 * Contents: Scoped link decoration, navigation lifecycle, and launch consumption.
 */

import {
    ASSESSOR_LAUNCHER_PARAMETER,
    getAssessorDestinationHref,
    getAssessorSourceKind,
    removeAssessorLauncherParameter,
} from '../../domain/source-links.ts';

const SOURCE_LINK_KEY = Symbol.for('kanade.wpvg-assessor.source-links');
const consumedLaunchers = new WeakSet<Window>();
const NAVIGATION_SELECTOR = [
    'nav',
    'header',
    'footer',
    'aside',
    "[role='navigation']",
    "[role='banner']",
    '.navbox',
    '.vertical-navbox',
    '.sidebar',
    '.mw-editsection',
    '.mw-portlet',
    '.mw-jump-link',
    '#mw-navigation',
    '#footer',
    '.toc',
    '#toc',
].join(', ');

/** Consume the launch after host page checks pass, before opening the UI. */
export function consumeAssessorLauncher(view: Window): boolean {
    const url = new URL(view.location.href);
    if (
        consumedLaunchers.has(view) ||
        url.origin !== 'https://zh.wikipedia.org' ||
        url.searchParams.getAll(ASSESSOR_LAUNCHER_PARAMETER).length !== 1 ||
        url.searchParams.get(ASSESSOR_LAUNCHER_PARAMETER) !== '1'
    ) {
        return false;
    }
    consumedLaunchers.add(view);
    removeAssessorLauncherParameter(url);
    try {
        view.history.replaceState(view.history.state, '', url.href);
    } catch {
        // Restricted history must not suppress a requested launch.
    }
    return true;
}

/** Decorate result links without replacing clicks, targets, or page content. */
export function installAssessorSourceLinks(
    view: Window,
    doc: Document,
): () => void {
    const sourceKind = getAssessorSourceKind(view.location.href);
    if (sourceKind == null) return () => {};
    const owner = view as unknown as Record<PropertyKey, unknown>;
    const existing = owner[SOURCE_LINK_KEY];
    if (typeof existing === 'function') return existing as () => void;
    const scope =
        sourceKind === 'wiki'
            ? '#mw-content-text, .mw-parser-output'
            : '#main_results, #results, #output, table';
    const activationEvents = [
        'pointerdown',
        'click',
        'auxclick',
        'contextmenu',
    ];
    let disposed = false;

    function decorateAnchor(anchor: HTMLAnchorElement): void {
        if (
            !anchor.closest(scope) ||
            anchor.closest(NAVIGATION_SELECTOR) ||
            (sourceKind === 'wiki' && anchor.closest('form')) ||
            anchor.classList.contains('new') ||
            anchor.hasAttribute('download')
        ) {
            return;
        }
        const href = getAssessorDestinationHref(
            anchor.getAttribute('href'),
            anchor.baseURI || doc.baseURI || view.location.href,
        );
        if (href != null && href !== anchor.href) {
            anchor.setAttribute('href', href);
        }
    }

    function decorateTree(root: Node): void {
        if (root.nodeType === 1) {
            const element = root as Element;
            if (element.matches('a[href]')) {
                decorateAnchor(element as HTMLAnchorElement);
            }
        }
        if ('querySelectorAll' in root) {
            for (const anchor of (
                root as ParentNode
            ).querySelectorAll<HTMLAnchorElement>('a[href]')) {
                decorateAnchor(anchor);
            }
        }
    }

    function isCurrent(): boolean {
        if (disposed) return false;
        if (getAssessorSourceKind(view.location.href) !== sourceKind) {
            dispose();
            return false;
        }
        return true;
    }

    const Observer = doc.defaultView?.MutationObserver;
    const observer =
        Observer == null
            ? null
            : new Observer((records) => {
                  if (!isCurrent()) return;
                  for (const record of records) {
                      if (record.type === 'attributes')
                          decorateTree(record.target);
                      else
                          for (const node of record.addedNodes)
                              decorateTree(node);
                  }
              });

    function onLinkActivation(event: Event): void {
        if (!isCurrent()) return;
        const target = event.target as Node | null;
        const element =
            target?.nodeType === 1
                ? (target as Element)
                : target?.parentElement;
        const anchor = element?.closest<HTMLAnchorElement>('a[href]');
        if (anchor != null) decorateAnchor(anchor);
    }

    function resume(): void {
        if (!isCurrent()) return;
        decorateTree(doc);
        // Observe the Document so replacing its root cannot orphan the owner.
        observer?.observe(doc, {
            attributeFilter: ['href'],
            attributes: true,
            childList: true,
            subtree: true,
        });
    }

    function onPageHide(event: PageTransitionEvent): void {
        observer?.disconnect();
        if (!event.persisted) dispose();
    }

    function dispose(): void {
        disposed = true;
        observer?.disconnect();
        doc.removeEventListener('DOMContentLoaded', resume);
        for (const name of activationEvents) {
            doc.removeEventListener(name, onLinkActivation, true);
        }
        view.removeEventListener('pagehide', onPageHide);
        view.removeEventListener('pageshow', resume);
        if (owner[SOURCE_LINK_KEY] === dispose) delete owner[SOURCE_LINK_KEY];
    }

    owner[SOURCE_LINK_KEY] = dispose;
    doc.addEventListener('DOMContentLoaded', resume);
    for (const name of activationEvents) {
        doc.addEventListener(name, onLinkActivation, true);
    }
    view.addEventListener('pagehide', onPageHide);
    view.addEventListener('pageshow', resume);
    resume();
    return dispose;
}
