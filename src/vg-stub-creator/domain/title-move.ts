/**
 * @file src/vg-stub-creator/domain/title-move.ts
 * Purpose: Updates generated title fragments while preserving reviewed article edits.
 * Contents: Moved-title contracts, fragment matching, and text replacement.
 */

/**
 * Defines infobox start.
 *
 * Updates title-dependent generated fragments without rebuilding manual
 * text.
 */

const INFOBOX_START = '{{Infobox VG\n';
const INFOBOX_END = '\n}}';

/**
 * Updates generated title fragments for a moved article.
 *
 * @param text - Current manually editable wikitext.
 * @param current - Article data for the current title.
 * @param target - Article data for the target title.
 * @returns Wikitext with only generated title fragments
 * updated.
 */
export function updateMovedTitleText(
    text: string,
    current: any,
    target: any,
): string {
    let updated = updateInfoboxTitleLines(text, current, target);

    updated = updateLeadTitle(updated, current, target);
    updated = replaceOnce(
        updated,
        current.defaultSortText,
        target.defaultSortText,
    );

    return updated;
}

/**
 * Handles update lead title.
 *
 * Updates the first prose title and its optional foreign-title
 * parenthesis.
 *
 * @param text - Current wikitext.
 * @param current - Current-title article data.
 * @param target - Target-title article data.
 * @returns Updated wikitext.
 */
function updateLeadTitle(text: string, current: any, target: any): string {
    const exact = replaceOnce(text, current.leadNameText, target.leadNameText);

    if (exact !== text) {
        return exact;
    }

    const currentName = current.name || current.form?.name;

    if (currentName == null || currentName === '') {
        return text;
    }

    const mainTitle = `《'''${escapeRegularExpression(currentName)}'''》`;
    const pattern = new RegExp(`${mainTitle}(?:（[^）\\n]*）)?`, 'u');

    return text.replace(pattern, target.leadNameText);
}

/**
 * Updates only changed generated lines inside the Infobox VG template.
 *
 * @param text - Current wikitext.
 * @param current - Current-title article data.
 * @param target - Target-title article data.
 * @returns Updated wikitext.
 */
function updateInfoboxTitleLines(
    text: string,
    current: any,
    target: any,
): string {
    const bounds = getInfoboxBounds(text);

    if (bounds == null) {
        return text;
    }

    const { start, end } = bounds;
    const lines = getChangedInfoboxLines(current, target);
    const blockEnd = end + INFOBOX_END.length;
    let infobox = text.slice(start, blockEnd);

    const forEachCallback = function callback(key: string) {
        const configValue = lines.current.get(key) ?? null;
        const configValueA = lines.target.get(key) ?? null;
        infobox = updateInfoboxParameterLine(
            infobox,
            configValue,
            configValueA,
        );
    };
    lines.keys.forEach(forEachCallback);

    return replaceInfoboxBlock(text, start, blockEnd, infobox);
}

/**
 * Replaces the located infobox block.
 *
 * @param text - Source text.
 * @param start - Start value.
 * @param blockEnd - Block end value.
 * @param infobox - Infobox value.
 * @returns Result when the function
 *   replaces the located infobox block.
 */
function replaceInfoboxBlock(
    text: string,
    start: number,
    blockEnd: number,
    infobox: string,
): string {
    const updated = [
        '',
        text.slice(0, start),
        '',
        infobox,
        '',
        text.slice(blockEnd),
        '',
    ].join('');

    return updated;
}

/**
 * Gets the start and end positions of the generated infobox.
 *
 * @param text - Source text.
 * @returns The start and end positions of the generated infobox.
 */
function getInfoboxBounds(text: string): any | null {
    const start = text.indexOf(INFOBOX_START);
    const end = start < 0 ? -1 : text.indexOf(INFOBOX_END, start);

    return start < 0 || end < 0 ? null : { end, start };
}

/**
 * Gets current, target, and changed infobox parameter lines.
 *
 * @param current - Current value.
 * @param target - Target value.
 * @returns Current, target, and changed infobox parameter lines.
 */
function getChangedInfoboxLines(
    current: { infoboxText: string },
    target: { infoboxText: string },
): {
    current: Map<string, string>;
    keys: Set<string>;
    target: Map<string, string>;
} {
    const currentLines = parseTemplateParameterLines(current.infoboxText);
    const targetLines = parseTemplateParameterLines(target.infoboxText);
    const currentKeys = currentLines.keys();
    const targetKeys = targetLines.keys();
    const keys = new Set([...currentKeys, ...targetKeys]);

    return { current: currentLines, keys, target: targetLines };
}

/**
 * Updates one changed generated infobox parameter line.
 *
 * @param infobox - Infobox value.
 * @param currentLine - Current line value.
 * @param targetLine - Target line value.
 * @returns Result when the function
 *   updates one changed generated infobox parameter
 *   line.
 */
function updateInfoboxParameterLine(
    infobox: string,
    currentLine: string | null,
    targetLine: string | null,
): string {
    if (currentLine === targetLine) {
        return infobox;
    }
    if (currentLine != null && infobox.includes(currentLine)) {
        if (targetLine == null) {
            return infobox.replace(`\n${currentLine}`, '');
        }

        return infobox.replace(currentLine, targetLine);
    }
    if (targetLine != null) {
        const updated = infobox.replace(
            INFOBOX_END,
            `\n${targetLine}${INFOBOX_END}`,
        );

        return updated;
    }

    return infobox;
}

/**
 * Parses block-template parameter lines by parameter name.
 *
 * @param template - Generated template wikitext.
 * @returns Parameter lines keyed by name.
 */
function parseTemplateParameterLines(template: string): Map<string, string> {
    const mapCallback = function callback(line: string) {
        const match = line.match(/^\|\s*([^=]+?)\s*=/u);

        if (match == null) {
            return null;
        }

        return [match[1].trim(), line] as [string, string];
    };
    const entries = String(template || '')
        .split('\n')
        .map(mapCallback)
        .filter((entry): entry is [string, string] => entry != null);
    const result = new Map<string, string>(entries);
    return result;
}

/**
 * Replaces one exact generated fragment when it remains present.
 *
 * @param text - Current wikitext.
 * @param current - Current generated fragment.
 * @param target - Target generated fragment.
 * @returns Updated wikitext.
 */
function replaceOnce(text: string, current: string, target: string): string {
    if (current === target || current == null || current === '') {
        return text;
    }

    const index = text.indexOf(current);

    if (index < 0) {
        return text;
    }

    const result = `${text.slice(0, index)}${target || ''}${text.slice(
        index + current.length,
    )}`;
    return result;
}

/**
 * Escapes text for use inside a regular expression.
 *
 * @param value - Literal text.
 * @returns Escaped regular-expression text.
 */
function escapeRegularExpression(value: string): string {
    return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
