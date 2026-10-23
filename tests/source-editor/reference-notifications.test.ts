/**
 * @file tests/source-editor/reference-notifications.test.ts
 * Purpose: Tests native MediaWiki action notifications.
 *
 * Table of contents:
 * 1. Imports
 * 2. NotificationCall
 * 3. collectNotifications
 * 4. testSeverityMapping
 * 5. Test scenarios
 * 6. assertNotification
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createActionNotifier } from '../../src/source-editor/platform/mediawiki/notifications.ts';
import type { MediaWikiNotificationOptions } from '../../src/library/notifications/contracts.ts';

interface NotificationCall {
    message: string;
    options: MediaWikiNotificationOptions;
}

function collectNotifications(): {
    calls: NotificationCall[];
    notify: (message: string, options: MediaWikiNotificationOptions) => void;
} {
    const calls: NotificationCall[] = [];
    function notify(
        message: string,
        options: MediaWikiNotificationOptions,
    ): void {
        calls.push({ message, options });
    }
    return { calls, notify };
}

function testSeverityMapping(): void {
    const { calls, notify } = collectNotifications();
    const notifyAction = createActionNotifier('Source Editor', notify);

    notifyAction({ key: 'save.done', message: 'Saved', type: 'success' });
    notifyAction({ key: 'lookup.ready', message: 'Ready', type: 'info' });
    notifyAction({ key: 'source.stale', message: 'Stale', type: 'warning' });
    notifyAction({ key: 'save.failed', message: 'Failed', type: 'error' });

    assertNotification(calls[0], 'Saved', 'success', true, 'short');
    assertNotification(calls[1], 'Ready', 'info', true, 'short');
    assertNotification(calls[2], 'Stale', 'warn', true, 'long');
    assertNotification(calls[3], 'Failed', 'error', false);
}
test('maps action severities to native MediaWiki options', testSeverityMapping);

function assertNotification(
    call: NotificationCall,
    message: string,
    type: MediaWikiNotificationOptions['type'],
    autoHide: boolean,
    autoHideSeconds?: 'long' | 'short',
): void {
    assert.equal(call.message, message);
    assert.equal(call.options.type, type);
    assert.equal(call.options.autoHide, autoHide);
    assert.equal(call.options.autoHideSeconds, autoHideSeconds);
}

test('keeps replacement tags isolated by gadget', () => {
    const fixture = collectNotifications();
    const first = createActionNotifier('First Gadget', fixture.notify);
    const second = createActionNotifier('Second Gadget', fixture.notify);

    first({ key: 'Save Complete', message: 'First', type: 'success' });
    second({ key: 'Save Complete', message: 'Second', type: 'success' });

    assert.equal(fixture.calls[0].options.tag, 'first-gadget:save-complete');
    assert.equal(fixture.calls[1].options.tag, 'second-gadget:save-complete');
});
