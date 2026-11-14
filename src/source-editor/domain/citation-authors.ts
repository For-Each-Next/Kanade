/**
 * @file src/source-editor/domain/citation-authors.ts
 * Purpose: Split explicit comma-order personal authors during requested citation formatting.
 * Contents: Protected citation discovery, author-slot guards, and source replacements.
 */

import { wikitext } from '../../library/wikitext/index.ts';
import {
    DEFAULT_TEMPLATE_NAME_CONTEXT,
    isCitationTemplate,
    type TemplateNameContext,
} from './templates.ts';
import {
    findCitationFormattingProtectedRanges,
    findReferenceAttributeRanges,
    isInWikitextRanges,
} from './protected-wikitext.ts';
import { applyReplacements } from './wikitext.ts';
import type { TextReplacement } from './types.ts';

const PERSONAL_NAME =
    /^([\p{Script=Latin}][\p{Script=Latin}\p{M} .'’-]*),\s*([\p{Script=Latin}][\p{Script=Latin}\p{M} .'’-]*)$/u;
const ORGANIZATION_OR_SUFFIX =
    /\b(?:and|associates|association|agency|board|bureau|center|centre|co|company|corporation|corp|department|editorial|editors|foundation|group|inc|institute|jr|limited|llc|ltd|news|office|press|project|publisher|publishing|staff|sr|team|university)\b/iu;

/** Keeps uncertain names intact; only explicitly comma-separated personal names qualify. */
export function convertCitationAuthorNames(
    source: string,
    context: TemplateNameContext = DEFAULT_TEMPLATE_NAME_CONTEXT,
): string {
    const protectedRanges = [
        ...findCitationFormattingProtectedRanges(source),
        ...findReferenceAttributeRanges(source),
    ];
    const replacements: TextReplacement[] = [];
    for (const call of wikitext(source).template.getAll()) {
        if (
            !isCitationTemplate(call.name, context) ||
            isInWikitextRanges(call.start, protectedRanges)
        )
            continue;
        for (const parameter of call.params) {
            if (parameter.positional) continue;
            const author = /^author([1-9]\d*)?$/u.exec(parameter.name);
            if (!author) continue;
            const slot = author[1] || '1';
            const conflicts = call.params.filter((candidate) => {
                const name = candidate.name.toLowerCase();
                const plain =
                    /^(?:author|last|first|surname|given)([1-9]\d*)?$/u.exec(
                        name,
                    );
                const prefix =
                    /^author-(?:first|last|surname)([1-9]\d*)?$/u.exec(name);
                const infix = /^author([1-9]\d*)-(?:first|last|surname)$/u.exec(
                    name,
                );
                const matched = plain || prefix || infix;
                return matched && (matched[1] || '1') === slot;
            });
            if (conflicts.length !== 1) continue;
            const parts = PERSONAL_NAME.exec(parameter.value);
            if (!parts || ORGANIZATION_OR_SUFFIX.test(parameter.value))
                continue;
            const last = parts[1].trim();
            const first = parts[2].trim();
            if (!last || !first) continue;
            const suffix = author[1] || '';
            replacements.push({
                start: parameter.start,
                end: parameter.end,
                text: `last${suffix}=${last}|first${suffix}=${first}`,
            });
        }
    }
    return applyReplacements(source, replacements);
}
