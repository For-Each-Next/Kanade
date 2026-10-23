/**
 * @file scripts/source-editor/update-citation-template-data.ts
 * Purpose: Refreshes supported citations from English and Chinese Wikipedia TemplateData.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. TemplateDataDownloader
 * 4. Initialization and execution
 * 5. fetchAllCitationTemplateData
 * 6. createTemplateDataApi
 * 7. downloadTemplateData
 * 8. writeTemplateDataModules
 * 9. formatTemplateModule
 * 10. formatTemplateDataIndex
 * 11. templateFileStem
 * 12. templateIdentifier
 */

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { format } from 'prettier';

import { mergeCitationTemplateDataSnapshots } from '../../src/source-editor/domain/template-data-snapshot.ts';
import {
    normalizeTemplateName,
    SUPPORTED_CITATION_TEMPLATES,
} from '../../src/source-editor/domain/templates.ts';
import type {
    CitationTemplateData,
    CitationTemplateDataMap,
} from '../../src/source-editor/config/citation-template-data/types.ts';
import {
    loadTemplateData,
    type MediaWikiTemplateDataApi,
} from '../../src/source-editor/platform/mediawiki/template-data/api.ts';

const BATCH_SIZE = 20;
const OUTPUT_DIRECTORY = fileURLToPath(
    new URL(
        '../../src/source-editor/config/citation-template-data/generated/',
        import.meta.url,
    ),
);
const OUTPUT_INDEX = resolve(OUTPUT_DIRECTORY, 'index.ts');
const execFileAsync = promisify(execFile);

/** Read-only downloader injectable for offline updater tests. */
export type TemplateDataDownloader = (url: string) => Promise<string>;

if (import.meta.main) {
    const templateData = await fetchAllCitationTemplateData();
    await writeTemplateDataModules(templateData);
}

/**
 * Downloads English and Chinese snapshots in bounded batches.
 *
 * @param download - Read-only HTTPS downloader, or an offline fixture loader.
 * @param names - Template titles to refresh.
 * @returns Operation result.
 */
export async function fetchAllCitationTemplateData(
    download: TemplateDataDownloader = downloadTemplateData,
    names: readonly string[] = SUPPORTED_CITATION_TEMPLATES,
): Promise<CitationTemplateDataMap> {
    const [english, chinese] = await Promise.all(
        (['en', 'zh'] as const).map((language) =>
            loadTemplateData(names, {
                api: createTemplateDataApi(language, download),
                batchSize: BATCH_SIZE,
                requestParameters: {
                    format: 'json',
                    includeMissingTitles: 1,
                    origin: '*',
                },
            }),
        ),
    );
    const result: CitationTemplateDataMap = {};
    for (const name of names) {
        const snapshot = mergeCitationTemplateDataSnapshots(
            english.get(name),
            chinese.get(name),
        );
        if (snapshot != null) {
            result[normalizeTemplateName(name)] = snapshot;
        }
    }
    const missing = names.filter(function isMissing(name) {
        return result[normalizeTemplateName(name)] == null;
    });
    if (missing.length > 0) {
        throw new Error(
            `TemplateData unavailable in English or Chinese Wikipedia for: ${missing.join(', ')}`,
        );
    }
    return result;
}

/**
 * Adapts the updater's HTTPS downloader to the shared TemplateData loader.
 *
 * @param language - Wikipedia language to request.
 * @param download - Read-only HTTPS downloader.
 * @returns Operation result.
 */
function createTemplateDataApi(
    language: 'en' | 'zh',
    download: TemplateDataDownloader,
): MediaWikiTemplateDataApi {
    return {
        async get(parameters) {
            const params = new URLSearchParams(
                Object.entries(parameters).map(([name, value]) => [
                    name,
                    String(value),
                ]),
            );
            const url = `https://${language}.wikipedia.org/w/api.php?${params}`;
            return JSON.parse(await download(url));
        },
    };
}

