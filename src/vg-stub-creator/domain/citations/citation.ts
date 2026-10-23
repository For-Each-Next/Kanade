/**
 * @file src/vg-stub-creator/domain/citations/citation.ts
 * Purpose: Formats citation metadata as citation template wikitext.
 *
 * Contents: Metadata mapping, shared template parsing, parameter review, and site cleanup.
 */

import { parseTemplateCall } from '../../../library/wikitext/templates.ts';
import { getCitationTemplateName } from '../../../library/citation-metadata/templates.ts';
import citationRules from './data/citation-rules.ts';
import {
    getCitationTemplateData,
    type CitationTemplateData,
} from './data/templates.ts';

const CITATION_RULES = getCitationRules();
const DATE_PARTS_LENGTH = 10;
const UNKNOWN_PARAM_ORDER_OFFSET = 10000;

/**
 * Trims one citation source URL.
 *
 * @param url - Source URL.
 * @returns Trimmed source URL.
 */
function normalizeCitationSource(url: string): string {
    return url.trim();
}

/**
 * Handles build cite template.
 *
 * Builds citation template wikitext from one Zotero-style citation
 * object.
 *
 * @param citation - Zotero-style citation data.
 * @param options - Formatting options.
 * @param options.now - Date used for access-date.
 * @param options.url - Fallback source URL.
 * @returns Citation template wikitext.
 */
export function buildCiteTemplate(citation: any, options: any = {}): string {
    const template = getCitationTemplateName(citation.itemType);
    const citationValues = buildCitationValues(citation, options);
    const values = applyCitationRules(citationValues, {
        rules: options.rules || CITATION_RULES,
        sourceUrl: options.url,
    });
    const entries = Object.entries(values);
    const populatedEntries = entries.filter(hasTemplateValue);
    const params = sortCitationParamEntries(populatedEntries, template);

    return formatTemplateCall(template, params);
}

/**
 * Parses one generated citation template into editable parts.
 *
 * @param text - Citation template wikitext.
 * @returns Parsed template name and parameter rows.
 */
export function parseCiteTemplate(text: string): any {
    const parsed = parseTemplateCall(trimFieldText(text));
    const template = parsed.name || 'cite web';
    // Numbered names retain unnamed values in the existing named-row editor.
    const params = parsed.params.map(({ name, value }) => ({ name, value }));
    return {
        params: sortCitationParams(params, template),
        template,
    };
}

/**
 * Builds citation template wikitext from editable parts.
 *
 * @param parts - Editable citation parts.
 * @param parts.params - Editable parameter rows.
 * @param parts.template - Citation template name.
 * @returns Citation template wikitext.
 */
export function buildCiteTemplateFromParts(parts: any): string {
    const template = trimFieldText(parts?.template) || 'cite web';
    const params = sortCitationParams(parts?.params || [], template);
    const entries = params.map((param): [string, any] => [
        param.name,
        param.value,
    ]);
    const valuedEntries = entries.filter(hasTemplateValue);
    const result = formatTemplateCall(template, valuedEntries);
    return result;
}

/**
 * Sorts citation parameter rows by local TemplateData order.
 *
 * @param params - Citation parameter rows.
 * @param template - Citation template name.
 * @returns Sorted rows, or original order for an unknown template.
 */
export function sortCitationParams(
    params: Array<any>,
    template: string,
): Array<any> {
    const templateData = getCitationTemplateData(template);
    if (templateData == null) {
        return params.map((param) => ({ ...param }));
    }
    const compareParams = compareCitationParams.bind(null, templateData);
    const result = params
        .map((param, index) => ({ ...param, _index: index }))
        .sort(compareParams)
        .map(({ _index, ...param }) => param);
    return result;
}

/**
 * Gets bundled citation cleanup rules.
 *
 * @returns Site-specific citation cleanup rules.
 */
function getCitationRules(): Array<any> {
    return citationRules;
}

/**
 * Builds normalized citation template values.
 *
 * @param citation - Zotero-style citation data.
 * @param options - Formatting options.
 * @param options.now - Date used for access-date.
 * @param options.url - Fallback source URL.
 * @returns Template parameter values.
 */
function buildCitationValues(citation: any, options: any): any {
    const result = {
        accessDate: formatAccessDate(options.now),
        author: formatCreators(citation.creators, 'author'),
        date: citation.date,
        language: citation.language,
        publisher: citation.publisher,
        title: normalizeCitationTitle(citation.title),
        url: citation.url || options.url,
        via: citation.via,
        website: citation.websiteTitle || citation.publicationTitle,
    };
    if (options.bibliographic !== true) {
        return result;
    }
    return addBibliographicCitationValues(result, citation, options);
}

