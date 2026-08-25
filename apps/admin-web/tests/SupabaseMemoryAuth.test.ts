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

    await expect(auth.signIn('administrator@example.test', 'secret')).resolves.toBe(true);
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