/**
 * Downloads one HTTPS API response with optional proxy support.
 *
 * @param url - Url value.
 * @returns Operation result.
 */
async function downloadTemplateData(url: string): Promise<string> {
    const args = [
        '--fail',
        '--location',
        '--connect-timeout',
        '15',
        '--max-time',
        '60',
        '--silent',
        '--show-error',
        '--user-agent',
        'KanadeSourceEditorTemplateDataUpdater/1.0',
    ];
    const proxy = process.env.CITATION_TEMPLATE_PROXY;
    if (proxy != null && proxy !== '') {
        args.push('--proxy', proxy);
    }
    args.push(url);
    const result = await execFileAsync('curl', args, {
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
    });
    return result.stdout;
}

/**
 * Writes one generated module per citation template and an index.
 *
 * @param data - Data value.
 */
async function writeTemplateDataModules(
    data: CitationTemplateDataMap,
): Promise<void> {
    await mkdir(OUTPUT_DIRECTORY, { recursive: true });
    const entries = Object.entries(data).sort(
        function sortTemplates(left, right) {
            return left[0].localeCompare(right[0]);
        },
    );
    const writes = entries.map(async function writeTemplate([name, value]) {
        const path = resolve(OUTPUT_DIRECTORY, `${templateFileStem(name)}.ts`);
        const source = await formatTemplateModule(name, value);
        await writeFile(path, source);
    });
    const index = await formatTemplateDataIndex(entries);
    await Promise.all([...writes, writeFile(OUTPUT_INDEX, index)]);
}

/**
 * Formats one template's generated data module.
 *
 * @param name - Name to process.
 * @param data - Data value.
 * @returns Formatted template's generated data module.
 */
async function formatTemplateModule(
    name: string,
    data: CitationTemplateData,
): Promise<string> {
    const json = JSON.stringify(data, null, 4);
    const source = [
        '/**',
        ` * Generated English-first Wikipedia TemplateData for ${name}.`,
        ' * Chinese Wikipedia supplies additional ordering and fallback metadata.',
        ' *',
        ' * Run npm run update:template-data to refresh it.',
        ' */',
        '',
        'import type { CitationTemplateData } from "../types.ts";',
        '',
        `const templateData: CitationTemplateData = ${json};`,
        '',
        'export default templateData;',
        '',
    ].join('\n');
    return format(source, { parser: 'typescript', tabWidth: 4 });
}

/**
 * Formats the generated TemplateData index module.
 *
 * @param entries - Entries value.
 * @returns Formatted the generated TemplateData index module.
 */
async function formatTemplateDataIndex(
    entries: Array<[string, CitationTemplateData]>,
): Promise<string> {
    const imports = entries.map(function buildImport([name]) {
        const identifier = templateIdentifier(name);
        const path = `./${templateFileStem(name)}.ts`;
        return `import ${identifier} from "${path}";`;
    });
    const properties = entries.map(function buildProperty([name]) {
        return `${JSON.stringify(name)}: ${templateIdentifier(name)},`;
    });
    const source = [
        '/**',
        ' * Generated citation TemplateData index.',
        ' */',
        '',
        'import type { CitationTemplateDataMap } from "../types.ts";',
        ...imports,
        '',
        'const templateData: CitationTemplateDataMap = {',
        ...properties,
        '};',
        '',
        'export default templateData;',
        '',
    ].join('\n');
    return format(source, { parser: 'typescript', tabWidth: 4 });
}

/**
 * Converts a template name to its generated filename stem.
 *
 * @param name - Name to process.
 * @returns Converted template name to its generated filename stem.
 */
function templateFileStem(name: string): string {
    return name.replace(/\s+/gu, '-');
}

/**
 * Converts a template name to its generated import identifier.
 *
 * @param name - Name to process.
 * @returns Converted template name to its generated import identifier.
 */
function templateIdentifier(name: string): string {
    return name.replace(/\s+(.)/gu, function uppercaseWord(_match, letter) {
        return letter.toLocaleUpperCase('en-US');
    });
}