/**
 * Adds fields needed for a bibliographic Citoid query.
 *
 * @param values - Values value.
 * @param citation - Citation value.
 * @param options - Operation options.
 * @returns Operation result.
 */
function addBibliographicCitationValues(
    values: Record<string, unknown>,
    citation: any,
    options: any,
): Record<string, unknown> {
    const bookSection = citation.itemType === 'bookSection';
    const journalArticle = citation.itemType === 'journalArticle';
    return {
        ...values,
        accessDate:
            citation.url || options.url ? formatAccessDate(options.now) : '',
        chapter: bookSection ? citation.title : '',
        doi: formatIdentifierValue(citation.DOI),
        edition: citation.edition,
        isbn: formatIdentifierValue(citation.ISBN),
        issn: formatIdentifierValue(citation.ISSN),
        issue: citation.issue,
        journal: journalArticle ? citation.publicationTitle : '',
        location: citation.place,
        oclc: citation.oclc || getExtraIdentifier(citation.extra, 'OCLC'),
        pages: citation.pages,
        pmc:
            citation.PMCID ||
            getExtraIdentifier(citation.extra, 'PMCID')?.replace(/^PMC/iu, ''),
        pmid: citation.PMID || getExtraIdentifier(citation.extra, 'PMID'),
        series: citation.series,
        title: normalizeCitationTitle(
            bookSection ? citation.bookTitle : citation.title,
        ),
        volume: citation.volume,
        website: journalArticle
            ? citation.websiteTitle
            : citation.websiteTitle || citation.publicationTitle,
    };
}

/**
 * Formats the first usable scalar value returned for an identifier.
 *
 * @param value - Value to process.
 * @returns Value.
 */
function formatIdentifierValue(value: unknown): string {
    if (Array.isArray(value)) {
        return trimFieldText(value.find((candidate) => candidate != null));
    }
    return trimFieldText(value);
}

/**
 * Reads an identifier stored in Zotero's newline-delimited extra field.
 *
 * @param extra - Extra value.
 * @param name - Name to process.
 * @returns Value.
 */
function getExtraIdentifier(extra: unknown, name: string): string | undefined {
    const pattern = new RegExp(`(?:^|\\n)${name}:\\s*(\\S+)`, 'iu');
    return trimFieldText(extra).match(pattern)?.[1];
}

/**
 * Removes generated titles that are only a URL.
 *
 * @param title - Generated citation title.
 * @returns Normalized citation title.
 */
function normalizeCitationTitle(title: string): string {
    const value = trimFieldText(title);

    return parseUrl(value) == null ? value : '';
}

/**
 * Applies site-specific cleanup rules to citation values.
 *
 * @param values - Citation template values.
 * @param options - Rule matching options.
 * @param options.rules - Available cleanup rules.
 * @param options.sourceUrl - Original user-entered source
 * URL.
 * @returns Cleaned citation template values.
 */
function applyCitationRules(values: any, options: any): any {
    const rules = getMatchingRules(
        options.rules,
        options.sourceUrl || values.url,
    );
    let preserveValues = options.sourceUrl == null;
    if (!preserveValues) {
        preserveValues = rules.some((rule) => rule.redirect === true);
    }
    let initialValues = values;
    if (!preserveValues) {
        const normalizedUrl = normalizeCitationSource(options.sourceUrl);
        initialValues = { ...values, url: normalizedUrl };
    }

    const applyRule = applyCitationRule.bind(null, options.sourceUrl);
    const result = rules.reduce(applyRule, initialValues);
    return result;
}

/**
 * Applies one site-specific cleanup rule.
 *
 * @param sourceUrl - Original user-entered source URL.
 * @param values - Citation template values.
 * @param rule - Site-specific cleanup rule.
 * @returns Cleaned citation template values.
 */
function applyCitationRule(sourceUrl: string, values: any, rule: any): any {
    const fixes = rule.fixes || [];
    const applyFix = applyFieldFix.bind(null, sourceUrl);
    const result = fixes.reduce(applyFix, values);
    return result;
}

/**
 * Applies a field fix to citation values.
 *
 * @param sourceUrl - Original user-entered source URL.
 * @param values - Citation template values.
 * @param fix - Field fix definition.
 * @param fix.action - Field fix action.
 * @param fix.field - Citation value field.
 * @param fix.operand - Optional fix
 * operand.
 * @returns Citation template values.
 */
