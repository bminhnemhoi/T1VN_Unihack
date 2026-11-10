import { expect, test, type Page } from '@playwright/test';
import { noHorizontalOverflow, tableOrCards, toast, watchErrors } from './helpers';

const step = (page: Page, n: number) => page.getByText(new RegExp(`^Bước ${n} trên 3`));
const next = (page: Page) => page.getByRole('button', { name: 'Tiếp tục' });
/** The visible coverage meter: right column on desktop, bottom sheet on phones. */
const meter = (page: Page) => page.getByRole('meter', { name: 'Chỉ số bảo chứng' }).and(page.locator(':visible'));

async function closeMobileSheet(page: Page) {
  const toggle = page.getByRole('button', { name: /Ẩn bảng/ });
  if (await toggle.isVisible()) await toggle.click();
}

async function openMobileSheet(page: Page) {
  const toggle = page.getByRole('button', { name: /Xem bảng|Ẩn bảng/ });
  if (await toggle.isVisible()) {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  }
}

test.describe('S03 /circles/new', () => {
  test('happy path with docs/03 section 8 values: N=5, C=100, bond 480 -> coverage 100%', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/circles/new');
    await expect(step(page, 1)).toBeVisible();
    await expect(page.getByLabel('Số phần hụi')).toHaveValue('5');
    await expect(page.getByLabel('Mức góp mỗi kỳ')).toHaveValue('100');
    await expect(page.getByRole('radio', { name: 'Tháng (30 ngày)' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Bỏ thăm' })).toBeChecked();
    await next(page).click();

    await expect(step(page, 2)).toBeVisible();
    await expect(page).toHaveURL(/\?buoc=2$/);
    // bond 0 -> 20% (alpha only), not enough to start
    await openMobileSheet(page);
    await expect(meter(page)).toHaveAttribute('aria-valuenow', '20');
    await expect(page.getByText(/Chưa đủ để bắt đầu dây/).filter({ visible: true }).first()).toBeVisible();
    await page.getByLabel('Ký quỹ của chủ hụi').fill('480');
    await expect(meter(page)).toHaveAttribute('aria-valuenow', '100');
    await expect(page.getByText(/Đủ bảo chứng để bắt đầu dây|Đủ để bắt đầu dây/).filter({ visible: true }).first()).toBeVisible();
    await closeMobileSheet(page); // on phones the sheet floats over the form
    await next(page).click();

    await expect(step(page, 3)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Giao kèo dây hụi' })).toBeVisible();
    const contract = page.getByRole('article');
    await expect(contract).toContainText('Ký quỹ của chủ hụi');
    await expect(contract).toContainText('480 USDC');
    await expect(contract).toContainText('100%');
    // bid ceiling table (docs/03 section 8)
    const table = page.getByRole('table', { name: /Trần thăm/ });
    await expect(table.getByRole('row')).toHaveCount(6);
    await expect(table).toContainText('6,575342 USDC');
    await expect(table).toContainText('1,643835 USDC');
    await noHorizontalOverflow(page);
    errs.expectClean();
  });

  test('last step: "Tạo dây" asks for the 18+ box first, then says it is not wired yet', async ({ page }) => {
    await page.goto('/circles/new?buoc=3');
    await expect(step(page, 3)).toBeVisible();
    await page.getByRole('button', { name: 'Tạo dây', exact: true }).click();
    await expect(toast(page, 'đủ 18 tuổi')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /đủ 18 tuổi/ })).toBeFocused();
    await page.getByRole('checkbox', { name: /đủ 18 tuổi/ }).click();
    await page.getByRole('button', { name: 'Tạo dây', exact: true }).click();
    await expect(toast(page, 'Hiện là màn hình mẫu, chưa có dây nào được tạo')).toBeVisible();
  });

  test('Nghị định 19 panel: second checkbox and the notice button', async ({ page }) => {
    await page.goto('/circles/new?buoc=3');
    await expect(page.getByText('Cần thông báo bằng văn bản cho UBND')).toHaveCount(0);
    await page.getByRole('checkbox', { name: /đang làm chủ hụi một dây khác/ }).click();
    await expect(page.getByText('Cần thông báo bằng văn bản cho UBND')).toBeVisible();
    await page.getByRole('link', { name: 'Soạn thông báo' }).click();
    await expect(page).toHaveURL(/\/thong-bao-ubnd$/);
  });

  test('inline validation in Vietnamese, and a blocked "Tiếp tục" explains itself and focuses the bad field', async ({ page }) => {
    await page.goto('/circles/new');
    const n = page.getByLabel('Số phần hụi');
    await n.fill('2');
    await expect(page.getByText('Số phần phải từ 3 đến 30.')).toBeVisible();
    await expect(n).toHaveAttribute('aria-invalid', 'true');
    await next(page).click();
    await expect(step(page, 1)).toBeVisible(); // did not advance
    await expect(page.getByText('Sửa các ô báo lỗi để tiếp tục.')).toBeVisible();
    await expect(n).toBeFocused();
    await n.fill('abc');
    await expect(page.getByText('Số phần phải từ 3 đến 30.')).toBeVisible();
    await n.fill('31');
    await expect(page.getByText('Số phần phải từ 3 đến 30.')).toBeVisible();
    await n.fill('30');
    await expect(page.getByText('Số phần phải từ 3 đến 30.')).toHaveCount(0);
    await page.getByLabel('Mức góp mỗi kỳ').fill('0');
    await expect(page.getByText('Mức góp phải từ 1 đến 10.000 USDC.')).toBeVisible();
  });

  test('amounts show what the app understood, in vi-VN format, and use a numeric keypad', async ({ page }) => {
    await page.goto('/circles/new');
    const c = page.getByLabel('Mức góp mỗi kỳ');
    await expect(c).toHaveAttribute('inputmode', 'decimal');
    await expect(page.getByLabel('Số phần hụi')).toHaveAttribute('inputmode', 'numeric');
    await c.fill('1200');
    await expect(page.getByText('= 1.200 USDC')).toBeVisible();
    await c.fill('12,5');
    await expect(page.getByText('= 12,5 USDC')).toHaveCount(0); // same as typed, nothing to add
  });

  test('Enter moves to the next step; Back button, browser Back and reload keep what was typed', async ({ page }) => {
    await page.goto('/circles/new');
    await page.getByLabel('Số phần hụi').fill('8');
    await page.getByLabel('Mức góp mỗi kỳ').fill('250');
    await page.getByLabel('Mức góp mỗi kỳ').press('Enter');
    await expect(step(page, 2)).toBeVisible();
    await page.getByLabel('Ký quỹ của chủ hụi').fill('900');

    await page.reload(); // sessionStorage + ?buoc=2
    await expect(step(page, 2)).toBeVisible();
    await expect(page.getByLabel('Ký quỹ của chủ hụi')).toHaveValue('900');

    await page.getByRole('button', { name: 'Quay lại' }).click();
    await expect(step(page, 1)).toBeVisible();
    await expect(page.getByLabel('Số phần hụi')).toHaveValue('8');
    await expect(page.getByLabel('Mức góp mỗi kỳ')).toHaveValue('250');

    await next(page).click();
    await next(page).click();
    await expect(step(page, 3)).toBeVisible();
    await page.goBack();
    await expect(step(page, 2)).toBeVisible();
    await page.goBack();
    await expect(step(page, 1)).toBeVisible();
    await expect(page).toHaveURL(/\/circles\/new$/);
    await page.goForward();
    await expect(step(page, 2)).toBeVisible();
    await expect(page.getByLabel('Ký quỹ của chủ hụi')).toHaveValue('900');
  });

  test('deep link to a later step is held back while an earlier step is invalid', async ({ page }) => {
    await page.goto('/circles/new');
    await page.getByLabel('Số phần hụi').fill('1');
    await page.goto('/circles/new?buoc=3');
    await expect(step(page, 1)).toBeVisible();
    await expect(page.getByLabel('Số phần hụi')).toHaveValue('1');
  });

  test('four fields of the brief: số người, mức góp, chu kỳ Tuần/Tháng, kiểu chia; weekly warns that the ceiling is tiny', async ({ page }) => {
    await page.goto('/circles/new');
    await expect(page.getByRole('radio', { name: 'Tuần (7 ngày)' })).not.toBeChecked();
    await page.getByRole('radio', { name: 'Tuần (7 ngày)' }).click();
    await expect(page.getByRole('radio', { name: 'Tuần (7 ngày)' })).toBeChecked();
    await next(page).click();
    await next(page).click();
    await expect(step(page, 3)).toBeVisible();
    await expect(page.getByRole('list', { name: 'Cảnh báo về cấu hình dây' })).toContainText('Trần thăm kỳ 1 chỉ bằng');
  });

  test('review step: fairness meter follows the bid assumption, risk table lists every seat', async ({ page }) => {
    await page.goto('/circles/new?buoc=2');
    await page.getByLabel('Ký quỹ của chủ hụi').fill('480');
    await closeMobileSheet(page);
    await next(page).click();
    const fair = page.getByRole('region', { name: 'Đồng hồ công bằng' });
    await expect(fair).toBeVisible();
    await expect(fair.getByRole('listitem').filter({ hasText: /^Kỳ \d/ })).toHaveCount(5);
    await fair.getByRole('radio', { name: 'Ai cũng đặt trần' }).click();
    await expect(fair).toContainText('Chênh lệch giữa');
    await fair.getByRole('radio', { name: 'Không ai bỏ thăm' }).click();
    const risk = tableOrCards(page, /Số tiền tối đa mỗi chỗ/);
    // five seats: a header row and 5 rows in the table, 5 cards on a phone
    if ((page.viewportSize()?.width ?? 1440) >= 768) await expect(risk.getByRole('row')).toHaveCount(6);
    else await expect(risk.getByRole('listitem')).toHaveCount(5);
    await expect(risk).toContainText('304 USDC'); // docs/03 section 7.3: the last seat if receivers stop one after another
    await expect(page.getByText('chịu được 4 người đã hốt cùng bỏ đóng')).toBeVisible();
  });

  test('Fixed mode: no bid assumption, every seat pays the same', async ({ page }) => {
    await page.goto('/circles/new');
    await page.getByRole('radio', { name: 'Cố định (hốt lần lượt)' }).click();
    await next(page).click();
    await next(page).click();
    const fair = page.getByRole('region', { name: 'Đồng hồ công bằng' });
    await expect(fair).toContainText('mọi chỗ ngồi chịu như nhau');
    await expect(fair).toContainText('chênh nhau 0');
  });

  test('"Nhập lại từ đầu" clears the form; Fixed mode hides the bid table; commission switch toggles the fee field', async ({ page }) => {
    await page.goto('/circles/new');
    await page.getByLabel('Số phần hụi').fill('12');
    await page.getByRole('button', { name: 'Nhập lại từ đầu' }).click();
    await expect(page.getByLabel('Số phần hụi')).toHaveValue('5');
    await expect(toast(page, 'Đã xóa các ô đã nhập')).toBeVisible();

    await page.getByRole('radio', { name: 'Cố định (hốt lần lượt)' }).click();
    await next(page).click();
    const sw = page.getByRole('switch', { name: /Dây hưởng hoa hồng/ });
    await expect(page.getByLabel('Tiền công trên mỗi kỳ')).toBeEnabled();
    await sw.click();
    await expect(page.getByLabel('Tiền công trên mỗi kỳ')).toBeDisabled();
    await expect(page.getByText('Đang tắt vì dây này không hưởng hoa hồng.')).toBeVisible();
    await sw.click();
    await expect(page.getByLabel('Tiền công trên mỗi kỳ')).toBeEnabled();
    await next(page).click();
    await expect(page.getByText('Dây cố định hốt lần lượt không bỏ thăm, nên không có trần thăm.')).toBeVisible();
    await expect(page.getByRole('table', { name: /Trần thăm/ })).toHaveCount(0);
  });

  test('"Điền ký quỹ" fills the amount needed for 100%', async ({ page }) => {
    await page.goto('/circles/new?buoc=2');
    await openMobileSheet(page);
    await page.getByRole('button', { name: /^Điền ký quỹ/ }).and(page.locator(':visible')).click();
    await expect(page.getByLabel('Ký quỹ của chủ hụi')).toHaveValue('480');
    await expect(meter(page)).toHaveAttribute('aria-valuenow', '100');
  });
});

test.describe('S03 coverage panel on phones', () => {
  test('bar is always visible; the sheet opens, closes with the button and with Escape', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout only');
    await page.goto('/circles/new');
    const toggle = page.getByRole('button', { name: /Xem bảng/ });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByRole('region', { name: 'Bảng bảo chứng' })).toBeVisible();
    await page.getByRole('button', { name: /Ẩn bảng/ }).click();
    await expect(page.getByRole('region', { name: 'Bảng bảo chứng' })).toHaveCount(0);
    await page.getByRole('button', { name: /Xem bảng/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: 'Bảng bảo chứng' })).toHaveCount(0);
    // no duplicated ids even when both panels exist
    await page.getByRole('button', { name: /Xem bảng/ }).click();
    const dup = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
      return ids.filter((id, i) => ids.indexOf(id) !== i);
    });
    expect(dup).toEqual([]);
  });

  test('v1.2: the commission share turns into money per round, the agreement hash follows it', async ({ page }) => {
    await page.goto('/circles/new');
    await next(page).click();
    await expect(page.getByLabel('Phần hoa hồng của chủ hụi')).toHaveValue('50');
    await expect(page.getByLabel('Trần hoa hồng mỗi lần hốt')).toHaveValue('3');
    await expect(page.getByText(/Kỳ 1: chủ hụi nhận tối đa 12 USDC, thăm tối đa 3,287671 USDC \(trần luật 6,575342 USDC\)/)).toBeVisible();
    await page.getByLabel('Ký quỹ của chủ hụi').fill('480');
    await closeMobileSheet(page);
    await next(page).click();
    const table = page.getByRole('table', { name: /Trần thăm theo luật, trần thăm thực thi và hoa hồng/ });
    await expect(table.getByRole('row')).toHaveCount(6);
    await expect(table).toContainText('3,287671 USDC'); // enforced ceiling of round 1 = half the legal one
    await expect(table).toContainText('7,397259 USDC'); // phi x room of round 2 (docs/03 section 8.1)
    const first = await page.getByTestId('agreement-hash').innerText();
    await page.getByRole('button', { name: 'Quay lại' }).click();
    await page.getByLabel('Phần hoa hồng của chủ hụi').fill('30');
    await next(page).click();
    await expect(page.getByTestId('agreement-hash')).not.toHaveText(first);
    await noHorizontalOverflow(page);
  });

  test('v1.2: a share above 50% is refused, and Fixed circles have no share field', async ({ page }) => {
    await page.goto('/circles/new');
    await next(page).click();
    await page.getByLabel('Phần hoa hồng của chủ hụi').fill('60');
    await next(page).click();
    await expect(page.getByText('Phần hoa hồng phải từ 0% đến 50%.')).toBeVisible();
    await page.getByRole('button', { name: 'Quay lại' }).click();
    await page.getByRole('radio', { name: 'Cố định (hốt lần lượt)' }).click();
    await next(page).click();
    await expect(page.getByLabel('Phần hoa hồng của chủ hụi')).toHaveCount(0);
  });
});
