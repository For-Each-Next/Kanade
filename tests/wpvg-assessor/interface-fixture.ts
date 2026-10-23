/**
 * @file tests/wpvg-assessor/interface-fixture.ts
 * Purpose: Load the application boundary with the browser build's text assets.
 * Contents: Offline esbuild fixture for startup and category-opening tests.
 */

import { build } from 'esbuild';
import type {
    initializePageAssessorRuntime as initializeRuntime,
    startPageAssessor as startApplication,
} from '../../src/wpvg-assessor/app/interface.ts';

const { outputFiles } = await build({
    entryPoints: ['src/wpvg-assessor/app/interface.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    loader: { '.css': 'text' },
    write: false,
});
const source = `${outputFiles[0].text}\n//# sourceURL=kanade-wpvg-assessor-interface-fixture.js`;
const application = (await import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
)) as {
    initializePageAssessorRuntime: typeof initializeRuntime;
    startPageAssessor: typeof startApplication;
};

export const { initializePageAssessorRuntime, startPageAssessor } = application;
