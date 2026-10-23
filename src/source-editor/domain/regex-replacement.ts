/**
 * @file src/source-editor/domain/regex-replacement.ts
 * Purpose: Bound regular-expression replacement with JavaScript substitution rules.
 * Contents: Request/result contracts and a self-contained worker operation.
 */

export interface RegexReplacementDraft {
    pattern: string;
    replacement: string;
    flags: string;
}

export type RegexReplacementError =
    | 'pattern-required'
    | 'invalid-pattern'
    | 'invalid-flags'
    | 'input-too-large'
    | 'output-too-large'
    | 'too-many-matches'
    | 'unavailable'
    | 'timeout'
    | 'cancelled'
    | 'source-changed';

export type RegexReplacementResult =
    | { ok: true; output: string; matches: number }
    | { ok: false; error: RegexReplacementError };

export interface RegexReplacementTask {
    result: Promise<RegexReplacementResult>;
    cancel(): void;
}

/** Self-contained: the browser adapter serializes this function into a worker. */
export function executeRegexReplacement(
    request: RegexReplacementDraft & { source: string },
): RegexReplacementResult {
    const maxLength = 2_000_000;
    if (
        request.source.length > maxLength ||
        request.replacement.length > 100_000
    )
        return { ok: false, error: 'input-too-large' };
    if (!request.pattern) return { ok: false, error: 'pattern-required' };
    if (request.pattern.length > 10_000)
        return { ok: false, error: 'input-too-large' };
    if (
        !/^[dgimsuvy]*$/u.test(request.flags) ||
        new Set(request.flags).size !== request.flags.length
    )
        return { ok: false, error: 'invalid-flags' };
    let regex: RegExp;
    try {
        new RegExp('', request.flags);
    } catch {
        return { ok: false, error: 'invalid-flags' };
    }
    try {
        regex = new RegExp(request.pattern, request.flags);
    } catch {
        return { ok: false, error: 'invalid-pattern' };
    }
    const parts: string[] = [];
    let length = 0;
    let cursor = 0;
    let matches = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(request.source)) !== null) {
        if (++matches > 10_000) return { ok: false, error: 'too-many-matches' };
        const found = match;
        let replacement: string;
        let replacementLength = request.replacement.length;
        try {
            replacement = request.replacement.replace(
                /\$(\$|&|`|'|<[^>]*>|[0-9]{1,2})/gu,
                (token: string, key: string): string => {
                    let value: string;
                    if (key === '$') value = '$';
                    else if (key === '&') value = found[0];
                    else if (key === '`')
                        value = request.source.slice(0, found.index);
                    else if (key === "'")
                        value = request.source.slice(
                            found.index + found[0].length,
                        );
                    else if (key.startsWith('<'))
                        value =
                            found.groups === undefined
                                ? token
                                : (found.groups[key.slice(1, -1)] ?? '');
                    else {
                        const index = Number(key);
                        if (index > 0 && index < found.length)
                            value = found[index] ?? '';
                        else {
                            const first = Number(key[0]);
                            value =
                                key.length === 2 &&
                                first > 0 &&
                                first < found.length
                                    ? (found[first] ?? '') + key[1]
                                    : token;
                        }
                    }
                    replacementLength += value.length - token.length;
                    if (replacementLength > maxLength) throw new RangeError();
                    return value;
                },
            );
        } catch {
            return { ok: false, error: 'output-too-large' };
        }
        const prefix = request.source.slice(cursor, found.index);
        length += prefix.length + replacement.length;
        if (length > maxLength) return { ok: false, error: 'output-too-large' };
        parts.push(prefix, replacement);
        cursor = found.index + found[0].length;
        if (!regex.global) break;
        if (!found[0]) {
            const point = request.source.codePointAt(regex.lastIndex);
            regex.lastIndex +=
                (regex.unicode || regex.unicodeSets) &&
                point !== undefined &&
                point > 0xffff
                    ? 2
                    : 1;
        }
    }
    const tail = request.source.slice(cursor);
    if (length + tail.length > maxLength)
        return { ok: false, error: 'output-too-large' };
    parts.push(tail);
    return { ok: true, output: parts.join(''), matches };
}
