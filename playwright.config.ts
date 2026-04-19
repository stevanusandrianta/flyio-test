import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  // Start the local server automatically unless BASE_URL is set (e.g. CI against prod)
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        cwd: 'server',
        url: 'http://localhost:3001',
        reuseExistingServer: true,
        timeout: 15_000,
      },
});
