import path from 'node:path';
import { defineConfig } from '@playwright/test';

// Chain mode: a build that reads a deployment (`HUISAFE_DEPLOYMENTS_DIR` points at a MOCK `fuji.json`), the case where
// `/circles/demo` is a 404. It uses its own build folder (`NEXT_DIST_DIR=.next-chain`) so it never overwrites the sample-data
// build of the main config. The RPC is a dead local port, so this run never calls Fuji. `E2E_SKIP_BUILD=1` reuses the build.
const PORT = Number(process.env.E2E_CHAIN_PORT ?? 3102);
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
const CHAIN_ENV = {
  HUISAFE_DEPLOYMENTS_DIR: path.resolve(__dirname, 'e2e-chain/deployments'),
  HUISAFE_NETWORK: 'fuji',
  FUJI_RPC_URL: 'http://127.0.0.1:9',
  NEXT_PUBLIC_HUISAFE_DEMO: 'false',
  NEXT_DIST_DIR: '.next-chain',
};
const START = `pnpm exec next start -p ${PORT}`;

export default defineConfig({
  testDir: './e2e-chain',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
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
    env: CHAIN_ENV,
    reuseExistingServer: false,
    timeout: 360_000,
  },
});
