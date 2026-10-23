/**
 * @file src/wpvg-assessor/domain/assessment.ts
 * Purpose: Builds and updates talk-page assessment banner wikitext.
 *
 * Contents: Banner parsing, assessment transformations, and lossless lead replacement.
 */

import { stripNamespacePrefix } from '../../library/wiki-titles/wikipedia.ts';
import { maskSourceRanges, wikitext } from '../../library/wikitext/index.ts';

import type {
    ProjectBannerConfig,
    ProjectConfig,
    VideoGamesProjectConfig,
} from './project-types.ts';
import {
    CLASS_VALUES,
    IMPORTANCE_VALUES,
    NOT_VIDEO_GAME_IMPORTANCE,
    type Assessment,
    type AssessmentClass,
    type AssessmentImportance,
    type AssessmentProjectOption,
} from './types.ts';

const ARTICLES_FOR_CREATION_TEMPLATE = 'WikiProject Articles for creation';
const BANNER_SHELL_TEMPLATE = 'WikiProject banner shell';
const DYK_INVITE_TEMPLATE = 'DYK Invite';
const BANNER_SHELL_ALIASES = [
    'WikiProject banner shell',
    'Multiple wikiprojects',
    'Multiple WikiProjects',
    'Multiple Wikiprojects',
    'PJBS',
    'WikiProject Banner Shell',
    'WikiProject Shell',
    'WikiProjectBanners',
    'WikiProjectBannerShell',
    'WPBannerShell',
    'WPBS',
    'Wpbs',
    '多[個个][專专][題题]',
    '通用[評评][級级]',
    '[專专][題题][橫横]幅',
    '[維维]基[專专][題题][橫横]幅',
];
const EXISTING_PROJECT_ID_PREFIX = 'existing:';
const BANNER_SCAN_OPTIONS = {
    includeUnclosedLinks: true,
    literalTags: ['nowiki', 'pre', 'source', 'syntaxhighlight', 'math'],
};
const DEPARTED_VIDEO_GAMES_PARAMETERS = new Set([
    'b1',
    'b2',
    'b3',
    'b4',
    'b5',
    'b6',
    'minecraft-importance',
    'se-importance',
    'sega-importance',
    'nintendo-importance',
    'small',
    'demo',
    'attention',
    'nocat',
    'assessment cat',
]);

/**
 * Creates initial form data for the assessment dialog.
 *
 * @param projectConfig - Assessment project configuration.
 * @param text - Existing talk-page wikitext.
 * @returns Default assessment values.
 */
export function createDefaultAssessment(
    projectConfig: ProjectConfig,
    text = '',
): Assessment {
    const otherProjectEntries = projectConfig.otherProjects.map(
        function callback(project: { id: string }): [string, false] {
            return [project.id, false];
        },
    );
    const taskForceEntries = projectConfig.videoGames.taskForces.map(
        function callback(taskForce: { id: string }): [string, false] {
            return [taskForce.id, false];
        },
    );
    const result: Assessment = {
        className: 'Unassessed',
        importance: '',
        maintenance: {
            cover: false,
            needsInfobox: false,
            reassess: false,
            screenshot: false,
        },
        otherProjects: Object.fromEntries(otherProjectEntries),
        taskForces: Object.fromEntries(taskForceEntries),
    };
    return readExistingAssessment(result, text, projectConfig);
}

/**
 * Parses controls from recognizable assessment wikitext.
 *
 * @param projectConfig - Assessment project configuration.
 * @param text - Manually edited talk-page lead source.
 * @returns Parsed controls, or null without a managed banner.
 */
export function parseAssessment(
    projectConfig: ProjectConfig,
    text: string,
): Assessment | null {
    const templates = readLeadingTemplates(String(text || ''));
    const shell = templates.find((template) =>
        isBannerShellName(template.name),
    );
    const banners = collectExistingProjectBanners(templates);
    const videoGamesBanner = findProjectBanner(
        banners,
        projectConfig.videoGames,
    );
    const hasOtherProjectBanner = banners.some((banner) => {
        const name = readLeadingTemplates(banner)[0]?.name;
        return name != null && isOtherProjectName(name, projectConfig);
    });

    if (shell == null && videoGamesBanner == null && !hasOtherProjectBanner) {
        return null;
    }
    return createDefaultAssessment(projectConfig, text);
}

/**
 * Applies recognizable values from existing assessment banners.
 *
 * @param assessment - Initialized assessment values.
 * @param text - Existing talk-page source.
 * @param projectConfig - Project banner configuration.
 * @returns Assessment values populated from the current page.
 */
function readExistingAssessment(
    assessment: Assessment,
    text: string,
    projectConfig: ProjectConfig,
): Assessment {
    const templates = readLeadingTemplates(String(text || ''));
    const shell = templates.find((template) =>
        isBannerShellName(template.name),
    );
    const banners = collectExistingProjectBanners(templates);
    const videoGamesBanner = findProjectBanner(
        banners,
        projectConfig.videoGames,
    );
    const otherProjectBanner = banners.find((banner) => {
        const name = readLeadingTemplates(banner)[0]?.name;
        return name != null && isOtherProjectName(name, projectConfig);
    });

    if (
        videoGamesBanner == null &&
        (shell != null || otherProjectBanner != null)
    ) {
        assessment.importance = NOT_VIDEO_GAME_IMPORTANCE;
    }

    applyExistingClass(
        assessment,
        shell?.source,
        videoGamesBanner ?? otherProjectBanner,
        videoGamesBanner == null
            ? 'class'
            : projectConfig.videoGames.classParameter,
    );
    applyExistingVideoGames(
        assessment,
        videoGamesBanner,
        projectConfig.videoGames,
    );
    applyExistingOtherProjects(assessment, banners, projectConfig);
    return assessment;
}

