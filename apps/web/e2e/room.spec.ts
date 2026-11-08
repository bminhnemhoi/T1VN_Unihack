import { expect, test } from '@playwright/test';
import { toast, watchErrors } from './helpers';

const phase = (page: import('@playwright/test').Page, name: string) => page.getByRole('radio', { name, exact: true });
const timelineNow = (page: import('@playwright/test').Page) => page.locator('li[aria-current="step"]');

test.describe('S04/S06 /circles/demo', () => {
  test('phase switch drives the timeline and the card', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/circles/demo');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hụi tổ dân phố 7');
    await expect(phase(page, 'Nộp thăm')).toBeChecked();
    await expect(timelineNow(page)).toContainText('Nộp thăm kín');
    await phase(page, 'Mở thăm').click();
    await expect(timelineNow(page)).toContainText('Mở thăm');
    await expect(page.getByRole('button', { name: 'Mở thăm của tôi' })).toBeVisible();
    await phase(page, 'Chốt kỳ').click();
    await expect(timelineNow(page)).toContainText('Chốt kỳ');
    await expect(page.getByRole('button', { name: 'Chốt kỳ 3' })).toBeVisible();
    await phase(page, 'Nộp thăm').click();
    await expect(page.getByRole('button', { name: 'Niêm phong thăm' })).toBeVisible();
    errs.expectClean();
  });

  test('bid is checked against the ceiling for round 3 (3,287671 USDC) as you type', async ({ page }) => {
    await page.goto('/circles/demo');
    const bid = page.getByLabel('Tiền thăm mỗi phần hụi trả bớt');
    const seal = page.getByRole('button', { name: 'Niêm phong thăm' });
    await expect(bid).toHaveValue('2');
    await expect(seal).toBeEnabled();
    await bid.fill('3,3');
    await expect(page.getByText('Thăm tối đa kỳ này là 3,287671 USDC.')).toBeVisible();
    await expect(seal).toBeDisabled();
    await bid.fill('hai');
    await expect(page.getByText('Nhập thăm bằng số, ví dụ 2 hoặc 1,5.')).toBeVisible();
    await bid.fill('3,287671');
    await expect(page.locator('#bid-err')).toHaveCount(0);
    await expect(seal).toBeEnabled();
  });

  test('seal the bid, edit it, then open it in the reveal phase and get the deposit back', async ({ page }) => {
    await page.goto('/circles/demo');
    await page.getByLabel('Tiền thăm mỗi phần hụi trả bớt').fill('3');
    await page.getByRole('button', { name: 'Niêm phong thăm' }).click();
    await expect(page.getByText('Đã niêm phong thăm của bạn.')).toBeVisible();
    await page.getByRole('button', { name: 'Sửa thăm' }).click();
    await expect(page.getByLabel('Tiền thăm mỗi phần hụi trả bớt')).toHaveValue('3');
    await page.getByRole('button', { name: 'Niêm phong thăm' }).click();
    await phase(page, 'Mở thăm').click();
    await page.getByRole('button', { name: 'Mở thăm của tôi' }).click();
    await expect(page.getByText('Đã mở thăm của bạn: 3 USDC mỗi phần. Cọc 1 USDC đã được trả lại (mẫu).')).toBeVisible();
  });

  test('reveal without a sealed bid explains what happened; settle answers with the "needs the network" message', async ({ page }) => {
    await page.goto('/circles/demo');
    await phase(page, 'Mở thăm').click();
    await page.getByRole('button', { name: 'Mở thăm của tôi' }).click();
    await expect(page.getByText(/chưa niêm phong thăm ở giai đoạn nộp/)).toBeVisible();
    await phase(page, 'Chốt kỳ').click();
    await page.getByRole('button', { name: 'Chốt kỳ 3' }).click();
    await expect(toast(page, 'Chốt kỳ 3 cần nối mạng')).toBeVisible();
  });

  test('viewer is a member who has not received yet, so bidding is allowed (docs/03 section 6.1)', async ({ page }) => {
    await page.goto('/circles/demo');
    await expect(page.getByText('Bạn là thành viên 2')).toBeVisible();
    const rules = page.getByRole('region', { name: 'Luật của kỳ này' });
    await expect(rules).toContainText('3,287671 USDC');
    await expect(rules).toContainText('Thành viên 2 (bạn), Thành viên 3, Thành viên 5');
  });

  test('Bảng sổ hụi on desktop: rounds x members with the docs/03 section 8 numbers', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop table');
    await page.goto('/circles/demo');
    const table = page.getByRole('table', { name: /Bảng sổ hụi/ });
    await expect(table.getByRole('columnheader')).toHaveCount(7);
    await expect(table.getByRole('rowheader', { name: /Kỳ 1/ })).toBeVisible();
    const k1 = table.getByRole('row', { name: /Kỳ 1/ });
    await expect(k1.getByRole('cell')).toHaveText([/góp 94 USDC/, /góp 94 USDC/, /góp 94 USDC/, /Hốt kỳ này/, /góp 94 USDC/, /288,48 USDC/]);
    const k2 = table.getByRole('row', { name: /Kỳ 2/ });
    await expect(k2).toContainText('thiếu 100 USDC');
    await expect(k2).toContainText('bù 80 USDC tiền giữ lại, 20 USDC ký quỹ');
    await expect(k2).toContainText('323,18 USDC');
    await expect(table.getByRole('row', { name: /Kỳ 3/ })).toContainText('Đang nộp thăm kín');
    await page.getByRole('radio', { name: 'Mở thăm', exact: true }).click();
    await expect(table.getByRole('row', { name: /Kỳ 3/ })).toContainText('Đang mở thăm');
    await expect(table.getByRole('row', { name: /Đang giữ lại/ })).toContainText('60 USDC');
  });

  test('Bảng sổ hụi on phones: one line per round, open it to see each member', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone list');
    await page.goto('/circles/demo');
    const k2 = page.locator('details').filter({ hasText: 'Kỳ 2: Thành viên 1 hốt, nhận 323,18 USDC.' });
    await expect(k2).toContainText('1 người thiếu và đã được bù');
    await k2.locator('summary').click();
    await expect(k2).toHaveAttribute('open', '');
    await expect(k2.getByText('thiếu 100 USDC')).toBeVisible();
    await expect(k2.getByText('Thành viên 2 (bạn)')).toBeVisible();
  });

  test('kỳ 2 waterfall shows who covered the missing 100 USDC', async ({ page }) => {
    await page.goto('/circles/demo');
    await expect(page.getByText('Tiền hốt của kỳ 2 là 391 USDC, chia ra')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Kỳ 2: có người không đóng' })).toBeVisible();
  });
});
