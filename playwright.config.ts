import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    headless: false, // We want to SEE the test running
    viewport: { width: 1400, height: 900 },
    video: 'on', // Record video of the test
    screenshot: 'on',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 30000,
  },
  projects: [
    {
      name: 'Player 1',
      use: { storageState: undefined },
    },
  ],
});
