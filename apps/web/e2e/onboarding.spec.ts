import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './helpers';

// Sample build: no wallet, so the guide never opens by itself; "Xem lại hướng dẫn" in Cài đặt opens it.
const open = async (page: Page) => {
  await page.goto('/cai-dat');
  await page.getByRole('button', { name: 'Xem lại hướng dẫn' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
};

test.describe('B23 first-run guide', () => {
  test('is a modal dialog: heading focused, 2 questions text, Esc skips, nothing opens by itself in sample mode', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/circles');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const dialog = await open(page);
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Chào bạn. Cho mình hỏi nhanh 2 câu.');
    await expect(dialog.getByRole('heading', { level: 2 })).toBeFocused();
    await expect(dialog).toContainText('Để chỉ đúng chỗ bạn cần. Câu trả lời chỉ lưu trên máy này.');
    await expect(dialog.getByRole('radiogroup', { name: 'Bạn chơi hụi bao giờ chưa?' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Bỏ qua' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Xem lại hướng dẫn' })).toBeFocused(); // focus goes back
    errs.expectClean();
  });

  test('"Chưa" path: question 2, four cards in the brief\'s words, then the tour with "Xem dây mẫu"', async ({ page }) => {
    const dialog = await open(page);
    await dialog.getByRole('radio', { name: 'Chưa, mình mới nghe tới' }).click();
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Bạn vào HụiSafe để làm gì?');
    await dialog.getByRole('radio', { name: 'Xem thử cho biết' }).click();
    for (const [head, snippet] of [
      ['Hụi là gì', 'gọi là hốt. Mỗi người hốt đúng một lần.'],
      ['Bỏ thăm để hốt sớm', 'nên nhận nhiều hơn.'],
      ['Hụi truyền thống sợ gì', 'Người góp chỉ biết trông vào lòng tin.'],
      ['HụiSafe làm gì khác', 'ai bỏ đóng thì hợp đồng lấy ký quỹ bù ngay.'],
    ]) {
      await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(head!);
      await expect(dialog).toContainText(snippet!);
      await dialog.getByRole('button', { name: 'Tiếp tục' }).click();
    }
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('App có 4 chỗ chính');
    for (const line of ['Tổng quan: việc bạn cần làm hôm nay và các dây của bạn.', 'Dây: nộp thăm, mở thăm, xem ai hốt từng kỳ.', 'Sổ hụi: mọi khoản tiền vào ra, mỗi dòng có link kiểm trên Snowtrace.', 'Dây mới: mở một dây qua 6 câu hỏi.']) {
      await expect(dialog).toContainText(line);
    }
    await expect(dialog.getByRole('button', { name: 'Để sau' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Xem dây mẫu' }).click();
    await expect(page).toHaveURL(/\/circles\/demo$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('"Rồi" path: one card with three lines; "Tự mở dây" goes to the create flow', async ({ page }) => {
    const dialog = await open(page);
    await dialog.getByRole('radio', { name: 'Rồi, mình từng góp hoặc làm chủ hụi' }).click();
    await dialog.getByRole('radio', { name: 'Tự mở dây, làm chủ hụi' }).click();
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Ba điểm khác so với hụi bạn từng chơi');
    await expect(dialog).toContainText('Không ai cầm tiền: tiền góp đi thẳng từ ví người góp sang ví người hốt trong một giao dịch.');
    await expect(dialog).toContainText('Thăm kín thật: lá thăm được niêm phong on-chain, tới giờ mới mở, không ai đọc trộm được.');
    await expect(dialog).toContainText('Không cần AVAX: đăng nhập bằng Google hoặc email là có ví, phí mạng do HụiSafe trả.');
    await dialog.getByRole('button', { name: 'Tiếp tục' }).click();
    await dialog.getByRole('button', { name: 'Mở dây đầu tiên' }).click();
    await expect(page).toHaveURL(/\/circles\/new$/);
  });

  test('"Vào dây người quen mời" ends on the paste box, which checks the link', async ({ page }) => {
    const dialog = await open(page);
    await dialog.getByRole('radio', { name: 'Rồi, mình từng góp hoặc làm chủ hụi' }).click();
    await dialog.getByRole('radio', { name: 'Vào một dây người quen mời' }).click();
    await dialog.getByRole('button', { name: 'Tiếp tục' }).click();
    await dialog.getByRole('button', { name: 'Dán link mời' }).click();
    await dialog.getByLabel('Đường dẫn mời').fill('xin chào');
    await dialog.getByRole('button', { name: 'Mở lời mời' }).click();
    await expect(dialog.getByLabel('Đường dẫn mời')).toHaveAttribute('aria-invalid', 'true');
    await dialog.getByRole('button', { name: 'Quay lại' }).click();
    await expect(dialog.getByRole('button', { name: 'Dán link mời' })).toBeVisible();
  });

  test('keyboard: arrows move between the answers, Tab stays inside the dialog, Quay lại works', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard path is checked on the desktop project');
    const dialog = await open(page);
    const first = dialog.getByRole('radio', { name: 'Chưa, mình mới nghe tới' });
    await first.focus();
    await page.keyboard.press('ArrowDown');
    await expect(dialog.getByRole('radio', { name: 'Rồi, mình từng góp hoặc làm chủ hụi' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Bạn vào HụiSafe để làm gì?');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    }
    await dialog.getByRole('button', { name: 'Quay lại' }).click();
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Chào bạn. Cho mình hỏi nhanh 2 câu.');
  });

  test('phone: a full-height sheet; desktop: a 560px dialog; neither scrolls the page sideways', async ({ page }) => {
    const dialog = await open(page);
    const size = await dialog.evaluate((el) => ({ w: (el as HTMLElement).offsetWidth, h: (el as HTMLElement).offsetHeight })); // layout size: the entry animation scales the box
    const vp = page.viewportSize()!;
    if (vp.width <= 760) {
      expect(size.w).toBe(vp.width);
      expect(size.h).toBe(vp.height);
    } else {
      expect(size.w).toBe(560);
    }
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
});
