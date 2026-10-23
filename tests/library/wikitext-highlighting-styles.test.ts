/**
 * @file tests/library/wikitext-highlighting-styles.test.ts
 * Purpose: Preserve reusable wikitext syntax palettes without editor UI or lookup states.
 * Contents: Token colors, emphasis, nesting, and stylesheet ownership.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const styles = await readFile(
    new URL(
        '../../src/library/wikitext-highlighting/tokens.css',
        import.meta.url,
    ),
    'utf8',
);

test('highlight colors use the source palette', () => {
    assert.match(
        styles,
        /\.kanade-source-editor-token--html-tag\s*\{[^}]*rgb\(232, 232, 232\)/su,
    );
    assert.match(
        styles,
        /\.kanade-source-editor-token--reference-pink\s*\{[^}]*rgb\(243, 225, 247\)/su,
    );
    assert.match(
        styles,
        /\.kanade-source-editor-token--reference-blue\s*\{[^}]*rgb\(230, 242, 255\)/su,
    );
    assert.doesNotMatch(styles, /rgb\((?:211, 230, 250|231, 207, 239)\)/u);
    assert.match(
        styles,
        /\.kanade-source-editor-token--math\s*\{[^}]*rgb\(232, 240, 255\)/su,
    );
    assert.match(
        styles,
        /\.kanade-source-editor-token--nowiki\s*\{[^}]*rgb\(248, 232, 232\)/su,
    );
    assert.match(
        styles,
        /\.kanade-source-editor-token--file[^}]*rgba\(199, 255, 149, 0\.75\)/su,
    );
});

test('magic words and module names retain source colors', () => {
    assert.match(
        styles,
        /\.kanade-source-editor-token--parser-function\s*\{[^}]*rgb\(255, 0, 0\)/su,
    );
    assert.match(
        styles,
        /\.kanade-source-editor-token--module-name,[^}]*rgb\(85, 0, 153\)/su,
    );
});

test('list markers use magic-word red on the first depth grey', () => {
    const rule = getStyleRule('.kanade-source-editor-token--list');

    assert.match(rule, /color:\s*rgb\(255, 0, 0\)/u);
    assert.match(rule, /background:\s*rgb\(246, 246, 246\)/u);
});

test('HTML content backgrounds darken with nesting depth', () => {
    const depthColors = [
        [246, '96'],
        [228, '88'],
        [218, '83.5'],
    ] as const;
    for (const [depth, [color, backgroundWeight]] of depthColors.entries()) {
        const rule = getStyleRule(
            `.kanade-source-editor-token--html-content-${depth}`,
        );
        assert.match(
            rule,
            new RegExp(
                `background:\\s*rgb\\(${color}, ${color}, ${color}\\)`,
                'u',
            ),
        );
        assert.ok(
            rule.includes(
                `var(--kanade-source-editor-background) ${backgroundWeight}%`,
            ),
        );
        assert.match(rule, /var\(--kanade-source-editor-foreground\)/u);
    }
    const cappedRule = getStyleRule(
        '.kanade-source-editor-token--html-content-3,\n' +
            '.kanade-source-editor-token--html-content-4',
        true,
    );
    assert.match(cappedRule, /rgb\(208, 208, 208\)/u);
    assert.ok(
        cappedRule.includes('var(--kanade-source-editor-background) 79%'),
    );
    assert.match(cappedRule, /var\(--kanade-source-editor-foreground\)/u);
    assert.ok(
        styles.lastIndexOf('.kanade-source-editor-token--html-content-4') <
            styles.indexOf('.kanade-source-editor-token--html-tag'),
    );
});

test('heading underlines and language variants retain text styling', () => {
    const headingRules = [
        [
            '.kanade-source-editor-token--heading-2.kanade-source-editor-token--heading-text',
            'double',
        ],
        [
            '.kanade-source-editor-token--heading-3.kanade-source-editor-token--heading-text',
            'solid',
        ],
    ] as const;

    for (const [selector, decorationStyle] of headingRules) {
        const rule = getStyleRule(selector);

        assert.match(rule, /text-decoration-line:\s*underline/u);
        assert.match(
            rule,
            new RegExp(`text-decoration-style:\\s*${decorationStyle}`, 'u'),
        );
        assert.match(rule, /text-underline-offset:\s*0\.2em/u);
    }
    assert.match(
        getStyleRule('.kanade-source-editor-token--language-variant'),
        /font-style:\s*italic/u,
    );
});

test('special-character tips do not paint extra glyphs or guides', () => {
    assert.doesNotMatch(styles, /data:image\/svg\+xml/u);
    for (const name of [
        'tab',
        'en-space',
        'em-space',
        'thin-space',
        'ideographic-space',
        'soft-hyphen',
        'figure-dash',
        'en-dash',
        'em-dash',
        'horizontal-bar',
        'minus-sign',
    ]) {
        assert.doesNotMatch(
            styles,
            new RegExp(
                String.raw`\.kanade-source-editor-token--${name}::(?:before|after)`,
                'u',
            ),
        );
    }
});

test('shared token styles do not include editor UI or remote lookup states', () => {
    assert.doesNotMatch(
        styles,
        /\.kanade-source-editor-(?:frame|editor|tooltip)|token--(?:missing|unchecked|page-missing)/u,
    );
    assert.match(
        styles,
        /\.kanade-source-editor-token--bold\s*\{[^}]*font-weight:\s*bold/su,
    );
    assert.match(
        styles,
        /\.kanade-source-editor-token--italic\s*\{[^}]*font-style:\s*italic/su,
    );
});

function getStyleRule(selector: string, last = false): string {
    const normalizedStyles = styles.replace(/\s+/gu, ' ');
    const opening = `${selector.replace(/\s+/gu, ' ')} {`;
    const start = last
        ? normalizedStyles.lastIndexOf(opening)
        : normalizedStyles.indexOf(opening);
    const end = normalizedStyles.indexOf('}', start + opening.length);

    assert.notEqual(start, -1, `Missing stylesheet rule ${selector}`);
    assert.notEqual(end, -1, `Unclosed stylesheet rule ${selector}`);
    return normalizedStyles.slice(start + opening.length, end);
}
