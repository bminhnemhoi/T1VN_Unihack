import { describe, expect, it } from 'vitest';
import { loginAction, privyStatus } from './privyStatus';

const base = { ready: true, authenticated: true, hasWallet: false, stuck: false };

describe('privyStatus (issue #6: signed in at Privy, embedded wallet not there)', () => {
  it('is loading until Privy is ready', () => {
    expect(privyStatus({ ...base, ready: false })).toBe('loading');
  });
  it('is ready with a session and a wallet', () => {
    expect(privyStatus({ ...base, hasWallet: true })).toBe('ready');
  });
  it('is logged-out with no session', () => {
    expect(privyStatus({ ...base, authenticated: false })).toBe('logged-out');
  });
  it('shows loading (wallet being created) right after sign-in, not "Chưa đăng nhập"', () => {
    expect(privyStatus(base)).toBe('loading');
  });
  it('falls back to logged-out when wallet creation hangs, so the login button is offered again', () => {
    expect(privyStatus({ ...base, stuck: true })).toBe('logged-out');
  });
});

describe('loginAction', () => {
  it('logs in normally without a session', () => {
    expect(loginAction({ authenticated: false, hasWallet: false })).toBe('login');
  });
  it('resets the session first when signed in without a wallet (Privy ignores login() while a session exists)', () => {
    expect(loginAction({ authenticated: true, hasWallet: false })).toBe('reset-then-login');
  });
});
