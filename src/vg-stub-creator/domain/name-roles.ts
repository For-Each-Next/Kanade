/**
 * @file src/vg-stub-creator/domain/name-roles.ts
 * Purpose: Keeps immutable name sources separate from editable article-title and redirect roles.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. NameRole
 * 4. NameNoteTaVariant
 * 5. NameNoteTaVariantOverride
 * 6. NameNoteTaVariantDraft
 * 7. NameNoteTaVariantOverrides
 * 8. NameSource
 * 9. NameRoleRow
 * 10. NameForm
 * 11. NameRolePatch
 * 12. getNameSources
 * 13. getNameRole
 * 14. getOfficialNameNoteTaSources
 * 15. setNameRole
 * 16. getNameNoteTaVariants
 * 17. getNameNoteTaRuleDraft
 * 18. setNameNoteTaRule
 * 19. setNameNoteTaVariant
 * 20. buildNameNoteTaConversionText
 * 21. syncNameRoles
 * 22. getNameRedirectTitles
 * 23. getLocalizedNameRows
 * 24. getRoleRows
 * 25. getDefaultNameRole
 * 26. normalizeNoteTaVariants
 * 27. getNoteTaVariantDrafts
 * 28. getLegacyNoteTaRuleValue
 * 29. hasVariantMarket
 * 30. parseNoteTaRule
 * 31. formatNoteTaRule
 * 32. normalizeNoteTaVariant
 * 33. getEffectiveNoteTaValues
 * 34. getDefaultNoteTaRuleValue
 * 35. getNextNoteTaOrder
 * 36. getOriginalName
 * 37. isChineseName
 * 38. splitRedirectTitles
 * 39. normalizeTitleKey
 * 40. isRecord
 */

import { isRecord } from '../../library/data-validation/records.ts';

import { buildOfficialNameConversionText } from './wiki.ts';
import { normalizeArticleFormInput } from './article-input.ts';
import {
    hasFirstLevelFieldSeparator,
    splitFieldValues,
    trimValue,
} from './wikitext/field-values.ts';

const NAME_ROLES = [
    'pageName',
    'displayTitle',
    'redirect',
    'sortKey',
    'noteTa',
] as const;

export type NameRole = (typeof NAME_ROLES)[number];

export type NameNoteTaVariant =
    | 'zh'
    | 'zh-cn'
    | 'zh-tw'
    | 'zh-hk'
    | 'zh-sg'
    | 'zh-mo'
    | 'zh-my'
    | 'zh-hans'
    | 'zh-hant';

interface NameNoteTaVariantOverride {
    value: string;
    order: number;
}

export interface NameNoteTaVariantDraft {
    value: string;
    defaultValue: string;
    effectiveValue: string;
}

type NameNoteTaVariantOverrides = Partial<
    Record<NameNoteTaVariant, NameNoteTaVariantOverride>
>;

export interface NameSource {
    id: string;
    kind: 'localized' | 'original' | 'english';
    index?: number;
    name: string;
    sourceUrl: string;
}

export interface NameRoleRow {
    id: string;
    sourceId: string;
    role: NameRole;
    value: string;
    enabled: boolean;
    sourceValue: string;
    modified: boolean;
    noteTaVariants?: NameNoteTaVariantOverrides;
    noteTaRule?: string;
}

type NameForm = Record<string, unknown>;
type NameRolePatch = Partial<
    Pick<NameRoleRow, 'value' | 'enabled' | 'modified'>
>;

const SINGLETON_ROLES = new Set<NameRole>([
    'pageName',
    'displayTitle',
    'sortKey',
]);

/** Reads name sources without changing an active editor's draft. */
export function getNameSources(form: NameForm): NameSource[] {
    const rows = getLocalizedNameRows(form);
    const reserved = new Set(['original', 'english']);
    const used = new Set<string>();
    let sequence = 1;

    for (const row of rows) {
        const id = trimValue(row?.nameId);
        if (id !== '') {
            reserved.add(id);
        }
    }
    if (Array.isArray(form.nameRoleRows)) {
        for (const row of form.nameRoleRows) {
            if (isRecord(row)) {
                reserved.add(trimValue(row.sourceId));
            }
        }
    }

    const localized = rows.map((row, index): NameSource => {
        let id = trimValue(row?.nameId);
        if (
            id === '' ||
            id === 'original' ||
            id === 'english' ||
            used.has(id)
        ) {
            do {
                id = `localized:${sequence}`;
                sequence += 1;
            } while (reserved.has(id));
            reserved.add(id);
        }
        used.add(id);
        return {
            id,
            index,
            kind: 'localized',
            name: trimValue(row?.name),
            sourceUrl: trimValue(row?.sourceUrl),
        };
    });

    return [
        ...localized,
        {
            id: 'original',
            kind: 'original',
            name: getOriginalName(form.originalName).name,
            sourceUrl: trimValue(form.originalNameSourceUrl),
        },
        {
            id: 'english',
            kind: 'english',
            name: trimValue(form.englishName),
            sourceUrl: trimValue(form.englishNameSourceUrl),
        },
    ];
}

