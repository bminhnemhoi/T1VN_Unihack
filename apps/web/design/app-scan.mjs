// B22 check of the web app against lamng-design-rule, on a sample build: node design/app-scan.mjs http://localhost:3101
// Per screen and size: overlapping text (occlusion-aware), page scroll, font families, spacing off the 4/8/12/16/24/32
// scale, text contrast under 4.5:1 (3:1 for large text) and tap targets under 24px. Run from apps/web.
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:3101';
const SCREENS = [
  ['/circles', []],
  ['/circles/demo', []],
  ['/circles/demo', ['rail:2']],
  ['/circles/demo', ['rail:4']],
  ['/circles/demo', ['bid:3', 'seal', 'wait:2000', 'ffwd', 'reveal', 'wait:2000', 'ffwd']],
  ['/circles/demo/so-ho', []],
  ['/circles/demo/so-ho', ['seg:Theo kỳ']],
  ['/circles/co-dinh', []],
  ...[0, 1, 2, 3, 4, 5].map((n) => ['/circles/new', Array(n).fill('next')]),
  // B23: demo chip popover, the first-run guide (new path, played path, last screen), the install card, Cài đặt with the demo tools
  ['/circles', ['chip']],
  ['/cai-dat', ['onb']],
  ['/cai-dat', ['onb', 'pick:0', 'pick:2']],
  ['/cai-dat', ['onb', 'pick:0', 'pick:2', 'more', 'more', 'more', 'more']],
  ['/cai-dat', ['onb', 'pick:1', 'pick:1']],
  ['/cai-dat', ['onb', 'pick:1', 'pick:1', 'more']],
  ['/circles', ['install']],
  // B22f: secondary pages on the page kit (`.pg`)
  ...['/circles/demo/bao-chung', '/circles/demo/giu-lai', '/circles/demo/thieu', '/circles/demo/ket-qua', '/circles/da-xong/tat-toan',
    '/circles/dang-gom', '/circles/da-xong', '/moi/dang-gom', '/cai-dat', '/thong-bao-ubnd', '/lab', '/dang-nhap', '/khong-co-trang-nay'].map((u) => [u, []]),
];
const ONLY = process.argv[3] ? new RegExp(process.argv[3]) : null; // optional filter on the path
const SIZES = [[1440, 900], [1280, 720], [768, 1024], [390, 844], [360, 740]];


