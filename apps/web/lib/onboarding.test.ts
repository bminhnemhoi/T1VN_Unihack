import { describe, expect, it } from 'vitest';
import { isBusyRoute, markOnboarded, needsFaucet, onboardedKey, readOnboarded, shouldAutoShowOnboarding, stepsFor, tourAction } from './onboarding';

const mem = () => {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const base = { signedIn: true, circlesLoaded: true, circleCount: 0, onboarded: false as boolean | null, busyRoute: false };

describe('onboarding flag (localStorage)', () => {
  it('keys on the lower-cased address', () => {
    expect(onboardedKey('0xABC')).toBe('huisafe.onboarded.0xabc');
  });
  it('is unseen until marked, then seen for that wallet only', () => {
    const st = mem();
    expect(readOnboarded('0xAb', st)).toBe(false);
    markOnboarded('0xAb', { played: 'new', purpose: 'look' }, st);
    expect(readOnboarded('0xab', st)).toBe(true);
    expect(readOnboarded('0xcd', st)).toBe(false);
    expect(JSON.parse(st.m.get('huisafe.onboarding.0xab')!)).toEqual({ played: 'new', purpose: 'look' });
  });
  it('no storage at all: null, and marking does not throw', () => {
    expect(readOnboarded('0xab', null)).toBeNull();
    expect(() => markOnboarded('0xab', {}, null)).not.toThrow();
  });
  it('a storage that throws counts as no storage', () => {
    const bad = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readOnboarded('0xab', bad)).toBeNull();
    expect(() => markOnboarded('0xab', {}, bad)).not.toThrow();
  });
});

describe('shouldAutoShowOnboarding', () => {
  it('opens for a signed-in wallet with no circle and no flag', () => {
    expect(shouldAutoShowOnboarding(base)).toBe(true);
  });
  it.each([
    ['signed out', { signedIn: false }],
    ['circles still loading', { circlesLoaded: false }],
    ['already in a circle', { circleCount: 1 }],
    ['already seen', { onboarded: true }],
    ['no usable storage', { onboarded: null }],
    ['busy route (invite, login)', { busyRoute: true }],
  ])('stays closed: %s', (_n, patch) => {
    expect(shouldAutoShowOnboarding({ ...base, ...patch })).toBe(false);
  });
  it('knows the busy routes', () => {
    expect(isBusyRoute('/dang-nhap')).toBe(true);
    expect(isBusyRoute('/moi/0xabc')).toBe(true);
    expect(isBusyRoute('/circles')).toBe(false);
  });
});

describe('steps and last screen', () => {
  it('the "new" path has four cards, the "played" path one', () => {
    expect(stepsFor('new')).toEqual(['q-played', 'q-purpose', 'learn-1', 'learn-2', 'learn-3', 'learn-4', 'tour']);
    expect(stepsFor('played')).toEqual(['q-played', 'q-purpose', 'played', 'tour']);
    expect(stepsFor(undefined)).toEqual(stepsFor('new'));
  });
  it('the main button follows answer 2', () => {
    expect(tourAction('invite', true)).toEqual({ label: 'Dán link mời', href: null });
    expect(tourAction('own', true)).toEqual({ label: 'Mở dây đầu tiên', href: '/circles/new' });
    expect(tourAction('look', false)).toEqual({ label: 'Xem dây mẫu', href: '/circles/demo' });
    expect(tourAction('look', true).href).toMatch(/^\/circles\/0x[0-9a-fA-F]{40}$/);
  });
  it('points to the faucet only when the balance is exactly zero', () => {
    expect(needsFaucet(0n)).toBe(true);
    expect(needsFaucet(1n)).toBe(false);
    expect(needsFaucet(undefined)).toBe(false);
  });
});
