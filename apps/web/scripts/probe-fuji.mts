/**
 * Number probe (B28): before recording a demo, open the ledger of real Fuji circles in a browser, read every cell on
 * screen and compare it with numbers read straight from the chain (readCircle: round results and ShortfallCovered
 * events). Catches display bugs like the one where the finished default circle showed bond 32, 30, 20, 10, 0.
 *
 *   pnpm --filter web probe:fuji [baseUrl] [circle ...]
 *   default base: the public demo; default circles: FUJI_EVIDENCE (default and fixed circles).
 *
 * Read only: no key, no transaction. Exit code 0 only when every check holds.
 */
import { chromium } from '@playwright/test';
import { createPublicClient, http } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { FUJI_EVIDENCE } from 'config';
import { FUJI_EXPLORER_API, formatUsdcNumber, huiMath, readCircle, registerExplorerApi } from 'sdk';

const base = process.argv[2] ?? 'https://lamng.tail3abf4e.ts.net:8443';
const circles = (process.argv.length > 3 ? process.argv.slice(3) : [FUJI_EVIDENCE.defaultCircle, FUJI_EVIDENCE.fixedCircle]) as `0x${string}`[];
const rpc = process.env.NEXT_PUBLIC_FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const client = createPublicClient({ chain: avalancheFuji, transport: http(rpc, { batch: true }), batch: { multicall: true } });
registerExplorerApi(client as never, FUJI_EXPLORER_API); // events from the explorer, as the web app reads them
const f = (u: bigint) => formatUsdcNumber(u);
/** Vietnamese number on screen ("8,00", "28,848", "1.234,5") to micro-USDC. */
const units = (txt: string): bigint => {
  const [i, d = ''] = txt.replace(/\./g, '').split(',');
  return BigInt(i!) * 1_000_000n + BigInt((d + '000000').slice(0, 6));
};
/** Amount written just before `word` in a cell, e.g. "bù 8,00 từ tiền giữ lại". */
const before = (cell: string, word: string): bigint | undefined => {
  const m = new RegExp(`([0-9.]+(?:,[0-9]+)?) ${word}`).exec(cell);
  return m ? units(m[1]!) : undefined;
};

let failed = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`);
};

const browser = await chromium.launch();
for (const address of circles) {
  console.log(`\n== ${address}`);
  const v = await readCircle(client as never, address);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${base}/circles/${address}/so-ho`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForSelector('main table tbody tr', { timeout: 60_000 });
  await page.waitForTimeout(2_000);
  const rows = await page.$$eval('main table tbody tr', (trs) => trs.map((tr) => [...tr.querySelectorAll('th,td')].map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim())));
  const members = [...v.members].sort((a, b) => a.joinIndex - b.joinIndex);
  const done = v.rounds.filter((r) => r.phase === 'done');

  for (const r of done) {
    const wi = members.findIndex((m) => m.address.toLowerCase() === r.winner?.toLowerCase());
    const cell = rows[wi]?.[r.k] ?? '';
    const hot = /HỐT ([0-9.]+(?:,[0-9]+)?)/.exec(cell);
    check(`round ${r.k}: winner cell shows HỐT ${f(r.payout ?? 0n)}`, hot !== null && units(hot[1]!) === (r.payout ?? 0n), cell);
    for (const s of r.shortfalls) {
      const si = members.findIndex((m) => m.address.toLowerCase() === s.member.toLowerCase());
      const sc = rows[si]?.[r.k] ?? '';
      const cv = s.covered ?? { holdback: s.fromHoldback, bond: s.fromBond, reserve: 0n, uncovered: 0n };
      if (cv.holdback > 0n) check(`round ${r.k}: shortfall cell shows ${f(cv.holdback)} from holdback`, before(sc, 'từ tiền giữ lại') === cv.holdback, sc);
      if (cv.bond > 0n) check(`round ${r.k}: shortfall cell shows ${f(cv.bond)} from bond`, before(sc, 'từ ký quỹ') === cv.bond, sc);
    }
  }

  // Bond after each settled round: deposited minus what shortfalls up to that round took from it and was not given back.
  const deposited = v.bondDeposited ?? v.bondRemaining;
  const all = await page.$$eval('main table tr', (trs) => trs.map((tr) => [...tr.querySelectorAll('th,td')].map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim())));
  const bondRow = all.find((r) => r[0] === 'Ký quỹ còn') ?? [];
  let used = 0n;
  for (const r of done) {
    // A shortfall repaid in grace (resolved) gave its bond part back; an open or defaulted one did not.
    used += r.shortfalls.filter((s) => !s.resolved).reduce((a, s) => a + (s.covered?.bond ?? s.fromBond), 0n);
    const want = deposited - used;
    const got = bondRow[r.k];
    check(`bond after round ${r.k} = ${f(want)}`, got !== undefined && /^[0-9.,]+$/.test(got) && units(got) === want, got ?? '(none)');
  }

  const top = (await page.textContent('#hs-health').catch(() => '')) ?? '';
  const opening = Math.floor(Number(huiMath.coverageIndexBps(BigInt(v.params.alphaBps), deposited, 0n, BigInt(v.params.N), v.params.C)) / 100);
  if (v.state !== 'forming' && v.state !== 'cancelled') check(`top bar: coverage at opening ${opening}%`, top.replace(/\s+/g, ' ').includes(`${opening}%`), top.replace(/\s+/g, ' '));
  await page.close();
}
await browser.close();
console.log(failed === 0 ? '\nPROBE OK' : `\nPROBE FAILED: ${failed} check(s)`);
process.exit(failed === 0 ? 0 : 1);