/** Reads an explicit choice, or a nonpersistent default role draft. */
export function getNameRole(
    form: NameForm,
    sourceId: string,
    role: NameRole,
): NameRoleRow {
    const sources = getNameSources(form);
    return (
        getRoleRows(form, sources).find(
            (row) => row.sourceId === sourceId && row.role === role,
        ) ?? getDefaultNameRole(form, sources, sourceId, role)
    );
}

/** Selects official sources contributing to the combined generated conversion rule. */
export function getOfficialNameNoteTaSources(
    form: NameForm,
    sources: NameSource[] = getNameSources(form),
): NameSource[] {
    const localizedRows = getLocalizedNameRows(form);
    const receivedRoles = Array.isArray(form.nameRoleRows)
        ? form.nameRoleRows
        : [];
    return sources.filter((source) => {
        if (source.kind !== 'localized') return false;
        const localized = localizedRows[source.index!];
        if (!isRecord(localized) || localized.official !== true) return false;
        const explicit = receivedRoles.some(
            (row) =>
                isRecord(row) &&
                row.role === 'noteTa' &&
                row.sourceId === source.id,
        );
        if (!explicit) return true;
        const role = getNameRole(form, source.id, 'noteTa');
        return (
            role.enabled &&
            trimValue(role.noteTaRule) === '' &&
            !(
                role.noteTaVariants == null &&
                role.modified &&
                trimValue(role.value) !== ''
            )
        );
    });
}

/** Stores one role choice while keeping singleton roles mutually exclusive. */
export function setNameRole(
    form: NameForm,
    sourceId: string,
    role: NameRole,
    patch: NameRolePatch,
): NameRoleRow {
    syncNameRoles(form);
    const sources = getNameSources(form);
    const defaults = getDefaultNameRole(form, sources, sourceId, role);
    const defaultValue = defaults.value;
    if (!sources.some((source) => source.id === sourceId)) {
        return defaults;
    }

    const rows = form.nameRoleRows as NameRoleRow[];
    let row = rows.find(
        (item) => item.sourceId === sourceId && item.role === role,
    );
    if (row == null) {
        row = defaults;
        rows.push(row);
        // Read through the collection so wrapped forms observe later changes.
        row = rows[rows.length - 1];
    }

    if (patch.value != null) {
        if (
            role === 'noteTa' &&
            (row.noteTaVariants != null || row.noteTaRule != null) &&
            patch.value !== row.value
        ) {
            delete row.noteTaVariants;
            delete row.noteTaRule;
        }
        row.value = String(patch.value);
        row.modified = patch.modified ?? row.value !== defaultValue;
    } else if (patch.modified != null) {
        row.modified = patch.modified;
    }
    if (patch.enabled != null) {
        row.enabled = patch.enabled;
    }
    row.sourceValue = defaults.sourceValue;

    if (row.enabled && SINGLETON_ROLES.has(role)) {
        for (const other of rows) {
            if (other !== row && other.role === role && other.enabled) {
                other.enabled = false;
            }
        }
    }

    return row;
}

/** Reads separate regional overrides without modifying a source or role draft. */
export function getNameNoteTaVariants(
    form: NameForm,
    sourceId: string,
): Record<NameNoteTaVariant, NameNoteTaVariantDraft> {
    const sources = getNameSources(form);
    return getNoteTaVariantDrafts(
        form,
        sources,
        sourceId,
        getNameRole(form, sourceId, 'noteTa'),
    );
}

