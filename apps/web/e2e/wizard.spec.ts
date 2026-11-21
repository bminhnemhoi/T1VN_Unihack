import { expect, test, type Page } from '@playwright/test';
import { demoClick, watchErrors } from './helpers';

// "Dây mới" (approved prototype, B22): one question per screen, six steps. Numbers: docs/03 section 8 (5 x 100 USDC,
// bond 480 = 0,8 x O_max 600, members allow (N - 1) x (C + 1% reveal bond) = 404).

const next = (page: Page) => page.getByRole('button', { name: 'Tiếp tục ›' });
const stepLabel = (page: Page) => page.locator('.crTop .label');

test.describe('/circles/new (Dây mới)', () => {
  test('happy path: bidding, 5 people, 100 USDC, monthly -> bond 480, 100%, allowance 404, then "Tạo dây"', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/circles/new');
    await expect(stepLabel(page)).toHaveText('Tạo dây · bước 1/6');
    await expect(page.getByRole('radio', { name: /Bỏ thăm/ })).toHaveAttribute('aria-checked', 'true');
    await next(page).click();

    await expect(stepLabel(page)).toHaveText('Tạo dây · bước 2/6');
    await expect(page.locator('.stepper output')).toHaveText('5');
    await next(page).click();

    await expect(page.getByLabel('Mỗi kỳ, mỗi người góp bao nhiêu?')).toHaveValue('100');
    await expect(page.locator('#cHint')).toContainText('khoảng 400,00 USDC');
    await next(page).click();

    await expect(page.getByRole('radio', { name: /Mỗi tháng/ })).toHaveAttribute('aria-checked', 'true');
    await next(page).click();

    await expect(page.locator('.bondBig')).toContainText('480,00');
    await expect(page.getByText('Chỉ số bảo chứng 100%')).toBeVisible();
    await expect(page.getByText(/Rủi ro lớn nhất 600,00 USDC/)).toBeVisible();
    await next(page).click();

    await expect(page.getByRole('heading', { name: 'Xem lại rồi tạo dây.' })).toBeVisible();
    const review = page.locator('.crQ .rc');
    await expect(review).toContainText('480,00 USDC');
    await expect(review).toContainText('404,00 USDC');

    // The 18+ box comes first (NĐ 19 Điều 5, 6).
    await page.getByRole('button', { name: 'Tạo dây' }).click();
    await expect(page.getByLabel(/Tôi đủ 18 tuổi/)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel(/Tôi đủ 18 tuổi/)).toBeFocused();
    await page.getByLabel(/Tôi đủ 18 tuổi/).check();
    await page.getByRole('button', { name: 'Tạo dây' }).click();
    await expect(page.locator('button[aria-busy="true"]')).toBeDisabled();
    await expect(page.locator('.crDone .stamp')).toContainText('ĐÃ TẠO DÂY');
    await expect(page.getByRole('heading', { name: 'Gửi đường dẫn mời cho 5 người.' })).toBeVisible();
    await expect(page.getByText('Bản xem thử: chưa gửi gì lên blockchain.')).toBeVisible();
    errs.expectClean();
  });

  test('people: the stepper stops at 3 and 30, the slider takes the arrow keys', async ({ page }) => {
    await page.goto('/circles/new');
    await next(page).click();
    const minus = page.getByRole('button', { name: 'Bớt một người' });
    await minus.click();
    await minus.click();
    await expect(page.locator('.stepper output')).toHaveText('3');
    await expect(minus).toBeDisabled();
    const slider = page.getByRole('slider', { name: 'Số người chơi, từ 3 đến 30' });
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.stepper output')).toHaveText('4');
    await page.keyboard.press('End');
    await expect(page.locator('.stepper output')).toHaveText('30');
    await expect(page.getByRole('button', { name: 'Thêm một người' })).toBeDisabled();
  });

  test('contribution: out of range is refused in place and "Tiếp tục" waits; chips fill the box', async ({ page }) => {
    await page.goto('/circles/new');
    await next(page).click();
    await next(page).click();
    const box = page.getByLabel('Mỗi kỳ, mỗi người góp bao nhiêu?');
    await box.fill('0,5');
    await expect(box).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#cHint')).toHaveText('Tối thiểu 1 USDC.');
    await expect(next(page)).toBeDisabled();
    await box.fill('20000');
    await expect(page.locator('#cHint')).toHaveText('Bản thử nghiệm tối đa 10.000 USDC mỗi kỳ.');
    await page.getByRole('button', { name: '50', exact: true }).click();
    await expect(box).toHaveValue('50');
    await expect(page.getByRole('button', { name: '50', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(next(page)).toBeEnabled();
  });

  test('period: weekly shows a much smaller ceiling; Fixed has no ceiling at all', async ({ page }) => {
    await page.goto('/circles/new');
    await next(page).click();
    await next(page).click();
    await next(page).click();
    const monthly = await page.locator('.crQ .sub b').textContent();
    await page.getByRole('radio', { name: /Mỗi tuần/ }).click();
    await expect(page.getByRole('radio', { name: /Mỗi tuần/ })).toHaveAttribute('aria-checked', 'true');
    const weekly = await page.locator('.crQ .sub b').textContent();
    expect(weekly).not.toBe(monthly);
    await page.getByRole('button', { name: '‹ Quay lại' }).click();
    await page.getByRole('button', { name: '‹ Quay lại' }).click();
    await page.getByRole('button', { name: '‹ Quay lại' }).click();
    await page.getByRole('radio', { name: /Cố định/ }).click();
    await next(page).click();
    await next(page).click();
    await next(page).click();
    await expect(page.getByText('Hụi cố định không có thăm nên không có trần thăm.')).toBeVisible();
  });

  test('"Huỷ tạo dây" on the first step goes back to the overview', async ({ page }) => {
    await page.goto('/circles/new');
    await page.getByRole('link', { name: 'Huỷ tạo dây' }).click();
    await expect(page).toHaveURL(/\/circles$/);
  });

  test('"Thử: lỗi mạng": the create fails at the send step and says nothing was lost; the retry works', async ({ page }) => {
    await page.goto('/circles/new');
    await demoClick(page, /^Thử:/, 2);
    for (let i = 0; i < 5; i++) await next(page).click();
    await page.getByLabel(/Tôi đủ 18 tuổi/).check();
    await page.getByRole('button', { name: 'Tạo dây' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Dây chưa được tạo, bạn chưa mất gì.' })).toBeVisible();
    await page.getByRole('button', { name: 'Gửi lại lệnh tạo dây' }).click();
    await expect(page.locator('.crDone .stamp')).toContainText('ĐÃ TẠO DÂY');
  });
});
