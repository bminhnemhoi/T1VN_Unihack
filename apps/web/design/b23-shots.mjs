// B23 screenshots at 360 / 390 / 768 / 1440 into .handover/screens/b23-*. usage (from apps/web, sample build): node design/b23-shots.mjs http://localhost:3103
import { chromium } from '@playwright/test';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:3103';
const out = path.resolve(import.meta.dirname, '../../../.handover/screens');
const SIZES = [[360, 740], [390, 844], [768, 1024], [1440, 900]];
const b = await chromium.launch();
for (const [w, h] of SIZES) {
  const touch = w <= 768;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const shot = async (name, opts = {}) => p.screenshot({ path: `${out}/b23-${name}-${w}.png`, ...opts });

  // Landing (still, so the intro does not cover it)
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  await shot('landing-hero');
  await p.getByTestId('demo-chip').click();
  await shot('landing-demo-chip');
  await p.keyboard.press('Escape');
  for (const id of ['mot-ky', 'tinh-huong', 'cong-nghe', 'so-cai']) {
    await p.locator(`#${id}`).evaluate((el) => el.scrollIntoView());
    await p.waitForTimeout(250);
    await shot(`landing-${id}`);
  }
  await p.emulateMedia({ reducedMotion: 'no-preference' });

  // App
  await p.goto(`${base}/circles`, { waitUntil: 'networkidle' });
  await shot('overview');
  await p.getByTestId('demo-chip').click();
  await p.waitForTimeout(250);
  await shot('app-demo-chip');
  await p.keyboard.press('Escape');
  await p.goto(`${base}/circles/demo`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await shot('room');
  await p.goto(`${base}/cai-dat`, { waitUntil: 'networkidle' });
  await p.getByTestId('demo-tools').scrollIntoViewIfNeeded();
  await shot('settings-demo-tools');

  // First-run guide
  await p.getByRole('button', { name: 'Xem lại hướng dẫn' }).click();
  await p.waitForTimeout(500);
  await shot('onboarding-q1');
  const d = p.getByRole('dialog');
  await d.getByRole('radio').nth(0).click();
  await p.waitForTimeout(350);
  await d.getByRole('radio').nth(1).click();
  await p.waitForTimeout(350);
  await shot('onboarding-learn1');
  for (let i = 0; i < 4; i++) {
    await d.getByRole('button', { name: 'Tiếp tục' }).click();
    await p.waitForTimeout(300);
  }
  await shot('onboarding-tour');
  await d.getByRole('button', { name: 'Để sau' }).click();

  // Install card (phones only)
  if (w <= 760) {
    await p.goto(`${base}/circles`, { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.setItem('huisafe.install', JSON.stringify({ days: ['2026-11-01'], dismissedAt: [], installed: false })));
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(300);
    await p.evaluate(() => {
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = async () => {};
      e.userChoice = Promise.resolve({ outcome: 'dismissed' });
      window.dispatchEvent(e);
    });
    await p.waitForTimeout(500);
    await shot('install-card');
  }
  await ctx.close();
}
await b.close();
console.log('screenshots in', out);
