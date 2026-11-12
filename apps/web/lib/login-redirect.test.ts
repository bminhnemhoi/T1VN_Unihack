import { describe, expect, it } from 'vitest';
import { loginRedirect } from './login-redirect';

describe('loginRedirect', () => {
  it('sends a signed-in user to their circles', () => {
    expect(loginRedirect('ready', true)).toBe('/circles');
  });
  it('sends a signed-in user back to the invite they came from', () => {
    expect(loginRedirect('ready', true, '/moi/dang-gom')).toBe('/moi/dang-gom');
  });
  it('keeps the login page while signing in is still needed', () => {
    expect(loginRedirect('loading', false)).toBeNull();
    expect(loginRedirect('logged-out', false)).toBeNull();
    expect(loginRedirect('ready', false)).toBeNull();
  });
});
