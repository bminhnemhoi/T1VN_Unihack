// Exports the brand SVGs in public/brand to PNG (192, 512, 512 maskable, apple-touch 180) and favicon sizes.
// usage: node design/make-brand.mjs   (then app/favicon.ico is built by design/make-ico.py)
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const dir = path.resolve(import.meta.dirname, '../public/brand');
const svg = (f) => readFileSync(path.join(dir, f), 'utf8');
const jobs = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon.svg', 'icon-512-maskable.png', 512],
  ['icon.svg', 'apple-touch-icon.png', 180],
  ['favicon.svg', 'favicon-16.png', 16],
  ['favicon.svg', 'favicon-32.png', 32],
  ['favicon.svg', 'favicon-48.png', 48],
];
const b = await chromium.launch();
const p = await b.newPage();
for (const [src, out, size] of jobs) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg(src)}`);
  await p.screenshot({ path: path.join(dir, out), omitBackground: true });
}
await b.close();