/**
 * Collects nested project banners and standalone leading templates.
 *
 * @param templates - Leading top-level templates.
 * @returns Sources that may represent configured project banners.
 */
function collectExistingProjectBanners(
    templates: Array<TemplateToken>,
): Array<string> {
    const result = [];

    for (const template of templates) {
        if (isBannerShellName(template.name)) {
            result.push(...readNestedBannersFromShell(template.source));
        } else {
            result.push(template.source);
        }
    }

    return result;
}

/**
 * Finds the first banner matching a configured project.
 *
 * @param banners - Candidate banner sources.
 * @param project - Project configuration.
 * @returns Matching banner source, when present.
 */
function findProjectBanner(
    banners: Array<string>,
    project: ProjectBannerConfig | VideoGamesProjectConfig,
): string | undefined {
    return banners.find(function matchesConfiguredProject(banner) {
        const name = readLeadingTemplates(banner)[0]?.name;
        return name != null && matchesProject(name, project);
    });
}

/**
 * Finds template-derived options for unconfigured project banners.
 *
 * @param banners - Existing banner sources.
 * @param projectConfig - Project banner configuration.
 * @returns Unique template-derived project options.
 */
function findExistingOtherProjectOptions(
    banners: Array<string>,
    projectConfig: ProjectConfig,
): Array<AssessmentProjectOption> {
    const result = [];
    const seen = new Set<string>();

    for (const banner of banners) {
        const name = readLeadingTemplates(banner)[0]?.name;
        const label = readExistingProjectLabel(name);

        if (
            name == null ||
            label == null ||
            isConfiguredProjectName(name, projectConfig)
        ) {
            continue;
        }
        const id = buildExistingProjectId(name);
        if (!seen.has(id)) {
            seen.add(id);
            result.push({ id, label });
        }
    }

    return result;
}

/**
 * Checks whether a banner name belongs to a configured project.
 *
 * @param name - Existing template name.
 * @param projectConfig - Project banner configuration.
 * @returns Whether the name matches a configured project.
 */
function isConfiguredProjectName(
    name: string,
    projectConfig: ProjectConfig,
): boolean {
    return [projectConfig.videoGames, ...projectConfig.otherProjects].some(
        (project) => matchesProject(name, project),
    );
}

/**
 * Identifies configured or conventional secondary project banners.
 *
 * @param name - Existing template name.
 * @param projectConfig - Project banner configuration.
 * @returns Whether it is a recognizable non-VG project banner.
 */
function isOtherProjectName(
    name: string,
    projectConfig: ProjectConfig,
): boolean {
    return (
        !matchesProject(name, projectConfig.videoGames) &&
        !isBannerShellName(name) &&
        (readExistingProjectLabel(name) != null ||
            projectConfig.otherProjects.some((project) =>
                matchesProject(name, project),
            ))
    );
}

/**
 * Extracts a display label from a conventional project template name.
 *
 * @param name - Existing template name.
 * @returns Captured project label, when the name is conventional.
 */
