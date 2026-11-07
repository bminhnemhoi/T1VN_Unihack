import { expect, test } from '@playwright/test';
import { mainNav, noHorizontalOverflow, watchErrors } from './helpers';

const ROUTES = [
  { path: '/', label: 'Trang chủ' },
  { path: '/circles', label: 'Dây của tôi' },
  { path: '/circles/new', label: 'Tạo dây' },
  { path: '/circles/demo', label: 'Phòng thăm' },
];

test.describe('shell: navigation on every route', () => {
  for (const r of ROUTES) {
    test(`${r.path}: only "${r.label}" is the current page, nothing overflows, no errors`, async ({ page }) => {
      const errs = watchErrors(page);
      await page.goto(r.path);
      const nav = mainNav(page);
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(nav.getByRole('link', { name: r.label, exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(page.getByRole('status').filter({ hasText: 'CHẾ ĐỘ DEMO' })).toBeVisible();
      await noHorizontalOverflow(page);
      errs.expectClean();
    });
  }

  test('every nav link goes where its label says, and Back / Forward work', async ({ page }) => {
    await page.goto('/');
    const nav = mainNav(page);
    for (const r of ROUTES.slice(1)) {
      await nav.getByRole('link', { name: r.label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${r.path}$`));
    }
    await page.goBack();
    await expect(page).toHaveURL(/\/circles\/new$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/circles$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/circles\/new$/);
  });

  test('logo goes home; skip link jumps to the main content', async ({ page }) => {
    await page.goto('/circles');
    await page.getByRole('link', { name: 'HụiSafe, về trang chủ' }).click();
    await expect(page).toHaveURL(/\/$/);
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

  test('footer links work', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('navigation', { name: 'Liên kết chân trang' });
    for (const r of ROUTES) {
      await footer.getByRole('link', { name: r.label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${r.path === '/' ? '/$' : r.path + '$'}`));
    }
  });
});
