/**
 * @file tests/library/logging.test.ts
 * Purpose: Verify shared structured logging, private-data redaction, and timer semantics.
 *
 * Table of contents:
 * 1. Imports
 * 2. LogCall
 * 3. createOutput
 * 4. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createLogger,
    type LogOutput,
    type LoggingConfig,
} from '../../src/library/logging/logger.ts';

interface LogCall {
    level: keyof LogOutput;
    values: unknown[];
}

function createOutput(): { calls: LogCall[]; output: LogOutput } {
    const calls: LogCall[] = [];
    const record = (level: keyof LogOutput, values: unknown[]) => {
        calls.push({ level, values });
    };
    return {
        calls,
        output: {
            debug: (...values) => record('debug', values),
            error: (...values) => record('error', values),
            info: (...values) => record('info', values),
            warn: (...values) => record('warn', values),
        },
    };
}

test('defaults to warning output with stable event names', () => {
    const { calls, output } = createOutput();
    const logger = createLogger('Source Editor', { output });

    logger.debug('page.fetch.started');
    logger.info('page.fetch.ready');
    logger.warn('Page fetch failed!');
    logger.error('page.save.failed', { status: 503 });

    assert.deepEqual(calls, [
        {
            level: 'warn',
            values: ['[source-editor] ' + 'page.fetch.failed'],
        },
        {
            level: 'error',
            values: ['[source-editor] page.save.failed', { status: 503 }],
        },
    ]);
});

test('resolves option, gadget, common, and default level precedence', () => {
    const config: LoggingConfig = {
        gadgets: { alpha: 'debug', beta: 'silent', 'mixed-case': 'info' },
        level: 'error',
    };
    const fixture = createOutput();

    assert.equal(
        createLogger('alpha', { config, output: fixture.output }).isEnabled(
            'debug',
        ),
        true,
    );
    assert.equal(
        createLogger('beta', { config, output: fixture.output }).isEnabled(
            'error',
        ),
        false,
    );
    assert.equal(
        createLogger('gamma', { config, output: fixture.output }).isEnabled(
            'warn',
        ),
        false,
    );
    assert.equal(
        createLogger('gamma', {
            config,
            level: 'info',
            output: fixture.output,
        }).isEnabled('info'),
        true,
    );
    assert.equal(
        createLogger('Mixed Case', {
            config,
            output: fixture.output,
        }).isEnabled('info'),
        true,
    );
});

test('creates nested scopes without changing the parent', () => {
    const { calls, output } = createOutput();
    const logger = createLogger('Source Editor', {
        level: 'info',
        output,
    });

    logger.child('MediaWiki API').child('Titles').info('lookup.ready');
    logger.info('startup.ready');

    assert.deepEqual(calls, [
        {
            level: 'info',
            values: ['[source-editor]' + '[mediawiki-api.titles] lookup.ready'],
        },
        {
            level: 'info',
            values: ['[source-editor] startup.ready'],
        },
    ]);
});

test('redacts and bounds diagnostic details', () => {
    const { calls, output } = createOutput();
    const logger = createLogger('../../src/source-editor/index.ts', {
        level: 'debug',
        output,
    });
    const details: Record<string, unknown> = {
        error: new Error('Failed at https://example.test/private?q=token'),
        nested: { ok: true, password: 'secret', sourceText: 'article' },
        requestUrl: 'https://example.test/?token=secret',
        values: Array.from({ length: 25 }, (_value, index) => index),
    };
    details.circular = details;

    logger.debug('request.failed', details);

    const sanitized = calls[0].values[1] as Record<string, unknown>;
    assert.deepEqual(sanitized.error, {
        message: '[redacted]',
        name: 'Error',
    });
    assert.deepEqual(sanitized.nested, {
        ok: true,
        password: '[redacted]',
        sourceText: '[redacted]',
    });
    assert.equal(sanitized.requestUrl, '[redacted]');
    assert.equal(sanitized.circular, '[circular]');
    assert.equal((sanitized.values as unknown[]).at(-1), '[truncated]');
});

test('does not let hostile diagnostic values break the caller', () => {
    const { calls, output } = createOutput();
    const logger = createLogger('../../src/source-editor/index.ts', { output });
    const details = new Proxy(
        {},
        {
            ownKeys() {
                throw new Error('unreadable');
            },
        },
    );

    assert.doesNotThrow(() => logger.warn('request.failed', details));
    assert.equal(calls[0].values[1], '[unavailable]');
});

test('records an idempotent debug timer', () => {
    const { calls, output } = createOutput();
    const times = [100, 112, 140];
    const logger = createLogger('source-editor', {
        level: 'debug',
        now: () => times.shift() ?? 140,
        output,
    });
    const stop = logger.startTimer('article.save', { operation: 'create' });

    stop({ outcome: 'success' });
    stop({ outcome: 'duplicate' });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].values, [
        '[source-editor] article.save.completed',
        {
            completion: { outcome: 'success' },
            durationMs: 12,
            initial: { operation: 'create' },
        },
    ]);
});

test('does not sample a disabled debug timer', () => {
    const { calls, output } = createOutput();
    let samples = 0;
    const logger = createLogger('../../src/source-editor/index.ts', {
        now() {
            samples += 1;
            return samples;
        },
        output,
    });

    const stop = logger.startTimer('article.format');
    stop();

    assert.equal(samples, 0);
    assert.deepEqual(calls, []);
});

test('redacts page titles and email addresses and keeps error codes', () => {
    const { calls, output } = createOutput();
    const logger = createLogger('source-editor', {
        level: 'debug',
        output,
    });
    const error = Object.assign(new Error('request rejected'), {
        code: 'badtoken',
    });

    logger.debug('page.fetch.failed', {
        email: 'person@example.test',
        error,
        title: 'Private draft',
    });

    assert.deepEqual(calls[0].values[1], {
        email: '[redacted]',
        error: {
            code: 'badtoken',
            message: '[redacted]',
            name: 'Error',
        },
        title: '[redacted]',
    });
});

test('redacts URLs embedded in diagnostic strings and nested credentials', () => {
    const { calls, output } = createOutput();
    const logger = createLogger('wiki', { output });
    logger.child('editor').warn('lookup.failed', {
        source: 'Private article text',
        token: 'secret token',
        nested: { password: 'secret password', count: 2 },
        reason: 'Connection to https://example.test/private failed',
    });
    assert.deepEqual(calls[0].values, [
        '[wiki][editor] lookup.failed',
        {
            source: '[redacted]',
            token: '[redacted]',
            nested: { password: '[redacted]', count: 2 },
            reason: 'Connection to [url] failed',
        },
    ]);
});
