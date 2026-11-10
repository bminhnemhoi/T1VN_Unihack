/**
 * B12 live check on anvil: create a circle with phi = 50% FROM THE WEB FORM (Playwright), then drive the rounds with the
 * same write flows the app uses, and compare the numbers with docs/03 section 8.1 scaled by 1/10 (C = 10 USDC).
 * Needs `anvil-playground.ts` on 8545/3200 and `HUISAFE_NETWORK=anvil NEXT_PUBLIC_HUISAFE_DEMO=true next dev -p 3300`.
 * Anvil only (public default mnemonic). Screenshots go to SHOTS (default .handover/screens/b12-live-*).
 *
 *   pnpm --filter web exec tsx scripts/anvil-v12.ts
 */
import { chromium, type Page } from '@playwright/test';
import { createPublicClient, http, type PublicClient } from 'viem';
import { loadAddresses } from 'config/addresses';
import { resolveNetwork } from 'config/network';
import { huiCircleFullAbi, huiFactoryAbi, memorySaltStore, type FetchLike } from 'sdk';
import { createChainConfig } from '../lib/chain/config';
import { devWallet } from '../lib/chain/wallet';
import { activate, commitBid, createCircle, depositBond, finalize, join, revealBid, settleRound, type TxContext } from '../lib/chain/write';
import { DEFAULTS, validateForm } from '../lib/circleForm';
import { buildCreateInput } from '../lib/live/createInput';
import { anvilChain } from '../lib/server/chain';

const RPC = 'http://127.0.0.1:8545';
const WEB = 'http://localhost:3300';
const API = 'http://127.0.0.1:3200';
const SHOTS = process.env.SHOTS ?? '../../.handover/screens';