/** Reads one free-form rule while retaining regional maps from older drafts. */
export function getNameNoteTaRuleDraft(
    form: NameForm,
    sourceId: string,
): NameNoteTaVariantDraft {
    const sources = getNameSources(form);
    const role = getNameRole(form, sourceId, 'noteTa');
    const defaultValue = getDefaultNoteTaRuleValue(form, sources, sourceId);
    const value =
        role.noteTaRule ??
        (!role.modified
            ? ''
            : role.noteTaVariants != null
              ? formatNoteTaRule(
                    getEffectiveNoteTaValues(
                        getNoteTaVariantDrafts(form, sources, sourceId, role),
                    ),
                    parseNoteTaRule(role.value).other,
                )
              : getLegacyNoteTaRuleValue(form, role));
    return {
        value,
        defaultValue,
        effectiveValue: trimValue(value) || defaultValue,
    };
}

/** Stores raw rule text and keeps independent chronology for each changed clause. */
export function setNameNoteTaRule(
    form: NameForm,
    sourceId: string,
    value: string,
): NameRoleRow {
    syncNameRoles(form);
    const row = setNameRole(form, sourceId, 'noteTa', {});
    const sources = getNameSources(form);
    if (
        !sources.some((source) => source.id === sourceId) ||
        row.noteTaRule === value
    ) {
        return row;
    }
    const previousDrafts = getNoteTaVariantDrafts(form, sources, sourceId, row);
    const next = parseNoteTaRule(
        trimValue(value) || getDefaultNoteTaRuleValue(form, sources, sourceId),
    );
    const order = getNextNoteTaOrder(form);
    const overrides: NameNoteTaVariantOverrides = {};
    for (const variant of Object.keys(next.values) as NameNoteTaVariant[]) {
        const effectiveValue = trimValue(next.values[variant]);
        const unchanged =
            previousDrafts[variant]?.effectiveValue === effectiveValue;
        overrides[variant] = {
            value: trimValue(value) === '' ? '' : effectiveValue,
            order: unchanged
                ? (row.noteTaVariants?.[variant]?.order ?? 0)
                : order,
        };
    }
    row.noteTaRule = value;
    row.noteTaVariants = overrides;
    row.modified = trimValue(value) !== '';
    row.value = formatNoteTaRule(next.values, next.other);
    return row;
}

/** Changes only one regional field and persists its relative edit order. */
export function setNameNoteTaVariant(
    form: NameForm,
    sourceId: string,
    variant: NameNoteTaVariant,
    value: string,
): NameRoleRow {
    syncNameRoles(form);
    const row = setNameRole(form, sourceId, 'noteTa', {});
    if (!getNameSources(form).some((source) => source.id === sourceId)) {
        return row;
    }
    const drafts = getNameNoteTaVariants(form, sourceId);
    if (
        row.noteTaVariants?.[variant] != null &&
        drafts[variant].value === value
    ) {
        return row;
    }
    const overrides: NameNoteTaVariantOverrides = {
        ...row.noteTaVariants,
    };
    if (row.noteTaVariants == null && row.modified) {
        row.value = getLegacyNoteTaRuleValue(form, row);
        for (const key of Object.keys(drafts) as NameNoteTaVariant[]) {
            if (drafts[key].value !== '') {
                overrides[key] = { value: drafts[key].value, order: 0 };
            }
        }
    }
    const order = getNextNoteTaOrder(form);
    overrides[variant] = { value, order };
    row.noteTaVariants = overrides;
    delete row.noteTaRule;
    row.modified = Object.values(overrides).some(
        (entry) => trimValue(entry.value) !== '',
    );
    const next = getNoteTaVariantDrafts(
        form,
        getNameSources(form),
        sourceId,
        row,
    );
    row.value = formatNoteTaRule(
        getEffectiveNoteTaValues(next),
        parseNoteTaRule(row.value).other,
    );
    return row;
}

