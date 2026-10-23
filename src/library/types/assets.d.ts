/**
 * @file src/library/types/assets.d.ts
 * Purpose: Declare the shared build contract for stylesheet imports.
 * Contents: CSS assets loaded as text by the root browser build.
 */

declare module '*.css' {
    const content: string;
    export default content;
}
