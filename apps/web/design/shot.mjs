// Screenshots of app routes for reviews (B22f). usage: node design/shot.mjs <base> <outdir> <tag> <w> <h> <paths...>
import { chromium } from '@playwright/test';
const [base, out, tag, w, h, ...paths] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } });
for (const u of paths) { await p.goto(base + u); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${tag}${u.replaceAll('/', '_').replace('?', '-')}.png` }); }
await b.close();
