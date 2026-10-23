/**
 * @file src/rev-copy/features/section-links/controller.ts
 * Purpose: Add page-title and section copy controls without changing article content.
 *
 * Contents: Owned heading controls, popup actions, revision state, and teardown.
 */

import { buildPageLink, buildRevisionLinks } from '../../domain/revision-links';
import type { WikiSite } from '../../domain/wiki-site';
import type { Messages } from '../../i18n';

interface SectionRevision {
    revisionId: number;
    timestamp: string;
    diffOldId?: number;
}

export interface SectionLinksOptions {
    container: HTMLElement;
    includePageHeading?: boolean;
    pageTitle: string;
    site: WikiSite;
    homeWiki: string;
    messages: Messages;
    copy: (text: string) => Promise<void>;
    advanced?: (sectionId: string) => void | Promise<void>;
}

export interface SectionLinks {
    refresh(): void;
    setRevision(input: SectionRevision): void;
    dispose(): void;
}

interface HeadingEntry {
    heading: HTMLHeadingElement;
    sectionId: string;
    control: HTMLSpanElement;
    trigger: HTMLAnchorElement;
    openTimer: number | undefined;
    closeTimer: number | undefined;
    busy: boolean;
    unclipped: boolean;
    flowRoot: boolean;
    pageHeading: boolean;
    positioned: boolean;
    removeListeners(): void;
}

let popupSequence = 0;

