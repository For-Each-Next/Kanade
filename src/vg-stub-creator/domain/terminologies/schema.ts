/**
 * @file src/vg-stub-creator/domain/terminologies/schema.ts
 * Purpose: Runtime terminology catalog entry.
 *
 * Table of contents:
 * 1. TerminologyAlias
 * 2. TerminologyDefinition
 */

type TerminologyAlias = string | RegExp;

export interface TerminologyDefinition {
    aliases: [TerminologyAlias, ...Array<TerminologyAlias>];
    label: string;
    page?: string;
    navboxes?: Array<string>;
    categories?: Array<string>;
    stubTags?: Array<string>;
}
