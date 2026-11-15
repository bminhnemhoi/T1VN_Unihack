import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const [w, fs] of [[1100, ''], [720, ''], [480, ''], [1440, '200%']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage();
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto('http://localhost:3102/', { waitUntil: 'networkidle' });
  if (fs) await p.addStyleTag({ content: `html{font-size:${fs}}` });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `/tmp/claude-1000/zoom-${w}${fs ? '-fs' : ''}.png` });
  console.log(w, fs, 'scrollW', await p.evaluate(() => document.documentElement.scrollWidth));
}
await b.close();
