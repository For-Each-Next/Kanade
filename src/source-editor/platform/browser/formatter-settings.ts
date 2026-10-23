/**
 * @file src/source-editor/platform/browser/formatter-settings.ts
 * Purpose: Versioned browser-local persistence for shared Source Editor preferences.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. SettingsStorage
 * 4. createFormatterSettingsStore
 * 5. loadStoredFormatterSettings
 * 6. getLocalStorage
 */

import {
    createDefaultFormatterSettings,
    type FormatterSettings,
    parseFormatterSettings,
} from '../../domain/formatter-settings.ts';
import type { FormatterSettingsStore } from '../../app/service-ports.ts';

export const FORMATTER_SETTINGS_STORAGE_KEY =
    'kanade:source-editor:formatter-settings:v1';
export const FORMATTER_SETTINGS_SCHEMA_VERSION = 1;

type SettingsStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

/** Creates a formatter-settings store backed by browser storage. */
export function createFormatterSettingsStore(
    getStorage: () => SettingsStorage | undefined = getLocalStorage,
): FormatterSettingsStore {
    return {
        clear() {
            const storage = getStorage();
            if (storage == null) {
                throw new Error('Local storage is unavailable.');
            }
            storage.removeItem(FORMATTER_SETTINGS_STORAGE_KEY);
        },
        load() {
            try {
                return loadStoredFormatterSettings(getStorage());
            } catch {
                return createDefaultFormatterSettings();
            }
        },
        save(settings) {
            const validated = parseFormatterSettings(settings);
            if (validated == null) {
                throw new TypeError('Formatter settings are invalid.');
            }
            const storage = getStorage();
            if (storage == null) {
                throw new Error('Local storage is unavailable.');
            }
            storage.setItem(
                FORMATTER_SETTINGS_STORAGE_KEY,
                JSON.stringify({
                    schemaVersion: FORMATTER_SETTINGS_SCHEMA_VERSION,
                    settings: validated,
                }),
            );
        },
    };
}

function loadStoredFormatterSettings(
    storage: SettingsStorage | undefined,
): FormatterSettings {
    const serialized = storage?.getItem(FORMATTER_SETTINGS_STORAGE_KEY);
    if (serialized == null) return createDefaultFormatterSettings();
    const value: unknown = JSON.parse(serialized);
    if (
        typeof value === 'object' &&
        value !== null &&
        'schemaVersion' in value
    ) {
        return value.schemaVersion === FORMATTER_SETTINGS_SCHEMA_VERSION &&
            'settings' in value
            ? (parseFormatterSettings(value.settings) ??
                  createDefaultFormatterSettings())
            : createDefaultFormatterSettings();
    }
    return createDefaultFormatterSettings();
}

function getLocalStorage(): Storage | undefined {
    try {
        return typeof localStorage === 'undefined' ? undefined : localStorage;
    } catch {
        return undefined;
    }
}
