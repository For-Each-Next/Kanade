/**
 * @file tests/source-editor/styles-loader.test.mjs
 * Purpose: Verify shared token styles reach both Source Editor documents.
 * Contents: Combined styles, single installation, and nonce propagation.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

test('host and frame styles share tokens while retaining local UI and nonce', async () => {
    const [tokens, editor] = await Promise.all([
        readFile('src/library/wikitext-highlighting/tokens.css', 'utf8'),
        readFile('src/source-editor/features/editor/styles.css', 'utf8'),
    ]);
    const { outputFiles } = await build({
        entryPoints: ['src/source-editor/features/editor/styles.ts'],
        bundle: true,
        format: 'cjs',
        platform: 'node',
        loader: { '.css': 'text' },
        define: { __SOURCE_EDITOR_EDITOR_STYLES__: JSON.stringify(editor) },
        write: false,
    });
    const dom = new JSDOM('<!doctype html><html><head></head></html>');
    try {
        const sheets = [];
        const owner = dom.window.document.createElement('style');
        owner.nonce = 'host-style-nonce';
        const module = { exports: {} };
        vm.runInNewContext(outputFiles[0].text, {
            module,
            HTMLStyleElement: dom.window.HTMLStyleElement,
            mw: {
                util: {
                    addCSS(css) {
                        sheets.push(css);
                        return { ownerNode: owner };
                    },
                },
            },
        });
        const styles = module.exports;
        styles.installSourceEditorStyles('.additional-dialog-style {}');
        styles.installSourceEditorStyles('.not-installed-twice {}');
        styles.installSourceEditorFrameStyles(dom.window.document);

        assert.deepEqual(sheets, [
            `${tokens}\n${editor}\n.additional-dialog-style {}`,
        ]);
        const frameStyle = dom.window.document.querySelector('style');
        assert.ok(frameStyle);
        assert.equal(frameStyle.textContent, `${tokens}\n${editor}`);
        assert.equal(frameStyle.nonce, 'host-style-nonce');
        assert.equal(frameStyle.dataset.kanadeSourceEditorStyle, 'editor');
    } finally {
        dom.window.close();
    }
});
