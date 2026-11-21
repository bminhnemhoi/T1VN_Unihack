import { expect, test } from '@playwright/test';

/**
 * B19: with a real deployment loaded the sample room `/circles/demo` does not exist, so nothing in the shell may link to it
 * (a link in view is prefetched by `next start`, and a 404 there shows up in the console of every page). This runs against a
 * chain-mode build with a MOCK deployment and a dead RPC; see playwright.chain.config.ts.
 */
const PAGES = ['/', '/circles', '/circles/new', '/cai-dat', '/thong-bao-ubnd'];

test('no page of the chain-mode build answers 404 to its own menu, footer or prefetch', async ({ page }) => {
  const bad: string[] = [];
  page.on('response', (r) => {
    if (r.url().startsWith('http://localhost') && r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
  });
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    // prefetch of footer links happens when they scroll into view
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

test('the menu has no sample room in chain mode (header, bottom bar, footer) and nothing points at /circles/demo', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('a[href="/circles/demo"]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Phòng thăm', exact: true })).toHaveCount(0);
  }
  // The app frame (B22) has four tabs on every width: Tổng quan, Dây, Sổ hụi, Dây mới. None of them is the sample room.
  await page.goto('/circles');
  const nav = page.getByRole('navigation', { name: /^Điều hướng chính/ });
  await expect(nav.getByRole('link')).toHaveCount(4);
  for (const name of ['Tổng quan', 'Dây', 'Sổ hụi', 'Dây mới']) await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
});

test('settings: without a wallet it asks to log in instead of showing a copy button that has nothing to copy', async ({ page }) => {
  await page.goto('/cai-dat');
  await expect(page.getByRole('heading', { name: 'Địa chỉ ví của bạn' })).toBeVisible();
  await expect(page.getByText('Hãy đăng nhập để thấy địa chỉ ví của bạn.')).toBeVisible();
  await expect(page.getByTestId('copy-address')).toHaveCount(0);
});
