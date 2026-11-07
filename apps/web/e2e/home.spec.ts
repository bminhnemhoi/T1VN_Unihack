import { expect, test } from '@playwright/test';
import { toast, watchErrors } from './helpers';

test.describe('S01 /', () => {
  test('login button answers at once instead of doing nothing', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByRole('button', { name: 'Đăng nhập bằng Google hoặc email' });
    await expect(btn).toBeEnabled();
    await btn.click();
    await expect(toast(page, 'Đăng nhập bằng Google hoặc email sẽ có khi nối ví')).toBeVisible();
    await page.getByRole('button', { name: 'Đóng thông báo' }).click();
    await expect(toast(page, 'sẽ có khi nối ví')).toHaveCount(0);
  });

  test('hero CTAs and closing CTAs navigate to the right screens', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Xem thử màn hình mẫu' }).click();
    await expect(page).toHaveURL(/\/circles$/);
    await page.goto('/');
    await page.getByRole('link', { name: 'Tạo dây thử' }).click();
    await expect(page).toHaveURL(/\/circles\/new$/);
    await page.goto('/');
    await page.getByRole('link', { name: 'Xem phòng bỏ thăm mẫu' }).click();
    await expect(page).toHaveURL(/\/circles\/demo$/);
  });

  test('coverage meter: slider moves the number, the words and the 50% rule together', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/');
    const slider = page.getByRole('slider', { name: /Ký quỹ của chủ hụi/ });
    const meter = page.getByRole('meter', { name: 'Chỉ số bảo chứng của dây mẫu' });
    // docs/03 section 8: N=5, C=100, alpha 20%, bond 480 -> 100%
    await expect(meter).toHaveAttribute('aria-valuenow', '100');
    await expect(page.getByText('Đủ để bắt đầu dây.')).toBeVisible();
    await slider.focus();
    await slider.press('Home');
    await expect(meter).toHaveAttribute('aria-valuenow', '20');
    await expect(page.getByText(/Chưa đủ để bắt đầu dây\. Cần thêm/)).toBeVisible();
    await expect(page.getByText('0 USDC', { exact: true }).first()).toBeVisible();
    // 480 * ... keyboard steps of 10: 20% + bond/600 -> 50% at 180
    for (let i = 0; i < 18; i++) await slider.press('ArrowRight');
    await expect(meter).toHaveAttribute('aria-valuenow', '50');
    await expect(page.getByText('Đủ để bắt đầu dây.')).toBeVisible();
    await slider.press('End');
    await expect(meter).toHaveAttribute('aria-valuenow', '100');
    errs.expectClean();
  });

  test('FAQ: every question opens and closes', async ({ page }) => {
    await page.goto('/');
    const items = page.locator('details.hoi');
    const n = await items.count();
    expect(n).toBe(6);
    for (let i = 0; i < n; i++) {
      const d = items.nth(i);
      const summary = d.locator('summary');
      await summary.scrollIntoViewIfNeeded();
      await summary.click();
      await expect(d).toHaveAttribute('open', '');
      await summary.click();
      await expect(d).not.toHaveAttribute('open', '');
    }
  });

  test('ticker, border beam and the page are static under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.beam-ring')).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('transform', 'none');
  });
});
