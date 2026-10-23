/**
 * @file tests/vg-stub-creator/citation-prefetch.test.ts
 * Purpose: Keeps citation prefetch work within the lifetime of its form owner.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createCitationPrefetchQueue } from '../../src/vg-stub-creator/features/creator/form/form-model.ts';

test('prefetch debounces changed forms and deduplicates source URLs', (context) => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const received: string[] = [];
    const queue = createCitationPrefetchQueue({
        citationPrefetchDelay: 20,
        onSourceUrlChange: (url) => received.push(url),
    });
    queue({ developersSourceUrl: 'https://example.org/old' });
    const form = {
        developersSourceUrl: 'https://example.org/current',
        publishersSourceUrl: 'https://example.org/current',
    };
    queue(form);
    context.mock.timers.tick(20);
    assert.deepEqual(received, ['https://example.org/current']);
    queue(form);
    context.mock.timers.tick(20);
    assert.deepEqual(received, ['https://example.org/current']);
    queue.dispose();
});

test('cancel drops pending work and permits the same restored sources to be queued', (context) => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const received: string[] = [];
    const queue = createCitationPrefetchQueue({
        citationPrefetchDelay: 20,
        onSourceUrlChange: (url) => received.push(url),
    });
    const form = { developersSourceUrl: 'https://example.org/source' };
    queue(form);
    queue.cancel();
    context.mock.timers.tick(20);
    assert.deepEqual(received, []);
    queue(form);
    context.mock.timers.tick(20);
    assert.deepEqual(received, ['https://example.org/source']);
    queue.dispose();
});

test('dispose cancels queued work and rejects later scheduling', (context) => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const received: string[] = [];
    const queue = createCitationPrefetchQueue({
        citationPrefetchDelay: 20,
        onSourceUrlChange: (url) => received.push(url),
    });
    queue({ developersSourceUrl: 'https://example.org/pending' });
    queue.dispose();
    queue({ developersSourceUrl: 'https://example.org/late' });
    context.mock.timers.tick(40);
    assert.deepEqual(received, []);
});
