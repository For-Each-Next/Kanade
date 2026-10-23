/**
 * @file src/vg-stub-creator/domain/edit-summary.ts
 * Purpose: Builds edit summaries for generated video game stubs.
 *
 * Table of contents:
 * 1. Constants and state
 * 2. EditSummaryMetadata
 * 3. buildEditSummary
 * 4. addEditSummarySuffix
 * 5. buildNavboxEditSummary
 * 6. buildYearSummaryText
 * 7. buildProseCountText
 * 8. buildProseDetailText
 * 9. buildSourceDetailText
 * 10. buildArticleCreationSummaryText
 * 11. buildEnwikiSummaryLink
 * 12. buildWikidataSummaryLink
 */

const EDIT_SUMMARY_SUFFIX =
    '[[m:User:For_Each_..._Next/global.js/create_vg_stub.js|🎮]]';

export interface EditSummaryMetadata {
    displayName?: string;
    enwikiTitle?: string;
    proseSinographs?: number;
    wikidataId?: string;
    year?: string;
}

/**
 * Builds a generated-stub edit summary.
 *
 * @param metadata - Edit summary metadata.
 * @param metadata.displayName - Summary display title.
 * @param metadata.enwikiTitle - English Wikipedia page title.
 * @param metadata.proseSinographs - Prose length in
 * sinographs.
 * @param metadata.wikidataId - Wikidata entity ID.
 * @param metadata.year - Release year.
 * @returns Generated edit summary.
 */
export function buildEditSummary(metadata: EditSummaryMetadata): string {
    const nameText = buildArticleCreationSummaryText(
        metadata.displayName ?? '',
        metadata.year ?? '',
    );
    const proseText =
        nameText === ''
            ? ''
            : buildProseDetailText(
                  buildProseCountText(metadata.proseSinographs ?? 0),
              );
    const sourceText = nameText === '' ? '' : buildSourceDetailText(metadata);
    return addEditSummarySuffix(`${nameText}${proseText}${sourceText}`);
}

/**
 * Identifies the tool in an edit summary.
 *
 * @param summary - Edit summary text.
 * @returns Attributed edit summary.
 */
export function addEditSummarySuffix(summary: string): string {
    const text = String(summary || '').trim();

    const result =
        text === '' ? EDIT_SUMMARY_SUFFIX : `${text} ${EDIT_SUMMARY_SUFFIX}`;
    return result;
}

/**
 * Builds the summary for a staged navbox edit.
 *
 * @param edit - Navbox edit values.
 * @param edit.create - Whether the navbox will be created.
 * @param edit.title - Full navbox page title.
 * @param articleTitle - Final linked article title.
 * @returns Navbox edit summary.
 */
export function buildNavboxEditSummary(
    edit: { create?: boolean; title?: unknown },
    articleTitle: unknown,
): string {
    const linkedTitle = String(articleTitle ?? '').trim();

    if (edit.create !== true) {
        return `add link to '[[${linkedTitle}]]'`;
    }

    const navboxTitle = String(edit.title ?? '').trim();
    return `create '${navboxTitle}', with link to '[[${linkedTitle}]]'`;
}

/**
 * Builds the year link for an edit summary.
 *
 * @param year - Release year.
 * @returns Year summary text.
 */
function buildYearSummaryText(year: string): string {
    const value = String(year || '').trim();
    const match = value.match(/\b\d{4}\b/u);

    if (match == null) {
        return '';
    }

    return match[0];
}

/**
 * Builds the prose count text for an edit summary.
 *
 * @param count - Prose length in sinographs.
 * @returns Prose count text.
 */
function buildProseCountText(count: number): string {
    if (!Number.isFinite(count) || count <= 0) {
        return '';
    }

    return `${Math.round(count)} equivalent sinographs`;
}

/**
 * Builds prose-count detail text for an edit summary.
 *
 * @param proseCount - Prose-count fragment.
 * @returns Prose-count detail summary text.
 */
function buildProseDetailText(proseCount: string): string {
    const text = String(proseCount || '').trim();

    return text === '' ? '' : `, with ${text}`;
}

/**
 * Builds source-link detail text for an edit summary.
 *
 * @param metadata - Edit summary metadata.
 * @param metadata.enwikiTitle - English Wikipedia page title.
 * @param metadata.wikidataId - Wikidata entity ID.
 * @returns Source-link detail text.
 */
function buildSourceDetailText(metadata: EditSummaryMetadata): string {
    const links = [
        buildEnwikiSummaryLink(metadata.enwikiTitle ?? ''),
        buildWikidataSummaryLink(metadata.wikidataId ?? ''),
    ].filter(Boolean);

    const result =
        links.length === 0
            ? ''
            : [
                  '; also see ',
                  links.map((link) => `"${link}"`).join(' and '),
                  '',
              ].join('');
    return result;
}

/**
 * Builds the article creation text for an edit summary.
 *
 * @param displayName - Summary display title.
 * @param year - Release year.
 * @returns Article creation summary text.
 */
function buildArticleCreationSummaryText(
    displayName: string,
    year: string,
): string {
    const label = String(displayName || '').trim();
    const yearText = buildYearSummaryText(year);

    if (label === '') {
        return '';
    }

    const result = [
        'create ',
        yearText === '' ? '' : `${yearText} `,
        'video game «',
        label,
        '»',
    ].join('');
    return result;
}

/**
 * Builds an English Wikipedia summary link.
 *
 * @param title - English Wikipedia page title.
 * @returns Summary link, or an empty string.
 */
export function buildEnwikiSummaryLink(title: string): string {
    const value = String(title || '').trim();

    return value === '' ? '' : `[[:w:en:${value}]]`;
}

/**
 * Builds a Wikidata summary link.
 *
 * @param id - Wikidata entity ID.
 * @returns Summary link, or an empty string.
 */
export function buildWikidataSummaryLink(id: string): string {
    const value = String(id || '').trim();

    return value === '' ? '' : `[[:d:${value}]]`;
}
