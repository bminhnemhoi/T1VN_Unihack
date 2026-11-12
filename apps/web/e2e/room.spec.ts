import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './helpers';

// The circle room as a timeline (approved prototype, B22): round rail (phone: story bars), receipt / bid room / plan.
// Numbers: docs/03 section 8 (5 x 100 USDC, M4 takes kỳ 1 at 6, M1 takes kỳ 2 at 3, M4 misses kỳ 2: 80 holdback + 20 bond).

const round = (page: Page, k: number, isMobile: boolean | undefined) =>
  isMobile ? page.locator('.storyNav .bars').getByRole('button', { name: `Kỳ ${k}`, exact: true }) : page.locator('.rail button').nth(k - 1);

test.describe('/circles/demo (Dây)', () => {
  test('opens on the running kỳ 3: three phases, the clock, the slip with the ceiling 3,287671', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/circles/demo');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hụi tổ dân phố 7');
    const phases = page.getByRole('list', { name: 'Các bước của kỳ 3' });
    await expect(phases.getByRole('listitem')).toHaveCount(3);
    await expect(phases.locator('li.on')).toContainText('Nộp thăm kín');
    await expect(page.getByRole('timer')).toBeVisible();
    await expect(page.locator('#bidHint')).toContainText('Trần kỳ này 3,287671 USDC');
    errs.expectClean();
  });

  test('the bid is checked as you type: over the ceiling or at 100 is refused, the button locks', async ({ page }) => {
    await page.goto('/circles/demo');
    const bid = page.getByLabel('Thăm của bạn (số tiền bớt cho mọi người)');
    const seal = page.getByRole('button', { name: 'Niêm phong thăm' });
    await bid.fill('3,3');
    await expect(bid).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#bidHint')).toContainText('Vượt trần kỳ này (3,287671 USDC)');
    await expect(seal).toBeDisabled();
    await bid.fill('100');
    await expect(page.locator('#bidHint')).toContainText('nhỏ hơn 100,00 USDC');
    await bid.fill('abc');
    await expect(page.locator('#bidHint')).toContainText('Nhập số tiền');
    await bid.fill('3');
    await expect(bid).toHaveAttribute('aria-invalid', 'false');
    await expect(seal).toBeEnabled();
  });

  test('if you win with 3,00 you get 346,12 (pot 2 x 97 + 2 x 100 = 394)', async ({ page, isMobile }) => {
    await page.goto('/circles/demo');
    await page.getByLabel('Thăm của bạn (số tiền bớt cho mọi người)').fill('3');
    if (isMobile) {
      await expect(page.locator('.peek b')).toHaveText('346,12');
      await page.locator('.peek').click();
      const sheet = page.getByRole('dialog', { name: /Nếu bạn thắng kỳ 3 với thăm 3,00/ });
      await expect(sheet).toContainText('394,00');
      await expect(sheet).toContainText('346,12');
      await page.keyboard.press('Escape');
      await expect(page.locator('.sheet')).not.toHaveClass(/open/);
      await expect(page.locator('.peek')).toBeFocused();
    } else {
      const side = page.locator('.panel.side');
      await expect(side).toContainText('Nếu bạn thắng kỳ 3 với thăm 3,00');
      await expect(side).toContainText('394,00');
      await expect(side.locator('.big dd')).toHaveText('346,12');
    }
  });

  test('sealing goes Ký -> Gửi -> Xác nhận and only then stamps; "Tua nhanh" opens the reveal, then settles', async ({ page }) => {
    await page.goto('/circles/demo');
    await page.getByLabel('Thăm của bạn (số tiền bớt cho mọi người)').fill('3');
    await page.getByRole('button', { name: 'Niêm phong thăm' }).click();
    const busy = page.locator('button[aria-busy="true"]');
    await expect(busy).toBeDisabled();
    await expect(page.getByRole('list', { name: 'Tiến độ giao dịch' })).toBeVisible();
    await expect(page.locator('.slip .stamp')).not.toHaveClass(/\bon\b/);
    await expect(page.locator('.slip .stamp.on')).toContainText('ĐÃ NIÊM PHONG');
    await expect(page.getByLabel('Thăm của bạn (số tiền bớt cho mọi người)')).toBeDisabled();

    await page.getByRole('button', { name: 'Tua nhanh ›' }).click();
    await expect(page.getByRole('list', { name: 'Các bước của kỳ 3' }).locator('li.on')).toContainText('Mở thăm');
    await page.getByRole('button', { name: 'Mở thăm', exact: true }).click();
    await expect(page.locator('.slip .stamp.on')).toContainText('ĐÃ MỞ');

    await page.getByRole('button', { name: 'Tua nhanh ›' }).click();
    // 3,00 beats the sample rival's 2,50: you take the pot.
    await expect(page.locator('.slip .stamp.on')).toContainText('ĐÃ HỐT');
    await expect(page.locator('.slip .stamp.on')).toContainText('346,12');
    await expect(page.getByRole('link', { name: 'Xem sổ hụi ↗' })).toBeVisible();
  });

  test('"Thử: lỗi mạng": the send step fails, nothing is stamped, "Gửi lại thăm" recovers', async ({ page }) => {
    await page.goto('/circles/demo');
    const net = page.getByRole('button', { name: /^Thử:/ });
    await net.click(); // mạng chậm
    await net.click(); // lỗi mạng
    await expect(net).toHaveText('Thử: lỗi mạng');
    // The data on screen stays (stale) and a retry chip appears.
    await expect(page.getByRole('button', { name: 'Chưa cập nhật được · Thử lại' })).toBeVisible();
    await page.getByLabel('Thăm của bạn (số tiền bớt cho mọi người)').fill('3');
    await page.getByRole('button', { name: 'Niêm phong thăm' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Lệnh chưa lên chuỗi, bạn chưa mất gì' })).toBeVisible();
    await expect(page.locator('.slip .stamp.on')).toHaveCount(0);
    await page.getByRole('button', { name: 'Gửi lại thăm' }).click();
    await expect(page.locator('.slip .stamp.on')).toContainText('ĐÃ NIÊM PHONG');
  });

  test('kỳ 2 is a receipt: M4 missed 100, covered 80 from holdback + 20 from bond (480 -> 460), M1 still gets 323,18', async ({ page, isMobile }) => {
    await page.goto('/circles/demo');
    await round(page, 2, isMobile).click();
    const receipt = page.locator('.receipt');
    await expect(receipt).toContainText('Biên lai · Kỳ 2');
    await expect(receipt).toContainText('M4 không đóng 100,00 USDC. M1 vẫn nhận đủ.');
    await expect(receipt.getByRole('img', { name: /80,00 từ tiền giữ lại.*20,00 từ ký quỹ/ })).toBeVisible();
    await expect(receipt).toContainText('480,00 → 460,00');
    await expect(receipt).toContainText('391,00');
    await expect(receipt.locator('.big dd')).toHaveText('323,18');
    await expect(receipt.locator('.stamp.on')).toContainText('M1 HỐT');
  });

  test('kỳ 1 adds up (376 - 3,76 - 3,76 - 80 = 288,48); kỳ 4 shows its ceiling 1,643835; kỳ 5 has no bid', async ({ page, isMobile }) => {
    await page.goto('/circles/demo');
    await round(page, 1, isMobile).click();
    await expect(page.locator('.receipt')).toContainText('M4 thắng với thăm 6,00 USDC');
    await expect(page.locator('.receipt')).toContainText('376,00');
    await expect(page.locator('.receipt .big dd')).toHaveText('288,48');
    await round(page, 4, isMobile).click();
    await expect(page.getByText('1,643835 USDC')).toBeVisible();
    await round(page, 5, isMobile).click();
    await expect(page.getByRole('heading', { name: 'Người còn lại hốt, không bỏ thăm' })).toBeVisible();
  });

  test('phone: ‹ › step through the rounds and the story line follows', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'story navigation is the phone layout');
    await page.goto('/circles/demo');
    await expect(page.locator('.snMid strong')).toHaveText('Kỳ 3/5');
    await page.getByRole('button', { name: 'Kỳ trước' }).click();
    await expect(page.locator('.snMid strong')).toHaveText('Kỳ 2/5');
    await expect(page.locator('.snMid small')).toContainText('M1 hốt');
    await page.getByRole('button', { name: 'Kỳ sau' }).click();
    await page.getByRole('button', { name: 'Kỳ sau' }).click();
    await expect(page.locator('.snMid strong')).toHaveText('Kỳ 4/5');
  });

  test('top bar chips: coverage 100%, bond 460/480, reserve 7,67; they open the coverage page', async ({ page, isMobile }) => {
    await page.goto('/circles/demo');
    const health = page.locator('#hs-health');
    await expect(health).toContainText('100%');
    if (!isMobile) {
      await expect(health).toContainText('460/480');
      await expect(health).toContainText('7,67');
    }
    await health.locator('a.chip').first().click();
    await expect(page).toHaveURL(/\/circles\/demo\/bao-chung$/);
  });
});

test.describe('/circles/co-dinh (Fixed)', () => {
  test('no bid: the round goes to M3 by joining order, and the viewer\'s shortfall comes first', async ({ page }) => {
    await page.goto('/circles/co-dinh');
    await expect(page.getByRole('heading', { name: 'Kỳ này bạn hốt.' })).toBeVisible();
    await page.getByRole('link', { name: 'Trả khoản thiếu 20,00 USDC' }).click();
    await expect(page).toHaveURL(/\/circles\/co-dinh\/thieu$/);
  });
});
