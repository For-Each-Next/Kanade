/**
 * @file src/library/mediawiki-edit-box/contracts.ts
 * Purpose: Public editor contracts and narrow host-editor shapes.
 *
 * Table of contents:
 * 1. CodeMirrorEditor
 * 2. VisualEditorFragment
 * 3. VisualEditorScrollContainer
 * 4. VisualEditorSurface
 * 5. VisualEditorGlobal
 * 6. EditBox
 * 7. EditBoxBackend
 */

export interface CodeMirrorEditor {
    isActive?: boolean;
    focus?: () => void;
    surface?: VisualEditorSurface | null;
    textarea?: HTMLTextAreaElement | null;
    view?: {
        dispatch?: (transaction: {
            changes: { from: number; insert: string; to: number };
            scrollIntoView?: boolean;
            selection?: { anchor: number; head?: number };
        }) => void;
        focus?: () => void;
        scrollDOM?: {
            scrollLeft: number;
            scrollTop: number;
        };
        state?: {
            doc?: { length: number; toString(): string };
            selection?: {
                main?: {
                    anchor?: number;
                    from: number;
                    head?: number;
                    to: number;
                };
            };
        };
    };
}

export interface VisualEditorFragment {
    collapseToEnd(): VisualEditorFragment;
    expandLinearSelection(scope: 'root'): VisualEditorFragment;
    getSelection?(): {
        getRange(): { end: number; start: number };
    };
    insertContent(text: string): VisualEditorFragment;
    select(): VisualEditorFragment;
}

export interface VisualEditorScrollContainer {
    scrollLeft(): number;
    scrollLeft(value: number): unknown;
    scrollTop(): number;
    scrollTop(value: number): unknown;
}

export interface VisualEditorSurface {
    getDom(): string | Document;
    getMode(): string;
    getModel(): {
        getFragment(): VisualEditorFragment;
        getLinearFragment(
            range: unknown,
            noAutoSelect?: boolean,
        ): VisualEditorFragment;
        getRangeFromSourceOffsets(from: number, to?: number): unknown;
        getSourceOffsetFromOffset(offset: number): number;
    };
    getView(): {
        focus(): void;
        getSurface?(): {
            $scrollContainer?: VisualEditorScrollContainer;
        };
    };
}

export interface VisualEditorGlobal {
    Range: new (start: number, end?: number) => unknown;
    init?: {
        target?: {
            active?: boolean;
            getSurface?: () => VisualEditorSurface | null;
        };
    };
}

/** Editor-independent access to a MediaWiki source edit box. */
export interface EditBox {
    readonly element: HTMLTextAreaElement | null;
    focus(): void;
    read(): string;
    replaceSelection(text: string): void;
    write(text: string): void;
}

/** Operations supplied by an editor backed by a native textarea. */
export interface EditBoxBackend {
    focus(): void;
    read(): string;
    replaceSelection(text: string): void;
    write(text: string): void;
}
