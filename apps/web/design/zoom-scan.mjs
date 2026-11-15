// B24 zoom scan: node design/zoom-scan.mjs http://localhost:3102 [shots-dir]
// Opens the landing and the app screens at 1440, 1280, 1100, 960, 720, 480 CSS px (= 1440 at 100%, 113%, 131%, 150%, 200%,
// 300% browser zoom) and again with the browser font set to 200%, and lists text boxes that overlap, text clipped by a
// parent, and horizontal scroll. Screenshots (when a dir is given) are the landing hero and the Overview.
import { chromium } from '@playwright/test';
import { scanOverlaps } from '../e2e/overlap-scan.ts';

const base = process.argv[2] ?? 'http://localhost:3102';
const shots = process.argv[3];
const WIDTHS = [1440, 1280, 1100, 960, 720, 480];
const PAGES = [
  ['/', '[data-lp-root]'],
  ['/circles', '#noi-dung'],
  ['/circles/demo', '#noi-dung'],
  ['/circles/new', '#noi-dung'],
  ['/cai-dat', '#noi-dung'],
];
const b = await chromium.launch();
let bad = 0;
for (const fontScale of ['', '200%']) {
  for (const w of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: w < 800 });
    const p = await ctx.newPage();
    await p.emulateMedia({ reducedMotion: 'reduce' });
    for (const [path, sel] of PAGES) {
      await p.goto(base + path, { waitUntil: 'networkidle' });
      if (fontScale) await p.addStyleTag({ content: `html{font-size:${fontScale}}` });
      await p.waitForTimeout(500);
      const r = await p.evaluate(scanOverlaps, sel);
      const hscroll = r.scrollW > r.viewW + 1;
      if (r.hits.length || r.clip.length || hscroll) {
        bad++;
        console.log(`${fontScale ? 'font200 ' : ''}${w} ${path}`, JSON.stringify({ hits: r.hits, clip: r.clip, hscroll: hscroll ? `${r.scrollW}>${r.viewW}` : false }));
      }
      if (shots && (path === '/' || path === '/circles')) await p.screenshot({ path: `${shots}/b24-zoom-${path === '/' ? 'landing' : 'overview'}-${w}${fontScale ? '-font200' : ''}.png` });
    }
    await ctx.close();
  }
}
await b.close();
console.log(bad ? `zoom scan: ${bad} page/size combinations with problems` : 'zoom scan: clean');
process.exit(bad ? 1 : 0);
