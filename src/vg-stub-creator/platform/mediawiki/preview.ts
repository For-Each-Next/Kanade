/**
 * @file src/vg-stub-creator/platform/mediawiki/preview.ts
 * Purpose: Coordinates native and Action API parsing for dialog and inline previews.
 *
 * Table of contents:
 * 1. Imports
 * 2. PreviewMessages
 * 3. PreviewDependencies
 * 4. createPreviewController
 * 5. parseArticlePreviewText
 * 6. buildNativePreviewText
 * 7. parseNativePreviewText
 * 8. buildNativePreviewFormData
 * 9. extractNativePreviewHtml
 * 10. parsePreviewText
 * 11. fetchPageText
 */

import {
    readQueryPage,
    readPageRevision,
    readRevisionContent,
} from './query-response.ts';

import type { ArticleForm } from '../../domain/models.ts';
import { trimValue } from '../../domain/wikitext/index.ts';
import type {
    MediaWikiApiPort,
    PreviewAdapterPorts,
} from '../../app/contracts/application.ts';
import { serializeElementContent } from '../browser/preview-markup.ts';

interface PreviewMessages {
    previewHttp(status: number): string;
    previewMissing: string;
    unableRead(title: string): string;
}

export interface PreviewDependencies {
    createApi: () => MediaWikiApiPort;
    getPageName: () => string;
    messages: PreviewMessages;
}

/**
 * Creates preview operations bound to the current page-title provider.
 *
 * @param dependencies - API, page, and user-message dependencies.
 * @returns Bound preview operations.
 */
export function createPreviewController(
    dependencies: PreviewDependencies,
): PreviewAdapterPorts {
    const parseArticle = function parseArticle(
        text: string,
        form: ArticleForm,
    ): Promise<string> {
        return parseArticlePreviewText(
            dependencies,
            text,
            form,
            dependencies.getPageName(),
        );
    };
    const parseWikitext = function parseWikitext(
        text: string,
        title: string = dependencies.getPageName(),
    ): Promise<string> {
        return parsePreviewText(dependencies, text, title);
    };

    return {
        fetchPageText: fetchPageText.bind(null, dependencies),
        parseArticlePreviewText: parseArticle,
        parsePreviewText: parseWikitext,
    };
}

/**
 * Parses article wikitext through MediaWiki's native edit preview.
 *
 * @param text - Text to process.
 * @param form - Form value.
 * @param fallbackTitle - Fallback title value.
 * @returns Article wikitext parsed by MediaWiki's edit preview.
 */
async function parseArticlePreviewText(
    dependencies: PreviewDependencies,
    text: string,
    form: ArticleForm,
    fallbackTitle: string,
): Promise<string> {
    const nativeText = buildNativePreviewText(text, form, fallbackTitle);
    const draftTitle = trimValue(form.pageName) || fallbackTitle;
    return parseNativePreviewText(
        dependencies,
        nativeText,
        fallbackTitle,
        draftTitle,
    );
}

/**
 * Adds the heading expected by source-reading modules during preview.
 *
 * @param text - Text to process.
 * @param form - Form value.
 * @param fallbackTitle - Fallback title value.
 * @returns Resulting text.
 */
function buildNativePreviewText(
    text: string,
    form: ArticleForm,
    fallbackTitle: string,
): string {
    const title = trimValue(form.pageName) || fallbackTitle;
    return `= ${title} =\n${text}`;
}

/**
 * Requests MediaWiki's native edit preview without navigating away.
 *
 * @param text - Text to process.
 * @param title - Wiki title.
 * @param draftTitle - Target title for the Action API parser context.
 * @returns Native preview HTML, or Action API preview HTML when the host cannot provide it.
 */
async function parseNativePreviewText(
    dependencies: PreviewDependencies,
    text: string,
    title: string,
    draftTitle: string,
): Promise<string> {
    const url = mw.util.getUrl(title, { action: 'submit' });
    const response = await fetch(url, {
        body: buildNativePreviewFormData(text),
        credentials: 'same-origin',
        method: 'POST',
    });

    if (!response.ok) {
        const message = dependencies.messages.previewHttp(response.status);
        throw new Error(message);
    }

    const nativePreview = extractNativePreviewHtml(await response.text());
    if (nativePreview != null) return nativePreview;

    // Read-only and blocked edit views can return a normal HTML page without
    // #wikiPreview. The documented parse API can still preview the same text
    // without requiring an editor form or submitting an edit.
    const apiPreview = await parsePreviewText(
        dependencies,
        text,
        draftTitle,
        true,
    );
    if (apiPreview.trim() === '')
        throw new Error(dependencies.messages.previewMissing);
    return apiPreview;
}

/**
 * Builds a form payload compatible with MediaWiki's edit preview.
 *
 * @param text - Text to process.
 * @returns Built form payload compatible with MediaWiki's edit preview.
 */
function buildNativePreviewFormData(text: string): FormData {
    const editForm = document.getElementById(
        'editform',
    ) as HTMLFormElement | null;
    const formData = editForm == null ? new FormData() : new FormData(editForm);
    const previewButton = document.getElementById(
        'wpPreview',
    ) as HTMLInputElement | null;

    formData.set('wpTextbox1', text);
    formData.set('wpPreview', previewButton?.value || 'Show preview');
    formData.delete('wpSave');
    formData.delete('wpDiff');
    return formData;
}

/**
 * Extracts rendered preview content from a MediaWiki response document.
 *
 * @param responseHtml - Response html value.
 * @returns Value.
 */
function extractNativePreviewHtml(responseHtml: string): string | null {
    const doc = new DOMParser().parseFromString(responseHtml, 'text/html');
    const preview = doc.querySelector('#wikiPreview');

    if (preview == null) return null;

    const parserOutput = preview.matches('.mw-parser-output')
        ? preview
        : preview.querySelector('.mw-parser-output');
    return serializeElementContent(parserOutput || preview);
}

/**
 * Parses generated wikitext through MediaWiki's API.
 *
 * @param text - Text to process.
 * @param title - Wiki title.
 * @returns Parsed generated wikitext through MediaWiki's API.
 */
async function parsePreviewText(
    dependencies: PreviewDependencies,
    text: string,
    title: string,
    preview: boolean = false,
): Promise<string> {
    const response = await dependencies.createApi().post({
        action: 'parse',
        contentmodel: 'wikitext',
        disableeditsection: true,
        formatversion: 2,
        prop: 'text',
        text,
        title,
        ...(preview ? { preview: true } : {}),
    });

    const html = response?.parse?.text;
    return typeof html === 'string' ? html : '';
}

/**
 * Fetches the current source for one wiki page.
 *
 * @param title - Wiki title.
 * @returns Operation result.
 */
async function fetchPageText(
    dependencies: PreviewDependencies,
    title: string,
): Promise<string> {
    const response = await dependencies.createApi().get({
        action: 'query',
        formatversion: '2',
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main',
        titles: title,
    });
    const message = dependencies.messages.unableRead(title);
    const page = readQueryPage(response, message);
    return readRevisionContent(readPageRevision(page, message), message);
}
