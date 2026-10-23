/**
 * @file src/rev-copy/features/revision-row/row.ts
 * Purpose: Render selectable wikitext and a compact copy/tools action group using safe DOM nodes.
 *
 * Contents: Safe inline text, selectable wikitext, actions, and revision states.
 */

import type { RevisionLinks } from '../../domain/revision-links';
import type { Messages } from '../../i18n';

interface RowOptions {
    title: string;
    pageLink: string;
    pageUrl: string;
    permalinkUrl: string;
    messages: Messages;
    displayWikitext: boolean;
    copy: () => Promise<void>;
    advanced: () => Promise<void>;
}

export interface RevisionRow {
    element: HTMLElement;
    setLinks: (links: RevisionLinks) => void;
}

function setActionEnabled(link: HTMLAnchorElement, enabled: boolean): void {
    link.setAttribute('aria-disabled', String(!enabled));
    link.tabIndex = enabled ? 0 : -1;
}

function createActionLink(
    label: string,
    action: () => void,
): HTMLAnchorElement {
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'kanade-rev-copy-action';
    link.setAttribute('role', 'button');
    link.textContent = label;
    link.addEventListener('click', (event) => {
        event.preventDefault();
        if (link.getAttribute('aria-disabled') !== 'true') action();
    });
    link.addEventListener('keydown', (event) => {
        if (event.key === ' ') {
            event.preventDefault();
            link.click();
        }
    });
    return link;
}

function makeSelectable(code: HTMLElement, description: string): void {
    code.tabIndex = 0;
    code.setAttribute('role', 'button');
    code.setAttribute('aria-description', description);
    code.title = description;
    const select = (): void => {
        const selection = code.ownerDocument.getSelection();
        if (!selection) return;
        const range = code.ownerDocument.createRange();
        range.selectNodeContents(code);
        selection.removeAllRanges();
        selection.addRange(range);
    };
    code.addEventListener('click', () => {
        const selection = code.ownerDocument.getSelection();
        // Keep a deliberate word or drag selection within the code intact.
        if (
            selection &&
            !selection.isCollapsed &&
            code.contains(selection.anchorNode) &&
            code.contains(selection.focusNode)
        ) {
            return;
        }
        select();
    });
    code.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            select();
        }
    });
}

export function createRevisionRow(options: RowOptions): RevisionRow {
    const { messages } = options;
    const element = document.createElement('div');
    element.id = 'kanade-rev-copy-row';
    element.className = 'kanade-rev-copy-row';
    element.setAttribute('role', 'group');
    element.setAttribute('aria-label', messages.rowLabel);
    const page = document.createElement(options.displayWikitext ? 'code' : 'a');
    page.className = 'kanade-rev-copy-page';
    if (page instanceof HTMLAnchorElement) page.href = options.pageUrl;
    page.textContent = options.displayWikitext
        ? options.pageLink
        : options.title;
    page.title = options.pageLink;
    if (options.displayWikitext) makeSelectable(page, messages.selectWikitext);
    const revision = document.createElement(
        options.displayWikitext ? 'code' : 'a',
    );
    revision.className = 'kanade-rev-copy-permalink';
    if (revision instanceof HTMLAnchorElement)
        revision.href = options.permalinkUrl;
    if (options.displayWikitext)
        makeSelectable(revision, messages.selectWikitext);
    const revisionGroup = document.createElement('span');
    revisionGroup.className = 'kanade-rev-copy-revision';
    if (options.displayWikitext)
        revisionGroup.classList.add('kanade-rev-copy-revision-wikitext');
    revisionGroup.setAttribute('aria-live', 'polite');
    revisionGroup.append('(', revision, ')');
    revisionGroup.hidden = true;
    const actions = document.createElement('span');
    actions.className = 'kanade-rev-copy-actions';
    const punctuation = (text: string, className: string): HTMLSpanElement => {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        span.setAttribute('aria-hidden', 'true');
        return span;
    };
    actions.append(punctuation('[\u00a0', 'kanade-rev-copy-action-bracket'));
    const copy = createActionLink(messages.rowCopy, () => {
        setActionEnabled(copy, false);
        void options.copy().finally(() => {
            setActionEnabled(copy, true);
        });
    });
    copy.dataset.kanadeRevCopyAction = 'copy';
    setActionEnabled(copy, true);
    actions.append(copy);
    const tools = createActionLink(messages.rowTools, () => {
        setActionEnabled(tools, false);
        void options.advanced().finally(() => setActionEnabled(tools, true));
    });
    tools.dataset.kanadeRevCopyAction = 'advanced';
    tools.setAttribute('aria-haspopup', 'dialog');
    setActionEnabled(tools, true);
    actions.append(
        punctuation('\u00a0| ', 'kanade-rev-copy-action-separator'),
        tools,
    );
    actions.append(punctuation('\u00a0]', 'kanade-rev-copy-action-bracket'));
    element.append(page, revisionGroup, actions);
    return {
        element,
        setLinks(links) {
            revision.textContent = options.displayWikitext
                ? links.permalink
                : links.revisionLabel;
            revision.title = options.displayWikitext
                ? messages.selectWikitext
                : links.permalink;
            revisionGroup.hidden = false;
        },
    };
}
