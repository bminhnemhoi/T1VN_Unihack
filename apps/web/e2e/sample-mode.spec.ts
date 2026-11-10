import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

// These run against a build with NO deployment (no contracts/deployments/<network>.json): the app must keep working
// on sample data and say so. With a deployment the label is not rendered at all.
test.describe('sample mode (nothing deployed)', () => {
  for (const path of ['/', '/circles', '/circles/new', '/circles/demo', '/dang-nhap']) {
    test(`${path} shows the "Đang xem dữ liệu mẫu" label`, async ({ page }) => {
      const errs = watchErrors(page);
      await page.goto(path);
      await expect(page.getByTestId('sample-mode')).toHaveText('Đang xem dữ liệu mẫu');
      errs.expectClean();
    });
  }

  test('an address is not a sample circle: Vietnamese 404', async ({ page }) => {
    const res = await page.goto('/circles/0x0000000000000000000000000000000000000001');
    expect(res?.status()).toBe(404);
  });

  test('buttons that need the chain answer instead of doing nothing', async ({ page }) => {
    await page.goto('/circles/demo');
    await page.getByRole('button', { name: 'Niêm phong thăm' }).click();
    await expect(page.getByText('Niêm phong thăm', { exact: false }).first()).toBeVisible();
  });

  test('login page keeps the "sắp có" buttons and no wallet is invented', async ({ page }) => {
    await page.goto('/dang-nhap');
    await page.getByRole('button', { name: 'Tiếp tục với Google' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'màn hình mẫu' })).toBeVisible();
  });
});
