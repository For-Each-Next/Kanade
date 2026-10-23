/**
 * @file tests/build/build-assets.test.ts
 * Purpose: Verifies readable asset literals preserve HTML/CSS bytes and JS escaping.
 *
 * Table of contents:
 * 1. Imports
 * 2. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

import { createReadableAssetLiteral } from '../../scripts/build-assets.ts';

test('wraps compact HTML without adding indentation or changing text spacing', () => {
    const source =
        '<cdx-dialog class="example" :title="msg(\'title\')"><div>' +
        '<span data-example="` ${untrusted()} \\path">First</span> · ' +
        '<span class="a deliberately long attribute value for readable wrapping of embedded HTML assets">Second</span>' +
        '</div></cdx-dialog>';
    const literal = createReadableAssetLiteral(source, { compactMarkup: true });

    assert.ok(literal.includes('\\\n'));
    assert.ok(literal.split('\n').length > 4);
    assert.equal(
        runInNewContext(literal, {
            untrusted: () => assert.fail('Asset text must not interpolate.'),
        }),
        source,
    );
});

test('preserves authored CSS newlines, backslashes, backticks, and interpolation text', () => {
    const source = [
        '/* Authored CSS stays readable. */',
        '.example::after {',
        '    content: "` ${untrusted()} \\F021";',
        '}',
    ].join('\r\n');
    const literal = createReadableAssetLiteral(source);

    assert.ok(literal.includes('\n.example::after {\\r\n'));
    assert.equal(
        runInNewContext(literal, {
            untrusted: () => assert.fail('Asset text must not interpolate.'),
        }),
        source,
    );
});

test('keeps Unicode characters intact when a compact HTML line wraps', () => {
    const source = '<p>' + 'a'.repeat(96) + '😀</p>';
    const literal = createReadableAssetLiteral(source, { compactMarkup: true });

    assert.equal(
        runInNewContext(Buffer.from(literal).toString('utf8')),
        source,
    );
});
