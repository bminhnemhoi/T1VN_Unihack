import { expect, type Page } from '@playwright/test';

/** Collects console errors and uncaught exceptions; call `expectClean()` at the end of a test. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
  });
  return { expectClean: () => expect(errors, errors.join('\n')).toEqual([]) };
}

/** The toast is a live region (role=status) that holds the message text. */
export const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

export async function noHorizontalOverflow(page: Page) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(extra, 'page is wider than the viewport').toBeLessThanOrEqual(0);
}

/** Main navigation that is visible at this viewport: top bar on desktop, bottom bar on phones. */
export const mainNav = (page: Page) => page.getByRole('navigation', { name: /^Điều hướng chính/ });

/**
 * Nothing visible may stick out past the right edge of the screen, except inside a box that scrolls on purpose
 * (a table in `overflow-x: auto`). Catches the card whose button spills out while the page itself does not scroll.
 */
export async function noClippedContent(page: Page) {
  const bad = await page.evaluate(() => {
    const limit = window.innerWidth + 1;
    const scrolls = (el: Element | null): boolean => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const o = getComputedStyle(e).overflowX;
        if (o === 'auto' || o === 'scroll' || o === 'hidden') return true;
      }
      return false;
    };
    const out: string[] = [];
    document.querySelectorAll('main *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right > limit && !scrolls(el)) out.push(`${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 40)} right=${Math.round(r.right)}`);
    });
    return out.slice(0, 5);
  });
  expect(bad, 'content sticks out past the right edge').toEqual([]);
}

/**
 * A wide result table and its card list share one accessible name; below the breakpoint only the cards are shown (B17).
 * Returns whichever of the two is on screen, so a test can read the numbers at any width.
 */
export const tableOrCards = (page: Page, name: RegExp) => page.getByRole('table', { name }).or(page.getByRole('list', { name }));
