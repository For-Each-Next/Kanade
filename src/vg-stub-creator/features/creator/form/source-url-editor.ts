/**
 * @file src/vg-stub-creator/features/creator/form/source-url-editor.ts
 * Purpose: Owns URL entry drafts and plain source lists without changing persisted source fields.
 * Contents: Source entry contracts, completion, safe links, and repeated-row focus.
 */

import { splitSourceUrls, trimValue } from '../../../domain/wikitext/index.ts';

interface Dependencies {
    reactive: (value: Record<string, string>) => Record<string, string>;
    nextTick: (callback: () => void) => unknown;
    read: (key: string) => string | undefined;
    write: (key: string, value: string) => void;
    onComplete?: () => void;
}

interface EntrySnapshot {
    urls: string[];
    writtenValue: string;
}

/** Keeps one dialog's source lists and unfinished entry values together. */
export function createSourceUrlEditor(dependencies: Dependencies) {
    let disposed = false;
    let lifecycle = 0;
    const entries = new Map<string, EntrySnapshot>();
    const sourceEntryValues = dependencies.reactive({});

    /** Drops a draft when its source owner has been removed or replaced. */
    function readEntry(key: string): EntrySnapshot | undefined {
        const entry = entries.get(key);
        if (
            entry &&
            trimValue(dependencies.read(key)) !== trimValue(entry.writtenValue)
        ) {
            entries.delete(key);
            delete sourceEntryValues[key];
            return undefined;
        }
        return entry;
    }

    /** Retains unfinished typing in the existing history and recovery field. */
    function writeEntry(key: string, entry: EntrySnapshot): void {
        entry.writtenValue = [...entry.urls, sourceEntryValues[key] || '']
            .filter(Boolean)
            .join('\n');
        dependencies.write(key, entry.writtenValue);
    }

    const methods = {
        /** Lists each saved source once while unfinished text stays in its input. */
        getSourceUrls(key: string): string[] {
            const entry = readEntry(key);
            return [
                ...new Set(
                    entry?.urls ?? splitSourceUrls(dependencies.read(key)),
                ),
            ];
        },

        /** Restricts clickable source links to absolute HTTP(S) URLs. */
        getSourceUrlHref(value: string): string | undefined {
            const url = trimValue(value);
            if (!/^https?:\/\/\S+$/iu.test(url)) return undefined;
            try {
                const parsed = new URL(url);
                return ['http:', 'https:'].includes(parsed.protocol)
                    ? parsed.href
                    : undefined;
            } catch (_error) {
                return undefined;
            }
        },

        /** Keeps the in-progress value in the form without adding a displayed row. */
        updateSourceEntry(key: string, value: string): void {
            if (disposed || dependencies.read(key) === undefined) return;
            const entry = readEntry(key) ?? {
                urls: methods.getSourceUrls(key),
                writtenValue: '',
            };
            entries.set(key, entry);
            sourceEntryValues[key] = value;
            writeEntry(key, entry);
        },

        /** Completes pasted, blurred, or Enter-submitted text without intercepting IME. */
        commitSourceEntry(key: string, event?: KeyboardEvent): void {
            if (disposed || event?.isComposing || event?.keyCode === 229)
                return;
            event?.preventDefault();
            const entry = readEntry(key);
            if (!entry || dependencies.read(key) === undefined) return;
            const urls = [
                ...new Set([
                    ...entry.urls,
                    ...splitSourceUrls(sourceEntryValues[key]),
                ]),
            ];
            entries.delete(key);
            sourceEntryValues[key] = '';
            dependencies.write(key, urls.join('\n'));
            dependencies.onComplete?.();
        },

        /** Applies clipboard text at the current selection before completing it. */
        pasteSourceEntry(key: string, event: ClipboardEvent): void {
            if (disposed || dependencies.read(key) === undefined) return;
            const pasted = event.clipboardData?.getData('text/plain');
            if (!pasted) return;
            const input = event.target as HTMLInputElement | null;
            const value = sourceEntryValues[key] || '';
            const start = input?.selectionStart ?? value.length;
            const end = input?.selectionEnd ?? start;
            event.preventDefault();
            methods.updateSourceEntry(
                key,
                value.slice(0, start) + pasted + value.slice(end),
            );
            methods.commitSourceEntry(key);
        },

        /** Removes only the chosen URL and restores the collection's keyboard focus. */
        removeSourceUrl(key: string, url: string, event?: Event): void {
            if (disposed || dependencies.read(key) === undefined) return;
            const button = event?.currentTarget as HTMLElement | null;
            const wrapper = button?.closest<HTMLElement>(
                '[data-kanade-vg-stub-creator-source-input]',
            );
            const rows = wrapper
                ? [
                      ...wrapper.querySelectorAll(
                          '[data-kanade-vg-stub-creator-source-url]',
                      ),
                  ]
                : [];
            const row = button?.closest(
                '[data-kanade-vg-stub-creator-source-url]',
            );
            const index = row ? rows.indexOf(row) : -1;
            const urls = methods
                .getSourceUrls(key)
                .filter((value) => value !== url);
            const entry = readEntry(key);
            if (entry) {
                entry.urls = urls;
                writeEntry(key, entry);
            } else {
                dependencies.write(key, urls.join('\n'));
            }
            dependencies.onComplete?.();
            if (!wrapper || index < 0) return;
            const owner = lifecycle;
            dependencies.nextTick(() => {
                if (
                    disposed ||
                    lifecycle !== owner ||
                    !wrapper.isConnected ||
                    dependencies.read(key) === undefined
                )
                    return;
                const remaining = wrapper.querySelectorAll<HTMLElement>(
                    '[data-kanade-vg-stub-creator-source-url]',
                );
                const next = remaining[index] ?? remaining[index - 1];
                const target =
                    next?.querySelector<HTMLButtonElement>('button') ??
                    wrapper.querySelector<HTMLInputElement>('input');
                target?.focus();
            });
        },
    };

    function reset(): void {
        lifecycle += 1;
        entries.clear();
        for (const key of Object.keys(sourceEntryValues))
            delete sourceEntryValues[key];
    }

    return {
        methods,
        state: { sourceEntryValues },
        hasPendingEntries(): boolean {
            return [...entries.keys()].some(
                (key) => readEntry(key) && trimValue(sourceEntryValues[key]),
            );
        },
        reset,
        dispose(): void {
            disposed = true;
            reset();
        },
    };
}
