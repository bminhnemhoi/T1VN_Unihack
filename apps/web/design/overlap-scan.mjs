// Overlap scanner used for the B22 port: node apps/web/design/overlap-scan.mjs x <out-dir> against a sample build on :3101.
// Flags visible text boxes that overlap each other (occlusion-aware) or stick out of a clipping box.
// Detects visible text boxes that overlap each other or are clipped by their scroll container.
import pw from '/home/towfienes/orca/workspaces/T1VN_Unihack/sim-ai/node_modules/.pnpm/@playwright+test@1.64.1/node_modules/@playwright/test/index.js';
const url = process.argv[2];
const routes = ['#tong-quan', '#day', '#so-hui', 'tao0','tao1','tao2','tao3','tao4','tao5'];
const sizes = [[1440, 900], [1280, 720], [768, 1024], [530, 1000], [390, 844], [375, 667], [360, 740]];
const scan = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && +cs.opacity > 0.05; };
  const leaves = [...document.querySelectorAll('#noi-dung *')].filter((e) => {
    if (!vis(e) || e.closest('[hidden],.sheet:not(.open)')) return false;
    const d = e.closest('details:not([open])'); if (d && !e.closest('summary')) return false;
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    return own || ['BUTTON', 'INPUT', 'A'].includes(e.tagName) || e.classList.contains('bar');
  });
  const clipOf = (e) => { let c = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 }; let p = e; while (p && p !== document.body) { const cs = getComputedStyle(p); if (p === e || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const r = p.getBoundingClientRect(); c = { left: Math.max(c.left, r.left), top: Math.max(c.top, r.top), right: Math.min(c.right, r.right), bottom: Math.min(c.bottom, r.bottom) }; } p = p.parentElement; } return c; };
  const box = (e) => { const range = document.createRange(); range.selectNodeContents(e); let rs = [...range.getClientRects()]; if (!rs.length || e.tagName === 'INPUT') rs = [e.getBoundingClientRect()]; const c = clipOf(e); return rs.map((r) => ({ left: Math.max(r.left, c.left), top: Math.max(r.top, c.top), right: Math.min(r.right, c.right), bottom: Math.min(r.bottom, c.bottom) })).filter((r) => r.right - r.left > 1 && r.bottom - r.top > 1); };
  const hits = [];
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    const a = leaves[i], b = leaves[j]; if (a.contains(b) || b.contains(a)) continue;
    for (const ra of box(a)) for (const rb of box(b)) {
      const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (x > 2 && y > 2) {
        // occluded? topmost element at the intersection belongs to one side and an opaque layer sits between it and the shared ancestor
        const cx = (Math.max(ra.left, rb.left) + Math.min(ra.right, rb.right)) / 2, cy = (Math.max(ra.top, rb.top) + Math.min(ra.bottom, rb.bottom)) / 2;
        const top = document.elementFromPoint(cx, cy); let occluded = false;
        for (const [front, back] of [[a, b], [b, a]]) if (top && (front.contains(top) || top.contains(front))) {
          let q = front; while (q && !q.contains(back)) { const bg = getComputedStyle(q).backgroundColor; if (/^rgb\(/.test(bg) || (bg.startsWith('rgba') && !bg.endsWith(', 0)'))) { occluded = true; break; } q = q.parentElement; }
        }
        if (occluded) continue;
        hits.push(`${a.tagName}.${a.className}"${(a.textContent || a.value || '').trim().slice(0, 18)}" × ${b.tagName}.${b.className}"${(b.textContent || b.value || '').trim().slice(0, 18)}"`); break; }
    }
  }
  // clipped: text box sticks out of an ancestor with overflow hidden/clip and is not a scroller
  const clip = [];
  for (const e of leaves) { const r = e.getBoundingClientRect(); let p = e.parentElement;
    while (p && p !== document.body) { const cs = getComputedStyle(p); if (/hidden|clip/.test(cs.overflowX + cs.overflowY)) { const pr = p.getBoundingClientRect(); if (r.right > pr.right + 2 || r.left < pr.left - 2 || r.bottom > pr.bottom + 2 || r.top < pr.top - 2) { if (!/auto|scroll/.test(cs.overflowX + cs.overflowY)) clip.push(`${e.tagName}.${e.className}"${e.textContent.trim().slice(0, 18)}" in .${p.className}`); } break; } p = p.parentElement; } }
  return { hits: [...new Set(hits)].slice(0, 8), clip: [...new Set(clip)].slice(0, 6) };
};
const b = await pw.chromium.launch();
const paths = ['/circles', '/circles/demo', '/circles/demo/so-ho', '/circles/new', '/circles/co-dinh', '/circles/da-xong/tat-toan'];
for (const [w, h] of [[1440, 900], [1280, 720], [768, 1024], [390, 844], [360, 740]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  for (const path of paths) {
    await p.goto('http://127.0.0.1:3101' + path); await p.waitForTimeout(700);
    const res = await p.evaluate(scan);
    if (res.hits.length || res.clip.length) console.log(w + 'x' + h, path, JSON.stringify(res));
  }
  if (w === 1440 || w === 390) {
    await p.goto('http://127.0.0.1:3101/circles/demo'); await p.waitForTimeout(700);
    await p.screenshot({ path: process.argv[3] + `/w2-room-${w}.png` });
    const k1 = p.getByRole('button', { name: /^Kỳ 1,/ });
    if (await k1.isVisible()) await k1.click(); else { await p.getByRole('button', { name: 'Kỳ trước' }).click(); await p.getByRole('button', { name: 'Kỳ trước' }).click(); }
    await p.waitForTimeout(400);
    console.log(w, 'K1 overlap', JSON.stringify(await p.evaluate(scan)));
    await p.screenshot({ path: process.argv[3] + `/w2-k1-${w}.png` });
  }
  await p.close();
}
await b.close(); console.log('scan done');
