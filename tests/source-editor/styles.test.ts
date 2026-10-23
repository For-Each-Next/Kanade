/**
 * @file tests/source-editor/styles.test.ts
 * Purpose: tests / styles.test module.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 * 4. getStyleRule
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const styles = await readFile(
    new URL(
        '../../src/source-editor/features/editor/styles.css',
        import.meta.url,
    ),
    'utf8',
);
const tokenStyles = await readFile(
    new URL(
        '../../src/library/wikitext-highlighting/tokens.css',
        import.meta.url,
    ),
    'utf8',
);
const editorStyles = `${tokenStyles}\n${styles}`;

test('reference text is small only in its editor state', () => {
    const rule = getStyleRule(
        '.kanade-source-editor-editor--small-reference-text ' +
            '.kanade-source-editor-token--reference,\n' +
            '.kanade-source-editor-editor--small-reference-text ' +
            '.kanade-source-editor-token--footnote,\n' +
            '.kanade-source-editor-editor--small-reference-text ' +
            '.kanade-source-editor-token--small-reference-comment',
        true,
    );

    assert.match(rule, /font-size:\s*0\.86em/u);
    assert.doesNotMatch(
        getStyleRule('.kanade-source-editor-token--reference'),
        /font-size/u,
    );
    assert.doesNotMatch(
        styles,
        /--reference\s+\.kanade-source-editor-token--footnote/u,
    );
    assert.doesNotMatch(
        styles,
        /--footnote\s+\.kanade-source-editor-token--reference/u,
    );
});

test('large-font state scales the copied native editor size', () => {
    const baseRule = getStyleRule('.kanade-source-editor-editor', true);

    assert.match(baseRule, /font-size:\s*0\.875rem/u);
    assert.doesNotMatch(styles, /--kanade-source-editor-native-font-size/u);
});

test('unchecked links use the copied editor foreground color', () => {
    const rule = getStyleRule('.kanade-source-editor-token--unchecked');

    assert.match(rule, /color:\s*var\(--kanade-source-editor-foreground/u);
    assert.match(rule, /!important/u);
});

test('iframe styles include emphasis and reference popovers', () => {
    assert.match(styles, /\.kanade-source-editor-frame\s*\{/u);
    assert.match(
        styles,
        /\.kanade-source-editor-frame:not\(\[data-kanade-source-editor-ready=['"]true['"]\]\)/u,
    );
    assert.match(
        tokenStyles,
        /\.kanade-source-editor-token--bold\s*\{[^}]*font-weight:\s*bold/su,
    );
    assert.match(
        tokenStyles,
        /\.kanade-source-editor-token--italic\s*\{[^}]*font-style:\s*italic/su,
    );
    assert.match(styles, /\.kanade-source-editor-tooltip__tail\s*\{/u);
    assert.match(
        styles,
        /\.kanade-source-editor-tooltip__surface\s*\{[^}]*max-height:\s*44vh/su,
    );
    assert.match(styles, /\.kanade-source-editor-tooltip__note\s*\{/u);
});

test('reference popovers bridge the anchor gap while visuals animate', () => {
    const bridge = getStyleRule('.kanade-source-editor-tooltip::before');
    const aboveBridge = getStyleRule(
        '.kanade-source-editor-tooltip--above::before',
    );
    const belowBridge = getStyleRule(
        '.kanade-source-editor-tooltip--below::before',
    );
    const aboveVisual = getStyleRule(
        '.kanade-source-editor-tooltip--above .kanade-source-editor-tooltip__visual',
    );
    const belowVisual = getStyleRule(
        '.kanade-source-editor-tooltip--below .kanade-source-editor-tooltip__visual',
    );

    assert.match(bridge, /height:\s*10px/u);
    assert.match(bridge, /pointer-events:\s*auto/u);
    assert.match(aboveBridge, /top:\s*100%/u);
    assert.match(belowBridge, /bottom:\s*100%/u);
    assert.match(
        aboveVisual,
        /animation:\s*kanade-source-editor-tooltip-in-down/u,
    );
    assert.match(
        belowVisual,
        /animation:\s*kanade-source-editor-tooltip-in-up/u,
    );
});

function getStyleRule(selector: string, last = false): string {
    const normalizedStyles = editorStyles.replace(/\s+/gu, ' ');
    const opening = `${selector.replace(/\s+/gu, ' ')} {`;
    const start = last
        ? normalizedStyles.lastIndexOf(opening)
        : normalizedStyles.indexOf(opening);
    const end = normalizedStyles.indexOf('}', start + opening.length);

    assert.notEqual(start, -1, `Missing stylesheet rule ${selector}`);
    assert.notEqual(end, -1, `Unclosed stylesheet rule ${selector}`);
    return normalizedStyles.slice(start + opening.length, end);
}
