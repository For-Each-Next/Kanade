/**
 * @file src/wpvg-assessor/domain/new-page-list-archive.ts
 * Purpose: Archives whole months into lossless annual new-page-list archives.
 *
 * Contents: Dated record parsing, cutoff rules, and annual archive merging.
 */

const ARCHIVE_PREFIX = 'WikiProject:电子游戏/新进条目/';
const YEAR_HEADING_PATTERN = /^==[ \t]*(\d{4})年[ \t]*==[ \t]*$/u;
const MONTH_HEADING_PATTERN = /^===[ \t]*(\d{1,2})月[ \t]*===[ \t]*$/u;
const DATE_LINE_PATTERN = /^\*[ \t]+(\d{1,2})月(\d{1,2})日[ \t]*-[ \t]*(.*)$/u;
const DATE_CANDIDATE_PATTERN = /^\*[ \t]*\d+月/u;
const SUBGROUP_PATTERN = /^\*:[ \t]*[^：:\r\n]+[：:][ \t]*/u;
const HEADING_PATTERN = /^={1,6}[^=].*?={1,6}[ \t]*$/u;
const VGC_NAME_PATTERN =
    /^(?:(?:Template|模板|樣板|样板|T)[ \t]*:[ \t]*)?vgc$/iu;

export interface NewPageListArchiveGroup {
    title: string;
    year: number;
    months: Array<number>;
    recordCount: number;
    text: string;
}

export interface NewPageListArchivePlan {
    cutoff: string;
    sourceText: string;
    groups: Array<NewPageListArchiveGroup>;
    recordCount: number;
}

interface SourceLine {
    start: number;
    end: number;
    text: string;
    masked: string;
}

interface ArchiveRecord {
    start: number;
    end: number;
    date: string;
    year: number;
    month: number;
    text: string;
}

interface YearHeading {
    start: number;
    end: number;
    year: number;
    records: Array<ArchiveRecord>;
}

interface MonthHeading extends YearHeading {
    month: number;
}

interface ParsedArchiveSource {
    records: Array<ArchiveRecord>;
    headings: Array<YearHeading>;
    months: Array<MonthHeading>;
    lines: Array<SourceLine>;
}

/** Prepares annual destinations and exact remaining list source without writes. */
export function prepareNewPageListArchive(
    text: string,
    now: Date,
): NewPageListArchivePlan {
    const cutoff = getArchiveCutoff(now);
    const parsed = readArchiveSource(text);
    const eligible = parsed.records.filter((record) => record.date <= cutoff);
    const ranges = eligible.map(({ start, end }) => ({ start, end }));

    for (const heading of [...parsed.headings, ...parsed.months]) {
        if (
            heading.records.length > 0 &&
            heading.records.every((record) => record.date <= cutoff)
        ) {
            ranges.push({ start: heading.start, end: heading.end });
        }
    }

    return {
        cutoff,
        sourceText: removeSourceRanges(text, ranges),
        groups: buildArchiveGroups(eligible),
        recordCount: eligible.length,
    };
}

