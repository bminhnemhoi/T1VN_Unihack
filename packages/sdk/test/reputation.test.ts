import { describe, expect, it } from 'vitest';
import { memberTier, organizerTier, summarizeOrganizerCircle, type MemberReputationInput } from '../src/reputation';
import type { CircleEvent } from '../src/read';

const NOW = 1_800_000_000;
const SIX = 183 * 86_400;
const base: MemberReputationInput = { completed: 0, onTime: 0, late: 0, defaults: 0, unpaidDebt: 0n, nowSec: NOW };

describe('memberTier', () => {
  it('0 completed is Mới and points to Tin cậy', () => {
    const r = memberTier(base);
    expect(r.tier).toBe('new');
    expect(r.next?.tier).toBe('trusted');
    expect(r.next?.missing.length).toBeGreaterThan(0);
    expect(r.redFlag).toBe(false);
  });
  it('completed 2 is still Mới, 3 with clean record is Tin cậy', () => {
    expect(memberTier({ ...base, completed: 2, onTime: 20 }).tier).toBe('new');
    expect(memberTier({ ...base, completed: 3, onTime: 20 }).tier).toBe('trusted');
  });
  it('on-time ratio boundary: 95/100 passes, 94/100 fails, no data fails', () => {
    expect(memberTier({ ...base, completed: 3, onTime: 95, late: 5 }).tier).toBe('trusted');
    expect(memberTier({ ...base, completed: 3, onTime: 94, late: 6 }).tier).toBe('new');
    expect(memberTier({ ...base, completed: 3, onTime: 0, late: 0 }).tier).toBe('new');
  });
  it('one default blocks Tin cậy', () => {
    const r = memberTier({ ...base, completed: 5, onTime: 50, defaults: 1 });
    expect(r.tier).toBe('new');
    expect(r.next?.missing.join(' ')).toContain('vỡ nợ');
  });
  it('Lâu năm needs 10 completed, 6 months and no debt', () => {
    const v = { ...base, completed: 10, onTime: 100, firstEventAt: NOW - SIX };
    expect(memberTier(v).tier).toBe('veteran');
    expect(memberTier(v).next).toBeNull();
    expect(memberTier({ ...v, completed: 9 }).tier).toBe('trusted');
    expect(memberTier({ ...v, firstEventAt: NOW - SIX + 1 }).tier).toBe('trusted');
    expect(memberTier({ ...v, firstEventAt: undefined }).tier).toBe('trusted');
    const debt = memberTier({ ...v, unpaidDebt: 1n });
    expect(debt.tier).toBe('trusted');
    expect(debt.redFlag).toBe(true);
    expect(debt.next?.tier).toBe('veteran');
  });
});

describe('organizerTier', () => {
  const o = { finishedCircles: 0, circlesBondUsedForDefault: 0, unpaidDefault: false, nowSec: NOW };
  it('boundaries', () => {
    expect(organizerTier(o).tier).toBe('new');
    expect(organizerTier({ ...o, finishedCircles: 2 }).tier).toBe('new');
    expect(organizerTier({ ...o, finishedCircles: 3 }).tier).toBe('trusted');
    expect(organizerTier({ ...o, finishedCircles: 3, circlesBondUsedForDefault: 1 }).tier).toBe('new');
    const v = { ...o, finishedCircles: 10, firstCircleAt: NOW - SIX };
    expect(organizerTier(v).tier).toBe('veteran');
    expect(organizerTier({ ...v, finishedCircles: 9 }).tier).toBe('trusted');
    expect(organizerTier({ ...v, firstCircleAt: NOW - SIX + 1 }).tier).toBe('trusted');
    expect(organizerTier({ ...v, unpaidDefault: true }).redFlag).toBe(true);
  });
});

const ev = (eventName: string, args: Record<string, unknown>): CircleEvent => ({
  eventName,
  args,
  blockNumber: 1n,
  logIndex: 0,
  txHash: '0x00',
});

describe('summarizeOrganizerCircle', () => {
  it('finished only with CircleFinalized', () => {
    expect(summarizeOrganizerCircle([]).finished).toBe(false);
    expect(summarizeOrganizerCircle([ev('CircleFinalized', {})]).finished).toBe(true);
  });
  it('bond cover counts only for a member who defaulted', () => {
    const cover = ev('ShortfallCovered', { member: '0xAA', source: 1 });
    expect(summarizeOrganizerCircle([cover]).bondUsedForDefault).toBe(false);
    expect(summarizeOrganizerCircle([cover, ev('MemberDefaulted', { member: '0xaa' })]).bondUsedForDefault).toBe(true);
    const holdbackCover = ev('ShortfallCovered', { member: '0xAA', source: 0 });
    expect(summarizeOrganizerCircle([holdbackCover, ev('MemberDefaulted', { member: '0xaa' })]).bondUsedForDefault).toBe(false);
  });
});
