/**
 * @file tests/vg-stub-creator/source-url-focus.test.mjs
 * Purpose: Verifies keyboard focus after removing sources or replacing their draft owner.
 * Contents: DOM source-list focus regression scenarios.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { reactive } from 'vue';
import { createSourceUrlEditor } from '../../src/vg-stub-creator/features/creator/form/source-url-editor.ts';

function createFixture(initial = {}) {
    const values = { ...initial };
    const ticks = [];
    return {
        ...createSourceUrlEditor({
            reactive,
            nextTick: (callback) => ticks.push(callback),
            read: (key) => values[key],
            write: (key, value) => {
                values[key] = value;
            },
        }),
        flush: () => ticks.splice(0).forEach((callback) => callback()),
    };
}

test('source removal focuses the next row, previous row, then its source input', () => {
    const dom = new JSDOM(`
        <div data-kanade-vg-stub-creator-source-input="sources">
            <input aria-label="Source URLs">
            <ul>
                <li data-kanade-vg-stub-creator-source-url><button>First</button></li>
                <li data-kanade-vg-stub-creator-source-url><button>Second</button></li>
                <li data-kanade-vg-stub-creator-source-url><button>Third</button></li>
            </ul>
        </div>
    `);
    const fixture = createFixture({
        sources: 'https://first.test\nhttps://second.test\nhttps://third.test',
    });
    const document = dom.window.document;
    const [first, second, third] = document.querySelectorAll('button');
    const remove = (button, url) => {
        fixture.methods.removeSourceUrl('sources', url, {
            currentTarget: button,
        });
        button.closest('li').remove();
        fixture.flush();
    };
    remove(second, 'https://second.test');
    assert.equal(document.activeElement, third);
    remove(third, 'https://third.test');
    assert.equal(document.activeElement, first);
    remove(first, 'https://first.test');
    assert.equal(document.activeElement, document.querySelector('input'));
    dom.window.close();
});

test('reset invalidates queued row focus before another draft takes ownership', () => {
    const dom = new JSDOM(`
        <div data-kanade-vg-stub-creator-source-input="sources">
            <input aria-label="Source URLs">
            <ul><li data-kanade-vg-stub-creator-source-url><button>Remove</button></li></ul>
        </div>
    `);
    const fixture = createFixture({ sources: 'https://first.test' });
    const button = dom.window.document.querySelector('button');
    fixture.methods.removeSourceUrl('sources', 'https://first.test', {
        currentTarget: button,
    });
    button.closest('li').remove();
    fixture.reset();
    fixture.flush();
    assert.equal(dom.window.document.activeElement.tagName, 'BODY');
    dom.window.close();
});
