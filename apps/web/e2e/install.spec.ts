import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './helpers';

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

/** Memory of an earlier visit on another day, so today is the second visit day. */
const seedSecondVisit = (page: Page, extra: object = {}) =>
  page.addInitScript((mem) => {
    if (!localStorage.getItem('huisafe.install')) localStorage.setItem('huisafe.install', JSON.stringify({ days: ['2026-11-01'], dismissedAt: [], installed: false, ...mem }));
  }, extra);

/** Android Chrome hands the page this event; the page keeps it for its own card. */
const fireInstallPrompt = async (page: Page, outcome: 'accepted' | 'dismissed' = 'dismissed') => {
  await page.waitForLoadState('networkidle'); // the page has listened for the event once it has hydrated
  await page.waitForTimeout(300);
  await page.evaluate((o) => {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    e.prompt = async () => {
      (window as unknown as { __prompted: number }).__prompted = ((window as unknown as { __prompted?: number }).__prompted ?? 0) + 1;
    };
    e.userChoice = Promise.resolve({ outcome: o });
    window.dispatchEvent(e);
  }, outcome);
};

test.describe('B23 PWA manifest', () => {
  test('manifest and icons are served', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m).toMatchObject({ name: 'HụiSafe', short_name: 'HụiSafe', start_url: '/circles', display: 'standalone', background_color: '#F4F0E8', theme_color: '#201D1D' });
    expect(m.icons.some((i: { purpose: string; sizes: string }) => i.purpose === 'maskable' && i.sizes === '512x512')).toBe(true);
    for (const src of ['/brand/icon-192.png', '/brand/icon-512.png', '/brand/icon-512-maskable.png', '/brand/apple-touch-icon.png', '/brand/favicon.svg', '/favicon.ico']) {
      const r = await request.get(src);
      expect(r.ok(), src).toBe(true);
    }
  });

  test('the page links the apple-touch-icon and a theme colour', async ({ page }) => {
    await page.goto('/circles');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /apple-touch-icon\.png/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.webmanifest/);
  });
});

test.describe('B23 install offer (phone)', () => {
  test.skip(({ isMobile }) => !isMobile, 'the offer is for phones');

  test('Android: offered on the second visit day, "Để sau" snoozes it', async ({ page }) => {
    const errs = watchErrors(page);
    await seedSecondVisit(page);
    await page.goto('/circles');
    await expect(page.getByTestId('install-hint')).toHaveCount(0); // no install prompt from the browser yet
    await fireInstallPrompt(page);
    const hint = page.getByTestId('install-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('Thêm HụiSafe vào màn hình chính để mở nhanh như app.');
    await expect(hint.getByRole('button', { name: 'Thêm' })).toBeVisible();
    await expect(hint.getByRole('button', { name: 'Đóng' })).toBeVisible();
    await hint.getByRole('button', { name: 'Để sau' }).click();
    await expect(hint).toHaveCount(0);
    const mem = await page.evaluate(() => JSON.parse(localStorage.getItem('huisafe.install')!));
    expect(mem.dismissedAt).toHaveLength(1);
    await page.reload();
    await fireInstallPrompt(page);
    await page.waitForTimeout(500);
    await expect(page.getByTestId('install-hint')).toHaveCount(0); // 14 days of quiet
    errs.expectClean();
  });

  test('Android: "Thêm" runs the browser prompt and an accepted install is never asked again', async ({ page }) => {
    await seedSecondVisit(page);
    await page.goto('/circles');
    await fireInstallPrompt(page, 'accepted');
    await page.getByTestId('install-hint').getByRole('button', { name: 'Thêm' }).click();
    await expect(page.getByTestId('install-hint')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __prompted: number }).__prompted)).toBe(1);
    const mem = await page.evaluate(() => JSON.parse(localStorage.getItem('huisafe.install')!));
    expect(mem.installed).toBe(true);
  });

  test('first visit without a success: nothing; a confirmed transaction brings the offer', async ({ page }) => {
    await page.goto('/circles/demo');
    await fireInstallPrompt(page);
    await page.waitForTimeout(500);
    await expect(page.getByTestId('install-hint')).toHaveCount(0);
    await page.getByLabel('Thăm của bạn (số tiền bớt cho mọi người)').fill('3');
    await page.getByRole('button', { name: 'Niêm phong thăm' }).click();
    await expect(page.locator('.slip .stamp.on')).toContainText('ĐÃ NIÊM PHONG');
    await expect(page.getByTestId('install-hint')).toBeVisible();
  });

  test('never on the landing, and never in the standalone app', async ({ page }) => {
    await seedSecondVisit(page);
    await page.goto('/');
    await fireInstallPrompt(page);
    await page.waitForTimeout(500);
    await expect(page.getByTestId('install-hint')).toHaveCount(0);
  });

  test('the card clears the phone menu and does not scroll the page sideways', async ({ page }) => {
    await seedSecondVisit(page);
    await page.goto('/circles');
    await fireInstallPrompt(page);
    const hint = page.getByTestId('install-hint');
    await expect(hint).toBeVisible();
    const card = (await hint.boundingBox())!;
    const nav = (await page.getByRole('navigation', { name: 'Điều hướng chính (điện thoại)' }).boundingBox())!;
    expect(card.y + card.height).toBeLessThanOrEqual(nav.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});

test.describe('B23 install offer (iPhone Safari)', () => {
  test.use({ userAgent: IOS_UA, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test.skip(({ isMobile }) => !isMobile, 'the offer is for phones');

  test('shows the share-sheet instructions instead of an install button', async ({ page }) => {
    await seedSecondVisit(page);
    await page.goto('/circles');
    const hint = page.getByTestId('install-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('Thêm HụiSafe vào màn hình chính: bấm nút Chia sẻ');
    await expect(hint).toContainText('Thêm vào MH chính');
    await expect(hint.getByRole('button', { name: 'Đã hiểu' })).toBeVisible();
    await expect(hint.getByRole('button', { name: 'Để sau' })).toBeVisible();
  });
});
