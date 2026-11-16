import { describe, expect, it } from 'vitest';
import { feedOf, ledgerOf, usdc2 } from '@/lib/app-data';
import { tabOf } from '@/lib/app-tabs';
import { bidQuote } from '@/lib/hui-calc';
import { usdc } from '@/lib/sample';
import { getSampleCircle } from '@/lib/sample-circles';

// docs/03 section 8, branch B: M4 takes kỳ 1 (bid 6), M1 takes kỳ 2 (bid 3), M4 misses kỳ 2 (80 holdback + 20 bond).
const demo = getSampleCircle('demo');

describe('ledgerOf (Sổ hụi)', () => {
  const { cells, bond, k } = ledgerOf(demo);
  it('puts the worked example in the right cells', () => {
    expect(k).toBe(3);
    expect(cells[3]![0]).toMatchObject({ kind: 'win', v: '+288,48', note: 'hốt với thăm 6,00' });
    expect(cells[0]![1]).toMatchObject({ kind: 'win', v: '+323,18' });
    expect(cells[3]![1]).toMatchObject({ kind: 'miss', v: '−100,00' });
    expect(cells[3]![1]!.note).toContain('80,00 từ tiền giữ lại + 20,00 từ ký quỹ');
    expect(cells[1]![0]).toMatchObject({ kind: 'pay', v: '−94,00' });
    expect(cells[1]![1]).toMatchObject({ kind: 'pay', v: '−97,00' });
  });
  it('marks the running round and what is still to come', () => {
    expect(cells[3]![2]).toMatchObject({ kind: 'miss', v: '—' });
    expect(cells[0]![2]!.note).toContain('sẽ góp đủ 100,00');
    expect(cells[1]![3]!.kind).toBe('later');
  });
  it('tracks the bond after every settled round', () => {
    expect(bond).toEqual([usdc(480), usdc(460), null, null, null]);
  });
});

describe('feedOf (Vừa xảy ra)', () => {
  it('lists the newest round first with the receipt numbers', () => {
    const feed = feedOf(demo);
    expect(feed[0]!.k).toBe(2);
    expect(feed.find((b) => b.text === 'Hốt với thăm 3,00')!.v).toBe('323,18');
    expect(feed.find((b) => b.text === 'Quá ân hạn, ghi vỡ nợ')!.v).toBe('−100,00');
    expect(feed.find((b) => b.text.startsWith('Ký quỹ bù'))!.text).toBe('Ký quỹ bù 20,00 cho M4');
    expect(feed.at(-1)!.text).toBe('Hốt với thăm 6,00');
  });
});

describe('the bid estimate of kỳ 3', () => {
  it('pays 346,12 USDC for a bid of 3 (pot 2 × 97 + 2 × 100)', () => {
    const q = bidQuote(demo.terms, 3, usdc(3));
    expect(usdc2(q.pot)).toBe('394,00');
    expect(usdc2(q.payout)).toBe('346,12');
  });
});

describe('tabOf', () => {
  it('maps every app path to its tab', () => {
    expect(tabOf('/circles')).toBe('tong-quan');
    expect(tabOf('/circles/new')).toBe('tao');
    expect(tabOf('/circles/demo')).toBe('day');
    expect(tabOf('/circles/demo/bao-chung')).toBe('day');
    expect(tabOf('/circles/demo/so-ho')).toBe('so-hui');
    expect(tabOf('/lab')).toBeNull();
  });
});

describe('ledger of a circle that never ran (bug 16/11: cancelled circle showed "đang chạy")', () => {
  it('a cancelled circle has no running round: every cell is "later" and says why', () => {
    const { cells, k } = ledgerOf(getSampleCircle('da-huy'));
    expect(k).toBe(0);
    expect(cells.flat().every((x) => x.kind === 'later')).toBe(true);
    expect(cells[0]![0]!.note).toBe('dây đã hủy trước khi chạy');
  });
  it('a gathering circle has no running round either', () => {
    const { cells, k } = ledgerOf(getSampleCircle('dang-gom'));
    expect(k).toBe(0);
    expect(cells.flat().every((x) => x.kind === 'later')).toBe(true);
  });
});
