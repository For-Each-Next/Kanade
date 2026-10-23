/**
 * @file src/source-editor/app/main.ts
 * Purpose: Compose Source Editor editing, reference workflows, and the control panel.
 *
 * Contents: Shared startup, active-editor access, and reference navigation.
 */

import { createEditorServices } from './editor-services.ts';
import { startEditorIntegration } from './editor-integration.ts';
import { createReferenceManagement } from './reference-management.ts';
import type { FormatterSettings } from '../domain/formatter-settings.ts';
import { getEditBox } from '../platform/mediawiki/edit-box/index.ts';
import { initializeSourceEditorI18n, msg } from '../i18n/index.ts';
import { createFormatterSettingsStore } from '../platform/browser/formatter-settings.ts';
import { startRegexReplacement } from '../platform/browser/regex-replacement.ts';
import {
    getDatabaseName,
    getRevisionId,
    isSectionEditing,
} from '../platform/mediawiki/editor-context.ts';
import { createWikiNamespaceResolver } from '../platform/mediawiki/namespaces.ts';
import { createActionNotifier } from '../platform/mediawiki/notifications.ts';
import { loadPageRevisionSource } from '../platform/mediawiki/page-source.ts';
import { createPageSummaryLoader } from '../platform/mediawiki/page-summary.ts';
import { lookupWikiLinks } from '../platform/mediawiki/wiki-links.ts';
import { getCurrentContentLanguage } from '../platform/wiki-policy.ts';
import { createLogger } from '../../library/logging/logger.ts';
import { resolveSourceEditorOptions } from '../domain/runtime-options.ts';

const STARTUP_KEY = Symbol.for('kanade.source-editor.startup');

/** Starts the editor and binds every references entry to the same active source. */
export function start(): Promise<void> {
    if (typeof mw === 'undefined' || typeof mw.loader?.using !== 'function')
        return Promise.resolve();
    const page = window as unknown as Record<PropertyKey, unknown>;
    const existing = page[STARTUP_KEY];
    if (existing instanceof Promise) return existing;
    const startup = initialize();
    page[STARTUP_KEY] = startup;
    void startup.catch((error) => {
        if (page[STARTUP_KEY] === startup) delete page[STARTUP_KEY];
        console.error('[Source Editor] Initialization failed', error);
    });
    return startup;
}

async function initialize(): Promise<void> {
    initializeSourceEditorI18n();
    const runtimeOptions = resolveSourceEditorOptions(
        window.sourceEditorConfig,
    );
    const logger = createLogger('source-editor', {
        level: runtimeOptions.logLevel,
    });
    const notify = createActionNotifier('source-editor');
    let openPanel:
        | ((
              initialTab?: 'formatting' | 'references' | 'editor' | 'tools',
          ) => Promise<void>)
        | undefined;
    const references = createReferenceManagement(logger, notify, async () => {
        await openPanel?.();
    });
    async function manageReferences(
        settings?: FormatterSettings,
    ): Promise<void> {
        const editor = getEditBox();
        if (editor == null) {
            mw.notify(msg('feedback.noEditor'), {
                type: 'warn',
                tag: 'source-editor',
            });
            return;
        }
        try {
            const citations = (settings ?? services.loadFormatterSettings())
                .citationFormatting;
            await references.open(editor, {
                citationLayout: citations.layout,
                referenceStyle: citations.compactReferences ? 'r' : 'ref',
                separateReferenceDefinitions:
                    citations.separateReferenceDefinitions,
                formatScriptTitles: citations.formatScriptTitles,
                scriptTitleMode: citations.scriptTitleMode,
            });
        } catch (error) {
            mw.notify(msg('feedback.openFailed'), {
                type: 'error',
                tag: 'source-editor',
            });
            throw error;
        }
    }
    const mediaWikiLogger = logger.child('mediawiki');
    const databaseName = getDatabaseName();
    const namespaces = createWikiNamespaceResolver(
        databaseName,
        mediaWikiLogger.child('namespaces'),
    );
    const services = createEditorServices({
        databaseName,
        getRevisionId,
        isSectionEditing,
        logger: mediaWikiLogger,
        uiLogger: logger.child('ui'),
        notify,
        namespaces: {
            current: namespaces.current,
            load: () => namespaces.load(new mw.Api()),
        },
        settings: createFormatterSettingsStore(),
        lookupLinks: (titles) => lookupWikiLinks(new mw.Api(), titles),
        loadRevisionSource: (revisionId) =>
            loadPageRevisionSource(new mw.Api(), revisionId),
        loadPageSummary: (target) =>
            createPageSummaryLoader(
                window.location.origin,
                mw.util.wikiScript('api'),
            )(target),
    });
    await startEditorIntegration({
        ...services,
        runtimeOptions,
        contentLanguage: getCurrentContentLanguage(),
        openReferences: manageReferences,
        startRegexReplacement,
        loadCitationFormattingContext: references.loadFormattingContext,
        registerPanelOpener(opener) {
            openPanel = opener;
        },
    });
    // VisualEditor's source mode has no native textarea for the enhanced surface.
    mw.hook('ve.wikitextInteractive').add(() => {
        void mw.loader
            .using(['mediawiki.util'])
            .then(() => {
                if (
                    document.getElementById('kanade-source-editor-panel') ||
                    !getEditBox()
                )
                    return;
                const item =
                    mw.util.addPortletLink(
                        'p-cactions',
                        '#',
                        msg('tool.name'),
                        'kanade-source-editor-panel',
                        msg('tool.description'),
                    ) ??
                    mw.util.addPortletLink(
                        'p-tb',
                        '#',
                        msg('tool.name'),
                        'kanade-source-editor-panel',
                        msg('tool.description'),
                    );
                const link = item?.matches('a')
                    ? item
                    : item?.querySelector('a');
                link?.addEventListener('click', (event) => {
                    event.preventDefault();
                    void manageReferences().catch(() => undefined);
                });
            })
            .catch((error: unknown) => {
                console.error(
                    '[Source Editor] Source-mode launcher failed',
                    error,
                );
                mw.notify(msg('feedback.openFailed'), {
                    type: 'error',
                    tag: 'source-editor',
                });
            });
    });
}