function applyFieldFix(sourceUrl: string, values: any, fix: any): any {
    if (fix.action === 'omit') {
        return applyOmitFix(values, fix);
    }

    if (fix.action === 'replace') {
        return applyReplaceFix(values, fix);
    }

    if (fix.action === 'set') {
        return applySetFix(values, fix);
    }

    if (fix.action === 'set-from-source-query') {
        return applySetFromSourceQueryFix(sourceUrl, values, fix);
    }

    if (fix.action === 'preserve-source-query') {
        return applyPreserveSourceQueryFix(sourceUrl, values, fix);
    }

    return values;
}

/**
 * Applies an omit fix to citation values.
 *
 * @param values - Citation template values.
 * @param fix - Field fix definition.
 * @param fix.field - Citation value field.
 * @param fix.operand - Value that should be omitted.
 * @returns Citation template values.
 */
function applyOmitFix(values: any, fix: any): any {
    if (fix.operand != null && values[fix.field] !== fix.operand) {
        return values;
    }

    const result = {
        ...values,
        [fix.field]: '',
    };
    return result;
}

/**
 * Applies a regular expression replacement fix to citation values.
 *
 * @param values - Citation template values.
 * @param fix - Field fix definition.
 * @param fix.field - Citation value field.
 * @param fix.operand - Replace operand.
 * @param fix.operand.pattern - Regular expression pattern to
 * replace.
 * @param fix.operand.replacement - Replacement value.
 * @returns Citation template values.
 */
function applyReplaceFix(values: any, fix: any): any {
    const result = {
        ...values,
        [fix.field]: replacePattern(values[fix.field], fix),
    };
    return result;
}

/**
 * Applies a static value fix to citation values.
 *
 * @param values - Citation template values.
 * @param fix - Field fix definition.
 * @param fix.field - Citation value field.
 * @param fix.operand - Replacement value.
 * @returns Citation template values.
 */
function applySetFix(values: any, fix: any): any {
    const result = {
        ...values,
        [fix.field]: fix.operand,
    };
    return result;
}

/**
 * Maps a source URL query value to a citation value.
 *
 * @param sourceUrl - Original user-entered source URL.
 * @param values - Citation template values.
 * @param fix - Field fix definition.
 * @param fix.field - Citation value field.
 * @param fix.operand - Query mapping operand.
 * @param fix.operand.key - Query key to read.
 * @param fix.operand.values - Citation values keyed by query
 * value.
 * @returns Citation template values.
 */
function applySetFromSourceQueryFix(
    sourceUrl: string,
    values: any,
    fix: any,
): any {
    const source = parseUrl(sourceUrl);
    const operand = fix.operand || {};

    if (source == null || operand.key == null || operand.values == null) {
        return values;
    }

    const queryValue = source.searchParams.get(operand.key);

    if (queryValue == null) {
        return values;
    }

    const fieldValue = operand.values[queryValue];

    if (fieldValue == null) {
        return values;
    }

    const result = {
        ...values,
        [fix.field]: fieldValue,
    };
    return result;
}

/**
 * Applies a preserve-source-query fix to citation values.
 *
 * @param sourceUrl - Original user-entered source URL.
 * @param values - Citation template values.
 * @param fix - Field fix definition.
 * @param fix.field - Citation value field.
 * @returns Citation template values.
 */
function applyPreserveSourceQueryFix(
    sourceUrl: string,
    values: any,
    fix: any,
): any {
    const result = {
        ...values,
        [fix.field]: preserveSourceQuery(
            values[fix.field],
            sourceUrl,
            fix.operand,
        ),
    };
    return result;
}

/**
 * Replaces a pattern in a value when possible.
 *
 * @param value - Value to update.
 * @param fix - Field fix definition.
 * @param fix.operand - Replace operand.
 * @param fix.operand.pattern - Regular expression pattern to
 * replace.
 * @param fix.operand.replacement - Replacement value.
 * @returns Value with the pattern replaced.
 */
function replacePattern(value: string, fix: any): string {
    const operand = fix.operand || {};

    if (value == null || operand.pattern == null) {
        return value;
    }

    const pattern = new RegExp(operand.pattern, 'u');
    const result = value.replace(pattern, operand.replacement || '');
    return result;
}

/**
 * Preserves the original source query when Citoid omits it.
 *
 * @param citationUrl - URL returned by Citoid.
 * @param sourceUrl - Original user-entered source URL.
 * @param keys - Query keys to preserve.
 * @returns URL with original query values restored when
 * possible.
 */
