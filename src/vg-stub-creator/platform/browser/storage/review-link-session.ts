/**
 * @file src/vg-stub-creator/platform/browser/storage/review-link-session.ts
 * Purpose: Owns one dialog instance's review-link opening state.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. createReviewLinkSession
 * 4. claimReviewLinksOpening
 */

import type { ReviewLinkSession } from '../../../app/contracts/application.ts';

const REVIEW_LINKS_OPENED_STORAGE_KEY = 'vg-stub-creator-review-links-opened';

/**
 * Creates an isolated one-shot review-link claim for a dialog instance.
 *
 * @param getStorage - Gets the current tab's storage.
 * @returns Per-instance review-link session.
 */
export function createReviewLinkSession(
    getStorage: () => Storage,
): ReviewLinkSession {
    let claimed = false;

    return {
        claim() {
            if (claimed) {
                return false;
            }

            claimed = true;

            try {
                return claimReviewLinksOpening(getStorage());
            } catch {
                return true;
            }
        },
    };
}

/**
 * Claims the one-time review-link opening for the current tab.
 *
 * @param storage - Tab-scoped storage implementation.
 * @returns Whether the caller claimed the opening.
 */
function claimReviewLinksOpening(storage: Storage): boolean {
    if (storage.getItem(REVIEW_LINKS_OPENED_STORAGE_KEY) !== null) {
        return false;
    }

    storage.setItem(REVIEW_LINKS_OPENED_STORAGE_KEY, '1');
    return true;
}
