// B25 hero shots: node design/b25-hero.mjs <base> <before|after>   -> .handover/screens/b25-hero-<tag>-<w>.png
import { chromium } from '@playwright/test';
import path from 'node:path';
const base = process.argv[2] ?? 'http://localhost:3101';
const tag = process.argv[3] ?? 'after';
const out = path.resolve(import.meta.dirname, '../../../.handover/screens');
const b = await chromium.launch();
for (const [w, h] of [[390, 844], [768, 1024], [1440, 900], [1920, 1080], [2218, 1200], [2560, 1300]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: w <= 768 })).newPage();
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/b25-hero-${tag}-${w}.png` });
  const m = await p.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    const h1 = r('h1'), side = r('[data-lp-side]'), hero = r('[data-lp-hero]');
    const left = h1 ? [Math.round(h1.left), Math.round(h1.right)] : null;
    const sideP = side ? [Math.round(side.left), Math.round(side.right)] : null;
    return { left, side: sideP, gap: left && sideP ? sideP[0] - left[1] : null, vw: innerWidth, zoom: getComputedStyle(document.querySelector('[data-lp-root]')).zoom };
  });
  console.log(w, JSON.stringify(m));
  await p.close();
}
await b.close();
