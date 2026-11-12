import { expect, test } from '@playwright/test';
import { noClippedContent, noHorizontalOverflow, watchErrors } from './helpers';

/** W11: the sổ hụi page is the printable book (the PDF was replaced by "In sổ hụi" + a print stylesheet). */
test.describe('/circles/demo/so-ho', () => {
  test('header, QR to Snowtrace, members, lines, totals and the on-chain note; every amount has its unit', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/circles/demo/so-ho?ban=day-du');
    await expect(page.getByRole('button', { name: 'In sổ hụi' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tải JSON' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Tải PDF/ })).toHaveCount(0);
    await expect(page.getByRole('img', { name: /Mã QR/ })).toBeVisible();
    const members = page.getByRole('table', { name: 'Thành viên theo thứ tự vào dây' });
    await expect(members.getByRole('row')).toHaveCount(6); // header + 5 seats
    await expect(page.getByRole('table', { name: 'Các dòng sổ hụi' })).toBeVisible();
    await expect(page.getByText('Bản in này dựng từ dữ liệu on-chain tại thời điểm in.')).toBeVisible();
    await expect(page.getByText('Tổng góp').locator('..')).toContainText('USDC');
    const money = await page.getByRole('table', { name: 'Các dòng sổ hụi' }).locator('tbody td.text-right').allTextContents();
    expect(money.length).toBeGreaterThan(0);
    for (const m of money) expect(m).toMatch(/USDC$/);
    await noHorizontalOverflow(page);
    await noClippedContent(page);
    errs.expectClean();
  });

  test('print preview: A4 sheet without site chrome, with the book, QR and the note', async ({ page }) => {
    await page.goto('/circles/demo/so-ho?ban=day-du');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('header.sticky')).toBeHidden();
    await expect(page.locator('footer')).toBeHidden();
    await expect(page.getByRole('navigation')).toHaveCount(0); // hidden navs are not in the accessibility tree
    await expect(page.getByRole('button', { name: 'In sổ hụi' })).toBeHidden();
    await expect(page.getByText(/In lúc/)).toBeVisible();
    await expect(page.getByRole('img', { name: /Mã QR/ })).toBeVisible();
    await expect(page.getByText('Bản in này dựng từ dữ liệu on-chain tại thời điểm in.')).toBeVisible();
    const over = await page.evaluate(() => Math.max(...[...document.querySelectorAll('main *')].map((e) => e.getBoundingClientRect().right)) - window.innerWidth);
    expect(over, 'content wider than the printable width').toBeLessThanOrEqual(1);
  });

  test('"In sổ hụi" opens the print dialog', async ({ page }) => {
    await page.goto('/circles/demo/so-ho?ban=day-du');
    await page.evaluate(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => {
        (window as unknown as { __printed: number }).__printed++;
      };
    });
    await page.getByRole('button', { name: 'In sổ hụi' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
  });
});
