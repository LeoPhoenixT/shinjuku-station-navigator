import { defineConfig, devices } from '@playwright/test';

const localBrowser = process.platform === 'win32' ? { channel: 'chrome' as const } : {};

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/globalSetup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], ...localBrowser },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'], ...localBrowser },
    },
  ],
});
