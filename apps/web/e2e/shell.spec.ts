import { expect, test } from '@playwright/test';
import { mainNav, noHorizontalOverflow, watchErrors } from './helpers';

// The web-app frame (approved prototype, B22): four tabs (top bar on a computer, tab bar with icons on a phone).
const ROUTES = [
  { path: '/circles', label: 'Tổng quan' },
  { path: '/circles/demo', label: 'Dây' },
  { path: '/circles/demo/so-ho', label: 'Sổ hụi' },
  { path: '/circles/new', label: 'Dây mới' },
];

test.describe('shell: navigation on every route', () => {
  // The landing page (/) has its own navigation and no app frame: covered in home.spec.ts.
  for (const r of ROUTES) {
    test(`${r.path}: only "${r.label}" is the current page, the app fits one screen, no errors`, async ({ page }) => {
      const errs = watchErrors(page);
      await page.goto(r.path);
      const nav = mainNav(page);
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(nav.getByRole('link', { name: r.label, exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(page.getByTestId('demo-banner')).toBeVisible();
      await noHorizontalOverflow(page);
      // The frame is exactly one screen: the page itself never scrolls, only the area inside it.
      const extra = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
      expect(extra).toBeLessThanOrEqual(0);
      errs.expectClean();
    });
  }

  test('every tab goes where its label says, and Back / Forward work', async ({ page }) => {
    await page.goto('/circles/demo');
    const nav = mainNav(page);
    for (const r of ROUTES) {
      await nav.getByRole('link', { name: r.label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${r.path}$`));
    }
    await page.goBack();
    await expect(page).toHaveURL(/\/circles\/demo\/so-ho$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/circles\/demo$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/circles\/demo\/so-ho$/);
  });

  test('phone tab bar: an icon and a word for every tab', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'tab bar is the phone layout');
    await page.goto('/circles');
    const bar = page.getByRole('navigation', { name: 'Điều hướng chính (điện thoại)' });
    await expect(bar.getByRole('link')).toHaveCount(4);
    for (const r of ROUTES) await expect(bar.getByRole('link', { name: r.label, exact: true }).locator('svg')).toHaveCount(1);
  });

  test('settings and the tools behind it are one tap away', async ({ page }) => {
    await page.goto('/circles');
    await page.getByRole('link', { name: 'Cài đặt và công cụ khác' }).click();
    await expect(page).toHaveURL(/\/cai-dat$/);
  });

  test('logo goes home; skip link jumps to the main content', async ({ page }) => {
    await page.goto('/circles');
    await page.goto('/circles/new');
    await page.getByRole('link', { name: 'HụiSafe, tổng quan' }).click();
    await expect(page).toHaveURL(/\/circles$/);
    await page.goto('/circles'); // fresh load: the first Tab stop is the skip link
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Bỏ qua, đến nội dung chính' });
    await expect(skip).toBeFocused();
    await skip.press('Enter');
    await expect(page).toHaveURL(/#noi-dung$/);
  });

  test('unknown address shows a Vietnamese 404 with a way out', async ({ page }) => {
    const res = await page.goto('/khong-co-trang-nay');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Không tìm thấy trang này' })).toBeVisible();
    await page.getByRole('link', { name: 'Về trang chủ', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    expect((await page.goto('/circles/khong-co'))?.status()).toBe(404);
  });
});
