import path from 'node:path';
import { defineConfig } from '@playwright/test';

// Runs against the PRODUCTION build (`next build && next start`), the same bundle that will be deployed.
// The tests describe the SAMPLE-DATA screens, so the server always runs with no deployment: `HUISAFE_DEPLOYMENTS_DIR` points at
// an empty folder, which hides `contracts/deployments/fuji.json` (the real Fuji deploy) without moving or editing it. The layout
// bakes the chain config in at build time, so the build must see the same variable: the web server command builds first.
// `E2E_SKIP_BUILD=1` reuses an existing sample-mode build (`pnpm test:e2e:run`). On machines without Playwright's own browser,
// point PW_CHROMIUM_PATH at a system Chromium.
const PORT = Number(process.env.E2E_PORT ?? 3101);
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

const SAMPLE_ENV = { HUISAFE_DEPLOYMENTS_DIR: path.resolve(__dirname, 'e2e/sample-deployments'), HUISAFE_NETWORK: 'fuji', NEXT_PUBLIC_HUISAFE_DEMO: 'false' };
const START = `pnpm exec next start -p ${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath, args: ['--no-sandbox'] },
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  },
  projects: [
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD ? START : `pnpm exec next build && ${START}`,
    url: `http://localhost:${PORT}`,
    env: SAMPLE_ENV,
    reuseExistingServer: !process.env.CI,
    timeout: 360_000,
  },
});