/** Combines managed regional name rules while preserving unrelated rule clauses. */
export function buildNameNoteTaConversionText(
    form: NameForm,
    officialRows: Array<Record<string, unknown>>,
): string | undefined {
    const sources = getNameSources(form);
    const roles = getRoleRows(form, sources).filter(
        (row) =>
            row.role === 'noteTa' && row.enabled && row.noteTaVariants != null,
    );
    if (roles.length === 0) {
        return form.noteTaNamesRemoved === true
            ? undefined
            : buildOfficialNameConversionText(officialRows);
    }
    const baseline = parseNoteTaRule(
        form.noteTaNamesRemoved === true
            ? ''
            : (buildOfficialNameConversionText(officialRows) ?? ''),
    );
    const values = { ...baseline.values };
    if (form.noteTaNamesRemoved !== true) {
        for (const variant of ['zh-cn', 'zh-tw'] as const) {
            values[variant] ??= trimValue(
                officialRows.find((row) => hasVariantMarket(row, variant))
                    ?.name,
            );
        }
    }
    const other = [...baseline.other];
    if (Array.isArray(form.noteTaRows)) {
        const reviewed = form.noteTaRows.find(
            (row) => isRecord(row) && row.source === 'names' && row.modified,
        );
        if (isRecord(reviewed)) {
            const reviewedRule = parseNoteTaRule(trimValue(reviewed.value));
            const previousRule = parseNoteTaRule(
                trimValue(reviewed.generatedValue),
            );
            other.push(...reviewedRule.other);
            for (const variant of Object.keys(
                reviewedRule.values,
            ) as NameNoteTaVariant[]) {
                if (!Object.hasOwn(previousRule.values, variant)) {
                    values[variant] = reviewedRule.values[variant];
                }
            }
        }
    }
    const orders: Partial<Record<NameNoteTaVariant, number>> = {};
    for (const role of roles) {
        const drafts = getNoteTaVariantDrafts(
            form,
            sources,
            role.sourceId,
            role,
        );
        const variants =
            role.noteTaRule != null && trimValue(role.noteTaRule) !== ''
                ? (Object.keys(
                      parseNoteTaRule(role.noteTaRule).values,
                  ) as NameNoteTaVariant[])
                : (Object.keys(drafts) as NameNoteTaVariant[]);
        for (const variant of variants) {
            const value = drafts[variant].effectiveValue;
            const order = role.noteTaVariants?.[variant]?.order ?? 0;
            if (value !== '' && order >= (orders[variant] ?? -1)) {
                values[variant] = value;
                orders[variant] = order;
            }
        }
        other.push(...parseNoteTaRule(role.value).other);
    }
    const value = formatNoteTaRule(values, [...new Set(other)]);
    return value === '' ? undefined : value;
}

/** Assigns stable source IDs and synchronizes only unchanged generated drafts. */
export function syncNameRoles(form: NameForm): void {
    const sources = getNameSources(form);
    const localized = getLocalizedNameRows(form);
    for (const source of sources) {
        if (source.kind !== 'localized' || source.index == null) {
            continue;
        }
        const row = localized[source.index];
        if (isRecord(row) && row.nameId !== source.id) {
            row.nameId = source.id;
        }
    }

    const received = Array.isArray(form.nameRoleRows) ? form.nameRoleRows : [];
    const normalized = getRoleRows(form, sources);
    const enabledSingletons = new Set<NameRole>();
    const next = normalized.map((row) => {
        const defaults = getDefaultNameRole(
            form,
            sources,
            row.sourceId,
            row.role,
        );
        row.sourceValue = defaults.sourceValue;
        if (row.noteTaVariants != null) {
            const variants = getNoteTaVariantDrafts(
                form,
                sources,
                row.sourceId,
                row,
            );
            row.value = formatNoteTaRule(
                getEffectiveNoteTaValues(variants),
                parseNoteTaRule(row.noteTaRule ?? row.value).other,
            );
        } else if (!row.modified) {
            row.value = defaults.value;
        }
        if (row.enabled && SINGLETON_ROLES.has(row.role)) {
            if (enabledSingletons.has(row.role)) {
                row.enabled = false;
            }
            enabledSingletons.add(row.role);
        }

        const current = received.find(
            (item) =>
                isRecord(item) &&
                item.sourceId === row.sourceId &&
                item.role === row.role,
        );
        if (!isRecord(current)) {
            return row;
        }
        if (row.noteTaVariants == null && current.noteTaVariants != null) {
            delete current.noteTaVariants;
        }
        if (row.noteTaRule == null && current.noteTaRule != null) {
            delete current.noteTaRule;
        }
        for (const [key, value] of Object.entries(row)) {
            if (current[key] !== value) {
                current[key] = value;
            }
        }
        return current;
    });

    if (!Array.isArray(form.nameRoleRows)) {
        form.nameRoleRows = next;
    } else if (
        next.length !== received.length ||
        next.some((row, index) => row !== received[index])
    ) {
        received.splice(0, received.length, ...next);
    }
}

