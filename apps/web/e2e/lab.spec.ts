import { expect, test, type Page } from '@playwright/test';
import { noHorizontalOverflow, noClippedContent, watchErrors } from './helpers';

const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1440) < 768;

test.describe('S16 /lab, v1.2 organizer scenarios', () => {
  test('dummy-wallet table shows the docs/03 section 7.3 numbers read from the output file, with the exact promise', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/lab');
    // phones show cards, wider screens the table: the same four lines either way
    const row = (name: RegExp) => (isPhone(page) ? page.getByRole('list', { name: 'Chủ hụi dùng ví ảo' }).getByRole('listitem').filter({ hasText: name }) : page.getByRole('region', { name: 'Bảng ví ảo, kéo ngang để xem hết' }).getByRole('row', { name: name }));
    await expect(row(/1 ví ảo, CI 100%/)).toContainText('lỗ 18,038354 USDC');
    await expect(row(/2 ví ảo, CI 100%/)).toContainText('lời 41,472772 USDC');
    await expect(row(/2 ví ảo, CI 100%/)).toContainText('336,572274 USDC');
    await expect(row(/CI 50%/)).toContainText('lời 120,756588 USDC');
    await expect(page.getByText('Cọc 100% chặn được chủ hụi dùng một ví ảo: làm vậy chủ hụi tự lỗ.')).toBeVisible();
    await expect(page.getByText(/Dùng nhiều ví ảo thì bị chặn bằng xác thực mỗi người một tài khoản/)).toBeVisible();
    await expect(page.getByText(/chặn gian lận/)).toHaveCount(0);
    errs.expectClean();
  });

  test('organizer earnings: assumptions are stated, month x 10 shows phi = 50% inside the cap, weekly small circles lose', async ({ page }) => {
    await page.goto('/lab');
    await expect(page.getByText(/tham khảo Klonner & Rai, 2008\), không phải số đo thật\. Tỷ suất là kết quả của giả định, không phải dự báo\./)).toBeVisible();
    const table = {
      getByRole: (_r: 'row', o: { name: RegExp }) =>
        isPhone(page) ? page.getByRole('list', { name: 'Lời của chủ hụi theo cách tính hoa hồng' }).getByRole('listitem').filter({ hasText: o.name }) : page.getByRole('region', { name: 'Bảng lời của chủ hụi, kéo ngang để xem hết' }).getByRole('row', o),
    };
    await expect(table.getByRole('row', { name: /φ = 50%/ })).toContainText('5,24%');
    await expect(table.getByRole('row', { name: /φ = 50%/ })).toContainText('Có');
    await expect(table.getByRole('row', { name: /Cố định 1%/ })).toContainText('Không: vượt trần');
    await page.getByRole('radio', { name: 'Hụi tuần' }).click();
    await page.getByRole('radio', { name: '5 người' }).click();
    await expect(table.getByRole('row', { name: /Cố định 1%/ })).toContainText('Không: vượt trần');
    await expect(page.getByText(/cho chủ hụi lỗ sau rủi ro/)).toBeVisible();
    await expect(table.getByRole('row', { name: /φ = 33%/ })).toContainText('(lỗ)');
  });

  test('both new sections fit the screen: no sideways scroll of the page', async ({ page }) => {
    await page.goto('/lab');
    await expect(page.getByRole('heading', { name: 'Chủ hụi dùng ví ảo' })).toBeVisible();
    await noHorizontalOverflow(page);
    await noClippedContent(page);
  });
});
