import { expect, test } from '@playwright/test';
import { toast, watchErrors } from './helpers';

// "Tổng quan" (approved prototype, B22): verdict, four numbers, circles with their round strip, "Vừa xảy ra".
test.describe('/circles (Tổng quan)', () => {
  test('every sample circle is a row that opens its own circle', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/circles');
    const list = page.getByRole('list', { name: 'Các dây của bạn' });
    await expect(list.getByRole('heading', { level: 3 })).toHaveText(['Hụi tổ dân phố 7', 'Hụi cố định gia đình', 'Hụi bạn đại học', 'Hụi chị em văn phòng']);
    for (const [label, path] of [
      ['Hụi tổ dân phố 7', 'demo'],
      ['Hụi cố định gia đình', 'co-dinh'],
      ['Hụi bạn đại học', 'dang-gom'],
      ['Hụi chị em văn phòng', 'da-xong'],
    ] as const) {
      await page.goto('/circles');
      await list.getByRole('link', { name: new RegExp(label) }).click();
      await expect(page).toHaveURL(new RegExp(`/circles/${path}$`));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
    }
    errs.expectClean();
  });

  test('verdict first: the most urgent task with its deadline and one action', async ({ page }) => {
    await page.goto('/circles');
    const verdict = page.locator('.verdict');
    await expect(verdict).toContainText('Bạn có 3 việc: nộp thăm kín cho kỳ 3 ở Hụi tổ dân phố 7, còn');
    await verdict.getByRole('link', { name: 'Vào phòng thăm ↗' }).click();
    await expect(page).toHaveURL(/\/circles\/demo$/);
  });

  test('numbers: 191,00 paid so far (94 + 97, docs/03 section 8), 100,00 per round', async ({ page }) => {
    await page.goto('/circles');
    const stats = page.locator('.stats');
    await expect(stats).toContainText('191,00');
    await expect(stats).toContainText('100,00');
  });

  test('the open shortfall sits on top and links to where it is paid', async ({ page }) => {
    await page.goto('/circles');
    const alert = page.getByRole('alert').filter({ hasText: 'Bạn còn thiếu 20,00 USDC kỳ 2 ở Hụi cố định gia đình' });
    await expect(alert).toBeVisible();
    await alert.getByRole('link', { name: 'Trả ngay ›' }).click();
    await expect(page).toHaveURL(/\/circles\/co-dinh\/thieu$/);
  });

  test('"Vừa xảy ra" tells kỳ 2 then kỳ 1 with the receipt numbers (desktop)', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'the feed column is a desktop panel');
    await page.goto('/circles');
    const feed = page.getByRole('region', { name: 'Vừa xảy ra ở Hụi tổ dân phố 7' });
    await expect(feed).toContainText('Quá ân hạn, ghi vỡ nợ');
    await expect(feed).toContainText('Ký quỹ bù 20,00 cho M4');
    await expect(feed).toContainText('323,18');
    await expect(feed).toContainText('288,48');
  });

  test('"Thử: tài khoản mới" shows the empty state; the paste box checks the link', async ({ page }) => {
    await page.goto('/circles');
    const net = page.getByRole('button', { name: /^Thử:/ });
    for (let i = 0; i < 3; i++) await net.click();
    await expect(net).toHaveText('Thử: tài khoản mới');
    await expect(page.getByRole('heading', { name: 'Bạn chưa ở dây hụi nào.' })).toBeVisible();
    await page.getByRole('button', { name: 'Dán đường dẫn mời' }).click();
    const dialog = page.getByRole('dialog', { name: 'Mở lời mời' });
    await dialog.getByLabel('Đường dẫn mời').fill('xin chào');
    await dialog.getByRole('button', { name: 'Mở lời mời' }).click();
    await expect(dialog.getByLabel('Đường dẫn mời')).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog).toContainText('Chưa đúng đường dẫn mời');
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Tạo dây mới' }).click();
    await expect(page).toHaveURL(/\/circles\/new$/);
  });

  test('"Thử: mạng chậm" shows a skeleton first, then the data; "lỗi mạng" on a fresh page shows the error and Thử lại', async ({ page }) => {
    await page.goto('/circles');
    const net = page.getByRole('button', { name: /^Thử:/ });
    await net.click();
    await expect(page.locator('.sk').first()).toBeVisible();
    await expect(page.locator('.verdict')).toBeVisible({ timeout: 5000 });
    await net.click(); // lỗi mạng: what is on screen stays, marked stale
    await expect(page.getByRole('button', { name: 'Chưa cập nhật được · Thử lại' })).toBeVisible();
    await page.getByRole('link', { name: 'Sổ hụi' }).click();
    await expect(page.getByRole('heading', { name: 'Chưa đọc được dữ liệu từ chuỗi.' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Thử lại' }).click();
    await expect(page.getByRole('heading', { name: 'Kỳ × thành viên' })).toBeVisible();
  });
});

test.describe('other sample circles answer for themselves', () => {
  test('forming circle: invite link is copied, "Bắt đầu dây" explains why not yet', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await page.goto('/circles/dang-gom');
    await expect(page.getByRole('heading', { name: 'Đang chờ đủ người: 3 trên 5' })).toBeVisible();
    await page.getByRole('button', { name: 'Sao chép đường dẫn mời' }).click();
    await expect(toast(page, /đường dẫn mời|sao chép/i)).toBeVisible();
    const start = page.getByRole('button', { name: 'Bắt đầu dây' });
    await expect(start).toHaveAttribute('aria-disabled', 'true'); // closed, but it still answers when pressed
    await start.click({ force: true });
    await expect(toast(page, 'mới có 3 trên 5 người')).toBeVisible();
  });

  test('finished circle: both actions are real links', async ({ page }) => {
    await page.goto('/circles/da-xong');
    await page.getByRole('link', { name: 'Xem sổ hụi' }).click();
    await expect(page).toHaveURL(/\/circles\/da-xong\/so-ho$/);
    await page.goBack();
    await page.getByRole('link', { name: 'Xem tất toán và nhận tiền' }).click();
    await expect(page).toHaveURL(/\/circles\/da-xong\/tat-toan$/);
  });
});
