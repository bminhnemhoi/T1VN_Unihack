import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * W12: WCAG 2.2 AA on every route (axe), plus keyboard-only passes through the three places where a mistake costs money:
 * the create-circle form, the bid room and the assistant drawer. Serious and critical findings fail the test.
 */
const ROUTES = [
  '/',
  '/circles',
  '/circles/new',
  '/dang-nhap',
  '/moi/dang-gom',
  '/cai-dat',
  '/thong-bao-ubnd',
  '/lab',
  ...['demo', 'co-dinh', 'dang-gom', 'da-xong'].flatMap((id) => [`/circles/${id}`, ...['ket-qua', 'thieu', 'bao-chung', 'giu-lai', 'so-ho', 'tat-toan'].map((s) => `/circles/${id}/${s}`)]),
];

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function scan(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n  ')}`);
}

test.describe('axe: no serious or critical WCAG 2.2 AA violation', () => {
  for (const path of ROUTES) {
    test(path, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      expect(await scan(page)).toEqual([]);
    });
  }
});

test.describe('axe: states that need a click', () => {
  test('assistant drawer open', async ({ page }) => {
    await page.goto('/circles/new');
    await page.getByRole('button', { name: 'Trợ lý' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Trợ lý AI cho chủ hụi' })).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });
  test('create form, step 2', async ({ page }) => {
    await page.goto('/circles/new?buoc=2');
    expect(await scan(page)).toEqual([]);
  });
});

test.describe('banner demo', () => {
  for (const path of ['/', '/circles', '/circles/new', '/circles/demo', '/circles/demo/so-ho', '/dang-nhap', '/cai-dat', '/thong-bao-ubnd', '/lab']) {
    test(`${path} shows the demo strip`, async ({ page }) => {
      await page.goto(path);
      const banner = page.getByTestId('demo-banner');
      await expect(banner).toHaveCount(1);
      await expect(banner).toContainText('Chế độ demo: 1 kỳ = 3 phút, lãi tính như hụi tháng');
      await expect(banner).toHaveAttribute('role', 'status');
    });
  }
});

test.describe('keyboard only', () => {
  test('create form: Tab reaches every field of step 1 and focus is always on something visible', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard path is checked on the desktop project');
    await page.goto('/circles/new');
    const reached = new Set<string>();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const label = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement | null;
        if (!e) return '';
        return e.getAttribute('aria-label') || (e as HTMLInputElement).labels?.[0]?.textContent || e.textContent || '';
      });
      reached.add(label.trim());
      const visible = await page.evaluate(() => {
        const r = document.activeElement?.getBoundingClientRect();
        return !!r && r.width > 0 && r.height > 0;
      });
      expect(visible, `focus is on something invisible after ${i + 1} Tab presses`).toBe(true);
    }
    expect([...reached].some((l) => l.includes('Số phần hụi'))).toBe(true);
    expect([...reached].some((l) => l.includes('Mức góp mỗi kỳ'))).toBe(true);
    expect([...reached].some((l) => l.includes('Tiếp tục'))).toBe(true);

  });

  test('create form: a radio takes the arrow keys, and Enter on "Tiếp tục" goes to step 2', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard path is checked on the desktop project');
    await page.goto('/circles/new');
    await page.getByRole('radio', { name: 'Bỏ thăm' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('radio', { name: 'Cố định' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Bỏ thăm' })).toBeFocused();
    await page.getByRole('button', { name: 'Tiếp tục' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\?buoc=2$/);
  });

  test('bid room: the phase switch, the bid field and the seal button work without a mouse, with a visible focus ring', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard path is checked on the desktop project');
    await page.goto('/circles/demo');
    const seal = page.getByRole('button', { name: 'Niêm phong thăm' });
    await expect(seal).toBeVisible();
    const bid = page.getByLabel('Tiền thăm mỗi phần hụi trả bớt');
    await bid.focus();
    await bid.fill('3');
    await seal.focus();
    const ring = await seal.evaluate((e) => {
      const s = getComputedStyle(e);
      return `${s.outlineStyle}|${s.outlineWidth}|${s.boxShadow}`;
    });
    expect(ring, 'focused button has no visible ring').not.toBe('none|0px|none');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Đã niêm phong thăm của bạn.')).toBeVisible();
  });

  test('assistant drawer: opens from the keyboard, traps focus, Escape closes and returns focus to the button', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard path is checked on the desktop project');
    await page.goto('/circles/new');
    const trigger = page.getByRole('button', { name: 'Trợ lý' }).first();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Trợ lý AI cho chủ hụi' });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement)), `focus left the dialog after ${i + 1} Tab presses`).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
