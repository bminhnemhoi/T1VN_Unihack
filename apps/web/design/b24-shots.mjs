// B24 screenshots at 360 / 390 / 768 / 1440 into .handover/screens/b24-*. usage (sample build): node design/b24-shots.mjs http://localhost:3103
// Hero at the start, middle and end of the seal animation, the technology section, the phone top bar (dressed as signed in),
// and the "ĐÃ TẠO DÂY" screen. The Overview with a cancelled circle needs the sample list patched, so it is shot by hand.
import { chromium } from '@playwright/test';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:3103';
const out = path.resolve(import.meta.dirname, '../../../.handover/screens');
const SIZES = [[360, 740], [390, 844], [768, 1024], [1440, 900]];
const b = await chromium.launch();
for (const [w, h] of SIZES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w <= 768, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const shot = (name) => p.screenshot({ path: `${out}/b24-${name}-${w}.png` });

  // Hero: the intro hands over at ~1.7 s, the seal runs about 0.9 s a little after that.
  await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  const t0 = Date.now();
  for (const [name, at] of [['hero-start', 2300], ['hero-mid', 3000], ['hero-end', 5200]]) {
    await p.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
    await shot(name);
  }
  // Technology section once its cards have come in.
  await p.locator('#cong-nghe').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 60));
  await p.waitForTimeout(2600);
  await shot('tech');

  // App: top bar on phones, dressed like a signed-in user (the sample build has no Privy session).
  if (w <= 414) {
    await p.goto(`${base}/circles`, { waitUntil: 'networkidle' });
    await p.evaluate(() => {
      const acct = document.querySelector('.acct');
      const login = [...acct.children].find((e) => e.getAttribute('aria-label') === 'Đăng nhập');
      const addr = document.createElement('button'); addr.type = 'button'; addr.className = 'mono'; addr.setAttribute('data-testid', 'wallet-address'); addr.innerHTML = '<span class="lbl">0x6e55…5A63</span>';
      const bal = document.createElement('a'); bal.href = '/cai-dat#so-du'; bal.className = 'bal mono'; bal.innerHTML = '<span class="bFull">12 USDC</span><span class="bShort" aria-hidden="true">12 USDC</span>';
      const out = document.createElement('button'); out.type = 'button'; out.setAttribute('aria-label', 'Đăng xuất'); out.innerHTML = login.innerHTML;
      acct.replaceChild(out, login); acct.insertBefore(bal, out); acct.insertBefore(addr, bal);
    });
    await p.waitForTimeout(300);
    await shot('topbar');
  }

  // "ĐÃ TẠO DÂY"
  await p.goto(`${base}/circles/new`, { waitUntil: 'networkidle' });
  for (let i = 0; i < 5; i++) { await p.getByRole('button', { name: /Tiếp tục/ }).click(); await p.waitForTimeout(250); }
  await p.getByRole('checkbox').check();
  await p.locator('.crNav .btn').last().click();
  await p.waitForSelector('.crDone .stamp', { timeout: 8000 });
  await p.waitForTimeout(1000);
  await shot('created');
  await ctx.close();
}
await b.close();
