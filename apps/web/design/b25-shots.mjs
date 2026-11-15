// B25 screenshots into .handover/screens/b25-*. usage (sample build): node design/b25-shots.mjs http://localhost:3101
// Delete: list row with "Xóa", the confirmation, three frames of the motion, Cài đặt "Dây đã ẩn". Hero: 1440, 1920, 2560, 768, 390.
import { chromium } from '@playwright/test';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:3101';
const only = process.argv[3]; // 'delete' | 'hero' | undefined (both)
const out = path.resolve(import.meta.dirname, '../../../.handover/screens');
const b = await chromium.launch();
const NAME = 'Hụi tổ dân phố 9';
if (only !== 'hero') {
  for (const [w, h] of [[360, 740], [390, 844], [768, 1024], [1440, 900]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w <= 768 });
    const p = await ctx.newPage();
    const shot = (n) => p.screenshot({ path: `${out}/b25-${n}-${w}.png` });
    await p.goto(`${base}/circles`, { waitUntil: 'networkidle' });
    const row = p.locator('li[data-row]').filter({ hasText: NAME });
    await row.scrollIntoViewIfNeeded();
    await p.waitForTimeout(500);
    await shot('delete-row');
    await row.getByRole('button', { name: /Xóa dây/ }).click();
    await p.waitForTimeout(500);
    await shot('delete-dialog');
    await p.getByRole('dialog').getByRole('button', { name: /Rút 48/ }).click();
    // motion frames (desktop only: the target chip lives in the top bar)
    if (w === 1440) {
      await p.waitForSelector('[role=dialog]', { state: 'detached' });
      for (const [n, at] of [['motion-1', 150], ['motion-2', 400], ['motion-3', 650]]) { await p.waitForTimeout(at === 150 ? 150 : at - [150, 400, 650][[150, 400, 650].indexOf(at) - 1]); await shot(n); }
    }
    await p.waitForTimeout(2800);
    await shot('delete-after');
    await p.goto(`${base}/cai-dat#day-da-an`, { waitUntil: 'networkidle' });
    await p.getByTestId('hidden-circles').scrollIntoViewIfNeeded();
    await p.waitForTimeout(300);
    await shot('hidden-list');
    await ctx.close();
  }
}
await b.close();
