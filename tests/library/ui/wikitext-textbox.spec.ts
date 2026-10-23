/**
 * @file tests/library/ui/wikitext-textbox.spec.ts
 * Purpose: Tests syntax highlighting over an unchanged native textarea.
 * Contents: Native editing, passive rendering, scrolling, protected states, and cleanup.
 */

import { fileURLToPath } from 'node:url';

import { expect, test as base, type Page } from '@playwright/test';
import { build } from 'esbuild';

import type { attachWikitextHighlighting } from '../../../src/library/wikitext-textbox/index.ts';

type HighlightingController = ReturnType<typeof attachWikitextHighlighting>;
type FixtureWindow = Window & {
    textboxFixture: {
        attach: typeof attachWikitextHighlighting;
        controller: HighlightingController;
        textarea: HTMLTextAreaElement;
        events: Array<string>;
    };
};

const test = base.extend({
    context: async ({ context }, use) => {
        const requests: Array<string> = [];
        await context.route('**/*', async (route) => {
            requests.push(route.request().url());
            await route.abort('blockedbyclient');
        });
        await use(context);
        expect(
            requests,
            'The highlighting-only textbox makes no requests',
        ).toEqual([]);
    },
});

let runtime: string;
test.beforeAll(async () => {
    const result = await build({
        stdin: {
            contents: `
                import { attachWikitextHighlighting } from './src/library/wikitext-textbox/index.ts';
                const textarea = document.querySelector('#source');
                const events = [];
                textarea.addEventListener('input', () => events.push('input'));
                textarea.addEventListener('change', () => events.push('change'));
                window.textboxFixture = {
                    attach: attachWikitextHighlighting,
                    controller: attachWikitextHighlighting(textarea),
                    textarea,
                    events,
                };
            `,
            resolveDir: fileURLToPath(new URL('../../../', import.meta.url)),
            loader: 'ts',
        },
        bundle: true,
        format: 'iife',
        loader: { '.css': 'text' },
        write: false,
    });
    runtime = result.outputFiles[0].text;
});

async function mount(
    page: Page,
    source: string,
    options: {
        readOnly?: boolean;
        disabled?: boolean;
        wrap?: string;
        focusBeforeAttach?: boolean;
    } = {},
): Promise<void> {
    await page.setContent(`<!doctype html><html lang="en"><head>
        <style>
            textarea { width: 420px; height: 120px; padding: 8px;
                font: 16px/24px monospace; box-sizing: border-box; }
            textarea::placeholder { color: rgb(90, 100, 110); opacity: 1; }
        </style>
        </head><body><form>
            <label for="source">Wikitext</label>
            <textarea id="source" name="source" class="original-input"
                style="resize: both;" spellcheck="false" aria-describedby="hint"
                placeholder="Write wikitext"></textarea>
            <p id="hint">Review the source before submitting.</p>
            <button type="button" id="outside">Outside</button>
        </form></body></html>`);
    await page.locator('#source').evaluate(
        (element, input) => {
            const textarea = element as HTMLTextAreaElement;
            textarea.value = input.source;
            textarea.readOnly = input.options.readOnly ?? false;
            textarea.disabled = input.options.disabled ?? false;
            textarea.wrap = input.options.wrap ?? 'soft';
            if (input.options.focusBeforeAttach) {
                textarea.focus();
                textarea.setSelectionRange(2, 7, 'backward');
            }
        },
        { source, options },
    );
    await page.addScriptTag({ content: runtime });
}

test('colors syntax while the native textarea remains the sole interactive form control', async ({
    page,
}) => {
    const source =
        '== Heading ==\n{{Cite web|title=Example}}\n[[Missing page]] <ref>note</ref>\n<img src="https://example.org/untrusted.png">';
    await mount(page, source);
    const input = page.getByRole('textbox', { name: 'Wikitext', exact: true });
    const highlight = page.locator('pre.kanade-wikitext-textbox-highlight');
    await expect(input).toHaveValue(source);
    await expect(input).toHaveAttribute('id', 'source');
    await expect(input).toHaveAttribute('aria-describedby', 'hint');
    await expect(highlight).toHaveAttribute('aria-hidden', 'true');
    await expect(
        highlight.locator('.kanade-source-editor-token--template-name'),
    ).toHaveText('Cite web');
    await expect(page.locator('textarea')).toHaveCount(1);
    await expect(page.getByRole('textbox')).toHaveCount(1);
    await input.focus();
    await expect(input).toBeFocused();
    expect(
        await input.evaluate(
            (element) => element instanceof HTMLTextAreaElement,
        ),
    ).toBe(true);
    expect(
        await page.evaluate(() =>
            new FormData(document.querySelector('form')!).get('source'),
        ),
    ).toBe(source);
    expect(
        await page.evaluate(
            () => (window as unknown as FixtureWindow).textboxFixture.events,
        ),
    ).toEqual([]);
    await expect(
        page.locator(
            'iframe, [contenteditable], [role="tooltip"], .kanade-source-editor-tooltip, .kanade-source-editor-page-preview',
        ),
    ).toHaveCount(0);
    await expect(
        highlight.locator(
            'a, button, img, script, .kanade-source-editor-token--missing, .kanade-source-editor-token--unchecked',
        ),
    ).toHaveCount(0);
});

