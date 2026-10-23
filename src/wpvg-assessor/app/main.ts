/**
 * @file src/wpvg-assessor/app/main.ts
 * Purpose: Composes the page-assessor UI, workflows, and MediaWiki adapters.
 *
 * Contents: Composition, page context, and host adapters.
 */

import { createAssessmentPageApi } from '../platform/mediawiki/assessment-page-api.ts';
import { createNewPageListApi } from '../platform/mediawiki/new-page-list-api.ts';
import { NEW_PAGE_LIST_TITLE } from '../platform/mediawiki/new-page-list-api.ts';
import { createArchivePageApi } from '../platform/mediawiki/archive-page-api.ts';
import { createNewPageArchiveWorkflow } from './archive-new-pages.ts';
import { createPageApi } from '../platform/mediawiki/page-api.ts';
import { createTalkPageApi } from '../platform/mediawiki/talk-page-api.ts';
import {
    getSubjectPageTitle,
    getTalkPageTitle,
} from '../platform/mediawiki/title.ts';
import { createCreationTimeCacheStore } from '../platform/browser/creation-time-cache.ts';
import { createAssessmentSessionStore } from '../platform/browser/assessment-session.ts';
import projectConfig from '../domain/project-config.ts';
import type {
    DialogPageContext,
    SaveReviewedDialog,
} from './dialog-contracts.ts';
import { buildNewPageListSummary } from '../domain/new-page-summary.ts';
import { msg } from '../i18n/index.ts';
import { startPageAssessor } from './interface.ts';
import { createDialogWorkflow } from './dialog-state.ts';
import { createReviewedDialogSaveWorkflow } from './save-dialog.ts';
import { createTalkSaveWorkflow } from './save-talk-assessment.ts';
import {
    createAssessmentStagingWorkflow,
    createCachedDialogLoader,
} from './staged-assessments.ts';
import { createLogger, type Logger } from '../../library/logging/logger.ts';
import { createActionNotifier } from '../platform/mediawiki/notifications.ts';
import { createCategoryApi } from '../platform/mediawiki/category-api.ts';
import { createCategoryAssessmentWorkflow } from './category-assessment.ts';
import { createAssessmentStateLoader } from './assessment-state.ts';
import { createReviewedAssessmentSaveWorkflow } from './save-assessment.ts';
import { getArticlePreviewStyles } from '../platform/browser/article-preview-styles.ts';

const STARTUP_KEY = Symbol.for('kanade.wpvg-assessor.startup');

/** Starts the composed browser gadget. */
export function start(): void {
    const page = window as unknown as Record<PropertyKey, unknown>;
    if (page[STARTUP_KEY] != null) return;
    // Claim the page before composing workflows or requesting host modules so
    // combined and individual installations retain one assessment owner.
    const owner = {};
    page[STARTUP_KEY] = owner;
    try {
        initialize();
    } catch (error) {
        if (page[STARTUP_KEY] === owner) delete page[STARTUP_KEY];
        throw error;
    }
}

