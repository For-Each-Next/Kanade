/**
 * @file src/vg-stub-creator/platform/mediawiki/notifications.ts
 * Purpose: Deliver local tool feedback through the shared notification contract.
 * Contents: Native host delivery and injected notification factory.
 */

import { createActionNotifier as createNotifier } from '../../../library/notifications/action-notifier.ts';
import type {
    ActionNotifier,
    MediaWikiNotify,
} from '../../../library/notifications/contracts.ts';

export function createActionNotifier(
    toolId: string,
    notify: MediaWikiNotify = notifyWithMediaWiki,
): ActionNotifier {
    return createNotifier(toolId, notify);
}

function notifyWithMediaWiki(...args: Parameters<MediaWikiNotify>): unknown {
    if (typeof mw === 'undefined')
        throw new Error('MediaWiki notifications are unavailable.');
    return mw.notify(...args);
}