test('typing, terminal newlines, native undo, and change events stay with the textarea', async ({
    page,
}) => {
    await mount(page, 'Start');
    const input = page.locator('#source');
    await input.focus();
    await input.press('ControlOrMeta+End');
    await input.press('Enter');
    await page.keyboard.insertText('{{Example}}');
    await expect(input).toHaveValue('Start\n{{Example}}');
    await expect(
        page.locator('.kanade-source-editor-token--template-name'),
    ).toHaveText('Example');
    expect(
        await input.evaluate((element) => {
            const textarea = element as HTMLTextAreaElement;
            return [textarea.selectionStart, textarea.selectionEnd];
        }),
    ).toEqual([17, 17]);
    await input.press('ControlOrMeta+z');
    await expect(input).toHaveValue('Start\n');
    await input.press('ControlOrMeta+Shift+z');
    await expect(input).toHaveValue('Start\n{{Example}}');
    await page.locator('#outside').click();
    expect(
        await page.evaluate(
            () => (window as unknown as FixtureWindow).textboxFixture.events,
        ),
    ).toEqual(['input', 'input', 'input', 'input', 'change']);
});

test('composition and programmatic refresh do not replace native text or selection', async ({
    page,
}) => {
    await mount(page, 'Original');
    const result = await page.evaluate(() => {
        const { textarea, controller, events } = (
            window as unknown as FixtureWindow
        ).textboxFixture;
        textarea.focus();
        textarea.dispatchEvent(
            new CompositionEvent('compositionstart', { bubbles: true }),
        );
        textarea.value = '中文 {{Template}}\n';
        textarea.setSelectionRange(2, 2);
        textarea.dispatchEvent(
            new InputEvent('input', {
                bubbles: true,
                inputType: 'insertCompositionText',
                data: '中文',
                isComposing: true,
            }),
        );
        textarea.dispatchEvent(
            new CompositionEvent('compositionend', {
                bubbles: true,
                data: '中文',
            }),
        );
        controller.refresh();
        return {
            source: textarea.value,
            selection: [textarea.selectionStart, textarea.selectionEnd],
            events: [...events],
        };
    });
    expect(result).toEqual({
        source: '中文 {{Template}}\n',
        selection: [2, 2],
        events: ['input'],
    });
    await expect(
        page.locator('.kanade-source-editor-token--template-name'),
    ).toHaveText('Template');
    await page.evaluate(() => {
        const { textarea, controller } = (window as unknown as FixtureWindow)
            .textboxFixture;
        textarea.value = '{{Changed}}';
        textarea.setSelectionRange(1, 4);
        controller.refresh();
    });
    await expect(
        page.locator('.kanade-source-editor-token--template-name'),
    ).toHaveText('Changed');
    expect(
        await page.locator('#source').evaluate((element) => {
            const textarea = element as HTMLTextAreaElement;
            return [textarea.selectionStart, textarea.selectionEnd];
        }),
    ).toEqual([1, 4]);
});

test('scroll offsets follow the native textarea in both directions', async ({
    page,
}) => {
    await mount(
        page,
        Array.from(
            { length: 40 },
            (_, index) => `${index} {{Template|${'long source '.repeat(20)}}}`,
        ).join('\n'),
        { wrap: 'off' },
    );
    await page.locator('#source').evaluate((element) => {
        element.scrollTop = 96;
        element.scrollLeft = 120;
        element.dispatchEvent(new Event('scroll'));
    });
    await expect
        .poll(() =>
            page.evaluate(() => {
                const input =
                    document.querySelector<HTMLTextAreaElement>('#source')!;
                const layer = document.querySelector<HTMLElement>(
                    '.kanade-wikitext-textbox-highlight',
                )!;
                return [
                    input.scrollTop,
                    layer.scrollTop,
                    input.scrollLeft,
                    layer.scrollLeft,
                ];
            }),
        )
        .toEqual([96, 96, 120, 120]);
});

