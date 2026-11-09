import { expect, test } from '@playwright/test';
import { toast, watchErrors } from './helpers';

test.describe('S02 /circles', () => {
  test('four sample circles, each "Mở dây" opens its own circle', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/circles');
    await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Hụi tổ dân phố 7', 'Hụi cố định gia đình', 'Hụi bạn đại học', 'Hụi chị em văn phòng']);

    await page.getByRole('link', { name: 'Mở Hụi tổ dân phố 7' }).click();
    await expect(page).toHaveURL(/\/circles\/demo$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hụi tổ dân phố 7');

    await page.goto('/circles');
    await page.getByRole('link', { name: 'Mở Hụi cố định gia đình' }).click();
    await expect(page).toHaveURL(/\/circles\/co-dinh$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hụi cố định gia đình');

    await page.goto('/circles');
    await page.getByRole('link', { name: 'Mở Hụi bạn đại học' }).click();
    await expect(page).toHaveURL(/\/circles\/dang-gom$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hụi bạn đại học');

    await page.goto('/circles');
    await page.getByRole('link', { name: 'Mở Hụi chị em văn phòng' }).click();
    await expect(page).toHaveURL(/\/circles\/da-xong$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hụi chị em văn phòng');
    errs.expectClean();
  });

  test('empty-state switch (whole row is clickable), then create from the empty state', async ({ page }) => {
    await page.goto('/circles');
    const sw = page.getByRole('switch', { name: 'Xem thử trạng thái chưa có dây' });
    await expect(sw).not.toBeChecked();
    await page.getByText('Xem thử trạng thái chưa có dây').click(); // the label, not the tiny switch
    await expect(sw).toBeChecked();
    await expect(page.getByText('Bạn chưa tham gia dây nào.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sổ hụi của bạn còn trống' })).toBeVisible();
    await sw.click();
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(4);
    await page.getByRole('link', { name: 'Tạo dây mới' }).click();
    await expect(page).toHaveURL(/\/circles\/new$/);
  });

  test('verdict first: the most urgent task, its deadline and one action; then the wallet ledger', async ({ page }) => {
    await page.goto('/circles');
    const now = page.getByRole('region', { name: 'Nộp thăm kín cho kỳ 3' });
    await expect(now).toContainText('Việc gấp nhất của bạn, ở dây Hụi tổ dân phố 7');
    await expect(now).toContainText('Trần thăm kỳ này khoảng 3,28 USDC'); // 3,287671 rounded DOWN
    await now.getByRole('link', { name: 'Vào phòng thăm' }).click();
    await expect(page).toHaveURL(/\/circles\/demo$/);
    await page.goBack();
    await page.getByRole('region', { name: 'Nộp thăm kín cho kỳ 3' }).getByRole('link', { name: 'Mời thêm người' }).click();
    await expect(page).toHaveURL(/\/circles\/dang-gom$/);
    await page.goBack();
    const wallet = page.getByRole('region', { name: 'Sổ của bạn' });
    await expect(wallet).toContainText('100 USDC');
    await expect(wallet).toContainText('191 USDC'); // 94 + 97 (docs/03 section 8)
    await expect(wallet).toContainText('Chưa');
  });

  test('round strip says each round in words (not colour only)', async ({ page }) => {
    await page.goto('/circles');
    const strip = page.getByRole('list', { name: 'Các kỳ của dây: đã chi 2 trên 5' }).first();
    await expect(strip.getByRole('listitem')).toHaveCount(5);
    await expect(strip).toContainText('Kỳ 1: đã chi, Thành viên 4 hốt');
    await expect(strip).toContainText('Kỳ 2: đã chi, Thành viên 1 hốt');
    await expect(strip).toContainText('Kỳ 3: đang diễn ra');
    await expect(strip).toContainText('Kỳ 5: chưa tới');
  });

  test('countdowns tick', async ({ page }) => {
    await page.goto('/circles/demo');
    await page.getByRole('radio', { name: 'Mở thăm', exact: true }).click(); // the reveal countdown shows seconds
    const t = page.locator('time').last();
    const before = await t.textContent();
    await expect.poll(async () => t.textContent(), { timeout: 5000 }).not.toBe(before);
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
    await page.getByRole('link', { name: '← Dây của tôi' }).click();
    await expect(page).toHaveURL(/\/circles$/);
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
