/**
 * @file scripts/build-assets.ts
 * Purpose: Encodes readable build assets without changing their string contents.
 *
 * Table of contents:
 * 1. createReadableAssetLiteral
 * 2. escapeTemplateContent
 * 3. wrapCompactMarkup
 */

/**
 * Creates a JavaScript template literal for an embedded asset.
 *
 * Compact markup uses escaped line continuations so its existing text spacing
 * survives exactly. Authored styles retain their actual newlines.
 */
export function createReadableAssetLiteral(
    source: string,
    options: { compactMarkup?: boolean } = {},
): string {
    const lines = source
        .split('\n')
        .map((line) =>
            options.compactMarkup
                ? wrapCompactMarkup(line)
                      .map(escapeTemplateContent)
                      .join('\\\n')
                : escapeTemplateContent(line),
        );
    return '`' + lines.join('\n') + '`';
}

function escapeTemplateContent(source: string): string {
    return source
        .replaceAll('\\', '\\\\')
        .replaceAll('`', '\\`')
        .replaceAll('${', '\\${')
        .replaceAll('\r', '\\r');
}

function wrapCompactMarkup(source: string): string[] {
    const lines: string[] = [];
    let start = 0;
    while (start < source.length) {
        const limit = Math.min(start + 100, source.length);
        const tagBoundary = source.indexOf('><', start);
        let end =
            tagBoundary >= start && tagBoundary + 1 <= limit
                ? tagBoundary + 1
                : limit;
        if (end === limit && end < source.length) {
            const space = source.lastIndexOf(' ', end - 1);
            if (space > start) end = space;
        }
        const previous = source.charCodeAt(end - 1);
        const next = source.charCodeAt(end);
        if (
            previous >= 0xd800 &&
            previous <= 0xdbff &&
            next >= 0xdc00 &&
            next <= 0xdfff
        ) {
            end -= 1;
        }
        lines.push(source.slice(start, end));
        start = end;
    }
    return lines;
}
