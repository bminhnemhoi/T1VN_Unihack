import { expect, test, type Page } from '@playwright/test';
import { FUJI_EVIDENCE } from 'config';
import { noHorizontalOverflow, watchErrors } from './helpers';

/** Most checks run with reduced motion: the page must be complete and correct without any animation. */
async function openStill(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
}

test.describe('S01 / landing', () => {
  test('has its own navigation, no app header or bottom bar, and keeps the demo strip', async ({ page }) => {
    const errs = watchErrors(page);
    await openStill(page);
    await expect(page.getByRole('navigation', { name: 'Trang giới thiệu' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: /^Điều hướng chính/ })).toHaveCount(0);
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByTestId('demo-banner')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Chơi hụi\s+không sợ\s+giựt\./);
    await noHorizontalOverflow(page);
    errs.expectClean();
  });

  for (const name of ['Mở app', 'Chơi hụi ngay', 'Mở HụiSafe']) {
    test(`"${name}" opens the web app`, async ({ page }) => {
      await openStill(page);
      await page.getByRole('link', { name }).click();
      await expect(page).toHaveURL(/\/circles$/);
      // Back in the app, its own chrome is there again.
      await expect(page.getByRole('navigation', { name: /^Điều hướng chính/ }).first()).toBeAttached();
    });
  }

  test('footer links reach the main screens', async ({ page }) => {
    const footer = page.getByRole('navigation', { name: 'Vào web app' });
    for (const [label, url] of [['Dây của tôi', /\/circles$/], ['Tạo dây', /\/circles\/new$/], ['Phòng mô phỏng', /\/lab$/], ['Đăng nhập', /\/dang-nhap$/]] as const) {
      await openStill(page);
      await footer.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(url);
    }
  });

  test('bid card follows docs/03 section 8: bid 6 pays 288,48, above 6,575342 is refused', async ({ page }) => {
    await openStill(page);
    const bid = page.getByLabel(/Thăm kỳ 1/);
    await expect(page.getByTestId('lp-payout')).toHaveText('288,48');
    await bid.fill('7');
    await expect(page.getByText('Vượt trần 6,575342 USDC: hợp đồng không cho mở thăm này.')).toBeVisible();
    await expect(page.getByTestId('lp-payout')).toHaveCount(0);
    await bid.fill('6,575342');
    await expect(page.getByText(/Hợp lệ\. Mỗi người còn lại bớt 6,575342 USDC\./)).toBeVisible();
  });

  test('cascade card: M4 defaults, 80 from holdback + 20 from bond, M1 still gets 323,18', async ({ page }) => {
    await openStill(page);
    const out = page.getByTestId('lp-cascade');
    await expect(out).toHaveText('Pot 391 USDC. M1 nhận ngay 323,18 USDC.');
    await page.getByRole('button', { name: 'M4 bỏ đóng' }).click();
    await expect(page.getByRole('button', { name: 'M4 bỏ đóng' })).toHaveAttribute('aria-pressed', 'true');
    await expect(out).toHaveText('M4 thiếu 100: bù 80 từ tiền giữ lại của M4, 20 từ ký quỹ (còn 460). M1 vẫn nhận 323,18 USDC.');
  });

  test('coverage card: 480 on 5 members is 100%, less cannot start on Fuji', async ({ page }) => {
    await openStill(page);
    const out = page.getByTestId('lp-coverage');
    await expect(out).toHaveText('Bảo chứng 100%: đủ, được bắt đầu dây');
    const bond = page.getByRole('slider', { name: /Ký quỹ/ });
    await bond.focus();
    await bond.press('Home');
    await expect(out).toHaveText('Bảo chứng 20%: dưới 100%, không bắt đầu được dây');
    await bond.press('End');
    await expect(out).toHaveText('Bảo chứng 100%: đủ, được bắt đầu dây');
  });

  test('ledger links open the two real circles on the Fuji explorer', async ({ page }) => {
    await openStill(page);
    for (const address of Object.values(FUJI_EVIDENCE)) {
      const link = page.locator(`a[href="https://testnet.snowtrace.io/address/${address}"]`);
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
  });

  test('reduced motion: no intro, the ballot shows its final stamped state, nothing is moved', async ({ page }) => {
    await openStill(page);
    await expect(page.locator('[data-lp-intro]')).toBeHidden();
    await expect(page.locator('[data-lp-story]')).toHaveAttribute('data-state', '3');
    await expect(page.locator('[data-lp-line]').first()).toHaveCSS('transform', 'none');
  });
});

test.describe('S01 / landing motion', () => {
  test('intro covers the first paint and replays on every visit, can be skipped, ends by itself; ballot opens on scroll', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/');
    const intro = page.locator('[data-lp-intro]');
    const skip = intro.locator('button', { hasText: 'Bỏ qua' });
    await expect(skip).toBeVisible();
    await skip.click();
    await expect(intro).toBeHidden();
    await expect(page.locator('html')).toHaveClass(/lenis/);
    await expect(page.locator('[data-lp-line]').first()).toBeInViewport();

    await page.reload();
    await expect(intro).toBeVisible(); // every visit plays it
    await expect(intro).toBeHidden({ timeout: 6000 }); // and it ends on its own
    // After the curtain the hero has entered: the headline is in place, not stuck below its mask.
    await expect(page.locator('[data-lp-line]').first()).toHaveCSS('transform', /none|matrix\(1, 0, 0, 1, 0, 0\)/, { timeout: 4000 });

    const story = page.locator('[data-lp-story]');
    await page.locator('[data-step="3"]').scrollIntoViewIfNeeded();
    await expect(story).toHaveAttribute('data-state', '3', { timeout: 5000 });

    await page.getByRole('link', { name: 'Mở app' }).click();
    await expect(page).toHaveURL(/\/circles$/);
    await expect(page.locator('html')).not.toHaveClass(/lenis/);
    errs.expectClean();
  });
});