function measure() {
  const SCALE = new Set([0, 4, 8, 12, 16, 24, 32]);
  const root = document.getElementById('hs-root');
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && cs.display !== 'none'; };
  const all = [...root.querySelectorAll('*')].filter((e) => vis(e) && !e.closest('.sheet:not(.open), .sr, [aria-hidden="true"] .sk'));
  const textEls = all.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  // fonts
  const fams = new Set(textEls.map((e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').trim()));
  // spacing (the app's own classes only: Tailwind pages are out of scope)
  const off = [];
  for (const e of all) {
    if (!e.closest('.room, .ov, .lg, .cr, .state, .top, .tabbar, .pg, [data-testid="onboarding"], [data-testid="install-hint"]')) continue;
    const cs = getComputedStyle(e);
    for (const p of ['gap', 'rowGap', 'columnGap', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft']) {
      const v = cs[p];
      if (!v || v === 'normal' || v === 'auto') continue;
      const n = Math.abs(parseFloat(v));
      if (Number.isNaN(n) || SCALE.has(Math.round(n * 100) / 100)) continue;
      // margin: 0 auto centring, and env(safe-area) fallbacks resolve to scale values; anything else is reported
      if (p.startsWith('margin') && (cs.marginLeft === cs.marginRight && p.match(/Left|Right/))) continue;
      if (p === 'marginLeft' && (e.classList.contains('health') || e.classList.contains('ctl') || e.classList.contains('acct'))) continue; // margin-left: auto pushes the chips and the account buttons right
      off.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${p}=${v}`);
    }
  }
  // contrast
  const rgb = (s) => { const m = s.match(/[\d.]+/g); if (!m) return null; const v = m.map(Number); return s.startsWith('color(') ? [v[0] * 255, v[1] * 255, v[2] * 255, v[3] ?? 1] : v; };
  const seen = (e) => { for (let p = e; p; p = p.parentElement) if (+getComputedStyle(p).opacity < 0.99) return false; return true; };
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (e) => { for (let p = e; p; p = p.parentElement) { const c = rgb(getComputedStyle(p).backgroundColor); if (c && (c.length < 4 || c[3] > 0.6)) return c; } return [244, 240, 232]; };
  const low = [];
  for (const e of textEls) {
    const cs = getComputedStyle(e);
    if (e.closest('[disabled], .btn[disabled]') || e.closest('.later') || !seen(e)) continue; // disabled controls are exempt (WCAG 1.4.3)
    const fg = rgb(cs.color); const bg = bgOf(e);
    if (!fg || !bg) continue;
    const a = lum(fg), b = lum(bg); const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const size = parseFloat(cs.fontSize); const bold = +cs.fontWeight >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    // The phone menu's current tab is ivory on a sliding ink pill that is a sibling, so its own background chain says otherwise.
    if (e.closest('.tabbar') && e.closest('a[aria-current="page"]')) continue;
    if (ratio < need) low.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${e.textContent.trim().slice(0, 20)}" ${ratio.toFixed(2)}`);
  }
  // targets
  const small = all
    .filter((e) => e.matches('a, button, input, [role="radio"], [role="button"]'))
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width < 24 || r.height < 24; })
    .filter((e) => !(e.tagName === 'A' && e.closest('p, .rf, .legend, .alert')))
    .map((e) => `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 20)}"`);
  const view = document.getElementById('hs-view');
  return { fams: [...fams], off: [...new Set(off)].slice(0, 6), low: [...new Set(low)].slice(0, 6), small: [...new Set(small)].slice(0, 6), pageScroll: document.documentElement.scrollHeight - innerHeight, sideScroll: document.documentElement.scrollWidth - innerWidth, viewScroll: view.scrollHeight - view.clientHeight };
}

function overlaps() {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && +cs.opacity > 0.05; };
  const leaves = [...document.querySelectorAll('#noi-dung *, [data-testid="onboarding"] *, [data-testid="install-hint"] *')].filter((e) => vis(e) && !e.closest('.sheet:not(.open)') && ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || ['BUTTON', 'INPUT', 'A'].includes(e.tagName)));
  const clipOf = (e) => { let c = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 }; for (let p = e; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (p === e || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const r = p.getBoundingClientRect(); c = { left: Math.max(c.left, r.left), top: Math.max(c.top, r.top), right: Math.min(c.right, r.right), bottom: Math.min(c.bottom, r.bottom) }; } } return c; };
  const box = (e) => { const range = document.createRange(); range.selectNodeContents(e); let rs = [...range.getClientRects()]; if (!rs.length || e.tagName === 'INPUT') rs = [e.getBoundingClientRect()]; const c = clipOf(e); return rs.map((r) => ({ left: Math.max(r.left, c.left), top: Math.max(r.top, c.top), right: Math.min(r.right, c.right), bottom: Math.min(r.bottom, c.bottom) })).filter((r) => r.right - r.left > 1 && r.bottom - r.top > 1); };
  const hits = [];
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    const a = leaves[i], b = leaves[j];
    if (a.contains(b) || b.contains(a)) continue;
    // the stamp lands on the slip on purpose (prototype): it is a stamp, not text in the way
    if (a.closest('.stamp') || b.closest('.stamp')) { if ((a.closest('.slip') || b.closest('.slip'))) continue; }
    for (const ra of box(a)) for (const rb of box(b)) {
      const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (x > 2 && y > 2) {
        const cx = (Math.max(ra.left, rb.left) + Math.min(ra.right, rb.right)) / 2, cy = (Math.max(ra.top, rb.top) + Math.min(ra.bottom, rb.bottom)) / 2;
        const top = document.elementFromPoint(cx, cy); let occluded = false;
        for (const [front, back] of [[a, b], [b, a]]) if (top && (front.contains(top) || top.contains(front))) {
          for (let q = front; q && !q.contains(back); q = q.parentElement) { const bg = getComputedStyle(q).backgroundColor; if (/^rgb\(/.test(bg) || (bg.startsWith('rgba') && !bg.endsWith(', 0)'))) { occluded = true; break; } }
        }
        if (!occluded) hits.push(`"${(a.textContent || a.value || '').trim().slice(0, 18)}" × "${(b.textContent || b.value || '').trim().slice(0, 18)}"`);
      }
    }
  }
  return [...new Set(hits)].slice(0, 6);
}

