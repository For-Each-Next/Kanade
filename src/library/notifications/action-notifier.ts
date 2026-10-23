/**
 * @file src/library/notifications/action-notifier.ts
 * Purpose: Map action feedback to scoped native-notification options.
 * Contents: Injected delivery, normalized tags, and severity lifetimes.
 */

import type {
    ActionNotifier,
    MediaWikiNotificationOptions,
    MediaWikiNotify,
} from './contracts.ts';

/** Tool owners supply their identity, translated text, and host delivery. */
export function createActionNotifier(
    toolId: string,
    notify: MediaWikiNotify,
): ActionNotifier {
    const toolTag = normalizeTagSegment(toolId);
    return (notification) => {
        const type =
            notification.type === 'warning' ? 'warn' : notification.type;
        const tag = `${toolTag}:${normalizeTagSegment(notification.key)}`;
        const options: MediaWikiNotificationOptions =
            type === 'error'
                ? Object.freeze({ autoHide: false, tag, type })
                : Object.freeze({
                      autoHide: true,
                      autoHideSeconds: type === 'warn' ? 'long' : 'short',
                      tag,
                      type,
                  });
        notify(notification.message, options);
    };
}

function normalizeTagSegment(value: string): string {
    const normalized = String(value)
        .trim()
        .toLocaleLowerCase()
        .replace(/[^a-z0-9.-]+/gu, '-')
        .replace(/^-|-$/gu, '');
    return normalized || 'unknown';
}