test('read-only and disabled states remain native, including later changes', async ({
    page,
}) => {
    await mount(page, '{{Protected}}', { readOnly: true });
    const input = page.locator('#source');
    await expect(input).toHaveJSProperty('readOnly', true);
    await input.focus();
    await input.press('x');
    await expect(input).toHaveValue('{{Protected}}');
    await input.evaluate((element) => {
        const textarea = element as HTMLTextAreaElement;
        textarea.readOnly = false;
        textarea.disabled = true;
    });
    await expect(input).toBeDisabled();
    await page.locator('#outside').focus();
    await input.evaluate((element) => (element as HTMLTextAreaElement).focus());
    await expect(page.locator('#outside')).toBeFocused();
    expect(
        await page.evaluate(() =>
            new FormData(document.querySelector('form')!).has('source'),
        ),
    ).toBe(false);
    await input.evaluate((element) => {
        (element as HTMLTextAreaElement).disabled = false;
    });
    await input.focus();
    await input.press('ControlOrMeta+End');
    await page.keyboard.insertText(' edited');
    await expect(input).toHaveValue('{{Protected}} edited');
});

test('cleanup restores native presentation without losing edits or selection', async ({
    page,
}) => {
    await mount(page, 'Initial');
    const input = page.locator('#source');
    await input.fill('Edited {{Template}}\n');
    await input.evaluate((element) =>
        (element as HTMLTextAreaElement).setSelectionRange(2, 7),
    );
    const result = await page.evaluate(() => {
        const { textarea, controller, events } = (
            window as unknown as FixtureWindow
        ).textboxFixture;
        const before = events.length;
        controller.destroy();
        controller.destroy();
        return {
            source: textarea.value,
            selection: [textarea.selectionStart, textarea.selectionEnd],
            className: textarea.className,
            style: textarea.getAttribute('style'),
            parent: textarea.parentElement?.tagName,
            sameNode: document.querySelector('#source') === textarea,
            extraInputs: events
                .slice(before)
                .filter((event) => event === 'input').length,
        };
    });
    expect(result).toEqual({
        source: 'Edited {{Template}}\n',
        selection: [2, 7],
        className: 'original-input',
        style: 'resize: both;',
        parent: 'FORM',
        sameNode: true,
        extraInputs: 0,
    });
    await expect(
        page.locator(
            '.kanade-wikitext-textbox, .kanade-wikitext-textbox-highlight',
        ),
    ).toHaveCount(0);
    await expect(input).toBeVisible();
    await input.fill('Still editable');
    await expect(input).toHaveValue('Still editable');
});

test('native form reset redraws the empty field and keeps its placeholder visible', async ({
    page,
}) => {
    await mount(page, '{{Initial}}');
    const input = page.locator('#source');
    await input.fill('{{Edited}}');
    await page.locator('form').evaluate((element) => {
        (element as HTMLFormElement).reset();
    });
    await expect(input).toHaveValue('');
    await expect(page.locator('.kanade-wikitext-textbox-highlight')).toHaveText(
        '',
    );
    await expect(input).toHaveAttribute('placeholder', 'Write wikitext');
    expect(
        await input.evaluate((element) => {
            const placeholder = getComputedStyle(element, '::placeholder');
            return {
                shown: element.matches(':placeholder-shown'),
                color: placeholder.color,
                fill: placeholder.getPropertyValue('-webkit-text-fill-color'),
                opacity: placeholder.opacity,
            };
        }),
    ).toEqual({
        shown: true,
        color: 'rgb(90, 100, 110)',
        fill: 'rgb(90, 100, 110)',
        opacity: '1',
    });
});

test('attaching and removing highlighting preserves an active native selection', async ({
    page,
}) => {
    await mount(page, 'Before {{Template}} after', {
        focusBeforeAttach: true,
    });
    const input = page.locator('#source');
    const selection = () =>
        input.evaluate((element) => {
            const textarea = element as HTMLTextAreaElement;
            return [
                textarea.selectionStart,
                textarea.selectionEnd,
                textarea.selectionDirection,
            ];
        });
    await expect(input).toBeFocused();
    expect(await selection()).toEqual([2, 7, 'backward']);
    expect(
        await page.evaluate(() => {
            const { attach, textarea, controller } = (
                window as unknown as FixtureWindow
            ).textboxFixture;
            return attach(textarea) === controller;
        }),
    ).toBe(true);
    await expect(page.locator('.kanade-wikitext-textbox')).toHaveCount(1);
    await page.evaluate(() => {
        (
            window as unknown as FixtureWindow
        ).textboxFixture.controller.destroy();
    });
    await expect(input).toBeFocused();
    expect(await selection()).toEqual([2, 7, 'backward']);
    await page.keyboard.insertText(' replacement ');
    await expect(input).toHaveValue('Be replacement {{Template}} after');
});