function readExistingProjectLabel(name: string | undefined): string | null {
    const enteredName = stripNamespacePrefix(name ?? '', 'zhwiki', 10)
        .replace(/_/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
    const match =
        /^WikiProject\s+(.+)$/iu.exec(enteredName) ??
        /^(.+?)[專专][題题]$/u.exec(enteredName);
    return match?.[1]?.trim() || null;
}

/**
 * Builds a stable selection ID from an existing project template name.
 *
 * @param name - Existing template name.
 * @returns Dynamic project selection ID.
 */
function buildExistingProjectId(name: string): string {
    return `${EXISTING_PROJECT_ID_PREFIX}${normalizeTemplateName(name)}`;
}

/**
 * Checks whether an existing secondary banner should remain selected.
 *
 * @param name - Existing template name.
 * @param assessment - Current assessment selections.
 * @param projectConfig - Project banner configuration.
 * @returns Whether the existing banner should be preserved.
 */
function isExistingOtherProjectSelected(
    name: string,
    assessment: Assessment,
    projectConfig: ProjectConfig,
): boolean {
    const configured = projectConfig.otherProjects.some((project) =>
        matchesProject(name, project),
    );
    if (configured || readExistingProjectLabel(name) == null) {
        return true;
    }
    const id = buildExistingProjectId(name);
    return assessment.otherProjects[id] !== false;
}

/**
 * Applies the existing shared or per-banner class.
 *
 * @param assessment - Mutable assessment values.
 * @param shell - Existing banner-shell source.
 * @param banner - Existing primary or secondary project banner.
 * @param classParameter - Existing banner's class parameter name.
 */
function applyExistingClass(
    assessment: Assessment,
    shell: string | undefined,
    banner: string | undefined,
    classParameter: string,
): void {
    const shellClass = readTemplateParameter(shell, 'class');
    const bannerClass = readTemplateParameter(banner, classParameter);
    const className = normalizeAssessmentClass(shellClass ?? bannerClass);

    if (className != null) {
        assessment.className = className;
    }
}

/**
 * Applies primary-project importance, task-force, and maintenance
 * values.
 *
 * @param assessment - Mutable assessment values.
 * @param banner - Existing primary project banner.
 * @param config - Primary project configuration.
 */
function applyExistingVideoGames(
    assessment: Assessment,
    banner: string | undefined,
    config: VideoGamesProjectConfig,
): void {
    if (banner == null) {
        return;
    }

    const importance = readAssessmentImportance(
        readTemplateParameter(banner, config.importanceParameter),
    );
    if (importance != null) {
        assessment.importance = importance;
    }
    for (const taskForce of config.taskForces) {
        assessment.taskForces[taskForce.id] = readTaskForceParameter(
            banner,
            taskForce,
        );
    }
    applyExistingMaintenance(assessment, banner);
}

/**
 * Applies existing primary-project maintenance flags.
 *
 * @param assessment - Mutable assessment values.
 * @param banner - Existing primary project banner.
 */
function applyExistingMaintenance(
    assessment: Assessment,
    banner: string,
): void {
    assessment.maintenance.reassess = readBooleanParameter(banner, 'reassess');
    assessment.maintenance.needsInfobox = readBooleanParameter(
        banner,
        'needs-infobox',
    );
    assessment.maintenance.cover = readBooleanParameter(banner, 'cover');
    assessment.maintenance.screenshot = readBooleanParameter(
        banner,
        'screenshot',
    );
}

/**
 * Marks configured secondary projects already present on the page.
 *
 * @param assessment - Mutable assessment values.
 * @param banners - Existing project banner sources.
 * @param projectConfig - Project banner configuration.
 */
function applyExistingOtherProjects(
    assessment: Assessment,
    banners: Array<string>,
    projectConfig: ProjectConfig,
): void {
    for (const project of projectConfig.otherProjects) {
        assessment.otherProjects[project.id] =
            findProjectBanner(banners, project) != null;
    }
    for (const project of findExistingOtherProjectOptions(
        banners,
        projectConfig,
    )) {
        assessment.otherProjects[project.id] = true;
    }
}

/**
 * Lists unconfigured WikiProject banners that can be toggled in the UI.
 *
 * @param text - Existing talk-page source.
 * @param projectConfig - Project banner configuration.
 * @returns Template-derived project labels and selection IDs.
 */
export function getExistingOtherProjectOptions(
    text: string,
    projectConfig: ProjectConfig,
): Array<AssessmentProjectOption> {
    return findExistingOtherProjectOptions(
        collectExistingProjectBanners(readLeadingTemplates(String(text || ''))),
        projectConfig,
    );
}

/**
 * Applies selected assessment banners to the top of a talk page.
 *
 * @param text - Existing talk-page wikitext.
 * @param assessment - Selected assessment values.
 * @param projectConfig - Assessment project configuration.
 * @returns Updated talk-page wikitext.
 */
export function updateTalkPageAssessment(
    text: string,
    assessment: Assessment,
    projectConfig: ProjectConfig,
): string {
    const banners = buildAssessmentBanners(assessment, projectConfig, text);
    const result = replaceManagedTopTemplates(text, banners, projectConfig);
    return result;
}

/**
 * Applies manually edited assessment top-section text to a talk page.
 *
 * @param text - Existing talk-page wikitext.
 * @param topSection - Replacement top-section wikitext.
 * @returns Updated talk-page wikitext.
 */
export function updateTalkPageTopSection(
    text: string,
    topSection: string,
): string {
    const source = String(text || '');
    const replacement = String(topSection || '');
    const heading = /^=+/mu.exec(source);
    const remainder = heading == null ? '' : source.slice(heading.index);

    if (remainder === '') {
        return replacement;
    }

    if (replacement === '') {
        return remainder;
    }

    if (replacement.endsWith('\n\n')) {
        return `${replacement}${remainder}`;
    }

    const separator = replacement.endsWith('\n') ? '\n' : '\n\n';
    return `${replacement}${separator}${remainder}`;
}

/**
 * Replaces managed assessment templates while preserving other lead
 * content.
 *
 * @param text - Existing talk-page wikitext.
 * @param banners - Replacement assessment banners.
 * @param projectConfig - Assessment project configuration.
 * @returns Updated talk-page wikitext.
 */
function replaceManagedTopTemplates(
    text: string,
    banners: string,
    projectConfig: ProjectConfig,
): string {
    const source = String(text || '');
    const replacement = String(banners || '').trim();
    const templates = readLeadingTemplates(source);
    const patterns = buildManagedTemplatePatterns(projectConfig);
    const managed = templates.filter(function isManaged(template) {
        return isManagedTemplate(template.name, patterns);
    });

    if (managed.length > 0) {
        return replaceLeadingManagedTemplates(
            source,
            templates,
            managed[0],
            replacement,
            patterns,
        );
    }

    const cleaned = source.replace(/^\s+/u, '');

    if (cleaned === '') {
        return `${replacement}\n`;
    }

    return `${replacement}\n\n${cleaned}`;
}

/**
 * Builds all selected assessment banner calls.
 *
 * @param assessment - Selected assessment values.
 * @param projectConfig - Assessment project configuration.
 * @param text - Existing talk-page wikitext.
 * @returns Assessment banner wikitext.
 */
export function buildAssessmentBanners(
    assessment: Assessment,
    projectConfig: ProjectConfig,
    text = '',
): string {
    const existingBanners = extractBannersForAssessmentShell(
        text,
        assessment,
        projectConfig,
    );
    const existingVideoGamesBanner = findProjectBanner(
        existingBanners,
        projectConfig.videoGames,
    );
    const videoGamesBanner =
        assessment.importance === NOT_VIDEO_GAME_IMPORTANCE
            ? null
            : buildVideoGamesBanner(
                  assessment,
                  projectConfig.videoGames,
                  existingVideoGamesBanner,
              );
    const banners = replaceExistingVideoGamesBanners(
        existingBanners,
        videoGamesBanner,
        assessment,
        projectConfig,
    );
    const otherProjectBanners = buildSelectedOtherProjectBanners(
        assessment,
        projectConfig,
        existingBanners,
    );
    for (const banner of otherProjectBanners) {
        appendAssessmentContent(banners, [banner]);
    }

    return buildBannerShell(assessment.className, banners, text);
}

/**
 * Replaces primary-project banners without reordering nested projects.
 *
 * @param banners - Existing nested banners.
 * @param replacement - Updated primary project banner, or null to remove it.
 * @param assessment - Current assessment selections.
 * @param projectConfig - Project banner configuration.
 * @returns Existing banner order with the selected primary banner omitted
 * or included once.
 */
function replaceExistingVideoGamesBanners(
    banners: Array<string>,
    replacement: string | null,
    assessment: Assessment,
    projectConfig: ProjectConfig,
): Array<string> {
    const result = [];
    let replaced = false;

    for (const banner of banners) {
        const name = readLeadingTemplates(banner)[0]?.name;
        const matches =
            name != null && matchesProject(name, projectConfig.videoGames);
        if (matches) {
            if (!replaced && replacement != null) {
                result.push(replacement);
                replaced = true;
            } else if (result.at(-1)?.trim() === '') {
                result.pop();
            }
            continue;
        }

        const selected =
            name == null ||
            isExistingOtherProjectSelected(name, assessment, projectConfig);
        if (selected) {
            result.push(banner);
        } else if (result.at(-1)?.trim() === '') {
            result.pop();
        }
    }

    if (!replaced && replacement != null) {
        appendAssessmentContent(result, [replacement]);
    }

    return result;
}

/**
 * Builds every selected secondary WikiProject banner.
 *
 * @param assessment - Selected assessment values.
 * @param projectConfig - Project banner configuration.
 * @param existingBanners - Current nested banner sources.
 * @returns Selected secondary project banner calls.
 */
function buildSelectedOtherProjectBanners(
    assessment: Assessment,
    projectConfig: ProjectConfig,
    existingBanners: Array<string>,
): Array<string> {
    return projectConfig.otherProjects.flatMap(function buildSelected(project) {
        const selected = assessment.otherProjects?.[project.id];
        const exists = findProjectBanner(existingBanners, project) != null;

        return selected && !exists ? [buildSimpleProjectBanner(project)] : [];
    });
}

/**
 * Returns the top talk-page code after applying the assessment.
 *
 * @param text - Existing talk-page wikitext.
 * @param assessment - Selected assessment values.
 * @param projectConfig - Assessment project configuration.
 * @returns Previewed top-section wikitext.
 */
export function previewTalkPageTopSection(
    text: string,
    assessment: Assessment,
    projectConfig: ProjectConfig,
): string {
    const updatedText = updateTalkPageAssessment(
        text,
        assessment,
        projectConfig,
    );
    const result = getTopSection(updatedText);
    return result;
}

/**
 * Returns the current lead section before the first heading.
 *
 * @param text - Talk-page wikitext.
 * @returns Lead-section source.
 */
export function getTalkPageTopSection(text: string): string {
    return getTopSection(text);
}

/**
 * Checks whether the leading talk-page templates include a DYK invite.
 *
 * @param text - Talk-page wikitext.
 * @returns Whether a DYK invite is present at the top of the page.
 */
export function hasDykInviteAtTop(text: string): boolean {
    return readLeadingTemplates(String(text || '')).some(
        function isDykInvite(template) {
            return matchesTemplateName(template.name, DYK_INVITE_TEMPLATE);
        },
    );
}

/**
 * Checks whether a proposed lead change only adds an empty importance
 * field.
 *
 * @param oldTopSection - Existing top-section source.
 * @param newTopSection - Proposed top-section source.
 * @returns Whether the only effective change is |importance=.
 */
export function isEmptyImportanceOnlyChange(
    oldTopSection: string,
    newTopSection: string,
): boolean {
    const oldText = String(oldTopSection || '').trim();
    const newText = String(newTopSection || '').trim();

    const result =
        oldText !== newText &&
        removeEmptyImportanceParameters(oldText) ===
            removeEmptyImportanceParameters(newText);
    return result;
}

/**
 * Gets whether new-page-list registration should be checked by default.
 *
 * @param namespaceNumber - Current page namespace number.
 * @param title - Current normalized page title.
 * @returns Whether registration should default to checked.
 */
export function shouldRegisterByDefault(
    namespaceNumber: number,
    title: string,
): boolean {
    return namespaceNumber === 0 || !String(title || '').includes('/');
}

/**
 * Replaces managed templates within the leading template sequence.
 *
 * @param source - Existing page source.
 * @param templates - Leading top-level templates.
 * @param firstManaged - First managed template to replace.
 * @param replacement - Replacement banner shell.
 * @param patterns - Managed template matchers.
 * @returns Source with one replacement at the original assessment
 * position.
 */
function replaceLeadingManagedTemplates(
    source: string,
    templates: Array<TemplateToken>,
    firstManaged: TemplateToken,
    replacement: string,
    patterns: Array<RegExp>,
): string {
    const first = templates[0];
    const last = templates.at(-1);

    if (first == null || last == null) {
        return source;
    }

    let result = source.slice(0, first.start);

    for (let index = 0; index < templates.length; index += 1) {
        const template = templates[index];
        const previous = templates[index - 1];
        const separatorStart = previous?.end ?? template.start;
        const separator = source.slice(separatorStart, template.start);
        const managed = isManagedTemplate(template.name, patterns);

        if (template === firstManaged) {
            result += `${separator}${replacement}`;
        } else if (!managed) {
            const followsManaged =
                previous != null && isManagedTemplate(previous.name, patterns);
            const retainedSeparator =
                followsManaged && separator.trim() === ''
                    ? separator.replace(/(\r?\n)[ \t]+/gu, '$1')
                    : separator;

            result += `${retainedSeparator}${template.source}`;
        } else if (separator.trim() !== '') {
            result += separator;
        }
    }

    return result + source.slice(last.end);
}

/**
 * Checks whether a template name matches the managed patterns.
 *
 * @param name - Template name.
 * @param patterns - Managed template patterns.
 * @returns Whether the template is managed.
 */
function isManagedTemplate(name: string, patterns: Array<RegExp>): boolean {
    const normalizedName = normalizeTemplateName(name);
    return (
        matchesAnyPattern(patterns, normalizedName) ||
        readExistingProjectLabel(name) != null
    );
}

/**
 * Builds normalized template-name patterns for managed banners.
 *
 * @param projectConfig - Assessment project configuration.
 * @returns Normalized template name patterns.
 */
function buildManagedTemplatePatterns(
    projectConfig: ProjectConfig,
): Array<RegExp> {
    const result = [
        ...BANNER_SHELL_ALIASES,
        ARTICLES_FOR_CREATION_TEMPLATE,
        ...[projectConfig.videoGames, ...projectConfig.otherProjects].flatMap(
            (project) => [project.template, ...(project.aliases || [])],
        ),
    ].map(buildTemplatePattern);
    return result;
}

/**
 * Builds one template-name matcher.
 *
 * @param name - Literal template name or simple alias regex.
 * @returns Template-name pattern.
 */
function buildTemplatePattern(name: string): RegExp {
    const normalizedName = normalizeTemplateName(name);
    const parts = normalizedName.split(/(\[[^\]]+\])/u);
    const patternParts = [];

    for (const part of parts) {
        let patternPart = part;

        if (!part.startsWith('[')) {
            patternPart = escapeRegExp(part);
        }

        patternParts.push(patternPart);
    }

    const pattern = patternParts.join('');

    return new RegExp(`^${pattern}$`, 'iu');
}

