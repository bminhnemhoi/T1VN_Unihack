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

  test('coverage meter: slider moves the number, the words and the 100% floor (ADR-22) together', async ({ page }) => {
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
    await expect(page.getByText('100% tối thiểu')).toBeVisible();
    // keyboard steps of 10: 20% + bond/600 -> 50% at 180. Fuji floor is 100%, so 50% is still not enough.
    for (let i = 0; i < 18; i++) await slider.press('ArrowRight');
    await expect(meter).toHaveAttribute('aria-valuenow', '50');
    await expect(page.getByText(/Chưa đủ để bắt đầu dây\. Cần thêm/)).toBeVisible();
    for (let i = 0; i < 29; i++) await slider.press('ArrowRight'); // 470: 98,3%, still short
    await expect(page.getByText(/Chưa đủ để bắt đầu dây\. Cần thêm/)).toBeVisible();
    await slider.press('End');
    await expect(meter).toHaveAttribute('aria-valuenow', '100');
    await expect(page.getByText('Đủ để bắt đầu dây.')).toBeVisible();
    errs.expectClean();
  });

  test('card shows the sum behind the percentage and it follows the slider', async ({ page }) => {
    await page.goto('/');
    const sum = page.getByTestId('cong-thuc');
    await expect(sum).toHaveText('480 ký quỹ + 120 giữ lại = 600 trên 600 rủi ro lớn nhất');
    const slider = page.getByRole('slider', { name: /Ký quỹ của chủ hụi/ });
    await slider.focus();
    await slider.press('Home');
    await expect(sum).toHaveText('0 ký quỹ + 120 giữ lại = 120 trên 600 rủi ro lớn nhất');
    for (let i = 0; i < 18; i++) await slider.press('ArrowRight');
    await expect(sum).toHaveText('180 ký quỹ + 120 giữ lại = 300 trên 600 rủi ro lớn nhất');
    await expect(page.getByText('Trần thăm kỳ 1')).toHaveCount(0); // not part of the hero card any more
  });

  test('page has no repeated number band or running ticker, and NĐ 19 is worded as "mức trần" with a source link', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Số liệu dây mẫu' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Dòng sổ hụi mẫu' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Áp các mức trần của NĐ 19/2019' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Theo Nghị định 19/2019' })).toHaveCount(0);
    const src = page.getByRole('link', { name: /Đọc văn bản NĐ 19\/2019/ });
    await expect(src).toHaveAttribute('href', /caselaw\.vn/);
    await expect(src).toHaveAttribute('rel', /noopener/);
  });

  test('hero: the no-login demo is the main action, login is secondary', async ({ page }) => {
    await page.goto('/');
    const demo = page.getByRole('link', { name: 'Xem thử màn hình mẫu' });
    const login = page.getByRole('button', { name: 'Đăng nhập bằng Google hoặc email' });
    const [d, l] = await Promise.all([demo.boundingBox(), login.boundingBox()]);
    expect(d!.y).toBeLessThan(l!.y); // demo comes first
    await expect(demo).toHaveCSS('background-color', 'rgb(232, 176, 74)');
    await expect(login).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
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

  test('border beam and the entrance are off under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.beam-ring')).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('transform', 'none');
  });
});
