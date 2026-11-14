import { expect, test } from '@playwright/test';

// B23 part 4: the phone menu floats as a glass pill; a sliding ink pill marks the current tab.
test.describe('floating phone menu', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone layout');

  test('is a 64px pill 12px from both edges and from the bottom, over the content', async ({ page }) => {
    await page.goto('/circles');
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính (điện thoại)' });
    await expect(nav).toBeVisible();
    const box = (await nav.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(Math.round(box.height)).toBe(64);
    expect(Math.round(box.x)).toBe(12);
    expect(Math.round(vp.width - (box.x + box.width))).toBe(12);
    expect(Math.round(vp.height - (box.y + box.height))).toBe(12); // no safe-area inset in the test browser
    const radius = await nav.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(radius).toBe('32px');
  });

  test('four tabs with an icon and a one-word label; the ink pill follows the current one', async ({ page }) => {
    await page.goto('/circles');
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính (điện thoại)' });
    const links = nav.getByRole('link');
    await expect(links).toHaveCount(4);
    for (const label of ['Tổng quan', 'Dây', 'Sổ hụi', 'Dây mới']) {
      const link = nav.getByRole('link', { name: label, exact: true });
      await expect(link.locator('svg')).toHaveCount(1);
    }
    const pill = nav.locator('.pill');
    const centre = async () => {
      const b = (await pill.boundingBox())!;
      return Math.round(b.x + b.width / 2);
    };
    const first = await centre();
    await nav.getByRole('link', { name: 'Sổ hụi', exact: true }).click();
    await expect(page).toHaveURL(/\/so-ho$/);
    await expect(nav.getByRole('link', { name: 'Sổ hụi', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect.poll(centre).toBeGreaterThan(first + 150); // slid to the third slot
    const link = (await nav.getByRole('link', { name: 'Sổ hụi', exact: true }).boundingBox())!;
    const linkCentre = Math.round(link.x + link.width / 2);
    await expect.poll(async () => Math.abs((await centre()) - linkCentre), { timeout: 3000 }).toBeLessThanOrEqual(2); // settled under its tab
  });

  test('the last thing on every main screen can be scrolled clear of the menu', async ({ page }) => {
    for (const path of ['/circles', '/circles/demo', '/circles/demo/so-ho', '/circles/new']) {
      await page.goto(path);
      const nav = (await page.getByRole('navigation', { name: 'Điều hướng chính (điện thoại)' }).boundingBox())!;
      const view = page.locator('#hs-view');
      const pad = await view.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
      expect(pad, path).toBeGreaterThanOrEqual(88);
      // Pinned action bars end above the menu.
      for (const sel of ['.act', '.bondBar', '.crFoot']) {
        const el = page.locator(sel).first();
        if (await el.count()) {
          const b = await el.boundingBox();
          if (b) expect(b.y + b.height, `${path} ${sel}`).toBeLessThanOrEqual(nav.y + 1);
        }
      }
    }
  });

  test('a sheet covers the menu instead of sitting under it', async ({ page }) => {
    await page.goto('/circles/demo');
    await page.getByRole('button', { name: /Xem cách tính/ }).click();
    const sheet = page.getByRole('dialog').first();
    await expect(sheet).toBeVisible();
    const top = await page.evaluate(() => {
      const s = document.querySelector('.sheet.open') as HTMLElement | null;
      const n = document.querySelector('.tabbar') as HTMLElement | null;
      return s && n ? Number(getComputedStyle(s).zIndex) > Number(getComputedStyle(n).zIndex) : null;
    });
    expect(top).toBe(true);
  });
});
