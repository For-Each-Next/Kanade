/**
 * @file src/source-editor/features/source-manager/messages.ts
 * Purpose: Locale adapters for source validation and analysis messages.
 *
 * Table of contents:
 * 1. Imports
 * 2. createSourceValidationMessages
 * 3. createSourceAnalysisMessages
 * 4. Constants and state
 */

import type * as analysis from '../../domain/source-analysis.ts';
import type * as validation from '../../domain/source-validation.ts';
import { msg, type SourceEditorI18n } from '../../i18n/index.ts';

/** Creates localized messages for pure source-draft validation. */
export function createSourceValidationMessages(
    translator: Pick<SourceEditorI18n, 'msg'>,
): validation.SourceValidationMessages {
    return {
        addParameter(message, parameter) {
            return translator.msg('validation.addParameter', {
                message,
                parameter,
            });
        },
        aliasRequiresValue() {
            return translator.msg('validation.aliasRequiresValue');
        },
        archiveDateRequiresUrl() {
            return translator.msg('validation.archiveDateRequiresUrl');
        },
        archiveUrlRequiresDate() {
            return translator.msg('validation.archiveUrlRequiresDate');
        },
        dependency(source, targets) {
            return translator.msg('validation.dependency', {
                source,
                targets: targets.join(translator.msg('validation.or')),
            });
        },
        dependencyWithParameter(source, targets, parameter) {
            return translator.msg('validation.dependencyWithParameter', {
                parameter,
                source,
                targets: targets.join(translator.msg('validation.or')),
            });
        },
        invalidDate(parameter) {
            return translator.msg('validation.invalidDate', { parameter });
        },
        invalidParameterName() {
            return translator.msg('validation.invalidParameterName');
        },
        parameterRequired() {
            return translator.msg('validation.parameterRequired');
        },
        unsupportedParameter(parameter) {
            return translator.msg('validation.unsupportedParameter', {
                parameter,
            });
        },
    };
}

/** Creates localized labels and explanations for citation analysis. */
export function createSourceAnalysisMessages(
    translator: Pick<SourceEditorI18n, 'msg'>,
): analysis.SourceAnalysisMessages {
    return {
        aliasLabel(sourceKey, value) {
            return translator.msg(
                sourceKey
                    ? 'analysis.sourceKeyLabel'
                    : 'analysis.hashAliasLabel',
                { value },
            );
        },
        aliasReason(sourceKey, hasMissing) {
            if (sourceKey) {
                return translator.msg(
                    hasMissing
                        ? 'analysis.someMissingSourceKey'
                        : 'analysis.differentSourceKey',
                );
            }
            return translator.msg(
                hasMissing
                    ? 'analysis.someMissingAlias'
                    : 'analysis.differentAlias',
            );
        },
        authorLabel(author) {
            return translator.msg('analysis.authorLabel', { author });
        },
        authorReason() {
            return translator.msg('analysis.authorReason');
        },
        domainLabel(category, domain) {
            return translator.msg(
                category === 'publication'
                    ? 'analysis.publicationLabel'
                    : 'analysis.publisherLabel',
                { domain },
            );
        },
        domainReason(sameDisplayValue) {
            return translator.msg(
                sameDisplayValue
                    ? 'analysis.sameDisplayStyle'
                    : 'analysis.sameHostValue',
            );
        },
        fieldChanged() {
            return translator.msg('analysis.fieldChanged');
        },
        replacementConflict() {
            return translator.msg('analysis.replacementConflict');
        },
        sourceChanged() {
            return translator.msg('analysis.sourceChanged');
        },
        sourceMissing() {
            return translator.msg('analysis.sourceMissing');
        },
        untitledSource() {
            return translator.msg('common.untitledSource');
        },
    };
}

const messages = { msg };

export const sourceValidationMessages =
    createSourceValidationMessages(messages);
export const sourceAnalysisMessages = createSourceAnalysisMessages(messages);