/** Merges missing records into their month sections without rewriting saved text. */
export function mergeNewPageListArchive(
    existingText: string,
    group: NewPageListArchiveGroup,
): string {
    const moved = readArchiveSource(group.text);
    if (
        group.title !== `${ARCHIVE_PREFIX}${group.year}年存档` ||
        moved.records.length !== group.recordCount ||
        moved.records.length === 0 ||
        moved.records.some((record) => record.year !== group.year) ||
        moved.headings.length !== 1 ||
        moved.headings[0].year !== group.year ||
        moved.months.length !== group.months.length ||
        moved.months.some(
            (month, index) =>
                month.month !== group.months[index] ||
                month.records.length === 0,
        ) ||
        moved.months.reduce(
            (count, month) => count + month.records.length,
            0,
        ) !== group.recordCount ||
        removeSourceRanges(group.text, [
            ...moved.records,
            ...moved.headings,
            ...moved.months,
        ]).trim() !== ''
    ) {
        throw new Error('The annual archive group contains invalid records.');
    }
    if (existingText === '') return group.text;

    const existing = readArchiveSource(existingText, group.year, true);
    if (
        existing.headings.length > 1 ||
        (existing.months.length > 0 && existing.headings.length !== 1) ||
        existing.headings.some((heading) => heading.year !== group.year) ||
        existing.months.reduce(
            (count, month) => count + month.records.length,
            0,
        ) !== existing.records.length
    ) {
        throw new Error(
            'The annual archive has incompatible year or month sections.',
        );
    }
    const byDate = new Map<string, Array<ArchiveRecord>>();
    for (const record of existing.records) {
        const saved = byDate.get(record.date) ?? [];
        saved.push(record);
        byDate.set(record.date, saved);
    }
    const missing: Array<ArchiveRecord> = [];

    for (const record of moved.records) {
        const previous = byDate.get(record.date);
        if (previous == null) {
            missing.push(record);
        } else if (
            previous.some(
                (saved) =>
                    compareRecordText(saved.text) !==
                    compareRecordText(record.text),
            )
        ) {
            throw new Error(
                `The archive already contains a different record for ${record.date}.`,
            );
        }
    }

    if (missing.length === 0) {
        return existingText;
    }

    const lineEnding =
        existingText.match(/\r\n|\n|\r/u)?.[0] ??
        group.text.match(/\r\n|\n|\r/u)?.[0] ??
        '\n';
    let result = existingText;
    if (existing.headings.length === 0) {
        result = insertArchiveText(
            result,
            findArchiveInsertOffset(existing),
            `== ${group.year}年 ==${lineEnding}${lineEnding}`,
            lineEnding,
        );
    }
    for (const month of [...group.months].sort((left, right) => right - left)) {
        const records = missing
            .filter((record) => record.month === month)
            .sort((left, right) => right.date.localeCompare(left.date));
        if (records.length === 0) continue;
        let parsed = readArchiveSource(result, group.year, true);
        const section = parsed.months.find(
            (heading) => heading.month === month,
        );
        if (section == null) {
            const older = parsed.months.find(
                (heading) => heading.month < month,
            );
            const offset = older?.start ?? findArchiveInsertOffset(parsed);
            const body = joinArchiveRecords(
                records.map((record) => record.text),
                lineEnding,
            );
            result = insertArchiveText(
                result,
                offset,
                `=== ${month}月 ===${lineEnding}${lineEnding}${body}${/[\r\n]$/u.test(body) ? '' : lineEnding}${lineEnding}`,
                lineEnding,
            );
            continue;
        }
        for (const record of records) {
            parsed = readArchiveSource(result, group.year, true);
            const current = parsed.months.find(
                (heading) => heading.month === month,
            )!;
            const older = current.records.find(
                (saved) => saved.date < record.date,
            );
            const offset =
                older?.start ?? current.records.at(-1)?.end ?? current.end;
            result = insertArchiveText(result, offset, record.text, lineEnding);
        }
    }
    return result;
}

/** Gets the last UTC day of the most recent wholly eligible archive month. */
function getArchiveCutoff(now: Date): string {
    if (!Number.isFinite(now.getTime())) {
        throw new Error('The archive date is invalid.');
    }
    const target = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 0),
    );
    return target.toISOString().slice(0, 10);
}

/** Reads offset-preserving daily records outside templates and literal regions. */
function readArchiveSource(
    text: string,
    impliedYear?: number,
    allowDuplicateDates = false,
): ParsedArchiveSource {
    const lines = readSourceLines(text, maskStructuredWikitext(text));
    const records: Array<ArchiveRecord> = [];
    const headings: Array<YearHeading> = [];
    const months: Array<MonthHeading> = [];
    const dates = new Set<string>();
    let year = impliedYear;
    let currentHeading: YearHeading | undefined;
    let currentMonth: MonthHeading | undefined;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const heading = YEAR_HEADING_PATTERN.exec(line.masked);
        if (heading != null) {
            year = Number(heading[1]);
            currentHeading = {
                start: line.start,
                end: line.end,
                year,
                records: [],
            };
            currentMonth = undefined;
            headings.push(currentHeading);
            continue;
        }
        const monthHeading = MONTH_HEADING_PATTERN.exec(line.masked);
        if (monthHeading != null) {
            const month = Number(monthHeading[1]);
            if (
                year == null ||
                month < 1 ||
                month > 12 ||
                months.some(
                    (heading) =>
                        heading.year === year && heading.month === month,
                )
            ) {
                throw new Error(
                    'The annual archive contains an invalid or repeated month heading.',
                );
            }
            currentMonth = {
                start: line.start,
                end: line.end,
                year,
                month,
                records: [],
            };
            months.push(currentMonth);
            continue;
        }
        if (HEADING_PATTERN.test(line.masked)) {
            year = undefined;
            currentHeading = undefined;
            currentMonth = undefined;
            continue;
        }
        if (line.masked.startsWith('*:')) {
            throw new Error('The new-page list contains a detached subgroup.');
        }
        if (!DATE_CANDIDATE_PATTERN.test(line.masked)) {
            continue;
        }
        if (year == null) {
            throw new Error('A dated new-page record has no year heading.');
        }
        const record = readDatedRecord(line, year);
        if (currentMonth != null && record.month !== currentMonth.month) {
            throw new Error(
                'An annual archive record is outside its month section.',
            );
        }
        while (lines[index + 1]?.masked.startsWith('*:')) {
            index += 1;
            if (!SUBGROUP_PATTERN.test(lines[index].masked)) {
                throw new Error(
                    'The new-page list contains a malformed subgroup.',
                );
            }
            record.end = lines[index].end;
        }
        record.text = text.slice(record.start, record.end);
        if (!allowDuplicateDates && dates.has(record.date)) {
            throw new Error(
                `The new-page list repeats the date ${record.date}.`,
            );
        }
        dates.add(record.date);
        records.push(record);
        currentHeading?.records.push(record);
        currentMonth?.records.push(record);
    }

    return { records, headings, months, lines };
}

