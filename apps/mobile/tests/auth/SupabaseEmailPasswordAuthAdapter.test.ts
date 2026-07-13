import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native-url-polyfill/auto', () => ({}));

import { SupabaseEmailPasswordAuthAdapter } from '../../src/auth/SupabaseEmailPasswordAuthAdapter';

function providerSession(accessToken = 'access-token', refreshToken = 'refresh-token') {
  return { access_token: accessToken, refresh_token: refreshToken };
}

function fakeAuth(overrides: Record<string, unknown> = {}) {
  return {
    signInWithPassword: vi.fn(async () => ({ data: { session: providerSession() }, error: null })),
    refreshSession: vi.fn(async () => ({ data: { session: providerSession() }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    startAutoRefresh: vi.fn(async () => undefined),
    stopAutoRefresh: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('SupabaseEmailPasswordAuthAdapter', () => {
  it('calls only signInWithPassword with the exact email and password', async () => {
    const auth = fakeAuth();
    const adapter = new SupabaseEmailPasswordAuthAdapter(auth as never);

    await expect(adapter.signInWithPassword('employee@example.invalid', 'exact-password'))
      .resolves.toEqual({
        status: 'authenticated',
        tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
      });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'employee@example.invalid',
      password: 'exact-password',
    });
  });

  it('keeps invalid credentials distinct from provider infrastructure failure', async () => {
    const invalid = fakeAuth({
      signInWithPassword: vi.fn(async () => ({
        data: { session: null }, error: { code: 'invalid_credentials', message: 'provider text' },
      })),
    });
    await expect(new SupabaseEmailPasswordAuthAdapter(invalid as never)
      .signInWithPassword('a@example.invalid', 'bad'))
      .resolves.toEqual({ status: 'invalid_credentials' });

    const unavailable = fakeAuth({
      signInWithPassword: vi.fn(async () => ({
        data: { session: null }, error: { code: 'unexpected_failure', message: 'secret detail' },
      })),
    });
    await expect(new SupabaseEmailPasswordAuthAdapter(unavailable as never)
      .signInWithPassword('a@example.invalid', 'bad'))
      .rejects.toThrow('Authentication provider sign-in is unavailable');

    const malformed = fakeAuth({
      signInWithPassword: vi.fn(async () => ({ data: { session: null }, error: null })),
    });
    await expect(new SupabaseEmailPasswordAuthAdapter(malformed as never)
      .signInWithPassword('a@example.invalid', 'password'))
      .rejects.toThrow('incomplete session');
  });

  it('refreshes with only the supplied refresh token and returns the rotation', async () => {
    const auth = fakeAuth({
      refreshSession: vi.fn(async () => ({
        data: { session: providerSession('new-access', 'new-refresh') }, error: null,
      })),
    });
    const adapter = new SupabaseEmailPasswordAuthAdapter(auth as never);

    await expect(adapter.refreshSession('old-refresh')).resolves.toEqual({
      status: 'refreshed',
      tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' },
    });
    expect(auth.refreshSession).toHaveBeenCalledWith({ refresh_token: 'old-refresh' });
  });

  it.each(['session_expired', 'user_banned', 'refresh_token_already_used'])(
    'maps terminal refresh error %s to a rejected session',
    async (code) => {
      const auth = fakeAuth({
        refreshSession: vi.fn(async () => ({ data: { session: null }, error: { code } })),
      });
      await expect(new SupabaseEmailPasswordAuthAdapter(auth as never)
        .refreshSession('expired-refresh')).resolves.toEqual({ status: 'rejected' });
    },
  );

  it('uses provider-local sign-out only', async () => {
    const auth = fakeAuth();
    await new SupabaseEmailPasswordAuthAdapter(auth as never).signOutLocal();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('maps only refresh and signed-out provider events and unsubscribes', () => {
    const unsubscribe = vi.fn();
    let callback: ((event: string, session: unknown) => void) | null = null;
    const auth = fakeAuth({
      onAuthStateChange: vi.fn((listener) => {
        callback = listener;
        return { data: { subscription: { unsubscribe } } };
      }),
    });
    const listener = vi.fn();
    const dispose = new SupabaseEmailPasswordAuthAdapter(auth as never).subscribe(listener);

    const emit = callback as unknown as (event: string, session: unknown) => void;
    emit('SIGNED_IN', providerSession());
    emit('TOKEN_REFRESHED', providerSession('rotated-access', 'rotated-refresh'));
    emit('SIGNED_OUT', null);

    expect(listener).toHaveBeenNthCalledWith(1, {
      type: 'token_refreshed',
      tokens: { accessToken: 'rotated-access', refreshToken: 'rotated-refresh' },
    });
    expect(listener).toHaveBeenNthCalledWith(2, { type: 'signed_out' });
    dispose();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('awaits explicit auto-refresh lifecycle calls', async () => {
    const auth = fakeAuth();
    const adapter = new SupabaseEmailPasswordAuthAdapter(auth as never);
    await adapter.startAutoRefresh();
    await adapter.stopAutoRefresh();
    expect(auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
  });
});
