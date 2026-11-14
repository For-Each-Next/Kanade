/**
 * @file src/source-editor/app/editor-integration.ts
 * Purpose: Attach formatting and reference actions without replacing MediaWiki's editor.
 * Contents: Host discovery, native-editor compatibility, launchers, and action disposal.
 */

import type { EditorServices } from './editor-contracts.ts';
import { msg } from '../i18n/index.ts';
import { createFormatterActions } from './formatter.ts';
import {
    FORMATTER_DIALOG_STYLES,
    type FormatterDialogTab,
} from '../features/formatter/dialog.ts';
import { getFormatterEditor } from '../platform/mediawiki/formatter-editor.ts';
import { registerEditBoxHooks } from '../platform/mediawiki/edit-box/index.ts';
import { registerQuickAccessAction } from '../../library/quick-access/registry.ts';

const TEXTAREA_ID = 'wpTextbox1';
const TOOL_ID = 'kanade-source-editor-panel';

/** MediaWiki alone owns editor creation, highlighting, and CodeMirror preferences. */
export async function startEditorIntegration(
    services: EditorServices,
): Promise<void> {
    await waitForDocument();
    if (!isWikitextSourcePage()) return;
    registerEditBoxHooks();
    await mw.loader.using([
        'mediawiki.api',
        'mediawiki.util',
        '@wikimedia/codex',
    ]);
    if (!document.getElementById('kanade-source-editor-panel-styles')) {
        const style = document.createElement('style');
        style.id = 'kanade-source-editor-panel-styles';
        style.textContent = FORMATTER_DIALOG_STYLES;
        document.head.append(style);
    }
    const formatter = createFormatterActions(services, getFormatterEditor);
    services.registerPanelOpener?.(formatter.open);
    let quickAccessEditor: HTMLTextAreaElement | null = null;
    let releaseQuickAccess: (() => void) | undefined;

    function refresh(): void {
        installTool(formatter.open);
        const candidate = document.getElementById(TEXTAREA_ID);
        const textarea =
            candidate instanceof HTMLTextAreaElement && isWikitextSourcePage()
                ? candidate
                : null;
        if (textarea === quickAccessEditor) return;
        releaseQuickAccess?.();
        releaseQuickAccess = undefined;
        quickAccessEditor = textarea;
        if (!textarea) return;
        getFormatterEditor(textarea);
        const releaseFormat = registerQuickAccessAction({
            id: 'source-editor',
            label: msg('tool.format'),
            title: msg('tool.formatDescription'),
            activate: () => formatter.format(),
        });
        const openReferences = services.openReferences;
        const releaseReferences = openReferences
            ? registerQuickAccessAction({
                  id: 'source-editor-references',
                  label: msg('dialog.referencesTab'),
                  title: msg('dialog.manageReferences'),
                  activate: () => openReferences(),
              })
            : undefined;
        releaseQuickAccess = () => {
            releaseFormat();
            releaseReferences?.();
        };
    }
    refresh();
    mw.hook('wikipage.content').add(refresh);
    mw.hook('ve.wikitextInteractive').add(refresh);
}

function installTool(
    openFormatter: (initialTab?: FormatterDialogTab) => Promise<void>,
): void {
    if (document.getElementById(TOOL_ID) || !isWikitextSourcePage()) return;
    const add = (portlet: string): HTMLElement | null =>
        mw.util.addPortletLink(
            portlet,
            '#',
            msg('tool.name'),
            TOOL_ID,
            msg('tool.description'),
        );
    const item = add('p-cactions') ?? add('p-tb');
    const link = item?.matches('a') ? item : item?.querySelector('a');
    link?.addEventListener('click', (event) => {
        event.preventDefault();
        void openFormatter();
    });
}

function isWikitextSourcePage(): boolean {
    return (
        mw.config.get('wgPageContentModel') === 'wikitext' &&
        ['edit', 'submit'].includes(String(mw.config.get('wgAction')))
    );
}

function waitForDocument(): Promise<void> {
    if (document.readyState !== 'loading') return Promise.resolve();
    return new Promise((resolve) =>
        document.addEventListener('DOMContentLoaded', () => resolve(), {
            once: true,
        }),
    );
}