/**
 * Normalizes template names for redirect and whitespace-tolerant
 * matching.
 *
 * @param name - Raw transcluded template name.
 * @returns Normalized template key.
 */
function normalizeTemplateName(name: string): string {
    const result = stripNamespacePrefix(String(name || ''), 'zhwiki', 10)
        .replace(/_/gu, ' ')
        .replace(/\s+/gu, ' ')
        .toLowerCase();
    return result;
}

/**
 * Escapes a literal string for RegExp source.
 *
 * @param value - Literal pattern segment.
 * @returns Escaped pattern segment.
 */
function escapeRegExp(value: string): string {
    return value.replace(/[\\^$.*+?()[\]{}|]/gu, '\\$&');
}

/** One recognized banner or unmanaged leading template with original source offsets. */
interface TemplateToken {
    end: number;
    name: string;
    source: string;
    start: number;
}

/** Link labels are not banner bodies, even when their source is unfinished. */
function queryBannerSource(source: string) {
    const query = wikitext(source, BANNER_SCAN_OPTIONS);
    return wikitext(
        maskSourceRanges(source, query.link.getAll()),
        BANNER_SCAN_OPTIONS,
    );
}

/** Retains original source slices for the top-level banners found by the shared scanner. */
function readBannerTemplates(source: string): TemplateToken[] {
    return queryBannerSource(source)
        .template.getAll()
        .filter((template) => template.depth === 0)
        .map(({ end, name, start }) => ({
            end,
            name,
            source: source.slice(start, end),
            start,
        }));
}

