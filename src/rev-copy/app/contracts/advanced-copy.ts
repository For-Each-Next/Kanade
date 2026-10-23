/**
 * @file src/rev-copy/app/contracts/advanced-copy.ts
 * Purpose: Host runtime required by advanced-copy presentation.
 * Contents: Rendering, settled updates, and local component requirements.
 */

export interface CodexRuntime {
    h(
        component: unknown,
        props?: Record<string, unknown> | null,
        children?: unknown,
    ): unknown;
    render(node: unknown, container: Element): void;
    nextTick(): Promise<void>;
    components: Record<string, unknown>;
}