function preserveSourceQuery(
    citationUrl: string,
    sourceUrl: string,
    keys: Array<string>,
): string {
    const citation = parseUrl(citationUrl);
    const source = parseUrl(sourceUrl);

    if (citation == null || source == null) {
        return citationUrl;
    }

    if (source.search === '') {
        return citationUrl;
    }

    const sourceKeys = getSourceQueryKeys(source, keys);
    const preserveKey = preserveSourceQueryKey.bind(null, citation, source);
    sourceKeys.forEach(preserveKey);

    return citation.toString();
}

/**
 * Gets source query keys that should be preserved.
 *
 * @param source - Original source URL.
 * @param keys - Query keys to preserve.
 * @returns Query keys to preserve.
 */
function getSourceQueryKeys(source: URL, keys: Array<string>): Array<string> {
    if (Array.isArray(keys)) {
        return keys;
    }

    const iterator = source.searchParams.keys();
    return Array.from(iterator);
}

/**
 * Preserves one query value from the source URL.
 *
 * @param citation - Citation URL returned by Citoid.
 * @param source - Original source URL.
 * @param key - Query key to preserve.
 * @returns Result when the function
 *   preserves one query value from the source url.
 */
function preserveSourceQueryKey(citation: URL, source: URL, key: string): void {
    if (citation.searchParams.has(key) || !source.searchParams.has(key)) {
        return;
    }

    const value = source.searchParams.get(key);

    if (value == null) {
        return;
    }

    citation.searchParams.set(key, value);
}

/**
 * Gets cleanup rules matching a URL host.
 *
 * @param rules - Available cleanup rules.
 * @param url - URL used to match cleanup rules.
 * @returns Matching cleanup rules.
 */
function getMatchingRules(rules: Array<any>, url: string): Array<any> {
    const globalRules = rules.filter(isGlobalRule);
    const parsedUrl = parseUrl(url);

    if (parsedUrl == null) {
        return globalRules;
    }

    const matchesHost = isMatchingRule.bind(null, parsedUrl.hostname);
    return rules.filter(matchesHost);
}

/**
 * Checks whether a cleanup rule applies to all citations.
 *
 * @param rule - Cleanup rule.
 * @returns Whether the rule is global.
 */
function isGlobalRule(rule: any): boolean {
    return rule.host == null;
}

/**
 * Checks whether a cleanup rule matches a host.
 *
 * @param hostname - URL hostname.
 * @param rule - Site-specific cleanup rule.
 * @returns Whether the rule matches the host.
 */
function isMatchingRule(hostname: string, rule: any): boolean {
    return rule.host == null || hostname === rule.host;
}

/**
 * Parses a URL, returning null for invalid values.
 *
 * @param url - URL to parse.
 * @returns Parsed URL.
 */
function parseUrl(url: string): URL | null {
    try {
        return new URL(url);
    } catch (_error) {
        return null;
    }
}

/**
 * Checks whether a template parameter should be emitted.
 *
 * @param entry - Template parameter entry.
 * @returns Whether the value is present.
 */
function hasTemplateValue(entry: [string, any]): boolean {
    const [_key, value] = entry;

    return value != null && String(value).trim() !== '';
}

/**
 * Sorts citation parameter entries by local TemplateData order.
 *
 * @param entries - Citation parameter entries.
 * @param template - Citation template name.
 * @returns Sorted parameter entries.
 */
function sortCitationParamEntries(
    entries: Array<[string, any]>,
    template: string,
): Array<Array<string>> {
    const params = [];
    for (const [name, value] of entries) {
        const formattedName = formatTemplateKey(name);
        params.push({
            name: formattedName,
            value,
        });
    }
    const sortedParams = sortCitationParams(params, template);
    const result = sortedParams.map((param) => [param.name, param.value]);
    return result;
}

/**
 * Formats one template parameter.
 *
 * @param entry - Template parameter entry.
 * @param options - Formatting options.
 * @param options.formatKey - Whether to convert camelCase
 * keys.
 * @returns Template parameter wikitext.
 */
function formatTemplateParam(entry: Array<string>, options: any = {}): string {
    const [key, value] = entry;
    const name = options.formatKey === false ? key : formatTemplateKey(key);

    const text = String(value);
    return `|${name}=${escapeTemplateValue(text)}`;
}

/**
 * Formats one citation template call.
 *
 * @param template - Template name.
 * @param params - Template parameter entries.
 * @returns Template wikitext.
 */
function formatTemplateCall(
    template: string,
    params: Array<Array<string>>,
): string {
    const name = trimFieldText(template) || 'cite web';

    if (name.toLocaleLowerCase() === 'cite web') {
        const result = `{{${name}\n${params
            .map(formatIndentedTemplateParam)
            .join('\n')}\n}}`;
        return result;
    }

    const result = [
        '{{',
        name,
        '',
        params.map(formatUnindentedTemplateParam).join(''),
        '}}',
    ].join('');
    return result;
}