/**
 * Reads the uninterrupted leading sequence of top-level templates.
 * Scanner results are indexed once for the entire leading sequence.
 *
 * @param text - Talk-page source.
 * @returns Leading template tokens, including unmanaged templates.
 */
function readLeadingTemplates(text: string): Array<TemplateToken> {
    const query = queryBannerSource(text);
    const comments = new Map(
        query.comment.getAll().map(({ start, end }) => [start, end]),
    );
    const ranges = new Map(
        [...query.template.getAll(), ...query.templateParameter.getAll()].map(
            (range) => [range.start, range],
        ),
    );
    const result: TemplateToken[] = [];
    let offset = skipLeadingWhitespaceAndComments(text, 0, comments);
    let range = ranges.get(offset);
    while (range != null) {
        const raw = text.slice(range.start, range.end);
        result.push({
            end: range.end,
            name: wikitext(raw, BANNER_SCAN_OPTIONS).template.parser().name,
            source: raw,
            start: range.start,
        });
        offset = skipLeadingWhitespaceAndComments(text, range.end, comments);
        range = ranges.get(offset);
    }

    return result;
}

/**
 * Extracts banners that should be nested in the assessment shell.
 *
 * @param text - Existing talk-page source.
 * @param assessment - Selected secondary projects to retain from standalone
 * banners.
 * @param projectConfig - Configured standalone secondary project banners.
 * @returns Existing nested and configured secondary banners plus one AfC.
 */
function extractBannersForAssessmentShell(
    text: string,
    assessment: Assessment,
    projectConfig: ProjectConfig,
): Array<string> {
    const source = String(text || '');
    const result: Array<string> = [];
    let articlesForCreationFound = false;

    for (const template of readLeadingTemplates(source)) {
        if (isBannerShellName(template.name)) {
            articlesForCreationFound = appendNestedAssessmentBanners(
                result,
                template.source,
                true,
                articlesForCreationFound,
            );
            continue;
        }

        const isArticlesForCreation = matchesTemplateName(
            template.name,
            ARTICLES_FOR_CREATION_TEMPLATE,
        );
        const configuredSecondary = projectConfig.otherProjects.find(
            (project) => matchesProject(template.name, project),
        );
        const isSelectedSecondary =
            configuredSecondary != null
                ? assessment.otherProjects?.[configuredSecondary.id]
                : isOtherProjectName(template.name, projectConfig) &&
                  isExistingOtherProjectSelected(
                      template.name,
                      assessment,
                      projectConfig,
                  );
        const isVideoGames = matchesProject(
            template.name,
            projectConfig.videoGames,
        );
        const shouldInclude =
            (isArticlesForCreation && !articlesForCreationFound) ||
            (!isArticlesForCreation && (isVideoGames || isSelectedSecondary));
        if (shouldInclude) {
            appendAssessmentContent(result, [template.source.trim()]);
            articlesForCreationFound ||= isArticlesForCreation;
        }
    }

    return result;
}

