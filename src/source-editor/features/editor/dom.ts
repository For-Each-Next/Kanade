/**
 * @file src/source-editor/features/editor/dom.ts
 * Purpose: Source text and selection operations for the editable DOM.
 *
 * Table of contents:
 * 1. eventElement
 * 2. readEditableText
 * 3. readNodeText
 * 4. isEditableLine
 * 5. getSelectionOffsets
 * 6. measureOffset
 * 7. setSelectionOffsets
 * 8. findTextPoint
 * 9. collectTextNodes
 * 10. restoreAttribute
 */

export function eventElement(target: EventTarget | null): Element | null {
    if (target == null || !('nodeType' in target)) {
        return null;
    }
    const node = target as Node;
    return node.nodeType === 1 ? (node as Element) : node.parentElement;
}

export function readEditableText(
    editor: HTMLElement,
    options: { preserveTerminalCaretPlaceholder?: boolean } = {},
): string {
    return readNodeText(
        editor,
        undefined,
        options.preserveTerminalCaretPlaceholder ?? false,
    );
}

function readNodeText(
    node: Node,
    end?: { node: Node; offset: number },
    preserveTerminalCaretPlaceholder = false,
): string {
    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue ?? '';
        // Chromium may add a final newline node solely to hold the caret.
        if (
            !preserveTerminalCaretPlaceholder &&
            text === '\n' &&
            node.nextSibling == null &&
            node.previousSibling?.nodeType === Node.TEXT_NODE &&
            node.previousSibling.nodeValue?.endsWith('\n')
        ) {
            return '';
        }
        return node === end?.node ? text.slice(0, end.offset) : text;
    }
    if (node.nodeName === 'BR') {
        if (preserveTerminalCaretPlaceholder) return '\n';
        // A final BR makes the empty last line editable without adding source.
        return node.nextSibling == null || isEditableLine(node.nextSibling)
            ? ''
            : '\n';
    }
    let text = '';
    const children = [...node.childNodes];
    const limit = node === end?.node ? end.offset : children.length;
    for (let index = 0; index < limit; index++) {
        const child = children[index];
        if (
            index > 0 &&
            (isEditableLine(children[index - 1]) ||
                (isEditableLine(child) && !text.endsWith('\n')))
        ) {
            text += '\n';
        }
        text += readNodeText(child, end, preserveTerminalCaretPlaceholder);
        if (end != null && child.contains(end.node)) break;
    }
    return text;
}

function isEditableLine(node: Node): boolean {
    return node.nodeName === 'DIV' || node.nodeName === 'P';
}

export function getSelectionOffsets(
    editor: HTMLElement,
    fallback = { end: 0, start: 0 },
): {
    end: number;
    start: number;
} {
    const selection = editor.ownerDocument.getSelection();
    if (selection == null || selection.rangeCount === 0) {
        return fallback;
    }
    const range = selection.getRangeAt(0);
    if (
        !editor.contains(range.startContainer) ||
        !editor.contains(range.endContainer)
    ) {
        return fallback;
    }
    return {
        end: measureOffset(editor, range.endContainer, range.endOffset),
        start: measureOffset(editor, range.startContainer, range.startOffset),
    };
}

function measureOffset(root: Node, node: Node, offset: number): number {
    return readNodeText(root, { node, offset }).length;
}

export function setSelectionOffsets(
    editor: HTMLElement,
    start: number,
    end: number,
): void {
    const range = editor.ownerDocument.createRange();
    const startPoint = findTextPoint(editor, start);
    const endPoint = findTextPoint(editor, end);
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    const selection = editor.ownerDocument.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
}

function findTextPoint(
    root: Node,
    requested: number,
): { node: Node; offset: number } {
    let remaining = Math.max(0, requested);
    const textNodes = collectTextNodes(root);
    for (const node of textNodes) {
        const length = node.nodeValue?.length ?? 0;
        if (remaining <= length) {
            return { node, offset: remaining };
        }
        remaining -= length;
    }
    const last = textNodes.at(-1) ?? root;
    return { node: last, offset: last.nodeValue?.length ?? 0 };
}

function collectTextNodes(root: Node): Node[] {
    const nodes: Node[] = [];
    for (const child of root.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            nodes.push(child);
        } else {
            nodes.push(...collectTextNodes(child));
        }
    }
    return nodes;
}

export function restoreAttribute(
    element: HTMLElement,
    name: string,
    value: string | null,
): void {
    if (value == null) {
        element.removeAttribute(name);
        return;
    }
    element.setAttribute(name, value);
}
