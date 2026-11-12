import { defineConfig, devices } from '@playwright/test';

import { ADMIN_PASSWORD, SESSION_SECRET, WEBHOOK_SECRET } from './tests/e2e/auth-constants';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // Baselines are committed for Linux, the CI platform (D61).
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 1,
  workers: 2,
  timeout: 60_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: 'stack.perf.spec.ts',
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: 'stack.perf.spec.ts',
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testIgnore: 'stack.perf.spec.ts',
    },
    {
      // Cross-browser smoke (D61): the public specs only; the admin and the
      // visual baselines stay on the projects above.
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: [
        'shell.spec.ts',
        'projects.spec.ts',
        'terminal.spec.ts',
        'window.spec.ts',
        'stack.spec.ts',
        'timeline.spec.ts',
        'security.spec.ts',
        'a11y.spec.ts',
      ],
    },
    {
      name: 'perf',
      dependencies: ['chromium', 'webkit', 'mobile'],
      use: {
        ...devices['Desktop Chrome'],
        trace: 'off',
        video: 'off',
        screenshot: 'off',
      },
      testMatch: 'stack.perf.spec.ts',
    },
  ],
  webServer: {
    command: `bun run start -p ${PORT}`,
    url: `${baseURL}/en`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      CONTENT_SOURCE: 'fixtures',
      ADMIN_PASSWORD,
      SESSION_SECRET,
      ADMIN_FIXTURE_WRITES: '1',
      SANITY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    },
  },
});