/**
 * Appends recognized nested banners while optionally deduplicating AfC.
 *
 * @param result - Collected banner calls.
 * @param shell - Existing banner-shell source.
 * @param deduplicateArticlesForCreation - Whether to collapse AfC
 * calls.
 * @param articlesForCreationFound - Whether an AfC call was already
 * found.
 * @returns Whether an AfC call has been found.
 */
function appendNestedAssessmentBanners(
    result: Array<string>,
    shell: string,
    deduplicateArticlesForCreation: boolean,
    articlesForCreationFound: boolean,
): boolean {
    let found = articlesForCreationFound;
    const parts = [];

    for (const banner of readNestedBannersFromShell(shell)) {
        const name = readLeadingTemplates(banner)[0]?.name;

        if (name == null) {
            parts.push(banner);
            continue;
        }

        const isArticlesForCreation = matchesTemplateName(
            name,
            ARTICLES_FOR_CREATION_TEMPLATE,
        );
        if (deduplicateArticlesForCreation && isArticlesForCreation && found) {
            if (parts.at(-1)?.trim() === '') {
                parts.pop();
            }
            continue;
        }

        parts.push(banner);
        found ||= isArticlesForCreation;
    }

    appendAssessmentContent(result, parts);

    return found;
}

/**
 * Appends a source group with a separator only when its boundary needs one.
 *
 * @param result - Accumulated shell-body source parts.
 * @param parts - Next preserved body or standalone banner source.
 */
function appendAssessmentContent(
    result: Array<string>,
    parts: Array<string>,
): void {
    if (parts.length === 0) {
        return;
    }
    if (
        result.length > 0 &&
        !/\s$/u.test(result.at(-1) ?? '') &&
        !/^\s/u.test(parts[0])
    ) {
        result.push('\n');
    }
    result.push(...parts);
}

/**
 * Reads nested banner template calls from a banner shell.
 *
 * @param shell - Banner-shell source.
 * @returns Nested template calls.
 */
function readNestedBannersFromShell(shell: string): Array<string> {
    const inner = extractBannerShellBannerBody(shell);
    const parts = [];
    let offset = 0;

    for (const next of readBannerTemplates(inner)) {
        if (offset < next.start) {
            parts.push(inner.slice(offset, next.start));
        }
        parts.push(next.source);
        offset = next.end;
    }
    if (offset < inner.length) {
        parts.push(inner.slice(offset));
    }
    return parts;
}

/**
 * Extracts the WPBS nested banner body.
 *
 * @param shell - Banner-shell source.
 * @returns Body source.
 */
function extractBannerShellBannerBody(shell: string): string {
    const parts = splitTemplateParts(shell);
    const parameters = parts.slice(1);
    const explicitBody = parameters.find(isBannerShellBodyParameter);

    if (explicitBody != null) {
        const equals = findTopLevelEquals(explicitBody);
        return explicitBody.slice(equals + 1).trim();
    }

    return parameters.filter(isPositionalParameter).join('\n').trim();
}

/**
 * Checks whether a template parameter is the banner-shell |1= body.
 *
 * @param parameter - Raw template parameter source.
 * @returns Whether it is the body parameter.
 */
function isBannerShellBodyParameter(parameter: string): boolean {
    const equals = findTopLevelEquals(parameter);

    return equals !== -1 && parameter.slice(0, equals).trim() === '1';
}

/**
 * Checks whether a template parameter is positional at top level.
 *
 * @param parameter - Raw template parameter source.
 * @returns Whether it is positional.
 */
function isPositionalParameter(parameter: string): boolean {
    return findTopLevelEquals(parameter) === -1 && parameter.trim() !== '';
}

/**
 * Splits a template source into top-level pipe-separated parts.
 *
 * @param template - Template source including braces.
 * @returns Top-level template parts.
 */
function splitTemplateParts(template: string): Array<string> {
    return wikitext(template.slice(2, -2), BANNER_SCAN_OPTIONS).split('|');
}

/**
 * Finds the first top-level equals sign in template parameter source.
 *
 * @param parameter - Template parameter source.
 * @returns Equals offset, or -1.
 */
function findTopLevelEquals(parameter: string): number {
    return wikitext(parameter, BANNER_SCAN_OPTIONS).findTopLevelEquals();
}

/**
 * Reads a named top-level template parameter.
 *
 * @param template - Template source, when available.
 * @param name - Parameter name.
 * @returns Trimmed value, or null when the parameter is absent.
 */
function readTemplateParameter(
    template: string | undefined,
    name: string,
): string | null {
    if (template == null) {
        return null;
    }

    const expectedName = normalizeParameterName(name);
    for (const parameter of splitTemplateParts(template).slice(1)) {
        const equals = findTopLevelEquals(parameter);
        const parameterName = parameter.slice(0, equals);

        if (
            equals !== -1 &&
            normalizeParameterName(parameterName) === expectedName
        ) {
            return parameter.slice(equals + 1).trim();
        }
    }

    return null;
}

/**
 * Normalizes a template parameter name for matching.
 *
 * @param name - Raw parameter name.
 * @returns Case- and spacing-normalized name.
 */