/** Projects redirect choices without modifying source names or review rows. */
export function getNameRedirectTitles(form: NameForm): string[] {
    form = normalizeArticleFormInput(form);
    const sources = getNameSources(form);
    const ordered = [
        ...sources.filter((source) => source.kind === 'original'),
        ...sources.filter((source) => source.kind === 'english'),
        ...sources.filter((source) => source.kind === 'localized'),
    ];
    const candidates = ordered.flatMap((source) => {
        const row = getNameRole(form, source.id, 'redirect');
        return row.enabled ? splitRedirectTitles(row.value) : [];
    });
    const represented = new Set(
        sources.map((source) => normalizeTitleKey(source.name)),
    );
    if (Array.isArray(form.nameAliases)) {
        candidates.push(
            ...form.nameAliases
                .filter(isChineseName)
                .map((row) => trimValue(row.name))
                .filter((name) => !represented.has(normalizeTitleKey(name))),
        );
    }

    const seen = new Set<string>();
    return candidates.filter((title) => {
        const key = normalizeTitleKey(title);
        if (key === '' || seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/** Reads localized row objects while preserving their positional indexes. */
function getLocalizedNameRows(form: NameForm): Array<Record<string, unknown>> {
    return Array.isArray(form.localizedNames) ? form.localizedNames : [];
}

/** Normalizes valid explicit roles without mutating their persisted collection. */
function getRoleRows(form: NameForm, sources: NameSource[]): NameRoleRow[] {
    const sourceIds = new Set(sources.map((source) => source.id));
    const seen = new Set<string>();
    if (!Array.isArray(form.nameRoleRows)) {
        return [];
    }
    return form.nameRoleRows.flatMap((row) => {
        if (!isRecord(row) || !NAME_ROLES.includes(row.role as NameRole)) {
            return [];
        }
        const sourceId = trimValue(row.sourceId);
        const role = row.role as NameRole;
        const key = `${sourceId}:${role}`;
        if (!sourceIds.has(sourceId) || seen.has(key)) {
            return [];
        }
        seen.add(key);
        const defaults = getDefaultNameRole(form, sources, sourceId, role);
        const value = row.value == null ? defaults.value : String(row.value);
        const noteTaVariants =
            role === 'noteTa'
                ? normalizeNoteTaVariants(
                      row.noteTaVariants,
                      typeof row.noteTaRule === 'string',
                  )
                : undefined;
        return [
            {
                id: trimValue(row.id) || key,
                sourceId,
                role,
                value,
                enabled: row.enabled === true,
                sourceValue:
                    row.sourceValue == null
                        ? defaults.sourceValue
                        : String(row.sourceValue),
                modified: Object.hasOwn(row, 'modified')
                    ? row.modified === true
                    : value !== defaults.value,
                ...(noteTaVariants == null ? {} : { noteTaVariants }),
                ...(role === 'noteTa' && typeof row.noteTaRule === 'string'
                    ? { noteTaRule: row.noteTaRule }
                    : {}),
            },
        ];
    });
}

/** Builds disabled usage drafts and legacy automatic redirect defaults. */
function getDefaultNameRole(
    form: NameForm,
    sources: NameSource[],
    sourceId: string,
    role: NameRole,
): NameRoleRow {
    const source = sources.find((item) => item.id === sourceId);
    const name = source?.name ?? '';
    const localizedRow =
        source?.index == null
            ? undefined
            : getLocalizedNameRows(form)[source.index];
    let value = name;

    if (role === 'sortKey' && source?.kind === 'original') {
        const language =
            getOriginalName(form.originalName).language ||
            trimValue(form.originalLanguage) ||
            'ja';
        if (/^ja(?:-|$)/iu.test(language)) {
            value = '';
        }
    }
    if (role === 'noteTa') {
        value =
            source?.kind === 'localized' && localizedRow != null
                ? (buildOfficialNameConversionText([localizedRow]) ?? '')
                : '';
    }
    const legacyNameRule =
        role === 'noteTa' &&
        source?.kind === 'localized' &&
        localizedRow?.official === true
            ? buildOfficialNameConversionText(
                  getLocalizedNameRows(form).filter(
                      (row) => row?.official === true,
                  ),
              )
            : undefined;

    return {
        id: `${sourceId}:${role}`,
        sourceId,
        role,
        value,
        enabled:
            role === 'noteTa'
                ? legacyNameRule != null && form.noteTaNamesRemoved !== true
                : role === 'redirect' &&
                  name !== '' &&
                  (source?.kind !== 'localized' || isChineseName(localizedRow)),
        sourceValue: name,
        modified: false,
    };
}

/** Keeps valid saved override maps stable through reactive synchronization. */
function normalizeNoteTaVariants(
    value: unknown,
    retainEmpty = false,
): NameNoteTaVariantOverrides | undefined {
    if (!isRecord(value)) {
        return retainEmpty ? {} : undefined;
    }
    const normalized: NameNoteTaVariantOverrides = {};
    for (const key of Object.keys(value)) {
        const variant = normalizeNoteTaVariant(key);
        if (variant == null) continue;
        const entry = value[key];
        if (!isRecord(entry)) {
            continue;
        }
        normalized[variant] = {
            value: entry.value == null ? '' : String(entry.value),
            order:
                typeof entry.order === 'number' &&
                Number.isSafeInteger(entry.order) &&
                entry.order >= 0
                    ? entry.order
                    : 0,
        };
    }
    if (Object.keys(normalized).length === 0 && !retainEmpty) {
        return undefined;
    }
    if (
        Object.keys(value).length === Object.keys(normalized).length &&
        Object.entries(normalized).every(
            ([variant, entry]) =>
                isRecord(value[variant]) &&
                Object.keys(value[variant]).length === 2 &&
                value[variant].value === entry.value &&
                value[variant].order === entry.order,
        )
    ) {
        return value as NameNoteTaVariantOverrides;
    }
    return normalized;
}

/** Resolves each regional default independently, including imported full rules. */
function getNoteTaVariantDrafts(
    form: NameForm,
    sources: NameSource[],
    sourceId: string,
    role: NameRoleRow,
): Record<NameNoteTaVariant, NameNoteTaVariantDraft> {
    const source = sources.find((row) => row.id === sourceId);
    const localized =
        source?.kind === 'localized' && source.index != null
            ? getLocalizedNameRows(form)[source.index]
            : undefined;
    const raw =
        role.noteTaRule == null ? undefined : parseNoteTaRule(role.noteTaRule);
    const previous =
        role.noteTaVariants == null && role.modified
            ? parseNoteTaRule(getLegacyNoteTaRuleValue(form, role)).values
            : {};
    const result = {} as Record<NameNoteTaVariant, NameNoteTaVariantDraft>;
    const variants = new Set<NameNoteTaVariant>([
        'zh-cn',
        'zh-tw',
        ...(Object.keys(role.noteTaVariants ?? {}) as NameNoteTaVariant[]),
        ...(Object.keys(previous) as NameNoteTaVariant[]),
        ...(Object.keys(raw?.values ?? {}) as NameNoteTaVariant[]),
    ]);
    for (const variant of variants) {
        const defaultValue =
            localized != null &&
            (variant === 'zh-cn' || variant === 'zh-tw') &&
            hasVariantMarket(localized, variant)
                ? source!.name
                : '';
        const value =
            role.noteTaVariants?.[variant]?.value ?? previous[variant] ?? '';
        result[variant] = {
            value,
            defaultValue,
            effectiveValue:
                raw != null && trimValue(role.noteTaRule) !== ''
                    ? trimValue(raw.values[variant])
                    : trimValue(value) || defaultValue,
        };
    }
    return result;
}

/** Imports unchanged reviewed full rules before a regional field takes ownership. */
function getLegacyNoteTaRuleValue(form: NameForm, role: NameRoleRow): string {
    if (Array.isArray(form.noteTaRows)) {
        const reviewed = form.noteTaRows.find(
            (row) =>
                isRecord(row) &&
                row.source === `name-role:${role.sourceId}` &&
                row.modified === true &&
                row.generatedValue === role.value,
        );
        if (isRecord(reviewed)) return trimValue(reviewed.value);
    }
    return role.value;
}

/** Maps Simplified and Traditional market selections to the two name fields. */
function hasVariantMarket(
    row: Record<string, unknown>,
    variant: NameNoteTaVariant,
): boolean {
    const markets = variant === 'zh-cn' ? ['hans', 'cn'] : ['hant', 'tw', 'hk'];
    return markets.some(
        (market) =>
            row[market] === true ||
            (Array.isArray(row.markets) && row.markets.includes(market)),
    );
}

/** Recognizes regional aliases and retains clauses outside the managed fields. */
function parseNoteTaRule(value: string): {
    values: Partial<Record<NameNoteTaVariant, string>>;
    other: string[];
} {
    const values: Partial<Record<NameNoteTaVariant, string>> = {};
    const other: string[] = [];
    for (const entry of splitFieldValues(`${value};`)) {
        const match = entry.match(/^(zh(?:-[a-z]+)?)\s*:\s*(.*)$/isu);
        const variant =
            match == null ? undefined : normalizeNoteTaVariant(match[1]);
        if (match == null || variant == null) {
            if (trimValue(entry) !== '') other.push(trimValue(entry));
            continue;
        }
        values[variant] = trimValue(match[2]);
    }
    return { values, other };
}

/** Emits one managed name rule with other variant clauses kept in order. */
function formatNoteTaRule(
    values: Partial<Record<NameNoteTaVariant, string>>,
    other: string[],
): string {
    return [
        ...[
            ...new Set<NameNoteTaVariant>([
                'zh-cn',
                'zh-tw',
                ...(Object.keys(values) as NameNoteTaVariant[]),
            ]),
        ].flatMap((variant) => {
            const value = trimValue(values[variant]);
            return value === '' ? [] : [`${variant}:${value};`];
        }),
        ...other.map((entry) => `${entry};`),
    ].join(' ');
}

/** Recognizes supported Chinese codes and keeps the established script aliases. */
function normalizeNoteTaVariant(value: string): NameNoteTaVariant | undefined {
    const code = value.toLowerCase();
    if (code === 'zh-hans') return 'zh-cn';
    if (code === 'zh-hant') return 'zh-tw';
    return /^(?:zh|zh-(?:cn|tw|hk|sg|mo|my))$/u.test(code)
        ? (code as NameNoteTaVariant)
        : undefined;
}

/** Projects effective values without changing raw input or stored chronology. */
function getEffectiveNoteTaValues(
    drafts: Record<NameNoteTaVariant, NameNoteTaVariantDraft>,
): Partial<Record<NameNoteTaVariant, string>> {
    return Object.fromEntries(
        Object.entries(drafts).map(([variant, draft]) => [
            variant,
            draft.effectiveValue,
        ]),
    );
}

/** Gives single-region localized names the same defaults as the former fields. */
function getDefaultNoteTaRuleValue(
    form: NameForm,
    sources: NameSource[],
    sourceId: string,
): string {
    const role = getDefaultNameRole(form, sources, sourceId, 'noteTa');
    const parsed = parseNoteTaRule(role.value);
    const defaults = getEffectiveNoteTaValues(
        getNoteTaVariantDrafts(form, sources, sourceId, role),
    );
    return formatNoteTaRule({ ...defaults, ...parsed.values }, parsed.other);
}

/** Shares one increasing chronology across all source cards and regions. */
function getNextNoteTaOrder(form: NameForm): number {
    return (
        Math.max(
            0,
            ...(form.nameRoleRows as NameRoleRow[]).flatMap((role) =>
                Object.values(role.noteTaVariants ?? {}).map(
                    (entry) => entry.order,
                ),
            ),
        ) + 1
    );
}

/** Removes only a language-code prefix, preserving colons in real titles. */
function getOriginalName(value: unknown): { language: string; name: string } {
    const text = trimValue(value);
    const match = text.match(/^([a-z]{2,3}(?:-[a-z0-9]+)*):\s*(.*)$/iu);
    return match == null
        ? { language: '', name: text }
        : { language: match[1], name: trimValue(match[2]) };
}

/** Matches Chinese localized-name redirect eligibility. */
function isChineseName(row: unknown): boolean {
    if (!isRecord(row)) {
        return false;
    }
    return (
        ['hans', 'hant', 'cn', 'tw', 'hk'].some(
            (market) => row[market] === true,
        ) || /\p{Script=Han}/u.test(trimValue(row.name))
    );
}

/** Supports several redirect titles without splitting commas within one title. */
function splitRedirectTitles(value: string): string[] {
    const titles = hasFirstLevelFieldSeparator(value)
        ? splitFieldValues(value)
        : [trimValue(value)];
    return titles
        .map((title) => title.replace(/_/gu, ' ').trim())
        .filter(Boolean);
}

function normalizeTitleKey(value: string): string {
    return value.replace(/_/gu, ' ').trim().toLocaleLowerCase();
}
