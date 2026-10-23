/**
 * @file tests/wpvg-assessor/dialog-mount.test.mjs
 * Purpose: Verify assessor mount failures release only their own host and session.
 * Contents: Lifecycle fixtures, setup failures, and idempotent dismissal.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { mountAssessorDialog } from '../../src/wpvg-assessor/features/assessment/dialog-mount.ts';

function createDocument(t) {
    const dom = new JSDOM('<div id="host-content">Host content</div>');
    const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: dom.window.document,
    });
    t.after(() => {
        if (original) Object.defineProperty(globalThis, 'document', original);
        else delete globalThis.document;
        dom.window.close();
    });
    return dom.window.document;
}

function createRuntime(failure) {
    let unmounts = 0;
    const app = {
        component() {
            if (failure === 'registration') throw new Error(failure);
        },
        mount() {
            if (failure === 'mount') throw new Error(failure);
        },
        unmount() {
            unmounts += 1;
            if (failure === 'unmount') throw new Error(failure);
        },
    };
    return {
        require(name) {
            if (name !== 'vue') return {};
            return {
                createMwApp() {
                    if (failure === 'creation') throw new Error(failure);
                    return app;
                },
            };
        },
        unmounts: () => unmounts,
    };
}

for (const failure of ['component', 'creation', 'registration', 'mount']) {
    test(`releases the dialog host and session after ${failure} fails`, (t) => {
        const document = createDocument(t);
        const runtime = createRuntime(failure);
        let disposals = 0;
        assert.throws(
            () =>
                mountAssessorDialog({
                    require: runtime.require,
                    createComponent() {
                        if (failure === 'component') throw new Error(failure);
                        return {};
                    },
                    onClose() {
                        assert.fail(
                            'Setup failure must not act as a dismissal.',
                        );
                    },
                    onDispose() {
                        disposals += 1;
                    },
                }),
            { message: failure },
        );
        assert.equal(
            document.getElementById('kanade-wpvg-assessor-dialog-host'),
            null,
        );
        assert.equal(
            document.getElementById('host-content').textContent,
            'Host content',
        );
        assert.equal(disposals, 1);
        assert.equal(
            runtime.unmounts(),
            failure === 'registration' || failure === 'mount' ? 1 : 0,
        );
    });
}

test('dismisses once and ignores callbacks from a disposed dialog', (t) => {
    const document = createDocument(t);
    const runtime = createRuntime();
    let close;
    let closes = 0;
    let disposals = 0;
    const dispose = mountAssessorDialog({
        require: runtime.require,
        createComponent(_Vue, onClose) {
            close = onClose;
            return {};
        },
        onClose() {
            closes += 1;
        },
        onDispose() {
            disposals += 1;
        },
    });
    assert.ok(document.getElementById('kanade-wpvg-assessor-dialog-host'));
    close();
    close();
    dispose();
    assert.equal(closes, 1);
    assert.equal(disposals, 1);
    assert.equal(runtime.unmounts(), 1);
    assert.equal(
        document.getElementById('kanade-wpvg-assessor-dialog-host'),
        null,
    );
});

test('releases the session and host when Vue teardown throws', (t) => {
    const document = createDocument(t);
    const runtime = createRuntime('unmount');
    let disposals = 0;
    const dispose = mountAssessorDialog({
        require: runtime.require,
        createComponent: () => ({}),
        onClose() {},
        onDispose() {
            disposals += 1;
        },
    });
    assert.throws(dispose, { message: 'unmount' });
    assert.doesNotThrow(dispose);
    assert.equal(disposals, 1);
    assert.equal(
        document.getElementById('kanade-wpvg-assessor-dialog-host'),
        null,
    );
});

for (const stage of ['component', 'creation', 'registration', 'mount']) {
    test(`a synchronous close during ${stage} cannot retain or mount a disposed app`, (t) => {
        const document = createDocument(t);
        let close;
        let creations = 0;
        let mounts = 0;
        let unmounts = 0;
        let closes = 0;
        let disposals = 0;
        const app = {
            component() {
                if (stage === 'registration') close();
            },
            mount() {
                mounts += 1;
                if (stage === 'mount') close();
            },
            unmount() {
                unmounts += 1;
            },
        };
        const dispose = mountAssessorDialog({
            require(name) {
                return name === 'vue'
                    ? {
                          createMwApp() {
                              creations += 1;
                              if (stage === 'creation') close();
                              return app;
                          },
                      }
                    : {};
            },
            createComponent(_Vue, onClose) {
                close = onClose;
                if (stage === 'component') close();
                return {};
            },
            onClose() {
                closes += 1;
            },
            onDispose() {
                disposals += 1;
            },
        });
        close();
        dispose();
        assert.equal(creations, stage === 'component' ? 0 : 1);
        assert.equal(mounts, stage === 'mount' ? 1 : 0);
        assert.equal(unmounts, stage === 'component' ? 0 : 1);
        assert.equal(closes, 1);
        assert.equal(disposals, 1);
        assert.equal(
            document.getElementById('kanade-wpvg-assessor-dialog-host'),
            null,
        );
    });
}

test('setup errors survive failures in both Vue and session teardown', (t) => {
    const document = createDocument(t);
    const original = new Error('mount failed');
    let disposals = 0;
    assert.throws(
        () =>
            mountAssessorDialog({
                require(name) {
                    return name === 'vue'
                        ? {
                              createMwApp() {
                                  return {
                                      component() {},
                                      mount() {
                                          throw original;
                                      },
                                      unmount() {
                                          throw new Error('unmount failed');
                                      },
                                  };
                              },
                          }
                        : {};
                },
                createComponent: () => ({}),
                onClose() {
                    assert.fail('Setup failure must not restore focus.');
                },
                onDispose() {
                    disposals += 1;
                    throw new Error('session cleanup failed');
                },
            }),
        (error) => error === original,
    );
    assert.equal(disposals, 1);
    assert.equal(
        document.getElementById('kanade-wpvg-assessor-dialog-host'),
        null,
    );
    assert.equal(
        document.getElementById('host-content').textContent,
        'Host content',
    );
});
