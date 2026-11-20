import { expect, test, type Page } from '@playwright/test';
import { demoClick, noHorizontalOverflow, toast, watchErrors } from './helpers';

/**
 * B25: "Xóa" a cancelled circle. The sample list has one: "Hụi tổ dân phố 9", cancelled, with the organizer's 48 USDC bond
 * still in it. A circle cannot be deleted on the blockchain, so deleting hides it for this wallet on this device, and when
 * a bond is left it is withdrawn first. These tests run on sample data: the three steps are simulated, nothing is sent.
 */
const NAME = 'Hụi tổ dân phố 9';
const row = (page: Page) => page.locator('li[data-row]').filter({ hasText: NAME });
const list = (page: Page) => page.getByRole('list', { name: 'Các dây của bạn' });

test.describe('delete a cancelled circle', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Start from an empty hidden list once per test (a reload inside the test must keep what the test stored).
    await page.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('seeded')) {
          sessionStorage.setItem('seeded', '1');
          localStorage.removeItem('huisafe.hidden.sample');
        }
      } catch {
        /* no storage */
      }
    });
  });

  test('the row says ĐÃ HỦY, why, and offers a 44px "Xóa" button; the other rows do not', async ({ page }) => {
    await page.goto('/circles');
    await expect(row(page)).toContainText('Đã hủy');
    await expect(row(page)).toContainText('Hủy vì không đủ người trước hạn · bạn là chủ hụi · rút ký quỹ');
    const del = row(page).getByRole('button', { name: `Xóa dây ${NAME}` });
    await expect(del).toBeVisible();
    const box = (await del.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole('button', { name: /^Xóa dây/ })).toHaveCount(1);
  });

  test('the dialog tells the truth: the bond comes back, the circle is hidden, the book stays; Esc closes and returns focus', async ({ page }) => {
    await page.goto('/circles');
    const del = row(page).getByRole('button', { name: `Xóa dây ${NAME}` });
    await del.click();
    const dialog = page.getByRole('dialog', { name: `Xóa dây "${NAME}"?` });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Dây còn 48,00 USDC ký quỹ của bạn. Xóa sẽ rút 48,00 USDC về ví rồi ẩn dây khỏi danh sách. Sổ trên blockchain vẫn giữ.');
    await expect(dialog).toContainText('Dây là smart contract trên blockchain nên không xóa hẳn được');
    await expect(dialog.getByRole('button', { name: 'Rút 48,00 USDC và xóa' })).toBeVisible();
    await expect(dialog.getByRole('heading')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(del).toBeFocused();
    await expect(row(page)).toHaveCount(1); // nothing was deleted
  });

  test('focus stays inside the dialog (Tab and Shift+Tab wrap)', async ({ page }) => {
    await page.goto('/circles');
    await row(page).getByRole('button', { name: `Xóa dây ${NAME}` }).click();
    const dialog = page.getByRole('dialog');
    const inside = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
    await expect(dialog.getByRole('heading')).toBeFocused(); // the dialog moves focus to its title on open
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(await inside()).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    expect(await inside()).toBe(true);
    await expect(dialog).toBeVisible();
  });

  test('"Giữ lại" keeps the circle', async ({ page }) => {
    await page.goto('/circles');
    await row(page).getByRole('button', { name: `Xóa dây ${NAME}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Giữ lại' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(row(page)).toHaveCount(1);
  });

  test('withdraw and delete: Ký → Gửi → Xác nhận, then the row goes, a toast offers "Hoàn tác" and it comes back', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/circles');
    await row(page).getByRole('button', { name: `Xóa dây ${NAME}` }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Rút 48,00 USDC và xóa' }).click();
    await expect(dialog.getByRole('button', { name: /Đang chờ bạn ký/ })).toBeDisabled(); // locked while it runs
    await expect(row(page)).toHaveCount(1); // never hidden before the receipt
    await expect(dialog).toBeHidden({ timeout: 6000 });
    await expect(row(page)).toHaveCount(0);
    const t = toast(page, `Đã xóa dây "${NAME}"`);
    await expect(t).toBeVisible();
    await t.getByRole('button', { name: 'Hoàn tác' }).click();
    await expect(row(page)).toHaveCount(1);
    errs.expectClean();
  });

  test('it stays hidden after a reload (the list lives in this browser, keyed per wallet)', async ({ page }) => {
    await page.goto('/circles');
    await row(page).getByRole('button', { name: `Xóa dây ${NAME}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Rút 48,00 USDC và xóa' }).click();
    await expect(row(page)).toHaveCount(0, { timeout: 6000 });
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('huisafe.hidden.sample')))!)).toEqual([{ id: 'e', label: NAME }]);
    await page.reload();
    await expect(list(page).getByRole('heading', { level: 3 })).toHaveCount(3); // the finished circle is folded under "Đã kết thúc"
    await expect(row(page)).toHaveCount(0);
  });

  test('a failed network hides nothing and says so; the button offers a retry', async ({ page }) => {
    await page.goto('/circles');
    await demoClick(page, /^Thử:/, 2); // thường → mạng chậm → lỗi mạng
    await row(page).getByRole('button', { name: `Xóa dây ${NAME}` }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Rút 48,00 USDC và xóa' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Lệnh chưa lên blockchain, bạn chưa mất gì', { timeout: 8000 });
    await expect(dialog.getByRole('button', { name: 'Thử lại' })).toBeVisible();
    await expect(row(page)).toHaveCount(1);
  });

  for (const [w, h] of [[360, 740], [390, 844], [768, 1024], [1440, 900]] as const) {
    test(`layout at ${w}px: no sideways scroll, the dialog fits the screen, the button is reachable without a swipe`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/circles');
      const del = row(page).getByRole('button', { name: `Xóa dây ${NAME}` });
      await del.scrollIntoViewIfNeeded();
      await expect(del).toBeInViewport();
      await noHorizontalOverflow(page);
      await del.click();
      const card = page.getByTestId('delete-dialog');
      await expect(card).toBeVisible();
      const b = (await card.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(w + 1);
      expect(b.y + b.height).toBeLessThanOrEqual(h + 1);
      await noHorizontalOverflow(page);
    });
  }
});

