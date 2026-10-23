/**
 * @file src/library/notifications/contracts.ts
 * Purpose: Plain-text feedback contract shared by action owners.
 * Contents: Notification severity, scoped action message, and delivery port.
 */

export type ActionNotificationType = 'error' | 'info' | 'success' | 'warning';

export interface ActionNotification {
    readonly key: string;
    readonly message: string;
    readonly type: ActionNotificationType;
}

export type ActionNotifier = (notification: ActionNotification) => void;

export interface MediaWikiNotificationOptions {
    readonly autoHide: boolean;
    readonly autoHideSeconds?: 'long' | 'short';
    readonly tag: string;
    readonly type: 'error' | 'info' | 'success' | 'warn';
}

export type MediaWikiNotify = (
    message: string,
    options: MediaWikiNotificationOptions,
) => unknown;
