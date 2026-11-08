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