export function createSectionLinks(options: SectionLinksOptions): SectionLinks {
    const document = options.container.ownerDocument;
    const window = document.defaultView;
    if (!window) throw new Error('Section links need a browser document.');
    const entries = new Map<HTMLHeadingElement, HeadingEntry>();
    let revision: SectionRevision | undefined;
    let activeEntry: HeadingEntry | undefined;
    let popup: HTMLSpanElement | undefined;
    let popupCleanups: (() => void)[] = [];
    let disposed = false;
    let restoringFocus = false;
    let openingAdvanced = false;

    function pageHeading(): HTMLHeadingElement | undefined {
        if (!options.includePageHeading) return;
        return [
            ...document.querySelectorAll<HTMLHeadingElement>(
                'h1#firstHeading, h1.mw-first-heading, h1.firstHeading',
            ),
        ].find(
            (heading) =>
                !options.container.contains(heading) &&
                !heading.closest(
                    '#mw-content-text, .mw-parser-output, nav, [role="navigation"]',
                ),
        );
    }

    function sectionId(heading: HTMLHeadingElement): string {
        const ownId =
            heading.id || heading.querySelector('.mw-headline[id]')?.id;
        if (ownId) return ownId;
        const category = heading.closest<HTMLElement>(
            '#mw-subcategories, #mw-pages, #mw-category-media',
        );
        return category?.querySelector('h2, h3, h4, h5, h6') === heading
            ? category.id
            : '';
    }

    function headingTitle(heading: HTMLHeadingElement): string {
        const copy = heading.cloneNode(true) as HTMLHeadingElement;
        copy.querySelectorAll(
            '.mw-editsection, .kanade-rev-copy-section-control',
        ).forEach((element) => element.remove());
        return copy.textContent?.trim() || sectionId(heading);
    }

    function isCurrent(entry: HeadingEntry): boolean {
        return (
            !disposed &&
            entry.heading.isConnected &&
            entry.control.parentNode === entry.heading &&
            (entry.pageHeading
                ? pageHeading() === entry.heading
                : options.container.contains(entry.heading)) &&
            entries.get(entry.heading) === entry
        );
    }

    function clearTimers(entry: HeadingEntry): void {
        window!.clearTimeout(entry.openTimer);
        window!.clearTimeout(entry.closeTimer);
        entry.openTimer = undefined;
        entry.closeTimer = undefined;
    }

    function closePopup(restoreFocus = false): void {
        const previous = activeEntry;
        if (previous) {
            clearTimers(previous);
            previous.control.classList.remove('is-open');
            previous.trigger.setAttribute('aria-expanded', 'false');
            previous.trigger.removeAttribute('aria-controls');
        }
        for (const cleanup of popupCleanups) cleanup();
        popupCleanups = [];
        popup?.remove();
        popup = undefined;
        activeEntry = undefined;
        if (restoreFocus && previous && isCurrent(previous)) {
            restoringFocus = true;
            previous.trigger.focus();
            restoringFocus = false;
        }
    }

    async function copyText(
        entry: HeadingEntry,
        action: HTMLAnchorElement,
        text: string,
    ): Promise<void> {
        if (!isCurrent(entry) || entry.busy || !entry.control.contains(action))
            return;
        clearTimers(entry);
        const fromPopup = action !== entry.trigger;
        closePopup(fromPopup);
        entry.busy = true;
        entry.trigger.setAttribute('aria-disabled', 'true');
        try {
            await options.copy(text);
        } catch {
            // The supplied clipboard adapter owns success and failure feedback.
        } finally {
            entry.busy = false;
            entry.trigger.removeAttribute('aria-disabled');
        }
    }

    async function openAdvanced(
        entry: HeadingEntry,
        action: HTMLAnchorElement,
    ): Promise<void> {
        if (
            !options.advanced ||
            !isCurrent(entry) ||
            entry.busy ||
            openingAdvanced ||
            !entry.control.contains(action)
        )
            return;
        openingAdvanced = true;
        entry.busy = true;
        entry.trigger.setAttribute('aria-disabled', 'true');
        closePopup(true);
        try {
            await options.advanced(entry.sectionId);
        } catch {
            // The advanced controller owns loading and generation feedback.
        } finally {
            openingAdvanced = false;
            entry.busy = false;
            entry.trigger.removeAttribute('aria-disabled');
        }
    }

    function showPopup(entry: HeadingEntry, focusFirst = false): void {
        clearTimers(entry);
        if (!isCurrent(entry) || entry.busy || openingAdvanced) return;
        closePopup();
        activeEntry = entry;
        popup = document.createElement('span');
        popup.className = 'kanade-rev-copy-section-popup';
        popup.id = `kanade-rev-copy-section-popup-${++popupSequence}`;
        popup.setAttribute('role', 'group');
        popup.setAttribute(
            'aria-label',
            options.messages.sectionCopyOptions.replace(
                '$1',
                headingTitle(entry.heading),
            ),
        );
        const page = buildPageLink(
            options.pageTitle,
            options.site,
            options.homeWiki,
            entry.sectionId,
        );
        const choices: [string, string | undefined][] = [
            [options.messages.sectionCopyPage, page],
        ];
        if (revision) {
            const links = buildRevisionLinks({
                ...revision,
                pageTitle: options.pageTitle,
                site: options.site,
                homeWiki: options.homeWiki,
                sectionId: entry.sectionId,
            });
            choices.push(
                [options.messages.sectionCopyPermalink, links.permalink],
                [options.messages.sectionCopyBoth, links.all],
            );
        }
        if (options.advanced)
            choices.push([options.messages.sectionAdvanced, undefined]);
        for (const [label, text] of choices) {
            const action = document.createElement('a');
            action.href = '#';
            action.className = 'kanade-rev-copy-section-action';
            action.setAttribute('role', 'button');
            action.textContent = label;
            if (text === undefined)
                action.setAttribute('aria-haspopup', 'dialog');
            const activate = (): void => {
                if (text === undefined) void openAdvanced(entry, action);
                else void copyText(entry, action, text);
            };
            const click = (event: MouseEvent): void => {
                event.preventDefault();
                activate();
            };
            const keydown = (event: KeyboardEvent): void => {
                if (
                    event.key === ' ' ||
                    (text === undefined && event.key === 'Enter')
                ) {
                    event.preventDefault();
                    activate();
                }
            };
            action.addEventListener('click', click);
            action.addEventListener('keydown', keydown);
            popupCleanups.push(() => {
                action.removeEventListener('click', click);
                action.removeEventListener('keydown', keydown);
            });
            popup.append(action);
        }
        entry.control.append(popup);
        entry.control.classList.add('is-open');
        entry.trigger.setAttribute('aria-expanded', 'true');
        entry.trigger.setAttribute('aria-controls', popup.id);
        if (focusFirst) popup.querySelector('a')?.focus();
    }

    function scheduleOpen(entry: HeadingEntry): void {
        clearTimers(entry);
        if (restoringFocus || activeEntry === entry) return;
        entry.openTimer = window!.setTimeout(() => showPopup(entry), 600);
    }

    function scheduleClose(entry: HeadingEntry, event: Event): void {
        const next = (event as FocusEvent).relatedTarget;
        if (next && 'nodeType' in next && entry.control.contains(next as Node))
            return;
        clearTimers(entry);
        if (activeEntry === entry) {
            entry.closeTimer = window!.setTimeout(() => closePopup(), 150);
        }
    }

    function addHeading(
        heading: HTMLHeadingElement,
        id: string,
        isPageHeading: boolean,
    ): void {
        const headingStyle = window!.getComputedStyle(heading);
        const overflow = [
            headingStyle.overflow,
            headingStyle.overflowX,
            headingStyle.overflowY,
        ];
        const unclipped = overflow.some(
            (value) => value === 'hidden' || value === 'clip',
        );
        const flowRoot =
            unclipped &&
            headingStyle.display === 'block' &&
            overflow.includes('hidden');
        const positioned =
            isPageHeading &&
            (!headingStyle.position || headingStyle.position === 'static');
        const control = document.createElement('span');
        control.className = 'kanade-rev-copy-section-control';
        const trigger = document.createElement('a');
        trigger.className = 'kanade-rev-copy-section-trigger';
        trigger.href = `#${encodeURIComponent(id)}`;
        trigger.setAttribute('role', 'button');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.textContent = '#';
        control.append(trigger);
        heading.prepend(control);
        heading.classList.add('kanade-rev-copy-section-heading');
        if (isPageHeading)
            heading.classList.add('kanade-rev-copy-section-page-heading');
        if (positioned)
            heading.classList.add('kanade-rev-copy-section-positioned');
        if (unclipped)
            heading.classList.add('kanade-rev-copy-section-unclipped');
        if (flowRoot)
            heading.classList.add('kanade-rev-copy-section-flow-root');
        const listeners: [EventTarget, string, EventListener][] = [];
        const entry: HeadingEntry = {
            heading,
            sectionId: id,
            control,
            trigger,
            openTimer: undefined,
            closeTimer: undefined,
            busy: false,
            unclipped,
            flowRoot,
            pageHeading: isPageHeading,
            positioned,
            removeListeners() {
                for (const [target, type, listener] of listeners)
                    target.removeEventListener(type, listener);
            },
        };
        entries.set(heading, entry);
        const listen = (
            target: EventTarget,
            type: string,
            listener: EventListener,
        ): void => {
            target.addEventListener(type, listener);
            listeners.push([target, type, listener]);
        };
        listen(trigger, 'click', (event) => {
            event.preventDefault();
            void copyText(
                entry,
                trigger,
                buildPageLink(
                    options.pageTitle,
                    options.site,
                    options.homeWiki,
                    id,
                ),
            );
        });
        listen(trigger, 'focus', () => scheduleOpen(entry));
        listen(control, 'mouseenter', () => scheduleOpen(entry));
        listen(control, 'mouseleave', (event) => scheduleClose(entry, event));
        listen(control, 'focusout', (event) => scheduleClose(entry, event));
        listen(control, 'keydown', (event) => {
            const keyboard = event as KeyboardEvent;
            if (keyboard.key === 'Escape') {
                keyboard.preventDefault();
                clearTimers(entry);
                closePopup(true);
            } else if (
                keyboard.key === 'ArrowDown' &&
                event.target === trigger
            ) {
                keyboard.preventDefault();
                showPopup(entry, true);
            } else if (keyboard.key === ' ' && event.target === trigger) {
                keyboard.preventDefault();
                void copyText(
                    entry,
                    trigger,
                    buildPageLink(
                        options.pageTitle,
                        options.site,
                        options.homeWiki,
                        id,
                    ),
                );
            }
        });
    }

    function removeHeading(entry: HeadingEntry): void {
        clearTimers(entry);
        if (activeEntry === entry) closePopup();
        entry.removeListeners();
        entry.control.remove();
        entry.heading.classList.remove('kanade-rev-copy-section-heading');
        if (entry.pageHeading)
            entry.heading.classList.remove(
                'kanade-rev-copy-section-page-heading',
            );
        if (entry.positioned)
            entry.heading.classList.remove(
                'kanade-rev-copy-section-positioned',
            );
        if (entry.unclipped)
            entry.heading.classList.remove('kanade-rev-copy-section-unclipped');
        if (entry.flowRoot)
            entry.heading.classList.remove('kanade-rev-copy-section-flow-root');
        entries.delete(entry.heading);
    }

    function refresh(): void {
        if (disposed) return;
        const headings = new Map(
            [
                ...options.container.querySelectorAll<HTMLHeadingElement>(
                    'h2, h3, h4, h5, h6',
                ),
            ]
                .filter(
                    (heading) =>
                        sectionId(heading) &&
                        !heading.closest(
                            'nav, .toc, #toc, .vector-toc, [role="navigation"]',
                        ),
                )
                .map((heading) => [heading, sectionId(heading)] as const),
        );
        const title = pageHeading();
        if (title) headings.set(title, 'top');
        for (const entry of entries.values()) {
            if (
                !headings.has(entry.heading) ||
                headings.get(entry.heading) !== entry.sectionId ||
                entry.control.parentNode !== entry.heading
            )
                removeHeading(entry);
        }
        for (const [heading, id] of headings) {
            if (!entries.has(heading))
                addHeading(heading, id, heading === title);
            const entry = entries.get(heading)!;
            entry.trigger.setAttribute(
                'aria-label',
                options.messages.sectionCopyLink.replace(
                    '$1',
                    headingTitle(heading),
                ),
            );
        }
    }

    refresh();
    return {
        refresh,
        setRevision(input) {
            if (disposed) return;
            buildRevisionLinks({
                ...input,
                pageTitle: options.pageTitle,
                site: options.site,
                homeWiki: options.homeWiki,
            });
            revision = { ...input };
            if (activeEntry) {
                const focusInside = !!popup?.contains(document.activeElement);
                showPopup(activeEntry, focusInside);
            }
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            for (const entry of entries.values()) removeHeading(entry);
            closePopup();
        },
    };
}
