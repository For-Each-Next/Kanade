/**
 * @file tests/library/notifications.test.ts
 * Purpose: Verify shared action-notification behavior independently of a browser.
 * Contents: Severity lifetimes, stable scoped tags, text preservation, and delivery failures.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createActionNotifier } from '../../src/library/notifications/action-notifier.ts';
import type { MediaWikiNotificationOptions } from '../../src/library/notifications/contracts.ts';

test('notification lifetimes preserve persistent errors and longer warnings', () => {
    const captured: Array<{
        message: string;
        options: MediaWikiNotificationOptions;
    }> = [];
    const notify = createActionNotifier('Source Editor', (message, options) => {
        captured.push({ message, options });
        assert.ok(Object.isFrozen(options));
    });
    for (const type of ['error', 'warning', 'info', 'success'] as const) {
        notify({
            key: ' Save Failed ',
            message: `<${type}> & unchanged`,
            type,
        });
    }
    assert.deepEqual(captured, [
        {
            message: '<error> & unchanged',
            options: {
                autoHide: false,
                tag: 'source-editor:save-failed',
                type: 'error',
            },
        },
        {
            message: '<warning> & unchanged',
            options: {
                autoHide: true,
                autoHideSeconds: 'long',
                tag: 'source-editor:save-failed',
                type: 'warn',
            },
        },
        {
            message: '<info> & unchanged',
            options: {
                autoHide: true,
                autoHideSeconds: 'short',
                tag: 'source-editor:save-failed',
                type: 'info',
            },
        },
        {
            message: '<success> & unchanged',
            options: {
                autoHide: true,
                autoHideSeconds: 'short',
                tag: 'source-editor:save-failed',
                type: 'success',
            },
        },
    ]);
});

test('notification owners remain independent and invalid tag segments are safe', () => {
    const tags: string[] = [];
    const delivery = (
        _message: string,
        options: MediaWikiNotificationOptions,
    ) => tags.push(options.tag);
    const first = createActionNotifier(' Creator ', delivery);
    const second = createActionNotifier('Assessor', delivery);
    const unknown = createActionNotifier(' !!! ', delivery);
    const notification = {
        key: 'Check',
        message: 'Done',
        type: 'success',
    } as const;
    first(notification);
    second(notification);
    unknown({ ...notification, key: '???' });
    assert.deepEqual(tags, [
        'creator:check',
        'assessor:check',
        'unknown:unknown',
    ]);
});

test('delivery failures remain visible to the owning tool', () => {
    const failure = new Error('Native notifications unavailable');
    const notify = createActionNotifier('tool', () => {
        throw failure;
    });
    assert.throws(
        () => notify({ key: 'save', message: 'Done', type: 'success' }),
        (error) => error === failure,
    );
});