/** Keeps physical line endings and character offsets unchanged. */
function readSourceLines(text: string, masked: string): Array<SourceLine> {
    const lines: Array<SourceLine> = [];
    for (const match of text.matchAll(/[^\r\n]*(?:\r\n|\n|\r|$)/gu)) {
        if (match[0] === '') continue;
        const start = match.index;
        const content = match[0].replace(/(?:\r\n|\n|\r)$/u, '');
        lines.push({
            start,
            end: start + match[0].length,
            text: content,
            masked: masked.slice(start, start + content.length),
        });
    }
    return lines;
}

/** Rejects impossible calendar dates rather than normalizing them into another month. */
function readDatedRecord(line: SourceLine, year: number): ArchiveRecord {
    const match = DATE_LINE_PATTERN.exec(line.masked);
    const month = Number(match?.[1]);
    const day = Number(match?.[2]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        match == null ||
        !Number.isFinite(date.getTime()) ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() + 1 !== month ||
        date.getUTCDate() !== day
    ) {
        throw new Error('The new-page list contains an invalid daily date.');
    }
    return {
        start: line.start,
        end: line.end,
        date: date.toISOString().slice(0, 10),
        year,
        month,
        text: '',
    };
}

/** Collects descending month sections into one destination per year. */
function buildArchiveGroups(
    records: Array<ArchiveRecord>,
): Array<NewPageListArchiveGroup> {
    const groups = new Map<string, NewPageListArchiveGroup>();
    for (const record of [...records].sort((left, right) =>
        right.date.localeCompare(left.date),
    )) {
        const title = `${ARCHIVE_PREFIX}${record.year}年存档`;
        const converted = convertVgcCalls(record.text);
        const group = groups.get(title);
        if (group == null) {
            groups.set(title, {
                title,
                year: record.year,
                months: [record.month],
                recordCount: 1,
                text: `== ${record.year}年 ==\n\n=== ${record.month}月 ===\n\n${converted}`,
            });
        } else {
            group.recordCount += 1;
            if (!group.months.includes(record.month)) {
                group.months.push(record.month);
                group.text = joinArchiveRecords(
                    [group.text, `\n=== ${record.month}月 ===\n\n`],
                    '\n',
                );
            }
            group.text = joinArchiveRecords([group.text, converted], '\n');
        }
    }
    return [...groups.values()];
}

/** Removes only reviewed record spans and newly emptied year headings. */
function removeSourceRanges(
    text: string,
    ranges: Array<{ start: number; end: number }>,
): string {
    let result = '';
    let offset = 0;
    for (const range of [...ranges].sort(
        (left, right) => left.start - right.start,
    )) {
        result += text.slice(offset, range.start);
        offset = range.end;
    }
    return result + text.slice(offset);
}

/** Converts active Vgc calls without touching comments or literal-tag bodies. */
function convertVgcCalls(text: string, depth = 0): string {
    if (depth > 100)
        throw new Error('The new-page list contains deeply nested templates.');
    let result = '';
    for (let index = 0; index < text.length;) {
        const opaqueEnd = readOpaqueEnd(text, index);
        if (opaqueEnd != null) {
            result += text.slice(index, opaqueEnd);
            index = opaqueEnd;
            continue;
        }
        if (!text.startsWith('{{', index)) {
            result += text[index];
            index += 1;
            continue;
        }
        const width = text.startsWith('{{{', index) ? 3 : 2;
        const end = readConstructEnd(text, index);
        const inner = text.slice(index + width, end - width);
        const name = inner.split('|', 1)[0].trim().replace(/_/gu, ' ');
        if (width === 2 && VGC_NAME_PATTERN.test(name)) {
            result += buildArchivedVgcLink(inner);
        } else {
            result +=
                '{'.repeat(width) +
                convertVgcCalls(inner, depth + 1) +
                '}'.repeat(width);
        }
        index = end;
    }
    return result;
}

