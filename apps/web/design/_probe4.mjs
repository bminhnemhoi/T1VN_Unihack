import { chromium } from '@playwright/test';
const [w, h, ...times] = process.argv.slice(2).map(Number);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800 })).newPage();
await p.goto('http://localhost:3102/', { waitUntil: 'domcontentloaded' });
const t0 = Date.now();
for (const t of times) {
  await p.waitForTimeout(Math.max(0, t - (Date.now() - t0)));
  await p.screenshot({ path: `/tmp/claude-1000/hero-${w}-${t}.png` });
}
await b.close();