function normalizeParameterName(name: string): string {
    return String(name || '')
        .replace(/_/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim()
        .toLowerCase();
}

/**
 * Interprets a conventional truthy template parameter.
 *
 * @param template - Template source.
 * @param name - Parameter name.
 * @returns Whether the parameter is enabled.
 */
function readBooleanParameter(template: string, name: string): boolean {
    const value = readTemplateParameter(template, name);

    return value != null && value !== '' && !/^(?:0|false|n|no)$/iu.test(value);
}

/**
 * Reads a task force's canonical parameter or configured fallback alias.
 *
 * @param banner - Existing video-game banner.
 * @param taskForce - Canonical task-force parameter and optional aliases.
 * @returns Whether the first supplied canonical or alias parameter is enabled.
 */
function readTaskForceParameter(
    banner: string,
    taskForce: VideoGamesProjectConfig['taskForces'][number],
): boolean {
    const name = [taskForce.parameter, ...(taskForce.aliases ?? [])].find(
        (parameter) => readTemplateParameter(banner, parameter) != null,
    );
    return name != null && readBooleanParameter(banner, name);
}

/**
 * Normalizes known assessment classes and their supported aliases.
 *
 * @returns Known canonical or trimmed custom class, or null when absent
 * or empty.
 */
export function normalizeAssessmentClass(
    value: string | null,
): AssessmentClass | null {
    if (value?.trim() === '') {
        return null;
    }
    const aliasedValue = value?.trim().toLowerCase() === 'bplus' ? 'B+' : value;
    return readAssessmentChoice(aliasedValue, CLASS_VALUES);
}

/**
 * Reads an importance value, canonicalizing known values.
 *
 * @returns Known canonical or exact custom importance, or null when
 * absent.
 */
function readAssessmentImportance(
    value: string | null,
): AssessmentImportance | null {
    return readAssessmentChoice(value, IMPORTANCE_VALUES);
}

/**
 * Finds a case-insensitive canonical value or preserves the entered
 * value.
 *
 * @param choices - Supported canonical values.
 * @returns Canonical matching or trimmed custom value, or null.
 */
function readAssessmentChoice(
    value: string | null,
    choices: readonly string[],
): string | null {
    if (value == null) {
        return null;
    }

    const enteredValue = value.trim();
    const normalizedValue = enteredValue.toLowerCase();
    return (
        choices.find((choice) => choice.toLowerCase() === normalizedValue) ??
        enteredValue
    );
}

/**
 * Checks whether a template name matches a project config.
 *
 * @param name - Template name.
 * @param project - Project config.
 * @returns Whether it matches.
 */
function matchesProject(
    name: string,
    project: ProjectBannerConfig | VideoGamesProjectConfig,
): boolean {
    const normalizedName = normalizeTemplateName(name);
    const patterns = [project.template, ...(project.aliases || [])].map(
        buildTemplatePattern,
    );
    const result = matchesAnyPattern(patterns, normalizedName);
    return result;
}

/**
 * Checks whether a template is a banner shell alias.
 *
 * @param name - Template name.
 * @returns Whether it is WPBS.
 */
function isBannerShellName(name: string): boolean {
    const normalizedName = normalizeTemplateName(name);
    const patterns = buildBannerShellPatterns();
    const result = matchesAnyPattern(patterns, normalizedName);
    return result;
}

/**
 * Checks whether a template name matches one canonical template call.
 *
 * @param name - Existing template name.
 * @param expected - Canonical template name.
 * @returns Whether the template names match.
 */
function matchesTemplateName(name: string, expected: string): boolean {
    return buildTemplatePattern(expected).test(normalizeTemplateName(name));
}

/**
 * Checks whether any pattern matches a normalized template name.
 *
 * @param patterns - Template-name patterns.
 * @param normalizedName - Normalized template name.
 * @returns Whether any pattern matches.
 */
function matchesAnyPattern(
    patterns: Array<RegExp>,
    normalizedName: string,
): boolean {
    let result = false;

    for (let index = 0; index < patterns.length && !result; index += 1) {
        result = patterns[index].test(normalizedName);
    }

    return result;
}

/**
 * Builds shell alias matchers.
 *
 * @returns Shell matchers.
 */
function buildBannerShellPatterns(): Array<RegExp> {
    return BANNER_SHELL_ALIASES.map(buildTemplatePattern);
}

/**
 * Allows invisible comments between leading talk-page templates.
 *
 * @param text - Source being scanned.
 * @param start - Starting offset.
 * @param comments - Comment ends indexed by their original start offsets.
 * @returns First offset after whitespace and comments.
 */
function skipLeadingWhitespaceAndComments(
    text: string,
    start: number,
    comments: ReadonlyMap<number, number>,
): number {
    let index = skipWhitespace(text, start);
    let end = comments.get(index);
    while (end != null) {
        index = skipWhitespace(text, end);
        end = comments.get(index);
    }
    return index;
}

/**
 * Skips whitespace from a source offset.
 *
 * @param text - Source text.
 * @param start - Starting offset.
 * @returns First non-whitespace offset.
 */
function skipWhitespace(text: string, start: number): number {
    let index = start;

    while (/\s/u.test(text[index] || '')) {
        index += 1;
    }

    return index;
}

/**
 * Builds the WikiProject Video games banner.
 *
 * @param assessment - Selected assessment values.
 * @param config - Video games project configuration.
 * @param existing - Existing matching banner source.
 * @returns Video games banner call.
 */
function buildVideoGamesBanner(
    assessment: Assessment,
    config: VideoGamesProjectConfig,
    existing?: string,
): string {
    if (existing != null) {
        return updateExistingVideoGamesBanner(existing, assessment, config);
    }

    const params = [
        [
            '|',
            config.importanceParameter,
            '=',
            assessment.importance || '',
            '',
        ].join(''),
    ];

    const selectedTaskForces = [];

    for (const taskForce of config.taskForces) {
        if (assessment.taskForces?.[taskForce.id]) {
            selectedTaskForces.push(taskForce);
        }
    }

    for (const taskForce of selectedTaskForces) {
        params.push(`|${taskForce.parameter}=yes`);
    }

    const maintenanceParams = getSelectedMaintenanceParams(assessment);

    for (const param of maintenanceParams) {
        params.push(`|${param}=yes`);
    }

    return `{{${config.template}${params.join('')}}}`;
}

/**
 * Updates managed VG selections and removes departed parameters while
 * retaining all other parameter source.
 *
 * @param banner - Existing matching banner.
 * @param assessment - Selected assessment values.
 * @param config - Video games project configuration.
 * @returns Updated banner with untouched parameters preserved verbatim.
 */
function updateExistingVideoGamesBanner(
    banner: string,
    assessment: Assessment,
    config: VideoGamesProjectConfig,
): string {
    const bannerClass = readTemplateParameter(banner, config.classParameter);
    const importance = readAssessmentImportance(
        readTemplateParameter(banner, config.importanceParameter),
    );

    const selections = [
        {
            names: [config.classParameter],
            value: null,
            unchanged: bannerClass == null || bannerClass === '',
        },
        {
            names: [config.importanceParameter],
            value: assessment.importance || '',
            unchanged: importance === assessment.importance,
        },
        ...config.taskForces.map((taskForce) => ({
            names: [taskForce.parameter, ...(taskForce.aliases ?? [])],
            value: assessment.taskForces?.[taskForce.id] ? 'yes' : null,
            unchanged:
                readTaskForceParameter(banner, taskForce) ===
                Boolean(assessment.taskForces?.[taskForce.id]),
        })),
        ...getMaintenanceSelections(assessment).map(([name, selected]) => ({
            names: [name],
            value: selected ? 'yes' : null,
            unchanged: readBooleanParameter(banner, name) === Boolean(selected),
        })),
    ];
    const parts = splitTemplateParts(banner);
    const updated = [parts[0]];
    const written = new Set<string>();

    for (const parameter of parts.slice(1)) {
        const equals = findTopLevelEquals(parameter);
        const name = normalizeParameterName(parameter.slice(0, equals));
        if (equals !== -1 && DEPARTED_VIDEO_GAMES_PARAMETERS.has(name)) {
            continue;
        }

        const selection =
            equals === -1
                ? undefined
                : selections.find((candidate) =>
                      candidate.names.some(
                          (candidateName) =>
                              normalizeParameterName(candidateName) === name,
                      ),
                  );
        if (selection == null || selection.unchanged) {
            updated.push(parameter);
        } else if (
            selection.value != null &&
            !written.has(selection.names[0])
        ) {
            updated.push(`${selection.names[0]}=${selection.value}`);
            written.add(selection.names[0]);
        }
    }

    for (const selection of selections) {
        if (
            !selection.unchanged &&
            selection.value != null &&
            !written.has(selection.names[0])
        ) {
            updated.push(`${selection.names[0]}=${selection.value}`);
        }
    }

    return `{{${updated.join('|')}}}`;
}

/**
 * Gets selected maintenance banner parameters.
 *
 * @param assessment - Selected assessment values.
 * @returns Maintenance parameter names.
 */
function getSelectedMaintenanceParams(assessment: Assessment): Array<string> {
    return getMaintenanceSelections(assessment)
        .filter((entry) => entry[1])
        .map((entry) => entry[0]);
}

/**
 * Lists every managed maintenance parameter and its selected state.
 *
 * @param assessment - Selected assessment values.
 * @returns Parameter names with their checkbox selections.
 */
function getMaintenanceSelections(
    assessment: Assessment,
): Array<[string, boolean]> {
    return [
        ['reassess', assessment.maintenance?.reassess],
        ['needs-infobox', assessment.maintenance?.needsInfobox],
        ['cover', assessment.maintenance?.cover],
        ['screenshot', assessment.maintenance?.screenshot],
    ];
}

/**
 * Builds a simple selected WikiProject banner.
 *
 * @param project - WikiProject configuration.
 * @returns Template call.
 */
function buildSimpleProjectBanner(project: ProjectBannerConfig): string {
    return `{{${project.template}}}`;
}

/**
 * Builds the shell that carries shared assessment class.
 *
 * @param className - Selected assessment class.
 * @param banners - Nested WikiProject banner calls.
 * @param text - Existing source containing shell parameters to preserve.
 * @returns Banner shell wikitext.
 */
function buildBannerShell(
    className: string,
    banners: Array<string>,
    text: string,
): string {
    const preservedParameters = readLeadingTemplates(String(text || ''))
        .filter((template) => isBannerShellName(template.name))
        .flatMap((template) => splitTemplateParts(template.source).slice(1))
        .filter((parameter) => {
            const equals = findTopLevelEquals(parameter);
            const name = normalizeParameterName(parameter.slice(0, equals));
            return equals !== -1 && name !== 'class' && name !== '1';
        });
    const body = banners.join('').trim();
    const result = [
        [
            '{{',
            BANNER_SHELL_TEMPLATE,
            '|class=',
            className || 'Unassessed',
            ...preservedParameters.map((parameter) => `|${parameter}`),
            '|1=',
        ].join(''),
        ...(body === '' ? [] : [body]),
        '}}',
    ].join('\n');
    return result;
}

/**
 * Extracts the leading talk-page section before the first heading.
 *
 * @param text - Talk-page wikitext.
 * @returns Top-section wikitext.
 */
function getTopSection(text: string): string {
    const heading = /^=+/mu.exec(text);

    return (heading == null ? text : text.slice(0, heading.index)).trimEnd();
}

/**
 * Removes empty importance parameters for no-op detection.
 *
 * @param text - Source text.
 * @returns Source without empty importance fields.
 */
function removeEmptyImportanceParameters(text: string): string {
    const result = String(text || '')
        .replace(/\|\s*importance\s*=\s*(?=[|}\n])/giu, '')
        .replace(/[ \t]+$/gmu, '')
        .trim();
    return result;
}
