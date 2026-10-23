/**
 * @file playwright.config.ts
 * Purpose: Run offline browser scenarios against every interactive tool.
 * Contents: Test discovery, Chromium settings, and the local fixture server.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    testMatch: '**/ui/*.spec.ts',
    timeout: 30_000,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: 2,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4176',
        serviceWorkers: 'block',
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE == null
            ? {}
            : {
                  launchOptions: {
                      executablePath:
                          process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
                  },
              }),
    },
    webServer: {
        command: 'node tests/wpvg-assessor/ui/server.mjs',
        url: 'http://127.0.0.1:4176/tests/ui/index.html',
        reuseExistingServer: !process.env.CI,
    },
});