/** Accepts only the confirmed single title argument of Module:Vgclass. */
function buildArchivedVgcLink(inner: string): string {
    const parts = inner.split('|');
    const argument = parts[1]?.trim();
    const explicit = /^1[ \t]*=/u.exec(argument ?? '');
    const title = (
        explicit == null ? argument : argument?.slice(explicit[0].length)
    )
        ?.trim()
        .replace(/^:/u, '')
        .trim();
    if (
        parts.length !== 2 ||
        title == null ||
        title === '' ||
        title.startsWith('#') ||
        /[{}[\]|<>]/u.test(title) ||
        [...title].some(
            (character) =>
                character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        ) ||
        (explicit == null && title.includes('='))
    ) {
        throw new Error('The new-page list contains an unsupported Vgc call.');
    }
    return `[[:${title}]]`;
}

/** Masks structural-looking lines inside opaque text and template constructs. */
function maskStructuredWikitext(text: string): string {
    const masked = text.split('');
    for (let index = 0; index < text.length;) {
        const opaqueEnd = readOpaqueEnd(text, index);
        const end =
            opaqueEnd ??
            (text.startsWith('{{', index)
                ? readConstructEnd(text, index)
                : null);
        if (end == null) {
            index += 1;
            continue;
        }
        for (let position = index; position < end; position += 1) {
            if (masked[position] !== '\r' && masked[position] !== '\n')
                masked[position] = ' ';
        }
        index = end;
    }
    return masked.join('');
}

/** Reads comments and literal extension tags, rejecting unterminated regions. */
function readOpaqueEnd(text: string, index: number): number | null {
    if (text.startsWith('<!--', index)) {
        const end = text.indexOf('-->', index + 4);
        if (end === -1)
            throw new Error('The new-page list contains an unclosed comment.');
        return end + 3;
    }
    if (text[index] !== '<') return null;
    const opening = /^<(nowiki|pre|source|syntaxhighlight|math)\b[^>]*>/iu.exec(
        text.slice(index),
    );
    if (opening == null) return null;
    if (/\/\s*>$/u.test(opening[0])) return index + opening[0].length;
    const closing = new RegExp(`</${opening[1]}[ \\t]*>`, 'iu');
    const remainder = text.slice(index + opening[0].length);
    const match = closing.exec(remainder);
    if (match == null)
        throw new Error('The new-page list contains an unclosed literal tag.');
    return index + opening[0].length + match.index + match[0].length;
}

/** Balances template and parameter braces without interpreting opaque contents. */
function readConstructEnd(text: string, start: number): number {
    const stack: Array<number> = [];
    for (let index = start; index < text.length;) {
        const opaqueEnd = readOpaqueEnd(text, index);
        if (opaqueEnd != null) {
            index = opaqueEnd;
            continue;
        }
        const width = text.startsWith('{{{', index)
            ? 3
            : text.startsWith('{{', index)
              ? 2
              : 0;
        if (width > 0) {
            stack.push(width);
            if (stack.length > 100)
                throw new Error(
                    'The new-page list contains deeply nested templates.',
                );
            index += width;
            continue;
        }
        const closing = stack.at(-1) ?? 0;
        if (closing > 0 && text.startsWith('}'.repeat(closing), index)) {
            stack.pop();
            index += closing;
            if (stack.length === 0) return index;
            continue;
        }
        index += 1;
    }
    throw new Error('The new-page list contains an unclosed template.');
}

/** Ignores only the record's outer line terminator when recovering an append. */
function compareRecordText(text: string): string {
    return text.replace(/(?:\r\n|\n|\r)$/u, '');
}

/** Inserts after the complete last month body and before explicit archive footers. */
function findArchiveInsertOffset(parsed: ParsedArchiveSource): number {
    const sectionEnd =
        parsed.months.at(-1)?.end ?? parsed.headings.at(-1)?.end ?? 0;
    const footer = parsed.lines.find(
        (line) =>
            line.start >= sectionEnd &&
            ((HEADING_PATTERN.test(line.masked) &&
                !YEAR_HEADING_PATTERN.test(line.masked) &&
                !MONTH_HEADING_PATTERN.test(line.masked)) ||
                /^\[\[(?:Category|分类|分類):/iu.test(line.masked)),
    );
    return footer?.start ?? parsed.lines.at(-1)?.end ?? 0;
}

/** Adds complete lines while leaving all existing characters untouched. */
function insertArchiveText(
    text: string,
    offset: number,
    inserted: string,
    lineEnding: string,
): string {
    const prefix = text.slice(0, offset);
    const suffix = text.slice(offset);
    const separator =
        prefix === '' || /[\r\n]$/u.test(prefix) ? '' : lineEnding;
    const terminal =
        suffix === '' || /[\r\n]$/u.test(inserted) ? '' : lineEnding;
    return `${prefix}${separator}${inserted}${terminal}${suffix}`;
}

/** Joins whole records without changing their original internal line endings. */
function joinArchiveRecords(
    records: Array<string>,
    lineEnding: string,
): string {
    return records.reduce(
        (result, record) =>
            result +
            (result === '' || /[\r\n]$/u.test(result) ? '' : lineEnding) +
            record,
        '',
    );
}
