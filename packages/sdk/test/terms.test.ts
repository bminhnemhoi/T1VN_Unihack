import { readFileSync } from 'node:fs';
import { keccak256, toBytes } from 'viem';
import { describe, expect, it } from 'vitest';
import { DEMO_TERMS_INPUT, buildTermsText, termsHashOf, termsInputOfView, verifyTerms, type TermsInput } from '../src/terms';

const base: TermsInput = {
  mode: 'bidding',
  memberCount: 5,
  contribution: 100_000_000n,
  periodSeconds: 2_592_000,
  roundDuration: 2_592_000,
  commitWindow: 1_296_000,
  revealWindow: 648_000,
  alphaBps: 2000,
  commissionMode: true,
  feeBps: 100,
  commissionShareBps: 0,
  reserveBps: 100,
  revealBondBps: 100,
  capBps: 2000,
  graceSeconds: 172_800,
};

describe('circle terms text and hash (ADR-27)', () => {
  it('is deterministic and hashes the UTF-8 text', () => {
    const a = buildTermsText(base);
    expect(buildTermsText({ ...base })).toBe(a);
    expect(termsHashOf(a)).toBe(keccak256(toBytes(a)));
    expect(termsHashOf(a)).not.toBe(`0x${'00'.repeat(32)}`);
  });

  it('changes when any parameter a member relies on changes (audit L-02)', () => {
    const h = (t: TermsInput) => termsHashOf(buildTermsText(t));
    const original = h(base);
    const variants: Partial<TermsInput>[] = [
      { mode: 'fixed' },
      { memberCount: 6 },
      { contribution: 101_000_000n },
      { periodSeconds: 2_678_400 },
      { roundDuration: 1_296_000 },
      { commitWindow: 864_000 },
      { revealWindow: 432_000 },
      { graceSeconds: 86_400 },
      { alphaBps: 3000 },
      { commissionMode: false },
      { feeBps: 200 },
      { commissionShareBps: 5000, feeBps: 300 },
      { reserveBps: 200 },
      { revealBondBps: 200 },
      { capBps: 1500 },
    ];
    for (const v of variants) expect(h({ ...base, ...v }), JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x))).not.toBe(original);
  });

  it('states phi, the bid share left to members and the fallback order', () => {
    const text = buildTermsText({ ...base, commissionShareBps: 5000, feeBps: 300 });
    expect(text).toContain('50% quỹ lãi');
    expect(text).toContain('thăm tối đa là 50% trần luật');
    expect(text).toContain('thứ tự vào dây');
    expect(text).toContain('100 USDC');
  });

  it('states round length, bid windows, reveal bond, reserve rule and the on-time split', () => {
    const text = buildTermsText(base);
    expect(text).toContain('Thời gian thật giữa hai kỳ: 30 ngày');
    expect(text).toContain('Nộp thăm kín trong 15 ngày đầu của kỳ, mở thăm trong 180 giờ kế tiếp');
    expect(text).toContain('Cọc mở thăm: 1% mức góp');
    expect(text).toContain('Quỹ dự phòng: 1% pot mỗi kỳ');
    expect(text).toContain('trọng số của mỗi thành viên là số phần còn lại sau khi trừ số lần trễ (tối đa 4, thấp nhất 0)');
    expect(text).toContain('người vỡ nợ nhận 0');
    expect(text).toContain('Trần lãi năm: 20%');
  });

  it('does not render the 120 s demo grace as 0 hours', () => {
    expect(buildTermsText({ ...base, graceSeconds: 120 })).toContain('Ân hạn trả trễ: 2 phút');
    expect(buildTermsText(base)).toContain('Ân hạn trả trễ: 48 giờ');
  });

  it('a fixed circle has no bid windows or reveal bond', () => {
    const text = buildTermsText({ ...base, mode: 'fixed', commitWindow: 0, revealWindow: 0, revealBondBps: 0, capBps: 0 });
    expect(text).toContain('Không có bỏ thăm và không có cọc mở thăm');
    expect(text).not.toContain('Nộp thăm kín');
  });
});

describe('verifyTerms', () => {
  it('matches when the stored hash is the hash of the standard text of the same parameters', () => {
    const r = verifyTerms({ ...base, termsHash: termsHashOf(buildTermsText(base)) });
    expect(r.match).toBe(true);
    expect(r.expected).toBe(r.actual);
    expect(r.text).toBe(buildTermsText(base));
  });

  it('flags a hash of some other document, or of the same text with a different parameter', () => {
    expect(verifyTerms({ ...base, termsHash: termsHashOf('any other agreement') }).match).toBe(false);
    expect(verifyTerms({ ...base, alphaBps: 1000, termsHash: termsHashOf(buildTermsText(base)) }).match).toBe(false);
  });

  it('compares hex case-insensitively', () => {
    const h = termsHashOf(buildTermsText(base));
    expect(verifyTerms({ ...base, termsHash: `0x${h.slice(2).toUpperCase()}` as `0x${string}` }).match).toBe(true);
  });

  it('termsInputOfView maps a CircleView so the UI can verify what readCircle returned', () => {
    const hash = termsHashOf(buildTermsText(base));
    const view = {
      mode: 'bidding' as const,
      params: {
        N: 5,
        C: 100_000_000n,
        periodSeconds: 2_592_000,
        roundDuration: 2_592_000,
        commitWindow: 1_296_000,
        revealWindow: 648_000,
        graceSeconds: 172_800,
        alphaBps: 2000,
        commissionMode: true,
        feeBps: 100,
        commissionShareBps: 0,
        reserveBps: 100,
        revealBondBps: 100,
        capBps: 2000,
        termsHash: hash,
      },
    };
    const input = termsInputOfView(view);
    expect(verifyTerms({ ...input, termsHash: input.termsHash! }).match).toBe(true);
  });
});

describe('demo circle terms (shared with script/CreateDemoCircle.s.sol)', () => {
  const vector = JSON.parse(readFileSync(new URL('../../../contracts/test/vectors/terms.json', import.meta.url), 'utf8')) as {
    demo: { text: string; hash: `0x${string}` };
  };
  const script = readFileSync(new URL('../../../contracts/script/CreateDemoCircle.s.sol', import.meta.url), 'utf8');

  it('the pinned vector is exactly what the SDK builds (re-run `pnpm --filter sdk generate:terms` after editing the text)', () => {
    expect(buildTermsText(DEMO_TERMS_INPUT)).toBe(vector.demo.text);
    expect(termsHashOf(vector.demo.text)).toBe(vector.demo.hash);
  });

  it('CreateDemoCircle.s.sol hardcodes that very hash and no longer a free string', () => {
    const m = /DEMO_TERMS_HASH\s*=\s*(0x[0-9a-fA-F]{64})/.exec(script);
    expect(m?.[1]?.toLowerCase()).toBe(vector.demo.hash.toLowerCase());
    expect(script).toContain('termsHash: DEMO_TERMS_HASH');
    expect(script).not.toMatch(/termsHash:\s*keccak256\(/);
  });
});
