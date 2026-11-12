import { afterIntro } from './helpers';
import { expect, test, type Locator, type Page } from '@playwright/test';

/** B17 regression: objective layout faults found in UI-REVIEW-B16 must not come back. Runs at 390, 768 and 1440. */
const CIRCLES = ['demo', 'co-dinh', 'dang-gom', 'da-xong'];
const PAGES = [
  '/',
  '/dang-nhap',
  '/circles',
  '/circles/new',
  '/moi/dang-gom',
  '/cai-dat',
  '/thong-bao-ubnd',
  '/lab',
  ...CIRCLES.map((id) => `/circles/${id}`),
  ...CIRCLES.flatMap((id) => ['ket-qua', 'thieu', 'bao-chung', 'giu-lai', 'so-ho', 'tat-toan'].map((s) => `/circles/${id}/${s}`)),
];

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await afterIntro(page);
  // Some faults only appear after the data has rendered (S08 grew from 390 to 406px 1.5 s after the load event); measuring at once misses them.
  await page.waitForTimeout(1200);
}

test.describe('no page scrolls sideways, after the data has rendered', () => {
  for (const path of PAGES) {
    test(path, async ({ page }) => {
      await open(page, path);
      const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(m.scroll, `scrollWidth ${m.scroll} > clientWidth ${m.client}`).toBeLessThanOrEqual(m.client);
    });
  }
});

/** Width and height of the area that really answers a tap on `el`: probes the points around it, so a transparent ::after counts. */
async function hitSize(el: Locator): Promise<{ w: number; h: number }> {
  await el.scrollIntoViewIfNeeded();
  return el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    const owner = (t: Element | null) => t && (t === node || node.contains(t));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let y = r.top - 40; y <= r.bottom + 40; y += 2) {
      for (let x = Math.max(0, r.left - 40); x <= Math.min(innerWidth - 1, r.right + 40); x += 2) {
        if (owner(document.elementFromPoint(x, y))) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
    return { w: maxX - minX + 2, h: maxY - minY + 2 };
  });
}

test.describe('touch targets of at least 48px (docs/02 design brief)', () => {
  test('every button of the design system is 48px or more, on every screen', async ({ page }) => {
    for (const path of ['/', '/circles', '/circles/new', '/moi/dang-gom', '/circles/dang-gom', '/circles/demo', '/circles/demo/thieu', '/circles/da-xong/tat-toan', '/cai-dat', '/thong-bao-ubnd', '/lab']) {
      await open(page, path);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[data-slot="button"], [data-slot="toggle-group-item"]')]
          .map((e) => ({ e, r: e.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < 48 || r.width < 48))
          .map(({ e, r }) => `${(e.textContent ?? '').trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`),
      );
      expect(small, `${path}: controls under 48px`).toEqual([]);
    }
  });

  test('web-app controls (prototype B22) are 44px or more: tabs, buttons, chips, rounds, ledger dots', async ({ page }) => {
    for (const path of ['/circles', '/circles/demo', '/circles/demo/so-ho', '/circles/new']) {
      await open(page, path);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.hs .btn, .hs .tabs a, .hs .tabbar a, .hs .acct a, .hs .acct > button, .hs .chips button, .hs .seg button, .hs .storyNav > button, .hs .rail button, .hs .dots button, .hs .opt, .hs .peek')]
          .map((e) => ({ e, r: e.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 32))
          .map(({ e, r }) => `${(e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`),
      );
      expect(small, `${path}: controls under 44px`).toEqual([]);
    }
  });

  test('the age checkbox and links inside text have a 48px touch area', async ({ page }) => {
    await open(page, '/moi/dang-gom');
    const box = await hitSize(page.getByRole('checkbox'));
    expect(box.h, 'checkbox height').toBeGreaterThanOrEqual(48);
    for (const [path, name] of [['/circles/co-dinh/ket-qua', 'Xem khoản thiếu'], ['/circles/demo/thieu', 'Xem thác bù'], ['/circles/da-xong/tat-toan', 'Xem sổ hụi']] as const) {
      await open(page, path);
      const link = await hitSize(page.getByRole('link', { name }).first());
      expect(link.h, `${name} height`).toBeGreaterThanOrEqual(46); // 24px text line + two 12.8px margins, probed in steps of 2px
    }
  });

  test('a link\'s larger touch area never covers the centre of a button', async ({ page }) => {
    for (const path of ['/circles/demo/thieu', '/circles/da-xong/tat-toan', '/circles/co-dinh/ket-qua', '/circles/demo/bao-chung']) {
      await open(page, path);
      const stolen = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('main button, main [data-slot="button"]')]
          .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
          .filter((b) => {
            b.scrollIntoView({ block: 'center' }); // elementFromPoint answers null outside the screen
            const r = b.getBoundingClientRect();
            const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return !(t && (t === b || b.contains(t)));
          })
          .map((b) => (b.textContent ?? '').trim().slice(0, 30)),
      );
      expect(stolen, `${path}: button centres covered by something else`).toEqual([]);
    }
  });
});

test.describe('B17 specific faults', () => {
  test('S12 and S05: no wide table hides result columns, the rows are cards below 1024px / 768px', async ({ page }) => {
    const w = page.viewportSize()?.width ?? 1440;
    await open(page, '/circles/da-xong/tat-toan');
    const cards = page.getByRole('list', { name: 'Tất toán của từng thành viên' });
    if (w < 1024) await expect(cards.getByRole('listitem').first()).toContainText('Ròng');
    else await expect(page.getByRole('region', { name: /Bảng tất toán/ })).toBeVisible();
    await open(page, '/moi/dang-gom');
    const risk = page.getByRole('list', { name: 'Số tiền tối đa mỗi chỗ có thể mất, theo kỳ hốt' });
    if (w < 768) await expect(risk.getByRole('listitem').first()).toContainText('Mất tối đa');
    else await expect(page.getByRole('region', { name: /Bảng số tiền tối đa/ })).toBeVisible();
  });

  test('toggle buttons and button labels stay inside their own box (S08 role switch, S04 copy button)', async ({ page }) => {
    for (const path of ['/circles/demo/thieu', '/circles/dang-gom', '/circles/new', '/lab']) {
      await open(page, path);
      const cut = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[data-slot="toggle-group-item"], [data-slot="button"]')]
          .filter((e) => e.getBoundingClientRect().width > 0 && e.scrollWidth > e.clientWidth + 1)
          .map((e) => `${(e.textContent ?? '').trim().slice(0, 40)} ${e.scrollWidth}>${e.clientWidth}`),
      );
      expect(cut, `${path}: label wider than its button`).toEqual([]);
    }
  });

  test('a section page of a circle keeps the "Dây" tab current', async ({ page }) => {
    await open(page, '/circles/demo/giu-lai');
    await expect(page.getByRole('navigation', { name: /^Điều hướng chính/ }).locator('[aria-current="page"]')).toHaveText(/Dây$/);
  });
});
