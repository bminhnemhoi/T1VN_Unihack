import { expect, test } from '@playwright/test';
import { scanOverlaps } from './overlap-scan';

/**
 * B24 section D: browser zoom and enlarged browser text must not stack text on text or scroll the page sideways.
 * A reader on a 2440 px screen at 200% zoom sees a 1220 px wide viewport; at 300% a 480 px one. We cannot change the real
 * zoom factor, but zoom only changes the CSS viewport, so the same viewport widths reproduce it. "Text 200%" sets the root
 * font size, which is what the browser's font-size setting does. Runs once (the desktop project); motion off so the layout
 * is measured at rest.
 */
const WIDTHS = [1100, 720, 480];
const PAGES: [string, string][] = [
  ['/', '[data-lp-root]'],
  ['/circles', '#noi-dung'],
  ['/circles/demo', '#noi-dung'],
  ['/circles/new', '#noi-dung'],
  ['/cai-dat', '#noi-dung'],
  ['/dang-nhap', '#noi-dung'],
];

test.describe('zoom and text size', () => {
  test.skip(({ isMobile }) => !!isMobile, 'one project is enough: the viewport is set per test');
  test.use({ reducedMotion: 'reduce' });
  test.setTimeout(120_000);

  for (const width of WIDTHS) {
    test(`no text on text, no sideways scroll at ${width}px (${Math.round((1440 / width) * 100)}% zoom of a 1440 screen)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const [path, root] of PAGES) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        const r = await page.evaluate(scanOverlaps, root);
        expect(r.hits, `${path} at ${width}px: text boxes overlap`).toEqual([]);
        expect(r.clip, `${path} at ${width}px: text clipped by its parent`).toEqual([]);
        expect(r.scrollW, `${path} at ${width}px scrolls sideways`).toBeLessThanOrEqual(r.viewW + 1);
      }
    });
  }

  for (const width of [1440, 720]) {
    test(`browser text at 200% keeps the layout at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const [path, root] of PAGES) {
        await page.goto(path);
        await page.addStyleTag({ content: 'html{font-size:200%}' });
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        const r = await page.evaluate(scanOverlaps, root);
        expect(r.hits, `${path} at ${width}px, text 200%: text boxes overlap`).toEqual([]);
        expect(r.clip, `${path} at ${width}px, text 200%: text clipped by its parent`).toEqual([]);
        expect(r.scrollW, `${path} at ${width}px, text 200% scrolls sideways`).toBeLessThanOrEqual(r.viewW + 1);
      }
    });
  }

  test('the landing hero stays in flow after its entrance, with motion on (1100px)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, reducedMotion: 'no-preference', locale: 'vi-VN' });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(6500); // intro hand-off (about 1.7 s) + the hero entrance (about 3 s)
    // Only the hero: the sections below have not been scrolled to, so their scroll reveals still sit in their start poses.
    const r = await page.evaluate(scanOverlaps, '[data-lp-hero]');
    expect(r.hits, 'hero text overlaps once the entrance has played').toEqual([]);
    expect(r.scrollW).toBeLessThanOrEqual(r.viewW + 1);
    await ctx.close();
  });

  // B24 bug 4: logo, DEMO chip and the account strip share ONE row on phones. The sample build has no Privy session, so the
  // strip is dressed like a signed-in one (address, balance, sign out) with the longest balance the chip can show.
  for (const width of [360, 375, 390, 414]) {
    test(`phone top bar is one row at ${width}px, tap targets stay 44px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/circles');
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => {
        const acct = document.querySelector('.acct')!;
        const login = [...acct.children].find((e) => e.getAttribute('aria-label') === 'Đăng nhập')!;
        const addr = document.createElement('button');
        addr.type = 'button';
        addr.className = 'addr mono';
        addr.setAttribute('data-testid', 'wallet-address');
        addr.innerHTML = '<span class="addrDot" aria-hidden="true"></span><span class="addrTxt">0x6e55…5A63</span><svg class="addrIco" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/></svg>';
        const bal = document.createElement('a');
        bal.href = '/cai-dat#so-du';
        bal.className = 'bal mono';
        bal.innerHTML = '<span class="bFull">1.234,56 USDC</span><span class="bShort" aria-hidden="true">1.234 USDC</span>';
        const out = document.createElement('button');
        out.type = 'button';
        out.setAttribute('aria-label', 'Đăng xuất');
        out.innerHTML = login.innerHTML;
        acct.replaceChild(out, login);
        acct.insertBefore(bal, out);
        acct.insertBefore(addr, bal);
      });
      const m = await page.evaluate(() => {
        const top = document.querySelector('.top')!;
        const items = [...top.querySelectorAll('.logo, [data-testid=demo-chip], .acct > *')].filter((e) => e.getBoundingClientRect().width > 0);
        const centres = items.map((e) => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2));
        const targets = [...top.querySelectorAll('.acct > *')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.getBoundingClientRect());
        return { spread: Math.max(...centres) - Math.min(...centres), height: Math.round(top.getBoundingClientRect().height), minTarget: Math.min(...targets.map((r) => Math.min(r.width, r.height))), right: Math.max(...items.map((e) => e.getBoundingClientRect().right)) };
      });
      expect(m.spread, 'every item is on the same row').toBeLessThanOrEqual(2);
      expect(m.height, 'the bar is one row tall').toBeLessThanOrEqual(64);
      expect(m.minTarget).toBeGreaterThanOrEqual(44);
      expect(m.right, 'nothing runs past the right gutter').toBeLessThanOrEqual(width - 15);
    });
  }

  for (const width of [768, 960, 1024, 1100, 1440]) {
    test(`tablet & desktop top bar (${width}px) always shows wallet short address + copy icon on one row without clipping`, async ({ page }) => {
      await page.setViewportSize({ width, height: 860 });
      await page.goto('/circles');
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => {
        const acct = document.querySelector('.acct')!;
        const login = [...acct.children].find((e) => e.getAttribute('aria-label') === 'Đăng nhập')!;
        const addr = document.createElement('button');
        addr.type = 'button';
        addr.className = 'addr mono';
        addr.setAttribute('data-testid', 'wallet-address');
        addr.setAttribute('aria-label', 'Sao chép địa chỉ ví 0xa4DC…e1A8');
        addr.innerHTML = '<span class="addrDot" aria-hidden="true"></span><span class="addrTxt">0xa4DC…e1A8</span><svg class="addrIco" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        const bal = document.createElement('a');
        bal.href = '/cai-dat#so-du';
        bal.className = 'bal mono';
        bal.innerHTML = '<span class="bFull">1.234,56 USDC</span><span class="bShort" aria-hidden="true">1.234 USDC</span>';
        const out = document.createElement('button');
        out.type = 'button';
        out.setAttribute('aria-label', 'Đăng xuất');
        out.innerHTML = login.innerHTML;
        acct.replaceChild(out, login);
        acct.insertBefore(bal, out);
        acct.insertBefore(addr, bal);
      });
      const m = await page.evaluate(() => {
        const top = document.querySelector('.top')!;
        const addrBtn = document.querySelector<HTMLElement>('[data-testid="wallet-address"]')!;
        const addrTxt = addrBtn.querySelector<HTMLElement>('.addrTxt')!;
        const addrIco = addrBtn.querySelector<SVGElement>('svg.addrIco')!;
        const items = [...top.querySelectorAll('.logo, [data-testid=demo-chip], .tabs, .acct > *')].filter((e) => e.getBoundingClientRect().width > 0);
        const centres = items.map((e) => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2));
        return {
          spread: Math.max(...centres) - Math.min(...centres),
          btnRect: addrBtn.getBoundingClientRect(),
          txtRect: addrTxt.getBoundingClientRect(),
          icoRect: addrIco.getBoundingClientRect(),
          scrollW: document.documentElement.scrollWidth,
          viewW: window.innerWidth,
        };
      });
      expect(m.spread, 'all top-bar items share one row').toBeLessThanOrEqual(2);
      expect(m.btnRect.height).toBeGreaterThanOrEqual(44);
      expect(m.txtRect.width, 'wallet short address is visible, never hidden').toBeGreaterThan(55);
      expect(m.icoRect.width, 'copy icon is visible inside wallet button').toBeGreaterThanOrEqual(14);
      expect(m.scrollW).toBeLessThanOrEqual(m.viewW + 1);
    });
  }

  // B25 item 2: on a wide screen the two hero columns stay together. Widths are those of 1440, 1920 and 2560 screens; the page
  // scales itself (CSS zoom) above 1400px, so gaps are compared in CSS pixels (divided by that zoom).
  for (const width of [1440, 1920, 2560]) {
    test(`hero columns sit together and centred at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => {
        const zoom = Number(getComputedStyle(document.querySelector('[data-lp-root]')!).zoom) || 1;
        // The right edge of the title TEXT (not of its box: the box used to be a wide column with empty space in it).
        const range = document.createRange();
        range.selectNodeContents(document.querySelector('h1')!);
        const h1 = range.getBoundingClientRect();
        const side = document.querySelector('[data-lp-side]')!.getBoundingClientRect();
        const bubble = document.querySelector('[data-lp-bubble]')!.getBoundingClientRect();
        const cta = document.querySelector('a[href="#mot-ky"]')!.getBoundingClientRect();
        const logo = document.querySelector('[data-lp-root] nav a')!.getBoundingClientRect();
        return { zoom, gap: (side.left - h1.right) / zoom, leftMargin: h1.left / zoom, rightMargin: (innerWidth - side.right) / zoom, bubbleLeft: bubble.left, sideLeft: side.left, ctaTop: cta.top, logoLeft: logo.left };
      });
      expect(m.gap, 'gap between the title and the right column, in CSS px').toBeGreaterThanOrEqual(48);
      expect(m.gap).toBeLessThanOrEqual(110);
      expect(Math.abs(m.leftMargin - m.rightMargin), 'the cluster is centred: equal margins left and right').toBeLessThanOrEqual(90);
      expect(Math.abs(m.bubbleLeft - m.sideLeft), 'chat bubbles and the paragraph share the left edge of the right column').toBeLessThanOrEqual(40 * m.zoom);
    });
  }
});