/**
 * Formats one template parameter without normalizing its key.
 *
 * @param param - Template parameter entry.
 * @returns Inline template parameter text.
 */
function formatUnindentedTemplateParam(param: Array<string>): string {
    return formatTemplateParam(param, { formatKey: false });
}

/**
 * Formats one indented template parameter.
 *
 * @param entry - Template parameter entry.
 * @returns Template parameter wikitext.
 */
function formatIndentedTemplateParam(entry: Array<string>): string {
    const [key, value] = entry;

    const text = String(value);
    return `  | ${key} = ${escapeTemplateValue(text)}`;
}

/**
 * Formats a JavaScript key as a citation template parameter.
 *
 * @param key - Citation value key.
 * @returns Template parameter key.
 */
function formatTemplateKey(key: string): string {
    return key.replace(/[A-Z]/gu, '-$&').toLocaleLowerCase();
}

/**
 * Escapes values that would otherwise break a template parameter.
 *
 * @param value - Template parameter value.
 * @returns Escaped template parameter value.
 */
function escapeTemplateValue(value: string): string {
    return value.trim().replace(/\|/gu, '{{!}}');
}

/**
 * Compares citation parameters by local TemplateData order.
 *
 * @param templateData - Citation template parameter metadata.
 * @param left - Left parameter row.
 * @param right - Right parameter row.
 * @returns Sort comparison result.
 */
function compareCitationParams(
    templateData: CitationTemplateData,
    left: any,
    right: any,
): number {
    const result =
        getParamOrderIndex(templateData, left.name) -
            getParamOrderIndex(templateData, right.name) ||
        left._index - right._index;
    return result;
}

/**
 * Gets a parameter order index, resolving aliases to canonical names.
 *
 * @param templateData - Citation template parameter metadata.
 * @param name - Citation parameter name.
 * @returns Parameter order index.
 */
function getParamOrderIndex(
    templateData: CitationTemplateData,
    name: string,
): number {
    const paramOrder = templateData.paramOrder || [];
    const canonical = getCanonicalParamName(templateData, name);
    const index = paramOrder.indexOf(canonical);

    if (index !== -1) {
        return index;
    }

    return UNKNOWN_PARAM_ORDER_OFFSET;
}

/**
 * Resolves a parameter alias to its canonical TemplateData key.
 *
 * @param templateData - Citation template parameter metadata.
 * @param name - Citation parameter name.
 * @returns Canonical parameter name when known.
 */
function getCanonicalParamName(
    templateData: CitationTemplateData,
    name: string,
): string {
    const value = trimFieldText(name);
    const aliases = templateData.aliases || {};

    if (Object.hasOwn(aliases, value)) {
        return value;
    }

    let result = value;
    for (const [key, values] of Object.entries(aliases)) {
        const matches = (values as string[]).includes(value);
        if (result === value && matches) {
            result = key;
        }
    }
    return result;
}

/**
 * Trims text-like citation fields.
 *
 * @param value - Raw field value.
 * @returns Trimmed field text.
 */
function trimFieldText(value: any): string {
    return String(value || '').trim();
}

/**
 * Formats matching creators as a joined author string.
 *
 * @param creators - Zotero creator data.
 * @param type - Creator type to include.
 * @returns Joined creator names.
 */
function formatCreators(creators: Array<any>, type: string): string {
    if (!Array.isArray(creators)) {
        return '';
    }

    const matchesType = isCreatorType.bind(null, type);
    const result = creators.filter(matchesType).map(formatCreator).join('; ');
    return result;
}

/**
 * Checks whether a creator has the requested type.
 *
 * @param type - Creator type to include.
 * @param creator - Zotero creator data.
 * @returns Whether the creator matches.
 */
function isCreatorType(type: string, creator: any): boolean {
    return creator.creatorType === type;
}

/**
 * Formats one Zotero creator.
 *
 * @param creator - Zotero creator data.
 * @returns Creator display text.
 */
function formatCreator(creator: any): string {
    if (creator.name != null) {
        return creator.name;
    }

    return [creator.firstName, creator.lastName].filter(Boolean).join(' ');
}

/**
 * Formats the access date for citation templates.
 *
 * @param date - Date used for access-date.
 * @returns ISO date string.
 */
function formatAccessDate(date: Date): string {
    const accessDate = date || new Date();

    return accessDate.toISOString().slice(0, DATE_PARTS_LENGTH);
}