test.describe('delete with motion', () => {
  test('the amount flies to the top bar and the row leaves, in under a second and a half; the end state is the same', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'the flight target is the same on phones; one project is enough');
    await page.goto('/circles');
    // Watch the page itself: the flight lasts half a second, a poll could blink and miss it. Records when the flying
    // amount is added and removed, and when the row leaves the list.
    await page.evaluate(() => {
      const w = window as unknown as { __m: { flyIn?: number; flyOut?: number; flyText?: string; rowOut?: number } };
      w.__m = {};
      new MutationObserver((recs) => {
        for (const r of recs) {
          r.addedNodes.forEach((n) => {
            if (n instanceof HTMLElement && n.tagName === 'SPAN' && n.textContent?.startsWith('+')) {
              w.__m.flyIn = performance.now();
              w.__m.flyText = n.textContent;
            }
          });
          r.removedNodes.forEach((n) => {
            if (n instanceof HTMLElement && n.tagName === 'SPAN' && n.textContent?.startsWith('+')) w.__m.flyOut = performance.now();
          });
        }
      }).observe(document.body, { childList: true });
      const ul = document.querySelector('ul.circles')!;
      new MutationObserver((recs) => {
        for (const r of recs) r.removedNodes.forEach((n) => n instanceof HTMLElement && n.getAttribute('data-row') === 'e' && (w.__m.rowOut = performance.now()));
      }).observe(ul, { childList: true });
    });
    await row(page).getByRole('button', { name: `Xóa dây ${NAME}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Rút 48,00 USDC và xóa' }).click();
    await expect(row(page)).toHaveCount(0, { timeout: 8000 });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => (window as unknown as { __m: { flyIn?: number; flyOut?: number; flyText?: string; rowOut?: number } }).__m);
    expect(m.flyText).toBe('+48 USDC'); // same notation as the balance chip it flies to
    expect(m.flyOut! - m.flyIn!, 'the flight takes about half a second').toBeGreaterThan(350);
    expect(m.flyOut! - m.flyIn!).toBeLessThan(700);
    expect(m.rowOut! - m.flyIn!, 'the row leaves while the flight is finishing: whole motion under 0.9 s + one frame').toBeLessThan(1000);
    expect(m.rowOut!).toBeGreaterThan(m.flyIn! + 400); // after the flight is under way, not before
    await expect(page.locator('body > span[aria-hidden="true"]')).toHaveCount(0); // cleaned up
    await expect(toast(page, `Đã xóa dây "${NAME}"`)).toBeVisible();
  });
});

test.describe('Cài đặt: dây đã ẩn', () => {
  test('empty at first; a hidden circle is listed and "Hiện lại" puts it back in the Overview', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('seeded')) {
          sessionStorage.setItem('seeded', '1');
          localStorage.removeItem('huisafe.hidden.sample');
        }
      } catch {
        /* no storage */
      }
    });
    await page.goto('/cai-dat');
    const section = page.getByTestId('hidden-circles');
    await expect(section).toContainText('Chưa ẩn dây nào.');
    await page.goto('/circles');
    await row(page).getByRole('button', { name: `Xóa dây ${NAME}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Rút 48,00 USDC và xóa' }).click();
    await expect(row(page)).toHaveCount(0, { timeout: 6000 });
    await page.goto('/cai-dat');
    await expect(section.getByRole('list', { name: 'Dây đã ẩn' })).toContainText(NAME);
    await section.getByRole('button', { name: `Hiện lại dây ${NAME}` }).click();
    await expect(section).toContainText('Chưa ẩn dây nào.');
    await page.goto('/circles');
    await expect(list(page).getByRole('heading', { level: 3, name: NAME })).toBeVisible();
  });
});

test.describe('archive a finished circle', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('seeded')) {
          sessionStorage.setItem('seeded', '1');
          localStorage.removeItem('huisafe.hidden.sample');
        }
      } catch {
        /* no storage */
      }
    });
  });

  test('"Lưu trữ" hides it without any transaction, "Hoàn tác" brings it back, and the group disappears when empty', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/circles');
    await page.getByText('Đã kết thúc', { exact: true }).click();
    await page.getByRole('button', { name: 'Lưu trữ dây Hụi chị em văn phòng' }).click();
    const dialog = page.getByTestId('delete-dialog');
    await expect(dialog.getByRole('heading')).toHaveText('Lưu trữ dây "Hụi chị em văn phòng"?');
    await expect(dialog).toContainText('đã xong');
    await expect(dialog).toContainText('Cài đặt → Dây đã ẩn');
    await expect(dialog).not.toContainText('Ký');
    await dialog.getByRole('button', { name: 'Lưu trữ', exact: true }).click();
    await expect(page.getByTestId('ended-group')).toHaveCount(0);
    await toast(page, 'Đã lưu trữ dây "Hụi chị em văn phòng"').getByRole('button', { name: 'Hoàn tác' }).click();
    await expect(page.getByTestId('ended-group')).toContainText('1 dây');
    errs.expectClean();
  });
});
