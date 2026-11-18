import fs from 'node:fs';
import { defineConfig } from '@playwright/test';

const localChromePath =
  '/home/kurixutian/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

export default defineConfig({
  testDir: './tests',
  testMatch: 'e2e.spec.ts',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
    ...(fs.existsSync(localChromePath)
      ? { launchOptions: { executablePath: localChromePath } }
      : {}),
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      use: { viewport: { width: 375, height: 667 } },
    },
  ],
});