test('the passive layer follows native typography and resizing', async ({
    page,
}) => {
    await mount(
        page,
        '== Heading ==\n{{Cite web|title=Example}}\n[[Page|label]]',
    );
    const alignment = () =>
        page.evaluate(() => {
            const input =
                document.querySelector<HTMLTextAreaElement>('#source')!;
            const layer = document.querySelector<HTMLElement>(
                '.kanade-wikitext-textbox-highlight',
            )!;
            const native = getComputedStyle(input);
            const backdrop = getComputedStyle(layer);
            const originalBounds = input.getBoundingClientRect();
            const highlightedBounds = layer.getBoundingClientRect();
            return {
                offset: [
                    highlightedBounds.x - originalBounds.x,
                    highlightedBounds.y - originalBounds.y,
                ],
                nativeWidth: input.clientWidth,
                highlightWidth: layer.clientWidth,
                nativeHeight: input.clientHeight,
                highlightHeight: layer.clientHeight,
                font: backdrop.font === native.font,
                padding: backdrop.padding === native.padding,
                whiteSpace: backdrop.whiteSpace,
            };
        });
    expect(await alignment()).toEqual({
        offset: [0, 0],
        nativeWidth: 418,
        highlightWidth: 418,
        nativeHeight: 118,
        highlightHeight: 118,
        font: true,
        padding: true,
        whiteSpace: 'pre-wrap',
    });
    await page.locator('#source').evaluate((element) => {
        const textarea = element as HTMLTextAreaElement;
        textarea.style.width = '320px';
        textarea.style.height = '180px';
        textarea.style.fontSize = '18px';
        textarea.style.padding = '12px';
        textarea.wrap = 'off';
    });
    await expect.poll(alignment).toEqual({
        offset: [0, 0],
        nativeWidth: 318,
        highlightWidth: 318,
        nativeHeight: 178,
        highlightHeight: 178,
        font: true,
        padding: true,
        whiteSpace: 'pre',
    });
});

test('separate textareas retain independent highlighting and disposal', async ({
    page,
}) => {
    await mount(page, '{{First}}');
    await page.evaluate(() => {
        const fixture = (window as unknown as FixtureWindow).textboxFixture;
        const second = document.createElement('textarea');
        second.id = 'second';
        second.value = '{{Second}}';
        document.body.append(second);
        fixture.attach(second);
        fixture.controller.destroy();
    });
    await expect(page.locator('.kanade-wikitext-textbox')).toHaveCount(1);
    await expect(
        page.locator('.kanade-source-editor-token--template-name'),
    ).toHaveText('Second');
    await page.locator('#second').fill('{{Independent}}');
    await expect(
        page.locator('.kanade-source-editor-token--template-name'),
    ).toHaveText('Independent');
    await expect(page.locator('#source')).toHaveValue('{{First}}');
});

test('callers can size the wrapper as a flex item and the native field at full width', async ({
    page,
}) => {
    await mount(page, '{{Responsive}}');
    await page.evaluate(() => {
        const wrapper = document.querySelector<HTMLElement>(
            '.kanade-wikitext-textbox',
        )!;
        const layout = document.createElement('div');
        layout.id = 'flex-layout';
        layout.style.cssText = 'display: flex; width: 600px; gap: 16px;';
        const sibling = document.createElement('div');
        sibling.style.cssText = 'flex: 0 0 32px;';
        wrapper.before(layout);
        layout.append(sibling, wrapper);
        wrapper.style.cssText += 'flex: 1; min-width: 0;';
        document.querySelector<HTMLTextAreaElement>('#source')!.style.width =
            '100%';
    });
    const widths = () =>
        page.evaluate(() => {
            const wrapper = document.querySelector<HTMLElement>(
                '.kanade-wikitext-textbox',
            )!;
            const input =
                document.querySelector<HTMLTextAreaElement>('#source')!;
            const layer = document.querySelector<HTMLElement>(
                '.kanade-wikitext-textbox-highlight',
            )!;
            return [wrapper.offsetWidth, input.offsetWidth, layer.offsetWidth];
        });
    await expect.poll(widths).toEqual([552, 552, 552]);
    await page.locator('#flex-layout').evaluate((element) => {
        (element as HTMLElement).style.width = '360px';
    });
    await expect.poll(widths).toEqual([312, 312, 312]);
    await expect(page.locator('#source')).toHaveValue('{{Responsive}}');
});
