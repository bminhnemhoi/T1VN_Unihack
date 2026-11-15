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
});
