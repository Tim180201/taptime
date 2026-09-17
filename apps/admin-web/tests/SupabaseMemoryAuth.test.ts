import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  createClient: vi.fn(),
  signInWithPassword: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  setSession: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: sdk.createClient }));

import { SupabaseMemoryAuth } from '../src/SupabaseMemoryAuth';

describe('SupabaseMemoryAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.createClient.mockReturnValue({
      auth: {
        signInWithPassword: sdk.signInWithPassword,
        getSession: sdk.getSession,
        signOut: sdk.signOut,
        resetPasswordForEmail: sdk.resetPasswordForEmail,
        setSession: sdk.setSession,
        updateUser: sdk.updateUser,
      },
    });
    sdk.signInWithPassword.mockResolvedValue({ error: null, data: { session: { access_token: 'memory-token' } } });
    sdk.getSession.mockResolvedValue({ data: { session: { access_token: 'memory-token' } } });
    sdk.signOut.mockResolvedValue({ error: null });
    sdk.resetPasswordForEmail.mockResolvedValue({ error: null });
    sdk.setSession.mockResolvedValue({ error: null, data: { session: { access_token: 'recovery' } } });
    sdk.updateUser.mockResolvedValue({ error: null });
  });

  it('constructs Supabase with memory-only auth and no URL session detection', () => {
    new SupabaseMemoryAuth('https://example.supabase.co', 'publishable-key');

    expect(sdk.createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'publishable-key',
      { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } },
    );
  });

  it('keeps token access callback-scoped and signs out only the local browser session', async () => {
    const auth = new SupabaseMemoryAuth('https://example.supabase.co', 'publishable-key');

    await expect(auth.signIn('administrator@example.test', 'secret')).resolves.toBe('signed_in');
    await expect(auth.withAccessToken(async (token) => `used:${token}`)).resolves.toBe('used:memory-token');
    await auth.signOut();

    expect(sdk.signInWithPassword).toHaveBeenCalledWith({ email: 'administrator@example.test', password: 'secret' });
    expect(sdk.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('consumes only an explicit recovery fragment while global URL detection stays disabled', async () => {
    const clearRecoveryUrl = vi.fn();
    const listener = vi.fn();
    const auth = new SupabaseMemoryAuth(
      'https://example.supabase.co',
      'publishable-key',
      {
        recoveryUrl: () => 'https://admin.tb-infra.de/#access_token=aaaaaaaaaaaaaaaa&refresh_token=bbbbbbbbbbbbbbbb&type=recovery&token_type=bearer',
        clearRecoveryUrl,
      },
    );
    auth.subscribePasswordRecovery(listener);

    await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce());
    expect(clearRecoveryUrl).toHaveBeenCalledOnce();
    expect(sdk.setSession).toHaveBeenCalledWith({
      access_token: 'aaaaaaaaaaaaaaaa',
      refresh_token: 'bbbbbbbbbbbbbbbb',
    });
    await expect(auth.updateRecoveredPassword('new-memory-secret')).resolves.toBe(true);
    expect(sdk.updateUser).toHaveBeenCalledWith({ password: 'new-memory-secret' });
    expect(sdk.signOut).not.toHaveBeenCalled();
  });

  it('ignores non-recovery and malformed fragments without clearing the address bar', async () => {
    const clearRecoveryUrl = vi.fn();
    new SupabaseMemoryAuth('https://example.supabase.co', 'publishable-key', {
      recoveryUrl: () => 'https://admin.tb-infra.de/#access_token=aaaaaaaaaaaaaaaa&refresh_token=bbbbbbbbbbbbbbbb&type=signup',
      clearRecoveryUrl,
    });
    await Promise.resolve();
    expect(sdk.setSession).not.toHaveBeenCalled();
    expect(clearRecoveryUrl).not.toHaveBeenCalled();
  });

  it('requests a provider reset without revealing whether the email exists', async () => {
    const auth = new SupabaseMemoryAuth('https://example.supabase.co', 'publishable-key');
    await expect(auth.requestPasswordReset('administrator@example.test')).resolves.toBe(true);
    expect(sdk.resetPasswordForEmail).toHaveBeenCalledWith('administrator@example.test');
  });
});

describe('SupabaseMemoryAuth sign-in outcomes (T-040)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.createClient.mockReturnValue({
      auth: {
        signInWithPassword: sdk.signInWithPassword,
        getSession: sdk.getSession,
        signOut: sdk.signOut,
        resetPasswordForEmail: sdk.resetPasswordForEmail,
        setSession: sdk.setSession,
        updateUser: sdk.updateUser,
      },
    });
  });

  const auth = () => new SupabaseMemoryAuth('https://example.supabase.co', 'publishable-key');
  const failing = (error: { status?: number; code?: string }) =>
    sdk.signInWithPassword.mockResolvedValue({ error, data: { session: null, user: null } });

  it.each([
    [{ status: 400, code: 'invalid_credentials' }, 'credentials_rejected'],
    [{ status: 400, code: 'email_not_confirmed' }, 'email_not_confirmed'],
    [{ status: 403, code: 'user_banned' }, 'access_blocked'],
    [{ status: 429, code: 'over_request_rate_limit' }, 'rate_limited'],
    [{ status: 429 }, 'rate_limited'],
    [{ status: 400 }, 'credentials_rejected'],
    [{ status: 400, code: 'validation_failed' }, 'credentials_rejected'],
    // Review round 2 (Codex): a disabled provider, a rejected API key or an unknown 4xx code is
    // never the user's fault. Before the fix these three read as wrong credentials.
    [{ status: 422, code: 'email_provider_disabled' }, 'service_unavailable'],
    [{ status: 401, code: 'invalid_api_key' }, 'service_unavailable'],
    [{ status: 401 }, 'service_unavailable'],
    [{ status: 400, code: 'some_new_code' }, 'service_unavailable'],
    [{ status: 503 }, 'service_unavailable'],
    [{ status: 540, code: 'some_unknown_code' }, 'service_unavailable'],
    [{ status: 0 }, 'service_unavailable'],
    [{}, 'service_unavailable'],
  ] as const)('maps %o to %s', async (error, outcome) => {
    failing(error);
    await expect(auth().signIn('a@example.test', 'pw')).resolves.toBe(outcome);
  });

  it('treats a thrown transport error as unavailable, not as rejected credentials', async () => {
    sdk.signInWithPassword.mockRejectedValue(new TypeError('fetch failed'));
    await expect(auth().signIn('a@example.test', 'pw')).resolves.toBe('service_unavailable');
  });

  it('treats a success without a session as unavailable', async () => {
    sdk.signInWithPassword.mockResolvedValue({ error: null, data: { session: null, user: null } });
    await expect(auth().signIn('a@example.test', 'pw')).resolves.toBe('service_unavailable');
  });
});
