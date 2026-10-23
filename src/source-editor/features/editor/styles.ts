/**
 * @file src/source-editor/features/editor/styles.ts
 * Purpose: Install shared syntax tokens and Source Editor interface styles once.
 *
 * Table of contents:
 * 1. Imports and state
 * 2. installSourceEditorStyles
 * 3. installSourceEditorFrameStyles
 * 4. getEditorStyles
 */

import tokenStyles from '../../../library/wikitext-highlighting/tokens.css';

let installed = false;
let styleNonce = '';

/** Adds package styles through MediaWiki's nonce-aware helper. */
export function installSourceEditorStyles(additionalStyles: string): void {
    if (installed) {
        return;
    }
    const sheet = mw.util.addCSS(`${getEditorStyles()}\n${additionalStyles}`);
    const owner = sheet.ownerNode;
    if (owner instanceof HTMLStyleElement) {
        styleNonce = owner.nonce;
    }
    installed = true;
}

/** Adds editor and token styles to the isolated editing document. */
export function installSourceEditorFrameStyles(target: Document): void {
    const style = target.createElement('style');
    style.dataset.kanadeSourceEditorStyle = 'editor';
    if (styleNonce !== '') {
        style.nonce = styleNonce;
    }
    style.textContent = getEditorStyles();
    target.head.append(style);
}

function getEditorStyles(): string {
    const editorStyles =
        typeof __SOURCE_EDITOR_EDITOR_STYLES__ === 'undefined'
            ? ''
            : __SOURCE_EDITOR_EDITOR_STYLES__;
    return `${tokenStyles}\n${editorStyles}`;
}
