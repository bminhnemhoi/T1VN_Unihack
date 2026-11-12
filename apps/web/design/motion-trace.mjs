// B22g motion check on a sample build: frame times while loading and scrolling the landing, and while opening the
// bid sheet on a phone, under CPU throttling; plus CLS. usage: node design/motion-trace.mjs <base> <cpuRate>
import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://localhost:3101';
const rate = Number(process.argv[3] ?? 4);
const b = await chromium.launch();

async function page() {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const c = await p.context().newCDPSession(p);
  await c.send('Emulation.setCPUThrottlingRate', { rate });
  await p.addInitScript(() => {
    window.__f = []; window.__cls = 0; window.__lt = [];
    let t = performance.now();
    const loop = (n) => { window.__f.push(n - t); t = n; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
  });
  return p;
}
const stats = (f) => { const s = [...f].sort((a, b) => a - b); return { frames: f.length, over50: f.filter((x) => x > 50).length, over34: f.filter((x) => x > 34).length, max: Math.round(s.at(-1) ?? 0), p50: +(s[Math.floor(s.length / 2)] ?? 0).toFixed(1) }; };
const take = (p) => p.evaluate(() => { const f = window.__f; window.__f = []; return f; });

// 1. landing: load (intro + hero), then scroll to the end
const L = await page();
await L.goto(base + '/', { waitUntil: 'load' });
await L.waitForTimeout(4500);
const load = stats(await take(L));
const longLoad = await L.evaluate(() => window.__lt.slice());
for (let i = 0; i < 40; i++) { await L.mouse.wheel(0, 420); await L.waitForTimeout(80); }
await L.waitForTimeout(800);
const scroll = stats(await take(L));
const clsL = await L.evaluate(() => +window.__cls.toFixed(4));

// 2. app: open the bid sheet on the phone room
const A = await page();
await A.goto(base + '/circles/demo', { waitUntil: 'load' });
await A.waitForTimeout(1500);
await take(A);
await A.locator('.peek').first().click();
await A.waitForTimeout(700);
const sheet = stats(await take(A));
const clsA = await A.evaluate(() => +window.__cls.toFixed(4));

console.log(JSON.stringify({ cpu: `${rate}x`, landingLoad: { ...load, longTasks: longLoad }, landingScroll: scroll, landingCLS: clsL, sheetOpen: sheet, appCLS: clsA }, null, 1));
await b.close();