const b = await chromium.launch();
let bad = 0;
for (const [w, h] of SIZES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  for (const [path, steps] of SCREENS) {
    if (ONLY && !ONLY.test(path)) continue;
    await p.goto(base + path, { waitUntil: 'networkidle' });
    for (const s of steps) {
      const [k, arg] = s.split(':');
      if (k === 'next') await p.getByRole('button', { name: 'Tiếp tục ›' }).click();
      if (k === 'rail') await (w > 760 ? p.locator('.rail button').nth(+arg - 1) : p.locator('.storyNav .bars button').nth(+arg - 1)).click();
      if (k === 'bid') await p.getByLabel('Thăm của bạn (số tiền bớt cho mọi người)').fill(arg);
      if (k === 'seal') await p.getByRole('button', { name: 'Niêm phong thăm' }).click();
      if (k === 'reveal') await p.getByRole('button', { name: 'Mở thăm', exact: true }).click();
      if (k === 'ffwd') {
        await p.getByTestId('demo-chip').click();
        await p.getByTestId('demo-banner').getByRole('button', { name: 'Tua nhanh ›' }).click();
        await p.keyboard.press('Escape');
      }
      if (k === 'chip') await p.getByTestId('demo-chip').click();
      if (k === 'onb') await p.getByRole('button', { name: 'Xem lại hướng dẫn' }).click();
      if (k === 'pick') await p.getByRole('dialog').getByRole('radio').nth(+arg).click();
      if (k === 'more') await p.getByRole('dialog').getByRole('button', { name: 'Tiếp tục' }).click();
      if (k === 'install') {
        await p.evaluate(() => localStorage.setItem('huisafe.install', JSON.stringify({ days: ['2026-11-01'], dismissedAt: [], installed: false })));
        await p.reload({ waitUntil: 'networkidle' });
        await p.waitForTimeout(300);
        await p.evaluate(() => {
          const e = new Event('beforeinstallprompt', { cancelable: true });
          e.prompt = async () => {};
          e.userChoice = Promise.resolve({ outcome: 'dismissed' });
          window.dispatchEvent(e);
        });
      }
      if (k === 'seg') await p.getByRole('button', { name: arg }).click().catch(() => {});
      if (k === 'wait') await p.waitForTimeout(+arg);
    }
    await p.waitForTimeout(500);
    const m = await p.evaluate(measure);
    const o = await p.evaluate(overlaps);
    const problems = [
      m.fams.length > 2 && `fonts ${m.fams.join('/')}`,
      m.off.length && `spacing ${m.off.join('; ')}`,
      m.low.length && `contrast ${m.low.join('; ')}`,
      m.small.length && `targets ${m.small.join('; ')}`,
      m.pageScroll > 0 && `page scrolls ${m.pageScroll}px`,
      m.sideScroll > 0 && `side scroll ${m.sideScroll}px`,
      o.length && `overlap ${o.join('; ')}`,
    ].filter(Boolean);
    const tag = `${w}x${h} ${path}${steps.length ? ' ' + steps.join(',') : ''}`;
    if (problems.length) { bad++; console.log(`FAIL ${tag}\n  ${problems.join('\n  ')}`); }
    else console.log(`ok   ${tag}  fonts=${m.fams.join('/')} viewScroll=${m.viewScroll}`);
  }
  await ctx.close();
}
await b.close();
console.log(bad ? `${bad} screen(s) with problems` : 'all screens clean');