let failures = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = String(got) === String(want);
  if (!ok) failures++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${name}: ${String(got)}${ok ? '' : ` (want ${String(want)})`}`);
};

async function rpc(method: string, params: unknown[] = []): Promise<void> {
  await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
}
const warp = async (s: number) => {
  await rpc('evm_increaseTime', [s]);
  await rpc('evm_mine');
};

async function shoot(page: Page, name: string): Promise<void> {
  for (const [w, h] of [[390, 844], [768, 1024], [1440, 900]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/b12-${name}-${w}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function main(): Promise<void> {
  const network = resolveNetwork({ HUISAFE_NETWORK: 'anvil' });
  const addrs = loadAddresses(network.deploymentFile, [network.chainId]);
  if (!addrs.deployed || !addrs.factory || !addrs.reputation || !addrs.usdc || !addrs.forwarder) throw new Error('anvil.json incomplete');
  const { factory } = addrs;
  const pub = createPublicClient({ chain: anvilChain, transport: http(RPC) }) as PublicClient;
  const chainCfg = createChainConfig({ network: 'anvil', chainId: network.chainId, factory, registry: addrs.reputation, usdc: addrs.usdc, forwarder: addrs.forwarder, fromBlock: '0', vndPerUsdc: 26_000, pollMs: 2000 });
  const saltStore = memorySaltStore();
  const fetchFn: FetchLike = (url, init) => fetch(url, init as RequestInit);
  const ctx = (i: number): TxContext => ({
    chain: chainCfg,
    wallet: devWallet(i < 0 ? 4 : 5 + i, network.chainId),
    getAccessToken: async () => (i < 0 ? 'organizer' : `member-${i + 1}`),
    fetchFn,
    relayUrl: `${API}/api/relay`,
    attestUrl: `${API}/api/attest`,
    saltStore,
  });

  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ locale: 'vi-VN', viewport: { width: 1440, height: 900 } })).newPage();
  // The browser sends tokens the way the real app would; here the faked verifier of the playground reads "organizer".
  page.setDefaultTimeout(120_000);
  page.setDefaultNavigationTimeout(180_000);
  await page.route('**/api/relay', async (route) => {
    const r = route.request();
    const res = await fetch(`${API}/api/relay`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer organizer' }, body: r.postData() ?? '' });
    await route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
  });
  await page.route('**/api/attest', async (route) => {
    const r = route.request();
    const res = await fetch(`${API}/api/attest`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer organizer' }, body: r.postData() ?? '' });
    await route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
  });

  // 1. Log in as the organizer wallet (dev account 4) and fill the form: C = 10, phi 50%, fee ceiling 3%.
  await page.goto(`${WEB}/dang-nhap`);
  await page.waitForTimeout(3000); // let the page hydrate, or the change event is lost
  await page.locator('#vi-thu').selectOption('4');
  await page.getByText(/Bạn đã đăng nhập với ví/).waitFor();
  // The dev wallet lives in React state, so go on with client-side navigation (a reload would log it out).
  await page.getByRole('link', { name: 'Tạo dây' }).first().click();
  await page.waitForURL(/\/circles\/new/);
  await page.getByLabel('Mức góp mỗi kỳ').fill('10');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByLabel('Phần hoa hồng của chủ hụi').fill('50');
  await page.getByLabel('Trần hoa hồng mỗi lần hốt').fill('3');
  await page.getByLabel('Ký quỹ của chủ hụi').fill('48');
  await shoot(page, 'live-wizard-buoc2');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByText('Thỏa thuận của dây').waitFor();
  await shoot(page, 'live-wizard-buoc3');
  // The dev wallet has no Privy token, so the button of the form stops at "Bạn cần đăng nhập trước" on anvil (lib/chain, flow A).
  // Submit the SAME values the form holds through the same pure functions the button calls (validateForm -> buildCreateInput).
  const form = { ...DEFAULTS, c: '10', share: '50', fee: '3', bond: '48' };
  const valid = validateForm(form);
  if (!valid.value) throw new Error(`form invalid: ${JSON.stringify(valid.errors)}`);
  const nowSec = Number((await pub.getBlock()).timestamp);
  const created = await createCircle(ctx(-1), buildCreateInput(form, valid.value, { nowSec, demo: true }));
  if (!created.ok) throw new Error(`createCircle: ${created.code} ${created.message}`);
  const circle = created.circle;
  const dep = await depositBond(ctx(-1), circle, valid.value.bond);
  if (!dep.ok) throw new Error(`depositBond: ${dep.code} ${dep.message}`);
  console.log(`created with the form values: ${circle}`);

  const params = (await pub.readContract({ address: circle, abi: huiCircleFullAbi, functionName: 'params' })) as { commissionShareBps: number; feeBps: number; termsHash: string };
  check('on-chain phi from the form', params.commissionShareBps, 5000);
  check('on-chain fee ceiling', params.feeBps, 300);

  // 2. Forming: the invite page must say "Khớp thỏa thuận".
  await page.goto(`${WEB}/moi/${circle}`);
  await page.getByText('Khớp thỏa thuận').waitFor({ timeout: 30_000 });
  console.log('  ok  invite page shows "Khớp thỏa thuận" for the hash written by the form');
  await shoot(page, 'live-moi');

  for (let i = 0; i < 5; i++) {
    const r = await join(ctx(i), circle, { ageConfirmed: true });
    if (!r.ok) throw new Error(`join M${i + 1}: ${r.code} ${r.message}`);
  }
  const act = await activate(ctx(-1), circle);
  if (!act.ok) throw new Error(`activate: ${act.code} ${act.message}`);

  await page.goto(`${WEB}/circles/${circle}`);
  await page.getByRole('region', { name: 'Máy tính thăm' }).waitFor();
  await shoot(page, 'live-phong-nop-tham');

  // 3. Round 1: M3 bids 0.3 (cap 0,328767), round 2: M1 bids 0.2 (cap 0,246575).
  const bidders: [number, bigint][] = [[2, 300_000n], [0, 200_000n]];
  for (let k = 1; k <= 5; k++) {
    const b = bidders[k - 1];
    if (b) {
      const c = await commitBid(ctx(b[0]), circle, k, b[1]);
      if (!c.ok) throw new Error(`commit r${k}: ${c.code} ${c.message}`);
      await warp(91);
      const rv = await revealBid(ctx(b[0]), circle, k);
      if (!rv.ok) throw new Error(`reveal r${k}: ${rv.code} ${rv.message}`);
      await warp(90);
    } else {
      await warp(181);
    }
    if (k === 1 || k === 2) {
      await page.goto(`${WEB}/circles/${circle}`);
      await page.getByRole('region', { name: 'Máy tính thăm' }).waitFor({ timeout: 30_000 });
      await shoot(page, `live-phong-ky${k}`);
    }
    const s = await settleRound(ctx(-1), circle);
    if (!s.ok) throw new Error(`settle r${k}: ${s.code} ${s.message}`);
    const info = (await pub.readContract({ address: circle, abi: huiCircleFullAbi, functionName: 'roundInfo', args: [k] })) as { pot: bigint; fee: bigint; payout: bigint; holdback: bigint; premium: bigint };
    console.log(`  round ${k}: pot ${info.pot} fee ${info.fee} premium ${info.premium} holdback ${info.holdback} payout ${info.payout}`);
    if (k === 1) {
      // docs/03 8.1 scaled by 1/10 with a bid of 0.3: pot 38.8, fee min(1.315068, 3% x 38.8 = 1.164) = 1.164, payout 38.8 - 1.164 - 0.388 - 8
      check('round 1 pot', info.pot, 38_800_000n);
      check('round 1 fee (3% of the pot is the lower bound)', info.fee, 1_164_000n);
      check('round 1 payout', info.payout, 29_248_000n);
    }
    if (k === 2) {
      // L = 3, room = 0.4931506 x 3 = 1.4794518 (floor), phi x room = 0.7397259; pot = 3 x 9.8 + 10 = 39.4, 3% = 1.182 -> fee 0.739725
      check('round 2 fee = phi x room (below the 3% cap)', info.fee, 739_725n);
    }
  }
  await page.goto(`${WEB}/circles/${circle}/ket-qua`);
  await page.getByRole('heading', { name: /Kết quả kỳ/ }).waitFor({ timeout: 30_000 });
  await shoot(page, 'live-ket-qua');

  // 4. Close the circle: wait out the grace period, finalize.
  await warp(130);
  const fin = await finalize(ctx(-1), circle);
  if (!fin.ok) throw new Error(`finalize: ${fin.code} ${fin.message}`);
  const settledEvents = await pub.getContractEvents({ address: circle, abi: huiCircleFullAbi, eventName: 'ReserveShared', fromBlock: 0n });
  check('ReserveShared events (one per member without default)', settledEvents.length, 5);
  await page.goto(`${WEB}/circles/${circle}/tat-toan`);
  await page.getByText('Hoa hồng đã trả ngay lúc chi kỳ').waitFor({ timeout: 30_000 });
  const text = await page.locator('main').innerText();
  console.log(text.split('\n').filter((l) => /Hoa hồng|Ký quỹ trả lại|Thưởng/.test(l)).join('\n'));
  await shoot(page, 'live-tat-toan');
  await page.goto(`${WEB}/circles/${circle}/so-ho`);
  await page.getByText('Hoa hồng').first().waitFor({ timeout: 30_000 });
  await shoot(page, 'live-so-ho');
  const factoryCircles = await pub.readContract({ address: factory, abi: huiFactoryAbi, functionName: 'allCircles' });
  console.log(`circles in the directory: ${factoryCircles.length}`);

  await browser.close();
  console.log(failures === 0 ? 'B12 LIVE CHECK OK' : `B12 LIVE CHECK: ${failures} failure(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
