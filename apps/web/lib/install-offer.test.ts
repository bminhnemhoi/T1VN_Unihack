import { describe, expect, it } from 'vitest';
import { DAY_MS, dayOf, detectInstallPlatform, readInstallMemory, shouldOfferInstall, withVisit, writeInstallMemory, type InstallState } from './install-offer';

const NOW = Date.UTC(2026, 10, 15, 9, 0, 0);
const ok: InstallState = {
  phone: true, standalone: false, installed: false, successSinceOffer: true, visitDays: 1, txBusy: false, onboardingOpen: false,
  pathname: '/circles', dismissedAt: [], now: NOW, platform: 'android',
};
const offer = (patch: Partial<InstallState>) => shouldOfferInstall({ ...ok, ...patch });

describe('shouldOfferInstall', () => {
  it('offers after a confirmed transaction', () => expect(offer({})).toBe(true));
  it('offers on the second visit day even without a transaction', () => expect(offer({ successSinceOffer: false, visitDays: 2 })).toBe(true));
  it('does not offer on the first visit without a success', () => expect(offer({ successSinceOffer: false, visitDays: 1 })).toBe(false));
  it.each([
    ['not a phone', { phone: false }],
    ['already an app', { standalone: true }],
    ['installed earlier', { installed: true }],
    ['on the landing', { pathname: '/' }],
    ['a transaction is going', { txBusy: true }],
    ['the guide is open', { onboardingOpen: true }],
    ['no install path on this browser', { platform: null }],
  ])('never: %s', (_n, patch) => expect(offer(patch)).toBe(false));

  it('stays quiet for 14 days after "Để sau", then asks again', () => {
    expect(offer({ dismissedAt: [NOW - 13 * DAY_MS] })).toBe(false);
    expect(offer({ dismissedAt: [NOW - 14 * DAY_MS] })).toBe(true);
  });
  it('asks at most 3 times in all', () => {
    expect(offer({ dismissedAt: [NOW - 60 * DAY_MS, NOW - 45 * DAY_MS] })).toBe(true);
    expect(offer({ dismissedAt: [NOW - 90 * DAY_MS, NOW - 60 * DAY_MS, NOW - 30 * DAY_MS] })).toBe(false);
  });
});

describe('detectInstallPlatform', () => {
  const iosSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const iosChrome = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
  it('iPhone Safari gets the share instructions, other iOS browsers get nothing', () => {
    expect(detectInstallPlatform(iosSafari, 5, false)).toBe('ios');
    expect(detectInstallPlatform(iosChrome, 5, false)).toBeNull();
  });
  it('Android needs the saved install prompt', () => {
    expect(detectInstallPlatform(android, 5, true)).toBe('android');
    expect(detectInstallPlatform(android, 5, false)).toBeNull();
  });
});

describe('install memory', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  it('round-trips, and survives garbage and a throwing store', () => {
    const st = mem();
    writeInstallMemory({ days: ['2026-11-14'], dismissedAt: [1], installed: false }, st);
    expect(readInstallMemory(st)).toEqual({ days: ['2026-11-14'], dismissedAt: [1], installed: false });
    st.m.set('huisafe.install', '{oops');
    expect(readInstallMemory(st)).toEqual({ days: [], dismissedAt: [], installed: false });
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(readInstallMemory(bad)).toEqual({ days: [], dismissedAt: [], installed: false });
    expect(() => writeInstallMemory({ days: [], dismissedAt: [], installed: false }, bad)).not.toThrow();
  });
  it('counts distinct local days only once each', () => {
    const a = withVisit({ days: [], dismissedAt: [], installed: false }, NOW);
    expect(withVisit(a, NOW + 60_000).days).toEqual([dayOf(NOW)]);
    expect(withVisit(a, NOW + 2 * DAY_MS).days).toHaveLength(2);
  });
});
