/**
 * @file src/library/wikitext-textbox/index.ts
 * Purpose: Add syntax colors to a native wikitext textarea without extra editor features.
 * Contents: Text-only highlighting, native scroll alignment, refresh, and disposal.
 */

import { highlightWikitext } from '../wikitext-highlighting/highlighter.ts';
import tokenStyles from '../wikitext-highlighting/tokens.css';
import textboxStyles from './styles.css';

export interface WikitextTextbox {
    /** Redraw after assigning textarea.value programmatically. */
    refresh(): void;
    /** Remove highlighting without changing the native value or selection. */
    destroy(): void;
}

const attached = new WeakMap<HTMLTextAreaElement, WikitextTextbox>();
const INPUT_CLASS = 'kanade-wikitext-textbox-input';
const TEXT_PROPERTIES = [
    'direction',
    'fontFamily',
    'fontSize',
    'fontStretch',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'letterSpacing',
    'lineHeight',
    'overflowWrap',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'tabSize',
    'textAlign',
    'textIndent',
    'textTransform',
    'wordBreak',
    'wordSpacing',
] as const;

/**
 * Enhance a mounted block textbox in an owned form or dialog. A block wrapper
 * is inserted; callers style that wrapper for flex/grid placement and size the
 * textarea directly rather than through parent-child selectors.
 * The textarea remains the native form control:
 * typing, selection, undo, composition, readonly, and disabled stay browser-owned.
 * No MediaWiki runtime, network request, link checking, or popup is installed.
 */
export function attachWikitextHighlighting(
    textarea: HTMLTextAreaElement,
): WikitextTextbox {
    const existing = attached.get(textarea);
    if (existing) return existing;

    const target = textarea.ownerDocument;
    const view = target.defaultView!;
    const wasFocused = target.activeElement === textarea;
    const originalStyle = view.getComputedStyle(textarea);
    const foreground = originalStyle.color;
    const caret = originalStyle.caretColor;
    const hadInputClass = textarea.classList.contains(INPUT_CLASS);
    const wrapper = target.createElement('div');
    wrapper.className = 'kanade-wikitext-textbox';
    wrapper.style.setProperty(
        '--kanade-wikitext-textbox-foreground',
        foreground,
    );
    wrapper.style.setProperty('--kanade-wikitext-textbox-caret', caret);
    wrapper.style.setProperty('--kanade-source-editor-foreground', foreground);
    wrapper.style.setProperty(
        '--kanade-source-editor-background',
        originalStyle.backgroundColor,
    );

    const highlight = target.createElement('pre');
    highlight.className = 'kanade-wikitext-textbox-highlight';
    highlight.setAttribute('aria-hidden', 'true');
    const style = target.createElement('style');
    style.nonce =
        target.querySelector<HTMLStyleElement>('style[nonce]')?.nonce ?? '';
    style.textContent = `${tokenStyles}\n${textboxStyles}`;
    textarea.before(wrapper);
    wrapper.append(style, highlight, textarea);
    textarea.classList.add(INPUT_CLASS);
    if (wasFocused) textarea.focus({ preventScroll: true });

    let destroyed = false;
    const listeners = new view.AbortController();
    const listenerOptions = { signal: listeners.signal };

    function syncScroll(): void {
        highlight.scrollTop = textarea.scrollTop;
        highlight.scrollLeft = textarea.scrollLeft;
    }

    function align(): void {
        const computed = view.getComputedStyle(textarea);
        for (const property of TEXT_PROPERTIES) {
            highlight.style[property] = computed[property];
        }
        const borderX =
            parseFloat(computed.borderLeftWidth) +
            parseFloat(computed.borderRightWidth);
        const borderY =
            parseFloat(computed.borderTopWidth) +
            parseFloat(computed.borderBottomWidth);
        highlight.style.borderWidth = computed.borderWidth;
        highlight.style.top = `${textarea.offsetTop}px`;
        highlight.style.left = `${textarea.offsetLeft}px`;
        highlight.style.width = `${textarea.clientWidth + borderX}px`;
        highlight.style.height = `${textarea.clientHeight + borderY}px`;
        highlight.style.whiteSpace =
            textarea.wrap === 'off' ? 'pre' : 'pre-wrap';
        syncScroll();
    }

    function refresh(): void {
        if (destroyed) return;
        const fragment = target.createDocumentFragment();
        for (const segment of highlightWikitext(textarea.value)) {
            if (segment.classNames.length === 0) {
                fragment.append(target.createTextNode(segment.text));
            } else {
                const span = target.createElement('span');
                span.className = segment.classNames.join(' ');
                span.textContent = segment.text;
                fragment.append(span);
            }
        }
        if (textarea.value.endsWith('\n'))
            fragment.append(target.createElement('br'));
        highlight.replaceChildren(fragment);
        align();
    }

    textarea.addEventListener('input', refresh, listenerOptions);
    textarea.addEventListener('compositionend', refresh, listenerOptions);
    textarea.addEventListener('scroll', syncScroll, listenerOptions);
    textarea.form?.addEventListener(
        'reset',
        () => queueMicrotask(refresh),
        listenerOptions,
    );
    const resize = new view.ResizeObserver(align);
    resize.observe(textarea);
    const attributes = new view.MutationObserver(align);
    attributes.observe(textarea, {
        attributes: true,
        attributeFilter: [
            'class',
            'style',
            'wrap',
            'dir',
            'disabled',
            'readonly',
        ],
    });

    const control: WikitextTextbox = {
        refresh,
        destroy() {
            if (destroyed) return;
            destroyed = true;
            const wasFocused = target.activeElement === textarea;
            listeners.abort();
            resize.disconnect();
            attributes.disconnect();
            if (!hadInputClass) textarea.classList.remove(INPUT_CLASS);
            if (textarea.parentNode === wrapper) wrapper.before(textarea);
            wrapper.remove();
            if (wasFocused) textarea.focus({ preventScroll: true });
            attached.delete(textarea);
        },
    };
    attached.set(textarea, control);
    refresh();
    return control;
}
