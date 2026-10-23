/**
 * @file src/vg-stub-creator/features/creator/page-trigger.ts
 * Purpose: Owns page-context eligibility and creator launch links.
 * Contents: Supported-page checks and MediaWiki portlet actions.
 */

import { msg } from '../../i18n/index.ts';

const MAIN_NAMESPACE = 0;
const USER_NAMESPACE = 2;
const DRAFT_NAMESPACE = 118;

export interface LauncherPageContext {
    namespaceNumber: number;
    pageTitle: string;
    userName: string | null;
}

/**
 * Adds gadget triggers to MediaWiki page actions.
 */

/**
 * Checks whether a Chinese Wikipedia page can show the launcher.
 *
 * @param context - Current page namespace, title, and user.
 * @returns Whether the launcher belongs on the current page.
 */
export function canShowZhwikiLauncher(context: LauncherPageContext): boolean {
    if (
        context.namespaceNumber === MAIN_NAMESPACE ||
        context.namespaceNumber === DRAFT_NAMESPACE
    ) {
        return true;
    }

    if (
        context.namespaceNumber !== USER_NAMESPACE ||
        context.userName == null
    ) {
        return false;
    }

    const pageTitle = context.pageTitle.replace(/_/gu, ' ');
    const userName = context.userName.replace(/_/gu, ' ');

    return pageTitle === userName || pageTitle.startsWith(`${userName}/`);
}

/**
 * Adds a gadget trigger to the page views portlet on missing pages.
 *
 * @param mediaWikiUtil - MediaWiki utility functions.
 * @param handler - Gadget open handler.
 * @returns Whether a trigger was added.
 */
export function addMissingPageEditTrigger(
    mediaWikiUtil: any,
    handler: (...args: any[]) => any,
): boolean {
    const messageB = msg('launcher.createStub');
    const link = mediaWikiUtil.addPortletLink(
        'p-views',
        '#',
        messageB,
        'kanade-vg-stub-creator-launcher',
    );

    if (link == null) {
        return false;
    }

    link.addEventListener('click', handler);

    return true;
}

/**
 * Handles add view page trigger.
 *
 * Adds the gadget to the visible page-action area with a toolbox
 * fallback.
 *
 * @param mediaWikiUtil - MediaWiki utility functions.
 * @param handler - Gadget open handler.
 * @returns Whether a trigger was added.
 */
export function addViewPageTrigger(
    mediaWikiUtil: any,
    handler: (...args: any[]) => any,
): boolean {
    const messageA = msg('launcher.createStub');
    const link =
        mediaWikiUtil.addPortletLink(
            'p-views',
            '#',
            messageA,
            'kanade-vg-stub-creator-launcher',
        ) ||
        mediaWikiUtil.addPortletLink(
            'p-tb',
            '#',
            messageA,
            't-vg-stub-creator',
        );

    if (link == null) {
        return false;
    }

    link.addEventListener('click', handler);

    return true;
}

/**
 * Handles add enwiki create trigger.
 *
 * Adds an English Wikipedia page action that starts zhwiki stub
 * creation.
 *
 * @param mediaWikiUtil - MediaWiki utility functions.
 * @param handler - Gadget launch handler.
 * @param href - Fallback zhwiki creation URL.
 * @returns Whether a trigger was added.
 */
export function addEnwikiCreateTrigger(
    mediaWikiUtil: any,
    handler: (...args: any[]) => any,
    href: string,
): boolean {
    const message = msg('launcher.createZhwikiStub');
    const link =
        mediaWikiUtil.addPortletLink(
            'p-cactions',
            href,
            message,
            'ca-create-zhwiki-vg-stub',
        ) ||
        mediaWikiUtil.addPortletLink(
            'p-tb',
            href,
            message,
            't-create-zhwiki-vg-stub',
        );

    if (link == null) {
        return false;
    }

    const anchor = link.matches('a') ? link : link.querySelector('a');
    if (anchor != null) {
        anchor.target = '_blank';
        anchor.rel = 'noopener';
    }
    link.addEventListener('click', handler);

    return true;
}