/** Composes assessment workflows and starts their owned interface. */
function initialize(): void {
    const logger = createLogger('wpvg-assessor', {
        level: window.wpvgAssessorConfig?.logLevel,
    });
    const adapters = createMediaWikiAdapters(logger);
    const session = createAssessmentSessionStore(
        logger.child('storage.assessment-session'),
        JSON.stringify([
            mw.config.get('wgDBname'),
            mw.config.get('wgUserName'),
        ]),
    );
    const dialogWorkflow = createDialogWorkflow(
        {
            async fetchAssessmentPages(api, talkTitle) {
                const cachedList = session.read().newPageList;
                if (cachedList != null) {
                    return {
                        newPageList: cachedList,
                        talkPage: await adapters.pages.fetchPageText(
                            api,
                            talkTitle,
                        ),
                    };
                }
                return adapters.assessmentPages.fetchAssessmentPages(
                    api,
                    talkTitle,
                );
            },
            fetchPageCreationTimes: adapters.pages.fetchPageCreationTimes,
            fetchSubjectPageInfo: adapters.pages.fetchSubjectPageInfo,
            getSubjectPageTitle,
            getTalkPageTitle,
            savePreparedNewPageList:
                adapters.newPageList.savePreparedNewPageList,
        },
        projectConfig,
    );
    const saveTalkAssessment = createTalkSaveWorkflow({
        fetchPageText: adapters.pages.fetchPageText,
        logger: logger.child('workflow.talk-save'),
        postTalkPageEdit: adapters.talkPage.postTalkPageEdit,
    });
    const saveReviewedDialog = createReviewedDialogSaveWorkflow(
        {
            buildRegistrationSummary: buildNewPageListSummary,
            getRegistrationSave: dialogWorkflow.getRegistrationSave,
            logger: logger.child('workflow.dialog-save'),
            saveRegistration: dialogWorkflow.saveRegistration,
            saveTalkAssessment,
        },
        projectConfig,
    );
    const cache = createCachedDialogLoader({
        getTalkPageTitle,
        loadDialogState: dialogWorkflow.loadDialogState,
        logger: logger.child('workflow.dialog-cache'),
        session,
    });
    const saveReviewedState: SaveReviewedDialog = async (
        state,
        review,
        reportPhase,
    ) => {
        try {
            return await saveReviewedDialog(state, review, reportPhase);
        } finally {
            cache.invalidate();
        }
    };
    const notify = createActionNotifier('wpvg-assessor');
    const loadAssessmentState = createAssessmentStateLoader(
        {
            fetchPageText: adapters.pages.fetchPageText,
            getSubjectPageTitle,
            getTalkPageTitle,
        },
        projectConfig,
    );
    const saveReviewedAssessment = createReviewedAssessmentSaveWorkflow({
        logger: logger.child('workflow.assessment-save'),
        saveTalkAssessment,
    });
    const staging = createAssessmentStagingWorkflow(
        {
            changedBatchMessage: () => msg('dialog.batchChanged'),
            fetchNewPageList: adapters.newPageList.fetchNewPageList,
            fetchPageCreationTimes: adapters.pages.fetchPageCreationTimes,
            logger: logger.child('workflow.staging'),
            saveRegistration: dialogWorkflow.saveRegistration,
            saveReviewedDialog,
            session,
        },
        projectConfig,
    );

    startPageAssessor({
        archiveNewPages: createNewPageArchiveWorkflow({
            sourceTitle: NEW_PAGE_LIST_TITLE,
            fetchNewPageList: adapters.newPageList.fetchNewPageList,
            fetchPageText: adapters.archive.fetchPageText,
            async savePreparedNewPageList(
                api,
                snapshot,
                proposedText,
                summary,
            ) {
                try {
                    await adapters.newPageList.savePreparedNewPageList(
                        api,
                        snapshot,
                        proposedText,
                        summary,
                    );
                } finally {
                    cache.invalidate();
                }
            },
            saveArchivePage: adapters.archive.saveArchivePage,
            now: () => new Date(),
        }),
        categoryAssessment: createCategoryAssessmentWorkflow({
            ...adapters.category,
            loadAssessmentState,
            async saveReviewedAssessment(state, review) {
                try {
                    return await saveReviewedAssessment(state, review);
                } finally {
                    cache.invalidate();
                }
            },
            onSaveFailed(error) {
                notify({
                    key: 'category-save-failed',
                    message: msg('batch.saveFailed', {
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    }),
                    type: 'error',
                });
            },
            resolveTitle: (title) => mw.Title.newFromText(title),
            logger: logger.child('workflow.category'),
        }),
        createDialogPageContext,
        getArticlePreviewStyles,
        loadDialogState: cache.load,
        logger: logger.child('ui'),
        notify,
        saveReviewedDialog: saveReviewedState,
        staging: {
            ...staging,
            async save(api, batch, reportPhase) {
                try {
                    return await staging.save(api, batch, reportPhase);
                } finally {
                    cache.invalidate();
                }
            },
        },
    });
}

/** Creates external MediaWiki values for one dialog-opening attempt. */
function createDialogPageContext(): DialogPageContext {
    const pageName = mw.config.get('wgPageName');

    return {
        api: new mw.Api(),
        pageName,
        title: mw.Title.newFromText(pageName),
    };
}

function createMediaWikiAdapters(logger: Logger) {
    const mediaWikiLogger = logger.child('mediawiki');
    const cache = createCreationTimeCacheStore(logger.child('storage'));
    return Object.freeze({
        archive: createArchivePageApi(mediaWikiLogger.child('archive')),
        assessmentPages: createAssessmentPageApi(
            mediaWikiLogger.child('assessment-page'),
        ),
        category: createCategoryApi(mediaWikiLogger.child('category')),
        newPageList: createNewPageListApi(
            mediaWikiLogger.child('new-page-list'),
        ),
        pages: createPageApi(mediaWikiLogger.child('page'), cache),
        talkPage: createTalkPageApi(mediaWikiLogger.child('talk-page')),
    });
}
