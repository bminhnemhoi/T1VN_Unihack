/**
 * Text overlap scanner for the zoom checks (B24, section D). `scanOverlaps` runs INSIDE the page (`page.evaluate`), so it
 * must stay self-contained. It lists visible text boxes that overlap another text box (unless an opaque layer hides one
 * of them) and text that sticks out of an overflow-hidden ancestor, plus horizontal scroll. The same function feeds
 * `design/zoom-scan.mjs` (screenshots) and `e2e/zoom.spec.ts` (the guard).
 */
export interface OverlapReport {
  hits: string[];
  clip: string[];
  scrollW: number;
  viewW: number;
}

export function scanOverlaps(rootSel: string): OverlapReport {
  const root = document.querySelector(rootSel) ?? document.body;
  const vis = (e: Element) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    // checkVisibility walks the ancestors too: a child of an opacity:0 stamp is not visible even though its own opacity is 1
    const shown = (e as Element & { checkVisibility?: (o: { opacityProperty?: boolean; visibilityProperty?: boolean }) => boolean }).checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? true;
    return shown && r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  const leaves = [...root.querySelectorAll('*')].filter((e) => {
    if (!vis(e) || e.closest('[hidden],[data-lp-intro],nextjs-portal,.sheet:not(.open),[aria-hidden="true"]')) return false;
    const d = e.closest('details:not([open])');
    if (d && !e.closest('summary')) return false;
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
    return own || ['BUTTON', 'INPUT'].includes(e.tagName);
  });
  const clipOf = (e: Element) => {
    let c = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 };
    let p: Element | null = e;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (p === e || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const r = p.getBoundingClientRect();
        c = { left: Math.max(c.left, r.left), top: Math.max(c.top, r.top), right: Math.min(c.right, r.right), bottom: Math.min(c.bottom, r.bottom) };
      }
      p = p.parentElement;
    }
    return c;
  };
  const boxes = (e: Element) => {
    const range = document.createRange();
    range.selectNodeContents(e);
    let rs = [...range.getClientRects()];
    if (!rs.length || e.tagName === 'INPUT') rs = [e.getBoundingClientRect()];
    const c = clipOf(e);
    return rs
      .map((r) => ({ left: Math.max(r.left, c.left), top: Math.max(r.top, c.top), right: Math.min(r.right, c.right), bottom: Math.min(r.bottom, c.bottom) }))
      .filter((r) => r.right - r.left > 1 && r.bottom - r.top > 1);
  };
  const label = (e: Element) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0] ?? ''}"${(e.textContent ?? '').trim().slice(0, 18)}"`;
  const hits: string[] = [];
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i]!;
      const b = leaves[j]!;
      if (a.contains(b) || b.contains(a)) continue;
      let found = false;
      for (const ra of boxes(a)) {
        for (const rb of boxes(b)) {
          const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (x > 2 && y > 2) {
            const cx = (Math.max(ra.left, rb.left) + Math.min(ra.right, rb.right)) / 2;
            const cy = (Math.max(ra.top, rb.top) + Math.min(ra.bottom, rb.bottom)) / 2;
            const top = document.elementFromPoint(cx, cy);
            let occluded = false;
            for (const [front, back] of [[a, b], [b, a]] as const) {
              if (top && (front.contains(top) || top.contains(front))) {
                let q: Element | null = front;
                while (q && !q.contains(back)) {
                  const bg = getComputedStyle(q).backgroundColor;
                  if (/^rgb\(/.test(bg) || (bg.startsWith('rgba') && !bg.endsWith(', 0)'))) {
                    occluded = true;
                    break;
                  }
                  q = q.parentElement;
                }
              }
            }
            // An opaque card hiding half of another text box is still a collision (it was the bubbles over the paragraph at 1100px):
            // `occluded` only excuses the explicit allow-list of layers designed to cover content.
            const designedCover = [a, b].some((n) => n.closest('.tabbar,.sheet.open,.scrim,.toast,[role="dialog"]'));
            if (!designedCover || !occluded) {
              hits.push(`${label(a)} x ${label(b)}`);
              found = true;
            }
          }
          if (found) break;
        }
        if (found) break;
      }
    }
  }
  const clip: string[] = [];
  for (const e of leaves) {
    const r = e.getBoundingClientRect();
    let p = e.parentElement;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) break; // a scroller: what is below the fold is reachable by scrolling
      if (/hidden|clip/.test(cs.overflowX + cs.overflowY)) {
        const pr = p.getBoundingClientRect();
        if ((r.right > pr.right + 2 || r.left < pr.left - 2 || r.bottom > pr.bottom + 2 || r.top < pr.top - 2) ) clip.push(`${label(e)} in .${String(p.className).split(' ')[0] ?? ''}`);
        break;
      }
      p = p.parentElement;
    }
  }
  return { hits: [...new Set(hits)].slice(0, 12), clip: [...new Set(clip)].slice(0, 8), scrollW: document.documentElement.scrollWidth, viewW: document.documentElement.clientWidth };
}
