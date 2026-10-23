/**
 * @file src/source-editor/app/reference-management.ts
 * Purpose: Compose source lookup, review, and editing for the Source Editor references workspace.
 *
 * Contents: Reference services, dialog opener, and safe metadata storage.
 */

import {
    getCurrentWikiId,
    getCurrentWikiPolicy,
    getCurrentContentLanguage,
} from '../platform/wiki-policy.ts';
import {
    buildCs1CheckWikitext,
    requestCs1WikitextCheck,
    splitCs1CheckHtml,
} from '../platform/mediawiki/cs1-check.ts';
import {
    fetchAvailableArchive,
    resolveSourceMetadata,
} from '../platform/network/source-metadata.ts';
import {
    createTemplateDataObjectStorage,
    loadCitationTemplateData,
    type TemplateDataObjectStorage,
} from '../platform/mediawiki/template-data.ts';
import { resolveCitationWikiLink } from '../platform/mediawiki/wiki-link.ts';
import { createTemplateNameContextResolver } from '../platform/mediawiki/template-namespaces.ts';
import * as sourceManagerUi from '../features/source-manager/controller.ts';
import { createCs1ReviewWorkflow } from './workflows/cs1-review.ts';
import type { Logger } from '../../library/logging/logger.ts';
import type { ActionNotifier } from '../../library/notifications/contracts.ts';
import { writePreservingPosition } from '../platform/mediawiki/edit-box/index.ts';
import { findUsedMetadataFreeCitationTemplates } from '../domain/api.ts';
import { loadHostModules } from '../../library/mediawiki-runtime/modules.ts';

const cs1Review = createCs1ReviewWorkflow({
    buildCheckWikitext: buildCs1CheckWikitext,
    requestCheck: requestCs1WikitextCheck,
    splitCheckHtml: splitCs1CheckHtml,
});

/** Share metadata loading between the main formatter and reference task dialogs. */
export function createReferenceManagement(
    logger: Logger,
    notifyAction: ActionNotifier,
    openFormattingSettings?: () => Promise<void>,
) {
    const wikiId = getCurrentWikiId();
    const wiki = Object.freeze({
        wikiId,
        wikiPolicy: getCurrentWikiPolicy(),
        contentLanguage: getCurrentContentLanguage(),
        pageTitle: String(mw.config.get('wgPageName') ?? '').replaceAll(
            '_',
            ' ',
        ),
    });
    const templateNames = createTemplateNameContextResolver(wikiId);
    const openSourceManagerDialog =
        sourceManagerUi.createOpenSourceManagerDialog({
            wiki,
            loadModules: (modules) => loadHostModules(mw.loader, modules),
            writePreservingPosition,
            openFormattingSettings,
            cs1Review,
            fetchAvailableArchive,
            loadCitationTemplateData(names) {
                return loadCitationTemplateData(names, {
                    api: new mw.Api(),
                    storage: getTemplateDataStorage(),
                    templateNameContext: templateNames.current(),
                    wikiId,
                });
            },
            loadTemplateNameContext() {
                if (wikiId === 'enwiki' || wikiId === 'zhwiki') {
                    return Promise.resolve(templateNames.current());
                }
                return templateNames.load(new mw.Api());
            },
            logger: logger.child('ui.references'),
            notifyAction,
            resolveSourceMetadata(input, archiveSeed) {
                return resolveSourceMetadata(input, archiveSeed, {
                    wikiPolicy: wiki.wikiPolicy,
                });
            },
            resolveWikiLink(value) {
                return resolveCitationWikiLink(value, new mw.Api());
            },
        });
    return {
        open: openSourceManagerDialog,
        async loadFormattingContext(source: string) {
            const templateNameContext =
                wikiId === 'enwiki' || wikiId === 'zhwiki'
                    ? templateNames.current()
                    : await templateNames.load(new mw.Api());
            const names = findUsedMetadataFreeCitationTemplates(
                source,
                templateNameContext,
            );
            const runtimeTemplateData = names.length
                ? await loadCitationTemplateData(names, {
                      api: new mw.Api(),
                      storage: getTemplateDataStorage(),
                      templateNameContext,
                      wikiId,
                  })
                : {};
            return { runtimeTemplateData, templateNameContext };
        },
    };
}

function getTemplateDataStorage(): TemplateDataObjectStorage | undefined {
    try {
        return createTemplateDataObjectStorage(globalThis.localStorage);
    } catch {
        return undefined;
    }
}
