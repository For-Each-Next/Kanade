/**
 * @file src/wpvg-assessor/app/source-links-browser.ts
 * Purpose: Install assessment source links before waiting for MediaWiki.
 * Contents: Independent source-page bootstrap and host-startup eligibility.
 */

import { isAssessorExternalSource } from '../domain/source-links.ts';
import { installAssessorSourceLinks } from '../platform/browser/source-links.ts';

/** External lists need link decoration only; wiki pages continue host startup. */
export function startBeforeHost(): boolean {
    installAssessorSourceLinks(window, document);
    return !isAssessorExternalSource(window.location.href);
}
